// Workflow route — Suspense fallback. Mirrors the loaded Workflow panel
// layout exactly (apps/back-to-one/src/app/projects/[projectId]/workflow/page.tsx):
//   PageHeader (Workflow title + project meta + status pill)
//   .wf-count "N Nodes" subtitle
//   chain of .wf-node cards with .wf-connector pills between
//   Deliverables section header + glass-tile.sk-tile rows
//
// Re-uses the page's own chrome classes (.wf-node / .wf-connector /
// .wf-count) so the skeleton inherits the loaded layout's borders and
// spacing — only inner content swaps for .sk shimmer rectangles.
import { PageHeader } from '@/components/ui/PageHeader'
import { WorkflowSkeleton } from '@/components/workflow/WorkflowSkeleton'

export default function WorkflowLoading() {
  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        projectId=""
        title="Workflow"
        meta={
          <div className="flex flex-col items-center" style={{ gap: 6 }}>
            <div className="sk sk-line" style={{ width: 110, height: 11 }} />
            <div className="sk sk-pill" style={{ width: 70, height: 14 }} />
          </div>
        }
      />
      <WorkflowSkeleton />
    </div>
  )
}
