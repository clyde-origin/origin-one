import { describe, it, expect } from 'vitest'
import { snapshotsDiffer, findOutdatedDeliveryIds } from './detect-outdated'

const base = {
  callTime: '08:00',
  locationAddress: '123 Main St',
  shootDate: '2026-04-22',
  scheduleBlockIds: ['b1', 'b2'],
  lunchTime: '13:30',
}

describe('snapshotsDiffer', () => {
  it('null prior returns false (no delta computable)', () => {
    expect(snapshotsDiffer(null, base)).toBe(false)
  })
  it('identical returns false', () => {
    expect(snapshotsDiffer({ ...base }, { ...base })).toBe(false)
  })
  it('callTime change returns true', () => {
    expect(snapshotsDiffer({ ...base, callTime: '07:30' }, base)).toBe(true)
  })
  it('locationAddress change returns true', () => {
    expect(snapshotsDiffer({ ...base, locationAddress: '999 Other St' }, base)).toBe(true)
  })
  it('shootDate change returns true', () => {
    expect(snapshotsDiffer({ ...base, shootDate: '2026-05-01' }, base)).toBe(true)
  })
  it('lunchTime change returns true', () => {
    expect(snapshotsDiffer({ ...base, lunchTime: '14:00' }, base)).toBe(true)
  })
  it('scheduleBlockIds size change returns true', () => {
    expect(snapshotsDiffer({ ...base, scheduleBlockIds: ['b1'] }, base)).toBe(true)
  })
  it('scheduleBlockIds order-independent', () => {
    expect(snapshotsDiffer({ ...base, scheduleBlockIds: ['b2', 'b1'] }, base)).toBe(false)
  })
  it('different block IDs returns true', () => {
    expect(snapshotsDiffer({ ...base, scheduleBlockIds: ['b1', 'b3'] }, base)).toBe(true)
  })
})

describe('findOutdatedDeliveryIds', () => {
  it('returns ids whose snapshot has changed', () => {
    const result = findOutdatedDeliveryIds({
      deliveries: [
        { id: 'd1', recipientId: 'r1', personalizedSnapshot: { ...base } },
        { id: 'd2', recipientId: 'r2', personalizedSnapshot: { ...base, callTime: '07:00' } },
        { id: 'd3', recipientId: 'r3', personalizedSnapshot: null },
      ],
      freshSnapshotsByRecipient: {
        r1: { ...base, callTime: '08:30' },     // d1 changed
        r2: { ...base, callTime: '07:00' },     // d2 unchanged
        r3: { ...base },                        // d3 unchanged (null prior)
      },
    })
    expect(result).toEqual(['d1'])
  })

  it('skips deliveries with no fresh snapshot for their recipient', () => {
    const result = findOutdatedDeliveryIds({
      deliveries: [{ id: 'd1', recipientId: 'rGone', personalizedSnapshot: { ...base } }],
      freshSnapshotsByRecipient: {},
    })
    expect(result).toEqual([])
  })
})
