'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useProject, useMilestones, useCreateMilestone, useUpdateMilestone,
  useAddMilestonePerson, useRemoveMilestonePerson, useCrew,
  useShootDays, useLocations,
  useCreateShootDay, useUpdateShootDay, useDeleteShootDay,
  useMentionRoster, useMeId,
  useCallSheets, useCreateCallSheet,
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
import { deriveProjectColors, DEFAULT_PROJECT_HEX } from '@origin-one/ui'
import { useViewerRole } from '@/lib/auth/useViewerRole'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { ThreadRowBadge } from '@/components/threads/ThreadRowBadge'
import { useThreadsByEntity } from '@/components/threads/useThreadsByEntity'
import { useDetailSheetThreads } from '@/components/threads/useDetailSheetThreads'
import type { Milestone, CrewMember, ShootDay, ShootDayType, Location } from '@/types'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

type Mode = 'project' | 'master' | 'days'
type TopTab = 'milestones' | 'schedule'
type ScheduleSub = 'days' | 'callsheet'

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

  // Cinema Glass calendar — see hub-full-preview-v2.html `.cal-card`.
  const ah = accent.startsWith('#') ? accent : '#c45adc'
  const [ar, ag, ab] = [parseInt(ah.slice(1, 3), 16), parseInt(ah.slice(3, 5), 16), parseInt(ah.slice(5, 7), 16)]

  return (
    <div
      className="glass-tile timeline-cal flex-shrink-0"
      style={{
        ['--tile-rgb' as any]: `${ar}, ${ag}, ${ab}`,
        margin: '12px 16px',
        padding: '12px 14px 14px',
      }}
    >
      {/* Month nav — circular 22px chrome buttons + tabular mono caps month label. */}
      <div className="flex items-center justify-center gap-3 mb-2">
        <button onClick={prev} className="flex items-center justify-center cursor-pointer" style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#7a7a82' }} aria-label="Previous month">
          <svg width="6" height="10" viewBox="0 0 6 10" fill="none"><path d="M5 1L1 5L5 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <span className="font-mono uppercase" style={{ fontSize: '0.54rem', fontWeight: 600, letterSpacing: '0.10em', color: '#ebebef', fontVariantNumeric: 'tabular-nums' }}>{MONTHS[mo]} {yr}</span>
        <button onClick={next} className="flex items-center justify-center cursor-pointer" style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#7a7a82' }} aria-label="Next month">
          <svg width="6" height="10" viewBox="0 0 6 10" fill="none"><path d="M1 1L5 5L1 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      {/* Day of week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '0 2px' }}>
        {DOW.map(d => <div key={d} className="font-mono uppercase text-center" style={{ fontSize: '0.36rem', color: '#7a7a82', letterSpacing: '0.10em', padding: '4px 0 2px' }}>{d}</div>)}
      </div>

      {/* Grid — circular cells, accent dot below for milestones, accent halo for today, solid accent fill for selected. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, padding: '0 2px' }}>
        {cells.map((c, i) => {
          const isToday = sameDay(c.date, today)
          const isSelected = selectedDate && sameDay(c.date, selectedDate)
          const dayMilestones = milestones.filter(m => sameDay(m.date, c.date))
          const hasMilestone = dayMilestones.length > 0
          const muted = c.otherMonth

          // Color resolution: selected wins → today → muted → default
          const cellBg = isSelected ? accent
            : isToday ? `rgba(${ar},${ag},${ab},0.18)`
            : 'transparent'
          const cellColor = isSelected ? '#04040a'
            : isToday ? accent
            : muted ? '#7a7a82'
            : '#ebebef'

          return (
            <div
              key={i}
              className="flex flex-col items-center justify-center cursor-pointer relative select-none font-mono"
              style={{
                aspectRatio: '1',
                borderRadius: '50%',
                background: cellBg,
                color: cellColor,
                fontSize: '0.50rem',
                fontWeight: isToday || isSelected ? 600 : 500,
                fontVariantNumeric: 'tabular-nums',
                opacity: muted ? 0.32 : 1,
                pointerEvents: muted ? 'none' : undefined,
                boxShadow: isSelected ? `0 0 10px rgba(${ar},${ag},${ab},0.50)` : undefined,
              }}
              onClick={() => !muted && onSelect(c.date)}
            >
              <span style={{ lineHeight: 1 }}>{c.day}</span>
              {hasMilestone && !isSelected && (
                <div className="absolute" style={{
                  bottom: 3, left: '50%', transform: 'translateX(-50%)',
                  width: 3, height: 3, borderRadius: '50%',
                  background: accent, boxShadow: `0 0 4px ${accent}`,
                }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center" style={{ gap: 10, marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {mode === 'project' ? (
          <>
            {[{ label: 'Upcoming', color: '#e8a020' }, { label: 'In Progress', color: '#6470f3' }, { label: 'Done', color: '#00b894' }].map(l => (
              <div key={l.label} className="flex items-center gap-1">
                <div className="rounded-full" style={{ width: 4, height: 4, background: l.color, boxShadow: `0 0 3px ${l.color}` }} />
                <span className="font-mono uppercase" style={{ fontSize: '0.36rem', color: '#7a7a82', letterSpacing: '0.10em' }}>{l.label}</span>
              </div>
            ))}
          </>
        ) : (
          <div className="flex items-center gap-2.5">
            <span className="font-mono uppercase" style={{ fontSize: '0.36rem', color: '#7a7a82', letterSpacing: '0.10em' }}>Projects:</span>
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
      <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)', margin: '12px auto 18px' }} />
      {/* Header — editable title (sheen-title treatment when displaying) */}
      <div style={{ padding: '0 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex justify-between items-start">
          {editTitle ? (
            <input autoFocus value={titleValue} onChange={e => setTitleValue(e.target.value)} onBlur={saveTitle}
              onKeyDown={e => { if (e.key === 'Enter') saveTitle() }}
              className="outline-none flex-1"
              style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.02em', color: '#ebebef', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '4px 8px' }} />
          ) : (
            <div onClick={() => setEditTitle(true)} className="sheen-title" style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.02em', cursor: 'pointer', flex: 1 }}>{milestone.title}</div>
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

// ── MILESTONE ROW (Cinema Glass .ms-row) ──────────────────
//
// One canonical row used by both Project mode and Master view.
// Date number wears the project accent; the dow caption is mono;
// the vertical rule is an accent gradient; the status pill follows
// the cinema-glass chip pattern (bg @ 0.20, border @ 0.50).

function MilestoneRow({ ms, accent, isNext, highlighted, threadEntry, onClick }: {
  ms: Milestone
  accent: string
  isNext?: boolean
  highlighted?: boolean
  threadEntry: any
  onClick: () => void
}) {
  const d = new Date(ms.date)
  const isDelivery = ms.title.toLowerCase().includes('delivery')
  const ah = accent.startsWith('#') ? accent : '#c45adc'
  const [ar, ag, ab] = [parseInt(ah.slice(1, 3), 16), parseInt(ah.slice(3, 5), 16), parseInt(ah.slice(5, 7), 16)]
  // Status → phase token mapping for the chip pattern.
  // Delivery overrides everything (red); otherwise the milestone status
  // resolves to a phase key consumed by .ai-meta-pill.
  const statusKey = isDelivery ? 'delivery' : (ms.status === 'completed' ? 'post' : ms.status === 'in_progress' ? 'prod' : 'pre')
  const statusBg = isDelivery ? 'rgba(232,86,74,0.20)' : statusKey === 'pre' ? 'rgba(232,160,32,0.20)' : statusKey === 'prod' ? 'rgba(100,112,243,0.20)' : 'rgba(0,184,148,0.20)'
  const statusBorder = isDelivery ? 'rgba(232,86,74,0.50)' : statusKey === 'pre' ? 'rgba(232,160,32,0.50)' : statusKey === 'prod' ? 'rgba(100,112,243,0.50)' : 'rgba(0,184,148,0.50)'
  const statusFg = isDelivery ? '#e8564a' : statusKey === 'pre' ? '#e8a020' : statusKey === 'prod' ? '#6470f3' : '#00b894'
  const statusLabel = isDelivery ? 'Delivery' : (MILESTONE_STATUS_LABEL[ms.status] ?? ms.status)
  return (
    <div data-ms-id={ms.id}
      className="timeline-ms-row flex items-start cursor-pointer transition-all"
      style={{
        position: 'relative',
        gap: 12, padding: highlighted ? '11px 8px' : '11px 0',
        margin: highlighted ? '0 -8px' : undefined,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: highlighted ? `rgba(${ar},${ag},${ab},0.06)` : undefined,
        borderRadius: highlighted ? 7 : undefined,
      }}
      onClick={onClick}>
      <div className="flex-shrink-0 text-center" style={{ width: 36 }}>
        <div className="font-mono" style={{
          fontSize: '1.05rem', fontWeight: 500, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
          color: isDelivery ? '#e8564a' : (isNext ? accent : accent),
        }}>{d.getDate()}</div>
        <div className="font-mono uppercase" style={{ fontSize: '0.34rem', color: '#7a7a82', letterSpacing: '0.10em', marginTop: 4 }}>{DAYS[d.getDay()]}</div>
      </div>
      <div className="flex-shrink-0" style={{
        width: 1, alignSelf: 'stretch', margin: '2px 0',
        background: isDelivery
          ? 'linear-gradient(180deg, transparent, rgba(232,86,74,0.50) 18%, rgba(232,86,74,0.50) 82%, transparent)'
          : `linear-gradient(180deg, transparent, rgba(${ar},${ag},${ab},0.40) 18%, rgba(${ar},${ag},${ab},0.40) 82%, transparent)`,
      }} />
      <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 5, paddingTop: 2 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 500, color: isDelivery ? '#e8564a' : '#ebebef', letterSpacing: '0.005em', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {ms.title}
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="font-mono uppercase inline-flex items-center"
            style={{
              fontSize: '0.32rem', letterSpacing: '0.08em', gap: 4,
              padding: '1px 6px', borderRadius: 10,
              background: statusBg, border: `1px solid ${statusBorder}`, color: statusFg,
            }}
          >
            <span className="rounded-full" style={{ width: 3, height: 3, background: statusFg, boxShadow: `0 0 3px ${statusFg}` }} />
            {statusLabel}
          </span>
        </div>
      </div>
      <svg width="5" height="9" viewBox="0 0 5 9" fill="none" className="flex-shrink-0" style={{ opacity: 0.25, marginTop: 6 }}><path d="M1 1L4 4.5L1 8" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <ThreadRowBadge entry={threadEntry} />
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────

export default function TimelinePage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const router = useRouter()
  const { data: project } = useProject(projectId)
  const accent = project?.color || getProjectColor(projectId)
  const accentHex = accent.startsWith('#') ? accent : '#c45adc'
  const accentRgb = `${parseInt(accentHex.slice(1, 3), 16)}, ${parseInt(accentHex.slice(3, 5), 16)}, ${parseInt(accentHex.slice(5, 7), 16)}`
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

  const search = useSearchParams()
  const initialTopTab = (search?.get('tab') === 'schedule' ? 'schedule' : 'milestones') as TopTab
  const initialScheduleSub = (search?.get('sub') === 'callsheet' ? 'callsheet' : 'days') as ScheduleSub

  const [topTab, setTopTab] = useState<TopTab>(initialTopTab)
  const [scheduleSub, setScheduleSub] = useState<ScheduleSub>(initialScheduleSub)
  const [mode, setMode] = useState<Mode>(initialTopTab === 'schedule' ? 'days' : 'project')

  // Sync the legacy `mode` to the new tab+sub state so the existing
  // body conditionals and FAB switch continue to work.
  useEffect(() => {
    if (topTab === 'schedule' && scheduleSub === 'days') setMode('days')
    else if (topTab === 'milestones' && mode === 'days') setMode('project')
  }, [topTab, scheduleSub])

  // Bounce non-producers off the Callsheet sub-tab — Schedule > Days
  // is visible to everyone; Schedule > Callsheet is producer-only.
  useEffect(() => {
    if (topTab === 'schedule' && scheduleSub === 'callsheet' && role !== null && !isProducer) {
      setScheduleSub('days')
    }
  }, [topTab, scheduleSub, role, isProducer])
  const [month, setMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedMS, setSelectedMS] = useState<Milestone | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showCreateCallSheet, setShowCreateCallSheet] = useState(false)
  // Register the + handler with the global ActionBar. The handler
  // switches based on active tab — milestone create on Milestones,
  // shoot-day create on Schedule>Days, call-sheet create on
  // Schedule>Callsheet.
  useFabAction(
    {
      onPress: () => {
        haptic('light')
        if (topTab === 'schedule' && scheduleSub === 'callsheet') setShowCreateCallSheet(true)
        else if (topTab === 'schedule') setShowCreateDay(true)
        else setShowAdd(true)
      },
      label:
        topTab === 'schedule' && scheduleSub === 'callsheet' ? 'New call sheet'
        : topTab === 'schedule' ? 'Add shoot day'
        : undefined,
    },
    [topTab, scheduleSub],
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

  // Cinema Glass — feed `--accent-rgb` / `--accent-glow-rgb` to .sheen-title
  // and any rgba(var(--accent-rgb),…) consumer below. Same pattern as
  // HubContent. Project tokens stay inline-hex on JSX where the spec
  // calls for the raw accent (Locations/Art precedent).
  const accentColors = deriveProjectColors(accent || DEFAULT_PROJECT_HEX)
  const [ar, ag, ab] = [parseInt(accentColors.primary.slice(1, 3), 16), parseInt(accentColors.primary.slice(3, 5), 16), parseInt(accentColors.primary.slice(5, 7), 16)]
  const glowR = Math.min(255, ar + 20), glowG = Math.min(255, ag + 20), glowB = Math.min(255, ab + 20)

  return (
    <div
      className="screen"
      style={{
        overflow: 'hidden',
        ['--accent-rgb' as string]: `${ar}, ${ag}, ${ab}`,
        ['--accent-glow-rgb' as string]: `${glowR}, ${glowG}, ${glowB}`,
        ['--tile-rgb' as string]: `${ar}, ${ag}, ${ab}`,
        ['--accent' as string]: accent,
      }}>
      {/* Header — title + status pill. Primary tabs (Milestones | Schedule)
          render below the header. Secondary toggle on the right of the
          header switches inside whichever primary tab is active. */}
      <PageHeader
        projectId={projectId}
        title="Timeline"
        meta={project ? (
          <div className="flex flex-col items-center gap-1.5">
            <ProjectSwitcher projectId={projectId} projectName={project.name} accentColor={accent} variant="meta" />
            <span
              className="font-mono uppercase"
              style={{
                fontSize: '0.42rem',
                letterSpacing: '0.08em',
                padding: '1px 7px',
                borderRadius: 20,
                background: `${statusHex(project.status)}33`,
                border: `1px solid ${statusHex(project.status)}80`,
                color: statusHex(project.status),
                fontWeight: 600,
              }}
            >
              {projectStatusLabel}
            </span>
          </div>
        ) : ''}
        right={
          topTab === 'milestones' ? (
            <div className="timeline-mode-toggle flex items-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 2, gap: 1 }}>
              <button onClick={() => setMode('project')}
                className={`font-mono uppercase cursor-pointer select-none whitespace-nowrap ${mode === 'project' ? 'sheen-title' : ''}`}
                style={{ fontSize: '0.42rem', letterSpacing: '0.06em', padding: '4px 9px', borderRadius: 16, fontWeight: 600,
                  ...(mode === 'project'
                    ? { boxShadow: `inset 0 0 0 1px rgba(${ar}, ${ag}, ${ab}, 0.32)` }
                    : { color: '#7a7a82', border: '1px solid transparent', background: 'transparent' }) }}>
                Project
              </button>
              <button onClick={() => { setMode('master'); setSelectedDate(null) }}
                className={`font-mono uppercase cursor-pointer select-none whitespace-nowrap ${mode === 'master' ? 'sheen-title' : ''}`}
                style={{ fontSize: '0.42rem', letterSpacing: '0.06em', padding: '4px 9px', borderRadius: 16, fontWeight: 600,
                  ...(mode === 'master'
                    ? { boxShadow: `inset 0 0 0 1px rgba(${ar}, ${ag}, ${ab}, 0.32)` }
                    : { color: '#7a7a82', border: '1px solid transparent', background: 'transparent' }) }}>
                Master
              </button>
            </div>
          ) : (
            <div className="timeline-mode-toggle flex items-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 2, gap: 1 }}>
              <button onClick={() => { haptic('light'); setScheduleSub('days') }}
                className={`font-mono uppercase cursor-pointer select-none whitespace-nowrap ${scheduleSub === 'days' ? 'sheen-title' : ''}`}
                style={{ fontSize: '0.42rem', letterSpacing: '0.06em', padding: '4px 9px', borderRadius: 16, fontWeight: 600,
                  ...(scheduleSub === 'days'
                    ? { boxShadow: `inset 0 0 0 1px rgba(${ar}, ${ag}, ${ab}, 0.32)` }
                    : { color: '#7a7a82', border: '1px solid transparent', background: 'transparent' }) }}>
                Days
              </button>
              {isProducer && (
                <button onClick={() => { haptic('light'); setScheduleSub('callsheet') }}
                  className="font-mono uppercase cursor-pointer select-none whitespace-nowrap"
                  style={{ fontSize: '0.42rem', letterSpacing: '0.06em', padding: '4px 9px', borderRadius: 16, fontWeight: 600,
                    ...(scheduleSub === 'callsheet'
                      ? { background: 'rgba(0,184,148,0.20)', color: '#00b894', border: '1px solid rgba(0,184,148,0.50)' }
                      : { color: '#7a7a82', border: '1px solid transparent', background: 'transparent' }) }}>
                  Callsheet
                </button>
              )}
            </div>
          )
        }
      />

      {/* Primary tab strip — Milestones | Schedule. Visible to everyone;
          Callsheet sub-tab is gated to producers (right slot). */}
      <div className="flex items-center justify-center gap-2 px-4 pb-3 pt-2 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {(['milestones', 'schedule'] as TopTab[]).map(t => {
          const active = topTab === t
          return (
            <button
              key={t}
              onClick={() => { haptic('light'); setTopTab(t) }}
              className={`font-mono uppercase cursor-pointer select-none ${active ? 'sheen-title' : ''}`}
              style={{
                fontSize: '0.5rem', letterSpacing: '0.1em', fontWeight: 700,
                padding: '6px 14px', borderRadius: 18,
                ...(active
                  ? { boxShadow: `inset 0 0 0 1px rgba(${ar}, ${ag}, ${ab}, 0.32)` }
                  : { background: 'transparent', color: '#7a7a82', border: '1px solid transparent' }),
              }}
            >
              {t}
            </button>
          )
        })}
      </div>

      {/* Schedule > Callsheet — producer-only inline list of project call sheets.
          Detail (Compose / Recipients / Tracking) lives at /call-sheets/[id]. */}
      {topTab === 'schedule' && scheduleSub === 'callsheet' && isProducer ? (
        <CallsheetTabContent
          projectId={projectId}
          accent={accent}
          shootDays={days}
          showCreate={showCreateCallSheet}
          setShowCreate={setShowCreateCallSheet}
        />
      ) : topTab === 'schedule' && scheduleSub === 'days' ? (
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
                <div className="font-mono" style={{ fontSize: '0.46rem', color: '#7a7a82', letterSpacing: '0.04em', lineHeight: 1.6 }}>
                  Nothing scheduled across<br />any project on this date.
                </div>
              </div>
            )
            return (
              <>
                <div className="sheen-title text-center" style={{ fontWeight: 700, fontSize: '0.84rem', letterSpacing: '-0.01em', padding: '14px 0 10px', fontVariantNumeric: 'tabular-nums' }}>
                  {MONTHS[selectedDate.getMonth()]} {selectedDate.getDate()}, {selectedDate.getFullYear()}
                </div>
                <div
                  className="glass-tile timeline-ms-list"
                  style={{ ['--tile-rgb' as any]: accentRgb, padding: '0 14px' }}
                >
                  {dayMs.map(ms => (
                    <MilestoneRow
                      key={ms.id}
                      ms={ms}
                      accent={accent}
                      threadEntry={threadByMilestoneId.get(ms.id)}
                      onClick={() => setSelectedMS(ms)}
                    />
                  ))}
                </div>
              </>
            )
          })()
        ) : (
          /* Project mode: full milestone list grouped by month */
          <>
            {sorted.length === 0 ? <EmptyState text="No milestones yet" /> : monthGroups.map(group => (
              <div key={group.label}>
                <div className="sheen-title text-center" style={{ fontWeight: 700, fontSize: '0.84rem', letterSpacing: '-0.01em', padding: '14px 0 10px', fontVariantNumeric: 'tabular-nums' }}>
                  {group.label}
                </div>
                <div
                  className="glass-tile timeline-ms-list"
                  style={{ ['--tile-rgb' as any]: accentRgb, padding: '0 14px' }}
                >
                  {group.items.map(ms => {
                    const isNext = !ms.title.toLowerCase().includes('delivery') && sorted.indexOf(ms) === sorted.findIndex(m => new Date(m.date) >= new Date())
                    const highlighted = highlightId === ms.id
                    return (
                      <MilestoneRow
                        key={ms.id}
                        ms={ms}
                        accent={accent}
                        isNext={isNext}
                        highlighted={highlighted}
                        threadEntry={threadByMilestoneId.get(ms.id)}
                        onClick={() => setSelectedMS(ms)}
                      />
                    )
                  })}
                </div>
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
      {/* Phase counts strip — chip pattern matches the cinema-glass
          .ai-meta-pill anatomy; one chip per phase (Prep / Shoot / Post). */}
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{ gap: 8, padding: '12px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        {PHASE_ORDER.map(t => {
          const c = PHASE_HEX[t]
          const has = counts[t] > 0
          return (
            <span
              key={t}
              className="font-mono uppercase inline-flex items-center"
              style={{
                gap: 5, padding: '2px 8px', borderRadius: 20,
                fontSize: '0.42rem', letterSpacing: '0.08em', fontWeight: 600,
                background: has ? `${c}33` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${has ? `${c}80` : 'rgba(255,255,255,0.08)'}`,
                color: has ? c : '#7a7a82',
              }}
            >
              <span className="rounded-full" style={{ width: 4, height: 4, background: has ? c : '#7a7a82', boxShadow: has ? `0 0 4px ${c}` : undefined }} />
              {PHASE_LABEL[t]} {counts[t]}
            </span>
          )
        })}
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
  // Cinema Glass chip — phase-tinted bg @ 0.20, border @ 0.50, mono caps.
  return (
    <span
      className="font-mono uppercase inline-flex items-center"
      style={{
        gap: 4,
        fontSize: '0.42rem', letterSpacing: '0.08em', fontWeight: 600,
        padding: '2px 8px', borderRadius: 20,
        background: `${c}33`, border: `1px solid ${c}80`, color: c,
        flexShrink: 0,
      }}
    >
      <span className="rounded-full" style={{ width: 4, height: 4, background: c, boxShadow: `0 0 4px ${c}` }} />
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
  // Per-row tile-rgb keyed to the day's phase so each row glows the
  // phase color (Prep amber / Shoot indigo / Post teal) — cinema-glass
  // .glass-tile cascade with --tile-rgb override.
  const phaseRgb: Record<ShootDayType, string> = {
    pre:  '232, 160, 32',
    prod: '100, 112, 243',
    post: '0, 184, 148',
  }
  return (
    <button
      type="button"
      onClick={() => { haptic('light'); onTap() }}
      className="glass-tile-sm w-full text-left active:opacity-80 transition-opacity"
      style={{
        ['--tile-rgb' as string]: phaseRgb[day.type],
        padding: '12px 14px',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gridTemplateRows: 'auto auto',
        rowGap: 4, columnGap: 8,
        alignItems: 'center',
      }}
    >
      <div style={{ fontSize: '0.85rem', color: '#ebebef', fontWeight: 500 }}>
        {shootDayFormatDate(day.date)}
      </div>
      <PhaseChip type={day.type} />
      <div
        className="font-mono uppercase"
        style={{
          fontSize: '0.42rem', letterSpacing: '0.08em', color: '#7a7a82',
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
  const router = useRouter()
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

      {mode === 'edit' && day && (
        <button
          type="button"
          onClick={() => { haptic('light'); router.push(`/projects/${projectId}/timeline/${day.id}`) }}
          className="font-mono uppercase flex items-center justify-between"
          style={{
            padding: '12px 14px', borderRadius: 12,
            background: 'rgba(100,112,243,0.10)', border: '1px solid rgba(100,112,243,0.30)',
            color: '#9ba6ff', fontSize: '0.55rem', letterSpacing: '0.1em',
          }}
        >
          <span>Open Daily Schedule</span>
          <span aria-hidden>→</span>
        </button>
      )}

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

// ── CALLSHEET TAB CONTENT ─────────────────────────────────
// Producer-only sub-tab inside Schedule. Lists call sheets in the project
// and lets the AD spin one up bound to a shoot day. Tapping a row goes
// to /call-sheets/[id] (Compose / Recipients / Tracking tabs).

function CallsheetTabContent({
  projectId, accent, shootDays, showCreate, setShowCreate,
}: {
  projectId: string
  accent: string
  shootDays: ShootDay[]
  showCreate: boolean
  setShowCreate: (v: boolean) => void
}) {
  const router = useRouter()
  const { data: callSheets = [], isLoading } = useCallSheets(projectId)
  const shootDayById = useMemo(() => new Map(shootDays.map(d => [d.id, d])), [shootDays])

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><LoadingState /></div>

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar" style={{ WebkitOverflowScrolling: 'touch', padding: '16px 16px 100px' }}>
      {callSheets.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center text-white/40">
          No call sheets yet. Tap + to create one.
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-w-2xl mx-auto">
          {callSheets.map(cs => {
            const sd = shootDayById.get(cs.shootDayId)
            const phaseHex = sd ? PHASE_HEX[sd.type] : '#62627a'
            const statusColor = cs.status === 'sent' ? '#34d399' : '#62627a'
            return (
              <button
                key={cs.id}
                onClick={() => { haptic('light'); router.push(`/projects/${projectId}/call-sheets/${cs.id}`) }}
                className="text-left bg-white/[0.04] border border-white/10 rounded-2xl p-4 active:bg-white/[0.08]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-white">{cs.title || 'Untitled call sheet'}</div>
                    <div className="font-mono uppercase tracking-wider text-[10px] text-white/50 mt-0.5">
                      {sd ? shootDayFormatDate(sd.date) : 'No shoot day'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {sd && (
                      <span className="font-mono uppercase text-[9px] tracking-widest px-2 py-0.5 rounded-full"
                        style={{ background: `${phaseHex}1a`, color: phaseHex, border: `1px solid ${phaseHex}33` }}>
                        {PHASE_LABEL[sd.type]}
                      </span>
                    )}
                    <span className="font-mono uppercase text-[9px] tracking-widest px-2 py-0.5 rounded-full"
                      style={{ background: `${statusColor}1a`, color: statusColor, border: `1px solid ${statusColor}33` }}>
                      {cs.status}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {showCreate && (
          <CreateCallSheetSheet
            projectId={projectId}
            shootDays={shootDays}
            usedShootDayIds={new Set(callSheets.map(cs => cs.shootDayId))}
            onClose={() => setShowCreate(false)}
            onCreated={(id) => { setShowCreate(false); router.push(`/projects/${projectId}/call-sheets/${id}`) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function CreateCallSheetSheet({
  projectId, shootDays, usedShootDayIds, onClose, onCreated,
}: {
  projectId: string
  shootDays: ShootDay[]
  usedShootDayIds: Set<string>
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const createMut = useCreateCallSheet(projectId)
  const [shootDayId, setShootDayId] = useState<string>('')
  const [title, setTitle] = useState<string>('')

  const eligible = shootDays.filter(d => !usedShootDayIds.has(d.id) && d.type !== 'post')

  async function submit() {
    if (!shootDayId) return
    const cs = await createMut.mutateAsync({ projectId, shootDayId, title: title.trim() || null })
    if (cs?.id) onCreated(cs.id)
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
      <div className="font-mono uppercase" style={{ fontSize: '0.50rem', letterSpacing: '0.1em', color: '#00b894' }}>
        New call sheet
      </div>

      <label className="flex flex-col" style={{ gap: 6 }}>
        <span className="font-mono uppercase" style={{ fontSize: '0.42rem', letterSpacing: '0.1em', color: '#62627a' }}>Shoot Day</span>
        <select
          value={shootDayId}
          onChange={e => setShootDayId(e.target.value)}
          className="font-mono"
          style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#e8e8f0', fontSize: '0.78rem' }}
        >
          <option value="">Select a shoot day…</option>
          {eligible.map(d => (
            <option key={d.id} value={d.id}>{shootDayFormatDate(d.date)} — {PHASE_LABEL[d.type]}</option>
          ))}
        </select>
        {eligible.length === 0 && (
          <span className="text-xs text-white/40">All eligible shoot days already have call sheets.</span>
        )}
      </label>

      <label className="flex flex-col" style={{ gap: 6 }}>
        <span className="font-mono uppercase" style={{ fontSize: '0.42rem', letterSpacing: '0.1em', color: '#62627a' }}>Title (optional)</span>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Gibbon Slackboard"
          className="font-mono"
          style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#e8e8f0', fontSize: '0.78rem' }}
        />
      </label>

      <div className="flex items-center" style={{ gap: 10, marginTop: 4 }}>
        <button type="button" onClick={onClose} className="font-mono uppercase"
          style={{ padding: '10px 14px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#a0a0b8', fontSize: '0.5rem', letterSpacing: '0.1em', marginLeft: 'auto' }}>
          Cancel
        </button>
        <button type="button" onClick={submit} disabled={!shootDayId || createMut.isPending} className="font-mono uppercase"
          style={{ padding: '10px 18px', borderRadius: 20, background: shootDayId ? 'rgba(0,184,148,0.16)' : 'rgba(255,255,255,0.04)', border: shootDayId ? '1px solid rgba(0,184,148,0.45)' : '1px solid rgba(255,255,255,0.06)', color: shootDayId ? '#00b894' : 'rgba(255,255,255,0.3)', fontSize: '0.5rem', letterSpacing: '0.1em', cursor: shootDayId ? 'pointer' : 'not-allowed' }}>
          {createMut.isPending ? 'Creating…' : 'Create'}
        </button>
      </div>
    </motion.div>
  )
}