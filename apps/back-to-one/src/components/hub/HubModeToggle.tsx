'use client'

import type { HubMode } from '@/lib/hooks/useHubMode'

interface Props {
  mode: HubMode
  onChange: (next: HubMode) => void
}

const SEGMENTS: ReadonlyArray<{ value: HubMode; label: string }> = [
  { value: 'production', label: 'Production' },
  { value: 'creative',   label: 'Creative' },
]

/**
 * Binary segmented toggle between Production and Creative modes.
 * Renders inside the .hub-topbar. Stateless — parent owns the mode
 * via useHubMode().
 */
export function HubModeToggle({ mode, onChange }: Props) {
  return (
    <div className="hub-toggle" role="tablist" aria-label="Hub mode">
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
