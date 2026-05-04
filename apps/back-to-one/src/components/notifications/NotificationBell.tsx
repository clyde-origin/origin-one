'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useUnreadCount, useNotifications } from '@/lib/hooks/useOriginOne'

// InboxSheet only renders when the user opens the bell. Defer its chunk
// (full notifications list UI) until first interaction.
const InboxSheet = dynamic(
  () => import('./InboxSheet').then(m => ({ default: m.InboxSheet })),
  { ssr: false },
)

const TA_DEEP = '#D97706' // matches src/lib/thread-tokens.ts unread amber

export function NotificationBell({ projectId }: { projectId: string | null }) {
  const [open, setOpen] = useState(false)
  // Has-opened latch — keep the InboxSheet mounted after first open so its
  // Sheet component's exit animation can run on close. Combined with
  // `next/dynamic`, the chunk only fetches when the bell is first tapped.
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { if (open) setLoaded(true) }, [open])
  const { data: unread = 0 } = useUnreadCount(projectId)
  const { data: all } = useNotifications(projectId)

  // Zero-state suppression: hide bell entirely until this user has any notifications.
  if ((all?.length ?? 0) === 0) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 8, position: 'relative',
        }}
      >
        <BellIcon />
        {unread > 0 && (
          <span
            aria-hidden
            style={{
              position: 'absolute', top: 4, right: 4,
              width: 8, height: 8, borderRadius: '50%',
              background: TA_DEEP, border: '2px solid #04040a',
            }}
          />
        )}
      </button>
      {loaded && <InboxSheet open={open} onClose={() => setOpen(false)} projectId={projectId} />}
    </>
  )
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgba(255,255,255,0.7)' }}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}
