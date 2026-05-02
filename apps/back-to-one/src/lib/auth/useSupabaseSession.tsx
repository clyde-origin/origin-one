'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { createBrowserAuthClient } from '@origin-one/auth'

// Single source of truth for the Supabase auth session. Each call site
// previously called useSupabaseSession() which spun up its own
// useState + onAuthStateChange listener — five listeners across the
// hook tree on every project page. The provider below registers one
// listener, holds the session in context, and the hook is now a thin
// useContext read.

// `undefined` distinguishes "outside a provider" from "no session yet".
const SessionContext = createContext<Session | null | undefined>(undefined)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    const supabase = createBrowserAuthClient()
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (mounted) setSession(s)
    })

    // Auth Day cleanup: drop the legacy viewer-role localStorage key.
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('origin_one_user_role')
    }

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

export function useSupabaseSession(): Session | null {
  const ctx = useContext(SessionContext)
  if (ctx === undefined) {
    throw new Error('useSupabaseSession must be used within a <SessionProvider>')
  }
  return ctx
}
