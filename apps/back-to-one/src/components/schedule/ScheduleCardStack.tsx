'use client'

import type { ScheduleBlock, ScheduleBlockKind, ScheduleBlockTrack } from '@/types'
import { formatTimeRange } from '@/lib/schedule/format-time'
import { useLocations, useProjectTalent } from '@/lib/hooks/useOriginOne'

const FULL_WIDTH_KINDS = new Set<ScheduleBlockKind>([
  'load_in', 'talent_call', 'lunch', 'wrap', 'tail_lights', 'meal_break', 'custom',
])

const TRACK_HEX: Record<ScheduleBlockTrack, string> = {
  main: '#6470f3',
  secondary: '#e8a020',
  tertiary: '#00b894',
}

const KIND_LABEL: Partial<Record<ScheduleBlockKind, string>> = {
  load_in: 'LOAD IN',
  talent_call: 'TALENT CALL',
  lunch: 'LUNCH',
  wrap: 'WRAP OUT',
  tail_lights: 'TAIL LIGHTS',
  meal_break: 'MEAL BREAK',
}

export function ScheduleCardStack({
  blocks,
  onEditBlock,
  projectId,
}: {
  blocks: ScheduleBlock[]
  onEditBlock: (block: ScheduleBlock) => void
  projectId: string
}) {
  const { data: locations = [] } = useLocations(projectId)
  const { data: talent = [] } = useProjectTalent(projectId)

  const sorted = [...blocks].sort((a, b) => {
    const t = a.startTime.localeCompare(b.startTime)
    if (t !== 0) return t
    const trackOrder = { main: 0, secondary: 1, tertiary: 2 }
    return trackOrder[a.track] - trackOrder[b.track]
  })

  const talentName = (id: string) => talent.find(t => t.id === id)?.name ?? '—'
  const locationName = (id: string | null) => (id ? locations.find(l => l.id === id)?.name ?? '' : '')

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center text-white/40">
        No schedule yet — add the first block.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {sorted.map(b => {
        const isFull = FULL_WIDTH_KINDS.has(b.kind)
        const accent = isFull ? '#a0a0b8' : TRACK_HEX[b.track]
        const tagLabel = isFull
          ? (b.kind === 'custom' ? (b.customLabel ?? 'CUSTOM') : (KIND_LABEL[b.kind] ?? b.kind.replace('_', ' ')))
          : b.track

        return (
          <button
            key={b.id}
            onClick={() => onEditBlock(b)}
            className="text-left bg-white/[0.04] border border-white/10 rounded-2xl p-3.5 active:bg-white/[0.08] transition-colors"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-white/55">{formatTimeRange(b.startTime, b.endTime)}</span>
              <span
                className="font-mono uppercase text-[9px] tracking-widest px-2 py-0.5 rounded-full"
                style={{ background: `${accent}1a`, color: accent, border: `1px solid ${accent}33` }}
              >
                {tagLabel}
              </span>
            </div>
            <div className="mt-1.5 text-[0.9rem] text-white/95 leading-tight">
              {b.description || <span className="text-white/30">No description</span>}
            </div>
            {!isFull && (b.locationId || b.talentIds.length > 0) && (
              <div className="mt-1.5 text-[11px] text-white/50">
                {b.locationId && <span>📍 {locationName(b.locationId)}</span>}
                {b.locationId && b.talentIds.length > 0 && <span> · </span>}
                {b.talentIds.length > 0 && <span>{b.talentIds.map(talentName).join(', ')}</span>}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
