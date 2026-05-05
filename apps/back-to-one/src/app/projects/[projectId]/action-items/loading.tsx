// Action Items route — Suspense fallback. Mirrors the loaded Action
// Items panel layout exactly (apps/back-to-one/src/app/projects/
// [projectId]/action-items/page.tsx):
//   PageHeader (Action Items title + project meta + status pill)
//   .action-items-tabs row (Me / Dept tabs)
//   .card .ai-list glass wrapper containing .ai-bucket dividers + .ai-tr
//   task rows (checkbox + title + meta)
//
// Re-uses the page's own chrome (.glass-tile.sk-tile, .ai-bucket, .ai-tr)
// so the skeleton inherits the loaded layout's borders and spacing — only
// inner content swaps for .sk shimmer rectangles.
import { PageHeader } from '@/components/ui/PageHeader'
import { ActionItemsSkeleton } from '@/components/action-items/ActionItemsSkeleton'

export default function ActionItemsLoading() {
  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        projectId=""
        title="Action Items"
        meta={
          <div className="flex flex-col items-center" style={{ gap: 6 }}>
            <div className="sk sk-line" style={{ width: 110, height: 11 }} />
            <div className="sk sk-pill" style={{ width: 70, height: 14 }} />
          </div>
        }
      />
      <ActionItemsSkeleton />
    </div>
  )
}
