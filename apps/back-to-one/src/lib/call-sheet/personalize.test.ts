import { describe, it, expect } from 'vitest'
import { personalizeRecipient } from './personalize'

const baseCtx = {
  shootDate: '2026-04-22',
  generalCallTime: '07:30',
  crewCallTime: '07:00',
  lunchTime: '13:30',
  setLocationAddress: '123 Main St',
  schedule: [
    { id: 'b1', startTime: '09:30', kind: 'work' as const, talentIds: ['t1'], crewMemberIds: [] },
    { id: 'b2', startTime: '08:00', kind: 'work' as const, talentIds: ['t1', 't2'], crewMemberIds: [] },
    { id: 'b3', startTime: '07:45', kind: 'talent_call' as const, talentIds: ['t3'], crewMemberIds: [] },
  ],
}

describe('personalizeRecipient', () => {
  it('talent: derives call time from earliest block - 15min', () => {
    const snap = personalizeRecipient(
      { id: 'r1', kind: 'talent', talentId: 't1', projectMemberId: null, callTimeOverride: null },
      baseCtx,
    )
    expect(snap.callTime).toBe('07:45')
    expect(snap.scheduleBlockIds).toEqual(['b1', 'b2'])
  })

  it('talent: respects talent_call kind (no -15min offset)', () => {
    const snap = personalizeRecipient(
      { id: 'r1', kind: 'talent', talentId: 't3', projectMemberId: null, callTimeOverride: null },
      baseCtx,
    )
    expect(snap.callTime).toBe('07:45')
  })

  it('talent: falls back to generalCallTime when no blocks', () => {
    const snap = personalizeRecipient(
      { id: 'r1', kind: 'talent', talentId: 'tX', projectMemberId: null, callTimeOverride: null },
      baseCtx,
    )
    expect(snap.callTime).toBe('07:30')
  })

  it('crew: uses crewCallTime', () => {
    const snap = personalizeRecipient(
      { id: 'r1', kind: 'crew', talentId: null, projectMemberId: 'm1', callTimeOverride: null },
      baseCtx,
    )
    expect(snap.callTime).toBe('07:00')
  })

  it('override always wins', () => {
    const snap = personalizeRecipient(
      { id: 'r1', kind: 'talent', talentId: 't1', projectMemberId: null, callTimeOverride: '06:00' },
      baseCtx,
    )
    expect(snap.callTime).toBe('06:00')
  })
})
