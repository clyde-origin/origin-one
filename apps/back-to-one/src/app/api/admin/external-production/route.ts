import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { onboardRequestSchema, isAdminEmail } from '@/lib/admin/onboard-validation'
import { renderInviteEmail } from '@/lib/email/templates/external-production-invite'
import { sendEmail } from '@/lib/email/send-email'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  // 1. Parse body + zod-validate
  const body = await request.json().catch(() => null)
  const parsed = onboardRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid request', issues: parsed.error.issues },
      { status: 400 }
    )
  }
  const { companyName, projectName, producers } = parsed.data

  // 2. Resolve caller via Supabase auth cookies
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) { cookieStore.set(name, value, options) },
        remove(name: string, options: CookieOptions) { cookieStore.set(name, '', { ...options, maxAge: 0 }) },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) {
    return NextResponse.json({ error: 'auth required' }, { status: 401 })
  }

  // 3. Admin allowlist gate (UI is convenience; THIS is security)
  if (!isAdminEmail(user.email, process.env.ADMIN_EMAILS)) {
    return NextResponse.json({ error: 'not authorized' }, { status: 403 })
  }

  // 4. Required env: ORIGIN_TEAM_ID (which team owns the demo seeds)
  const originTeamId = process.env.ORIGIN_TEAM_ID
  if (!originTeamId) {
    console.error('ORIGIN_TEAM_ID not configured')
    return NextResponse.json({ error: 'server misconfigured' }, { status: 500 })
  }

  // 5. Resolve caller's User.id (rpc needs it for the caller-as-producer row)
  const { data: callerUser, error: callerErr } = await supabase
    .from('User').select('id').eq('authId', user.id).single()
  if (callerErr || !callerUser) {
    console.error('caller User row lookup failed', callerErr)
    return NextResponse.json({ error: 'caller user not found' }, { status: 500 })
  }

  // 6. Run the rpc — DB transaction commits or rolls back as a unit
  const { data: rpcData, error: rpcErr } = await supabase.rpc('onboard_external_production', {
    p_caller_user_id: callerUser.id,
    p_company_name: companyName,
    p_project_name: projectName,
    p_producers: producers,
    p_origin_team_id: originTeamId,
  })
  if (rpcErr) {
    console.error('onboard rpc failed', rpcErr)
    return NextResponse.json({ error: 'creation failed' }, { status: 500 })
  }

  // 7. Send branded magic-link emails (best-effort, post-commit)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const origin = request.nextUrl.origin
  const emailResults: Array<{ email: string; ok: boolean; reason?: string }> = []

  for (const producer of producers) {
    try {
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: producer.email,
        options: { redirectTo: `${origin}/auth/callback?redirect=/projects` },
      })
      if (linkErr || !linkData?.properties?.action_link) {
        emailResults.push({ email: producer.email, ok: false, reason: linkErr?.message ?? 'no link' })
        continue
      }
      const rendered = renderInviteEmail({
        producerName: producer.name,
        productionName: companyName,
        magicLink: linkData.properties.action_link,
        heroImageUrl: `${origin}/images/b21_bg.jpg`,
      })
      const sendResult = await sendEmail({
        to: producer.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      })
      emailResults.push({
        email: producer.email,
        ok: sendResult.ok,
        reason: sendResult.ok ? undefined : sendResult.error,
      })
    } catch (err) {
      emailResults.push({
        email: producer.email,
        ok: false,
        reason: err instanceof Error ? err.message : 'unknown error',
      })
    }
  }

  return NextResponse.json({
    ok: true,
    ...(rpcData as Record<string, unknown>),
    emails: emailResults,
  })
}
