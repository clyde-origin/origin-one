'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useProjects, useCrew, useArchiveProject, useDeleteProject, useUpdateProject,
  useMeId, useUserProjectFolders, useUserProjectPlacements,
  useCreateUserProjectFolder, useUpdateUserProjectFolder, useDeleteUserProjectFolder,
  useUpsertUserProjectPlacement, useArchivedProjects, useRestoreProject,
  useArchivedUserProjectFolders, useArchiveUserProjectFolder, useRestoreUserProjectFolder,
} from '@/lib/hooks/useOriginOne'
import { SkeletonLine, CrewAvatar } from '@/components/ui'
import { useRootFab } from '@/components/ui/ActionBarRoot'
import { getProjectColor, statusHex, STATUS_LABELS_SHORT } from '@/lib/utils/phase'
import { haptic } from '@/lib/utils/haptics'
import { useLongPress } from '@/lib/hooks/useLongPress'
import { ProjectActionSheet } from '@/components/projects/ProjectActionSheet'
import { FolderCard } from '@/components/projects/FolderCard'
import { OpenFolderSheet } from '@/components/projects/OpenFolderSheet'
import { FolderActionSheet } from '@/components/projects/FolderActionSheet'
import { NewFolderSheet } from '@/components/projects/NewFolderSheet'
import { GlobalPanels, type PanelId } from '@/components/projects/GlobalPanels'
import { ThreadsSheet } from '@/components/projects/ThreadsSheet'
import { ChatSheet } from '@/components/projects/ChatSheet'
import { ResourcesSheet } from '@/components/projects/ResourcesSheet'
import { clearStoredViewer } from '@/lib/utils/viewerIdentity'
import type { Project } from '@/types'

// ── HELPERS ──────────────────────────────────────────────────

function hexToRgba(hex: string | null | undefined, a: number) {
  const h = hex || '#444444'
  const r = parseInt(h.slice(1, 3), 16)
  const g = parseInt(h.slice(3, 5), 16)
  const b = parseInt(h.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function slateBodyBg(color: string | null | undefined): string {
  const c = color || '#444444'
  const r = parseInt(c.slice(1, 3), 16)
  const g = parseInt(c.slice(3, 5), 16)
  const b = parseInt(c.slice(5, 7), 16)
  const dr = Math.round(r * 0.07)
  const dg = Math.round(g * 0.07)
  const db = Math.round(b * 0.07)
  const c1 = `rgb(${dr + 4},${dg + 4},${db + 4})`
  const c2 = `rgb(${Math.round(dr * 0.7) + 2},${Math.round(dg * 0.7) + 2},${Math.round(db * 0.7) + 2})`
  return `linear-gradient(135deg,${c1},${c2})`
}

// ── COLORED LINES (replaces clapper SVG) ─────────────────────

function SlateLines({ color }: { color: string }) {
  const opacities = [0.28, 0, 0.15, 0, 0.07, 0]
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
  const phaseColor = statusHex(project.status)
  const { data: crew } = useCrew(project.id)
  const allCrew = crew ?? []
  const longPressHandlers = useLongPress(onLongPress, 500)

  if (isGhost) {
    return (
      <div style={{ borderRadius: 14, border: '1px dashed rgba(255,255,255,0.1)', opacity: 0.18, overflow: 'hidden' }}>
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
      onClick={onClick}
      {...longPressHandlers}
      data-project-id={project.id}
      style={{
        borderRadius: 14, overflow: 'hidden', position: 'relative', cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
        border: `1px solid rgba(255,255,255,${editMode ? '0.1' : '0.06'})`,
        background: 'rgba(10,10,18,0.6)',
        transition: isDragging ? 'none' : 'transform 0.12s ease, opacity 0.25s, filter 0.25s',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
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
        minHeight: 90,
      }}>
        {/* Top: type left, phase pill right */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <div className="font-mono uppercase" style={{ fontSize: '0.42rem', letterSpacing: '0.08em', color: hexToRgba(color, 0.55) }}>{project.type}</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 20, background: hexToRgba(phaseColor, 0.12), border: `1px solid ${hexToRgba(phaseColor, 0.2)}`, flexShrink: 0 }}>
              <div style={{ width: 3, height: 3, borderRadius: '50%', background: phaseColor, boxShadow: `0 0 3px ${phaseColor}` }} />
              <span className="font-mono uppercase" style={{ fontSize: '0.34rem', letterSpacing: '0.04em', color: phaseColor }}>{STATUS_LABELS_SHORT[project.status] ?? project.status}</span>
            </div>
          </div>
          <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#dddde8', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{project.name}</div>
          {project.client && <div className="font-mono" style={{ fontSize: '0.38rem', color: '#62627a', letterSpacing: '0.06em', marginTop: 3 }}>{project.client}</div>}
        </div>
        {/* Bottom: crew avatars spread across */}
        <div style={{ position: 'relative', zIndex: 1, marginTop: 7 }}>
          {!editMode && allCrew.length > 0 && (
            <div style={{ display: 'flex' }}>
              {allCrew.slice(0, 5).map((c, i) => (
                <div key={c.id} style={{ marginLeft: i === 0 ? 0 : -3, position: 'relative', zIndex: 5 - i }}>
                  <CrewAvatar name={c.User?.name ?? 'Unknown'} size={20} avatarUrl={c.User?.avatarUrl} />
                </div>
              ))}
              {allCrew.length > 5 && (
                <div style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.32rem', fontWeight: 600, border: '1px solid rgba(0,0,0,0.5)', marginLeft: -3, fontFamily: 'var(--font-geist-mono)', background: hexToRgba(color, 0.12), color: '#62627a' }}>+{allCrew.length - 5}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
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
  const allProjects = projects ?? []
  const archiveMutation = useArchiveProject()
  const deleteMutation = useDeleteProject()
  const updateMutation = useUpdateProject()

  const [actionProject, setActionProject] = useState<{
    id: string; name: string; client: string; type: string; aspectRatio: string; projectColor: string
  } | null>(null)
  const [colorOverrides, setColorOverrides] = useState<Record<string, string>>({})

  // ── Edit mode (drag) state ──
  const [editMode, setEditMode] = useState(false)
  const [dragProjectId, setDragProjectId] = useState<string | null>(null)
  const [dragTargetIdx, setDragTargetIdx] = useState<number>(-1)

  // Refs to avoid stale closures in touch handlers
  const dragProjectIdRef = useRef<string | null>(null)
  const dragTargetIdxRef = useRef<number>(-1)
  const dragTargetIdRef = useRef<string | null>(null)
  const [dragTargetId, setDragTargetIdState] = useState<string | null>(null)
  // Track whether the current drag is a project or a folder. Folders can be
  // reordered or dropped onto the Archive icon; they cannot drop onto other
  // cards (no nesting, no folder-creation-from-folder).
  const dragKindRef = useRef<'project' | 'folder'>('project')
  const dragStartRef = useRef<{ x: number; y: number; elX: number; elY: number; w: number } | null>(null)
  const dragElRef = useRef<HTMLDivElement>(null)
  const lastSlotIdxRef = useRef<number>(-1)
  const dragTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingDragRef = useRef<{ projectId: string; x: number; y: number; elX: number; elY: number; w: number } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const sortedProjects = [...allProjects]

  function getColor(projectId: string) {
    if (colorOverrides[projectId]) return colorOverrides[projectId]
    const p = allProjects.find(proj => proj.id === projectId)
    return p?.color || getProjectColor(projectId)
  }

  function handleLogout() {
    haptic('medium')
    clearStoredViewer()
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
    updateMutation.mutate({ id: actionProject.id, fields: { color } })
  }

  function handleTypeChange(type: string) {
    if (!actionProject) return
    setActionProject(prev => prev ? { ...prev, type } : null)
    updateMutation.mutate({ id: actionProject.id, fields: { type } })
  }

  function handleAspectChange(aspectRatio: string) {
    if (!actionProject) return
    setActionProject(prev => prev ? { ...prev, aspectRatio } : null)
    updateMutation.mutate({ id: actionProject.id, fields: { aspectRatio } })
  }

  // ── Touch drag handlers (ref-based, direct DOM transform) ──
  const activateDrag = useCallback((projectId: string, x: number, y: number, elX: number, elY: number, w: number) => {
    dragStartRef.current = { x, y, elX, elY, w }
    dragProjectIdRef.current = projectId
    lastSlotIdxRef.current = -1
    setDragProjectId(projectId)
    haptic('medium')
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent, id: string, kind: 'project' | 'folder' = 'project') => {
    if (!editMode) return
    const touch = e.touches[0]
    const el = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const elX = touch.clientX - el.left
    const elY = touch.clientY - el.top
    pendingDragRef.current = { projectId: id, x: touch.clientX, y: touch.clientY, elX, elY, w: el.width }
    dragKindRef.current = kind
    // No hold timer in wiggle mode — drag activates on the first movement
    // > MOVE_THRESHOLD (handled in handleTouchMove). A pure tap (no move)
    // falls through to the inner card's onClick → opens the action sheet.
  }, [editMode])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const touch = e.touches[0]

    // Promote pending → active drag once movement crosses MOVE_THRESHOLD.
    // Below the threshold, the touch is treated as a tap (so onClick on
    // the inner card still fires for action-sheet opens).
    const MOVE_THRESHOLD = 5
    if (pendingDragRef.current && !dragProjectIdRef.current) {
      const pd = pendingDragRef.current
      const dx = touch.clientX - pd.x
      const dy = touch.clientY - pd.y
      if (Math.hypot(dx, dy) > MOVE_THRESHOLD) {
        activateDrag(pd.projectId, pd.x, pd.y, pd.elX, pd.elY, pd.w)
        pendingDragRef.current = null
        // fall through to the active-drag handling below
      } else {
        return
      }
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

    // Snapshot slot rects live on every move (grid shifts as items displace).
    // Include both project and folder cards so reorder works for either kind.
    const slotEls = document.querySelectorAll<HTMLElement>('[data-project-id], [data-folder-id]')
    let closest = -1
    let closestDist = Infinity
    const slots: { id: string; cx: number; cy: number }[] = []
    slotEls.forEach(el => {
      const id = el.dataset.projectId ?? el.dataset.folderId
      if (!id || id === dragProjectIdRef.current) return // skip self
      const rect = el.getBoundingClientRect()
      slots.push({ id, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 })
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

    // Drop-target detection (folder create / add to folder / archive).
    // - Project drag: project + folder cards + Archive icon are valid targets.
    // - Folder drag:  Archive icon only (no folder nesting, no project→folder
    //                 from a folder). Reorder still works on empty slots.
    const draggingFolder = dragKindRef.current === 'folder'
    const cardSelector = draggingFolder
      ? '[data-archive-target]'
      : '[data-project-id], [data-folder-id], [data-archive-target]'
    const allTargets = document.querySelectorAll<HTMLElement>(cardSelector)
    let snapClosestId: string | null = null
    let snapClosestDist = Infinity
    allTargets.forEach(el => {
      const id = el.dataset.projectId ?? el.dataset.folderId ?? el.dataset.archiveTarget
      if (!id || id === dragProjectIdRef.current) return
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const dist = Math.hypot(cardCx - cx, cardCy - cy)
      // Archive icon is smaller than a card — give it a more generous radius.
      const isArchive = id === ARCHIVE_FOLDER_ID
      const radius = isArchive ? 60 : 30
      if (dist < snapClosestDist && dist <= radius) { snapClosestDist = dist; snapClosestId = id }
    })
    const newTarget: string | null = snapClosestId
    if (newTarget !== dragTargetIdRef.current) {
      dragTargetIdRef.current = newTarget
      setDragTargetIdState(newTarget)
      if (newTarget) haptic('light')
    }
  }, [])

  // Fan-open state lifted to RootFabContext (provided by projects/layout.tsx).
  // ActionBarRoot's + button toggles it; this page reads it to drive arc render.
  // The same context owns threadsOpen, chatOpen, and resourcesOpen — toggled
  // by the corresponding bar buttons. All three sheets share visual style
  // and z-stacking, with mutual exclusion against fan/panel below.
  const meId = useMeId()
  const { data: folders } = useUserProjectFolders()
  const { data: placements } = useUserProjectPlacements()
  const allFolders = folders ?? []
  const allPlacements = placements ?? []

  const createFolderMutation = useCreateUserProjectFolder()
  const updateFolderMutation = useUpdateUserProjectFolder()
  const deleteFolderMutation = useDeleteUserProjectFolder()
  const placementMutation = useUpsertUserProjectPlacement()

  const [actionFolder, setActionFolder] = useState<{ id: string; name: string; color: string | null } | null>(null)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [restoreProject, setRestoreProject] = useState<Project | null>(null)
  const [restoreFolder, setRestoreFolder] = useState<{ id: string; name: string; color: string | null; count: number } | null>(null)
  const [openFolderOrigin, setOpenFolderOrigin] = useState<{ x: number; y: number } | null>(null)

  const { data: archivedProjects } = useArchivedProjects()
  const allArchivedProjects = archivedProjects ?? []
  const restoreMutation = useRestoreProject()

  const { data: archivedFolders } = useArchivedUserProjectFolders()
  const allArchivedFolders = archivedFolders ?? []
  const archiveFolderMutation = useArchiveUserProjectFolder()
  const restoreFolderMutation = useRestoreUserProjectFolder()

  // Synthetic Archive folder — not a real DB row. Sentinel id never collides
  // with a UUID. Pinned at the very end of the home grid (sortOrder = MAX).
  const ARCHIVE_FOLDER_ID = '__archive__'
  const archiveFolder = { id: ARCHIVE_FOLDER_ID, name: 'Archive', color: '#62627a' }

  const {
    fanOpen: selFabOpen, closeFan,
    threadsOpen, closeThreads,
    chatOpen, closeChat,
    resourcesOpen, closeResources,
    openFolderId, setOpenFolderId, closeOpenFolder,
  } = useRootFab()
  const [activePanel, setActivePanel] = useState<PanelId | null>(null)

  // Capture the source tile's center so OpenFolderSheet can zoom from it.
  // Looks up the rect by data-folder-id / data-archive-target, both already
  // present on the home grid and on archived-folder tiles inside the sheet.
  const openFolder = useCallback((id: string) => {
    const selector = id === '__archive__'
      ? '[data-archive-target]'
      : `[data-folder-id="${id}"]`
    const el = document.querySelector(selector) as HTMLElement | null
    if (el) {
      const r = el.getBoundingClientRect()
      setOpenFolderOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
    } else {
      setOpenFolderOrigin(null)
    }
    setOpenFolderId(id)
  }, [setOpenFolderId])

  // ── Merged home-grid items ────────────────────────────────────
  type HomeItem =
    | { kind: 'folder'; id: string; sortOrder: number; folder: typeof allFolders[number] }
    | { kind: 'project'; id: string; sortOrder: number; project: Project }

  const homeItems = useMemo<HomeItem[]>(() => {
    const placementById = new Map(allPlacements.map(p => [p.projectId, p]))
    const inFolder = new Set(
      allPlacements.filter(p => p.folderId !== null).map(p => p.projectId)
    )

    const folderItems: HomeItem[] = allFolders.map(f => ({
      kind: 'folder', id: f.id, sortOrder: f.sortOrder, folder: f,
    }))

    // Fallback sortOrder for unplaced projects: needs to fit in Postgres
    // INTEGER (Int4, max ~2.1B). Newer createdAt should produce a smaller
    // value so newer projects appear first.
    const fallbackSO = (createdAt: string | Date) =>
      2_000_000_000 - Math.floor(new Date(createdAt).getTime() / 1000)

    const projectItems: HomeItem[] = allProjects
      .filter(p => !inFolder.has(p.id))
      .map(p => {
        const pl = placementById.get(p.id)
        const so = pl && pl.folderId === null ? pl.sortOrder : fallbackSO(p.createdAt)
        return { kind: 'project', id: p.id, sortOrder: so, project: p }
      })

    return [...folderItems, ...projectItems].sort((a, b) => a.sortOrder - b.sortOrder)
  }, [allProjects, allFolders, allPlacements])

  // Loose archived projects = archived projects whose placement isn't inside
  // an archived folder. The synthetic Archive folder shows these directly;
  // archived projects inside an archived folder live one level deeper.
  const archivedFolderIds = useMemo(
    () => new Set(allArchivedFolders.map(f => f.id)),
    [allArchivedFolders]
  )
  const looseArchivedProjects = useMemo(() => {
    const placementByProjectId = new Map(allPlacements.map(p => [p.projectId, p]))
    return allArchivedProjects.filter(p => {
      const pl = placementByProjectId.get(p.id)
      return !pl?.folderId || !archivedFolderIds.has(pl.folderId)
    })
  }, [allArchivedProjects, allPlacements, archivedFolderIds])

  const folderProjects = useMemo(() => {
    // Map folderId → projects (in placement.sortOrder).
    // Active folders pull from allProjects; archived folders pull from
    // allArchivedProjects (their projects were archived together).
    const result = new Map<string, Project[]>()
    for (const f of allFolders) result.set(f.id, [])
    for (const f of allArchivedFolders) result.set(f.id, [])
    const byActiveProjectId = new Map(allProjects.map(p => [p.id, p]))
    const byArchivedProjectId = new Map(allArchivedProjects.map(p => [p.id, p]))
    const sorted = [...allPlacements]
      .filter(p => p.folderId !== null)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    for (const pl of sorted) {
      const list = result.get(pl.folderId!)
      if (!list) continue
      const isArchivedFolder = archivedFolderIds.has(pl.folderId!)
      const project = isArchivedFolder
        ? byArchivedProjectId.get(pl.projectId)
        : byActiveProjectId.get(pl.projectId)
      if (project) list.push(project)
    }
    // Synthetic Archive folder content — the loose archived projects only;
    // archived folders themselves are passed via OpenFolderSheet.folders.
    result.set(ARCHIVE_FOLDER_ID, looseArchivedProjects)
    return result
  }, [allProjects, allArchivedProjects, allFolders, allArchivedFolders, allPlacements, archivedFolderIds, looseArchivedProjects])

  const handleTouchEnd = useCallback(() => {
    // Clear pending drag timer
    if (dragTimerRef.current) {
      clearTimeout(dragTimerRef.current)
      dragTimerRef.current = null
    }
    pendingDragRef.current = null

    const draggedId = dragProjectIdRef.current
    const targetId = dragTargetIdRef.current
    const targetIdx = dragTargetIdxRef.current
    const kind = dragKindRef.current

    if (draggedId && meId) {
      const targetIsArchive = targetId === ARCHIVE_FOLDER_ID
      const targetIsFolder = targetId && allFolders.some(f => f.id === targetId)
      const targetIsProject = targetId && allProjects.some(p => p.id === targetId)

      if (targetIsArchive) {
        // Drop onto Archive icon → archive everything in scope.
        haptic('medium')
        if (kind === 'project') {
          archiveMutation.mutate(draggedId)
        } else {
          // Mark the folder archived; the mutation cascades to all projects
          // inside so the folder reappears intact in the archive view.
          archiveFolderMutation.mutate(draggedId)
        }
      } else if (kind === 'project' && targetId && targetIsFolder) {
        // Drop project into existing folder
        haptic('light')
        const folderProjList = folderProjects.get(targetId) ?? []
        placementMutation.mutate({
          userId: meId,
          projectId: draggedId,
          folderId: targetId,
          sortOrder: folderProjList.length,
        })
      } else if (kind === 'project' && targetId && targetIsProject) {
        // Drop project onto a project → create new folder containing both
        haptic('medium')
        const draggedItem = homeItems.find(i => i.kind === 'project' && i.id === draggedId)
        createFolderMutation.mutate(
          { userId: meId, name: 'Untitled', color: null, sortOrder: draggedItem?.sortOrder ?? 0 },
          {
            onSuccess: (folder) => {
              placementMutation.mutate({ userId: meId, projectId: draggedId, folderId: folder.id, sortOrder: 0 })
              placementMutation.mutate({ userId: meId, projectId: targetId,  folderId: folder.id, sortOrder: 1 })
            },
          }
        )
      } else if (targetIdx >= 0) {
        // Top-level reorder — works for both project and folder drags.
        const reordered = homeItems.filter(i => i.id !== draggedId)
        const beforeSO = targetIdx > 0 ? reordered[targetIdx - 1]?.sortOrder ?? 0 : 0
        const afterSO  = reordered[targetIdx]?.sortOrder ?? beforeSO + 1024
        const newSO = Math.floor((beforeSO + afterSO) / 2)
        if (kind === 'project') {
          placementMutation.mutate({ userId: meId, projectId: draggedId, folderId: null, sortOrder: newSO })
        } else {
          updateFolderMutation.mutate({ id: draggedId, fields: { sortOrder: newSO } })
        }
      }
    }

    // Reset
    dragProjectIdRef.current = null
    dragTargetIdRef.current = null
    dragTargetIdxRef.current = -1
    dragStartRef.current = null
    lastSlotIdxRef.current = -1
    setDragProjectId(null)
    setDragTargetIdx(-1)
    setDragTargetIdState(null)
  }, [meId, allProjects, allFolders, folderProjects, homeItems, placementMutation, createFolderMutation, archiveMutation, archiveFolderMutation, deleteFolderMutation, updateFolderMutation])

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

  // Body-scroll lock during edit mode so iOS doesn't try to rubber-band the
  // page while the user is dragging a card. Same position-fixed-with-saved-
  // scrollY trick used by the bar's overlay surfaces.
  useEffect(() => {
    if (!editMode) return
    const scrollY = window.scrollY
    const body = document.body
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    }
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    body.style.overflow = 'hidden'
    return () => {
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.left = prev.left
      body.style.right = prev.right
      body.style.width = prev.width
      body.style.overflow = prev.overflow
      window.scrollTo(0, scrollY)
    }
  }, [editMode])

  // Mirror the original "tap + closes both fan and panel" behavior: any
  // transition of fan open→closed (from the bar +, the dim overlay, or
  // navigation that calls closeFan) clears any active panel.
  useEffect(() => {
    if (!selFabOpen) setActivePanel(null)
  }, [selFabOpen])

  // Mutual exclusion: opening either side sheet closes any active fan-arc
  // panel so the glass surfaces never overlap. The fan itself is closed by
  // ActionBarRoot's handlers before each toggle, so only the panel-clear
  // needs to be mirrored here.
  useEffect(() => {
    if (threadsOpen || chatOpen || resourcesOpen) setActivePanel(null)
  }, [threadsOpen, chatOpen, resourcesOpen])
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
        filter: (activePanel || threadsOpen || chatOpen || resourcesOpen || openFolderId) ? 'blur(1.5px)' : 'none',
        transition: 'filter 0.25s',
        pointerEvents: (activePanel || threadsOpen || chatOpen || resourcesOpen || openFolderId) ? 'none' : 'auto',
      }}>
        {/* Header */}
        <div style={{ position: 'relative', padding: '0 20px 18px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' as const }}>
            <p className="font-mono uppercase" style={{ fontSize: '0.4rem', color: '#62627a', letterSpacing: '0.12em', marginBottom: 3 }}>Back to One</p>
            <h1 className="font-sans" style={{ fontWeight: 800, fontSize: '1.6rem', color: '#dddde8', letterSpacing: '-0.03em', lineHeight: 1 }}>Origin Point</h1>
            <p className="font-sans" style={{ fontSize: '0.88rem', fontWeight: 500, color: '#62627a', marginTop: 10 }}>Select a Project</p>
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
        <div
          ref={gridRef}
          onClick={(e) => {
            if (editMode && e.target === e.currentTarget) {
              haptic('light')
              setEditMode(false)
            }
          }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, padding: '0 14px' }}
        >
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse" style={{ aspectRatio: '16/9', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.04)' }}>
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

              {/* Unified home grid — folders + top-level projects sorted by sortOrder */}
              {homeItems.map((it, i) => {
                if (it.kind === 'folder') {
                  const isArchive = it.id === ARCHIVE_FOLDER_ID
                  const isFolderDragging = dragKindRef.current === 'folder' && dragProjectId === it.id
                  const showInsertLine = !!dragProjectId && dragProjectId !== it.id && dragTargetIdx === i
                  return (
                    <motion.div
                      key={`folder-${it.id}`}
                      layout
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      onTouchStart={isArchive ? undefined : (e => handleTouchStart(e, it.id, 'folder'))}
                      style={{
                        position: 'relative',
                        touchAction: editMode ? 'none' : 'auto',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        WebkitTouchCallout: 'none',
                      }}
                    >
                      {showInsertLine && (
                        <div style={{
                          position: 'absolute', left: -5, top: 0, bottom: 0, width: 3,
                          background: '#c45adc', borderRadius: 2,
                          boxShadow: '0 0 12px rgba(196,90,220,0.7)',
                          zIndex: 6, pointerEvents: 'none',
                        }} />
                      )}
                      <FolderCard
                        folder={it.folder}
                        projects={folderProjects.get(it.id) ?? []}
                        editMode={editMode}
                        isGhost={isFolderDragging}
                        isDragging={false}
                        // Archive folder is never a drop target — projects must be archived
                        // via the project action sheet, not by dragging.
                        isDropTarget={!isArchive && dragTargetId === it.id}
                        dimmed={(!!actionProject && actionProject.id !== it.id) || (!!dragProjectId)}
                        wiggleDelay={i * 0.08}
                        onLongPress={() => {
                          haptic('medium')
                          if (!editMode) setEditMode(true)
                        }}
                        onClick={() => {
                          haptic('light')
                          // Archive folder skips the FolderActionSheet — it can't be
                          // renamed/recolored/deleted (it's synthetic).
                          if (editMode && !isArchive) {
                            setActionFolder({ id: it.folder.id, name: it.folder.name, color: it.folder.color })
                            return
                          }
                          openFolder(it.id)
                        }}
                      />
                    </motion.div>
                  )
                }
                // project slate render — same pattern as existing
                const p = it.project
                const isDragging = dragProjectId === p.id
                const showInsertLine = !!dragProjectId && dragProjectId !== p.id && dragTargetIdx === i
                return (
                  <motion.div
                    key={`project-${p.id}`}
                    layout
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    onTouchStart={e => handleTouchStart(e, p.id)}
                    style={{
                      position: 'relative',
                      touchAction: editMode ? 'none' : 'auto',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      WebkitTouchCallout: 'none',
                    }}
                  >
                    {showInsertLine && (
                      <div style={{
                        position: 'absolute', left: -5, top: 0, bottom: 0, width: 3,
                        background: '#c45adc', borderRadius: 2,
                        boxShadow: '0 0 12px rgba(196,90,220,0.7)',
                        zIndex: 6, pointerEvents: 'none',
                      }} />
                    )}
                    <SlateCard
                      project={p} color={getColor(p.id)}
                      dimmed={(!!actionProject && actionProject.id !== p.id) || (!!dragProjectId && !isDragging)}
                      editMode={editMode} isGhost={isDragging} isDragging={false}
                      wiggleDelay={i * 0.08}
                      onLongPress={() => {
                        haptic('medium')
                        if (!editMode) setEditMode(true)
                      }}
                      onClick={() => {
                        if (editMode) {
                          setActionProject({ id: p.id, name: p.name, client: p.client ?? '', type: p.type ?? '', aspectRatio: p.aspectRatio ?? '', projectColor: getColor(p.id) })
                          return
                        }
                        router.push(`/projects/${p.id}`)
                      }}
                    />
                    {dragTargetId === p.id && (
                      <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                        borderRadius: 14,
                        boxShadow: '0 0 0 2px rgba(196,90,220,0.7), 0 0 30px rgba(196,90,220,0.5), inset 0 0 18px rgba(196,90,220,0.2)',
                        transform: 'scale(1.04)',
                        transition: 'all 0.18s ease',
                        zIndex: 5,
                      }} />
                    )}
                  </motion.div>
                )
              })}

              {/* Add buttons — New Project + New Folder */}
              {!editMode && (
                <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'center', gap: 8, padding: '4px 2px 2px' }}>
                  <Link href="/projects/new" className="block active:opacity-70 transition-opacity">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 20, border: '1px dashed rgba(196,90,220,0.2)', background: 'rgba(196,90,220,0.03)', cursor: 'pointer' }}>
                      <span style={{ color: 'rgba(196,90,220,0.4)', fontSize: 13 }}>+</span>
                      <span className="font-mono uppercase" style={{ fontSize: 10, color: 'rgba(196,90,220,0.4)', letterSpacing: '0.08em' }}>New Project</span>
                    </div>
                  </Link>
                  <button
                    onClick={() => { haptic('light'); setCreatingFolder(true) }}
                    className="active:opacity-70 transition-opacity"
                    style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 20, border: '1px dashed rgba(100,112,243,0.25)', background: 'rgba(100,112,243,0.04)', cursor: 'pointer' }}
                  >
                    <span style={{ color: 'rgba(100,112,243,0.5)', fontSize: 13 }}>+</span>
                    <span className="font-mono uppercase" style={{ fontSize: 10, color: 'rgba(100,112,243,0.5)', letterSpacing: '0.08em' }}>New Folder</span>
                  </button>
                </div>
              )}

              {/* Archive icon — sits below the New Project / New Folder pills.
                  Tappable (opens the archive sheet) AND a drop target for
                  drag-to-archive (project or folder). The dashed glow
                  intensifies when something is being dragged onto it. */}
              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'center', padding: '6px 2px 2px' }}>
                <button
                  data-archive-target={ARCHIVE_FOLDER_ID}
                  onClick={() => { haptic('light'); openFolder(ARCHIVE_FOLDER_ID) }}
                  className="active:opacity-80 transition-all"
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    padding: '10px 14px',
                    borderRadius: 14,
                    border: dragTargetId === ARCHIVE_FOLDER_ID
                      ? '1.5px solid rgba(232,86,74,0.7)'
                      : '1px dashed rgba(98,98,122,0.3)',
                    background: dragTargetId === ARCHIVE_FOLDER_ID
                      ? 'rgba(232,86,74,0.12)'
                      : 'rgba(98,98,122,0.04)',
                    boxShadow: dragTargetId === ARCHIVE_FOLDER_ID
                      ? '0 0 30px rgba(232,86,74,0.45), inset 0 0 18px rgba(232,86,74,0.15)'
                      : 'none',
                    transform: dragTargetId === ARCHIVE_FOLDER_ID ? 'scale(1.06)' : 'scale(1)',
                    transition: 'all 0.18s ease',
                    cursor: 'pointer',
                    color: dragTargetId === ARCHIVE_FOLDER_ID ? '#e8564a' : '#62627a',
                  }}
                >
                  {/* Folder-tab icon (manila/file folder shape) */}
                  <svg width="22" height="18" viewBox="0 0 22 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M2 4.5C2 3.4 2.9 2.5 4 2.5H8.5L10.5 4.5H18C19.1 4.5 20 5.4 20 6.5V14.5C20 15.6 19.1 16.5 18 16.5H4C2.9 16.5 2 15.6 2 14.5V4.5Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                  <span className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: '0.1em' }}>
                    Archive{allArchivedProjects.length > 0 ? ` · ${allArchivedProjects.length}` : ''}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Floating dragged card — positioned via ref for zero-lag.
          Renders a SlateCard or FolderCard depending on the drag kind. */}
      {dragProjectId && (() => {
        const startX = dragStartRef.current ? dragStartRef.current.x - dragStartRef.current.elX : 0
        const startY = dragStartRef.current ? dragStartRef.current.y - dragStartRef.current.elY : 0
        const w = dragStartRef.current?.w ?? 172
        const wrapperStyle: React.CSSProperties = {
          position: 'fixed', left: startX, top: startY, width: w, zIndex: 50, pointerEvents: 'none',
        }
        if (dragKindRef.current === 'folder') {
          const folder = allFolders.find(f => f.id === dragProjectId)
          if (!folder) return null
          return (
            <div ref={dragElRef} style={wrapperStyle}>
              <FolderCard
                folder={folder}
                projects={folderProjects.get(folder.id) ?? []}
                editMode={false} isGhost={false} isDragging={true} isDropTarget={false} dimmed={false}
                onLongPress={() => {}} onClick={() => {}}
              />
            </div>
          )
        }
        const project = allProjects.find(p => p.id === dragProjectId)
        if (!project) return null
        return (
          <div ref={dragElRef} style={wrapperStyle}>
            <SlateCard project={project} color={getColor(project.id)} dimmed={false} editMode={false} isGhost={false} isDragging={true} onLongPress={() => {}} onClick={() => {}} />
          </div>
        )
      })()}

      {/* ══ SINGLE OVERLAY — dims grid, always below panel (z3) ══ */}
      <AnimatePresence>
        {(activePanel || selFabOpen || threadsOpen || chatOpen || resourcesOpen || openFolderId) && (
          <motion.div key="dim-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
            onClick={() => { closeFan(); setActivePanel(null); closeThreads(); closeChat(); closeResources(); closeOpenFolder() }}
            style={{
              position: 'fixed', inset: 0, zIndex: 3,
              background: selFabOpen ? 'rgba(4,4,10,0.75)' : 'rgba(4,4,10,0.65)',
              ...(selFabOpen ? { backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' } : {}),
            }}
          />
        )}
      </AnimatePresence>

      {/* FAB zone — zero-size anchor at FAB center point. Bottom anchor
          matches ActionBar's `calc(18px + safe-area-inset-bottom)` so the
          two surfaces read as a single visual language. */}
      <div style={{ position: 'fixed', bottom: 'calc(18px + env(safe-area-inset-bottom, 0px))', left: '50%', width: 0, height: 0, zIndex: 7, overflow: 'visible' }}>

        {/* Arc buttons — 48px, icon only, per-button color. Strong-glass +
            per-arc-color glow + drop shadow, matching ActionBar's satellite
            variant. Glow tracks each arc's panel color (no project context
            at root). */}
        {([
          // Arcs lifted +52 from prior values (-58 / -67 / -78) so labels
          // clear the bar's top edge with comfortable padding and the arcs
          // sit higher in the open space between bar and panel. Original
          // shape preserved (9 / 11 deltas between outer / mid / top).
          { panel: 'tasks' as PanelId, label: 'Tasks', tx: -99, ty: -110, delay: 0, color: '#e8a020', icon: <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M2 5h12M2 8h8M2 11h5" stroke="#e8a020" strokeWidth="1.3" strokeLinecap="round"/><path d="M12 9v4M10 11h4" stroke="#e8a020" strokeWidth="1.3" strokeLinecap="round"/></svg> },
          { panel: 'milestones' as PanelId, label: 'Milestones', tx: -57, ty: -119, delay: 0.04, color: '#6470f3', icon: <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M8 2L10.5 6.5H13.5L11 9.5L12 13.5L8 11L4 13.5L5 9.5L2.5 6.5H5.5L8 2Z" stroke="#6470f3" strokeWidth="1.2" strokeLinejoin="round"/></svg> },
          { panel: 'schedule' as PanelId, label: 'Schedule', tx: 0, ty: -130, delay: 0.08, color: '#00b894', icon: <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="#00b894" strokeWidth="1.2"/><path d="M5 2v2M11 2v2" stroke="#00b894" strokeWidth="1.2" strokeLinecap="round"/><path d="M2 7h12" stroke="#00b894" strokeWidth="1"/><rect x="5" y="9" width="2" height="2" rx="0.5" fill="#00b894" opacity="0.7"/><rect x="9" y="9" width="2" height="2" rx="0.5" fill="#00b894" opacity="0.7"/></svg> },
          // Crew (sky) replaces Threads at this slot — Threads is being promoted
          // to a route (/projects/threads) in step 2 of this PR; the sky color
          // and slot position carry over to Crew, which has no canonical color
          // in the design system and reads cleanly against amber/indigo/teal/gold.
          { panel: 'crew' as PanelId, label: 'Crew', tx: 57, ty: -119, delay: 0.12, color: '#4ab8e8', icon: <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><circle cx="6" cy="6" r="2" stroke="#4ab8e8" strokeWidth="1.3"/><circle cx="11" cy="6.5" r="1.6" stroke="#4ab8e8" strokeWidth="1.1"/><path d="M2 13c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="#4ab8e8" strokeWidth="1.3" strokeLinecap="round"/><path d="M10.5 13c.4-1.2 1.5-2.2 3-2.5" stroke="#4ab8e8" strokeWidth="1.1" strokeLinecap="round"/></svg> },
          { panel: 'activity' as PanelId, label: 'Activity', tx: 99, ty: -110, delay: 0.16, color: '#e8c44a', icon: <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M9 2L4 9h4l-1 5L14 7h-4l-1-5z" stroke="#e8c44a" strokeWidth="1.3" strokeLinejoin="round"/></svg> },
        ]).map((b) => {
          const isInactive = activePanel !== null && activePanel !== b.panel
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
                background: 'rgba(8,8,14,0.85)',
                backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                border: `0.5px solid ${b.color}45`,
                boxShadow: `0 4px 18px rgba(0,0,0,0.4), 0 0 14px ${b.color}38`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              {b.icon}
            </button>
            {/* Label — fades in 60ms after each arc starts, fades out
                immediately on close. Absolute-positioned beneath the
                button so it never reflows the arc. pointerEvents: none
                so taps still hit the button. */}
            <motion.div
              initial={false}
              animate={{ opacity: selFabOpen ? 1 : 0 }}
              transition={{ duration: 0.18, delay: selFabOpen ? b.delay + 0.06 : 0 }}
              style={{
                position: 'absolute',
                top: 54,
                left: 24,
                transform: 'translateX(-50%)',
                whiteSpace: 'nowrap',
                fontSize: 11, fontWeight: 500,
                color: 'rgba(255,255,255,0.85)',
                textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                pointerEvents: 'none',
              }}
            >
              {b.label}
            </motion.div>
          </motion.div>
          )
        })}

        {/* Main FAB lifted to ActionBarRoot (mounted by projects/layout.tsx).
            The arcs above remain anchored to the same FAB zone so they fan
            from the bar's + position when the user taps it. The legacy
            indigo/violet glass + button has been replaced by the bar's
            primary-variant + (strong glass + brand-indigo glow). */}
      </div>

      {/* Global panels */}
      <GlobalPanels
        activePanel={activePanel}
        onClose={() => setActivePanel(null)}
        onNavigate={(panel) => setActivePanel(panel)}
      />

      {/* Threads sheet — slide-up from bottom, toggled by ActionBarRoot */}
      <ThreadsSheet open={threadsOpen} />

      {/* Chat sheet — cross-project conversations, toggled by ActionBarRoot */}
      <ChatSheet open={chatOpen} onClose={closeChat} />

      {/* Resources sheet — cross-project (company-wide) resources, toggled
          by ActionBarRoot. Producer-only role gate lands with Auth. */}
      <ResourcesSheet open={resourcesOpen} />

      {/* Action sheet */}
      <ProjectActionSheet
        project={actionProject}
        onArchive={() => { archiveMutation.mutate(actionProject!.id); setActionProject(null) }}
        onDelete={() => { deleteMutation.mutate(actionProject!.id); setActionProject(null) }}
        onRename={handleRename}
        onColorChange={handleColorChange}
        onTypeChange={handleTypeChange}
        onAspectChange={handleAspectChange}
        onClose={() => setActionProject(null)}
      />

      <FolderActionSheet
        folder={actionFolder}
        onClose={() => setActionFolder(null)}
        onRename={(name) => actionFolder && updateFolderMutation.mutate({ id: actionFolder.id, fields: { name } })}
        onColorChange={(color) => actionFolder && updateFolderMutation.mutate({ id: actionFolder.id, fields: { color } })}
        onDelete={() => actionFolder && deleteFolderMutation.mutate(actionFolder.id, { onSuccess: () => setActionFolder(null) })}
      />

      <OpenFolderSheet
        open={!!openFolderId}
        originPoint={openFolderOrigin}
        folder={
          openFolderId === ARCHIVE_FOLDER_ID
            ? archiveFolder
            : (allFolders.find(f => f.id === openFolderId)
              ?? allArchivedFolders.find(f => f.id === openFolderId)
              ?? null)
        }
        projects={openFolderId ? (folderProjects.get(openFolderId) ?? []) : []}
        kicker={
          openFolderId === ARCHIVE_FOLDER_ID
            ? 'Archive'
            : (openFolderId && archivedFolderIds.has(openFolderId) ? 'Archived Folder' : 'Folder')
        }
        emptyMessage={
          openFolderId === ARCHIVE_FOLDER_ID
            ? 'Nothing archived yet'
            : (openFolderId && archivedFolderIds.has(openFolderId)
                ? 'No projects in this archived folder'
                : undefined)
        }
        onProjectLongPress={
          // Long-press → restore prompt for any archived project, whether
          // it's loose in the synthetic Archive or inside an archived folder.
          openFolderId === ARCHIVE_FOLDER_ID || (openFolderId && archivedFolderIds.has(openFolderId))
            ? (p) => { haptic('medium'); setRestoreProject(p) }
            : undefined
        }
        folders={
          openFolderId === ARCHIVE_FOLDER_ID
            ? allArchivedFolders.map(f => ({
                id: f.id, name: f.name, color: f.color,
                count: (folderProjects.get(f.id) ?? []).length,
              }))
            : undefined
        }
        onFolderClick={
          openFolderId === ARCHIVE_FOLDER_ID
            ? (f) => { haptic('light'); openFolder(f.id) }
            : undefined
        }
        onFolderLongPress={
          openFolderId === ARCHIVE_FOLDER_ID
            ? (f) => {
                haptic('medium')
                setRestoreFolder({
                  id: f.id, name: f.name, color: f.color,
                  count: (folderProjects.get(f.id) ?? []).length,
                })
              }
            : undefined
        }
        onClose={closeOpenFolder}
      />

      {/* Restore confirm — appears when tapping a project inside the Archive folder */}
      {restoreProject && (
        <div
          onClick={() => setRestoreProject(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 30,
            background: 'rgba(4,4,10,0.78)',
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'flex-end',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', padding: '20px 18px calc(28px + env(safe-area-inset-bottom, 0px))',
              background: 'rgba(10,10,18,0.95)',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '20px 20px 0 0',
              display: 'flex', flexDirection: 'column', gap: 14,
              boxShadow: '0 -32px 80px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16, color: '#dddde8', letterSpacing: '-0.01em' }}>
              Restore <span style={{ color: getColor(restoreProject.id) }}>{restoreProject.name}</span>?
            </div>
            <div style={{ fontSize: 12, color: '#8a8a9a', lineHeight: 1.5 }}>
              The project will return to the home grid with its status set to Post-Production. You can change the status from inside the project.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setRestoreProject(null)}
                style={{
                  flex: 1, padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  color: '#dddde8', fontSize: 13,
                }}
              >Cancel</button>
              <button
                onClick={() => {
                  haptic('medium')
                  const id = restoreProject.id
                  setRestoreProject(null)
                  closeOpenFolder()
                  restoreMutation.mutate(id)
                }}
                style={{
                  flex: 1, padding: '12px 14px', borderRadius: 10,
                  background: '#00b894', border: '1px solid rgba(0,184,148,0.6)',
                  color: 'white', fontSize: 13, fontWeight: 600,
                }}
              >Restore</button>
            </div>
          </div>
        </div>
      )}

      {/* Restore-folder confirm — long-press on an archived folder card */}
      {restoreFolder && (
        <div
          onClick={() => setRestoreFolder(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 30,
            background: 'rgba(4,4,10,0.78)',
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'flex-end',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', padding: '20px 18px calc(28px + env(safe-area-inset-bottom, 0px))',
              background: 'rgba(10,10,18,0.95)',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '20px 20px 0 0',
              display: 'flex', flexDirection: 'column', gap: 14,
              boxShadow: '0 -32px 80px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16, color: '#dddde8', letterSpacing: '-0.01em' }}>
              Restore <span style={{ color: restoreFolder.color ?? '#6470f3' }}>{restoreFolder.name}</span>?
            </div>
            <div style={{ fontSize: 12, color: '#8a8a9a', lineHeight: 1.5 }}>
              The folder returns to the home grid with its {restoreFolder.count} project{restoreFolder.count !== 1 ? 's' : ''} restored to Post-Production. You can re-archive items individually after.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setRestoreFolder(null)}
                style={{
                  flex: 1, padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  color: '#dddde8', fontSize: 13,
                }}
              >Cancel</button>
              <button
                onClick={() => {
                  haptic('medium')
                  const id = restoreFolder.id
                  setRestoreFolder(null)
                  restoreFolderMutation.mutate(id)
                }}
                style={{
                  flex: 1, padding: '12px 14px', borderRadius: 10,
                  background: '#00b894', border: '1px solid rgba(0,184,148,0.6)',
                  color: 'white', fontSize: 13, fontWeight: 600,
                }}
              >Restore</button>
            </div>
          </div>
        </div>
      )}

      <NewFolderSheet
        open={creatingFolder}
        onClose={() => setCreatingFolder(false)}
        onCreate={({ name, color }) => {
          if (!meId) return
          createFolderMutation.mutate({ userId: meId, name, color, sortOrder: 0 })
        }}
      />
    </div>
  )
}
