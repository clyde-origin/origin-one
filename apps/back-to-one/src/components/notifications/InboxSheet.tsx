'use client'

import { useRouter } from 'next/navigation'
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/lib/hooks/useOriginOne'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import type { NotificationRow } from '@/lib/db/queries'
import { EnablePushPrompt } from './EnablePushPrompt'

export function InboxSheet({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId: string | null }) {
  const { data: notifications = [] } = useNotifications(projectId)
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead(projectId)
  const router = useRouter()

  const unread = notifications.filter((n) => !n.readAt)
  const earlier = notifications.filter((n) => n.readAt)

  const goTo = (n: NotificationRow) => {
    if (!n.readAt) markRead.mutate(n.id)
    router.push(deepLinkFor(n))
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader
        title={projectId ? 'Notifications' : 'All notifications'}
        onClose={onClose}
        action={
          unread.length > 0 ? (
            <button
              onClick={() => markAll.mutate()}
              style={{ background: 'none', border: 'none', color: '#6470f3', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Mark all read
            </button>
          ) : undefined
        }
      />
      <SheetBody>
        <EnablePushPrompt />
        {notifications.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
            Nothing new.
          </div>
        )}
        {unread.length > 0 && (
          <Section title="Unread">
            {unread.map((n) => <Row key={n.id} n={n} unread onClick={() => goTo(n)} showProject={!projectId} />)}
          </Section>
        )}
        {earlier.length > 0 && (
          <Section title="Earlier">
            {earlier.map((n) => <Row key={n.id} n={n} unread={false} onClick={() => goTo(n)} showProject={!projectId} />)}
          </Section>
        )}
      </SheetBody>
    </Sheet>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.13em',
        textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
        padding: '0 16px 8px',
      }}>{title}</div>
      <div>{children}</div>
    </div>
  )
}

function Row({ n, unread, onClick, showProject }: { n: NotificationRow; unread: boolean; onClick: () => void; showProject: boolean }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', gap: 12, padding: '12px 16px', cursor: 'pointer',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: unread ? 'rgba(217,119,6,0.05)' : 'transparent',
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'rgba(255,255,255,0.08)',
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>
          <span style={{ fontWeight: 700 }}>{n.actor?.name ?? 'Someone'}</span>
          {' mentioned you'}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          {showProject && n.project && (
            <span style={{
              fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)',
              background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4,
            }}>{n.project.name}</span>
          )}
          <span style={{
            fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)',
            background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: 4,
          }}>{n.contextLabel}</span>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 6, lineHeight: 1.4 }}>
          {n.excerpt}
        </div>
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {formatRelative(n.createdAt)}
      </div>
    </div>
  )
}

function deepLinkFor(n: NotificationRow): string {
  switch (n.sourceType) {
    case 'chatMessage':   return `/projects/${n.projectId}/chat?focus=${n.sourceId}`
    case 'threadMessage': return `/projects/${n.projectId}/threads?msg=${n.sourceId}`
    case 'actionItem':    return `/projects/${n.projectId}/action-items?detail=${n.sourceId}`
    case 'milestone':     return `/projects/${n.projectId}/timeline?milestone=${n.sourceId}`
    case 'shootDay':      return `/projects/${n.projectId}/timeline?shootDay=${n.sourceId}`
    default:              return `/projects/${n.projectId}`
  }
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}
