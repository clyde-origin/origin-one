'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { LazyMotion, domAnimation } from 'framer-motion'
import { SessionProvider } from '@/lib/auth/useSupabaseSession'
import { useServiceWorker } from '@/lib/sw/register'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 min before refetch
            gcTime: 30 * 60 * 1000, // keep cache warm across PWA tab toggles
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  )

  // Eager SW registration so the offline shell works even for users who
  // never enable push notifications.
  useServiceWorker()

  return (
    <QueryClientProvider client={queryClient}>
      <LazyMotion features={domAnimation} strict>
        <SessionProvider>
          {children}
        </SessionProvider>
      </LazyMotion>
    </QueryClientProvider>
  )
}
