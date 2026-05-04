'use client'

// Slide-up detail "page" rendered inside a GlobalPanels panel frame when
// a list row is tapped. Covers the panel content area exactly so the
// transition reads like a stacked navigation step rather than a separate
// modal — same surface, same shape, just a deeper layer.
//
// Type discriminated by the selected detail's `type`:
//   task       → ActionItem detail with status toggle + project link
//   milestone  → Milestone detail with date countdown + project link
//   crew       → ProjectMember/User detail aggregated across projects
//
// Activity rows are intentionally not given a detail — they are
// auto-generated log entries; the source row is the source of truth.
// Schedule "Shoot Day" events route to the project chat instead of opening
// a detail (no shoot-day record exists yet).

import Image from 'next/image'
import { m, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useToggleActionItem } from '@/lib/hooks/useOriginOne'
import { haptic } from '@/lib/utils/haptics'
import { MILESTONE_STATUS_HEX, getProjectColor, statusHex, statusLabel } from '@/lib/utils/phase'
import type { ActionItem, Milestone, Project } from '@/types'

interface CrewDetailRow {
  userId: string
  name: string
  email?: string
  avatarUrl: string | null
  projectIds: string[]
  // role/department vary per project; pass the raw ProjectMember rows so
  // the detail can render per-project membership cleanly.
  memberships: { projectId: string; role: string; department: string | null }[]
}

export type PanelDetail =
  | { type: 'task'; item: ActionItem }
  | { type: 'milestone'; item: Milestone }
  | { type: 'crew'; row: CrewDetailRow }

interface PanelDetailSheetProps {
  detail: PanelDetail | null
  projects: Project[]
  onClose: () => void
}

// ── Helpers ────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - now.getTime()) / 86400000)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

function projectName(projects: Project[], id: string): string {
  return projects.find(p => p.id === id)?.name ?? 'Project'
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (!parts[0]) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ── Shared header ──────────────────────────────────────────

function DetailHeader({ kicker, accent, onClose }: { kicker: string; accent: string; onClose: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px 10px', flexShrink: 0,
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <button
        onClick={onClose}
        className="active:opacity-60 transition-opacity"
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6, padding: 0,
          color: '#8a8a9a', fontSize: 12,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span>Back</span>
      </button>
      <span className="font-mono uppercase" style={{
        fontSize: 9, color: accent, letterSpacing: '0.12em',
      }}>
        {kicker}
      </span>
    </div>
  )
}

function ProjectLinkPill({ project, onTap }: { project: Project; onTap: () => void }) {
  const color = project.color || getProjectColor(project.id)
  return (
    <button
      onClick={onTap}
      className="active:opacity-70 transition-opacity"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '5px 10px', borderRadius: 20,
        background: `${color}1f`,
        border: `1px solid ${color}40`,
        color, fontSize: 11, fontWeight: 500,
        cursor: 'pointer',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
      {project.name}
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
        <path d="M4 2h6v6M10 2L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  )
}

// ── Type-specific bodies ───────────────────────────────────

function TaskDetailBody({ item, projects, onClose }: { item: ActionItem; projects: Project[]; onClose: () => void }) {
  const router = useRouter()
  const toggle = useToggleActionItem(item.projectId)
  const project = projects.find(p => p.id === item.projectId)
  const days = item.dueDate ? daysUntil(item.dueDate) : null
  const dueLabel = days === null ? 'No due date'
    : days === 0 ? 'Today'
    : days < 0 ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} late`
    : `In ${days} day${days !== 1 ? 's' : ''} · ${formatDate(item.dueDate!)}`
  const dueColor = days === null ? '#62627a'
    : days < 0 ? '#e8564a'
    : days === 0 ? '#c45adc'
    : days <= 7 ? '#e8a020'
    : '#62627a'
  const isDone = item.status === 'done'

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 18px', display: 'flex', flexDirection: 'column', gap: 14, overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
      <div style={{
        fontWeight: 700, fontSize: 18, color: isDone ? '#62627a' : '#dddde8',
        letterSpacing: '-0.01em', lineHeight: 1.25,
        textDecoration: isDone ? 'line-through' : 'none',
      }}>
        {item.title}
      </div>
      {item.description && (
        <div style={{ fontSize: 13, color: '#a0a0b8', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
          {item.description}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <DetailRow label="Due" value={dueLabel} valueColor={dueColor} />
        <DetailRow label="Status" value={item.status} valueColor={isDone ? '#00b894' : '#e8a020'} mono />
        {item.department && <DetailRow label="Department" value={item.department} />}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {project && (
          <ProjectLinkPill
            project={project}
            onTap={() => { haptic('light'); onClose(); router.push(`/projects/${project.id}/action-items`) }}
          />
        )}
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
        <button
          onClick={() => { haptic('light'); toggle.mutate({ id: item.id, done: !isDone }) }}
          className="active:opacity-80 transition-opacity"
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 10,
            border: `1px solid ${isDone ? 'rgba(232,160,32,0.5)' : 'rgba(0,184,148,0.5)'}`,
            background: isDone ? 'rgba(232,160,32,0.12)' : 'rgba(0,184,148,0.16)',
            color: isDone ? '#e8a020' : '#00b894',
            fontSize: 12, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {isDone ? 'Reopen' : 'Mark done'}
        </button>
      </div>
    </div>
  )
}

function MilestoneDetailBody({ item, projects, onClose }: { item: Milestone; projects: Project[]; onClose: () => void }) {
  const router = useRouter()
  const project = projects.find(p => p.id === item.projectId)
  const days = daysUntil(item.date)
  const statusColor = MILESTONE_STATUS_HEX[item.status] ?? '#c45adc'
  const countdown = days === 0 ? 'Today' : days < 0 ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ago` : `In ${days} day${days !== 1 ? 's' : ''}`

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 18px', display: 'flex', flexDirection: 'column', gap: 14, overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ fontWeight: 700, fontSize: 18, color: '#dddde8', letterSpacing: '-0.01em', lineHeight: 1.25 }}>
        {item.title}
      </div>
      {(item as any).notes && (
        <div style={{ fontSize: 13, color: '#a0a0b8', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
          {(item as any).notes}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <DetailRow label="Date" value={formatDate(item.date)} />
        <DetailRow label="Countdown" value={countdown} valueColor={days < 0 ? '#62627a' : days <= 7 ? '#e8564a' : days <= 14 ? '#e8a020' : '#a0a0b8'} mono />
        <DetailRow label="Status" value={item.status} valueColor={statusColor} mono />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {project && (
          <ProjectLinkPill
            project={project}
            onTap={() => { haptic('light'); onClose(); router.push(`/projects/${project.id}/timeline`) }}
          />
        )}
      </div>
    </div>
  )
}

function CrewDetailBody({ row, projects, onClose }: { row: CrewDetailRow; projects: Project[]; onClose: () => void }) {
  const router = useRouter()
  // Aggregate department counts across memberships so the detail surfaces a
  // primary department (most common) rather than picking one arbitrarily.
  const deptCounts = new Map<string, number>()
  for (const m of row.memberships) {
    if (m.department) deptCounts.set(m.department, (deptCounts.get(m.department) ?? 0) + 1)
  }
  const primaryDept = Array.from(deptCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 18px', display: 'flex', flexDirection: 'column', gap: 14, overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {row.avatarUrl ? (
          <Image src={row.avatarUrl} alt="" width={56} height={56} sizes="56px" style={{ borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 18,
            background: 'rgba(100,112,243,0.18)',
            border: '1px solid rgba(100,112,243,0.35)',
            color: '#a8b0ff',
          }}>
            {getInitials(row.name)}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#dddde8', letterSpacing: '-0.01em' }}>{row.name}</div>
          {primaryDept && <div className="font-mono" style={{ fontSize: 10, color: '#62627a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{primaryDept}</div>}
        </div>
      </div>
      {row.email && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <DetailRow label="Email" value={row.email} mono small />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="font-mono uppercase" style={{ fontSize: 9, color: '#62627a', letterSpacing: '0.12em' }}>
          On {row.memberships.length} project{row.memberships.length !== 1 ? 's' : ''}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {row.memberships.map((m) => {
            const project = projects.find(p => p.id === m.projectId)
            if (!project) return null
            const color = project.color || getProjectColor(project.id)
            return (
              <button
                key={`${m.projectId}-${m.role}`}
                onClick={() => { haptic('light'); onClose(); router.push(`/projects/${project.id}`) }}
                className="active:opacity-70 transition-opacity"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 10,
                  background: `${color}10`, border: `1px solid ${color}30`,
                  color: '#dddde8', fontSize: 12,
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                  {project.name}
                </span>
                <span className="font-mono" style={{ fontSize: 9, color: '#62627a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {m.role}{m.department ? ` · ${m.department}` : ''}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value, valueColor, mono, small }: {
  label: string; value: string; valueColor?: string; mono?: boolean; small?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
      <span className="font-mono uppercase" style={{ fontSize: 9, color: '#62627a', letterSpacing: '0.12em' }}>{label}</span>
      <span
        className={mono ? 'font-mono' : ''}
        style={{
          fontSize: small ? 11 : 12,
          color: valueColor ?? '#dddde8',
          fontWeight: 500,
          textAlign: 'right',
          wordBreak: 'break-word',
          textTransform: mono ? 'uppercase' : 'none',
          letterSpacing: mono ? '0.06em' : '0',
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ── Sheet shell ────────────────────────────────────────────

export function PanelDetailSheet({ detail, projects, onClose }: PanelDetailSheetProps) {
  const kicker = detail?.type === 'task' ? 'Task'
    : detail?.type === 'milestone' ? 'Milestone'
    : detail?.type === 'crew' ? 'Crew member'
    : ''
  const accent = detail?.type === 'task' ? 'rgba(232,160,32,0.7)'
    : detail?.type === 'milestone' ? 'rgba(196,90,220,0.7)'
    : detail?.type === 'crew' ? 'rgba(74,184,232,0.7)'
    : 'rgba(196,90,220,0.7)'

  return (
    <AnimatePresence>
      {detail && (
        <m.div
          key="panel-detail"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          // Cover the parent panel content area exactly. Border-radius matches
          // the panel's so the slide-up reads as a stacked navigation step.
          style={{
            position: 'absolute',
            top: 2, left: 0, right: 0, bottom: 0,
            background: 'rgba(10,10,18,0.88)',
            backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
            display: 'flex', flexDirection: 'column',
            borderRadius: '0 0 20px 20px',
            zIndex: 5,
          }}
        >
          <DetailHeader kicker={kicker} accent={accent} onClose={onClose} />
          {detail.type === 'task' && <TaskDetailBody item={detail.item} projects={projects} onClose={onClose} />}
          {detail.type === 'milestone' && <MilestoneDetailBody item={detail.item} projects={projects} onClose={onClose} />}
          {detail.type === 'crew' && <CrewDetailBody row={detail.row} projects={projects} onClose={onClose} />}
        </m.div>
      )}
    </AnimatePresence>
  )
}

export type { CrewDetailRow }
