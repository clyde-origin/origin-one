// Crew skeleton — panel-accurate ghost of the loaded Crew body. Used by
// app/projects/[projectId]/crew/loading.tsx (route Suspense fallback) and
// inline in page.tsx while React Query is fetching, so route + data
// loading show the same fallback.
//
// Mirrors the body of page.tsx (the "happy path" rendered after isLoading
// resolves and crew exists):
//   role-pill row (6 pills — All / director / producer / coordinator /
//                  writer / crew, each with " · count")
//   per-role section: centered .sheen-title-style header + 3-col
//                     glass-tile crew-card grid (avatar + name + role)
//
// Re-uses the page's own chrome (.glass-tile.sk-tile for cards, the same
// 3-col grid + 16px outer padding) so the skeleton inherits the loaded
// layout's borders and spacing — only inner content swaps for .sk shimmer
// rectangles.
export function CrewSkeleton() {
  return (
    <div
      className="flex-1 overflow-hidden"
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      {/* Role-pill row — sticky-ish bar above the body. Mirrors the live
          RolePillRow which scrolls horizontally with 8px gap, padded
          16px sides, hairline bottom border. */}
      <div
        className="flex items-center"
        style={{
          gap: 8,
          padding: '8px 16px 6px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {[34, 56, 60, 72, 50, 46].map((w, i) => (
          <div key={i} className="sk sk-pill" style={{ width: w, height: 22 }} />
        ))}
      </div>

      {/* Body — two dept-grouped sections. Each section: centered sheen-title
          ghost + small mono count line, then a 3-col grid of glass-tile
          crew cards. Padding mirrors the live page (16px sides, no top
          padding so the first section header gets the same 18px marginTop
          the live page uses). */}
      <div style={{ padding: '0 16px 24px' }}>
        {[6, 3].map((count, sectionIdx) => (
          <div key={sectionIdx}>
            {/* Section header — centered title + count, matching the live
                page's "<sheen-title>{role}</sheen-title> + count" pattern. */}
            <div
              className="flex flex-col items-center"
              style={{ marginTop: 18, marginBottom: 10, gap: 4 }}
            >
              <div className="sk sk-title" style={{ width: 90, height: 14 }} />
              <div className="sk sk-line" style={{ width: 18, height: 6 }} />
            </div>

            {/* 3-col crew-card grid — matches the live grid: 10px gap,
                3 equal columns. Each card is a .glass-tile.sk-tile with
                a 44px circle avatar + name line + role line, padded
                12px 8px 10px (live CrewCard padding). */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
              }}
            >
              {Array.from({ length: count }).map((_, i) => (
                <div
                  key={i}
                  className="glass-tile sk-tile flex flex-col items-center"
                  style={{ padding: '12px 8px 10px', gap: 6 }}
                >
                  <div
                    className="sk sk-circle"
                    style={{ width: 44, height: 44 }}
                  />
                  <div
                    className="sk sk-line"
                    style={{ width: '70%', height: 8 }}
                  />
                  <div
                    className="sk sk-line"
                    style={{ width: '50%', height: 6 }}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
