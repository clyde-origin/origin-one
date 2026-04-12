'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useProjects, useAllActionItems, useAllMilestones, useAllThreads, useToggleActionItem,
} from '@/lib/hooks/useOriginOne'
import { getProjectColor, MILESTONE_STATUS_HEX, STATUS_HEX } from '@/lib/utils/phase'
import { GhostCircle, GhostRect, GhostPill } from '@/components/ui/EmptyState'
import { haptic } from '@/lib/utils/haptics'
import type { ActionItem, Milestone, Thread, Project } from '@/types'

// ── TYPES ────────────────────────────────────────────────────

export type PanelId = 'tasks' | 'milestones' | 'schedule' | 'threads' | 'activity'

const PANEL_ORDER: PanelId[] = ['tasks', 'milestones', 'schedule', 'threads', 'activity']
const PANEL_TITLES: Record<PanelId, string> = {
  tasks: 'Action Items',
  milestones: 'Milestones',
  schedule: 'Schedule',
  threads: 'Threads',
  activity: 'Activity',
}

// ── HELPERS ──────────────────────────────────────────────────

function hexToRgba(hex: string | null | undefined, a: number) {
  const h = hex || '#444444'
  const r = parseInt(h.slice(1, 3), 16)
  const g = parseInt(h.slice(3, 5), 16)
  const b = parseInt(h.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - now.getTime()) / 86400000)
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isToday(dateStr: string): boolean {
  return daysUntil(dateStr) === 0
}

function projectName(projects: Project[], projectId: string): string {
  return projects.find(p => p.id === projectId)?.name ?? 'Project'
}

// ── SECTION HEADER ───────────────────────────────────────────

function Sec({ label, count, countColor }: { label: string; count?: number; countColor?: string }) {
  return (
    <div style={{
      fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#62627a',
      textTransform: 'uppercase', letterSpacing: '0.1em',
      padding: '11px 0 5px', display: 'flex', justifyContent: 'space-between',
    }}>
      <span>{label}</span>
      {count !== undefined && <span style={{ color: countColor || '#62627a' }}>{count}</span>}
    </div>
  )
}

// ── PROJECT PILL ─────────────────────────────────────────────

function ProjPill({ name }: { name: string }) {
  return (
    <span style={{
      fontFamily: "'DM Mono', monospace", fontSize: 9, padding: '1px 6px',
      borderRadius: 20, background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.07)', color: '#62627a', whiteSpace: 'nowrap',
    }}>
      {name}
    </span>
  )
}

// ── PANEL DOTS ───────────────────────────────────────────────

function PanelDots({ activeIdx }: { activeIdx: number }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {PANEL_ORDER.map((_, i) => (
        <div key={i} style={{
          width: i === activeIdx ? 14 : 4, height: 4, borderRadius: i === activeIdx ? 2 : '50%',
          background: i === activeIdx ? '#c45adc' : 'rgba(255,255,255,0.12)',
          transition: 'width 0.2s, background 0.2s',
        }} />
      ))}
    </div>
  )
}

// ── EMPTY ROWS ───────────────────────────────────────────────

function EmptyPanelRows() {
  return (
    <div style={{ padding: '20px 0' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <GhostCircle size={17} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <GhostRect w={120 + i * 20} h={10} />
            <div style={{ display: 'flex', gap: 6 }}>
              <GhostPill w={52} h={14} />
              <GhostRect w={36} h={10} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// ACTION ITEMS PANEL
// ══════════════════════════════════════════════════════════════

function ActionItemsPanel({ items, projects }: { items: ActionItem[]; projects: Project[] }) {
  const overdue  = items.filter(i => i.status !== 'done' && i.dueDate && daysUntil(i.dueDate) < 0)
  const today    = items.filter(i => i.status !== 'done' && i.dueDate && isToday(i.dueDate))
  const upcoming = items.filter(i => i.status !== 'done' && i.dueDate && daysUntil(i.dueDate) > 0)
  const undated  = items.filter(i => i.status !== 'done' && !i.dueDate)
  const done     = items.filter(i => i.status === 'done')
  const openCount = items.filter(i => i.status !== 'done').length

  if (items.length === 0) return <EmptyPanelRows />

  return (
    <>
      <div className="font-mono" style={{ fontSize: 10, color: '#62627a', padding: '0 0 4px' }}>
        {openCount} open{overdue.length > 0 ? ` · ${overdue.length} overdue` : ''}
      </div>
      {overdue.length > 0 && (
        <>
          <Sec label="Overdue" count={overdue.length} countColor="#e8564a" />
          {overdue.map(item => (
            <ActionRow key={item.id} item={item} pName={projectName(projects, item.projectId)} variant="overdue" />
          ))}
        </>
      )}
      {today.length > 0 && (
        <>
          <Sec label="Today" count={today.length} />
          {today.map(item => (
            <ActionRow key={item.id} item={item} pName={projectName(projects, item.projectId)} variant="today" />
          ))}
        </>
      )}
      {(upcoming.length > 0 || undated.length > 0) && (
        <>
          <Sec label="Upcoming" count={upcoming.length + undated.length} />
          {upcoming.map(item => (
            <ActionRow key={item.id} item={item} pName={projectName(projects, item.projectId)} variant="upcoming" />
          ))}
          {undated.map(item => (
            <ActionRow key={item.id} item={item} pName={projectName(projects, item.projectId)} variant="upcoming" />
          ))}
        </>
      )}
      {done.length > 0 && (
        <>
          <Sec label="Done" />
          {done.slice(0, 5).map(item => (
            <ActionRow key={item.id} item={item} pName={projectName(projects, item.projectId)} variant="done" />
          ))}
        </>
      )}
    </>
  )
}

function ActionRow({ item, pName, variant }: { item: ActionItem; pName: string; variant: 'overdue' | 'today' | 'upcoming' | 'done' }) {
  const toggle = useToggleActionItem(item.projectId)
  const chkColors = {
    overdue: { border: 'rgba(232,86,74,0.5)', bg: 'rgba(232,86,74,0.08)' },
    today: { border: 'rgba(196,90,220,0.5)', bg: 'rgba(196,90,220,0.08)' },
    upcoming: { border: 'rgba(255,255,255,0.12)', bg: 'transparent' },
    done: { border: 'rgba(0,184,148,0.4)', bg: 'rgba(0,184,148,0.1)' },
  }
  const dtColors = {
    overdue: '#e8564a', today: '#c45adc', upcoming: '#e8a020', done: '#00b894',
  }
  const days = item.dueDate ? daysUntil(item.dueDate) : null
  const dateLabel = variant === 'done' ? 'Done'
    : days === null ? ''
    : days === 0 ? 'Today'
    : days < 0 ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} late`
    : formatDate(item.dueDate!)

  return (
    <div style={{ padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div
        onClick={() => { haptic('light'); toggle.mutate({ id: item.id, done: item.status !== 'done' }) }}
        style={{
          width: 17, height: 17, borderRadius: '50%', flexShrink: 0, marginTop: 1, cursor: 'pointer',
          border: `1.5px solid ${chkColors[variant].border}`, background: chkColors[variant].bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, color: variant === 'done' ? '#00b894' : 'transparent',
        }}>
        {variant === 'done' && '✓'}
      </div>
      <div>
        <div style={{
          fontWeight: 500, fontSize: 13, color: variant === 'done' ? '#62627a' : '#dddde8',
          lineHeight: 1.3,
          textDecoration: variant === 'done' ? 'line-through' : 'none',
          textDecorationColor: '#62627a',
        }}>
          {item.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
          <ProjPill name={pName} />
          {dateLabel && (
            <span className="font-mono" style={{ fontSize: 9, color: dtColors[variant] }}>{dateLabel}</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// MILESTONES PANEL
// ══════════════════════════════════════════════════════════════

function MilestonesPanel({ milestones, projects }: { milestones: Milestone[]; projects: Project[] }) {
  const upcoming = milestones.filter(m => daysUntil(m.date) >= 0).sort((a, b) => daysUntil(a.date) - daysUntil(b.date))
  const past = milestones.filter(m => daysUntil(m.date) < 0)

  if (milestones.length === 0) return <EmptyPanelRows />

  return (
    <>
      <div className="font-mono" style={{ fontSize: 10, color: '#62627a', padding: '0 0 4px' }}>
        {upcoming.length} upcoming · {new Set(milestones.map(m => m.projectId)).size} project{new Set(milestones.map(m => m.projectId)).size !== 1 ? 's' : ''}
      </div>
      {upcoming.length > 0 && (
        <>
          <Sec label="Upcoming" />
          {upcoming.map(ms => {
            const days = daysUntil(ms.date)
            const cdColor = days <= 7 ? '#e8564a' : days <= 14 ? '#e8a020' : '#62627a'
            const dotColor = MILESTONE_STATUS_HEX[ms.status] ?? '#c45adc'
            return (
              <div key={ms.id} style={{ padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#dddde8' }}>{ms.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <ProjPill name={projectName(projects, ms.projectId)} />
                    <span className="font-mono" style={{ fontSize: 9, color: days <= 14 ? '#e8a020' : '#62627a' }}>{formatDate(ms.date)}</span>
                  </div>
                </div>
                <span className="font-mono" style={{ fontSize: 10, color: cdColor, flexShrink: 0 }}>
                  {days === 0 ? 'Today' : `${days}d`}
                </span>
              </div>
            )
          })}
        </>
      )}
      {past.length > 0 && (
        <>
          <Sec label="Completed" />
          {past.map(ms => (
            <div key={ms.id} style={{ padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 10, opacity: 0.5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00b894', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#62627a' }}>{ms.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <ProjPill name={projectName(projects, ms.projectId)} />
                </div>
              </div>
              <span className="font-mono" style={{ fontSize: 10, color: '#00b894', flexShrink: 0 }}>Done</span>
            </div>
          ))}
        </>
      )}
    </>
  )
}

// ══════════════════════════════════════════════════════════════
// SCHEDULE PANEL (mini calendar + event list from milestones/shoots)
// ══════════════════════════════════════════════════════════════

function SchedulePanel({ milestones, projects }: { milestones: Milestone[]; projects: Project[] }) {
  const today = new Date()
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Build events from milestones + project shoot dates
  const events = useMemo(() => {
    const evts: { date: string; title: string; sub: string; type: string; color: string; projectName: string; time: string }[] = []
    // Milestones as events
    milestones.forEach(ms => {
      evts.push({
        date: ms.date,
        title: `Milestone: ${ms.title}`,
        sub: `${projectName(projects, ms.projectId)} · ${ms.status}`,
        type: 'Milestone',
        color: '#e8564a',
        projectName: projectName(projects, ms.projectId),
        time: '—',
      })
    })
    // Shoot date ranges from projects
    projects.forEach(p => {
      if ((p as any).shootDate) {
        const start = new Date((p as any).shootDate)
        const end = (p as any).shootDateEnd ? new Date((p as any).shootDateEnd) : start
        const cur = new Date(start)
        let dayNum = 1
        while (cur <= end) {
          evts.push({
            date: cur.toISOString().split('T')[0],
            title: `Shoot Day ${dayNum}`,
            sub: p.name,
            type: 'Shoot',
            color: '#6470f3',
            projectName: p.name,
            time: 'All day',
          })
          cur.setDate(cur.getDate() + 1)
          dayNum++
        }
      }
    })
    return evts
  }, [milestones, projects])

  // Calendar data
  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const daysInPrev = new Date(viewYear, viewMonth, 0).getDate()
  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const cells: { day: number; isOther: boolean; dateStr: string }[] = []
  // Previous month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrev - i
    const m = viewMonth === 0 ? 12 : viewMonth
    const y = viewMonth === 0 ? viewYear - 1 : viewYear
    cells.push({ day: d, isOther: true, dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` })
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, isOther: false, dateStr: `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` })
  }
  // Fill rest of last week
  const remainder = 7 - (cells.length % 7)
  if (remainder < 7) {
    for (let d = 1; d <= remainder; d++) {
      const m = viewMonth === 11 ? 1 : viewMonth + 2
      const y = viewMonth === 11 ? viewYear + 1 : viewYear
      cells.push({ day: d, isOther: true, dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` })
    }
  }

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // Events for selected date
  const selectedEvents = selectedDate ? events.filter(e => e.date === selectedDate) : []
  // If nothing selected, show upcoming events
  const displayEvents = selectedDate ? selectedEvents : events.filter(e => daysUntil(e.date) >= 0).slice(0, 6)
  const displayLabel = selectedDate
    ? `${formatDate(selectedDate)} — ${selectedEvents.length} event${selectedEvents.length !== 1 ? 's' : ''}`
    : 'Upcoming'

  const typeColors: Record<string, { bg: string; border: string; text: string }> = {
    Shoot: { bg: 'rgba(100,112,243,0.12)', border: 'rgba(100,112,243,0.2)', text: '#6470f3' },
    Milestone: { bg: 'rgba(232,86,74,0.12)', border: 'rgba(232,86,74,0.2)', text: '#e8564a' },
    Scout: { bg: 'rgba(232,160,32,0.12)', border: 'rgba(232,160,32,0.2)', text: '#e8a020' },
    Meeting: { bg: 'rgba(74,184,232,0.12)', border: 'rgba(74,184,232,0.2)', text: '#4ab8e8' },
    Delivery: { bg: 'rgba(232,86,74,0.12)', border: 'rgba(232,86,74,0.2)', text: '#e8564a' },
  }

  return (
    <>
      {/* Mini calendar - fixed above scroll */}
      <div style={{ padding: '0 18px', flexShrink: 0 }}>
        <div style={{ padding: '12px 0 6px' }}>
          {/* Nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px', marginBottom: 10 }}>
            <div onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) } else setViewMonth(m => m - 1) }}
              style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#62627a', fontSize: 12, cursor: 'pointer' }}>
              ‹
            </div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#dddde8' }}>{monthLabel}</div>
            <div onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) } else setViewMonth(m => m + 1) }}
              style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#62627a', fontSize: 12, cursor: 'pointer' }}>
              ›
            </div>
          </div>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className="font-mono" style={{ fontSize: 9, color: '#62627a', textAlign: 'center', paddingBottom: 6, letterSpacing: '0.04em' }}>{d}</div>
            ))}
            {/* Day cells */}
            {cells.map((c, i) => {
              const isTodayCell = c.dateStr === todayStr
              const isSelected = c.dateStr === selectedDate
              const dayEvents = events.filter(e => e.date === c.dateStr)
              const dotColors = Array.from(new Set(dayEvents.map(e => e.color)))
              return (
                <div key={i} onClick={() => { setSelectedDate(c.dateStr === selectedDate ? null : c.dateStr); haptic('light') }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2px 0 4px',
                    cursor: 'pointer', borderRadius: 8, position: 'relative',
                    background: isSelected ? 'rgba(196,90,220,0.15)' : 'transparent',
                  }}>
                  <div className="font-mono" style={{
                    fontSize: 11, lineHeight: 1,
                    color: isTodayCell ? '#c45adc' : isSelected ? '#c45adc' : c.isOther ? 'rgba(98,98,122,0.3)' : '#a0a0b8',
                    fontWeight: isTodayCell ? 700 : 400,
                  }}>
                    {c.day}
                  </div>
                  <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 2, minHeight: 5 }}>
                    {dotColors.slice(0, 3).map((color, di) => (
                      <div key={di} style={{ width: 4, height: 4, borderRadius: '50%', background: color }} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '8px 0 0' }} />
        </div>
      </div>

      {/* Scrolling event list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 18px 16px', WebkitOverflowScrolling: 'touch' }}
        className="no-scrollbar">
        <Sec label={displayLabel} />
        {displayEvents.length === 0 ? (
          <div className="font-mono" style={{ fontSize: 11, color: 'rgba(98,98,122,0.5)', padding: '20px 0', textAlign: 'center' }}>
            No events
          </div>
        ) : (
          displayEvents.map((evt, i) => {
            const tc = typeColors[evt.type] || typeColors.Milestone
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: i < displayEvents.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <div style={{ width: 36, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 2 }}>
                  <div className="font-mono" style={{ fontSize: 9, color: '#62627a', lineHeight: 1.2, textAlign: 'center' }}>{evt.time}</div>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: evt.color, marginTop: 4, flexShrink: 0 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#dddde8' }}>{evt.title}</div>
                  <div className="font-mono" style={{ fontSize: 9, color: '#62627a', marginTop: 2 }}>{evt.sub}</div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                    <span className="font-mono" style={{
                      fontSize: 9, padding: '1px 6px', borderRadius: 20,
                      background: tc.bg, border: `1px solid ${tc.border}`, color: tc.text,
                    }}>{evt.type}</span>
                    <ProjPill name={evt.projectName} />
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}

// ══════════════════════════════════════════════════════════════
// THREADS PANEL
// ══════════════════════════════════════════════════════════════

function ThreadsPanel({ threads, projects }: { threads: Thread[]; projects: Project[] }) {
  if (threads.length === 0) return <EmptyPanelRows />

  const avatarColors = [
    { bg: 'rgba(100,112,243,0.2)', text: '#6470f3' },
    { bg: 'rgba(74,232,160,0.2)', text: '#4ae8a0' },
    { bg: 'rgba(232,196,74,0.2)', text: '#e8c44a' },
    { bg: 'rgba(74,184,232,0.2)', text: '#4ab8e8' },
    { bg: 'rgba(196,90,220,0.2)', text: '#c45adc' },
  ]

  const renderThread = (t: Thread, i: number) => {
    const ac = avatarColors[i % avatarColors.length]
    const lastMsg = t.messages[t.messages.length - 1]
    const preview = lastMsg?.content ?? ''
    const timeAgo = t.updatedAt ? formatDate(t.updatedAt) : ''
    const initials = t.title.slice(0, 2).toUpperCase()

    return (
      <div key={t.id} style={{
        padding: '9px 0',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'flex-start', gap: 10,
        position: 'relative', opacity: 0.85,
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 9, flexShrink: 0, marginTop: 1,
          background: ac.bg, color: ac.text,
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <div style={{ fontWeight: 600, fontSize: 12, color: '#dddde8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
            <span className="font-mono" style={{ fontSize: 9, color: '#62627a', flexShrink: 0 }}>{timeAgo}</span>
          </div>
          {preview && (
            <div style={{
              fontSize: 11, color: '#a0a0b8', lineHeight: 1.4, marginTop: 2,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {preview}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <ProjPill name={projectName(projects, t.projectId)} />
            {t.messages.length > 0 && (
              <span className="font-mono" style={{ fontSize: 9, color: '#62627a' }}>{t.messages.length} msg{t.messages.length !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="font-mono" style={{ fontSize: 10, color: '#62627a', padding: '0 0 4px' }}>
        {threads.length} thread{threads.length !== 1 ? 's' : ''} · all projects
      </div>
      <Sec label="Recent" />
      {threads.map((t, i) => renderThread(t, i))}
    </>
  )
}

// ══════════════════════════════════════════════════════════════
// ACTIVITY PANEL (hardcoded for now)
// ══════════════════════════════════════════════════════════════

function ActivityPanel({ projects }: { projects: Project[] }) {
  const projectNames = projects.map(p => p.name)
  const pName = projectNames[0] || 'Project'
  const pName2 = projectNames[1] || projectNames[0] || 'Project'

  const activities = [
    { initials: 'OP', bg: 'rgba(196,90,220,0.2)', color: '#c45adc', text: <>You created <em>{pName}</em></>, project: pName, time: 'Just now', group: 'Today' },
    { initials: 'OP', bg: 'rgba(196,90,220,0.2)', color: '#c45adc', text: <>You added crew to <em>{pName}</em></>, project: pName, time: 'Earlier', group: 'Today' },
    ...(projectNames.length > 1 ? [
      { initials: 'OP', bg: 'rgba(100,112,243,0.2)', color: '#6470f3', text: <>You created <em>{pName2}</em></>, project: pName2, time: 'Earlier', group: 'Today' },
    ] : []),
  ]

  const groups = Array.from(new Set(activities.map(a => a.group)))

  if (projects.length === 0) return <EmptyPanelRows />

  return (
    <>
      <div className="font-mono" style={{ fontSize: 10, color: '#62627a', padding: '0 0 4px' }}>
        all projects · today
      </div>
      {groups.map(g => (
        <div key={g}>
          <Sec label={g} />
          {activities.filter(a => a.group === g).map((a, i) => (
            <div key={i} style={{ padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 8, flexShrink: 0, marginTop: 1,
                background: a.bg, color: a.color,
              }}>
                {a.initials}
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#a0a0b8', lineHeight: 1.4 }}>
                  {a.text}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                  <ProjPill name={a.project} />
                  <span className="font-mono" style={{ fontSize: 9, color: '#62627a' }}>{a.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
      <style>{`
        .global-panel em { color: #c45adc; font-style: normal; font-weight: 500; }
        .global-panel b { color: #dddde8; font-weight: 600; }
      `}</style>
    </>
  )
}

// ══════════════════════════════════════════════════════════════
// MAIN GLOBAL PANELS COMPONENT
// ══════════════════════════════════════════════════════════════

interface GlobalPanelsProps {
  activePanel: PanelId | null
  onClose: () => void
  onNavigate: (panel: PanelId) => void
}

export function GlobalPanels({ activePanel, onClose, onNavigate }: GlobalPanelsProps) {
  const { data: projects } = useProjects()
  const { data: actionItems } = useAllActionItems()
  const { data: milestones } = useAllMilestones()
  const { data: threads } = useAllThreads()
  const allProjects = projects ?? []
  const allItems = actionItems ?? []
  const allMilestones = milestones ?? []
  const allThreads = threads ?? []

  const [prevPanel, setPrevPanel] = useState<PanelId | null>(null)
  const activeIdx = activePanel ? PANEL_ORDER.indexOf(activePanel) : -1
  const prevIdx = prevPanel ? PANEL_ORDER.indexOf(prevPanel) : -1
  const slideDir = activeIdx >= prevIdx ? 1 : -1 // 1 = from right, -1 = from left

  // Track panel changes for slide direction
  if (activePanel && activePanel !== prevPanel) {
    setPrevPanel(activePanel)
  }

  // Swipe handling
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const handleSwipeStart = (e: React.TouchEvent) => setTouchStartX(e.touches[0].clientX)
  const handleSwipeEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || !activePanel) return
    const dx = e.changedTouches[0].clientX - touchStartX
    if (Math.abs(dx) > 60) {
      const curIdx = PANEL_ORDER.indexOf(activePanel)
      if (dx < 0 && curIdx < PANEL_ORDER.length - 1) {
        onNavigate(PANEL_ORDER[curIdx + 1])
        haptic('light')
      } else if (dx > 0 && curIdx > 0) {
        onNavigate(PANEL_ORDER[curIdx - 1])
        haptic('light')
      }
    }
    setTouchStartX(null)
  }

  const panelSub = useMemo(() => {
    if (!activePanel) return ''
    switch (activePanel) {
      case 'tasks': {
        const open = allItems.filter(i => i.status !== 'done').length
        const overdue = allItems.filter(i => i.status !== 'done' && i.dueDate && daysUntil(i.dueDate) < 0).length
        return `${open} open${overdue > 0 ? ` · ${overdue} overdue` : ''}`
      }
      case 'milestones': {
        const up = allMilestones.filter(m => daysUntil(m.date) >= 0).length
        const pCount = new Set(allMilestones.map(m => m.projectId)).size
        return `${up} upcoming · ${pCount} project${pCount !== 1 ? 's' : ''}`
      }
      case 'schedule': {
        const now = new Date()
        return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      }
      case 'threads': {
        return `${allThreads.length} thread${allThreads.length !== 1 ? 's' : ''} · all projects`
      }
      case 'activity': return 'all projects · today'
    }
  }, [activePanel, allItems, allMilestones, allThreads])

  return (
    <AnimatePresence>
      {activePanel && (
        <>
          {/* Panel frame — sits below "Back to One" header and above FAB */}
          <motion.div
            key="panel-frame"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            onTouchStart={handleSwipeStart}
            onTouchEnd={handleSwipeEnd}
            className="global-panel"
            style={{
              position: 'fixed',
              top: 156,
              bottom: 'calc(68px + 52px + 16px)',
              left: 14, right: 14,
              zIndex: 5,
              background: 'rgba(10,10,18,0.78)',
              backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 20, overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 -1px 0 rgba(255,255,255,0.05), 0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            {/* Accent line */}
            <div style={{
              height: 2, flexShrink: 0,
              background: 'linear-gradient(90deg, transparent 5%, rgba(196,90,220,0.45) 40%, rgba(196,90,220,0.45) 60%, transparent 95%)',
            }} />

            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px 12px', flexShrink: 0,
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div className="font-mono" style={{ fontSize: 9, color: 'rgba(196,90,220,0.5)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>My Work</div>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#dddde8', letterSpacing: '-0.02em' }}>
                  {PANEL_TITLES[activePanel]}
                </div>
              </div>
              <PanelDots activeIdx={activeIdx} />
            </div>

            {/* Body — content slides horizontally */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activePanel}
                initial={{ opacity: 0, x: slideDir * 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -slideDir * 24 }}
                transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  overflow: activePanel === 'schedule' ? 'hidden' : undefined,
                }}
              >
                {activePanel === 'schedule' ? (
                  <SchedulePanel milestones={allMilestones} projects={allProjects} />
                ) : (
                  <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 16px', WebkitOverflowScrolling: 'touch' }}
                    className="no-scrollbar">
                    {activePanel === 'tasks' && <ActionItemsPanel items={allItems} projects={allProjects} />}
                    {activePanel === 'milestones' && <MilestonesPanel milestones={allMilestones} projects={allProjects} />}
                    {activePanel === 'threads' && <ThreadsPanel threads={allThreads} projects={allProjects} />}
                    {activePanel === 'activity' && <ActivityPanel projects={allProjects} />}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
