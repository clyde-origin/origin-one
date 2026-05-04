// POST /api/call-sheets/[id]/refresh-deltas
//
// Server-side delta detection: rebuilds each recipient's "fresh" snapshot
// from current CallSheet + ShootDay + ScheduleBlock state and flags any
// CallSheetDelivery rows whose stored personalizedSnapshot now differs
// (sets outdatedAt = now()). Confirmed deliveries whose key data
// changed have confirmedAt cleared so the recipient must re-confirm.
//
// Called by the client after every successful CallSheet update.

import { NextResponse } from 'next/server'
import { getCallSheetAdminClient } from '@/lib/call-sheet/admin-client'
import { personalizeRecipient, type RecipientSnapshot } from '@/lib/call-sheet/personalize'
import { snapshotsDiffer } from '@/lib/call-sheet/detect-outdated'
import {
  getCallSheetProjectId,
  requireProducerAccess,
} from '@/lib/auth/server-authz'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const callSheetId = params.id

  const projectId = await getCallSheetProjectId(callSheetId)
  if (!projectId) {
    return NextResponse.json({ ok: false, error: 'call sheet not found' }, { status: 404 })
  }
  const authz = await requireProducerAccess(projectId)
  if (!authz.ok) {
    return NextResponse.json({ ok: false, error: authz.message }, { status: authz.status })
  }

  const db = getCallSheetAdminClient()

  const csRes = await db.from('CallSheet').select('*').eq('id', callSheetId).single()
  if (csRes.error || !csRes.data) {
    return NextResponse.json({ ok: false, error: 'call sheet not found' }, { status: 404 })
  }
  const callSheet = csRes.data

  // ShootDay + ScheduleBlock + recipients all key off the same callSheetId /
  // shootDayId — fetch in parallel rather than four sequential awaits.
  const [sdRes, blocksRes, recipientsRes] = await Promise.all([
    db.from('ShootDay').select('*, Location(address)').eq('id', callSheet.shootDayId).single(),
    db.from('ScheduleBlock')
      .select('id, startTime, kind, talentIds, crewMemberIds')
      .eq('shootDayId', callSheet.shootDayId),
    db.from('CallSheetRecipient').select('*').eq('callSheetId', callSheetId).eq('excluded', false),
  ])
  if (sdRes.error || !sdRes.data) {
    return NextResponse.json({ ok: false, error: 'shoot day not found' }, { status: 404 })
  }
  const shootDay = sdRes.data as any
  const blocks = (blocksRes.data ?? []) as any[]
  const recipients = (recipientsRes.data ?? []) as any[]

  const ctx = {
    shootDate: shootDay.date,
    generalCallTime: callSheet.generalCallTime,
    crewCallTime: callSheet.crewCallTime,
    lunchTime: callSheet.lunchTime,
    setLocationAddress: shootDay.Location?.address ?? null,
    schedule: blocks,
  }

  const freshByRecipient: Record<string, RecipientSnapshot> = {}
  for (const r of recipients) {
    freshByRecipient[r.id] = personalizeRecipient(r, ctx)
  }

  // Pull all deliveries for these recipients
  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, outdated: 0, clearedConfirmations: 0 })
  }
  const ids = recipients.map(r => r.id)
  const delivRes = await db.from('CallSheetDelivery')
    .select('id, recipientId, personalizedSnapshot, confirmedAt')
    .in('recipientId', ids)
  const deliveries = (delivRes.data ?? []) as Array<{ id: string; recipientId: string; personalizedSnapshot: RecipientSnapshot | null; confirmedAt: string | null }>

  const nowIso = new Date().toISOString()

  // Group rows into two buckets so we can issue at most two bulk UPDATEs
  // instead of one per row. The first bucket is rows that are outdated but
  // were never confirmed (only the timestamps update). The second bucket
  // also clears confirmedAt because their snapshot differs.
  const outdatedOnlyIds: string[] = []
  const clearConfirmIds: string[] = []
  for (const d of deliveries) {
    const fresh = freshByRecipient[d.recipientId]
    if (!fresh) continue
    if (!snapshotsDiffer(d.personalizedSnapshot, fresh)) continue
    if (d.confirmedAt) {
      clearConfirmIds.push(d.id)
    } else {
      outdatedOnlyIds.push(d.id)
    }
  }

  let outdatedCount = 0
  if (outdatedOnlyIds.length > 0) {
    const { error: updErr } = await db.from('CallSheetDelivery')
      .update({ outdatedAt: nowIso, updatedAt: nowIso })
      .in('id', outdatedOnlyIds)
    if (!updErr) outdatedCount += outdatedOnlyIds.length
  }
  if (clearConfirmIds.length > 0) {
    const { error: updErr } = await db.from('CallSheetDelivery')
      .update({ outdatedAt: nowIso, updatedAt: nowIso, confirmedAt: null })
      .in('id', clearConfirmIds)
    if (!updErr) outdatedCount += clearConfirmIds.length
  }

  return NextResponse.json({
    ok: true,
    outdated: outdatedCount,
    clearedConfirmations: clearConfirmIds.length,
  })
}
