import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const { projectId } = params
  const body = await request.json() as {
    name?: string
    email?: string
    role?: string
    department?: string | null
  }

  if (!body.email || !body.name) {
    return NextResponse.json({ error: 'name and email required' }, { status: 400 })
  }

  // Verify caller is producer-tier on this project's team.
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
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data: project } = await supabase
    .from('Project').select('id, teamId').eq('id', projectId).maybeSingle()
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 })

  // Authorize: caller is either a TeamMember of the project's team (broad
  // team-level producer access) OR a producer/director ProjectMember of this
  // specific project with canEdit=true (project-level path — used by the admin
  // onboarding flow when the admin is scoped to one external project, not the
  // whole external team).
  const { data: tm } = await supabase
    .from('TeamMember')
    .select('id, User!inner(authId)')
    .eq('teamId', project.teamId)
    .eq('User.authId', user.id)
    .maybeSingle()
  if (!tm) {
    const { data: pm } = await supabase
      .from('ProjectMember')
      .select('id, role, canEdit, User!inner(authId)')
      .eq('projectId', projectId)
      .eq('User.authId', user.id)
      .in('role', ['producer', 'director'])
      .eq('canEdit', true)
      .maybeSingle()
    if (!pm) return NextResponse.json({ error: 'not a producer on this project' }, { status: 403 })
  }

  // Issue invite via service role.
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await admin.auth.admin.inviteUserByEmail(body.email, {
    data: {
      name: body.name,
      projectId,
      role: body.role ?? 'crew',
      department: body.department ?? null,
    },
    redirectTo: `${request.nextUrl.origin}/auth/callback?redirect=/projects/${projectId}`,
  })
  if (error) {
    if (error.message?.toLowerCase().includes('already')) {
      return NextResponse.json({ error: 'That email already has an account.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, userId: data.user?.id })
}
