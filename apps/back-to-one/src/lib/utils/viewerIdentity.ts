// Pre-Auth viewer identity stored in localStorage. Replaced by Supabase Auth
// session in sequence #25 — until then, this is the single source of truth
// for "who is looking at this app right now."

export type ViewerRole = 'producer' | 'crew'

export const VIEWER_ROLE_KEY = 'origin_one_user_role'
export const VIEWER_NAME_KEY = 'origin_one_user_name'

const VALID_ROLES: readonly string[] = ['producer', 'crew']

export function readStoredViewerRole(): ViewerRole | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(VIEWER_ROLE_KEY)
  return raw && VALID_ROLES.includes(raw) ? (raw as ViewerRole) : null
}

export function readStoredViewerName(): string | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(VIEWER_NAME_KEY)
  const trimmed = (raw ?? '').trim()
  return trimmed.length > 0 ? trimmed : null
}

export function writeStoredViewer(role: ViewerRole, name: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(VIEWER_ROLE_KEY, role)
  window.localStorage.setItem(VIEWER_NAME_KEY, name.trim())
}

export function clearStoredViewer(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(VIEWER_ROLE_KEY)
  window.localStorage.removeItem(VIEWER_NAME_KEY)
}
