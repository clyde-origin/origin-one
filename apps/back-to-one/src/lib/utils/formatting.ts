/**
 * Derive up to two-character uppercase initials from a name.
 *
 * Splits on whitespace, takes the first character of each word, and returns
 * at most two characters. Empty input returns `fallback` (default `'?'`).
 *
 * Used by avatar circles across chat, workflow, and casting surfaces.
 */
export function initials(name: string | null | undefined, fallback = '?'): string {
  const letters = (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
  return letters || fallback
}
