import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string; memberId: string } }
) {
  const { projectId, memberId } = params
  const body = await request.json() as {
    role?: string
    department?: string | null
    canEdit?: boolean
  }

  if (!body.role) {
    return NextResponse.json({ error: 'role required' }, { status: 400 })
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

  const { data: tm } = await supabase
    .from('TeamMember')
    .select('id, User!inner(authId)')
    .eq('teamId', project.teamId)
    .eq('User.authId', user.id)
    .maybeSingle()
  if (!tm) return NextResponse.json({ error: 'not a producer on this team' }, { status: 403 })

  // Resolve target memberId → userId, scoped to this project.
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: existingMember } = await admin
    .from('ProjectMember')
    .select('userId, projectId')
    .eq('id', memberId)
    .maybeSingle()
  if (!existingMember || existingMember.projectId !== projectId) {
    return NextResponse.json({ error: 'member not found on this project' }, { status: 404 })
  }

  // Insert new ProjectMember row with the new role; rely on the
  // (projectId, userId, role) composite unique to reject duplicates.
  const { data: newRow, error: insErr } = await admin
    .from('ProjectMember')
    .insert({
      projectId,
      userId: existingMember.userId,
      role: body.role,
      department: body.department ?? null,
      canEdit: body.canEdit ?? false,
    })
    .select('id')
    .single()

  if (insErr) {
    if ((insErr as any).code === '23505') {
      return NextResponse.json({ error: 'this user already has that role on this project' }, { status: 409 })
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, memberId: newRow.id })
}
