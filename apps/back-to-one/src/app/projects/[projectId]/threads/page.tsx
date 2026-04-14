'use client'
import { PageTransition } from '@/components/ui/PageTransition'

import { useState, useRef, useEffect } from 'react'
import { useProject, useThreads, useCreateThread, usePostMessage, useCrew } from '@/lib/hooks/useOriginOne'

import { LoadingState, CrewAvatar } from '@/components/ui'
import { GhostRect, GhostPill, GhostCircle, SectionLabel, EmptyCTA } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { FAB } from '@/components/ui/FAB'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { haptic } from '@/lib/utils/haptics'
import { getProjectColor , statusHex, statusLabel } from '@/lib/utils/phase'
import type { Thread, ThreadMessage, TeamMember } from '@/types'

// ── Helpers ───────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ── Thread List Item ──────────────────────────────────────

function ThreadRow({ thread, onTap }: { thread: Thread; onTap: (t: Thread) => void }) {
  const lastMsg = thread.messages.length > 0
    ? thread.messages[thread.messages.length - 1]
    : null

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 border-b border-border cursor-pointer transition-colors active:bg-surface2"
      onClick={() => onTap(thread)}
    >
      {/* Thread icon */}
      <div className="w-9 h-9 rounded-lg bg-surface2 border border-border flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-muted">
          <path d="M2 4a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2H6l-3 2V12a2 2 0 01-1-1.73V4z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base leading-snug text-text truncate font-medium">{thread.title}</span>
        </div>
        <div className="flex items-center gap-2">
          {lastMsg ? (
            <span className="font-mono text-xs text-muted truncate">{lastMsg.content.slice(0, 60)}{lastMsg.content.length > 60 ? '...' : ''}</span>
          ) : (
            <span className="font-mono text-xs text-muted">No messages yet</span>
          )}
        </div>
      </div>

      {/* Time + count */}
      <div className="flex flex-col items-end flex-shrink-0 gap-1">
        <span className="font-mono text-[0.5rem] text-muted">{timeAgo(thread.updatedAt)}</span>
        {thread.messages.length > 0 && (
          <span className="font-mono text-[0.5rem] text-muted">{thread.messages.length}</span>
        )}
      </div>
    </div>
  )
}

// ── Message Bubble ────────────────────────────────────────

function MessageBubble({ message, crew }: { message: ThreadMessage; crew: TeamMember[] }) {
  const author = message.createdBy ? crew.find(c => c.userId === message.createdBy) : null
  const authorName = author ? author.User.name : null

  return (
    <div className="px-4 py-2.5">
      <div className="flex items-start gap-2.5">
        {authorName ? (
          <CrewAvatar name={authorName} size={28} />
        ) : (
          <div className="w-7 h-7 rounded-full bg-surface3 border border-border flex items-center justify-center flex-shrink-0">
            <span className="font-mono text-[0.45rem] text-muted">?</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-mono text-xs font-medium text-text">
              {authorName ?? 'Anonymous'}
            </span>
            <span className="font-mono text-[0.5rem] text-muted">{timeAgo(message.createdAt)}</span>
          </div>
          <div className="text-sm text-text2 leading-relaxed">{message.content}</div>
        </div>
      </div>
    </div>
  )
}

// ── Thread Detail Sheet ───────────────────────────────────

function ThreadSheet({ thread, crew, projectId, onClose }: {
  thread: Thread | null; crew: TeamMember[]; projectId: string; onClose: () => void
}) {
  const [reply, setReply] = useState('')
  const postMessage = usePostMessage(projectId)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [thread?.messages.length])

  if (!thread) return null

  const handleSend = () => {
    if (!reply.trim()) return
    postMessage.mutate({ threadId: thread.id, createdBy: '', content: reply.trim() })
    setReply('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      <SheetHeader title={thread.title} onClose={onClose} />
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-0 pt-3 pb-2" style={{ maxHeight: '50vh' }}>
        {thread.messages.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <span className="font-mono text-xs text-muted">No messages yet — start the conversation</span>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {thread.messages
              .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
              .map(msg => <MessageBubble key={msg.id} message={msg} crew={crew} />)
            }
          </div>
        )}
      </div>
      {/* Composer */}
      <div className="px-4 pt-2 pb-2 border-t border-border">
        <div className="flex items-end gap-2">
          <textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a reply..."
            rows={1}
            className="flex-1 bg-surface2 border border-border2 rounded-lg px-3 py-2.5 text-text text-sm outline-none focus:border-accent transition-colors resize-none"
          />
          <button
            onClick={handleSend}
            disabled={!reply.trim()}
            className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center transition-opacity disabled:opacity-40 active:opacity-80 flex-shrink-0"
            aria-label="Send"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M14 2L7 9M14 2l-4 12-3-5-5-3 12-4z" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </>
  )
}

// ── New Thread Sheet ──────────────────────────────────────

function NewThreadSheet({ projectId, onClose, onCreate }: {
  projectId: string
  onClose: () => void
  onCreate: (data: { title: string; createdBy: string }) => void
}) {
  const [title, setTitle] = useState('')

  const handleSubmit = () => {
    if (!title.trim()) return
    onCreate({ title: title.trim(), createdBy: '' })
    onClose()
  }

  return (
    <>
      <SheetHeader title="New Thread" onClose={onClose} />
      <SheetBody>
        <div className="flex flex-col gap-4">
          <div>
            <label className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Title</label>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="What's this about?"
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
              className="w-full bg-surface2 border border-border2 rounded-lg px-3 py-2.5 text-text text-base outline-none focus:border-accent transition-colors" />
          </div>
          <button onClick={handleSubmit} disabled={!title.trim()}
            className="w-full py-3 rounded-lg bg-accent text-white font-semibold text-base transition-opacity disabled:opacity-40 active:opacity-80">
            Create Thread
          </button>
        </div>
      </SheetBody>
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────

export default function ThreadsPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const { data: project } = useProject(projectId)
  const accent = getProjectColor(projectId)
  const [selected, setSelected] = useState<Thread | null>(null)
  const [creating, setCreating] = useState(false)

  const { data: threads, isLoading: loadingThreads } = useThreads(projectId)
  const { data: crew, isLoading: loadingCrew }       = useCrew(projectId)
  const createThread = useCreateThread(projectId)

  const allThreads = threads ?? []
  const allCrew    = crew ?? []

  // Keep selected thread in sync with fresh data
  const liveSelected = selected ? allThreads.find(t => t.id === selected.id) ?? selected : null

  return (
    <PageTransition><div className="screen">
      <PageHeader projectId={projectId} title="Threads" meta={project ? (<div className="flex flex-col items-center gap-1.5"><span style={{ color: accent, fontSize: '0.50rem', letterSpacing: '0.06em' }}>{project.name}</span><span className="font-mono uppercase" style={{ fontSize: '0.38rem', padding: '2px 8px', borderRadius: 12, background: `${statusHex(project.status)}18`, color: statusHex(project.status) }}>{statusLabel(project.status)}</span></div>) : ''} />

      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 80 }}>
        {loadingThreads || loadingCrew ? <LoadingState /> : (
          allThreads.length === 0 ? (
            <>
              <SectionLabel>Threads</SectionLabel>
              <div style={{ margin: '0 16px 8px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: 9, padding: 14 }}>
                <GhostPill w={64} h={18} />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 8 }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}><GhostRect w={140} h={12} /><GhostRect w="100%" h={10} /><GhostRect w="80%" h={10} /></div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}><GhostRect w={36} h={10} /><GhostCircle size={18} /></div>
                </div>
              </div>
              <div style={{ margin: '0 16px 8px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: 9, padding: 14 }}>
                <GhostPill w={80} h={18} />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 8 }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}><GhostRect w={120} h={12} /><GhostRect w="100%" h={10} /></div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}><GhostRect w={36} h={10} /></div>
                </div>
              </div>
              <EmptyCTA icon="🧵" headline="Start a thread." sub="Tie conversations to shots, tasks, locations — anything." />
            </>
          ) : (
            allThreads.map(t => <ThreadRow key={t.id} thread={t} onTap={setSelected} />)
          )
        )}
      </div>

      <FAB accent={accent} projectId={projectId} onPress={() => { haptic('light'); setCreating(true) }} />

      <Sheet open={!!selected} onClose={() => setSelected(null)} maxHeight="90vh">
        <ThreadSheet thread={liveSelected} crew={allCrew} projectId={projectId} onClose={() => setSelected(null)} />
      </Sheet>

      <Sheet open={creating} onClose={() => setCreating(false)}>
        <NewThreadSheet projectId={projectId} onClose={() => setCreating(false)}
          onCreate={(data) => createThread.mutate(data)} />
      </Sheet>
    </div>
    </PageTransition>
  )
}