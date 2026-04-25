'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

// ── Types ────────────────────────────────────────────────

/**
 * One branch on a fan-out FAB. Used by surfaces with 1-3 alternative
 * actions surfaced from a single + (currently only the Hub).
 */
export interface FabBranch {
  label: string
  color: string
  icon: ReactNode
  action: () => void
}

/**
 * The action a surface registers for its + slot. Either a simple onPress,
 * or a 1-3-item branch fan. Pages that want no + (Chat browsing, detail
 * sheets, surfaces that hide +) simply don't register; ActionBar renders
 * the + slot as visibility:hidden so cluster width stays uniform.
 */
export interface FabAction {
  /** Tap-to-fire callback. Mutually exclusive with `branches`. */
  onPress?: () => void
  /** Fan-out alternatives. 1-3 items. Mutually exclusive with `onPress`. */
  branches?: FabBranch[]
  /** Optional aria-label for the + button. Defaults to "Create". */
  label?: string
}

interface FabActionContextValue {
  /** Currently registered action, or null when no surface has registered. */
  action: FabAction | null
}

// ── Context ──────────────────────────────────────────────

const FabActionContext = createContext<FabActionContextValue>({
  action: null,
})

interface InternalContextValue {
  register: (a: FabAction) => () => void
}

const InternalContext = createContext<InternalContextValue | null>(null)

// ── Provider ─────────────────────────────────────────────

/**
 * Mount once at the project-scoped layout level. Hosts the single FAB
 * action registered by whatever page is currently rendered. Multiple
 * concurrent registrations resolve last-write-wins via insertion order;
 * cleanup pops the entry, falling through to the prior registration.
 */
export function FabActionProvider({ children }: { children: ReactNode }) {
  // Stack of registrations. The top entry is what ActionBar reads.
  // A stack (rather than a single slot) handles edge cases like a
  // detail sheet remounting before the underlying page's effect reruns.
  const stackRef = useRef<Array<{ id: number; action: FabAction }>>([])
  const [version, setVersion] = useState(0)
  const idRef = useRef(0)

  const register = useCallback((action: FabAction) => {
    const id = ++idRef.current
    stackRef.current.push({ id, action })
    setVersion(v => v + 1)
    return () => {
      const idx = stackRef.current.findIndex(e => e.id === id)
      if (idx >= 0) {
        stackRef.current.splice(idx, 1)
        setVersion(v => v + 1)
      }
    }
  }, [])

  const value = useMemo<FabActionContextValue>(() => {
    const top = stackRef.current[stackRef.current.length - 1]
    return { action: top?.action ?? null }
  }, [version])

  const internalValue = useMemo<InternalContextValue>(() => ({ register }), [register])

  return (
    <InternalContext.Provider value={internalValue}>
      <FabActionContext.Provider value={value}>
        {children}
      </FabActionContext.Provider>
    </InternalContext.Provider>
  )
}

// ── Hooks ────────────────────────────────────────────────

/**
 * Read the currently registered FAB action. Only ActionBar should call this.
 */
export function useFabActionState(): FabActionContextValue {
  return useContext(FabActionContext)
}

/**
 * Register a + behavior for the current surface.
 *
 * Pass `deps` when the registered action captures values that change at
 * runtime — e.g. the Hub's milestone branch captures the project accent;
 * Scenemaker's onPress captures the active mode handler. Re-registration
 * fires when any dep changes.
 *
 * Stable callbacks (state setters, dispatch functions) don't need deps.
 */
export function useFabAction(action: FabAction, deps: ReadonlyArray<unknown> = []) {
  const internal = useContext(InternalContext)
  // Hold latest action in a ref so the effect can read it without re-running
  // when only the action object identity changes (deps control re-registration).
  const actionRef = useRef(action)
  actionRef.current = action

  useEffect(() => {
    if (!internal) return
    return internal.register(actionRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
