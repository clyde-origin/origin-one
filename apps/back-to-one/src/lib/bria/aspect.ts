// Maps a Project.aspectRatio string to a Bria API request and an optional
// post-crop hint. Bria natively supports a fixed set of ratios; for ratios
// outside that set (e.g. 2.39:1, 1.85:1) we request the closest supported
// one. The seed pipeline crops with sharp; the in-app route currently skips
// the crop step (deferred — see DECISIONS).
//
// Mirrors packages/db/src/seed-images/bria-aspect.ts. Two copies kept
// intentionally to avoid pulling Prisma side-effects through @origin-one/db
// into the app bundle. Reconcile via a shared @origin-one/integrations
// package the second a third consumer appears.

export type BriaRequestRatio = '1:1' | '16:9' | '9:16' | '4:5' | '3:2'

export type BriaAspectResult = {
  request: BriaRequestRatio
  cropTo: string | null
}

const NATIVE: ReadonlySet<string> = new Set<BriaRequestRatio>([
  '1:1', '16:9', '9:16', '4:5', '3:2',
])

const CROP_FROM_16_9: ReadonlySet<string> = new Set([
  '2.39:1', '1.85:1',
])

export function briaAspect(ratio: string | null | undefined): BriaAspectResult {
  if (!ratio) return { request: '16:9', cropTo: null }
  if (NATIVE.has(ratio)) return { request: ratio as BriaRequestRatio, cropTo: null }
  if (CROP_FROM_16_9.has(ratio)) return { request: '16:9', cropTo: ratio }
  return { request: '16:9', cropTo: null }
}
