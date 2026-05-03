// Action Items route — Suspense fallback. Mirrors the design's "Action
// Items · Loading" mockup (apps/back-to-one/reference/hub-full-preview-v2
// .html @ ~10337): tab nav silhouette + bucket dividers + task rows
// (small circle status + title + meta) inside a single .ai-list wrapper.
export default function ActionItemsLoading() {
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

      {/* Tab nav silhouette — Mine / Team / All */}
      <div style={{ display: 'flex', gap: 8, padding: '14px 16px 6px' }}>
        <div className="sk sk-pill" />
        <div className="sk sk-pill" style={{ width: 70 }} />
        <div className="sk sk-pill" style={{ width: 60 }} />
        <div className="sk sk-pill" style={{ width: 90 }} />
      </div>

      <div style={{ padding: '0 16px 24px' }}>
        {/* Bucket divider — In Progress */}
        <div className="sk sk-section-header" />
        {[0, 1, 2].map((i) => (
          <div key={`in-${i}`} className="sk-row">
            <div className="sk sk-circle" style={{ width: 14 }} />
            <div className="sk-stack">
              <div className={`sk sk-line ${i % 2 === 0 ? 'long' : 'med'}`} />
              <div className="sk sk-line short" />
            </div>
          </div>
        ))}

        {/* Bucket divider — Up Next */}
        <div className="sk sk-section-header" />
        {[0, 1, 2].map((i) => (
          <div key={`next-${i}`} className="sk-row">
            <div className="sk sk-circle" style={{ width: 14 }} />
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
