// Server-side fetch + rollup for the budget export routes (CSV, Topsheet
// PDF, Detail PDF). Uses the SUPABASE_SERVICE_ROLE_KEY — anon has no
// grants on public schema, so anon-key reads fail with 42501. Service
// role bypasses RLS; producer-only access is enforced at the UI layer
// until Auth day's session-aware middleware lands. See BUILD_STATUS.md
// "Budget export API routes — pre-Auth gating gap".

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  buildEvalContext,
  rollUpBudget,
  type BudgetRollup,
} from '@/lib/budget/compute'
import type { EvalContext } from '@/lib/budget/eval'
import type {
  Budget,
  BudgetVersion,
  BudgetAccount,
  BudgetLine,
  BudgetLineAmount,
  BudgetVariable,
  BudgetMarkup,
  Expense,
  ShootDay,
  Project,
} from '@/types'

export interface BudgetLineWithAmounts extends BudgetLine {
  amounts: BudgetLineAmount[]
}

export interface BudgetTree extends Budget {
  versions: BudgetVersion[]
  accounts: BudgetAccount[]
  lines: BudgetLineWithAmounts[]
  variables: BudgetVariable[]
  markups: BudgetMarkup[]
  expenses: Expense[]
}

export interface BudgetExportData {
  project: Project
  budget: BudgetTree
  shootDays: ShootDay[]
  // Per-version rollup. Always covers every version on the budget so
  // export columns line up with what the topsheet drawer renders.
  rollupByVersionId: Map<string, BudgetRollup>
  evalCtxByVersionId: Map<string, EvalContext>
}

function serverClient(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY missing — required for budget export routes. ' +
      'Add it to apps/back-to-one/.env.local (server-only; do NOT use NEXT_PUBLIC_ prefix).',
    )
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    // Disable session persistence — these clients are short-lived
    // server-side, never tied to a user.
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function fetchBudgetExportData(budgetId: string): Promise<BudgetExportData> {
  const db = serverClient()

  // 1. Budget tree (single nested fetch — same shape as getBudgetByProject).
  const budgetResp = await db
    .from('Budget')
    .select(`
      *,
      versions:BudgetVersion(*),
      accounts:BudgetAccount(*),
      lines:BudgetLine(*, amounts:BudgetLineAmount(*)),
      variables:BudgetVariable(*),
      markups:BudgetMarkup(*),
      expenses:Expense(*)
    `)
    .eq('id', budgetId)
    .maybeSingle()
  if (budgetResp.error || !budgetResp.data) {
    throw new Error(`Budget ${budgetId} not found`)
  }
  const budget = budgetResp.data as BudgetTree

  // 2 + 3. Project (for filename + header copy) and ShootDays (for
  // buildEvalContext schedule globals) both key on `budget.projectId` —
  // run them in parallel rather than sequentially.
  const [projectResp, shootDaysResp] = await Promise.all([
    db.from('Project').select('*').eq('id', budget.projectId).maybeSingle(),
    db.from('ShootDay').select('*').eq('projectId', budget.projectId),
  ])
  if (projectResp.error || !projectResp.data) {
    throw new Error(`Project ${budget.projectId} not found`)
  }
  const project = projectResp.data as Project
  if (shootDaysResp.error) throw shootDaysResp.error
  const shootDays = (shootDaysResp.data ?? []) as ShootDay[]

  // 4. Per-version rollup. Same compute pipeline the page renders.
  const rollupByVersionId = new Map<string, BudgetRollup>()
  const evalCtxByVersionId = new Map<string, EvalContext>()
  for (const v of budget.versions) {
    const ctx = buildEvalContext(budget.variables, shootDays, v.id)
    const amountsByLine = new Map<string, BudgetLineAmount | undefined>()
    for (const line of budget.lines) {
      amountsByLine.set(line.id, line.amounts.find(a => a.versionId === v.id))
    }
    const r = rollUpBudget({
      lines: budget.lines,
      amountsByLine,
      accounts: budget.accounts,
      expenses: budget.expenses,
      markups: budget.markups,
      ctx,
      varianceThreshold: Number(budget.varianceThreshold),
      activeVersionId: v.id,
    })
    rollupByVersionId.set(v.id, r)
    evalCtxByVersionId.set(v.id, ctx)
  }

  return { project, budget, shootDays, rollupByVersionId, evalCtxByVersionId }
}

// ── Filename + slug helpers ─────────────────────────────────────────────

export function projectSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    || 'budget'
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// account_path = "ATL/A. Production" or "BTL/B. Shooting Crew Labor".
// Walks parentId chain — sub-accounts append "/<sub-name>".
export function buildAccountPath(account: BudgetAccount, accounts: BudgetAccount[]): string {
  const byId = new Map(accounts.map(a => [a.id, a]))
  const segments: string[] = []
  let cur: BudgetAccount | undefined = account
  while (cur) {
    segments.unshift(`${cur.code}. ${cur.name}`)
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return [account.section, ...segments].join('/')
}

// Resolve the active version requested via ?version= on the export
// routes. Accepts kind aliases and falls back to working/first.
export function resolveActiveVersion(
  versions: BudgetVersion[],
  param: string | null,
): BudgetVersion {
  const sorted = [...versions].sort((a, b) => a.sortOrder - b.sortOrder)
  if (sorted.length === 0) throw new Error('Budget has no versions')
  if (param) {
    const byKind = sorted.find(v => v.kind === param)
    if (byKind) return byKind
    const byName = sorted.find(v => v.name.toLowerCase() === param.toLowerCase())
    if (byName) return byName
  }
  return sorted.find(v => v.kind === 'working') ?? sorted[0]!
}
