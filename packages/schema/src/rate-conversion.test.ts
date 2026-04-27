import { describe, it, expect } from 'vitest'
import { computeExpenseUnits, resolveExpenseRate } from './rate-unit'

// ── computeExpenseUnits ────────────────────────────────────────────────
//
// The single most-important test in this file is the named PR #19
// regression: `computeExpenseUnits('day', 6)` returns { units: 1, unit:
// 'DAY' } so a 6-hour day-rate-of-$900 entry computes to $900 (1 × $900),
// NOT $5,400 (6 × $900). The whole point of deferring PR #19 to the budget
// arc was to ship the math fix *with verification*.

describe('computeExpenseUnits', () => {
  describe('hour-unit timecards', () => {
    it('returns hours as units, HOUR as unit', () => {
      expect(computeExpenseUnits('hour', 12)).toEqual({ units: 12, unit: 'HOUR' })
    })

    it('handles zero hours', () => {
      expect(computeExpenseUnits('hour', 0)).toEqual({ units: 0, unit: 'HOUR' })
    })

    it('handles fractional hours (12.5)', () => {
      expect(computeExpenseUnits('hour', 12.5)).toEqual({ units: 12.5, unit: 'HOUR' })
    })

    it('handles a typical 8-hour day on hourly rate', () => {
      // Editor at $75/hour clocks 8 hours → 8 × $75 = $600 (callers do the multiply).
      expect(computeExpenseUnits('hour', 8)).toEqual({ units: 8, unit: 'HOUR' })
    })
  })

  describe('day-unit timecards (PR #19 regression cases)', () => {
    // 🟥 The named regression test from PR #19's bug report.
    // Rate: $900/day. Hours clocked: 6. Expected expense: $900 (1 × $900).
    // The bug was: `total = hours × rate` produced 6 × $900 = $5,400.
    // Helper returns units=1 unit=DAY so callers compute 1 × $900 = $900.
    it('PR #19 case: day-unit with 6 hours returns { units: 1, unit: DAY }', () => {
      expect(computeExpenseUnits('day', 6)).toEqual({ units: 1, unit: 'DAY' })
    })

    it('returns 1 unit + DAY regardless of hours value (12 hours)', () => {
      expect(computeExpenseUnits('day', 12)).toEqual({ units: 1, unit: 'DAY' })
    })

    it('still returns 1 unit + DAY when hours is 0 — day-unit is informational on hours', () => {
      // A day-unit timecard with hours=0 still represents one paid day.
      // The hours field on day-unit is informational only.
      expect(computeExpenseUnits('day', 0)).toEqual({ units: 1, unit: 'DAY' })
    })

    it('still returns 1 unit + DAY for fractional hours (8.5)', () => {
      expect(computeExpenseUnits('day', 8.5)).toEqual({ units: 1, unit: 'DAY' })
    })

    it('still returns 1 unit + DAY for an extreme hours value (24)', () => {
      // The schema caps hours at Decimal(4,2) which allows up to 24.00.
      expect(computeExpenseUnits('day', 24)).toEqual({ units: 1, unit: 'DAY' })
    })
  })
})

// ── resolveExpenseRate ─────────────────────────────────────────────────
//
// Priority order (spec §5.1):
//   1. timecard.rate            — producer's per-timecard override
//   2. line.actualsRate         — per-line override on BudgetLine
//   3. rateSourceVersion's amount.rate
//   4. 0 — fallback so callers can multiply safely without null guards.
//
// **Explicit-zero invariant:** an explicit 0 at any level means "this work
// is unpaid" — distinct from "no rate set". Only null/undefined falls
// through. Zero stops the fallback chain.

describe('resolveExpenseRate', () => {
  describe('first-position takes priority', () => {
    it('returns timecardRate when present', () => {
      expect(resolveExpenseRate(150, 200, 250)).toBe(150)
    })

    it('returns timecardRate even when subsequent levels are null', () => {
      expect(resolveExpenseRate(150, null, null)).toBe(150)
    })
  })

  describe('falls through to second position', () => {
    it('returns lineActualsRate when timecardRate is null', () => {
      expect(resolveExpenseRate(null, 200, 250)).toBe(200)
    })

    it('returns lineActualsRate when timecardRate is undefined', () => {
      expect(resolveExpenseRate(undefined, 200, 250)).toBe(200)
    })
  })

  describe('falls through to third position', () => {
    it('returns versionRate when first two are null', () => {
      expect(resolveExpenseRate(null, null, 250)).toBe(250)
    })

    it('returns versionRate when first two are undefined', () => {
      expect(resolveExpenseRate(undefined, undefined, 250)).toBe(250)
    })

    it('returns versionRate when first two mix null and undefined', () => {
      expect(resolveExpenseRate(null, undefined, 250)).toBe(250)
    })
  })

  describe('all-null fallback', () => {
    it('returns 0 (number, not null) when all three are null', () => {
      expect(resolveExpenseRate(null, null, null)).toBe(0)
    })

    it('returns 0 when all three are undefined', () => {
      expect(resolveExpenseRate(undefined, undefined, undefined)).toBe(0)
    })

    it('the fallback type is number, never null', () => {
      // Callers downstream multiply this value — typeof must be 'number'.
      expect(typeof resolveExpenseRate(null, null, null)).toBe('number')
    })
  })

  describe('explicit-zero invariant', () => {
    // Critical: an explicit 0 at any level is a valid "unpaid work" rate.
    // It must NOT be coerced to the next fallback — only null/undefined falls through.

    it('treats explicit 0 at timecard level as the resolved rate (not fallback)', () => {
      expect(resolveExpenseRate(0, 200, 250)).toBe(0)
    })

    it('treats explicit 0 at line-actuals level as the resolved rate when timecard is null', () => {
      expect(resolveExpenseRate(null, 0, 250)).toBe(0)
    })

    it('treats explicit 0 at version level as the resolved rate when first two are null', () => {
      expect(resolveExpenseRate(null, null, 0)).toBe(0)
    })

    it('explicit 0 at timecard does NOT fall through to a non-zero line rate', () => {
      // The bug we're guarding against: `tcRate || lineRate || versionRate`
      // would coerce 0 to fallback. We use null/undefined-aware short-circuit.
      expect(resolveExpenseRate(0, 999, 999)).not.toBe(999)
      expect(resolveExpenseRate(0, 999, 999)).toBe(0)
    })
  })
})
