'use client'

// iOS-style "open folder" — a glass card layered over the projects grid
// when the user taps a folder outside wiggle. Renders the folder's
// projects in the same 2-col SlateCard grid the home grid uses, but
// scoped to the folder. Closing handled by the bar's Back button via
// RootFabContext.closeOpenFolder() (already wired in PR #37 stack
// extension), tap on the dim backdrop, or escape (later).

import { useLayoutEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { haptic } from '@/lib/utils/haptics'
import { useLongPress } from '@/lib/hooks/useLongPress'
import { SlateCard, hexToRgba } from '@/components/projects/SlateCard'
import { ArchiveIcon, ARCHIVE_FOLDER_ID, MOVE_OUT_TARGET_ID } from '@/components/projects/ArchiveIcon'
import type { Project } from '@/types'

type FolderRef = { id: string; name: string; color: string | null }
type FolderWithCount = FolderRef & { count: number }

interface OpenFolderSheetProps {
  open: boolean
  folder: FolderRef | null
  projects: Project[]
  onClose: () => void
  // Optional kicker label override (default "Folder"; "Archive" for the
  // synthetic archive folder).
  kicker?: string
  // Optional empty-state copy override.
  emptyMessage?: string
  // Optional click-handler override per project. Default: route to project page.
  onProjectClick?: (project: Project) => void
  // Optional long-press handler per project. Used by the Archive variant to
  // open the restore prompt without hijacking the tap-to-route default.
  onProjectLongPress?: (project: Project) => void
  // Optional folder cards rendered before the project tiles. Used by the
  // Archive variant to show archived folders inline so the user can drill
  // into them or long-press to restore.
  folders?: FolderWithCount[]
  onFolderClick?: (folder: FolderRef) => void
  onFolderLongPress?: (folder: FolderRef) => void
  // Optional viewport-space origin for an iOS-style zoom-from-source open.
  // When provided, the sheet's transform-origin is anchored to this point
  // so it scales out from where the user tapped (the folder card or the
  // archive icon) instead of scaling around its own center.
  originPoint?: { x: number; y: number } | null

  // NEW — wiggle / drag wiring
  editMode?: boolean
  draggingProjectId?: string | null      // viewport-active drag's project id (for ghost styling)
  dragTargetId?: string | null           // current drag target id (for archive/move-out highlights)
  archivedCount?: number                 // number of archived projects (for ArchiveIcon label)
  onProjectTouchStart?: (e: React.TouchEvent | React.MouseEvent, projectId: string) => void
  onArchiveTap?: () => void              // tap on in-sheet ArchiveIcon → swap to Archive variant
  // Called when the in-sheet "Done" pill is tapped — parent should
  // turn editMode off and clear any drag state.
  onExitEditMode?: () => void

  // Color resolver — mirrors page.tsx's `getColor`, which combines
  // session colorOverrides with the project's stored color and a
  // deterministic per-id hash fallback. Defaults to a fixed indigo
  // when the parent doesn't pass one (e.g. archive variant).
  getColor?: (projectId: string) => string
}

// Compact folder tile — visual cue (folder icon + count) in the same 4:3 slot
// as a project tile. Sized for the Archive variant where archived folders
// live alongside loose archived projects.
function FolderTile({
  folder, onClick, onLongPress,
}: { folder: FolderWithCount; onClick: () => void; onLongPress?: () => void }) {
  const longPressHandlers = useLongPress(onLongPress ?? (() => {}), 500, 8, onClick)
  const accent = folder.color ?? '#6470f3'
  return (
    <button
      data-folder-id={folder.id}
      {...longPressHandlers}
      className="active:scale-[0.96] active:brightness-[0.85]"
      style={{
        aspectRatio: '4 / 3',
        borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
        border: `1px solid ${hexToRgba(accent, 0.32)}`,
        background: 'rgba(8,8,14,0.7)',
        padding: '12px 12px 10px', textAlign: 'left',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
      }}
    >
      <div style={{
        width: 28, height: 22, borderRadius: 4,
        background: hexToRgba(accent, 0.18),
        border: `1px solid ${hexToRgba(accent, 0.5)}`,
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: -4, left: 2, width: 14, height: 5,
          borderRadius: '2px 2px 0 0',
          background: hexToRgba(accent, 0.5),
        }} />
      </div>
      <div>
        <div style={{ fontWeight: 800, fontSize: 13, color: '#dddde8', letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</div>
        <div className="font-mono" style={{ fontSize: 9, color: hexToRgba(accent, 0.7), letterSpacing: '0.08em', marginTop: 2 }}>
          {folder.count} project{folder.count !== 1 ? 's' : ''}
        </div>
      </div>
    </button>
  )
}

export function OpenFolderSheet({
  open, folder, projects, onClose, kicker, emptyMessage,
  onProjectClick, onProjectLongPress,
  folders, onFolderClick, onFolderLongPress,
  originPoint,
  editMode, draggingProjectId, dragTargetId, archivedCount, onProjectTouchStart, onArchiveTap,
  onExitEditMode,
  getColor,
}: OpenFolderSheetProps) {
  const router = useRouter()
  const accent = folder?.color ?? '#6470f3'
  const defaultProjectClick = (p: Project) => { haptic('light'); onClose(); router.push(`/projects/${p.id}`) }
  const handleClick = onProjectClick ?? defaultProjectClick
  const folderList = folders ?? []
  const isEmpty = projects.length === 0 && folderList.length === 0
  const totalCount = projects.length + folderList.length

  // Compute transform-origin in pixels relative to the sheet's own bounding
  // box so the open animation scales out of (and the close animation scales
  // back into) the source tile. If no originPoint is supplied (e.g. closing
  // via the bar back button), we keep the previous origin so the exit still
  // animates toward the source instead of snapping to center.
  const sheetRef = useRef<HTMLDivElement>(null)
  const [transformOriginPx, setTransformOriginPx] = useState<string>('50% 50%')
  useLayoutEffect(() => {
    if (!open || !originPoint) return
    const el = sheetRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = Math.max(0, Math.min(r.width, originPoint.x - r.left))
    const y = Math.max(0, Math.min(r.height, originPoint.y - r.top))
    setTransformOriginPx(`${x}px ${y}px`)
  }, [open, originPoint])

  const isArchiveVariant = folder?.id === ARCHIVE_FOLDER_ID

  return (
    <AnimatePresence>
      {open && folder && (
        <motion.div
          ref={sheetRef}
          key="open-folder"
          initial={{ opacity: 0, scale: 0.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.06 }}
          transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
          className={`folder-open-sheet${isArchiveVariant ? ' archive-tone' : ''}`}
          style={{
            transformOrigin: transformOriginPx,
          }}
        >
          {/* Accent line */}
          <div style={{
            height: 2, flexShrink: 0,
            background: `linear-gradient(90deg, transparent 5%, ${hexToRgba(accent, 0.45)} 40%, ${hexToRgba(accent, 0.45)} 60%, transparent 95%)`,
          }} />

          {/* Header */}
          <div style={{ padding: '14px 18px 12px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="font-mono" style={{ fontSize: 9, color: hexToRgba(accent, 0.6), textTransform: 'uppercase', letterSpacing: '0.12em' }}>{kicker ?? 'Folder'}</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#dddde8', letterSpacing: '-0.02em', marginTop: 2 }}>{folder.name}</div>
            <div className="font-mono" style={{ fontSize: 10, color: '#62627a', marginTop: 4 }}>
              {totalCount} item{totalCount !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Grid */}
          <div style={{
            flex: 1, minHeight: 0, overflowY: 'auto',
            WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
            padding: '12px 14px 18px',
          }}>
            {isEmpty ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', fontSize: 12, color: '#62627a' }}>
                {emptyMessage ?? 'No projects yet — drop one in from the home grid'}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '14px 12px' }}>
                {folderList.map(f => (
                  <FolderTile
                    key={f.id}
                    folder={f}
                    onClick={() => onFolderClick?.(f)}
                    onLongPress={onFolderLongPress ? () => onFolderLongPress(f) : undefined}
                  />
                ))}
                {editMode && folder?.id !== ARCHIVE_FOLDER_ID && (
                  <div style={{
                    gridColumn: 'span 3', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '8px 14px', background: 'rgba(196,90,220,0.08)', border: '1px solid rgba(196,90,220,0.18)',
                    borderRadius: 20, marginBottom: 2,
                  }}>
                    <span className="font-mono" style={{ fontSize: 10, color: 'rgba(196,90,220,0.6)', letterSpacing: '0.06em' }}>
                      Hold + drag to move
                    </span>
                    <button
                      className="font-mono"
                      onClick={() => onExitEditMode?.()}
                      style={{
                        fontSize: 10, color: '#c45adc', letterSpacing: '0.06em', padding: '3px 10px', borderRadius: 20,
                        background: 'rgba(196,90,220,0.12)', border: '1px solid rgba(196,90,220,0.25)', cursor: 'pointer',
                      }}
                    >Done</button>
                  </div>
                )}
                {projects.map((p, i) => {
                  const isDragging = draggingProjectId === p.id
                  return (
                    <motion.div
                      key={p.id}
                      layout
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      onTouchStart={onProjectTouchStart ? (e => onProjectTouchStart(e, p.id)) : undefined}
                      onMouseDown={onProjectTouchStart ? (e => onProjectTouchStart(e, p.id)) : undefined}
                      style={{
                        position: 'relative',
                        touchAction: editMode ? 'none' : 'auto',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        WebkitTouchCallout: 'none',
                      }}
                    >
                      <SlateCard
                        project={p}
                        color={getColor ? getColor(p.id) : (p.color || '#6470f3')}
                        dimmed={!!draggingProjectId && !isDragging}
                        editMode={editMode ?? false}
                        isGhost={isDragging}
                        isDragging={false}
                        wiggleDelay={i * 0.08}
                        onClick={() => handleClick(p)}
                        onLongPress={onProjectLongPress ? () => onProjectLongPress(p) : (() => {})}
                      />
                    </motion.div>
                  )
                })}

                {editMode && folder?.id !== ARCHIVE_FOLDER_ID && (
                  <>
                    {/* Move-out pill — only visible while dragging a project. */}
                    {draggingProjectId && (
                      <div
                        data-move-out-target={MOVE_OUT_TARGET_ID}
                        style={{
                          gridColumn: 'span 3',
                          display: 'flex',
                          justifyContent: 'center',
                          padding: '6px 2px 2px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex', alignItems: 'center', gap: 7,
                            padding: '8px 16px',
                            borderRadius: 20,
                            border: dragTargetId === MOVE_OUT_TARGET_ID
                              ? `1.5px solid ${hexToRgba(accent, 0.7)}`
                              : `1px dashed ${hexToRgba(accent, 0.4)}`,
                            background: dragTargetId === MOVE_OUT_TARGET_ID
                              ? hexToRgba(accent, 0.18)
                              : hexToRgba(accent, 0.04),
                            transform: dragTargetId === MOVE_OUT_TARGET_ID ? 'scale(1.06)' : 'scale(1)',
                            transition: 'all 0.18s ease',
                            color: dragTargetId === MOVE_OUT_TARGET_ID ? '#dddde8' : hexToRgba(accent, 0.7),
                          }}
                        >
                          <span style={{ fontSize: 13 }}>←</span>
                          <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.1em' }}>
                            Move out
                          </span>
                        </div>
                      </div>
                    )}

                    {/* In-sheet Archive icon — drop target during drag, tap to
                        swap sheet contents to the Archive variant. */}
                    <ArchiveIcon
                      count={archivedCount ?? 0}
                      isDropTarget={dragTargetId === ARCHIVE_FOLDER_ID}
                      onClick={onArchiveTap ?? (() => {})}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
