'use client'

import { useEffect, useRef } from 'react'
import { evaluate, RESERVED_NAMES } from '@/lib/budget/eval'
import type { EvalContext } from '@/lib/budget/eval'
import type { BudgetVariable, BudgetVersion } from '@/types'

// PR 12 — small popover showing how a formula resolved.
//
// Displayed when the line's qty contains an identifier (formula chip
// in PR 8/9). Shows the raw expression, every referenced identifier's
// value with source label, and a substituted-form breakdown for
// compound expressions.
//
// Auto-dismiss: 4s, or tap-elsewhere via overlay click.

const IDENT_RE = /[a-zA-Z_][a-zA-Z0-9_]*/g
const RESERVED = new Set<string>(RESERVED_NAMES)

interface VariableInspectTooltipProps {
  expression: string
  ctx: EvalContext
  variables: BudgetVariable[]
  versions: BudgetVersion[]
  activeVersionId: string | null
  onDismiss: () => void
}

export function VariableInspectTooltip({
  expression, ctx, variables, versions, activeVersionId, onDismiss,
}: VariableInspectTooltipProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, 4000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [onDismiss])

  // Pull every identifier referenced in the expression. Order-stable +
  // unique. Reserved schedule names get separate treatment.
  const idents: string[] = []
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  IDENT_RE.lastIndex = 0
  while ((m = IDENT_RE.exec(expression)) !== null) {
    const name = m[0]!
    if (!seen.has(name)) { seen.add(name); idents.push(name) }
  }

  const finalResult = evaluate(expression, ctx)
  const finalDisplay = finalResult.ok ? finalResult.value : `err (${finalResult.error.kind})`

  // Substituted-form breakdown — show the expression with each identifier
  // replaced by its resolved number. Useful for compound exprs like
  // "shootDays * 2" → "8 × 2 = 16".
  const isCompound = idents.length > 0 && /[+\-*/()]/.test(expression)
  const substituted = isCompound
    ? expression.replace(IDENT_RE, name => {
        if (RESERVED.has(name)) return String(ctx.schedule[name as keyof typeof ctx.schedule] ?? 0)
        const v = ctx.variables[name]
        const evald = v != null ? evaluate(v, ctx) : null
        return evald?.ok ? String(evald.value) : '?'
      }).replace(/\*/g, '×')
    : null

  return (
    <>
      {/* Catch-all backdrop — tap anywhere outside dismisses. Transparent. */}
      <div
        onClick={onDismiss}
        style={{ position: 'fixed', inset: 0, zIndex: 60 }}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label="Formula breakdown"
        style={{
          position: 'absolute',
          left: 0, right: 0,
          margin: '4px 16px 0',
          padding: '10px 12px',
          borderRadius: 10,
          background: 'rgba(20,20,32,0.96)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
          zIndex: 61,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}
      >
        {/* Expression + result */}
        <div className="flex items-baseline" style={{ gap: 8 }}>
          <span
            className="font-mono"
            style={{ fontSize: 12, color: '#fff', fontWeight: 500 }}
          >{expression}</span>
          <span
            className="font-mono"
            style={{ fontSize: 12, color: '#a0a0b8' }}
          >= {finalDisplay}</span>
        </div>

        {/* Substituted breakdown for compound exprs only */}
        {substituted && (
          <div
            className="font-mono"
            style={{ fontSize: 11, color: '#62627a' }}
          >{substituted}</div>
        )}

        {/* Per-identifier source labels */}
        <div className="flex flex-col" style={{ gap: 3, marginTop: 2 }}>
          {idents.map(name => (
            <IdentSource
              key={name}
              name={name}
              ctx={ctx}
              variables={variables}
              versions={versions}
              activeVersionId={activeVersionId}
            />
          ))}
        </div>
      </div>
    </>
  )
}

function IdentSource({
  name, ctx, variables, versions, activeVersionId,
}: {
  name: string
  ctx: EvalContext
  variables: BudgetVariable[]
  versions: BudgetVersion[]
  activeVersionId: string | null
}) {
  // Schedule globals.
  if (RESERVED.has(name)) {
    const value = ctx.schedule[name as keyof typeof ctx.schedule] ?? 0
    const sourceLabel =
      name === 'shootDays' ? 'prod ShootDays' :
      name === 'prepDays'  ? 'pre ShootDays'  :
      name === 'postDays'  ? 'post ShootDays' : ''
    return (
      <Row name={name}>
        = {value}{sourceLabel ? ` ${sourceLabel}` : ''}
      </Row>
    )
  }

  // User-defined variable. Show project-level + version-override values
  // when both exist.
  const projectLevel = variables.find(v => v.versionId == null && v.name === name)
  const override = activeVersionId
    ? variables.find(v => v.versionId === activeVersionId && v.name === name)
    : undefined

  if (!projectLevel && !override) {
    return <Row name={name}>= ? (undefined)</Row>
  }

  const overrideVersion = override ? versions.find(v => v.id === override.versionId) : null

  return (
    <Row name={name}>
      {projectLevel && (
        <span>= {resolveValueLabel(projectLevel.value, ctx)} (project-level)</span>
      )}
      {projectLevel && override && <span style={{ color: '#62627a' }}>{' · '}</span>}
      {override && (
        <span>
          {!projectLevel && '= '}
          {projectLevel ? 'or ' : ''}
          {resolveValueLabel(override.value, ctx)} ({overrideVersion?.name ?? 'version'} override)
        </span>
      )}
    </Row>
  )
}

function Row({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline font-mono" style={{ gap: 6, fontSize: 11 }}>
      <span style={{ color: '#9b6ef3' }}>{name}</span>
      <span style={{ color: '#a0a0b8' }}>{children}</span>
    </div>
  )
}

function resolveValueLabel(raw: string, ctx: EvalContext): string {
  // If raw is a plain number, show as-is. Otherwise evaluate and show
  // "expr = value" so the producer can see both the formula and result.
  if (/^-?\d+(\.\d+)?$/.test(raw.trim())) return raw
  const r = evaluate(raw, ctx)
  if (r.ok) return `${raw} = ${r.value}`
  return `${raw} = err`
}
