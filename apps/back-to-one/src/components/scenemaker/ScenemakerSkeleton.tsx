// Scenemaker skeleton — panel-accurate ghost of the loaded Scenemaker
// content area. Used by app/projects/[projectId]/scenemaker/loading.tsx
// (route Suspense fallback) AND inline in page.tsx while React Query is
// fetching shots, so route + data loading show the same fallback.
//
// Scenemaker is a single route that hosts three modes (Script /
// Shotlist / Storyboard) via internal tab state. The skeleton suggests
// a neutral content body that reads as "either a scene-divided list or
// a grid of cells" — close enough to all three landings that no single
// mode flashes a layout swap when its real chrome paints in. Mirrors:
//   shotlist body — alternating scene-divider lines + .glass-tile.sk-tile
//     shot rows (densest of the three landings)
//
// Re-uses the page's own chrome (.glass-tile.sk-tile for the row
// surfaces) so the skeleton inherits the loaded layout's borders and
// gradients — only inner content swaps for .sk shimmer rectangles.
//
// Renders inner-content-only — caller is expected to render the
// surrounding PageHeader + .hub-topbar mode tabs + 44px mode subheader
// above. loading.tsx does this for the route fallback; the inline
// isLoading branch in page.tsx slots this inside the existing main
// content area underneath the always-rendered header/tabs/subheader.
export function ScenemakerSkeleton() {
  return (
    <div style={{ paddingTop: 4 }}>
      {[0, 1].map(sceneIdx => (
        <div key={sceneIdx} style={{ marginTop: sceneIdx === 0 ? 0 : 12 }}>
          {/* Scene header — number badge + title line + meta count */}
          <div
            className="flex items-center"
            style={{ padding: '12px 14px 6px', gap: 10 }}
          >
            <div className="sk" style={{ width: 26, height: 18, borderRadius: 4 }} />
            <div className="sk sk-line" style={{ flex: 1, height: 12 }} />
            <div className="sk sk-line" style={{ width: 38, height: 8 }} />
          </div>

          {/* Scene divider — hairline tinted bar (real page uses a 1px
              scene-color bar under the header) */}
          <div
            className="sk"
            style={{ height: 1, margin: '0 14px 6px', opacity: 0.5 }}
          />

          {/* Shot rows — .glass-tile.sk-tile keeps the cinema-glass chrome
              + neutral grey tint; inner is a num-tag + size + description
              + thumbnail layout matching SortableShotRow. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 14px' }}>
            {[0, 1, 2].map(rowIdx => (
              <div
                key={rowIdx}
                className="glass-tile sk-tile"
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '9px 10px',
                }}
              >
                {/* Shot number tag */}
                <div className="sk" style={{ width: 28, height: 20, borderRadius: 4 }} />
                {/* Size abbrev */}
                <div className="sk sk-pill" style={{ width: 26, height: 14 }} />
                {/* Description line */}
                <div className="sk sk-line" style={{ flex: 1, height: 9 }} />
                {/* Thumbnail */}
                <div
                  className="sk"
                  style={{ width: 72, height: 44, borderRadius: 6, marginLeft: 'auto' }}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
