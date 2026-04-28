'use client'

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { createBrowserAuthClient } from '@origin-one/auth'

export function useSupabaseSession(): Session | null {
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    const supabase = createBrowserAuthClient()
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))

    // Auth Day cleanup: drop the legacy viewer-role localStorage key.
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('origin_one_user_role')
    }

    return () => sub.subscription.unsubscribe()
  }, [])

  return session
}
