// Casting route — Suspense fallback. Mirrors the loaded Casting panel
// layout exactly (apps/back-to-one/src/app/projects/[projectId]/casting/page.tsx):
//   PageHeader (Casting title + project meta + phase pill silhouette)
//   "N roles · M cast" count row + Characters dropdown trigger
//   filter pill row
//   sheen-title section divider + 2-col grid of CastCard skeletons
//
// Re-uses the page's own chrome (border + cast-card frame) so the skeleton
// inherits the loaded layout's borders and spacing — only inner content
// swaps for .sk shimmer rectangles.
import { PageHeader } from '@/components/ui/PageHeader'
import { CastingSkeleton } from '@/components/casting/CastingSkeleton'

export default function CastingLoading() {
  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        projectId=""
        title="Casting"
        meta={
          <div className="flex flex-col items-center" style={{ gap: 6 }}>
            <div className="sk sk-line" style={{ width: 110, height: 11 }} />
            <div className="sk sk-pill" style={{ width: 70, height: 14 }} />
          </div>
        }
        noBorder
      />
      <CastingSkeleton />
    </div>
  )
}
