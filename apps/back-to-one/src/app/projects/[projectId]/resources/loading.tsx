// Resources route — Suspense fallback. Mirrors the design's "Resources ·
// Loading" mockup (apps/back-to-one/reference/hub-full-preview-v2.html
// @ ~15852): filter pills + sheen section headers + resource rows
// (icon circle + name/meta + small action pill on the right).
export default function ResourcesLoading() {
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
      <div style={{ display: 'flex', gap: 8, padding: '14px 16px 6px' }}>
        <div className="sk sk-pill" />
        <div className="sk sk-pill" style={{ width: 80 }} />
        <div className="sk sk-pill" style={{ width: 70 }} />
        <div className="sk sk-pill" style={{ width: 60 }} />
      </div>

      <div style={{ padding: '0 16px 24px' }}>
        {/* Section: Vendors */}
        <div className="sk sk-section-header" />
        {[0, 1, 2].map((i) => (
          <div key={`v-${i}`} className="sk-row">
            <div className="sk sk-circle" style={{ width: 28 }} />
            <div className="sk-stack">
              <div className={`sk sk-line ${i % 2 === 0 ? 'long' : 'med'}`} />
              <div className="sk sk-line short" />
            </div>
            <div className="sk sk-pill" style={{ width: 56, height: 18 }} />
          </div>
        ))}

        {/* Section: Equipment */}
        <div className="sk sk-section-header" />
        {[0, 1, 2].map((i) => (
          <div key={`e-${i}`} className="sk-row">
            <div className="sk sk-circle" style={{ width: 28 }} />
            <div className="sk-stack">
              <div className={`sk sk-line ${i % 2 === 0 ? 'med' : 'long'}`} />
              <div className="sk sk-line short" />
            </div>
            <div className="sk sk-pill" style={{ width: 56, height: 18 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
