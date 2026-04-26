'use client'

// Projects-root layout. Wraps every route under /projects/ in the
// RootFabProvider (the fan-open state shared between ActionBarRoot's +
// button and projects/page.tsx's 5-arc fan render) and conditionally
// mounts ActionBarRoot on root-only routes.
//
// Important Next.js App Router behavior: this layout nests around EVERY
// route under /projects/, including /projects/[projectId]/* — there is
// no segment-level "shadow" mechanism that escapes a parent layout. To
// avoid stacking the root bar on top of the project-scoped ActionBar
// that lives in [projectId]/layout.tsx, the bar is mounted only when
// the pathname matches a known root route (/projects or /projects/threads).
// All other paths (project-scoped pages and /projects/new) bypass it.
//
// The provider still wraps everything cheaply — project-scoped pages
// don't consume the context, so it's a no-op for them.

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { ActionBarRoot, RootFabProvider } from '@/components/ui/ActionBarRoot'

export default function ProjectsRootLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''

  // Pathname whitelist — bar shows only on root routes. Project-scoped
  // routes (/projects/<id>/*) get the [projectId]-scoped ActionBar from
  // their own layout. /projects/new bypasses the bar (form-only page).
  const isRootRoute = pathname === '/projects' || pathname === '/projects/threads'

  return (
    <RootFabProvider>
      {children}
      {isRootRoute && <ActionBarRoot />}
    </RootFabProvider>
  )
}
