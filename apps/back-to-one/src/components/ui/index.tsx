'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import type { Phase } from '@/lib/utils/phase'

export { Sigil } from './Sigil'
export { DestructiveSheet } from './DestructiveSheet'
export { ThreadsIcon } from './ThreadsIcon'
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

const AVATAR_COLORS = [
  ['#e8a020', '#d4782c'], ['#6470f3', '#8b5cf6'], ['#00b894', '#00857a'],
  ['#c45adc', '#9b4dca'], ['#e87060', '#d35448'], ['#3b82f6', '#2563eb'],
  ['#f59e0b', '#d97706'], ['#10b981', '#059669'],
]

function avatarGradient(name: string): [string, string] {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const pair = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
  return [pair[0], pair[1]]
}

function avatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  return (name[0] ?? '?').toUpperCase()
}

export function CrewAvatar({
  name,
  size = 38,
  avatarUrl,
}: {
  name: string
  size?: number
  avatarUrl?: string | null
}) {
  const [c1] = avatarGradient(name)
  const initials = avatarInitials(name)
  const [imgFailed, setImgFailed] = useState(false)
  const showImage = !!avatarUrl && !imgFailed
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <div
        className="rounded-full flex items-center justify-center font-semibold overflow-hidden"
        style={{
          width: size,
          height: size,
          background: '#0a0a12',
          border: `0.5px solid ${c1}`,
          color: c1,
          fontSize: size * 0.26,
        }}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl!}
            alt={name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setImgFailed(true)}
          />
        ) : (
          initials
        )}
      </div>
    </div>
  )
}
