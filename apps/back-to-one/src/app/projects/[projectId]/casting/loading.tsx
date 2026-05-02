// Casting route — Suspense fallback. Mirrors the design's "Casting · Loading"
// mockup (apps/back-to-one/reference/hub-full-preview-v2.html @ ~12952):
//   - 3-line page-header skeleton (short / sk-title / med)
//   - Filter pill row (4 sk-pills of varying widths)
//   - 3-col preview grid: 6 cells, each a 3:4 sk block + sk-line label below.
//
// The 3-col grid is intentionally rougher than the loaded page's 2-col cast-
// card grid — the design uses a denser preview for the loading state so the
// shimmer reads as page-bones, not as faux content. The in-page React-Query
// `isLoading` branch (page.tsx) renders the same skeleton.
export default function CastingLoading() {
  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Page header skeleton — title + project meta + phase pill silhouettes */}
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

      {/* 3-col cast card preview */}
      <div className="sk-grid-3" style={{ padding: '8px 16px 24px' }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i}>
            <div className="sk" style={{ aspectRatio: '3 / 4', borderRadius: 8, marginBottom: 6 }} />
            <div className={`sk sk-line ${i % 3 === 0 ? 'short' : i % 3 === 1 ? 'long' : 'med'}`} />
          </div>
        ))}
      </div>
    </div>
  )
}
