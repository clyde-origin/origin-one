// Workflow skeleton — panel-accurate ghost of the loaded Workflow body.
// Used by app/projects/[projectId]/workflow/loading.tsx (route Suspense
// fallback) and inline in page.tsx while React Query is fetching, so
// route + data loading show the same fallback.
//
// Mirrors the body of page.tsx (the "happy path" rendered after isLoading
// resolves and at least one node exists):
//   .wf-count subtitle  (e.g. "5 Nodes")
//   chain of .wf-node cards (5 stub nodes), each with:
//     - top .wf-node-tag pill (type label)
//     - body title + tool subline
//     - assignee column (avatar circle + name + role)
//   .wf-connector pills between consecutive nodes (centred hairline + pill)
//   "Deliverables" section header + 2 .glass-tile.sk-tile rows
//
// Forces --tag-rgb to a neutral grey on each .wf-node so the panel reads
// as data-pending rather than tinted-by-type. This mirrors the
// .glass-tile.sk-tile neutral-grey pattern.
export function WorkflowSkeleton() {
  return (
    <div
      className="flex-1 overflow-hidden"
      style={{ paddingBottom: 100 }}
    >
      {/* Wf-count subtitle — "N Nodes" line above the chain */}
      <div className="wf-count" style={{ padding: '6px 24px 2px' }}>
        <div className="sk sk-line" style={{ width: 60, height: 7 }} />
      </div>

      {/* Node chain — 5 stacked .wf-node cards with .wf-connector
          pills between consecutive pairs. Tag widths vary so the chain
          reads as a real workflow rather than a uniform stack. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          padding: '8px 24px 0',
        }}
      >
        {[
          { tagW: 38, titleW: 92,  toolW: 68 },
          { tagW: 28, titleW: 110, toolW: 78 },
          { tagW: 36, titleW: 84,  toolW: 60 },
          { tagW: 30, titleW: 100, toolW: 72 },
          { tagW: 52, titleW: 120, toolW: 84 },
        ].map((n, i) => (
          <div
            key={i}
            style={{ width: '100%', display: 'flex', flexDirection: 'column' }}
          >
            {/* Reuse .wf-node chrome (gradient + border + glow) but force
                a neutral --tag-rgb so the skeleton doesn't hint a type. */}
            <div
              className="wf-node"
              style={{ ['--tag-rgb' as string]: '130, 130, 145' } as React.CSSProperties}
            >
              {/* Tag (top row, full-width grid area "tag") — short rectangle */}
              <span className="wf-node-tag" style={{ padding: 0, border: 'none', background: 'transparent' }}>
                <div className="sk" style={{ width: n.tagW, height: 10, borderRadius: 4 }} />
              </span>
              {/* Body — title + tool subline */}
              <div className="wf-node-body">
                <div className="sk sk-line" style={{ width: n.titleW, height: 12 }} />
                <div className="sk sk-line" style={{ width: n.toolW, height: 7, marginTop: 4 }} />
              </div>
              {/* Assignee column — avatar circle + name/role stack */}
              <div className="wf-node-assignee">
                <div className="sk sk-circle" style={{ width: 28, height: 28 }} />
                <div className="wf-node-name-block">
                  <div className="sk sk-line" style={{ width: 50, height: 8 }} />
                  <div className="sk sk-line" style={{ width: 36, height: 6, marginTop: 3 }} />
                </div>
              </div>
            </div>
            {/* Connector pill between consecutive nodes — wears
                .wf-connector chrome (centred hairline) with an inner
                .sk pill standing in for the format label. */}
            {i < 4 && (
              <div className="wf-connector">
                <div className="sk sk-pill" style={{ width: 64, height: 18 }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Deliverables section — header + 2 glass-tile.sk-tile rows.
          Mirrors the standalone Deliverables block on the loaded page
          (border-top divider, sheen-title style header, +Add chip on the
          right). */}
      <div
        style={{
          margin: '24px 24px 0',
          paddingTop: 20,
          borderTop: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div className="sk" style={{ width: 110, height: 14, borderRadius: 4 }} />
          <div className="sk sk-pill" style={{ width: 44, height: 14 }} />
        </div>
        {[0, 1].map(i => (
          <div
            key={i}
            className="glass-tile sk-tile"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              marginBottom: 7,
              minHeight: 56,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sk sk-line" style={{ width: i === 0 ? 140 : 110, height: 11 }} />
              <div className="sk sk-line" style={{ width: 90, height: 7, marginTop: 5 }} />
              <div className="sk sk-line" style={{ width: 70, height: 6, marginTop: 3 }} />
            </div>
            <div className="sk sk-line" style={{ width: 30, height: 9 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
