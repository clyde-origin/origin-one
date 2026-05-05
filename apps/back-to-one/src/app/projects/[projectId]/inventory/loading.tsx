// Inventory route — Suspense fallback. Mirrors the loaded Inventory panel
// layout exactly (apps/back-to-one/src/app/projects/[projectId]/inventory/page.tsx):
//   PageHeader (Inventory title + project meta)
//   import action row (disabled "Import PDF / Excel" affordance)
//   department tab strip (per-dept pills with count chips)
//   .inv-section / .inv-section-header / .inv-rows (status-grouped rows)
//   .inv-row (52px thumb + name/meta column + status pill)
//
// Re-uses the page's own chrome (.inv-section / .inv-rows / .inv-row /
// .inv-thumb / .inv-info / .inv-status-pill) so the skeleton inherits the
// loaded layout's grid, gaps, and borders — only inner content swaps for
// .sk shimmer rectangles.
import { PageHeader } from '@/components/ui/PageHeader'
import { InventorySkeleton } from '@/components/inventory/InventorySkeleton'

export default function InventoryLoading() {
  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        projectId=""
        title="Inventory"
        meta={
          <div className="flex flex-col items-center" style={{ gap: 6 }}>
            <div className="sk sk-line" style={{ width: 110, height: 11 }} />
            <div className="sk sk-pill" style={{ width: 70, height: 14 }} />
          </div>
        }
        noBorder
      />

      {/* Import action row */}
      <div
        className="flex flex-shrink-0"
        style={{ gap: 8, padding: '0 16px 12px' }}
      >
        <div
          className="flex-1 flex items-center justify-center"
          style={{
            gap: 7,
            padding: '11px 14px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="sk sk-line" style={{ width: 140, height: 11 }} />
        </div>
      </div>

      {/* Department tab strip — 6 pills (varied widths to feel real) */}
      <div
        className="flex-shrink-0 overflow-x-auto no-scrollbar"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex" style={{ gap: 6, padding: '0 16px 12px' }}>
          {[70, 60, 84, 64, 76, 72].map((w, i) => (
            <div
              key={i}
              className="sk sk-pill flex-shrink-0"
              style={{ width: w, height: 26 }}
            />
          ))}
        </div>
      </div>

      {/* Body — same scroll container the page uses */}
      <div
        className="flex-1 overflow-hidden"
        style={{ padding: '4px 16px 100px' }}
      >
        <InventorySkeleton />
      </div>
    </div>
  )
}
