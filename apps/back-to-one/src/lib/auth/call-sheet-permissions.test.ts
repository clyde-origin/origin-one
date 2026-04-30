import { describe, it, expect } from 'vitest'
import { canEditCallSheet, isPostOnlyDepartment } from './call-sheet-permissions'

describe('canEditCallSheet', () => {
  it('owner + producer always pass', () => {
    expect(canEditCallSheet('owner', null)).toBe(true)
    expect(canEditCallSheet('producer', null)).toBe(true)
  })
  it('crew in Production passes (case-insensitive)', () => {
    expect(canEditCallSheet('crew', { department: 'Production' })).toBe(true)
    expect(canEditCallSheet('crew', { department: 'production' })).toBe(true)
  })
  it('crew in other depts fails', () => {
    expect(canEditCallSheet('crew', { department: 'Camera' })).toBe(false)
    expect(canEditCallSheet('crew', { department: null })).toBe(false)
  })
  it('null viewer fails', () => {
    expect(canEditCallSheet(null, { department: 'Production' })).toBe(false)
  })
})

describe('isPostOnlyDepartment', () => {
  it('matches the post list', () => {
    expect(isPostOnlyDepartment('Editorial')).toBe(true)
    expect(isPostOnlyDepartment('Color')).toBe(true)
    expect(isPostOnlyDepartment('Sound Post')).toBe(true)
    expect(isPostOnlyDepartment('VFX')).toBe(true)
    expect(isPostOnlyDepartment('Motion Graphics')).toBe(true)
  })
  it('case-insensitive', () => {
    expect(isPostOnlyDepartment('editorial')).toBe(true)
    expect(isPostOnlyDepartment('SOUND POST')).toBe(true)
  })
  it('returns false for non-post', () => {
    expect(isPostOnlyDepartment('Camera')).toBe(false)
    expect(isPostOnlyDepartment('Production')).toBe(false)
    expect(isPostOnlyDepartment(null)).toBe(false)
    expect(isPostOnlyDepartment('')).toBe(false)
  })
})
