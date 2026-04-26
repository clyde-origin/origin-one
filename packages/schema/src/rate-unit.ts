// Unit of time for a CrewTimecard rate. 'day' = whole-day rate (one timecard
// date counts as one day, hours field informational); 'hour' = hourly rate
// (units = hours).
//
// The two helpers below close PR #19's deferred math issue. They live here
// (rather than in apps/back-to-one) so packages/db/prisma/seed.ts can
// import them — single source of truth across the seed, the EntryCard
// total math, and the future timecard-to-expense flow (PR 8). Pure
// stateless transforms over the rate-unit type; no business logic in the
// "stateful" sense, just typed conversions tied to the RateUnit enum's
// domain.

import { z } from "zod";
import { BudgetUnit } from "./budget";

export const RateUnit = z.enum(["day", "hour"]);

export type RateUnit = z.infer<typeof RateUnit>;

/**
 * Convert a CrewTimecard's (rateUnit, hours) into the (units, unit) pair
 * that becomes Expense.units / Expense.unit when an approved timecard
 * is materialized.
 *
 * Hour timecards: units = hours, unit = HOUR.
 * Day timecards:  units = 1,     unit = DAY  (one timecard date = one day —
 *                                              the hours field is
 *                                              informational only on
 *                                              day-unit timecards).
 *
 * The PR #19 case: a $900/day rate with 6 hours clocked → expense = $900,
 * not $5,400. The bug was `total = hours × rate`; this helper returns
 * units=1 + unit=DAY so callers compute 1 × $900 = $900.
 */
export function computeExpenseUnits(
  rateUnit: RateUnit,
  hours: number,
): { units: number; unit: z.infer<typeof BudgetUnit> } {
  if (rateUnit === "hour") return { units: hours, unit: "HOUR" };
  return { units: 1, unit: "DAY" };
}

/**
 * Resolve the rate to use when materializing a timecard into an Expense.
 *
 * Priority (spec §5.1):
 *   1. timecard.rate           (producer's per-timecard override)
 *   2. line.actualsRate        (per-line override on BudgetLine)
 *   3. rateSourceVersion's amount.rate
 *
 * Returns 0 when all three are null/undefined so callers can multiply
 * safely without a null guard.
 *
 * **Explicit-zero invariant**: an explicit 0 at any level is treated as
 * a valid rate (= "this work is unpaid"). Only null/undefined falls
 * through to the next fallback. Zero stops the chain.
 *
 * Distinguishing 0 from "no rate set" matters for unpaid passes (interns,
 * favors, comp work) — they need to record an Expense at amount $0
 * rather than silently inheriting a different rate from another level.
 */
export function resolveExpenseRate(
  timecardRate: number | null | undefined,
  lineActualsRate: number | null | undefined,
  versionRate: number | null | undefined,
): number {
  if (timecardRate !== null && timecardRate !== undefined) return timecardRate;
  if (lineActualsRate !== null && lineActualsRate !== undefined) return lineActualsRate;
  if (versionRate !== null && versionRate !== undefined) return versionRate;
  return 0;
}
