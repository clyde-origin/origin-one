'use client'

import { useState, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useProject, useMilestones, useCreateMilestone, useCrew } from '@/lib/hooks/useOriginOne'
import { LoadingState, EmptyState, CrewAvatar, SkeletonLine } from '@/components/ui'
import { PageHeader } from '@/components/ui/PageHeader'
import { FAB } from '@/components/ui/FAB'
import { CreateMilestoneSheet } from '@/components/create'
import { haptic } from '@/lib/utils/haptics'
import { formatDate, isLate, getProjectColor, PHASE_HEX, PHASE_LABELS } from '@/lib/utils/phase'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import type { Milestone, CrewMember, Phase } from '@/types'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa']
const PHASE_LABEL = PHASE_LABELS

type Mode = 'project' | 'master'

function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate() }
function dateKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` }

// ── CALENDAR ──────────────────────────────────────────────

function Calendar({ month, mode, accent, phases, milestones, deliveryDate, selectedDate, onSelect, onMonthChange }: {
  month: Date; mode: Mode; accent: string
  phases: { id: string; start: Date; end: Date }[]
  milestones: { date: Date; phase: string; projectColor?: string }[]
  deliveryDate: Date | null; selectedDate: Date | null
  onSelect: (d: Date) => void; onMonthChange: (d: Date) => void
}) {
  const today = new Date()
  const yr = month.getFullYear(), mo = month.getMonth()
  const firstDay = new Date(yr, mo, 1).getDay()
  const daysInMonth = new Date(yr, mo + 1, 0).getDate()
  const prevDays = new Date(yr, mo, 0).getDate()

  const getPhase = (d: Date) => { for (const p of phases) { if (d >= p.start && d <= p.end) return p.id } return null }

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
          const phase = !c.otherMonth && mode === 'project' ? getPhase(c.date) : null
          const isToday = sameDay(c.date, today)
          const isDelivery = deliveryDate && sameDay(c.date, deliveryDate)
          const isSelected = selectedDate && sameDay(c.date, selectedDate)
          const hasMilestone = milestones.some(m => sameDay(m.date, c.date))

          // Dots
          let dots: string[] = []
          if (mode === 'project' && hasMilestone) dots = [accent]
          else if (mode === 'master') {
            const colors = Array.from(new Set(milestones.filter(m => sameDay(m.date, c.date)).map(m => m.projectColor ?? '#62627a')))
            dots = colors.slice(0, 3)
          }

          const phaseClass = phase === 'pre' ? 'rgba(232,160,32,0.12)' : phase === 'prod' ? 'rgba(100,112,243,0.12)' : phase === 'post' ? 'rgba(0,184,148,0.12)' : undefined

          return (
            <div
              key={i}
              className="flex flex-col items-center justify-center cursor-pointer relative select-none"
              style={{
                height: 30, borderRadius: 5,
                background: isToday ? 'rgba(255,255,255,0.13)' : phaseClass,
                color: c.otherMonth ? undefined : isDelivery ? '#e8564a' : isToday ? '#dddde8' : phase ? '#dddde8' : '#62627a',
                fontWeight: isToday || isDelivery ? 700 : undefined,
                opacity: c.otherMonth ? 0.2 : 1,
                pointerEvents: c.otherMonth ? 'none' : undefined,
                outline: isSelected ? `1.5px solid ${accent}99` : undefined,
                outlineOffset: isSelected ? 1 : undefined,
              }}
              onClick={() => !c.otherMonth && onSelect(c.date)}
            >
              {isDelivery && <div className="absolute rounded" style={{ inset: 1, border: '1px solid rgba(232,86,74,0.4)', borderRadius: 4 }} />}
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
            {[{ label: 'Pre', color: '#e8a020' }, { label: 'Prod', color: '#6470f3' }, { label: 'Post', color: '#00b894' }].map(l => (
              <div key={l.label} className="flex items-center gap-1">
                <div className="rounded-full" style={{ width: 5, height: 5, background: l.color }} />
                <span className="font-mono uppercase" style={{ fontSize: '0.42rem', color: '#62627a', letterSpacing: '0.05em' }}>{l.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1 ml-auto">
              <div className="rounded-full" style={{ width: 5, height: 5, background: '#e8564a' }} />
              <span className="font-mono uppercase" style={{ fontSize: '0.42rem', color: '#62627a', letterSpacing: '0.05em' }}>Delivery</span>
            </div>
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
  const isDelivery = milestone.name.toLowerCase().includes('delivery')
  const phaseColor = isDelivery ? '#e8564a' : PHASE_HEX[milestone.phase]
  const dateObj = new Date(milestone.date)
  const fullDate = `${MONTHS[dateObj.getMonth()]} ${dateObj.getDate()}, ${dateObj.getFullYear()}`
  const dayName = DAYS[dateObj.getDay()]
  const people = milestone.people.map(id => crew.find(c => c.id === id)).filter(Boolean) as CrewMember[]
  const [taggedIds, setTaggedIds] = useState<Set<string>>(new Set(milestone.people))

  const toggleTag = (id: string) => setTaggedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })

  return (
    <>
      <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '12px auto 18px' }} />
      {/* Eyebrow */}
      <div style={{ padding: '0 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="font-mono uppercase flex items-center gap-1.5" style={{ fontSize: '0.44rem', letterSpacing: '0.08em', color: phaseColor, marginBottom: 6 }}>
          <div className="rounded-full" style={{ width: 6, height: 6, background: phaseColor }} />
          {PHASE_LABEL[milestone.phase] ?? milestone.phase}
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em', color: isDelivery ? '#e8564a' : '#dddde8' }}>{milestone.name}</div>
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
          <span className="font-mono uppercase flex-shrink-0" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', width: 68, paddingTop: 2 }}>Phase</span>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#dddde8' }}>{PHASE_LABEL[milestone.phase]}</span>
        </div>
      </div>

      {/* Notes */}
      <div style={{ padding: '0 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Notes</span>
        <textarea
          defaultValue={milestone.notes}
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
              return (
                <button key={c.id} className="flex items-center cursor-pointer select-none transition-all"
                  style={{ gap: 5, padding: '4px 9px', borderRadius: 20, fontSize: '0.48rem', letterSpacing: '0.04em', fontFamily: 'var(--font-dm-mono), monospace',
                    background: tagged ? `${accent}1f` : 'rgba(255,255,255,0.04)', border: `1px solid ${tagged ? `${accent}4d` : 'rgba(255,255,255,0.05)'}`, color: tagged ? accent : '#62627a' }}
                  onClick={() => toggleTag(c.id)}>
                  <div className="rounded-full" style={{ width: 5, height: 5, background: tagged ? accent : '#62627a' }} />
                  {c.first} {c.last[0]}.
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

// ── NEW MILESTONE SHEET ──────────────────────────────────

function NewMilestoneSheet({ phase, accent, onSave, onClose }: {
  phase: Phase; accent: string
  onSave: (data: { name: string; phase: Phase; dept: string; date: string; notes: string; people: string[] }) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [msPhase, setMsPhase] = useState<Phase>(phase)
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')

  const canSave = name.trim().length > 0 && date.length > 0

  return (
    <>
      <div style={{ padding: '12px 0 0' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '0 auto 4px' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ fontWeight: 800, fontSize: '1rem', color: '#dddde8' }}>New Milestone</span>
        <button
          onClick={() => { if (canSave) { haptic('light'); onSave({ name: name.trim(), phase: msPhase, dept: '', date, notes, people: [] }) } }}
          style={{
            fontFamily: 'var(--font-dm-mono)', fontSize: '0.48rem', letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '5px 10px', borderRadius: 20, cursor: canSave ? 'pointer' : 'default',
            background: canSave ? `${accent}1a` : 'rgba(255,255,255,0.04)',
            border: `1px solid ${canSave ? `${accent}40` : 'rgba(255,255,255,0.05)'}`,
            color: canSave ? accent : '#62627a',
          }}
        >Save</button>
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rough cut review"
            autoComplete="off" spellCheck={false}
            className="w-full outline-none focus:border-white/20"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7, padding: '10px 12px', color: '#dddde8', fontSize: '0.82rem' }}
          />
        </div>

        <div>
          <label className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full outline-none focus:border-white/20"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7, padding: '10px 12px', color: '#dddde8', fontSize: '0.78rem', fontFamily: 'var(--font-dm-mono)' }}
          />
        </div>

        <div>
          <label className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Phase</label>
          <div style={{ display: 'flex', gap: 5 }}>
            {(['pre', 'prod', 'post'] as Phase[]).map(p => (
              <button key={p} onClick={() => setMsPhase(p)}
                className="font-mono uppercase cursor-pointer flex-1"
                style={{
                  fontSize: '0.44rem', letterSpacing: '0.05em', padding: '7px 9px', borderRadius: 20, textAlign: 'center',
                  background: msPhase === p ? `${PHASE_HEX[p]}1a` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${msPhase === p ? `${PHASE_HEX[p]}40` : 'rgba(255,255,255,0.05)'}`,
                  color: msPhase === p ? PHASE_HEX[p] : '#62627a',
                }}
              >{PHASE_LABEL[p]}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Optional"
            className="w-full outline-none focus:border-white/20 resize-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7, padding: '10px 12px', color: '#dddde8', fontSize: '0.78rem', lineHeight: 1.5 }}
          />
        </div>
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

  // Phases derived from project dates
  const phases = useMemo(() => {
    if (!project) return []
    const pre = project.startDate && project.shootDate ? { id: 'pre', start: new Date(project.startDate), end: new Date(project.shootDate) } : null
    const prod = project.shootDate ? { id: 'prod', start: new Date(project.shootDate), end: project.shootDateEnd ? new Date(project.shootDateEnd) : new Date(project.shootDate) } : null
    const post = (project.shootDateEnd || project.shootDate) && project.deliveryDate ? { id: 'post', start: new Date(project.shootDateEnd || project.shootDate!), end: new Date(project.deliveryDate) } : null
    return [pre, prod, post].filter(Boolean) as { id: string; start: Date; end: Date }[]
  }, [project])

  const deliveryDate = project?.deliveryDate ? new Date(project.deliveryDate) : null

  // Calendar milestone dots
  const calMilestones = useMemo(() => allMS.map(m => ({ date: new Date(m.date), phase: m.phase, projectColor: accent })), [allMS, accent])

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

  const phaseColor = project ? PHASE_HEX[project.phase] : '#6470f3'
  const phaseLabel = project ? (project.phase === 'pre' ? 'In Pre-Production' : project.phase === 'prod' ? 'In Production' : 'In Post-Production') : ''

  return (
    <div className="screen" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <PageHeader
        projectId={projectId}
        title="Timeline"
        meta={project ? `${project.name} · ${phaseLabel}` : ''}
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
        month={month} mode={mode} accent={accent} phases={phases}
        milestones={calMilestones} deliveryDate={deliveryDate}
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
                  const isDelivery = ms.name.toLowerCase().includes('delivery')
                  return (
                    <div key={ms.id} className="flex items-start cursor-pointer" style={{ gap: 12, padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                      onClick={() => setSelectedMS(ms)}>
                      <div className="flex-shrink-0" style={{ width: 40 }}>
                        <div className="font-mono" style={{ fontSize: '1rem', fontWeight: 500, color: accent, lineHeight: 1 }}>{d.getDate()}</div>
                        <div className="font-mono uppercase" style={{ fontSize: '0.4rem', color: '#62627a', letterSpacing: '0.06em', marginTop: 2 }}>{DAYS[d.getDay()]}</div>
                      </div>
                      <div className="flex-shrink-0" style={{ width: 1, background: `${accent}66`, alignSelf: 'stretch', margin: '2px 0' }} />
                      <div className="flex-1 min-w-0" style={{ paddingTop: 2 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isDelivery ? '#e8564a' : '#dddde8', marginBottom: 4 }}>{ms.name}</div>
                        <div className="font-mono uppercase flex items-center gap-1" style={{ fontSize: '0.42rem', color: '#62627a', background: 'rgba(255,255,255,0.04)', borderRadius: 3, padding: '2px 5px', display: 'inline-flex', letterSpacing: '0.05em' }}>
                          <div className="rounded-full" style={{ width: 5, height: 5, background: PHASE_HEX[ms.phase] }} />
                          {PHASE_LABEL[ms.phase]}
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
                  const isDelivery = ms.name.toLowerCase().includes('delivery')
                  const isNext = !isDelivery && sorted.indexOf(ms) === sorted.findIndex(m => new Date(m.date) >= new Date())
                  const highlighted = highlightId === ms.id
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
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isDelivery ? '#e8564a' : '#dddde8', marginBottom: 4 }}>{ms.name}</div>
                        <div className="font-mono uppercase flex items-center gap-1" style={{ fontSize: '0.42rem', color: '#62627a', background: 'rgba(255,255,255,0.04)', borderRadius: 3, padding: '2px 5px', display: 'inline-flex', letterSpacing: '0.05em' }}>
                          <div className="rounded-full" style={{ width: 5, height: 5, background: isDelivery ? '#e8564a' : PHASE_HEX[ms.phase] }} />
                          {isDelivery ? 'Delivery' : PHASE_LABEL[ms.phase]}
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
        currentPhase={(project?.phase ?? 'prod') as Phase}
        shootDate={project?.shootDate}
        shootDateEnd={project?.shootDateEnd}
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
