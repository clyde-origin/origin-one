'use client'

import { useEffect } from 'react'

const SW_PATH = '/sw.js'
const SW_SCOPE = '/'

/**
 * Eagerly register the BT1 service worker on mount.
 *
 * The push client (`lib/push/client.ts`) also registers `/sw.js`, but only when
 * the user explicitly enables push notifications. This hook ensures the offline
 * shell is available for everyone — including users who never opt into push —
 * so the app keeps working on a phone in low signal.
 *
 * Idempotent: if a registration already exists for the scope, the browser
 * reuses it.
 */
export function useServiceWorker(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    // Skip in dev — Next dev server hot-reloads conflict with cached assets.
    if (process.env.NODE_ENV !== 'production') return

    const register = async () => {
      try {
        const existing = await navigator.serviceWorker.getRegistration(SW_SCOPE)
        if (existing) return
        await navigator.serviceWorker.register(SW_PATH, { scope: SW_SCOPE })
      } catch {
        // Registration failure shouldn't break the app; the user just loses the offline shell.
      }
    }

    void register()
  }, [])
}
