import { createClient } from '@supabase/supabase-js'

export type BindResult =
  | { ok: true; userId: string }
  | { ok: false; code: 'conflict' | 'incomplete-invite' | 'unknown' }

/**
 * Run on /auth/callback after the user is authenticated.
 *
 * Flow A — Founding rebind / re-bind: existing User row matches by email,
 * authId set to the auth.users.id.
 *
 * Flow B — New crew invite: no User row matches by email, but auth.users
 * has app_metadata with name + projectId + role + department. Creates
 * User + ProjectMember (and TeamMember if producer-tier).
 *
 * Service-role bypasses RLS — required because at first sign-in there is no
 * User.authId yet for RLS to gate against.
 */
export async function bindAuthUser(
  authUserId: string,
  email: string,
  appMetadata: Record<string, unknown>
): Promise<BindResult> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: existing, error: fetchErr } = await admin
    .from('User')
    .select('id, authId')
    .eq('email', email)
    .maybeSingle()

  if (fetchErr) {
    console.error('bindAuthUser: User lookup failed', fetchErr)
    return { ok: false, code: 'unknown' }
  }

  if (existing) {
    if (existing.authId && existing.authId !== authUserId) {
      return { ok: false, code: 'conflict' }
    }
    if (existing.authId === authUserId) {
      return { ok: true, userId: existing.id }
    }
    const { error: updErr } = await admin
      .from('User')
      .update({ authId: authUserId })
      .eq('id', existing.id)
    if (updErr) {
      console.error('bindAuthUser: authId update failed', updErr)
      return { ok: false, code: 'unknown' }
    }
    return { ok: true, userId: existing.id }
  }

  // Flow B — new invitee from app metadata
  const name = (appMetadata.name as string) ?? null
  const projectId = (appMetadata.projectId as string) ?? null
  const role = (appMetadata.role as string) ?? 'crew'
  const department = (appMetadata.department as string) ?? null

  if (!name || !projectId) {
    return { ok: false, code: 'incomplete-invite' }
  }

  const { data: project } = await admin
    .from('Project')
    .select('teamId')
    .eq('id', projectId)
    .maybeSingle()
  if (!project) return { ok: false, code: 'incomplete-invite' }

  const { data: newUser, error: createErr } = await admin
    .from('User')
    .insert({ email, name, authId: authUserId })
    .select('id')
    .single()
  if (createErr || !newUser) {
    console.error('bindAuthUser: User insert failed', createErr)
    return { ok: false, code: 'unknown' }
  }

  await admin.from('ProjectMember').insert({
    projectId,
    userId: newUser.id,
    role,
    department,
    canEdit: role === 'producer' || role === 'director',
  })

  if (role === 'producer' || role === 'director') {
    await admin.from('TeamMember').insert({
      teamId: project.teamId,
      userId: newUser.id,
      role,
    })
  }

  return { ok: true, userId: newUser.id }
}
