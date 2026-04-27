import type { ImageEntry, ProjectKey, Surface } from './paths'

const VALID_PROJECT_KEYS: ReadonlySet<ProjectKey> = new Set(
  ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'crew'],
)
const VALID_SURFACES: ReadonlySet<Surface> = new Set(
  ['location', 'narrativeLocation', 'moodboard', 'prop', 'wardrobe', 'hmu', 'cast', 'avatar'],
)

export type OnlyFilter = {
  projectKey: ProjectKey
  surface?: Surface
  slug?: string
}

export function parseOnly(raw: string | undefined): OnlyFilter | null {
  if (!raw) return null
  const parts = raw.split('.')
  const [projectKey, surface, slug] = parts
  if (!VALID_PROJECT_KEYS.has(projectKey as ProjectKey)) {
    throw new Error(`Invalid projectKey "${projectKey}" in --only filter. Expected one of: ${[...VALID_PROJECT_KEYS].join(', ')}`)
  }
  if (surface !== undefined && !VALID_SURFACES.has(surface as Surface)) {
    throw new Error(`Invalid surface "${surface}" in --only filter. Expected one of: ${[...VALID_SURFACES].join(', ')}`)
  }
  return {
    projectKey: projectKey as ProjectKey,
    surface: surface as Surface | undefined,
    slug,
  }
}

export function matchesOnly(entry: ImageEntry, filter: OnlyFilter | null): boolean {
  if (!filter) return true
  if (entry.projectKey !== filter.projectKey) return false
  if (filter.surface && entry.surface !== filter.surface) return false
  if (filter.slug && entry.slug !== filter.slug) return false
  return true
}
