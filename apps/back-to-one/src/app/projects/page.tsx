'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useProjects, useArchiveProject, useDeleteProject, useUpdateProject,
  useMeId, useMyTeam, useUserProjectFolders, useUserProjectPlacements,
  useCreateUserProjectFolder, useUpdateUserProjectFolder, useDeleteUserProjectFolder,
  useUpsertUserProjectPlacement, useArchivedProjects, useRestoreProject,
  useArchivedUserProjectFolders, useArchiveUserProjectFolder, useRestoreUserProjectFolder,
  useMoveProjectToRoot,
  useUpdateTeamName,
} from '@/lib/hooks/useOriginOne'
import { SkeletonLine } from '@/components/ui'
import { useRootFab } from '@/components/ui/ActionBarRoot'
import { getProjectColor } from '@/lib/utils/phase'
import { haptic } from '@/lib/utils/haptics'
import { SlateCard, WiggleStyle } from '@/components/projects/SlateCard'
import { ArchiveIcon, ARCHIVE_FOLDER_ID, MOVE_OUT_TARGET_ID } from '@/components/projects/ArchiveIcon'
import { ProjectActionSheet } from '@/components/projects/ProjectActionSheet'
import { FolderCard } from '@/components/projects/FolderCard'
import { OpenFolderSheet } from '@/components/projects/OpenFolderSheet'
import { FolderActionSheet } from '@/components/projects/FolderActionSheet'
import { NewFolderSheet } from '@/components/projects/NewFolderSheet'
import { TeamNameSheet } from '@/components/projects/TeamNameSheet'
import { GlobalPanels, type PanelId } from '@/components/projects/GlobalPanels'
import { ThreadsSheet } from '@/components/projects/ThreadsSheet'
import { ChatSheet } from '@/components/projects/ChatSheet'
import { ResourcesSheet } from '@/components/projects/ResourcesSheet'
import { createBrowserAuthClient } from '@origin-one/auth'
import type { Project } from '@/types'

// ── HELPERS ──────────────────────────────────────────────────

// ── POINTER EVENT NORMALIZATION ──────────────────────────────────────────
// Both touch and mouse are pointer-like; the drag handlers care only about
// (clientX, clientY). Helpers below normalize either event shape.

type AnyPointerEvent =
  | React.TouchEvent | React.MouseEvent | TouchEvent | MouseEvent

function pointerCoords(e: AnyPointerEvent): { x: number; y: number } {
  if ('touches' in e) {
    if (e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY }
    // touchend has no `touches` entries; fall through to changedTouches
    if ('changedTouches' in e && e.changedTouches.length > 0) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
    }
  }
  // MouseEvent
  return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY }
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
  // Folder id at drag start; null = drag started on the home grid.
  // Drives the drop-target routing in handleTouchEnd.
  const dragSourceFolderIdRef = useRef<string | null>(null)

  const sortedProjects = [...allProjects]

  function getColor(projectId: string) {
    if (colorOverrides[projectId]) return colorOverrides[projectId]
    const p = allProjects.find(proj => proj.id === projectId)
    return p?.color || getProjectColor(projectId)
  }

  async function handleLogout() {
    haptic('medium')
    const supabase = createBrowserAuthClient()
    await supabase.auth.signOut()
    router.push('/login')
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

  const handleTouchStart = useCallback((e: React.TouchEvent | React.MouseEvent, id: string, kind: 'project' | 'folder' = 'project') => {
    if (!editMode) return
    const { x, y } = pointerCoords(e)
    const el = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const elX = x - el.left
    const elY = y - el.top
    pendingDragRef.current = { projectId: id, x, y, elX, elY, w: el.width }
    dragKindRef.current = kind
    // No hold timer in wiggle mode — drag activates on the first movement
    // > MOVE_THRESHOLD (handled in handleTouchMove). A pure tap (no move)
    // falls through to the inner card's onClick → opens the action sheet.

    // If a folder is open, the drag started inside that folder. Capture
    // the source folder id so handleTouchEnd can route correctly. If no
    // folder is open, source is the home grid (null). Archive variant
    // doesn't allow drag-out (no in-sheet folder context to track).
    const currentFolderId = openFolderIdRef.current
    dragSourceFolderIdRef.current = currentFolderId && currentFolderId !== ARCHIVE_FOLDER_ID
      ? currentFolderId
      : null
  }, [editMode])

  const handleTouchMove = useCallback((e: TouchEvent | MouseEvent) => {
    const { x: touchX, y: touchY } = pointerCoords(e)

    // Promote pending → active drag once movement crosses MOVE_THRESHOLD.
    // Below the threshold, the touch is treated as a tap (so onClick on
    // the inner card still fires for action-sheet opens).
    const MOVE_THRESHOLD = 5
    if (pendingDragRef.current && !dragProjectIdRef.current) {
      const pd = pendingDragRef.current
      const dx = touchX - pd.x
      const dy = touchY - pd.y
      if (Math.hypot(dx, dy) > MOVE_THRESHOLD) {
        activateDrag(pd.projectId, pd.x, pd.y, pd.elX, pd.elY, pd.w)
        pendingDragRef.current = null
        // fall through to the active-drag handling below
      } else {
        return
      }
    }

    if (!dragProjectIdRef.current || !dragStartRef.current) return
    // preventDefault is iOS-rubber-band suppression — only meaningful on touch.
    if ('touches' in e) e.preventDefault()

    // Direct DOM transform — zero lag
    if (dragElRef.current) {
      dragElRef.current.style.left = `${touchX - dragStartRef.current.elX}px`
      dragElRef.current.style.top = `${touchY - dragStartRef.current.elY}px`
    }

    // Dragged card center
    const cardCx = touchX - dragStartRef.current.elX + dragStartRef.current.w / 2
    const cardCy = touchY - dragStartRef.current.elY + 54 // approx half card height

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
      : '[data-project-id], [data-folder-id], [data-archive-target], [data-move-out-target]'
    const allTargets = document.querySelectorAll<HTMLElement>(cardSelector)
    let snapClosestId: string | null = null
    let snapClosestDist = Infinity
    allTargets.forEach(el => {
      const id = el.dataset.projectId ?? el.dataset.folderId ?? el.dataset.archiveTarget ?? el.dataset.moveOutTarget
      if (!id || id === dragProjectIdRef.current) return
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const dist = Math.hypot(cardCx - cx, cardCy - cy)
      // Archive icon and Move-out pill are smaller than a card — give them a more generous radius.
      const isArchive = id === ARCHIVE_FOLDER_ID
      const isMoveOut = id === MOVE_OUT_TARGET_ID
      // Archive / Move-out are smaller pill targets — keep 60.
      // Folder + project tiles are larger; 30 was tight on a touch device
      // and very tight with a mouse. 55 makes them forgiving without
      // overlapping siblings (tile width is ~170px, gap is 8px).
      const radius = isArchive || isMoveOut ? 60 : 55
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
  const myTeam = useMyTeam()
  const { data: folders } = useUserProjectFolders()
  const { data: placements } = useUserProjectPlacements()
  const allFolders = folders ?? []
  const allPlacements = placements ?? []

  const createFolderMutation = useCreateUserProjectFolder()
  const updateFolderMutation = useUpdateUserProjectFolder()
  const deleteFolderMutation = useDeleteUserProjectFolder()
  const placementMutation = useUpsertUserProjectPlacement()
  const moveProjectToRootMutation = useMoveProjectToRoot()

  const [actionFolder, setActionFolder] = useState<{ id: string; name: string; color: string | null } | null>(null)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [renamingTeam, setRenamingTeam] = useState(false)
  const updateTeamNameMutation = useUpdateTeamName()
  const [restoreProject, setRestoreProject] = useState<Project | null>(null)
  const [restoreFolder, setRestoreFolder] = useState<{ id: string; name: string; color: string | null; count: number } | null>(null)
  const [openFolderOrigin, setOpenFolderOrigin] = useState<{ x: number; y: number } | null>(null)

  const { data: archivedProjects } = useArchivedProjects()
  const allArchivedProjects = archivedProjects ?? []
  const restoreMutation = useRestoreProject()

  const { data: archivedFolders } = useArchivedUserProjectFolders()
  const allArchivedFolders = archivedFolders ?? []
  // Used by both homeItems (to keep restored projects visible) and the
  // looseArchivedProjects calculation below.
  const archivedFolderIds = useMemo(
    () => new Set(allArchivedFolders.map(f => f.id)),
    [allArchivedFolders]
  )
  const archiveFolderMutation = useArchiveUserProjectFolder()
  const restoreFolderMutation = useRestoreUserProjectFolder()

  // Synthetic Archive folder — not a real DB row. Sentinel id never collides
  // with a UUID. Pinned at the very end of the home grid (sortOrder = MAX).
  const archiveFolder = { id: ARCHIVE_FOLDER_ID, name: 'Archive', color: '#62627a' }

  const {
    fanOpen: selFabOpen, closeFan,
    threadsOpen, closeThreads,
    chatOpen, closeChat,
    resourcesOpen, closeResources,
    openFolderId, setOpenFolderId, closeOpenFolder,
  } = useRootFab()
  // Mirror openFolderId into a ref so handleTouchStart can read it without
  // needing to be re-created every time a folder opens/closes.
  const openFolderIdRef = useRef<string | null>(openFolderId)
  useEffect(() => { openFolderIdRef.current = openFolderId }, [openFolderId])
  const [activePanel, setActivePanel] = useState<PanelId | null>(null)

  // Capture the source tile's center so OpenFolderSheet can zoom from it.
  // Looks up the rect by data-folder-id / data-archive-target, both already
  // present on the home grid and on archived-folder tiles inside the sheet.
  const openFolder = useCallback((id: string) => {
    // If the sheet is already open, this is a swap (e.g. tap Archive
    // while another folder is open). Don't recompute the origin —
    // we want the close-back-into-source-tile gesture to still target
    // the original tile. Just swap the openFolderId.
    if (openFolderId) {
      setOpenFolderId(id)
      return
    }
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
  }, [openFolderId, setOpenFolderId])

  // ── Merged home-grid items ────────────────────────────────────
  type HomeItem =
    | { kind: 'folder'; id: string; sortOrder: number; folder: typeof allFolders[number] }
    | { kind: 'project'; id: string; sortOrder: number; project: Project }

  const homeItems = useMemo<HomeItem[]>(() => {
    const placementById = new Map(allPlacements.map(p => [p.projectId, p]))
    // A placement counts as "in a folder" only if the folder is still active.
    // If the folder is archived (or no longer exists), the project would be
    // orphaned in a hidden container — treat it as top-level instead so a
    // restored project becomes visible again immediately.
    const inFolder = new Set(
      allPlacements
        .filter(p => p.folderId !== null && !archivedFolderIds.has(p.folderId!))
        .map(p => p.projectId)
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
  }, [allProjects, allFolders, allPlacements, archivedFolderIds])

  // Loose archived projects = archived projects whose placement isn't inside
  // an archived folder. The synthetic Archive folder shows these directly;
  // archived projects inside an archived folder live one level deeper.
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
    if (dragTimerRef.current) {
      clearTimeout(dragTimerRef.current)
      dragTimerRef.current = null
    }
    pendingDragRef.current = null

    const draggedId = dragProjectIdRef.current
    const targetId = dragTargetIdRef.current
    const targetIdx = dragTargetIdxRef.current
    const kind = dragKindRef.current
    const sourceFolderId = dragSourceFolderIdRef.current

    if (draggedId && meId) {
      const targetIsArchive = targetId === ARCHIVE_FOLDER_ID
      const targetIsMoveOut = targetId === MOVE_OUT_TARGET_ID
      const targetIsFolder = targetId && allFolders.some(f => f.id === targetId)
      const targetIsProject = targetId && allProjects.some(p => p.id === targetId)

      if (sourceFolderId) {
        // ── Drag started INSIDE an open folder ──
        if (targetIsArchive) {
          haptic('medium')
          archiveMutation.mutate(draggedId)
        } else if (targetIsMoveOut) {
          haptic('medium')
          moveProjectToRootMutation.mutate(draggedId)
        } else if (kind === 'project' && targetId && targetIsProject) {
          // Folder-internal reorder — only valid if target is also in the same folder.
          const folderProjs = folderProjects.get(sourceFolderId) ?? []
          const tgtPos = folderProjs.findIndex(p => p.id === targetId)
          const srcPos = folderProjs.findIndex(p => p.id === draggedId)
          if (tgtPos !== -1 && srcPos !== -1) {
            haptic('light')
            // Determine drop side: if dragged was before target, insert AFTER
            // target; if dragged was after target, insert BEFORE target. This
            // matches the "swap with neighbor in drag direction" intuition.
            const insertAfter = srcPos < tgtPos
            // Look up the placement rows on either side of the insertion point
            // to compute a midpoint sortOrder.
            const placementFor = (idx: number) =>
              idx >= 0 && idx < folderProjs.length
                ? allPlacements.find(p => p.projectId === folderProjs[idx].id && p.folderId === sourceFolderId)
                : undefined
            const tgtPlacement = placementFor(tgtPos)
            const tgtSO = tgtPlacement?.sortOrder ?? 0
            let newSO: number
            if (insertAfter) {
              const nextPlacement = placementFor(tgtPos + 1)
              const nextSO = nextPlacement?.sortOrder ?? tgtSO + 1024
              newSO = Math.floor((tgtSO + nextSO) / 2)
            } else {
              const prevPlacement = placementFor(tgtPos - 1)
              const prevSO = prevPlacement?.sortOrder ?? Math.max(0, tgtSO - 1024)
              newSO = Math.floor((prevSO + tgtSO) / 2)
            }
            // Guard against newSO collapsing to tgtSO (can happen if neighbor
            // sortOrders are adjacent integers — rare but possible). Bump by 1
            // when needed; the next reorder will re-spread.
            if (newSO === tgtSO) newSO = insertAfter ? tgtSO + 1 : Math.max(0, tgtSO - 1)
            placementMutation.mutate({
              userId: meId,
              projectId: draggedId,
              folderId: sourceFolderId,
              sortOrder: newSO,
            })
          }
        }
        // No top-level reorder, no folder-creation, no folder→folder. Drops
        // on anything else inside the sheet are no-ops (snap back).
      } else {
        // ── Drag started on the home grid — existing behavior ──
        if (targetIsArchive) {
          haptic('medium')
          if (kind === 'project') {
            archiveMutation.mutate(draggedId)
          } else {
            archiveFolderMutation.mutate(draggedId)
          }
        } else if (kind === 'project' && targetId && targetIsFolder) {
          haptic('light')
          const folderProjList = folderProjects.get(targetId) ?? []
          placementMutation.mutate({
            userId: meId,
            projectId: draggedId,
            folderId: targetId,
            sortOrder: folderProjList.length,
          })
        } else if (kind === 'project' && targetId && targetIsProject) {
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
    }

    // Reset
    dragProjectIdRef.current = null
    dragTargetIdRef.current = null
    dragTargetIdxRef.current = -1
    dragStartRef.current = null
    lastSlotIdxRef.current = -1
    dragSourceFolderIdRef.current = null
    setDragProjectId(null)
    setDragTargetIdx(-1)
    setDragTargetIdState(null)
  }, [meId, allProjects, allFolders, allPlacements, folderProjects, homeItems, placementMutation, createFolderMutation, archiveMutation, archiveFolderMutation, updateFolderMutation, moveProjectToRootMutation])

  // Global touch + mouse listeners for drag
  useEffect(() => {
    if (!editMode) return
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)
    window.addEventListener('mousemove', handleTouchMove)
    window.addEventListener('mouseup', handleTouchEnd)
    return () => {
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('mousemove', handleTouchMove)
      window.removeEventListener('mouseup', handleTouchEnd)
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
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4vh)', paddingBottom: '24vh',
        filter: (activePanel || threadsOpen || chatOpen || resourcesOpen || openFolderId) ? 'blur(1.5px)' : 'none',
        transition: 'filter 0.25s',
        pointerEvents: (activePanel || threadsOpen || chatOpen || resourcesOpen || openFolderId) ? 'none' : 'auto',
      }}>
        {/* Header */}
        <div style={{ position: 'relative', padding: '0 20px 18px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' as const }}>
            <p className="font-mono uppercase" style={{ fontSize: '0.4rem', color: '#62627a', letterSpacing: '0.12em', marginBottom: 3 }}>Back to One</p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <h1 className="font-sans" style={{ fontWeight: 800, fontSize: '1.6rem', color: '#dddde8', letterSpacing: '-0.03em', lineHeight: 1 }}>
                {myTeam?.name ?? 'Projects'}
              </h1>
              {editMode && myTeam && (
                <button
                  onClick={() => { haptic('light'); setRenamingTeam(true) }}
                  className="active:opacity-60 transition-opacity"
                  style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'rgba(196,90,220,0.12)',
                    border: '1px solid rgba(196,90,220,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  aria-label="Rename team"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M11.5 1.5l3 3-9 9-3.5.5.5-3.5 9-9z" stroke="#c45adc" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </div>
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
                      onMouseDown={isArchive ? undefined : (e => handleTouchStart(e, it.id, 'folder'))}
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
                    onMouseDown={e => handleTouchStart(e, p.id)}
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

              <ArchiveIcon
                count={allArchivedProjects.length}
                isDropTarget={dragTargetId === ARCHIVE_FOLDER_ID}
                onClick={() => { haptic('light'); openFolder(ARCHIVE_FOLDER_ID) }}
              />
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
            : () => { haptic('medium'); if (!editMode) setEditMode(true) }
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
        editMode={editMode}
        draggingProjectId={dragProjectId && dragKindRef.current === 'project' ? dragProjectId : null}
        dragTargetId={dragTargetId}
        archivedCount={allArchivedProjects.length}
        onProjectTouchStart={(e, id) => handleTouchStart(e, id, 'project')}
        onArchiveTap={() => { haptic('light'); openFolder(ARCHIVE_FOLDER_ID) }}
        onExitEditMode={() => { setEditMode(false); setDragProjectId(null) }}
        getColor={getColor}
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
      <TeamNameSheet
        open={renamingTeam}
        currentName={myTeam?.name ?? ''}
        onClose={() => setRenamingTeam(false)}
        onSave={async (name) => {
          if (!myTeam) return
          await updateTeamNameMutation.mutateAsync({ teamId: myTeam.id, name })
        }}
      />
    </div>
  )
}
