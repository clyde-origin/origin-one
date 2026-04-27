'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProject, useBudget, useShootDays } from '@/lib/hooks/useOriginOne'
import { PageHeader } from '@/components/ui/PageHeader'
import { getProjectColor, statusHex, statusLabel as projectStatusLabel } from '@/lib/utils/phase'
import { deriveProjectColors, DEFAULT_PROJECT_HEX } from '@origin-one/ui'
import { readStoredViewerRole, type ViewerRole } from '@/lib/utils/viewerIdentity'
import { buildEvalContext, rollUpBudget, type ComputedLine, type AccountSubtotal, type BudgetRollup } from '@/lib/budget/compute'
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
  ShootDayType,
} from '@/types'

// ── Tokens (BRAND_TOKENS — phase tints + fixed UI palette) ──────────────

const PHASE_HEX: Record<ShootDayType, string> = {
  pre:  '#e8a020',
  prod: '#6470f3',
  post: '#00b894',
}

const PHASE_LABEL: Record<ShootDayType, string> = {
  pre:  'prepDays',
  prod: 'shootDays',
  post: 'postDays',
}

const VARIANCE_HEX = {
  over:  '#e8564a',
  warn:  '#e8a020',
  under: '#00b894',
} as const

// ── Types — local view of the nested Supabase response ──────────────────

interface BudgetLineWithAmounts extends BudgetLine {
  amounts: BudgetLineAmount[]
}

interface BudgetTree extends Budget {
  versions: BudgetVersion[]
  accounts: BudgetAccount[]
  lines: BudgetLineWithAmounts[]
  variables: BudgetVariable[]
  markups: BudgetMarkup[]
  expenses: Expense[]
}

// ── Helpers ─────────────────────────────────────────────────────────────

function formatUSD(n: number): string {
  if (!Number.isFinite(n)) return '$0'
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 100) {
    return `${sign}$${Math.round(abs).toLocaleString('en-US')}`
  }
  return `${sign}$${abs.toFixed(2)}`
}

function formatPercent(n: number): string {
  // 0.083 → "8%" — coarse for chip display
  return `${Math.round(n * 100)}%`
}

// ── VersionPills ────────────────────────────────────────────────────────

function VersionPills({
  versions, activeId, accent, onChange,
}: {
  versions: BudgetVersion[]
  activeId: string | null
  accent: string
  onChange: (id: string) => void
}) {
  const sorted = [...versions].sort((a, b) => a.sortOrder - b.sortOrder)
  return (
    <div
      className="flex items-center"
      style={{ gap: 6, padding: '14px 16px 10px' }}
    >
      <span
        className="font-mono uppercase"
        style={{ fontSize: 9, letterSpacing: '0.12em', color: '#62627a', marginRight: 4 }}
      >Version</span>
      {sorted.map(v => {
        const active = v.id === activeId
        const locked = v.state === 'locked'
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onChange(v.id)}
            className="font-mono uppercase"
            style={{
              flex: 1,
              padding: '7px 10px', borderRadius: 999,
              fontSize: 10, letterSpacing: '0.06em',
              background: active ? `${accent}24` : 'rgba(255,255,255,0.02)',
              border: `1px solid ${active ? `${accent}66` : 'rgba(255,255,255,0.08)'}`,
              color: active ? accent : '#a0a0b8',
              cursor: 'pointer',
            }}
          >
            {v.name}{locked ? ' ⌃' : ''}
          </button>
        )
      })}
    </div>
  )
}

// ── VariablesStrip ──────────────────────────────────────────────────────

function VariablesStrip({
  schedule, vars,
}: {
  schedule: { prepDays: number; shootDays: number; postDays: number }
  vars: Record<string, string>
}) {
  return (
    <div
      className="flex flex-wrap"
      style={{
        gap: 6, padding: '4px 16px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {(['pre', 'prod', 'post'] as const).map(t => {
        const hex = PHASE_HEX[t]
        const value = t === 'pre' ? schedule.prepDays : t === 'prod' ? schedule.shootDays : schedule.postDays
        return (
          <span
            key={t}
            className="font-mono inline-flex items-center"
            style={{
              gap: 6, padding: '4px 10px', borderRadius: 999,
              fontSize: 10, letterSpacing: '0.04em',
              background: `${hex}1a`, border: `1px solid ${hex}38`, color: hex,
            }}
          >
            <span style={{ opacity: 0.85 }}>{PHASE_LABEL[t]}</span>
            <span style={{ fontWeight: 600 }}>{value}</span>
          </span>
        )
      })}
      {Object.entries(vars).map(([name, value]) => (
        <span
          key={name}
          className="font-mono inline-flex items-center"
          style={{
            gap: 6, padding: '4px 10px', borderRadius: 999,
            fontSize: 10, letterSpacing: '0.04em',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: '#a0a0b8',
          }}
        >
          <span style={{ opacity: 0.85 }}>{name}</span>
          <span style={{ fontWeight: 600 }}>{value}</span>
        </span>
      ))}
    </div>
  )
}

// ── LineRow ─────────────────────────────────────────────────────────────

function LineRow({
  line, computed, amount,
}: {
  line: BudgetLineWithAmounts
  computed: ComputedLine
  amount: BudgetLineAmount | undefined
}) {
  const hasFormula = /[a-zA-Z_]/.test(amount?.qty ?? '')

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gridTemplateRows: 'auto auto',
        columnGap: 10, rowGap: 4,
        padding: 10,
        borderRadius: 6,
        borderTop: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', gridColumn: 1, gridRow: 1 }}>
        {line.description}
      </div>
      <div
        className="font-mono"
        style={{
          fontSize: 13, fontWeight: 600, color: '#fff', gridColumn: 2, gridRow: 1, textAlign: 'right',
          opacity: computed.qtyError ? 0.4 : 1,
        }}
      >
        {formatUSD(computed.total)}
      </div>

      <div
        className="font-mono flex items-center flex-wrap"
        style={{
          gap: 6, gridColumn: '1 / -1', gridRow: 2,
          fontSize: 10, color: '#62627a', letterSpacing: '0.03em',
        }}
      >
        {/* qty */}
        <span style={{ color: '#a0a0b8' }}>
          {hasFormula ? (
            <span
              title={`= ${computed.qtyResolved}`}
              style={{
                color: PHASE_HEX.prod,
                borderBottom: `1px dotted ${PHASE_HEX.prod}80`,
                cursor: 'help',
              }}
            >
              {amount?.qty}
            </span>
          ) : (
            <>{computed.qtyResolved}</>
          )}
        </span>

        {/* unit chip */}
        <span
          style={{
            background: 'rgba(255,255,255,0.06)', color: '#a0a0b8',
            padding: '1px 5px', borderRadius: 3, fontSize: 9, letterSpacing: '0.06em',
          }}
        >{line.unit}</span>

        {/* rate */}
        <span style={{ color: '#a0a0b8' }}>@ {formatUSD(computed.rate)}</span>

        {/* fringe */}
        {Number(line.fringeRate) > 0 && (
          <span style={{ color: '#62627a', fontSize: 9 }}>
            +{formatPercent(Number(line.fringeRate))} fr
          </span>
        )}

        {/* tags */}
        {line.tags.map(tag => (
          <span
            key={tag}
            style={{
              padding: '2px 7px', borderRadius: 999, fontSize: 9, letterSpacing: '0.04em',
              background: 'rgba(155,110,243,0.10)', border: '1px solid rgba(155,110,243,0.22)',
              color: '#9b6ef3',
            }}
          >{tag}</span>
        ))}

        {/* variance flag */}
        {computed.flag && (
          <span
            style={{
              padding: '2px 6px', borderRadius: 999, fontSize: 9, letterSpacing: '0.04em',
              background: `${VARIANCE_HEX[computed.flag]}1a`,
              border: `1px solid ${VARIANCE_HEX[computed.flag]}38`,
              color: VARIANCE_HEX[computed.flag],
            }}
          >
            {computed.flag === 'over' ? '↑ ' : computed.flag === 'under' ? '↓ ' : ''}
            {formatPercent(Math.abs(computed.varPct))}
          </span>
        )}

        {/* error indicator (when qty formula failed to evaluate) */}
        {computed.qtyError && (
          <span
            title={computed.qtyError}
            style={{
              padding: '2px 6px', borderRadius: 999, fontSize: 9, letterSpacing: '0.04em',
              background: 'rgba(232,86,74,0.12)',
              border: '1px solid rgba(232,86,74,0.30)',
              color: '#e8564a',
            }}
          >ERR</span>
        )}
      </div>
    </div>
  )
}

// ── AccountCard ─────────────────────────────────────────────────────────

function AccountCard({
  account, lines, amountsByLine, computedByLine, subtotal, expanded, onToggle,
}: {
  account: BudgetAccount
  lines: BudgetLineWithAmounts[]
  amountsByLine: Map<string, BudgetLineAmount | undefined>
  computedByLine: Map<string, ComputedLine>
  subtotal: AccountSubtotal | undefined
  expanded: boolean
  onToggle: () => void
}) {
  const accountLines = lines.filter(l => l.accountId === account.id)
  const total = subtotal?.total ?? 0

  return (
    <div
      style={{
        background: 'rgba(15,15,25,0.6)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left"
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'inherit',
        }}
      >
        <span
          className="font-mono"
          style={{ fontSize: 10, color: '#62627a', minWidth: 24 }}
        >{account.code}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#fff' }}>{account.name}</span>
        <span
          className="font-mono"
          style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}
        >{formatUSD(total)}</span>
        <span
          style={{
            color: '#62627a', fontSize: 12,
            transition: 'transform 0.2s',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >›</span>
      </button>
      {expanded && accountLines.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '4px 6px 6px' }}>
          {accountLines.map(line => {
            const computed = computedByLine.get(line.id)
            if (!computed) return null
            return (
              <LineRow
                key={line.id}
                line={line}
                computed={computed}
                amount={amountsByLine.get(line.id)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────

export default function BudgetPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const router = useRouter()

  // Producer gate (Q8) — same shim pattern Schedule uses (PR #40).
  const [role, setRole] = useState<ViewerRole | null>(null)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    setRole(readStoredViewerRole())
    setHydrated(true)
  }, [])
  useEffect(() => {
    if (hydrated && role !== 'producer') {
      router.replace(`/projects/${projectId}`)
    }
  }, [hydrated, role, router, projectId])

  const { data: project } = useProject(projectId)
  const { data: budgetRaw, isLoading } = useBudget(projectId)
  const { data: shootDaysRaw } = useShootDays(projectId)

  const colors = deriveProjectColors(project?.color || getProjectColor(projectId) || DEFAULT_PROJECT_HEX)
  const accent = colors.primary

  const budget = budgetRaw as BudgetTree | null | undefined
  const shootDays = (shootDaysRaw ?? []) as ShootDay[]

  // Active version — defaults to Working (kind), then first version, then null.
  const versionsSorted = useMemo<BudgetVersion[]>(() => {
    if (!budget) return []
    return [...budget.versions].sort((a, b) => a.sortOrder - b.sortOrder)
  }, [budget])
  const defaultVersionId = useMemo(() => {
    if (versionsSorted.length === 0) return null
    return versionsSorted.find(v => v.kind === 'working')?.id ?? versionsSorted[0]!.id
  }, [versionsSorted])
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null)
  useEffect(() => {
    // Initialize once budget loads. Avoids React Query's "state set during render" warning.
    if (activeVersionId === null && defaultVersionId) setActiveVersionId(defaultVersionId)
  }, [defaultVersionId, activeVersionId])

  const evalCtx = useMemo(() => {
    if (!budget) return null
    return buildEvalContext(budget.variables, shootDays, activeVersionId)
  }, [budget, shootDays, activeVersionId])

  // amountsByLine for the active version — shared between rollup and rendering.
  const amountsByActiveLine = useMemo(() => {
    const m = new Map<string, BudgetLineAmount | undefined>()
    if (!budget || !activeVersionId) return m
    for (const line of budget.lines) {
      m.set(line.id, line.amounts.find(a => a.versionId === activeVersionId))
    }
    return m
  }, [budget, activeVersionId])

  const rollup = useMemo<BudgetRollup | null>(() => {
    if (!budget || !evalCtx || !activeVersionId) return null
    return rollUpBudget({
      lines: budget.lines,
      amountsByLine: amountsByActiveLine,
      accounts: budget.accounts,
      expenses: budget.expenses,
      markups: budget.markups,
      ctx: evalCtx,
      varianceThreshold: Number(budget.varianceThreshold),
      activeVersionId,
    })
  }, [budget, evalCtx, activeVersionId, amountsByActiveLine])

  const accountsSorted = useMemo<BudgetAccount[]>(() => {
    if (!budget) return []
    // Top-level only (parentId === null), sorted by section then sortOrder.
    // ATL above BTL.
    const tops = budget.accounts.filter(a => a.parentId == null)
    return [...tops].sort((a, b) => {
      if (a.section !== b.section) return a.section === 'ATL' ? -1 : 1
      return a.sortOrder - b.sortOrder
    })
  }, [budget])

  // localStorage-backed expand/collapse per (userId, budgetId). For PR 8
  // we don't have a stable userId pre-Auth; use projectId as the key.
  // Default: all collapsed. The seed has lots of accounts; collapsed-first
  // keeps the page short on a phone.
  const expandKey = `budget-expand:${projectId}`
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set())
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(expandKey)
      if (raw) setExpandedSet(new Set(JSON.parse(raw) as string[]))
    } catch { /* ignore */ }
  }, [expandKey])
  const toggleExpand = (accountId: string) => {
    setExpandedSet(prev => {
      const next = new Set(prev)
      if (next.has(accountId)) next.delete(accountId)
      else next.add(accountId)
      try {
        window.localStorage.setItem(expandKey, JSON.stringify(Array.from(next)))
      } catch { /* ignore */ }
      return next
    })
  }

  // Pre-hydration / non-producer: render nothing.
  if (!hydrated || role !== 'producer') return null

  return (
    <div className="screen">
      <PageHeader
        projectId={projectId}
        title="Budget"
        meta={project ? (
          <div className="flex flex-col items-center gap-1.5">
            <span style={{ color: accent, fontSize: '0.50rem', letterSpacing: '0.06em' }}>{project.name}</span>
            <span
              className="font-mono uppercase"
              style={{
                fontSize: '0.38rem', padding: '2px 8px', borderRadius: 12,
                background: `${statusHex(project.status)}18`, color: statusHex(project.status),
              }}
            >{projectStatusLabel(project.status)}</span>
          </div>
        ) : ''}
        noBorder
      />

      {/* Body */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
        }}
      >
        {isLoading ? (
          <div
            className="font-mono uppercase text-center"
            style={{ fontSize: '0.42rem', letterSpacing: '0.1em', color: '#62627a', padding: '32px 0' }}
          >Loading…</div>
        ) : !budget ? (
          // Empty state (5 of 6 seed projects). PR 11 wires the TemplatePicker.
          <div className="text-center" style={{ padding: '60px 24px' }}>
            <div
              className="font-mono uppercase"
              style={{ fontSize: '0.5rem', letterSpacing: '0.1em', color: '#62627a', marginBottom: 10 }}
            >No budget yet</div>
            <div style={{ fontSize: '0.85rem', color: '#a0a0b8', lineHeight: 1.5 }}>
              Start one from the AICP template, clone from another project,<br />or begin blank — coming with the template picker.
            </div>
          </div>
        ) : !rollup || !evalCtx ? (
          <div
            className="font-mono uppercase text-center"
            style={{ fontSize: '0.42rem', letterSpacing: '0.1em', color: '#62627a', padding: '32px 0' }}
          >Computing…</div>
        ) : (
          <>
            {/* Project totals block */}
            <div style={{ padding: '4px 20px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div
                className="flex items-end justify-between"
                style={{ marginTop: 14, gap: 16 }}
              >
                <div>
                  <div
                    className="font-mono uppercase"
                    style={{ fontSize: 9, letterSpacing: '0.12em', color: '#62627a', marginBottom: 4 }}
                  >Working Total</div>
                  <div
                    className="font-mono"
                    style={{ fontSize: 18, fontWeight: 600, color: '#fff' }}
                  >{formatUSD(rollup.grandTotal)}</div>
                </div>
                <div>
                  <div
                    className="font-mono uppercase"
                    style={{ fontSize: 9, letterSpacing: '0.12em', color: '#62627a', marginBottom: 4 }}
                  >Actuals</div>
                  <div
                    className="font-mono"
                    style={{ fontSize: 18, fontWeight: 600, color: accent }}
                  >{formatUSD(rollup.grandActuals)}</div>
                  {rollup.grandTotal > 0 && (
                    <div className="font-mono" style={{ fontSize: 10, color: '#a0a0b8', marginTop: 2 }}>
                      {Math.round((rollup.grandActuals / rollup.grandTotal) * 100)}% spent
                      <div
                        style={{
                          marginTop: 4, width: 80, height: 3, borderRadius: 2, overflow: 'hidden',
                          background: 'rgba(255,255,255,0.06)', position: 'relative',
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute', inset: 0,
                            width: `${Math.min(100, Math.round((rollup.grandActuals / rollup.grandTotal) * 100))}%`,
                            background: accent, borderRadius: 2,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Version pills */}
            <VersionPills
              versions={budget.versions}
              activeId={activeVersionId}
              accent={accent}
              onChange={setActiveVersionId}
            />

            {/* Variables strip */}
            <VariablesStrip
              schedule={evalCtx.schedule}
              vars={evalCtx.variables}
            />

            {/* Account list */}
            <div
              style={{
                padding: '12px 16px 24px',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}
            >
              {accountsSorted.map(a => {
                // Section header row when transitioning ATL → BTL
                const sub = rollup.subtotalByAccount.get(a.id)
                return (
                  <AccountCard
                    key={a.id}
                    account={a}
                    lines={budget.lines}
                    amountsByLine={amountsByActiveLine}
                    computedByLine={rollup.computedByLine}
                    subtotal={sub}
                    expanded={expandedSet.has(a.id)}
                    onToggle={() => toggleExpand(a.id)}
                  />
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
