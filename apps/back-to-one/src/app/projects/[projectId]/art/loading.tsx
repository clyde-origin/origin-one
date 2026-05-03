// Art route — Suspense fallback. Mirrors the design's "Art · Loading"
// mockup (apps/back-to-one/reference/hub-full-preview-v2.html @ ~14230):
// tab nav (Props/HMU/Wardrobe) + status filter pills + 2-col vertical
// .art-card grid with 4:3 hero + name + status pill.
export default function ArtLoading() {
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

      {/* Tab nav — Props / HMU / Wardrobe */}
      <div style={{ display: 'flex', gap: 8, padding: '14px 16px 6px', justifyContent: 'center' }}>
        <div className="sk sk-pill" style={{ width: 60 }} />
        <div className="sk sk-pill" style={{ width: 60 }} />
        <div className="sk sk-pill" style={{ width: 80 }} />
      </div>

      {/* Status filter row */}
      <div style={{ display: 'flex', gap: 8, padding: '6px 16px 12px' }}>
        <div className="sk sk-pill" />
        <div className="sk sk-pill" style={{ width: 70 }} />
        <div className="sk sk-pill" style={{ width: 60 }} />
      </div>

      {/* 2-col art card grid */}
      <div className="sk-grid-2" style={{ padding: '0 16px 24px' }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i}>
            <div className="sk sk-thumb" style={{ aspectRatio: '4 / 3', marginBottom: 8 }} />
            <div className={`sk sk-line ${i % 2 === 0 ? 'long' : 'med'}`} style={{ marginBottom: 6 }} />
            <div className="sk sk-pill" style={{ width: 56, height: 18 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
