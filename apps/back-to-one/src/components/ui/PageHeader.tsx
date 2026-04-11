import Link from 'next/link'

interface PageHeaderProps {
  projectId: string
  title: string
  meta?: string
  right?: React.ReactNode
  noBorder?: boolean
}

export function PageHeader({ projectId, title, meta, right, noBorder }: PageHeaderProps) {
  return (
    <div
      className="relative flex flex-col items-center justify-end sticky top-0 z-20 flex-shrink-0 px-5"
      style={{
        minHeight: 100,
        paddingTop: 'calc(var(--safe-top) + 10px)',
        paddingBottom: 12,
        background: '#04040a',
        ...(!noBorder && { borderBottom: '1px solid rgba(255,255,255,0.05)' }),
      }}
    >
      {/* Back button — absolute top-left */}
      <Link
        href={`/projects/${projectId}`}
        className="absolute flex items-center justify-center flex-shrink-0 active:opacity-60 transition-opacity"
        style={{
          top: 'calc(var(--safe-top) + 10px)',
          left: 20,
          width: 32, height: 32, borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
          <path d="M6 1L1 6L6 11" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>

      {/* Title + meta — centered */}
      <div className="flex flex-col items-center text-center" style={{ maxWidth: '70%' }}>
        <div className="text-text leading-none truncate" style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          {title}
        </div>
        {meta && (
          <div className="font-mono uppercase" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginTop: 4 }}>
            {meta}
          </div>
        )}
      </div>

      {/* Optional right content — absolute top-right */}
      {right && (
        <div
          className="absolute flex items-center flex-shrink-0"
          style={{
            top: 'calc(var(--safe-top) + 10px)',
            right: 20,
          }}
        >
          {right}
        </div>
      )}
    </div>
  )
}
