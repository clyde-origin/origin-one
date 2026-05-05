// Threads route — Suspense fallback. Mirrors the loaded Threads panel
// layout exactly (apps/back-to-one/src/app/projects/[projectId]/threads/
// page.tsx):
//   PageHeader (Threads title + project meta-name + active/unread line)
//   .threads-section dividers (rule | label · count | rule)
//   .threads-row glass-tile-sm rows (52px thumb + chip + snippet + meta)
//
// Re-uses the page's own chrome (.glass-tile.sk-tile + .glass-tile-sm so
// the row chrome is identical) so the skeleton inherits the loaded layout's
// borders and spacing — only inner content swaps for .sk shimmer
// rectangles.
import { PageHeader } from '@/components/ui/PageHeader'
import { ThreadsSkeleton } from '@/components/threads/ThreadsSkeleton'

export default function ThreadsLoading() {
  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        projectId=""
        title="Threads"
        meta={
          <div className="flex flex-col items-center" style={{ gap: 6 }}>
            <div className="sk sk-line" style={{ width: 110, height: 11 }} />
            <div className="sk sk-line" style={{ width: 90, height: 9 }} />
          </div>
        }
        noBorder
      />
      <ThreadsSkeleton />
    </div>
  )
}
