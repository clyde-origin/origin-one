'use client'

import { useState, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useProject, useMilestones, useCreateMilestone, useCrew } from '@/lib/hooks/useOriginOne'
import { LoadingState, EmptyState, CrewAvatar, SkeletonLine } from '@/components/ui'
import { PageHeader } from '@/components/ui/PageHeader'
import { FAB } from '@/components/ui/FAB'
import { CreateMilestoneSheet } from '@/components/create'
import { haptic } from '@/lib/utils/haptics'
import { formatDate, isLate, getProjectColor, MILESTONE_STATUS_HEX, MILESTONE_STATUS_LABEL, statusLabel } from '@/lib/utils/phase'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import type { Milestone, CrewMember } from '@/types'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa']

type Mode = 'project' | 'master'

function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate() }
function dateKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` }

// ── CALENDAR ──────────────────────────────────────────────

function Calendar({ month, mode, accent, milestones, selectedDate, onSelect, onMonthChange }: {
  month: Date; mode: Mode; accent: string
  milestones: { date: Date; status: string; projectColor?: string }[]
  selectedDate: Date | null
  onSelect: (d: Date) => void; onMonthChange: (d: Date) => void
}) {
  const today = new Date()
  const yr = month.getFullYear(), mo = month.getMonth()
  const firstDay = new Date(yr, mo, 1).getDay()
  const daysInMonth = new Date(yr, mo + 1, 0).getDate()
  const prevDays = new Date(yr, mo, 0).getDate()

  const cells: { day: number; date: Date; otherMonth: boolean }[] = []
  for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: prevDays - i, date: new Date(yr, mo - 1, prevDays - i), otherMonth: true })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, date: new Date(yr, mo, d), otherMonth: false })
  const rem = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7)
  for (let i = 1; i <= rem; i++) cells.push({ day: i, date: new Date(yr, mo + 1, i), otherMonth: true })

  const prev = () => onMonthChange(new Date(yr, mo - 1, 1))
  const next = () => onMonthChange(new Date(yr, mo + 1, 1))

  return (
    <div className="flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '10px 16px 8px' }}>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-2.5">
        <button onClick={prev} className="flex items-center justify-center cursor-pointer" style={{ width: 44, height: 44, borderRadius: '50%' }}>
          <div className="flex items-center justify-center" style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none"><path d="M5 1L1 5L5 9" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </button>
        <span style={{ fontWeight: 800, fontSize: '0.88rem', letterSpacing: '-0.01em' }}>{MONTHS[mo]} {yr}</span>
        <button onClick={next} className="flex items-center justify-center cursor-pointer" style={{ width: 44, height: 44, borderRadius: '50%' }}>
          <div className="flex items-center justify-center" style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none"><path d="M1 1L5 5L1 9" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </button>
      </div>

      {/* Day of week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 3 }}>
        {DOW.map(d => <div key={d} className="font-mono uppercase text-center" style={{ fontSize: '0.4rem', color: '#62627a', letterSpacing: '0.05em', padding: '1px 0' }}>{d}</div>)}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {cells.map((c, i) => {
          const isToday = sameDay(c.date, today)
          const isSelected = selectedDate && sameDay(c.date, selectedDate)
          const hasMilestone = milestones.some(m => sameDay(m.date, c.date))

          // Dots
          let dots: string[] = []
          if (mode === 'project' && hasMilestone) dots = [accent]
          else if (mode === 'master') {
            const colors = Array.from(new Set(milestones.filter(m => sameDay(m.date, c.date)).map(m => m.projectColor ?? '#62627a')))
            dots = colors.slice(0, 3)
          }

          return (
            <div
              key={i}
              className="flex flex-col items-center justify-center cursor-pointer relative select-none"
              style={{
                height: 30, borderRadius: 5,
                background: isToday ? 'rgba(255,255,255,0.13)' : undefined,
                color: c.otherMonth ? undefined : isToday ? '#dddde8' : '#62627a',
                fontWeight: isToday ? 700 : undefined,
                opacity: c.otherMonth ? 0.2 : 1,
                pointerEvents: c.otherMonth ? 'none' : undefined,
                outline: isSelected ? `1.5px solid ${accent}99` : undefined,
                outlineOffset: isSelected ? 1 : undefined,
              }}
              onClick={() => !c.otherMonth && onSelect(c.date)}
            >
              <span className="font-mono" style={{ fontSize: '0.52rem', lineHeight: 1 }}>{c.day}</span>
              {dots.length > 0 && (
                <div className="flex items-center justify-center" style={{ gap: 2, height: 5, marginTop: 1 }}>
                  {dots.map((color, di) => <div key={di} className="rounded-full" style={{ width: 3, height: 3, background: color }} />)}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center" style={{ gap: 10, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        {mode === 'project' ? (
          <>
            {[{ label: 'Upcoming', color: '#e8a020' }, { label: 'In Progress', color: '#6470f3' }, { label: 'Done', color: '#00b894' }].map(l => (
              <div key={l.label} className="flex items-center gap-1">
                <div className="rounded-full" style={{ width: 5, height: 5, background: l.color }} />
                <span className="font-mono uppercase" style={{ fontSize: '0.42rem', color: '#62627a', letterSpacing: '0.05em' }}>{l.label}</span>
              </div>
            ))}
          </>
        ) : (
          <div className="flex items-center gap-2.5">
            <span className="font-mono uppercase" style={{ fontSize: '0.42rem', color: '#62627a', letterSpacing: '0.05em' }}>Projects:</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── MILESTONE DETAIL SHEET ────────────────────────────────

function MilestoneDetailSheet({ milestone, crew, accent, onClose }: {
  milestone: Milestone | null; crew: CrewMember[]; accent: string; onClose: () => void
}) {
  if (!milestone) return null
  const isDelivery = milestone.title.toLowerCase().includes('delivery')
  const statusColor = isDelivery ? '#e8564a' : (MILESTONE_STATUS_HEX[milestone.status] ?? '#62627a')
  const dateObj = new Date(milestone.date)
  const fullDate = `${MONTHS[dateObj.getMonth()]} ${dateObj.getDate()}, ${dateObj.getFullYear()}`
  const dayName = DAYS[dateObj.getDay()]
  const people = (milestone.people ?? []).map(id => crew.find(c => c.id === id)).filter(Boolean) as CrewMember[]
  const [taggedIds, setTaggedIds] = useState<Set<string>>(new Set(milestone.people ?? []))

  const toggleTag = (id: string) => setTaggedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })

  return (
    <>
      <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '12px auto 18px' }} />
      {/* Eyebrow */}
      <div style={{ padding: '0 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="font-mono uppercase flex items-center gap-1.5" style={{ fontSize: '0.44rem', letterSpacing: '0.08em', color: statusColor, marginBottom: 6 }}>
          <div className="rounded-full" style={{ width: 6, height: 6, background: statusColor }} />
          {MILESTONE_STATUS_LABEL[milestone.status] ?? milestone.status}
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em', color: isDelivery ? '#e8564a' : '#dddde8' }}>{milestone.title}</div>
      </div>

      {/* Fields */}
      <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="flex items-start gap-3">
          <span className="font-mono uppercase flex-shrink-0" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', width: 68, paddingTop: 2 }}>Date</span>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: isDelivery ? '#e8564a' : '#dddde8' }}>{fullDate}</span>
        </div>
        <div className="flex items-start gap-3">
          <span className="font-mono uppercase flex-shrink-0" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', width: 68, paddingTop: 2 }}>Day</span>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#dddde8' }}>{dayName}</span>
        </div>
        <div className="flex items-start gap-3">
          <span className="font-mono uppercase flex-shrink-0" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', width: 68, paddingTop: 2 }}>Status</span>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#dddde8' }}>{MILESTONE_STATUS_LABEL[milestone.status] ?? milestone.status}</span>
        </div>
      </div>

      {/* Notes */}
      <div style={{ padding: '0 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Notes</span>
        <textarea
          defaultValue={milestone.notes ?? ''}
          placeholder="Add a note..."
          className="outline-none"
          style={{ width: '100%', minHeight: 64, maxHeight: 120, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7, padding: '10px 12px', fontSize: '0.76rem', color: '#dddde8', lineHeight: 1.5, resize: 'none', fontFamily: 'inherit' }}
          onFocus={e => { e.target.style.borderColor = `${accent}66` }}
          onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.05)' }}
        />
      </div>

      {/* Crew tags */}
      {crew.length > 0 && (
        <div style={{ padding: '12px 20px 0' }}>
          <span className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 8 }}>Crew</span>
          <div className="flex flex-wrap" style={{ gap: 6 }}>
            {crew.map(c => {
              const tagged = taggedIds.has(c.id)
              const name = c.User?.name ?? 'Unknown'
              return (
                <button key={c.id} className="flex items-center cursor-pointer select-none transition-all"
                  style={{ gap: 5, padding: '4px 9px', borderRadius: 20, fontSize: '0.48rem', letterSpacing: '0.04em', fontFamily: 'var(--font-geist-mono), monospace',
                    background: tagged ? `${accent}1f` : 'rgba(255,255,255,0.04)', border: `1px solid ${tagged ? `${accent}4d` : 'rgba(255,255,255,0.05)'}`, color: tagged ? accent : '#62627a' }}
                  onClick={() => toggleTag(c.id)}>
                  <div className="rounded-full" style={{ width: 5, height: 5, background: tagged ? accent : '#62627a' }} />
                  {name.split(' ')[0]} {name.split(' ')[1]?.[0] ? `${name.split(' ')[1][0]}.` : ''}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Buttons */}
      <div style={{ padding: '16px 20px 0', display: 'flex', gap: 10 }}>
        <button className="flex-1 font-bold cursor-pointer transition-all"
          style={{ padding: 13, borderRadius: 8, fontSize: '0.78rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.05)', color: '#a0a0b8' }}
          onClick={onClose}>Save</button>
        <button className="flex-1 font-bold cursor-pointer transition-all"
          style={{ padding: 13, borderRadius: 8, fontSize: '0.78rem', background: 'rgba(232,86,74,0.08)', border: '1px solid rgba(232,86,74,0.2)', color: '#e8564a' }}
          onClick={() => { haptic('warning'); onClose() }}>Delete</button>
      </div>
    </>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────

export default function TimelinePage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const router = useRouter()
  const accent = getProjectColor(projectId)

  const { data: project } = useProject(projectId)
  const { data: milestones, isLoading } = useMilestones(projectId)
  const { data: crew } = useCrew(projectId)

  const allMS = milestones ?? []
  const allCrew = crew ?? []

  const [mode, setMode] = useState<Mode>('project')
  const [month, setMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedMS, setSelectedMS] = useState<Milestone | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const createMilestone = useCreateMilestone(projectId)

  const msListRef = useRef<HTMLDivElement>(null)

  // Calendar milestone dots
  const calMilestones = useMemo(() => allMS.map(m => ({ date: new Date(m.date), status: m.status, projectColor: accent })), [allMS, accent])

  // Upcoming grouped by month
  const sorted = [...allMS].sort((a, b) => a.date.localeCompare(b.date))

  const onDayClick = useCallback((date: Date) => {
    setSelectedDate(date)
    if (mode === 'project') {
      // Find nearest milestone and scroll to it
      const target = sorted.find(m => new Date(m.date) >= date) ?? sorted[sorted.length - 1]
      if (target && msListRef.current) {
        const el = msListRef.current.querySelector(`[data-ms-id="${target.id}"]`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          setHighlightId(target.id)
          setTimeout(() => setHighlightId(null), 1200)
        }
      }
    }
  }, [mode, sorted])

  // Group milestones by month
  const monthGroups = useMemo(() => {
    const groups: { label: string; items: Milestone[] }[] = []
    const map = new Map<string, Milestone[]>()
    sorted.forEach(m => {
      const d = new Date(m.date)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(m)
    })
    map.forEach((items, key) => {
      const [yr, mo] = key.split('-').map(Number)
      groups.push({ label: `${MONTHS[mo]} ${yr}`, items })
    })
    return groups
  }, [sorted])

  const projectStatusLabel = project ? statusLabel(project.status) : ''

  return (
    <div className="screen" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <PageHeader
        projectId={projectId}
        title="Timeline"
        meta={project ? `${project.name} · ${projectStatusLabel}` : ''}
        right={
          <div className="flex items-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 20, padding: 3, gap: 2 }}>
            <button onClick={() => setMode('project')} className="font-mono uppercase cursor-pointer select-none whitespace-nowrap"
              style={{ fontSize: '0.44rem', letterSpacing: '0.05em', padding: '4px 9px', borderRadius: 16, transition: 'all 0.18s',
                ...(mode === 'project' ? { background: `${accent}2e`, color: accent, border: `1px solid ${accent}4d` } : { color: '#62627a', border: '1px solid transparent' }) }}>
              Project
            </button>
            <button onClick={() => { setMode('master'); setSelectedDate(null) }} className="font-mono uppercase cursor-pointer select-none whitespace-nowrap"
              style={{ fontSize: '0.44rem', letterSpacing: '0.05em', padding: '4px 9px', borderRadius: 16, transition: 'all 0.18s',
                ...(mode === 'master' ? { background: 'rgba(255,255,255,0.08)', color: '#dddde8' } : { color: '#62627a', border: '1px solid transparent' }) }}>
              Master
            </button>
          </div>
        }
      />

      {/* Calendar — anchored, does not scroll */}
      <Calendar
        month={month} mode={mode} accent={accent}
        milestones={calMilestones}
        selectedDate={selectedDate} onSelect={onDayClick} onMonthChange={setMonth}
      />

      {/* Milestone list — scrollable */}
      <div ref={msListRef} className="flex-1 overflow-y-auto no-scrollbar" style={{ WebkitOverflowScrolling: 'touch', padding: '0 16px 100px' }}>
        {isLoading ? (
          <div className="py-8"><LoadingState /></div>
        ) : mode === 'master' && !selectedDate ? (
          /* Master default: "Tap a date" */
          <div className="flex flex-col items-center justify-center text-center" style={{ padding: '40px 24px', gap: 8 }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ opacity: 0.15, marginBottom: 4 }}>
              <rect x="4" y="6" width="24" height="22" rx="3" stroke="white" strokeWidth="1.5" />
              <path d="M4 12H28" stroke="white" strokeWidth="1.5" />
              <path d="M11 4V8M21 4V8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#a0a0b8' }}>Tap a date</div>
            <div className="font-mono" style={{ fontSize: '0.46rem', color: '#62627a', letterSpacing: '0.04em', lineHeight: 1.6 }}>
              Select any date to see milestones<br />across all projects.
            </div>
          </div>
        ) : mode === 'master' && selectedDate ? (
          /* Master: show milestones for selected date */
          (() => {
            const dayMs = sorted.filter(m => sameDay(new Date(m.date), selectedDate))
            if (dayMs.length === 0) return (
              <div className="flex flex-col items-center justify-center text-center" style={{ padding: '40px 24px', gap: 8 }}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ opacity: 0.15, marginBottom: 4 }}>
                  <rect x="4" y="6" width="24" height="22" rx="3" stroke="white" strokeWidth="1.5" />
                  <path d="M4 12H28" stroke="white" strokeWidth="1.5" />
                  <path d="M11 4V8M21 4V8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#a0a0b8' }}>{MONTHS[selectedDate.getMonth()]} {selectedDate.getDate()}</div>
                <div className="font-mono" style={{ fontSize: '0.46rem', color: '#62627a', letterSpacing: '0.04em', lineHeight: 1.6 }}>
                  Nothing scheduled across<br />any project on this date.
                </div>
              </div>
            )
            return (
              <>
                <div className="font-mono uppercase" style={{ fontSize: '0.47rem', color: '#62627a', letterSpacing: '0.1em', padding: '14px 0 7px' }}>
                  {MONTHS[selectedDate.getMonth()]} {selectedDate.getDate()}, {selectedDate.getFullYear()}
                </div>
                {dayMs.map(ms => {
                  const d = new Date(ms.date)
                  const isDelivery = ms.title.toLowerCase().includes('delivery')
                  const msColor = isDelivery ? '#e8564a' : (MILESTONE_STATUS_HEX[ms.status] ?? '#62627a')
                  return (
                    <div key={ms.id} className="flex items-start cursor-pointer" style={{ gap: 12, padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                      onClick={() => setSelectedMS(ms)}>
                      <div className="flex-shrink-0" style={{ width: 40 }}>
                        <div className="font-mono" style={{ fontSize: '1rem', fontWeight: 500, color: accent, lineHeight: 1 }}>{d.getDate()}</div>
                        <div className="font-mono uppercase" style={{ fontSize: '0.4rem', color: '#62627a', letterSpacing: '0.06em', marginTop: 2 }}>{DAYS[d.getDay()]}</div>
                      </div>
                      <div className="flex-shrink-0" style={{ width: 1, background: `${accent}66`, alignSelf: 'stretch', margin: '2px 0' }} />
                      <div className="flex-1 min-w-0" style={{ paddingTop: 2 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isDelivery ? '#e8564a' : '#dddde8', marginBottom: 4 }}>{ms.title}</div>
                        <div className="font-mono uppercase flex items-center gap-1" style={{ fontSize: '0.42rem', color: '#62627a', background: 'rgba(255,255,255,0.04)', borderRadius: 3, padding: '2px 5px', display: 'inline-flex', letterSpacing: '0.05em' }}>
                          <div className="rounded-full" style={{ width: 5, height: 5, background: msColor }} />
                          {MILESTONE_STATUS_LABEL[ms.status] ?? ms.status}
                        </div>
                      </div>
                      <svg width="5" height="9" viewBox="0 0 5 9" fill="none" className="flex-shrink-0" style={{ opacity: 0.2, marginTop: 4 }}><path d="M1 1L4 4.5L1 8" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                  )
                })}
              </>
            )
          })()
        ) : (
          /* Project mode: full milestone list grouped by month */
          <>
            {sorted.length === 0 ? <EmptyState text="No milestones yet" /> : monthGroups.map(group => (
              <div key={group.label}>
                <div className="font-mono uppercase" style={{ fontSize: '0.47rem', color: '#62627a', letterSpacing: '0.1em', padding: '14px 0 7px' }}>{group.label}</div>
                {group.items.map((ms, i) => {
                  const d = new Date(ms.date)
                  const isDelivery = ms.title.toLowerCase().includes('delivery')
                  const isNext = !isDelivery && sorted.indexOf(ms) === sorted.findIndex(m => new Date(m.date) >= new Date())
                  const highlighted = highlightId === ms.id
                  const msColor = isDelivery ? '#e8564a' : (MILESTONE_STATUS_HEX[ms.status] ?? '#62627a')
                  return (
                    <div key={ms.id} data-ms-id={ms.id}
                      className="flex items-start cursor-pointer transition-all"
                      style={{
                        gap: 12, padding: highlighted ? '11px 8px' : '11px 0',
                        margin: highlighted ? '0 -8px' : undefined,
                        borderBottom: highlighted ? '1px solid transparent' : '1px solid rgba(255,255,255,0.05)',
                        background: highlighted ? `${accent}12` : undefined,
                        borderRadius: highlighted ? 7 : 4,
                      }}
                      onClick={() => setSelectedMS(ms)}>
                      <div className="flex-shrink-0" style={{ width: 40 }}>
                        <div className="font-mono" style={{ fontSize: '1rem', fontWeight: 500, lineHeight: 1, color: isDelivery ? '#e8564a' : isNext ? accent : '#dddde8' }}>{d.getDate()}</div>
                        <div className="font-mono uppercase" style={{ fontSize: '0.4rem', color: '#62627a', letterSpacing: '0.06em', marginTop: 2 }}>{DAYS[d.getDay()]}</div>
                      </div>
                      <div className="flex-shrink-0" style={{ width: 1, alignSelf: 'stretch', margin: '2px 0', background: isDelivery ? 'rgba(232,86,74,0.5)' : isNext ? `${accent}66` : 'rgba(255,255,255,0.05)' }} />
                      <div className="flex-1 min-w-0" style={{ paddingTop: 2 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isDelivery ? '#e8564a' : '#dddde8', marginBottom: 4 }}>{ms.title}</div>
                        <div className="font-mono uppercase flex items-center gap-1" style={{ fontSize: '0.42rem', color: '#62627a', background: 'rgba(255,255,255,0.04)', borderRadius: 3, padding: '2px 5px', display: 'inline-flex', letterSpacing: '0.05em' }}>
                          <div className="rounded-full" style={{ width: 5, height: 5, background: msColor }} />
                          {isDelivery ? 'Delivery' : (MILESTONE_STATUS_LABEL[ms.status] ?? ms.status)}
                        </div>
                      </div>
                      <svg width="5" height="9" viewBox="0 0 5 9" fill="none" className="flex-shrink-0" style={{ opacity: 0.2, marginTop: 4 }}><path d="M1 1L4 4.5L1 8" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                  )
                })}
              </div>
            ))}
          </>
        )}
      </div>

      {/* FAB */}
      <FAB accent={accent} projectId={projectId} onPress={() => { haptic('light'); setShowAdd(true) }} />

      {/* Add Milestone Sheet */}
      <CreateMilestoneSheet
        open={showAdd}
        projectId={projectId}
        accent={accent}
        onSave={(data) => { createMilestone.mutate(data as any); setShowAdd(false) }}
        onClose={() => setShowAdd(false)}
      />

      {/* Detail Sheet */}
      <Sheet open={!!selectedMS} onClose={() => setSelectedMS(null)}>
        <MilestoneDetailSheet milestone={selectedMS} crew={allCrew} accent={accent} onClose={() => setSelectedMS(null)} />
      </Sheet>
    </div>
  )
}
