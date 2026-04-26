// Expense — single source of actuals (labor + non-labor). Spec §3.1.
// Decimal columns serialize to string (Prisma convention).

import { z } from "zod";
import { BudgetUnit } from "./budget";

export const ExpenseSource = z.enum(["timecard", "manual"]);
export type ExpenseSource = z.infer<typeof ExpenseSource>;

export const Expense = z.object({
  id: z.string().uuid(),
  budgetId: z.string().uuid(),
  lineId: z.string().uuid(),
  source: ExpenseSource,
  amount: z.string(),                                 // Decimal(12,2)
  date: z.coerce.date(),
  units: z.string().nullable(),                       // Decimal(8,2)
  unitRate: z.string().nullable(),                    // Decimal(12,2)
  unit: BudgetUnit.nullable(),
  vendor: z.string().nullable(),
  notes: z.string().nullable(),
  receiptUrl: z.string().nullable(),
  timecardId: z.string().uuid().nullable(),           // @unique — one expense per timecard
  createdBy: z.string(),                              // ProjectMember.id pre-Auth, User.id post-Auth
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Expense = z.infer<typeof Expense>;
