// POST /api/call-sheets/[id]/send
//
// Request body:
//   {
//     scheduledFor?: string | null    // ISO timestamp; null/missing → send immediately
//     recipientIds?: string[]         // null/missing → all non-excluded recipients
//     channels?: ('email' | 'sms')[]  // default ['email']
//   }
//
// Side effects:
//   - For each (recipient, channel) tuple: insert a CallSheetDelivery row with
//     personalizedSnapshot computed from current call sheet state.
//   - If scheduledFor is null, immediately fires dispatchPendingDeliveries so
//     the rows go out without waiting for the next cron tick.

import { NextRequest, NextResponse } from 'next/server'
import { getCallSheetAdminClient } from '@/lib/call-sheet/admin-client'
import { personalizeRecipient } from '@/lib/call-sheet/personalize'
import { dispatchPendingDeliveries } from '@/lib/call-sheet/dispatch'
import {
  getCallSheetProjectId,
  requireProducerAccess,
} from '@/lib/auth/server-authz'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const callSheetId = params.id

  const projectId = await getCallSheetProjectId(callSheetId)
  if (!projectId) {
    return NextResponse.json({ ok: false, error: 'call sheet not found' }, { status: 404 })
  }
  const authz = await requireProducerAccess(projectId)
  if (!authz.ok) {
    return NextResponse.json({ ok: false, error: authz.message }, { status: authz.status })
  }

  const body = await req.json().catch(() => ({})) as {
    scheduledFor?: string | null
    recipientIds?: string[]
    channels?: ('email' | 'sms')[]
  }

  const channels = (body.channels && body.channels.length > 0) ? body.channels : ['email' as const]
  const scheduledFor = body.scheduledFor ?? null

  const db = getCallSheetAdminClient()

  // Load call sheet + shoot day + schedule + recipients + location
  const [cs, sd, schedule, recipients] = await Promise.all([
    db.from('CallSheet').select('*').eq('id', callSheetId).single(),
    db.from('CallSheet').select('shootDayId').eq('id', callSheetId).single().then(async (r) => {
      const shootDayId = r.data?.shootDayId
      if (!shootDayId) return { data: null, error: r.error }
      return db.from('ShootDay').select('*, Location(id, name, address)').eq('id', shootDayId).single()
    }),
    db.from('CallSheet').select('shootDayId').eq('id', callSheetId).single().then(async (r) => {
      const shootDayId = r.data?.shootDayId
      if (!shootDayId) return { data: [], error: null }
      return db.from('ScheduleBlock').select('id, startTime, kind, talentIds, crewMemberIds').eq('shootDayId', shootDayId)
    }),
    body.recipientIds && body.recipientIds.length > 0
      ? db.from('CallSheetRecipient').select('*').eq('callSheetId', callSheetId).in('id', body.recipientIds)
      : db.from('CallSheetRecipient').select('*').eq('callSheetId', callSheetId).eq('excluded', false),
  ])

  if (cs.error || !cs.data) {
    return NextResponse.json({ ok: false, error: cs.error?.message ?? 'call sheet not found' }, { status: 404 })
  }
  if (sd.error || !sd.data) {
    return NextResponse.json({ ok: false, error: sd.error?.message ?? 'shoot day not found' }, { status: 404 })
  }
  if (recipients.error) {
    return NextResponse.json({ ok: false, error: recipients.error.message }, { status: 500 })
  }

  const callSheet = cs.data
  const shootDay = sd.data as any
  const blocks = (schedule.data ?? []) as any[]
  const ctx = {
    shootDate: shootDay.date,
    generalCallTime: callSheet.generalCallTime,
    crewCallTime: callSheet.crewCallTime,
    lunchTime: callSheet.lunchTime,
    setLocationAddress: shootDay.Location?.address ?? null,
    schedule: blocks,
  }

  const rowsToInsert: any[] = []
  const nowIso = new Date().toISOString()
  for (const r of (recipients.data ?? [])) {
    const snapshot = personalizeRecipient(r as any, ctx)
    for (const ch of channels) {
      const wantsCh = ch === 'email' ? r.sendEmail : r.sendSms
      if (!wantsCh) continue
      rowsToInsert.push({
        recipientId: r.id,
        channel: ch,
        provider: 'stub', // overwritten on send
        status: 'queued',
        scheduledFor,
        personalizedSnapshot: snapshot,
        updatedAt: nowIso,
      })
    }
  }

  if (rowsToInsert.length > 0) {
    const { error: insErr } = await db.from('CallSheetDelivery').insert(rowsToInsert)
    if (insErr) {
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })
    }
  }

  // Mark call sheet as sent on first dispatch
  if (callSheet.status === 'draft') {
    await db.from('CallSheet').update({
      status: 'sent',
      publishedAt: nowIso,
      updatedAt: nowIso,
    }).eq('id', callSheetId)
  }

  // If immediate, trigger dispatch right now
  let immediate: { sent: number; errors: number } | null = null
  if (!scheduledFor) {
    immediate = await dispatchPendingDeliveries()
  }

  return NextResponse.json({ ok: true, queued: rowsToInsert.length, immediate })
}
