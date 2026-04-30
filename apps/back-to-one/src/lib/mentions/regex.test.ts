import { describe, it, expect } from 'vitest'
import { findMentionAtCursor, tokenizeMentions } from './regex'

describe('findMentionAtCursor', () => {
  it('returns null when cursor not in a mention', () => {
    expect(findMentionAtCursor('hello world', 5)).toBeNull()
  })
  it('returns empty query for bare @ at end', () => {
    expect(findMentionAtCursor('hello @', 7)).toBe('')
  })
  it('returns partial query', () => {
    expect(findMentionAtCursor('hello @Sa', 9)).toBe('Sa')
  })
  it('handles names with apostrophes and spaces', () => {
    expect(findMentionAtCursor("hi @O'Brien Sm", 14)).toBe("O'Brien Sm")
  })
  it('returns null when @ is preceded by alphanumeric (email-like)', () => {
    expect(findMentionAtCursor('foo@bar', 7)).toBeNull()
  })
  it('only triggers at the active cursor, not earlier @ tokens', () => {
    expect(findMentionAtCursor('@Sarah hello @Bo', 16)).toBe('Bo')
  })
  it('returns null if cursor is inside text after a complete mention', () => {
    expect(findMentionAtCursor('@Sarah hello', 12)).toBeNull()
  })
})

describe('tokenizeMentions', () => {
  it('returns empty for plain text', () => {
    expect(tokenizeMentions('hello world')).toEqual([])
  })
  it('extracts a single mention', () => {
    expect(tokenizeMentions('hi @Sarah!')).toEqual([
      { start: 3, end: 9, name: 'Sarah' },
    ])
  })
  it('extracts multiple mentions in order', () => {
    const tokens = tokenizeMentions('@Sarah and @Tom met')
    expect(tokens).toHaveLength(2)
    expect(tokens[0].name).toBe('Sarah')
    expect(tokens[1].name).toBe('Tom')
  })
  it('handles multi-word names', () => {
    expect(tokenizeMentions("hi @O'Brien Smith done")).toEqual([
      { start: 3, end: 18, name: "O'Brien Smith" },
    ])
  })
  it('does not match emails', () => {
    expect(tokenizeMentions('foo@bar.com hi')).toEqual([])
  })
})
