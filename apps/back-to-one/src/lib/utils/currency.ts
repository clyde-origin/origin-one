/**
 * USD currency formatting for timecard rates and totals.
 *
 * Single source of truth — every dollar amount surfaced in the UI passes
 * through this helper. No inline string interpolation of dollars anywhere.
 *
 * USD is hardcoded for now. Multi-currency is deferred until international
 * productions surface the need.
 */

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Format a number as USD with two-decimal precision and thousands separators.
 *
 *   formatUSD(750)        // "$750.00"
 *   formatUSD(9000)       // "$9,000.00"
 *   formatUSD(0)          // "$0.00"
 *   formatUSD(null)       // "$0.00"
 *   formatUSD(undefined)  // "$0.00"
 *   formatUSD(NaN)        // "$0.00"
 *
 * Null/undefined/NaN inputs collapse to "$0.00" so callers don't need to
 * branch — they already filter at the visibility level (e.g. EntryCard
 * suppresses the rate row when rate is null).
 */
export function formatUSD(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '$0.00'
  return USD.format(value)
}
