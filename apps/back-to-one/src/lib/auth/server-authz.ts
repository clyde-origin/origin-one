// Server-side authorization helpers for API route handlers.
//
// Pre-Auth, the budget export and call-sheet send/refresh routes used the
// service-role key without any session check ("producer-only enforced at
// the UI layer"). With Auth shipped, these helpers gate the routes on the
// caller's session and project membership before the service-role fetch
// runs. The helper reuses the SQL function has_producer_access() so the
// authz logic stays in one place (RLS policies + this helper).

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getServerSession } from './session'

export type AuthzFailure = {
  ok: false
  status: 401 | 403 | 500
  message: string
}

export type AuthzSuccess = {
  ok: true
  authId: string
}

export type AuthzResult = AuthzSuccess | AuthzFailure

let adminClient: SupabaseClient | null = null

function getAdminClient(): SupabaseClient {
  if (adminClient) return adminClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      'server-authz: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for protected API routes.',
    )
  }
  adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return adminClient
}

export async function requireSession(): Promise<{ ok: true; authId: string } | AuthzFailure> {
  const session = await getServerSession()
  if (!session?.user) return { ok: false, status: 401, message: 'Unauthenticated' }
  return { ok: true, authId: session.user.id }
}

export async function requireProducerAccess(projectId: string): Promise<AuthzResult> {
  const session = await requireSession()
  if (!session.ok) return session

  const { data, error } = await getAdminClient().rpc('has_producer_access', {
    p_project_id: projectId,
    p_auth_id: session.authId,
  })
  if (error) {
    console.error('requireProducerAccess: RPC failed', error)
    return { ok: false, status: 500, message: 'Authorization check failed' }
  }
  if (!data) return { ok: false, status: 403, message: 'Forbidden' }
  return { ok: true, authId: session.authId }
}

// Resolve the projectId for a Budget. Uses service-role to bypass RLS so
// the helper works before authz is established.
export async function getBudgetProjectId(budgetId: string): Promise<string | null> {
  const { data, error } = await getAdminClient()
    .from('Budget')
    .select('projectId')
    .eq('id', budgetId)
    .maybeSingle()
  if (error) {
    console.error('getBudgetProjectId failed', error)
    return null
  }
  return (data?.projectId as string | undefined) ?? null
}

export async function getCallSheetProjectId(callSheetId: string): Promise<string | null> {
  const { data, error } = await getAdminClient()
    .from('CallSheet')
    .select('projectId')
    .eq('id', callSheetId)
    .maybeSingle()
  if (error) {
    console.error('getCallSheetProjectId failed', error)
    return null
  }
  return (data?.projectId as string | undefined) ?? null
}

// Validate a redirect target is a same-origin path. The JS URL constructor
// silently ignores the base when the input is absolute, so
// `new URL("https://attacker.com", origin)` resolves to attacker.com — an
// open-redirect surface for the auth/callback and login flows.
//
// Rules: must start with `/`, must not be protocol-relative (`//`), and
// must not contain a backslash that some user agents normalize to `/`.
export function safeRedirectPath(
  path: string | null | undefined,
  fallback = '/projects',
): string {
  if (typeof path !== 'string' || path.length === 0) return fallback
  if (!path.startsWith('/')) return fallback
  if (path.startsWith('//')) return fallback
  if (path.startsWith('/\\')) return fallback
  if (path.includes('\\')) return fallback
  return path
}
