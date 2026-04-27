// Compose the props shape that TopsheetContent + TopsheetPdfDocument
// both consume. The on-page topsheet (PR 10) builds these inline; the
// export routes need a server-side equivalent that walks the same
// rollup data.

import type { BudgetRollup } from '@/lib/budget/compute'
import type { TopsheetVersionTotal } from '@/components/budget/TopsheetContent'
import type { BudgetExportData } from './fetch-budget-tree'

export interface TopsheetProps {
  perVersion: Map<string, TopsheetVersionTotal>
  topAccounts: BudgetExportData['budget']['accounts']
  actualsByAccountId: Map<string, number>
  grandActuals: number
  sectionSubtotalsByVersion: Map<string, { atl: number; btl: number }>
  sectionActuals: { atl: number; btl: number }
}

export function buildTopsheetProps(
  data: BudgetExportData,
  activeVersionId: string,
): TopsheetProps {
  const { budget, rollupByVersionId } = data
  const perVersion = new Map<string, TopsheetVersionTotal>()
  const sectionSubtotalsByVersion = new Map<string, { atl: number; btl: number }>()

  for (const v of budget.versions) {
    const r = rollupByVersionId.get(v.id)
    if (!r) continue
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
    let atl = 0, btl = 0
    for (const a of budget.accounts) {
      if (a.parentId != null) continue
      const sub = r.subtotalByAccount.get(a.id)?.total ?? 0
      if (a.section === 'ATL') atl += sub
      else btl += sub
    }
    sectionSubtotalsByVersion.set(v.id, { atl, btl })
  }

  // Actuals are not versioned — derive from the active version's rollup.
  const activeRollup = rollupByVersionId.get(activeVersionId)
  const actualsByAccountId = new Map<string, number>()
  let atlActuals = 0, btlActuals = 0
  for (const a of budget.accounts) {
    if (a.parentId == null) {
      const sub = activeRollup?.subtotalByAccount.get(a.id)
      const v = sub?.totalActuals ?? 0
      actualsByAccountId.set(a.id, v)
      if (a.section === 'ATL') atlActuals += v
      else btlActuals += v
    }
  }

  const topAccounts = budget.accounts
    .filter(a => a.parentId == null)
    .sort((a, b) => {
      if (a.section !== b.section) return a.section === 'ATL' ? -1 : 1
      return a.sortOrder - b.sortOrder
    })

  return {
    perVersion,
    topAccounts,
    actualsByAccountId,
    grandActuals: activeRollup?.grandActuals ?? 0,
    sectionSubtotalsByVersion,
    sectionActuals: { atl: atlActuals, btl: btlActuals },
  }
}
