'use client'

// Projects-root variant of the ActionBar. Mounts only on root-level routes
// (/projects and /projects/threads) via projects/layout.tsx. Visual tokens
// match the project-scoped ActionBar exactly — strong glass + accent glow +
// drop shadow — so the two surfaces read as one bar across navigation.
//
// Slot map: [— / chat / + / Threads / Resources]
//   back      hidden — root has nowhere to go back to (left:16 stays empty)
//   chat      visible — reduced opacity, no-op handler. Company-level chat
//             is gated on Auth; the slot is here for visual symmetry with
//             the project-scoped bar so the cluster reads identical across
//             navigation
//   +         visible — toggles the 5-arc fan in projects/page.tsx via
//             RootFabContext
//   threads   visible — routes to /projects/threads; toggle-to-close while
//             on the route. Active state (accent fill + intensified glow)
//             when pathname matches
//   resources visible — reduced opacity, no-op handler. Company-level
//             resources is V2 schema work (nullable projectId on Resource +
//             Folder + Storage bucket). Slot is here for visual symmetry

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { haptic } from '@/lib/utils/haptics'

// ── RootFabContext ────────────────────────────────────────
//
// Co-located with ActionBarRoot because (a) it's the only consumer outside
// the projects-root page, (b) Next.js layout files can only export a default
// + a small set of metadata fields, so the hook can't live in layout.tsx
// itself, and (c) introducing a new top-level contexts/ module is overkill
// for a single shared boolean.

interface RootFabContextValue {
  fanOpen: boolean
  toggleFan: () => void
  closeFan: () => void
  threadsOpen: boolean
  toggleThreads: () => void
  closeThreads: () => void
  chatOpen: boolean
  toggleChat: () => void
  closeChat: () => void
}

const RootFabContext = createContext<RootFabContextValue | null>(null)

/**
 * Wrap projects-root children. Owns the fan-open boolean shared between
 * ActionBarRoot's + button and projects/page.tsx's 5-arc fan render, plus
 * the threads-sheet and chat-sheet booleans shared with the corresponding
 * sheet components rendered on projects/page.tsx.
 */
export function RootFabProvider({ children }: { children: ReactNode }) {
  const [fanOpen, setFanOpen] = useState(false)
  const [threadsOpen, setThreadsOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const toggleFan = useCallback(() => setFanOpen(o => !o), [])
  const closeFan = useCallback(() => setFanOpen(false), [])
  const toggleThreads = useCallback(() => setThreadsOpen(o => !o), [])
  const closeThreads = useCallback(() => setThreadsOpen(false), [])
  const toggleChat = useCallback(() => setChatOpen(o => !o), [])
  const closeChat = useCallback(() => setChatOpen(false), [])
  return (
    <RootFabContext.Provider value={{
      fanOpen, toggleFan, closeFan,
      threadsOpen, toggleThreads, closeThreads,
      chatOpen, toggleChat, closeChat,
    }}>
      {children}
    </RootFabContext.Provider>
  )
}

/**
 * Read the projects-root fan state. Returns inert defaults if called
 * outside the provider — defensive only; the layout always wraps.
 */
export function useRootFab(): RootFabContextValue {
  const ctx = useContext(RootFabContext)
  if (!ctx) {
    return {
      fanOpen: false, toggleFan: () => {}, closeFan: () => {},
      threadsOpen: false, toggleThreads: () => {}, closeThreads: () => {},
      chatOpen: false, toggleChat: () => {}, closeChat: () => {},
    }
  }
  return ctx
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

const DISABLED_OPACITY = 0.45

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
  } = useRootFab()

  const accent = ACCENT
  const onThreadsRoute = pathname === '/projects/threads'
  const threadsActive = onThreadsRoute || threadsOpen

  function handlePlus() {
    haptic('medium')
    closeThreads()
    closeChat()
    toggleFan()
  }

  function handleThreads() {
    haptic('light')
    closeFan()
    closeChat()
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
    toggleChat()
  }

  // Resources stays disabled: company-level resources is V2 schema work
  // (nullable Resource.projectId). Visual-symmetry slot until then.
  function handleResources() {
    console.log('[ActionBarRoot] company resources coming with V2')
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
      }}
    >
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

      {/* Resources — right edge. Reduced opacity, no-op handler. Mirrors
          the project-scoped ActionBar's resources-at-right placement so
          the two bars read identical across navigation. */}
      <div
        className="pointer-events-auto"
        style={{
          position: 'absolute',
          right: 16, top: '50%',
          transform: 'translateY(-50%)',
          opacity: DISABLED_OPACITY,
        }}
      >
        <ActionBarButton
          size={SIZE_SATELLITE}
          variant="satellite"
          accent={accent}
          onClick={handleResources}
          ariaLabel="Resources (coming with V2)"
        >
          <ResourcesIcon />
        </ActionBarButton>
      </div>
    </div>
  )
}
