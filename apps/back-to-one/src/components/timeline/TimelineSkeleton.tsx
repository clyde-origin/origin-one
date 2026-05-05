// Timeline skeleton — panel-accurate ghost of the loaded Timeline body. Used
// by app/projects/[projectId]/timeline/loading.tsx (route Suspense fallback)
// and inline in page.tsx while React Query is fetching, so route + data
// loading show the same fallback.
//
// Mirrors the Milestones tab body of page.tsx (the default tab). The page's
// PageHeader + primary tab strip render around this skeleton — this component
// covers everything below the tab strip:
//   .glass-tile timeline-cal — month nav + day-of-week + 6×7 grid + legend
//   .sheen-title month label
//   .glass-tile timeline-ms-list — stack of milestone rows (date · rule · title + pill)
export function TimelineSkeleton({ withTabStrip = false }: { withTabStrip?: boolean } = {}) {
  // 6×7 = 42 calendar cells.
  const calCells = Array.from({ length: 42 })
  return (
    <div
      className="flex-1 overflow-hidden"
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      {/* Primary tab strip silhouette — only rendered by the route-level
          loading.tsx (where the page hasn't mounted yet, so its real tab
          strip isn't on screen). The page's own isLoading branch passes
          withTabStrip={false} since the live tab strip is already rendered. */}
      {withTabStrip && (
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            gap: 8,
            padding: '8px 16px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="sk sk-pill" style={{ width: 90, height: 22 }} />
          <div className="sk sk-pill" style={{ width: 84, height: 22 }} />
        </div>
      )}

      {/* Calendar — keep the .glass-tile.sk-tile chrome so border/blur
          matches the loaded .timeline-cal exactly. */}
      <div
        className="glass-tile sk-tile flex-shrink-0"
        style={{ margin: '12px 16px', padding: '12px 14px 14px' }}
      >
        {/* Month nav row — prev · MONTH YEAR · next */}
        <div className="flex items-center justify-center" style={{ gap: 12, marginBottom: 8 }}>
          <div className="sk sk-circle" style={{ width: 22, height: 22 }} />
          <div className="sk sk-line" style={{ width: 100, height: 9 }} />
          <div className="sk sk-circle" style={{ width: 22, height: 22 }} />
        </div>

        {/* Day-of-week headers (7) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, padding: '0 2px 4px' }}>
          {[0, 1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="flex items-center justify-center" style={{ padding: '4px 0 2px' }}>
              <div className="sk sk-line" style={{ width: 14, height: 6 }} />
            </div>
          ))}
        </div>

        {/* Calendar grid — 6 rows × 7 cols of circular cells. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, padding: '0 2px' }}>
          {calCells.map((_, i) => (
            <div key={i} style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="sk sk-circle" style={{ width: '70%', height: '70%' }} />
            </div>
          ))}
        </div>

        {/* Legend row */}
        <div className="flex items-center" style={{ gap: 10, marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {[44, 60, 32].map((w, i) => (
            <div key={i} className="flex items-center" style={{ gap: 4 }}>
              <div className="sk sk-circle" style={{ width: 4, height: 4 }} />
              <div className="sk sk-line" style={{ width: w, height: 6 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Milestone list region — month group header + .glass-tile of rows.
          Mirrors the project-mode default body. */}
      <div className="flex-1 overflow-hidden" style={{ padding: '0 16px 24px' }}>
        {/* Month group label (sheen-title) */}
        <div className="flex items-center justify-center" style={{ padding: '14px 0 10px' }}>
          <div className="sk sk-line" style={{ width: 120, height: 14, borderRadius: 6 }} />
        </div>

        {/* List tile — stack of rows. Mirrors .timeline-ms-row anatomy:
            date number + dow / vertical rule / title + status pill / chevron. */}
        <div
          className="glass-tile sk-tile"
          style={{ padding: '0 14px' }}
        >
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="flex items-start"
              style={{
                gap: 12,
                padding: '11px 0',
                borderBottom: i === 4 ? undefined : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {/* Date column — big day number + dow caption */}
              <div className="flex-shrink-0 flex flex-col items-center" style={{ width: 36, gap: 4 }}>
                <div className="sk sk-line" style={{ width: 22, height: 16, borderRadius: 4 }} />
                <div className="sk sk-line" style={{ width: 18, height: 5 }} />
              </div>

              {/* Vertical rule — 1px wide */}
              <div className="sk flex-shrink-0" style={{ width: 1, alignSelf: 'stretch', margin: '2px 0', borderRadius: 0 }} />

              {/* Title + status pill */}
              <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 6, paddingTop: 2 }}>
                <div className={`sk sk-line ${i % 2 === 0 ? 'long' : 'med'}`} style={{ height: 9 }} />
                <div className="sk sk-pill" style={{ width: 64, height: 12 }} />
              </div>

              {/* Chevron */}
              <div className="sk sk-line flex-shrink-0" style={{ width: 5, height: 9, marginTop: 6, borderRadius: 2 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
