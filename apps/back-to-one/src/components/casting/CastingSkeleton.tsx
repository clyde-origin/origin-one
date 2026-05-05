// Casting skeleton — panel-accurate ghost of the loaded Casting body. Used
// by app/projects/[projectId]/casting/loading.tsx (route Suspense fallback)
// and inline in page.tsx while React Query is fetching, so route + data
// loading show the same fallback.
//
// Mirrors the body of page.tsx (the populated, post-isLoading happy path):
//   "N roles · M cast" count row + Characters dropdown trigger
//   filter pill row (All / Leads / Supporting / Day Players · Uncast)
//   sheen-title section divider + 2-col grid of CastCard skeletons
//
// Each card mirrors .cast-card chrome: 4:5 hero block (scene-color hero
// becomes a neutral .sk panel) + character name line + actor name line.
// Pairs of rows are emitted under one divider ("Principal Cast"), so the
// skeleton reads as "data-pending" rather than "empty".
export function CastingSkeleton() {
  return (
    <div
      className="flex-1 overflow-hidden"
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      {/* Count row + Characters dropdown trigger */}
      <div
        style={{
          padding: '6px 20px 2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div className="sk sk-line" style={{ width: 110, height: 7 }} />
        <div className="sk sk-pill" style={{ width: 90, height: 18 }} />
      </div>

      {/* Filter pill row — mirrors the live active-filter bar */}
      <div
        className="flex items-center"
        style={{ gap: 8, padding: '10px 16px 8px' }}
      >
        <div className="sk sk-pill" style={{ width: 50, height: 18 }} />
        <div className="sk sk-pill" style={{ width: 70, height: 18 }} />
        <div className="sk sk-pill" style={{ width: 90, height: 18 }} />
        <div className="sk sk-pill" style={{ width: 80, height: 18 }} />
      </div>

      {/* Body — section divider + 2-col cast card grid */}
      <div
        className="flex-1 overflow-hidden"
        style={{ padding: '8px 20px 24px' }}
      >
        {/* Sheen section divider */}
        <div className="flex items-center justify-center" style={{ marginTop: 18, marginBottom: 10 }}>
          <div className="sk sk-line" style={{ width: 132, height: 14, borderRadius: 6 }} />
        </div>

        {/* 2-col cast card grid — 6 stub cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div
              key={i}
              style={{
                display: 'flex', flexDirection: 'column', gap: 6,
                padding: 8, borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 14px -8px rgba(0,0,0,0.55)',
              }}
            >
              {/* 4:5 hero block — neutral .sk pane stands in for the
                  scene-color portrait. Matches the loaded card aspect. */}
              <div className="sk" style={{ aspectRatio: '4 / 5', borderRadius: 8 }} />

              {/* Character name (large) */}
              <div className="flex justify-center">
                <div className={`sk sk-line ${i % 3 === 0 ? 'med' : i % 3 === 1 ? 'long' : 'short'}`} style={{ height: 10 }} />
              </div>

              {/* Actor name (mono caps, smaller) */}
              <div className="flex justify-center">
                <div className="sk sk-line" style={{ width: '60%', height: 6 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
