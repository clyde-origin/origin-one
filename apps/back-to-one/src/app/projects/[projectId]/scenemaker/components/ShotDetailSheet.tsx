'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { haptic } from '@/lib/utils/haptics'
import { useThreads, useCreateThread, usePostMessage, useCrew } from '@/lib/hooks/useOriginOne'
import type { Shot, Thread, TeamMember } from '@/types'

// Fixed thread-system colors (never project-derived)
const TV = '#7C3AED'
const TA = '#F59E0B'

const SIZE_ABBREV: Record<string, string> = {
  extreme_wide: 'EWS', wide: 'WIDE', full: 'FS', medium: 'MED',
  medium_close_up: 'MCU', close_up: 'CU', extreme_close_up: 'ECU', insert: 'INS',
  aerial: 'AERIAL', pov: 'POV',
}

const SHOT_SIZES = [
  { value: 'extreme_wide', label: 'Extreme Wide' },
  { value: 'wide', label: 'Wide' },
  { value: 'full', label: 'Full' },
  { value: 'medium', label: 'Medium' },
  { value: 'medium_close_up', label: 'Med Close-Up' },
  { value: 'close_up', label: 'Close-Up' },
  { value: 'extreme_close_up', label: 'Extreme CU' },
  { value: 'insert', label: 'Insert' },
  { value: 'aerial', label: 'Aerial' },
  { value: 'pov', label: 'POV' },
]

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

function ThreadIconButton({
  state, onClick,
}: {
  state: 'none' | 'read' | 'unread'
  onClick: () => void
}) {
  const hasThread = state !== 'none'
  return (
    <button
      onClick={onClick}
      aria-label={hasThread ? 'Open thread' : 'Start thread'}
      style={{
        width: 30, height: 30, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', background: 'transparent', border: 'none',
        cursor: 'pointer', flexShrink: 0,
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

function StartThreadSheet({
  shot, accent, onCancel, onPost, meName,
}: {
  shot: Shot
  accent: string
  onCancel: () => void
  onPost: (firstMessage: string) => void
  meName: string
}) {
  const [text, setText] = useState('')
  const av = avatarStyle(meName || 'Me')

  return (
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
      <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.13)', borderRadius: 2, margin: '12px auto 0' }} />

      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        padding: '14px 20px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div>
          <div className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.22)', marginBottom: 3 }}>
            Start Thread on
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
            Shot {shot.shotNumber}{shot.size ? ` · ${SIZE_ABBREV[shot.size] ?? shot.size}` : ''}
          </div>
        </div>
        <button
          onClick={() => { haptic('light'); onCancel() }}
          className="font-mono uppercase"
          style={{
            fontSize: 10, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)',
            background: 'transparent', border: 'none', cursor: 'pointer', paddingTop: 4,
          }}
        >Cancel</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{
          width: 44, height: 28, borderRadius: 5, flexShrink: 0,
          background: shot.imageUrl ? 'transparent' : `linear-gradient(135deg, ${accent}30, ${accent}10)`,
          overflow: 'hidden',
        }}>
          {shot.imageUrl && <img src={shot.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>
        <span className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: '0.07em', color: 'rgba(255,255,255,0.3)' }}>
          Shot {shot.shotNumber}{shot.size ? ` · ${SIZE_ABBREV[shot.size] ?? shot.size}` : ''}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '14px 20px' }}>
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
          placeholder="Start a discussion about this shot…"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8,
            fontSize: 14, color: '#fff', minHeight: 70, resize: 'none', lineHeight: 1.55,
            fontFamily: "'Geist', sans-serif",
          }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '10px 20px 0' }}>
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
  )
}

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
  const scrollRef = useRef<HTMLDivElement>(null)

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
            <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexDirection: isMe ? 'row-reverse' : 'row' }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700, flexShrink: 0,
                background: av.bg, color: av.color,
                border: `1px solid ${av.color}30`,
              }}>{initialsOf(name)}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: '75%', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                {!isMe && (
                  <span className="font-mono uppercase" style={{ fontSize: 8, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.28)' }}>
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

export function ShotDetailSheet({ shot, accent, projectId, onClose, onUploadImage, onUpdateShot }: {
  shot: Shot | null
  accent: string
  projectId: string
  onClose: () => void
  onUploadImage: (shotId: string, file: File) => void
  onUpdateShot: (shotId: string, fields: { description?: string; size?: string | null; notes?: string }) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [editingDesc, setEditingDesc] = useState(false)
  const [descValue, setDescValue] = useState('')
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [threadOpen, setThreadOpen] = useState(false)
  const [startingThread, setStartingThread] = useState(false)

  const { data: threads } = useThreads(projectId)
  const { data: crew } = useCrew(projectId)
  const createThread = useCreateThread(projectId)
  const postMessage = usePostMessage(projectId)

  const allCrew: TeamMember[] = useMemo(() => (crew ?? []) as TeamMember[], [crew])
  const allThreads: Thread[] = useMemo(() => (threads ?? []) as Thread[], [threads])
  const meId: string | null = allCrew[0]?.userId ?? null
  const meMember = meId ? allCrew.find(c => c.userId === meId) : null
  const meName = meMember?.User?.name ?? ''

  const shotThread = useMemo(() => {
    if (!shot) return null
    return allThreads.find(t => t.attachedToType === 'shot' && t.attachedToId === shot.id) ?? null
  }, [allThreads, shot])

  useEffect(() => {
    if (!shot) { setThreadOpen(false); setStartingThread(false) }
  }, [shot])

  if (!shot) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onUploadImage(shot.id, file)
    e.target.value = ''
  }

  const commitDesc = () => {
    setEditingDesc(false)
    const trimmed = descValue.trim()
    if (trimmed !== (shot.description ?? '')) onUpdateShot(shot.id, { description: trimmed })
  }

  const commitNotes = () => {
    setEditingNotes(false)
    const trimmed = notesValue.trim()
    if (trimmed !== (shot.notes ?? '')) onUpdateShot(shot.id, { notes: trimmed })
  }

  const handleThreadIconClick = () => {
    haptic('light')
    if (shotThread) {
      setThreadOpen(open => !open)
    } else {
      if (!meId) return
      setStartingThread(true)
    }
  }

  const handlePostFirstMessage = (firstMessage: string) => {
    if (!meId) return
    createThread.mutate(
      { attachedToType: 'shot', attachedToId: shot.id, createdBy: meId },
      {
        onSuccess: (created) => {
          postMessage.mutate({ threadId: created.id, createdBy: meId, content: firstMessage })
        },
      },
    )
    setStartingThread(false)
    setThreadOpen(true)
  }

  const threadState: 'none' | 'read' | 'unread' =
    !shotThread ? 'none' : shotThread.unread ? 'unread' : 'read'

  return (
    <>
      {/* Sheet header — Shot type + thread icon + Done */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.3)' }}>Shot</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <ThreadIconButton state={threadState} onClick={handleThreadIconClick} />
          <button
            onClick={() => { haptic('medium'); onClose() }}
            style={{ fontSize: 14, fontWeight: 600, color: TV, background: 'transparent', border: 'none', cursor: 'pointer' }}
          >Done</button>
        </div>
      </div>

      {/* Hero image area */}
      <div
        className="cursor-pointer"
        style={{
          margin: '4px 16px 14px',
          borderRadius: 10,
          overflow: 'hidden',
          aspectRatio: '16/9',
          background: shot.imageUrl ? 'transparent' : `linear-gradient(135deg, ${accent}12, ${accent}06)`,
          border: shot.imageUrl ? 'none' : `1.5px dashed ${accent}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}
        onClick={() => fileRef.current?.click()}
      >
        {shot.imageUrl ? (
          <img src={shot.imageUrl} alt={shot.shotNumber} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="5" width="18" height="14" rx="2" stroke={accent} strokeWidth="1.5" opacity="0.5" />
              <path d="M12 10v4M10 12h4" stroke={accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            </svg>
            <span className="font-mono uppercase" style={{ fontSize: '0.4rem', letterSpacing: '0.08em', color: accent, opacity: 0.6 }}>
              Tap to upload
            </span>
          </div>
        )}
        {shot.imageUrl && (
          <div className="absolute bottom-2 right-2 flex items-center justify-center" style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(4,4,10,0.7)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 3v6M3 6h6" stroke="rgba(255,255,255,0.6)" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

      {/* Shot info */}
      <div style={{ padding: '0 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
          <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em', color: accent }}>
            {shot.shotNumber}
          </span>
          {shot.size && (
            <span className="font-mono uppercase" style={{ fontSize: '0.38rem', letterSpacing: '0.06em', padding: '2px 7px', borderRadius: 10, background: `${accent}14`, border: `1px solid ${accent}30`, color: accent }}>
              {SIZE_ABBREV[shot.size] ?? shot.size}
            </span>
          )}
        </div>

        {editingDesc ? (
          <textarea
            value={descValue}
            onChange={e => setDescValue(e.target.value)}
            autoFocus
            onBlur={commitDesc}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitDesc() } }}
            rows={2}
            className="w-full outline-none resize-none"
            style={{ fontSize: '0.82rem', fontWeight: 600, color: '#dddde8', lineHeight: 1.4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '6px 8px' }}
          />
        ) : (
          <div
            className="cursor-text"
            style={{ fontSize: '0.82rem', fontWeight: 600, color: shot.description ? '#dddde8' : '#62627a', lineHeight: 1.4, minHeight: 22, borderRadius: 6, padding: '2px 0' }}
            onClick={() => { setDescValue(shot.description ?? ''); setEditingDesc(true) }}>
            {shot.description || 'Tap to add description...'}
          </div>
        )}
      </div>

      {/* Framing / Shot Size selector */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 8 }}>Framing</span>
        <div className="flex flex-wrap" style={{ gap: 5 }}>
          {SHOT_SIZES.map(s => (
            <button key={s.value}
              className="font-mono cursor-pointer select-none transition-all"
              style={{
                fontSize: '0.42rem', letterSpacing: '0.04em', padding: '4px 9px', borderRadius: 16,
                background: shot.size === s.value ? `${accent}1f` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${shot.size === s.value ? `${accent}4d` : 'rgba(255,255,255,0.05)'}`,
                color: shot.size === s.value ? accent : '#62627a',
              }}
              onClick={() => {
                haptic('light')
                onUpdateShot(shot.id, { size: s.value })
              }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes field */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Notes</span>
        {editingNotes ? (
          <textarea
            value={notesValue}
            onChange={e => setNotesValue(e.target.value)}
            autoFocus
            onBlur={commitNotes}
            rows={3}
            placeholder="Crew instructions, reminders..."
            className="w-full outline-none resize-none"
            style={{ fontSize: '0.74rem', color: '#a0a0b8', lineHeight: 1.5, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '6px 8px' }}
          />
        ) : (
          <div
            className="cursor-text"
            style={{ fontSize: '0.74rem', color: shot.notes ? '#a0a0b8' : '#62627a', lineHeight: 1.5, minHeight: 20, borderRadius: 6, padding: '2px 0' }}
            onClick={() => { setNotesValue(shot.notes ?? ''); setEditingNotes(true) }}>
            {shot.notes || 'Tap to add notes...'}
          </div>
        )}
      </div>

      {/* Thread preview row — only when thread exists and zone closed */}
      {shotThread && !threadOpen && (
        <div style={{ padding: '12px 20px' }}>
          <span className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Thread</span>
          <div
            onClick={() => { haptic('light'); setThreadOpen(true) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 10, padding: '9px 12px', cursor: 'pointer',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="font-mono" style={{ fontSize: 9, color: TV, marginBottom: 2 }}>
                {shotThread.messages.length} {shotThread.messages.length === 1 ? 'reply' : 'replies'}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {shotThread.messages.length > 0
                  ? shotThread.messages[shotThread.messages.length - 1].content
                  : 'Tap to open thread'}
              </div>
            </div>
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.2)' }}>›</span>
          </div>
        </div>
      )}

      {/* Inline thread zone — expands when icon or row tapped */}
      {shotThread && threadOpen && (
        <ThreadZone thread={shotThread} crew={allCrew} meId={meId} projectId={projectId} />
      )}

      {/* Metadata rows */}
      <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div className="flex items-start gap-3">
          <span className="font-mono uppercase flex-shrink-0" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', width: 68, paddingTop: 2 }}>Status</span>
          <span className="capitalize" style={{ fontSize: '0.76rem', fontWeight: 600, color: '#dddde8' }}>{shot.status.replace(/_/g, ' ')}</span>
        </div>
      </div>

      {/* Buttons */}
      <div style={{ padding: '14px 20px 0', display: 'flex', gap: 10 }}>
        <button className="flex-1 font-bold cursor-pointer transition-all"
          style={{ padding: 13, borderRadius: 8, fontSize: '0.78rem', background: `${accent}1f`, border: `1px solid ${accent}40`, color: accent }}
          onClick={() => { haptic('medium'); onClose() }}>Done</button>
        <button className="flex-1 font-bold cursor-pointer transition-all"
          style={{ padding: 13, borderRadius: 8, fontSize: '0.78rem', background: 'rgba(232,86,74,0.08)', border: '1px solid rgba(232,86,74,0.2)', color: '#e8564a' }}
          onClick={() => { haptic('warning'); onClose() }}>Delete shot</button>
      </div>

      {/* Start thread sheet overlay */}
      {startingThread && (
        <>
          <div
            onClick={() => setStartingThread(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 69 }}
          />
          <StartThreadSheet
            shot={shot}
            accent={accent}
            onCancel={() => setStartingThread(false)}
            onPost={handlePostFirstMessage}
            meName={meName}
          />
        </>
      )}
    </>
  )
}
