// Budget arc — Zod schemas for the 8 budget models + 5 enums.
// Decimal columns serialize to string (Prisma convention); coerce at the
// app boundary with Number(...) where math is needed. Use z.coerce.date()
// for any DateTime / @db.Date column.

import { z } from "zod";

export const BudgetVersionKind    = z.enum(["estimate", "working", "committed", "other"]);
export const BudgetVersionState   = z.enum(["draft", "locked"]);
export const BudgetAccountSection = z.enum(["ATL", "BTL"]);
export const BudgetUnit           = z.enum(["DAY", "WEEK", "HOUR", "FLAT", "UNIT"]);
export const MarkupTarget         = z.enum(["grandTotal", "accountSubtotal"]);

export type BudgetVersionKind    = z.infer<typeof BudgetVersionKind>;
export type BudgetVersionState   = z.infer<typeof BudgetVersionState>;
export type BudgetAccountSection = z.infer<typeof BudgetAccountSection>;
export type BudgetUnit           = z.infer<typeof BudgetUnit>;
export type MarkupTarget         = z.infer<typeof MarkupTarget>;

export const Budget = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  currency: z.string(),
  rateSourceVersionId: z.string().uuid().nullable(),
  varianceThreshold: z.string(),                      // Decimal(5,4) — string in JSON
  clonedFromProjectId: z.string().uuid().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Budget = z.infer<typeof Budget>;

export const BudgetVersion = z.object({
  id: z.string().uuid(),
  budgetId: z.string().uuid(),
  name: z.string(),
  kind: BudgetVersionKind,
  sortOrder: z.number().int(),
  state: BudgetVersionState,
  lockedAt: z.coerce.date().nullable(),
  lockedBy: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type BudgetVersion = z.infer<typeof BudgetVersion>;

export const BudgetAccount = z.object({
  id: z.string().uuid(),
  budgetId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  section: BudgetAccountSection,
  code: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type BudgetAccount = z.infer<typeof BudgetAccount>;

export const BudgetLine = z.object({
  id: z.string().uuid(),
  budgetId: z.string().uuid(),
  accountId: z.string().uuid(),
  description: z.string(),
  unit: BudgetUnit,
  fringeRate: z.string(),                             // Decimal(5,4)
  tags: z.string().array(),
  actualsRate: z.string().nullable(),                 // Decimal(12,2)
  sortOrder: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type BudgetLine = z.infer<typeof BudgetLine>;

export const BudgetLineAmount = z.object({
  id: z.string().uuid(),
  lineId: z.string().uuid(),
  versionId: z.string().uuid(),
  qty: z.string(),                                    // formula or numeric literal
  rate: z.string(),                                   // Decimal(12,2)
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type BudgetLineAmount = z.infer<typeof BudgetLineAmount>;

export const BudgetVariable = z.object({
  id: z.string().uuid(),
  budgetId: z.string().uuid(),
  versionId: z.string().uuid().nullable(),            // null = budget-level
  name: z.string(),
  value: z.string(),                                  // formula or numeric literal
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type BudgetVariable = z.infer<typeof BudgetVariable>;

export const BudgetMarkup = z.object({
  id: z.string().uuid(),
  budgetId: z.string().uuid(),
  versionId: z.string().uuid().nullable(),            // null = applies to all versions
  name: z.string(),
  percent: z.string(),                                // Decimal(5,4)
  appliesTo: MarkupTarget,
  accountId: z.string().uuid().nullable(),            // required when appliesTo = accountSubtotal
  sortOrder: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type BudgetMarkup = z.infer<typeof BudgetMarkup>;
