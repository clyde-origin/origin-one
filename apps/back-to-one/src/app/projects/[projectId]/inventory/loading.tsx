// Inventory route — Suspense fallback. Mirrors the design's "Inventory ·
// Loading" mockup (apps/back-to-one/reference/hub-full-preview-v2.html
// @ ~14647): dept-pill row + status section headers + .inv-row list
// skeletons with 38px thumb + title + meta.
export default function InventoryLoading() {
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

      {/* Dept-pill row */}
      <div style={{ display: 'flex', gap: 8, padding: '14px 16px 6px' }}>
        <div className="sk sk-pill" />
        <div className="sk sk-pill" style={{ width: 70 }} />
        <div className="sk sk-pill" style={{ width: 60 }} />
        <div className="sk sk-pill" style={{ width: 80 }} />
      </div>

      <div style={{ padding: '0 16px 24px' }}>
        {/* Status section: In stock */}
        <div className="sk sk-section-header" />
        {[0, 1, 2, 3].map((i) => (
          <div key={`s1-${i}`} className="sk-row">
            <div className="sk sk-thumb" style={{ width: 38, height: 38 }} />
            <div className="sk-stack">
              <div className={`sk sk-line ${i % 2 === 0 ? 'long' : 'med'}`} />
              <div className="sk sk-line short" />
            </div>
          </div>
        ))}

        {/* Status section: Out for use */}
        <div className="sk sk-section-header" />
        {[0, 1].map((i) => (
          <div key={`s2-${i}`} className="sk-row">
            <div className="sk sk-thumb" style={{ width: 38, height: 38 }} />
            <div className="sk-stack">
              <div className={`sk sk-line ${i === 0 ? 'long' : 'med'}`} />
              <div className="sk sk-line short" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
