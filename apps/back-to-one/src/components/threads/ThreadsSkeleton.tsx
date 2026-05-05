// Threads skeleton — panel-accurate ghost of the loaded Threads body.
// Used by app/projects/[projectId]/threads/loading.tsx (route Suspense
// fallback) and inline in page.tsx while React Query is fetching, so
// route + data loading show the same fallback.
//
// Mirrors the body of page.tsx (the "happy path" rendered after isLoading
// resolves and threads exist):
//   centered .ai-header (Threads sheen-title + project meta-name +
//                        "X active · Y unread" line + hairline divider)
//   .threads-section dividers (rule | label · count | rule)
//   .threads-row glass-tile-sm rows (52px square thumb + chip + snippet
//                                    + meta column)
//
// Re-uses the page's own chrome (.glass-tile.sk-tile + .glass-tile-sm so
// the row chrome is identical) so the skeleton inherits the loaded
// layout's borders and spacing — only inner content swaps for .sk
// shimmer rectangles.
//
// NOTE: this component renders only the SCROLL BODY (everything below the
// page header). The route's loading.tsx wraps it in <PageHeader> the same
// way Budget does, so nothing here re-paints the title.
export function ThreadsSkeleton() {
  return (
    <div
      className="flex-1 overflow-hidden"
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ flex: 1, paddingBottom: 32 }}>
        {/* Unread section divider + 2 unread rows */}
        <SectionLabelSk />
        {[0, 1].map(i => (
          <ThreadRowSk key={`u-${i}`} variant={i} />
        ))}

        {/* Recent section divider + 4 rows */}
        <SectionLabelSk topMargin={4} />
        {[0, 1, 2, 3].map(i => (
          <ThreadRowSk key={`r-${i}`} variant={i + 2} />
        ))}
      </div>
    </div>
  )
}

// Skeleton form of <SectionLabel>. Matches the .threads-section layout
// (rule | label | rule, 14/20px padding, optional topMargin between
// adjacent sections).
function SectionLabelSk({ topMargin = 0 }: { topMargin?: number }) {
  return (
    <div
      className="threads-section flex items-center"
      style={{ gap: 10, padding: '14px 20px 6px', marginTop: topMargin }}
    >
      <span
        className="threads-section-rule flex-1"
        style={{ height: 1, background: 'rgba(255,255,255,0.06)' }}
      />
      <div className="sk sk-line" style={{ width: 70, height: 8 }} />
      <span
        className="threads-section-rule flex-1"
        style={{ height: 1, background: 'rgba(255,255,255,0.06)' }}
      />
    </div>
  )
}

// Skeleton form of <ThreadCard>. Matches the live row silhouette:
//   52px thumbnail (square w/ 7px radius) + content column containing
//   chip pill, snippet (2 lines), and a footer row with a small avatar
//   stack stub + reply count stub.
// Wrapped in .glass-tile.sk-tile + .glass-tile-sm so the row chrome
// (border, blur, gradient) renders identically to the loaded card.
function ThreadRowSk({ variant }: { variant: number }) {
  const snippetA = ['88%', '74%', '92%', '66%', '82%', '70%']
  const snippetB = ['64%', '88%', '54%', '78%', '60%', '72%']
  return (
    <div
      className="threads-row glass-tile glass-tile-sm sk-tile"
      style={{
        margin: '0 14px 6px',
        padding: '10px 12px 10px 10px',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
      }}
    >
      {/* Thumbnail — 52px square, matches live <Thumbnail size={52} /> */}
      <div
        className="sk sk-thumb flex-shrink-0"
        style={{ width: 52, height: 52, borderRadius: 7 }}
      />

      {/* Content column */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Object chip pill (e.g. "Action Item · ...") */}
        <div
          className="sk sk-pill"
          style={{ width: 88, height: 14, marginBottom: 6 }}
        />

        {/* Snippet — sender + 2-line message body, plus a meta column
            on the right with timestamp + (sometimes) unread count chip. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 7,
          }}
        >
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div
              className="sk sk-line"
              style={{ width: snippetA[variant % snippetA.length], height: 9 }}
            />
            <div
              className="sk sk-line"
              style={{ width: snippetB[variant % snippetB.length], height: 9 }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 5,
              flexShrink: 0,
            }}
          >
            <div className="sk sk-line" style={{ width: 32, height: 7 }} />
            {variant % 3 === 0 && (
              <div
                className="sk sk-circle"
                style={{ width: 17, height: 17 }}
              />
            )}
          </div>
        </div>

        {/* Footer row — small participant-avatar stack + reply count */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="sk sk-circle"
                style={{
                  width: 18,
                  height: 18,
                  marginLeft: i === 0 ? 0 : -4,
                }}
              />
            ))}
          </div>
          <div className="sk sk-line" style={{ width: 44, height: 7 }} />
        </div>
      </div>
    </div>
  )
}
