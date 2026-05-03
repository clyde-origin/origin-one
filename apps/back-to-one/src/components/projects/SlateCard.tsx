'use client'

import { useLongPress } from '@/lib/hooks/useLongPress'
import { STATUS_LABELS_SHORT } from '@/lib/utils/phase'
import type { Project, ProjectStatus } from '@/types'

export function hexToRgba(hex: string | null | undefined, a: number) {
  const h = hex || '#444444'
  const r = parseInt(h.slice(1, 3), 16)
  const g = parseInt(h.slice(3, 5), 16)
  const b = parseInt(h.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function hexToRgbTriplet(hex: string | null | undefined): string {
  const h = hex || '#444444'
  const r = parseInt(h.slice(1, 3), 16)
  const g = parseInt(h.slice(3, 5), 16)
  const b = parseInt(h.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

function statusToPhaseClass(s: ProjectStatus): 'pre' | 'prod' | 'post' | 'archived' {
  if (s === 'production') return 'prod'
  if (s === 'post_production') return 'post'
  if (s === 'archived') return 'archived'
  return 'pre'
}

export function WiggleStyle() {
  return (
    <style>{`
      @keyframes wiggle {
        0%   { transform: rotate(0deg); }
        25%  { transform: rotate(-1.5deg); }
        75%  { transform: rotate(1.5deg); }
        100% { transform: rotate(0deg); }
      }
    `}</style>
  )
}

export type SlateCardProps = {
  project: Project
  color: string
  dimmed: boolean
  editMode: boolean
  isGhost: boolean
  isDragging: boolean
  wiggleDelay?: number
  onLongPress: () => void
  onClick: () => void
}

export function SlateCard({
  project, color, dimmed, editMode, isGhost, isDragging, wiggleDelay,
  onLongPress, onClick,
}: SlateCardProps) {
  const longPressHandlers = useLongPress(onLongPress, 500, 8, onClick)

  if (isGhost) {
    return (
      <div style={{
        borderRadius: 14, border: '1px dashed rgba(255,255,255,0.1)',
        opacity: 0.18, aspectRatio: '1 / 1',
      }} />
    )
  }

  const wiggleStyle = editMode && !isDragging ? {
    animation: 'wiggle 0.5s ease-in-out infinite',
    animationDelay: `${wiggleDelay ?? 0}s`,
  } : {}

  const dragStyle = isDragging ? {
    transform: 'scale(1.06) rotate(1.5deg)',
    boxShadow: '0 16px 48px rgba(0,0,0,0.7), 0 0 0 1.5px rgba(255,255,255,0.12)',
    zIndex: 50,
    opacity: 0.95,
  } : {}

  const phaseClass = statusToPhaseClass(project.status)
  const projRgb = hexToRgbTriplet(color)

  return (
    <div
      {...longPressHandlers}
      data-project-id={project.id}
      className="slate-card"
      style={{
        ['--proj-rgb' as string]: projRgb,
        opacity: dimmed ? 0.35 : 1,
        filter: dimmed ? 'blur(1px)' : undefined,
        ...wiggleStyle,
        ...dragStyle,
      }}
    >
      <div className="slate-body">
        {project.client && <div className="slate-client">{project.client}</div>}
        <div className="slate-name">{project.name}</div>
        <div className={`slate-phase ${phaseClass}`}>
          <span className="phase-dot" />
          {STATUS_LABELS_SHORT[project.status] ?? project.status}
        </div>
      </div>
    </div>
  )
}
