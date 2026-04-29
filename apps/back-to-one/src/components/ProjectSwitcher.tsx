'use client'

// Project switcher — a tappable project name with a slide-down panel listing
// the user's projects grouped by their personal folders. Replaces the old
// swipe-between-projects gesture on the Hub. Lives in the topbar of every
// project surface so navigation across projects is one tap from anywhere.
//
// Two visual variants:
//   - 'hub'  — used by HubContent topbar (large bold title; chevron sits beside).
//   - 'meta' — used inside PageHeader meta of every subpage (small mono caps).
//
// Destination path preserves the active subpage: navigating from
// /projects/A/timeline lands on /projects/B/timeline.

import { useMemo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useProjects, useUserProjectFolders, useUserProjectPlacements } from '@/lib/hooks/useOriginOne'
import { haptic } from '@/lib/utils/haptics'
import { DEFAULT_PROJECT_HEX } from '@origin-one/ui'

type SwitcherFolder = { id: string; name: string; color: string | null; sortOrder: number }
type SwitcherPlacement = { projectId: string; folderId: string | null; sortOrder: number }
type SwitcherProject = { id: string; name: string; client: string | null; color?: string | null; createdAt: string }

export function ProjectSwitcher({
  projectId, projectName, accentColor, variant,
}: {
  projectId: string
  projectName: string
  accentColor: string
  variant: 'hub' | 'meta'
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const { data: projects } = useProjects()
  const { data: folders } = useUserProjectFolders()
  const { data: placements } = useUserProjectPlacements()

  // Compute destination path: replace the projectId segment, preserve the
  // first sub-segment (e.g. /timeline) but drop deeper segments that may not
  // resolve on the new project (e.g. /scenemaker/scene/<oldSceneId>).
  function destinationFor(newId: string): string {
    if (!pathname) return `/projects/${newId}`
    const segs = pathname.split('/').filter(Boolean)
    // Expecting: ['projects', '<oldId>', '<sub?>', ...]
    if (segs[0] !== 'projects' || segs[1] !== projectId) return `/projects/${newId}`
    const sub = segs[2]
    return sub ? `/projects/${newId}/${sub}` : `/projects/${newId}`
  }

  function pick(newId: string) {
    setOpen(false)
    if (newId === projectId) return
    router.push(destinationFor(newId))
  }

  return (
    <>
      {variant === 'hub' ? (
        <button
          type="button"
          onClick={() => { haptic('light'); setOpen(o => !o) }}
          className="flex items-center gap-1.5 leading-none"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', position: 'relative' }}
          aria-expanded={open}
          aria-label="Switch project"
        >
          <span className="text-text text-center" style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
            {projectName}
          </span>
          <Chevron open={open} />
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); haptic('light'); setOpen(o => !o) }}
          className="flex items-center gap-1"
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            color: accentColor, fontSize: '0.50rem', letterSpacing: '0.06em',
          }}
          aria-expanded={open}
          aria-label="Switch project"
        >
          <span>{projectName}</span>
          <Chevron open={open} small />
        </button>
      )}

      <ProjectSwitcherPanel
        open={open}
        onClose={() => setOpen(false)}
        projects={(projects ?? []) as SwitcherProject[]}
        folders={(folders ?? []) as SwitcherFolder[]}
        placements={(placements ?? []) as SwitcherPlacement[]}
        currentProjectId={projectId}
        onPick={pick}
      />
    </>
  )
}

function Chevron({ open, small }: { open: boolean; small?: boolean }) {
  const size = small ? 8 : 12
  return (
    <motion.svg
      width={size} height={size} viewBox="0 0 12 12" fill="none"
      animate={{ rotate: open ? 180 : 0 }}
      transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
      style={{ marginTop: small ? 0 : 4, opacity: 0.6, flexShrink: 0 }}
    >
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </motion.svg>
  )
}

function ProjectSwitcherPanel({
  open, onClose, projects, folders, placements, currentProjectId, onPick,
}: {
  open: boolean
  onClose: () => void
  projects: SwitcherProject[]
  folders: SwitcherFolder[]
  placements: SwitcherPlacement[]
  currentProjectId: string
  onPick: (projectId: string) => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  // Portal to body so the fixed-positioned panel escapes any ancestor
  // containing block (the Hub topbar has backdrop-filter, which would
  // otherwise contain + clip the panel via the topbar's overflow:hidden).
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const { folderProjects, topLevel } = useMemo(() => {
    const placementByPid = new Map(placements.map(p => [p.projectId, p]))
    const fp: Record<string, SwitcherProject[]> = {}
    for (const f of folders) fp[f.id] = []
    const top: SwitcherProject[] = []
    for (const proj of projects) {
      const pl = placementByPid.get(proj.id)
      if (pl?.folderId && fp[pl.folderId]) {
        fp[pl.folderId].push(proj)
      } else {
        top.push(proj)
      }
    }
    for (const fid of Object.keys(fp)) {
      fp[fid].sort((a, b) => {
        const sa = placementByPid.get(a.id)?.sortOrder ?? 0
        const sb = placementByPid.get(b.id)?.sortOrder ?? 0
        return sa - sb
      })
    }
    top.sort((a, b) => {
      const pa = placementByPid.get(a.id), pb = placementByPid.get(b.id)
      const sa = pa && pa.folderId === null ? pa.sortOrder : new Date(a.createdAt).getTime()
      const sb = pb && pb.folderId === null ? pb.sortOrder : new Date(b.createdAt).getTime()
      return sa - sb
    })
    return { folderProjects: fp, topLevel: top }
  }, [projects, folders, placements])

  const sortedFolders = useMemo(
    () => [...folders].sort((a, b) => a.sortOrder - b.sortOrder),
    [folders]
  )

  function toggleFolder(id: string) {
    haptic('light')
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function renderProjectRow(p: SwitcherProject, indent: boolean) {
    const isCurrent = p.id === currentProjectId
    const dotColor = (p.color as string | undefined) ?? DEFAULT_PROJECT_HEX
    return (
      <button
        key={p.id}
        type="button"
        onClick={() => { haptic('light'); onPick(p.id) }}
        className="flex items-center w-full text-left"
        style={{
          gap: 10,
          padding: indent ? '9px 14px 9px 30px' : '9px 14px',
          background: isCurrent ? 'rgba(255,255,255,0.04)' : 'transparent',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
        }}
      >
        <span
          className="rounded-full flex-shrink-0"
          style={{ width: 6, height: 6, background: dotColor, opacity: isCurrent ? 1 : 0.7 }}
        />
        <span className="flex-1 truncate" style={{ fontSize: '0.78rem', fontWeight: isCurrent ? 600 : 500, color: isCurrent ? '#dddde8' : '#a8a8b8' }}>
          {p.name}
        </span>
        {p.client && (
          <span className="font-mono uppercase truncate" style={{ fontSize: '0.42rem', letterSpacing: '0.08em', color: '#62627a', maxWidth: 110 }}>
            {p.client}
          </span>
        )}
      </button>
    )
  }

  const panel = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="switcher-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(4,4,10,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
              zIndex: 60,
            }}
          />
          <motion.div
            key="switcher-panel"
            initial={{ y: -12, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -8, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            style={{
              position: 'fixed',
              top: 'calc(var(--safe-top) + 108px)',
              left: 0,
              right: 0,
              marginLeft: 'auto',
              marginRight: 'auto',
              width: 'min(360px, calc(100vw - 24px))',
              maxHeight: 'calc(100vh - var(--safe-top) - 140px)',
              overflowY: 'auto',
              background: 'rgba(10,10,18,0.96)',
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              boxShadow: '0 18px 48px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.3)',
              zIndex: 61,
              padding: '8px 6px 12px',
              transformOrigin: 'top center',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {sortedFolders.map(f => {
              const kids = folderProjects[f.id] ?? []
              const isOpen = expanded.has(f.id) || kids.some(k => k.id === currentProjectId)
              return (
                <div key={f.id}>
                  <button
                    type="button"
                    onClick={() => toggleFolder(f.id)}
                    className="flex items-center w-full text-left"
                    style={{ gap: 8, padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8 }}
                  >
                    <motion.svg
                      width="10" height="10" viewBox="0 0 12 12" fill="none"
                      animate={{ rotate: isOpen ? 90 : 0 }}
                      transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
                      style={{ flexShrink: 0, opacity: 0.6 }}
                    >
                      <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </motion.svg>
                    <span
                      className="rounded-sm flex-shrink-0"
                      style={{ width: 10, height: 8, background: f.color ?? '#6470f3', opacity: 0.85 }}
                    />
                    <span className="flex-1 truncate" style={{ fontSize: '0.74rem', fontWeight: 600, color: '#c8c8d6' }}>
                      {f.name}
                    </span>
                    <span className="font-mono" style={{ fontSize: '0.46rem', color: '#62627a' }}>{kids.length}</span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && kids.length > 0 && (
                      <motion.div
                        key="kids"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
                        style={{ overflow: 'hidden' }}
                      >
                        {kids.map(k => renderProjectRow(k, true))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}

            {sortedFolders.length > 0 && topLevel.length > 0 && (
              <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '6px 14px' }} />
            )}
            {topLevel.map(p => renderProjectRow(p, false))}

            {projects.length === 0 && (
              <div className="font-mono uppercase" style={{ fontSize: '0.5rem', color: '#62627a', padding: '14px', letterSpacing: '0.08em', textAlign: 'center' }}>
                No projects
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )

  if (!mounted) return null
  return createPortal(panel, document.body)
}
