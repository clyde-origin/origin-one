// Chat skeleton — panel-accurate ghost of the loaded Chat body. Used by
// app/projects/[projectId]/chat/loading.tsx (route Suspense fallback) and
// inline in page.tsx while React Query is fetching channels, so route +
// data loading show the same fallback.
//
// Mirrors the body of page.tsx (the "happy path" Team-tab flow):
//   .chat-tabs              — Team / Direct segmented tab strip
//   .chat-channel-pills     — horizontal scroll row of channel pills
//   message list            — alternating bubbles (left = other, right = self)
//                             with an occasional date separator
//   .chat-input-bar         — pill-shaped input + send arrow
//
// Re-uses the page's own structural classes (.chat-tabs / .chat-channel-pills /
// .chat-input-bar / .chat-input-inner) verbatim so the skeleton inherits the
// real surface borders, paddings, and z-stack — only the inner content swaps
// for .sk shimmer rectangles.
export function ChatSkeleton() {
  return (
    <>
      {/* ── Team / Direct tab strip ── */}
      <div
        className="chat-tabs flex flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        {[0, 1].map(i => (
          <div
            key={i}
            className="chat-tab relative flex-1 flex items-center justify-center"
            style={{ padding: '12px 0' }}
          >
            <div className="sk sk-line" style={{ width: 44, height: 9 }} />
          </div>
        ))}
      </div>

      {/* ── Channel pill row ── */}
      <div
        className="chat-channel-pills no-scrollbar flex flex-shrink-0 items-center"
        style={{
          gap: 6, padding: '8px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          overflowX: 'auto',
        }}
      >
        {[78, 64, 92, 70, 84].map((w, i) => (
          <div
            key={i}
            className="sk sk-pill flex-shrink-0"
            style={{ width: w, height: 22 }}
          />
        ))}
        {/* + Topic affordance — kept on the right per the live layout */}
        <div
          className="sk sk-pill flex-shrink-0"
          style={{ width: 70, height: 22, marginLeft: 'auto' }}
        />
      </div>

      {/* ── Message list ── alternating other/self bubbles, one date sep */}
      <div
        className="flex-1 overflow-hidden"
        style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        {/* Day separator — rule | label | rule, matches .chat-day-sep */}
        <div className="flex items-center" style={{ gap: 10, margin: '4px 0' }}>
          <div className="flex-1" style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
          <div className="sk sk-line" style={{ width: 50, height: 8 }} />
          <div className="flex-1" style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
        </div>

        {/* 6 bubbles — alternating sides + varied widths */}
        {[
          { self: false, w: '64%', avatar: true },
          { self: false, w: '48%', avatar: false },
          { self: true,  w: '52%', avatar: true  },
          { self: false, w: '70%', avatar: true  },
          { self: true,  w: '40%', avatar: true  },
          { self: false, w: '58%', avatar: true  },
        ].map((b, i) => (
          <div
            key={i}
            style={{
              display: 'flex', gap: 9, alignItems: 'flex-end',
              flexDirection: b.self ? 'row-reverse' : 'row',
            }}
          >
            {b.avatar ? (
              <div className="sk sk-circle" style={{ width: 28, height: 28, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 28, flexShrink: 0 }} />
            )}
            <div
              className="sk"
              style={{
                width: b.w,
                maxWidth: '75%',
                height: 32,
                borderRadius: 14,
                borderBottomLeftRadius: b.self ? 14 : 4,
                borderBottomRightRadius: b.self ? 4 : 14,
              }}
            />
          </div>
        ))}
      </div>

      {/* ── Input bar ── */}
      <div
        className="chat-input-bar flex-shrink-0"
        style={{
          padding: '10px 14px 20px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div
          className="chat-input-inner flex items-center"
          style={{
            gap: 8,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 22,
            padding: '8px 14px',
          }}
        >
          <div className="sk sk-line" style={{ flex: 1, height: 12 }} />
          <div className="sk sk-circle" style={{ width: 18, height: 18, flexShrink: 0 }} />
        </div>
      </div>
    </>
  )
}
