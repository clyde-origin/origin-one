'use client'

// Folder card in the project-selection grid. Mini-grid of slate-shaped
// tiles, scaling by project count per the spec. Folder accent outlines
// the card; tile body = project's getProjectColor(); tile stripe tint =
// matches the slate top-stripes on the real SlateCard.
//
// Aspect ratio matches the parent grid's auto-row (which is implicit on
// the project slate cards) — wrapping in aspect-ratio: 4/3 keeps folder
// cards visually consistent with project cards.

import { getProjectColor } from '@/lib/utils/phase'
import { haptic } from '@/lib/utils/haptics'
import { useLongPress } from '@/lib/hooks/useLongPress'
import type { Project } from '@/types'

interface FolderCardProps {
  folder: { id: string; name: string; color: string | null }
  projects: Project[]            // projects contained in this folder, in placement order
  editMode: boolean
  isGhost: boolean
  isDragging: boolean
  isDropTarget: boolean
  dimmed: boolean
  wiggleDelay?: number
  onLongPress: () => void
  onClick: () => void
}

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function bodyGradient(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const c1 = `rgb(${Math.round(r * 0.07) + 4},${Math.round(g * 0.07) + 4},${Math.round(b * 0.07) + 4})`
  const c2 = `rgb(${Math.round(r * 0.05) + 2},${Math.round(g * 0.05) + 2},${Math.round(b * 0.05) + 2})`
  return `linear-gradient(135deg,${c1},${c2})`
}

function tileLayout(count: number): { cols: number; rows: number; visible: number; overflow: boolean } {
  if (count <= 0) return { cols: 2, rows: 2, visible: 0, overflow: false } // empty: 4 placeholder cells
  if (count === 1) return { cols: 1, rows: 1, visible: 1, overflow: false }
  if (count === 2) return { cols: 2, rows: 1, visible: 2, overflow: false }
  if (count <= 4)  return { cols: 2, rows: 2, visible: count, overflow: false }
  if (count <= 9)  return { cols: 3, rows: 3, visible: count, overflow: false }
  return { cols: 3, rows: 3, visible: 8, overflow: true } // 10+ → 8 tiles + +N
}

export function FolderCard({
  folder, projects, editMode, isGhost, isDragging, isDropTarget, dimmed, wiggleDelay,
  onLongPress, onClick,
}: FolderCardProps) {
  const longPressHandlers = useLongPress(onLongPress, 500)
  const accent = folder.color ?? '#6470f3'
  const layout = tileLayout(projects.length)
  const overflowCount = layout.overflow ? projects.length - layout.visible : 0

  if (isGhost) {
    return (
      <div style={{
        borderRadius: 14, border: '1px dashed rgba(255,255,255,0.1)',
        opacity: 0.18, aspectRatio: '4 / 3',
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
    zIndex: 50, opacity: 0.95,
  } : {}

  const targetStyle = isDropTarget ? {
    transform: 'scale(1.04)',
    boxShadow: `0 0 0 2px ${hexToRgba(accent, 0.7)}, 0 0 30px ${hexToRgba(accent, 0.5)}, inset 0 0 18px ${hexToRgba(accent, 0.2)}`,
  } : {}

  return (
    <div
      data-folder-id={folder.id}
      onClick={editMode ? undefined : onClick}
      {...(editMode ? {} : longPressHandlers)}
      style={{
        position: 'relative',
        borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
        background: 'rgba(8,8,14,0.6)',
        border: `1px solid ${hexToRgba(accent, 0.22)}`,
        aspectRatio: '4 / 3',
        padding: 8,
        display: 'grid', gridTemplateRows: '1fr auto', gap: 5,
        opacity: dimmed ? 0.35 : 1,
        filter: dimmed ? 'blur(1px)' : 'none',
        transition: isDragging ? 'none' : 'transform 0.18s ease, box-shadow 0.18s ease, opacity 0.25s, filter 0.25s',
        userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
        ...wiggleStyle, ...dragStyle, ...targetStyle,
      }}
    >
      {/* Mini-grid of slate-shaped tiles */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
        gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
        gap: 3, minHeight: 0,
      }}>
        {Array.from({ length: layout.cols * layout.rows }).map((_, i) => {
          if (i >= layout.visible) {
            // empty placeholder cell (3-project case has 1; bigger sizes have remainder)
            if (layout.overflow && i === layout.cols * layout.rows - 1) {
              return (
                <div key={i} style={{
                  background: 'rgba(8,8,14,0.85)', border: `0.5px solid ${hexToRgba(accent, 0.45)}`,
                  borderRadius: 3,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 700,
                  color: hexToRgba(accent, 0.95),
                }}>+{overflowCount}</div>
              )
            }
            return (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px dashed rgba(255,255,255,0.06)', borderRadius: 3,
              }} />
            )
          }
          const project = projects[i]
          const projColor = project.color || getProjectColor(project.id)
          return (
            <div key={project.id} style={{
              background: bodyGradient(projColor),
              borderRadius: 3, border: '0.5px solid rgba(255,255,255,0.06)',
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column', minHeight: 0,
            }}>
              <div style={{
                height: '20%', minHeight: 4,
                backgroundColor: projColor,
                backgroundImage:
                  `linear-gradient(rgba(255,255,255,0.28), rgba(255,255,255,0.28)) 0 0 / 100% 1px no-repeat,
                   linear-gradient(rgba(255,255,255,0.15), rgba(255,255,255,0.15)) 0 1.5px / 100% 1px no-repeat`,
              }} />
              <div style={{ flex: 1 }} />
            </div>
          )
        })}
      </div>

      {/* Label row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 2px' }}>
        <span style={{
          fontWeight: 700, fontSize: 11, color: '#dddde8',
          letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{folder.name}</span>
        <span className="font-mono" style={{
          fontSize: 8, color: hexToRgba(accent, 0.7), letterSpacing: '0.08em', flexShrink: 0,
        }}>{projects.length}</span>
      </div>
    </div>
  )
}
