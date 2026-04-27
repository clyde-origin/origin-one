import { describe, it, expect } from 'vitest'
import { parseOnly, matchesOnly } from './filter'
import type { ImageEntry } from './paths'

const e = (over: Partial<ImageEntry> = {}): ImageEntry => ({
  projectKey: 'p1',
  surface: 'cast',
  slug: 'camille-rousseau',
  source: 'ai',
  matchByName: 'Camille Rousseau',
  ...over,
})

describe('parseOnly', () => {
  it('returns null for undefined', () => {
    expect(parseOnly(undefined)).toBeNull()
  })

  it('parses project-only filter', () => {
    expect(parseOnly('p1')).toEqual({ projectKey: 'p1' })
  })

  it('parses project + surface filter', () => {
    expect(parseOnly('p1.cast')).toEqual({ projectKey: 'p1', surface: 'cast' })
  })

  it('parses full filter', () => {
    expect(parseOnly('p1.cast.camille-rousseau')).toEqual({
      projectKey: 'p1', surface: 'cast', slug: 'camille-rousseau',
    })
  })

  it('throws on invalid project key', () => {
    expect(() => parseOnly('p9')).toThrow(/projectKey/)
  })

  it('throws on invalid surface', () => {
    expect(() => parseOnly('p1.bogus')).toThrow(/surface/)
  })
})

describe('matchesOnly', () => {
  it('matches everything when filter is null', () => {
    expect(matchesOnly(e(), null)).toBe(true)
  })

  it('matches by project', () => {
    expect(matchesOnly(e(), { projectKey: 'p1' })).toBe(true)
    expect(matchesOnly(e({ projectKey: 'p2' }), { projectKey: 'p1' })).toBe(false)
  })

  it('matches by project + surface', () => {
    expect(matchesOnly(e(), { projectKey: 'p1', surface: 'cast' })).toBe(true)
    expect(matchesOnly(e({ surface: 'prop' }), { projectKey: 'p1', surface: 'cast' })).toBe(false)
  })

  it('matches by full triple', () => {
    expect(matchesOnly(e(), { projectKey: 'p1', surface: 'cast', slug: 'camille-rousseau' })).toBe(true)
    expect(matchesOnly(e({ slug: 'other' }), { projectKey: 'p1', surface: 'cast', slug: 'camille-rousseau' })).toBe(false)
  })
})
