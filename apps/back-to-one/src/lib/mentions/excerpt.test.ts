import { describe, it, expect } from 'vitest'
import { buildExcerpt } from './excerpt'

describe('buildExcerpt', () => {
  it('returns the text untouched when shorter than 140', () => {
    expect(buildExcerpt('hello world')).toBe('hello world')
  })
  it('returns the text untouched when exactly 140', () => {
    const t = 'a'.repeat(140)
    expect(buildExcerpt(t)).toBe(t)
  })
  it('truncates at the nearest preceding space and adds ellipsis', () => {
    const t = 'word '.repeat(40) // 200 chars, words boundary every 5
    const out = buildExcerpt(t)
    expect(out.length).toBeLessThanOrEqual(141)
    expect(out.endsWith('…')).toBe(true)
    expect(out).not.toMatch(/wo…$/)
  })
  it('falls back to a hard cut when no word boundary in window', () => {
    const t = 'a'.repeat(200)
    const out = buildExcerpt(t)
    expect(out.length).toBe(141)
    expect(out.endsWith('…')).toBe(true)
  })
  it('collapses internal whitespace and trims', () => {
    expect(buildExcerpt('  hello\n\nworld  ')).toBe('hello world')
  })
})
