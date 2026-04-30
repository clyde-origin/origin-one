// Pure: per-recipient personalization data + snapshot for delta detection.

import { addMinutesToTime, compareTime } from '@/lib/schedule/format-time'
import type { ScheduleBlock } from '@/types'

export type PersonalizeRecipient = {
  id: string
  kind: 'talent' | 'crew' | 'client' | 'freeform'
  talentId: string | null
  projectMemberId: string | null
  callTimeOverride: string | null
}

export type PersonalizeContext = {
  shootDate: string
  generalCallTime: string | null
  crewCallTime: string | null
  lunchTime: string | null
  setLocationAddress: string | null
  schedule: Pick<ScheduleBlock, 'id' | 'startTime' | 'kind' | 'talentIds' | 'crewMemberIds'>[]
}

export type RecipientSnapshot = {
  callTime: string | null
  locationAddress: string | null
  shootDate: string
  scheduleBlockIds: string[]
  lunchTime: string | null
}

export function personalizeRecipient(recipient: PersonalizeRecipient, ctx: PersonalizeContext): RecipientSnapshot {
  // Determine "their" schedule blocks
  const ownBlocks = ctx.schedule.filter(b => {
    if (recipient.talentId) return b.talentIds.includes(recipient.talentId)
    if (recipient.projectMemberId) return b.crewMemberIds.includes(recipient.projectMemberId)
    return false
  })

  // Call time: override > derived from earliest own block - 15 min (talent) > general/crew call
  let callTime: string | null = recipient.callTimeOverride
  if (!callTime) {
    if (recipient.kind === 'talent') {
      if (ownBlocks.length > 0) {
        const earliest = [...ownBlocks].sort((a, b) => compareTime(a.startTime, b.startTime))[0]
        callTime = earliest.kind === 'talent_call'
          ? earliest.startTime
          : addMinutesToTime(earliest.startTime, -15)
      } else {
        callTime = ctx.generalCallTime
      }
    } else {
      // crew, client, freeform
      callTime = ctx.crewCallTime ?? ctx.generalCallTime
    }
  }

  return {
    callTime,
    locationAddress: ctx.setLocationAddress,
    shootDate: ctx.shootDate,
    scheduleBlockIds: ownBlocks.map(b => b.id).sort(),
    lunchTime: ctx.lunchTime,
  }
}
