// Resources skeleton — panel-accurate ghost of the loaded Resources body.
// Used by app/projects/[projectId]/resources/loading.tsx (route Suspense
// fallback) and inline in page.tsx while React Query is fetching, so
// route + data loading show the same fallback.
//
// Mirrors the body of page.tsx (the "happy path" rendered after isLoading
// resolves and at least one resource exists):
//   .ai-dept-filters strip with 5 dept-pill skeletons (All / Templates /
//                                                       Docs / Links / Media)
//   .res-list with 2 .res-section blocks; each section has:
//     - .res-section-header (sheen-extruded title rectangle)
//     - .res-rows stack of .res-row stubs (icon + name/meta stack +
//       action pill on the right)
//
// Uses real .res-* chrome so the skeleton inherits the page's grid,
// padding, and section header treatment.
export function ResourcesSkeleton() {
  return (
    <>
      {/* Filter pill row — same .ai-dept-filters strip the loaded page
          renders. 5 stub pills with varied widths so it reads as
          "All · Templates · Docs · Links · Media". */}
      <div className="ai-dept-filters">
        {[36, 70, 50, 54, 60].map((w, i) => (
          <div key={i} className="sk sk-pill" style={{ width: w, height: 22 }} />
        ))}
      </div>

      {/* Body — wears the same outer padding the loaded page uses. */}
      <div
        className="flex-1 overflow-hidden"
        style={{ padding: '0 14px 80px' }}
      >
        <div className="res-list">
          {/* Two sections — varied label widths to hint Templates / Docs */}
          {[
            { headerW: 110, rows: [88, 124, 96] },
            { headerW: 132, rows: [108, 80, 116] },
          ].map((section, sIdx) => (
            <div key={sIdx} className="res-section">
              {/* Section header — match .res-section-header height (~17px
                  at 0.92rem). Centred rectangle so it reads as the
                  sheen-extruded title even before the gradient resolves. */}
              <div
                className="res-section-header"
                style={{ display: 'flex', justifyContent: 'center', padding: 0 }}
              >
                <div className="sk" style={{ width: section.headerW, height: 14, borderRadius: 4 }} />
              </div>
              <div className="res-rows">
                {section.rows.map((nameW, rIdx) => (
                  // Real .res-row chrome — keeps the 32px icon column,
                  // info stack column, and right-aligned action pill.
                  // Inner content swaps for .sk shimmer rectangles.
                  <div key={rIdx} className="res-row">
                    <div className="sk" style={{ width: 32, height: 32, borderRadius: 8 }} />
                    <div className="res-info">
                      <div className="sk sk-line" style={{ width: nameW, height: 11 }} />
                      <div className="sk sk-line" style={{ width: 44, height: 7, marginTop: 4 }} />
                    </div>
                    <div className="sk sk-pill" style={{ width: 56, height: 18 }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
