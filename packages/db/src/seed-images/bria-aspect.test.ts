import { describe, it, expect } from 'vitest'
import { briaAspect } from './bria-aspect'

describe('briaAspect', () => {
  it('passes through Bria-native ratios with no crop', () => {
    expect(briaAspect('16:9')).toEqual({ request: '16:9', cropTo: null })
    expect(briaAspect('9:16')).toEqual({ request: '9:16', cropTo: null })
    expect(briaAspect('1:1')).toEqual({ request: '1:1', cropTo: null })
    expect(briaAspect('4:5')).toEqual({ request: '4:5', cropTo: null })
    expect(briaAspect('3:2')).toEqual({ request: '3:2', cropTo: null })
  })

  it('requests 16:9 and crops for 2.39:1', () => {
    expect(briaAspect('2.39:1')).toEqual({ request: '16:9', cropTo: '2.39:1' })
  })

  it('requests 16:9 and crops for 1.85:1', () => {
    expect(briaAspect('1.85:1')).toEqual({ request: '16:9', cropTo: '1.85:1' })
  })

  it('defaults to 16:9 with no crop for null/undefined/empty', () => {
    expect(briaAspect(null)).toEqual({ request: '16:9', cropTo: null })
    expect(briaAspect(undefined)).toEqual({ request: '16:9', cropTo: null })
    expect(briaAspect('')).toEqual({ request: '16:9', cropTo: null })
  })

  it('defaults to 16:9 for unrecognized ratios', () => {
    expect(briaAspect('garbage')).toEqual({ request: '16:9', cropTo: null })
    expect(briaAspect('5:7')).toEqual({ request: '16:9', cropTo: null })
  })
})
