import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import webpush from 'web-push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:noreply@example.com'

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

function makeServerClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) { cookieStore.set({ name, value, ...options }) },
        remove(name: string, options: CookieOptions) { cookieStore.set({ name, value: '', ...options }) },
      },
    },
  )
}

function deepLinkFor(n: { sourceType: string; sourceId: string; projectId: string }): string {
  switch (n.sourceType) {
    case 'chatMessage':   return `/projects/${n.projectId}/chat?focus=${n.sourceId}`
    case 'threadMessage': return `/projects/${n.projectId}/threads?msg=${n.sourceId}`
    case 'actionItem':    return `/projects/${n.projectId}/action-items?detail=${n.sourceId}`
    case 'milestone':     return `/projects/${n.projectId}/timeline?milestone=${n.sourceId}`
    case 'shootDay':      return `/projects/${n.projectId}/timeline?shootDay=${n.sourceId}`
    default:              return `/projects/${n.projectId}`
  }
}

export async function POST(req: Request) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return NextResponse.json({ error: 'VAPID not configured' }, { status: 500 })
  }

  const supabase = makeServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let body: { notificationIds?: string[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }
  const ids = body.notificationIds ?? []
  if (ids.length === 0) return NextResponse.json({ ok: true, dispatched: 0 })

  const { data: notifications, error } = await supabase
    .from('Notification')
    .select('id, userId, projectId, sourceType, sourceId, actorId, excerpt, contextLabel, actor:User!Notification_actorId_fkey(id,name), project:Project(id,name)')
    .in('id', ids)
  if (error) {
    console.error('dispatch: notification fetch failed:', error)
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 })
  }

  // Fetch all relevant PushSubscriptions in one query and group by userId,
  // rather than one round-trip per notification.
  const userIds = Array.from(new Set((notifications ?? []).map(n => n.userId)))
  const subsByUserId = new Map<string, Array<{ endpoint: string; p256dh: string; auth: string }>>()
  if (userIds.length > 0) {
    const { data: allSubs } = await supabase
      .from('PushSubscription')
      .select('userId, endpoint, p256dh, auth')
      .in('userId', userIds)
    for (const s of allSubs ?? []) {
      const list = subsByUserId.get(s.userId) ?? []
      list.push({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth })
      subsByUserId.set(s.userId, list)
    }
  }

  let dispatched = 0
  for (const n of notifications ?? []) {
    const subs = subsByUserId.get(n.userId) ?? []
    if (subs.length === 0) continue

    const actorName = (n as any).actor?.name ?? 'Someone'
    const projectName = (n as any).project?.name
    const title = projectName
      ? `${actorName} mentioned you · ${projectName}`
      : `${actorName} mentioned you`
    const body = n.contextLabel ? `${n.contextLabel} — ${n.excerpt}` : n.excerpt
    const payload = JSON.stringify({
      title,
      body,
      url: deepLinkFor(n),
      tag: n.id,
    })

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        )
        dispatched++
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await supabase.from('PushSubscription').delete().eq('endpoint', sub.endpoint)
        } else {
          console.error('webpush sendNotification failed:', err?.statusCode ?? err)
        }
      }
    }
  }

  return NextResponse.json({ ok: true, dispatched })
}
