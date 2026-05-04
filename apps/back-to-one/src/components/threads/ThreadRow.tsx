// Shared cross-project Thread row, originally extracted from
// GlobalPanels.tsx > ThreadsPanel. Used by /projects/threads to render
// the company-wide threads list at full page scale. The compact panel
// rendering this came from has been retired (Threads moved from a
// fan-arc panel to its own route in PR 2c).

import type { Thread, Project } from '@/types'

const AVATAR_COLORS = [
  { bg: 'rgba(100,112,243,0.2)', text: '#6470f3' },
  { bg: 'rgba(74,232,160,0.2)',  text: '#4ae8a0' },
  { bg: 'rgba(232,196,74,0.2)',  text: '#e8c44a' },
  { bg: 'rgba(74,184,232,0.2)',  text: '#4ab8e8' },
  { bg: 'rgba(196,90,220,0.2)',  text: '#c45adc' },
]

function genericThreadLabel(attachedToType: string): string {
  switch (attachedToType) {
    case 'shot':          return 'Shot'
    case 'scene':         return 'Scene'
    case 'location':      return 'Location'
    case 'character':     return 'Character'
    case 'cast':          return 'Cast'
    case 'crew':          return 'Crew'
    case 'prop':          return 'Prop'
    case 'wardrobe':      return 'Wardrobe'
    case 'hmu':           return 'HMU'
    case 'moodboardRef':  return 'Moodboard'
    case 'actionItem':    return 'Action'
    case 'milestone':     return 'Milestone'
    case 'deliverable':   return 'Deliverable'
    case 'workflowStage': return 'Workflow'
    case 'inventoryItem': return 'Inventory'
    default:              return 'Thread'
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function projectName(projects: Project[], projectId: string): string {
  return projects.find(p => p.id === projectId)?.name ?? 'Project'
}

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

export function ThreadRow({ thread, projects, index }: { thread: Thread; projects: Project[]; index: number }) {
  const ac = AVATAR_COLORS[index % AVATAR_COLORS.length]
  const lastMsg = thread.messages[thread.messages.length - 1]
  const preview = lastMsg?.content ?? ''
  const timeAgo = thread.updatedAt ? formatDate(thread.updatedAt) : ''
  const label = genericThreadLabel(thread.attachedToType)
  const initials = label.slice(0, 2).toUpperCase()

  return (
    <div style={{
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
          <div style={{ fontWeight: 600, fontSize: 12, color: '#dddde8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
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
          <ProjPill name={projectName(projects, thread.projectId)} />
          {thread.messages.length > 0 && (
            <span className="font-mono" style={{ fontSize: 9, color: '#62627a' }}>{thread.messages.length} msg{thread.messages.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </div>
  )
}
