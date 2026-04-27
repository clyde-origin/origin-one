// Timecard → Expense sync (spec §5.1). Wired into approveTimecard /
// reopenTimecard so an approved timecard's labor cost flows into Budget
// actuals automatically.
//
// Idempotency: Expense.timecardId is @unique (PR 4 schema). Re-approval
// upserts the same row; reopen deletes it. Re-approve after reopen
// recreates with current values.
//
// Error policy per spec / user pre-flag: NEVER throw on failure here.
// The timecard's own status update (approved / reopened) succeeds
// independently. Sync failures log + skip — the producer can fix
// missing line mapping later.

import { createBrowserAuthClient as createClient } from '@origin-one/auth'
import { computeExpenseUnits, resolveExpenseRate } from '@origin-one/schema'
import type { RateUnit } from '@/types'

interface SupabaseTimecard {
  id: string
  date: string
  hours: string | number
  rate: string | number | null
  rateUnit: RateUnit | null
  lineItemId: string | null
  crewMemberId: string
  approvedBy: string | null
}

interface SupabaseLine {
  id: string
  budgetId: string
  actualsRate: string | number | null
}

interface SupabaseBudget {
  id: string
  rateSourceVersionId: string | null
}

interface SupabaseAmount {
  rate: string | number
}

/**
 * Materialize an approved timecard into an Expense (upsert by timecardId).
 * Called from approveTimecard right after the status update — runs in a
 * separate request, so a failure here doesn't roll back the approval.
 */
export async function syncExpenseFromTimecard(timecardId: string): Promise<void> {
  const db = createClient()

  // 1. Timecard + crewMember.defaultLineItemId.
  const tcResp = await db
    .from('CrewTimecard')
    .select('id, date, hours, rate, rateUnit, lineItemId, crewMemberId, approvedBy')
    .eq('id', timecardId)
    .maybeSingle()
  if (tcResp.error) {
    console.warn('[budget] syncExpenseFromTimecard: timecard fetch failed', tcResp.error)
    return
  }
  const tc = tcResp.data as SupabaseTimecard | null
  if (!tc) {
    console.warn(`[budget] syncExpenseFromTimecard: timecard ${timecardId} not found`)
    return
  }
  if (tc.rateUnit == null) {
    console.warn(`[budget] syncExpenseFromTimecard: timecard ${timecardId} has no rateUnit — skip`)
    return
  }

  // 2. Resolve lineId — per-timecard override OR crew member's default line.
  let lineId = tc.lineItemId
  if (!lineId) {
    const memberResp = await db
      .from('ProjectMember')
      .select('defaultLineItemId')
      .eq('id', tc.crewMemberId)
      .maybeSingle()
    lineId = (memberResp.data as { defaultLineItemId: string | null } | null)?.defaultLineItemId ?? null
  }
  if (!lineId) {
    console.warn(`[budget] syncExpenseFromTimecard: timecard ${timecardId} has no lineItemId nor crew default — skip`)
    return
  }

  // 3. Budget line (for budgetId + actualsRate fallback).
  const lineResp = await db
    .from('BudgetLine')
    .select('id, budgetId, actualsRate')
    .eq('id', lineId)
    .maybeSingle()
  if (lineResp.error || !lineResp.data) {
    console.warn(`[budget] syncExpenseFromTimecard: BudgetLine ${lineId} not found`, lineResp.error)
    return
  }
  const line = lineResp.data as SupabaseLine
  const lineActualsRate = line.actualsRate == null
    ? null
    : (typeof line.actualsRate === 'string' ? parseFloat(line.actualsRate) : Number(line.actualsRate))

  // 4. Budget — for rateSourceVersionId.
  const budgetResp = await db
    .from('Budget')
    .select('id, rateSourceVersionId')
    .eq('id', line.budgetId)
    .maybeSingle()
  if (budgetResp.error || !budgetResp.data) {
    console.warn(`[budget] syncExpenseFromTimecard: Budget ${line.budgetId} not found`, budgetResp.error)
    return
  }
  const budget = budgetResp.data as SupabaseBudget

  // 5. Rate-source version's amount on this line (versionRate fallback).
  let versionRate: number | null = null
  if (budget.rateSourceVersionId) {
    const amtResp = await db
      .from('BudgetLineAmount')
      .select('rate')
      .eq('lineId', line.id)
      .eq('versionId', budget.rateSourceVersionId)
      .maybeSingle()
    const amt = amtResp.data as SupabaseAmount | null
    if (amt) {
      versionRate = typeof amt.rate === 'string' ? parseFloat(amt.rate) : Number(amt.rate)
    }
  }

  // 6. Compute units/unitRate/unit/amount via the verified PR 6 helpers.
  const tcRate = tc.rate == null
    ? null
    : (typeof tc.rate === 'string' ? parseFloat(tc.rate) : Number(tc.rate))
  const hours = typeof tc.hours === 'string' ? parseFloat(tc.hours) : Number(tc.hours)
  const { units, unit } = computeExpenseUnits(tc.rateUnit, hours)
  const unitRate = resolveExpenseRate(tcRate, lineActualsRate, versionRate)
  const amount = units * unitRate

  // 7. Upsert Expense — match on timecardId (which is @unique). Supabase
  //    upsert with onConflict on a unique column does the right thing.
  const expenseRow = {
    budgetId: line.budgetId,
    lineId: line.id,
    source: 'timecard' as const,
    amount: amount.toFixed(2),
    date: tc.date,
    units: units.toFixed(2),
    unitRate: unitRate.toFixed(2),
    unit,
    timecardId: tc.id,
    createdBy: tc.approvedBy ?? tc.crewMemberId,
  }

  // Check whether an Expense already exists for this timecard.
  const existing = await db
    .from('Expense')
    .select('id')
    .eq('timecardId', tc.id)
    .maybeSingle()
  if (existing.data) {
    // Update the existing row (minus the id).
    const { error } = await db
      .from('Expense')
      .update({
        amount: expenseRow.amount, units: expenseRow.units, unitRate: expenseRow.unitRate,
        unit: expenseRow.unit, lineId: expenseRow.lineId, date: expenseRow.date,
      })
      .eq('id', (existing.data as { id: string }).id)
    if (error) console.warn(`[budget] syncExpenseFromTimecard: update failed`, error)
    return
  }

  // Insert fresh.
  const { error } = await db
    .from('Expense')
    .insert({ id: crypto.randomUUID(), ...expenseRow })
  if (error) {
    console.warn('[budget] syncExpenseFromTimecard: insert failed', error)
  }
}

/**
 * Delete the Expense paired with a timecard. Called from reopenTimecard.
 * No-throw; logs and continues.
 */
export async function deleteExpenseForTimecard(timecardId: string): Promise<void> {
  const db = createClient()
  const { error } = await db.from('Expense').delete().eq('timecardId', timecardId)
  if (error) {
    console.warn(`[budget] deleteExpenseForTimecard: delete failed`, error)
  }
}
