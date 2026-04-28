'use client'

import { haptic } from '@/lib/utils/haptics'

// PR 12 — chip strip above the account list. Multi-select with AND
// semantics (a line is visible only if its tags include every active
// filter tag). Hidden entirely when no tags exist anywhere in the
// budget. Topsheet does NOT honor the filter — this is a list-only
// affordance.

interface TagFilterStripProps {
  allTags: string[]               // unique tags across budget, sorted by use count then name
  active: string[]                // currently selected filter tags
  accent: string
  onToggle: (tag: string) => void
  onClearAll: () => void
}

export function TagFilterStrip({
  allTags, active, accent, onToggle, onClearAll,
}: TagFilterStripProps) {
  if (allTags.length === 0) return null

  const activeSet = new Set(active)

  return (
    <div
      className="flex items-center"
      style={{
        gap: 6,
        padding: '8px 16px 6px',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}
    >
      {active.length > 0 && (
        <button
          type="button"
          onClick={() => { haptic('light'); onClearAll() }}
          className="font-mono uppercase"
          style={{
            flexShrink: 0,
            padding: '4px 10px',
            borderRadius: 999,
            background: `${accent}24`,
            border: `1px solid ${accent}66`,
            color: accent,
            fontSize: 9, letterSpacing: '0.06em',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {active.length} filter{active.length === 1 ? '' : 's'} · clear
        </button>
      )}

      {allTags.map(tag => {
        const isActive = activeSet.has(tag)
        return (
          <button
            key={tag}
            type="button"
            onClick={() => { haptic('light'); onToggle(tag) }}
            className="font-mono"
            style={{
              flexShrink: 0,
              padding: '4px 10px',
              borderRadius: 999,
              background: isActive ? `${accent}1a` : 'rgba(155,110,243,0.10)',
              border: `1px solid ${isActive ? `${accent}66` : 'rgba(155,110,243,0.22)'}`,
              color: isActive ? accent : '#9b6ef3',
              fontSize: 10, letterSpacing: '0.04em',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >{tag}</button>
        )
      })}
    </div>
  )
}
