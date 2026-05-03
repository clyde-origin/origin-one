// SceneMaker route — Suspense fallback. Single route that hosts three
// modes (Script / Shotlist / Storyboard) — this skeleton uses the
// Storyboard 3-up grid silhouette as the default since it's the densest
// of the three (the lighter Script/Shotlist list states resolve quickly
// once the JS chunk is in cache). Mirrors gallery silhouettes for all
// three modes (apps/back-to-one/reference/hub-full-preview-v2.html
// @ ~11501 / ~11809 / ~12032).
export default function SceneMakerLoading() {
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

      {/* Tab nav — Script / Shotlist / Storyboard */}
      <div style={{ display: 'flex', gap: 8, padding: '14px 16px 6px', justifyContent: 'center' }}>
        <div className="sk sk-pill" style={{ width: 60 }} />
        <div className="sk sk-pill" style={{ width: 70 }} />
        <div className="sk sk-pill" style={{ width: 80 }} />
      </div>

      {/* Filter pills row — Characters / Locations / Props (Script tab) */}
      <div style={{ display: 'flex', gap: 8, padding: '6px 16px 12px' }}>
        <div className="sk sk-pill" />
        <div className="sk sk-pill" style={{ width: 70 }} />
        <div className="sk sk-pill" style={{ width: 60 }} />
      </div>

      {/* 3-up storyboard thumbnail grid (covers the densest mode) */}
      <div className="sk-grid-3" style={{ padding: '0 16px 24px' }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="sk sk-thumb" />
        ))}
      </div>
    </div>
  )
}
