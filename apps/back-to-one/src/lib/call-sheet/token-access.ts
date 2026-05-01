// Helpers for the public /c/[token] routes (confirm, view, pixel).
//
// These routes are reached without a session — the confirmToken is the
// capability. Two defenses to apply consistently:
//   1. Expiry — reject access more than EXPIRY_GRACE_DAYS past the shoot.
//      Keeps stale links in old emails / link expanders / archived
//      mailboxes from working forever.
//   2. CSRF check on POST — verify Origin matches the app, so a third-
//      party site can't auto-submit a state flip on behalf of someone
//      who happens to be logged into the wrong tab.

import { getCallSheetAdminClient } from './admin-client'

export const EXPIRY_GRACE_DAYS = 14

export type DeliveryLookup = {
  id: string
  recipientId: string
  callSheetId: string
  projectId: string
  shootDate: string | null
  openedAt: string | null
}

export async function loadDeliveryForToken(token: string): Promise<DeliveryLookup | null> {
  const db = getCallSheetAdminClient()
  const { data, error } = await db
    .from('CallSheetDelivery')
    .select(`
      id,
      openedAt,
      CallSheetRecipient!inner (
        id,
        callSheetId,
        CallSheet!inner ( projectId, shootDayId, ShootDay ( date ) )
      )
    `)
    .eq('confirmToken', token)
    .maybeSingle()
  if (error || !data) return null

  const recipient = data.CallSheetRecipient as unknown as {
    id: string
    callSheetId: string
    CallSheet: { projectId: string; shootDayId: string; ShootDay: { date: string } | null }
  }
  return {
    id: data.id as string,
    recipientId: recipient.id,
    callSheetId: recipient.callSheetId,
    projectId: recipient.CallSheet.projectId,
    shootDate: recipient.CallSheet.ShootDay?.date ?? null,
    openedAt: data.openedAt as string | null,
  }
}

// shootDate format: YYYY-MM-DD (per Prisma Date column convention here).
export function isCallSheetAccessExpired(shootDate: string | null, now: Date = new Date()): boolean {
  if (!shootDate) return false
  const shoot = new Date(`${shootDate}T00:00:00Z`)
  if (Number.isNaN(shoot.getTime())) return false
  const expiresAtMs = shoot.getTime() + EXPIRY_GRACE_DAYS * 24 * 60 * 60 * 1000
  return now.getTime() > expiresAtMs
}

// Compares request Origin (or Referer fallback) to the request's own
// origin. A same-origin POST is required for state changes; a third-
// party form auto-submit lands here with mismatched Origin.
export function isSameOriginRequest(req: Request): boolean {
  const requestUrl = new URL(req.url)
  const expected = requestUrl.origin
  const origin = req.headers.get('origin')
  if (origin) return origin === expected
  const referer = req.headers.get('referer')
  if (referer) {
    try {
      return new URL(referer).origin === expected
    } catch {
      return false
    }
  }
  // No Origin and no Referer — refuse rather than assume safe.
  return false
}
