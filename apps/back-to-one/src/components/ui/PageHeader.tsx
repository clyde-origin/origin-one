import Link from 'next/link'

interface PageHeaderProps {
  projectId: string
  title: string
  meta?: React.ReactNode
  left?: React.ReactNode
  right?: React.ReactNode
  noBorder?: boolean
}

export function PageHeader({ projectId, title, meta, left, right, noBorder }: PageHeaderProps) {
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
      {/* Title + meta — centered */}
      <div className="flex flex-col items-center text-center" style={{ maxWidth: '70%' }}>
        <div className="text-text leading-none truncate" style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
          {title}
        </div>
        {meta && (
          <div className="font-mono uppercase" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginTop: 4 }}>
            {meta}
          </div>
        )}
      </div>

      {/* Optional left content — absolute top-left, mirror of right slot */}
      {left && (
        <div
          className="absolute flex items-center flex-shrink-0"
          style={{
            top: 'calc(var(--safe-top) + 10px)',
            left: 20,
          }}
        >
          {left}
        </div>
      )}

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
