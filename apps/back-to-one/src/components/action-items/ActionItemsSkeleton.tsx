// Action Items skeleton — panel-accurate ghost of the loaded Action
// Items body. Used by app/projects/[projectId]/action-items/loading.tsx
// (route Suspense fallback) and inline in page.tsx while React Query is
// fetching, so route + data loading show the same fallback.
//
// Mirrors the body of page.tsx (the "happy path" rendered after isLoading
// resolves and items exist):
//   .action-items-tabs row (Me / Dept tabs with count chips, sticky)
//   .card .ai-list glass wrapper containing:
//     .ai-bucket dividers (rule | label | rule)
//     .ai-tr task rows (checkbox circle + title line + meta line)
//
// Re-uses the page's own chrome (.glass-tile.sk-tile, .ai-bucket,
// .ai-tr) so the skeleton inherits the loaded layout's borders and
// spacing — only inner content swaps for .sk shimmer rectangles.
export function ActionItemsSkeleton() {
  return (
    <div
      className="flex-1 overflow-hidden"
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      {/* Tabs row — mirrors .action-items-tabs (sticky strip below header,
          two flex-1 tabs each with a label + small count pill). */}
      <div
        className="flex"
        style={{
          padding: '0 16px',
          background: 'rgba(4,4,10,0.95)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {[0, 1].map(i => (
          <div
            key={i}
            className="flex-1 flex items-center justify-center"
            style={{ padding: '15px 0', gap: 6 }}
          >
            <div className="sk sk-title" style={{ width: 36, height: 14 }} />
            <div className="sk sk-pill" style={{ width: 22, height: 12 }} />
          </div>
        ))}
      </div>

      {/* Body — single .ai-list glass wrapper (uses .glass-tile.sk-tile so
          the chrome reads as data-pending). Two bucket dividers + 6 task
          rows total — matches the loaded page's "Today / This Week" rhythm
          most projects show. */}
      <div style={{ padding: '14px 16px 24px' }}>
        <div className="card ai-list glass-tile sk-tile" style={{ padding: 0 }}>
          {/* Today bucket */}
          <BucketDividerSk />
          {[0, 1, 2].map(i => (
            <TaskRowSk key={`t-${i}`} variant={i} />
          ))}

          {/* This Week bucket */}
          <BucketDividerSk />
          {[0, 1, 2].map(i => (
            <TaskRowSk key={`w-${i}`} variant={i + 1} />
          ))}
        </div>
      </div>
    </div>
  )
}

// Skeleton form of <BucketDivider>. Matches the .ai-bucket layout:
// rule | label | rule. Rules are real .ai-bucket .bucket-rule chrome;
// the label swaps to a small .sk pill so the cap reads as "label
// pending" instead of being empty.
function BucketDividerSk() {
  return (
    <div className="ai-bucket">
      <span className="bucket-rule" />
      <div className="sk sk-line" style={{ width: 60, height: 8 }} />
      <span className="bucket-rule" />
    </div>
  )
}

// Skeleton form of <TaskRow>. Matches the .ai-tr layout (16px round
// checkbox + content stack). The content stack mirrors the live row:
// title line (medium-long) + meta row with a small date stub. Variants
// just shift the title width so the stack feels real instead of
// metronome-uniform.
function TaskRowSk({ variant }: { variant: number }) {
  const titleWidths = ['82%', '68%', '74%', '60%', '90%']
  const w = titleWidths[variant % titleWidths.length]
  return (
    <div className="ai-tr">
      {/* Checkbox circle — matches the live 16px hollow circle */}
      <div
        className="sk sk-circle flex-shrink-0"
        style={{ width: 16, height: 16, marginTop: 1 }}
      />

      {/* Content stack */}
      <div className="flex-1 min-w-0" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Title line */}
        <div className="sk sk-line" style={{ width: w, height: 10 }} />
        {/* Meta row — date stub + a small assignee stub */}
        <div className="flex items-center" style={{ gap: 8 }}>
          <div className="sk sk-line" style={{ width: 50, height: 7 }} />
          <div className="sk sk-line" style={{ width: 38, height: 7 }} />
        </div>
      </div>
    </div>
  )
}
