// Chat route — Suspense fallback. Mirrors the design's "Chat · Loading"
// mockup (apps/back-to-one/reference/hub-full-preview-v2.html @ ~11348):
// tab nav (channels / DMs filter pills) + section header + chat-rows
// (avatar + name + last message preview).
export default function ChatLoading() {
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

      {/* Tab nav silhouette */}
      <div style={{ display: 'flex', gap: 8, padding: '14px 16px 6px' }}>
        <div className="sk sk-pill" />
        <div className="sk sk-pill" style={{ width: 70 }} />
        <div className="sk sk-pill" style={{ width: 60 }} />
      </div>

      <div style={{ padding: '0 16px 24px' }}>
        {/* Section header */}
        <div className="sk sk-section-header" />

        {/* Chat rows — avatar + name + last message */}
        {[
          ['med', 'long'],
          ['long', 'med'],
          ['med', 'short'],
          ['long', 'short'],
          ['med', 'long'],
          ['long', 'short'],
        ].map(([a, b], i) => (
          <div key={i} className="sk-row">
            <div className="sk sk-circle" style={{ width: 32 }} />
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
