// Server-side dispatch — called by both the immediate send route and the
// minute-by-minute Vercel Cron worker. Idempotent: claims rows by setting
// status='sent' before calling provider so concurrent cron invocations
// can't double-send.

import { getCallSheetAdminClient } from './admin-client'
import { sendEmail } from '@/lib/email/send-email'
import { sendSms } from '@/lib/sms/send-sms'
import { buildCallSheetEmail, buildCallSheetSms } from '@/lib/email/call-sheet-template'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const SHORT_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function shootDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const date = new Date(Date.UTC(y, m - 1, d))
  return `${DOW[date.getUTCDay()]}, ${SHORT_MONTH[date.getUTCMonth()]} ${d}, ${y}`
}

export async function dispatchPendingDeliveries(opts?: { now?: Date; limit?: number }): Promise<{ sent: number; errors: number }> {
  const db = getCallSheetAdminClient()
  const now = opts?.now ?? new Date()
  const limit = opts?.limit ?? 100

  // Claim a batch — set status='sent' first so we don't double-send if cron
  // overlaps. We then fetch the claimed rows, do the actual send, and update
  // sentAt + provider + externalId in a follow-up update.
  const { data: candidates, error: selErr } = await db
    .from('CallSheetDelivery')
    .select('id')
    .or(`scheduledFor.is.null,scheduledFor.lte.${now.toISOString()}`)
    .is('sentAt', null)
    .eq('status', 'queued')
    .order('createdAt', { ascending: true })
    .limit(limit)
  if (selErr) {
    console.error('dispatchPendingDeliveries select failed:', selErr)
    return { sent: 0, errors: 1 }
  }
  if (!candidates || candidates.length === 0) return { sent: 0, errors: 0 }

  const ids = candidates.map(c => c.id)

  // Fetch full rows + recipient + call sheet + project + shoot day
  const { data: rows, error: fetchErr } = await db
    .from('CallSheetDelivery')
    .select(`
      *,
      CallSheetRecipient!inner(
        *,
        Talent(id, name, email, phone),
        ProjectMember(id, department, role, User(id, name, email, phone)),
        CallSheet!inner(
          *,
          Project!inner(id, name),
          ShootDay!inner(id, date, type, locationId, Location(id, name, address))
        )
      )
    `)
    .in('id', ids)
  if (fetchErr || !rows) {
    console.error('dispatchPendingDeliveries fetch failed:', fetchErr)
    return { sent: 0, errors: 1 }
  }

  let sent = 0
  let errors = 0
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // Per-row send pipeline — extracted from the original for-of so we can
  // run a chunk's sends in parallel via Promise.all.
  type RowOutcome =
    | { kind: 'missingRelated'; id: string }
    | { kind: 'sent'; id: string; provider: 'resend' | 'twilio' | 'stub'; externalId: string | null }
    | { kind: 'failed'; id: string; provider: 'resend' | 'twilio' | 'stub'; reason: string }

  async function runRow(row: any): Promise<RowOutcome> {
    const recipient = row.CallSheetRecipient
    const callSheet = recipient?.CallSheet
    const shootDay = callSheet?.ShootDay
    const project = callSheet?.Project
    const location = shootDay?.Location
    if (!recipient || !callSheet || !shootDay || !project) {
      return { kind: 'missingRelated', id: row.id }
    }

    // Resolve recipient identity + contact
    const talent = recipient.Talent
    const member = recipient.ProjectMember
    const user = member?.User
    const recipientName =
      talent?.name ?? user?.name ?? recipient.freeformName ?? 'There'
    const email =
      talent?.email ?? user?.email ?? recipient.freeformEmail ?? null
    const phone =
      talent?.phone ?? user?.phone ?? recipient.freeformPhone ?? null

    // Resolve call time from snapshot stored at queue time
    const snapshot = (row.personalizedSnapshot ?? null) as { callTime?: string | null; locationAddress?: string | null } | null
    const callTime = snapshot?.callTime ?? callSheet.generalCallTime ?? null
    const setAddress = snapshot?.locationAddress ?? location?.address ?? null
    const dateLabel = shootDateLabel(shootDay.date)

    let providerStamp: 'resend' | 'twilio' | 'stub' = 'stub'

    if (row.channel === 'email') {
      if (!email) {
        return { kind: 'failed', id: row.id, provider: providerStamp, reason: 'no email on file' }
      }
      const built = buildCallSheetEmail({
        recipientName,
        projectTitle: callSheet.title || project.name,
        shootDateLabel: dateLabel,
        callTime,
        setAddress,
        productionNotes: callSheet.productionNotes ?? null,
        parkingNotes: callSheet.parkingNotes ?? null,
        appUrl,
        confirmToken: row.confirmToken,
        replyTo: callSheet.replyToEmail ?? null,
      })
      const result = await sendEmail({
        to: email,
        replyTo: callSheet.replyToEmail ?? null,
        subject: built.subject,
        html: built.html,
        text: built.text,
      })
      providerStamp = result.provider
      if (result.ok) {
        return { kind: 'sent', id: row.id, provider: providerStamp, externalId: result.externalId }
      }
      return { kind: 'failed', id: row.id, provider: providerStamp, reason: result.error }
    } else if (row.channel === 'sms') {
      if (!phone) {
        return { kind: 'failed', id: row.id, provider: providerStamp, reason: 'no phone on file' }
      }
      const body = buildCallSheetSms({
        recipientName,
        projectTitle: callSheet.title || project.name,
        shootDateLabel: dateLabel,
        callTime,
        setAddress,
        appUrl,
        confirmToken: row.confirmToken,
      })
      const result = await sendSms({ to: phone, body })
      providerStamp = result.provider
      if (result.ok) {
        return { kind: 'sent', id: row.id, provider: providerStamp, externalId: result.externalId }
      }
      return { kind: 'failed', id: row.id, provider: providerStamp, reason: result.error }
    }
    // Unknown channel — preserve original failure path.
    return { kind: 'failed', id: row.id, provider: providerStamp, reason: 'unknown' }
  }

  // Chunked parallel pipeline — sends fan out 10 at a time so a slow
  // provider response doesn't stall the cron tick. Updates fan out the
  // same way (Supabase forbids varying-payload bulk updates: each row's
  // externalId / failedReason is row-specific).
  const CHUNK_SIZE = 10
  const allRows = rows as any[]

  for (let i = 0; i < allRows.length; i += CHUNK_SIZE) {
    const chunk = allRows.slice(i, i + CHUNK_SIZE)
    const outcomes = await Promise.all(chunk.map(runRow))
    const nowIso = new Date().toISOString()

    await Promise.all(outcomes.map(async (o) => {
      if (o.kind === 'missingRelated') {
        await db.from('CallSheetDelivery').update({
          status: 'failed',
          failedReason: 'missing related row',
          updatedAt: nowIso,
        }).eq('id', o.id)
        errors++
        return
      }
      if (o.kind === 'sent') {
        const { error: updErr } = await db.from('CallSheetDelivery').update({
          sentAt: nowIso,
          status: 'sent',
          provider: o.provider,
          externalId: o.externalId,
          updatedAt: nowIso,
        }).eq('id', o.id)
        if (updErr) {
          console.error('dispatch update sent failed:', updErr)
          errors++
        } else {
          sent++
        }
        return
      }
      // failed
      await db.from('CallSheetDelivery').update({
        status: 'failed',
        failedReason: o.reason,
        provider: o.provider,
        updatedAt: nowIso,
      }).eq('id', o.id)
      errors++
    }))
  }

  return { sent, errors }
}
