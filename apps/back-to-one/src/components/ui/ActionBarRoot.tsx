'use client'

// Projects-root variant of the ActionBar. Mounts only on root-level routes
// (/projects and /projects/threads) via projects/layout.tsx. Visual tokens
// match the project-scoped ActionBar exactly — strong glass + accent glow +
// drop shadow — so the two surfaces read as one bar across navigation.
//
// Slot map: [— / chat / + / Threads / Resources]
//   back      hidden — root has nowhere to go back to (left:16 stays empty)
//   chat      toggles the cross-project ChatSheet (channel + DM aggregate)
//             via RootFabContext.chatOpen
//   +         toggles the 5-arc fan in projects/page.tsx via
//             RootFabContext.fanOpen
//   threads   on /projects: toggles the cross-project ThreadsSheet via
//             RootFabContext.threadsOpen
//             on /projects/threads (direct URL): keeps router.back-style
//             toggle-to-close behavior
//   resources toggles the cross-project ResourcesSheet via
//             RootFabContext.resourcesOpen. Producer role gate lands with
//             Auth — pre-Auth the slot is visible to everyone.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/utils/haptics'
import { useKeyboardOpen } from '@/lib/hooks/useKeyboardOpen'
import type { PanelDetail } from '@/components/projects/PanelDetailSheet'

// ── RootFabContext (split into three sub-contexts) ────────
//
// Co-located with ActionBarRoot because (a) it's the only consumer outside
// the projects-root page, (b) Next.js layout files can only export a default
// + a small set of metadata fields, so the hook can't live in layout.tsx
// itself, and (c) introducing a new top-level contexts/ module is overkill.
//
// The state is split into three independent sub-contexts so consumers
// reading just one slice (Fan, Overlay, or Folder) only re-render when
// their slice changes. The legacy `useRootFab()` hook is preserved as a
// thin aggregator over the three sub-contexts; consumers that use the
// flat shape still work but, like before, re-render on any change.

interface FanContextValue {
  fanOpen: boolean
  toggleFan: () => void
  closeFan: () => void
}

interface OverlayContextValue {
  threadsOpen: boolean
  toggleThreads: () => void
  closeThreads: () => void
  chatOpen: boolean
  toggleChat: () => void
  closeChat: () => void
  resourcesOpen: boolean
  toggleResources: () => void
  closeResources: () => void
}

interface FolderContextValue {
  // Panel item detail (slide-up over a fan-arc panel). Lifted from
  // GlobalPanels to the bar-context so the back button can pop it.
  panelDetail: PanelDetail | null
  setPanelDetail: (d: PanelDetail | null) => void
  closePanelDetail: () => void
  openFolderId: string | null
  setOpenFolderId: (id: string | null) => void
  closeOpenFolder: () => void
}

interface RootFabContextValue extends FanContextValue, OverlayContextValue, FolderContextValue {}

const FanContext = createContext<FanContextValue | null>(null)
const OverlayContext = createContext<OverlayContextValue | null>(null)
const FolderContext = createContext<FolderContextValue | null>(null)

const FAN_DEFAULT: FanContextValue = {
  fanOpen: false, toggleFan: () => {}, closeFan: () => {},
}
const OVERLAY_DEFAULT: OverlayContextValue = {
  threadsOpen: false, toggleThreads: () => {}, closeThreads: () => {},
  chatOpen: false, toggleChat: () => {}, closeChat: () => {},
  resourcesOpen: false, toggleResources: () => {}, closeResources: () => {},
}
const FOLDER_DEFAULT: FolderContextValue = {
  panelDetail: null, setPanelDetail: () => {}, closePanelDetail: () => {},
  openFolderId: null, setOpenFolderId: () => {}, closeOpenFolder: () => {},
}

/**
 * Wrap projects-root children. Owns the fan-open boolean shared between
 * ActionBarRoot's + button and projects/page.tsx's 5-arc fan render, plus
 * the threads, chat, and resources sheet booleans shared with the
 * corresponding sheet components rendered on projects/page.tsx.
 */
export function RootFabProvider({ children }: { children: ReactNode }) {
  const [fanOpen, setFanOpen] = useState(false)
  const [threadsOpen, setThreadsOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [resourcesOpen, setResourcesOpen] = useState(false)
  const [panelDetail, setPanelDetailState] = useState<PanelDetail | null>(null)
  const [openFolderId, setOpenFolderIdState] = useState<string | null>(null)
  const toggleFan = useCallback(() => setFanOpen(o => !o), [])
  const closeFan = useCallback(() => setFanOpen(false), [])
  const toggleThreads = useCallback(() => setThreadsOpen(o => !o), [])
  const closeThreads = useCallback(() => setThreadsOpen(false), [])
  const toggleChat = useCallback(() => setChatOpen(o => !o), [])
  const closeChat = useCallback(() => setChatOpen(false), [])
  const toggleResources = useCallback(() => setResourcesOpen(o => !o), [])
  const closeResources = useCallback(() => setResourcesOpen(false), [])
  const setPanelDetail = useCallback((d: PanelDetail | null) => setPanelDetailState(d), [])
  const closePanelDetail = useCallback(() => setPanelDetailState(null), [])
  const setOpenFolderId = useCallback((id: string | null) => setOpenFolderIdState(id), [])
  const closeOpenFolder = useCallback(() => setOpenFolderIdState(null), [])

  // Lock the document body's scroll while any overlay is open. iOS Safari
  // standalone PWA treats the document as the primary scroller and
  // overscroll-behavior on inner elements isn't sufficient to stop the
  // background from rubber-banding underneath. The position-fixed-with-
  // saved-scrollY trick is the standard iOS-safe body-lock; restoring
  // window.scrollTo on close avoids any visible jump.
  useEffect(() => {
    const anyOpen = !!(fanOpen || threadsOpen || chatOpen || resourcesOpen || panelDetail || openFolderId)
    if (!anyOpen) return
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
  }, [fanOpen, threadsOpen, chatOpen, resourcesOpen, panelDetail, openFolderId])

  // Each sub-value memoizes on its own state slice — when the fan toggles,
  // overlayValue / folderValue keep referential equality and consumers
  // subscribed to those contexts skip the re-render.
  const fanValue = useMemo<FanContextValue>(
    () => ({ fanOpen, toggleFan, closeFan }),
    [fanOpen, toggleFan, closeFan],
  )
  const overlayValue = useMemo<OverlayContextValue>(
    () => ({
      threadsOpen, toggleThreads, closeThreads,
      chatOpen, toggleChat, closeChat,
      resourcesOpen, toggleResources, closeResources,
    }),
    [
      threadsOpen, toggleThreads, closeThreads,
      chatOpen, toggleChat, closeChat,
      resourcesOpen, toggleResources, closeResources,
    ],
  )
  const folderValue = useMemo<FolderContextValue>(
    () => ({
      panelDetail, setPanelDetail, closePanelDetail,
      openFolderId, setOpenFolderId, closeOpenFolder,
    }),
    [
      panelDetail, setPanelDetail, closePanelDetail,
      openFolderId, setOpenFolderId, closeOpenFolder,
    ],
  )

  return (
    <FanContext.Provider value={fanValue}>
      <OverlayContext.Provider value={overlayValue}>
        <FolderContext.Provider value={folderValue}>
          {children}
        </FolderContext.Provider>
      </OverlayContext.Provider>
    </FanContext.Provider>
  )
}

/**
 * Read just the fan-open state slice. Use this on consumers that only
 * touch fanOpen / toggleFan / closeFan — re-renders only when the fan
 * itself opens or closes.
 */
export function useFan(): FanContextValue {
  return useContext(FanContext) ?? FAN_DEFAULT
}

/**
 * Read the overlay sheets state slice (threads / chat / resources).
 * Re-renders only when one of those sheets toggles.
 */
export function useOverlay(): OverlayContextValue {
  return useContext(OverlayContext) ?? OVERLAY_DEFAULT
}

/**
 * Read the folder / panel-detail state slice. Re-renders only when an
 * open folder or panel detail changes.
 */
export function useFolder(): FolderContextValue {
  return useContext(FolderContext) ?? FOLDER_DEFAULT
}

/**
 * Read the projects-root fan state. Returns inert defaults if called
 * outside the provider — defensive only; the layout always wraps.
 *
 * Backwards-compatible aggregator over the three sub-contexts. Consumers
 * that use the flat shape still work; like before they re-render on any
 * underlying state change. New code should prefer the narrower hooks
 * (`useFan`, `useOverlay`, `useFolder`) when only one slice is needed.
 */
export function useRootFab(): RootFabContextValue {
  const fan = useFan()
  const overlay = useOverlay()
  const folder = useFolder()
  return { ...fan, ...overlay, ...folder }
}

const Z_INDEX = 65
const BAR_BOTTOM_INSET = 18
const SIZE_PRIMARY = 52
const SIZE_SATELLITE = 36
const CLUSTER_GAP = 10

// Brand indigo. No project context exists at root, so the bar uses the
// brand neutral as its accent across all visible slots.
const ACCENT = '#6470f3'

type ButtonVariant = 'satellite' | 'primary' | 'active'

function buttonStyle(variant: ButtonVariant, accent: string): React.CSSProperties {
  const base: React.CSSProperties = {
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  }
  if (variant === 'primary') {
    return {
      ...base,
      background: 'rgba(8,8,14,0.85)',
      border: `0.5px solid ${accent}b3`,
      color: 'rgba(255,255,255,1)',
      boxShadow: `0 6px 24px rgba(0,0,0,0.45), 0 0 22px ${accent}66`,
    }
  }
  if (variant === 'active') {
    return {
      ...base,
      background: `${accent}38`,
      border: `0.5px solid ${accent}d9`,
      color: 'rgba(255,255,255,1)',
      boxShadow: `0 4px 18px rgba(0,0,0,0.4), 0 0 22px ${accent}8c`,
    }
  }
  return {
    ...base,
    background: 'rgba(8,8,14,0.85)',
    border: `0.5px solid ${accent}45`,
    color: 'rgba(255,255,255,0.95)',
    boxShadow: `0 4px 18px rgba(0,0,0,0.4), 0 0 14px ${accent}38`,
  }
}

// Icons mirror ActionBar.tsx's verbatim — same paths, same stroke widths,
// same viewBoxes — so chat/threads/resources read identical across the two
// bars.

function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function ThreadsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  )
}

function ResourcesIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}

function ActionBarButton({
  size, variant, accent, onClick, ariaLabel, children,
}: {
  size: typeof SIZE_PRIMARY | typeof SIZE_SATELLITE
  variant: ButtonVariant
  accent: string
  onClick: () => void
  ariaLabel: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex items-center justify-center cursor-pointer active:scale-[0.94] transition-transform"
      style={{
        width: size, height: size, borderRadius: '50%',
        padding: 0,
        ...buttonStyle(variant, accent),
      }}
    >
      {children}
    </button>
  )
}

export function ActionBarRoot() {
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const {
    fanOpen, toggleFan, closeFan,
    threadsOpen, toggleThreads, closeThreads,
    chatOpen, toggleChat, closeChat,
    resourcesOpen, toggleResources, closeResources,
    panelDetail, closePanelDetail,
    openFolderId, closeOpenFolder,
  } = useRootFab()

  const accent = ACCENT
  const onThreadsRoute = pathname === '/projects/threads'
  const threadsActive = onThreadsRoute || threadsOpen
  const keyboardOpen = useKeyboardOpen()

  // Anything that, when present, the back button can pop. Order is the
  // close priority — top of the stack first.
  const hasOpenLayer = !!panelDetail || !!openFolderId || fanOpen || threadsOpen || chatOpen || resourcesOpen

  function handlePlus() {
    haptic('medium')
    closeThreads()
    closeChat()
    closeResources()
    closePanelDetail()
    closeOpenFolder()
    toggleFan()
  }

  function handleThreads() {
    haptic('light')
    closeFan()
    closeChat()
    closeResources()
    closePanelDetail()
    closeOpenFolder()
    // Direct URL access of /projects/threads keeps its back-nav toggle.
    // From /projects (the project-selection page), the bar toggles a
    // slide-up sheet rendered by projects/page.tsx instead of navigating.
    if (onThreadsRoute) {
      if (typeof window !== 'undefined' && window.history.length > 1) router.back()
      else router.push('/projects')
    } else {
      toggleThreads()
    }
  }

  function handleChat() {
    haptic('light')
    closeFan()
    closeThreads()
    closeResources()
    closePanelDetail()
    closeOpenFolder()
    toggleChat()
  }

  function handleResources() {
    haptic('light')
    closeFan()
    closeThreads()
    closeChat()
    closePanelDetail()
    closeOpenFolder()
    toggleResources()
  }

  // Layered pop. /projects has nowhere to navigate "back" to in the route
  // sense, so back acts on UI state in priority order:
  //   panel detail → open folder → fan-arc panel → side sheet → fan
  // When nothing is expanded the tap is intentionally a no-op (matches the
  // bar's project-scoped Back, which router.back()s into Hub fallback only
  // when there's history to pop).
  function handleBack() {
    if (!hasOpenLayer) return
    haptic('light')
    if (panelDetail) { closePanelDetail(); return }
    if (openFolderId) { closeOpenFolder(); return }
    // The fan is what owns the "active panel" inside it (cleared via
    // projects/page.tsx's effect when fan closes), so closing the fan also
    // closes any panel rendered through it.
    if (fanOpen) { closeFan(); return }
    if (threadsOpen) { closeThreads(); return }
    if (chatOpen) { closeChat(); return }
    if (resourcesOpen) { closeResources(); return }
  }

  return (
    <div
      className="pointer-events-none"
      style={{
        position: 'fixed',
        left: 0, right: 0,
        bottom: `calc(${BAR_BOTTOM_INSET}px + env(safe-area-inset-bottom, 0px))`,
        height: SIZE_PRIMARY,
        zIndex: Z_INDEX,
        opacity: keyboardOpen ? 0 : 1,
        visibility: keyboardOpen ? 'hidden' : 'visible',
        transition: 'opacity 0.2s ease, visibility 0.2s ease',
      }}
    >
      {/* Back — left edge. Fades in only when there is something to pop
          (panel detail, fan-arc panel, side sheet, or fan). When nothing
          is expanded, the slot becomes inert (pointer-events: none) so a
          tap on the empty corner doesn't accidentally trigger anything. */}
      <AnimatePresence>
        {hasOpenLayer && (
          <motion.div
            key="root-back"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
            className="pointer-events-auto"
            style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }}
          >
            <ActionBarButton
              size={SIZE_SATELLITE}
              variant="satellite"
              accent={accent}
              onClick={handleBack}
              ariaLabel="Back"
            >
              <BackIcon />
            </ActionBarButton>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cluster — [chat / + / threads], centered. Chat opens a slide-up
          sheet showing the user's chat conversations across all projects;
          + toggles the 5-arc fan; threads opens the cross-project threads
          sheet. All three render at full opacity. */}
      <div
        className="pointer-events-auto"
        style={{
          position: 'absolute',
          left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex', alignItems: 'center', gap: CLUSTER_GAP,
        }}
      >
        <ActionBarButton
          size={SIZE_SATELLITE}
          variant={chatOpen ? 'active' : 'satellite'}
          accent={accent}
          onClick={handleChat}
          ariaLabel={chatOpen ? 'Close chat' : 'Chat'}
        >
          <ChatIcon />
        </ActionBarButton>

        <motion.div
          animate={{ rotate: fanOpen ? 45 : 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 280 }}
        >
          <ActionBarButton
            size={SIZE_PRIMARY}
            variant="primary"
            accent={accent}
            onClick={handlePlus}
            ariaLabel={fanOpen ? 'Close menu' : 'Open menu'}
          >
            <PlusIcon />
          </ActionBarButton>
        </motion.div>

        <ActionBarButton
          size={SIZE_SATELLITE}
          variant={threadsActive ? 'active' : 'satellite'}
          accent={accent}
          onClick={handleThreads}
          ariaLabel={threadsActive ? 'Close threads' : 'Threads'}
        >
          <ThreadsIcon />
        </ActionBarButton>
      </div>

      {/* Resources — right edge. Toggles the cross-project ResourcesSheet
          on /projects (mounted by projects/page.tsx). Mirrors the project-
          scoped ActionBar's resources-at-right placement so the two bars
          read identical across navigation. Role-gated visibility (producer-
          only) lands on Auth day. */}
      <div
        className="pointer-events-auto"
        style={{
          position: 'absolute',
          right: 16, top: '50%',
          transform: 'translateY(-50%)',
        }}
      >
        <ActionBarButton
          size={SIZE_SATELLITE}
          variant={resourcesOpen ? 'active' : 'satellite'}
          accent={accent}
          onClick={handleResources}
          ariaLabel={resourcesOpen ? 'Close resources' : 'Resources'}
        >
          <ResourcesIcon />
        </ActionBarButton>
      </div>
    </div>
  )
}
