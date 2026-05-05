// Budget route — Suspense fallback. Mirrors the loaded Budget panel
// layout exactly (apps/back-to-one/src/app/projects/[projectId]/budget/page.tsx):
//   PageHeader (Budget title + project meta + status pill + overflow)
//   .bgt-summary (Total + bar + spent/remaining split)
//   stack of AccountCard skeletons (.glass-tile.sk-tile, ~5 cards)
//   .bgt-section-header + recent transaction rows
//
// Re-uses the page's own chrome classes (.bgt-summary / .bgt-section-header
// / .bgt-tx-row) so the skeleton inherits the loaded layout's borders and
// spacing — only inner content swaps for .sk shimmer rectangles.
import { PageHeader } from '@/components/ui/PageHeader'
import { BudgetSkeleton } from '@/components/budget/BudgetSkeleton'

export default function BudgetLoading() {
  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        projectId=""
        title="Budget"
        meta={
          <div className="flex flex-col items-center" style={{ gap: 6 }}>
            <div className="sk sk-line" style={{ width: 110, height: 11 }} />
            <div className="sk sk-pill" style={{ width: 70, height: 14 }} />
          </div>
        }
        right={<div className="sk sk-circle" style={{ width: 32, height: 32 }} />}
        noBorder
      />
      <BudgetSkeleton />
    </div>
  )
}
