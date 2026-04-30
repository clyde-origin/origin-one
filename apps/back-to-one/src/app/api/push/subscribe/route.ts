import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function makeServerClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) { cookieStore.set(name, value, options) },
        remove(name: string, options: CookieOptions) { cookieStore.set(name, '', { ...options, maxAge: 0 }) },
      },
    },
  )
}

interface SubscribeBody {
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string
}

export async function POST(req: Request) {
  const supabase = makeServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let body: SubscribeBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  if (!body.endpoint || !body.p256dh || !body.auth) {
    return NextResponse.json({ error: 'missing required fields' }, { status: 400 })
  }

  const { data: appUser, error: userErr } = await supabase
    .from('User').select('id').eq('authId', user.id).single()
  if (userErr || !appUser) return NextResponse.json({ error: 'user row not found' }, { status: 404 })

  const { error: upsertErr } = await supabase
    .from('PushSubscription')
    .upsert({
      userId: appUser.id,
      endpoint: body.endpoint,
      p256dh: body.p256dh,
      auth: body.auth,
      userAgent: body.userAgent ?? null,
    }, { onConflict: 'endpoint' })

  if (upsertErr) {
    console.error('PushSubscription upsert failed:', upsertErr)
    return NextResponse.json({ error: 'persist failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const supabase = makeServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let body: { endpoint?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }
  if (!body.endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 400 })

  const { error } = await supabase
    .from('PushSubscription').delete().eq('endpoint', body.endpoint)
  if (error) {
    console.error('PushSubscription delete failed:', error)
    return NextResponse.json({ error: 'delete failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
