import { describe, it, expect } from 'vitest'
import { onboardRequestSchema, isAdminEmail } from './onboard-validation'

describe('onboardRequestSchema', () => {
  const valid = {
    companyName: 'THNK Elephant',
    projectName: 'Office Pool',
    producers: [
      { name: 'Chris Loanzon', email: 'a.chrisdelas@gmail.com' },
      { name: 'Eileen Soong', email: 'eileen.s.soong@gmail.com' },
    ],
  }

  it('accepts a valid payload', () => {
    expect(onboardRequestSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects empty company name', () => {
    const r = onboardRequestSchema.safeParse({ ...valid, companyName: '' })
    expect(r.success).toBe(false)
  })

  it('rejects company name over 80 chars', () => {
    const r = onboardRequestSchema.safeParse({ ...valid, companyName: 'A'.repeat(81) })
    expect(r.success).toBe(false)
  })

  it('rejects empty project name', () => {
    const r = onboardRequestSchema.safeParse({ ...valid, projectName: '' })
    expect(r.success).toBe(false)
  })

  it('rejects when producers array is empty', () => {
    const r = onboardRequestSchema.safeParse({ ...valid, producers: [] })
    expect(r.success).toBe(false)
  })

  it('rejects invalid email in producer row', () => {
    const r = onboardRequestSchema.safeParse({
      ...valid,
      producers: [{ name: 'Chris', email: 'not-an-email' }],
    })
    expect(r.success).toBe(false)
  })

  it('rejects empty producer name', () => {
    const r = onboardRequestSchema.safeParse({
      ...valid,
      producers: [{ name: '', email: 'ok@example.com' }],
    })
    expect(r.success).toBe(false)
  })

  it('trims whitespace on names and emails', () => {
    const r = onboardRequestSchema.parse({
      companyName: '  THNK Elephant  ',
      projectName: '  Office Pool  ',
      producers: [{ name: '  Chris  ', email: '  a@b.com  ' }],
    })
    expect(r.companyName).toBe('THNK Elephant')
    expect(r.projectName).toBe('Office Pool')
    expect(r.producers[0]).toEqual({ name: 'Chris', email: 'a@b.com' })
  })
})

describe('isAdminEmail', () => {
  it('returns true for an exact match in the allowlist', () => {
    expect(isAdminEmail('clyde@originpoint.io', 'clyde@originpoint.io')).toBe(true)
  })

  it('returns true when allowlist has multiple entries', () => {
    expect(isAdminEmail('tyler@originpoint.io', 'clyde@originpoint.io,tyler@originpoint.io')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isAdminEmail('Clyde@Originpoint.IO', 'clyde@originpoint.io')).toBe(true)
  })

  it('handles whitespace around entries', () => {
    expect(isAdminEmail('clyde@originpoint.io', ' clyde@originpoint.io , tyler@originpoint.io ')).toBe(true)
  })

  it('returns false when email not in allowlist', () => {
    expect(isAdminEmail('intruder@example.com', 'clyde@originpoint.io')).toBe(false)
  })

  it('returns false when allowlist is empty or undefined', () => {
    expect(isAdminEmail('clyde@originpoint.io', '')).toBe(false)
    expect(isAdminEmail('clyde@originpoint.io', undefined)).toBe(false)
  })

  it('returns false when email is empty', () => {
    expect(isAdminEmail('', 'clyde@originpoint.io')).toBe(false)
  })
})
