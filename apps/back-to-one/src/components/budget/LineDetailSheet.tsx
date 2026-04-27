'use client'

import { useEffect, useMemo, useState } from 'react'
import { evaluate, type EvalContext } from '@/lib/budget/eval'
import {
  useUpdateBudgetLine,
  useUpdateBudgetLineAmount,
  useCreateManualExpense,
} from '@/lib/hooks/useOriginOne'
import { useDetailSheetThreads } from '@/components/threads/useDetailSheetThreads'
import { haptic } from '@/lib/utils/haptics'
import type {
  BudgetVersion,
  BudgetAccount,
  BudgetLine,
  BudgetLineAmount,
  Expense,
  BudgetUnit,
} from '@/types'

const PHASE_HEX = { pre: '#e8a020', prod: '#6470f3', post: '#00b894' } as const

const VARIANCE_HEX = { over: '#e8564a', warn: '#e8a020', under: '#00b894' } as const

const UNIT_OPTIONS: BudgetUnit[] = ['DAY', 'WEEK', 'HOUR', 'FLAT', 'UNIT']

interface BudgetLineWithAmounts extends BudgetLine {
  amounts: BudgetLineAmount[]
}

function formatUSD(n: number): string {
  if (!Number.isFinite(n)) return '$0'
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  return abs >= 100
    ? `${sign}$${Math.round(abs).toLocaleString('en-US')}`
    : `${sign}$${abs.toFixed(2)}`
}

// ── LineDetailSheet ─────────────────────────────────────────────────────

type Tab = 'edit' | 'expenses' | 'threads'

interface LineDetailSheetProps {
  projectId: string
  budgetId: string
  line: BudgetLineWithAmounts
  versions: BudgetVersion[]
  accounts: BudgetAccount[]
  expenses: Expense[]
  evalCtx: EvalContext
  activeVersionId: string | null
  accent: string
  currentMemberId: string | null
  onBack: () => void
}

export function LineDetailSheet({
  projectId, budgetId, line, versions, accounts, expenses,
  evalCtx, activeVersionId, accent, currentMemberId, onBack,
}: LineDetailSheetProps) {
  const [tab, setTab] = useState<Tab>('edit')

  const lineExpenses = useMemo(
    () => expenses.filter(e => e.lineId === line.id).sort((a, b) => b.date.localeCompare(a.date)),
    [expenses, line.id],
  )

  const threadsParts = useDetailSheetThreads({
    projectId,
    attachedToType: 'budgetLine',
    attachedToId: line.id,
    subjectLabel: line.description,
  })

  // Unread count badge — pulled from threadsParts state via the existing
  // shared component. Approximation: peek into the parts' MessageZone
  // existence — not ideal but the canonical hook doesn't expose count.
  // For PR 9 we just show "Threads" without a count badge; PR 12+ adds
  // the unread aggregate everywhere.

  return (
    <div className="flex flex-col" style={{ flex: 1, minHeight: 0 }}>
      <LineDetailHeader
        projectId={projectId}
        line={line}
        accent={accent}
        onBack={onBack}
      />

      <LineDetailTabs
        tab={tab}
        accent={accent}
        expenseCount={lineExpenses.length}
        onChange={setTab}
      />

      <div
        className="flex-1 overflow-y-auto"
        style={{
          padding: '16px 16px 80px',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
        }}
      >
        {tab === 'edit' && (
          <LineEditTab
            projectId={projectId}
            line={line}
            versions={versions}
            accounts={accounts}
            evalCtx={evalCtx}
            activeVersionId={activeVersionId}
            accent={accent}
          />
        )}
        {tab === 'expenses' && (
          <LineExpensesTab
            projectId={projectId}
            budgetId={budgetId}
            line={line}
            expenses={lineExpenses}
            currentMemberId={currentMemberId}
            accent={accent}
          />
        )}
        {tab === 'threads' && (
          <LineThreadsTab parts={threadsParts} />
        )}
      </div>
    </div>
  )
}

// ── LineDetailHeader ────────────────────────────────────────────────────

function LineDetailHeader({
  projectId, line, accent, onBack,
}: {
  projectId: string
  line: BudgetLineWithAmounts
  accent: string
  onBack: () => void
}) {
  const update = useUpdateBudgetLine(projectId)
  const [editingDesc, setEditingDesc] = useState(false)
  const [desc, setDesc] = useState(line.description)
  useEffect(() => { setDesc(line.description) }, [line.description])

  const saveDesc = () => {
    setEditingDesc(false)
    const trimmed = desc.trim()
    if (trimmed && trimmed !== line.description) {
      update.mutate({ id: line.id, patch: { description: trimmed } })
    } else {
      setDesc(line.description)
    }
  }

  return (
    <div
      style={{
        padding: 'calc(var(--safe-top) + 10px) 16px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      <div className="flex items-center" style={{ gap: 12 }}>
        <button
          type="button"
          onClick={() => { haptic('light'); onBack() }}
          aria-label="Back to budget list"
          style={{
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', color: '#fff',
            fontSize: 18, cursor: 'pointer',
          }}
        >‹</button>
        <span
          className="font-mono uppercase"
          style={{ fontSize: 11, letterSpacing: '0.08em', color: '#a0a0b8' }}
        >Line</span>
      </div>

      {/* Description — inline editable */}
      {editingDesc ? (
        <input
          type="text"
          value={desc}
          autoFocus
          onChange={e => setDesc(e.target.value)}
          onBlur={saveDesc}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 8,
            padding: '8px 10px',
            color: '#fff', fontSize: 18, fontWeight: 600,
            outline: 'none', fontFamily: 'inherit',
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditingDesc(true)}
          className="text-left"
          style={{
            background: 'transparent', border: 'none', cursor: 'text',
            color: '#fff', fontSize: 18, fontWeight: 600, padding: 0,
          }}
        >{line.description}</button>
      )}

      {/* Tags chip strip */}
      <TagChipStrip projectId={projectId} line={line} accent={accent} />
    </div>
  )
}

// ── TagChipStrip ────────────────────────────────────────────────────────

function TagChipStrip({
  projectId, line, accent,
}: { projectId: string; line: BudgetLineWithAmounts; accent: string }) {
  const update = useUpdateBudgetLine(projectId)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  const removeTag = (t: string) => {
    update.mutate({ id: line.id, patch: { tags: line.tags.filter(x => x !== t) } })
  }
  const addTag = () => {
    const t = draft.trim()
    setDraft(''); setAdding(false)
    if (!t) return
    if (line.tags.includes(t)) return
    update.mutate({ id: line.id, patch: { tags: [...line.tags, t] } })
  }

  return (
    <div className="flex flex-wrap" style={{ gap: 6 }}>
      {line.tags.map(t => (
        <span
          key={t}
          className="font-mono inline-flex items-center"
          style={{
            gap: 4, padding: '3px 4px 3px 8px', borderRadius: 999,
            fontSize: 9, letterSpacing: '0.04em',
            background: `${accent}1a`, border: `1px solid ${accent}38`, color: accent,
          }}
        >
          {t}
          <button
            type="button"
            onClick={() => { haptic('light'); removeTag(t) }}
            aria-label={`Remove tag ${t}`}
            style={{
              width: 14, height: 14, borderRadius: 999, marginLeft: 2,
              background: 'transparent', border: 'none', color: 'inherit',
              fontSize: 11, lineHeight: 1, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </span>
      ))}
      {adding ? (
        <input
          type="text"
          value={draft}
          autoFocus
          placeholder="dept:art …"
          onChange={e => setDraft(e.target.value)}
          onBlur={addTag}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setDraft(''); setAdding(false) } }}
          className="font-mono"
          style={{
            background: 'rgba(255,255,255,0.04)', border: `1px dashed ${accent}66`,
            borderRadius: 999, padding: '3px 8px',
            color: '#fff', fontSize: 9, letterSpacing: '0.04em',
            outline: 'none', minWidth: 80,
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="font-mono"
          style={{
            padding: '3px 8px', borderRadius: 999,
            background: 'transparent', border: '1px dashed rgba(255,255,255,0.15)',
            color: '#62627a', fontSize: 9, letterSpacing: '0.04em',
            cursor: 'pointer',
          }}
        >+ tag</button>
      )}
    </div>
  )
}

// ── LineDetailTabs ──────────────────────────────────────────────────────

function LineDetailTabs({
  tab, accent, expenseCount, onChange,
}: {
  tab: Tab
  accent: string
  expenseCount: number
  onChange: (t: Tab) => void
}) {
  const items: { id: Tab; label: string; badge?: number }[] = [
    { id: 'edit',     label: 'Edit'     },
    { id: 'expenses', label: 'Expenses', badge: expenseCount },
    { id: 'threads',  label: 'Threads'  },
  ]
  return (
    <div
      className="flex"
      style={{
        gap: 4, padding: '12px 16px 0',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {items.map(it => {
        const active = it.id === tab
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => { haptic('light'); onChange(it.id) }}
            className="font-mono uppercase"
            style={{
              flex: 1, textAlign: 'center', padding: '10px 0',
              fontSize: 10, letterSpacing: '0.08em',
              background: 'transparent', border: 'none',
              borderBottom: `2px solid ${active ? accent : 'transparent'}`,
              color: active ? accent : '#62627a',
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <span>{it.label}</span>
            {it.badge !== undefined && it.badge > 0 && (
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 16, height: 14, padding: '0 4px', borderRadius: 999,
                  background: active ? `${accent}33` : 'rgba(255,255,255,0.06)',
                  color: active ? accent : '#a0a0b8',
                  fontSize: 9, fontWeight: 600,
                }}
              >{it.badge}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── LineEditTab ─────────────────────────────────────────────────────────

function LineEditTab({
  projectId, line, versions, accounts, evalCtx, activeVersionId, accent,
}: {
  projectId: string
  line: BudgetLineWithAmounts
  versions: BudgetVersion[]
  accounts: BudgetAccount[]
  evalCtx: EvalContext
  activeVersionId: string | null
  accent: string
}) {
  const updateLine = useUpdateBudgetLine(projectId)
  const sortedVersions = [...versions].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="flex flex-col" style={{ gap: 18 }}>
      {/* Section: Per-version cells */}
      <div>
        <SectionLabel>Per-version qty &amp; rate</SectionLabel>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${sortedVersions.length}, minmax(0, 1fr))`,
            gap: 8,
          }}
        >
          {sortedVersions.map(v => {
            const amount = line.amounts.find(a => a.versionId === v.id)
            return (
              <VersionAmountCell
                key={v.id}
                projectId={projectId}
                version={v}
                line={line}
                amount={amount}
                evalCtx={evalCtx}
                accent={accent}
                isActive={v.id === activeVersionId}
              />
            )
          })}
        </div>
      </div>

      {/* Section: Line-level fields */}
      <div className="flex flex-col" style={{ gap: 12 }}>
        <SectionLabel>Line fields</SectionLabel>

        {/* Account selector */}
        <Field label="Account">
          <select
            value={line.accountId}
            onChange={e => updateLine.mutate({ id: line.id, patch: { accountId: e.target.value } })}
            className="font-mono"
            style={{
              padding: '8px 10px', borderRadius: 8,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: '#e8e8f0', fontSize: 12,
              outline: 'none', width: '100%',
            }}
          >
            {[...accounts].sort((a, b) => a.sortOrder - b.sortOrder).map(a => (
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
            ))}
          </select>
        </Field>

        {/* Unit selector */}
        <Field label="Unit">
          <div className="flex" style={{ gap: 6 }}>
            {UNIT_OPTIONS.map(u => {
              const active = line.unit === u
              return (
                <button
                  key={u}
                  type="button"
                  onClick={() => { haptic('light'); updateLine.mutate({ id: line.id, patch: { unit: u } }) }}
                  className="font-mono uppercase"
                  style={{
                    flex: 1, padding: '7px 0', borderRadius: 8,
                    fontSize: 9, letterSpacing: '0.08em',
                    background: active ? `${accent}1a` : 'rgba(255,255,255,0.04)',
                    border: active ? `1px solid ${accent}66` : '1px solid rgba(255,255,255,0.08)',
                    color: active ? accent : '#a0a0b8',
                    cursor: 'pointer',
                  }}
                >{u}</button>
              )
            })}
          </div>
        </Field>

        {/* Fringe rate */}
        <FringeRateField projectId={projectId} line={line} />

        {/* Actuals rate override */}
        <ActualsRateField projectId={projectId} line={line} />
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="font-mono uppercase"
      style={{ fontSize: 9, letterSpacing: '0.12em', color: '#62627a', marginBottom: 10 }}
    >{children}</div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col" style={{ gap: 6 }}>
      <span
        className="font-mono uppercase"
        style={{ fontSize: 9, letterSpacing: '0.10em', color: '#62627a' }}
      >{label}</span>
      {children}
    </label>
  )
}

// ── VersionAmountCell ───────────────────────────────────────────────────

function VersionAmountCell({
  projectId, version, line, amount, evalCtx, accent, isActive,
}: {
  projectId: string
  version: BudgetVersion
  line: BudgetLineWithAmounts
  amount: BudgetLineAmount | undefined
  evalCtx: EvalContext
  accent: string
  isActive: boolean
}) {
  const updateAmount = useUpdateBudgetLineAmount(projectId)
  const locked = version.state === 'locked'

  const [qty, setQty] = useState(amount?.qty ?? '0')
  const [rate, setRate] = useState(amount?.rate ?? '0')
  const [qtyError, setQtyError] = useState<string | null>(null)
  useEffect(() => { setQty(amount?.qty ?? '0') }, [amount?.qty])
  useEffect(() => { setRate(amount?.rate ?? '0') }, [amount?.rate])

  const liveTotal = useMemo(() => {
    const evalResult = evaluate(qty, evalCtx)
    const qtyN = evalResult.ok ? evalResult.value : 0
    const rateN = Number.parseFloat(rate)
    if (!Number.isFinite(rateN)) return 0
    const fringe = Number.parseFloat(line.fringeRate)
    const fringeAmt = qtyN * rateN * (Number.isFinite(fringe) ? fringe : 0)
    return qtyN * rateN + fringeAmt
  }, [qty, rate, evalCtx, line.fringeRate])

  const saveQty = () => {
    if (!amount || locked) return
    if (qty === amount.qty) return
    const evalResult = evaluate(qty, evalCtx)
    setQtyError(evalResult.ok ? null : describeEvalError(evalResult.error))
    // Spec §4: save still allowed on parse error so producer can fix incrementally.
    updateAmount.mutate({ id: amount.id, patch: { qty } })
  }

  const saveRate = () => {
    if (!amount || locked) return
    if (rate === amount.rate) return
    const rateN = Number.parseFloat(rate)
    if (!Number.isFinite(rateN) || rateN < 0) {
      // Reject; revert to last good.
      setRate(amount.rate)
      return
    }
    updateAmount.mutate({ id: amount.id, patch: { rate: rateN.toFixed(2) } })
  }

  const borderActive = isActive ? accent : 'rgba(255,255,255,0.10)'

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 6,
        padding: 10, borderRadius: 10,
        background: 'rgba(10,10,18,0.42)',
        border: `1px solid ${borderActive}${isActive ? '66' : ''}`,
      }}
    >
      <div className="flex items-center" style={{ gap: 6 }}>
        <span
          className="font-mono uppercase"
          style={{
            fontSize: 9, letterSpacing: '0.08em',
            color: isActive ? accent : '#a0a0b8',
          }}
        >{version.name}</span>
        {locked && (
          <span
            title="Locked — unlock from version pill menu."
            style={{ fontSize: 10, color: '#00b894' }}
          >⌃</span>
        )}
      </div>

      <Field label="Qty">
        <input
          type="text"
          inputMode="text"
          value={qty}
          disabled={locked || !amount}
          onChange={e => { setQty(e.target.value); setQtyError(null) }}
          onBlur={saveQty}
          className="font-mono"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${qtyError ? 'rgba(232,86,74,0.5)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 6,
            padding: '6px 8px',
            color: locked ? '#62627a' : '#fff', fontSize: 12,
            outline: 'none',
          }}
        />
        {qtyError && (
          <span style={{ fontSize: 9, color: '#e8564a' }}>{qtyError}</span>
        )}
      </Field>

      <Field label="Rate">
        <div className="relative" style={{ position: 'relative' }}>
          <span
            className="font-mono"
            style={{
              position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
              fontSize: 12, color: '#62627a', pointerEvents: 'none',
            }}
          >$</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={rate}
            disabled={locked || !amount}
            onChange={e => setRate(e.target.value)}
            onBlur={saveRate}
            className="font-mono"
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6,
              padding: '6px 8px 6px 18px',
              color: locked ? '#62627a' : '#fff', fontSize: 12,
              outline: 'none',
            }}
          />
        </div>
      </Field>

      <div
        className="font-mono"
        style={{ fontSize: 10, color: '#a0a0b8', marginTop: 2 }}
      >
        ={' '}{formatUSD(liveTotal)}
      </div>
    </div>
  )
}

function describeEvalError(err: { kind: string; name?: string; pos?: number; message?: string }): string {
  switch (err.kind) {
    case 'parse_error':       return `parse error at ${err.pos ?? '?'}`
    case 'unknown_identifier': return `unknown: ${err.name}`
    case 'cycle':             return `cycle: ${err.name}`
    case 'div_by_zero':       return 'div by zero'
    default:                  return 'eval error'
  }
}

// ── FringeRateField ─────────────────────────────────────────────────────

function FringeRateField({ projectId, line }: { projectId: string; line: BudgetLineWithAmounts }) {
  const update = useUpdateBudgetLine(projectId)
  // Display as percent; store as Decimal(5,4) string.
  const startPercent = (Number.parseFloat(line.fringeRate) || 0) * 100
  const [val, setVal] = useState(startPercent.toFixed(2).replace(/\.00$/, ''))
  useEffect(() => {
    const p = (Number.parseFloat(line.fringeRate) || 0) * 100
    setVal(p.toFixed(2).replace(/\.00$/, ''))
  }, [line.fringeRate])

  const save = () => {
    const pct = Number.parseFloat(val)
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      const p = (Number.parseFloat(line.fringeRate) || 0) * 100
      setVal(p.toFixed(2).replace(/\.00$/, ''))
      return
    }
    const decimalString = (pct / 100).toFixed(4)
    if (decimalString === line.fringeRate) return
    update.mutate({ id: line.id, patch: { fringeRate: decimalString } })
  }

  return (
    <Field label="Fringe %">
      <div style={{ position: 'relative' }}>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          max="100"
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={save}
          className="font-mono"
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 8,
            padding: '8px 24px 8px 10px',
            color: '#e8e8f0', fontSize: 12,
            outline: 'none',
          }}
        />
        <span
          className="font-mono"
          style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            fontSize: 12, color: '#62627a', pointerEvents: 'none',
          }}
        >%</span>
      </div>
    </Field>
  )
}

function ActualsRateField({ projectId, line }: { projectId: string; line: BudgetLineWithAmounts }) {
  const update = useUpdateBudgetLine(projectId)
  const [val, setVal] = useState(line.actualsRate ?? '')
  useEffect(() => { setVal(line.actualsRate ?? '') }, [line.actualsRate])

  const save = () => {
    const trimmed = val.trim()
    if (trimmed === '') {
      if (line.actualsRate !== null) update.mutate({ id: line.id, patch: { actualsRate: null } })
      return
    }
    const n = Number.parseFloat(trimmed)
    if (!Number.isFinite(n) || n < 0) {
      setVal(line.actualsRate ?? '')
      return
    }
    const next = n.toFixed(2)
    if (next === line.actualsRate) return
    update.mutate({ id: line.id, patch: { actualsRate: next } })
  }

  return (
    <Field label="Actuals rate override (optional)">
      <div style={{ position: 'relative' }}>
        <span
          className="font-mono"
          style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            fontSize: 12, color: '#62627a', pointerEvents: 'none',
          }}
        >$</span>
        <input
          type="text"
          inputMode="decimal"
          placeholder="(uses version rate)"
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={save}
          className="font-mono"
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 8,
            padding: '8px 10px 8px 22px',
            color: '#e8e8f0', fontSize: 12,
            outline: 'none',
          }}
        />
      </div>
    </Field>
  )
}

// ── LineExpensesTab ─────────────────────────────────────────────────────

function LineExpensesTab({
  projectId, budgetId, line, expenses, currentMemberId, accent,
}: {
  projectId: string
  budgetId: string
  line: BudgetLineWithAmounts
  expenses: Expense[]
  currentMemberId: string | null
  accent: string
}) {
  const create = useCreateManualExpense(projectId)
  const [adding, setAdding] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [vendor, setVendor] = useState('')
  const [notes, setNotes] = useState('')

  const reset = () => { setAmount(''); setDate(today); setVendor(''); setNotes(''); setAdding(false) }
  const submit = () => {
    if (!currentMemberId) return
    const n = Number.parseFloat(amount)
    if (!Number.isFinite(n) || n < 0) return
    create.mutate({
      budgetId, lineId: line.id,
      amount: n.toFixed(2),
      date,
      vendor: vendor.trim() || null,
      notes: notes.trim() || null,
      createdBy: currentMemberId,
    }, { onSuccess: reset })
  }

  return (
    <div className="flex flex-col" style={{ gap: 8 }}>
      {expenses.length === 0 && !adding && (
        <div
          className="text-center"
          style={{ padding: '24px 8px', fontSize: 12, color: '#62627a' }}
        >No expenses yet</div>
      )}

      {expenses.map(e => (
        <ExpenseRow key={e.id} expense={e} />
      ))}

      {adding ? (
        <div
          className="flex flex-col"
          style={{
            gap: 10, padding: 12, borderRadius: 10,
            background: 'rgba(10,10,18,0.42)',
            border: `1px solid ${accent}33`,
          }}
        >
          <Field label="Amount">
            <div style={{ position: 'relative' }}>
              <span
                className="font-mono"
                style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 12, color: '#62627a', pointerEvents: 'none',
                }}
              >$</span>
              <input
                type="number" inputMode="decimal" step="0.01" min="0"
                value={amount}
                autoFocus
                onChange={e => setAmount(e.target.value)}
                className="font-mono"
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 8, padding: '8px 10px 8px 22px',
                  color: '#fff', fontSize: 12, outline: 'none',
                }}
              />
            </div>
          </Field>
          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="font-mono"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 8, padding: '8px 10px',
                color: '#e8e8f0', fontSize: 12, outline: 'none',
              }}
            />
          </Field>
          <Field label="Vendor (optional)">
            <input
              type="text"
              value={vendor}
              onChange={e => setVendor(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 8, padding: '8px 10px',
                color: '#e8e8f0', fontSize: 13, outline: 'none', fontFamily: 'inherit',
              }}
            />
          </Field>
          <Field label="Notes (optional)">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 8, padding: '8px 10px',
                color: '#e8e8f0', fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'inherit',
              }}
            />
          </Field>
          <div className="flex" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={reset}
              className="font-mono uppercase"
              style={{
                padding: '8px 14px', borderRadius: 999,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                color: '#a0a0b8', fontSize: 9, letterSpacing: '0.08em', cursor: 'pointer',
              }}
            >Cancel</button>
            <button
              type="button"
              onClick={submit}
              disabled={!currentMemberId || !amount.trim()}
              className="font-mono uppercase"
              style={{
                padding: '8px 16px', borderRadius: 999,
                background: amount.trim() && currentMemberId ? `${accent}24` : 'rgba(255,255,255,0.04)',
                border: amount.trim() && currentMemberId ? `1px solid ${accent}66` : '1px solid rgba(255,255,255,0.06)',
                color: amount.trim() && currentMemberId ? accent : '#62627a',
                fontSize: 9, letterSpacing: '0.08em',
                cursor: amount.trim() && currentMemberId ? 'pointer' : 'not-allowed',
              }}
            >Save expense</button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { haptic('light'); setAdding(true) }}
          className="font-mono uppercase"
          style={{
            marginTop: 4, padding: '10px 14px', borderRadius: 10,
            background: 'transparent', border: '1px dashed rgba(255,255,255,0.15)',
            color: '#a0a0b8', fontSize: 9, letterSpacing: '0.08em',
            cursor: 'pointer', textAlign: 'center',
          }}
        >+ Add expense</button>
      )}
    </div>
  )
}

function ExpenseRow({ expense }: { expense: Expense }) {
  const sourceLabel = expense.source === 'timecard' ? '⏱ Timecard' : '🧾 Manual'
  const subtitle = expense.vendor ?? expense.notes ?? (expense.source === 'timecard' ? 'Approved timecard' : 'Manual entry')
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderRadius: 10,
        background: 'rgba(10,10,18,0.42)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="flex-1" style={{ minWidth: 0 }}>
        <div
          className="font-mono uppercase"
          style={{ fontSize: 9, letterSpacing: '0.08em', color: '#a0a0b8' }}
        >{sourceLabel} · {expense.date}</div>
        <div
          style={{
            fontSize: 12, color: '#e8e8f0', marginTop: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >{subtitle}</div>
      </div>
      <div
        className="font-mono"
        style={{ fontSize: 13, fontWeight: 600, color: '#fff', flexShrink: 0 }}
      >{formatUSD(Number(expense.amount))}</div>
    </div>
  )
}

// ── LineThreadsTab ──────────────────────────────────────────────────────

function LineThreadsTab({ parts }: { parts: ReturnType<typeof useDetailSheetThreads> }) {
  return (
    <div className="flex flex-col" style={{ gap: 12, alignItems: 'stretch' }}>
      <div className="flex items-center" style={{ gap: 10 }}>
        <span
          className="font-mono uppercase"
          style={{ fontSize: 9, letterSpacing: '0.10em', color: '#62627a' }}
        >Thread</span>
        <div style={{ marginLeft: 'auto' }}>{parts.TriggerIcon}</div>
      </div>
      {parts.PreviewRow}
      {parts.MessageZone}
      {parts.StartSheetOverlay}
    </div>
  )
}

// Re-export VARIANCE_HEX for the page (used by LineRow).
export { VARIANCE_HEX, PHASE_HEX }
