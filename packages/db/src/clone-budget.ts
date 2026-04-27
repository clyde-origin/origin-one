// cloneBudget — deep copy a project's Budget into another project, in a
// single Prisma transaction.
//
// Per spec §7.2 / plan PR 7:
//   • Copies Budget + BudgetVersions + BudgetAccounts (tree) + BudgetLines
//     + BudgetLineAmounts + BudgetVariables + BudgetMarkups.
//   • Does NOT copy Expenses — actuals are real-world data, not template.
//   • Re-links every internal FK to the freshly-created IDs (parentId on
//     accounts, versionId/lineId/accountId on amounts/markups/variables).
//   • Stores the source projectId on Budget.clonedFromProjectId for
//     traceability (column added in PR 4 #48).
//
// Located in @origin-one/db so packages/db/prisma/seed.ts and any future
// app-side caller (API route + Prisma) can both import it. Helper is
// pure — caller provides the PrismaClient instance, lifecycle is the
// caller's concern. Single $transaction inside guarantees atomicity:
// partial failure rolls everything back.

import type { PrismaClient } from '@prisma/client'

export async function cloneBudget(
  prisma: PrismaClient,
  sourceProjectId: string,
  targetProjectId: string,
): Promise<string> {
  // Default Prisma interactive-transaction timeout is 5s. A typical clone
  // is ~140 round-trips (1 budget + N versions + N accounts + N lines +
  // 3N line-amounts + variables + markups) which on Supabase pooler runs
  // ~7-10s. 30s gives generous headroom; clone is not in a hot path.
  return prisma.$transaction(async (tx) => {
    // ── Source — eager-load everything we need to clone in one query.
    // Includes ordered children (accounts by sortOrder so the topological
    // pass below sees a stable order; amounts ride on lines).
    const source = await tx.budget.findUniqueOrThrow({
      where: { projectId: sourceProjectId },
      include: {
        versions:  { orderBy: { sortOrder: 'asc' } },
        accounts:  { orderBy: { sortOrder: 'asc' } },
        lines:     { include: { amounts: true } },
        variables: true,
        markups:   { orderBy: { sortOrder: 'asc' } },
      },
    })

    // ── 1. Budget shell — same currency/threshold, fresh id, clonedFrom set.
    const target = await tx.budget.create({
      data: {
        projectId: targetProjectId,
        currency: source.currency,
        varianceThreshold: source.varianceThreshold,
        clonedFromProjectId: sourceProjectId,
      },
    })

    // ── 2. Versions — build sourceVersionId → newVersionId map.
    const versionIdByOld = new Map<string, string>()
    for (const v of source.versions) {
      const created = await tx.budgetVersion.create({
        data: {
          budgetId:  target.id,
          name:      v.name,
          kind:      v.kind,
          sortOrder: v.sortOrder,
          state:     v.state,
          // Lock metadata is intentionally NOT copied — a clone starts
          // unlocked even if the source version was locked. Producer can
          // re-lock the clone if they want.
        },
      })
      versionIdByOld.set(v.id, created.id)
    }

    // Re-link rateSourceVersionId on the target budget if the source had one.
    if (source.rateSourceVersionId) {
      const newRateSource = versionIdByOld.get(source.rateSourceVersionId)
      if (newRateSource) {
        await tx.budget.update({
          where: { id: target.id },
          data:  { rateSourceVersionId: newRateSource },
        })
      }
    }

    // ── 3. Accounts (tree) — topological pass: parent must exist before child.
    const accountIdByOld = new Map<string, string>()
    const sortedAccounts = topologicalAccounts(source.accounts)
    for (const a of sortedAccounts) {
      const created = await tx.budgetAccount.create({
        data: {
          budgetId:  target.id,
          parentId:  a.parentId ? accountIdByOld.get(a.parentId) ?? null : null,
          section:   a.section,
          code:      a.code,
          name:      a.name,
          sortOrder: a.sortOrder,
        },
      })
      accountIdByOld.set(a.id, created.id)
    }

    // ── 4. Lines + per-version amounts.
    for (const line of source.lines) {
      const newAccountId = accountIdByOld.get(line.accountId)
      if (!newAccountId) {
        throw new Error(`cloneBudget: missing target account for source ${line.accountId}`)
      }
      const created = await tx.budgetLine.create({
        data: {
          budgetId:    target.id,
          accountId:   newAccountId,
          description: line.description,
          unit:        line.unit,
          fringeRate:  line.fringeRate,
          tags:        line.tags,
          actualsRate: line.actualsRate,
          sortOrder:   line.sortOrder,
        },
      })
      for (const amt of line.amounts) {
        const newVersionId = versionIdByOld.get(amt.versionId)
        if (!newVersionId) {
          throw new Error(`cloneBudget: missing target version for source ${amt.versionId}`)
        }
        await tx.budgetLineAmount.create({
          data: {
            lineId:    created.id,
            versionId: newVersionId,
            qty:       amt.qty,
            rate:      amt.rate,
            notes:     amt.notes,
          },
        })
      }
    }

    // ── 5. Variables — versionId nullable (null = budget-level).
    for (const v of source.variables) {
      await tx.budgetVariable.create({
        data: {
          budgetId:  target.id,
          versionId: v.versionId ? versionIdByOld.get(v.versionId) ?? null : null,
          name:      v.name,
          value:     v.value,
          notes:     v.notes,
        },
      })
    }

    // ── 6. Markups — versionId nullable, accountId required only when
    //     appliesTo='accountSubtotal'.
    for (const m of source.markups) {
      await tx.budgetMarkup.create({
        data: {
          budgetId:  target.id,
          versionId: m.versionId ? versionIdByOld.get(m.versionId) ?? null : null,
          accountId: m.accountId ? accountIdByOld.get(m.accountId) ?? null : null,
          name:      m.name,
          percent:   m.percent,
          appliesTo: m.appliesTo,
          sortOrder: m.sortOrder,
        },
      })
    }

    // Expenses are intentionally NOT cloned (spec §7.2 — actuals are
    // real-world data, not template).

    return target.id
  }, { timeout: 30_000 })
}

/**
 * Topologically sort accounts so each parent is emitted before its children.
 * BudgetAccount.parentId can reference another row in the same budget; the
 * input may be in any order. Pure utility — exported for testability.
 */
export function topologicalAccounts<T extends { id: string; parentId: string | null }>(rows: T[]): T[] {
  const sorted: T[] = []
  const remaining = [...rows]
  const placed = new Set<string>()
  while (remaining.length > 0) {
    const i = remaining.findIndex(r => !r.parentId || placed.has(r.parentId))
    if (i < 0) {
      throw new Error('cloneBudget: cycle (or dangling parentId) in account tree')
    }
    const [next] = remaining.splice(i, 1)
    sorted.push(next)
    placed.add(next.id)
  }
  return sorted
}
