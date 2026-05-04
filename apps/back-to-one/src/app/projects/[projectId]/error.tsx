'use client'

export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'var(--bg, #04040a)',
      }}
    >
      <div
        className="glass-tile"
        style={{
          maxWidth: 360,
          width: '100%',
          padding: '24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--fg, #ebebef)',
          }}
        >
          Something went wrong
        </div>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.4,
            color: 'var(--fg-mono, #7a7a82)',
          }}
        >
          This project page hit an error and stopped rendering.
        </div>
        <button
          onClick={() => reset()}
          style={{
            marginTop: 6,
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            background: 'rgba(196,90,220,0.15)',
            border: '1px solid rgba(196,90,220,0.35)',
            color: '#c45adc',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
        {error.digest && (
          <div
            className="font-mono"
            style={{
              fontSize: 10,
              color: 'var(--fg-mono, #7a7a82)',
              opacity: 0.6,
              marginTop: 4,
            }}
          >
            {error.digest}
          </div>
        )}
      </div>
    </div>
  )
}
