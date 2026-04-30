// Derive each talent's call time from the schedule.
// Default: earliest schedule block they appear in, minus 15 min.
// Exception: a `talent_call` block uses the block's startTime exactly
// (the AD has set it explicitly).

import { addMinutesToTime, compareTime } from './format-time'
import type { ScheduleBlock } from '@/types'

export function deriveCallTimes(
  blocks: Pick<ScheduleBlock, 'startTime' | 'talentIds' | 'kind'>[],
  talentIds: string[],
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const tid of talentIds) {
    const myBlocks = blocks.filter(b => b.talentIds.includes(tid))
    if (myBlocks.length === 0) continue
    const earliest = [...myBlocks].sort((a, b) => compareTime(a.startTime, b.startTime))[0]
    if (earliest.kind === 'talent_call') {
      result[tid] = earliest.startTime
    } else {
      result[tid] = addMinutesToTime(earliest.startTime, -15)
    }
  }
  return result
}
