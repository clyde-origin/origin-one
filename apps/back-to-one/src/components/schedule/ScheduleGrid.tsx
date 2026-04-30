'use client'

import { useMemo } from 'react'
import type { ScheduleBlock, ScheduleBlockKind } from '@/types'
import { formatTime, formatTimeRange, minutesBetween } from '@/lib/schedule/format-time'
import { useLocations, useProjectTalent } from '@/lib/hooks/useOriginOne'

const FULL_WIDTH_KINDS = new Set<ScheduleBlockKind>([
  'load_in', 'talent_call', 'lunch', 'wrap', 'tail_lights', 'meal_break', 'custom',
])

const KIND_FULL_LABEL: Partial<Record<ScheduleBlockKind, string>> = {
  load_in: 'LOAD IN',
  talent_call: 'TALENT CALL',
  lunch: 'LUNCH',
  wrap: 'WRAP OUT',
  tail_lights: 'TAIL LIGHTS',
  meal_break: 'MEAL BREAK',
}

type Row = {
  startTime: string
  endTime: string | null
  fullWidth: ScheduleBlock | null
  main: ScheduleBlock | null
  secondary: ScheduleBlock | null
  tertiary: ScheduleBlock | null
}

function groupBlocks(blocks: ScheduleBlock[]): Row[] {
  const map = new Map<string, Row>()
  for (const b of blocks) {
    const key = `${b.startTime}__${b.endTime ?? ''}`
    if (!map.has(key)) {
      map.set(key, { startTime: b.startTime, endTime: b.endTime, fullWidth: null, main: null, secondary: null, tertiary: null })
    }
    const row = map.get(key)!
    if (FULL_WIDTH_KINDS.has(b.kind)) {
      row.fullWidth = b
    } else if (b.track === 'main') {
      row.main = b
    } else if (b.track === 'secondary') {
      row.secondary = b
    } else {
      row.tertiary = b
    }
  }
  return Array.from(map.values()).sort((a, b) => a.startTime.localeCompare(b.startTime))
}

export function ScheduleGrid({
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

  const rows = useMemo(() => groupBlocks(blocks), [blocks])

  const talentName = (id: string) => talent.find(t => t.id === id)?.name ?? '—'
  const locationName = (id: string | null) => (id ? locations.find(l => l.id === id)?.name ?? '—' : '')

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center text-white/40">
        No schedule yet — add the first block.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
      <table className="w-full text-xs text-white" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr className="bg-white/5 text-white/40 font-mono uppercase tracking-wider">
            <th className="text-left p-3 w-32">Time</th>
            <th className="text-left p-3 w-12">Min</th>
            <th className="text-left p-3 w-32">Talent</th>
            <th className="text-left p-3 w-32">Location</th>
            <th className="text-left p-3">Main</th>
            <th className="text-left p-3">Secondary</th>
            <th className="text-left p-3">Tertiary</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const minutes = r.endTime ? minutesBetween(r.startTime, r.endTime) : null
            if (r.fullWidth) {
              const b = r.fullWidth
              const label =
                b.kind === 'custom'
                  ? (b.customLabel?.toUpperCase() ?? 'CUSTOM')
                  : KIND_FULL_LABEL[b.kind] ?? b.kind.toUpperCase()
              return (
                <tr
                  key={i}
                  className="border-t border-white/5 cursor-pointer hover:bg-white/[0.04]"
                  onClick={() => onEditBlock(b)}
                >
                  <td className="p-3 font-mono">{formatTimeRange(r.startTime, r.endTime)}</td>
                  <td className="p-3 text-white/40">{minutes ?? ''}</td>
                  <td colSpan={5} className="p-3 text-center font-mono uppercase tracking-wider text-white/85">
                    {label}
                    {b.description ? <span className="text-white/50"> · {b.description}</span> : null}
                  </td>
                </tr>
              )
            }

            const primary = r.main ?? r.secondary ?? r.tertiary
            const tIds = primary?.talentIds ?? []
            const locId = primary?.locationId ?? null

            return (
              <tr key={i} className="border-t border-white/5">
                <td className="p-3 font-mono">{formatTimeRange(r.startTime, r.endTime)}</td>
                <td className="p-3 text-white/40">{minutes ?? ''}</td>
                <td className="p-3 text-white/80">{tIds.length === 0 ? '—' : tIds.map(talentName).join(', ')}</td>
                <td className="p-3 text-white/80">{locationName(locId)}</td>
                <td className="p-3 cursor-pointer hover:bg-white/[0.04]" onClick={() => r.main && onEditBlock(r.main)}>
                  {r.main?.description ?? <span className="text-white/25">—</span>}
                </td>
                <td className="p-3 text-white/65 cursor-pointer hover:bg-white/[0.04]" onClick={() => r.secondary && onEditBlock(r.secondary)}>
                  {r.secondary?.description ?? <span className="text-white/25">—</span>}
                </td>
                <td className="p-3 text-white/65 cursor-pointer hover:bg-white/[0.04]" onClick={() => r.tertiary && onEditBlock(r.tertiary)}>
                  {r.tertiary?.description ?? <span className="text-white/25">—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
