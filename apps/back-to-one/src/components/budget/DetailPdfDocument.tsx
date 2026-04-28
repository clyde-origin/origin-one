// Multi-page detail PDF — every line item visible, grouped by account,
// page-break between accounts (or smart break when content overflows).
// Internal review document, not the client-facing topsheet. See spec §8.
//
// Same primitive layer as TopsheetPdfDocument (@react-pdf/renderer), so
// the two share the cream-paper visual system. Compute pipeline is also
// shared — fetch-budget-tree.ts already builds per-version rollups.

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type {
  BudgetAccount, BudgetVersion, BudgetMarkup,
} from '@/types'
import type { BudgetLineWithAmounts } from '@/lib/budget-export/fetch-budget-tree'
import type { BudgetRollup } from '@/lib/budget/compute'

const PAPER     = '#f4f1ea'
const PAPER_INK = '#1a1a26'
const PAPER_INK_MUTED = '#6a6258'
const PAPER_RULE       = '#c8c1b3'
const PAPER_RULE_LIGHT = '#e2dccb'
const PAPER_SUBTOTAL_BG = '#ece6d6'
const VAR_OVER  = '#c44030'
const VAR_WARN  = '#a07415'
const VAR_UNDER = '#1a8c5a'

const FONT_SANS = 'Helvetica'
const FONT_SANS_BOLD = 'Helvetica-Bold'
const FONT_SANS_OBLIQUE = 'Helvetica-Oblique'
const FONT_MONO = 'Courier'

const styles = StyleSheet.create({
  page: {
    backgroundColor: PAPER,
    color: PAPER_INK,
    padding: 32,
    fontFamily: FONT_SANS,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: PAPER_RULE,
    paddingBottom: 8,
    marginBottom: 10,
  },
  eyebrow: {
    fontFamily: FONT_MONO,
    fontSize: 8,
    letterSpacing: 1.4,
    color: PAPER_INK_MUTED,
    marginBottom: 3,
  },
  title: { fontFamily: FONT_SANS_BOLD, fontSize: 14, marginBottom: 1 },
  subLine: { fontFamily: FONT_MONO, fontSize: 9, color: PAPER_INK_MUTED },
  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 4,
    fontFamily: FONT_MONO, fontSize: 8, color: PAPER_INK_MUTED,
  },
  accountBlock: { marginBottom: 10 },
  accountHeader: {
    flexDirection: 'row',
    paddingVertical: 4,
    backgroundColor: PAPER_SUBTOTAL_BG,
    borderBottomWidth: 1,
    borderBottomColor: PAPER_RULE,
    marginBottom: 3,
  },
  accountCode: {
    width: 28, fontFamily: FONT_MONO, fontSize: 9, color: PAPER_INK_MUTED, paddingRight: 4,
  },
  accountName: { flex: 1, fontFamily: FONT_SANS_BOLD, fontSize: 10, color: PAPER_INK },
  accountTotal: {
    fontFamily: FONT_MONO, fontSize: 10, color: PAPER_INK, fontWeight: 700,
    width: 80, textAlign: 'right',
  },
  thead: {
    flexDirection: 'row',
    paddingBottom: 2, marginBottom: 1,
    borderBottomWidth: 0.5, borderBottomColor: PAPER_RULE_LIGHT,
  },
  tr: {
    flexDirection: 'row',
    paddingVertical: 2,
    borderBottomWidth: 0.5, borderBottomColor: PAPER_RULE_LIGHT,
  },
  cellHead: {
    fontFamily: FONT_MONO, fontSize: 7,
    color: PAPER_INK_MUTED, letterSpacing: 0.4, textTransform: 'uppercase',
  },
  cellDescription: { flex: 3, fontSize: 8, color: PAPER_INK },
  cellQtyFormula: {
    fontFamily: FONT_SANS_OBLIQUE, fontSize: 7, color: PAPER_INK_MUTED, marginTop: 1,
  },
  cellUnit: {
    width: 32, fontFamily: FONT_MONO, fontSize: 8, color: PAPER_INK_MUTED,
  },
  cellAmt: {
    flex: 1.2, fontFamily: FONT_MONO, fontSize: 8, color: PAPER_INK, textAlign: 'right',
  },
  cellAmtSmall: {
    width: 36, fontFamily: FONT_MONO, fontSize: 8, color: PAPER_INK, textAlign: 'right',
  },
  cellVariance: {
    width: 50, fontFamily: FONT_MONO, fontSize: 8, textAlign: 'right',
  },
  markupBlock: {
    marginTop: 6, paddingTop: 4,
    borderTopWidth: 1, borderTopColor: PAPER_RULE,
  },
  markupRow: {
    flexDirection: 'row', paddingVertical: 2,
  },
  markupName: { flex: 3, fontSize: 9, fontFamily: FONT_SANS_OBLIQUE, color: PAPER_INK_MUTED },
  markupAmt: { flex: 1, fontFamily: FONT_MONO, fontSize: 9, color: PAPER_INK_MUTED, textAlign: 'right' },
  grandRow: {
    flexDirection: 'row', paddingVertical: 7, marginTop: 4,
    backgroundColor: PAPER_INK,
  },
  grandName: { flex: 3, paddingLeft: 6, fontFamily: FONT_SANS_BOLD, fontSize: 11, color: PAPER },
  grandAmt: { flex: 1, fontFamily: FONT_MONO, fontSize: 10, color: PAPER, textAlign: 'right', paddingRight: 6 },
  footer: {
    position: 'absolute', left: 32, right: 32, bottom: 16,
    flexDirection: 'row', justifyContent: 'space-between',
    fontFamily: FONT_MONO, fontSize: 8, color: PAPER_INK_MUTED,
  },
})

function formatNumeric(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n === 0) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  return `${sign}${Math.round(abs).toLocaleString('en-US')}`
}

function formatPercent(n: number): string {
  return `${Math.round(n * 100)}%`
}

function formatDateShort(d: Date): string {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export interface DetailPdfDocumentProps {
  projectName: string
  projectClient: string | null
  projectType: string | null
  currency: string
  activeVersion: BudgetVersion
  versions: BudgetVersion[]
  accounts: BudgetAccount[]
  lines: BudgetLineWithAmounts[]
  markups: BudgetMarkup[]
  rollupActive: BudgetRollup
  rollupByVersionId: Map<string, BudgetRollup>
  generatedAt: Date
}

export function DetailPdfDocument({
  projectName, projectClient, projectType, currency,
  activeVersion, versions, accounts, lines, markups,
  rollupActive, rollupByVersionId, generatedAt,
}: DetailPdfDocumentProps) {
  const sortedVersions = [...versions].sort((a, b) => a.sortOrder - b.sortOrder)
  const topAccounts = accounts
    .filter(a => a.parentId == null)
    .sort((a, b) => {
      if (a.section !== b.section) return a.section === 'ATL' ? -1 : 1
      return a.sortOrder - b.sortOrder
    })
  const subLine = [projectClient, projectType, currency].filter(Boolean).join(' · ').toUpperCase()

  return (
    <Document>
      <Page size="LETTER" orientation="portrait" style={styles.page}>
        {/* Header — sits on first page only */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ORIGIN ONE · BACK TO ONE — DETAIL</Text>
          <Text style={styles.title}>{projectName}</Text>
          <Text style={styles.subLine}>{subLine}</Text>
          <View style={styles.metaRow}>
            <Text>VERSION · {activeVersion.name.toUpperCase()}</Text>
            <Text>{formatDateShort(generatedAt)}</Text>
          </View>
        </View>

        {/* Account blocks — react-pdf renders these as a flow; `wrap`
            on each block lets it page-break naturally if it overflows.
            `break` on subsequent blocks would force-break per account
            (we let it flow for tighter use of page space). */}
        {topAccounts.map(account => {
          const accountLines = lines
            .filter(l => l.accountId === account.id)
            .sort((a, b) => a.sortOrder - b.sortOrder)
          const subtotal = rollupActive.subtotalByAccount.get(account.id)?.total ?? 0
          return (
            <View key={account.id} style={styles.accountBlock} wrap>
              <View style={styles.accountHeader}>
                <Text style={styles.accountCode}>{account.code}</Text>
                <Text style={styles.accountName}>{account.name}</Text>
                <Text style={styles.accountTotal}>{formatNumeric(subtotal)}</Text>
              </View>

              {accountLines.length > 0 && (
                <View style={styles.thead}>
                  <Text style={[styles.cellDescription, styles.cellHead]}>Line</Text>
                  <Text style={[styles.cellUnit, styles.cellHead]}>Unit</Text>
                  <Text style={[styles.cellAmtSmall, styles.cellHead]}>Qty</Text>
                  <Text style={[styles.cellAmtSmall, styles.cellHead]}>Rate</Text>
                  <Text style={[styles.cellAmtSmall, styles.cellHead]}>Fr%</Text>
                  {sortedVersions.map(v => (
                    <Text key={v.id} style={[styles.cellAmt, styles.cellHead]}>{v.name.slice(0, 8)}</Text>
                  ))}
                  <Text style={[styles.cellAmt, styles.cellHead]}>Actuals</Text>
                  <Text style={[styles.cellVariance, styles.cellHead]}>Var</Text>
                </View>
              )}

              {accountLines.map(line => {
                const activeAmount = line.amounts.find(a => a.versionId === activeVersion.id)
                const computed = rollupActive.computedByLine.get(line.id)
                const flag = computed?.flag
                const varColor =
                  flag === 'over'  ? VAR_OVER  :
                  flag === 'warn'  ? VAR_WARN  :
                  flag === 'under' ? VAR_UNDER :
                  PAPER_INK_MUTED
                return (
                  <View key={line.id} style={styles.tr}>
                    <View style={styles.cellDescription}>
                      <Text>{line.description}</Text>
                      {activeAmount?.qty && /[a-zA-Z_]/.test(activeAmount.qty) && (
                        <Text style={styles.cellQtyFormula}>= {activeAmount.qty}</Text>
                      )}
                    </View>
                    <Text style={styles.cellUnit}>{line.unit}</Text>
                    <Text style={styles.cellAmtSmall}>
                      {computed?.qtyResolved != null ? Math.round(computed.qtyResolved * 100) / 100 : '—'}
                    </Text>
                    <Text style={styles.cellAmtSmall}>{formatNumeric(computed?.rate ?? 0)}</Text>
                    <Text style={styles.cellAmtSmall}>
                      {Number(line.fringeRate) > 0 ? formatPercent(Number(line.fringeRate)) : '—'}
                    </Text>
                    {sortedVersions.map(v => {
                      const r = rollupByVersionId.get(v.id)
                      return (
                        <Text key={v.id} style={styles.cellAmt}>
                          {formatNumeric(r?.computedByLine.get(line.id)?.total ?? 0)}
                        </Text>
                      )
                    })}
                    <Text style={styles.cellAmt}>{formatNumeric(computed?.actuals ?? 0)}</Text>
                    <Text style={[styles.cellVariance, { color: varColor }]}>
                      {computed && computed.varPct !== 0
                        ? `${computed.varPct > 0 ? '+' : '−'}${Math.round(Math.abs(computed.varPct) * 100)}%`
                        : '—'}
                    </Text>
                  </View>
                )
              })}

              {accountLines.length === 0 && (
                <Text style={{ fontSize: 8, color: PAPER_INK_MUTED, fontStyle: 'italic', paddingVertical: 4 }}>
                  No line items
                </Text>
              )}
            </View>
          )
        })}

        {/* Markups + grand total */}
        {markups.length > 0 && (
          <View style={styles.markupBlock}>
            {markups
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map(m => {
                const amt = rollupActive.markupAmounts.find(x => x.markupId === m.id)?.amount ?? 0
                const pctDisplay = (Number(m.percent) * 100).toFixed(2).replace(/\.?0+$/, '')
                return (
                  <View key={m.id} style={styles.markupRow}>
                    <Text style={styles.markupName}>
                      {m.name} {pctDisplay}%{m.appliesTo === 'grandTotal' ? ' (on grand)' : ''}
                    </Text>
                    <Text style={styles.markupAmt}>{formatNumeric(amt)}</Text>
                  </View>
                )
              })}
          </View>
        )}

        <View style={styles.grandRow}>
          <Text style={styles.grandName}>GRAND TOTAL · {activeVersion.name.toUpperCase()}</Text>
          <Text style={styles.grandAmt}>{formatNumeric(rollupActive.grandTotal)}</Text>
        </View>

        {/* Footer — fixed on every page */}
        <View style={styles.footer} fixed>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} of ${totalPages}`} />
          <Text>Detail Report · BTO Budget · {projectName}</Text>
        </View>
      </Page>
    </Document>
  )
}
