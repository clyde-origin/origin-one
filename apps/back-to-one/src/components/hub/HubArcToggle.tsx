'use client'

import { m, LayoutGroup } from 'framer-motion'

export type ArcMode = 'script' | 'shotlist' | 'storyboard'

interface Props {
  mode: ArcMode
  onChange: (next: ArcMode) => void
}

const SEGMENTS: ReadonlyArray<{ value: ArcMode; label: string }> = [
  { value: 'script',     label: 'Script' },
  { value: 'shotlist',   label: 'Shotlist' },
  { value: 'storyboard', label: 'Storyboard' },
]

/**
 * Triple segmented toggle for the One Arc preview within the Creative
 * surface. Local state — does NOT persist; each visit starts at 'script'.
 *
 * Carousel behavior: the selected segment is always centered. Buttons
 * cycle around it via Framer Motion's `layout` prop — when the active
 * segment changes, the others animate to their new positions while the
 * active one stretches via the `.hub-toggle-btn.active` CSS rule
 * (flex-grow 1.6 + accent fill, matching the binary HubModeToggle).
 */
export function HubArcToggle({ mode, onChange }: Props) {
  const activeIndex = Math.max(0, SEGMENTS.findIndex(s => s.value === mode))
  // Cyclically rotate so the active segment lands at center (index 1).
  // For active = i, render order is [(i-1+3)%3, i, (i+1)%3].
  const rotated = [
    SEGMENTS[(activeIndex - 1 + SEGMENTS.length) % SEGMENTS.length],
    SEGMENTS[activeIndex],
    SEGMENTS[(activeIndex + 1) % SEGMENTS.length],
  ]
  return (
    <LayoutGroup id="hub-arc-toggle">
      <div className="hub-toggle" role="tablist" aria-label="One Arc mode">
        {rotated.map(seg => (
          <m.button
            key={seg.value}
            layout
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            type="button"
            role="tab"
            aria-selected={mode === seg.value}
            className={`hub-toggle-btn${mode === seg.value ? ' active' : ''}`}
            onClick={() => onChange(seg.value)}
          >
            {seg.label}
          </m.button>
        ))}
      </div>
    </LayoutGroup>
  )
}
