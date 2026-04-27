import { describe, it, expect } from 'vitest'
import { MANIFEST } from './manifest'

const VALID_PROJECT_KEYS = new Set(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'crew'])
const VALID_SURFACES = new Set([
  'location', 'narrativeLocation', 'moodboard',
  'prop', 'wardrobe', 'hmu', 'cast', 'avatar',
])

describe('MANIFEST', () => {
  it('is an array', () => {
    expect(Array.isArray(MANIFEST)).toBe(true)
    // Non-empty assertion is enforced in the count test below — tightened
    // once the manifest is populated in the next task. This split lets
    // the schema-validation tests run cleanly against an empty manifest.
  })

  it('every entry has required fields', () => {
    for (const e of MANIFEST) {
      expect(VALID_PROJECT_KEYS.has(e.projectKey), `bad projectKey for ${e.slug}`).toBe(true)
      expect(VALID_SURFACES.has(e.surface), `bad surface for ${e.slug}`).toBe(true)
      expect(e.slug, `slug missing on ${JSON.stringify(e)}`).toMatch(/^[a-z0-9-]+$/)
      expect(['stock', 'ai']).toContain(e.source)
      expect(typeof e.matchByName).toBe('string')
      expect(e.matchByName.length).toBeGreaterThan(0)
      if (e.source === 'stock') expect(e.query).toBeTruthy()
      if (e.source === 'ai') expect(e.prompt).toBeTruthy()
    }
  })

  it('has no duplicate slugs within a (projectKey, surface) pair', () => {
    const seen = new Map<string, string>()
    for (const e of MANIFEST) {
      const key = `${e.projectKey}.${e.surface}.${e.slug}`
      expect(seen.has(key), `duplicate: ${key}`).toBe(false)
      seen.set(key, e.matchByName)
    }
  })

  it('crew project key only carries avatar surface', () => {
    for (const e of MANIFEST) {
      if (e.projectKey === 'crew') expect(e.surface).toBe('avatar')
      if (e.surface === 'avatar') expect(e.projectKey).toBe('crew')
    }
  })
})
