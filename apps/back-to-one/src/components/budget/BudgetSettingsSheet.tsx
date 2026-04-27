'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  useUpdateBudget, useDeleteBudget,
  useCreateBudgetMarkup, useUpdateBudgetMarkup, useDeleteBudgetMarkup,
} from '@/lib/hooks/useOriginOne'
import { computeLine } from '@/lib/budget/compute'
import type { EvalContext } from '@/lib/budget/eval'
import { haptic } from '@/lib/utils/haptics'
import type {
  Budget, BudgetVersion, BudgetAccount,
  BudgetLine, BudgetLineAmount, BudgetMarkup, Expense,
} from '@/types'

// PR 12 — settings sheet. Six sections per spec §11.2 Q2:
//   1. Variance threshold (numeric, with live "would-flag" preview)
//   2. Currency (locked — USD for v1)
//   3. Markup management (list + inline edit + add + delete)
//   4. Rate source version picker (radio chips)
//   5. Clone source (read-only)
//   6. Danger zone (delete budget — type-name confirmation)
//
// Replace-in-place: the page passes onBack, this component replaces the
// account list in the scroll surface. NOT a nested modal.

interface BudgetLineWithAmounts extends BudgetLine {
  amounts: BudgetLineAmount[]
}

interface BudgetSettingsSheetProps {
  projectId: string
  projectName: string
  budget: Budget & {
    versions: BudgetVersion[]
    accounts: BudgetAccount[]
    lines: BudgetLineWithAmounts[]
    markups: BudgetMarkup[]
    expenses: Expense[]
  }
  evalCtx: EvalContext
  activeVersionId: string | null
  cloneSourceProjectName: string | null
  accent: string
  onBack: () => void
  onDeleted: () => void
}

export function BudgetSettingsSheet({
  projectId: _projectId, projectName, budget, evalCtx, activeVersionId: _activeVersionId,
  cloneSourceProjectName, accent, onBack, onDeleted,
}: BudgetSettingsSheetProps) {
  const projectId = _projectId
  return (
    <div
      style={{
        padding: 'calc(var(--safe-top) + 10px) 16px 32px',
        display: 'flex', flexDirection: 'column', gap: 18,
      }}
    >
      <Header onBack={onBack} accent={accent} />

      <VarianceThresholdSection
        budget={budget}
        evalCtx={evalCtx}
        accent={accent}
        projectId={projectId}
      />

      <CurrencySection />

      <MarkupSection
        budget={budget}
        accent={accent}
        projectId={projectId}
      />

      <RateSourceSection
        budget={budget}
        accent={accent}
        projectId={projectId}
      />

      <CloneSourceSection
        cloneSourceProjectName={cloneSourceProjectName}
        clonedFromProjectId={budget.clonedFromProjectId}
      />

      <DangerZoneSection
        budget={budget}
        projectName={projectName}
        accent={accent}
        projectId={projectId}
        onDeleted={onDeleted}
      />
    </div>
  )
}

// ── Header ──────────────────────────────────────────────────────────────

function Header({ onBack, accent }: { onBack: () => void; accent: string }) {
  return (
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
        style={{ fontSize: 11, letterSpacing: '0.08em', color: accent }}
      >Settings</span>
    </div>
  )
}

// ── Section primitives ──────────────────────────────────────────────────

function Section({
  title, hint, children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section
      style={{
        padding: 14,
        borderRadius: 12,
        background: 'rgba(15,15,25,0.6)',
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      <div className="flex flex-col" style={{ gap: 4 }}>
        <span
          className="font-mono uppercase"
          style={{ fontSize: 9, letterSpacing: '0.12em', color: '#a0a0b8' }}
        >{title}</span>
        {hint && (
          <span style={{ fontSize: 11, color: '#62627a', lineHeight: 1.5 }}>{hint}</span>
        )}
      </div>
      {children}
    </section>
  )
}

// ── 1. Variance threshold ───────────────────────────────────────────────

function VarianceThresholdSection({
  budget, evalCtx, accent, projectId,
}: {
  budget: BudgetSettingsSheetProps['budget']
  evalCtx: EvalContext
  accent: string
  projectId: string
}) {
  // Display percent; Decimal(5,4) under the hood.
  const initialPct = (Number(budget.varianceThreshold) * 100).toFixed(0)
  const [pct, setPct] = useState(initialPct)
  const [debouncedPct, setDebouncedPct] = useState(pct)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedPct(pct), 200)
    return () => clearTimeout(t)
  }, [pct])

  const update = useUpdateBudget(projectId)

  const flaggedCount = useMemo(() => {
    const n = Number(debouncedPct) / 100
    if (!Number.isFinite(n) || n < 0 || n > 1) return null
    let count = 0
    for (const line of budget.lines) {
      const amount = line.amounts.find(a => a.versionId === budget.rateSourceVersionId) ?? line.amounts[0]
      const expensesForLine = budget.expenses.filter(e => e.lineId === line.id)
      const cl = computeLine(line, amount, expensesForLine, evalCtx, n)
      if (cl.flag === 'over' || cl.flag === 'under') count++
    }
    return count
  }, [debouncedPct, budget, evalCtx])

  const valid = (() => {
    const n = Number(pct)
    return Number.isFinite(n) && n >= 0 && n <= 100
  })()
  const dirty = pct !== initialPct
  const handleSave = () => {
    if (!valid || !dirty) return
    const decimal = (Number(pct) / 100).toFixed(4)
    haptic('medium')
    update.mutate({ id: budget.id, patch: { varianceThreshold: decimal } })
  }

  return (
    <Section
      title="Variance threshold"
      hint="Lines whose actuals exceed this share of the budgeted total are flagged. Half this value triggers the warning band."
    >
      <div className="flex items-center" style={{ gap: 8 }}>
        <div
          className="flex items-center"
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 8,
          }}
        >
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={pct}
            onChange={e => setPct(e.target.value)}
            style={{
              flex: 1, padding: '10px 12px',
              background: 'transparent', border: 'none',
              color: '#fff', fontSize: 13, outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <span className="font-mono" style={{ fontSize: 12, color: '#62627a', paddingRight: 12 }}>%</span>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!valid || !dirty || update.isPending}
          className="font-mono uppercase"
          style={{
            padding: '10px 14px', borderRadius: 8,
            fontSize: 9, letterSpacing: '0.10em',
            background: !valid || !dirty || update.isPending ? 'rgba(255,255,255,0.04)' : `${accent}24`,
            border: `1px solid ${!valid || !dirty || update.isPending ? 'rgba(255,255,255,0.08)' : `${accent}66`}`,
            color: !valid || !dirty || update.isPending ? '#62627a' : accent,
            cursor: !valid || !dirty || update.isPending ? 'not-allowed' : 'pointer',
          }}
        >Save</button>
      </div>
      <div
        className="font-mono"
        style={{ fontSize: 11, color: '#62627a' }}
      >
        {flaggedCount === null
          ? 'Enter a percentage between 0 and 100.'
          : `At ${debouncedPct}%, ~${flaggedCount} line${flaggedCount === 1 ? '' : 's'} would be flagged.`}
      </div>
    </Section>
  )
}

// ── 2. Currency (locked) ────────────────────────────────────────────────

function CurrencySection() {
  return (
    <Section
      title="Currency"
      hint="Locked to USD for v1. Multi-currency comes after Auth."
    >
      <div
        className="font-mono"
        style={{
          padding: '10px 12px', borderRadius: 8,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          color: '#a0a0b8', fontSize: 13,
        }}
      >USD</div>
    </Section>
  )
}

// ── 3. Markup management ────────────────────────────────────────────────

function MarkupSection({
  budget, accent, projectId,
}: {
  budget: BudgetSettingsSheetProps['budget']
  accent: string
  projectId: string
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const sortedMarkups = [...budget.markups].sort((a, b) => a.sortOrder - b.sortOrder)
  const nextSort = sortedMarkups.length > 0
    ? Math.max(...sortedMarkups.map(m => m.sortOrder)) + 1
    : 1

  return (
    <Section
      title="Markups"
      hint="Applied on top of the chart of accounts. Use grand-total for project-wide percentages, or scope to a specific account subtotal."
    >
      <div className="flex flex-col" style={{ gap: 6 }}>
        {sortedMarkups.length === 0 && !adding && (
          <div className="font-mono" style={{ fontSize: 11, color: '#62627a', padding: '4px 0' }}>
            No markups defined.
          </div>
        )}

        {sortedMarkups.map(markup => (
          editingId === markup.id ? (
            <MarkupEditor
              key={markup.id}
              markup={markup}
              budget={budget}
              accent={accent}
              projectId={projectId}
              mode="edit"
              onClose={() => setEditingId(null)}
            />
          ) : (
            <MarkupRow
              key={markup.id}
              markup={markup}
              budget={budget}
              accent={accent}
              onEdit={() => { haptic('light'); setEditingId(markup.id) }}
            />
          )
        ))}

        {adding ? (
          <MarkupEditor
            budget={budget}
            accent={accent}
            projectId={projectId}
            mode="create"
            defaultSortOrder={nextSort}
            onClose={() => setAdding(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => { haptic('light'); setAdding(true) }}
            className="font-mono uppercase"
            style={{
              padding: '8px 12px', borderRadius: 8,
              fontSize: 9, letterSpacing: '0.10em',
              background: 'rgba(255,255,255,0.03)',
              border: '1px dashed rgba(255,255,255,0.18)',
              color: '#a0a0b8', cursor: 'pointer',
            }}
          >+ Add markup</button>
        )}
      </div>
    </Section>
  )
}

function MarkupRow({
  markup, budget, accent, onEdit,
}: {
  markup: BudgetMarkup
  budget: BudgetSettingsSheetProps['budget']
  accent: string
  onEdit: () => void
}) {
  const account = markup.appliesTo === 'accountSubtotal' && markup.accountId
    ? budget.accounts.find(a => a.id === markup.accountId)
    : null
  const version = markup.versionId
    ? budget.versions.find(v => v.id === markup.versionId)
    : null
  const targetLabel = markup.appliesTo === 'grandTotal'
    ? 'on grand total'
    : account
      ? `on ${account.code} · ${account.name}`
      : 'on account subtotal (missing)'

  return (
    <button
      type="button"
      onClick={onEdit}
      className="text-left"
      style={{
        padding: 10, borderRadius: 8,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        cursor: 'pointer', color: 'inherit',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}
    >
      <div className="flex items-baseline" style={{ gap: 8 }}>
        <span style={{ fontSize: 13, color: '#fff', fontWeight: 500, flex: 1 }}>{markup.name}</span>
        <span className="font-mono" style={{ fontSize: 13, color: accent, fontWeight: 600 }}>
          {(Number(markup.percent) * 100).toFixed(2).replace(/\.?0+$/, '')}%
        </span>
      </div>
      <div
        className="font-mono"
        style={{ fontSize: 10, color: '#62627a', letterSpacing: '0.04em' }}
      >
        {targetLabel} · {version ? version.name : 'all versions'}
      </div>
    </button>
  )
}

function MarkupEditor({
  markup, budget, accent, projectId, mode, defaultSortOrder, onClose,
}: {
  markup?: BudgetMarkup
  budget: BudgetSettingsSheetProps['budget']
  accent: string
  projectId: string
  mode: 'create' | 'edit'
  defaultSortOrder?: number
  onClose: () => void
}) {
  const [name, setName] = useState(markup?.name ?? '')
  const [pctStr, setPctStr] = useState(markup ? (Number(markup.percent) * 100).toString() : '')
  const [appliesTo, setAppliesTo] = useState<'grandTotal' | 'accountSubtotal'>(
    markup?.appliesTo ?? 'grandTotal',
  )
  const [accountId, setAccountId] = useState<string | null>(markup?.accountId ?? null)
  const [versionId, setVersionId] = useState<string | null>(markup?.versionId ?? null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const create = useCreateBudgetMarkup(projectId)
  const update = useUpdateBudgetMarkup(projectId)
  const del = useDeleteBudgetMarkup(projectId)

  const topLevelAccounts = budget.accounts.filter(a => a.parentId == null)
  const sortedVersions = [...budget.versions].sort((a, b) => a.sortOrder - b.sortOrder)

  const pctValid = (() => {
    const n = Number(pctStr)
    return Number.isFinite(n) && n >= 0 && n <= 100
  })()
  const accountValid = appliesTo !== 'accountSubtotal' || !!accountId
  const valid = name.trim().length > 0 && pctValid && accountValid
  const isPending = create.isPending || update.isPending || del.isPending

  const handleSave = () => {
    if (!valid || isPending) return
    const decimal = (Number(pctStr) / 100).toFixed(4)
    const finalAccountId = appliesTo === 'accountSubtotal' ? accountId : null
    haptic('medium')
    if (mode === 'create') {
      create.mutate(
        {
          budgetId: budget.id, versionId,
          name: name.trim(), percent: decimal,
          appliesTo, accountId: finalAccountId,
          sortOrder: defaultSortOrder ?? 1,
        },
        { onSuccess: onClose },
      )
    } else if (markup) {
      update.mutate(
        {
          id: markup.id,
          patch: {
            name: name.trim(), percent: decimal,
            appliesTo, accountId: finalAccountId, versionId,
          },
        },
        { onSuccess: onClose },
      )
    }
  }

  const handleDelete = () => {
    if (!markup) return
    haptic('medium')
    del.mutate(markup.id, { onSuccess: onClose })
  }

  return (
    <div
      style={{
        padding: 12, borderRadius: 10,
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${accent}38`,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      {/* Name + percent — same row */}
      <div className="flex" style={{ gap: 6 }}>
        <input
          type="text"
          value={name}
          autoFocus={mode === 'create'}
          placeholder="Markup name"
          onChange={e => setName(e.target.value)}
          style={{
            flex: 1, padding: '8px 10px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 8,
            color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit',
          }}
        />
        <div
          className="flex items-center"
          style={{
            width: 90,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 8,
          }}
        >
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={pctStr}
            placeholder="0"
            onChange={e => setPctStr(e.target.value)}
            style={{
              flex: 1, padding: '8px 10px',
              background: 'transparent', border: 'none',
              color: '#fff', fontSize: 13, outline: 'none',
              fontFamily: 'inherit', minWidth: 0,
            }}
          />
          <span className="font-mono" style={{ fontSize: 11, color: '#62627a', paddingRight: 8 }}>%</span>
        </div>
      </div>

      {/* Target picker — radio chips */}
      <div className="flex flex-col" style={{ gap: 6 }}>
        <span
          className="font-mono uppercase"
          style={{ fontSize: 9, letterSpacing: '0.12em', color: '#a0a0b8' }}
        >Apply to</span>
        <div className="flex" style={{ gap: 6 }}>
          <Pill
            active={appliesTo === 'grandTotal'}
            accent={accent}
            onClick={() => { setAppliesTo('grandTotal'); setAccountId(null) }}
            label="Grand total"
          />
          <Pill
            active={appliesTo === 'accountSubtotal'}
            accent={accent}
            onClick={() => setAppliesTo('accountSubtotal')}
            label="Account subtotal"
          />
        </div>
        {appliesTo === 'accountSubtotal' && (
          <select
            value={accountId ?? ''}
            onChange={e => setAccountId(e.target.value || null)}
            style={{
              padding: '8px 10px',
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${accountId ? 'rgba(255,255,255,0.10)' : `${accent}55`}`,
              borderRadius: 8,
              color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit',
            }}
          >
            <option value="">— Select account —</option>
            {topLevelAccounts.map(a => (
              <option key={a.id} value={a.id} style={{ color: '#000' }}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Version scope picker */}
      <div className="flex flex-col" style={{ gap: 6 }}>
        <span
          className="font-mono uppercase"
          style={{ fontSize: 9, letterSpacing: '0.12em', color: '#a0a0b8' }}
        >Applies to versions</span>
        <select
          value={versionId ?? ''}
          onChange={e => setVersionId(e.target.value || null)}
          style={{
            padding: '8px 10px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 8,
            color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit',
          }}
        >
          <option value="" style={{ color: '#000' }}>All versions</option>
          {sortedVersions.map(v => (
            <option key={v.id} value={v.id} style={{ color: '#000' }}>{v.name}</option>
          ))}
        </select>
      </div>

      {/* Save / cancel / delete */}
      <div className="flex" style={{ gap: 6, marginTop: 4 }}>
        <button
          type="button"
          onClick={() => { haptic('light'); onClose() }}
          className="font-mono uppercase"
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 8,
            fontSize: 9, letterSpacing: '0.10em',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: '#a0a0b8', cursor: 'pointer',
          }}
        >Cancel</button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!valid || isPending}
          className="font-mono uppercase"
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 8,
            fontSize: 9, letterSpacing: '0.10em',
            background: !valid || isPending ? 'rgba(255,255,255,0.04)' : `${accent}24`,
            border: `1px solid ${!valid || isPending ? 'rgba(255,255,255,0.08)' : `${accent}66`}`,
            color: !valid || isPending ? '#62627a' : accent,
            cursor: !valid || isPending ? 'not-allowed' : 'pointer',
          }}
        >{mode === 'create' ? 'Add markup' : 'Save'}</button>
      </div>
      {mode === 'edit' && markup && (
        confirmingDelete ? (
          <div className="flex" style={{ gap: 6 }}>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="font-mono uppercase"
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8,
                fontSize: 9, letterSpacing: '0.10em',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: '#a0a0b8', cursor: 'pointer',
              }}
            >Keep</button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="font-mono uppercase"
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8,
                fontSize: 9, letterSpacing: '0.10em',
                background: 'rgba(232,86,74,0.10)',
                border: '1px solid rgba(232,86,74,0.40)',
                color: '#e8564a', cursor: 'pointer',
              }}
            >Delete markup</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="font-mono uppercase"
            style={{
              padding: '8px 12px', borderRadius: 8,
              fontSize: 9, letterSpacing: '0.10em',
              background: 'transparent',
              border: '1px solid rgba(232,86,74,0.30)',
              color: '#e8564a', cursor: 'pointer',
            }}
          >Delete markup</button>
        )
      )}
    </div>
  )
}

function Pill({
  active, accent, onClick, label,
}: {
  active: boolean
  accent: string
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-mono uppercase"
      style={{
        flex: 1,
        padding: '8px 10px', borderRadius: 999,
        fontSize: 9, letterSpacing: '0.06em',
        background: active ? `${accent}24` : 'rgba(255,255,255,0.02)',
        border: `1px solid ${active ? `${accent}66` : 'rgba(255,255,255,0.08)'}`,
        color: active ? accent : '#a0a0b8',
        cursor: 'pointer',
      }}
    >{label}</button>
  )
}

// ── 4. Rate source version picker ───────────────────────────────────────

function RateSourceSection({
  budget, accent, projectId,
}: {
  budget: BudgetSettingsSheetProps['budget']
  accent: string
  projectId: string
}) {
  const update = useUpdateBudget(projectId)
  const sortedVersions = [...budget.versions].sort((a, b) => a.sortOrder - b.sortOrder)
  const current = budget.rateSourceVersionId

  const handleSelect = (id: string) => {
    if (id === current) return
    haptic('light')
    update.mutate({ id: budget.id, patch: { rateSourceVersionId: id } })
  }

  return (
    <Section
      title="Rate source version"
      hint="Used when timecard.rate and line.actualsRate are both null. Pick the version whose per-line rates best represent your committed pricing."
    >
      <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>
        {sortedVersions.map(v => {
          const active = v.id === current
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => handleSelect(v.id)}
              className="font-mono"
              style={{
                flex: 1,
                padding: '8px 12px', borderRadius: 999,
                fontSize: 11, letterSpacing: '0.04em',
                background: active ? `${accent}24` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${active ? `${accent}66` : 'rgba(255,255,255,0.08)'}`,
                color: active ? accent : '#a0a0b8',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >{v.name}</button>
          )
        })}
      </div>
    </Section>
  )
}

// ── 5. Clone source ─────────────────────────────────────────────────────

function CloneSourceSection({
  cloneSourceProjectName, clonedFromProjectId,
}: {
  cloneSourceProjectName: string | null
  clonedFromProjectId: string | null
}) {
  const label = clonedFromProjectId == null
    ? 'Original budget'
    : cloneSourceProjectName
      ? `Cloned from ${cloneSourceProjectName}`
      : 'Cloned from a project no longer accessible'
  return (
    <Section title="Origin">
      <div
        className="font-mono"
        style={{
          padding: '10px 12px', borderRadius: 8,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          color: '#a0a0b8', fontSize: 12,
        }}
      >{label}</div>
    </Section>
  )
}

// ── 6. Danger zone — delete budget ──────────────────────────────────────

function DangerZoneSection({
  budget, projectName, accent: _accent, projectId, onDeleted,
}: {
  budget: BudgetSettingsSheetProps['budget']
  projectName: string
  accent: string
  projectId: string
  onDeleted: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
  const del = useDeleteBudget(projectId)

  const matches = typed.trim() === projectName

  const handleDelete = () => {
    if (!matches || del.isPending) return
    haptic('medium')
    del.mutate(budget.id, { onSuccess: onDeleted })
  }

  return (
    <section
      style={{
        padding: 14, borderRadius: 12,
        background: 'rgba(232,86,74,0.04)',
        border: '1px solid rgba(232,86,74,0.20)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      <div className="flex flex-col" style={{ gap: 4 }}>
        <span
          className="font-mono uppercase"
          style={{ fontSize: 9, letterSpacing: '0.12em', color: '#e8564a' }}
        >Danger zone</span>
        <span style={{ fontSize: 11, color: '#a0a0b8', lineHeight: 1.5 }}>
          Removes every account, line, version, variable, and markup on this budget. Manual expenses on the project remain (detached).
        </span>
      </div>

      {confirming ? (
        <>
          <div style={{ fontSize: 11, color: '#a0a0b8', lineHeight: 1.5 }}>
            Type <span style={{ color: '#fff', fontWeight: 600 }}>{projectName}</span> to confirm.
          </div>
          <input
            type="text"
            value={typed}
            autoFocus
            placeholder={projectName}
            onChange={e => setTyped(e.target.value)}
            style={{
              padding: '8px 10px',
              background: 'rgba(232,86,74,0.06)',
              border: '1px solid rgba(232,86,74,0.30)',
              borderRadius: 8,
              color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit',
            }}
          />
          <div className="flex" style={{ gap: 6 }}>
            <button
              type="button"
              onClick={() => { setConfirming(false); setTyped('') }}
              className="font-mono uppercase"
              style={{
                flex: 1, padding: '9px 12px', borderRadius: 8,
                fontSize: 9, letterSpacing: '0.10em',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: '#a0a0b8', cursor: 'pointer',
              }}
            >Cancel</button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!matches || del.isPending}
              className="font-mono uppercase"
              style={{
                flex: 1, padding: '9px 12px', borderRadius: 8,
                fontSize: 9, letterSpacing: '0.10em',
                background: matches && !del.isPending ? 'rgba(232,86,74,0.16)' : 'rgba(232,86,74,0.06)',
                border: `1px solid ${matches && !del.isPending ? 'rgba(232,86,74,0.55)' : 'rgba(232,86,74,0.20)'}`,
                color: matches && !del.isPending ? '#e8564a' : '#62627a',
                cursor: matches && !del.isPending ? 'pointer' : 'not-allowed',
              }}
            >{del.isPending ? 'Deleting…' : 'Delete budget'}</button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="font-mono uppercase"
          style={{
            padding: '9px 12px', borderRadius: 8,
            fontSize: 9, letterSpacing: '0.10em',
            background: 'transparent',
            border: '1px solid rgba(232,86,74,0.40)',
            color: '#e8564a', cursor: 'pointer',
          }}
        >Delete budget</button>
      )}
    </section>
  )
}
