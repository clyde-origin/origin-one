import { describe, it, expect } from 'vitest'
import { buildDefaultRecipients } from './seed-recipients'

describe('buildDefaultRecipients', () => {
  it('includes all talent', () => {
    const rows = buildDefaultRecipients({
      callSheetId: 'cs1',
      talent: [
        { id: 't1', email: 'a@x.com', phone: '555' },
        { id: 't2', email: null, phone: null },
      ],
      members: [],
    })
    expect(rows).toHaveLength(2)
    expect(rows.every(r => r.kind === 'talent')).toBe(true)
  })

  it('excludes post-only departments', () => {
    const rows = buildDefaultRecipients({
      callSheetId: 'cs1',
      talent: [],
      members: [
        { id: 'm1', department: 'Camera', email: 'c@x.com', phone: null },
        { id: 'm2', department: 'Editorial', email: 'e@x.com', phone: null },
        { id: 'm3', department: 'Sound Post', email: 's@x.com', phone: null },
        { id: 'm4', department: 'Production', email: 'p@x.com', phone: '555' },
      ],
    })
    expect(rows).toHaveLength(2)
    expect(rows.find(r => r.projectMemberId === 'm1')?.kind).toBe('crew')
    expect(rows.find(r => r.projectMemberId === 'm2')).toBeUndefined()
    expect(rows.find(r => r.projectMemberId === 'm3')).toBeUndefined()
    expect(rows.find(r => r.projectMemberId === 'm4')?.kind).toBe('crew')
  })

  it('flags clients as kind=client', () => {
    const rows = buildDefaultRecipients({
      callSheetId: 'cs1',
      talent: [],
      members: [
        { id: 'm1', department: 'Client', email: 'c@x.com', phone: null },
      ],
    })
    expect(rows[0].kind).toBe('client')
  })

  it('sendEmail/sendSms gated on contact info', () => {
    const rows = buildDefaultRecipients({
      callSheetId: 'cs1',
      talent: [
        { id: 't1', email: 'a@x.com', phone: null },
        { id: 't2', email: null, phone: '555' },
      ],
      members: [],
    })
    expect(rows[0].sendEmail).toBe(true)
    expect(rows[0].sendSms).toBe(false)
    expect(rows[1].sendEmail).toBe(false)
    expect(rows[1].sendSms).toBe(true)
  })
})
