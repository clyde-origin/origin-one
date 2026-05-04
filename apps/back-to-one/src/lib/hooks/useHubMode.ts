'use client'

import { useCallback, useEffect, useState } from 'react'

export type HubMode = 'production' | 'creative'
const VALID: ReadonlySet<HubMode> = new Set(['production', 'creative'])
const keyFor = (projectId: string) => `hub-mode:${projectId}`

/** Pure helper — read the persisted mode for a project (null if unset / invalid). */
export function readHubMode(projectId: string): HubMode | null {
  if (typeof window === 'undefined') return null
  const v = window.localStorage.getItem(keyFor(projectId))
  return v && VALID.has(v as HubMode) ? (v as HubMode) : null
}

/** Pure helper — persist a mode for a project. Silently rejects invalid values. */
export function writeHubMode(projectId: string, mode: HubMode): void {
  if (typeof window === 'undefined') return
  if (!VALID.has(mode)) return
  window.localStorage.setItem(keyFor(projectId), mode)
}

/**
 * Hub mode state for a project, persisted per-project to localStorage.
 * Defaults to 'production' on first load. The setter writes through to
 * storage immediately so a hard reload restores the last-used mode.
 */
export function useHubMode(projectId: string): {
  mode: HubMode
  setMode: (next: HubMode) => void
} {
  const [mode, setModeState] = useState<HubMode>('production')

  // Hydrate from localStorage on mount + when projectId changes.
  useEffect(() => {
    const stored = readHubMode(projectId)
    setModeState(stored ?? 'production')
  }, [projectId])

  const setMode = useCallback((next: HubMode) => {
    setModeState(next)
    writeHubMode(projectId, next)
  }, [projectId])

  return { mode, setMode }
}
