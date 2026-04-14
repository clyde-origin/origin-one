'use client'

import { PageExitProvider } from '@/lib/context/PageExitContext'

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { projectId: string }
}) {
  return (
    <PageExitProvider>
      <div className="relative w-full h-full">
        {children}
      </div>
    </PageExitProvider>
  )
}
