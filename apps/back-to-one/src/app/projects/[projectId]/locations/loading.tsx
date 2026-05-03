// Locations route — Suspense fallback. Mirrors the design's "Locations ·
// Loading" mockup (apps/back-to-one/reference/hub-full-preview-v2.html
// @ ~12612): 2-col vertical .loc-card grid skeleton with hero placeholder
// and meta lines below.
export default function LocationsLoading() {
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

      {/* 2-col location card grid — hero on top, two meta lines below */}
      <div className="sk-grid-2" style={{ padding: '14px 16px 24px' }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i}>
            <div className="sk" style={{ aspectRatio: '4 / 3', borderRadius: 12, marginBottom: 8 }} />
            <div className={`sk sk-line ${i % 2 === 0 ? 'long' : 'med'}`} style={{ marginBottom: 4 }} />
            <div className="sk sk-line short" style={{ marginLeft: 0 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
