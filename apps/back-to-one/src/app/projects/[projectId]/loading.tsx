// Hub route — Suspense fallback. Streams while the per-project Hub JS
// chunk loads (or recompiles in dev). HubContent itself renders a richer
// skeleton (HubSkeleton) once mounted while data is fetching, so this
// fallback covers cold first hits and deep-linked URLs.
//
// Silhouette = the Hub layout: topbar header skeleton, crew avatar row,
// cp-filter-row, Timeline+Budget tile pair, My Action Items block, two
// module preview blocks (SceneMaker+Moodboard pair, Locations row), and
// a Workflow node chain. Mirrors the gallery's "Hub · Loading" mockup
// (apps/back-to-one/reference/hub-full-preview-v2.html @ ~8529).
export default function HubLoading() {
  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Topbar */}
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

      <div style={{ padding: '14px 16px 48px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Crew avatar row */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="sk sk-circle" style={{ width: 32 }} />
          ))}
        </div>

        {/* cp-filter-row — role pills */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <div className="sk sk-pill" style={{ width: 40 }} />
          <div className="sk sk-pill" style={{ width: 70 }} />
          <div className="sk sk-pill" style={{ width: 80 }} />
          <div className="sk sk-pill" style={{ width: 60 }} />
        </div>

        {/* Timeline + Budget tile pair */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="sk" style={{ height: 130, borderRadius: 12 }} />
          <div className="sk" style={{ height: 130, borderRadius: 12 }} />
        </div>

        {/* My Action Items block */}
        <div className="sk" style={{ height: 140, borderRadius: 12 }} />

        {/* SceneMaker + Moodboard preview pair */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
          <div className="sk" style={{ height: 110, borderRadius: 12 }} />
          <div className="sk" style={{ width: 88, height: 110, borderRadius: 12 }} />
        </div>

        {/* Locations preview row — 3 mini cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <div className="sk sk-card" style={{ height: 70 }} />
          <div className="sk sk-card" style={{ height: 70 }} />
          <div className="sk sk-card" style={{ height: 70 }} />
        </div>

        {/* Workflow horizontal node chain */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px' }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                <div className="sk" style={{ width: 36, height: 36, borderRadius: 8 }} />
                <div className="sk sk-line" style={{ width: 32, height: 6 }} />
              </div>
              {i < 4 && <div className="sk" style={{ width: 12, height: 1 }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
