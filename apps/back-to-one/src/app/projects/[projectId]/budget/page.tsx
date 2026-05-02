'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  useProject, useBudget, useShootDays, useCrew, useMeId, useProjects,
  useCreateBudgetLine, useUpdateBudgetVersion,
  useDuplicateBudgetVersion, useDeleteBudgetVersion,
} from '@/lib/hooks/useOriginOne'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProjectSwitcher } from '@/components/ProjectSwitcher'
import { getProjectColor, statusHex, statusLabel as projectStatusLabel } from '@/lib/utils/phase'
import { deriveProjectColors, DEFAULT_PROJECT_HEX } from '@origin-one/ui'
import { useViewerRole } from '@/lib/auth/useViewerRole'
import { buildEvalContext, rollUpBudget, type ComputedLine, type AccountSubtotal, type BudgetRollup } from '@/lib/budget/compute'
import { useFabAction } from '@/lib/contexts/FabActionContext'
import { useLongPress } from '@/lib/hooks/useLongPress'
import { haptic } from '@/lib/utils/haptics'
import { LineDetailSheet } from '@/components/budget/LineDetailSheet'
import { TopsheetDrawer } from '@/components/budget/TopsheetDrawer'
import { TemplatePicker } from '@/components/budget/TemplatePicker'
import { TagFilterStrip } from '@/components/budget/TagFilterStrip'
import { BudgetSettingsSheet } from '@/components/budget/BudgetSettingsSheet'
import { VariableInspectTooltip } from '@/components/budget/VariableInspectTooltip'
import type { TopsheetVersionTotal } from '@/components/budget/TopsheetContent'
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
  TeamMember,
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
  versions, activeId, accent, onChange, onLongPress,
}: {
  versions: BudgetVersion[]
  activeId: string | null
  accent: string
  onChange: (id: string) => void
  onLongPress: (versionId: string) => void
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
      {sorted.map(v => (
        <VersionPill
          key={v.id}
          version={v}
          active={v.id === activeId}
          accent={accent}
          onTap={() => onChange(v.id)}
          onLongPress={() => onLongPress(v.id)}
        />
      ))}
    </div>
  )
}

function VersionPill({
  version, active, accent, onTap, onLongPress,
}: {
  version: BudgetVersion
  active: boolean
  accent: string
  onTap: () => void
  onLongPress: () => void
}) {
  const longPress = useLongPress(() => { haptic('medium'); onLongPress() }, 500)
  const locked = version.state === 'locked'
  // Cinema Glass — active pill wears .sheen-title + accent inset border
  // (matches the Timeline mode-toggle treatment).
  return (
    <button
      type="button"
      onClick={onTap}
      {...longPress}
      className={`font-mono uppercase ${active ? 'sheen-title' : ''}`}
      style={{
        flex: 1,
        padding: '7px 10px', borderRadius: 999,
        fontSize: 10, letterSpacing: '0.06em', fontWeight: 600,
        ...(active
          ? { boxShadow: `inset 0 0 0 1px rgba(var(--accent-rgb), 0.32)` }
          : { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', color: '#a0a0b8' }),
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      {version.name}{locked ? ' ⌃' : ''}
    </button>
  )
}

// ── VersionPillMenu — opens on long-press of a pill. Inline overlay
// (NOT a nested modal). Replaces the version pill area with action
// buttons; tap an action or "Cancel" to dismiss.

function VersionPillMenu({
  version, allVersions, projectId, accent, currentMemberId, onDismiss,
}: {
  version: BudgetVersion
  allVersions: BudgetVersion[]
  projectId: string
  accent: string
  currentMemberId: string | null
  onDismiss: () => void
}) {
  type Mode = 'menu' | 'rename' | 'duplicate' | 'delete-confirm' | 'lock-confirm'
  const [mode, setMode] = useState<Mode>('menu')
  const [renameVal, setRenameVal] = useState(version.name)
  const [dupName, setDupName] = useState(`${version.name} (copy)`)

  const update = useUpdateBudgetVersion(projectId)
  const dup = useDuplicateBudgetVersion(projectId)
  const del = useDeleteBudgetVersion(projectId)

  const isLast = allVersions.length <= 1
  const locked = version.state === 'locked'

  const close = () => onDismiss()

  if (mode === 'menu') {
    return (
      <Overlay accent={accent}>
        <Lbl>Version: {version.name}</Lbl>
        <ActionRow accent={accent}>
          <ActionBtn accent={accent} onClick={() => setMode('rename')}>Rename</ActionBtn>
          <ActionBtn
            accent={accent}
            onClick={() => locked
              ? update.mutate({ id: version.id, patch: { state: 'draft' } }, { onSuccess: close })
              : setMode('lock-confirm')
            }
          >{locked ? 'Unlock' : 'Lock'}</ActionBtn>
          <ActionBtn accent={accent} onClick={() => setMode('duplicate')}>Duplicate</ActionBtn>
          <ActionBtn
            accent={accent}
            tone="danger"
            disabled={isLast}
            onClick={() => setMode('delete-confirm')}
          >{isLast ? 'Last — can’t delete' : 'Delete'}</ActionBtn>
        </ActionRow>
        <ActionRow accent={accent}>
          <ActionBtn accent={accent} tone="muted" onClick={close}>Cancel</ActionBtn>
        </ActionRow>
      </Overlay>
    )
  }

  if (mode === 'rename') {
    return (
      <Overlay accent={accent}>
        <Lbl>Rename version</Lbl>
        <input
          type="text"
          value={renameVal}
          autoFocus
          onChange={e => setRenameVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') setMode('menu') }}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 8, padding: '8px 10px',
            color: '#fff', fontSize: 13, outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <ActionRow accent={accent}>
          <ActionBtn accent={accent} tone="muted" onClick={() => setMode('menu')}>Back</ActionBtn>
          <ActionBtn
            accent={accent}
            disabled={!renameVal.trim() || renameVal.trim() === version.name}
            onClick={() => {
              const t = renameVal.trim()
              if (!t) return
              update.mutate({ id: version.id, patch: { name: t } }, { onSuccess: close })
            }}
          >Save</ActionBtn>
        </ActionRow>
      </Overlay>
    )
  }

  if (mode === 'lock-confirm') {
    return (
      <Overlay accent={accent}>
        <Lbl>Lock {version.name}?</Lbl>
        <p style={{ fontSize: 12, color: '#a0a0b8', lineHeight: 1.5 }}>
          Locked versions are read-only. You can unlock anytime from this menu.
        </p>
        <ActionRow accent={accent}>
          <ActionBtn accent={accent} tone="muted" onClick={() => setMode('menu')}>Back</ActionBtn>
          <ActionBtn
            accent={accent}
            onClick={() => update.mutate(
              { id: version.id, patch: { state: 'locked', lockedBy: currentMemberId } },
              { onSuccess: close },
            )}
          >Lock</ActionBtn>
        </ActionRow>
      </Overlay>
    )
  }

  if (mode === 'duplicate') {
    return (
      <Overlay accent={accent}>
        <Lbl>Duplicate {version.name}</Lbl>
        <input
          type="text"
          value={dupName}
          autoFocus
          onChange={e => setDupName(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 8, padding: '8px 10px',
            color: '#fff', fontSize: 13, outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <p style={{ fontSize: 11, color: '#62627a', lineHeight: 1.5 }}>
          Copies all per-line qty + rate values from {version.name}. Variables and markups stay budget-level.
        </p>
        <ActionRow accent={accent}>
          <ActionBtn accent={accent} tone="muted" onClick={() => setMode('menu')}>Back</ActionBtn>
          <ActionBtn
            accent={accent}
            disabled={!dupName.trim()}
            onClick={() => {
              const t = dupName.trim()
              if (!t) return
              dup.mutate({ srcVersionId: version.id, name: t }, { onSuccess: close })
            }}
          >Duplicate</ActionBtn>
        </ActionRow>
      </Overlay>
    )
  }

  // delete-confirm
  return (
    <Overlay accent={accent}>
      <Lbl>Delete {version.name}?</Lbl>
      <p style={{ fontSize: 12, color: '#e8564a', lineHeight: 1.5 }}>
        This removes all qty + rate values for this version, plus any variables and markups
        scoped to it. Cannot be undone.
      </p>
      <ActionRow accent={accent}>
        <ActionBtn accent={accent} tone="muted" onClick={() => setMode('menu')}>Back</ActionBtn>
        <ActionBtn
          accent={accent}
          tone="danger"
          onClick={() => del.mutate(version.id, { onSuccess: close })}
        >Delete</ActionBtn>
      </ActionRow>
    </Overlay>
  )
}

function Overlay({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        margin: '4px 16px 10px',
        padding: 12,
        borderRadius: 14,
        background: 'rgba(10,10,18,0.92)',
        border: `1px solid ${accent}40`,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >{children}</div>
  )
}

function Lbl({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="font-mono uppercase"
      style={{ fontSize: 9, letterSpacing: '0.12em', color: '#a0a0b8' }}
    >{children}</div>
  )
}

function ActionRow({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>{children}</div>
  )
}

function ActionBtn({
  accent, tone, disabled, onClick, children,
}: {
  accent: string
  tone?: 'danger' | 'muted'
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  const bg = tone === 'danger' ? 'rgba(232,86,74,0.10)'
    : tone === 'muted' ? 'rgba(255,255,255,0.04)'
    : `${accent}1a`
  const border = tone === 'danger' ? 'rgba(232,86,74,0.40)'
    : tone === 'muted' ? 'rgba(255,255,255,0.10)'
    : `${accent}55`
  const color = tone === 'danger' ? '#e8564a'
    : tone === 'muted' ? '#a0a0b8'
    : accent
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="font-mono uppercase"
      style={{
        flex: 1,
        padding: '8px 12px', borderRadius: 999,
        fontSize: 9, letterSpacing: '0.08em',
        background: disabled ? 'rgba(255,255,255,0.02)' : bg,
        border: `1px solid ${disabled ? 'rgba(255,255,255,0.06)' : border}`,
        color: disabled ? '#62627a' : color,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >{children}</button>
  )
}

// ── VariablesStrip ──────────────────────────────────────────────────────

function VariablesStrip({
  schedule, vars,
}: {
  schedule: { prepDays: number; shootDays: number; postDays: number }
  vars: Record<string, string>
}) {
  // Cinema Glass — phase chips wear the canonical chip alpha
  // (bg @ 0.20, border @ 0.50) + glowing phase dot. Custom variables
  // collapse to the neutral glass chip.
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
            className="font-mono uppercase inline-flex items-center"
            style={{
              gap: 5, padding: '3px 9px', borderRadius: 999,
              fontSize: 10, letterSpacing: '0.06em', fontWeight: 600,
              background: `${hex}33`, border: `1px solid ${hex}80`, color: hex,
            }}
          >
            <span className="rounded-full" style={{ width: 4, height: 4, background: hex, boxShadow: `0 0 4px ${hex}` }} />
            <span>{PHASE_LABEL[t]}</span>
            <span>{value}</span>
          </span>
        )
      })}
      {Object.entries(vars).map(([name, value]) => (
        <span
          key={name}
          className="font-mono inline-flex items-center"
          style={{
            gap: 6, padding: '3px 10px', borderRadius: 999,
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
  line, computed, amount, onTap, onFormulaTap,
}: {
  line: BudgetLineWithAmounts
  computed: ComputedLine
  amount: BudgetLineAmount | undefined
  onTap: () => void
  onFormulaTap?: (lineId: string) => void
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
        cursor: 'pointer',
        width: '100%', color: 'inherit',
        position: 'relative',
      }}
      onClick={() => { haptic('light'); onTap() }}
      role="button"
      tabIndex={0}
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
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (onFormulaTap) { haptic('light'); onFormulaTap(line.id) }
              }}
              className="font-mono"
              style={{
                color: PHASE_HEX.prod,
                borderBottom: `1px dotted ${PHASE_HEX.prod}80`,
                background: 'transparent', border: 'none', padding: 0,
                fontSize: 'inherit', letterSpacing: 'inherit',
                cursor: 'pointer',
              }}
              title={`= ${computed.qtyResolved}`}
            >
              {amount?.qty}
            </button>
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
  account, lines, amountsByLine, computedByLine, subtotal, expanded, onToggle, onLineTap,
  visibleLineIds, onFormulaTap,
}: {
  account: BudgetAccount
  lines: BudgetLineWithAmounts[]
  amountsByLine: Map<string, BudgetLineAmount | undefined>
  computedByLine: Map<string, ComputedLine>
  subtotal: AccountSubtotal | undefined
  expanded: boolean
  onToggle: () => void
  onLineTap: (lineId: string) => void
  // PR 12 — when active filter narrows what's visible, only sum
  // visible lines into the displayed subtotal. visibleLineIds=null means
  // no filter active (use rollup subtotal as authoritative).
  visibleLineIds: Set<string> | null
  onFormulaTap?: (lineId: string) => void
}) {
  const accountLines = lines.filter(l => l.accountId === account.id)
  const visibleAccountLines = visibleLineIds
    ? accountLines.filter(l => visibleLineIds.has(l.id))
    : accountLines
  const total = visibleLineIds
    ? visibleAccountLines.reduce((s, l) => s + (computedByLine.get(l.id)?.total ?? 0), 0)
    : subtotal?.total ?? 0

  // Cinema Glass — account row sits in a .glass-tile-sm. Project accent
  // tints the surface via --tile-rgb inherited from the screen root.
  return (
    <div className="glass-tile-sm">
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
          {visibleAccountLines.length === 0 ? (
            <div
              className="font-mono"
              style={{ fontSize: 10, color: '#62627a', padding: '8px 10px', letterSpacing: '0.04em' }}
            >No matching lines</div>
          ) : (
            visibleAccountLines.map(line => {
              const computed = computedByLine.get(line.id)
              if (!computed) return null
              return (
                <LineRow
                  key={line.id}
                  line={line}
                  computed={computed}
                  amount={amountsByLine.get(line.id)}
                  onTap={() => onLineTap(line.id)}
                  onFormulaTap={onFormulaTap}
                />
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// PR 12 — header overflow menu. Sits inline between the variables
// strip and the body. Replace-in-place; NOT a nested modal.
function OverflowMenu({
  accent, onSettings, onTopsheet, onClose,
}: {
  accent: string
  onSettings: () => void
  onTopsheet: () => void
  onClose: () => void
}) {
  return (
    <div
      style={{
        margin: '4px 16px 10px',
        padding: 12,
        borderRadius: 14,
        background: 'rgba(10,10,18,0.92)',
        border: `1px solid ${accent}40`,
        display: 'flex', flexDirection: 'column', gap: 6,
      }}
    >
      <button
        type="button"
        onClick={onSettings}
        className="text-left"
        style={{
          padding: '10px 12px', borderRadius: 8,
          background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
          color: '#fff', fontSize: 13, cursor: 'pointer',
        }}
      >Settings</button>
      <button
        type="button"
        onClick={onTopsheet}
        className="text-left"
        style={{
          padding: '10px 12px', borderRadius: 8,
          background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
          color: '#fff', fontSize: 13, cursor: 'pointer',
        }}
      >Topsheet</button>
      <button
        type="button"
        onClick={onClose}
        className="font-mono uppercase"
        style={{
          padding: '8px 12px', borderRadius: 8,
          fontSize: 9, letterSpacing: '0.10em',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.10)',
          color: '#a0a0b8', cursor: 'pointer',
        }}
      >Cancel</button>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────

export default function BudgetPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const router = useRouter()

  // Producer-only page (auth-004 RLS guarantees no Budget data leaks; this
  // redirect just keeps crew from landing on a hard-empty page). The render
  // gate sits after all hooks (see end of component) — early-returning here
  // breaks the rules of hooks, since the body below has ~30 more hooks whose
  // call count must stay stable across renders as `role` resolves.
  const role = useViewerRole(projectId)
  useEffect(() => {
    if (role === 'crew') router.replace(`/projects/${projectId}`)
  }, [role, router, projectId])

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

  // Per-version rollups for the topsheet — one column per version. The
  // active-version rollup above feeds the on-page list; topsheet needs
  // every version's totals at once. EvalContext is built per version
  // because version-scoped variable overrides differ.
  const topsheetData = useMemo(() => {
    if (!budget) return null
    const sortedVersions = [...budget.versions].sort((a, b) => a.sortOrder - b.sortOrder)
    const perVersion = new Map<string, TopsheetVersionTotal>()
    const sectionByVersion = new Map<string, { atl: number; btl: number }>()

    for (const v of sortedVersions) {
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
      const byAccountId = new Map<string, number>()
      for (const a of budget.accounts) {
        if (a.parentId == null) {
          byAccountId.set(a.id, r.subtotalByAccount.get(a.id)?.total ?? 0)
        }
      }
      perVersion.set(v.id, {
        versionId: v.id,
        total: r.grandTotal,
        byAccountId,
        markupAmounts: r.markupAmounts,
      })
      // Section subtotals (sum of root accounts in each section).
      let atl = 0, btl = 0
      for (const a of budget.accounts) {
        if (a.parentId != null) continue
        const sub = r.subtotalByAccount.get(a.id)?.total ?? 0
        if (a.section === 'ATL') atl += sub
        else btl += sub
      }
      sectionByVersion.set(v.id, { atl, btl })
    }

    // Actuals per top-level account (versions don't change actuals).
    const actualsByAccountId = new Map<string, number>()
    let atlActuals = 0, btlActuals = 0
    if (rollup) {
      for (const a of budget.accounts) {
        if (a.parentId == null) {
          const sub = rollup.subtotalByAccount.get(a.id)
          const v = sub?.totalActuals ?? 0
          actualsByAccountId.set(a.id, v)
          if (a.section === 'ATL') atlActuals += v
          else btlActuals += v
        }
      }
    }

    return {
      perVersion,
      sectionSubtotalsByVersion: sectionByVersion,
      sectionActuals: { atl: atlActuals, btl: btlActuals },
      actualsByAccountId,
    }
  }, [budget, shootDays, rollup])

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

  // PR 12 — tag filter (AND semantics). Persists per-(project, budget)
  // in localStorage; mirrors the account-expand pattern.
  const tagFilterKey = budget ? `budget-tag-filter:${projectId}:${budget.id}` : null
  const [activeTags, setActiveTags] = useState<string[]>([])
  useEffect(() => {
    if (!tagFilterKey) return
    try {
      const raw = window.localStorage.getItem(tagFilterKey)
      if (raw) setActiveTags(JSON.parse(raw) as string[])
    } catch { /* ignore */ }
  }, [tagFilterKey])
  const toggleTag = (tag: string) => {
    setActiveTags(prev => {
      const next = prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
      try {
        if (tagFilterKey) window.localStorage.setItem(tagFilterKey, JSON.stringify(next))
      } catch { /* ignore */ }
      return next
    })
  }
  const clearTags = () => {
    setActiveTags([])
    try {
      if (tagFilterKey) window.localStorage.setItem(tagFilterKey, JSON.stringify([]))
    } catch { /* ignore */ }
  }

  // PR 12 — unique tags across the budget, sorted by use count then name.
  const allTags = useMemo<string[]>(() => {
    if (!budget) return []
    const counts = new Map<string, number>()
    for (const line of budget.lines) {
      for (const tag of line.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag]) => tag)
  }, [budget])

  // PR 12 — visible line ids under the active filter. AND semantics: a
  // line passes only if its tags include every active filter tag.
  // Returns null when no filter is active so children can short-circuit
  // to the unfiltered rollup subtotals.
  const visibleLineIds = useMemo<Set<string> | null>(() => {
    if (!budget || activeTags.length === 0) return null
    const set = new Set<string>()
    for (const line of budget.lines) {
      const lineTags = new Set(line.tags)
      if (activeTags.every(t => lineTags.has(t))) set.add(line.id)
    }
    return set
  }, [budget, activeTags])

  const findFormulaLine = (lineId: string) => budget?.lines.find(l => l.id === lineId) ?? null
  const findFormulaAmount = (lineId: string) => {
    if (!budget || !activeVersionId) return undefined
    const line = budget.lines.find(l => l.id === lineId)
    return line?.amounts.find(a => a.versionId === activeVersionId)
  }

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
  // Track most-recently-expanded account so + Add line knows where to attach.
  const lastExpandedRef = useRef<string | null>(null)
  const toggleExpand = (accountId: string) => {
    setExpandedSet(prev => {
      const next = new Set(prev)
      if (next.has(accountId)) {
        next.delete(accountId)
      } else {
        next.add(accountId)
        lastExpandedRef.current = accountId
      }
      try {
        window.localStorage.setItem(expandKey, JSON.stringify(Array.from(next)))
      } catch { /* ignore */ }
      return next
    })
  }

  // Layer state: 'list' (account list) | 'detail' (line detail sheet)
  // | 'settings' (PR 12 — budget settings sheet, replace-in-place).
  // PR 10 adds the topsheet drawer/panel — orthogonal: it can be open
  // alongside list / detail / settings. On mobile it covers; on
  // desktop it sits alongside as a side panel.
  const [layer, setLayer] = useState<'list' | 'detail' | 'settings'>('list')
  const [activeLineId, setActiveLineId] = useState<string | null>(null)
  const [topsheetOpen, setTopsheetOpen] = useState(false)

  // PR 12 — overflow ("•••") menu state.
  const [overflowOpen, setOverflowOpen] = useState(false)

  // PR 12 — formula-chip inspect tooltip state.
  const [tooltipLineId, setTooltipLineId] = useState<string | null>(null)

  // PR 12 — clone-source label resolution. Look up the source project
  // name from the projects list (already loaded for nav). When the
  // source project was archived/deleted, name is undefined and the
  // settings sheet falls back to a "no longer accessible" copy.
  const { data: allProjects } = useProjects()
  const cloneSourceProjectName = useMemo(() => {
    if (!budget?.clonedFromProjectId || !allProjects) return null
    const src = (allProjects as { id: string; name: string }[]).find(p => p.id === budget.clonedFromProjectId)
    return src?.name ?? null
  }, [budget?.clonedFromProjectId, allProjects])
  // Reset back to list when budget reloads with no active line (e.g., line deleted).
  useEffect(() => {
    if (layer === 'detail' && activeLineId && budget) {
      const exists = budget.lines.some(l => l.id === activeLineId)
      if (!exists) { setLayer('list'); setActiveLineId(null) }
    }
  }, [budget, layer, activeLineId])

  // Long-press version-pill menu state.
  const [menuVersionId, setMenuVersionId] = useState<string | null>(null)

  // PR 11 — empty-state template picker. Shown inline (replaces the
  // empty-state copy on the same surface, no nested modal).
  const [pickerOpen, setPickerOpen] = useState(false)

  // Resolve current ProjectMember.id for createdBy / lockedBy fields.
  // Pre-Auth: useMeId returns User.id; we look up the matching ProjectMember
  // for this project. Single swap point on Auth day.
  const meId = useMeId()
  const { data: crewRaw } = useCrew(projectId)
  const currentMemberId = useMemo<string | null>(() => {
    if (!meId || !crewRaw) return null
    // useCrew(projectId) is already server-side filtered to this project,
    // so userId match is sufficient. Returns ProjectMember.id for use in
    // createdBy / lockedBy fields per spec §3 (ProjectMember.id pre-Auth).
    const member = (crewRaw as TeamMember[]).find(c => c.userId === meId)
    return member?.id ?? null
  }, [meId, crewRaw])

  // + Add line via ActionBar — registered only when budget is loaded
  // and we're in list view. handleAddLine creates a fresh line in the
  // most recently expanded account (or first account in list if none),
  // then opens the detail sheet on Edit tab.
  const createLine = useCreateBudgetLine(projectId)
  const handleAddLine = () => {
    if (!budget) return
    if (accountsSorted.length === 0) return
    const targetAccountId = lastExpandedRef.current ?? accountsSorted[0]!.id
    haptic('light')
    createLine.mutate(
      {
        budgetId: budget.id,
        accountId: targetAccountId,
        description: 'New line',
        unit: 'DAY',
        fringeRate: '0',
        sortOrder: 999,
      },
      {
        onSuccess: (newId) => {
          setActiveLineId(newId)
          setLayer('detail')
          // Make sure the parent account is expanded so back-to-list shows
          // the new line in context.
          setExpandedSet(prev => {
            if (prev.has(targetAccountId)) return prev
            const next = new Set(prev)
            next.add(targetAccountId)
            try {
              window.localStorage.setItem(expandKey, JSON.stringify(Array.from(next)))
            } catch { /* ignore */ }
            return next
          })
        },
      },
    )
  }
  useFabAction(
    { onPress: handleAddLine, label: 'Add line item' },
    [budget?.id, accountsSorted.length],
  )

  // Render gate: nothing for unresolved role / non-producers. All hooks
  // above run unconditionally; only the JSX below is gated.
  if (role !== 'producer') return null

  const activeLine = activeLineId && budget
    ? budget.lines.find(l => l.id === activeLineId) ?? null
    : null

  // Cinema Glass — feed --accent-rgb / --accent-glow-rgb / --tile-rgb
  // off the project accent so .sheen-title and any rgba(var(--accent-rgb),…)
  // consumer reads the project tint. Same pattern as HubContent + Timeline.
  const [ar, ag, ab] = [parseInt(accent.slice(1, 3), 16), parseInt(accent.slice(3, 5), 16), parseInt(accent.slice(5, 7), 16)]
  const glowR = Math.min(255, ar + 20), glowG = Math.min(255, ag + 20), glowB = Math.min(255, ab + 20)

  return (
    <div
      className="screen"
      style={{
        ['--accent-rgb' as string]: `${ar}, ${ag}, ${ab}`,
        ['--accent-glow-rgb' as string]: `${glowR}, ${glowG}, ${glowB}`,
        ['--tile-rgb' as string]: `${ar}, ${ag}, ${ab}`,
        ['--accent' as string]: accent,
      }}
    >
      <PageHeader
        projectId={projectId}
        title="Budget"
        meta={project ? (
          <div className="flex flex-col items-center gap-1.5">
            <ProjectSwitcher projectId={projectId} projectName={project.name} accentColor={accent} variant="meta" />
            <span
              className="font-mono uppercase"
              style={{
                fontSize: '0.42rem', letterSpacing: '0.08em',
                padding: '1px 7px', borderRadius: 20,
                background: `${statusHex(project.status)}33`,
                border: `1px solid ${statusHex(project.status)}80`,
                color: statusHex(project.status),
                fontWeight: 600,
              }}
            >{projectStatusLabel(project.status)}</span>
          </div>
        ) : ''}
        right={budget ? (
          <button
            type="button"
            onClick={() => { haptic('light'); setOverflowOpen(o => !o) }}
            aria-label="Budget options"
            style={{
              width: 32, height: 32, borderRadius: 999,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#a0a0b8', fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >⋯</button>
        ) : undefined}
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
          // Empty state — TemplatePicker swaps in on tap. Replace-in-place;
          // not a nested modal.
          pickerOpen ? (
            <TemplatePicker
              projectId={projectId}
              accent={accent}
              onCreated={() => setPickerOpen(false)}
              onCancel={() => setPickerOpen(false)}
            />
          ) : (
            <div className="text-center" style={{ padding: '60px 24px' }}>
              <div
                className="font-mono uppercase"
                style={{ fontSize: '0.5rem', letterSpacing: '0.1em', color: '#62627a', marginBottom: 10 }}
              >No budget yet</div>
              <div style={{ fontSize: '0.85rem', color: '#a0a0b8', lineHeight: 1.5, marginBottom: 18 }}>
                Start from the AICP template, clone from another project,<br />or begin blank.
              </div>
              <button
                type="button"
                onClick={() => { haptic('light'); setPickerOpen(true) }}
                className="font-mono uppercase"
                style={{
                  padding: '11px 22px', borderRadius: 999,
                  fontSize: 10, letterSpacing: '0.10em',
                  background: `${accent}24`, border: `1px solid ${accent}66`,
                  color: accent, cursor: 'pointer',
                }}
              >Start budget</button>
            </div>
          )
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
                    style={{ fontSize: 9, letterSpacing: '0.12em', color: '#7a7a82', marginBottom: 4 }}
                  >Working Total</div>
                  {/* Hero number — sheen+extrusion treatment per
                      DESIGN_LANGUAGE.md (Page-title scale, project accent). */}
                  <div
                    className="font-mono sheen-title"
                    style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}
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

            {/* Version pills (long-press → menu) */}
            <VersionPills
              versions={budget.versions}
              activeId={activeVersionId}
              accent={accent}
              onChange={setActiveVersionId}
              onLongPress={(vid) => setMenuVersionId(vid)}
            />

            {/* Inline version-pill menu — replaces nothing, slots between
                pills and variables. NOT a nested modal. */}
            {menuVersionId && (() => {
              const v = budget.versions.find(x => x.id === menuVersionId)
              if (!v) return null
              return (
                <VersionPillMenu
                  version={v}
                  allVersions={budget.versions}
                  projectId={projectId}
                  accent={accent}
                  currentMemberId={currentMemberId}
                  onDismiss={() => setMenuVersionId(null)}
                />
              )
            })()}

            {/* Variables strip */}
            <VariablesStrip
              schedule={evalCtx.schedule}
              vars={evalCtx.variables}
            />

            {/* PR 12 — overflow menu (inline; replaces no surface, sits
                between the variables strip and the body. NOT a nested
                modal). */}
            {overflowOpen && (
              <OverflowMenu
                accent={accent}
                onSettings={() => { setOverflowOpen(false); setLayer('settings') }}
                onTopsheet={() => { setOverflowOpen(false); setTopsheetOpen(true) }}
                onClose={() => setOverflowOpen(false)}
              />
            )}

            {/* Tag filter strip — appears in list view only. Hidden when
                no tags exist anywhere in the budget. */}
            {layer === 'list' && (
              <TagFilterStrip
                allTags={allTags}
                active={activeTags}
                accent={accent}
                onToggle={toggleTag}
                onClearAll={clearTags}
              />
            )}

            {/* Layer-switched body — list / detail / settings */}
            {layer === 'detail' && activeLine ? (
              <LineDetailSheet
                projectId={projectId}
                budgetId={budget.id}
                line={activeLine}
                versions={budget.versions}
                accounts={budget.accounts}
                expenses={budget.expenses}
                evalCtx={evalCtx}
                activeVersionId={activeVersionId}
                accent={accent}
                currentMemberId={currentMemberId}
                onBack={() => { setLayer('list'); setActiveLineId(null) }}
              />
            ) : layer === 'settings' ? (
              <BudgetSettingsSheet
                projectId={projectId}
                projectName={project?.name ?? ''}
                budget={budget}
                evalCtx={evalCtx}
                activeVersionId={activeVersionId}
                cloneSourceProjectName={cloneSourceProjectName}
                accent={accent}
                onBack={() => setLayer('list')}
                onDeleted={() => setLayer('list')}
              />
            ) : (
              <div
                style={{
                  padding: '12px 16px 24px',
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}
              >
                {accountsSorted.map(a => {
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
                      onLineTap={(lineId) => { setActiveLineId(lineId); setLayer('detail') }}
                      visibleLineIds={visibleLineIds}
                      onFormulaTap={(lineId) => setTooltipLineId(lineId)}
                    />
                  )
                })}
              </div>
            )}

            {/* Variable inspect tooltip — page-level overlay. Triggered
                by tapping a formula chip in any LineRow. */}
            {tooltipLineId && (() => {
              const line = findFormulaLine(tooltipLineId)
              const amount = findFormulaAmount(tooltipLineId)
              if (!line || !amount) return null
              return (
                <div style={{ position: 'fixed', left: 0, right: 0, bottom: '40%', zIndex: 60 }}>
                  <VariableInspectTooltip
                    expression={amount.qty}
                    ctx={evalCtx}
                    variables={budget.variables}
                    versions={budget.versions}
                    activeVersionId={activeVersionId}
                    onDismiss={() => setTooltipLineId(null)}
                  />
                </div>
              )
            })()}
          </>
        )}
      </div>

      {/* Topsheet handle — fixed bottom of the budget surface, above
          ActionBar. Cinema-glass: .glass-tile-sm + sheen-title total. */}
      {budget && rollup && topsheetData && (
        <button
          type="button"
          onClick={() => { haptic('light'); setTopsheetOpen(true) }}
          className="glass-tile-sm font-mono"
          style={{
            position: 'fixed',
            left: 0, right: 0,
            bottom: 'calc(68px + 52px + 14px + env(safe-area-inset-bottom, 0px))',
            margin: '0 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
            color: '#ebebef', fontSize: 12,
            cursor: 'pointer', zIndex: 30,
          }}
        >
          <div className="flex flex-col" style={{ alignItems: 'flex-start', gap: 2 }}>
            <span
              className="font-mono uppercase"
              style={{ fontSize: 9, color: '#7a7a82', letterSpacing: '0.08em' }}
            >Grand Total · {(() => {
              const v = budget.versions.find(x => x.id === activeVersionId)
              return v?.name ?? '—'
            })()}</span>
            <span className="sheen-title" style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
              {(() => {
                const total = rollup.grandTotal
                if (total >= 100) return `$${Math.round(total).toLocaleString('en-US')}`
                return `$${total.toFixed(2)}`
              })()}
            </span>
          </div>
          <span style={{ color: '#7a7a82', fontSize: 12 }}>▴ topsheet</span>
        </button>
      )}

      {/* Topsheet drawer — bottom on mobile, right side panel on desktop */}
      {budget && topsheetData && (
        <TopsheetDrawer
          open={topsheetOpen}
          onClose={() => setTopsheetOpen(false)}
          accent={accent}
          budgetId={budget.id}
          activeVersionKind={
            (budget.versions.find(v => v.id === activeVersionId)?.kind ?? null)
          }
          content={{
            projectName: project?.name ?? '',
            projectClient: (project as { client?: string | null } | null | undefined)?.client ?? null,
            projectType:   (project as { type?: string | null } | null | undefined)?.type ?? null,
            currency: budget.currency,
            versions: budget.versions,
            accounts: accountsSorted,
            markups: budget.markups,
            perVersion: topsheetData.perVersion,
            activeVersionId,
            actualsByAccountId: topsheetData.actualsByAccountId,
            grandActuals: rollup?.grandActuals ?? 0,
            generatedAt: new Date(),
            sectionSubtotalsByVersion: topsheetData.sectionSubtotalsByVersion,
            sectionActuals: topsheetData.sectionActuals,
          }}
        />
      )}
    </div>
  )
}
