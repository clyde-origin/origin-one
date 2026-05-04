'use client'

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
 */
export function HubArcToggle({ mode, onChange }: Props) {
  return (
    <div className="hub-toggle" role="tablist" aria-label="One Arc mode">
      {SEGMENTS.map(seg => (
        <button
          key={seg.value}
          type="button"
          role="tab"
          aria-selected={mode === seg.value}
          className={`hub-toggle-btn${mode === seg.value ? ' active' : ''}`}
          onClick={() => onChange(seg.value)}
        >
          {seg.label}
        </button>
      ))}
    </div>
  )
}
