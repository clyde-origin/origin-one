'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProject, useActionItems, useToggleActionItem, useCreateActionItem, useUpdateActionItem, useCrew, useMentionRoster, useMeId } from '@/lib/hooks/useOriginOne'
import { MentionInput } from '@/components/ui/MentionInput'
import { MentionText } from '@/components/ui/MentionText'
import { LoadingState, EmptyState, CrewAvatar } from '@/components/ui'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProjectSwitcher } from '@/components/ProjectSwitcher'
import { useFabAction } from '@/lib/contexts/FabActionContext'
import { CreateTaskSheet } from '@/components/create'
import { haptic } from '@/lib/utils/haptics'
import { formatDate, isLate, getProjectColor, statusLabel, statusHex, DEPT_COLORS, DEPT_SHORT as DEPT_SHORT_MAP } from '@/lib/utils/phase'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { ThreadRowBadge, type ThreadRowBadgeEntry } from '@/components/threads/ThreadRowBadge'
import { useThreadsByEntity } from '@/components/threads/useThreadsByEntity'
import { useDetailSheetThreads } from '@/components/threads/useDetailSheetThreads'
import type { ActionItem, TeamMember } from '@/types'

type Tab = 'me' | 'upcoming' | 'dept'

const DEPT_OPTIONS = ['Direction', 'Production', 'Camera', 'Sound', 'Art', 'Wardrobe', 'HMU', 'Post', 'Other'] as const

// Cinema Glass: parse a project hex into the rgb triplets the .sheen-title /
// .glass-tile rules read at runtime. Glow apex is a +20/+30/+16 brightening
// to land near the gallery values without a new package export.
function hexRgbTriplet(hex: string | null | undefined): string {
  const h = hex || '#c45adc'
  const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}
function hexGlowTriplet(hex: string | null | undefined): string {
  const h = hex || '#c45adc'
  const r = Math.min(255, parseInt(h.slice(1, 3), 16) + 20)
  const g = Math.min(255, parseInt(h.slice(3, 5), 16) + 30)
  const b = Math.min(255, parseInt(h.slice(5, 7), 16) + 16)
  return `${r}, ${g}, ${b}`
}

// Cinema Glass: project.status → `.ai-meta-pill` phase variant. Archived
// has no dedicated chip; falls back to `prod` (neutral indigo) so the chip
// still renders rather than disappearing.
function statusToPhaseChip(status: string | undefined): 'pre' | 'prod' | 'post' {
  if (status === 'production') return 'prod'
  if (status === 'post_production') return 'post'
  return 'pre' // development, pre_production
}

// ── TASK ROW ──────────────────────────────────────────────

function TaskRow({ item, isMine, accent, showAssignee, crew, onTap, onToggle, threadEntry }: {
  item: ActionItem; isMine: boolean; accent: string; showAssignee?: boolean
  crew: TeamMember[]; onTap: () => void; onToggle: () => void
  threadEntry: ThreadRowBadgeEntry | undefined
}) {
  const overdue = item.dueDate ? isLate(item.dueDate) : false
  const dateLabel = item.dueDate ? formatDate(item.dueDate) : null
  const isDone = item.status === 'done'
  const assignee = crew.find(c => c.userId === item.assignedTo || c.id === item.assignedTo)

  return (
    // Outer wrapper is the positioning context for the badge — the inner card
    // is a glass-tile-xs (cinema-glass) so the row reads as a frosted accent
    // surface tied to the project accent.
    <div style={{ position: 'relative', margin: '0 16px 2px' }}>
      <div
        className="action-items-row glass-tile glass-tile-xs flex items-start cursor-pointer relative overflow-hidden"
        style={{ gap: 11, padding: '12px 13px' }}
        onClick={onTap}
      >
        {/* Checkbox */}
        <div
          className="flex-shrink-0 rounded-full flex items-center justify-center cursor-pointer"
          style={{ width: 16, height: 16, marginTop: 1, border: `1.5px solid ${isMine ? accent : 'var(--fg-mono)'}` }}
          onClick={e => { e.stopPropagation(); haptic('success'); onToggle() }}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate" style={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.3, color: isMine ? 'var(--fg)' : 'var(--fg-mono)' }}>
              {item.title}
            </span>
            {item.department && (() => {
              const dc = DEPT_COLORS[item.department] ?? '#7a7a82'
              return <span className="font-mono flex-shrink-0" style={{ fontSize: '0.38rem', padding: '1px 6px', borderRadius: 10, background: `${dc}19`, border: `1px solid ${dc}38`, color: dc, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{DEPT_SHORT_MAP[item.department] ?? item.department}</span>
            })()}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {dateLabel && (
              <span className="font-mono" style={{ fontSize: '0.48rem', letterSpacing: '0.04em', color: overdue ? 'var(--phase-pre)' : 'var(--fg-mono)' }}>
                {dateLabel}{overdue ? ' — Overdue' : ''}
              </span>
            )}
            {showAssignee && assignee && (
              <span className="font-mono ml-auto" style={{ fontSize: '0.58rem', color: 'var(--fg-mono)' }}>
                {assignee.User?.name ?? 'Unknown'}
              </span>
            )}
          </div>
        </div>
      </div>
      <ThreadRowBadge entry={threadEntry} />
    </div>
  )
}

// ── DONE TASK ROW ─────────────────────────────────────────

function DoneTaskRow({ item, onTap, threadEntry }: { item: ActionItem; onTap: () => void; threadEntry: ThreadRowBadgeEntry | undefined }) {
  const dateLabel = item.dueDate ? formatDate(item.dueDate) : null
  return (
    <div style={{ position: 'relative', margin: '0 16px 2px' }}>
      <div className="action-items-row action-items-row--done glass-tile glass-tile-xs flex items-start cursor-pointer" style={{ gap: 11, padding: '12px 13px' }} onClick={onTap}>
        <div className="flex-shrink-0 rounded-full flex items-center justify-center" style={{ width: 16, height: 16, marginTop: 1, background: 'rgba(var(--phase-prod-rgb), 0.12)', border: '1.5px solid var(--phase-prod)' }}>
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.5 6L6.5 2" stroke="var(--phase-prod)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="truncate line-through" style={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.3, color: 'var(--fg-mono)' }}>{item.title}</div>
          {dateLabel && <div className="font-mono mt-0.5" style={{ fontSize: '0.48rem', color: 'var(--fg-mono)' }}>{dateLabel}</div>}
        </div>
      </div>
      <ThreadRowBadge entry={threadEntry} />
    </div>
  )
}

// ── TASK DETAIL SHEET ─────────────────────────────────────

function TaskDetailSheet({ item, crew, accent, projectId, onClose, onToggle }: {
  item: ActionItem | null; crew: TeamMember[]; accent: string; projectId: string; onClose: () => void; onToggle: () => void
}) {
  const updateItem = useUpdateActionItem(projectId)
  const meId = useMeId()
  const [editDue, setEditDue] = useState(false)
  const [editAssignee, setEditAssignee] = useState(false)
  const [dueValue, setDueValue] = useState(item?.dueDate?.split('T')[0] ?? '')
  const [notes, setNotes] = useState(item?.description ?? '')
  const [notesMentions, setNotesMentions] = useState<string[]>((item as any)?.mentions ?? [])
  const { data: roster = [] } = useMentionRoster(projectId)

  const { TriggerIcon, PreviewRow, MessageZone, StartSheetOverlay } = useDetailSheetThreads({
    projectId,
    attachedToType: 'actionItem',
    attachedToId: item?.id ?? null,
    subjectLabel: item?.title ?? '',
  })

  if (!item) return null
  const assignee = crew.find(c => c.userId === item.assignedTo || c.id === item.assignedTo)
  const overdue = item.dueDate ? isLate(item.dueDate) : false
  const dateLabel = item.dueDate ? formatDate(item.dueDate) : '—'
  const isDone = item.status === 'done'

  const saveDue = (val: string) => {
    setEditDue(false)
    if (val !== (item.dueDate?.split('T')[0] ?? '')) {
      updateItem.mutate({ id: item.id, actorId: meId as string, fields: { dueDate: val || null } })
    }
  }

  const saveAssignee = (userId: string | null) => {
    setEditAssignee(false)
    if (userId !== item.assignedTo) {
      updateItem.mutate({ id: item.id, actorId: meId as string, fields: { assignedTo: userId } })
    }
  }

  return (
    <>
      {/* Header */}
      <div style={{ padding: '0 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex justify-between items-start">
          <div style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#dddde8', marginBottom: 6, flex: 1 }}>{item.title}</div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {item.department && (() => {
              const dc = DEPT_COLORS[item.department] ?? '#62627a'
              return <span className="font-mono" style={{ fontSize: '0.42rem', padding: '2px 8px', borderRadius: 12, background: `${dc}18`, color: dc }}>{DEPT_SHORT_MAP[item.department] ?? item.department}</span>
            })()}
            {TriggerIcon}
            <button onClick={onClose} className="text-muted text-sm w-7 h-7 flex items-center justify-center">✕</button>
          </div>
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
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 8px', color: '#dddde8', fontSize: '0.74rem', fontFamily: 'var(--font-geist-mono)' }}
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

        {/* Assignee — compact dropdown */}
        <div className="flex items-start gap-3" style={{ position: 'relative' }}>
          <span className="font-mono uppercase flex-shrink-0" style={{ fontSize: '0.46rem', color: '#62627a', letterSpacing: '0.08em', width: 68, paddingTop: 1 }}>Assignee</span>
          <div style={{ flex: 1, position: 'relative' }}>
            <button
              onClick={() => setEditAssignee(!editAssignee)}
              style={{
                fontSize: '0.78rem', fontWeight: 600, color: '#dddde8', cursor: 'pointer',
                borderBottom: '1px dashed rgba(255,255,255,0.1)', paddingBottom: 1,
                display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', borderBottomWidth: 1, borderBottomStyle: 'dashed', borderBottomColor: 'rgba(255,255,255,0.1)',
              }}
            >
              {assignee ? assignee.User?.name : '—'}
              <svg width="8" height="5" viewBox="0 0 8 5" fill="none" style={{ opacity: 0.3 }}><path d="M1 1L4 4L7 1" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {editAssignee && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: 4,
                background: '#151520', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                maxHeight: 180, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }}>
                <div onClick={() => saveAssignee(null)} style={{ padding: '9px 14px', cursor: 'pointer', color: !item.assignedTo ? accent : '#a0a0b8', fontSize: '0.74rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Unassigned</div>
                {crew.map(c => (
                  <div key={c.id} onClick={() => saveAssignee(c.userId)} style={{ padding: '9px 14px', cursor: 'pointer', color: (item.assignedTo === c.userId || item.assignedTo === c.id) ? accent : '#a0a0b8', fontSize: '0.74rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {c.User?.name ?? 'Unknown'}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Notes — editable MentionInput */}
        <div className="flex items-start gap-3">
          <span className="font-mono uppercase flex-shrink-0" style={{ fontSize: '0.46rem', color: '#62627a', letterSpacing: '0.08em', width: 68, paddingTop: 1 }}>Notes</span>
          <div
            style={{ flex: 1, fontSize: '0.72rem', color: '#a0a0b8', lineHeight: 1.55, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 6, padding: '10px 12px' }}
            onBlur={() => {
              if (notes !== (item.description ?? '') || notesMentions.join(',') !== ((item as any).mentions ?? []).join(',')) {
                updateItem.mutate({
                  id: item.id,
                  actorId: meId as string,
                  fields: { description: notes || undefined, mentions: notesMentions },
                  contextLabel: `Action Item · ${item.title}`,
                })
              }
            }}
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

      <div style={{ padding: '0 20px' }}>
        {PreviewRow}
        {MessageZone}
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

      {StartSheetOverlay}
    </>
  )
}

// ── SECTION HEAD ──────────────────────────────────────────

function SectionHead({ label, count }: { label: string; count?: string }) {
  return (
    <div className="flex items-center" style={{ padding: '14px 16px 8px' }}>
      <span className="font-mono uppercase flex-1" style={{ fontSize: '0.48rem', color: 'var(--fg-mono)', letterSpacing: '0.14em' }}>{label}</span>
      {count && <span className="font-mono" style={{ fontSize: '0.46rem', color: 'var(--fg-mono)' }}>{count}</span>}
    </div>
  )
}

// ── BUCKET DIVIDER ────────────────────────────────────────
// Cinema-glass `.ai-bucket` pattern — rule | label | rule. The "today"
// variant lights the label in project accent. Section header rule alpha
// matches the spec's bucket-rule (low-alpha hairline both themes).

function BucketDivider({ label, isToday }: { label: string; isToday?: boolean }) {
  return (
    <div className="action-items-bucket flex items-center" style={{ gap: 10, padding: '16px 16px 7px' }}>
      <span className="action-items-bucket-rule flex-1" style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
      <span className="font-mono uppercase flex-shrink-0" style={{ fontSize: '0.5rem', letterSpacing: '0.14em', fontWeight: 600, color: isToday ? 'var(--accent)' : 'var(--fg-mono)' }}>{label}</span>
      <span className="action-items-bucket-rule flex-1" style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────

export default function ActionItemsPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const router = useRouter()
  const { data: project } = useProject(projectId)
  const accent = project?.color || getProjectColor(projectId)

  const [tab, setTab] = useState<Tab>('me')
  const [selected, setSelected] = useState<ActionItem | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [deptFilter, setDeptFilter] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  // Register the + handler with the global ActionBar.
  useFabAction({ onPress: () => { haptic('light'); setShowAdd(true) } })
  const { data: items, isLoading: loadingItems } = useActionItems(projectId)
  const { data: crew, isLoading: loadingCrew } = useCrew(projectId)
  const toggle = useToggleActionItem(projectId)
  const createItem = useCreateActionItem(projectId)
  const threadByActionItemId = useThreadsByEntity(projectId, 'actionItem')

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
    <div
      className="screen"
      style={{
        // Cinema Glass: set the project's accent triplets once at the screen
        // root. Downstream `.sheen-title` / `.glass-tile` / `.sk-block` rules
        // read these and re-tint per project automatically.
        ['--accent' as string]: accent,
        ['--accent-rgb' as string]: hexRgbTriplet(accent),
        ['--accent-glow-rgb' as string]: hexGlowTriplet(accent),
      } as React.CSSProperties}
    >
      {/* Header (PageHeader is a shared component; per the unattended-mode
          brief it stays out of scope. Sheen treatment for the page title is
          deferred to the PageHeader-refactor PR.) */}
      <PageHeader
        projectId={projectId}
        title="Action Items"
        meta={project ? (
          <div className="flex flex-col items-center gap-1.5">
            <ProjectSwitcher projectId={projectId} projectName={project.name} accentColor={accent} variant="meta" />
            <span className={`ai-meta-pill ${statusToPhaseChip(project.status)}`}>
              <span className="phase-dot" />{statusLabel(project.status)}
            </span>
          </div>
        ) : ''}
      />

      {/* Tabs — cinema-glass: active label gets `.sheen-title` (gradient
          driven by the inline accent vars set on the screen root); active
          tab has an accent underline below. Inactive label uses var(--fg-mono)
          so light-mode flips to warm gray-brown. */}
      <div className="action-items-tabs flex sticky top-[73px] z-[19]" style={{ padding: '0 16px', background: 'rgba(4,4,10,0.95)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {([
          { key: 'me' as Tab, label: 'Me', count: myItems.length },
          { key: 'upcoming' as Tab, label: 'Upcoming', count: openItems.length },
          { key: 'dept' as Tab, label: 'Dept', count: Array.from(new Set(openItems.map(i => i.department).filter(Boolean))).length },
        ]).map(t => {
          const isActive = tab === t.key
          return (
            <button
              key={t.key}
              className="action-items-tab flex-1 flex items-center justify-center gap-1.5 relative cursor-pointer select-none"
              style={{ padding: '15px 0', background: 'transparent', border: 'none' }}
              onClick={() => setTab(t.key)}
            >
              <span
                className={isActive ? 'sheen-title' : ''}
                style={{ fontSize: '0.86rem', fontWeight: 600, letterSpacing: '0.005em', color: isActive ? undefined : 'var(--fg-mono)' }}
              >{t.label}</span>
              <span className="font-mono" style={{
                fontSize: '0.40rem', letterSpacing: '0.04em', padding: '1px 5px', borderRadius: 20,
                background: isActive ? `rgba(${hexRgbTriplet(accent)}, 0.14)` : 'rgba(255,255,255,0.05)',
                color: isActive ? accent : 'var(--fg-mono)',
                fontVariantNumeric: 'tabular-nums',
              }}>{t.count}</span>
              {isActive && (
                <div className="absolute" style={{ left: '22%', right: '22%', bottom: -1, height: 2, background: accent, borderRadius: '2px 2px 0 0', boxShadow: `0 0 6px rgba(${hexRgbTriplet(accent)}, 0.5)` }} />
              )}
            </button>
          )
        })}
      </div>

      {/* Panels */}
      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 100 }}>
        {loadingItems || loadingCrew ? (
          <div className="flex flex-col" style={{ padding: '14px 16px 0', gap: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass-tile glass-tile-xs flex items-start" style={{ gap: 11, padding: '12px 13px' }}>
                <div className="sk-block flex-shrink-0" style={{ width: 16, height: 16, borderRadius: '50%', marginTop: 1 }} />
                <div className="flex-1 flex flex-col" style={{ gap: 6 }}>
                  <div className="sk-block" style={{ width: '80%', height: 10 }} />
                  <div className="flex" style={{ gap: 8 }}>
                    <div className="sk-block" style={{ width: 48, height: 7 }} />
                    <div className="sk-block" style={{ width: 36, height: 7 }} />
                  </div>
                </div>
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
                    onTap={() => setSelected(item)} onToggle={() => toggle.mutate({ id: item.id, done: item.status !== 'done' })}
                    threadEntry={threadByActionItemId.get(item.id)} />
                ))}
                {doneItems.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 cursor-pointer select-none" style={{ padding: '14px 16px 10px', marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.05)' }}
                      onClick={() => setShowCompleted(!showCompleted)}>
                      <span className="font-mono uppercase flex-1" style={{ fontSize: '0.48rem', color: 'var(--fg-mono)', letterSpacing: '0.14em' }}>Completed</span>
                      <span className="font-mono" style={{ fontSize: '0.46rem', color: 'var(--fg-mono)' }}>{doneItems.length} tasks</span>
                      <svg width="7" height="11" viewBox="0 0 7 11" fill="none" style={{ opacity: 0.4, transition: 'transform 0.2s', transform: showCompleted ? 'rotate(90deg)' : undefined }}>
                        <path d="M1.5 1.5L5.5 5.5L1.5 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    {showCompleted && doneItems.map(item => (
                      <DoneTaskRow key={item.id} item={item} onTap={() => setSelected(item)} threadEntry={threadByActionItemId.get(item.id)} />
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
                    {todayItems.map(item => <TaskRow key={item.id} item={item} isMine accent={accent} showAssignee crew={allCrew} onTap={() => setSelected(item)} onToggle={() => toggle.mutate({ id: item.id, done: item.status !== 'done' })} threadEntry={threadByActionItemId.get(item.id)} />)}
                  </>
                )}
                {weekItems.length > 0 && (
                  <>
                    <BucketDivider label="This Week" />
                    {weekItems.map(item => <TaskRow key={item.id} item={item} isMine accent={accent} showAssignee crew={allCrew} onTap={() => setSelected(item)} onToggle={() => toggle.mutate({ id: item.id, done: item.status !== 'done' })} threadEntry={threadByActionItemId.get(item.id)} />)}
                  </>
                )}
                {laterItems.length > 0 && (
                  <>
                    <BucketDivider label="Later" />
                    {laterItems.map(item => <TaskRow key={item.id} item={item} isMine accent={accent} showAssignee crew={allCrew} onTap={() => setSelected(item)} onToggle={() => toggle.mutate({ id: item.id, done: item.status !== 'done' })} threadEntry={threadByActionItemId.get(item.id)} />)}
                  </>
                )}
                {openItems.length === 0 && <EmptyState text="Nothing upcoming" />}
              </>
            )}

            {/* DEPT TAB */}
            {tab === 'dept' && (() => {
              const hasUntagged = openItems.some(i => !i.department)
              const filteredItems = deptFilter ? openItems.filter(i => i.department === deptFilter) : openItems
              return (
                <>
                  {/* Cinema-glass `.dept-pill` row — horizontal scroll if it
                      overflows, dept-tinted chip pattern (bg 0.10 / border 0.32
                      / text 0.95). The icon-stacked variant from the spec is
                      omitted because the live code has no per-dept SVGs to
                      port — a follow-up icon-pack PR will adopt the stacked
                      layout when icons land. */}
                  <div className="action-items-dept-filters no-scrollbar flex" style={{ gap: 5, padding: '10px 16px 8px', overflowX: 'auto' }}>
                    {DEPT_OPTIONS.map(dept => {
                      const isActive = deptFilter === dept
                      const dc = DEPT_COLORS[dept] ?? '#7a7a82'
                      const dcRgb = hexRgbTriplet(dc)
                      return (
                        <button key={dept}
                          onClick={() => setDeptFilter(isActive ? null : dept)}
                          className="action-items-dept-pill font-mono uppercase cursor-pointer flex-shrink-0"
                          style={{
                            fontSize: '0.50rem', letterSpacing: '0.10em', padding: '5px 11px', borderRadius: 20,
                            background: isActive ? `rgba(${dcRgb}, 0.18)` : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${isActive ? `rgba(${dcRgb}, 0.50)` : 'rgba(255,255,255,0.08)'}`,
                            color: isActive ? dc : 'var(--fg-mono)',
                            whiteSpace: 'nowrap',
                          }}
                        >{DEPT_SHORT_MAP[dept] ?? dept}</button>
                      )
                    })}
                  </div>

                  {/* Grouped items */}
                  {deptFilter ? (
                    // Single department filtered
                    <>
                      <SectionHead label={deptFilter} count={`${filteredItems.length} open`} />
                      {filteredItems.map(item => (
                        <TaskRow key={item.id} item={item} isMine accent={accent} showAssignee crew={allCrew}
                          onTap={() => setSelected(item)} onToggle={() => toggle.mutate({ id: item.id, done: item.status !== 'done' })} threadEntry={threadByActionItemId.get(item.id)} />
                      ))}
                    </>
                  ) : (
                    // All departments grouped
                    <>
                      {DEPT_OPTIONS.map(dept => {
                        const deptItems = openItems.filter(i => i.department === dept)
                        if (deptItems.length === 0) return null
                        return (
                          <div key={dept}>
                            <BucketDivider label={DEPT_SHORT_MAP[dept] ?? dept} />
                            {deptItems.map(item => (
                              <TaskRow key={item.id} item={item} isMine accent={accent} showAssignee crew={allCrew}
                                onTap={() => setSelected(item)} onToggle={() => toggle.mutate({ id: item.id, done: item.status !== 'done' })} threadEntry={threadByActionItemId.get(item.id)} />
                            ))}
                          </div>
                        )
                      })}
                      {hasUntagged && (
                        <div>
                          <BucketDivider label="Untagged" />
                          {openItems.filter(i => !i.department).map(item => (
                            <TaskRow key={item.id} item={item} isMine accent={accent} showAssignee crew={allCrew}
                              onTap={() => setSelected(item)} onToggle={() => toggle.mutate({ id: item.id, done: item.status !== 'done' })} threadEntry={threadByActionItemId.get(item.id)} />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {openItems.length === 0 && <EmptyState text="No items" />}
                </>
              )
            })()}
          </>
        )}
      </div>

      {/* + handler registered above via useFabAction. ActionBar is mounted globally. */}

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