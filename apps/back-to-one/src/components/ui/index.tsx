import { cn } from '@/lib/utils/cn'
import type { Phase } from '@/types'

export { Sigil } from './Sigil'
export { DestructiveSheet } from './DestructiveSheet'
export { SkeletonLine, SkeletonAvatar, SkeletonCard } from './Skeleton'

// ── PHASE PILL ──────────────────────────────────────────────

const phaseStyles: Record<Phase, string> = {
  pre:  'bg-pre/10 text-pre',
  prod: 'bg-prod/10 text-prod',
  post: 'bg-post/10 text-post',
}

const phaseLabels: Record<Phase, string> = {
  pre: 'Pre', prod: 'Prod', post: 'Post',
}

export function PhasePill({ phase, className }: {
  phase: Phase
  className?: string
}) {
  return (
    <span className={cn(
      'font-mono text-[0.5rem] tracking-widest uppercase px-2 py-0.5 rounded-sm font-medium',
      phaseStyles[phase],
      className
    )}>
      {phaseLabels[phase]}
    </span>
  )
}

// ── EMPTY STATE ──────────────────────────────────────────────

export function EmptyState({ icon, text }: {
  icon?: React.ReactNode
  text: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted">
      {icon && <div className="opacity-40">{icon}</div>}
      <p className="font-mono text-[0.6rem] tracking-widest uppercase">{text}</p>
    </div>
  )
}

// ── LOADING STATE ────────────────────────────────────────────

export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-5 h-5 rounded-full border border-border2 border-t-accent animate-spin" />
    </div>
  )
}

// ── STATUS BADGE ─────────────────────────────────────────────

const statusStyles: Record<string, string> = {
  'Confirmed':    'bg-post/10 text-post',
  'Approved':     'bg-post/10 text-post font-semibold',
  'Selected':     'bg-post/10 text-post',
  'Ready':        'bg-post/10 text-post',
  'Hold':         'bg-pre/10 text-pre',
  'Option':       'bg-pre/10 text-pre',
  'In Progress':  'bg-pre/10 text-pre',
  'Uncast':       'bg-surface3 text-muted',
  'Scouted':      'bg-accent/10 text-accent-soft',
  'Needs Review': 'bg-red/10 text-red',
}

export function StatusBadge({ status, className }: {
  status: string
  className?: string
}) {
  return (
    <span className={cn(
      'font-mono text-[0.48rem] tracking-widest uppercase px-1.5 py-0.5 rounded-sm',
      statusStyles[status] ?? 'bg-surface3 text-muted',
      className
    )}>
      {status}
    </span>
  )
}

// ── SECTION LABEL ────────────────────────────────────────────

export function SectionLabel({ children, className }: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn(
      'font-mono text-[0.52rem] tracking-[0.2em] uppercase text-muted',
      'pb-2 border-b border-border mb-2 font-light',
      className
    )}>
      {children}
    </div>
  )
}

// ── CREW AVATAR ──────────────────────────────────────────────

export function CrewAvatar({
  first,
  last,
  color1,
  color2,
  size = 38,
  online,
}: {
  first: string
  last: string
  color1: string
  color2: string
  size?: number
  online?: boolean
}) {
  const initials = `${first[0]}${last[0]}`
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <div
        className="rounded-full flex items-center justify-center font-bold text-white"
        style={{
          width: size,
          height: size,
          background: `linear-gradient(135deg, ${color1}, ${color2})`,
          fontSize: size * 0.26,
        }}
      >
        {initials}
      </div>
      {online && (
        <div
          className="absolute bottom-0 right-0 rounded-full bg-green border-2 border-bg"
          style={{ width: size * 0.3, height: size * 0.3 }}
        />
      )}
    </div>
  )
}
