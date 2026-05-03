// Crew route — Suspense fallback. Mirrors the design's "Crew · Loading"
// mockup (apps/back-to-one/reference/hub-full-preview-v2.html @ ~13697):
// filter pill row + dept-grouped section headers + 3-col crew-card grid
// where each cell is an avatar circle with two lines below.
export default function CrewLoading() {
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
        <div className="sk sk-pill" style={{ width: 70 }} />
        <div className="sk sk-pill" style={{ width: 90 }} />
        <div className="sk sk-pill" style={{ width: 80 }} />
      </div>

      <div style={{ padding: '0 16px 24px' }}>
        {/* Dept section header */}
        <div className="sk sk-section-header" />

        {/* 3-col crew grid (avatar + role + dept) */}
        <div className="sk-grid-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={`g1-${i}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                padding: '10px 4px',
              }}
            >
              <div className="sk sk-circle" style={{ width: 44 }} />
              <div className={`sk sk-line ${i % 2 === 0 ? 'long' : 'med'}`} />
              <div className="sk sk-line short" />
            </div>
          ))}
        </div>

        {/* Second dept section */}
        <div className="sk sk-section-header" />
        <div className="sk-grid-3">
          {[0, 1, 2].map((i) => (
            <div
              key={`g2-${i}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                padding: '10px 4px',
              }}
            >
              <div className="sk sk-circle" style={{ width: 44 }} />
              <div className={`sk sk-line ${i % 2 === 0 ? 'med' : 'long'}`} />
              <div className="sk sk-line short" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
