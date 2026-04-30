// Call-sheet edit + send permissions.
//
// Producer/Owner OR crew with department === 'Production' (1st AD, PA,
// Production Coordinator) can edit and send. The post-departments
// constant is used by the recipient seeder to exclude post-only crew
// from the default recipient pool.
//
// When the upcoming Department-enum-conversion arc lands, swap these
// constants for enum membership in one place — the rest of the call-
// sheet code reads through these helpers.

export type ViewerRoleLabel = 'owner' | 'producer' | 'crew' | null

export const PRODUCTION_DEPARTMENTS = ['Production'] as const

export const POST_DEPARTMENTS = [
  'Editorial',
  'Color',
  'Sound Post',
  'VFX',
  'Motion Graphics',
] as const

function eq(a: string | null | undefined, b: string): boolean {
  return !!a && a.trim().toLowerCase() === b.toLowerCase()
}

export function canEditCallSheet(
  viewerRole: ViewerRoleLabel,
  member: { department?: string | null } | null,
): boolean {
  if (!viewerRole) return false
  if (viewerRole === 'owner' || viewerRole === 'producer') return true
  const dept = member?.department ?? null
  if (PRODUCTION_DEPARTMENTS.some(d => eq(dept, d))) return true
  return false
}

export function isPostOnlyDepartment(department: string | null | undefined): boolean {
  if (!department) return false
  return POST_DEPARTMENTS.some(d => eq(department, d))
}
