'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProject, useActionItems, useToggleActionItem, useCreateActionItem, useCrew } from '@/lib/hooks/useOriginOne'
import { LoadingState, EmptyState, CrewAvatar, SkeletonLine } from '@/components/ui'
import { PageHeader } from '@/components/ui/PageHeader'
import { FAB } from '@/components/ui/FAB'
import { CreateTaskSheet } from '@/components/create'
import { haptic } from '@/lib/utils/haptics'
import { formatDate, isUrgent, isLate, getProjectColor, DEPARTMENTS, PHASE_HEX, PHASE_LABELS_LONG, DEPT_COLORS } from '@/lib/utils/phase'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import type { ActionItem, CrewMember, Phase } from '@/types'

// ── CONSTANTS ─────────────────────────────────────────────

const PHASE_LABEL = PHASE_LABELS_LONG

type Tab = 'me' | 'upcoming' | 'dept'

// ── TASK ROW ──────────────────────────────────────────────

function TaskRow({ item, isMine, accent, showAssignee, crew, onTap, onToggle }: {
  item: ActionItem; isMine: boolean; accent: string; showAssignee?: boolean
  crew: CrewMember[]; onTap: () => void; onToggle: () => void
}) {
  const overdue = item.dueDate ? isLate(item.dueDate) : false
  const dateLabel = item.dueDate ? formatDate(item.dueDate) : null
  const assignee = crew.find(c => c.id === item.assigneeId)
  // TODO: high priority detection — using dept heuristic for now
  const isHigh = item.dept === 'Production' || item.dept === 'Camera'

  return (
    <div style={{ margin: '0 16px 2px', borderRadius: 9 }}>
      <div
        className="flex items-start cursor-pointer relative overflow-hidden active:bg-[#0d0d18] transition-colors"
        style={{ gap: 11, padding: '12px 13px', background: '#0a0a12', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 9 }}
        onClick={onTap}
      >
        {/* High priority accent bar */}
        {isHigh && (
          <div className="absolute left-0 rounded-r" style={{ top: 6, bottom: 6, width: 2.5, background: accent }} />
        )}

        {/* Checkbox */}
        <div
          className="flex-shrink-0 rounded-full flex items-center justify-center cursor-pointer"
          style={{ width: 16, height: 16, marginTop: 1, border: `1.5px solid ${isMine ? accent : '#62627a'}` }}
          onClick={e => { e.stopPropagation(); haptic('success'); onToggle() }}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="truncate" style={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.3, color: isMine ? '#dddde8' : '#a0a0b8' }}>
            {item.name}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {dateLabel && (
              <span className="font-mono" style={{ fontSize: '0.48rem', letterSpacing: '0.04em', color: overdue ? '#e8a020' : '#62627a' }}>
                {dateLabel}{overdue ? ' — Overdue' : ''}
              </span>
            )}
            <span className="font-mono uppercase" style={{ fontSize: '0.44rem', color: '#62627a', background: 'rgba(255,255,255,0.04)', borderRadius: 3, padding: '1px 4px' }}>
              {item.dept}
            </span>
            {showAssignee && assignee && (
              <span className="font-mono ml-auto" style={{ fontSize: '0.46rem', color: '#62627a', opacity: 0.6 }}>
                {assignee.first} {assignee.last[0]}.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── DONE TASK ROW ─────────────────────────────────────────

function DoneTaskRow({ item, onTap }: { item: ActionItem; onTap: () => void }) {
  const dateLabel = item.dueDate ? formatDate(item.dueDate) : null
  return (
    <div style={{ margin: '0 16px 2px', borderRadius: 9 }}>
      <div className="flex items-start cursor-pointer" style={{ gap: 11, padding: '12px 13px', background: '#0a0a12', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 9 }} onClick={onTap}>
        <div className="flex-shrink-0 rounded-full flex items-center justify-center" style={{ width: 16, height: 16, marginTop: 1, background: 'rgba(100,112,243,0.12)', border: '1.5px solid #6470f3' }}>
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.5 6L6.5 2" stroke="#6470f3" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="truncate line-through" style={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.3, color: '#62627a' }}>{item.name}</div>
          {dateLabel && <div className="font-mono mt-0.5" style={{ fontSize: '0.48rem', color: '#62627a' }}>{dateLabel}</div>}
        </div>
      </div>
    </div>
  )
}

// ── TASK DETAIL SHEET ─────────────────────────────────────

function TaskDetailSheet({ item, crew, accent, onClose, onToggle }: {
  item: ActionItem | null; crew: CrewMember[]; accent: string; onClose: () => void; onToggle: () => void
}) {
  if (!item) return null
  const assignee = crew.find(c => c.id === item.assigneeId)
  const overdue = item.dueDate ? isLate(item.dueDate) : false
  const dateLabel = item.dueDate ? formatDate(item.dueDate) : '—'
  const isHigh = item.dept === 'Production' || item.dept === 'Camera'

  return (
    <>
      {/* Header */}
      <div style={{ padding: '0 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex justify-between items-start">
          <div style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#dddde8', marginBottom: 6, flex: 1 }}>{item.name}</div>
          <button onClick={onClose} className="text-muted text-sm w-7 h-7 flex items-center justify-center flex-shrink-0">✕</button>
        </div>
        {isHigh && (
          <span className="font-mono uppercase" style={{ fontSize: '0.46rem', letterSpacing: '0.06em', padding: '3px 8px', borderRadius: 20, background: `${accent}1a`, border: `1px solid ${accent}33`, color: accent, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <svg width="6" height="6" viewBox="0 0 6 6" fill="none"><circle cx="3" cy="3" r="3" fill={accent} /></svg>
            High Priority
          </span>
        )}
      </div>

      {/* Fields */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 13 }}>
        <div className="flex items-start gap-3">
          <span className="font-mono uppercase flex-shrink-0" style={{ fontSize: '0.46rem', color: '#62627a', letterSpacing: '0.08em', width: 68, paddingTop: 1 }}>Due</span>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: overdue ? '#e8a020' : '#dddde8' }}>{dateLabel}{overdue ? ' — Overdue' : ''}</span>
        </div>
        <div className="flex items-start gap-3">
          <span className="font-mono uppercase flex-shrink-0" style={{ fontSize: '0.46rem', color: '#62627a', letterSpacing: '0.08em', width: 68, paddingTop: 1 }}>Dept</span>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#dddde8' }}>{item.dept}</span>
        </div>
        <div className="flex items-start gap-3">
          <span className="font-mono uppercase flex-shrink-0" style={{ fontSize: '0.46rem', color: '#62627a', letterSpacing: '0.08em', width: 68, paddingTop: 1 }}>Assignee</span>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#dddde8' }}>{assignee ? `${assignee.first} ${assignee.last}` : '—'}</span>
        </div>
        {item.notes && (
          <div className="flex items-start gap-3">
            <span className="font-mono uppercase flex-shrink-0" style={{ fontSize: '0.46rem', color: '#62627a', letterSpacing: '0.08em', width: 68, paddingTop: 1 }}>Notes</span>
            <div style={{ fontSize: '0.72rem', color: '#a0a0b8', lineHeight: 1.55, background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '10px 12px', flex: 1 }}>{item.notes}</div>
          </div>
        )}
      </div>

      {/* Buttons */}
      <div style={{ padding: '4px 20px 0', display: 'flex', gap: 10 }}>
        <button
          className="flex-1 font-bold cursor-pointer transition-all"
          style={{ padding: 13, borderRadius: 8, fontSize: '0.78rem', background: 'rgba(0,184,148,0.1)', border: '1px solid rgba(0,184,148,0.2)', color: '#00b894' }}
          onClick={() => { haptic('success'); onToggle(); onClose() }}
        >
          {item.done ? 'Reopen' : 'Mark Complete'}
        </button>
        <button
          className="flex-1 font-bold cursor-pointer transition-all"
          style={{ padding: 13, borderRadius: 8, fontSize: '0.78rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)', color: '#a0a0b8' }}
        >
          Reassign
        </button>
      </div>
    </>
  )
}

// ── SECTION HEAD ──────────────────────────────────────────

function SectionHead({ label, count }: { label: string; count?: string }) {
  return (
    <div className="flex items-center" style={{ padding: '14px 16px 8px' }}>
      <span className="font-mono uppercase flex-1" style={{ fontSize: '0.48rem', color: '#62627a', letterSpacing: '0.1em' }}>{label}</span>
      {count && <span className="font-mono" style={{ fontSize: '0.46rem', color: '#62627a' }}>{count}</span>}
    </div>
  )
}

// ── BUCKET DIVIDER ────────────────────────────────────────

function BucketDivider({ label, isToday }: { label: string; isToday?: boolean }) {
  return (
    <div className="flex items-center gap-2.5" style={{ padding: '16px 16px 7px' }}>
      <span className="font-mono uppercase flex-shrink-0" style={{ fontSize: '0.5rem', letterSpacing: '0.1em', color: isToday ? '#c45adc' : '#62627a' }}>{label}</span>
      <div className="flex-1" style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
    </div>
  )
}

// ── NEW ACTION ITEM SHEET ─────────────────────────────────

function NewActionItemSheet({ crew, accent, onSave, onClose }: {
  crew: CrewMember[]; accent: string
  onSave: (data: { name: string; dept: string; assigneeId: string | null; dueDate: string | null; notes: string }) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [dept, setDept] = useState('Production')
  const [assigneeId, setAssigneeId] = useState<string | null>(null)
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')

  const canSave = name.trim().length > 0

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ fontWeight: 800, fontSize: '1rem', color: '#dddde8' }}>New Action Item</span>
        <button
          onClick={() => { if (canSave) { haptic('light'); onSave({ name: name.trim(), dept, assigneeId, dueDate: dueDate || null, notes }) } }}
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
          <label className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Task name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="What needs to be done?"
            autoComplete="off" spellCheck={false}
            className="w-full outline-none focus:border-white/20"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7, padding: '10px 12px', color: '#dddde8', fontSize: '0.82rem' }}
          />
        </div>

        <div>
          <label className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Department</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {DEPARTMENTS.map(d => (
              <button key={d} onClick={() => setDept(d)}
                className="font-mono uppercase cursor-pointer"
                style={{
                  fontSize: '0.44rem', letterSpacing: '0.05em', padding: '5px 9px', borderRadius: 20,
                  background: dept === d ? `${accent}1a` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${dept === d ? `${accent}40` : 'rgba(255,255,255,0.05)'}`,
                  color: dept === d ? accent : '#62627a',
                }}
              >{d}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Due date</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
            className="w-full outline-none focus:border-white/20"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7, padding: '10px 12px', color: '#dddde8', fontSize: '0.78rem', fontFamily: 'var(--font-dm-mono)' }}
          />
        </div>

        <div>
          <label className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Assignee</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            <button onClick={() => setAssigneeId(null)}
              className="font-mono uppercase cursor-pointer"
              style={{
                fontSize: '0.44rem', padding: '5px 9px', borderRadius: 20,
                background: assigneeId === null ? `${accent}1a` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${assigneeId === null ? `${accent}40` : 'rgba(255,255,255,0.05)'}`,
                color: assigneeId === null ? accent : '#62627a',
              }}
            >Unassigned</button>
            {crew.map(c => (
              <button key={c.id} onClick={() => setAssigneeId(c.id)}
                className="font-mono cursor-pointer"
                style={{
                  fontSize: '0.44rem', padding: '5px 9px', borderRadius: 20,
                  background: assigneeId === c.id ? `${accent}1a` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${assigneeId === c.id ? `${accent}40` : 'rgba(255,255,255,0.05)'}`,
                  color: assigneeId === c.id ? accent : '#62627a',
                }}
              >{c.first} {c.last[0]}.</button>
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

export default function ActionItemsPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const router = useRouter()
  const accent = getProjectColor(projectId)

  const [tab, setTab] = useState<Tab>('me')
  const [selected, setSelected] = useState<ActionItem | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  const { data: project } = useProject(projectId)
  const { data: items, isLoading: loadingItems } = useActionItems(projectId)
  const { data: crew, isLoading: loadingCrew } = useCrew(projectId)
  const toggle = useToggleActionItem(projectId)
  const createItem = useCreateActionItem(projectId)

  const allItems = items ?? []
  const allCrew = crew ?? []
  const openItems = allItems.filter(i => !i.done)
  const doneItems = allItems.filter(i => i.done)

  // TODO: replace with actual user matching via localStorage
  const userName = typeof window !== 'undefined' ? localStorage.getItem('origin_one_user_name') ?? '' : ''
  const myItems = openItems // For now, show all as "mine"

  // Upcoming buckets
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(today)
  endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()))

  const todayItems = openItems.filter(i => { if (!i.dueDate) return false; const d = new Date(i.dueDate); d.setHours(0, 0, 0, 0); return d <= today })
  const weekItems = openItems.filter(i => { if (!i.dueDate) return false; const d = new Date(i.dueDate); d.setHours(0, 0, 0, 0); return d > today && d <= endOfWeek })
  const laterItems = openItems.filter(i => { if (!i.dueDate) return false; const d = new Date(i.dueDate); d.setHours(0, 0, 0, 0); return d > endOfWeek })

  // Dept groups
  const depts = Array.from(new Set(openItems.map(i => i.dept)))
  const [openDepts, setOpenDepts] = useState<Set<string>>(new Set(depts.slice(0, 2)))
  const toggleDept = (d: string) => setOpenDepts(prev => { const next = new Set(prev); next.has(d) ? next.delete(d) : next.add(d); return next })

  const phaseColor = project ? PHASE_HEX[project.phase] : '#6470f3'

  return (
    <div className="screen">
      {/* Header */}
      <PageHeader
        projectId={projectId}
        title="Action Items"
        meta={project ? `${project.name} · ${PHASE_LABEL[project.phase]}` : ''}
      />

      {/* Tabs */}
      <div className="flex sticky top-[73px] z-[19]" style={{ padding: '0 16px', background: '#04040a', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {([
          { key: 'me' as Tab, label: 'Me', count: myItems.length },
          { key: 'upcoming' as Tab, label: 'Upcoming', count: openItems.length },
          { key: 'dept' as Tab, label: 'Dept', count: depts.length },
        ]).map(t => (
          <button
            key={t.key}
            className="flex-1 flex items-center justify-center gap-1.5 relative cursor-pointer select-none transition-colors"
            style={{ padding: '15px 0', fontWeight: 700, fontSize: '0.88rem', color: tab === t.key ? '#dddde8' : '#62627a' }}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            <span className="font-mono" style={{
              fontSize: '0.46rem', letterSpacing: '0.04em', padding: '2px 5px', borderRadius: 20,
              background: tab === t.key ? `${accent}26` : 'rgba(255,255,255,0.06)',
              color: tab === t.key ? accent : '#62627a',
            }}>{t.count}</span>
            {tab === t.key && <div className="absolute bottom-0" style={{ left: '12%', right: '12%', height: 2, background: accent, borderRadius: '2px 2px 0 0' }} />}
          </button>
        ))}
      </div>

      {/* Panels */}
      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 100 }}>
        {loadingItems || loadingCrew ? (
          <div className="flex flex-col gap-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-border">
                <div className="mt-0.5 w-4 h-4 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <div className="flex-1 flex flex-col gap-1.5"><SkeletonLine w="80%" h={12} /><div className="flex gap-2"><SkeletonLine w={48} h={8} /><SkeletonLine w={36} h={8} /></div></div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* ME TAB */}
            {tab === 'me' && (
              <>
                <SectionHead label="My open items" count={`${myItems.length} tasks`} />
                {myItems.length === 0 ? <EmptyState text="All clear" /> : myItems.map(item => (
                  <TaskRow key={item.id} item={item} isMine accent={accent} crew={allCrew}
                    onTap={() => setSelected(item)} onToggle={() => toggle.mutate({ id: item.id, done: !item.done })} />
                ))}
                {doneItems.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 cursor-pointer select-none" style={{ padding: '14px 16px 10px', marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.05)' }}
                      onClick={() => setShowCompleted(!showCompleted)}>
                      <span className="font-mono uppercase flex-1" style={{ fontSize: '0.48rem', color: '#62627a', letterSpacing: '0.1em' }}>Completed</span>
                      <span className="font-mono" style={{ fontSize: '0.46rem', color: '#62627a' }}>{doneItems.length} tasks</span>
                      <svg width="7" height="11" viewBox="0 0 7 11" fill="none" style={{ opacity: 0.3, transition: 'transform 0.2s', transform: showCompleted ? 'rotate(90deg)' : undefined }}>
                        <path d="M1.5 1.5L5.5 5.5L1.5 9.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    {showCompleted && doneItems.map(item => (
                      <DoneTaskRow key={item.id} item={item} onTap={() => setSelected(item)} />
                    ))}
                  </>
                )}
              </>
            )}

            {/* UPCOMING TAB */}
            {tab === 'upcoming' && (
              <>
                {todayItems.length > 0 && (
                  <>
                    <BucketDivider label="Today" isToday />
                    {todayItems.map(item => <TaskRow key={item.id} item={item} isMine accent={accent} showAssignee crew={allCrew} onTap={() => setSelected(item)} onToggle={() => toggle.mutate({ id: item.id, done: !item.done })} />)}
                  </>
                )}
                {weekItems.length > 0 && (
                  <>
                    <BucketDivider label="This Week" />
                    {weekItems.map(item => <TaskRow key={item.id} item={item} isMine accent={accent} showAssignee crew={allCrew} onTap={() => setSelected(item)} onToggle={() => toggle.mutate({ id: item.id, done: !item.done })} />)}
                  </>
                )}
                {laterItems.length > 0 && (
                  <>
                    <BucketDivider label="Later" />
                    {laterItems.map(item => <TaskRow key={item.id} item={item} isMine accent={accent} showAssignee crew={allCrew} onTap={() => setSelected(item)} onToggle={() => toggle.mutate({ id: item.id, done: !item.done })} />)}
                  </>
                )}
                {openItems.length === 0 && <EmptyState text="Nothing upcoming" />}
              </>
            )}

            {/* DEPT TAB */}
            {tab === 'dept' && (
              <>
                {depts.map(dept => {
                  const deptItems = openItems.filter(i => i.dept === dept)
                  const isOpen = openDepts.has(dept)
                  return (
                    <div key={dept}>
                      <div className="flex items-center gap-2 cursor-pointer select-none" style={{ padding: '14px 16px 9px' }} onClick={() => toggleDept(dept)}>
                        <div className="flex-shrink-0 rounded-full" style={{ width: 6, height: 6, background: DEPT_COLORS[dept] ?? '#62627a' }} />
                        <span style={{ fontWeight: 700, fontSize: '0.78rem', color: '#a0a0b8', flex: 1 }}>{dept}</span>
                        <span className="font-mono" style={{ fontSize: '0.46rem', color: '#62627a' }}>{deptItems.length} open</span>
                        <svg width="7" height="11" viewBox="0 0 7 11" fill="none" style={{ opacity: 0.3, transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : undefined }}>
                          <path d="M1.5 1.5L5.5 5.5L1.5 9.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      {isOpen && deptItems.map(item => (
                        <TaskRow key={item.id} item={item} isMine accent={accent} crew={allCrew}
                          onTap={() => setSelected(item)} onToggle={() => toggle.mutate({ id: item.id, done: !item.done })} />
                      ))}
                    </div>
                  )
                })}
                {depts.length === 0 && <EmptyState text="No departments" />}
              </>
            )}
          </>
        )}
      </div>

      {/* FAB */}
      <FAB accent={accent} projectId={projectId} onPress={() => { haptic('light'); setShowAdd(true) }} />

      {/* Add Sheet */}
      <CreateTaskSheet
        open={showAdd}
        projectId={projectId}
        accent={accent}
        crew={allCrew}
        onSave={(data) => { createItem.mutate(data as any); setShowAdd(false) }}
        onClose={() => setShowAdd(false)}
      />

      {/* Detail Sheet */}
      <Sheet open={!!selected} onClose={() => setSelected(null)}>
        <div style={{ padding: '12px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '0 auto 20px' }} />
          <TaskDetailSheet
            item={selected}
            crew={allCrew}
            accent={accent}
            onClose={() => setSelected(null)}
            onToggle={() => { if (selected) toggle.mutate({ id: selected.id, done: !selected.done }) }}
          />
        </div>
      </Sheet>
    </div>
  )
}
