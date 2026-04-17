import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

interface ModuleCardProps {
  name: string
  meta: string
  href: string
  children: React.ReactNode
  className?: string
}

export function ModuleCard({
  name,
  meta,
  href,
  children,
  className,
}: ModuleCardProps) {
  return (
    <div className={cn(
      'bg-surface border border-border rounded-[10px] overflow-hidden',
      className
    )}>
      {/* Header — tapping navigates to the full screen */}
      <Link
        href={href}
        className={cn(
          'flex items-center gap-2 px-3.5 py-2.5',
          'border-b border-border',
          'active:bg-white/[0.025] transition-colors'
        )}
      >
        <span className="font-semibold text-[0.78rem] tracking-tight text-text flex-1">
          {name}
        </span>
        <span className="font-mono text-[0.5rem] tracking-wide text-muted font-light">
          {meta}
        </span>
        {/* Chevron */}
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="text-muted/50 flex-shrink-0">
          <path d="M3.5 2.5l4 3-4 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </Link>

      {/* Body — preview content */}
      <div className="px-3.5 py-3">
        {children}
      </div>
    </div>
  )
}
