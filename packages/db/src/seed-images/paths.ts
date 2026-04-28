export type Surface =
  | 'location'
  | 'narrativeLocation'
  | 'moodboard'
  | 'prop'
  | 'wardrobe'
  | 'hmu'
  | 'cast'
  | 'avatar'

export type ProjectKey = 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6' | 'crew'

export type ImageEntry = {
  projectKey: ProjectKey
  surface: Surface
  slug: string
  source: 'stock' | 'ai'
  query?: string
  prompt?: string
  caption?: string | null
  matchByName: string
}

export type Bucket = 'entity-attachments' | 'moodboard' | 'avatars'

const ENTITY_ATTACHMENT_SURFACES: ReadonlySet<Surface> = new Set([
  'location', 'narrativeLocation', 'prop', 'wardrobe', 'hmu', 'cast',
])

export function bucketForSurface(surface: Surface): Bucket {
  switch (surface) {
    case 'location':
    case 'narrativeLocation':
    case 'prop':
    case 'wardrobe':
    case 'hmu':
    case 'cast':
      return 'entity-attachments'
    case 'moodboard':
      return 'moodboard'
    case 'avatar':
      return 'avatars'
  }
  // TS-verified exhaustive: if a new Surface is added without updating the
  // switch above, this assignment fails at compile time.
  const _exhaustive: never = surface
  throw new Error(`Unknown surface: ${_exhaustive as string}`)
}

export function localFilePath(entry: Pick<ImageEntry, 'projectKey' | 'surface' | 'slug'>): string {
  return `${entry.projectKey}/${entry.surface}/${entry.slug}.jpg`
}

// rowId is the DB row id this image attaches to:
//   EntityAttachment surfaces → attachedToId
//   moodboard                 → projectId
//   avatar                    → userId
export function storagePath(
  entry: Pick<ImageEntry, 'surface' | 'slug'>,
  rowId: string,
): string {
  if (ENTITY_ATTACHMENT_SURFACES.has(entry.surface)) {
    return `${entry.surface}/${rowId}/${entry.slug}.jpg`
  }
  return `${rowId}/${entry.slug}.jpg`
}

export function imageSizeForSurface(surface: Surface): '1536x1024' | '1024x1024' {
  if (surface === 'cast' || surface === 'avatar') return '1024x1024'
  return '1536x1024'
}
