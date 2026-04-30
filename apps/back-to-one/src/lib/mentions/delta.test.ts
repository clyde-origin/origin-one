import { describe, it, expect } from 'vitest'
import { computeMentionDelta } from './delta'

describe('computeMentionDelta', () => {
  it('returns all new mentions when no prior notifications', () => {
    expect(computeMentionDelta({
      newMentions: ['u1', 'u2'],
      alreadyNotified: [],
      actorId: 'me',
    })).toEqual(['u1', 'u2'])
  })
  it('skips already-notified users', () => {
    expect(computeMentionDelta({
      newMentions: ['u1', 'u2'],
      alreadyNotified: ['u1'],
      actorId: 'me',
    })).toEqual(['u2'])
  })
  it('skips self-mentions', () => {
    expect(computeMentionDelta({
      newMentions: ['me', 'u1'],
      alreadyNotified: [],
      actorId: 'me',
    })).toEqual(['u1'])
  })
  it('dedupes within newMentions', () => {
    expect(computeMentionDelta({
      newMentions: ['u1', 'u1', 'u2'],
      alreadyNotified: [],
      actorId: 'me',
    })).toEqual(['u1', 'u2'])
  })
  it('preserves first-seen order', () => {
    expect(computeMentionDelta({
      newMentions: ['u3', 'u1', 'u2'],
      alreadyNotified: [],
      actorId: 'me',
    })).toEqual(['u3', 'u1', 'u2'])
  })
})
