'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  useProject,
  useCrew,
  useChatChannels,
  useCreateChatChannel,
  useChannelMessages,
  useSendChatMessage,
  useDMList,
  useDMMessages,
  useChatSubscription,
} from '@/lib/hooks/useOriginOne'
import { LoadingState } from '@/components/ui'
import { PageHeader } from '@/components/ui/PageHeader'
import { FAB } from '@/components/ui/FAB'
import { haptic } from '@/lib/utils/haptics'
import { getProjectColor, statusHex, statusLabel } from '@/lib/utils/phase'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { initials } from '@/lib/utils/formatting'

// ── Helpers ────────────────────────────────────────────────

function stableColor(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h)
  return `hsl(${((h % 360) + 360) % 360}, 55%, 55%)`
}

function timeOf(iso: string) {
  const d = new Date(iso)
  let h = d.getHours(), m = d.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`
}

function dayLabel(iso: string) {
  const d = new Date(iso); d.setHours(0, 0, 0, 0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

// Parse @mentions — returns array of { text, mention? }
function parseMessage(content: string, members: any[]) {
  const parts: { text: string; mention?: boolean }[] = []
  const re = /@([A-Za-z][A-Za-z.' -]{0,40})/g
  let last = 0
  let m: RegExpExecArray | null
  const names = new Set(members.map(mb => (mb.User?.name ?? '').toLowerCase()))
  while ((m = re.exec(content))) {
    const full = m[0]
    const name = m[1].trim()
    const isMatch = names.has(name.toLowerCase())
    if (!isMatch) continue
    if (m.index > last) parts.push({ text: content.slice(last, m.index) })
    parts.push({ text: full, mention: true })
    last = m.index + full.length
  }
  if (last < content.length) parts.push({ text: content.slice(last) })
  return parts.length ? parts : [{ text: content }]
}

// ── Message Bubble ─────────────────────────────────────────

function MessageBubble({
  msg, isSelf, accent, crew, showAvatar, showName,
}: { msg: any; isSelf: boolean; accent: string; crew: any[]; showAvatar: boolean; showName: boolean }) {
  const senderName = msg.sender?.name ?? ''
  const color = isSelf ? accent : stableColor(senderName)
  const parts = useMemo(() => parseMessage(msg.content ?? '', crew), [msg.content, crew])

  return (
    <div style={{ display: 'flex', gap: 9, alignItems: 'flex-end', flexDirection: isSelf ? 'row-reverse' : 'row' }}>
      {showAvatar ? (
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: `${color}22`, border: `1px solid ${color}44`, color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, flexShrink: 0,
        }}>
          {initials(senderName)}
        </div>
      ) : (
        <div style={{ width: 28, flexShrink: 0 }} />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: '75%', alignItems: isSelf ? 'flex-end' : 'flex-start' }}>
        {showName && !isSelf && (
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 8, letterSpacing: '0.07em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>
            {senderName}
          </div>
        )}
        <div style={{
          padding: '9px 12px',
          borderRadius: 14,
          fontSize: 13,
          lineHeight: 1.5,
          color: '#fff',
          background: isSelf ? `${accent}cc` : 'rgba(255,255,255,0.06)',
          border: isSelf ? 'none' : '1px solid rgba(255,255,255,0.07)',
          borderBottomLeftRadius: isSelf ? 14 : 4,
          borderBottomRightRadius: isSelf ? 4 : 14,
          wordBreak: 'break-word',
        }}>
          {parts.map((p, i) => p.mention
            ? <span key={i} style={{ fontWeight: 700, color: isSelf ? '#fff' : accent }}>{p.text}</span>
            : <span key={i}>{p.text}</span>
          )}
        </div>
        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>
          {timeOf(msg.createdAt)}
        </div>
      </div>
    </div>
  )
}

// ── Message List w/ date separators ────────────────────────

function MessageList({ messages, meId, accent, crew }: { messages: any[]; meId: string | null; accent: string; crew: any[] }) {
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages.length])

  const items: React.ReactNode[] = []
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]
    const prev = messages[i - 1]
    if (!prev || !sameDay(prev.createdAt, m.createdAt)) {
      items.push(
        <div key={`sep-${m.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)' }}>
            {dayLabel(m.createdAt)}
          </span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
        </div>,
      )
    }
    const isSelf = m.senderId === meId
    const prevSameSender = prev && prev.senderId === m.senderId && sameDay(prev.createdAt, m.createdAt)
    items.push(
      <MessageBubble
        key={m.id}
        msg={m}
        isSelf={isSelf}
        accent={accent}
        crew={crew}
        showAvatar={!prevSameSender}
        showName={!prevSameSender}
      />,
    )
  }
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items}
      <div ref={bottomRef} />
    </div>
  )
}

// ── Mention picker ────────────────────────────────────────

function MentionPicker({ crew, query, onPick }: { crew: any[]; query: string; onPick: (name: string) => void }) {
  const q = query.toLowerCase()
  const filtered = crew
    .filter(m => m.User?.name?.toLowerCase().includes(q))
    .slice(0, 5)
  if (filtered.length === 0) return null
  return (
    <div style={{
      position: 'absolute', bottom: 68, left: 14, right: 14,
      background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12, overflow: 'hidden', zIndex: 10,
    }}>
      {filtered.map((m, i) => {
        const u = m.User
        const c = stableColor(u?.name ?? '')
        return (
          <div key={m.id}
            onClick={() => onPick(u.name)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', cursor: 'pointer',
              borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${c}22`, border: `1px solid ${c}44`, color: c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>
              {initials(u?.name ?? '')}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{u?.name}</span>
            {m.role && (
              <span style={{ marginLeft: 'auto', fontFamily: "'Geist Mono', monospace", fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {m.role}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Input bar ─────────────────────────────────────────────

function InputBar({
  accent, placeholder, crew, onSend,
}: { accent: string; placeholder: string; crew: any[]; onSend: (text: string) => void }) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // detect @ query
  const mentionQuery = (() => {
    const match = value.match(/@([A-Za-z][A-Za-z.' -]*)?$/)
    return match ? (match[1] ?? '') : null
  })()

  const pickMention = (name: string) => {
    const newVal = value.replace(/@([A-Za-z][A-Za-z.' -]*)?$/, `@${name} `)
    setValue(newVal)
    inputRef.current?.focus()
  }

  const submit = () => {
    const v = value.trim()
    if (!v) return
    onSend(v)
    setValue('')
  }

  const ready = value.trim().length > 0

  return (
    <div style={{ flexShrink: 0, padding: '10px 14px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', position: 'relative' }}>
      {mentionQuery !== null && <MentionPicker crew={crew} query={mentionQuery} onPick={pickMention} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 22, padding: '8px 14px' }}>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
          placeholder={placeholder}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#fff' }}
        />
        <span
          onClick={submit}
          style={{ fontSize: 16, color: ready ? accent : 'rgba(255,255,255,0.25)', flexShrink: 0, cursor: ready ? 'pointer' : 'default', transition: 'color 0.15s' }}>
          ↑
        </span>
      </div>
    </div>
  )
}

// ── Add Channel Sheet ─────────────────────────────────────

function AddChannelSheet({ accent, onClose, onCreate }: { accent: string; onClose: () => void; onCreate: (name: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const submit = () => {
    const v = ref.current?.value?.trim()
    if (!v) return
    onCreate(v)
    onClose()
  }
  return (
    <>
      <SheetHeader title="New Topic" onClose={onClose}
        action={<button onClick={submit} style={{ fontSize: 14, fontWeight: 600, color: accent, background: 'none', border: 'none', cursor: 'pointer' }}>Create</button>}
      />
      <SheetBody>
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', display: 'block', marginBottom: 6 }}>
            Topic Name
          </span>
          <input
            ref={ref}
            autoFocus
            placeholder="e.g. Locations, Post, Cast"
            onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '11px 14px', fontFamily: "'Geist', sans-serif", fontSize: 14, color: '#fff', outline: 'none' }}
          />
        </div>
      </SheetBody>
    </>
  )
}

// ── DM List / Conversation ────────────────────────────────

function DMListView({ projectId, meId, accent, crew, onOpen }: { projectId: string; meId: string | null; accent: string; crew: any[]; onOpen: (partnerId: string) => void }) {
  const { data: dmData } = useDMList(projectId, meId)
  useChatSubscription({ projectId, channelId: null, meId })

  // Merge with crew so all teammates show, even without messages yet
  const byPartner = new Map<string, { partnerId: string; lastMessage: string; lastAt: string | null; unread: boolean }>()
  for (const row of dmData ?? []) byPartner.set(row.partnerId, row)
  const rows = crew
    .filter(m => m.userId !== meId)
    .map(m => {
      const existing = byPartner.get(m.userId)
      return {
        partnerId: m.userId,
        user: m.User,
        role: m.role,
        lastMessage: existing?.lastMessage ?? '',
        lastAt: existing?.lastAt ?? null,
        unread: existing?.unread ?? false,
      }
    })
    .sort((a, b) => {
      if (a.lastAt && b.lastAt) return a.lastAt < b.lastAt ? 1 : -1
      if (a.lastAt) return -1
      if (b.lastAt) return 1
      return 0
    })

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {rows.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          No teammates yet
        </div>
      ) : rows.map(r => {
        const c = stableColor(r.user?.name ?? '')
        return (
          <div key={r.partnerId}
            onClick={() => { haptic('light'); onOpen(r.partnerId) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 10px', borderRadius: 12, cursor: 'pointer',
              background: r.unread ? 'rgba(255,255,255,0.03)' : 'transparent',
              transition: 'background 0.14s',
            }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${c}22`, border: `1.5px solid ${c}55`, color: c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
              {initials(r.user?.name ?? '')}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>{r.user?.name}</div>
              <div style={{ fontSize: 12, color: r.unread ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                {r.lastMessage || (r.role ? r.role.charAt(0).toUpperCase() + r.role.slice(1) : '—')}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
              {r.lastAt && (
                <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>
                  {dayLabel(r.lastAt) === 'Today' ? timeOf(r.lastAt) : dayLabel(r.lastAt)}
                </div>
              )}
              {r.unread && <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent }} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DMConversation({ projectId, meId, partner, accent, crew, onBack }: { projectId: string; meId: string; partner: any; accent: string; crew: any[]; onBack: () => void }) {
  const { data: messages } = useDMMessages(projectId, meId, partner.userId)
  useChatSubscription({ projectId, channelId: null, meId, partnerId: partner.userId })
  const sendMsg = useSendChatMessage(projectId)
  const user = partner.User ?? partner
  const color = stableColor(user?.name ?? '')

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <span onClick={onBack} style={{ fontSize: 18, color: 'rgba(255,255,255,0.4)', cursor: 'pointer', flexShrink: 0 }}>←</span>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${color}22`, border: `1px solid ${color}44`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
          {initials(user?.name ?? '')}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', flex: 1 }}>{user?.name}</div>
      </div>
      <MessageList messages={messages ?? []} meId={meId} accent={accent} crew={crew} />
      <InputBar
        accent={accent}
        placeholder={`Message ${(user?.name ?? '').split(' ')[0]}…`}
        crew={crew}
        onSend={(text) => { sendMsg.mutate({ projectId, channelId: null, senderId: meId, recipientId: partner.userId, content: text }) }}
      />
    </>
  )
}

// ── Page ───────────────────────────────────────────────────

export default function ChatPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const { data: project } = useProject(projectId)
  const accent = project?.color || getProjectColor(projectId)

  const { data: crewData } = useCrew(projectId)
  const crew = crewData ?? []

  // meId: use first crew member as placeholder (no auth in app yet)
  const meId: string | null = crew[0]?.userId ?? null

  const { data: channels, isLoading: channelsLoading } = useChatChannels(projectId)
  const activeChannels = channels ?? []

  const [tab, setTab] = useState<'team' | 'direct'>('team')
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)
  const [dmPartnerId, setDmPartnerId] = useState<string | null>(null)
  const [creatingChannel, setCreatingChannel] = useState(false)

  // Default to first channel when channels load
  useEffect(() => {
    if (!activeChannelId && activeChannels.length > 0) {
      setActiveChannelId(activeChannels[0].id)
    }
  }, [activeChannels, activeChannelId])

  const { data: channelMessages } = useChannelMessages(tab === 'team' ? activeChannelId : null)
  useChatSubscription({ projectId, channelId: tab === 'team' ? activeChannelId : null })

  const createChannel = useCreateChatChannel(projectId)
  const sendMsg = useSendChatMessage(projectId)

  const handleSendTeam = useCallback((text: string) => {
    if (!meId || !activeChannelId) return
    sendMsg.mutate({ projectId, channelId: activeChannelId, senderId: meId, content: text })
  }, [meId, activeChannelId, projectId, sendMsg])

  const dmPartner = dmPartnerId ? crew.find(m => m.userId === dmPartnerId) : null

  return (
    <div className="screen">
      <PageHeader projectId={projectId} title="Chat" meta={project ? (
        <div className="flex flex-col items-center gap-1.5">
          <span style={{ color: accent, fontSize: '0.50rem', letterSpacing: '0.06em' }}>{project.name}</span>
          <span className="font-mono uppercase" style={{ fontSize: '0.38rem', padding: '2px 8px', borderRadius: 12, background: `${statusHex(project.status)}18`, color: statusHex(project.status) }}>
            {statusLabel(project.status)}
          </span>
        </div>
      ) : ''} />

      {/* Team / Direct tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        {(['team', 'direct'] as const).map(t => {
          const active = tab === t
          return (
            <div
              key={t}
              onClick={() => { haptic('light'); setTab(t); if (t === 'direct') setDmPartnerId(null) }}
              style={{
                flex: 1, textAlign: 'center', padding: '10px 0',
                fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.12em',
                textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none',
                color: active ? '#fff' : 'rgba(255,255,255,0.28)',
                borderBottom: active ? `2px solid ${accent}` : '2px solid transparent',
                marginBottom: -1,
                transition: 'color 0.15s',
              }}
            >
              {t === 'team' ? 'Team' : 'Direct'}
            </div>
          )
        })}
      </div>

      {tab === 'team' ? (
        <>
          {/* Channel tabs + Topic */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', overflowX: 'auto', flexShrink: 0 }} className="no-scrollbar">
            {channelsLoading ? (
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>Loading...</span>
            ) : activeChannels.map(c => {
              const active = c.id === activeChannelId
              return (
                <div
                  key={c.id}
                  onClick={() => { haptic('light'); setActiveChannelId(c.id) }}
                  style={{
                    fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: '0.1em',
                    textTransform: 'uppercase', padding: '6px 12px', borderRadius: 20,
                    background: active ? `${accent}1f` : 'transparent',
                    border: active ? `1px solid ${accent}4d` : '1px solid rgba(255,255,255,0.08)',
                    color: active ? accent : 'rgba(255,255,255,0.4)',
                    whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
                    transition: 'all 0.15s',
                  }}>
                  {c.name}
                </div>
              )
            })}
            <div
              onClick={() => { haptic('light'); setCreatingChannel(true) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: '0.1em',
                textTransform: 'uppercase', padding: '6px 12px', borderRadius: 20,
                border: '1px dashed rgba(255,255,255,0.18)',
                color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.02)',
                whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
                marginLeft: 'auto',
              }}>
              <span style={{ fontSize: 13, lineHeight: 1 }}>+</span>
              <span>Topic</span>
            </div>
          </div>

          {channelsLoading ? <LoadingState /> : (
            <>
              <MessageList messages={channelMessages ?? []} meId={meId} accent={accent} crew={crew} />
              <InputBar accent={accent} placeholder="Message the team…" crew={crew} onSend={handleSendTeam} />
            </>
          )}
        </>
      ) : (
        dmPartner && meId ? (
          <DMConversation
            projectId={projectId}
            meId={meId}
            partner={dmPartner}
            accent={accent}
            crew={crew}
            onBack={() => setDmPartnerId(null)}
          />
        ) : (
          <DMListView
            projectId={projectId}
            meId={meId}
            accent={accent}
            crew={crew}
            onOpen={setDmPartnerId}
          />
        )
      )}

      <Sheet open={creatingChannel} onClose={() => setCreatingChannel(false)}>
        <AddChannelSheet
          accent={accent}
          onClose={() => setCreatingChannel(false)}
          onCreate={(name) => {
            const sortOrder = activeChannels.length
            createChannel.mutate(
              { projectId, name, sortOrder },
              { onSuccess: (ch: any) => setActiveChannelId(ch.id) },
            )
          }}
        />
      </Sheet>

      <FAB accent={accent} projectId={projectId} hideChat />
    </div>
  )
}
