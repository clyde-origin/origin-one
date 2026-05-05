// Budget skeleton — panel-accurate ghost of the loaded Budget body. Used
// by app/projects/[projectId]/budget/loading.tsx (route Suspense fallback)
// and inline in page.tsx while React Query is fetching, so route + data
// loading show the same fallback.
//
// Mirrors the body of page.tsx (the "happy path" rendered after isLoading
// resolves and budget exists):
//   .bgt-summary  (total label + total + bar + spent/remaining split)
//   stack of AccountCard skeletons (5 .glass-tile.sk-tile rows)
//   .bgt-section-header + 3 .bgt-tx-row skeletons
export function BudgetSkeleton() {
  return (
    <div
      className="flex-1 overflow-hidden"
      style={{ padding: '12px 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      {/* Summary card — keep the .bgt-summary chrome, swap inner content for .sk */}
      <div className="bgt-summary">
        <div className="bgt-summary-total-row">
          <div className="sk sk-line" style={{ width: 50, height: 9 }} />
          <div className="sk" style={{ width: 96, height: 22, borderRadius: 4 }} />
        </div>
        <div className="sk" style={{ width: '100%', height: 8, borderRadius: 4, marginTop: 4 }} />
        <div className="bgt-summary-split">
          <div className="bgt-summary-split-cell" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="sk sk-line" style={{ width: 36, height: 7 }} />
            <div className="sk" style={{ width: 64, height: 14, borderRadius: 4 }} />
            <div className="sk sk-line" style={{ width: 26, height: 7 }} />
          </div>
          <div className="bgt-summary-split-cell right" style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
            <div className="sk sk-line" style={{ width: 50, height: 7 }} />
            <div className="sk" style={{ width: 64, height: 14, borderRadius: 4 }} />
            <div className="sk sk-line" style={{ width: 26, height: 7 }} />
          </div>
        </div>
      </div>

      {/* Account cards — 5 stub rows, varied label widths to feel real */}
      {[100, 134, 88, 120, 108].map((labelW, i) => (
        <div
          key={i}
          className="glass-tile sk-tile"
          style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="sk sk-line" style={{ width: labelW, height: 11 }} />
            <div className="sk sk-pill" style={{ width: 36, height: 14 }} />
          </div>
          <div className="sk" style={{ width: '100%', height: 4, borderRadius: 2 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div className="sk sk-line" style={{ width: 56, height: 8 }} />
            <div className="sk sk-line" style={{ width: 56, height: 8 }} />
          </div>
        </div>
      ))}

      {/* Recent Transactions header */}
      <div style={{ marginTop: 8 }}>
        <div className="sk sk-line" style={{ width: 140, height: 12 }} />
      </div>

      {/* Transaction rows — match .bgt-tx-row layout: date · amount · desc · pill */}
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto auto 1fr auto',
            gap: 8,
            alignItems: 'center',
            padding: '10px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <div className="sk sk-line" style={{ width: 30, height: 8 }} />
          <div className="sk sk-line" style={{ width: 50, height: 9 }} />
          <div className="sk sk-line" style={{ width: '60%', height: 9 }} />
          <div className="sk sk-pill" style={{ width: 50, height: 14 }} />
        </div>
      ))}
    </div>
  )
}
