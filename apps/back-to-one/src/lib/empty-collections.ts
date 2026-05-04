// Module-level empty constants. Replace `(items ?? [])` patterns with these
// to keep the same identity across renders — useMemo deps that watch the
// fallback no longer fire on every render when upstream `items` is undefined.
//
// Type as `never[]` / `ReadonlyMap<unknown, unknown>` so TypeScript widens to
// the consumer's element type. Cast at the call site if needed.

export const EMPTY_ARRAY: readonly never[] = []

export const EMPTY_MAP: ReadonlyMap<unknown, unknown> = new Map()
