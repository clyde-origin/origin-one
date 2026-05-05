// Hub skeleton — panel-accurate ghost of the loaded Hub. Reuses the real
// Hub CSS chrome (.hub-topbar / .glass-tile / .cp-filter-row /
// .cp-filter-pill / .lca-row / .ai-meta-pill / .module-header) so the
// skeleton looks like a "data-pending" version of the same surface, not
// a parallel design. Inner shimmer rectangles are .sk-* primitives.
//
// Mirrors HubContent.tsx structure:
//   topbar  → kicker · name · type/status pill · crew avatars · filter pills
//   body    → Timeline + Budget pair (2-col, 130px)
//             My Action Items block (170px)
//             Creative header
//             SceneMaker + Tone (2-col, 148px)
//             LCA row (3-col)
//             Workflow node chain
//
// Used by HubContent's `if (loadingProject) return <HubSkeleton />` gate
// AND re-exported from app/projects/[projectId]/loading.tsx so route
// transitions and client-side data fetches show the same fallback.

export function HubSkeleton() {
  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* ── TOPBAR ── matches HubContent topbar (frosted, sticky-ish) */}
      <div
        className="hub-topbar relative flex flex-col items-center justify-end px-5 flex-shrink-0"
        style={{
          minHeight: 100,
          paddingTop: 'calc(var(--safe-top) + 10px)',
          paddingBottom: 12,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          overflow: 'hidden',
          zIndex: 10,
        }}
      >
        {/* Client kicker */}
        <div className="sk sk-line" style={{ width: 64, height: 7, marginBottom: 6 }} />

        {/* Project name */}
        <div className="sk sk-title" style={{ width: '52%', height: 22 }} />

        {/* Type · Status row */}
        <div className="flex items-center justify-center gap-2" style={{ marginTop: 6 }}>
          <div className="sk sk-line" style={{ width: 38, height: 8 }} />
          <span style={{ fontSize: '0.48rem', color: '#62627a' }}>·</span>
          <div className="sk sk-pill" style={{ width: 70, height: 18 }} />
        </div>

        {/* Crew avatars (overlapping) */}
        <div className="flex items-center justify-center" style={{ marginTop: 10 }}>
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className="sk sk-circle"
              style={{ width: 28, height: 28, marginLeft: i === 0 ? 0 : -7, zIndex: 4 - i }}
            />
          ))}
        </div>

        {/* Filter-pill row (6 pills, varying widths) */}
        <div className="cp-filter-row" style={{ marginTop: 10 }}>
          {[36, 64, 70, 84, 60, 54].map((w, i) => (
            <div key={i} className="sk sk-pill" style={{ width: w, height: 22 }} />
          ))}
        </div>
      </div>

      {/* ── BODY ── matches HubContent body (gap-6) */}
      <div
        className="flex-1 overflow-hidden"
        style={{ padding: '18px 16px 140px' }}
      >
        <div className="flex flex-col" style={{ gap: 24 }}>

          {/* 1. Timeline + Budget pair (2-col, 130px) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'stretch' }}>
            <div>
              <ModuleHeaderSk name="Timeline" meta />
              <div className="glass-tile sk-tile" style={{ height: 130 }} />
            </div>
            <div>
              <ModuleHeaderSk name="Budget" />
              <div className="glass-tile sk-tile" style={{ height: 130 }} />
            </div>
          </div>

          {/* 2. My Action Items */}
          <div>
            <ModuleHeaderSk name="My Action Items" meta />
            <div className="glass-tile sk-tile" style={{ height: 170 }}>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="sk sk-circle" style={{ width: 14, height: 14 }} />
                    <div className="sk sk-line" style={{ flex: 1, height: 10 }} />
                    <div className="sk sk-pill" style={{ width: 40, height: 14 }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Creative header */}
          <div>
            <ModuleHeaderSk name="Creative" meta />

            {/* SceneMaker + Tone 2-col (148px) */}
            <div className="flex" style={{ gap: 8, height: 148 }}>
              <div className="glass-tile sk-tile flex-1 min-w-0" />
              <div className="glass-tile sk-tile" style={{ width: 88 }} />
            </div>

            {/* LCA row (3-col, ~120px) */}
            <div className="lca-row" style={{ marginTop: 10 }}>
              <div className="glass-tile sk-tile" style={{ height: 120 }} />
              <div className="glass-tile sk-tile" style={{ height: 120 }} />
              <div className="glass-tile sk-tile" style={{ height: 120 }} />
            </div>
          </div>

          {/* 4. Workflow node chain */}
          <div>
            <ModuleHeaderSk name="Workflow" meta />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 12px' }}>
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                    <div className="sk" style={{ width: 36, height: 36, borderRadius: 8 }} />
                    <div className="sk sk-line" style={{ width: 32, height: 6 }} />
                  </div>
                  {i < 4 && <div className="sk" style={{ width: 12, height: 1 }} />}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// Compact skeleton form of the Hub's <ModuleHeader> — matches the
// "name · meta" header that sits above each .glass-tile section.
function ModuleHeaderSk({ name, meta = false }: { name: string; meta?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, paddingLeft: 2 }}>
      <span
        className="font-mono uppercase"
        style={{
          fontSize: '0.42rem',
          letterSpacing: '0.12em',
          color: 'rgba(150, 150, 170, 0.45)',
        }}
      >
        {name}
      </span>
      {meta && <div className="sk sk-line" style={{ width: 56, height: 7 }} />}
    </div>
  )
}
