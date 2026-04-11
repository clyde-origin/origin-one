'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useProjects, useCrew, useMilestones, useArchiveProject, useDeleteProject, useUpdateProject,
  useFolders, useCreateFolder, useUpdateProjectOrder,
} from '@/lib/hooks/useOriginOne'
import { SkeletonLine, CrewAvatar } from '@/components/ui'
import { getProjectColor, PHASE_LABELS_MID, PHASE_HEX } from '@/lib/utils/phase'
import { haptic } from '@/lib/utils/haptics'
import { useLongPress } from '@/lib/hooks/useLongPress'
import { ProjectActionSheet } from '@/components/projects/ProjectActionSheet'
import { GlobalPanels, type PanelId } from '@/components/projects/GlobalPanels'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import type { Phase, Project, Folder } from '@/types'

// ── HELPERS ──────────────────────────────────────────────────

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function slateBodyBg(color: string): string {
  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)
  const dr = Math.round(r * 0.07)
  const dg = Math.round(g * 0.07)
  const db = Math.round(b * 0.07)
  const c1 = `rgb(${dr + 4},${dg + 4},${db + 4})`
  const c2 = `rgb(${Math.round(dr * 0.7) + 2},${Math.round(dg * 0.7) + 2},${Math.round(db * 0.7) + 2})`
  return `linear-gradient(135deg,${c1},${c2})`
}

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// ── COLORED LINES (replaces clapper SVG) ─────────────────────

function SlateLines({ color }: { color: string }) {
  // 6 lines, every other one transparent (alternating pattern)
  const opacities = [0.28, 0, 0.15, 0, 0.07, 0]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 18, overflow: 'hidden' }}>
      {opacities.map((o, i) => (
        <div key={i} style={{ flex: 1, background: o > 0 ? hexToRgba(color, o) : 'transparent' }} />
      ))}
    </div>
  )
}

function FolderLines({ color }: { color: string }) {
  const opacities = [0.25, 0, 0.14, 0, 0.07, 0]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 18, overflow: 'hidden' }}>
      {opacities.map((o, i) => (
        <div key={i} style={{ flex: 1, background: o > 0 ? hexToRgba(color, o) : 'transparent' }} />
      ))}
    </div>
  )
}

// ── SPACE BACKGROUND ─────────────────────────────────────────

function SpaceBg() {
  const bokeh = [
    { w: 54, t: '5%', l: '3%', o: 0.05 },
    { w: 38, t: '12%', l: undefined, r: '5%', o: 0.06 },
    { w: 66, t: '50%', l: '1%', o: 0.04 },
    { w: 44, t: '66%', l: undefined, r: '3%', o: 0.05 },
    { w: 28, t: '36%', l: '8%', o: 0.055 },
    { w: 20, t: '26%', l: undefined, r: '11%', o: 0.06 },
    { w: 48, t: '58%', l: undefined, r: '8%', o: 0.045 },
  ]
  const stars = [
    { s: 1.5, t: '4%', l: '18%', o: 0.5 }, { s: 1, t: '7%', l: '65%', o: 0.4 },
    { s: 2, t: '11%', l: '42%', o: 0.55 }, { s: 1, t: '20%', l: '78%', o: 0.38 },
    { s: 1.5, t: '32%', l: '85%', o: 0.45 }, { s: 1, t: '42%', l: '56%', o: 0.38 },
    { s: 2, t: '47%', l: '11%', o: 0.5 }, { s: 1, t: '55%', l: '73%', o: 0.42 },
    { s: 1.5, t: '63%', l: '46%', o: 0.38 }, { s: 1, t: '70%', l: '30%', o: 0.5 },
    { s: 2, t: '76%', l: '83%', o: 0.42 }, { s: 1, t: '83%', l: '18%', o: 0.38 },
    { s: 1.5, t: '88%', l: '60%', o: 0.46 }, { s: 1, t: '16%', l: '51%', o: 0.6 },
    { s: 2, t: '25%', l: '6%', o: 0.46 },
  ]
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <div style={{ position: 'absolute', top: '18%', left: '12%', width: 260, height: 120, background: 'radial-gradient(ellipse at 40% 50%, rgba(180,200,220,0.12) 0%, rgba(120,160,200,0.05) 35%, transparent 70%)', transform: 'rotate(-22deg)', filter: 'blur(14px)' }} />
      <div style={{ position: 'absolute', top: '60%', left: '35%', width: 200, height: 80, background: 'radial-gradient(ellipse, rgba(150,170,200,0.07) 0%, transparent 70%)', filter: 'blur(10px)' }} />
      {bokeh.map((b, i) => <div key={`bk-${i}`} style={{ position: 'absolute', borderRadius: '50%', filter: 'blur(3px)', width: b.w, height: b.w, top: b.t, left: b.l, right: (b as any).r, background: `rgba(150,165,180,${b.o})` }} />)}
      {stars.map((s, i) => <div key={`st-${i}`} style={{ position: 'absolute', borderRadius: '50%', background: 'white', width: s.s, height: s.s, top: s.t, left: s.l, opacity: s.o }} />)}
    </div>
  )
}

// ── SLATE CARD ───────────────────────────────────────────────

function SlateCard({ project, color, dimmed, editMode, isGhost, isDragging, wiggleDelay, onLongPress, onClick }: {
  project: Project; color: string; dimmed: boolean
  editMode: boolean; isGhost: boolean; isDragging: boolean; wiggleDelay?: number
  onLongPress: () => void; onClick: () => void
}) {
  const phaseColor = PHASE_HEX[project.phase as Phase]
  const { data: crew } = useCrew(project.id)
  const { data: milestones } = useMilestones(project.id)
  const allCrew = crew ?? []
  const nextMs = (milestones ?? []).find(m => new Date(m.date) >= new Date())
  const daysToNext = nextMs ? Math.ceil((new Date(nextMs.date).getTime() - Date.now()) / 86400000) : null
  const isUrgentMs = daysToNext !== null && daysToNext <= 14
  const longPressHandlers = useLongPress(onLongPress, 500)
  const milestoneText = nextMs ? (daysToNext === 0 ? `${nextMs.name} · Today` : `${nextMs.name} · ${daysToNext}d`) : null

  if (isGhost) {
    return (
      <div style={{ borderRadius: 9, border: '1px dashed rgba(255,255,255,0.1)', opacity: 0.18, overflow: 'hidden' }}>
        <div style={{ height: 18 }} />
        <div style={{ height: 90 }} />
      </div>
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

  return (
    <div
      onClick={editMode ? undefined : onClick}
      {...(editMode ? {} : longPressHandlers)}
      data-project-id={project.id}
      style={{
        borderRadius: 9, overflow: 'hidden', position: 'relative', cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
        border: `1px solid rgba(255,255,255,${editMode ? '0.1' : '0.06'})`,
        background: 'rgba(10,10,18,0.6)',
        transition: isDragging ? 'none' : 'transform 0.12s ease, opacity 0.25s, filter 0.25s',
        userSelect: 'none',
        opacity: dimmed ? 0.35 : 1,
        filter: dimmed ? 'blur(1px)' : 'none',
        ...wiggleStyle,
        ...dragStyle,
      }}
      className={editMode || isDragging ? '' : 'active:scale-[0.96] active:brightness-[0.85]'}
    >
      <SlateLines color={color} />
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '9px 10px 11px', position: 'relative', overflow: 'hidden',
        background: slateBodyBg(color),
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="font-mono uppercase" style={{ fontSize: '0.36rem', letterSpacing: '0.08em', color: hexToRgba(color, 0.55), marginBottom: 2 }}>{project.type}</div>
          <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#dddde8', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{project.name}</div>
          {project.client && <div className="font-mono" style={{ fontSize: '0.3rem', color: '#62627a', letterSpacing: '0.06em', marginTop: 2 }}>{project.client}</div>}
        </div>
        <div style={{ position: 'relative', zIndex: 1, marginTop: 7 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 20, background: hexToRgba(phaseColor, 0.12), border: `1px solid ${hexToRgba(phaseColor, 0.2)}` }}>
              <div style={{ width: 3, height: 3, borderRadius: '50%', background: phaseColor, boxShadow: `0 0 3px ${phaseColor}` }} />
              <span className="font-mono uppercase" style={{ fontSize: '0.34rem', letterSpacing: '0.04em', color: phaseColor }}>{PHASE_LABELS_MID[project.phase as Phase]}</span>
            </div>
            {!editMode && allCrew.length > 0 && (
              <div style={{ display: 'flex' }}>
                {allCrew.slice(0, 3).map((c, i) => (
                  <div key={c.id} style={{ marginLeft: i === 0 ? 0 : -4 }}>
                    <CrewAvatar first={c.first} last={c.last} color1={c.color1 || color} color2={c.color2 || color} size={16} />
                  </div>
                ))}
                {allCrew.length > 3 && (
                  <div style={{ width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.3rem', fontWeight: 600, border: '1px solid rgba(0,0,0,0.5)', marginLeft: -4, fontFamily: 'var(--font-dm-mono)', background: hexToRgba(color, 0.12), color: '#62627a' }}>+{allCrew.length - 3}</div>
                )}
              </div>
            )}
          </div>
          {!editMode && milestoneText && (
            <div className="font-mono" style={{ fontSize: '0.32rem', color: isUrgentMs ? '#e8a020' : 'rgba(255,255,255,0.28)', letterSpacing: '0.04em', marginTop: 3 }}>{isUrgentMs ? '↑ ' : ''}{milestoneText}</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── FOLDER CARD ──────────────────────────────────────────────

function FolderCard({ folder, projects, expanded, editMode, isDropTarget, onToggle, getColor }: {
  folder: Folder; projects: Project[]; expanded: boolean; editMode: boolean
  isDropTarget: boolean; onToggle: () => void; getColor: (id: string) => string
}) {
  const router = useRouter()
  const count = projects.length
  const activeCount = projects.filter(p => p.phase === 'prod').length

  return (
    <div
      data-folder-id={folder.id}
      style={{
        gridColumn: 'span 2', borderRadius: 10, overflow: 'hidden', position: 'relative',
        background: 'rgba(10,10,18,0.55)', cursor: 'pointer',
        border: `1px solid ${isDropTarget ? 'rgba(196,90,220,0.5)' : 'rgba(255,255,255,0.06)'}`,
        boxShadow: isDropTarget ? '0 0 20px rgba(196,90,220,0.15), inset 0 0 0 1px rgba(196,90,220,0.2)' : 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      onClick={() => !editMode && onToggle()}
    >
      <FolderLines color={folder.color} />
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px 13px', gap: 12, position: 'relative' }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: hexToRgba(folder.color, 0.15), color: folder.color, fontWeight: 800, fontSize: 13, fontFamily: "'Manrope',sans-serif" }}>
          {folder.name.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#dddde8' }}>{folder.name}</div>
          <div className="font-mono" style={{ fontSize: 10, color: '#62627a', marginTop: 2 }}>
            {isDropTarget ? 'drop to add' : `${count} project${count !== 1 ? 's' : ''}${activeCount > 0 ? ` · ${activeCount} active` : ''}`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {!editMode && (
            <div style={{ display: 'flex', gap: 4 }}>
              {projects.slice(0, 4).map(p => (
                <div key={p.id} style={{ width: 6, height: 6, borderRadius: '50%', background: getColor(p.id) }} />
              ))}
            </div>
          )}
          <div style={{ color: '#62627a', fontSize: 14, opacity: 0.4, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>›</div>
        </div>
        {/* Drop overlay */}
        {isDropTarget && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(4,4,10,0.55)', backdropFilter: 'blur(6px)', borderRadius: '0 0 10px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(196,90,220,0.2)', border: '1.5px solid rgba(196,90,220,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>⊞</div>
              <div className="font-mono" style={{ fontSize: 11, color: 'rgba(196,90,220,0.8)', letterSpacing: '0.08em' }}>Add to {folder.name}</div>
            </div>
          </div>
        )}
      </div>
      {/* Expanded folder contents */}
      {expanded && !editMode && (
        <div style={{ padding: '0 10px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {projects.map(p => (
            <SlateCard key={p.id} project={p} color={getColor(p.id)} dimmed={false} editMode={false} isGhost={false} isDragging={false} onLongPress={() => {}} onClick={() => router.push(`/projects/${p.id}`)} />
          ))}
          <Link href="/projects/new" className="block">
            <div style={{ borderRadius: 9, border: '1.5px dashed rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 60, gap: 6, cursor: 'pointer' }} className="active:scale-[0.96] transition-transform">
              <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M5 1V9M1 5H9" stroke="rgba(255,255,255,0.2)" strokeWidth="1.3" strokeLinecap="round" /></svg>
              <span className="font-mono uppercase" style={{ fontSize: '0.34rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.08em' }}>Add</span>
            </div>
          </Link>
        </div>
      )}
    </div>
  )
}

// ── NEW FOLDER SHEET ─────────────────────────────────────────

const FOLDER_COLORS = ['#c45adc', '#6470f3', '#00b894', '#e8a020', '#e85a5a', '#4ab8e8', '#e8c44a', '#a855f7']

function NewFolderSheet({ onClose, onCreate }: { onClose: () => void; onCreate: (data: { id: string; name: string; color: string; order: number }) => void }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(FOLDER_COLORS[0])

  const handleSubmit = () => {
    if (!name.trim()) return
    onCreate({ id: genId(), name: name.trim(), color, order: 0 })
    onClose()
  }

  return (
    <>
      <SheetHeader title="New Folder" onClose={onClose} />
      <SheetBody>
        <div className="flex flex-col gap-4">
          <div>
            <label className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Client / Name</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Fracture Films"
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
              className="w-full bg-surface2 border border-border2 rounded-lg px-3 py-2.5 text-text text-base outline-none focus:border-accent transition-colors" />
          </div>
          <div>
            <label className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Color</label>
            <div className="flex gap-2">
              {FOLDER_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} style={{
                  width: 32, height: 32, borderRadius: '50%', background: hexToRgba(c, 0.2), border: color === c ? `2px solid ${c}` : '2px solid transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.15s',
                }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: c }} />
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleSubmit} disabled={!name.trim()}
            className="w-full py-3 rounded-lg bg-accent text-white font-semibold text-base transition-opacity disabled:opacity-40 active:opacity-80">
            Create Folder
          </button>
        </div>
      </SheetBody>
    </>
  )
}

// ── WIGGLE KEYFRAMES (injected once) ─────────────────────────

function WiggleStyle() {
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

// ── MAIN PAGE ────────────────────────────────────────────────

export default function ProjectsPage() {
  const router = useRouter()
  const { data: projects, isLoading: loadingProjects } = useProjects()
  const { data: folders } = useFolders()
  const allProjects = projects ?? []
  const allFolders = folders ?? []
  const archiveMutation = useArchiveProject()
  const deleteMutation = useDeleteProject()
  const updateMutation = useUpdateProject()
  const createFolderMutation = useCreateFolder()
  const updateOrderMutation = useUpdateProjectOrder()

  const [actionProject, setActionProject] = useState<{
    id: string; name: string; client: string; type: string; projectColor: string
  } | null>(null)
  const [colorOverrides, setColorOverrides] = useState<Record<string, string>>({})
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [creatingFolder, setCreatingFolder] = useState(false)

  // ── Edit mode (drag) state ──
  const [editMode, setEditMode] = useState(false)
  const [dragProjectId, setDragProjectId] = useState<string | null>(null)
  const [dragTargetIdx, setDragTargetIdx] = useState<number>(-1)
  const [dropFolderId, setDropFolderId] = useState<string | null>(null)

  // Refs to avoid stale closures in touch handlers
  const dragProjectIdRef = useRef<string | null>(null)
  const dragTargetIdxRef = useRef<number>(-1)
  const dropFolderIdRef = useRef<string | null>(null)
  const dragStartRef = useRef<{ x: number; y: number; elX: number; elY: number; w: number } | null>(null)
  const dragElRef = useRef<HTMLDivElement>(null)
  const lastSlotIdxRef = useRef<number>(-1)
  const dragTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingDragRef = useRef<{ projectId: string; x: number; y: number; elX: number; elY: number; w: number } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  function getColor(projectId: string) {
    return colorOverrides[projectId] || getProjectColor(projectId)
  }

  function handleLogout() {
    haptic('medium')
    localStorage.removeItem('origin_one_user_name')
    router.push('/')
  }

  function handleRename(name: string, client: string) {
    if (!actionProject) return
    updateMutation.mutate({ id: actionProject.id, fields: { name, client } })
    setActionProject(prev => prev ? { ...prev, name, client } : null)
  }

  function handleColorChange(color: string) {
    if (!actionProject) return
    setColorOverrides(prev => ({ ...prev, [actionProject.id]: color }))
    setActionProject(prev => prev ? { ...prev, projectColor: color } : null)
    updateMutation.mutate({ id: actionProject.id, fields: { accent_color: color } })
  }

  function toggleFolder(folderId: string) {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  // Group projects
  const unfiledProjects = allProjects
    .filter(p => !p.folderId)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))

  const folderProjects = (folderId: string) =>
    allProjects.filter(p => p.folderId === folderId).sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))

  // ── Touch drag handlers (ref-based, direct DOM transform) ──
  const activateDrag = useCallback((projectId: string, x: number, y: number, elX: number, elY: number, w: number) => {
    dragStartRef.current = { x, y, elX, elY, w }
    dragProjectIdRef.current = projectId
    lastSlotIdxRef.current = -1
    setDragProjectId(projectId)
    haptic('medium')
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent, projectId: string) => {
    if (!editMode) return
    const touch = e.touches[0]
    const el = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const elX = touch.clientX - el.left
    const elY = touch.clientY - el.top
    pendingDragRef.current = { projectId, x: touch.clientX, y: touch.clientY, elX, elY, w: el.width }
    // 300ms hold to enter drag
    dragTimerRef.current = setTimeout(() => {
      const pd = pendingDragRef.current
      if (pd) activateDrag(pd.projectId, pd.x, pd.y, pd.elX, pd.elY, pd.w)
      dragTimerRef.current = null
    }, 300)
  }, [editMode, activateDrag])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const touch = e.touches[0]

    // Cancel pending drag if finger moves too far before 300ms hold
    if (dragTimerRef.current && pendingDragRef.current) {
      const dx = touch.clientX - pendingDragRef.current.x
      const dy = touch.clientY - pendingDragRef.current.y
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        clearTimeout(dragTimerRef.current)
        dragTimerRef.current = null
        pendingDragRef.current = null
      }
      return
    }

    if (!dragProjectIdRef.current || !dragStartRef.current) return
    e.preventDefault()

    // Direct DOM transform — zero lag
    if (dragElRef.current) {
      dragElRef.current.style.left = `${touch.clientX - dragStartRef.current.elX}px`
      dragElRef.current.style.top = `${touch.clientY - dragStartRef.current.elY}px`
    }

    // Dragged card center
    const cardCx = touch.clientX - dragStartRef.current.elX + dragStartRef.current.w / 2
    const cardCy = touch.clientY - dragStartRef.current.elY + 54 // approx half card height

    // Check if over a folder — snapshot rects live
    const folderEls = document.querySelectorAll<HTMLElement>('[data-folder-id]')
    let overFolder: string | null = null
    folderEls.forEach(el => {
      const rect = el.getBoundingClientRect()
      if (cardCx >= rect.left && cardCx <= rect.right && cardCy >= rect.top && cardCy <= rect.bottom) {
        overFolder = el.dataset.folderId!
      }
    })
    dropFolderIdRef.current = overFolder
    setDropFolderId(overFolder)

    if (overFolder) {
      dragTargetIdxRef.current = -1
      setDragTargetIdx(-1)
      return
    }

    // Snapshot slot rects live on every move (grid shifts as items displace)
    const slotEls = document.querySelectorAll<HTMLElement>('[data-project-id]')
    let closest = -1
    let closestDist = Infinity
    const slots: { id: string; cx: number; cy: number }[] = []
    slotEls.forEach(el => {
      if (el.closest('[data-folder-id]')) return // skip folder-nested
      if (el.dataset.projectId === dragProjectIdRef.current) return // skip self
      const rect = el.getBoundingClientRect()
      slots.push({ id: el.dataset.projectId!, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 })
    })
    // Find closest slot by distance from dragged card center
    slots.forEach((slot, i) => {
      const dist = Math.hypot(cardCx - slot.cx, cardCy - slot.cy)
      if (dist < closestDist) { closestDist = dist; closest = i }
    })
    // Insert after if card center is past slot center
    if (closest >= 0 && cardCy > slots[closest].cy) closest++

    if (closest !== lastSlotIdxRef.current) {
      lastSlotIdxRef.current = closest
      haptic('light')
    }
    dragTargetIdxRef.current = closest
    setDragTargetIdx(closest)
  }, [])

  const handleTouchEnd = useCallback(() => {
    // Clear pending drag timer
    if (dragTimerRef.current) {
      clearTimeout(dragTimerRef.current)
      dragTimerRef.current = null
    }
    pendingDragRef.current = null

    const projectId = dragProjectIdRef.current
    const folderId = dropFolderIdRef.current
    const targetIdx = dragTargetIdxRef.current

    if (projectId && folderId) {
      // Move project into folder — optimistic + persist
      updateOrderMutation.mutate(
        { id: projectId, fields: { folder_id: folderId } },
        { onError: (err) => console.error('Failed to move project into folder:', err) },
      )
    } else if (projectId && targetIdx >= 0) {
      // Reorder unfiled projects
      const ordered = [...unfiledProjects.filter(p => p.id !== projectId)]
      const movedProject = allProjects.find(p => p.id === projectId)
      if (movedProject) {
        const insertAt = Math.min(targetIdx, ordered.length)
        ordered.splice(insertAt, 0, movedProject)
        ordered.forEach((p, i) => {
          if (p.displayOrder !== i) {
            updateOrderMutation.mutate({ id: p.id, fields: { display_order: i, folder_id: null } })
          }
        })
      }
    }

    // Reset
    dragProjectIdRef.current = null
    dragTargetIdxRef.current = -1
    dropFolderIdRef.current = null
    dragStartRef.current = null
    lastSlotIdxRef.current = -1
    setDragProjectId(null)
    setDragTargetIdx(-1)
    setDropFolderId(null)
  }, [allProjects, unfiledProjects, updateOrderMutation])

  // Global touch listeners for drag
  useEffect(() => {
    if (!editMode) return
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)
    return () => {
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [editMode, handleTouchMove, handleTouchEnd])

  const [selFabOpen, setSelFabOpen] = useState(false)
  const [activePanel, setActivePanel] = useState<PanelId | null>(null)
  const isLoading = loadingProjects

  return (
    <div style={{ minHeight: '100dvh', background: '#04040a', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <WiggleStyle />
      <SpaceBg />

      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 55% 80% at 50% 0%, rgba(100,112,243,0.06) 0%, transparent 65%), linear-gradient(90deg, rgba(0,0,0,0.4) 0%, transparent 28%, transparent 72%, rgba(0,0,0,0.4) 100%)',
      }} />

      <div style={{
        position: 'relative', zIndex: 1, maxWidth: 390, margin: '0 auto',
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', paddingTop: '4vh', paddingBottom: '24vh',
        filter: activePanel ? 'blur(1.5px)' : 'none',
        transition: 'filter 0.25s',
        pointerEvents: activePanel ? 'none' : 'auto',
      }}>
        {/* Header */}
        <div style={{ position: 'relative', padding: '0 20px 18px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' as const }}>
            <p className="font-mono uppercase" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.1em', marginBottom: 5 }}>Origin Point</p>
            <h1 className="font-sans" style={{ fontWeight: 800, fontSize: '1.5rem', color: '#dddde8', letterSpacing: '-0.03em', lineHeight: 1 }}>Back to One.</h1>
            <p className="font-mono uppercase" style={{ fontSize: '0.38rem', color: '#62627a', letterSpacing: '0.1em', marginTop: 6 }}>Select a project</p>
          </div>
          <button onClick={handleLogout} className="active:opacity-60 transition-opacity" style={{
            position: 'fixed', top: 56, right: 20, zIndex: 5, width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.35 }}>
              <path d="M6 2H4a2 2 0 00-2 2v8a2 2 0 002 2h2M10.5 11.5L14 8l-3.5-3.5M14 8H6" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Slates grid */}
        <div ref={gridRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, padding: '0 14px' }}>
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse" style={{ aspectRatio: '16/9', borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ padding: '20px 8px 8px', display: 'flex', flexDirection: 'column', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                  <SkeletonLine w={50} h={6} /><SkeletonLine w={80} h={12} /><SkeletonLine w={36} h={10} className="rounded" />
                </div>
              </div>
            ))
          ) : (
            <>
              {/* Edit mode bar */}
              {editMode && (
                <div style={{
                  gridColumn: 'span 2', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '8px 14px', background: 'rgba(196,90,220,0.08)', border: '1px solid rgba(196,90,220,0.18)',
                  borderRadius: 20, marginBottom: 2,
                }}>
                  <span className="font-mono" style={{ fontSize: 10, color: 'rgba(196,90,220,0.6)', letterSpacing: '0.06em' }}>Hold + drag to move</span>
                  <button className="font-mono" onClick={() => { setEditMode(false); setDragProjectId(null) }} style={{
                    fontSize: 10, color: '#c45adc', letterSpacing: '0.06em', padding: '3px 10px', borderRadius: 20,
                    background: 'rgba(196,90,220,0.12)', border: '1px solid rgba(196,90,220,0.25)', cursor: 'pointer',
                  }}>Done</button>
                </div>
              )}

              {/* Folders */}
              {allFolders.length > 0 && (
                <>
                  <div style={{ gridColumn: 'span 2', padding: '4px 2px 2px' }}>
                    <span className="font-mono uppercase" style={{ fontSize: 10, color: 'rgba(98,98,122,0.45)', letterSpacing: '0.1em', opacity: editMode ? 0.4 : 1 }}>Clients</span>
                  </div>
                  {allFolders.map(f => (
                    <FolderCard key={f.id} folder={f} projects={folderProjects(f.id)}
                      expanded={expandedFolders.has(f.id)} editMode={editMode}
                      isDropTarget={dropFolderId === f.id} onToggle={() => toggleFolder(f.id)}
                      getColor={getColor} />
                  ))}
                </>
              )}

              {/* Projects label */}
              <div style={{ gridColumn: 'span 2', padding: '4px 2px 2px', marginTop: allFolders.length > 0 ? 4 : 0 }}>
                <span className="font-mono uppercase" style={{ fontSize: 10, color: 'rgba(98,98,122,0.45)', letterSpacing: '0.1em', opacity: editMode ? 0.4 : 1 }}>Projects</span>
              </div>

              {/* Unfiled projects */}
              {unfiledProjects.map((p, i) => {
                const isDragging = dragProjectId === p.id
                const isGhost = isDragging
                return (
                  <div
                    key={p.id}
                    onTouchStart={e => handleTouchStart(e, p.id)}
                    style={{ position: 'relative' }}
                  >
                    <SlateCard
                      project={p} color={getColor(p.id)}
                      dimmed={(!!actionProject && actionProject.id !== p.id) || (!!dragProjectId && !isDragging)}
                      editMode={editMode} isGhost={isGhost} isDragging={false}
                      wiggleDelay={i * 0.08}
                      onLongPress={() => {
                        haptic('light')
                        if (editMode) return
                        setActionProject({ id: p.id, name: p.name, client: p.client, type: p.type, projectColor: getColor(p.id) })
                      }}
                      onClick={() => router.push(`/projects/${p.id}`)}
                    />
                  </div>
                )
              })}

              {/* Add buttons */}
              <div style={{ gridColumn: 'span 2', display: 'flex', gap: 8, padding: '4px 2px 2px' }}>
                {!editMode && (
                  <>
                    <Link href="/projects/new" className="block active:opacity-70 transition-opacity">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 20, border: '1px dashed rgba(196,90,220,0.2)', background: 'rgba(196,90,220,0.03)', cursor: 'pointer' }}>
                        <span style={{ color: 'rgba(196,90,220,0.4)', fontSize: 13 }}>+</span>
                        <span className="font-mono uppercase" style={{ fontSize: 10, color: 'rgba(196,90,220,0.4)', letterSpacing: '0.08em' }}>New Project</span>
                      </div>
                    </Link>
                    <div onClick={() => { haptic('light'); setCreatingFolder(true) }} style={{
                      display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 20,
                      border: '1px dashed rgba(196,90,220,0.2)', background: 'rgba(196,90,220,0.03)', cursor: 'pointer',
                    }} className="active:opacity-70 transition-opacity">
                      <span style={{ color: 'rgba(196,90,220,0.4)', fontSize: 13 }}>⊞</span>
                      <span className="font-mono uppercase" style={{ fontSize: 10, color: 'rgba(196,90,220,0.4)', letterSpacing: '0.08em' }}>New Folder</span>
                    </div>
                  </>
                )}
                <div onClick={() => { haptic('light'); setEditMode(prev => !prev); if (editMode) { setDragProjectId(null) } }} style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 20,
                  border: `1px dashed rgba(196,90,220,${editMode ? '0.4' : '0.2'})`,
                  background: `rgba(196,90,220,${editMode ? '0.1' : '0.03'})`, cursor: 'pointer',
                }} className="active:opacity-70 transition-opacity">
                  <span style={{ color: `rgba(196,90,220,${editMode ? '0.8' : '0.4'})`, fontSize: 13 }}>⇅</span>
                  <span className="font-mono uppercase" style={{ fontSize: 10, color: `rgba(196,90,220,${editMode ? '0.8' : '0.4'})`, letterSpacing: '0.08em' }}>{editMode ? 'Done' : 'Reorder'}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Floating dragged card — positioned via ref for zero-lag */}
      {dragProjectId && (() => {
        const project = allProjects.find(p => p.id === dragProjectId)
        if (!project) return null
        return (
          <div ref={dragElRef} style={{
            position: 'fixed',
            left: 0, top: 0,
            width: dragStartRef.current?.w ?? 172, zIndex: 50, pointerEvents: 'none',
          }}>
            <SlateCard project={project} color={getColor(project.id)} dimmed={false} editMode={false} isGhost={false} isDragging={true} onLongPress={() => {}} onClick={() => {}} />
          </div>
        )
      })()}

      {/* ══ SINGLE OVERLAY — dims grid, always below panel (z3) ══ */}
      <AnimatePresence>
        {(activePanel || selFabOpen) && (
          <motion.div key="dim-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
            onClick={() => { setSelFabOpen(false); setActivePanel(null) }}
            style={{
              position: 'fixed', inset: 0, zIndex: 3,
              background: selFabOpen ? 'rgba(4,4,10,0.75)' : 'rgba(4,4,10,0.65)',
              ...(selFabOpen ? { backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' } : {}),
            }}
          />
        )}
      </AnimatePresence>

      {/* FAB zone — zero-size anchor at FAB center point */}
      <div style={{ position: 'fixed', bottom: 34, left: '50%', width: 0, height: 0, zIndex: 7, overflow: 'visible' }}>

        {/* Dashed branch lines from center to each arc button */}
        <AnimatePresence>
          {selFabOpen && (
            <motion.svg
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ position: 'absolute', transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 9, overflow: 'visible' }}
              width="1" height="1"
            >
              {([
                { x: -99, y: -39, activeStroke: 'rgba(232,160,32,0.45)', panel: 'tasks' as PanelId },
                { x: -57, y: -67, activeStroke: 'rgba(100,112,243,0.45)', panel: 'milestones' as PanelId },
                { x: 0,   y: -78, activeStroke: 'rgba(0,184,148,0.45)', panel: 'schedule' as PanelId },
                { x: 57,  y: -67, activeStroke: 'rgba(74,184,232,0.45)', panel: 'threads' as PanelId },
                { x: 99,  y: -39, activeStroke: 'rgba(232,196,74,0.45)', panel: 'activity' as PanelId },
              ]).map((l) => (
                <line key={l.panel} x1="0" y1="0" x2={l.x} y2={l.y}
                  stroke={activePanel === l.panel ? l.activeStroke : activePanel ? 'rgba(196,90,220,0.1)' : 'rgba(196,90,220,0.22)'}
                  strokeWidth="1" strokeDasharray="3 3" />
              ))}
              <circle cx="0" cy="0" r="2.5" fill="rgba(196,90,220,0.4)" />
            </motion.svg>
          )}
        </AnimatePresence>

        {/* Arc buttons — 48px, icon only, per-button color */}
        {([
          { panel: 'tasks' as PanelId, tx: -99, ty: -39, delay: 0, color: '#e8a020', bg: 'rgba(232,160,32,', icon: <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M2 5h12M2 8h8M2 11h5" stroke="#e8a020" strokeWidth="1.3" strokeLinecap="round"/><path d="M12 9v4M10 11h4" stroke="#e8a020" strokeWidth="1.3" strokeLinecap="round"/></svg> },
          { panel: 'milestones' as PanelId, tx: -57, ty: -67, delay: 0.04, color: '#6470f3', bg: 'rgba(100,112,243,', icon: <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M8 2L10.5 6.5H13.5L11 9.5L12 13.5L8 11L4 13.5L5 9.5L2.5 6.5H5.5L8 2Z" stroke="#6470f3" strokeWidth="1.2" strokeLinejoin="round"/></svg> },
          { panel: 'schedule' as PanelId, tx: 0, ty: -78, delay: 0.08, color: '#00b894', bg: 'rgba(0,184,148,', icon: <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="#00b894" strokeWidth="1.2"/><path d="M5 2v2M11 2v2" stroke="#00b894" strokeWidth="1.2" strokeLinecap="round"/><path d="M2 7h12" stroke="#00b894" strokeWidth="1"/><rect x="5" y="9" width="2" height="2" rx="0.5" fill="#00b894" opacity="0.7"/><rect x="9" y="9" width="2" height="2" rx="0.5" fill="#00b894" opacity="0.7"/></svg> },
          { panel: 'threads' as PanelId, tx: 57, ty: -67, delay: 0.12, color: '#4ab8e8', bg: 'rgba(74,184,232,', icon: <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M2 2.5h10a1 1 0 011 1v5a1 1 0 01-1 1H5L2 12V3.5a1 1 0 010-1z" stroke="#4ab8e8" strokeWidth="1.1" strokeLinejoin="round"/><path d="M5 6.5h6a1 1 0 011 1V10l-2-1H6a1 1 0 01-1-1V6.5" stroke="#4ab8e8" strokeWidth="1" strokeLinejoin="round" opacity="0.6"/></svg> },
          { panel: 'activity' as PanelId, tx: 99, ty: -39, delay: 0.16, color: '#e8c44a', bg: 'rgba(232,196,74,', icon: <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M9 2L4 9h4l-1 5L14 7h-4l-1-5z" stroke="#e8c44a" strokeWidth="1.3" strokeLinejoin="round"/></svg> },
        ]).map((b) => {
          const isActive = activePanel === b.panel
          const isInactive = activePanel !== null && !isActive
          return (
          <motion.div key={b.panel}
            initial={false}
            animate={selFabOpen
              ? { opacity: isInactive ? 0.35 : 1, scale: 1, x: b.tx, y: b.ty }
              : { opacity: 0, scale: 0, x: 0, y: 0 }
            }
            transition={{ duration: 0.22, delay: selFabOpen ? b.delay : 0, ease: [0.34, 1.56, 0.64, 1] }}
            style={{
              position: 'absolute', top: -24, left: -24,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: selFabOpen ? 'auto' : 'none',
            }}
          >
            <button
              onClick={() => { haptic('light'); setActivePanel(prev => prev === b.panel ? null : b.panel) }}
              style={{
                width: 48, height: 48, borderRadius: '50%',
                background: isActive ? `${b.bg}0.18)` : `${b.bg}0.1)`,
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                border: isActive ? `1px solid ${b.bg}0.55)` : `1px solid ${b.bg}0.3)`,
                boxShadow: isActive ? `0 0 16px ${b.bg}0.3)` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              {b.icon}
            </button>
          </motion.div>
          )
        })}

        {/* Main FAB button — shrinks on open */}
        <motion.button
          onClick={() => { haptic('medium'); if (selFabOpen) { setActivePanel(null) }; setSelFabOpen(prev => !prev) }}
          animate={selFabOpen
            ? { rotate: 45, width: 44, height: 44, top: -22, left: -22, background: 'rgba(196,90,220,0.2)', boxShadow: '0 4px 24px rgba(196,90,220,0.45)' }
            : { rotate: 0, width: 52, height: 52, top: -26, left: -26, background: 'rgba(196,90,220,0.15)', boxShadow: '0 4px 20px rgba(196,90,220,0.25), inset 0 1px 0 rgba(255,255,255,0.1)' }
          }
          transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          style={{ position: 'absolute', top: -26, left: -26, width: 52, height: 52, borderRadius: '50%', background: 'rgba(196,90,220,0.15)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1.5px solid rgba(196,90,220,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 11 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2V14M2 8H14" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" /></svg>
        </motion.button>
      </div>

      {/* Global panels */}
      <GlobalPanels
        activePanel={activePanel}
        onClose={() => setActivePanel(null)}
        onNavigate={(panel) => setActivePanel(panel)}
      />

      {/* Action sheet */}
      <ProjectActionSheet
        project={actionProject}
        onArchive={() => { archiveMutation.mutate(actionProject!.id); setActionProject(null) }}
        onDelete={() => { deleteMutation.mutate(actionProject!.id); setActionProject(null) }}
        onRename={handleRename}
        onColorChange={handleColorChange}
        onClose={() => setActionProject(null)}
      />

      {/* New Folder sheet */}
      <Sheet open={creatingFolder} onClose={() => setCreatingFolder(false)}>
        <NewFolderSheet onClose={() => setCreatingFolder(false)}
          onCreate={(data) => createFolderMutation.mutate(data)} />
      </Sheet>
    </div>
  )
}
