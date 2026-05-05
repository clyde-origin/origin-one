// Timeline route — Suspense fallback. Mirrors the loaded Timeline panel
// layout exactly (apps/back-to-one/src/app/projects/[projectId]/timeline/page.tsx):
//   PageHeader (Timeline title + project meta + status pill silhouette + mode toggle)
//   primary tab strip (Milestones | Schedule)
//   .glass-tile timeline-cal (calendar) — anchored
//   .sheen-title month group label + .glass-tile timeline-ms-list of milestone rows
//
// Re-uses the page's own chrome classes (.glass-tile.sk-tile) so the
// skeleton inherits the loaded layout's borders and spacing — only inner
// content swaps for .sk shimmer rectangles.
import { PageHeader } from '@/components/ui/PageHeader'
import { TimelineSkeleton } from '@/components/timeline/TimelineSkeleton'

export default function TimelineLoading() {
  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        projectId=""
        title="Timeline"
        meta={
          <div className="flex flex-col items-center" style={{ gap: 6 }}>
            <div className="sk sk-line" style={{ width: 110, height: 11 }} />
            <div className="sk sk-pill" style={{ width: 70, height: 14 }} />
          </div>
        }
        right={<div className="sk sk-pill" style={{ width: 88, height: 22 }} />}
        noBorder
      />
      <TimelineSkeleton withTabStrip />
    </div>
  )
}
