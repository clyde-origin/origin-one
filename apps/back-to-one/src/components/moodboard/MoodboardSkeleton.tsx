// Moodboard skeleton — panel-accurate ghost of the loaded Moodboard
// (Tone) body. Used by app/projects/[projectId]/moodboard/loading.tsx
// (route Suspense fallback) and inline in page.tsx while React Query is
// fetching, so route + data loading show the same fallback.
//
// Mirrors the body of page.tsx (the "happy path" rendered after
// isLoading resolves and at least one ref exists):
//   .ai-dept-filters TabBar (All + a few board tabs + add-tab pill)
//   mx-3.5 border-b divider
//   .oa-tone-mosaic 3-col mosaic with mixed wide/tall/normal tiles —
//     positions 0 + 7 are .wide, position 3 is .tall (matches the
//     tileVariant() rhythm in page.tsx)
//   "N references" caption below the grid
//
// Uses real .oa-tone-tile chrome so the skeleton inherits the mosaic's
// border, gradient fallback, and span behavior. Inner shimmer is .sk.
export function MoodboardSkeleton() {
  return (
    <>
      {/* Tab bar — matches the .ai-dept-filters strip the page renders.
          First pill is "All", followed by 3 board tabs and a dashed
          add-tab pill. Widths vary to feel real. */}
      <div className="ai-dept-filters">
        {[36, 60, 70, 54].map((w, i) => (
          <div key={i} className="sk sk-pill" style={{ width: w, height: 22 }} />
        ))}
        <div
          className="sk sk-pill"
          style={{ width: 22, height: 22, opacity: 0.55 }}
        />
      </div>

      {/* Divider — same mx-3.5 border-b the page draws under the tab bar */}
      <div className="mx-3.5 border-b border-border" />

      {/* Body — pt-3 pb-4 wrapper matches the loaded page */}
      <div className="flex-1 overflow-hidden" style={{ paddingBottom: 80 }}>
        <div className="pt-3 pb-4">
          {/* 3-col mosaic — wears real .oa-tone-mosaic chrome. Variants
              follow the tileVariant() index rhythm: idx 0 + 7 wide,
              idx 3 tall, rest normal. */}
          <div className="oa-tone-mosaic" style={{ padding: '0 14px' }}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => {
              const variant: '' | 'wide' | 'tall' =
                i === 0 || i === 7 ? 'wide' : i === 3 ? 'tall' : ''
              return (
                <div
                  key={i}
                  className={
                    variant === 'wide' ? 'col-span-2' : variant === 'tall' ? 'row-span-2' : ''
                  }
                  style={{
                    ...(variant === 'wide' ? { gridColumn: 'span 2' } : {}),
                    ...(variant === 'tall' ? { gridRow: 'span 2' } : {}),
                  }}
                >
                  <div
                    className={`oa-tone-tile sk${variant ? ` ${variant}` : ''}`}
                  />
                </div>
              )
            })}
          </div>
          {/* "N references" caption — .px-3.5 mt-3 wrapper on the page */}
          <div className="px-3.5" style={{ marginTop: 12 }}>
            <div className="sk sk-line" style={{ width: 88, height: 9 }} />
          </div>
        </div>
      </div>
    </>
  )
}
