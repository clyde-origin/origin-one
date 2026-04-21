// Shared row-level thread indicator. Single implementation — every list view
// across the app consumes this one component. Mirrors the shotlist spec:
// absolute bottom-right (-6/-6), 2px background-color border to float the
// badge over the card edge, violet when read, deep amber when unread. Caller
// guarantees a `position: relative` ancestor.
//
// Rule: Hub preview rows never carry entity-level thread badges — Hub aggregates
// via ThreadsIcon. See DECISIONS.md § Entity-vs-production-record threading rule.

import { TV, TA_DEEP } from '@/lib/thread-tokens'

export interface ThreadRowBadgeEntry {
  count: number
  unread: boolean
}

export function ThreadRowBadge({ entry }: { entry: ThreadRowBadgeEntry | undefined | null }) {
  if (!entry) return null
  const label = entry.count > 99 ? '99+' : String(entry.count)
  return (
    <div style={{
      position: 'absolute', bottom: -6, right: -6,
      minWidth: 20, height: 20, borderRadius: 10,
      background: entry.unread ? TA_DEEP : TV,
      border: '2px solid #080808',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Geist Mono', monospace",
      fontSize: 9, fontWeight: 700, color: '#fff',
      padding: '0 5px', zIndex: 2,
      pointerEvents: 'none',
    }}>{label}</div>
  )
}
