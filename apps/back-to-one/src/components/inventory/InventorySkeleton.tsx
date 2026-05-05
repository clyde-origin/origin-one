// Inventory skeleton — panel-accurate ghost of the loaded Inventory list.
// Used by app/projects/[projectId]/inventory/loading.tsx (route Suspense
// fallback) and inline in page.tsx while React Query is fetching, so route
// + data loading show the same fallback.
//
// Mirrors the body of page.tsx (the "happy path" rendered after isLoading
// resolves and items exist):
//   .inv-section / .inv-section-header / .inv-rows — status-grouped lists
//   .inv-row                                       — 52px thumb + name/meta
//                                                    column + status pill
//
// Re-uses the page's own structural classes (.inv-section / .inv-rows /
// .inv-row / .inv-thumb / .inv-info / .inv-status-pill) so the skeleton
// inherits the loaded layout's grid, gaps, and borders — only inner
// content swaps for .sk shimmer rectangles.
export function InventorySkeleton() {
  return (
    <>
      {[
        { headerW: 80, rows: [120, 96, 140, 110] },
        { headerW: 96, rows: [104, 132] },
      ].map((section, sIdx) => (
        <div key={sIdx} className="inv-section">
          {/* Section header — single shimmer line in place of the
              .inv-section-header sheen text. Matches the live header's
              centered alignment + 14px/10px vertical rhythm (4px on the
              first section per the .inv-section:first-of-type rule). */}
          <div
            style={{
              margin: sIdx === 0 ? '4px 0 10px' : '14px 0 10px',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div className="sk sk-line" style={{ width: section.headerW, height: 14 }} />
          </div>
          <div className="inv-rows">
            {section.rows.map((nameW, i) => (
              <div key={i} className="inv-row">
                {/* Thumb — 52px square (matches .inv-thumb intrinsic size) */}
                <div className="sk sk-thumb" style={{ width: 52, height: 52 }} />
                {/* Info column — name + meta */}
                <div className="inv-info">
                  <div className="sk sk-line" style={{ width: nameW, height: 12 }} />
                  <div className="sk sk-line" style={{ width: nameW * 0.6, height: 7 }} />
                </div>
                {/* Status pill on the right (matches .inv-status-pill) */}
                <div className="sk sk-pill" style={{ width: 56, height: 16 }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}
