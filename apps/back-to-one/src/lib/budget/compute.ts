// Budget computation pipeline — pure, memoize-friendly.
//
// Spec §4.6:
//   For each line in a given version:
//     qty       = evaluate(amount.qty, variables, scheduleGlobals)
//     rate      = amount.rate
//     fringeAmt = qty * rate * line.fringeRate
//     total     = qty * rate + fringeAmt
//     actuals   = sum(expense.amount where expense.lineId = line.id)
//     varPct    = (actuals - total) / total
//     flag      = abs(varPct) > threshold ? 'over' / 'under' : null
//
// Subtotals roll up the account tree. Markups apply to grandTotal or
// accountSubtotal per BudgetMarkup.appliesTo.

import { evaluate, type EvalContext, type EvalError } from './eval'
import type {
  BudgetAccount,
  BudgetLine,
  BudgetLineAmount,
  BudgetMarkup,
  BudgetVariable,
  Expense,
  ShootDayType,
} from '@/types'

export interface ComputedLine {
  lineId: string
  qtyFormula: string         // raw string for display ("shootDays * 2")
  qtyResolved: number
  qtyError: string | null     // human-readable error, null if OK
  rate: number
  fringeAmt: number
  total: number              // qty*rate + fringeAmt
  actuals: number
  varPct: number             // (actuals - total) / total; 0 if total === 0
  flag: 'over' | 'warn' | 'under' | null
}

export interface AccountSubtotal {
  accountId: string
  ownTotal: number           // sum of this account's own lines (no descendants)
  total: number              // ownTotal + sum of descendant subtotals
  ownActuals: number
  totalActuals: number
}

export interface ComputedMarkup {
  markupId: string
  amount: number
}

export interface BudgetRollup {
  computedByLine: Map<string, ComputedLine>
  subtotalByAccount: Map<string, AccountSubtotal>
  preMarkupTotal: number
  preMarkupActuals: number
  markupAmounts: ComputedMarkup[]
  grandTotal: number          // preMarkupTotal + sum(markupAmounts)
  grandActuals: number        // preMarkupActuals (markups don't accrue actuals)
}

// ── Eval context ─────────────────────────────────────────────────────────

/**
 * Build the EvalContext for a given budget + version. Schedule globals
 * derived from ShootDay counts (spec §5.3); user variables are version-
 * scoped overlay over budget-level.
 */
export function buildEvalContext(
  variables: BudgetVariable[],
  shootDays: { type: ShootDayType }[] | null | undefined,
  activeVersionId: string | null,
): EvalContext {
  const schedule = { prepDays: 0, shootDays: 0, postDays: 0 }
  for (const d of shootDays ?? []) {
    if (d.type === 'pre')       schedule.prepDays++
    else if (d.type === 'prod') schedule.shootDays++
    else if (d.type === 'post') schedule.postDays++
  }

  // Budget-level (versionId === null) first, then version-scoped overrides.
  const vars: Record<string, string> = {}
  for (const v of variables) {
    if (v.versionId == null) vars[v.name] = v.value
  }
  if (activeVersionId) {
    for (const v of variables) {
      if (v.versionId === activeVersionId) vars[v.name] = v.value
    }
  }
  return { schedule, variables: vars }
}

// ── Per-line ─────────────────────────────────────────────────────────────

export function computeLine(
  line: BudgetLine,
  amount: BudgetLineAmount | undefined,
  expensesForLine: Expense[],
  ctx: EvalContext,
  varianceThreshold: number,
): ComputedLine {
  const qtyFormula = amount?.qty ?? '0'
  const qtyEval = evaluate(qtyFormula, ctx)
  const qtyResolved = qtyEval.ok ? qtyEval.value : 0
  const qtyError = qtyEval.ok ? null : describeEvalError(qtyEval.error)

  const rate = amount ? Number(amount.rate) : 0
  const fringeRate = Number(line.fringeRate)
  const fringeAmt = qtyResolved * rate * fringeRate
  const total = qtyResolved * rate + fringeAmt

  const actuals = expensesForLine.reduce((s, e) => s + Number(e.amount), 0)
  const varPct = total === 0 ? 0 : (actuals - total) / total
  const absPct = Math.abs(varPct)
  const flag: ComputedLine['flag'] =
    total === 0 ? null
    : absPct > varianceThreshold ? (varPct > 0 ? 'over' : 'under')
    : absPct > varianceThreshold * 0.5 ? 'warn'
    : null

  return { lineId: line.id, qtyFormula, qtyResolved, qtyError, rate, fringeAmt, total, actuals, varPct, flag }
}

function describeEvalError(err: EvalError): string {
  switch (err.kind) {
    case 'parse_error':       return `parse error at ${err.pos}: ${err.message}`
    case 'unknown_identifier': return `unknown variable: ${err.name}`
    case 'cycle':             return `cycle in variable: ${err.name}`
    case 'div_by_zero':       return 'division by zero'
  }
}

// ── Account subtotals (tree rollup) ──────────────────────────────────────

/**
 * Roll up account totals through the parent/child tree.
 * Each account's `total` = ownLines + sum(descendant.total).
 * Same for actuals.
 */
export function buildAccountSubtotals(
  accounts: BudgetAccount[],
  lines: BudgetLine[],
  computedByLine: Map<string, ComputedLine>,
): Map<string, AccountSubtotal> {
  // Group lines by account.
  const linesByAccount = new Map<string, BudgetLine[]>()
  for (const l of lines) {
    const arr = linesByAccount.get(l.accountId) ?? []
    arr.push(l)
    linesByAccount.set(l.accountId, arr)
  }

  // Group child accounts by parent.
  const childrenByParent = new Map<string, BudgetAccount[]>()
  for (const a of accounts) {
    if (a.parentId) {
      const arr = childrenByParent.get(a.parentId) ?? []
      arr.push(a)
      childrenByParent.set(a.parentId, arr)
    }
  }

  const result = new Map<string, AccountSubtotal>()
  function visit(accountId: string): AccountSubtotal {
    const cached = result.get(accountId)
    if (cached) return cached

    let ownTotal = 0
    let ownActuals = 0
    for (const line of linesByAccount.get(accountId) ?? []) {
      const c = computedByLine.get(line.id)
      if (c) {
        ownTotal   += c.total
        ownActuals += c.actuals
      }
    }
    let descTotal = 0
    let descActuals = 0
    for (const child of childrenByParent.get(accountId) ?? []) {
      const childSub = visit(child.id)
      descTotal   += childSub.total
      descActuals += childSub.totalActuals
    }
    const sub: AccountSubtotal = {
      accountId,
      ownTotal,
      total: ownTotal + descTotal,
      ownActuals,
      totalActuals: ownActuals + descActuals,
    }
    result.set(accountId, sub)
    return sub
  }
  for (const a of accounts) visit(a.id)
  return result
}

// ── Markups ──────────────────────────────────────────────────────────────

/**
 * A markup applies if it's either (a) versionId === null (all versions) or
 * (b) versionId === activeVersionId.
 */
export function applicableMarkups(
  markups: BudgetMarkup[],
  activeVersionId: string | null,
): BudgetMarkup[] {
  return markups.filter(m => m.versionId == null || m.versionId === activeVersionId)
}

export function computeMarkupAmount(
  markup: BudgetMarkup,
  preMarkupTotal: number,
  subtotalByAccount: Map<string, AccountSubtotal>,
): number {
  const pct = Number(markup.percent)
  if (markup.appliesTo === 'grandTotal') {
    return preMarkupTotal * pct
  }
  if (markup.appliesTo === 'accountSubtotal' && markup.accountId) {
    const sub = subtotalByAccount.get(markup.accountId)
    return sub ? sub.total * pct : 0
  }
  return 0
}

// ── Top-level orchestration ──────────────────────────────────────────────

export interface RollupInput {
  lines: BudgetLine[]
  amountsByLine: Map<string, BudgetLineAmount | undefined>   // for active version
  accounts: BudgetAccount[]
  expenses: Expense[]
  markups: BudgetMarkup[]
  ctx: EvalContext
  varianceThreshold: number
  activeVersionId: string | null
}

export function rollUpBudget(input: RollupInput): BudgetRollup {
  // Group expenses by lineId once.
  const expensesByLine = new Map<string, Expense[]>()
  for (const e of input.expenses) {
    const arr = expensesByLine.get(e.lineId) ?? []
    arr.push(e)
    expensesByLine.set(e.lineId, arr)
  }

  const computedByLine = new Map<string, ComputedLine>()
  for (const line of input.lines) {
    const amount = input.amountsByLine.get(line.id)
    const expensesForLine = expensesByLine.get(line.id) ?? []
    const c = computeLine(line, amount, expensesForLine, input.ctx, input.varianceThreshold)
    computedByLine.set(line.id, c)
  }

  const subtotalByAccount = buildAccountSubtotals(input.accounts, input.lines, computedByLine)

  // Pre-markup grand: sum totals of root accounts (parentId === null).
  // Skipping the per-account-rollup-then-sum approach so we don't double-count
  // descendants — root totals already include them.
  let preMarkupTotal = 0
  let preMarkupActuals = 0
  for (const a of input.accounts) {
    if (a.parentId == null) {
      const sub = subtotalByAccount.get(a.id)
      if (sub) {
        preMarkupTotal   += sub.total
        preMarkupActuals += sub.totalActuals
      }
    }
  }

  const applicable = applicableMarkups(input.markups, input.activeVersionId)
  const markupAmounts: ComputedMarkup[] = applicable.map(m => ({
    markupId: m.id,
    amount: computeMarkupAmount(m, preMarkupTotal, subtotalByAccount),
  }))
  const totalMarkups = markupAmounts.reduce((s, m) => s + m.amount, 0)

  return {
    computedByLine,
    subtotalByAccount,
    preMarkupTotal,
    preMarkupActuals,
    markupAmounts,
    grandTotal: preMarkupTotal + totalMarkups,
    grandActuals: preMarkupActuals,
  }
}
