// Workflow route — Suspense fallback. Mirrors the design's "Workflow ·
// Loading" mockup (apps/back-to-one/reference/hub-full-preview-v2.html
// @ ~15457): filter pills + a vertical chain of node cards with small
// connector pills between each pair.
export default function WorkflowLoading() {
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

      {/* Filter pill row */}
      <div style={{ display: 'flex', gap: 8, padding: '14px 16px 12px' }}>
        <div className="sk sk-pill" />
        <div className="sk sk-pill" style={{ width: 70 }} />
        <div className="sk sk-pill" style={{ width: 80 }} />
      </div>

      {/* Node chain — 5 stacked cards with connector pills between */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 16px 24px' }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="sk sk-card" style={{ width: '100%' }} />
            {i < 4 && (
              <div
                className="sk sk-pill"
                style={{ width: 28, height: 12, margin: '8px 0' }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
