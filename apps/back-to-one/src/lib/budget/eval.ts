// Expression evaluator for budget line qty + variable values.
//
// Restricted grammar (spec §4.1):
//   expr        := term (('+' | '-') term)*
//   term        := factor (('*' | '/') factor)*
//   factor      := number | identifier | '(' expr ')' | '-' factor
//   number      := /[0-9]+(\.[0-9]+)?/
//   identifier  := /[a-zA-Z_][a-zA-Z0-9_]*/
//
// Hand-written recursive descent. NO eval, NO Function constructor, NO
// string ops, NO I/O. Errors are returned as typed values via the
// `EvalResult` discriminated union — never thrown to the caller. (Internal
// implementation uses an EvalAbort sentinel exception to short-circuit
// deep recursion; the top-level catches it and returns the typed error.)

export interface EvalContext {
  // Reserved schedule globals — derived at call site, NOT stored. Defaults
  // to 0 if a global isn't relevant for this expression's caller.
  schedule: { prepDays: number; shootDays: number; postDays: number }
  // Variables: caller pre-resolves version-scoped overlay over budget-level.
  // Maps name → raw value string (formula or numeric literal).
  variables: Record<string, string>
}

export type EvalError =
  | { kind: 'parse_error'; message: string; pos: number }
  | { kind: 'unknown_identifier'; name: string }
  | { kind: 'cycle'; name: string }
  | { kind: 'div_by_zero' }

export type EvalResult =
  | { ok: true; value: number }
  | { ok: false; error: EvalError }

export const RESERVED_NAMES = ['prepDays', 'shootDays', 'postDays'] as const
type Reserved = typeof RESERVED_NAMES[number]

const MAX_RECURSION_DEPTH = 8

// ── Internal types ───────────────────────────────────────────────────────

type Node =
  | { kind: 'number'; value: number }
  | { kind: 'ident'; name: string }
  | { kind: 'unary'; op: '-'; operand: Node }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/'; left: Node; right: Node }

class EvalAbort extends Error {
  constructor(public readonly evalError: EvalError) {
    super(evalError.kind)
  }
}

// ── Public entry point ───────────────────────────────────────────────────

export function evaluate(expr: string, ctx: EvalContext): EvalResult {
  try {
    const parser = new Parser(expr)
    const ast = parser.parseExpr()
    parser.expectEnd()
    const value = evaluateNode(ast, ctx, new Set())
    return { ok: true, value }
  } catch (e) {
    if (e instanceof EvalAbort) return { ok: false, error: e.evalError }
    throw e // unexpected error — surface
  }
}

// ── Parser ───────────────────────────────────────────────────────────────

class Parser {
  private i = 0
  constructor(private readonly src: string) {}

  parseExpr(): Node {
    let left = this.parseTerm()
    while (true) {
      this.skipWs()
      const ch = this.peek()
      if (ch !== '+' && ch !== '-') break
      this.i++
      const right = this.parseTerm()
      left = { kind: 'binary', op: ch, left, right }
    }
    return left
  }

  parseTerm(): Node {
    let left = this.parseFactor()
    while (true) {
      this.skipWs()
      const ch = this.peek()
      if (ch !== '*' && ch !== '/') break
      this.i++
      const right = this.parseFactor()
      left = { kind: 'binary', op: ch, left, right }
    }
    return left
  }

  parseFactor(): Node {
    this.skipWs()
    const start = this.i
    const ch = this.peek()

    // Unary minus
    if (ch === '-') {
      this.i++
      const operand = this.parseFactor()
      return { kind: 'unary', op: '-', operand }
    }

    // Parenthesized expression
    if (ch === '(') {
      this.i++
      const inner = this.parseExpr()
      this.skipWs()
      if (this.peek() !== ')') {
        throw new EvalAbort({ kind: 'parse_error', message: 'expected closing paren', pos: this.i })
      }
      this.i++
      return inner
    }

    // Numeric literal — leading digit required (no .5 shorthand)
    if (ch !== null && isDigit(ch)) {
      let end = this.i
      while (end < this.src.length && isDigit(this.src[end]!)) end++
      if (end < this.src.length && this.src[end] === '.') {
        end++
        if (end >= this.src.length || !isDigit(this.src[end]!)) {
          throw new EvalAbort({ kind: 'parse_error', message: 'expected digit after decimal point', pos: end })
        }
        while (end < this.src.length && isDigit(this.src[end]!)) end++
      }
      const lit = this.src.slice(this.i, end)
      this.i = end
      return { kind: 'number', value: Number.parseFloat(lit) }
    }

    // Identifier — letter/_ start, alphanumeric/_ tail
    if (ch !== null && isIdentStart(ch)) {
      let end = this.i
      while (end < this.src.length && isIdentTail(this.src[end]!)) end++
      const name = this.src.slice(this.i, end)
      this.i = end
      return { kind: 'ident', name }
    }

    // Anything else at this position is unparseable as a factor
    if (ch === null) {
      throw new EvalAbort({ kind: 'parse_error', message: 'unexpected end of input', pos: start })
    }
    throw new EvalAbort({ kind: 'parse_error', message: `unexpected character ${JSON.stringify(ch)}`, pos: start })
  }

  expectEnd(): void {
    this.skipWs()
    if (this.i < this.src.length) {
      throw new EvalAbort({ kind: 'parse_error', message: `unexpected trailing input ${JSON.stringify(this.src[this.i])}`, pos: this.i })
    }
  }

  // ── Lex helpers ────────────────────────────────────────────────────────

  private peek(): string | null {
    return this.i < this.src.length ? this.src[this.i]! : null
  }

  private skipWs(): void {
    while (this.i < this.src.length) {
      const c = this.src[this.i]!
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') this.i++
      else break
    }
  }
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9'
}
function isIdentStart(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_'
}
function isIdentTail(ch: string): boolean {
  return isIdentStart(ch) || isDigit(ch)
}

// ── Evaluator ────────────────────────────────────────────────────────────

function evaluateNode(node: Node, ctx: EvalContext, seen: Set<string>): number {
  switch (node.kind) {
    case 'number':
      return node.value

    case 'unary':
      return -evaluateNode(node.operand, ctx, seen)

    case 'binary': {
      const l = evaluateNode(node.left, ctx, seen)
      const r = evaluateNode(node.right, ctx, seen)
      switch (node.op) {
        case '+': return l + r
        case '-': return l - r
        case '*': return l * r
        case '/':
          if (r === 0) throw new EvalAbort({ kind: 'div_by_zero' })
          return l / r
      }
      // exhaustive — TS catches missing cases
      return 0
    }

    case 'ident':
      return resolveIdent(node.name, ctx, seen)
  }
}

function resolveIdent(name: string, ctx: EvalContext, seen: Set<string>): number {
  // 1. Reserved schedule globals — short-circuit, no recursion.
  if ((RESERVED_NAMES as readonly string[]).includes(name)) {
    const r = name as Reserved
    return ctx.schedule[r] ?? 0
  }

  // 2. Cycle detection — entered same name on the stack.
  if (seen.has(name)) {
    throw new EvalAbort({ kind: 'cycle', name })
  }

  // 3. Depth limit — abort cycles that grow without revisiting names.
  if (seen.size >= MAX_RECURSION_DEPTH) {
    throw new EvalAbort({ kind: 'cycle', name })
  }

  // 4. User-defined variable.
  const raw = ctx.variables[name]
  if (raw === undefined) {
    throw new EvalAbort({ kind: 'unknown_identifier', name })
  }

  // Recurse — parse + evaluate the variable's formula with `name` marked seen.
  const parser = new Parser(raw)
  const subTree = parser.parseExpr()
  parser.expectEnd()
  const nextSeen = new Set(seen)
  nextSeen.add(name)
  return evaluateNode(subTree, ctx, nextSeen)
}
