import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

interface TopbarProps {
  title: string
  backHref?: string
  backLabel?: string
  right?: React.ReactNode
  className?: string
}

export function Topbar({
  title,
  backHref,
  backLabel = 'Hub',
  right,
  className,
}: TopbarProps) {
  return (
    <div className={cn('topbar', className)}>
      {backHref && (
        <Link href={backHref} className="back-btn">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path
              d="M8.5 2.5L4.5 6.5l4 4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {backLabel}
        </Link>
      )}

      <span className="font-semibold text-[0.87rem] tracking-tight text-text flex-1 text-center">
        {title}
      </span>

      {right ? (
        <div className="flex items-center gap-2">{right}</div>
      ) : (
        // Spacer to keep title centered when no back button
        backHref ? null : <div className="w-16" />
      )}
    </div>
  )
}

// Icon button used in topbar right side
export function IconButton({
  onClick,
  children,
  label,
}: {
  onClick?: () => void
  children: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className="icon-btn"
      aria-label={label}
    >
      {children}
    </button>
  )
}
