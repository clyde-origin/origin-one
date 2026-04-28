// CSV export — generic shape (i) per spec §8.3. Streams via
// ReadableStream so very large budgets don't buffer in memory.
//
// Uses SUPABASE_SERVICE_ROLE_KEY (server-only, bypasses RLS) because
// anon has no public-schema grants. Producer-only access is enforced
// at the UI layer until Auth day's session-aware middleware lands.
// See BUILD_STATUS.md "Budget export API routes".

import {
  fetchBudgetExportData,
  projectSlug,
  todayIso,
  buildAccountPath,
  resolveActiveVersion,
  type BudgetExportData,
  type BudgetLineWithAmounts,
} from '@/lib/budget-export/fetch-budget-tree'
import type { BudgetAccount, BudgetMarkup } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COLUMNS = [
  'budget_id', 'version_kind', 'version_name',
  'account_code', 'account_name', 'account_path',
  'line_id', 'description', 'unit', 'qty_formula', 'qty_resolved',
  'rate', 'fringe_rate',
  'estimate_total', 'working_total', 'committed_total', 'actual_total',
  'variance_pct', 'tags', 'created_at', 'updated_at',
] as const

// CSV-escape per RFC 4180 — wrap in quotes if value contains comma,
// quote, newline, or carriage return; double internal quotes.
function csvField(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function csvRow(values: unknown[]): string {
  return values.map(csvField).join(',') + '\r\n'
}

function findVersionTotal(
  data: BudgetExportData,
  kind: 'estimate' | 'working' | 'committed',
  lineId: string,
): number | null {
  const v = data.budget.versions.find(x => x.kind === kind)
  if (!v) return null
  const r = data.rollupByVersionId.get(v.id)
  return r?.computedByLine.get(lineId)?.total ?? null
}

function findAccountTotalForVersion(
  data: BudgetExportData,
  kind: 'estimate' | 'working' | 'committed',
  accountId: string,
): number | null {
  const v = data.budget.versions.find(x => x.kind === kind)
  if (!v) return null
  const r = data.rollupByVersionId.get(v.id)
  return r?.subtotalByAccount.get(accountId)?.total ?? null
}

function findGrandTotalForVersion(
  data: BudgetExportData,
  kind: 'estimate' | 'working' | 'committed',
): number | null {
  const v = data.budget.versions.find(x => x.kind === kind)
  if (!v) return null
  return data.rollupByVersionId.get(v.id)?.grandTotal ?? null
}

function findMarkupAmountForVersion(
  data: BudgetExportData,
  kind: 'estimate' | 'working' | 'committed',
  markupId: string,
): number | null {
  const v = data.budget.versions.find(x => x.kind === kind)
  if (!v) return null
  const r = data.rollupByVersionId.get(v.id)
  return r?.markupAmounts.find(m => m.markupId === markupId)?.amount ?? null
}

function* generateRows(data: BudgetExportData, activeVersionKind: string): Generator<string> {
  const { budget, rollupByVersionId } = data

  // Header
  yield csvRow(COLUMNS as unknown as string[])

  const accountsSorted: BudgetAccount[] = [...budget.accounts].sort((a, b) => {
    if (a.section !== b.section) return a.section === 'ATL' ? -1 : 1
    return a.sortOrder - b.sortOrder
  })

  // Active-version rollup is the canonical "actuals + variance" surface.
  // The export also exposes per-version-kind totals (estimate/working/
  // committed) so accountants can pivot in Excel without a second
  // round-trip.
  const activeVersion = budget.versions.find(v => v.kind === activeVersionKind)
    ?? budget.versions[0]
  const activeRollup = activeVersion ? rollupByVersionId.get(activeVersion.id) : undefined

  // Line rows.
  for (const account of accountsSorted) {
    const accountPath = buildAccountPath(account, budget.accounts)
    const accountLines: BudgetLineWithAmounts[] = budget.lines
      .filter(l => l.accountId === account.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    for (const line of accountLines) {
      const activeAmount = activeVersion
        ? line.amounts.find(a => a.versionId === activeVersion.id)
        : undefined
      const activeComputed = activeRollup?.computedByLine.get(line.id)
      yield csvRow([
        budget.id,
        activeVersion?.kind ?? '',
        activeVersion?.name ?? '',
        account.code,
        account.name,
        accountPath,
        line.id,
        line.description,
        line.unit,
        activeAmount?.qty ?? '',
        activeComputed?.qtyResolved ?? '',
        activeAmount?.rate ?? '',
        line.fringeRate,
        findVersionTotal(data, 'estimate',  line.id) ?? '',
        findVersionTotal(data, 'working',   line.id) ?? '',
        findVersionTotal(data, 'committed', line.id) ?? '',
        activeComputed?.actuals ?? '',
        activeComputed ? (activeComputed.varPct * 100).toFixed(2) : '',
        line.tags.join(';'),
        line.createdAt,
        line.updatedAt,
      ])
    }
  }

  // Account-total summary rows — one per top-level account, with
  // estimate/working/committed/actual totals for that account.
  for (const account of accountsSorted) {
    if (account.parentId != null) continue
    const accountPath = buildAccountPath(account, budget.accounts)
    const activeSubtotal = activeRollup?.subtotalByAccount.get(account.id)
    yield csvRow([
      budget.id, activeVersion?.kind ?? '', activeVersion?.name ?? '',
      account.code, account.name, accountPath,
      '',
      `ACCOUNT TOTAL: ${account.code} ${account.name}`,
      '', '', '', '', '',
      findAccountTotalForVersion(data, 'estimate',  account.id) ?? '',
      findAccountTotalForVersion(data, 'working',   account.id) ?? '',
      findAccountTotalForVersion(data, 'committed', account.id) ?? '',
      activeSubtotal?.totalActuals ?? '',
      '', '', '', '',
    ])
  }

  // Markup rows — one per markup, amount in the relevant version columns.
  const markupsSorted: BudgetMarkup[] = [...budget.markups].sort((a, b) => a.sortOrder - b.sortOrder)
  for (const markup of markupsSorted) {
    const pctDisplay = (Number(markup.percent) * 100).toFixed(2).replace(/\.?0+$/, '')
    yield csvRow([
      budget.id, activeVersion?.kind ?? '', activeVersion?.name ?? '',
      '', '', '',
      '',
      `MARKUP: ${markup.name} @ ${pctDisplay}% (${markup.appliesTo})`,
      '', '', '', '', '',
      findMarkupAmountForVersion(data, 'estimate',  markup.id) ?? '',
      findMarkupAmountForVersion(data, 'working',   markup.id) ?? '',
      findMarkupAmountForVersion(data, 'committed', markup.id) ?? '',
      '',
      '', '', '', '',
    ])
  }

  // Grand total row — last.
  yield csvRow([
    budget.id, activeVersion?.kind ?? '', activeVersion?.name ?? '',
    '', '', '',
    '', 'GRAND TOTAL',
    '', '', '', '', '',
    findGrandTotalForVersion(data, 'estimate')  ?? '',
    findGrandTotalForVersion(data, 'working')   ?? '',
    findGrandTotalForVersion(data, 'committed') ?? '',
    activeRollup?.grandActuals ?? '',
    '', '', '', '',
  ])
}

export async function GET(
  request: Request,
  { params }: { params: { budgetId: string } },
) {
  const url = new URL(request.url)
  const versionParam = url.searchParams.get('version')

  let data: BudgetExportData
  try {
    data = await fetchBudgetExportData(params.budgetId)
  } catch (e) {
    console.error('CSV export fetch failed:', e)
    return new Response('Budget not found', { status: 404 })
  }

  const activeVersion = resolveActiveVersion(data.budget.versions, versionParam)
  const filename = `${projectSlug(data.project.name)}-budget-${activeVersion.kind}-${todayIso()}.csv`

  // ReadableStream — emit rows as they're generated. CSV stays in chunks
  // and never lands as one big in-memory string.
  const encoder = new TextEncoder()
  const iterator = generateRows(data, activeVersion.kind)
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      try {
        const next = iterator.next()
        if (next.done) {
          controller.close()
        } else {
          controller.enqueue(encoder.encode(next.value))
        }
      } catch (e) {
        controller.error(e)
      }
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'no-store',
    },
  })
}
