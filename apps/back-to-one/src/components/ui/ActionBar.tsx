'use client'

import { useState } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useProject } from '@/lib/hooks/useOriginOne'
import { useFabActionState } from '@/lib/contexts/FabActionContext'
import { haptic } from '@/lib/utils/haptics'
import { getProjectColor } from '@/lib/utils/phase'
import { deriveProjectColors, DEFAULT_PROJECT_HEX } from '@origin-one/ui'

// ── Visual tokens (locked to reference HTML) ─────────────
//
// All buttons share one glass style. Sizes: + 52, satellites/back/resources
// 36. Cluster gap 10. Bar bottom inset 18. Z-index 65 (above SubPageOverlay
// at 50, above all current detail sheets which span 43-61).
//
// PR 2a: ActionBar is fixed at z65 even when a detail sheet is open. + stays
// visible (registers to the underlying page's action). Sheet-aware behavior
// lands in PR 2b.

const Z_INDEX = 65
const BAR_BOTTOM_INSET = 18
const SIZE_PRIMARY = 52
const SIZE_SATELLITE = 36
const CLUSTER_GAP = 10

const GLASS_BG = 'rgba(8,8,14,0.6)'
const GLASS_BORDER = 'rgba(255,255,255,0.14)'
const ICON_COLOR = 'rgba(255,255,255,0.9)'

// ── Icons (verbatim from reference HTML actionbar-states.html) ───

function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}
function ChatIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
function ThreadsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  )
}
function ResourcesIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}

// ── Button primitive ─────────────────────────────────────

function ActionBarButton({
  size, onClick, ariaLabel, children, style,
}: {
  size: typeof SIZE_PRIMARY | typeof SIZE_SATELLITE
  onClick: () => void
  ariaLabel: string
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex items-center justify-center cursor-pointer active:scale-[0.94] transition-transform"
      style={{
        width: size, height: size, borderRadius: '50%',
        background: GLASS_BG,
        border: `0.5px solid ${GLASS_BORDER}`,
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        color: ICON_COLOR,
        boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        padding: 0,
        ...style,
      }}
    >
      {children}
    </button>
  )
}

// ── ActionBar ────────────────────────────────────────────

export function ActionBar() {
  const params = useParams<{ projectId: string }>()
  const projectId = params?.projectId ?? ''
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const { action } = useFabActionState()
  const [fabOpen, setFabOpen] = useState(false)

  // Hub vs subpage detection. Hub is at /projects/<id> (2 segments). Three
  // or more segments means a subpage is mounted inside SubPageOverlay.
  const segments = pathname.split('/').filter(Boolean)
  const isHub = segments.length <= 2

  // Project accent — derived once here (replaces 10 duplicate derivations
  // across the previous per-page FAB consumers).
  const { data: project } = useProject(projectId)
  const colors = deriveProjectColors(
    project?.color || getProjectColor(projectId) || DEFAULT_PROJECT_HEX,
  )
  const accent = colors.primary

  const hasOnPress = !!action?.onPress
  const hasBranches = !!action?.branches && action.branches.length > 0
  const plusVisible = hasOnPress || hasBranches

  function handleBack() {
    haptic('light')
    if (fabOpen) { setFabOpen(false); return }
    if (isHub) router.push('/projects')
    else router.back()
  }
  function handleChat() {
    haptic('light')
    setFabOpen(false)
    if (projectId) router.push(`/projects/${projectId}/chat`)
  }
  function handleThreads() {
    haptic('light')
    setFabOpen(false)
    if (projectId) router.push(`/projects/${projectId}/threads`)
  }
  function handleResources() {
    haptic('light')
    setFabOpen(false)
    if (projectId) router.push(`/projects/${projectId}/resources`)
  }
  function handlePlus() {
    haptic('light')
    if (hasBranches) {
      setFabOpen(o => !o)
    } else if (action?.onPress) {
      action.onPress()
    }
  }

  return (
    <>
      {/* Branch-fan dim overlay — only when a 3-branch fan is open */}
      <AnimatePresence>
        {fabOpen && hasBranches && (
          <motion.div
            key="ab-fab-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={() => setFabOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: Z_INDEX - 1,
              background: 'rgba(4,4,10,0.62)',
              backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
            }}
          />
        )}
      </AnimatePresence>

      {/* Branch-fan SVG dashed lines + buttons (Hub-style triangle fan) */}
      <AnimatePresence>
        {fabOpen && hasBranches && action?.branches && (
          <BranchFan
            branches={action.branches}
            accent={accent}
            onSelect={(b) => { setFabOpen(false); b.action() }}
          />
        )}
      </AnimatePresence>

      {/* The bar itself — fixed at bottom, full-width */}
      <div
        className="pointer-events-none"
        style={{
          position: 'fixed',
          left: 0, right: 0,
          bottom: `calc(${BAR_BOTTOM_INSET}px + env(safe-area-inset-bottom, 0px))`,
          height: SIZE_PRIMARY,
          zIndex: Z_INDEX,
        }}
      >
        {/* Back — left */}
        <div className="pointer-events-auto" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }}>
          <ActionBarButton size={SIZE_SATELLITE} onClick={handleBack} ariaLabel="Back">
            <BackIcon />
          </ActionBarButton>
        </div>

        {/* Cluster — chat / + / threads, centered */}
        <div
          className="pointer-events-auto"
          style={{
            position: 'absolute',
            left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex', alignItems: 'center', gap: CLUSTER_GAP,
          }}
        >
          <ActionBarButton size={SIZE_SATELLITE} onClick={handleChat} ariaLabel="Chat">
            <ChatIcon />
          </ActionBarButton>

          {/* + slot — visibility:hidden placeholder when no action registered.
              Cluster width stays uniform across states. */}
          {plusVisible ? (
            <motion.div
              animate={{ rotate: fabOpen ? 45 : 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 280 }}
            >
              <ActionBarButton
                size={SIZE_PRIMARY}
                onClick={handlePlus}
                ariaLabel={action?.label ?? 'Create'}
                style={{
                  background: `${accent}26`,
                  border: `1.5px solid ${accent}73`,
                  boxShadow: `0 4px 24px ${accent}40, 0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)`,
                }}
              >
                <PlusIcon />
              </ActionBarButton>
            </motion.div>
          ) : (
            <div
              aria-hidden="true"
              style={{ width: SIZE_PRIMARY, height: SIZE_PRIMARY, visibility: 'hidden' }}
            />
          )}

          <ActionBarButton size={SIZE_SATELLITE} onClick={handleThreads} ariaLabel="Threads">
            <ThreadsIcon />
          </ActionBarButton>
        </div>

        {/* Resources — right */}
        <div className="pointer-events-auto" style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)' }}>
          <ActionBarButton size={SIZE_SATELLITE} onClick={handleResources} ariaLabel="Resources">
            <ResourcesIcon />
          </ActionBarButton>
        </div>
      </div>
    </>
  )
}

// ── Branch fan ───────────────────────────────────────────
//
// Mirrors the canonical implementation from HubContent.tsx (the only surface
// that uses 3-branch +). Triangle layout: left-low, center-high, right-low.
// SVG dashed branch lines fan from FAB center to each button.

function BranchFan({
  branches, accent, onSelect,
}: {
  branches: import('@/lib/contexts/FabActionContext').FabBranch[]
  accent: string
  onSelect: (b: import('@/lib/contexts/FabActionContext').FabBranch) => void
}) {
  const ar = parseInt(accent.slice(1, 3), 16)
  const ag = parseInt(accent.slice(3, 5), 16)
  const ab = parseInt(accent.slice(5, 7), 16)

  // Per-branches-length geometry. Each `positions` row is the button's
  // CSS top/bottom anchor (button is 48×48, so its visible center sits at
  // left+24, bottom+24 from the cluster anchor). lineEndpoints are SVG
  // viewBox coordinates (220×110, origin at top-left, line origin at
  // 110/98 — the FAB center).
  //
  //   1 branch  → centered directly above the + (no asymmetry to fix).
  //   2 branches → symmetric left/right at equal angle.
  //   3 branches → Hub's existing triangle (left-low, center-high,
  //                right-low). Preserved verbatim — Hub renders correctly
  //                today and any geometry change there would be a
  //                regression.
  //
  // Bug pre-this-change: `positions` was a 3-element array used for every
  // length, so a 2-branch fan picked rows 0+1 — left-low + center-high —
  // visibly asymmetric. Reported on Scenemaker shotlist mode.
  type Position = { left: number; bottom: number }
  type Endpoint = { x: number; y: number }

  const POS_1: Position[] = [
    { left: -24, bottom: 46 },
  ]
  const LINE_1: Endpoint[] = [
    { x: 110, y: 28 },
  ]

  const POS_2: Position[] = [
    { left: -74, bottom: 31 },
    { left:  26, bottom: 31 },
  ]
  const LINE_2: Endpoint[] = [
    { x: 60,  y: 43 },
    { x: 160, y: 43 },
  ]

  const POS_3: Position[] = [
    { left: -90, bottom: 26 },
    { left: -22, bottom: 90 },
    { left:  46, bottom: 26 },
  ]
  const LINE_3: Endpoint[] = [
    { x: 22,  y: 46 },
    { x: 110, y: 8  },
    { x: 198, y: 46 },
  ]

  const positions: Position[] =
    branches.length === 1 ? POS_1 :
    branches.length === 2 ? POS_2 :
    POS_3

  const lineEndpoints: Endpoint[] =
    branches.length === 1 ? LINE_1 :
    branches.length === 2 ? LINE_2 :
    LINE_3

  return (
    <>
      {/* SVG dashed branch lines */}
      <motion.svg
        key="ab-branch-svg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        style={{
          position: 'fixed',
          bottom: `calc(${BAR_BOTTOM_INSET + 28}px + env(safe-area-inset-bottom, 0px))`,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: Z_INDEX,
          pointerEvents: 'none',
          overflow: 'visible',
        }}
        width="220" height="110" viewBox="0 0 220 110"
      >
        {branches.slice(0, positions.length).map((_, i) => (
          <line
            key={i}
            x1={110} y1={98}
            x2={lineEndpoints[i].x} y2={lineEndpoints[i].y}
            stroke={`rgba(${ar},${ag},${ab},0.2)`}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        ))}
        <circle cx={110} cy={98} r={3} fill={`rgba(${ar},${ag},${ab},0.35)`} />
      </motion.svg>

      {/* Branch buttons */}
      <div
        className="pointer-events-auto"
        style={{
          position: 'fixed',
          bottom: `calc(${BAR_BOTTOM_INSET + 28}px + env(safe-area-inset-bottom, 0px))`,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0, height: 0,
          zIndex: Z_INDEX,
        }}
      >
        {branches.slice(0, positions.length).map((b, i) => {
          const pos = positions[i]
          // 3-branch only: the center (index 1) pops slightly later and
          // from a larger y offset than the outers, mirroring Hub. With
          // 1 or 2 branches there is no "center" — animation is uniform.
          const isCenterBranch = branches.length === 3 && i === 1
          const delay = isCenterBranch ? 0.05 : 0
          const yOffset = isCenterBranch ? 30 : 20
          return (
            <motion.button
              key={b.label}
              initial={{ opacity: 0, y: yOffset }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: yOffset }}
              transition={{ type: 'spring', damping: 20, stiffness: 280, delay }}
              onClick={() => onSelect(b)}
              style={{
                position: 'absolute', bottom: pos.bottom, left: pos.left,
                background: 'transparent', border: 'none', padding: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: `${b.color}1a`, border: `1px solid ${b.color}4d`,
                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {b.icon}
              </div>
              <span
                className="font-mono uppercase whitespace-nowrap"
                style={{ fontSize: '0.38rem', letterSpacing: '0.06em', color: b.color }}
              >
                {b.label}
              </span>
            </motion.button>
          )
        })}
      </div>
    </>
  )
}
