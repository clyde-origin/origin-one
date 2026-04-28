import type { ImageEntry, ProjectKey, Surface } from './paths'

const VALID_PROJECT_KEYS: ReadonlySet<ProjectKey> = new Set(
  ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'crew'],
)
const VALID_SURFACES: ReadonlySet<Surface> = new Set(
  ['location', 'narrativeLocation', 'moodboard', 'prop', 'wardrobe', 'hmu', 'cast', 'avatar', 'storyboard'],
)

// Surface-only filters are allowed for surfaces that span multiple projects
// in a single run. Today only 'storyboard' qualifies (one entry per shot,
// fanned across all six demo projects).
const SURFACE_ONLY_ALLOWED: ReadonlySet<Surface> = new Set(['storyboard'])

export type OnlyFilter = {
  projectKey?: ProjectKey
  surface?: Surface
  slug?: string
}

export function parseOnly(raw: string | undefined): OnlyFilter | null {
  if (!raw) return null
  const parts = raw.split('.')
  const [first, second, third] = parts

  // Surface-only form: 'storyboard'
  if (VALID_SURFACES.has(first as Surface) && SURFACE_ONLY_ALLOWED.has(first as Surface) && parts.length === 1) {
    return { surface: first as Surface }
  }

  // Project-scoped form: 'p1' | 'p1.cast' | 'p1.cast.slug' | 'p1.storyboard.01A'
  if (!VALID_PROJECT_KEYS.has(first as ProjectKey)) {
    throw new Error(`Invalid projectKey "${first}" in --only filter. Expected one of: ${[...VALID_PROJECT_KEYS].join(', ')}`)
  }
  if (second !== undefined && !VALID_SURFACES.has(second as Surface)) {
    throw new Error(`Invalid surface "${second}" in --only filter. Expected one of: ${[...VALID_SURFACES].join(', ')}`)
  }
  return {
    projectKey: first as ProjectKey,
    surface: second as Surface | undefined,
    slug: third,
  }
}

export function matchesOnly(entry: ImageEntry, filter: OnlyFilter | null): boolean {
  if (!filter) return true
  if (filter.projectKey && entry.projectKey !== filter.projectKey) return false
  if (filter.surface && entry.surface !== filter.surface) return false
  if (filter.slug && entry.slug !== filter.slug) return false
  return true
}
