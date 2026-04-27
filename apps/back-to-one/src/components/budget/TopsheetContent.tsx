// TopsheetContent — pure presentational component shared between the
// in-app TopsheetDrawer (PR 10) and the future @react-pdf/renderer
// pipeline (PR 13). Spec §6.7: same React component renders to (a)
// on-screen preview, (b) PDF via react-pdf, (c) headless PNG (deferred).
//
// Pure: no useEffect, no useState, no hooks. Just JSX over props. The
// caller computes everything (rollups per version, markup amounts,
// grand totals, actuals) and passes it in as plain data.
//
// Visual spec is Frame C in apps/back-to-one/reference/budget-page.html
// — cream paper, brand-black ink, Geist Mono numerics, inverted grand
// total row.

import type { BudgetAccount, BudgetVersion, BudgetMarkup } from '@/types'

// Cream-paper palette (BRAND_TOKENS — paper-light + paper-dark + paper-ink).
const PAPER     = '#f4f1ea'
const PAPER_INK = '#1a1a26'
const PAPER_INK_MUTED = '#6a6258'
const PAPER_RULE       = '#c8c1b3'
const PAPER_RULE_LIGHT = '#e2dccb'
const PAPER_SUBTOTAL_BG = '#ece6d6'
const VAR_POS = '#1a8c5a'   // under-budget green
const VAR_NEG = '#c44030'   // over-budget red

export interface TopsheetVersionTotal {
  versionId: string
  total: number              // grand total post-markups for this version
  byAccountId: Map<string, number>   // account.id → rolled-up subtotal
  markupAmounts: { markupId: string; amount: number }[]
}

export interface TopsheetContentProps {
  projectName: string
  projectClient: string | null
  projectType: string | null
  currency: string
  versions: BudgetVersion[]
  // Top-level accounts only, in display order (ATL above BTL).
  accounts: BudgetAccount[]
  markups: BudgetMarkup[]
  // Per-version rollup data.
  perVersion: Map<string, TopsheetVersionTotal>
  // Active version id — used to bold its column header / drive Δ vs Working.
  activeVersionId: string | null
  // Actuals are not versioned — single rollup per account.
  actualsByAccountId: Map<string, number>
  grandActuals: number
  generatedAt: Date
  // Account subtotals by section for the BTL/ATL section subtotal rows.
  sectionSubtotalsByVersion: Map<string, { atl: number; btl: number }>
  sectionActuals: { atl: number; btl: number }
}

function formatNumeric(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n === 0) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  return `${sign}${Math.round(abs).toLocaleString('en-US')}`
}

function formatDelta(estimate: number, actuals: number): { text: string; tone: 'pos' | 'neg' | 'neutral' } {
  if (estimate === 0 || actuals === 0) return { text: '—', tone: 'neutral' }
  const diff = actuals - estimate
  if (diff === 0) return { text: '—', tone: 'neutral' }
  return {
    text: `${diff > 0 ? '+' : '−'}${Math.round(Math.abs(diff)).toLocaleString('en-US')}`,
    tone: diff > 0 ? 'neg' : 'pos',
  }
}

function formatDateShort(d: Date): string {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export function TopsheetContent({
  projectName, projectClient, projectType, currency,
  versions, accounts, markups, perVersion, activeVersionId,
  actualsByAccountId, grandActuals,
  generatedAt, sectionSubtotalsByVersion, sectionActuals,
}: TopsheetContentProps) {
  const sortedVersions = [...versions].sort((a, b) => a.sortOrder - b.sortOrder)
  const activeVersion = activeVersionId ? sortedVersions.find(v => v.id === activeVersionId) : sortedVersions[0]

  const atlAccounts = accounts.filter(a => a.section === 'ATL')
  const btlAccounts = accounts.filter(a => a.section === 'BTL')

  const subLine = `${[projectClient, projectType, currency].filter(Boolean).join(' · ').toUpperCase()}`

  return (
    <div
      style={{
        background: PAPER,
        color: PAPER_INK,
        padding: '22px 22px 16px',
        fontFamily: '-apple-system, "Inter", sans-serif',
        flex: 1,
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${PAPER_RULE}`, paddingBottom: 12, marginBottom: 14 }}>
        <div
          style={{
            fontFamily: '"Geist Mono", monospace', fontSize: 9, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: PAPER_INK_MUTED, marginBottom: 6,
          }}
        >Origin One · Back to One</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>
          {projectName} — Topsheet
        </div>
        <div
          style={{
            fontFamily: '"Geist Mono", monospace', fontSize: 10,
            color: PAPER_INK_MUTED, letterSpacing: '0.04em',
          }}
        >{subLine}</div>
        <div
          style={{
            display: 'flex', justifyContent: 'space-between', marginTop: 8,
            fontFamily: '"Geist Mono", monospace', fontSize: 9,
            color: PAPER_INK_MUTED, letterSpacing: '0.04em',
          }}
        >
          <span>VERSION · {(activeVersion?.name ?? '—').toUpperCase()}</span>
          <span>{formatDateShort(generatedAt)}</span>
        </div>
      </div>

      {/* Table */}
      <table
        style={{
          width: '100%', borderCollapse: 'collapse',
          fontFamily: '"Geist Mono", monospace', fontSize: 10,
        }}
      >
        <thead>
          <tr>
            <th style={thStyle({ left: true, code: true })}>&nbsp;</th>
            <th style={thStyle({ left: true })}>Account</th>
            {sortedVersions.map(v => (
              <th key={v.id} style={thStyle({ active: v.id === activeVersionId })}>{v.name}</th>
            ))}
            <th style={thStyle()}>Actuals</th>
            <th style={thStyle()}>Δ</th>
          </tr>
        </thead>
        <tbody>
          {/* ATL section */}
          {atlAccounts.length > 0 && (
            <SectionRows
              label="Above-the-Line"
              accounts={atlAccounts}
              versions={sortedVersions}
              perVersion={perVersion}
              actualsByAccountId={actualsByAccountId}
              activeVersionId={activeVersionId}
              sectionSubtotal={(vid: string) => sectionSubtotalsByVersion.get(vid)?.atl ?? 0}
              sectionActuals={sectionActuals.atl}
            />
          )}

          {/* BTL section */}
          {btlAccounts.length > 0 && (
            <SectionRows
              label="Below-the-Line"
              accounts={btlAccounts}
              versions={sortedVersions}
              perVersion={perVersion}
              actualsByAccountId={actualsByAccountId}
              activeVersionId={activeVersionId}
              sectionSubtotal={(vid: string) => sectionSubtotalsByVersion.get(vid)?.btl ?? 0}
              sectionActuals={sectionActuals.btl}
            />
          )}

          {/* Markups */}
          {markups.map(m => (
            <tr key={m.id}>
              <td style={tdCode}></td>
              <td style={tdName(true)}>
                <span style={{ fontStyle: 'italic', color: PAPER_INK_MUTED }}>
                  {m.name} {Math.round(Number(m.percent) * 100)}%{m.appliesTo === 'grandTotal' ? ' (on grand)' : ''}
                </span>
              </td>
              {sortedVersions.map(v => {
                const pv = perVersion.get(v.id)
                const amt = pv?.markupAmounts.find(x => x.markupId === m.id)?.amount ?? 0
                return (
                  <td key={v.id} style={{ ...tdAmt, fontStyle: 'italic', color: PAPER_INK_MUTED }}>
                    {formatNumeric(amt)}
                  </td>
                )
              })}
              <td style={{ ...tdAmt, fontStyle: 'italic', color: PAPER_INK_MUTED }}>—</td>
              <td style={{ ...tdAmt, fontStyle: 'italic', color: PAPER_INK_MUTED }}>—</td>
            </tr>
          ))}

          {/* Grand total */}
          <tr>
            <td style={tdGrand({ first: true })}></td>
            <td style={{ ...tdGrand({}), fontFamily: '-apple-system, "Inter", sans-serif' }}>GRAND TOTAL</td>
            {sortedVersions.map(v => {
              const pv = perVersion.get(v.id)
              return (
                <td key={v.id} style={tdGrand({ amt: true })}>
                  {formatNumeric(pv?.total ?? 0)}
                </td>
              )
            })}
            <td style={tdGrand({ amt: true })}>{formatNumeric(grandActuals)}</td>
            <td style={tdGrand({ amt: true })}>
              {(() => {
                const activePv = activeVersionId ? perVersion.get(activeVersionId) : null
                const total = activePv?.total ?? 0
                if (total === 0) return '—'
                return `${Math.round((grandActuals / total) * 100)}% spent`
              })()}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Footer */}
      <div
        style={{
          marginTop: 16, paddingTop: 10,
          borderTop: `1px solid ${PAPER_RULE}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontFamily: '"Geist Mono", monospace', fontSize: 9,
          color: PAPER_INK_MUTED, letterSpacing: '0.04em',
        }}
      >
        <span>1 of 1</span>
        <span>Generated · BTO Budget · v1</span>
      </div>
    </div>
  )
}

// ── Section rows helper ──────────────────────────────────────────────────

function SectionRows({
  label, accounts, versions, perVersion, actualsByAccountId, activeVersionId,
  sectionSubtotal, sectionActuals,
}: {
  label: string
  accounts: BudgetAccount[]
  versions: BudgetVersion[]
  perVersion: Map<string, TopsheetVersionTotal>
  actualsByAccountId: Map<string, number>
  activeVersionId: string | null
  sectionSubtotal: (versionId: string) => number
  sectionActuals: number
}) {
  const sortedAccounts = [...accounts].sort((a, b) => a.sortOrder - b.sortOrder)
  return (
    <>
      {sortedAccounts.map(a => {
        const actuals = actualsByAccountId.get(a.id) ?? 0
        const activeTotal = activeVersionId
          ? perVersion.get(activeVersionId)?.byAccountId.get(a.id) ?? 0
          : 0
        const delta = formatDelta(activeTotal, actuals)
        return (
          <tr key={a.id}>
            <td style={tdCode}>{a.code}</td>
            <td style={tdName()}>{a.name}</td>
            {versions.map(v => {
              const pv = perVersion.get(v.id)
              return (
                <td key={v.id} style={tdAmt}>
                  {formatNumeric(pv?.byAccountId.get(a.id) ?? 0)}
                </td>
              )
            })}
            <td style={tdAmt}>{formatNumeric(actuals)}</td>
            <td style={{ ...tdAmt, color: delta.tone === 'pos' ? VAR_POS : delta.tone === 'neg' ? VAR_NEG : PAPER_INK }}>
              {delta.text}
            </td>
          </tr>
        )
      })}
      {/* Section subtotal row */}
      <tr>
        <td style={tdSubtotal({ first: true })}></td>
        <td style={tdSubtotal()}>Subtotal {label}</td>
        {versions.map(v => (
          <td key={v.id} style={tdSubtotal({ amt: true })}>
            {formatNumeric(sectionSubtotal(v.id))}
          </td>
        ))}
        <td style={tdSubtotal({ amt: true })}>{formatNumeric(sectionActuals)}</td>
        <td style={tdSubtotal({ amt: true })}>—</td>
      </tr>
    </>
  )
}

// ── Cell style helpers ───────────────────────────────────────────────────

function thStyle(opts: { left?: boolean; active?: boolean; code?: boolean } = {}): React.CSSProperties {
  return {
    textAlign: opts.left ? 'left' : 'right',
    padding: '6px 4px 4px',
    borderBottom: `1px solid ${PAPER_RULE}`,
    color: opts.active ? PAPER_INK : PAPER_INK_MUTED,
    fontWeight: opts.active ? 700 : 500,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    fontSize: 8,
    width: opts.code ? 24 : undefined,
  }
}

const tdCode: React.CSSProperties = {
  padding: '7px 4px',
  borderBottom: `1px solid ${PAPER_RULE_LIGHT}`,
  color: PAPER_INK_MUTED, fontSize: 9, width: 24,
}

function tdName(markup: boolean = false): React.CSSProperties {
  return {
    padding: '7px 4px',
    borderBottom: `1px solid ${PAPER_RULE_LIGHT}`,
    fontFamily: markup ? '"Geist Mono", monospace' : '-apple-system, "Inter", sans-serif',
    fontSize: 11,
    color: PAPER_INK,
  }
}

const tdAmt: React.CSSProperties = {
  padding: '7px 4px',
  borderBottom: `1px solid ${PAPER_RULE_LIGHT}`,
  color: PAPER_INK,
  textAlign: 'right',
}

function tdSubtotal(opts: { first?: boolean; amt?: boolean } = {}): React.CSSProperties {
  return {
    padding: '7px 4px',
    background: PAPER_SUBTOTAL_BG,
    borderTop: `1px solid ${PAPER_RULE}`,
    borderBottom: `1px solid ${PAPER_RULE_LIGHT}`,
    fontWeight: 700,
    color: PAPER_INK,
    textAlign: opts.amt ? 'right' : 'left',
    width: opts.first ? 24 : undefined,
  }
}

function tdGrand(opts: { first?: boolean; amt?: boolean } = {}): React.CSSProperties {
  return {
    padding: '10px 4px',
    background: PAPER_INK,
    color: PAPER,
    fontWeight: 700,
    fontSize: 12,
    textAlign: opts.amt ? 'right' : 'left',
    width: opts.first ? 24 : undefined,
  }
}

// Re-export for the drawer's variance summary chip (PR 10 Hub upgrade
// uses these tones too).
export { VAR_POS, VAR_NEG, PAPER, PAPER_INK }
