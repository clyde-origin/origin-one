// Parallel renderer of TopsheetContent for @react-pdf/renderer.
//
// @react-pdf primitives (<Document>, <Page>, <View>, <Text>) cannot
// consume HTML. So this component mirrors TopsheetContent's visual
// intent — cream paper, brand-black ink, mono numerics, inverted grand
// total — using the react-pdf primitive layer. Both consume the same
// data shape and the same compute pipeline (rollUpBudget); the trees
// only diverge at the primitive layer. See BUILD_STATUS.md "Topsheet
// renders as two parallel components".

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { BudgetAccount, BudgetVersion, BudgetMarkup } from '@/types'
import type { TopsheetVersionTotal } from './TopsheetContent'

const PAPER     = '#f4f1ea'
const PAPER_INK = '#1a1a26'
const PAPER_INK_MUTED = '#6a6258'
const PAPER_RULE       = '#c8c1b3'
const PAPER_RULE_LIGHT = '#e2dccb'
const PAPER_SUBTOTAL_BG = '#ece6d6'
const VAR_POS = '#1a8c5a'
const VAR_NEG = '#c44030'

// react-pdf default fonts: Helvetica, Times-Roman, Courier. Courier as
// the mono substitute for Geist Mono — the visual rhythm is
// preserved (fixed-width numerics) without bundling a custom font in
// the Vercel Function. Sans body is Helvetica.
const FONT_SANS = 'Helvetica'
const FONT_SANS_BOLD = 'Helvetica-Bold'
const FONT_MONO = 'Courier'

const styles = StyleSheet.create({
  page: {
    backgroundColor: PAPER,
    color: PAPER_INK,
    padding: 36,
    fontFamily: FONT_SANS,
  },
  headerBlock: {
    borderBottomWidth: 1,
    borderBottomColor: PAPER_RULE,
    paddingBottom: 10,
    marginBottom: 12,
  },
  eyebrow: {
    fontFamily: FONT_MONO,
    fontSize: 8,
    letterSpacing: 1.4,
    color: PAPER_INK_MUTED,
    marginBottom: 4,
  },
  title: {
    fontFamily: FONT_SANS_BOLD,
    fontSize: 16,
    marginBottom: 2,
  },
  subLine: {
    fontFamily: FONT_MONO,
    fontSize: 9,
    color: PAPER_INK_MUTED,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    fontFamily: FONT_MONO,
    fontSize: 8,
    color: PAPER_INK_MUTED,
  },
  // Table
  thead: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: PAPER_RULE,
    paddingBottom: 4,
    marginBottom: 4,
  },
  tr: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: PAPER_RULE_LIGHT,
  },
  trSection: {
    flexDirection: 'row',
    paddingVertical: 5,
    backgroundColor: PAPER_SUBTOTAL_BG,
  },
  trGrand: {
    flexDirection: 'row',
    paddingVertical: 7,
    marginTop: 4,
    backgroundColor: PAPER_INK,
  },
  cellCode: {
    width: 24,
    fontFamily: FONT_MONO,
    fontSize: 8,
    color: PAPER_INK_MUTED,
    paddingRight: 4,
  },
  cellName: {
    flex: 2,
    fontSize: 9,
    color: PAPER_INK,
  },
  cellAmt: {
    flex: 1,
    fontFamily: FONT_MONO,
    fontSize: 9,
    color: PAPER_INK,
    textAlign: 'right',
  },
  cellHeader: {
    fontFamily: FONT_MONO,
    fontSize: 8,
    letterSpacing: 0.6,
    color: PAPER_INK_MUTED,
    textTransform: 'uppercase',
  },
  cellSubtotalName: {
    flex: 2,
    fontSize: 9,
    fontFamily: FONT_SANS_BOLD,
    color: PAPER_INK,
  },
  cellSubtotalAmt: {
    flex: 1,
    fontFamily: FONT_MONO,
    fontSize: 9,
    color: PAPER_INK,
    textAlign: 'right',
  },
  cellGrandName: {
    flex: 2,
    fontFamily: FONT_SANS_BOLD,
    fontSize: 10,
    color: PAPER,
  },
  cellGrandAmt: {
    flex: 1,
    fontFamily: FONT_MONO,
    fontSize: 10,
    color: PAPER,
    textAlign: 'right',
  },
  italic: {
    fontFamily: 'Helvetica-Oblique',
    color: PAPER_INK_MUTED,
  },
  cellMarkupName: {
    flex: 2,
    fontSize: 9,
    fontFamily: 'Helvetica-Oblique',
    color: PAPER_INK_MUTED,
  },
  cellMarkupAmt: {
    flex: 1,
    fontFamily: FONT_MONO,
    fontSize: 9,
    color: PAPER_INK_MUTED,
    textAlign: 'right',
  },
  footer: {
    marginTop: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: PAPER_RULE,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontFamily: FONT_MONO,
    fontSize: 8,
    color: PAPER_INK_MUTED,
  },
})

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

export interface TopsheetPdfDocumentProps {
  projectName: string
  projectClient: string | null
  projectType: string | null
  currency: string
  versions: BudgetVersion[]
  accounts: BudgetAccount[]                  // top-level only, ordered ATL → BTL
  markups: BudgetMarkup[]
  perVersion: Map<string, TopsheetVersionTotal>
  activeVersionId: string | null
  actualsByAccountId: Map<string, number>
  grandActuals: number
  generatedAt: Date
  sectionSubtotalsByVersion: Map<string, { atl: number; btl: number }>
  sectionActuals: { atl: number; btl: number }
}

export function TopsheetPdfDocument({
  projectName, projectClient, projectType, currency,
  versions, accounts, markups, perVersion, activeVersionId,
  actualsByAccountId, grandActuals,
  generatedAt, sectionSubtotalsByVersion, sectionActuals,
}: TopsheetPdfDocumentProps) {
  const sortedVersions = [...versions].sort((a, b) => a.sortOrder - b.sortOrder)
  const activeVersion = activeVersionId ? sortedVersions.find(v => v.id === activeVersionId) : sortedVersions[0]
  const atlAccounts = accounts.filter(a => a.section === 'ATL').sort((a, b) => a.sortOrder - b.sortOrder)
  const btlAccounts = accounts.filter(a => a.section === 'BTL').sort((a, b) => a.sortOrder - b.sortOrder)
  const subLine = [projectClient, projectType, currency].filter(Boolean).join(' · ').toUpperCase()

  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.headerBlock}>
          <Text style={styles.eyebrow}>ORIGIN ONE · BACK TO ONE</Text>
          <Text style={styles.title}>{projectName} — Topsheet</Text>
          <Text style={styles.subLine}>{subLine}</Text>
          <View style={styles.metaRow}>
            <Text>VERSION · {(activeVersion?.name ?? '—').toUpperCase()}</Text>
            <Text>{formatDateShort(generatedAt)}</Text>
          </View>
        </View>

        {/* Header row */}
        <View style={styles.thead}>
          <Text style={styles.cellCode} />
          <Text style={[styles.cellName, styles.cellHeader]}>Account</Text>
          {sortedVersions.map(v => (
            <Text key={v.id} style={[styles.cellAmt, styles.cellHeader]}>{v.name}</Text>
          ))}
          <Text style={[styles.cellAmt, styles.cellHeader]}>Actuals</Text>
          <Text style={[styles.cellAmt, styles.cellHeader]}>Δ</Text>
        </View>

        {/* ATL */}
        {atlAccounts.length > 0 && (
          <Section
            label="Above-the-Line"
            accounts={atlAccounts}
            versions={sortedVersions}
            perVersion={perVersion}
            actualsByAccountId={actualsByAccountId}
            activeVersionId={activeVersionId}
            sectionSubtotal={(vid) => sectionSubtotalsByVersion.get(vid)?.atl ?? 0}
            sectionActualsTotal={sectionActuals.atl}
          />
        )}

        {/* BTL */}
        {btlAccounts.length > 0 && (
          <Section
            label="Below-the-Line"
            accounts={btlAccounts}
            versions={sortedVersions}
            perVersion={perVersion}
            actualsByAccountId={actualsByAccountId}
            activeVersionId={activeVersionId}
            sectionSubtotal={(vid) => sectionSubtotalsByVersion.get(vid)?.btl ?? 0}
            sectionActualsTotal={sectionActuals.btl}
          />
        )}

        {/* Markup rows (italic, muted) */}
        {markups.map(m => (
          <View key={m.id} style={styles.tr}>
            <Text style={styles.cellCode} />
            <Text style={styles.cellMarkupName}>
              {m.name} {Math.round(Number(m.percent) * 100)}%
              {m.appliesTo === 'grandTotal' ? ' (on grand)' : ''}
            </Text>
            {sortedVersions.map(v => {
              const amt = perVersion.get(v.id)?.markupAmounts.find(x => x.markupId === m.id)?.amount ?? 0
              return (
                <Text key={v.id} style={styles.cellMarkupAmt}>{formatNumeric(amt)}</Text>
              )
            })}
            <Text style={styles.cellMarkupAmt}>—</Text>
            <Text style={styles.cellMarkupAmt}>—</Text>
          </View>
        ))}

        {/* Grand total — inverted */}
        <View style={styles.trGrand}>
          <Text style={styles.cellCode} />
          <Text style={styles.cellGrandName}>GRAND TOTAL</Text>
          {sortedVersions.map(v => (
            <Text key={v.id} style={styles.cellGrandAmt}>
              {formatNumeric(perVersion.get(v.id)?.total ?? 0)}
            </Text>
          ))}
          <Text style={styles.cellGrandAmt}>{formatNumeric(grandActuals)}</Text>
          <Text style={styles.cellGrandAmt}>
            {(() => {
              const t = activeVersionId ? perVersion.get(activeVersionId)?.total ?? 0 : 0
              if (t === 0) return '—'
              return `${Math.round((grandActuals / t) * 100)}% spent`
            })()}
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} of ${totalPages}`} />
          <Text>Generated · BTO Budget · v1</Text>
        </View>
      </Page>
    </Document>
  )
}

function Section({
  label, accounts, versions, perVersion, actualsByAccountId, activeVersionId,
  sectionSubtotal, sectionActualsTotal,
}: {
  label: string
  accounts: BudgetAccount[]
  versions: BudgetVersion[]
  perVersion: Map<string, TopsheetVersionTotal>
  actualsByAccountId: Map<string, number>
  activeVersionId: string | null
  sectionSubtotal: (versionId: string) => number
  sectionActualsTotal: number
}) {
  return (
    <>
      {accounts.map(a => {
        const actuals = actualsByAccountId.get(a.id) ?? 0
        const activeTotal = activeVersionId
          ? perVersion.get(activeVersionId)?.byAccountId.get(a.id) ?? 0
          : 0
        const delta = formatDelta(activeTotal, actuals)
        const deltaColor =
          delta.tone === 'pos' ? VAR_POS :
          delta.tone === 'neg' ? VAR_NEG :
          PAPER_INK
        return (
          <View key={a.id} style={styles.tr}>
            <Text style={styles.cellCode}>{a.code}</Text>
            <Text style={styles.cellName}>{a.name}</Text>
            {versions.map(v => (
              <Text key={v.id} style={styles.cellAmt}>
                {formatNumeric(perVersion.get(v.id)?.byAccountId.get(a.id) ?? 0)}
              </Text>
            ))}
            <Text style={styles.cellAmt}>{formatNumeric(actuals)}</Text>
            <Text style={[styles.cellAmt, { color: deltaColor }]}>{delta.text}</Text>
          </View>
        )
      })}
      <View style={styles.trSection}>
        <Text style={styles.cellCode} />
        <Text style={styles.cellSubtotalName}>Subtotal {label}</Text>
        {versions.map(v => (
          <Text key={v.id} style={styles.cellSubtotalAmt}>
            {formatNumeric(sectionSubtotal(v.id))}
          </Text>
        ))}
        <Text style={styles.cellSubtotalAmt}>{formatNumeric(sectionActualsTotal)}</Text>
        <Text style={styles.cellSubtotalAmt}>—</Text>
      </View>
    </>
  )
}
