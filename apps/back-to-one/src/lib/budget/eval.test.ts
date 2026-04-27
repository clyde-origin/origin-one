import { describe, it, expect } from 'vitest'
import { evaluate, RESERVED_NAMES, type EvalContext } from './eval'

// Empty context helper — no schedule globals, no variables.
const emptyCtx: EvalContext = {
  schedule: { prepDays: 0, shootDays: 0, postDays: 0 },
  variables: {},
}

const ctxWithSchedule = (sched: Partial<EvalContext['schedule']>): EvalContext => ({
  schedule: { prepDays: 0, shootDays: 0, postDays: 0, ...sched },
  variables: {},
})

const ctxWithVars = (variables: Record<string, string>): EvalContext => ({
  schedule: { prepDays: 0, shootDays: 0, postDays: 0 },
  variables,
})

// ── Numeric literals ────────────────────────────────────────────────────

describe('numeric literals', () => {
  it('parses an integer', () => {
    expect(evaluate('42', emptyCtx)).toEqual({ ok: true, value: 42 })
  })

  it('parses zero', () => {
    expect(evaluate('0', emptyCtx)).toEqual({ ok: true, value: 0 })
  })

  it('parses a float', () => {
    expect(evaluate('3.14', emptyCtx)).toEqual({ ok: true, value: 3.14 })
  })

  it('parses a float without leading zero (.5)', () => {
    // Per grammar: number := /[0-9]+(\.[0-9]+)?/  — leading digit required.
    // ".5" is a parse error per the documented grammar.
    const result = evaluate('.5', emptyCtx)
    expect(result.ok).toBe(false)
  })

  it('parses a multi-digit float', () => {
    expect(evaluate('123.456', emptyCtx)).toEqual({ ok: true, value: 123.456 })
  })

  it('handles whitespace around a literal', () => {
    expect(evaluate('  42  ', emptyCtx)).toEqual({ ok: true, value: 42 })
  })
})

// ── Arithmetic operators ────────────────────────────────────────────────

describe('arithmetic operators', () => {
  it('adds two numbers', () => {
    expect(evaluate('2 + 3', emptyCtx)).toEqual({ ok: true, value: 5 })
  })

  it('subtracts two numbers', () => {
    expect(evaluate('5 - 2', emptyCtx)).toEqual({ ok: true, value: 3 })
  })

  it('multiplies two numbers', () => {
    expect(evaluate('4 * 5', emptyCtx)).toEqual({ ok: true, value: 20 })
  })

  it('divides two numbers', () => {
    expect(evaluate('10 / 4', emptyCtx)).toEqual({ ok: true, value: 2.5 })
  })

  it('chains addition and subtraction left-to-right', () => {
    expect(evaluate('1 + 2 - 3 + 4', emptyCtx)).toEqual({ ok: true, value: 4 })
  })

  it('respects operator precedence — multiplication before addition', () => {
    expect(evaluate('2 + 3 * 4', emptyCtx)).toEqual({ ok: true, value: 14 })
  })

  it('respects operator precedence — division before subtraction', () => {
    expect(evaluate('20 - 10 / 2', emptyCtx)).toEqual({ ok: true, value: 15 })
  })
})

// ── Parentheses ─────────────────────────────────────────────────────────

describe('parentheses', () => {
  it('overrides default precedence', () => {
    expect(evaluate('(2 + 3) * 4', emptyCtx)).toEqual({ ok: true, value: 20 })
  })

  it('handles nested parens', () => {
    expect(evaluate('((1 + 2) * (3 + 4))', emptyCtx)).toEqual({ ok: true, value: 21 })
  })

  it('returns a parse error on unbalanced opening paren', () => {
    const result = evaluate('(1 + 2', emptyCtx)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('parse_error')
  })

  it('returns a parse error on unbalanced closing paren', () => {
    const result = evaluate('1 + 2)', emptyCtx)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('parse_error')
  })
})

// ── Unary minus ─────────────────────────────────────────────────────────

describe('unary minus', () => {
  it('negates a literal', () => {
    expect(evaluate('-5', emptyCtx)).toEqual({ ok: true, value: -5 })
  })

  it('combines with addition', () => {
    expect(evaluate('-5 + 3', emptyCtx)).toEqual({ ok: true, value: -2 })
  })

  it('combines with multiplication', () => {
    expect(evaluate('-5 * 2', emptyCtx)).toEqual({ ok: true, value: -10 })
  })

  it('applies to a parenthesized expression', () => {
    expect(evaluate('-(2 + 3)', emptyCtx)).toEqual({ ok: true, value: -5 })
  })

  it('applies to an identifier', () => {
    expect(evaluate('-shootDays', ctxWithSchedule({ shootDays: 8 }))).toEqual({ ok: true, value: -8 })
  })

  it('handles double negation', () => {
    expect(evaluate('--5', emptyCtx)).toEqual({ ok: true, value: 5 })
  })
})

// ── Identifier resolution — reserved schedule globals ───────────────────

describe('reserved schedule globals', () => {
  it('exposes prepDays, shootDays, postDays as reserved names', () => {
    expect(RESERVED_NAMES).toEqual(['prepDays', 'shootDays', 'postDays'])
  })

  it('resolves shootDays from context', () => {
    expect(evaluate('shootDays', ctxWithSchedule({ shootDays: 8 }))).toEqual({ ok: true, value: 8 })
  })

  it('resolves prepDays from context', () => {
    expect(evaluate('prepDays', ctxWithSchedule({ prepDays: 5 }))).toEqual({ ok: true, value: 5 })
  })

  it('resolves postDays from context', () => {
    expect(evaluate('postDays', ctxWithSchedule({ postDays: 3 }))).toEqual({ ok: true, value: 3 })
  })

  it('resolves shootDays inside arithmetic', () => {
    // The classic spec example — shootDays * 2 + 1
    expect(evaluate('shootDays * 2 + 1', ctxWithSchedule({ shootDays: 12 }))).toEqual({ ok: true, value: 25 })
  })

  it('returns 0 when a schedule global is not in context (default)', () => {
    expect(evaluate('shootDays', emptyCtx)).toEqual({ ok: true, value: 0 })
  })
})

// ── Identifier resolution — user-defined variables ──────────────────────

describe('user-defined variables', () => {
  it('resolves a numeric variable', () => {
    expect(evaluate('crewSize', ctxWithVars({ crewSize: '12' }))).toEqual({ ok: true, value: 12 })
  })

  it('resolves a float variable', () => {
    expect(evaluate('rate', ctxWithVars({ rate: '7.5' }))).toEqual({ ok: true, value: 7.5 })
  })

  it('uses a variable in arithmetic', () => {
    expect(evaluate('crewSize * 25', ctxWithVars({ crewSize: '12' }))).toEqual({ ok: true, value: 300 })
  })

  it('resolves a variable that references another variable', () => {
    expect(evaluate('a', ctxWithVars({ a: 'b + 1', b: '5' }))).toEqual({ ok: true, value: 6 })
  })

  it('resolves a variable that uses schedule globals inside its formula', () => {
    const ctx: EvalContext = {
      schedule: { prepDays: 0, shootDays: 12, postDays: 0 },
      variables: { totalDays: 'shootDays * 2' },
    }
    expect(evaluate('totalDays', ctx)).toEqual({ ok: true, value: 24 })
  })

  it('returns unknown_identifier (typed) for missing names', () => {
    const result = evaluate('foo', emptyCtx)
    expect(result).toEqual({ ok: false, error: { kind: 'unknown_identifier', name: 'foo' } })
  })

  it('returns unknown_identifier when a missing name is used in arithmetic', () => {
    const result = evaluate('foo + 1', emptyCtx)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('unknown_identifier')
  })

  it('does NOT throw on unknown identifier — returns typed error', () => {
    expect(() => evaluate('foo', emptyCtx)).not.toThrow()
  })
})

// ── Cycle detection ─────────────────────────────────────────────────────

describe('cycle detection', () => {
  it('detects a direct self-reference', () => {
    const result = evaluate('x', ctxWithVars({ x: 'x' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('cycle')
  })

  it('detects an indirect 2-step cycle (x→y→x)', () => {
    const result = evaluate('x', ctxWithVars({ x: 'y', y: 'x' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('cycle')
  })

  it('detects a 3-step cycle (a→b→c→a)', () => {
    const result = evaluate('a', ctxWithVars({ a: 'b', b: 'c', c: 'a' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('cycle')
  })

  it('detects a depth ≥ 8 deep chain that loops back', () => {
    // Builds 9-level chain: v0→v1→…→v8→v0
    const variables: Record<string, string> = {}
    for (let i = 0; i < 9; i++) variables[`v${i}`] = `v${(i + 1) % 9}`
    const result = evaluate('v0', { schedule: { prepDays: 0, shootDays: 0, postDays: 0 }, variables })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('cycle')
  })

  it('does NOT throw on cycle — returns typed error', () => {
    expect(() => evaluate('x', ctxWithVars({ x: 'x' }))).not.toThrow()
  })

  it('a non-cyclic chain of 7 levels evaluates correctly (well under depth limit)', () => {
    const variables: Record<string, string> = {}
    for (let i = 0; i < 6; i++) variables[`v${i}`] = `v${i + 1}`
    variables['v6'] = '42'
    expect(evaluate('v0', { schedule: { prepDays: 0, shootDays: 0, postDays: 0 }, variables }))
      .toEqual({ ok: true, value: 42 })
  })
})

// ── Division by zero ────────────────────────────────────────────────────

describe('division by zero', () => {
  it('returns div_by_zero (typed) for literal / 0', () => {
    expect(evaluate('1 / 0', emptyCtx)).toEqual({ ok: false, error: { kind: 'div_by_zero' } })
  })

  it('returns div_by_zero when divisor evaluates to 0', () => {
    const result = evaluate('5 / (3 - 3)', emptyCtx)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('div_by_zero')
  })

  it('does NOT return Infinity', () => {
    const result = evaluate('1 / 0', emptyCtx)
    if (result.ok) expect(result.value).not.toBe(Infinity)
    else expect(result.error.kind).toBe('div_by_zero')
  })

  it('does NOT return NaN for 0 / 0', () => {
    const result = evaluate('0 / 0', emptyCtx)
    if (result.ok) expect(Number.isNaN(result.value)).toBe(false)
    else expect(result.error.kind).toBe('div_by_zero')
  })

  it('does NOT throw on division by zero — returns typed error', () => {
    expect(() => evaluate('1 / 0', emptyCtx)).not.toThrow()
  })
})

// ── Parse errors ────────────────────────────────────────────────────────

describe('parse errors', () => {
  it('returns parse_error with position on unknown operator', () => {
    const result = evaluate('1 ^ 2', emptyCtx)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('parse_error')
      // Position info present (number, ≥ 0)
      if (result.error.kind === 'parse_error') {
        expect(typeof result.error.pos).toBe('number')
        expect(result.error.pos).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('returns parse_error on empty input', () => {
    const result = evaluate('', emptyCtx)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('parse_error')
  })

  it('returns parse_error on dangling operator', () => {
    const result = evaluate('1 +', emptyCtx)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('parse_error')
  })

  it('returns parse_error on stray closing paren', () => {
    const result = evaluate('1 + 2)', emptyCtx)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('parse_error')
  })

  it('does NOT throw on parse error — returns typed error', () => {
    expect(() => evaluate('1 ^ 2', emptyCtx)).not.toThrow()
  })
})

// ── Hostile / non-grammar input ─────────────────────────────────────────

describe('hostile input', () => {
  it('rejects JavaScript-shaped input (no eval, no Function)', () => {
    // If the evaluator used `eval` or `Function`, this would log "pwn"
    // or similar. Our parser MUST reject — only the grammar's vocabulary
    // is allowed.
    const result = evaluate('console.log("pwn")', emptyCtx)
    expect(result.ok).toBe(false)
  })

  it('rejects bracket access', () => {
    const result = evaluate('a[0]', emptyCtx)
    expect(result.ok).toBe(false)
  })

  it('rejects function-call syntax', () => {
    const result = evaluate('f(1)', emptyCtx)
    expect(result.ok).toBe(false)
  })

  it('handles a long flat expression without stack overflow', () => {
    // 1000-term sum — exercises the parser's iterative chains.
    const expr = '1' + '+1'.repeat(1000)
    expect(evaluate(expr, emptyCtx)).toEqual({ ok: true, value: 1001 })
  })
})
