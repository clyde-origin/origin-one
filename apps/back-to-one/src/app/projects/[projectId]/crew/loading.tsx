// Crew route — Suspense fallback. Mirrors the loaded Crew panel layout
// exactly (apps/back-to-one/src/app/projects/[projectId]/crew/page.tsx):
//   PageHeader (Crew title + project meta + status pill)
//   role-pill row (All / director / producer / coordinator / writer / crew)
//   per-role section: centered title + 3-col .glass-tile.sk-tile crew grid
//
// Re-uses the page's own chrome (.glass-tile.sk-tile crew cards, the same
// 3-col grid + 16px outer padding) so the skeleton inherits the loaded
// layout's borders and spacing — only inner content swaps for .sk shimmer
// rectangles.
import { PageHeader } from '@/components/ui/PageHeader'
import { CrewSkeleton } from '@/components/crew/CrewSkeleton'

export default function CrewLoading() {
  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        projectId=""
        title="Crew"
        meta={
          <div className="flex flex-col items-center" style={{ gap: 6 }}>
            <div className="sk sk-line" style={{ width: 110, height: 11 }} />
            <div className="sk sk-pill" style={{ width: 70, height: 14 }} />
          </div>
        }
        noBorder
      />
      <CrewSkeleton />
    </div>
  )
}
