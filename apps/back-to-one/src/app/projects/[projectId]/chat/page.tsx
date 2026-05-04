'use client'

import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react'
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
  useMentionRoster,
} from '@/lib/hooks/useOriginOne'
import { MentionInput } from '@/components/ui/MentionInput'
import { MentionText } from '@/components/ui/MentionText'
import { LoadingState } from '@/components/ui'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProjectSwitcher } from '@/components/ProjectSwitcher'
import { useFabAction } from '@/lib/contexts/FabActionContext'
import { haptic } from '@/lib/utils/haptics'
import { getProjectColor, statusHex, statusLabel } from '@/lib/utils/phase'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { initials } from '@/lib/utils/formatting'

// ── Helpers ────────────────────────────────────────────────

// Cinema Glass: parse a project hex into rgb triplets the .sheen-title /
// .glass-tile rules read. Glow apex matches the +20/+30/+16 pattern HubContent
// established in #122.
function hexRgbTriplet(hex: string | null | undefined): string {
  const h = hex || '#c45adc'
  return `${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)}`
}
function hexGlowTriplet(hex: string | null | undefined): string {
  const h = hex || '#c45adc'
  const r = Math.min(255, parseInt(h.slice(1, 3), 16) + 20)
  const g = Math.min(255, parseInt(h.slice(3, 5), 16) + 30)
  const b = Math.min(255, parseInt(h.slice(5, 7), 16) + 16)
  return `${r}, ${g}, ${b}`
}
function statusToPhaseChip(status: string | undefined): 'pre' | 'prod' | 'post' {
  if (status === 'production') return 'prod'
  if (status === 'post_production') return 'post'
  return 'pre'
}

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

// ── Message Bubble ─────────────────────────────────────────

const MessageBubble = memo(function MessageBubble({
  msg, isSelf, accent, showAvatar, showName,
}: { msg: any; isSelf: boolean; accent: string; showAvatar: boolean; showName: boolean }) {
  const senderName = msg.sender?.name ?? ''
  const color = isSelf ? accent : stableColor(senderName)

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
      <div className="flex flex-col" style={{ gap: 3, maxWidth: '75%', alignItems: isSelf ? 'flex-end' : 'flex-start' }}>
        {showName && !isSelf && (
          <div className="font-mono uppercase" style={{ fontSize: 8, letterSpacing: '0.07em', color: 'var(--fg-mono)' }}>
            {senderName}
          </div>
        )}
        <div
          className={`chat-bubble ${isSelf ? 'chat-bubble--self' : 'chat-bubble--other'}`}
          style={{
            padding: '9px 12px',
            borderRadius: 14,
            fontSize: 13,
            lineHeight: 1.5,
            color: isSelf ? '#fff' : 'var(--fg)',
            // Self bubble takes the project accent (~80% opacity); other-bubble
            // takes a frosted glass-tile-like fill keyed off var(--fg) so it
            // flips with theme.
            background: isSelf ? `${accent}cc` : 'rgba(255,255,255,0.06)',
            border: isSelf ? 'none' : '1px solid rgba(255,255,255,0.08)',
            borderBottomLeftRadius: isSelf ? 14 : 4,
            borderBottomRightRadius: isSelf ? 4 : 14,
            wordBreak: 'break-word',
            boxShadow: isSelf
              ? `0 4px 14px -8px ${accent}, inset 0 1px 0 rgba(255,255,255,0.10)`
              : 'inset 0 1px 0 rgba(255,255,255,0.05)',
          }}>
          <MentionText text={msg.content ?? ''} accent={isSelf ? '#ffffff' : accent} />
        </div>
        <div className="font-mono" style={{ fontSize: 8, color: 'var(--fg-mono)', opacity: 0.7 }}>
          {timeOf(msg.createdAt)}
        </div>
      </div>
    </div>
  )
})

// ── Message List w/ date separators ────────────────────────

function MessageList({ messages, meId, accent }: { messages: any[]; meId: string | null; accent: string }) {
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages.length])

  const items = useMemo(() => {
    const acc: React.ReactNode[] = []
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i]
      const prev = messages[i - 1]
      if (!prev || !sameDay(prev.createdAt, m.createdAt)) {
        // Cinema-glass `.ai-bucket` rule pattern — rule | label | rule
        acc.push(
          <div key={`sep-${m.id}`} className="chat-day-sep flex items-center" style={{ gap: 10, margin: '4px 0' }}>
            <div className="flex-1" style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
            <span className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: '0.14em', fontWeight: 600, color: 'var(--fg-mono)' }}>
              {dayLabel(m.createdAt)}
            </span>
            <div className="flex-1" style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
          </div>,
        )
      }
      const isSelf = m.senderId === meId
      const prevSameSender = prev && prev.senderId === m.senderId && sameDay(prev.createdAt, m.createdAt)
      acc.push(
        <MessageBubble
          key={m.id}
          msg={m}
          isSelf={isSelf}
          accent={accent}
          showAvatar={!prevSameSender}
          showName={!prevSameSender}
        />,
      )
    }
    return acc
  }, [messages, meId, accent])
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items}
      <div ref={bottomRef} />
    </div>
  )
}

// ── Input bar ─────────────────────────────────────────────

function InputBar({
  projectId, accent, placeholder, onSend,
}: { projectId: string; accent: string; placeholder: string; onSend: (text: string, mentions: string[]) => void }) {
  const [value, setValue] = useState('')
  const [mentions, setMentions] = useState<string[]>([])
  const { data: roster = [] } = useMentionRoster(projectId)

  const submit = () => {
    const v = value.trim()
    if (!v) return
    onSend(v, mentions)
    setValue('')
    setMentions([])
  }

  const ready = value.trim().length > 0

  return (
    <div className="chat-input-bar flex-shrink-0 relative" style={{ padding: '10px 14px 20px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="chat-input-inner flex items-center" style={{
        gap: 8,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 22, padding: '8px 14px',
      }}>
        <MentionInput
          value={value}
          mentions={mentions}
          onChange={(text, m) => { setValue(text); setMentions(m) }}
          roster={roster}
          placeholder={placeholder}
          accent={accent}
          onSubmit={submit}
        />
        <span
          onClick={submit}
          className="flex-shrink-0"
          style={{
            fontSize: 16, color: ready ? accent : 'var(--fg-mono)',
            cursor: ready ? 'pointer' : 'default',
            transition: 'color 0.15s',
            textShadow: ready ? `0 0 8px rgba(${hexRgbTriplet(accent)}, 0.45)` : undefined,
          }}>
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
    <div className="chat-dm-list flex-1 overflow-y-auto" style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {rows.length === 0 ? (
        <div className="font-mono uppercase" style={{ padding: 32, textAlign: 'center', fontSize: 10, color: 'var(--fg-mono)', letterSpacing: '0.08em' }}>
          No teammates yet
        </div>
      ) : rows.map(r => {
        const c = stableColor(r.user?.name ?? '')
        return (
          <div key={r.partnerId}
            onClick={() => { haptic('light'); onOpen(r.partnerId) }}
            className={`chat-dm-row glass-tile glass-tile-xs flex items-center cursor-pointer ${r.unread ? 'chat-dm-row--unread' : ''}`}
            style={{
              gap: 12, padding: '10px 10px',
              transition: 'background 0.14s',
            }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${c}22`, border: `1.5px solid ${c}55`, color: c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
              {initials(r.user?.name ?? '')}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)', lineHeight: 1.2 }}>{r.user?.name}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-mono)', opacity: r.unread ? 1 : 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                {r.lastMessage || (r.role ? r.role.charAt(0).toUpperCase() + r.role.slice(1) : '—')}
              </div>
            </div>
            <div className="flex flex-col items-end flex-shrink-0" style={{ gap: 5 }}>
              {r.lastAt && (
                <div className="font-mono" style={{ fontSize: 9, color: 'var(--fg-mono)' }}>
                  {dayLabel(r.lastAt) === 'Today' ? timeOf(r.lastAt) : dayLabel(r.lastAt)}
                </div>
              )}
              {r.unread && <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent, boxShadow: `0 0 6px ${accent}` }} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DMConversation({ projectId, meId, partner, accent, onBack }: { projectId: string; meId: string; partner: any; accent: string; onBack: () => void }) {
  const { data: messages } = useDMMessages(projectId, meId, partner.userId)
  useChatSubscription({ projectId, channelId: null, meId, partnerId: partner.userId })
  const sendMsg = useSendChatMessage(projectId)
  const user = partner.User ?? partner
  const color = stableColor(user?.name ?? '')

  return (
    <>
      <div className="flex items-center flex-shrink-0" style={{ gap: 10, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <span onClick={onBack} style={{ fontSize: 18, color: 'var(--fg-mono)', cursor: 'pointer', flexShrink: 0 }}>←</span>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${color}22`, border: `1px solid ${color}44`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
          {initials(user?.name ?? '')}
        </div>
        <div className="flex-1" style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>{user?.name}</div>
      </div>
      <MessageList messages={messages ?? []} meId={meId} accent={accent} />
      <InputBar
        projectId={projectId}
        accent={accent}
        placeholder={`Message ${(user?.name ?? '').split(' ')[0]}…`}
        onSend={(text, mentions) => sendMsg.mutate({
          projectId,
          channelId: null,
          senderId: meId as string,
          recipientId: partner.userId,
          content: text,
          mentions,
          contextLabel: `Chat · DM with ${user?.name ?? 'teammate'}`,
        })}
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
  // Register the + handler with the global ActionBar — same handler the
  // inline '+ topic' button uses, so both surfaces open the same sheet.
  useFabAction({ onPress: () => { haptic('light'); setCreatingChannel(true) } })

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

  const handleSendTeam = useCallback((text: string, mentions: string[]) => {
    if (!meId || !activeChannelId) return
    const activeChannelName = activeChannels.find(c => c.id === activeChannelId)?.name
    sendMsg.mutate({
      projectId,
      channelId: activeChannelId,
      senderId: meId as string,
      content: text,
      mentions,
      contextLabel: `Chat · ${activeChannelName ?? 'Team'}`,
    })
  }, [meId, activeChannelId, activeChannels, projectId, sendMsg])

  const dmPartner = dmPartnerId ? crew.find(m => m.userId === dmPartnerId) : null

  return (
    <div
      className="screen"
      style={{
        // Cinema Glass: project accent triplets at the .screen root so
        // .sheen-title / .glass-tile inherit. Chat is a project surface
        // (not a thread surface), so it uses the project's accent — not
        // fixed thread tokens.
        ['--accent' as string]: accent,
        ['--accent-rgb' as string]: hexRgbTriplet(accent),
        ['--accent-glow-rgb' as string]: hexGlowTriplet(accent),
      } as React.CSSProperties}
    >
      <PageHeader projectId={projectId} title="Chat" meta={project ? (
        <div className="flex flex-col items-center gap-1.5">
          <ProjectSwitcher projectId={projectId} projectName={project.name} accentColor={accent} variant="meta" />
          <span className={`ai-meta-pill ${statusToPhaseChip(project.status)}`}>
            <span className="phase-dot" />{statusLabel(project.status)}
          </span>
        </div>
      ) : ''} />

      {/* Team / Direct tabs — cinema-glass active treatment: sheen on
          active label + accent underline. Inactive uses var(--fg-mono)
          so light mode flips correctly. */}
      <div className="chat-tabs flex flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {(['team', 'direct'] as const).map(t => {
          const active = tab === t
          return (
            <div
              key={t}
              onClick={() => { haptic('light'); setTab(t); if (t === 'direct') setDmPartnerId(null) }}
              className="chat-tab relative flex-1 cursor-pointer select-none flex items-center justify-center"
              style={{ padding: '12px 0' }}
            >
              <span
                className={`font-mono uppercase ${active ? 'sheen-title' : ''}`}
                style={{
                  fontSize: 9, letterSpacing: '0.14em', fontWeight: 600,
                  color: active ? undefined : 'var(--fg-mono)',
                }}
              >
                {t === 'team' ? 'Team' : 'Direct'}
              </span>
              {active && (
                <div className="absolute" style={{
                  left: '24%', right: '24%', bottom: -1, height: 2,
                  background: accent, borderRadius: '2px 2px 0 0',
                  boxShadow: `0 0 6px rgba(${hexRgbTriplet(accent)}, 0.5)`,
                }} />
              )}
            </div>
          )
        })}
      </div>

      {tab === 'team' ? (
        <>
          {/* Channel pills row — cinema-glass `.dept-pill`-style chips
              tinted with the project accent on the active channel. The
              "+ Topic" affordance keeps its dashed border (signals "add
              new" rather than "select"). Horizontal scroll via .no-scrollbar. */}
          <div className="chat-channel-pills no-scrollbar flex flex-shrink-0 items-center" style={{
            gap: 6, padding: '8px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            overflowX: 'auto',
          }}>
            {channelsLoading ? (
              // Cinema-glass shimmer pill placeholders match channel pill silhouette.
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="sk-block flex-shrink-0" style={{ width: 78, height: 22, borderRadius: 20 }} />
              ))
            ) : activeChannels.map(c => {
              const active = c.id === activeChannelId
              return (
                <div
                  key={c.id}
                  onClick={() => { haptic('light'); setActiveChannelId(c.id) }}
                  className="chat-channel-pill flex-shrink-0 font-mono uppercase cursor-pointer"
                  style={{
                    fontSize: 10, letterSpacing: '0.1em',
                    padding: '6px 12px', borderRadius: 20,
                    background: active ? `rgba(${hexRgbTriplet(accent)}, 0.14)` : 'rgba(255,255,255,0.04)',
                    border: active ? `1px solid rgba(${hexRgbTriplet(accent)}, 0.40)` : '1px solid rgba(255,255,255,0.08)',
                    color: active ? accent : 'var(--fg-mono)',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s',
                  }}>
                  {c.name}
                </div>
              )
            })}
            <div
              onClick={() => { haptic('light'); setCreatingChannel(true) }}
              className="chat-channel-pill chat-channel-pill--add flex-shrink-0 font-mono uppercase cursor-pointer flex items-center"
              style={{
                gap: 5,
                fontSize: 10, letterSpacing: '0.1em',
                padding: '6px 12px', borderRadius: 20,
                border: '1px dashed rgba(255,255,255,0.18)',
                color: 'var(--fg-mono)', background: 'rgba(255,255,255,0.02)',
                whiteSpace: 'nowrap', marginLeft: 'auto',
              }}>
              <span style={{ fontSize: 13, lineHeight: 1 }}>+</span>
              <span>Topic</span>
            </div>
          </div>

          {channelsLoading ? <LoadingState /> : (
            <>
              <MessageList messages={channelMessages ?? []} meId={meId} accent={accent} />
              <InputBar projectId={projectId} accent={accent} placeholder="Message the team…" onSend={handleSendTeam} />
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

      {/* + handler registered above via useFabAction. ActionBar is mounted globally.
          The inline '+ topic' button at the channel-list header (line 263+) stays. */}
    </div>
  )
}
