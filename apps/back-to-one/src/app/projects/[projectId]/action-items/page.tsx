'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProject, useActionItems, useToggleActionItem, useCreateActionItem, useUpdateActionItem, useCrew } from '@/lib/hooks/useOriginOne'
import { LoadingState, EmptyState, CrewAvatar, SkeletonLine } from '@/components/ui'
import { PageHeader } from '@/components/ui/PageHeader'
import { FAB } from '@/components/ui/FAB'
import { CreateTaskSheet } from '@/components/create'
import { haptic } from '@/lib/utils/haptics'
import { formatDate, isLate, getProjectColor, statusLabel, statusHex } from '@/lib/utils/phase'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import type { ActionItem, TeamMember } from '@/types'

type Tab = 'me' | 'upcoming'

// ── TASK ROW ──────────────────────────────────────────────

function TaskRow({ item, isMine, accent, showAssignee, crew, onTap, onToggle }: {
  item: ActionItem; isMine: boolean; accent: string; showAssignee?: boolean
  crew: TeamMember[]; onTap: () => void; onToggle: () => void
}) {
  const overdue = item.dueDate ? isLate(item.dueDate) : false
  const dateLabel = item.dueDate ? formatDate(item.dueDate) : null
  const isDone = item.status === 'done'
  const assignee = crew.find(c => c.userId === item.assignedTo || c.id === item.assignedTo)

  return (
    <div style={{ margin: '0 16px 2px', borderRadius: 9 }}>
      <div
        className="flex items-start cursor-pointer relative overflow-hidden active:bg-[#0d0d18] transition-colors"
        style={{ gap: 11, padding: '12px 13px', background: '#0a0a12', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 9 }}
        onClick={onTap}
      >
        {/* Checkbox */}
        <div
          className="flex-shrink-0 rounded-full flex items-center justify-center cursor-pointer"
          style={{ width: 16, height: 16, marginTop: 1, border: `1.5px solid ${isMine ? accent : '#62627a'}` }}
          onClick={e => { e.stopPropagation(); haptic('success'); onToggle() }}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="truncate" style={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.3, color: isMine ? '#dddde8' : '#a0a0b8' }}>
            {item.title}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {dateLabel && (
              <span className="font-mono" style={{ fontSize: '0.48rem', letterSpacing: '0.04em', color: overdue ? '#e8a020' : '#62627a' }}>
                {dateLabel}{overdue ? ' — Overdue' : ''}
              </span>
            )}
            {showAssignee && assignee && (
              <span className="font-mono ml-auto" style={{ fontSize: '0.46rem', color: '#62627a', opacity: 0.6 }}>
                {assignee.User?.name ?? 'Unknown'}
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
          <div className="truncate line-through" style={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.3, color: '#62627a' }}>{item.title}</div>
          {dateLabel && <div className="font-mono mt-0.5" style={{ fontSize: '0.48rem', color: '#62627a' }}>{dateLabel}</div>}
        </div>
      </div>
    </div>
  )
}

// ── TASK DETAIL SHEET ─────────────────────────────────────

function TaskDetailSheet({ item, crew, accent, projectId, onClose, onToggle }: {
  item: ActionItem | null; crew: TeamMember[]; accent: string; projectId: string; onClose: () => void; onToggle: () => void
}) {
  const updateItem = useUpdateActionItem(projectId)
  const [editDue, setEditDue] = useState(false)
  const [editAssignee, setEditAssignee] = useState(false)
  const [dueValue, setDueValue] = useState(item?.dueDate?.split('T')[0] ?? '')

  if (!item) return null
  const assignee = crew.find(c => c.userId === item.assignedTo || c.id === item.assignedTo)
  const overdue = item.dueDate ? isLate(item.dueDate) : false
  const dateLabel = item.dueDate ? formatDate(item.dueDate) : '—'
  const isDone = item.status === 'done'

  const saveDue = (val: string) => {
    setEditDue(false)
    if (val !== (item.dueDate?.split('T')[0] ?? '')) {
      updateItem.mutate({ id: item.id, fields: { dueDate: val || null } })
    }
  }

  const saveAssignee = (userId: string | null) => {
    setEditAssignee(false)
    if (userId !== item.assignedTo) {
      updateItem.mutate({ id: item.id, fields: { assignedTo: userId } })
    }
  }

  return (
    <>
      {/* Header */}
      <div style={{ padding: '0 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex justify-between items-start">
          <div style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#dddde8', marginBottom: 6, flex: 1 }}>{item.title}</div>
          <button onClick={onClose} className="text-muted text-sm w-7 h-7 flex items-center justify-center flex-shrink-0">✕</button>
        </div>
      </div>

      {/* Editable Fields */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 13 }}>
        {/* Due Date — tap to edit */}
        <div className="flex items-start gap-3">
          <span className="font-mono uppercase flex-shrink-0" style={{ fontSize: '0.46rem', color: '#62627a', letterSpacing: '0.08em', width: 68, paddingTop: 1 }}>Due</span>
          {editDue ? (
            <input
              type="date"
              autoFocus
              defaultValue={dueValue}
              onChange={e => setDueValue(e.target.value)}
              onBlur={e => saveDue(e.target.value)}
              className="outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 8px', color: '#dddde8', fontSize: '0.74rem', fontFamily: 'var(--font-dm-mono)' }}
            />
          ) : (
            <span
              onClick={() => setEditDue(true)}
              style={{ fontSize: '0.78rem', fontWeight: 600, color: overdue ? '#e8a020' : '#dddde8', cursor: 'pointer', borderBottom: '1px dashed rgba(255,255,255,0.1)', paddingBottom: 1 }}
            >
              {dateLabel}{overdue ? ' — Overdue' : ''}
            </span>
          )}
        </div>

        {/* Assignee — tap to change */}
        <div className="flex items-start gap-3">
          <span className="font-mono uppercase flex-shrink-0" style={{ fontSize: '0.46rem', color: '#62627a', letterSpacing: '0.08em', width: 68, paddingTop: 1 }}>Assignee</span>
          {editAssignee ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flex: 1 }}>
              <button onClick={() => saveAssignee(null)}
                className="font-mono"
                style={{ fontSize: '0.42rem', padding: '4px 8px', borderRadius: 16, background: !item.assignedTo ? `${accent}1a` : 'rgba(255,255,255,0.04)', border: `1px solid ${!item.assignedTo ? `${accent}40` : 'rgba(255,255,255,0.05)'}`, color: !item.assignedTo ? accent : '#62627a', cursor: 'pointer' }}
              >None</button>
              {crew.map(c => (
                <button key={c.id} onClick={() => saveAssignee(c.userId)}
                  className="font-mono"
                  style={{ fontSize: '0.42rem', padding: '4px 8px', borderRadius: 16, background: (item.assignedTo === c.userId || item.assignedTo === c.id) ? `${accent}1a` : 'rgba(255,255,255,0.04)', border: `1px solid ${(item.assignedTo === c.userId || item.assignedTo === c.id) ? `${accent}40` : 'rgba(255,255,255,0.05)'}`, color: (item.assignedTo === c.userId || item.assignedTo === c.id) ? accent : '#62627a', cursor: 'pointer' }}
                >{c.User?.name ?? 'Unknown'}</button>
              ))}
            </div>
          ) : (
            <span
              onClick={() => setEditAssignee(true)}
              style={{ fontSize: '0.78rem', fontWeight: 600, color: '#dddde8', cursor: 'pointer', borderBottom: '1px dashed rgba(255,255,255,0.1)', paddingBottom: 1 }}
            >
              {assignee ? assignee.User?.name : '—'}
            </span>
          )}
        </div>

        {item.description && (
          <div className="flex items-start gap-3">
            <span className="font-mono uppercase flex-shrink-0" style={{ fontSize: '0.46rem', color: '#62627a', letterSpacing: '0.08em', width: 68, paddingTop: 1 }}>Notes</span>
            <div style={{ fontSize: '0.72rem', color: '#a0a0b8', lineHeight: 1.55, background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '10px 12px', flex: 1 }}>{item.description}</div>
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
          {isDone ? 'Reopen' : 'Mark Complete'}
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
  const openItems = allItems.filter(i => i.status !== 'done')
  const doneItems = allItems.filter(i => i.status === 'done')

  const myItems = openItems // For now, show all as "mine"

  // Upcoming buckets
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(today)
  endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()))

  const todayItems = openItems.filter(i => { if (!i.dueDate) return false; const d = new Date(i.dueDate); d.setHours(0, 0, 0, 0); return d <= today })
  const weekItems = openItems.filter(i => { if (!i.dueDate) return false; const d = new Date(i.dueDate); d.setHours(0, 0, 0, 0); return d > today && d <= endOfWeek })
  const laterItems = openItems.filter(i => { if (!i.dueDate) return false; const d = new Date(i.dueDate); d.setHours(0, 0, 0, 0); return d > endOfWeek })

  return (
    <div className="screen">
      {/* Header */}
      <PageHeader
        projectId={projectId}
        title="Action Items"
        meta={project ? `${project.name} · ${statusLabel(project.status)}` : ''}
      />

      {/* Tabs */}
      <div className="flex sticky top-[73px] z-[19]" style={{ padding: '0 16px', background: '#04040a', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {([
          { key: 'me' as Tab, label: 'Me', count: myItems.length },
          { key: 'upcoming' as Tab, label: 'Upcoming', count: openItems.length },
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
                    onTap={() => setSelected(item)} onToggle={() => toggle.mutate({ id: item.id, done: item.status !== 'done' })} />
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
                    {todayItems.map(item => <TaskRow key={item.id} item={item} isMine accent={accent} showAssignee crew={allCrew} onTap={() => setSelected(item)} onToggle={() => toggle.mutate({ id: item.id, done: item.status !== 'done' })} />)}
                  </>
                )}
                {weekItems.length > 0 && (
                  <>
                    <BucketDivider label="This Week" />
                    {weekItems.map(item => <TaskRow key={item.id} item={item} isMine accent={accent} showAssignee crew={allCrew} onTap={() => setSelected(item)} onToggle={() => toggle.mutate({ id: item.id, done: item.status !== 'done' })} />)}
                  </>
                )}
                {laterItems.length > 0 && (
                  <>
                    <BucketDivider label="Later" />
                    {laterItems.map(item => <TaskRow key={item.id} item={item} isMine accent={accent} showAssignee crew={allCrew} onTap={() => setSelected(item)} onToggle={() => toggle.mutate({ id: item.id, done: item.status !== 'done' })} />)}
                  </>
                )}
                {openItems.length === 0 && <EmptyState text="Nothing upcoming" />}
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
            projectId={projectId}
            onClose={() => setSelected(null)}
            onToggle={() => { if (selected) toggle.mutate({ id: selected.id, done: selected.status !== 'done' }) }}
          />
        </div>
      </Sheet>
    </div>
  )
}
