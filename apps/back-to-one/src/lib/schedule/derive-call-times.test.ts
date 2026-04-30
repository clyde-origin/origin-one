import { describe, it, expect } from 'vitest'
import { deriveCallTimes } from './derive-call-times'

const blocks = [
  { startTime: '09:30', talentIds: ['t1'], kind: 'work' as const },
  { startTime: '11:00', talentIds: ['t1', 't2'], kind: 'work' as const },
  { startTime: '08:00', talentIds: ['t3'], kind: 'work' as const },
]

describe('deriveCallTimes', () => {
  it('returns earliest block startTime - 15 min per talent', () => {
    const result = deriveCallTimes(blocks, ['t1', 't2', 't3'])
    expect(result.t1).toBe('09:15')
    expect(result.t2).toBe('10:45')
    expect(result.t3).toBe('07:45')
  })
  it('omits talents with no blocks', () => {
    const result = deriveCallTimes(blocks, ['t1', 'tX'])
    expect(result.t1).toBe('09:15')
    expect(result.tX).toBeUndefined()
  })
  it('respects explicit talent_call kind blocks (no -15 offset)', () => {
    const tcBlocks = [
      { startTime: '08:00', talentIds: ['t1'], kind: 'talent_call' as const },
      { startTime: '09:30', talentIds: ['t1'], kind: 'work' as const },
    ]
    const result = deriveCallTimes(tcBlocks, ['t1'])
    expect(result.t1).toBe('08:00')
  })
})
