'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import {
  useCrew, useRemoveCrewMember, useUpdateCrewMember,
  useCrewTimecardsByWeek,
  useCreateTimecard, useUpdateTimecard, useSubmitTimecard, useApproveTimecard, useReopenTimecard,
} from '@/lib/hooks/useOriginOne'
import { useProject } from '@/lib/hooks/useOriginOne'
import { CrewAvatar } from '@/components/ui'
import { haptic } from '@/lib/utils/haptics'
import { DEPARTMENTS } from '@/lib/utils/phase'
import type { TeamMember } from '@/types'

const spring = { type: 'spring' as const, stiffness: 400, damping: 40 }

// ── Timecards affordances — buttons only (click handlers are stubbed until
// the Timecards surface lands). Color defaults to text-secondary, shifts to
// project accent on hover. ──────────────────────────────────────────────────

function TimecardsLabelButton({ accent, onClick }: { accent: string; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="font-mono uppercase active:opacity-60"
      style={{
        fontSize: 11,
        letterSpacing: '0.08em',
        color: hover ? accent : '#a0a0b8',
        background: 'transparent',
        border: 'none',
        padding: '6px 8px',
        cursor: 'pointer',
        transition: 'color 0.12s',
      }}
    >
      Timecards
    </button>
  )
}

function TimecardsIconButton({ accent, onClick }: { accent: string; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  const color = hover ? accent : '#a0a0b8'
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label="Timecards"
      className="flex items-center justify-center w-11 h-11 active:opacity-60"
      style={{ background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color 0.12s' }}
    >
      {/* Clock icon — 20px, stroke follows hover state */}
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="7.5" stroke={color} strokeWidth="1.5" />
        <path d="M10 5.5V10l3 2" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

/** Get the department string from a crew member (field exists on ProjectMember but not yet on the TS type) */
function getMemberDepartment(member: TeamMember): string | null {
  return (member as TeamMember & { department?: string | null }).department ?? null
}

/** Group crew by department in fixed display order, nulls last */
function groupByDepartment(crew: TeamMember[]): { department: string | null; members: TeamMember[] }[] {
  const groups: Record<string, TeamMember[]> = {}
  const nullGroup: TeamMember[] = []

  for (const m of crew) {
    const dept = getMemberDepartment(m)
    if (dept === null) {
      nullGroup.push(m)
    } else {
      if (!groups[dept]) groups[dept] = []
      groups[dept].push(m)
    }
  }

  // Sort members within each group alphabetically by name
  const sortMembers = (arr: TeamMember[]) => arr.sort((a: TeamMember, b: TeamMember) => a.User.name.localeCompare(b.User.name))
  Object.keys(groups).forEach(k => sortMembers(groups[k]))
  sortMembers(nullGroup)

  // Build ordered result: known departments first (in fixed order), then extras, then null
  const result: { department: string | null; members: TeamMember[] }[] = []
  const seen = new Set<string>()

  for (const dept of DEPARTMENTS) {
    if (groups[dept]) { result.push({ department: dept, members: groups[dept] }); seen.add(dept) }
  }

  // Any departments not in the fixed order (future-proofing)
  Object.keys(groups).forEach(dept => {
    if (!seen.has(dept)) result.push({ department: dept, members: groups[dept] })
  })

  // Null department last
  if (nullGroup.length > 0) result.push({ department: null, members: nullGroup })

  return result
}

// ── LAYER 2A: CREW MEMBER DETAIL ─────────────────────────

function CrewDetail({ member, accent, projectId, onBack, onRemoved, onTimecards }: {
  member: TeamMember; accent: string; projectId: string
  onBack: () => void; onRemoved: () => void; onTimecards: () => void
}) {
  const update = useUpdateCrewMember(projectId)
  const remove = useRemoveCrewMember(projectId)
  const [showConfirm, setShowConfirm] = useState(false)
  const [role, setRole] = useState<string>(member.role)

  const saveRole = () => {
    update.mutate({ id: member.id, fields: { role } })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center px-5 pt-4 pb-3 gap-3 flex-shrink-0">
        <button onClick={onBack} className="flex items-center justify-center w-11 h-11 -ml-2 active:opacity-60">
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div className="flex-1" />
        <TimecardsIconButton
          accent={accent}
          onClick={() => { haptic('light'); onTimecards() }}
        />
      </div>

      {/* Profile */}
      <div className="flex flex-col items-center px-5 pb-5 flex-shrink-0">
        <CrewAvatar name={member.User.name} size={56} />
        <div className="mt-3 text-center">
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#dddde8' }}>{member.User.name}</div>
          <div className="text-text2 mt-0.5" style={{ fontSize: '0.82rem' }}>{member.User.email}</div>
        </div>
      </div>

      {/* Role field */}
      <div className="flex-1 overflow-y-auto px-5" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 14 }}>
          <div className="font-mono uppercase" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Role</div>
          <input
            type="text"
            value={role}
            onChange={e => setRole(e.target.value)}
            onBlur={saveRole}
            autoComplete="off"
            spellCheck={false}
            className="w-full outline-none focus:border-white/20"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7, padding: '10px 12px', color: '#dddde8', fontSize: '0.82rem' }}
          />
        </div>
      </div>

      {/* Remove */}
      <div className="flex-shrink-0 px-5 pb-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        {!showConfirm ? (
          <button onClick={() => { haptic('light'); setShowConfirm(true) }}
            className="w-full py-3 text-center active:opacity-60" style={{ fontSize: '0.82rem', color: '#e8564a' }}>
            Remove from project
          </button>
        ) : (
          <div className="py-3">
            <p className="text-center mb-3" style={{ fontSize: '0.78rem', color: '#dddde8' }}>
              Remove {member.User.name} from this project?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 rounded-lg font-semibold active:opacity-80"
                style={{ fontSize: '0.78rem', background: 'rgba(255,255,255,0.06)', color: '#a0a0b8' }}>
                Cancel
              </button>
              <button onClick={() => { haptic('warning'); remove.mutate(member.id); onRemoved() }}
                className="flex-1 py-3 rounded-lg font-semibold active:opacity-80"
                style={{ fontSize: '0.78rem', background: 'rgba(232,86,74,0.12)', color: '#e8564a' }}>
                Remove
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── CREW CELL (avatar + name + role, horizontal grid) ───

function CrewCell({ member, onTap }: { member: TeamMember; onTap: () => void }) {
  return (
    <div
      className="flex flex-col items-center cursor-pointer active:opacity-70"
      style={{ width: 68, gap: 4 }}
      onClick={onTap}
    >
      <CrewAvatar name={member.User.name} size={42} />
      <div className="text-center w-full" style={{
        fontSize: '0.62rem', fontWeight: 500, color: '#dddde8', lineHeight: 1.25,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
        overflow: 'hidden', wordBreak: 'break-word' as const,
      }}>
        {member.User.name}
      </div>
      <div className="text-center w-full" style={{
        fontSize: '0.48rem', color: '#62627a', lineHeight: 1.2, marginTop: -1,
      }}>
        {member.role}
      </div>
    </div>
  )
}

// ── TIMECARDS: week math + status palette ────────────────

// Status semantic colors. Fixed — these are status-meaning, not project-derived.
const STATUS_DOT: Record<string, string> = {
  approved:  '#00b894',
  submitted: '#6470f3',
  draft:     '#62627a',
  reopened:  '#e8a020',
}
// Reopened cells get a tinted background for at-a-glance queue spotting.
const REOPENED_CELL_BG = 'rgba(232,160,32,0.12)'

// Status precedence when a day has multiple entries — prefer the one that
// most demands attention. (Seed today has no split-day entries; guard anyway.)
const STATUS_PRECEDENCE: Record<string, number> = {
  reopened: 4, draft: 3, submitted: 2, approved: 1,
}
function moreSevereStatus(a: string, b: string): string {
  return (STATUS_PRECEDENCE[b] ?? 0) > (STATUS_PRECEDENCE[a] ?? 0) ? b : a
}

const MONTHS_UPPER = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

// All date math in UTC. Timecard.date is @db.Date so only the calendar date
// matters; UTC avoids DST / local-offset bugs when navigating weeks.
function startOfWeekUTC(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = x.getUTCDay()            // 0=Sun … 6=Sat
  const deltaToMon = (day + 6) % 7     // days since Mon
  x.setUTCDate(x.getUTCDate() - deltaToMon)
  return x
}
function addDaysUTC(d: Date, n: number): Date {
  const x = new Date(d)
  x.setUTCDate(x.getUTCDate() + n)
  return x
}
function isoDay(d: Date): string {
  // YYYY-MM-DD, UTC.
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
function formatWeekLabel(start: Date, end: Date): string {
  return `${MONTHS_UPPER[start.getUTCMonth()]} ${start.getUTCDate()} – ${MONTHS_UPPER[end.getUTCMonth()]} ${end.getUTCDate()}`
}

const WEEKDAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

// ── Shared week-navigation bar ─────────────────────────────
// Back arrow + prev/next week pill. Used by both ProducerOverview and
// IndividualWeekView so their headers stay pixel-identical.

function WeekNavBar({
  weekStart, weekEnd, onBack, onPrevWeek, onNextWeek,
}: {
  weekStart: Date; weekEnd: Date
  onBack: () => void; onPrevWeek: () => void; onNextWeek: () => void
}) {
  return (
    <div className="flex items-center justify-between px-4 pt-3 pb-3 flex-shrink-0 gap-3">
      <button onClick={onBack} className="flex items-center justify-center w-11 h-11 -ml-2 active:opacity-60">
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <div
        className="flex items-center"
        style={{
          gap: 8,
          padding: '6px 10px',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8,
          fontFamily: "'Geist Mono', monospace",
          fontSize: 11,
          color: '#a0a0b8',
          letterSpacing: '0.04em',
        }}
      >
        <button
          onClick={() => { haptic('light'); onPrevWeek() }}
          aria-label="Previous week"
          style={{ background: 'transparent', border: 'none', color: '#62627a', cursor: 'pointer', padding: '0 2px' }}
        >‹</button>
        <span>{formatWeekLabel(weekStart, weekEnd)}</span>
        <button
          onClick={() => { haptic('light'); onNextWeek() }}
          aria-label="Next week"
          style={{ background: 'transparent', border: 'none', color: '#62627a', cursor: 'pointer', padding: '0 2px' }}
        >›</button>
      </div>
      <div style={{ width: 44 }} /> {/* spacer, balances the back button */}
    </div>
  )
}

// ── Status pill — reused by day cards ──────────────────────
function StatusPill({ status }: { status: string }) {
  const palette: Record<string, { bg: string; color: string; label: string; prefix?: string }> = {
    approved:  { bg: 'rgba(0,184,148,0.14)',   color: '#00b894', label: 'Approved' },
    submitted: { bg: 'rgba(100,112,243,0.14)', color: '#6470f3', label: 'Submitted' },
    draft:     { bg: 'rgba(98,98,122,0.18)',   color: '#a0a0b8', label: 'Draft' },
    reopened:  { bg: 'rgba(232,160,32,0.16)',  color: '#e8a020', label: 'Reopened', prefix: '⟲ ' },
  }
  const p = palette[status] ?? palette.draft
  return (
    <span
      className="font-mono uppercase"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 9,
        letterSpacing: '0.08em',
        background: p.bg,
        color: p.color,
      }}
    >
      {(p.prefix ?? '') + p.label}
    </span>
  )
}

// ── PRODUCER OVERVIEW (Frame A) ──────────────────────────

function ProducerOverview({
  crew, projectId, accent, onBack, onRowTap,
}: {
  crew: TeamMember[]
  projectId: string
  accent: string
  onBack: () => void
  onRowTap: (member: TeamMember) => void
}) {
  // Week anchored to today. setWeekStart moves by ±7 days.
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekUTC(new Date()))
  const weekEnd = useMemo(() => addDaysUTC(weekStart, 6), [weekStart])
  const weekStartISO = isoDay(weekStart)
  const weekEndISO   = isoDay(weekEnd)

  const { data: timecards } = useCrewTimecardsByWeek(projectId, weekStartISO, weekEndISO)

  // Eligibility filter — excludes Client + Other per seed spec. Inline;
  // this is the locked rule, not a reusable concept yet.
  const eligibleCrew = useMemo(() => {
    return crew.filter(m => {
      const dept = getMemberDepartment(m)
      return dept !== null && dept !== 'Client' && dept !== 'Other'
    })
  }, [crew])

  // Bucket timecards by (memberId, dayIndex 0..6). Multi-entry days (not
  // in current seed but allowed by schema): sum hours, keep most severe status.
  type Cell = { hours: number; status: string }
  const cellsByMember = useMemo(() => {
    const map = new Map<string, Map<number, Cell>>()
    const weekStartMs = weekStart.getTime()
    for (const t of (timecards ?? [])) {
      const row = t as { crewMemberId: string; date: string; hours: string | number; status: string }
      const dayMs = new Date(row.date).getTime()
      const dayIdx = Math.round((dayMs - weekStartMs) / (24 * 60 * 60 * 1000))
      if (dayIdx < 0 || dayIdx > 6) continue
      const hours = typeof row.hours === 'string' ? parseFloat(row.hours) : Number(row.hours)
      let byDay = map.get(row.crewMemberId)
      if (!byDay) { byDay = new Map<number, Cell>(); map.set(row.crewMemberId, byDay) }
      const existing = byDay.get(dayIdx)
      if (existing) {
        byDay.set(dayIdx, {
          hours: existing.hours + hours,
          status: moreSevereStatus(existing.status, row.status),
        })
      } else {
        byDay.set(dayIdx, { hours, status: row.status })
      }
    }
    return map
  }, [timecards, weekStart])

  const grouped = useMemo(() => groupByDepartment(eligibleCrew), [eligibleCrew])
  const eligibleCount = eligibleCrew.length

  // Is any day this week "today" in UTC? Highlight header column.
  const todayIdx = useMemo(() => {
    const today = new Date()
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
    const diffDays = Math.round((todayUTC.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000))
    return diffDays >= 0 && diffDays <= 6 ? diffDays : -1
  }, [weekStart])

  const formatHours = (h: number) => (Math.abs(h - Math.round(h)) < 0.05 ? h.toFixed(1) : h.toFixed(1))

  return (
    <div className="flex flex-col h-full">
      <WeekNavBar
        weekStart={weekStart}
        weekEnd={weekEnd}
        onBack={onBack}
        onPrevWeek={() => setWeekStart(addDaysUTC(weekStart, -7))}
        onNextWeek={() => setWeekStart(addDaysUTC(weekStart, 7))}
      />

      {/* Title block */}
      <div className="px-5 pb-4 flex-shrink-0">
        <div style={{ fontSize: 22, fontWeight: 600, color: '#fff', marginBottom: 4 }}>Timecards</div>
        <div className="font-mono uppercase" style={{ fontSize: 11, color: '#a0a0b8', letterSpacing: '0.06em' }}>
          {eligibleCount} crew
        </div>
      </div>

      {/* Grid — grouped by department */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{ WebkitOverflowScrolling: 'touch', padding: '0 16px 24px' }}>
        {grouped.map(({ department, members }) => (
          <div key={department ?? '__none'} style={{ marginBottom: 18 }}>
            <div
              className="font-mono uppercase"
              style={{
                fontSize: 10,
                letterSpacing: '0.12em',
                color: accent,
                padding: '8px 4px 6px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                marginBottom: 4,
              }}
            >
              {department ?? 'Untagged'}
            </div>
            {/* column header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr repeat(7, 28px)',
                gap: 4,
                padding: '6px 4px 4px',
                fontFamily: "'Geist Mono', monospace",
                fontSize: 9,
                color: '#62627a',
                letterSpacing: '0.1em',
              }}
            >
              <span />
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <span key={i} style={{ textAlign: 'center', color: i === todayIdx ? accent : undefined }}>
                  {d}
                </span>
              ))}
            </div>
            {/* crew rows */}
            {members.map(m => {
              const byDay = cellsByMember.get(m.id)
              return (
                <div
                  key={m.id}
                  onClick={() => { haptic('light'); onRowTap(m) }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr repeat(7, 28px)',
                    gap: 4,
                    alignItems: 'center',
                    padding: '9px 4px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                >
                  <div className="flex items-center gap-2" style={{ fontSize: 13, fontWeight: 500 }}>
                    <CrewAvatar name={m.User.name} size={22} />
                    <span style={{ color: '#dddde8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.User.name}
                    </span>
                  </div>
                  {[0, 1, 2, 3, 4, 5, 6].map(dayIdx => {
                    const cell = byDay?.get(dayIdx)
                    if (!cell) {
                      return (
                        <div
                          key={dayIdx}
                          style={{
                            textAlign: 'center',
                            fontFamily: "'Geist Mono', monospace",
                            fontSize: 10,
                            color: '#62627a',
                            padding: '3px 0',
                          }}
                        >—</div>
                      )
                    }
                    const dotColor = STATUS_DOT[cell.status] ?? '#62627a'
                    const isReopened = cell.status === 'reopened'
                    return (
                      <div
                        key={dayIdx}
                        style={{
                          textAlign: 'center',
                          fontFamily: "'Geist Mono', monospace",
                          fontSize: 10,
                          color: '#ffffff',
                          padding: '3px 0',
                          borderRadius: 4,
                          background: isReopened ? REOPENED_CELL_BG : undefined,
                        }}
                      >
                        {formatHours(cell.hours)}
                        <div
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            background: dotColor,
                            margin: '2px auto 0',
                          }}
                        />
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── INDIVIDUAL WEEK VIEW (Frame B) ────────────────────────
// Identity + week selector + 7 day-rows. Handles the full CRUD surface:
// crew logs/edits own entries, producer approves/reopens. "Viewer mode"
// switches on isProducerView from the caller (derived from the viewer
// identity shim on CrewPanel — see CURRENT_VIEWER note there).

function IndividualWeekView({
  member, projectId, accent, projectName, viewerMember, isProducerView, onBack,
}: {
  member: TeamMember
  projectId: string
  accent: string
  projectName: string
  viewerMember: TeamMember | null
  isProducerView: boolean
  onBack: () => void
}) {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekUTC(new Date()))
  const weekEnd = useMemo(() => addDaysUTC(weekStart, 6), [weekStart])
  const weekStartISO = isoDay(weekStart)
  const weekEndISO = isoDay(weekEnd)

  const { data: timecards } = useCrewTimecardsByWeek(projectId, weekStartISO, weekEndISO)

  // Mutations
  const createTc = useCreateTimecard(projectId)
  const updateTc = useUpdateTimecard(projectId)
  const submitTc = useSubmitTimecard(projectId)
  const approveTc = useApproveTimecard(projectId)
  const reopenTc = useReopenTimecard(projectId)

  // Inline-editor state. Only one of these is non-null at a time.
  const [addingForDayIdx, setAddingForDayIdx] = useState<number | null>(null)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [reopeningEntryId, setReopeningEntryId] = useState<string | null>(null)

  // Entries for this member within the selected week, bucketed by day index.
  // If a day has multiple entries (schema allows it), we render the first only
  // for now — the seed has no split-days. Flagged for follow-up if needed.
  type Entry = {
    id: string; date: string; hours: number; description: string; status: string
    submittedAt: string | null; approvedAt: string | null; approvedBy: string | null
    reopenedAt: string | null; reopenedBy: string | null; reopenReason: string | null
  }
  const entriesByDay = useMemo(() => {
    const map = new Map<number, Entry>()
    const weekStartMs = weekStart.getTime()
    for (const row of (timecards ?? []) as any[]) {
      if (row.crewMemberId !== member.id) continue
      const dayMs = new Date(row.date).getTime()
      const dayIdx = Math.round((dayMs - weekStartMs) / (24 * 60 * 60 * 1000))
      if (dayIdx < 0 || dayIdx > 6) continue
      if (map.has(dayIdx)) continue  // first-wins; split-day deferred
      map.set(dayIdx, {
        id: row.id,
        date: row.date,
        hours: typeof row.hours === 'string' ? parseFloat(row.hours) : Number(row.hours),
        description: row.description,
        status: row.status,
        submittedAt: row.submittedAt ?? null,
        approvedAt: row.approvedAt ?? null,
        approvedBy: row.approvedBy ?? null,
        reopenedAt: row.reopenedAt ?? null,
        reopenedBy: row.reopenedBy ?? null,
        reopenReason: row.reopenReason ?? null,
      })
    }
    return map
  }, [timecards, weekStart, member.id])

  const { totalHours, reopenedCount } = useMemo(() => {
    let total = 0, reopened = 0
    entriesByDay.forEach(e => { total += e.hours; if (e.status === 'reopened') reopened++ })
    return { totalHours: total, reopenedCount: reopened }
  }, [entriesByDay])

  const department = getMemberDepartment(member) ?? 'Crew'
  const avatarInitials = member.User.name.split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase()
  const formatHours = (h: number) => h.toFixed(1)

  // Used to render the reopener name in the reason block.
  const crewNameById = useMemo(() => {
    // Resolved via the parent-provided allCrew list on the outer CrewPanel;
    // we only have `member` here, so look-up is shallow. For a richer lookup
    // we'd need allCrew — acceptable for tonight since the only attribution
    // shown is on reopened entries and we don't have allCrew plumbed through.
    // Fallback: "Producer" when unresolved. Refined post-Auth.
    return (id: string | null): string => {
      if (!id) return 'Producer'
      if (id === viewerMember?.id) return viewerMember.User.name
      return 'Producer'
    }
  }, [viewerMember])

  // ── Day-level render helpers ──────────────────────────────

  const dayLabels = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDaysUTC(weekStart, i)
      return {
        weekday: WEEKDAY_LABELS[i],
        date: `${MONTHS_UPPER[d.getUTCMonth()]} ${d.getUTCDate()}`,
        iso: isoDay(d),
      }
    })
  }, [weekStart])

  return (
    <div className="flex flex-col h-full">
      <WeekNavBar
        weekStart={weekStart}
        weekEnd={weekEnd}
        onBack={onBack}
        onPrevWeek={() => setWeekStart(addDaysUTC(weekStart, -7))}
        onNextWeek={() => setWeekStart(addDaysUTC(weekStart, 7))}
      />

      {/* Identity block */}
      <div className="flex flex-col items-center px-5 pb-5 flex-shrink-0">
        <div
          className="font-mono"
          style={{
            width: 64, height: 64, borderRadius: '50%',
            border: `2px solid ${accent}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 600, color: accent,
            marginBottom: 14,
          }}
        >{avatarInitials}</div>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{member.User.name}</div>
        <div className="font-mono uppercase" style={{ fontSize: 11, color: '#a0a0b8', letterSpacing: '0.06em' }}>
          {department} · {projectName}
        </div>
      </div>

      {/* Week summary row */}
      <div
        className="flex items-center justify-between px-5 pb-2 flex-shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16, paddingBottom: 10 }}
      >
        <div className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.12em', color: '#62627a' }}>
          Week · {formatHours(totalHours)} h total
        </div>
        {reopenedCount > 0 && (
          <div className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.12em', color: '#e8a020' }}>
            {reopenedCount} reopened
          </div>
        )}
      </div>

      {/* Day rows (Mon–Sun) */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
        {dayLabels.map((label, dayIdx) => {
          const entry = entriesByDay.get(dayIdx)
          const isEditingThis = entry && editingEntryId === entry.id
          const isReopeningThis = entry && reopeningEntryId === entry.id
          const isAddingThis = !entry && addingForDayIdx === dayIdx
          const isEmpty = !entry && !isAddingThis

          return (
            <div
              key={dayIdx}
              className="flex items-start"
              style={{
                padding: '12px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                gap: 14,
              }}
            >
              <div
                className="font-mono uppercase"
                style={{ minWidth: 68, fontSize: 10, letterSpacing: '0.08em', color: '#62627a', paddingTop: 3 }}
              >
                <div>{label.weekday}</div>
                <div style={{ color: '#a0a0b8', marginTop: 2 }}>{label.date}</div>
              </div>
              <div style={{ flex: 1 }}>
                {isAddingThis ? (
                  <EntryEditor
                    key={`add-${dayIdx}`}
                    initialHours={''}
                    initialDescription={''}
                    accent={accent}
                    pending={createTc.isPending}
                    onCancel={() => setAddingForDayIdx(null)}
                    onSave={(hours, description) => {
                      createTc.mutate(
                        { projectId, crewMemberId: member.id, date: label.iso, hours, description },
                        { onSuccess: () => setAddingForDayIdx(null) },
                      )
                    }}
                  />
                ) : isEditingThis && entry ? (
                  <EntryEditor
                    key={`edit-${entry.id}`}
                    initialHours={entry.hours.toString()}
                    initialDescription={entry.description}
                    accent={accent}
                    pending={updateTc.isPending}
                    onCancel={() => setEditingEntryId(null)}
                    onSave={(hours, description) => {
                      updateTc.mutate(
                        { id: entry.id, fields: { hours, description } },
                        { onSuccess: () => setEditingEntryId(null) },
                      )
                    }}
                  />
                ) : entry ? (
                  <EntryCard
                    entry={entry}
                    accent={accent}
                    isProducerView={isProducerView}
                    reopenerName={crewNameById(entry.reopenedBy)}
                    isReopening={!!isReopeningThis}
                    onEdit={() => setEditingEntryId(entry.id)}
                    onSubmit={() => submitTc.mutate(entry.id)}
                    onApprove={() => {
                      if (!viewerMember) return
                      approveTc.mutate({ id: entry.id, approvedBy: viewerMember.id })
                    }}
                    onStartReopen={() => setReopeningEntryId(entry.id)}
                    onCancelReopen={() => setReopeningEntryId(null)}
                    onConfirmReopen={(reason) => {
                      if (!viewerMember) return
                      reopenTc.mutate(
                        { id: entry.id, reopenedBy: viewerMember.id, reopenReason: reason },
                        { onSuccess: () => setReopeningEntryId(null) },
                      )
                    }}
                    pending={submitTc.isPending || approveTc.isPending || reopenTc.isPending}
                  />
                ) : (
                  /* Empty day */
                  <div style={{ fontSize: 13, color: '#62627a', paddingTop: 3 }}>
                    {isProducerView ? (
                      <span style={{ fontStyle: 'italic' }}>—</span>
                    ) : (
                      <button
                        onClick={() => { haptic('light'); setAddingForDayIdx(dayIdx) }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: accent,
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >+ Add hours</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Inline entry editor (add or edit) ─────────────────────

function EntryEditor({
  initialHours, initialDescription, accent, pending, onSave, onCancel,
}: {
  initialHours: string
  initialDescription: string
  accent: string
  pending: boolean
  onSave: (hours: number, description: string) => void
  onCancel: () => void
}) {
  const [hoursStr, setHoursStr] = useState(initialHours)
  const [description, setDescription] = useState(initialDescription)
  const hoursNum = parseFloat(hoursStr)
  const canSave = !pending && Number.isFinite(hoursNum) && hoursNum > 0 && hoursNum <= 24 && description.trim().length > 0

  return (
    <div
      style={{
        padding: 10,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
      }}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          type="number"
          inputMode="decimal"
          step="0.25"
          min="0"
          max="24"
          placeholder="hrs"
          value={hoursStr}
          onChange={e => setHoursStr(e.target.value)}
          autoFocus
          style={{
            width: 72,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 6,
            padding: '8px 10px',
            color: '#fff',
            fontSize: 14,
            fontFamily: "'Geist Mono', monospace",
            outline: 'none',
          }}
        />
      </div>
      <textarea
        placeholder="What did you work on?"
        value={description}
        onChange={e => setDescription(e.target.value)}
        rows={2}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 6,
          padding: '8px 10px',
          color: '#dddde8',
          fontSize: 12,
          lineHeight: 1.55,
          outline: 'none',
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button
          onClick={onCancel}
          className="font-mono uppercase"
          style={{
            fontSize: 10, letterSpacing: '0.08em',
            padding: '6px 12px', borderRadius: 6,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
            color: '#a0a0b8', cursor: 'pointer',
          }}
        >Cancel</button>
        <button
          onClick={() => { if (canSave) onSave(hoursNum, description.trim()) }}
          disabled={!canSave}
          className="font-mono uppercase"
          style={{
            fontSize: 10, letterSpacing: '0.08em',
            padding: '6px 12px', borderRadius: 6,
            background: canSave ? `${accent}20` : 'rgba(255,255,255,0.04)',
            border: `1px solid ${canSave ? `${accent}60` : 'rgba(255,255,255,0.06)'}`,
            color: canSave ? accent : '#62627a',
            cursor: canSave ? 'pointer' : 'not-allowed',
          }}
        >Save</button>
      </div>
    </div>
  )
}

// ── Entry card (read + action buttons) ────────────────────

function EntryCard({
  entry, accent, isProducerView, reopenerName, isReopening,
  onEdit, onSubmit, onApprove, onStartReopen, onCancelReopen, onConfirmReopen, pending,
}: {
  entry: {
    id: string; hours: number; description: string; status: string; reopenReason: string | null
  }
  accent: string
  isProducerView: boolean
  reopenerName: string
  isReopening: boolean
  onEdit: () => void
  onSubmit: () => void
  onApprove: () => void
  onStartReopen: () => void
  onCancelReopen: () => void
  onConfirmReopen: (reason: string) => void
  pending: boolean
}) {
  const { status } = entry
  const isReopenedTinted = status === 'reopened'

  // Action-set by viewer × status
  const showEdit       = !isProducerView && (status === 'draft' || status === 'reopened')
  const showSubmit     = !isProducerView && (status === 'draft' || status === 'reopened')
  const showApprove    = isProducerView && status === 'submitted'
  const showReopen     = isProducerView && (status === 'approved' || status === 'submitted')
  const showLockedHint = !isProducerView && status === 'approved'
  const showAwaiting   = isProducerView && status === 'draft'

  return (
    <div
      style={{
        padding: '10px 12px',
        background: isReopenedTinted ? 'rgba(232,160,32,0.08)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isReopenedTinted ? 'rgba(232,160,32,0.3)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 8,
      }}
    >
      {/* Line 1 — hours + status pill */}
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <span className="font-mono" style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>
          {entry.hours.toFixed(1)} h
        </span>
        <StatusPill status={status} />
      </div>

      {/* Description */}
      <div style={{ fontSize: 12, color: '#a0a0b8', lineHeight: 1.5, marginBottom: showLockedHint || showAwaiting ? 0 : 8 }}>
        {entry.description}
      </div>

      {/* Reopen reason block (shown on reopened entries) */}
      {status === 'reopened' && entry.reopenReason && !isReopening && (
        <div
          style={{
            marginTop: 8,
            padding: '8px 10px',
            background: 'rgba(232,160,32,0.08)',
            borderLeft: '2px solid #e8a020',
            borderRadius: '0 6px 6px 0',
            fontSize: 11,
            lineHeight: 1.55,
            color: '#fff',
          }}
        >
          <span
            className="font-mono uppercase block"
            style={{ fontSize: 9, letterSpacing: '0.1em', color: '#e8a020', marginBottom: 4 }}
          >Reopen reason</span>
          {entry.reopenReason}
          <span
            className="block"
            style={{ marginTop: 6, fontSize: 10, color: '#62627a', fontStyle: 'italic' }}
          >— {reopenerName}</span>
        </div>
      )}

      {/* Inline hints */}
      {showLockedHint && (
        <div
          className="font-mono uppercase"
          style={{ fontSize: 9, letterSpacing: '0.1em', color: '#62627a', marginTop: 8 }}
        >Locked</div>
      )}
      {showAwaiting && (
        <div
          className="font-mono uppercase"
          style={{ fontSize: 9, letterSpacing: '0.1em', color: '#62627a', marginTop: 8 }}
        >Awaiting submission</div>
      )}

      {/* Reopen reason input (producer) */}
      {isReopening && (
        <ReopenReasonInput
          accent={accent}
          pending={pending}
          onCancel={onCancelReopen}
          onConfirm={onConfirmReopen}
        />
      )}

      {/* Action row */}
      {!isReopening && (showEdit || showSubmit || showApprove || showReopen) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          {showEdit && (
            <button
              onClick={onEdit}
              disabled={pending}
              className="font-mono uppercase"
              style={{
                fontSize: 10, letterSpacing: '0.08em',
                padding: '6px 12px', borderRadius: 6,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                color: '#a0a0b8', cursor: pending ? 'not-allowed' : 'pointer',
              }}
            >Edit</button>
          )}
          {showSubmit && (
            <button
              onClick={onSubmit}
              disabled={pending}
              className="font-mono uppercase"
              style={{
                fontSize: 10, letterSpacing: '0.08em',
                padding: '6px 12px', borderRadius: 6,
                background: `${accent}20`,
                border: `1px solid ${accent}60`,
                color: accent, cursor: pending ? 'not-allowed' : 'pointer',
              }}
            >Submit</button>
          )}
          {showApprove && (
            <button
              onClick={onApprove}
              disabled={pending}
              className="font-mono uppercase"
              style={{
                fontSize: 10, letterSpacing: '0.08em',
                padding: '6px 12px', borderRadius: 6,
                background: 'rgba(0,184,148,0.14)',
                border: '1px solid rgba(0,184,148,0.4)',
                color: '#00b894', cursor: pending ? 'not-allowed' : 'pointer',
              }}
            >Approve</button>
          )}
          {showReopen && (
            <button
              onClick={onStartReopen}
              disabled={pending}
              className="font-mono uppercase"
              style={{
                fontSize: 10, letterSpacing: '0.08em',
                padding: '6px 12px', borderRadius: 6,
                background: 'rgba(232,160,32,0.14)',
                border: '1px solid rgba(232,160,32,0.4)',
                color: '#e8a020', cursor: pending ? 'not-allowed' : 'pointer',
              }}
            >Reopen</button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Reopen reason input (inline, not a modal) ────────────

function ReopenReasonInput({
  accent, pending, onCancel, onConfirm,
}: {
  accent: string
  pending: boolean
  onCancel: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const canConfirm = !pending && reason.trim().length >= 10

  return (
    <div
      style={{
        marginTop: 10,
        padding: 10,
        background: 'rgba(232,160,32,0.06)',
        border: '1px solid rgba(232,160,32,0.28)',
        borderRadius: 6,
      }}
    >
      <span
        className="font-mono uppercase block"
        style={{ fontSize: 9, letterSpacing: '0.1em', color: '#e8a020', marginBottom: 6 }}
      >Reason for reopen</span>
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        autoFocus
        rows={2}
        placeholder="Minimum 10 characters — what needs fixing?"
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 6,
          padding: '8px 10px',
          color: '#dddde8',
          fontSize: 12,
          lineHeight: 1.5,
          outline: 'none',
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button
          onClick={onCancel}
          className="font-mono uppercase"
          style={{
            fontSize: 10, letterSpacing: '0.08em',
            padding: '6px 12px', borderRadius: 6,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
            color: '#a0a0b8', cursor: 'pointer',
          }}
        >Cancel</button>
        <button
          onClick={() => { if (canConfirm) onConfirm(reason.trim()) }}
          disabled={!canConfirm}
          className="font-mono uppercase"
          style={{
            fontSize: 10, letterSpacing: '0.08em',
            padding: '6px 12px', borderRadius: 6,
            background: canConfirm ? 'rgba(232,160,32,0.16)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${canConfirm ? 'rgba(232,160,32,0.5)' : 'rgba(255,255,255,0.06)'}`,
            color: canConfirm ? '#e8a020' : '#62627a',
            cursor: canConfirm ? 'pointer' : 'not-allowed',
          }}
        >Confirm reopen</button>
      </div>
    </div>
  )
}

// ── MAIN CREW PANEL ──────────────────────────────────────

type Layer = 'list' | 'overview' | 'detail' | 'week'
type WeekOrigin = 'overview' | 'detail'

export function CrewPanel({ open, projectId, accent, onClose }: {
  open: boolean; projectId: string; accent: string; onClose: () => void
}) {
  const { data: crew } = useCrew(projectId)
  const { data: project } = useProject(projectId)
  const allCrew = crew ?? []
  const [layer, setLayer] = useState<Layer>('list')
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [weekOrigin, setWeekOrigin] = useState<WeekOrigin>('overview')

  // Temporary viewer-identity shim. Resolves to the first ProjectMember with
  // role='producer' — Tyler Heckerman in every seed project. Producer view
  // whenever this viewer is looking at someone else's timecards.
  // TODO: replace with Auth session when landed. Single spot to swap.
  const currentViewerMember = useMemo(
    () => allCrew.find(m => m.role === 'producer') ?? null,
    [allCrew],
  )
  const isProducerView = !!currentViewerMember && currentViewerMember.id !== selectedMember?.id

  // Reset to list when panel opens
  useEffect(() => {
    if (open) { setLayer('list'); setSelectedMember(null) }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-51 bg-surface rounded-t-[20px] border-t border-border2 flex flex-col"
            style={{
              top: 100,
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              zIndex: 51,
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={spring}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info: PanInfo) => {
              if (info.offset.y > 100 || info.velocity.y > 500) onClose()
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-0 flex-shrink-0">
              <div className="w-9 h-1 rounded-full bg-white/10" />
            </div>

            {/* Layer 1 — Crew List */}
            <motion.div
              className="flex flex-col flex-1 min-h-0"
              animate={{
                x: layer !== 'list' ? -20 : 0,
                opacity: layer !== 'list' ? 0 : 1,
              }}
              transition={{ duration: 0.2 }}
              style={{ display: layer === 'list' ? 'flex' : 'none' }}
            >
              {/* Header */}
              <div className="flex items-center px-5 pt-3 pb-3 flex-shrink-0">
                <div className="flex-1">
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#dddde8' }}>Crew</div>
                  <div className="font-mono" style={{ fontSize: '0.48rem', color: '#62627a', marginTop: 2 }}>{allCrew.length} members</div>
                </div>
                <TimecardsLabelButton
                  accent={accent}
                  onClick={() => { haptic('light'); setLayer('overview') }}
                />
                <button onClick={onClose} className="text-muted w-11 h-11 flex items-center justify-center active:opacity-60">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                </button>
              </div>

              {/* Crew grid — grouped by department */}
              <div className="flex-1 overflow-y-auto min-h-0" style={{ WebkitOverflowScrolling: 'touch', padding: '0 16px 20px' }}>
                {groupByDepartment(allCrew).map(({ department, members }) => (
                  <div key={department ?? '__none'} style={{ marginTop: 16 }}>
                    {/* Section header */}
                    <div style={{ marginBottom: 10 }}>
                      <div className="uppercase" style={{
                        fontSize: 13, fontWeight: 600, color: accent,
                        letterSpacing: '0.08em', paddingBottom: 6,
                      }}>
                        {department ?? 'Crew (untagged)'}
                      </div>
                      <div style={{ height: 1, background: `${accent}20` }} />
                    </div>
                    {/* Avatar row — wrapping flex */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                      {members.map(m => (
                        <CrewCell key={m.id} member={m} onTap={() => { haptic('light'); setSelectedMember(m); setLayer('detail') }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Layer 2A — Detail */}
            {layer === 'detail' && selectedMember && (
              <motion.div
                className="flex flex-col flex-1 min-h-0"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                transition={spring}
              >
                <CrewDetail
                  member={selectedMember}
                  accent={accent}
                  projectId={projectId}
                  onBack={() => setLayer('list')}
                  onRemoved={() => { setLayer('list'); setSelectedMember(null) }}
                  onTimecards={() => { setWeekOrigin('detail'); setLayer('week') }}
                />
              </motion.div>
            )}

            {/* Layer 2B — Producer Overview (Timecards) */}
            {layer === 'overview' && (
              <motion.div
                className="flex flex-col flex-1 min-h-0"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                transition={spring}
              >
                <ProducerOverview
                  crew={allCrew}
                  projectId={projectId}
                  accent={accent}
                  onBack={() => setLayer('list')}
                  onRowTap={(m) => { setSelectedMember(m); setWeekOrigin('overview'); setLayer('week') }}
                />
              </motion.div>
            )}

            {/* Layer 3 — Individual Week View (Timecards for one member) */}
            {layer === 'week' && selectedMember && (
              <motion.div
                className="flex flex-col flex-1 min-h-0"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                transition={spring}
              >
                <IndividualWeekView
                  member={selectedMember}
                  projectId={projectId}
                  accent={accent}
                  projectName={project?.name ?? ''}
                  viewerMember={currentViewerMember}
                  isProducerView={isProducerView}
                  onBack={() => setLayer(weekOrigin)}
                />
              </motion.div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
