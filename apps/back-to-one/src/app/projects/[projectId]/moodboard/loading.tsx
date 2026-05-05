// Moodboard / Tone route — Suspense fallback. Mirrors the loaded
// Moodboard panel layout exactly (apps/back-to-one/src/app/projects/[projectId]/moodboard/page.tsx):
//   PageHeader (Moodboard title + project meta + status pill)
//   .ai-dept-filters TabBar (All + board tabs + add-tab pill)
//   mx-3.5 border-b divider
//   .oa-tone-mosaic 3-col mosaic with mixed wide/tall/normal tiles
//
// Re-uses the page's own chrome classes (.ai-dept-filters /
// .oa-tone-mosaic / .oa-tone-tile) so the skeleton inherits the loaded
// layout's grid and spacing — only inner content swaps for .sk shimmer
// rectangles.
import { PageHeader } from '@/components/ui/PageHeader'
import { MoodboardSkeleton } from '@/components/moodboard/MoodboardSkeleton'

export default function MoodboardLoading() {
  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        projectId=""
        title="Moodboard"
        meta={
          <div className="flex flex-col items-center" style={{ gap: 6 }}>
            <div className="sk sk-line" style={{ width: 110, height: 11 }} />
            <div className="sk sk-pill" style={{ width: 70, height: 14 }} />
          </div>
        }
      />
      <MoodboardSkeleton />
    </div>
  )
}
