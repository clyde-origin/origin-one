'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useProject, useMilestones, useCreateMilestone, useUpdateMilestone,
  useAddMilestonePerson, useRemoveMilestonePerson, useCrew,
  useShootDays, useLocations,
  useCreateShootDay, useUpdateShootDay, useDeleteShootDay,
  useMentionRoster, useMeId,
} from '@/lib/hooks/useOriginOne'
import { MentionInput } from '@/components/ui/MentionInput'
import { MentionText } from '@/components/ui/MentionText'
import { LoadingState, EmptyState, CrewAvatar, SkeletonLine } from '@/components/ui'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProjectSwitcher } from '@/components/ProjectSwitcher'
import { useFabAction } from '@/lib/contexts/FabActionContext'
import { CreateMilestoneSheet } from '@/components/create'
import { haptic } from '@/lib/utils/haptics'
import { formatDate, isLate, getProjectColor, MILESTONE_STATUS_HEX, MILESTONE_STATUS_LABEL, statusLabel, statusHex } from '@/lib/utils/phase'
import { useViewerRole } from '@/lib/auth/useViewerRole'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { ThreadRowBadge } from '@/components/threads/ThreadRowBadge'
import { useThreadsByEntity } from '@/components/threads/useThreadsByEntity'
import { useDetailSheetThreads } from '@/components/threads/useDetailSheetThreads'
import type { Milestone, CrewMember, ShootDay, ShootDayType, Location } from '@/types'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa']

type Mode = 'project' | 'master' | 'days'

// PR 15 — Days tab is producer-only because day counts drive budget
// formula globals (prepDays / shootDays / postDays). Same shim pattern
// as Budget page + Hub Budget block. Auth day swaps the three sites
// in one pass — see DECISIONS "Producer-only swap sites".
const PHASE_HEX: Record<ShootDayType, string> = {
  pre:  '#e8a020',
  prod: '#6470f3',
  post: '#00b894',
}

const PHASE_LABEL: Record<ShootDayType, string> = {
  pre:  'Prep',
  prod: 'Shoot',
  post: 'Post',
}

const PHASE_ORDER: ShootDayType[] = ['pre', 'prod', 'post']

function shootDayFormatDate(iso: string): string {
  // 'YYYY-MM-DD' → 'Mon Apr 26'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const date = new Date(Date.UTC(y, m - 1, d))
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()]
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getUTCMonth()]
  return `${dow} ${mon} ${d}`
}

function todayISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

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
        {DOW.map(d => <div key={d} className="font-mono uppercase text-center" style={{ fontSize: '0.52rem', color: '#62627a', letterSpacing: '0.05em', padding: '2px 0' }}>{d}</div>)}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {cells.map((c, i) => {
          const isToday = sameDay(c.date, today)
          const isSelected = selectedDate && sameDay(c.date, selectedDate)
          const dayMilestones = milestones.filter(m => sameDay(m.date, c.date))
          const hasMilestone = dayMilestones.length > 0

          // Check for special dates
          const isDelivery = dayMilestones.some(m => {
            const title = (m as any).title ?? ''
            return title.toLowerCase().includes('delivery') || title.toLowerCase().includes('final')
          })
          const isProduction = dayMilestones.some(m => {
            const title = (m as any).title ?? ''
            return title.toLowerCase().includes('shoot') || title.toLowerCase().includes('day 1') || title.toLowerCase().includes('day 2') || title.toLowerCase().includes('day 3')
          })

          return (
            <div
              key={i}
              className="flex flex-col items-center justify-center cursor-pointer relative select-none"
              style={{
                height: 36, borderRadius: 6,
                background: isDelivery && !c.otherMonth ? 'rgba(255,255,255,0.12)'
                  : isProduction && !c.otherMonth ? `${accent}20`
                  : isToday ? 'rgba(255,255,255,0.13)'
                  : undefined,
                color: c.otherMonth ? undefined : isToday ? '#dddde8' : '#a0a0b8',
                fontWeight: isToday || isDelivery || isProduction ? 700 : undefined,
                opacity: c.otherMonth ? 0.2 : 1,
                pointerEvents: c.otherMonth ? 'none' : undefined,
                outline: isSelected ? `1.5px solid ${accent}99` : undefined,
                outlineOffset: isSelected ? 1 : undefined,
              }}
              onClick={() => !c.otherMonth && onSelect(c.date)}
            >
              <span className="font-mono" style={{ fontSize: '0.62rem', lineHeight: 1 }}>{c.day}</span>
              {hasMilestone && !isDelivery && !isProduction && (
                <div className="flex items-center justify-center" style={{ gap: 2, height: 5, marginTop: 2 }}>
                  <div className="rounded-full" style={{ width: 4, height: 4, background: accent }} />
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

function MilestoneDetailSheet({ milestone, crew, accent, projectId, onClose }: {
  milestone: Milestone | null; crew: CrewMember[]; accent: string; projectId: string; onClose: () => void
}) {
  const updateMs = useUpdateMilestone(projectId)
  const meId = useMeId()
  const { data: roster = [] } = useMentionRoster(projectId)
  const [editTitle, setEditTitle] = useState(false)
  const [editDate, setEditDate] = useState(false)
  const [editStatus, setEditStatus] = useState(false)
  const [titleValue, setTitleValue] = useState(milestone?.title ?? '')
  const [dateValue, setDateValue] = useState(milestone?.date?.split('T')[0] ?? '')
  const [notes, setNotes] = useState(milestone?.notes ?? '')
  const [notesMentions, setNotesMentions] = useState<string[]>((milestone as any)?.mentions ?? [])
  const [showAddCrew, setShowAddCrew] = useState(false)
  const addPerson = useAddMilestonePerson(projectId)
  const removePerson = useRemoveMilestonePerson(projectId)

  const { TriggerIcon, PreviewRow, MessageZone, StartSheetOverlay } = useDetailSheetThreads({
    projectId,
    attachedToType: 'milestone',
    attachedToId: milestone?.id ?? null,
    subjectLabel: milestone?.title ?? '',
  })

  if (!milestone) return null
  const statusColor = MILESTONE_STATUS_HEX[milestone.status] ?? '#62627a'
  const dateObj = new Date(milestone.date)
  const fullDate = `${MONTHS[dateObj.getMonth()]} ${dateObj.getDate()}, ${dateObj.getFullYear()}`
  const dayName = DAYS[dateObj.getDay()]

  const saveTitle = () => { setEditTitle(false); if (titleValue.trim() && titleValue !== milestone.title) updateMs.mutate({ id: milestone.id, actorId: meId as string, fields: { title: titleValue.trim() } }) }
  const saveDate = (val: string) => { setEditDate(false); if (val && val !== milestone.date?.split('T')[0]) updateMs.mutate({ id: milestone.id, actorId: meId as string, fields: { date: val } }) }
  const saveStatus = (s: string) => { setEditStatus(false); if (s !== milestone.status) updateMs.mutate({ id: milestone.id, actorId: meId as string, fields: { status: s } }) }
  const saveNotes = () => {
    if (notes !== (milestone.notes ?? '') || notesMentions.join(',') !== ((milestone as any).mentions ?? []).join(',')) {
      updateMs.mutate({
        id: milestone.id,
        actorId: meId as string,
        fields: { notes: notes || undefined, mentions: notesMentions },
        contextLabel: `Milestone · ${milestone.title}`,
      })
    }
  }
  const assignedCrew = (milestone.people ?? []).map(id => crew.find(c => c.userId === id)).filter(Boolean) as CrewMember[]
  const unassignedCrew = crew.filter(c => !(milestone.people ?? []).includes(c.userId))

  return (
    <>
      <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '12px auto 18px' }} />
      {/* Header — editable title */}
      <div style={{ padding: '0 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex justify-between items-start">
          {editTitle ? (
            <input autoFocus value={titleValue} onChange={e => setTitleValue(e.target.value)} onBlur={saveTitle}
              onKeyDown={e => { if (e.key === 'Enter') saveTitle() }}
              className="outline-none flex-1"
              style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#dddde8', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 8px' }} />
          ) : (
            <div onClick={() => setEditTitle(true)} style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#dddde8', cursor: 'pointer', borderBottom: '1px dashed rgba(255,255,255,0.1)', paddingBottom: 1, flex: 1 }}>{milestone.title}</div>
          )}
          <div className="flex items-center gap-2 flex-shrink-0">
            {TriggerIcon}
            <button onClick={onClose} className="text-muted text-sm w-7 h-7 flex items-center justify-center">✕</button>
          </div>
        </div>
      </div>

      {/* Editable Fields */}
      <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 13 }}>
        {/* Date — tap to edit */}
        <div className="flex items-start gap-3">
          <span className="font-mono uppercase flex-shrink-0" style={{ fontSize: '0.46rem', color: '#62627a', letterSpacing: '0.08em', width: 68, paddingTop: 1 }}>Date</span>
          {editDate ? (
            <input type="date" autoFocus defaultValue={dateValue} onChange={e => setDateValue(e.target.value)} onBlur={e => saveDate(e.target.value)}
              className="outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 8px', color: '#dddde8', fontSize: '0.74rem', fontFamily: 'var(--font-geist-mono)' }} />
          ) : (
            <span onClick={() => setEditDate(true)} style={{ fontSize: '0.78rem', fontWeight: 600, color: '#dddde8', cursor: 'pointer', borderBottom: '1px dashed rgba(255,255,255,0.1)', paddingBottom: 1 }}>{fullDate} · {dayName}</span>
          )}
        </div>

        {/* Status — tap to cycle */}
        <div className="flex items-start gap-3">
          <span className="font-mono uppercase flex-shrink-0" style={{ fontSize: '0.46rem', color: '#62627a', letterSpacing: '0.08em', width: 68, paddingTop: 1 }}>Status</span>
          {editStatus ? (
            <div style={{ display: 'flex', gap: 5, flex: 1 }}>
              {(['upcoming', 'in_progress', 'completed'] as const).map(s => {
                const sc = MILESTONE_STATUS_HEX[s] ?? '#62627a'
                const active = milestone.status === s
                return (
                  <button key={s} onClick={() => saveStatus(s)} className="font-mono capitalize cursor-pointer"
                    style={{ flex: 1, fontSize: '0.42rem', padding: '5px 0', borderRadius: 16, textAlign: 'center',
                      background: active ? `${sc}22` : 'rgba(255,255,255,0.04)', border: `1px solid ${active ? `${sc}55` : 'rgba(255,255,255,0.05)'}`, color: active ? sc : '#62627a' }}
                  >{MILESTONE_STATUS_LABEL[s]}</button>
                )
              })}
            </div>
          ) : (
            <span onClick={() => setEditStatus(true)} style={{ fontSize: '0.78rem', fontWeight: 600, color: statusColor, cursor: 'pointer', borderBottom: '1px dashed rgba(255,255,255,0.1)', paddingBottom: 1 }}>
              {MILESTONE_STATUS_LABEL[milestone.status] ?? milestone.status}
            </span>
          )}
        </div>

        {/* Notes — always editable MentionInput */}
        <div className="flex items-start gap-3">
          <span className="font-mono uppercase flex-shrink-0" style={{ fontSize: '0.46rem', color: '#62627a', letterSpacing: '0.08em', width: 68, paddingTop: 1 }}>Notes</span>
          <div
            style={{ flex: 1, fontSize: '0.72rem', color: '#a0a0b8', lineHeight: 1.55, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 6, padding: '10px 12px' }}
            onBlur={saveNotes}
          >
            <MentionInput
              value={notes}
              mentions={notesMentions}
              onChange={(text, m) => { setNotes(text); setNotesMentions(m) }}
              roster={roster}
              placeholder="Add notes…"
              multiline
              accent={accent}
            />
          </div>
        </div>
      </div>

      {/* Assigned crew + add button */}
      <div style={{ padding: '0 20px 12px', position: 'relative' }}>
        <span className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 8 }}>Crew</span>
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          {/* Assigned crew pills — tap to remove */}
          {assignedCrew.map(c => {
            const name = c.User?.name ?? 'Unknown'
            return (
              <button key={c.id} className="flex items-center cursor-pointer select-none transition-all"
                style={{ gap: 5, padding: '4px 9px', borderRadius: 20, fontSize: '0.48rem', letterSpacing: '0.04em', fontFamily: 'var(--font-geist-mono), monospace',
                  background: `${accent}1f`, border: `1px solid ${accent}4d`, color: accent }}
                onClick={() => removePerson.mutate({ milestoneId: milestone.id, userId: c.userId })}>
                <span>×</span>
                {name.split(' ')[0]} {name.split(' ')[1]?.[0] ? `${name.split(' ')[1][0]}.` : ''}
              </button>
            )
          })}
          {/* Add button */}
          <button
            onClick={() => setShowAddCrew(!showAddCrew)}
            className="flex items-center justify-center cursor-pointer"
            style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px dashed rgba(255,255,255,0.15)', background: 'transparent', color: '#62627a', fontSize: 14 }}
          >+</button>
        </div>
        {/* Add crew dropdown */}
        {showAddCrew && unassignedCrew.length > 0 && (
          <div style={{
            position: 'absolute', left: 20, right: 20, zIndex: 10, marginTop: 6,
            background: '#151520', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
            maxHeight: 160, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}>
            {unassignedCrew.map(c => (
              <div key={c.id}
                onClick={() => { addPerson.mutate({ milestoneId: milestone.id, userId: c.userId }); setShowAddCrew(false) }}
                style={{ padding: '9px 14px', cursor: 'pointer', color: '#a0a0b8', fontSize: '0.74rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
              >{c.User?.name ?? 'Unknown'}</div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '0 20px 14px' }}>
        {PreviewRow}
        {MessageZone}
      </div>

      {StartSheetOverlay}
    </>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────

export default function TimelinePage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const router = useRouter()
  const { data: project } = useProject(projectId)
  const accent = project?.color || getProjectColor(projectId)
  const { data: milestones, isLoading } = useMilestones(projectId)
  const { data: crew } = useCrew(projectId)
  const threadByMilestoneId = useThreadsByEntity(projectId, 'milestone')

  // Producer-only Days tab gate. role is null while resolving so the
  // third pill never flashes for non-producers.
  const role = useViewerRole(projectId)
  const isProducer = role === 'producer'

  const allMS = milestones ?? []
  const allCrew = crew ?? []

  // PR 15 — Days tab data. Always called (hooks must be unconditional);
  // the data only renders inside the Days tab body. React Query handles
  // de-dup so this is fine.
  const { data: shootDaysRaw, isLoading: loadingDays } = useShootDays(projectId)
  const { data: locationsRaw } = useLocations(projectId)
  const days = (shootDaysRaw ?? []) as ShootDay[]
  const locations = (locationsRaw ?? []) as Location[]
  const locationsById = useMemo(() => {
    const m = new Map<string, Location>()
    for (const l of locations) m.set(l.id, l)
    return m
  }, [locations])
  const dayCounts = useMemo<Record<ShootDayType, number>>(() => {
    const c: Record<ShootDayType, number> = { pre: 0, prod: 0, post: 0 }
    for (const d of days) c[d.type]++
    return c
  }, [days])
  const [editingDay, setEditingDay] = useState<ShootDay | null>(null)
  const [showCreateDay, setShowCreateDay] = useState(false)

  const [mode, setMode] = useState<Mode>('project')
  // If a non-producer somehow lands on `mode='days'` (e.g., role flips
  // mid-session), bounce back to project view. Only fires once role resolves.
  useEffect(() => {
    if (mode === 'days' && role !== null && !isProducer) setMode('project')
  }, [mode, role, isProducer])
  const [month, setMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedMS, setSelectedMS] = useState<Milestone | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  // Register the + handler with the global ActionBar. The handler
  // switches based on active tab — milestone create on Project/Master,
  // shoot-day create on Days. ActionBar shows one + at a time per
  // codebase convention, so this single registration is the right
  // shape.
  useFabAction(
    {
      onPress: () => {
        haptic('light')
        if (mode === 'days') setShowCreateDay(true)
        else setShowAdd(true)
      },
      label: mode === 'days' ? 'Add shoot day' : undefined,
    },
    [mode],
  )
  const createMilestone = useCreateMilestone(projectId)

  const msListRef = useRef<HTMLDivElement>(null)

  // Calendar milestone dots
  const calMilestones = useMemo(() => allMS.map(m => ({ date: new Date(m.date), status: m.status, title: m.title, projectColor: accent })), [allMS, accent])

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
        meta={project ? (
          <div className="flex flex-col items-center gap-1.5">
            <ProjectSwitcher projectId={projectId} projectName={project.name} accentColor={accent} variant="meta" />
            <span className="font-mono uppercase" style={{ fontSize: '0.38rem', padding: '2px 8px', borderRadius: 12, background: `${statusHex(project.status)}18`, color: statusHex(project.status) }}>{projectStatusLabel}</span>
          </div>
        ) : ''}
        left={
          // Days button — producer-only, opposite the Project/Master
          // pills on the right. Tap toggles in/out of Days view; tapping
          // a Project/Master pill on the right also exits Days as a
          // side effect. Connects to budget formula globals
          // (prepDays/shootDays/postDays). Auth day swap site (one of
          // three — see DECISIONS "Producer-only swap sites").
          isProducer ? (
            <button
              onClick={() => {
                haptic('light')
                setMode(mode === 'days' ? 'project' : 'days')
                setSelectedDate(null)
              }}
              className="font-mono uppercase cursor-pointer select-none whitespace-nowrap flex items-center"
              style={{
                fontSize: '0.44rem', letterSpacing: '0.05em',
                padding: '5px 10px', borderRadius: 16, transition: 'all 0.18s',
                ...(mode === 'days'
                  ? { background: `${accent}2e`, color: accent, border: `1px solid ${accent}4d` }
                  : { background: 'rgba(255,255,255,0.05)', color: '#62627a', border: '1px solid rgba(255,255,255,0.05)' }),
              }}
            >
              Days
            </button>
          ) : null
        }
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

      {/* Days tab — producer-only schedule UI; lifts the standalone
          /schedule page contents. Replaces calendar + milestone list. */}
      {mode === 'days' ? (
        <DaysTabContent
          projectId={projectId}
          accent={accent}
          days={days}
          locations={locations}
          locationsById={locationsById}
          isLoading={loadingDays}
          counts={dayCounts}
          editing={editingDay}
          showCreate={showCreateDay}
          setEditing={setEditingDay}
          setShowCreate={setShowCreateDay}
        />
      ) : (
      <>
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
                    <div key={ms.id} className="flex items-start cursor-pointer" style={{ position: 'relative', gap: 12, padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
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
                      <ThreadRowBadge entry={threadByMilestoneId.get(ms.id)} />
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
                        position: 'relative',
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
                      <ThreadRowBadge entry={threadByMilestoneId.get(ms.id)} />
                    </div>
                  )
                })}
              </div>
            ))}
          </>
        )}
      </div>
      </>
      )}

      {/* + handler registered above via useFabAction. ActionBar is mounted globally. */}

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
        <MilestoneDetailSheet milestone={selectedMS} crew={allCrew} accent={accent} projectId={projectId} onClose={() => setSelectedMS(null)} />
      </Sheet>
    </div>
  )
}

// ── DAYS TAB (PR 15 — lifted from /schedule) ──────────────

function DaysTabContent({
  projectId, accent, days, locations, locationsById, isLoading, counts,
  editing, showCreate, setEditing, setShowCreate,
}: {
  projectId: string
  accent: string
  days: ShootDay[]
  locations: Location[]
  locationsById: Map<string, Location>
  isLoading: boolean
  counts: Record<ShootDayType, number>
  editing: ShootDay | null
  showCreate: boolean
  setEditing: (d: ShootDay | null) => void
  setShowCreate: (b: boolean) => void
}) {
  return (
    <>
      {/* Phase counts strip */}
      <div
        className="flex items-center justify-center font-mono uppercase flex-shrink-0"
        style={{ gap: 14, padding: '12px 16px 14px', fontSize: '0.5rem', letterSpacing: '0.1em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        {PHASE_ORDER.map(t => (
          <span key={t} style={{ color: counts[t] > 0 ? PHASE_HEX[t] : '#62627a' }}>
            {PHASE_LABEL[t].toUpperCase()} {counts[t]}
          </span>
        ))}
      </div>

      {/* Day list */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          padding: '12px 16px 100px',
          display: 'flex', flexDirection: 'column', gap: 8,
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
        }}
      >
        {isLoading && (
          <div className="font-mono uppercase text-center" style={{ fontSize: '0.42rem', letterSpacing: '0.1em', color: '#62627a', padding: '32px 0' }}>
            Loading…
          </div>
        )}
        {!isLoading && days.length === 0 && (
          <div className="text-center" style={{ padding: '40px 8px' }}>
            <div className="font-mono uppercase" style={{ fontSize: '0.5rem', letterSpacing: '0.1em', color: '#62627a', marginBottom: 8 }}>
              No shoot days yet
            </div>
            <div style={{ fontSize: '0.78rem', color: '#a0a0b8' }}>
              Tap + to add prep, shoot, or post days. Day counts feed the budget's schedule globals.
            </div>
          </div>
        )}
        {days.map(day => (
          <ShootDayRow
            key={day.id}
            day={day}
            locationName={day.locationId ? (locationsById.get(day.locationId)?.name ?? null) : null}
            onTap={() => setEditing(day)}
          />
        ))}
      </div>

      <AnimatePresence>
        {showCreate && (
          <ShootDayEditSheet
            key="create"
            mode="create"
            day={null}
            projectId={projectId}
            locations={locations}
            onClose={() => setShowCreate(false)}
            onSubmitted={() => setShowCreate(false)}
          />
        )}
        {editing && (
          <ShootDayEditSheet
            key={editing.id}
            mode="edit"
            day={editing}
            projectId={projectId}
            locations={locations}
            onClose={() => setEditing(null)}
            onSubmitted={() => setEditing(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

function PhaseChip({ type }: { type: ShootDayType }) {
  const c = PHASE_HEX[type]
  return (
    <span
      className="font-mono uppercase"
      style={{
        fontSize: '0.42rem', letterSpacing: '0.1em',
        padding: '3px 8px', borderRadius: 20,
        background: `${c}14`, border: `1px solid ${c}59`, color: c,
        flexShrink: 0,
      }}
    >
      {PHASE_LABEL[type]}
    </span>
  )
}

function ShootDayRow({
  day, locationName, onTap,
}: {
  day: ShootDay
  locationName: string | null
  onTap: () => void
}) {
  return (
    <button
      type="button"
      onClick={() => { haptic('light'); onTap() }}
      className="w-full text-left active:opacity-80 transition-opacity"
      style={{
        padding: '12px 14px', borderRadius: 14,
        background: 'rgba(10,10,18,0.42)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.07)',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gridTemplateRows: 'auto auto',
        rowGap: 4, columnGap: 8,
        alignItems: 'center',
      }}
    >
      <div style={{ fontSize: '0.85rem', color: '#e8e8f0', fontWeight: 500 }}>
        {shootDayFormatDate(day.date)}
      </div>
      <PhaseChip type={day.type} />
      <div
        className="font-mono uppercase"
        style={{
          fontSize: '0.42rem', letterSpacing: '0.08em', color: '#62627a',
          gridColumn: '1 / span 2',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {locationName ?? (day.notes ? <MentionText text={day.notes} accent='#6470f3' /> : 'No location')}
      </div>
    </button>
  )
}

function ShootDayEditSheet({
  mode, day, projectId, locations,
  onClose, onSubmitted,
}: {
  mode: 'create' | 'edit'
  day: ShootDay | null
  projectId: string
  locations: Location[]
  onClose: () => void
  onSubmitted: () => void
}) {
  const [date, setDate] = useState<string>(day?.date ?? todayISO())
  const [type, setType] = useState<ShootDayType>(day?.type ?? 'prod')
  const [locationId, setLocationId] = useState<string | null>(day?.locationId ?? null)
  const [notes, setNotes] = useState<string>(day?.notes ?? '')
  const [notesMentions, setNotesMentions] = useState<string[]>((day as any)?.mentions ?? [])
  const { data: roster = [] } = useMentionRoster(projectId)
  const meId = useMeId()

  const create = useCreateShootDay(projectId)
  const update = useUpdateShootDay(projectId)
  const del    = useDeleteShootDay(projectId)

  const submit = async () => {
    if (!date) return
    haptic('medium')
    if (mode === 'create') {
      await create.mutateAsync({
        projectId, date, type,
        locationId, notes: notes.trim() || null,
        actorId: meId as string,
        mentions: notesMentions,
        contextLabel: `Shoot Day · ${new Date(date).toLocaleDateString()}`,
      })
    } else if (day) {
      await update.mutateAsync({
        id: day.id,
        actorId: meId as string,
        fields: { date, type, locationId, notes: notes.trim() || null, mentions: notesMentions },
        contextLabel: `Shoot Day · ${new Date(date).toLocaleDateString()}`,
      })
    }
    onSubmitted()
  }

  const remove = async () => {
    if (!day) return
    if (!confirm('Delete this shoot day?')) return
    haptic('warning')
    await del.mutateAsync(day.id)
    onSubmitted()
  }

  return (
    <motion.div
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 280 }}
      className="fixed inset-x-0 bottom-0 z-50"
      style={{
        background: 'rgba(8,8,14,0.96)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: '20px 18px calc(env(safe-area-inset-bottom, 0px) + 24px)',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}
    >
      <div className="self-center" style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }} />

      <div className="font-mono uppercase" style={{ fontSize: '0.50rem', letterSpacing: '0.1em', color: '#9ba6ff' }}>
        {mode === 'create' ? 'Add shoot day' : 'Edit shoot day'}
      </div>

      <label className="flex flex-col" style={{ gap: 6 }}>
        <span className="font-mono uppercase" style={{ fontSize: '0.42rem', letterSpacing: '0.1em', color: '#62627a' }}>Date</span>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="font-mono"
          style={{
            padding: '10px 12px', borderRadius: 10,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#e8e8f0', fontSize: '0.78rem',
          }}
        />
      </label>

      <div className="flex flex-col" style={{ gap: 6 }}>
        <span className="font-mono uppercase" style={{ fontSize: '0.42rem', letterSpacing: '0.1em', color: '#62627a' }}>Phase</span>
        <div className="flex" style={{ gap: 8 }}>
          {PHASE_ORDER.map(t => {
            const active = type === t
            const c = PHASE_HEX[t]
            return (
              <button
                key={t} type="button"
                onClick={() => { haptic('light'); setType(t) }}
                className="font-mono uppercase flex-1"
                style={{
                  padding: '10px 0', borderRadius: 10,
                  background: active ? `${c}26` : 'rgba(255,255,255,0.04)',
                  border: active ? `1px solid ${c}73` : '1px solid rgba(255,255,255,0.08)',
                  color: active ? c : '#62627a',
                  fontSize: '0.5rem', letterSpacing: '0.1em',
                }}
              >
                {PHASE_LABEL[t]}
              </button>
            )
          })}
        </div>
      </div>

      {locations.length > 0 && (
        <label className="flex flex-col" style={{ gap: 6 }}>
          <span className="font-mono uppercase" style={{ fontSize: '0.42rem', letterSpacing: '0.1em', color: '#62627a' }}>Location (optional)</span>
          <select
            value={locationId ?? ''}
            onChange={e => setLocationId(e.target.value || null)}
            className="font-mono"
            style={{
              padding: '10px 12px', borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#e8e8f0', fontSize: '0.78rem',
            }}
          >
            <option value="">— None —</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
      )}

      <div className="flex flex-col" style={{ gap: 6 }}>
        <span className="font-mono uppercase" style={{ fontSize: '0.42rem', letterSpacing: '0.1em', color: '#62627a' }}>Notes (optional)</span>
        <div style={{
          padding: '10px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#e8e8f0', fontSize: '0.78rem',
        }}>
          <MentionInput
            value={notes}
            mentions={notesMentions}
            onChange={(text, m) => { setNotes(text); setNotesMentions(m) }}
            roster={roster}
            placeholder="Optional notes…"
            multiline
            accent='#6470f3'
          />
        </div>
      </div>

      <div className="flex items-center" style={{ gap: 10, marginTop: 4 }}>
        {mode === 'edit' && (
          <button
            type="button" onClick={remove}
            className="font-mono uppercase"
            style={{
              padding: '10px 14px', borderRadius: 20,
              background: 'rgba(232,72,72,0.10)', border: '1px solid rgba(232,72,72,0.35)',
              color: '#e84848', fontSize: '0.5rem', letterSpacing: '0.1em',
            }}
          >Delete</button>
        )}
        <button
          type="button" onClick={onClose}
          className="font-mono uppercase"
          style={{
            padding: '10px 14px', borderRadius: 20,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#a0a0b8', fontSize: '0.5rem', letterSpacing: '0.1em',
            marginLeft: 'auto',
          }}
        >Cancel</button>
        <button
          type="button" onClick={submit}
          disabled={!date}
          className="font-mono uppercase"
          style={{
            padding: '10px 18px', borderRadius: 20,
            background: date ? 'rgba(100,112,243,0.16)' : 'rgba(255,255,255,0.04)',
            border: date ? '1px solid rgba(100,112,243,0.45)' : '1px solid rgba(255,255,255,0.06)',
            color: date ? '#9ba6ff' : 'rgba(255,255,255,0.3)',
            fontSize: '0.5rem', letterSpacing: '0.1em',
            cursor: date ? 'pointer' : 'not-allowed',
          }}
        >{mode === 'create' ? 'Add' : 'Save'}</button>
      </div>
    </motion.div>
  )
}