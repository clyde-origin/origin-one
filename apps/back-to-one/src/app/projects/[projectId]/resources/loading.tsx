// Resources route — Suspense fallback. Mirrors the loaded Resources panel
// layout exactly (apps/back-to-one/src/app/projects/[projectId]/resources/page.tsx):
//   PageHeader (Resources title + project meta + status pill)
//   .ai-dept-filters strip (5 filter pills)
//   .res-list with .res-section blocks (sheen header + .res-row stack)
//
// Re-uses the page's own chrome classes (.ai-dept-filters / .res-list /
// .res-section / .res-row) so the skeleton inherits the loaded layout's
// grid and spacing — only inner content swaps for .sk shimmer rectangles.
import { PageHeader } from '@/components/ui/PageHeader'
import { ResourcesSkeleton } from '@/components/resources/ResourcesSkeleton'

export default function ResourcesLoading() {
  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        projectId=""
        title="Resources"
        meta={
          <div className="flex flex-col items-center" style={{ gap: 6 }}>
            <div className="sk sk-line" style={{ width: 110, height: 11 }} />
            <div className="sk sk-pill" style={{ width: 70, height: 14 }} />
          </div>
        }
      />
      <ResourcesSkeleton />
    </div>
  )
}
