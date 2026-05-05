// Art skeleton — panel-accurate ghost of the loaded Art body. Used by
// app/projects/[projectId]/art/loading.tsx (route Suspense fallback) AND
// inline in page.tsx while React Query is fetching, so route + data
// loading show the same fallback.
//
// Mirrors the loaded body of page.tsx (the "happy path" rendered after
// isLoading resolves and items exist):
//   .art-section + .art-section-header (sheen-extrusion title)
//   count strip (mono caps "N items · N ready · N needed")
//   .art-grid → 6 .art-card stubs (1:1 hero + name + meta line)
//
// Re-uses the page's own chrome classes (.art-section /
// .art-section-header / .art-grid / .art-card / .art-card-image /
// .letterbox-top / .letterbox-bottom) so the skeleton inherits the
// loaded layout's borders, gradients, and spacing — only inner content
// swaps for .sk shimmer rectangles. The .art-card-image neutral-grey
// fill comes from --scene-rgb being deliberately omitted, which falls
// back to the rule's default `122, 122, 130` triplet.
//
// Renders body-only — caller is expected to render the surrounding
// PageHeader + tab strip + scroll wrapper (loading.tsx does this; the
// inline isLoading branch in page.tsx slots this inside the existing
// scroll area underneath the always-rendered tab bar).
export function ArtSkeleton() {
  return (
    <div className="art-section">
      {/* Sheen-extrusion section header — keep the .art-section-header
          chrome (same gradient text effect as the loaded panel) and
          swap the visible word for a centered .sk-line. */}
      <h2 className="art-section-header" style={{ display: 'flex', justifyContent: 'center' }}>
        <span className="sk sk-line" style={{ width: 120, height: 16 }} />
      </h2>

      {/* Count strip ("N items · N ready · N needed") */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
        <div className="sk sk-line" style={{ width: 160, height: 7 }} />
      </div>

      {/* 2-col art grid — 6 .art-card stubs */}
      <div className="art-grid">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className="art-card">
            {/* 1:1 hero — letterbox bars + status pill overlay (top-right) */}
            <div className="art-card-image">
              <div className="letterbox-top" />
              <div className="letterbox-bottom" />
              <div
                className="sk sk-pill"
                style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 44, height: 14, zIndex: 3,
                }}
              />
            </div>

            {/* Name */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div
                className="sk sk-line"
                style={{ width: i % 2 === 0 ? '70%' : '55%', height: 10 }}
              />
            </div>

            {/* Meta */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div
                className="sk sk-line"
                style={{ width: i % 3 === 0 ? '40%' : '52%', height: 7 }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
