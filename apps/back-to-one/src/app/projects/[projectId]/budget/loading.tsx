// Budget route — Suspense fallback. Mirrors the design's "Budget · Loading"
// mockup (apps/back-to-one/reference/hub-full-preview-v2.html @ ~9822):
//   - summary card (large)
//   - 2x2 category card grid
//   - section divider + transaction rows.
export default function BudgetLoading() {
  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        className="hub-topbar relative flex flex-col items-center justify-end px-5 flex-shrink-0 sticky top-0 z-20"
        style={{
          minHeight: 100,
          paddingTop: 'calc(var(--safe-top) + 10px)',
          paddingBottom: 12,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          overflow: 'hidden',
        }}
      >
        <div className="flex flex-col items-center" style={{ width: '70%' }}>
          <div className="sk sk-line short" style={{ marginBottom: 10 }} />
          <div className="sk sk-title" />
          <div className="sk sk-line med" style={{ marginTop: 10 }} />
        </div>
      </div>

      <div style={{ padding: '14px 16px 24px' }}>
        {/* Summary card */}
        <div className="sk" style={{ height: 110, borderRadius: 12, marginBottom: 16 }} />

        {/* Category grid 2x2 */}
        <div className="sk-grid-2" style={{ marginBottom: 16 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="sk sk-card" style={{ height: 70 }} />
          ))}
        </div>

        {/* Section divider — Transactions */}
        <div className="sk sk-section-header" />

        {/* Transaction rows */}
        {[0, 1, 2].map((i) => (
          <div key={i} className="sk-row">
            <div className="sk sk-circle" style={{ width: 18 }} />
            <div className="sk-stack">
              <div className={`sk sk-line ${i === 1 ? 'long' : 'med'}`} />
              <div className="sk sk-line short" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
