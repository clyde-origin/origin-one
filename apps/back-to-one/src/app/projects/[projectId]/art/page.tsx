'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useProject, useArtItems, useCreateArtItem, useUpdateArtItem, useDeleteArtItem } from '@/lib/hooks/useOriginOne'
import { PageHeader } from '@/components/ui/PageHeader'
import { FAB } from '@/components/ui/FAB'
import { haptic } from '@/lib/utils/haptics'
import { getProjectColor, statusHex, statusLabel as projectStatusLabel } from '@/lib/utils/phase'
import { deriveProjectColors, DEFAULT_PROJECT_HEX } from '@origin-one/ui'
import { useDetailSheetThreads } from '@/components/threads/useDetailSheetThreads'
import { ThreadRowBadge, type ThreadRowBadgeEntry } from '@/components/threads/ThreadRowBadge'
import { useThreadsByEntity } from '@/components/threads/useThreadsByEntity'
import type { ThreadAttachmentType } from '@/types'

// ── Types ───────────────────────────────────────────────

type ArtEntityType = 'wardrobe' | 'prop' | 'hmu'
type ArtStatus = 'needed' | 'sourced' | 'confirmed' | 'hero'

interface ArtEntity {
  id: string
  projectId: string
  type: ArtEntityType
  name: string
  description: string | null
  metadata: { status?: ArtStatus; imageUrl?: string; tags?: string[] } | null
  createdAt: string
  updatedAt: string
}

// ── Constants ───────────────────────────────────────────

const TABS: { key: ArtEntityType; label: string }[] = [
  { key: 'wardrobe', label: 'Wardrobe' },
  { key: 'prop',     label: 'Set Dec / Props' },
  { key: 'hmu',      label: 'HMU' },
]

const STATUS_STYLES: Record<ArtStatus, { bg: string; border: string; color: string }> = {
  needed:    { bg: 'rgba(252,165,0,0.1)',   border: 'rgba(252,165,0,0.2)',   color: '#FCA500' },
  sourced:   { bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.18)',  color: '#22C55E' },
  confirmed: { bg: 'rgba(103,232,249,0.08)', border: 'rgba(103,232,249,0.18)', color: '#67E8F9' },
  hero:      { bg: 'rgba(224,123,57,0.1)',  border: 'rgba(224,123,57,0.22)', color: '#E07B39' },
}

const STATUS_LABELS: Record<ArtStatus, string> = {
  needed: 'Needed', sourced: 'Sourced', confirmed: 'Confirmed', hero: 'Hero',
}

const ALL_STATUSES: ArtStatus[] = ['needed', 'sourced', 'confirmed', 'hero']

function getStatus(entity: ArtEntity): ArtStatus {
  return (entity.metadata?.status as ArtStatus) ?? 'needed'
}

// ── Status Badge ────────────────────────────────────────

function ArtStatusBadge({ status }: { status: ArtStatus }) {
  const s = STATUS_STYLES[status]
  return (
    <span className="font-mono uppercase" style={{
      fontSize: '0.42rem', letterSpacing: '0.1em',
      padding: '3px 8px', borderRadius: 20,
      background: s.bg, border: `1px solid ${s.border}`, color: s.color,
    }}>
      {STATUS_LABELS[status]}
    </span>
  )
}

// ── Art Item Card ───────────────────────────────────────

function ArtItemCard({ item, accent, onTap, threadEntry }: { item: ArtEntity; accent: string; onTap: () => void; threadEntry: ThreadRowBadgeEntry | undefined }) {
  const status = getStatus(item)
  const imgUrl = item.metadata?.imageUrl
  const tags = item.metadata?.tags ?? []

  return (
    <div
      className="flex cursor-pointer active:opacity-90 transition-opacity"
      style={{
        position: 'relative',
        gap: 14, padding: 12, borderRadius: 16,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        alignItems: 'flex-start',
      }}
      onClick={onTap}
    >
      {/* Image */}
      <div style={{
        width: 80, height: 80, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
        background: 'rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {imgUrl ? (
          <img src={imgUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 10, border: '1px dashed rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.15)', fontSize: 20,
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.3" />
              <circle cx="8" cy="10" r="2" stroke="currentColor" strokeWidth="1.2" />
              <path d="M2 16l5-4 3 2 4-5 8 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff', marginBottom: 3, lineHeight: 1.2 }}>
          {item.name}
        </div>
        {item.description && (
          <div style={{
            fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
          }}>
            {item.description}
          </div>
        )}
        {tags.length > 0 && (
          <div style={{ display: 'flex', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
            {tags.map(t => (
              <span key={t} className="font-mono uppercase" style={{
                fontSize: '0.38rem', letterSpacing: '0.1em',
                padding: '3px 8px', borderRadius: 20,
                background: `${accent}18`, border: `1px solid ${accent}33`, color: accent,
              }}>{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* Status */}
      <div style={{ flexShrink: 0 }}>
        <ArtStatusBadge status={status} />
      </div>

      <ThreadRowBadge entry={threadEntry} />
    </div>
  )
}

// ── Detail Sheet ────────────────────────────────────────

function ArtDetailSheet({
  item, accent, projectId, isCreate, onClose,
}: {
  item: ArtEntity | null
  accent: string
  projectId: string
  isCreate: boolean
  onClose: () => void
}) {
  const createArt = useCreateArtItem(projectId)
  const updateArt = useUpdateArtItem(projectId)
  const deleteArt = useDeleteArtItem(projectId)

  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<ArtStatus>('needed')
  const [itemType, setItemType] = useState<ArtEntityType>('prop')

  useEffect(() => {
    if (item) {
      setName(item.name)
      setNotes(item.description ?? '')
      setStatus(getStatus(item))
      setItemType(item.type)
    } else {
      setName('')
      setNotes('')
      setStatus('needed')
      setItemType('prop')
    }
  }, [item])

  const imgUrl = item?.metadata?.imageUrl

  // Art tabs are Entity records with type ∈ {prop, wardrobe, hmu}. Use the
  // Entity type as the canonical attachment type so prop threads posted here
  // unify with EntityDrawer's props tab for the same Entity id.
  const threadAttachType: ThreadAttachmentType = item
    ? (item.type as ThreadAttachmentType)
    : 'prop'
  const { TriggerIcon, PreviewRow, MessageZone, StartSheetOverlay } = useDetailSheetThreads({
    projectId,
    attachedToType: threadAttachType,
    attachedToId: !isCreate && item ? item.id : null,
    subjectLabel: item?.name ?? '',
  })

  function handleSave() {
    if (!name.trim()) return
    haptic('light')
    if (isCreate) {
      createArt.mutate({
        projectId,
        type: itemType,
        name: name.trim(),
        description: notes || undefined,
        metadata: { status },
      })
    } else if (item) {
      updateArt.mutate({
        id: item.id,
        fields: {
          name: name.trim(),
          description: notes || null,
          metadata: { ...(item.metadata ?? {}), status },
        },
      })
    }
    onClose()
  }

  function handleDelete() {
    if (!item) return
    haptic('warning')
    deleteArt.mutate(item.id)
    onClose()
  }

  function handleStatusTap(s: ArtStatus) {
    setStatus(s)
    if (!isCreate && item) {
      updateArt.mutate({
        id: item.id,
        fields: { metadata: { ...(item.metadata ?? {}), status: s } },
      })
    }
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 7, padding: '10px 12px',
    color: '#dddde8', fontSize: '0.82rem',
    width: '100%', outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-geist-mono)',
    fontSize: '0.44rem', color: 'rgba(255,255,255,0.28)',
    letterSpacing: '0.13em', textTransform: 'uppercase',
    display: 'block', marginBottom: 6,
  }

  return (
    <>
      {/* Handle */}
      <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.13)', margin: '12px auto 0', flexShrink: 0 }} />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
      }}>
        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fff' }}>
          {isCreate ? 'New Item' : item?.name ?? 'Item Detail'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!isCreate && TriggerIcon}
          <span
            style={{ fontSize: '0.78rem', fontWeight: 600, color: accent, cursor: 'pointer' }}
            onClick={handleSave}
          >
            Done
          </span>
        </div>
      </div>

      {/* Hero image */}
      <div style={{
        width: '100%', aspectRatio: '4/3',
        background: 'rgba(255,255,255,0.04)',
        position: 'relative', flexShrink: 0, overflow: 'hidden',
      }}>
        {imgUrl ? (
          <>
            <img src={imgUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div className="font-mono uppercase" style={{
              position: 'absolute', bottom: 10, right: 10,
              background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8, padding: '5px 10px',
              fontSize: '0.44rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
            }}>Edit Photo</div>
          </>
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8,
            color: 'rgba(255,255,255,0.15)', cursor: 'pointer',
          }}>
            <span style={{ fontSize: 28 }}>+</span>
            <span className="font-mono uppercase" style={{ fontSize: '0.48rem', letterSpacing: '0.1em' }}>
              Add Reference Image
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Name */}
        <div>
          <label style={labelStyle}>Name</label>
          {isCreate ? (
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Item name" autoFocus autoComplete="off" spellCheck={false}
              style={inputStyle}
            />
          ) : (
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              onBlur={() => { if (item && name.trim() !== item.name) handleSave() }}
              autoComplete="off" spellCheck={false}
              style={inputStyle}
            />
          )}
        </div>

        {/* Notes */}
        <div>
          <label style={labelStyle}>Notes</label>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            onBlur={() => { if (!isCreate && item) handleSave() }}
            placeholder="Description or notes"
            rows={3}
            style={{ ...inputStyle, resize: 'none' }}
          />
        </div>

        {/* Type (create mode only) */}
        {isCreate && (
          <div>
            <label style={labelStyle}>Category</label>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {TABS.map(t => (
                <button key={t.key} onClick={() => setItemType(t.key)} className="font-mono uppercase" style={{
                  fontSize: '0.44rem', letterSpacing: '0.08em',
                  padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                  background: itemType === t.key ? `${accent}1a` : 'transparent',
                  border: `1px solid ${itemType === t.key ? `${accent}40` : 'rgba(255,255,255,0.09)'}`,
                  color: itemType === t.key ? accent : 'rgba(255,255,255,0.3)',
                }}>{t.label}</button>
              ))}
            </div>
          </div>
        )}

        {/* Status pills */}
        <div>
          <label style={labelStyle}>Status</label>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {ALL_STATUSES.map(s => {
              const sel = status === s
              const st = STATUS_STYLES[s]
              return (
                <button key={s} onClick={() => handleStatusTap(s)} className="font-mono uppercase" style={{
                  fontSize: '0.44rem', letterSpacing: '0.08em',
                  padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                  background: sel ? st.bg : 'transparent',
                  border: `1px solid ${sel ? st.border : 'rgba(255,255,255,0.09)'}`,
                  color: sel ? st.color : 'rgba(255,255,255,0.3)',
                  transition: 'all 0.14s',
                }}>{STATUS_LABELS[s]}</button>
              )
            })}
          </div>
        </div>

        {/* Delete (edit mode only) */}
        {!isCreate && item && (
          <button onClick={handleDelete} style={{
            marginTop: 8, width: '100%', padding: '10px', borderRadius: 8,
            background: 'rgba(232,86,74,0.08)', border: '1px solid rgba(232,86,74,0.2)',
            color: '#e8564a', fontFamily: 'var(--font-geist-mono)', fontSize: '0.44rem',
            letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
          }}>Delete Item</button>
        )}
      </div>

      {!isCreate && PreviewRow}
      {!isCreate && MessageZone}
      {StartSheetOverlay}
    </>
  )
}

// ── Empty State ─────────────────────────────────────────

function ArtEmptyState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '60px 30px', gap: 10, textAlign: 'center',
    }}>
      <div style={{ fontSize: 32, opacity: 0.2 }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="8" cy="10" r="2" stroke="currentColor" strokeWidth="1.2" />
          <path d="M2 16l5-4 3 2 4-5 8 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="font-mono" style={{
        fontSize: '0.56rem', color: 'rgba(255,255,255,0.2)',
        letterSpacing: '0.06em', lineHeight: 1.6,
      }}>
        No items added yet.<br />Tap + to add your first item.
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────

export default function ArtPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const { data: project } = useProject(projectId)
  const colors = deriveProjectColors(project?.color || getProjectColor(projectId) || DEFAULT_PROJECT_HEX)
  const accent = colors.primary
  const { data: items, isLoading } = useArtItems(projectId)
  const allItems = (items ?? []) as ArtEntity[]

  const [activeTab, setActiveTab] = useState<ArtEntityType>('wardrobe')
  const [selected, setSelected] = useState<ArtEntity | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const tabItems = allItems.filter(i => i.type === activeTab)
  // activeTab is a ThreadAttachmentType-compatible string (prop | wardrobe | hmu)
  const threadByItemId = useThreadsByEntity(projectId, activeTab as ThreadAttachmentType)

  // Counts for the section label
  const confirmed = tabItems.filter(i => getStatus(i) === 'confirmed').length
  const needed = tabItems.filter(i => getStatus(i) === 'needed').length

  return (
    <div className="screen">
      <PageHeader
        projectId={projectId}
        title="Art"
        meta={project ? (
          <div className="flex flex-col items-center gap-1.5">
            <span style={{ color: accent, fontSize: '0.50rem', letterSpacing: '0.06em' }}>{project.name}</span>
            <span className="font-mono uppercase" style={{
              fontSize: '0.38rem', padding: '2px 8px', borderRadius: 12,
              background: `${statusHex(project.status)}18`, color: statusHex(project.status),
            }}>{projectStatusLabel(project.status)}</span>
          </div>
        ) : ''}
        noBorder
      />

      {/* Tab bar */}
      <div className="flex">
        {TABS.map(tab => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex-1 text-center uppercase cursor-pointer select-none relative transition-colors"
              style={{
                fontFamily: "'Geist', sans-serif", fontWeight: 700,
                padding: '11px 0', fontSize: '0.52rem', letterSpacing: '0.08em',
                color: isActive ? '#dddde8' : '#62627a',
                background: 'transparent', border: 'none',
              }}
            >
              {tab.label}
              {isActive && (
                <div className="absolute bottom-0" style={{
                  left: '10%', right: '10%', height: 2,
                  background: accent, borderRadius: '2px 2px 0 0',
                }} />
              )}
            </button>
          )
        })}
      </div>

      {/* Scroll area */}
      <div
        className="flex-1 overflow-y-auto no-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch', padding: '14px 16px 100px', position: 'relative', zIndex: 1 }}
      >
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                display: 'flex', gap: 14, padding: 12, borderRadius: 16,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ width: 80, height: 80, borderRadius: 10, background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
                  <div style={{ width: 140, height: 12, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }} />
                  <div style={{ width: 200, height: 9, borderRadius: 4, background: 'rgba(255,255,255,0.04)' }} />
                  <div style={{ width: 100, height: 9, borderRadius: 4, background: 'rgba(255,255,255,0.03)' }} />
                </div>
              </div>
            ))}
          </div>
        ) : tabItems.length === 0 ? (
          <ArtEmptyState />
        ) : (
          <>
            {/* Section label */}
            <div className="font-mono uppercase" style={{
              fontSize: '0.44rem', letterSpacing: '0.15em',
              color: 'rgba(255,255,255,0.2)',
              marginBottom: 8, marginTop: 4, paddingLeft: 2,
            }}>
              {tabItems.length} items · {confirmed} confirmed · {needed} needed
            </div>

            {/* Item cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tabItems.map(item => (
                <ArtItemCard
                  key={item.id}
                  item={item}
                  accent={accent}
                  onTap={() => { haptic('light'); setSelected(item) }}
                  threadEntry={threadByItemId.get(item.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* FAB */}
      <FAB accent={accent} projectId={projectId} onPress={() => { haptic('light'); setShowCreate(true) }} />

      {/* Detail / Create Sheet */}
      <AnimatePresence>
        {(selected || showCreate) && (
          <>
            <motion.div
              key="art-overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setSelected(null); setShowCreate(false) }}
              style={{
                position: 'fixed', inset: 0, zIndex: 50,
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
              }}
            />
            <motion.div
              key="art-sheet"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              drag="y" dragConstraints={{ top: 0 }} dragElastic={0.1}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100) { setSelected(null); setShowCreate(false) }
              }}
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 51,
                background: '#111', borderTop: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '24px 24px 0 0',
                height: '88%', overflowY: 'auto',
                display: 'flex', flexDirection: 'column',
                paddingBottom: 'env(safe-area-inset-bottom, 24px)',
              }}
              className="no-scrollbar"
            >
              <ArtDetailSheet
                item={selected}
                accent={accent}
                projectId={projectId}
                isCreate={showCreate && !selected}
                onClose={() => { setSelected(null); setShowCreate(false) }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
