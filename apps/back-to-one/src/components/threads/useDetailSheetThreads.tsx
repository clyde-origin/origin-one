'use client'

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import {
  useThreads,
  useCreateThread,
  usePostMessage,
  useCrew,
  useMarkThreadRead,
  useMeId,
} from '@/lib/hooks/useOriginOne'
import { TV, TA } from '@/lib/thread-tokens'
import { haptic } from '@/lib/utils/haptics'
import type { Thread, ThreadAttachmentType, TeamMember } from '@/types'

// Shared thread surface for every detail sheet. Returns the four pieces each
// sheet drops in. Placement (header icon, body preview, body zone, overlay)
// is the caller's call — but the behavior and look are unified here.

export interface DetailSheetThreadsArgs {
  projectId: string
  attachedToType: ThreadAttachmentType
  attachedToId: string | null
  subjectLabel: string
}

export interface DetailSheetThreadsParts {
  TriggerIcon: ReactElement | null
  PreviewRow: ReactElement | null
  MessageZone: ReactElement | null
  StartSheetOverlay: ReactElement | null
}

export function useDetailSheetThreads({
  projectId,
  attachedToType,
  attachedToId,
  subjectLabel,
}: DetailSheetThreadsArgs): DetailSheetThreadsParts {
  const { data: threads } = useThreads(projectId)
  const { data: crew } = useCrew(projectId)
  const createThread = useCreateThread(projectId)
  const postMessage = usePostMessage(projectId)
  const meId = useMeId()

  const [threadOpen, setThreadOpen] = useState(false)
  const [starting, setStarting] = useState(false)

  const allCrew: TeamMember[] = useMemo(() => (crew ?? []) as TeamMember[], [crew])
  const allThreads: Thread[] = useMemo(() => (threads ?? []) as Thread[], [threads])

  const thread = useMemo(() => {
    if (!attachedToId) return null
    return allThreads.find(
      t => t.attachedToType === attachedToType && t.attachedToId === attachedToId,
    ) ?? null
  }, [allThreads, attachedToType, attachedToId])

  // Close zone + cancel start flow when the subject changes (sheet rebinds).
  useEffect(() => {
    setThreadOpen(false)
    setStarting(false)
  }, [attachedToType, attachedToId])

  const canAct = !!attachedToId && !!meId

  const handleTriggerClick = () => {
    if (!canAct) return
    haptic('light')
    if (thread) {
      setThreadOpen(open => !open)
    } else {
      setStarting(true)
    }
  }

  const handlePostFirstMessage = (firstMessage: string) => {
    if (!meId || !attachedToId) return
    createThread.mutate(
      { attachedToType, attachedToId, createdBy: meId },
      {
        onSuccess: (created) => {
          postMessage.mutate({ threadId: created.id, createdBy: meId, content: firstMessage })
        },
      },
    )
    setStarting(false)
    setThreadOpen(true)
  }

  const state: 'none' | 'read' | 'unread' =
    !thread ? 'none' : thread.unreadCount > 0 ? 'unread' : 'read'

  const meMember = meId ? allCrew.find(c => c.userId === meId) : null
  const meName = meMember?.User?.name ?? ''

  const TriggerIcon = (
    <ThreadIconButton state={state} disabled={!canAct} onClick={handleTriggerClick} />
  )

  const PreviewRow = thread && !threadOpen ? (
    <ThreadPreviewRow thread={thread} onOpen={() => { haptic('light'); setThreadOpen(true) }} />
  ) : null

  const MessageZone = thread && threadOpen ? (
    <ThreadZone
      thread={thread}
      crew={allCrew}
      meId={meId}
      projectId={projectId}
    />
  ) : null

  const StartSheetOverlay = starting ? (
    <StartThreadSheet
      subjectLabel={subjectLabel}
      meName={meName}
      onCancel={() => setStarting(false)}
      onPost={handlePostFirstMessage}
    />
  ) : null

  return { TriggerIcon, PreviewRow, MessageZone, StartSheetOverlay }
}

// ── Trigger icon ────────────────────────────────────────────

function ThreadIconButton({
  state, disabled, onClick,
}: {
  state: 'none' | 'read' | 'unread'
  disabled?: boolean
  onClick: () => void
}) {
  const hasThread = state !== 'none'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={hasThread ? 'Open thread' : 'Start thread'}
      style={{
        width: 30, height: 30, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', background: 'transparent', border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer', flexShrink: 0,
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ opacity: hasThread ? 1 : 0.45 }}>
        <path
          d="M3 5C3 3.9 3.9 3 5 3h10c1.1 0 2 .9 2 2v7c0 1.1-.9 2-2 2H7l-4 3V5z"
          stroke={TV}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <line x1="7" y1="8" x2="13" y2="8" stroke={TV} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {state === 'unread' && (
        <div style={{
          position: 'absolute', top: 2, right: 2,
          width: 10, height: 10, borderRadius: '50%',
          background: TA,
          border: '1.5px solid #0a0a0f',
        }} />
      )}
      {state === 'read' && (
        <div style={{
          position: 'absolute', top: 2, right: 2,
          width: 10, height: 10, borderRadius: '50%',
          background: TV,
          border: '1.5px solid #0a0a0f',
        }} />
      )}
    </button>
  )
}

// ── Preview row (thread exists, zone closed) ────────────────

function ThreadPreviewRow({ thread, onOpen }: { thread: Thread; onOpen: () => void }) {
  const lastMsg = thread.messages.length
    ? thread.messages[thread.messages.length - 1].content
    : 'Tap to open thread'
  const unread = thread.unreadCount > 0
  return (
    <div style={{ padding: '12px 20px' }}>
      <span className="font-mono uppercase block" style={{
        fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6,
      }}>Thread</span>
      <div
        onClick={onOpen}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${unread ? 'rgba(245,158,11,0.22)' : 'rgba(255,255,255,0.07)'}`,
          borderRadius: 10, padding: '9px 12px', cursor: 'pointer',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="font-mono" style={{
            fontSize: 9, color: unread ? TA : TV, marginBottom: 2,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {thread.messages.length} {thread.messages.length === 1 ? 'reply' : 'replies'}
            {unread && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 14, height: 14, padding: '0 4px', borderRadius: 7,
                background: TA, color: '#fff', fontSize: 8, fontWeight: 700,
              }}>{thread.unreadCount}</span>
            )}
          </div>
          <div style={{
            fontSize: 12, color: 'rgba(255,255,255,0.45)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{lastMsg}</div>
        </div>
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.2)' }}>›</span>
      </div>
    </div>
  )
}

// ── Message zone (inline expanded) ──────────────────────────

function ThreadZone({
  thread, crew, meId, projectId,
}: {
  thread: Thread
  crew: TeamMember[]
  meId: string | null
  projectId: string
}) {
  const [reply, setReply] = useState('')
  const postMessage = usePostMessage(projectId)
  const markRead = useMarkThreadRead(projectId)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Zone-2 mount = user actually sees the messages. Clear the unread badge now.
  useEffect(() => {
    if (meId) markRead.mutate(thread.id)
    // intentional: re-fire on threadId only, not on every message arrival
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.id, meId])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [thread.messages.length])

  const handleSend = () => {
    if (!reply.trim() || !meId) return
    postMessage.mutate({ threadId: thread.id, createdBy: meId, content: reply.trim() })
    setReply('')
  }

  const meMember = meId ? crew.find(c => c.userId === meId) : null
  const meName = meMember?.User?.name ?? ''

  const sortedMessages = useMemo(() => {
    return [...thread.messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }, [thread.messages])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
      <div ref={scrollRef} style={{
        padding: '12px 16px',
        display: 'flex', flexDirection: 'column', gap: 10,
        maxHeight: '40vh', overflowY: 'auto',
      }}>
        {sortedMessages.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <span className="font-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)' }}>
              No messages yet
            </span>
          </div>
        ) : sortedMessages.map(m => {
          const author = crew.find(c => c.userId === m.createdBy)
          const name = author?.User?.name ?? 'Unknown'
          const isMe = meId != null && m.createdBy === meId
          const av = avatarStyle(name)
          return (
            <div key={m.id} style={{
              display: 'flex', gap: 8, alignItems: 'flex-end',
              flexDirection: isMe ? 'row-reverse' : 'row',
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700, flexShrink: 0,
                background: av.bg, color: av.color,
                border: `1px solid ${av.color}30`,
              }}>{initialsOf(name)}</div>
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 2, maxWidth: '75%',
                alignItems: isMe ? 'flex-end' : 'flex-start',
              }}>
                {!isMe && (
                  <span className="font-mono uppercase" style={{
                    fontSize: 8, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.28)',
                  }}>
                    {name}
                  </span>
                )}
                <div style={{
                  padding: '8px 11px', borderRadius: 12,
                  fontSize: 12, lineHeight: 1.5,
                  color: 'rgba(255,255,255,0.82)',
                  background: isMe ? 'rgba(124,58,237,0.65)' : 'rgba(255,255,255,0.06)',
                  border: isMe ? 'none' : '1px solid rgba(255,255,255,0.07)',
                  borderBottomLeftRadius: isMe ? 12 : 3,
                  borderBottomRightRadius: isMe ? 3 : 12,
                }}>{m.content}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ padding: '8px 14px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: '7px 12px',
        }}>
          {meName && (
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
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
              fontSize: 12, color: '#fff',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!reply.trim() || !meId}
            style={{
              fontSize: 14, color: TV, fontWeight: 700, cursor: 'pointer',
              background: 'transparent', border: 'none', flexShrink: 0,
              opacity: reply.trim() && meId ? 1 : 0.4,
            }}
          >↑</button>
        </div>
      </div>
    </div>
  )
}

// ── Start thread overlay ────────────────────────────────────

function StartThreadSheet({
  subjectLabel, meName, onCancel, onPost,
}: {
  subjectLabel: string
  meName: string
  onCancel: () => void
  onPost: (firstMessage: string) => void
}) {
  const [text, setText] = useState('')
  const av = avatarStyle(meName || 'Me')

  return (
    <>
      <div
        onClick={onCancel}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 69 }}
      />
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#181818',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '24px 24px 0 0',
          paddingBottom: 34,
          zIndex: 70,
        }}
      >
        <div style={{
          width: 36, height: 4, background: 'rgba(255,255,255,0.13)',
          borderRadius: 2, margin: '12px auto 0',
        }} />

        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '14px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div>
            <div className="font-mono uppercase" style={{
              fontSize: 9, letterSpacing: '0.12em',
              color: 'rgba(255,255,255,0.22)', marginBottom: 3,
            }}>
              Start Thread on
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
              {subjectLabel}
            </div>
          </div>
          <button
            onClick={() => { haptic('light'); onCancel() }}
            className="font-mono uppercase"
            style={{
              fontSize: 10, letterSpacing: '0.08em',
              color: 'rgba(255,255,255,0.3)',
              background: 'transparent', border: 'none',
              cursor: 'pointer', paddingTop: 4,
            }}
          >Cancel</button>
        </div>

        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 11, padding: '14px 20px',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0, marginTop: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
            background: av.bg, color: av.color,
            border: `1px solid ${av.color}30`,
          }}>{initialsOf(meName || 'Me')}</div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            autoFocus
            placeholder="Start a discussion…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8,
              fontSize: 14, color: '#fff', minHeight: 70, resize: 'none',
              lineHeight: 1.55, fontFamily: "'Geist', sans-serif",
            }}
          />
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          padding: '10px 20px 0',
        }}>
          <button
            onClick={() => { if (text.trim()) { haptic('medium'); onPost(text.trim()) } }}
            disabled={!text.trim()}
            className="font-mono uppercase"
            style={{
              padding: '9px 22px', borderRadius: 20,
              fontSize: 10, letterSpacing: '0.1em', fontWeight: 700,
              background: 'rgba(124,58,237,0.12)',
              border: '1px solid rgba(124,58,237,0.25)',
              color: TV,
              cursor: text.trim() ? 'pointer' : 'not-allowed',
              opacity: text.trim() ? 1 : 0.4,
            }}
          >Post Thread ↑</button>
        </div>
      </div>
    </>
  )
}

// ── Avatar helpers (shared) ─────────────────────────────────

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
