'use client'

import { usePathname } from 'next/navigation'
import { AnimatePresence } from 'framer-motion'
import { HubContent } from '@/components/hub/HubContent'
import { SubPageOverlay } from '@/components/ui/SubPageOverlay'
import { ActionBar } from '@/components/ui/ActionBar'
import { FabActionProvider } from '@/lib/contexts/FabActionContext'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { useNotificationsSubscription } from '@/lib/hooks/useOriginOne'

function BellOverlay({ projectId }: { projectId: string }) {
  useNotificationsSubscription()
  return (
    <div style={{
      position: 'fixed',
      top: 'calc(var(--safe-top, 0px) + 14px)',
      right: 16,
      zIndex: 25,
    }}>
      <NotificationBell projectId={projectId} />
    </div>
  )
}

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { projectId: string }
}) {
  const pathname = usePathname()
  // Hub is at /projects/[id] (2 segments). Subpages have 3+ segments.
  const segments = pathname.split('/').filter(Boolean)
  const isHub = segments.length <= 2

  return (
    <FabActionProvider>
      <HubContent projectId={params.projectId} />
      <AnimatePresence>
        {!isHub && (
          <SubPageOverlay key="subpage">
            {children}
          </SubPageOverlay>
        )}
      </AnimatePresence>
      <BellOverlay projectId={params.projectId} />
      <ActionBar />
    </FabActionProvider>
  )
}
