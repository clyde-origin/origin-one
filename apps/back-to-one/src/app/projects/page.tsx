'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useProjects, useCrew, useArchiveProject, useDeleteProject, useUpdateProject,
  useMeId, useUserProjectFolders, useUserProjectPlacements,
  useCreateUserProjectFolder, useUpdateUserProjectFolder, useDeleteUserProjectFolder,
  useUpsertUserProjectPlacement,
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
                  <CrewAvatar name={c.User?.name ?? 'Unknown'} size={20} />
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

    // Snapshot slot rects live on every move (grid shifts as items displace)
    const slotEls = document.querySelectorAll<HTMLElement>('[data-project-id]')
    let closest = -1
    let closestDist = Infinity
    const slots: { id: string; cx: number; cy: number }[] = []
    slotEls.forEach(el => {
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

    // Drop-target detection (folder create / add to folder).
    // Scans both project slates and folder cards; picks closest within snap radius.
    const allTargets = document.querySelectorAll<HTMLElement>('[data-project-id], [data-folder-id]')
    let snapClosestId: string | null = null
    let snapClosestDist = Infinity
    allTargets.forEach(el => {
      const id = el.dataset.projectId ?? el.dataset.folderId
      if (!id || id === dragProjectIdRef.current) return
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const dist = Math.hypot(cardCx - cx, cardCy - cy)
      if (dist < snapClosestDist) { snapClosestDist = dist; snapClosestId = id }
    })
    const SNAP_RADIUS = 30
    const newTarget = snapClosestDist <= SNAP_RADIUS ? snapClosestId : null
    if (newTarget !== dragTargetIdRef.current) {
      dragTargetIdRef.current = newTarget
      setDragTargetIdState(newTarget)
      if (newTarget) haptic('light')
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    // Clear pending drag timer
    if (dragTimerRef.current) {
      clearTimeout(dragTimerRef.current)
      dragTimerRef.current = null
    }
    pendingDragRef.current = null

    const projectId = dragProjectIdRef.current
    const targetIdx = dragTargetIdxRef.current

    if (projectId && targetIdx >= 0) {
      const ordered = [...sortedProjects.filter(p => p.id !== projectId)]
      const movedProject = allProjects.find(p => p.id === projectId)
      if (movedProject) {
        const insertAt = Math.min(targetIdx, ordered.length)
        ordered.splice(insertAt, 0, movedProject)
        // Display order no longer stored in DB — drag is visual-only for now
      }
    }

    // Reset
    dragProjectIdRef.current = null
    dragTargetIdxRef.current = -1
    dragTargetIdRef.current = null
    dragStartRef.current = null
    lastSlotIdxRef.current = -1
    setDragProjectId(null)
    setDragTargetIdx(-1)
    setDragTargetIdState(null)
  }, [allProjects, sortedProjects, updateMutation])

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

  const {
    fanOpen: selFabOpen, closeFan,
    threadsOpen, closeThreads,
    chatOpen, closeChat,
    resourcesOpen, closeResources,
    openFolderId, setOpenFolderId, closeOpenFolder,
  } = useRootFab()
  const [activePanel, setActivePanel] = useState<PanelId | null>(null)

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

    const projectItems: HomeItem[] = allProjects
      .filter(p => !inFolder.has(p.id))
      .map(p => {
        const pl = placementById.get(p.id)
        const so = pl && pl.folderId === null ? pl.sortOrder
                 : Number.MAX_SAFE_INTEGER - new Date(p.createdAt).getTime()
        return { kind: 'project', id: p.id, sortOrder: so, project: p }
      })

    return [...folderItems, ...projectItems].sort((a, b) => a.sortOrder - b.sortOrder)
  }, [allProjects, allFolders, allPlacements])

  const folderProjects = useMemo(() => {
    // Map folderId → projects (in placement.sortOrder)
    const result = new Map<string, Project[]>()
    for (const f of allFolders) result.set(f.id, [])
    const byProjectId = new Map(allProjects.map(p => [p.id, p]))
    const sorted = [...allPlacements]
      .filter(p => p.folderId !== null)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    for (const pl of sorted) {
      const project = byProjectId.get(pl.projectId)
      const list = result.get(pl.folderId!)
      if (project && list) list.push(project)
    }
    return result
  }, [allProjects, allFolders, allPlacements])

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
        filter: (activePanel || threadsOpen || chatOpen || resourcesOpen) ? 'blur(1.5px)' : 'none',
        transition: 'filter 0.25s',
        pointerEvents: (activePanel || threadsOpen || chatOpen || resourcesOpen) ? 'none' : 'auto',
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
                  return (
                    <div key={`folder-${it.id}`}>
                      <FolderCard
                        folder={it.folder}
                        projects={folderProjects.get(it.id) ?? []}
                        editMode={editMode}
                        isGhost={false}
                        isDragging={false}
                        isDropTarget={dragTargetId === it.id}
                        dimmed={(!!actionProject && actionProject.id !== it.id) || (!!dragProjectId)}
                        wiggleDelay={i * 0.08}
                        onLongPress={() => {
                          haptic('medium')
                          if (!editMode) setEditMode(true)
                        }}
                        onClick={() => {
                          haptic('light')
                          if (editMode) {
                            setActionFolder({ id: it.folder.id, name: it.folder.name, color: it.folder.color })
                            return
                          }
                          setOpenFolderId(it.id)
                        }}
                      />
                    </div>
                  )
                }
                // project slate render — same pattern as existing
                const p = it.project
                const isDragging = dragProjectId === p.id
                return (
                  <div
                    key={`project-${p.id}`}
                    onTouchStart={e => handleTouchStart(e, p.id)}
                    style={{ position: 'relative' }}
                  >
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
                  </div>
                )
              })}

              {/* Add button */}
              {!editMode && (
                <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'center', padding: '4px 2px 2px' }}>
                  <Link href="/projects/new" className="block active:opacity-70 transition-opacity">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 20, border: '1px dashed rgba(196,90,220,0.2)', background: 'rgba(196,90,220,0.03)', cursor: 'pointer' }}>
                      <span style={{ color: 'rgba(196,90,220,0.4)', fontSize: 13 }}>+</span>
                      <span className="font-mono uppercase" style={{ fontSize: 10, color: 'rgba(196,90,220,0.4)', letterSpacing: '0.08em' }}>New Project</span>
                    </div>
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Floating dragged card — positioned via ref for zero-lag */}
      {dragProjectId && (() => {
        const project = allProjects.find(p => p.id === dragProjectId)
        if (!project) return null
        const startX = dragStartRef.current ? dragStartRef.current.x - dragStartRef.current.elX : 0
        const startY = dragStartRef.current ? dragStartRef.current.y - dragStartRef.current.elY : 0
        return (
          <div ref={dragElRef} style={{
            position: 'fixed',
            left: startX, top: startY,
            width: dragStartRef.current?.w ?? 172, zIndex: 50, pointerEvents: 'none',
          }}>
            <SlateCard project={project} color={getColor(project.id)} dimmed={false} editMode={false} isGhost={false} isDragging={true} onLongPress={() => {}} onClick={() => {}} />
          </div>
        )
      })()}

      {/* ══ SINGLE OVERLAY — dims grid, always below panel (z3) ══ */}
      <AnimatePresence>
        {(activePanel || selFabOpen || threadsOpen || chatOpen || resourcesOpen) && (
          <motion.div key="dim-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
            onClick={() => { closeFan(); setActivePanel(null); closeThreads(); closeChat(); closeResources() }}
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
    </div>
  )
}
