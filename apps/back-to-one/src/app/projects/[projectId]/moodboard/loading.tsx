// Moodboard / Tone route — Suspense fallback. Mirrors the design's "Tone ·
// Loading" mockup (apps/back-to-one/reference/hub-full-preview-v2.html
// @ ~12303): tab nav + tag pills + a tone-mosaic skeleton. The mosaic
// uses .oa-tone-mosaic on the loaded page; the loading state simplifies
// to a 3-col grid of mixed-aspect thumbs to read as page-bones.
export default function MoodboardLoading() {
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
      <div style={{ display: 'flex', gap: 8, padding: '14px 16px 6px', justifyContent: 'center' }}>
        <div className="sk sk-pill" style={{ width: 60 }} />
        <div className="sk sk-pill" style={{ width: 70 }} />
        <div className="sk sk-pill" style={{ width: 80 }} />
      </div>

      {/* Tag pills row */}
      <div style={{ display: 'flex', gap: 8, padding: '6px 16px 12px', flexWrap: 'wrap' }}>
        <div className="sk sk-pill" />
        <div className="sk sk-pill" style={{ width: 70 }} />
        <div className="sk sk-pill" style={{ width: 60 }} />
        <div className="sk sk-pill" style={{ width: 80 }} />
      </div>

      {/* Tone mosaic preview — 3-col grid of mixed wide/tall thumbs */}
      <div className="sk-grid-3" style={{ padding: '0 16px 24px' }}>
        <div className="sk" style={{ aspectRatio: '1 / 1', borderRadius: 8 }} />
        <div className="sk" style={{ aspectRatio: '1 / 1.4', borderRadius: 8 }} />
        <div className="sk" style={{ aspectRatio: '1 / 1', borderRadius: 8 }} />
        <div className="sk" style={{ aspectRatio: '1 / 1.4', borderRadius: 8 }} />
        <div className="sk" style={{ aspectRatio: '1 / 1', borderRadius: 8 }} />
        <div className="sk" style={{ aspectRatio: '1 / 1.4', borderRadius: 8 }} />
        <div className="sk" style={{ aspectRatio: '1 / 1', borderRadius: 8 }} />
        <div className="sk" style={{ aspectRatio: '1 / 1', borderRadius: 8 }} />
        <div className="sk" style={{ aspectRatio: '1 / 1.4', borderRadius: 8 }} />
      </div>
    </div>
  )
}
