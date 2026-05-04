'use client'

import { useState, useMemo, useRef, useEffect, Fragment, memo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useHubMode } from '@/lib/hooks/useHubMode'
import { HubModeToggle } from './HubModeToggle'
import { HubArcToggle, type ArcMode } from './HubArcToggle'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { getShotsByProject, listEntityAttachmentsBatch, type EntityAttachmentRow } from '@/lib/db/queries'
import { EntityAttachmentCoverPresentational } from '@/components/attachments/EntityAttachmentGallery'
import { EMPTY_ARRAY } from '@/lib/empty-collections'
import {
  useProject, useActionItems, useToggleActionItem, useCreateActionItem, useMilestones, useCreateMilestone, useCrew,
  useMoodboard, useThreadPreviews,
  useLocations, useArtItems, useCastRoles, useWorkflowNodes, useInventoryItems, useShootDays, useBudget,
} from '@/lib/hooks/useOriginOne'
import { ProjectSwitcher } from '@/components/ProjectSwitcher'
import { buildEvalContext, rollUpBudget } from '@/lib/budget/compute'
import type {
  Budget, BudgetVersion, BudgetAccount, BudgetLine, BudgetLineAmount,
  BudgetVariable, BudgetMarkup, Expense, ShootDay,
} from '@/types'
import { useViewerRole } from '@/lib/auth/useViewerRole'
import { deriveProjectColors, DEFAULT_PROJECT_HEX } from '@origin-one/ui'
import { ThreadsIcon } from '@/components/ui'
import { CrewAvatar } from '@/components/ui/client'
import { StorageImage } from '@/components/ui/StorageImage'
import { HubSkeleton } from '@/components/hub/HubSkeleton'
import { CrewPanel } from '@/components/hub/CrewPanel'
import { SwipePanel } from '@/components/hub/SwipePanel'
import { GanttChart } from '@/components/hub/GanttChart'
import { AIDetailSheet, MSDetailSheet, CrewDetailSheet } from '@/components/hub/sheets'
import { CreateTaskSheet, CreateMilestoneSheet, CreateCreativeSheet } from '@/components/create'
import { InviteCrewSheet } from '@/components/crew/InviteCrewSheet'
import { useFabAction } from '@/lib/contexts/FabActionContext'
import { haptic } from '@/lib/utils/haptics'
import { Sheet } from '@/components/ui/Sheet'
import {
  formatDate, isLate, getProjectColor,
  statusLabel,
} from '@/lib/utils/phase'
import type { ActionItem, Milestone, CrewMember, Project, WorkflowNode, Role } from '@/types'

// ── HELPERS ───────────────────────────────────────────────

// Adds keyboard activation to a div-as-button. Use only for tile-shape
// surfaces where a real <button> would break layout/grid; primitives
// should still use <button>.
function clickableProps(handler: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: handler,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handler()
      }
    },
  }
}

// Some scene.description values are plain text (older scenes); newer
// scenes carry a JSON-encoded array of script blocks from the rich
// editor: [{ type, id, content }, …]. The Hub script preview wants
// plain text only — extract block.content strings and join them.
function previewScriptText(desc: string | null | undefined): string {
  if (!desc) return ''
  const trimmed = desc.trim()
  if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return desc
  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) {
      return parsed
        .map((b: any) => typeof b?.content === 'string' ? b.content : '')
        .filter(Boolean)
        .join(' ')
    }
  } catch {
    // not JSON — fall through and return raw
  }
  return desc
}

function hexToRgb(hex: string | null | undefined): [number, number, number] {
  const h = hex || '#444444'
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}

const SCENE_GRAD: Record<number, string> = {
  1: 'linear-gradient(160deg,#0c0810,#1a0c20)',
  2: 'linear-gradient(160deg,#0a0c10,#161820)',
  3: 'linear-gradient(160deg,#060c08,#0c1610)',
}

const WF_ICONS: Record<string, string> = {
  storage: '💾', software: '🖥', system: '⚙', transfer: '↗', phase: '◆', deliverable: '📦',
}

// ── MODULE HEADER — item 7: second-tier section headers ───

function ModuleHeader({ name, meta }: { name: string; meta?: string }) {
  return (
    <div className="flex flex-col items-center mb-2.5">
      <div className="flex items-center gap-1.5">
        <span className="sheen-title" style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '-0.01em' }}>{name}</span>
      </div>
      {meta && (
        <span className="font-mono" style={{ fontSize: '0.50rem', color: '#62627a', letterSpacing: '0.06em', marginTop: 2 }}>
          {meta}
        </span>
      )}
    </div>
  )
}

// SwipePanel, GanttChart, and the three detail sheets used to live
// inline in this file. Extracted to ./SwipePanel.tsx, ./GanttChart.tsx,
// and ./sheets.tsx — see imports above. The icon constants and the
// MINI_ICONS map were dead code (referenced nowhere) and were dropped.


// ── SWIPEABLE SCENEMAKER — item 12 ───────────────────────
//
// Wrapped in React.memo — its props are now memoized in the parent
// (allShots / allScenes / allMoodRefs / shuffledMood), so re-renders only
// fire when an actual data input changes.

const SwipeableSceneMaker = memo(function SwipeableSceneMaker({
  projectId, projectColor, pr, pg, pb,
  allShots, allScenes, allMoodRefs, shuffledMood,
  router,
}: {
  projectId: string; projectColor: string; pr: number; pg: number; pb: number;
  allShots: any[]; allScenes: any[]; allMoodRefs: any[]; shuffledMood: any[];
  router: ReturnType<typeof useRouter>;
}) {
  const SIZE_SHORT: Record<string, string> = {
    extreme_wide: 'EWS', wide: 'WS', full: 'FS', medium: 'MS',
    medium_close_up: 'MCU', close_up: 'CU', extreme_close_up: 'ECU', insert: 'INS',
  }

  // Pages: 0=Script, 1=Shotlist, 2=Storyboard (default — most visual)
  const [page, setPage] = useState(2)
  const touchStart = useRef<number | null>(null)
  const touchDelta = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)

  function onTouchStart(e: React.TouchEvent) {
    touchStart.current = e.touches[0].clientX
    touchDelta.current = 0
    setDragging(true)
    setDragOffset(0)
  }

  function onTouchMove(e: React.TouchEvent) {
    if (touchStart.current === null) return
    touchDelta.current = e.touches[0].clientX - touchStart.current
    setDragOffset(touchDelta.current)
  }

  function onTouchEnd() {
    const delta = touchDelta.current
    setDragging(false)
    setDragOffset(0)
    touchStart.current = null
    if (Math.abs(delta) > 40) {
      if (delta < 0 && page < 2) setPage(p => p + 1)
      if (delta > 0 && page > 0) setPage(p => p - 1)
    }
  }

  const translateX = (page * -100) + (dragging ? (dragOffset / 2) : 0)
  const pageLabels = ['Script', 'Shotlist', 'Storyboard']

  return (
    <div
      style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={() => {
        const mode = page === 0 ? 'script' : page === 2 ? 'storyboard' : 'shotlist'
        router.push(`/projects/${projectId}/scenemaker?mode=${mode}`)
      }}
    >
      {/* Page indicator — top */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, padding: '7px 9px 2px', alignItems: 'center' }}>
        {pageLabels.map((label, i) => (
          <span key={label} className="font-mono uppercase" style={{
            fontSize: '0.44rem',
            letterSpacing: '0.06em',
            color: page === i ? projectColor : '#62627a',
            fontWeight: page === i ? 700 : 400,
            opacity: page === i ? 1 : 0.5,
            transition: 'all 0.2s ease',
          }}>{label}</span>
        ))}
      </div>

      <div style={{
        display: 'flex', width: '300%', flex: 1,
        transform: `translateX(calc(${translateX / 3}%))`,
        transition: dragging ? 'none' : 'transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)',
        willChange: 'transform',
      }}>
        {/* Page 0: Script */}
        <div style={{ width: '33.333%', flex: '0 0 33.333%', padding: '8px 9px', display: 'flex', flexDirection: 'column' }}>
          {allScenes.length > 0 ? (
            <div className="flex flex-col flex-1 justify-center" style={{ gap: 5 }}>
              {allScenes.slice(0, 2).map(sc => (
                <div key={sc.id} style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="font-mono uppercase" style={{ fontSize: '0.32rem', color: projectColor, marginBottom: 2, letterSpacing: '0.06em' }}>{sc.title ?? ''}</div>
                  <div style={{ fontSize: '0.38rem', color: '#a0a0b8', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{sc.description ?? ''}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center">
              <span className="font-mono" style={{ fontSize: '0.38rem', color: '#62627a' }}>No script yet</span>
            </div>
          )}
        </div>

        {/* Page 1: Shotlist (default) — first 3 shots as rows */}
        <div style={{ width: '33.333%', flex: '0 0 33.333%', padding: '8px 9px', display: 'flex', flexDirection: 'column' }}>
          {allShots.length > 0 ? (
            <div className="flex flex-col flex-1 justify-center" style={{ gap: 3 }}>
              {allShots.slice(0, 3).map((shot: any) => (
                <div key={shot.id} className="flex items-center" style={{ gap: 7, padding: '5px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: 5, border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="font-mono flex-shrink-0" style={{ fontSize: '0.42rem', fontWeight: 700, color: projectColor, letterSpacing: '0.04em', width: 22 }}>{shot.shotNumber}</span>
                  <span className="font-mono flex-shrink-0" style={{ fontSize: '0.34rem', color: '#62627a', letterSpacing: '0.04em', width: 24, textAlign: 'center' }}>{SIZE_SHORT[shot.size] ?? '—'}</span>
                  <span className="truncate" style={{ fontSize: '0.40rem', color: '#a0a0b8', flex: 1 }}>{shot.description ?? ''}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center" style={{ gap: 6 }}>
              <div className="flex items-center justify-center rounded-full" style={{ width: 28, height: 28, border: `1.5px dashed rgba(${pr},${pg},${pb},0.35)` }}>
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M5 1V9M1 5H9" stroke={`rgba(${pr},${pg},${pb},0.5)`} strokeWidth="1.3" strokeLinecap="round" /></svg>
              </div>
              <span className="font-mono" style={{ fontSize: '0.42rem', color: '#62627a', letterSpacing: '0.06em' }}>No shots yet</span>
            </div>
          )}
        </div>

        {/* Page 2: Storyboard — first board only, with condensed description */}
        <div style={{ width: '33.333%', flex: '0 0 33.333%', padding: '8px 9px', display: 'flex', flexDirection: 'column' }}>
          {allShots.length > 0 ? (() => {
            const shot: any = allShots[0]
            return (
              <div className="flex flex-1 flex-col overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 6 }}>
                <div className="flex-shrink-0 relative" style={{ flex: 1, minHeight: 0, background: SCENE_GRAD[1] }}>
                  {shot.imageUrl && (
                    <StorageImage url={shot.imageUrl} alt={shot.shotNumber} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                  <div className="absolute" style={{ top: 4, left: 4, fontFamily: "'Geist', sans-serif", fontSize: '0.40rem', fontWeight: 700, color: projectColor, background: 'rgba(4,4,10,0.7)', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.04em' }}>
                    {shot.shotNumber}
                  </div>
                </div>
                <div style={{ padding: '5px 7px', flexShrink: 0 }}>
                  <div className="truncate" style={{ fontSize: '0.36rem', color: '#a0a0b8', lineHeight: 1.3 }}>{shot.description ?? ''}</div>
                </div>
              </div>
            )
          })() : (
            <div className="flex-1 flex items-center justify-center">
              <span className="font-mono" style={{ fontSize: '0.38rem', color: '#62627a' }}>No boards yet</span>
            </div>
          )}
        </div>
      </div>

    </div>
  )
})

// ── DETAIL SHEETS ─────────────────────────────────────────


// ── MAIN PAGE ─────────────────────────────────────────────

export function HubContent({ projectId }: { projectId: string }) {
  const router = useRouter()
  const { data: project, isLoading: loadingProject } = useProject(projectId)
  const colors = deriveProjectColors(project?.color || getProjectColor(projectId) || DEFAULT_PROJECT_HEX)
  const projectColor = colors.primary
  const [pr, pg, pb] = hexToRgb(colors.primary)
  const { data: actionItems, isLoading: loadingAI } = useActionItems(projectId)
  const { data: milestones, isLoading: loadingMS } = useMilestones(projectId)
  const { data: crew, isLoading: loadingCrew } = useCrew(projectId)
  // getShotsByProject returns Scene rows with Shot(*) attached, sorted
  // the same way useScenes would — so a separate scenes fetch was a
  // duplicate request. Derive allScenes from this single source.
  const { data: scenesWithShots } = useQuery({
    queryKey: ['shotsByProject', projectId],
    queryFn: () => getShotsByProject(projectId),
    enabled: !!projectId,
  })
  const { data: moodRefs } = useMoodboard(projectId)
  const { data: threads } = useThreadPreviews(projectId)
  const { data: locations } = useLocations(projectId)
  const { data: artItems } = useArtItems(projectId)
  const { data: castRoles } = useCastRoles(projectId)
  const { data: workflowNodes } = useWorkflowNodes(projectId)
  const { data: inventoryItems } = useInventoryItems(projectId)
  const { data: shootDays } = useShootDays(projectId)
  const { data: budgetData } = useBudget(projectId)

  // Warm Next.js's route cache for every subpage the Hub can navigate to.
  // The Hub uses router.push() (not <Link>), so without this every first
  // click pays for a fresh route compile + JS chunk fetch. Prefetching once
  // on mount makes subsequent navigation feel instant.
  useEffect(() => {
    if (!projectId) return
    const targets = [
      'timeline', 'budget', 'action-items', 'inventory', 'workflow',
      'scenemaker', 'moodboard', 'locations', 'art', 'casting',
      'crew', 'threads', 'chat', 'resources',
    ]
    for (const t of targets) router.prefetch(`/projects/${projectId}/${t}`)
  }, [projectId, router])

  // Hub Budget preview rollup — same compute pipeline the budget page uses.
  // PR 8 keeps the card simple (working total + actuals + % spent); the
  // fancier topsheet card (variance flags etc.) lands in PR 10.
  const budgetTree = budgetData as (Budget & {
    versions:  BudgetVersion[]
    accounts:  BudgetAccount[]
    lines:     (BudgetLine & { amounts: BudgetLineAmount[] })[]
    variables: BudgetVariable[]
    markups:   BudgetMarkup[]
    expenses:  Expense[]
  }) | null | undefined
  const budgetPreview = useMemo(() => {
    if (!budgetTree) return null
    const working = budgetTree.versions.find(v => v.kind === 'working') ?? budgetTree.versions[0]
    if (!working) return null
    const ctx = buildEvalContext(budgetTree.variables, (shootDays ?? []) as ShootDay[], working.id)
    const amountsByLine = new Map<string, BudgetLineAmount | undefined>()
    for (const line of budgetTree.lines) {
      amountsByLine.set(line.id, line.amounts.find(a => a.versionId === working.id))
    }
    const rollup = rollUpBudget({
      lines: budgetTree.lines,
      amountsByLine,
      accounts: budgetTree.accounts,
      expenses: budgetTree.expenses,
      markups: budgetTree.markups,
      ctx,
      varianceThreshold: Number(budgetTree.varianceThreshold),
      activeVersionId: working.id,
    })
    // Variance summary across lines (PR 10): count lines flagged 'over'
    // and 'under' so the Hub card can surface "N over budget".
    let over = 0, under = 0
    rollup.computedByLine.forEach(c => {
      if (c.flag === 'over')  over++
      else if (c.flag === 'under') under++
    })
    return {
      workingTotal: rollup.grandTotal,
      actuals: rollup.grandActuals,
      lineCount: budgetTree.lines.length,
      overCount: over,
      underCount: under,
      versionLabel: working.name,
    }
  }, [budgetTree, shootDays])

  // Budget block is producer-only per spec. RLS guarantees Budget data
  // returns empty for crew; this hook hides the entry-points too.
  const hubViewerRole = useViewerRole(projectId)
  const isProducer = hubViewerRole === 'producer'
  const toggle = useToggleActionItem(projectId)
  const createTask = useCreateActionItem(projectId)
  const createMilestone = useCreateMilestone(projectId)

  const [showCreateTask, setShowCreateTask] = useState(false)
  const [showCreateMilestone, setShowCreateMilestone] = useState(false)
  const [showCreateCreative, setShowCreateCreative] = useState(false)
  const [showInviteCrew, setShowInviteCrew] = useState(false)

  // ── Hub split mode (default ON, per docs/superpowers/specs/2026-05-03-hub-production-creative-toggle-design.md) ──
  // PR #157 shipped this gated behind ?hub=split for in-production
  // validation. After live iteration (Tone strip, FAB-per-mode swap,
  // Budget bottom row, rotating arc toggle, LCA per-column headers,
  // Art-page tab toggle, .slate-name CSS hotfix), the default is now
  // flipped to ON. ?hub=stacked is the opt-OUT kill switch — anyone
  // can fall back to the old stacked layout by hitting
  // /projects/<id>?hub=stacked if a regression surfaces.
  const searchParams = useSearchParams()
  const splitEnabled = searchParams?.get('hub') !== 'stacked'
  const { mode, setMode } = useHubMode(projectId)
  // Arc mode is local to the Creative surface — does NOT persist
  // (per spec: navigation aid, not a mode). Defaults to 'script'.
  const [arcMode, setArcMode] = useState<ArcMode>('script')

  // Hub registers a 3-branch + with the global ActionBar. The branch set
  // depends on the gate + mode:
  //   • un-gated (default Hub) → Action / Milestone / Creative — UNCHANGED today.
  //   • split + production → Action / Milestone / Crew (per spec — Creative
  //     branch swaps for Crew because creative belongs on the other surface).
  //   • split + creative → Scene / Shot / Tone (deep-link directly into
  //     each creation flow; CreateCreativeSheet picker becomes redundant).
  useFabAction({
    branches: splitEnabled && mode === 'creative' ? [
      {
        label: 'Scene',
        color: '#6470f3',
        icon: (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="2" y="3" width="14" height="12" rx="1.5" stroke="#6470f3" strokeWidth="1.3" />
            <path d="M2 7.5H16" stroke="#6470f3" strokeWidth="1.3" />
            <path d="M6.5 3V7.5M11.5 3V7.5" stroke="#6470f3" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        ),
        action: () => router.push(`/projects/${projectId}/scenemaker?mode=script`),
      },
      {
        label: 'Shot',
        color: '#6470f3',
        icon: (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="2.5" y="4.5" width="13" height="9" rx="1" stroke="#6470f3" strokeWidth="1.3" />
            <path d="M5.5 7.5L9 10L12.5 7.5" stroke="#6470f3" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
        action: () => router.push(`/projects/${projectId}/scenemaker?mode=shotlist`),
      },
      {
        label: 'Tone',
        color: '#6470f3',
        icon: (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="6" cy="7" r="3" stroke="#6470f3" strokeWidth="1.3" />
            <circle cx="11" cy="9.5" r="3" stroke="#6470f3" strokeWidth="1.3" />
            <circle cx="8" cy="12" r="3" stroke="#6470f3" strokeWidth="1.3" />
          </svg>
        ),
        action: () => router.push(`/projects/${projectId}/moodboard`),
      },
    ] : splitEnabled ? [
      // Split + production: Action / Milestone / Crew (Crew replaces Creative)
      {
        label: 'Action',
        color: '#e8a020',
        icon: (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="7" stroke="#e8a020" strokeWidth="1.3" />
            <path d="M5.5 9L8 11.5L12.5 6.5" stroke="#e8a020" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
        action: () => setShowCreateTask(true),
      },
      {
        label: 'Milestone',
        color: projectColor,
        icon: (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <line x1="2" y1="9" x2="16" y2="9" stroke={projectColor} strokeWidth="1.3" />
            <circle cx="6" cy="9" r="2.5" fill={projectColor} />
            <circle cx="12" cy="9" r="2.5" fill={projectColor} />
          </svg>
        ),
        action: () => setShowCreateMilestone(true),
      },
      {
        label: 'Crew',
        color: '#00b894',
        icon: (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="6" r="2.8" stroke="#00b894" strokeWidth="1.3" />
            <path d="M3 15.5c0-3 2.7-5 6-5s6 2 6 5" stroke="#00b894" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        ),
        action: () => setShowInviteCrew(true),
      },
    ] : [
      // Default un-gated Hub: Action / Milestone / Creative — UNCHANGED today.
      {
        label: 'Action',
        color: '#e8a020',
        icon: (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="7" stroke="#e8a020" strokeWidth="1.3" />
            <path d="M5.5 9L8 11.5L12.5 6.5" stroke="#e8a020" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
        action: () => setShowCreateTask(true),
      },
      {
        label: 'Milestone',
        color: projectColor,
        icon: (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <line x1="2" y1="9" x2="16" y2="9" stroke={projectColor} strokeWidth="1.3" />
            <circle cx="6" cy="9" r="2.5" fill={projectColor} />
            <circle cx="12" cy="9" r="2.5" fill={projectColor} />
          </svg>
        ),
        action: () => setShowCreateMilestone(true),
      },
      {
        label: 'Creative',
        color: '#6470f3',
        icon: (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="2" y="3" width="14" height="12" rx="1.5" stroke="#6470f3" strokeWidth="1.3" />
            <path d="M2 7.5H16" stroke="#6470f3" strokeWidth="1.3" />
            <path d="M6.5 3V7.5M11.5 3V7.5" stroke="#6470f3" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        ),
        action: () => setShowCreateCreative(true),
      },
    ],
  }, [splitEnabled, mode, projectColor, projectId, router])

  const [selectedAI, setSelectedAI] = useState<ActionItem | null>(null)
  const [selectedMS, setSelectedMS] = useState<Milestone | null>(null)
  const [selectedCrew, setSelectedCrew] = useState<CrewMember | null>(null)
  const [crewPanelOpen, setCrewPanelOpen] = useState(false)

  // Role filter pill row under crew avatars — V2 anchor row.
  // Filters the crew avatar strip to members with the selected role
  // (or all roles when 'all' is active).
  const [activeRoleFilter, setActiveRoleFilter] = useState<Role | 'all'>('all')

  // Project switcher lives in <ProjectSwitcher>; replaces the old
  // swipe-between-projects gesture and is also wired into every subpage's
  // PageHeader meta slot.

  // Stable identity for the `?? []` fallback so downstream useMemos that
  // watch `allItems` etc. don't re-fire every render when the upstream
  // query is undefined / resolves to the same array.
  const allItems = (actionItems ?? EMPTY_ARRAY) as ActionItem[]
  const allMS = (milestones ?? EMPTY_ARRAY) as Milestone[]
  const allCrew = (crew ?? EMPTY_ARRAY) as CrewMember[]
  const filteredCrew = useMemo(() => {
    if (activeRoleFilter === 'all') return allCrew
    return allCrew.filter((m: any) => m?.role === activeRoleFilter)
  }, [allCrew, activeRoleFilter])
  const allScenes = useMemo<any[]>(() => {
    if (!scenesWithShots) return EMPTY_ARRAY as unknown as any[]
    return scenesWithShots.map((s: any) => {
      const { Shot: _shot, ...sceneFields } = s
      return sceneFields
    })
  }, [scenesWithShots])
  const allShots = useMemo<any[]>(() => {
    if (!scenesWithShots) return EMPTY_ARRAY as unknown as any[]
    return scenesWithShots.flatMap((s: any) => s.Shot ?? [])
  }, [scenesWithShots])
  const allMoodRefs = (moodRefs ?? EMPTY_ARRAY) as any[]
  const allLocations = (locations ?? EMPTY_ARRAY) as any[]
  const allArt = (artItems ?? EMPTY_ARRAY) as any[]
  const allCast = (castRoles ?? EMPTY_ARRAY) as any[]
  const allWorkflow = (workflowNodes ?? EMPTY_ARRAY) as WorkflowNode[]
  const allInventory = (inventoryItems ?? EMPTY_ARRAY) as any[]
  const allThreads = (threads ?? EMPTY_ARRAY) as { unread: boolean }[]

  // crewByUserId — built once per `allCrew` change. Used inside the action
  // item preview render where each row used to do allCrew.find(c => c.userId === item.assignedTo).
  const crewByUserId = useMemo(() => {
    const m = new Map<string, CrewMember>()
    for (const c of allCrew) m.set(c.userId, c)
    return m
  }, [allCrew])

  const openItems = useMemo(
    () => allItems.filter(i => i.status !== 'done'),
    [allItems],
  )
  const previewTasks = useMemo(() => openItems.slice(0, 3), [openItems])
  const upcoming3 = useMemo(
    () => allMS
      .filter(m => new Date(m.date) >= new Date())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3),
    [allMS],
  )
  const unreadThreads = useMemo(
    () => allThreads.filter(t => t.unread).length,
    [allThreads],
  )

  const inventoryNeeded = useMemo(
    () => allInventory.filter((i: any) => i.status === 'needed').length,
    [allInventory],
  )

  const shuffledMood = useMemo(() => {
    const refs = [...allMoodRefs]
    let seed = 0
    for (let i = 0; i < projectId.length; i++) seed = ((seed << 5) - seed + projectId.charCodeAt(i)) | 0
    for (let i = refs.length - 1; i > 0; i--) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; const j = seed % (i + 1); [refs[i], refs[j]] = [refs[j], refs[i]] }
    return refs.slice(0, 4)
  }, [allMoodRefs, projectId])

  // ── BATCHED LOCATION ATTACHMENTS ───────────────────────
  // Hub's two location-cover surfaces (LCA row + Locations module in
  // creative split) used to mount one EntityAttachmentCover per location
  // — each running its own listEntityAttachments query. Replace with a
  // single batched fetch and a presentational cover that takes its slice.
  const locationIds = useMemo(
    () => allLocations.map((l: any) => l.id).filter(Boolean),
    [allLocations],
  )
  const locationIdsKey = useMemo(() => locationIds.join('|'), [locationIds])
  const { data: locationAttachments = EMPTY_ARRAY as unknown as EntityAttachmentRow[] } = useQuery({
    // queryKey baked from a stable string — react-query's structural
    // equality ignores the array content here so we use the joined key.
    queryKey: ['entityAttachmentsBatch', projectId, 'location', locationIdsKey],
    queryFn: () => listEntityAttachmentsBatch(projectId, 'location', locationIds),
    enabled: !!projectId && locationIds.length > 0,
  })
  const coversByLocationId = useMemo(() => {
    const m = new Map<string, EntityAttachmentRow[]>()
    for (const att of locationAttachments) {
      const list = m.get(att.attachedToId)
      if (list) list.push(att)
      else m.set(att.attachedToId, [att])
    }
    return m
  }, [locationAttachments])

  if (loadingProject) return <HubSkeleton />
  if (!project) return <div className="screen flex items-center justify-center"><p className="text-muted font-mono text-xs">Project not found</p></div>

  const locConfirmed = allLocations.filter((l: any) => l.status === 'confirmed').length
  const locTotal = allLocations.length
  const artApproved = allArt.filter(a => a.status === 'Approved').length
  const castConfirmed = allCast.filter((r: any) => r.cast === true).length

  // Cinema Glass: visual properties (bg, border, blur, radius) live on the
  // .glass-tile class; consumers spread structural style only (height, flex).
  const cardStyle = {}
  // Lighter project accent for the sheen-title gradient apex (the spec's
  // "accent-glow"). +20/+30/+16 lands close to the gallery values without
  // a new package export.
  const glowR = Math.min(255, pr + 20)
  const glowG = Math.min(255, pg + 30)
  const glowB = Math.min(255, pb + 16)

  return (
    <div
      className="screen"
      style={{
        // Set inline once at the screen root; downstream .glass-tile and
        // .sheen-title rules read these. Project tokens stay inline-hex
        // per Locations/Art precedent — chrome surfaces flip via CSS vars.
        ['--tile-rgb' as string]: `${pr}, ${pg}, ${pb}`,
        ['--accent-rgb' as string]: `${pr}, ${pg}, ${pb}`,
        ['--accent-glow-rgb' as string]: `${glowR}, ${glowG}, ${glowB}`,
      } as React.CSSProperties}
    >
      {/* ══ ACCENT-PULSE BAND — the only autoplay motion (V2 anchor).
            Reads --accent-rgb / --accent-glow-rgb set on the screen root. ══ */}
      <div className="hub-bg-glow-pulse" style={{ position: 'fixed' }} />

      {/* ══ TOPBAR — frosted surface + radial accent glow from above ══ */}
      <div className="hub-topbar relative flex flex-col items-center justify-end px-5 flex-shrink-0" style={{
        minHeight: 100, paddingTop: 'calc(var(--safe-top) + 10px)', paddingBottom: 12,
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        zIndex: 10,
        overflow: 'hidden',
      }}>
        {/* Radial accent glow from above */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '140%', height: '120%',
          background: `radial-gradient(ellipse 50% 70% at 50% 35%, rgba(${pr},${pg},${pb},0.15) 0%, rgba(${pr},${pg},${pb},0.04) 55%, transparent 80%)`,
          pointerEvents: 'none',
        }} />
        {/* Client name — muted secondary */}
        {project.client && (
          <span className="font-mono uppercase" style={{ fontSize: '0.52rem', letterSpacing: '0.1em', marginBottom: 4, color: projectColor, opacity: 0.85, position: 'relative' }}>
            {project.client}
          </span>
        )}

        {/* Project name + slide-down switcher panel. */}
        <ProjectSwitcher
          projectId={projectId}
          projectName={project.name}
          accentColor={projectColor}
          variant="hub"
        />

        {/* Type + Status pill — centered. Phase pill is the only chip
            in the meta row per DESIGN_LANGUAGE.md page header pattern. */}
        <div className="flex items-center justify-center gap-2" style={{ marginTop: 4 }}>
          <span className="font-mono uppercase" style={{ fontSize: '0.48rem', color: 'var(--fg-mono)' }}>{project.type}</span>
          <span style={{ fontSize: '0.48rem', color: 'var(--fg-mono)' }}>&middot;</span>
          <span className={`ai-meta-pill ${project.status}`}>
            <span className="phase-dot" />
            {statusLabel(project.status)}
          </span>
        </div>

        {/* Crew avatars */}
        <div
          className="flex items-center justify-center cursor-pointer"
          style={{ marginTop: 10 }}
          onClick={() => { haptic('light'); setCrewPanelOpen(true) }}>
          {filteredCrew.slice(0, 4).map((m, i) => (
            <div key={m.id} className="relative" style={{ marginLeft: i === 0 ? 0 : -7, zIndex: 4 - i }}>
              <CrewAvatar name={m.User?.name ?? 'Unknown'} size={28} avatarUrl={m.User?.avatarUrl} />
            </div>
          ))}
          {filteredCrew.length > 4 && (
            <div className="rounded-full bg-surface2 border border-border flex items-center justify-center" style={{ width: 28, height: 28, marginLeft: -7 }}>
              <span className="font-mono text-muted" style={{ fontSize: 9 }}>+{filteredCrew.length - 4}</span>
            </div>
          )}
          {filteredCrew.length === 0 && (
            <span className="font-mono" style={{ fontSize: '0.38rem', color: '#62627a', letterSpacing: '0.06em' }}>{activeRoleFilter === 'all' ? 'No crew yet' : `No ${activeRoleFilter}s`}</span>
          )}
        </div>

        {/* Role filter pill row — V2 anchor. Filters the crew avatar
            strip above by selected role. Hidden in split mode — the
            HubModeToggle takes its anchor slot in the topbar's
            vertical rhythm. */}
        {!splitEnabled && (
          <div className="cp-filter-row" role="tablist" aria-label="Crew role filter">
            {(['all', 'director', 'producer', 'coordinator', 'writer', 'crew'] as const).map(role => {
              const label = role === 'all' ? 'All' : role[0].toUpperCase() + role.slice(1)
              const isActive = activeRoleFilter === role
              return (
                <button
                  key={role}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`cp-filter-pill${isActive ? ' active' : ''}`}
                  onClick={() => { haptic('light'); setActiveRoleFilter(role) }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}

        {/* Hub split-mode toggle — replaces the crew role filter row in
            the topbar's last anchor slot when ?hub=split is active.
            Binary toggle between Production and Creative surfaces. */}
        {splitEnabled && (
          <div style={{ width: '100%', marginTop: 8 }}>
            <HubModeToggle mode={mode} onChange={setMode} />
          </div>
        )}
      </div>

      {/* ══ BODY ══ */}
      {/* item 15: paddingBottom increased to clear FAB at bottom: 68px */}
      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', padding: '18px 16px 140px' }}>
        <div className="flex flex-col gap-6">

          {(!splitEnabled || mode === 'production') && <>
          {/* 1. TIMELINE + BUDGET (2-col peers, producer-only Budget).
              Producer: side-by-side. Non-producer: Timeline goes
              full-width (Budget col is hidden). PR 14 placement fix. */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: (isProducer && !splitEnabled) ? '1fr 1fr' : '1fr',
              gap: 12,
              alignItems: 'stretch',
            }}
          >
            <div className="cursor-pointer" aria-label="Open timeline" {...clickableProps(() => router.push(`/projects/${projectId}/timeline`))}>
              <ModuleHeader name="Timeline" meta={new Date().toLocaleDateString('en-US', { weekday: 'short', month: '2-digit', day: '2-digit' }).replace(',', ' ·')} />
              {loadingMS ? (
                <div className="glass-tile" style={{ ...cardStyle, height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="letterbox-top" />
                  <div className="w-4 h-4 rounded-full border border-border2 border-t-accent animate-spin" />
                  <div className="letterbox-bottom" />
                </div>
              ) : allMS.length === 0 ? (
                <div className="glass-tile" style={{ ...cardStyle, height: 130, display: 'flex', flexDirection: 'column' }}>
                  <div className="letterbox-top" />
                  <div style={{ padding: '12px 12px 0', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                    {(['Pre', 'Prod', 'Post'] as const).map((label, i) => {
                      const color = ['#e8a020', '#6470f3', '#00b894'][i]
                      return (
                        <div key={label} className="flex items-center gap-1.5">
                          <span className="font-mono uppercase text-right flex-shrink-0" style={{ fontSize: '0.42rem', color: 'var(--fg-mono)', width: 28, letterSpacing: '0.06em' }}>{label}</span>
                          <div className="flex-1 rounded-sm" style={{ height: 5, background: `${color}1a`, animation: `pulse 2.4s ease-in-out infinite ${i * 0.3}s` }} />
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-4">
                    <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--fg)', letterSpacing: '-0.01em' }}>The time is now.</div>
                    <div className="font-mono" style={{ fontSize: '0.47rem', color: 'var(--fg-mono)', letterSpacing: '0.03em', lineHeight: 1.6 }}>No milestones yet.<br />Add milestones to start the clock.</div>
                  </div>
                  <div className="letterbox-bottom" />
                </div>
              ) : (
                // item 10: Gantt chart replaces milestone list
                <div className="glass-tile" style={{ ...cardStyle, height: 130, display: 'flex', flexDirection: 'column' }}>
                  <div className="letterbox-top" />
                  <GanttChart milestones={allMS} projectStatus={project.status} />
                  <div className="letterbox-bottom" />
                </div>
              )}
            </div>

            {/* BUDGET — producer-only (spec Q8). V2: bgt-dial signature
                visual replaces the actuals number; bgt-meta carries the
                spent/total mono row; bgt-version-pill anchors top-right
                with the working version label. Variance chip remains
                below the dial as a tinted info row. */}
            {isProducer && !splitEnabled && (
              <div
                className="cursor-pointer"
                onClick={() => { haptic('light'); router.push(`/projects/${projectId}/budget`) }}
              >
                <ModuleHeader name="Budget" />
                {budgetPreview && budgetPreview.workingTotal > 0 ? (() => {
                  const pct = Math.min(100, Math.round((budgetPreview.actuals / budgetPreview.workingTotal) * 100))
                  // r=26 ring, circumference 2π·26 ≈ 163.36
                  const CIRC = 163.36
                  const dashOffset = CIRC * (1 - pct / 100)
                  const fmt = (n: number) => n >= 1000
                    ? `$${Math.round(n / 1000)}K`
                    : `$${Math.round(n).toLocaleString('en-US')}`
                  return (
                    <div
                      className="glass-tile bgt-card"
                      style={{
                        position: 'relative', height: 130,
                        display: 'flex', flexDirection: 'column',
                        boxSizing: 'border-box',
                      }}
                    >
                      <span className="bgt-version-pill">{budgetPreview.versionLabel || 'Working'}</span>
                      <div className="letterbox-top" />
                      <div
                        className="bgt-body"
                        style={{
                          flex: 1, display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'flex-start',
                          padding: '8px 12px',
                        }}
                      >
                        <div className="bgt-dial">
                          <svg viewBox="0 0 64 64" fill="none">
                            <circle className="bgt-dial-bg" cx="32" cy="32" r="26" strokeWidth="3" />
                            <circle
                              className="bgt-dial-fg"
                              cx="32" cy="32" r="26" strokeWidth="3"
                              strokeDasharray={CIRC}
                              strokeDashoffset={dashOffset}
                            />
                          </svg>
                          <span className="bgt-dial-pct">{pct}%</span>
                        </div>
                        <div className="bgt-meta">
                          <span className="bgt-meta-spent">{fmt(budgetPreview.actuals)}</span>
                          <span className="bgt-meta-sep">/</span>
                          <span className="bgt-meta-total">{fmt(budgetPreview.workingTotal)}</span>
                        </div>
                        {budgetPreview.overCount > 0 && (
                          <span
                            className="font-mono uppercase"
                            style={{
                              fontSize: '0.34rem', letterSpacing: '0.08em',
                              padding: '2px 6px', borderRadius: 999, marginTop: 4,
                              background: 'rgba(232,86,74,0.10)',
                              border: '1px solid rgba(232,86,74,0.30)',
                              color: '#e8564a',
                            }}
                          >
                            ⚠ {budgetPreview.overCount} over
                          </span>
                        )}
                      </div>
                      <div className="letterbox-bottom" />
                    </div>
                  )
                })() : (
                  // V2.1 empty state: same Cinema Glass chrome as the loaded
                  // tile (glass-tile + bgt-card + version pill + letterboxes).
                  // Only the dial fg arc and meta values are dropped; a "—"
                  // placeholder keeps the dial silhouette and a mono ghost CTA
                  // anchors the next action. Visual-only; data flow unchanged.
                  <div
                    className="glass-tile bgt-card"
                    style={{
                      position: 'relative', height: 130,
                      display: 'flex', flexDirection: 'column',
                      boxSizing: 'border-box',
                    }}
                  >
                    <span className="bgt-version-pill bgt-version-pill-empty">—</span>
                    <div className="letterbox-top" />
                    <div
                      className="bgt-body"
                      style={{
                        flex: 1, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'flex-start',
                        padding: '8px 12px',
                      }}
                    >
                      <div className="bgt-dial bgt-dial-empty">
                        <svg viewBox="0 0 64 64" fill="none">
                          <circle className="bgt-dial-bg" cx="32" cy="32" r="26" strokeWidth="3" />
                        </svg>
                        <span className="bgt-dial-pct">—</span>
                      </div>
                      <span className="bgt-empty-cta">Set up budget →</span>
                    </div>
                    <div className="letterbox-bottom" />
                  </div>
                )}
              </div>
            )}
          </div>

                    </>}

{(!splitEnabled || mode === 'production') && <>
{/* 2. ACTION ITEMS (second) — item 9: no chevron, item 13: assignee pills + navigate */}
          <div className="cursor-pointer" aria-label="Open action items" {...clickableProps(() => router.push(`/projects/${projectId}/action-items`))}>
            <ModuleHeader name="My Action Items" meta={openItems.length > 0 ? `${openItems.length} open` : 'All clear'} />
            {loadingAI ? (
              <div className="glass-tile" style={{ ...cardStyle, height: 148, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="letterbox-top" />
                <div className="w-4 h-4 rounded-full border border-border2 border-t-accent animate-spin" />
                <div className="letterbox-bottom" />
              </div>
            ) : previewTasks.length === 0 ? (
              <div className="glass-tile" style={{ ...cardStyle, height: 148, display: 'flex', flexDirection: 'column' }}>
                <div className="letterbox-top" />
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-4">
                  <div className="relative flex-shrink-0" style={{ width: 34, height: 34 }}>
                    <div className="absolute inset-0 rounded-full" style={{ border: `1px solid rgba(${pr},${pg},${pb},0.3)`, animation: 'ring-pulse 2.4s ease-out infinite' }} />
                    <div className="absolute inset-0 rounded-full" style={{ background: `rgba(${pr},${pg},${pb},0.08)`, border: `1px solid rgba(${pr},${pg},${pb},0.15)` }} />
                    <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 15 15" fill="none">
                      <path d="M2.5 7.5L6 11L12.5 4" stroke={projectColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--fg)', letterSpacing: '-0.01em' }}>All clear, boss.</div>
                  <div className="font-mono" style={{ fontSize: '0.48rem', color: 'var(--fg-mono)', letterSpacing: '0.03em', lineHeight: 1.6 }}>No open items on this one.<br />Enjoy it while it lasts.</div>
                </div>
                <div className="letterbox-bottom" />
              </div>
            ) : (
              <div className="glass-tile" style={{ ...cardStyle, height: 148, display: 'flex', flexDirection: 'column' }}>
                <div className="letterbox-top" />
                {previewTasks.map((item, i) => {
                  const isMine = true
                  const dateLabel = item.dueDate ? formatDate(item.dueDate) : null
                  const overdue = item.dueDate ? isLate(item.dueDate) : false
                  // item 13: look up assignee name from crew (Map lookup,
                  // not allCrew.find — keeps the row render O(1)).
                  const assigneeMember = item.assignedTo ? crewByUserId.get(item.assignedTo) ?? null : null
                  const assigneeName = assigneeMember?.User?.name ?? null
                  return (
                    <div key={item.id} className="flex items-start cursor-pointer" style={{ gap: 10, padding: '9px 12px', borderBottom: i < previewTasks.length - 1 ? '1px solid rgba(255,255,255,0.05)' : undefined }}
                      onClick={e => { e.stopPropagation(); router.push(`/projects/${projectId}/action-items`) }}>
                      <div className="flex-shrink-0 rounded-full" style={{ width: 14, height: 14, marginTop: 1, border: `1.5px solid ${isMine ? projectColor : 'var(--fg-mono)'}` }}
                        onClick={e => { e.stopPropagation(); haptic('success'); toggle.mutate({ id: item.id, done: item.status !== 'done' }) }} />
                      <div className="flex-1 min-w-0">
                        {/* item 7: third-tier label size */}
                        <div className="truncate" style={{ fontSize: '0.66rem', fontWeight: 600, lineHeight: 1.3, color: isMine ? 'var(--fg)' : 'var(--fg-mono)' }}>{item.title}</div>
                        {dateLabel && <div className="font-mono" style={{ fontSize: '0.50rem', marginTop: 2, letterSpacing: '0.03em', color: overdue ? '#e8a020' : 'var(--fg-mono)' }}>{dateLabel}</div>}
                      </div>
                      {/* item 13: assignee pill */}
                      {assigneeName && (
                        <div style={{
                          flexShrink: 0,
                          padding: '2px 7px',
                          borderRadius: 20,
                          background: `rgba(${pr},${pg},${pb},0.08)`,
                          border: `1px solid rgba(${pr},${pg},${pb},0.2)`,
                          display: 'flex', alignItems: 'center',
                          alignSelf: 'center',
                        }}>
                          <span className="font-mono" style={{ fontSize: '0.32rem', color: 'var(--fg-mono)', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{assigneeName.split(' ')[0]}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
                <div className="letterbox-bottom" />
              </div>
            )}
          </div>

          </>}

{!splitEnabled && <>
{/* 3. CREATIVE SECTION — non-split only. In split mode, the spec-aligned
       Creative-split block below replaces this with HubArcToggle + locked
       arc panel + Tone (full-width) + LCA row. */}
          <div>
            <ModuleHeader name="Creative" meta={`${allScenes.length > 0 ? `SC.${allScenes[0].num}` : ''}${allMoodRefs.length > 0 ? ' · Tone' : ''}${allLocations.length > 0 ? ` · ${allLocations.length} locations` : ''}`} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* SceneMaker + Tone 50/50 — item 8: labels moved INSIDE panels */}
              <div className="flex" style={{ gap: 8, height: 148 }}>
                {/* SceneMaker card — item 12: swipeable */}
                <div className="glass-tile flex-1 min-w-0 cursor-pointer" style={{ display: 'flex', flexDirection: 'column' }}>
                  <SwipeableSceneMaker
                    projectId={projectId}
                    projectColor={projectColor}
                    pr={pr} pg={pg} pb={pb}
                    allShots={allShots}
                    allScenes={allScenes}
                    allMoodRefs={allMoodRefs}
                    shuffledMood={shuffledMood}
                    router={router}
                  />
                </div>

                {/* Tone panel — swipeable moodboard images */}
                <SwipePanel
                  items={allMoodRefs}
                  label="Tone"
                  labelColor={projectColor}
                  href={`/projects/${projectId}/moodboard`}
                  emptyContent={
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: 0.35 }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                        <rect x="2" y="4" width="20" height="16" rx="2" stroke="#62627a" strokeWidth="1.3" />
                        <circle cx="8" cy="10" r="2" stroke="#62627a" strokeWidth="1.2" />
                        <path d="M2 16l5-4 3 2 4-5 8 7" stroke="#62627a" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="font-mono" style={{ fontSize: '0.38rem', color: '#62627a' }}>Set the tone</span>
                    </div>
                  }
                  renderItem={(ref) => (
                    ref.imageUrl ? (
                      <StorageImage url={ref.imageUrl} alt={ref.title} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
                        placeholder={<div style={{ width: '100%', height: '100%', background: ref.gradient || '#0a0a12', opacity: 0.7 }} />} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: ref.gradient || '#0a0a12', opacity: 0.7 }} />
                    )
                  )}
                />
              </div>

              {/* Locations / Casting / Art row — V2 lca-row triplet */}
              <div className="lca-row">
                {/* Locations panel — swipeable location images */}
                <SwipePanel
                  items={allLocations}
                  label="Locations"
                  labelColor="#e8a020"
                  emptyIcon="📍"
                  href={`/projects/${projectId}/locations`}
                  renderItem={(loc: any) => (
                    // Cover sources from EntityAttachment ('location', loc.id);
                    // batched fetch via coversByLocationId. Falls back to a
                    // placeholder when no attachment exists.
                    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                      <EntityAttachmentCoverPresentational
                        items={coversByLocationId.get(loc.id) ?? (EMPTY_ARRAY as unknown as EntityAttachmentRow[])}
                        size="100%"
                        alt={loc.name}
                      />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 6px', background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}>
                        <span style={{ fontSize: '0.38rem', fontWeight: 600, color: '#dddde8' }}>{loc.name}</span>
                      </div>
                    </div>
                  )}
                />

                {/* Casting panel — grid of cast headshots (single page, no swiping) */}
                <SwipePanel
                  items={allCast.length > 0 ? [allCast] : []}
                  label="Casting"
                  labelColor="#00b894"
                  emptyIcon="🎭"
                  href={`/projects/${projectId}/casting`}
                  renderItem={(roles: any[]) => {
                    // Show up to 6 actors (confirmed first, then uncast); avatar grid.
                    const sorted = [...roles].sort((a, b) => Number(b.cast) - Number(a.cast))
                    const visible = sorted.slice(0, 6)
                    const remaining = sorted.length - visible.length
                    return (
                      <div style={{ width: '100%', height: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, padding: '6px 8px 10px' }}>
                        {visible.map((role: any, i: number) => {
                          const t = role.talent
                          return (
                            <div key={role.id ?? i} style={{
                              position: 'relative', aspectRatio: '1 / 1', borderRadius: '50%',
                              overflow: 'hidden',
                              border: t ? '1px solid rgba(0,184,148,0.35)' : '1px dashed rgba(255,255,255,0.12)',
                              background: 'rgba(255,255,255,0.04)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {t?.imageUrl ? (
                                <StorageImage url={t.imageUrl} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <span className="font-mono" style={{ fontSize: '0.42rem', fontWeight: 700, color: t ? '#00b894' : 'rgba(255,255,255,0.18)' }}>
                                  {t?.initials ?? '?'}
                                </span>
                              )}
                              {i === 5 && remaining > 0 && (
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(4,4,10,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dddde8', fontSize: '0.46rem', fontWeight: 700 }}>
                                  +{remaining}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  }}
                />

                {/* Art panel — swipeable tabs: Wardrobe, Props, HMU */}
                <SwipePanel
                  items={['wardrobe', 'props', 'hmu'] as const}
                  label="Art"
                  labelColor="#6470f3"
                  emptyIcon="🎨"
                  href={`/projects/${projectId}/art`}
                  renderItem={(cat: string) => {
                    // 'props' (UI label) maps to Entity.type 'prop' (singular).
                    // wardrobe / hmu match Entity.type one-to-one.
                    const entityType = cat === 'props' ? 'prop' : cat
                    const catItems = allArt.filter(a => a.type === entityType)
                    // First item from each section, in the same order the Art
                    // page lists them (createdAt asc, id asc — see getArtItems).
                    const first = catItems[0]
                    const imgUrl = (first?.metadata as { imageUrl?: string } | null)?.imageUrl
                    const catLabel = cat === 'hmu' ? 'HMU' : cat === 'wardrobe' ? 'Wardrobe' : 'Props'
                    return (
                      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 6 }}>
                        {imgUrl ? (
                          <StorageImage url={imgUrl} alt={catLabel} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                        ) : (
                          <>
                            <span className="font-mono uppercase" style={{ fontSize: '0.38rem', color: '#6470f3', letterSpacing: '0.06em' }}>{catLabel}</span>
                            <span className="font-mono" style={{ fontSize: '0.30rem', color: '#62627a', marginTop: 2 }}>{catItems.length > 0 ? `${catItems.length} items` : 'Empty'}</span>
                          </>
                        )}
                      </div>
                    )
                  }}
                />
              </div>
            </div>
          </div>

          </>}

{splitEnabled && mode === 'creative' && <>
          {/* CREATIVE SPLIT SURFACE — spec-aligned layout:
              HubArcToggle (Script/Shotlist/Storyboard) → locked 220px arc panel
              → Tone (full-width) → LCA 3-up SwipePanel row. */}
          <HubArcToggle mode={arcMode} onChange={setArcMode} />

          {/* Locked-height arc panel — content swaps per arcMode; height
              stays 220px so surfaces below never shift. Footer "Open in
              One Arc · X →" pill pinned to bottom of the locked box. */}
          <div
            className="glass-tile"
            style={{ position: 'relative', height: 220, overflow: 'hidden', marginTop: 8, padding: 0 }}
          >
            {arcMode === 'script' && (
              <div style={{ position: 'absolute', inset: 0, padding: '12px 14px 38px', overflow: 'hidden' }}>
                {allScenes.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {allScenes.slice(0, 5).map((sc: any) => (
                      <div key={sc.id}>
                        <div className="font-mono uppercase" style={{ fontSize: '0.42rem', color: projectColor, letterSpacing: '0.06em', marginBottom: 2 }}>
                          {sc.title ? sc.title : `SC.${sc.num ?? ''}`}
                        </div>
                        <div style={{ fontSize: '0.60rem', color: 'rgba(221,221,232,0.85)', lineHeight: 1.5 }}>
                          {previewScriptText(sc.description)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="font-mono" style={{ fontSize: '0.46rem', color: '#62627a' }}>No script yet</div>
                )}
                {/* Bottom fade-out mask for top-anchored prose overflow */}
                <div style={{ position: 'absolute', bottom: 32, left: 0, right: 0, height: 44, background: 'linear-gradient(to bottom, transparent, rgba(4,4,10,0.95))', pointerEvents: 'none' }} />
              </div>
            )}
            {arcMode === 'shotlist' && (
              <div style={{ position: 'absolute', inset: 0, padding: '12px 14px 38px', overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
                {allShots.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {allShots.slice(0, 16).map((shot: any) => (
                      <div key={shot.id} style={{ display: 'flex', gap: 8, padding: '5px 8px', background: 'rgba(255,255,255,0.025)', borderRadius: 5, alignItems: 'center' }}>
                        <span className="font-mono" style={{ fontSize: '0.46rem', fontWeight: 700, color: projectColor, letterSpacing: '0.04em', width: 28, flexShrink: 0 }}>{shot.shotNumber}</span>
                        <span style={{ fontSize: '0.52rem', color: 'rgba(221,221,232,0.78)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shot.description ?? ''}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="font-mono" style={{ fontSize: '0.46rem', color: '#62627a' }}>No shots yet</div>
                )}
              </div>
            )}
            {arcMode === 'storyboard' && (
              <div style={{ position: 'absolute', inset: 0, padding: '12px 14px 38px', overflow: 'hidden' }}>
                {allShots.filter((s: any) => s.imageUrl).length > 0 ? (
                  <div style={{ display: 'flex', gap: 8, height: '100%', overflowX: 'auto', alignItems: 'center', WebkitOverflowScrolling: 'touch' }}>
                    {allShots.filter((s: any) => s.imageUrl).slice(0, 8).map((shot: any) => (
                      <div key={shot.id} style={{ position: 'relative', flex: '0 0 auto', height: 140, aspectRatio: '16/9', borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}>
                        <StorageImage url={shot.imageUrl} alt={shot.shotNumber} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', top: 4, left: 4, fontSize: '0.42rem', fontWeight: 700, color: projectColor, background: 'rgba(4,4,10,0.7)', borderRadius: 4, padding: '1px 5px' }}>{shot.shotNumber}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="font-mono" style={{ fontSize: '0.46rem', color: '#62627a' }}>No storyboard yet</div>
                )}
              </div>
            )}
            {/* Footer pill — centered along the bottom edge of the locked box */}
            <button
              type="button"
              onClick={() => router.push(`/projects/${projectId}/scenemaker?mode=${arcMode}`)}
              className="font-mono uppercase"
              style={{
                position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', zIndex: 2,
                fontSize: '0.46rem', letterSpacing: '0.10em',
                color: projectColor, background: 'transparent', border: 'none', cursor: 'pointer',
                padding: '4px 6px',
                whiteSpace: 'nowrap',
              }}
            >
              Open in One Arc · {arcMode === 'script' ? 'Script' : arcMode === 'shotlist' ? 'Shotlist' : 'Storyboard'} ›
            </button>
          </div>

          {/* Tone — full-width strip of multiple refs side-by-side (NOT a
              swipe panel). Tap any tile or the label → navigate to the
              moodboard page. Empty state collapses to a "Set the tone" CTA. */}
          <div style={{ marginTop: 12 }} {...clickableProps(() => router.push(`/projects/${projectId}/moodboard`))} aria-label="Open tone / moodboard">
            <ModuleHeader name="Tone" meta={allMoodRefs.length > 0 ? `${allMoodRefs.length} ref${allMoodRefs.length === 1 ? '' : 's'}` : undefined} />
            {allMoodRefs.length > 0 ? (
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
                {allMoodRefs.slice(0, 8).map((ref: any) => (
                  <div
                    key={ref.id}
                    style={{
                      flex: '0 0 auto',
                      width: 84,
                      height: 110,
                      borderRadius: 6,
                      overflow: 'hidden',
                      background: ref.gradient || '#0a0a12',
                      border: '1px solid rgba(255,255,255,0.06)',
                      position: 'relative',
                    }}
                  >
                    {ref.imageUrl && (
                      <StorageImage
                        url={ref.imageUrl}
                        alt={ref.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        placeholder={<div style={{ width: '100%', height: '100%', background: ref.gradient || '#0a0a12', opacity: 0.7 }} />}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-tile" style={{ height: 110, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: 0.45 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="4" width="20" height="16" rx="2" stroke="#62627a" strokeWidth="1.3" />
                  <circle cx="8" cy="10" r="2" stroke="#62627a" strokeWidth="1.2" />
                  <path d="M2 16l5-4 3 2 4-5 8 7" stroke="#62627a" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="font-mono" style={{ fontSize: '0.42rem', color: '#62627a', letterSpacing: '0.06em' }}>Set the tone</span>
              </div>
            )}
          </div>

          {/* LCA — Locations / Casting / Art each get a Tone-style external
              ModuleHeader above their (sacred) SwipePanel. Header shows count
              meta for at-a-glance status; the SwipePanel's inside colored
              label stays as the per-tile identifier chip. */}
          <div className="lca-row" style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <ModuleHeader name="Locations" meta={allLocations.length > 0 ? `${allLocations.length} loc${allLocations.length === 1 ? '' : 's'}` : undefined} />
              <SwipePanel
                items={allLocations}
                label="Locations"
                showLabel={false}
                labelColor="#e8a020"
                emptyIcon="📍"
                href={`/projects/${projectId}/locations`}
                renderItem={(loc: any) => (
                  <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                    <EntityAttachmentCoverPresentational
                      items={coversByLocationId.get(loc.id) ?? (EMPTY_ARRAY as unknown as EntityAttachmentRow[])}
                      size="100%"
                      alt={loc.name}
                    />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 6px', background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}>
                      <span style={{ fontSize: '0.38rem', fontWeight: 600, color: '#dddde8' }}>{loc.name}</span>
                    </div>
                  </div>
                )}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <ModuleHeader name="Casting" meta={allCast.length > 0 ? `${allCast.length} role${allCast.length === 1 ? '' : 's'}` : undefined} />
              <SwipePanel
                items={allCast.length > 0 ? [allCast] : []}
                label="Casting"
                showLabel={false}
                labelColor="#00b894"
                emptyIcon="🎭"
                href={`/projects/${projectId}/casting`}
                renderItem={(roles: any[]) => {
                const sorted = [...roles].sort((a, b) => Number(b.cast) - Number(a.cast))
                const visible = sorted.slice(0, 6)
                const remaining = sorted.length - visible.length
                return (
                  <div style={{ width: '100%', height: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, padding: '6px 8px 10px' }}>
                    {visible.map((role: any, i: number) => {
                      const t = role.talent
                      return (
                        <div key={role.id ?? i} style={{
                          position: 'relative', aspectRatio: '1 / 1', borderRadius: '50%',
                          overflow: 'hidden',
                          border: t ? '1px solid rgba(0,184,148,0.35)' : '1px dashed rgba(255,255,255,0.12)',
                          background: 'rgba(255,255,255,0.04)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {t?.imageUrl ? (
                            <StorageImage url={t.imageUrl} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span className="font-mono" style={{ fontSize: '0.42rem', fontWeight: 700, color: t ? '#00b894' : 'rgba(255,255,255,0.18)' }}>
                              {t?.initials ?? '?'}
                            </span>
                          )}
                          {i === 5 && remaining > 0 && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(4,4,10,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dddde8', fontSize: '0.46rem', fontWeight: 700 }}>
                              +{remaining}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <ModuleHeader name="Art" meta={allArt.length > 0 ? `${allArt.length} item${allArt.length === 1 ? '' : 's'}` : undefined} />
              <SwipePanel
                items={['wardrobe', 'props', 'hmu'] as const}
                label="Art"
                showLabel={false}
                labelColor="#6470f3"
                emptyIcon="🎨"
                href={`/projects/${projectId}/art`}
                renderItem={(cat: string) => {
                  const entityType = cat === 'props' ? 'prop' : cat
                  const catItems = allArt.filter(a => a.type === entityType)
                  const first = catItems[0]
                  const imgUrl = (first?.metadata as { imageUrl?: string } | null)?.imageUrl
                  const catLabel = cat === 'hmu' ? 'HMU' : cat === 'wardrobe' ? 'Wardrobe' : 'Props'
                  return (
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 6 }}>
                      {imgUrl ? (
                        <StorageImage url={imgUrl} alt={catLabel} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                      ) : (
                        <>
                          <span className="font-mono uppercase" style={{ fontSize: '0.38rem', color: '#6470f3', letterSpacing: '0.06em' }}>{catLabel}</span>
                          <span className="font-mono" style={{ fontSize: '0.30rem', color: '#62627a', marginTop: 2 }}>{catItems.length > 0 ? `${catItems.length} items` : 'Empty'}</span>
                        </>
                      )}
                    </div>
                  )
                }}
              />
            </div>
          </div>
</>}

{(!splitEnabled || mode === 'production') && <>
{/* 4. INVENTORY — featured department chips strip + View all */}
          <div style={{ padding: '0 2px' }}>
            <div
              className="cursor-pointer"
              onClick={() => router.push(`/projects/${projectId}/inventory`)}
            >
              <ModuleHeader
                name="Inventory"
                meta={
                  allInventory.length > 0
                    ? `${allInventory.length} items${inventoryNeeded > 0 ? ` · ${inventoryNeeded} needed` : ''}`
                    : 'No items yet'
                }
              />
            </div>
            <div className="inv-strip">
              {([
                { dept: 'Camera',
                  icon: <svg className="inv-chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8h3l1.5-2h5L16 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.2"/></svg> },
                { dept: 'Lighting',
                  icon: <svg className="inv-chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 1 4 10.4c-.6.5-1 1.2-1 2V16H9v-.6c0-.8-.4-1.5-1-2A6 6 0 0 1 12 3z"/></svg> },
                { dept: 'G&E',
                  icon: <svg className="inv-chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M13 3 5 13h6l-1 8 8-10h-6l1-8z"/></svg> },
                { dept: 'Sound',
                  icon: <svg className="inv-chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><line x1="12" y1="18" x2="12" y2="21"/></svg> },
                { dept: 'Art',
                  icon: <svg className="inv-chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/></svg> },
                { dept: 'Wardrobe',
                  icon: <svg className="inv-chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10c0-2 1-3 3-3h10c2 0 3 1 3 3v10"/><path d="M4 20h16"/><path d="M9 7V4h6v3"/></svg> },
                { dept: 'HMU',
                  icon: <svg className="inv-chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M8 14c-2 0-4 2-4 4v2h16v-2c0-2-2-4-4-4"/></svg> },
              ] as const).map(({ dept, icon }) => (
                <div
                  key={dept}
                  className="inv-chip"
                  role="button"
                  tabIndex={0}
                  aria-label={`${dept} inventory`}
                  onClick={() => { haptic('light'); router.push(`/projects/${projectId}/inventory`) }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      router.push(`/projects/${projectId}/inventory`)
                    }
                  }}
                >
                  {icon}
                  <span className="inv-chip-label">{dept}</span>
                </div>
              ))}
              <div
                className="inv-chip inv-chip-all"
                role="button"
                tabIndex={0}
                aria-label="View all inventory"
                onClick={() => { haptic('light'); router.push(`/projects/${projectId}/inventory`) }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    router.push(`/projects/${projectId}/inventory`)
                  }
                }}
              >
                <svg className="inv-chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>
                </svg>
                <span className="inv-chip-label">View all</span>
              </div>
            </div>
          </div>

          </>}

{(!splitEnabled || mode === 'production') && <>
{/* 5. WORKFLOW — V2: 5-node icon chain (wf-row/wf-node/wf-conn).
              Phase tinting alternates by index (pre/pre/prod/post/post) to
              match the gallery's 5 phase-tinted cells. */}
          <div className="cursor-pointer" style={{ padding: '0 2px' }} aria-label="Open workflow" {...clickableProps(() => router.push(`/projects/${projectId}/workflow`))}>
            <ModuleHeader name="Workflow" meta={`${allWorkflow.length} nodes`} />
            {allWorkflow.length > 0 ? (
              <div className="wf-row">
                {allWorkflow.slice(0, 5).map((node, i, arr) => {
                  // Deterministic phase tinting by index — gallery cycle:
                  // pre (0,1) → prod (2) → post (3,4).
                  const phaseClass = i < 2 ? 'wf-pre' : i === 2 ? 'wf-prod' : 'wf-post'
                  return (
                    <Fragment key={node.id}>
                      <div className={`wf-node ${phaseClass}`}>
                        <span className="wf-node-icon" aria-hidden="true" style={{ fontSize: 14, lineHeight: '18px' }}>{WF_ICONS[node.type] ?? '⚙'}</span>
                        <span className="wf-node-label">{node.label}</span>
                      </div>
                      {i < arr.length - 1 && <div className="wf-conn" aria-hidden="true" />}
                    </Fragment>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-3">
                <div className="flex items-center gap-2">
                  {[0,1,2,3,4].map(i => <div key={i} className="flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: 8, border: `1.5px dashed rgba(${pr},${pg},${pb},0.18)` }}><div className="rounded-full" style={{ width: 4, height: 4, background: 'rgba(255,255,255,0.18)' }} /></div>)}
                </div>
                <span className="font-mono" style={{ fontSize: 9, color: 'var(--fg-mono)' }}>No workflow yet</span>
              </div>
            )}
          </div>
          </>}

{splitEnabled && mode === 'production' && isProducer && <>
          {/* 6. BUDGET — full-width row at the bottom of Production surface
                 (split mode only). Producer-only via existing useViewerRole
                 gate. Lifts the same dial / version pill / variance chrome
                 from Section 1's Budget tile but laid out as a full-width row
                 instead of a 1fr peer of Timeline. */}
          <div
            className="cursor-pointer"
            onClick={() => { haptic('light'); router.push(`/projects/${projectId}/budget`) }}
          >
            <ModuleHeader name="Budget" />
            {budgetPreview && budgetPreview.workingTotal > 0 ? (() => {
              const pct = Math.min(100, Math.round((budgetPreview.actuals / budgetPreview.workingTotal) * 100))
              const CIRC = 163.36
              const dashOffset = CIRC * (1 - pct / 100)
              const fmt = (n: number) => n >= 1000
                ? `$${Math.round(n / 1000)}K`
                : `$${Math.round(n).toLocaleString('en-US')}`
              return (
                <div
                  className="glass-tile bgt-card"
                  style={{
                    position: 'relative', height: 130,
                    display: 'flex', flexDirection: 'row', alignItems: 'center',
                    gap: 16, padding: '10px 18px',
                    boxSizing: 'border-box',
                  }}
                >
                  <span className="bgt-version-pill">{budgetPreview.versionLabel || 'Working'}</span>
                  <div className="bgt-dial" style={{ flexShrink: 0 }}>
                    <svg viewBox="0 0 64 64" fill="none">
                      <circle className="bgt-dial-bg" cx="32" cy="32" r="26" strokeWidth="3" />
                      <circle className="bgt-dial-fg" cx="32" cy="32" r="26" strokeWidth="3" strokeDasharray={CIRC} strokeDashoffset={dashOffset} />
                    </svg>
                    <span className="bgt-dial-pct">{pct}%</span>
                  </div>
                  <div className="bgt-meta" style={{ flex: 1, alignItems: 'flex-start' }}>
                    <span className="bgt-meta-spent">{fmt(budgetPreview.actuals)}</span>
                    <span className="bgt-meta-sep">/</span>
                    <span className="bgt-meta-total">{fmt(budgetPreview.workingTotal)}</span>
                  </div>
                  {budgetPreview.overCount > 0 && (
                    <span
                      className="font-mono uppercase"
                      style={{
                        fontSize: '0.40rem', letterSpacing: '0.08em',
                        padding: '3px 8px', borderRadius: 999,
                        background: 'rgba(232,86,74,0.10)',
                        border: '1px solid rgba(232,86,74,0.30)',
                        color: '#e8564a',
                        flexShrink: 0,
                      }}
                    >
                      ⚠ {budgetPreview.overCount} over
                    </span>
                  )}
                </div>
              )
            })() : (
              <div
                className="glass-tile bgt-card"
                style={{
                  position: 'relative', height: 100,
                  display: 'flex', flexDirection: 'row', alignItems: 'center',
                  justifyContent: 'center', gap: 12, padding: '10px 18px',
                  boxSizing: 'border-box',
                }}
              >
                <span className="bgt-version-pill bgt-version-pill-empty">—</span>
                <div className="bgt-dial" style={{ flexShrink: 0, opacity: 0.4 }}>
                  <svg viewBox="0 0 64 64" fill="none">
                    <circle className="bgt-dial-bg" cx="32" cy="32" r="26" strokeWidth="3" />
                  </svg>
                  <span className="bgt-dial-pct">—</span>
                </div>
                <span className="font-mono uppercase" style={{ fontSize: '0.46rem', letterSpacing: '0.10em', color: 'var(--fg-mono)' }}>
                  Set up budget →
                </span>
              </div>
            )}
          </div>
</>}

        </div>
      </div>

      {/* FAB cluster (back / chat / + / threads + branch fan) lifted to the
          global ActionBar in PR 2a. + behavior registered above via
          useFabAction. */}

      {/* ══ SHEETS ══ */}
      <Sheet open={!!selectedAI} onClose={() => setSelectedAI(null)}><AIDetailSheet item={selectedAI} crew={allCrew} onClose={() => setSelectedAI(null)} /></Sheet>
      <Sheet open={!!selectedMS} onClose={() => setSelectedMS(null)}><MSDetailSheet milestone={selectedMS} crew={allCrew} onClose={() => setSelectedMS(null)} /></Sheet>
      <Sheet open={!!selectedCrew} onClose={() => setSelectedCrew(null)}><CrewDetailSheet member={selectedCrew} projectId={projectId} onClose={() => setSelectedCrew(null)} /></Sheet>

      {/* ══ CREATION SHEETS ══ */}
      <CreateTaskSheet
        open={showCreateTask}
        projectId={projectId}
        accent={projectColor}
        crew={allCrew}
        onSave={(data) => { createTask.mutate(data as any); setShowCreateTask(false) }}
        onClose={() => setShowCreateTask(false)}
      />
      <CreateMilestoneSheet
        open={showCreateMilestone}
        projectId={projectId}
        accent={projectColor}
        onSave={(data) => { createMilestone.mutate(data as any); setShowCreateMilestone(false) }}
        onClose={() => setShowCreateMilestone(false)}
      />
      <CreateCreativeSheet
        open={showCreateCreative}
        projectId={projectId}
        accent={projectColor}
        onSelectScene={() => router.push(`/projects/${projectId}/scenemaker`)}
        onSelectShot={() => router.push(`/projects/${projectId}/scenemaker`)}
        onSelectTone={() => router.push(`/projects/${projectId}/moodboard`)}
        onClose={() => setShowCreateCreative(false)}
      />
      {/* InviteCrewSheet — triggered by the Crew FAB branch in split + production mode */}
      <InviteCrewSheet
        projectId={projectId}
        open={showInviteCrew}
        onClose={() => setShowInviteCrew(false)}
      />

      {/* ══ CREW PANEL ══ */}
      <CrewPanel open={crewPanelOpen} projectId={projectId} accent={projectColor} onClose={() => setCrewPanelOpen(false)} />
    </div>
  )
}
