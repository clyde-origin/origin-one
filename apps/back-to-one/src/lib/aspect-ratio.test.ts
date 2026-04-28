import { describe, it, expect } from 'vitest'
import { aspectRatioToCss } from './aspect-ratio'

describe('aspectRatioToCss', () => {
  it('returns 16 / 9 default for null', () => {
    expect(aspectRatioToCss(null)).toBe('16 / 9')
  })

  it('returns 16 / 9 default for undefined', () => {
    expect(aspectRatioToCss(undefined)).toBe('16 / 9')
  })

  it('returns 16 / 9 default for empty string', () => {
    expect(aspectRatioToCss('')).toBe('16 / 9')
  })

  it('converts simple ratios', () => {
    expect(aspectRatioToCss('16:9')).toBe('16 / 9')
    expect(aspectRatioToCss('9:16')).toBe('9 / 16')
    expect(aspectRatioToCss('1:1')).toBe('1 / 1')
    expect(aspectRatioToCss('4:5')).toBe('4 / 5')
    expect(aspectRatioToCss('3:2')).toBe('3 / 2')
  })

  it('converts decimal ratios', () => {
    expect(aspectRatioToCss('2.39:1')).toBe('2.39 / 1')
    expect(aspectRatioToCss('1.85:1')).toBe('1.85 / 1')
  })

  it('returns 16 / 9 default for malformed input', () => {
    expect(aspectRatioToCss('garbage')).toBe('16 / 9')
    expect(aspectRatioToCss('1:')).toBe('16 / 9')
    expect(aspectRatioToCss(':1')).toBe('16 / 9')
  })
})
