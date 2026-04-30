// Helpers for HH:MM 24h time strings used by ScheduleBlock + CallSheet
// derived call times. ShootDay.date is the date scope; these are tod-of-day.

export function parseTime(t: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(t)
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return { h, m }
}

export function formatTime(t: string | null | undefined): string {
  if (!t) return ''
  const parsed = parseTime(t)
  if (!parsed) return t
  const { h, m } = parsed
  const period = h >= 12 ? 'pm' : 'am'
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${display}:${String(m).padStart(2, '0')}${period}`
}

export function formatTimeRange(start: string | null | undefined, end: string | null | undefined): string {
  const a = formatTime(start ?? null)
  const b = formatTime(end ?? null)
  if (a && b) return `${a}–${b}`
  return a || b
}

export function addMinutesToTime(t: string, deltaMin: number): string {
  const parsed = parseTime(t)
  if (!parsed) return t
  const total = (parsed.h * 60 + parsed.m + deltaMin) % (24 * 60)
  const wrapped = total < 0 ? total + 24 * 60 : total
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function compareTime(a: string, b: string): number {
  const pa = parseTime(a)
  const pb = parseTime(b)
  if (!pa && !pb) return 0
  if (!pa) return 1
  if (!pb) return -1
  return (pa.h * 60 + pa.m) - (pb.h * 60 + pb.m)
}

export function minutesBetween(a: string, b: string): number | null {
  const pa = parseTime(a)
  const pb = parseTime(b)
  if (!pa || !pb) return null
  return (pb.h * 60 + pb.m) - (pa.h * 60 + pa.m)
}
