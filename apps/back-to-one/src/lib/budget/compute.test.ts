import { describe, it, expect } from 'vitest'
import {
  rollUpBudget,
  buildAccountSubtotals,
  applicableMarkups,
  computeMarkupAmount,
  computeLine,
  buildEvalContext,
  type RollupInput,
} from './compute'
import type {
  BudgetAccount,
  BudgetLine,
  BudgetLineAmount,
  BudgetMarkup,
  BudgetVariable,
  Expense,
  ShootDay,
} from '@/types'

// ── Factories — reduce noise. Every field defaults; override what matters. ──

const ISO = '2026-04-27T00:00:00.000Z'

function account(over: Partial<BudgetAccount> & { id: string; code: string }): BudgetAccount {
  return {
    budgetId: 'B',
    parentId: null,
    section: 'BTL',
    name: `Account ${over.code}`,
    sortOrder: 0,
    createdAt: ISO,
    updatedAt: ISO,
    ...over,
  }
}

function line(over: Partial<BudgetLine> & { id: string; accountId: string }): BudgetLine {
  return {
    budgetId: 'B',
    description: `Line ${over.id}`,
    unit: 'DAY',
    fringeRate: '0',
    tags: [],
    actualsRate: null,
    sortOrder: 0,
    createdAt: ISO,
    updatedAt: ISO,
    ...over,
  }
}

function amount(over: Partial<BudgetLineAmount> & { lineId: string; versionId: string }): BudgetLineAmount {
  return {
    id: `amt-${over.lineId}-${over.versionId}`,
    qty: '1',
    rate: '0',
    notes: null,
    createdAt: ISO,
    updatedAt: ISO,
    ...over,
  }
}

function expense(over: Partial<Expense> & { id: string; lineId: string; amount: string }): Expense {
  return {
    budgetId: 'B',
    source: 'manual',
    date: '2026-04-26',
    units: null,
    unitRate: null,
    unit: null,
    vendor: null,
    notes: null,
    receiptUrl: null,
    timecardId: null,
    createdBy: 'pm-1',
    createdAt: ISO,
    updatedAt: ISO,
    ...over,
  }
}

function markup(over: Partial<BudgetMarkup> & { id: string; appliesTo: 'grandTotal' | 'accountSubtotal'; percent: string }): BudgetMarkup {
  return {
    budgetId: 'B',
    versionId: null,
    name: `Markup ${over.id}`,
    accountId: null,
    sortOrder: 0,
    createdAt: ISO,
    updatedAt: ISO,
    ...over,
  }
}

function buildAmountsByLine(amounts: BudgetLineAmount[], versionId: string): Map<string, BudgetLineAmount | undefined> {
  const m = new Map<string, BudgetLineAmount | undefined>()
  for (const a of amounts) {
    if (a.versionId === versionId) m.set(a.lineId, a)
  }
  return m
}

function defaultRollup(over: Partial<RollupInput> = {}): RollupInput {
  return {
    lines: [],
    amountsByLine: new Map(),
    accounts: [],
    expenses: [],
    markups: [],
    ctx: { schedule: { prepDays: 0, shootDays: 0, postDays: 0 }, variables: {} },
    varianceThreshold: 0.10,
    activeVersionId: 'V',
    ...over,
  }
}

// ── rollUpBudget ─────────────────────────────────────────────────────────

describe('rollUpBudget', () => {
  it('returns zero totals when there are no accounts', () => {
    const r = rollUpBudget(defaultRollup())
    expect(r.preMarkupTotal).toBe(0)
    expect(r.grandTotal).toBe(0)
    expect(r.computedByLine.size).toBe(0)
  })

  it('handles an account with no lines (subtotal = 0)', () => {
    const a = account({ id: 'a1', code: 'A' })
    const r = rollUpBudget(defaultRollup({ accounts: [a] }))
    expect(r.subtotalByAccount.get('a1')!.total).toBe(0)
    expect(r.preMarkupTotal).toBe(0)
  })

  it('rolls up a single line correctly (qty * rate, no fringe)', () => {
    const a = account({ id: 'a1', code: 'A' })
    const l = line({ id: 'l1', accountId: 'a1' })
    const amts = [amount({ lineId: 'l1', versionId: 'V', qty: '5', rate: '100' })]
    const r = rollUpBudget(defaultRollup({
      accounts: [a],
      lines: [l],
      amountsByLine: buildAmountsByLine(amts, 'V'),
    }))
    expect(r.computedByLine.get('l1')!.total).toBe(500)
    expect(r.subtotalByAccount.get('a1')!.total).toBe(500)
    expect(r.preMarkupTotal).toBe(500)
    expect(r.grandTotal).toBe(500)
  })

  it('sums multiple lines in the same account', () => {
    const a = account({ id: 'a1', code: 'A' })
    const l1 = line({ id: 'l1', accountId: 'a1' })
    const l2 = line({ id: 'l2', accountId: 'a1' })
    const l3 = line({ id: 'l3', accountId: 'a1' })
    const amts = [
      amount({ lineId: 'l1', versionId: 'V', qty: '5',  rate: '100' }),  // 500
      amount({ lineId: 'l2', versionId: 'V', qty: '10', rate: '50'  }),  // 500
      amount({ lineId: 'l3', versionId: 'V', qty: '2',  rate: '250' }),  // 500
    ]
    const r = rollUpBudget(defaultRollup({
      accounts: [a],
      lines: [l1, l2, l3],
      amountsByLine: buildAmountsByLine(amts, 'V'),
    }))
    expect(r.subtotalByAccount.get('a1')!.total).toBe(1500)
  })

  it('rolls up a deeply nested tree (grandparent ⊃ parent ⊃ child)', () => {
    const grand  = account({ id: 'gp', code: 'GP', parentId: null })
    const parent = account({ id: 'p',  code: 'P',  parentId: 'gp' })
    const child  = account({ id: 'c',  code: 'C',  parentId: 'p'  })
    // One line in each level — totals should bubble up.
    const lGp = line({ id: 'lgp', accountId: 'gp' })
    const lP  = line({ id: 'lp',  accountId: 'p'  })
    const lC  = line({ id: 'lc',  accountId: 'c'  })
    const amts = [
      amount({ lineId: 'lgp', versionId: 'V', qty: '1', rate: '100' }),  // 100
      amount({ lineId: 'lp',  versionId: 'V', qty: '1', rate: '200' }),  // 200
      amount({ lineId: 'lc',  versionId: 'V', qty: '1', rate: '300' }),  // 300
    ]
    const r = rollUpBudget(defaultRollup({
      accounts: [grand, parent, child],
      lines: [lGp, lP, lC],
      amountsByLine: buildAmountsByLine(amts, 'V'),
    }))
    expect(r.subtotalByAccount.get('c')!.total).toBe(300)
    expect(r.subtotalByAccount.get('p')!.total).toBe(500)   // 200 + 300
    expect(r.subtotalByAccount.get('gp')!.total).toBe(600)  // 100 + 500
    // preMarkupTotal sums root accounts only — gp is the only root.
    expect(r.preMarkupTotal).toBe(600)
  })

  it('treats lines with no amount in the active version as zero', () => {
    const a = account({ id: 'a1', code: 'A' })
    const l1 = line({ id: 'l1', accountId: 'a1' })
    const l2 = line({ id: 'l2', accountId: 'a1' })
    // Only l1 has an amount on version V; l2 does not.
    const amts = [amount({ lineId: 'l1', versionId: 'V', qty: '5', rate: '100' })]
    const r = rollUpBudget(defaultRollup({
      accounts: [a],
      lines: [l1, l2],
      amountsByLine: buildAmountsByLine(amts, 'V'),
    }))
    expect(r.computedByLine.get('l1')!.total).toBe(500)
    expect(r.computedByLine.get('l2')!.total).toBe(0)
    expect(r.subtotalByAccount.get('a1')!.total).toBe(500)
  })
})

// ── buildAccountSubtotals ────────────────────────────────────────────────

describe('buildAccountSubtotals', () => {
  it('computes subtotals for both ATL and BTL accounts in the same pass', () => {
    const atl = account({ id: 'atl', code: 'AA', section: 'ATL' })
    const btl = account({ id: 'btl', code: 'A',  section: 'BTL' })
    const lAtl = line({ id: 'l-atl', accountId: 'atl' })
    const lBtl = line({ id: 'l-btl', accountId: 'btl' })
    const computed = new Map<string, import('./compute').ComputedLine>([
      ['l-atl', { lineId: 'l-atl', qtyFormula: '1', qtyResolved: 1, qtyError: null,
                  rate: 17500, fringeAmt: 0, total: 17500, actuals: 0, varPct: 0, flag: null }],
      ['l-btl', { lineId: 'l-btl', qtyFormula: '1', qtyResolved: 1, qtyError: null,
                  rate: 2500, fringeAmt: 0, total: 2500, actuals: 0, varPct: 0, flag: null }],
    ])
    const subs = buildAccountSubtotals([atl, btl], [lAtl, lBtl], computed)
    expect(subs.get('atl')!.total).toBe(17500)
    expect(subs.get('btl')!.total).toBe(2500)
  })

  it('returns subtotal=0 for an account with no lines', () => {
    const empty = account({ id: 'empty', code: 'F' })
    const subs = buildAccountSubtotals([empty], [], new Map())
    expect(subs.get('empty')!.total).toBe(0)
    expect(subs.get('empty')!.ownTotal).toBe(0)
  })

  it('rolls actuals up the tree alongside totals', () => {
    const parent = account({ id: 'p', code: 'P' })
    const child  = account({ id: 'c', code: 'C', parentId: 'p' })
    const lP = line({ id: 'lp', accountId: 'p' })
    const lC = line({ id: 'lc', accountId: 'c' })
    const computed = new Map<string, import('./compute').ComputedLine>([
      ['lp', { lineId: 'lp', qtyFormula: '1', qtyResolved: 1, qtyError: null,
               rate: 100, fringeAmt: 0, total: 100, actuals:  60, varPct: -0.4, flag: null }],
      ['lc', { lineId: 'lc', qtyFormula: '1', qtyResolved: 1, qtyError: null,
               rate: 200, fringeAmt: 0, total: 200, actuals: 250, varPct:  0.25, flag: 'over' }],
    ])
    const subs = buildAccountSubtotals([parent, child], [lP, lC], computed)
    expect(subs.get('c')!.totalActuals).toBe(250)
    expect(subs.get('p')!.totalActuals).toBe(310)  // 60 + 250
  })
})

// ── applicableMarkups ────────────────────────────────────────────────────

describe('applicableMarkups', () => {
  it('includes markups with versionId === null (apply to all versions)', () => {
    const m = markup({ id: 'm1', appliesTo: 'grandTotal', percent: '0.05', versionId: null })
    expect(applicableMarkups([m], 'V')).toEqual([m])
  })

  it('includes markups whose versionId matches the active version', () => {
    const m = markup({ id: 'm1', appliesTo: 'grandTotal', percent: '0.05', versionId: 'V' })
    expect(applicableMarkups([m], 'V')).toEqual([m])
  })

  it('excludes markups whose versionId does NOT match', () => {
    const m = markup({ id: 'm1', appliesTo: 'grandTotal', percent: '0.05', versionId: 'OTHER' })
    expect(applicableMarkups([m], 'V')).toEqual([])
  })
})

// ── computeMarkupAmount ──────────────────────────────────────────────────

describe('computeMarkupAmount', () => {
  it('applies grandTotal markup as percent of pre-markup total', () => {
    const m = markup({ id: 'm1', appliesTo: 'grandTotal', percent: '0.05' })
    expect(computeMarkupAmount(m, 100_000, new Map())).toBe(5_000)
  })

  it('applies accountSubtotal markup to the targeted account total', () => {
    const m = markup({ id: 'm1', appliesTo: 'accountSubtotal', percent: '0.10', accountId: 'btl' })
    const subs = new Map([
      ['atl', { accountId: 'atl', ownTotal: 100, total: 100, ownActuals: 0, totalActuals: 0 }],
      ['btl', { accountId: 'btl', ownTotal: 200, total: 200, ownActuals: 0, totalActuals: 0 }],
    ])
    expect(computeMarkupAmount(m, 999, subs)).toBe(20)  // 200 × 0.10 — pre-markup ignored
  })

  it('returns 0 when accountSubtotal markup has no accountId', () => {
    const m = markup({ id: 'm1', appliesTo: 'accountSubtotal', percent: '0.10', accountId: null })
    expect(computeMarkupAmount(m, 999, new Map())).toBe(0)
  })

  it('integrates: applicable markups roll into grandTotal in rollUpBudget', () => {
    const a = account({ id: 'a1', code: 'A' })
    const l = line({ id: 'l1', accountId: 'a1' })
    const amts = [amount({ lineId: 'l1', versionId: 'V', qty: '1', rate: '100' })]  // 100 pre-markup
    const m = markup({ id: 'm1', appliesTo: 'grandTotal', percent: '0.10' })       // +10
    const r = rollUpBudget(defaultRollup({
      accounts: [a],
      lines: [l],
      amountsByLine: buildAmountsByLine(amts, 'V'),
      markups: [m],
    }))
    expect(r.preMarkupTotal).toBe(100)
    expect(r.markupAmounts).toEqual([{ markupId: 'm1', amount: 10 }])
    expect(r.grandTotal).toBe(110)
  })
})

// ── Variance edges ───────────────────────────────────────────────────────

describe('computeLine variance', () => {
  const ctx = { schedule: { prepDays: 0, shootDays: 0, postDays: 0 }, variables: {} }

  it('returns null flag and varPct=0 when total === 0 (no division by zero)', () => {
    const l = line({ id: 'l1', accountId: 'a1' })
    const c = computeLine(l, undefined, [], ctx, 0.10)
    expect(c.total).toBe(0)
    expect(c.varPct).toBe(0)
    expect(c.flag).toBe(null)
    expect(Number.isFinite(c.varPct)).toBe(true)   // not NaN, not Infinity
  })

  it('flags warn exactly at threshold (boundary: not over yet, but past half-threshold)', () => {
    // The compute pipeline layers a 'warn' tier between half-threshold and
    // threshold (mockup has three variance colors: over / warn / under).
    // At exactly threshold, abs(varPct) > threshold is FALSE, so 'over' is
    // skipped — but it IS > half-threshold, so 'warn' fires.
    const l = line({ id: 'l1', accountId: 'a1' })
    const a = amount({ lineId: 'l1', versionId: 'V', qty: '1', rate: '100' })  // total 100
    const e = expense({ id: 'e1', lineId: 'l1', amount: '110' })                // actuals 110 → varPct = 0.10
    const c = computeLine(l, a, [e], ctx, 0.10)
    expect(c.varPct).toBeCloseTo(0.10, 6)
    expect(c.flag).toBe('warn')
  })

  it('returns null flag well within threshold (abs(varPct) < half-threshold)', () => {
    const l = line({ id: 'l1', accountId: 'a1' })
    const a = amount({ lineId: 'l1', versionId: 'V', qty: '1', rate: '100' })  // total 100
    const e = expense({ id: 'e1', lineId: 'l1', amount: '102' })                // varPct = 0.02
    const c = computeLine(l, a, [e], ctx, 0.10)
    expect(c.flag).toBe(null)
  })

  it('flags over when actuals exceed total beyond threshold', () => {
    const l = line({ id: 'l1', accountId: 'a1' })
    const a = amount({ lineId: 'l1', versionId: 'V', qty: '1', rate: '100' })  // total 100
    const e = expense({ id: 'e1', lineId: 'l1', amount: '125' })                // actuals 125 → varPct = 0.25
    const c = computeLine(l, a, [e], ctx, 0.10)
    expect(c.flag).toBe('over')
  })

  it('flags under when actuals fall short beyond threshold', () => {
    const l = line({ id: 'l1', accountId: 'a1' })
    const a = amount({ lineId: 'l1', versionId: 'V', qty: '1', rate: '100' })  // total 100
    const e = expense({ id: 'e1', lineId: 'l1', amount: '80' })                  // actuals 80 → varPct = -0.20
    const c = computeLine(l, a, [e], ctx, 0.10)
    expect(c.flag).toBe('under')
  })

  it('flags warn at half-threshold (between 0.5×threshold and threshold)', () => {
    const l = line({ id: 'l1', accountId: 'a1' })
    const a = amount({ lineId: 'l1', versionId: 'V', qty: '1', rate: '100' })  // total 100
    const e = expense({ id: 'e1', lineId: 'l1', amount: '107' })                // varPct = 0.07
    const c = computeLine(l, a, [e], ctx, 0.10)
    expect(c.flag).toBe('warn')
  })
})

// ── Fringe edges ─────────────────────────────────────────────────────────

describe('computeLine fringe', () => {
  const ctx = { schedule: { prepDays: 0, shootDays: 0, postDays: 0 }, variables: {} }

  it('0% fringe: total = qty * rate, no markup', () => {
    const l = line({ id: 'l1', accountId: 'a1', fringeRate: '0' })
    const a = amount({ lineId: 'l1', versionId: 'V', qty: '5', rate: '100' })
    const c = computeLine(l, a, [], ctx, 0.10)
    expect(c.fringeAmt).toBe(0)
    expect(c.total).toBe(500)
  })

  it('default 8.3% fringe: total = qty * rate * 1.083', () => {
    const l = line({ id: 'l1', accountId: 'a1', fringeRate: '0.083' })
    const a = amount({ lineId: 'l1', versionId: 'V', qty: '10', rate: '100' })
    const c = computeLine(l, a, [], ctx, 0.10)
    expect(c.fringeAmt).toBeCloseTo(83, 6)         // 10 * 100 * 0.083
    expect(c.total).toBeCloseTo(1083, 6)            // 1000 + 83
  })

  it('mixed fringes across an account roll up correctly', () => {
    const acc = account({ id: 'a1', code: 'A' })
    const lA = line({ id: 'la', accountId: 'a1', fringeRate: '0'    })  // no fringe
    const lB = line({ id: 'lb', accountId: 'a1', fringeRate: '0.18' })  // 18% — labor
    const lC = line({ id: 'lc', accountId: 'a1', fringeRate: '0.083' }) // 8.3% — admin
    const amts = [
      amount({ lineId: 'la', versionId: 'V', qty: '1', rate: '1000' }),  // 1000   + 0      = 1000
      amount({ lineId: 'lb', versionId: 'V', qty: '1', rate: '1000' }),  // 1000   + 180    = 1180
      amount({ lineId: 'lc', versionId: 'V', qty: '1', rate: '1000' }),  // 1000   + 83     = 1083
    ]
    const r = rollUpBudget(defaultRollup({
      accounts: [acc],
      lines: [lA, lB, lC],
      amountsByLine: buildAmountsByLine(amts, 'V'),
    }))
    expect(r.subtotalByAccount.get('a1')!.total).toBeCloseTo(3263, 6)  // 1000 + 1180 + 1083
  })
})

// ── buildEvalContext ─────────────────────────────────────────────────────

describe('buildEvalContext', () => {
  function shootDay(over: { type: 'pre' | 'prod' | 'post' }): ShootDay {
    return {
      id: `sd-${over.type}`, projectId: 'P', date: '2026-04-26',
      type: over.type, notes: null, locationId: null, sortOrder: 0,
      createdAt: ISO, updatedAt: ISO,
    }
  }
  function variable(over: Partial<BudgetVariable> & { name: string; value: string }): BudgetVariable {
    return {
      id: `var-${over.name}-${over.versionId ?? 'null'}`,
      budgetId: 'B', versionId: null, notes: null,
      createdAt: ISO, updatedAt: ISO,
      ...over,
    }
  }

  it('counts ShootDays into the schedule globals by type', () => {
    const days = [shootDay({ type: 'pre' }), shootDay({ type: 'prod' }), shootDay({ type: 'prod' }), shootDay({ type: 'post' })]
    const ctx = buildEvalContext([], days, 'V')
    expect(ctx.schedule).toEqual({ prepDays: 1, shootDays: 2, postDays: 1 })
  })

  it('handles undefined ShootDays as zero counts', () => {
    const ctx = buildEvalContext([], undefined, null)
    expect(ctx.schedule).toEqual({ prepDays: 0, shootDays: 0, postDays: 0 })
  })

  it('overlays version-scoped variables on top of budget-level (by name)', () => {
    const vars = [
      variable({ name: 'crewSize', value: '12', versionId: null }),
      variable({ name: 'crewSize', value: '14', versionId: 'WORKING' }),
      variable({ name: 'mealRate', value: '25', versionId: null }),
    ]
    const ctx = buildEvalContext(vars, [], 'WORKING')
    expect(ctx.variables.crewSize).toBe('14')   // version override wins
    expect(ctx.variables.mealRate).toBe('25')   // budget-level passes through
  })

  it('uses budget-level only when activeVersionId is null', () => {
    const vars = [
      variable({ name: 'crewSize', value: '12', versionId: null }),
      variable({ name: 'crewSize', value: '14', versionId: 'WORKING' }),
    ]
    const ctx = buildEvalContext(vars, [], null)
    expect(ctx.variables.crewSize).toBe('12')
  })
})
