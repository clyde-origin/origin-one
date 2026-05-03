// Threads route — Suspense fallback. Mirrors the design's "Threads ·
// Loading" mockup (apps/back-to-one/reference/hub-full-preview-v2.html
// @ ~10883): section divider + thread rows (circle thumb + title + meta).
export default function ThreadsLoading() {
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

      <div style={{ padding: '14px 16px 24px' }}>
        {/* Section divider */}
        <div className="sk sk-section-header" />

        {/* Thread rows — circle thumb + content + meta */}
        {[
          ['long', 'med'],
          ['med', 'long'],
          ['long', 'short'],
          ['med', 'med'],
          ['long', 'short'],
          ['med', 'long'],
        ].map(([a, b], i) => (
          <div key={i} className="sk-row">
            <div className="sk sk-circle" style={{ width: 36 }} />
            <div className="sk-stack">
              <div className={`sk sk-line ${a}`} />
              <div className={`sk sk-line ${b}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
