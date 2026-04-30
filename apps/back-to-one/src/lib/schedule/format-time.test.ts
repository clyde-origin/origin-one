import { describe, it, expect } from 'vitest'
import { formatTime, parseTime, addMinutesToTime, compareTime, minutesBetween } from './format-time'

describe('parseTime', () => {
  it('parses HH:MM', () => {
    expect(parseTime('09:30')).toEqual({ h: 9, m: 30 })
    expect(parseTime('00:00')).toEqual({ h: 0, m: 0 })
    expect(parseTime('23:59')).toEqual({ h: 23, m: 59 })
  })
  it('rejects invalid', () => {
    expect(parseTime('25:00')).toBeNull()
    expect(parseTime('bad')).toBeNull()
    expect(parseTime('')).toBeNull()
  })
})

describe('formatTime', () => {
  it('formats AM', () => {
    expect(formatTime('07:15')).toBe('7:15am')
    expect(formatTime('11:59')).toBe('11:59am')
  })
  it('formats noon and midnight', () => {
    expect(formatTime('12:00')).toBe('12:00pm')
    expect(formatTime('00:00')).toBe('12:00am')
  })
  it('formats PM', () => {
    expect(formatTime('13:30')).toBe('1:30pm')
    expect(formatTime('19:45')).toBe('7:45pm')
  })
  it('handles null/empty', () => {
    expect(formatTime(null)).toBe('')
    expect(formatTime('')).toBe('')
  })
})

describe('addMinutesToTime', () => {
  it('subtracts within the day', () => {
    expect(addMinutesToTime('09:30', -15)).toBe('09:15')
    expect(addMinutesToTime('10:00', -30)).toBe('09:30')
  })
  it('wraps when negative crosses midnight', () => {
    expect(addMinutesToTime('00:10', -15)).toBe('23:55')
  })
  it('adds across hour and day', () => {
    expect(addMinutesToTime('09:50', 15)).toBe('10:05')
    expect(addMinutesToTime('23:50', 20)).toBe('00:10')
  })
})

describe('compareTime', () => {
  it('orders strings numerically', () => {
    expect(compareTime('09:30', '10:00')).toBeLessThan(0)
    expect(compareTime('10:00', '09:30')).toBeGreaterThan(0)
    expect(compareTime('09:30', '09:30')).toBe(0)
  })
})

describe('minutesBetween', () => {
  it('computes positive durations', () => {
    expect(minutesBetween('09:30', '09:45')).toBe(15)
    expect(minutesBetween('11:45', '13:00')).toBe(75)
  })
  it('returns null for invalid', () => {
    expect(minutesBetween('bad', '09:00')).toBeNull()
  })
})
