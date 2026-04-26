'use client'

// Slide-up cross-project chat sheet. Toggled by ActionBarRoot's chat
// button via chatOpen in RootFabContext. Mirrors ThreadsSheet's shape and
// animation so the bar's two glass surfaces read as one visual language.
//
// Each row is one conversation — either a project channel chat or a DM
// involving the current user. Tapping a row navigates into the project's
// chat page where deep-linking to the specific channel/DM is the next
// arc of work (currently routes to /projects/<id>/chat as the entry).

import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useAllChats } from '@/lib/hooks/useOriginOne'
import { CrewAvatar } from '@/components/ui'
import { getProjectColor } from '@/lib/utils/phase'
import { haptic } from '@/lib/utils/haptics'

interface ChatSheetProps {
  open: boolean
  onClose: () => void
}

interface ChatConvo {
  id: string
  type: 'channel' | 'dm'
  projectId: string
  projectName: string
  projectColor: string | null
  channelId?: string
  channelName?: string
  partnerId?: string
  partnerName?: string
  partnerAvatar?: string | null
  title: string
  lastMessage: string
  lastMessageAt: string
  lastSenderId: string
  lastSenderName: string
  lastSenderAvatar: string | null
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diff = now - then
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function ChatRow({ convo, onTap }: { convo: ChatConvo; onTap: () => void }) {
  const color = convo.projectColor || getProjectColor(convo.projectId)
  return (
    <button
      onClick={onTap}
      className="active:bg-white/[0.04] transition-colors"
      style={{
        width: '100%', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 4px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: 'transparent', border: 'none', cursor: 'pointer',
      }}
    >
      {/* Avatar / sigil */}
      {convo.type === 'dm' && convo.partnerName ? (
        <CrewAvatar name={convo.partnerName} size={36} />
      ) : (
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `linear-gradient(135deg, ${color}33, ${color}14)`,
          border: `1px solid ${color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span className="font-mono" style={{ fontSize: 12, color, fontWeight: 600 }}>#</span>
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <span style={{
            fontSize: 13, fontWeight: 600, color: '#dddde8',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {convo.title}
          </span>
          <span className="font-mono" style={{ fontSize: 9, color: '#62627a', flexShrink: 0 }}>
            {formatRelative(convo.lastMessageAt)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 11, color: '#8a8a9a', flex: 1, minWidth: 0,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            <span style={{ color: '#a8a8b8' }}>{convo.lastSenderName.split(' ')[0]}: </span>
            {convo.lastMessage}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
          <span className="font-mono" style={{
            fontSize: 9, padding: '1px 6px', borderRadius: 20,
            background: `${color}14`, border: `1px solid ${color}30`,
            color, whiteSpace: 'nowrap',
          }}>
            {convo.projectName}
          </span>
        </div>
      </div>
    </button>
  )
}

export function ChatSheet({ open, onClose }: ChatSheetProps) {
  const router = useRouter()
  const { data: chats, isLoading } = useAllChats()
  const allChats = (chats ?? []) as ChatConvo[]

  function handleRowTap(convo: ChatConvo) {
    haptic('light')
    onClose()
    router.push(`/projects/${convo.projectId}/chat`)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="chat-sheet"
          initial={{ y: '110%' }}
          animate={{ y: 0 }}
          exit={{ y: '110%' }}
          transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
          style={{
            position: 'fixed',
            top: 156,
            bottom: 'calc(68px + 52px + 64px)',
            left: 14, right: 14,
            zIndex: 10,
            background: 'rgba(10,10,18,0.78)',
            backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 -1px 0 rgba(255,255,255,0.05), 0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {/* Accent line — brand indigo */}
          <div style={{
            height: 2, flexShrink: 0,
            background: 'linear-gradient(90deg, transparent 5%, rgba(100,112,243,0.45) 40%, rgba(100,112,243,0.45) 60%, transparent 95%)',
          }} />

          {/* Header */}
          <div style={{
            padding: '14px 18px 12px', flexShrink: 0,
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}>
            <div className="font-mono" style={{ fontSize: 9, color: 'rgba(100,112,243,0.5)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>All Projects</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#dddde8', letterSpacing: '-0.02em', marginTop: 2 }}>
              Chat
            </div>
            <div className="font-mono" style={{ fontSize: 10, color: '#62627a', marginTop: 4 }}>
              {isLoading ? 'Loading…' : `${allChats.length} conversation${allChats.length !== 1 ? 's' : ''}`}
            </div>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 18px 18px' }}>
            {!isLoading && allChats.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', fontSize: 12, color: '#62627a' }}>
                No chats yet
              </div>
            ) : (
              allChats.map((c) => (
                <ChatRow key={c.id} convo={c} onTap={() => handleRowTap(c)} />
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
