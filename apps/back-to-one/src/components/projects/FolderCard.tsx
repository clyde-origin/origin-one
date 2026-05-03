'use client'

// Folder card in the project-selection grid. Mac-style manila folder
// silhouette via SVG path (Cinema Glass V1). Tab in top-left curves
// into the body; the contained projects render as a 2x2 .slate-folder-grid
// of color-tinted cells.

import { getProjectColor } from '@/lib/utils/phase'
import { useLongPress } from '@/lib/hooks/useLongPress'
import type { Project } from '@/types'

interface FolderCardProps {
  folder: { id: string; name: string; color: string | null }
  projects: Project[]
  editMode: boolean
  isGhost: boolean
  isDragging: boolean
  isDropTarget: boolean
  dimmed: boolean
  wiggleDelay?: number
  onLongPress: () => void
  onClick: () => void
}

function hexToRgbTriplet(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

// 4 visible cells max in the 2x2 grid; overflow shows +N in the last cell.
function cellLayout(count: number): { visible: number; overflow: boolean } {
  if (count <= 4) return { visible: count, overflow: false }
  return { visible: 3, overflow: true }
}

export function FolderCard({
  folder, projects, editMode, isGhost, isDragging, isDropTarget, dimmed, wiggleDelay,
  onLongPress, onClick,
}: FolderCardProps) {
  const longPressHandlers = useLongPress(onLongPress, 500, 8, onClick)
  const accent = folder.color ?? '#6470f3'
  const projRgb = hexToRgbTriplet(accent)
  const layout = cellLayout(projects.length)
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
    filter: 'drop-shadow(0 16px 48px rgba(0,0,0,0.7))',
    zIndex: 50, opacity: 0.95,
  } : {}

  const cellStyles = Array.from({ length: 4 }).map((_, i) => {
    if (layout.overflow && i === 3) return null
    if (i >= layout.visible) return null
    const project = projects[i]
    const projColor = project.color || getProjectColor(project.id)
    return { project, cellRgb: hexToRgbTriplet(projColor) }
  })

  return (
    <div
      data-folder-id={folder.id}
      {...(editMode ? {} : longPressHandlers)}
      className={`slate-folder-card${isDropTarget ? ' drop-target' : ''}`}
      style={{
        // --proj-rgb drives the SVG fill/stroke, drop shadow, and tab content tint
        ['--proj-rgb' as string]: projRgb,
        opacity: dimmed ? 0.35 : 1,
        filter: dimmed ? 'blur(1px)' : undefined,
        ...wiggleStyle,
        ...dragStyle,
      }}
    >
      <svg className="slate-folder-svg" preserveAspectRatio="none" viewBox="0 0 200 125">
        <path
          className="folder-path"
          d="M 8 0 L 132 0 Q 140 0 140 8 L 140 16 Q 140 24 148 24 L 192 24 Q 200 24 200 32 L 200 117 Q 200 125 192 125 L 8 125 Q 0 125 0 117 L 0 8 Q 0 0 8 0 Z"
        />
      </svg>

      <div className="slate-folder-tab-content">
        <span className="slate-folder-name">{folder.name}</span>
        <span className="slate-folder-count">{projects.length}</span>
      </div>

      <div className="slate-folder-body">
        <div className="slate-folder-grid">
          {cellStyles.map((cell, i) => {
            if (layout.overflow && i === 3) {
              return (
                <div key="overflow" className="slate-folder-cell overflow">
                  +{overflowCount}
                </div>
              )
            }
            if (!cell) {
              return <div key={`empty-${i}`} className="slate-folder-cell empty" />
            }
            return (
              <div
                key={cell.project.id}
                className="slate-folder-cell"
                style={{ ['--cell-rgb' as string]: cell.cellRgb }}
              >
                <span className="slate-folder-cell-name">{cell.project.name}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
