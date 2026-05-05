// Locations skeleton — panel-accurate ghost of the loaded Locations grid.
// Used by app/projects/[projectId]/locations/loading.tsx (route Suspense
// fallback) and inline in page.tsx while React Query is fetching, so route
// + data loading show the same fallback.
//
// Mirrors the body of page.tsx (the "happy path" rendered after isLoading
// resolves and locations exist):
//   .loc-grid — 2-col grid of .loc-card panels with 16:9 hero + meta
//               (address line + dates row + status pill)
//
// Re-uses the page's own structural classes (.loc-grid + .loc-card chrome
// already lays in the panel border, blur, edge glow, and 16:9 hero ratio
// via .loc-image-hero) so the skeleton inherits the loaded layout exactly
// — only the inner content swaps for .sk shimmer rectangles.
export function LocationsSkeleton() {
  return (
    <div className="loc-grid">
      {[
        { title: 92, addr: 110, dates: 60, status: 64 },
        { title: 70, addr: 84,  dates: 70, status: 56 },
        { title: 110, addr: 128, dates: 54, status: 70 },
        { title: 80, addr: 96,  dates: 60, status: 64 },
        { title: 96, addr: 116, dates: 66, status: 60 },
        { title: 84, addr: 100, dates: 56, status: 70 },
      ].map((c, i) => (
        <div key={i} className="loc-card" style={{ padding: 0 }}>
          {/* Title — center top, matches .loc-title padding */}
          <div
            style={{
              padding: '9px 10px 8px',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div className="sk sk-line" style={{ width: c.title, height: 11 }} />
          </div>

          {/* 16:9 hero with letterbox bars (matches .loc-image-hero) */}
          <div className="loc-image-hero">
            <div className="letterbox-top" />
            <div className="sk" style={{ position: 'absolute', inset: 0, borderRadius: 0 }} />
            <div className="letterbox-bottom" />
          </div>

          {/* Meta — center stack: address + dates row + status pill */}
          <div className="loc-meta">
            <div className="sk sk-line" style={{ width: c.addr, height: 7 }} />
            <div className="loc-dates-row">
              <div className="sk sk-line" style={{ width: c.dates, height: 7 }} />
              <div className="sk sk-pill" style={{ width: c.status, height: 12 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
