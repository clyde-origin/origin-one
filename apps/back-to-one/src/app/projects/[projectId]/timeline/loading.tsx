// Timeline route — Suspense fallback. Mirrors the design's "Timeline ·
// Loading" mockup (apps/back-to-one/reference/hub-full-preview-v2.html
// @ ~9433): tall calendar/gantt card placeholder, a section divider, and
// a stack of milestone rows (circle + title + meta).
export default function TimelineLoading() {
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

      <div style={{ padding: '14px 16px 24px' }}>
        {/* Calendar / gantt card */}
        <div className="sk" style={{ height: 220, borderRadius: 12, marginBottom: 18 }} />

        {/* Section divider — Milestones */}
        <div className="sk sk-section-header" />

        {/* Milestone rows */}
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="sk-row">
            <div className="sk sk-circle" style={{ width: 28 }} />
            <div className="sk-stack">
              <div className={`sk sk-line ${i % 2 === 0 ? 'med' : 'long'}`} />
              <div className="sk sk-line short" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
