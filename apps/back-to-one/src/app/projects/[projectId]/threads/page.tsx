'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useProject, useThreads, usePostMessage, useCrew } from '@/lib/hooks/useOriginOne'
import { useThreadContexts, type ThreadContext } from '@/lib/thread-context'
import { Sheet } from '@/components/ui/Sheet'
import { haptic } from '@/lib/utils/haptics'
import type { Thread, ThreadMessage, TeamMember } from '@/types'

// Thread-system fixed colors — never project-derived
const TV = '#7C3AED'
const TA = '#F59E0B'

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (name[0] ?? '?').toUpperCase()
}

function avatarStyle(seed: string): { bg: string; color: string } {
  const palette = [
    { bg: 'rgba(124,58,237,0.2)', color: '#a78bfa' },
    { bg: 'rgba(100,112,243,0.2)', color: '#818cf8' },
    { bg: 'rgba(20,184,166,0.2)', color: '#5eead4' },
    { bg: 'rgba(74,222,128,0.2)', color: '#86efac' },
    { bg: 'rgba(239,68,68,0.2)', color: '#fca5a5' },
    { bg: 'rgba(245,158,11,0.2)', color: '#fbbf24' },
  ]
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return palette[Math.abs(hash) % palette.length]
}

function timeStamp(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// Gradients for thumbnail fallback squares — each is a dark two-stop blend
// toned with the type's BRAND_TOKENS accent (see CHIP_STYLES below).
const GRADIENTS: Record<string, string> = {
  'th-shot':          'linear-gradient(135deg, #1a1030, #0d1a2e)',  // violet      #9b6ef3
  'th-scene':         'linear-gradient(135deg, #140c1e, #0f0918)',  // lavender    #b890f0
  'th-location':      'linear-gradient(135deg, #0a1a14, #081a1a)',  // green       #3cbe6a
  'th-character':     'linear-gradient(135deg, #1a0b12, #14080e)',  // rose        #e8507a
  'th-cast':          'linear-gradient(135deg, #1a0e0e, #2a1218)',  // coral       #f07050
  'th-crew':          'linear-gradient(135deg, #0c1018, #0a0e14)',  // slate       #6888b8
  'th-prop':          'linear-gradient(135deg, #1a1006, #14100a)',  // orange      #f08030
  'th-wardrobe':      'linear-gradient(135deg, #1a0a16, #14081a)',  // pink        #e868c8
  'th-hmu':           'linear-gradient(135deg, #0a1a14, #081a10)',  // mint        #50d898
  'th-moodboardRef':  'linear-gradient(135deg, #141210, #0f0d0a)',  // warm white  #e8e0d0
  'th-actionItem':    'linear-gradient(135deg, #1a1506, #1a1208)',  // gold        #e8c44a
  'th-milestone':     'linear-gradient(135deg, #081818, #051414)',  // cyan        #22d4d4
  'th-deliverable':   'linear-gradient(135deg, #1a0808, #140606)',  // red         #e84848
  'th-workflowStage': 'linear-gradient(135deg, #141806, #0f1408)',  // lime        #a8d428
}

// Chip palette — BRAND_TOKENS project accents, direct hex values.
// Non-phase accents only (phase colors amber #e8a020 / indigo #6470f3 / teal #00b894
// are reserved for Pre-Production / Production / Post-Production semantics).
// Pattern: bg = base @ 0.10 alpha, border = base @ 0.22, color = base @ 0.9.
const CHIP_STYLES: Record<string, { bg: string; border: string; color: string }> = {
  'obj-shot':          { bg: 'rgba(155,110,243,0.1)', border: 'rgba(155,110,243,0.22)', color: 'rgba(155,110,243,0.9)' }, // #9b6ef3 violet
  'obj-scene':         { bg: 'rgba(184,144,240,0.1)', border: 'rgba(184,144,240,0.22)', color: 'rgba(184,144,240,0.9)' }, // #b890f0 lavender
  'obj-location':      { bg: 'rgba(60,190,106,0.1)',  border: 'rgba(60,190,106,0.22)',  color: 'rgba(60,190,106,0.9)'  }, // #3cbe6a green
  'obj-character':     { bg: 'rgba(232,80,122,0.1)',  border: 'rgba(232,80,122,0.22)',  color: 'rgba(232,80,122,0.9)'  }, // #e8507a rose
  'obj-cast':          { bg: 'rgba(240,112,80,0.1)',  border: 'rgba(240,112,80,0.22)',  color: 'rgba(240,112,80,0.9)'  }, // #f07050 coral
  'obj-crew':          { bg: 'rgba(104,136,184,0.1)', border: 'rgba(104,136,184,0.22)', color: 'rgba(104,136,184,0.9)' }, // #6888b8 slate
  'obj-prop':          { bg: 'rgba(240,128,48,0.1)',  border: 'rgba(240,128,48,0.22)',  color: 'rgba(240,128,48,0.9)'  }, // #f08030 orange
  'obj-wardrobe':      { bg: 'rgba(232,104,200,0.1)', border: 'rgba(232,104,200,0.22)', color: 'rgba(232,104,200,0.9)' }, // #e868c8 pink
  'obj-hmu':           { bg: 'rgba(80,216,152,0.1)',  border: 'rgba(80,216,152,0.22)',  color: 'rgba(80,216,152,0.9)'  }, // #50d898 mint
  'obj-moodboardRef':  { bg: 'rgba(232,224,208,0.1)', border: 'rgba(232,224,208,0.22)', color: 'rgba(232,224,208,0.9)' }, // #e8e0d0 warm white
  'obj-actionItem':    { bg: 'rgba(232,196,74,0.1)',  border: 'rgba(232,196,74,0.22)',  color: 'rgba(232,196,74,0.9)'  }, // #e8c44a gold
  'obj-milestone':     { bg: 'rgba(34,212,212,0.1)',  border: 'rgba(34,212,212,0.22)',  color: 'rgba(34,212,212,0.9)'  }, // #22d4d4 cyan
  'obj-deliverable':   { bg: 'rgba(232,72,72,0.1)',   border: 'rgba(232,72,72,0.22)',   color: 'rgba(232,72,72,0.9)'   }, // #e84848 red
  'obj-workflowStage': { bg: 'rgba(168,212,40,0.1)',  border: 'rgba(168,212,40,0.22)',  color: 'rgba(168,212,40,0.9)'  }, // #a8d428 lime
}

// ── Sub-components ────────────────────────────────────────

function ObjChip({ chipType, children, style }: { chipType: string; children: React.ReactNode; style?: React.CSSProperties }) {
  const s = CHIP_STYLES[chipType] ?? CHIP_STYLES['obj-actionItem']
  return (
    <span
      className="font-mono uppercase"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '2px 8px', borderRadius: 20,
        fontSize: 8, letterSpacing: '0.06em',
        background: s.bg, border: `1px solid ${s.border}`, color: s.color,
        marginBottom: 5,
        ...style,
      }}
    >
      {children}
    </span>
  )
}

function Thumbnail({ ctx, size = 52 }: { ctx: ThreadContext; size?: number }) {
  const bg = GRADIENTS[ctx.thumbnailGradient] ?? GRADIENTS['th-actionItem']
  return (
    <div
      style={{
        width: size, height: size,
        borderRadius: size >= 48 ? 7 : 6,
        flexShrink: 0, overflow: 'hidden',
        position: 'relative',
        border: '1px solid rgba(255,255,255,0.07)',
        background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {ctx.thumbnailType === 'image' && ctx.thumbnailValue?.startsWith('http') ? (
        <img src={ctx.thumbnailValue} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : ctx.thumbnailType === 'avatar' && ctx.thumbnailValue ? (
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          ...avatarStyle(ctx.thumbnailValue),
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 700,
        }}>{initialsOf(ctx.thumbnailValue)}</div>
      ) : ctx.thumbnailGradient === 'th-actionItem' ? (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="3" y="3" width="12" height="12" rx="2" stroke="rgba(232,196,74,0.5)" strokeWidth="1.2"/>
          <path d="M6 9l2 2 4-4" stroke="rgba(232,196,74,0.7)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : ctx.thumbnailGradient === 'th-milestone' ? (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="5.5" stroke="rgba(34,212,212,0.5)" strokeWidth="1.2"/>
          <path d="M9 6v3l2 1.5" stroke="rgba(34,212,212,0.7)" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      ) : ctx.thumbnailGradient === 'th-location' ? (
        <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
          <path d="M8 1C5.24 1 3 3.24 3 6c0 3.75 5 11 5 11s5-7.25 5-11c0-2.76-2.24-5-5-5z" stroke="rgba(60,190,106,0.6)" strokeWidth="1.2" fill="rgba(60,190,106,0.1)"/>
          <circle cx="8" cy="6" r="1.5" stroke="rgba(60,190,106,0.7)" strokeWidth="1.2"/>
        </svg>
      ) : ctx.thumbnailGradient === 'th-scene' ? (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="3" y="4" width="12" height="10" rx="1.5" stroke="rgba(184,144,240,0.5)" strokeWidth="1.2"/>
          <path d="M3 7h12" stroke="rgba(184,144,240,0.4)" strokeWidth="1"/>
        </svg>
      ) : ctx.thumbnailGradient === 'th-shot' && ctx.thumbnailValue ? (
        <div style={{
          position: 'absolute', bottom: 4, right: 4,
          fontFamily: "'Geist Mono', monospace", fontSize: 8, fontWeight: 700,
          letterSpacing: '0.04em', padding: '1px 4px', borderRadius: 3,
          background: 'rgba(0,0,0,0.5)', color: 'rgba(155,110,243,0.9)',
        }}>{ctx.thumbnailValue}</div>
      ) : null}
    </div>
  )
}

function ThreadCard({
  thread, context, crew, onTap, resolved = false,
}: {
  thread: Thread
  context: ThreadContext
  crew: TeamMember[]
  onTap: () => void
  resolved?: boolean
}) {
  const lastMsg = thread.messages[thread.messages.length - 1] ?? null
  const sender = lastMsg ? crew.find(c => c.userId === lastMsg.createdBy) : null
  const senderName = sender?.User?.name ?? (lastMsg ? 'Unknown' : '')

  const participantIds = useMemo(() => {
    const ids = new Set<string>()
    if (thread.createdBy) ids.add(thread.createdBy)
    for (const m of thread.messages) if (m.createdBy) ids.add(m.createdBy)
    return Array.from(ids)
  }, [thread])

  return (
    <div
      onClick={() => { haptic('light'); onTap() }}
      style={{
        margin: '0 14px 6px',
        background: 'rgba(255,255,255,0.025)',
        border: `1px solid ${thread.unread ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 12,
        padding: '10px 12px 10px 10px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex', gap: 10, alignItems: 'flex-start',
        opacity: resolved ? 0.4 : 1,
      }}
    >
      {thread.unread && (
        <div style={{
          position: 'absolute', left: 0, top: 10, bottom: 10,
          width: 2.5, background: TA, borderRadius: '0 2px 2px 0',
        }} />
      )}

      <Thumbnail ctx={context} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <ObjChip chipType={context.chipType} style={resolved ? { opacity: 0.7 } : undefined}>
          {context.displayLabel}
        </ObjChip>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 7 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 11.5, color: 'rgba(255,255,255,0.5)',
              lineHeight: 1.45,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {lastMsg ? (
                <>
                  <span style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>{senderName}:</span>{' '}
                  {lastMsg.content}
                </>
              ) : (
                <span style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>No messages yet</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
            <span className="font-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)' }}>
              {timeStamp(thread.updatedAt)}
            </span>
            {resolved ? (
              <span className="font-mono uppercase" style={{
                fontSize: 8, letterSpacing: '0.08em', padding: '2px 6px', borderRadius: 10,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.22)',
              }}>Done</span>
            ) : thread.unread ? (
              <div style={{
                width: 17, height: 17, borderRadius: '50%', background: TA,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Geist Mono', monospace", fontSize: 8, fontWeight: 700, color: '#fff',
              }}>{thread.messages.length}</div>
            ) : null}
          </div>
        </div>

        {!resolved && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {participantIds.slice(0, 3).map((uid, i) => {
                const c = crew.find(m => m.userId === uid)
                const name = c?.User?.name ?? '?'
                const av = avatarStyle(name)
                return (
                  <div key={uid} style={{
                    width: 18, height: 18, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 6, fontWeight: 700,
                    marginLeft: i === 0 ? 0 : -4,
                    border: '1.5px solid #080808',
                    flexShrink: 0,
                    background: av.bg, color: av.color,
                  }}>{initialsOf(name)}</div>
                )
              })}
            </div>
            {thread.messages.length > 0 && (
              <span className="font-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)' }}>
                {thread.messages.length} {thread.messages.length === 1 ? 'reply' : 'replies'}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Thread Sheet (full conversation view) ─────────────────

function ThreadDetailSheet({
  thread, context, crew, projectId, meId, onClose,
}: {
  thread: Thread | null
  context: ThreadContext | null
  crew: TeamMember[]
  projectId: string
  meId: string | null
  onClose: () => void
}) {
  const [reply, setReply] = useState('')
  const postMessage = usePostMessage(projectId)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [thread?.messages.length])

  if (!thread || !context) return null

  const handleSend = () => {
    if (!reply.trim() || !meId) return
    postMessage.mutate({ threadId: thread.id, createdBy: meId, content: reply.trim() })
    setReply('')
  }

  const meMember = meId ? crew.find(c => c.userId === meId) : null
  const meName = meMember?.User?.name ?? ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '82vh' }}>
      {/* Sheet header — thumb + chip + project, Done button */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <Thumbnail ctx={context} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <ObjChip chipType={context.chipType}>{context.displayLabel}</ObjChip>
        </div>
        <button
          onClick={onClose}
          style={{
            fontSize: 13, fontWeight: 600, color: TV,
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: '4px 8px',
          }}
        >
          Done
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {thread.messages.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <span className="font-mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)' }}>
              No messages yet — start the conversation
            </span>
          </div>
        ) : (
          [...thread.messages]
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
            .map(msg => {
              const author = crew.find(c => c.userId === msg.createdBy)
              const name = author?.User?.name ?? 'Unknown'
              const role = author?.role ?? ''
              const av = avatarStyle(name)
              return (
                <div key={msg.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700, flexShrink: 0,
                    background: av.bg, color: av.color,
                    border: `1px solid ${av.color}30`,
                  }}>{initialsOf(name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', marginBottom: 3 }}>
                      {name}{role ? ` · ${role}` : ''}
                    </div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55 }}>
                      {msg.content}
                    </div>
                    <div className="font-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', marginTop: 4 }}>
                      {timeStamp(msg.createdAt)}
                    </div>
                  </div>
                </div>
              )
            })
        )}
      </div>

      {/* Reply bar */}
      <div style={{ padding: '10px 14px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 22, padding: '8px 10px 8px 12px',
        }}>
          {meName && (
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, fontWeight: 700, flexShrink: 0,
              ...avatarStyle(meName),
            }}>{initialsOf(meName)}</div>
          )}
          <input
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSend() } }}
            placeholder="Reply…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 13, color: '#fff',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!reply.trim() || !meId}
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: TV, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', cursor: 'pointer', flexShrink: 0,
              fontSize: 13, color: '#fff',
              opacity: reply.trim() && meId ? 1 : 0.4,
            }}
          >↑</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────

export default function ThreadsPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const router = useRouter()
  const { data: project } = useProject(projectId)
  const { data: threads, isLoading: loadingThreads } = useThreads(projectId)
  const { data: crew, isLoading: loadingCrew } = useCrew(projectId)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const allThreads: Thread[] = useMemo(() => (threads ?? []) as Thread[], [threads])
  const allCrew: TeamMember[] = useMemo(() => (crew ?? []) as TeamMember[], [crew])
  const meId: string | null = allCrew[0]?.userId ?? null

  const contexts = useThreadContexts(projectId, allThreads)

  // Partition: unread / recent / resolved (resolved is always empty — no resolvedAt field yet)
  const unreadThreads = allThreads.filter(t => t.unread && !(t as any).resolvedAt)
  const recentThreads = allThreads.filter(t => !t.unread && !(t as any).resolvedAt)
  const resolvedThreads = allThreads.filter(t => !!(t as any).resolvedAt)

  const activeCount = allThreads.length - resolvedThreads.length
  const unreadCount = unreadThreads.length

  const selected = selectedId ? allThreads.find(t => t.id === selectedId) ?? null : null
  const selectedContext = selected ? contexts.get(selected.id) ?? null : null

  const projectName = project?.name ?? ''

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      minHeight: '100vh', background: '#060606', color: '#fff',
    }}>
      {/* Page header — matches reference exactly */}
      <div style={{
        textAlign: 'center',
        padding: '0 20px 0',
        paddingTop: 'calc(var(--safe-top) + 16px)',
        position: 'relative',
      }}>
        <div className="font-mono uppercase" style={{
          fontSize: 9, letterSpacing: '0.16em', color: TV, marginBottom: 3,
        }}>{projectName}</div>
        <div style={{
          fontSize: 22, fontWeight: 700, letterSpacing: '0.05em',
          textTransform: 'uppercase', lineHeight: 1, marginBottom: 5,
        }}>Threads</div>
        <div className="font-mono" style={{
          fontSize: 10, color: 'rgba(255,255,255,0.22)',
          letterSpacing: '0.05em', marginBottom: 12,
        }}>
          {activeCount} active · {unreadCount} unread
        </div>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />
      </div>

      {/* Scroll area */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 32 }}>
        {loadingThreads || loadingCrew ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <span className="font-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)' }}>Loading…</span>
          </div>
        ) : allThreads.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>No threads yet</div>
            <div className="font-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.04em', lineHeight: 1.6 }}>
              Start one from any shot, scene, task, or item.
            </div>
          </div>
        ) : (
          <>
            {unreadThreads.length > 0 && (
              <>
                <SectionLabel label="Unread" count={unreadThreads.length} />
                {unreadThreads.map(t => (
                  <ThreadCard
                    key={t.id}
                    thread={t}
                    context={contexts.get(t.id) ?? fallbackContext()}
                    crew={allCrew}
                    onTap={() => setSelectedId(t.id)}
                  />
                ))}
              </>
            )}
            {recentThreads.length > 0 && (
              <>
                <SectionLabel label="Recent" count={recentThreads.length} topMargin={unreadThreads.length > 0 ? 4 : 0} />
                {recentThreads.map(t => (
                  <ThreadCard
                    key={t.id}
                    thread={t}
                    context={contexts.get(t.id) ?? fallbackContext()}
                    crew={allCrew}
                    onTap={() => setSelectedId(t.id)}
                  />
                ))}
              </>
            )}
            {resolvedThreads.length > 0 && (
              <>
                <SectionLabel label="Resolved" count={resolvedThreads.length} topMargin={4} />
                {resolvedThreads.map(t => (
                  <ThreadCard
                    key={t.id}
                    thread={t}
                    context={contexts.get(t.id) ?? fallbackContext()}
                    crew={allCrew}
                    onTap={() => setSelectedId(t.id)}
                    resolved
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>

      <Sheet open={!!selected} onClose={() => setSelectedId(null)} maxHeight="88vh">
        <ThreadDetailSheet
          thread={selected}
          context={selectedContext}
          crew={allCrew}
          projectId={projectId}
          meId={meId}
          onClose={() => setSelectedId(null)}
        />
      </Sheet>

      {/* Back button — FAB position, bottom center */}
      <button
        onClick={() => { haptic('light'); router.back() }}
        aria-label="Back"
        style={{
          position: 'fixed',
          bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 52, height: 52, borderRadius: '50%',
          background: 'rgba(10,10,18,0.7)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(255,255,255,0.7)', fontSize: 22, lineHeight: 1,
          cursor: 'pointer',
          zIndex: 30,
        }}
      >‹</button>
    </div>
  )
}

function SectionLabel({ label, count, topMargin = 0 }: { label: string; count: number; topMargin?: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 20px 6px',
      marginTop: topMargin,
    }} className="font-mono uppercase">
      <span style={{ fontSize: 9, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.22)' }}>{label}</span>
      <span style={{ fontSize: 9, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.22)' }}>{count}</span>
    </div>
  )
}

function fallbackContext(): ThreadContext {
  return {
    displayLabel: 'Thread',
    chipType: 'obj-actionItem',
    thumbnailType: 'icon',
    thumbnailValue: null,
    thumbnailGradient: 'th-actionItem',
  }
}
