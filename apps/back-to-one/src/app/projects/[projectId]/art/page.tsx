'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useProject,
  useArtItems,
  useCreateArtItem,
  useUpdateArtItem,
  useDeleteArtItem,
  useUpsertPropSourced,
  useUpsertWardrobeSourced,
} from '@/lib/hooks/useOriginOne'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProjectSwitcher } from '@/components/ProjectSwitcher'
import { StorageImage } from '@/components/ui/StorageImage'
import { useFabAction } from '@/lib/contexts/FabActionContext'
import { haptic } from '@/lib/utils/haptics'
import { getProjectColor, statusLabel as projectStatusLabel } from '@/lib/utils/phase'
import { deriveProjectColors, DEFAULT_PROJECT_HEX } from '@origin-one/ui'
import { useDetailSheetThreads } from '@/components/threads/useDetailSheetThreads'
import { ThreadRowBadge, type ThreadRowBadgeEntry } from '@/components/threads/ThreadRowBadge'
import { useThreadsByEntity } from '@/components/threads/useThreadsByEntity'
import type { ThreadAttachmentType } from '@/types'

// ── Types ───────────────────────────────────────────────

type ArtEntityType = 'wardrobe' | 'prop' | 'hmu'

// Per-type status enums. Props and Wardrobe come from their own typed
// production-side tables (PropSourced/WardrobeSourced); HMU still rides on
// Entity.metadata.status until its own future schema PR. The shared union
// `ArtPillStatus` is what the pill component renders — `confirmed` (HMU's
// loose value) labels as "Ready" for visual coherence with the typed types'
// `ready` state. See DECISIONS.md "WardrobeSourced schema" entry.
type PropStatus     = 'needed' | 'sourced' | 'ready'
type WardrobeStatus = 'needed' | 'sourced' | 'fitted' | 'ready'
type HmuStatus      = 'needed' | 'sourced' | 'confirmed'
type ArtPillStatus  = 'needed' | 'sourced' | 'fitted' | 'ready' | 'confirmed'

interface PropSourcedRow     { id: string; status: PropStatus;     isHero: boolean }
interface WardrobeSourcedRow { id: string; status: WardrobeStatus }

interface ArtEntity {
  id: string
  projectId: string
  type: ArtEntityType
  name: string
  description: string | null
  metadata: { status?: HmuStatus; imageUrl?: string; tags?: string[] } | null
  // Supabase nested-select returns these as either an object (1:1) or null.
  PropSourced: PropSourcedRow | null
  WardrobeSourced: WardrobeSourcedRow | null
  createdAt: string
  updatedAt: string
}

// ── Helpers ────────────────────────────────────────────

// Decompose a #rrggbb hex into a [r,g,b] triplet so the screen root can set
// `--tile-rgb` / `--accent-rgb` / `--accent-glow-rgb` for the cinema-glass
// classes (`glass-tile`, `sheen-title`, `ai-meta-pill`) to consume.
function hexToRgb(hex: string | null | undefined): [number, number, number] {
  const h = (hex && /^#[0-9a-f]{6}$/i.test(hex)) ? hex : '#c45adc'
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}

// Project status → ai-meta-pill phase modifier (.pre / .prod / .post).
// development + pre_production both ride the pre amber; archived collapses to
// pre as a neutral fallback (the pill is omitted upstream when project is null).
function statusToPhase(s: string | undefined): 'pre' | 'prod' | 'post' {
  if (s === 'production') return 'prod'
  if (s === 'post_production') return 'post'
  return 'pre'
}

// ── Constants ───────────────────────────────────────────

const TABS: { key: ArtEntityType; label: string }[] = [
  { key: 'wardrobe', label: 'Wardrobe' },
  { key: 'prop',     label: 'Set Dec / Props' },
  { key: 'hmu',      label: 'HMU' },
]

// Pill styling. `confirmed` reuses `ready`'s visual since it's the same
// concept under different vocabularies (HMU's loose `confirmed` → labeled
// "Ready" until HMU has its own typed enum).
const STATUS_STYLES: Record<ArtPillStatus, { bg: string; border: string; color: string }> = {
  needed:    { bg: 'rgba(252,165,0,0.1)',   border: 'rgba(252,165,0,0.2)',   color: '#FCA500' },
  sourced:   { bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.18)',  color: '#22C55E' },
  fitted:    { bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.22)', color: '#A78BFA' },
  ready:     { bg: 'rgba(103,232,249,0.08)', border: 'rgba(103,232,249,0.18)', color: '#67E8F9' },
  confirmed: { bg: 'rgba(103,232,249,0.08)', border: 'rgba(103,232,249,0.18)', color: '#67E8F9' },
}

const STATUS_LABELS: Record<ArtPillStatus, string> = {
  needed: 'Needed', sourced: 'Sourced', fitted: 'Fitted', ready: 'Ready', confirmed: 'Ready',
}

// Hero pill colors (orange — independent of status)
const HERO_STYLE = { bg: 'rgba(224,123,57,0.1)', border: 'rgba(224,123,57,0.22)', color: '#E07B39' }

// Type-scoped filter chip lists. The pill component handles label-rename of
// `confirmed → Ready` automatically via STATUS_LABELS.
const STATUSES_BY_TYPE: Record<ArtEntityType, ArtPillStatus[]> = {
  prop:     ['needed', 'sourced', 'ready'],
  wardrobe: ['needed', 'sourced', 'fitted', 'ready'],
  hmu:      ['needed', 'sourced', 'confirmed'],
}

function getStatus(entity: ArtEntity): ArtPillStatus {
  if (entity.type === 'prop')     return entity.PropSourced?.status     ?? 'needed'
  if (entity.type === 'wardrobe') return entity.WardrobeSourced?.status ?? 'needed'
  return (entity.metadata?.status as HmuStatus | undefined) ?? 'needed'
}

function getIsHero(entity: ArtEntity): boolean {
  return entity.type === 'prop' ? (entity.PropSourced?.isHero ?? false) : false
}

// ── Status Badge + Hero Badge ───────────────────────────

function ArtStatusBadge({ status }: { status: ArtPillStatus }) {
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

function HeroBadge() {
  return (
    <span className="font-mono uppercase" style={{
      fontSize: '0.42rem', letterSpacing: '0.1em',
      padding: '3px 8px', borderRadius: 20,
      background: HERO_STYLE.bg, border: `1px solid ${HERO_STYLE.border}`, color: HERO_STYLE.color,
    }}>
      Hero
    </span>
  )
}

// ── Art Item Card ───────────────────────────────────────

function ArtItemCard({ item, accent, onTap, threadEntry }: { item: ArtEntity; accent: string; onTap: () => void; threadEntry: ThreadRowBadgeEntry | undefined }) {
  const status = getStatus(item)
  const isHero = getIsHero(item)
  const imgUrl = item.metadata?.imageUrl
  const tags = item.metadata?.tags ?? []

  return (
    <div
      className="glass-tile flex cursor-pointer active:opacity-90 transition-opacity"
      style={{
        position: 'relative',
        gap: 14, padding: 12,
        alignItems: 'flex-start',
      }}
      onClick={onTap}
    >
      {/* Letterbox bars — cinema-glass identity. Above content (z:5). */}
      <div className="letterbox-top" />
      <div className="letterbox-bottom" />

      {/* Image */}
      <div style={{
        width: 80, height: 80, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
        background: 'rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {imgUrl ? (
          <StorageImage url={imgUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
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
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--fg)', marginBottom: 3, lineHeight: 1.2 }}>
          {item.name}
        </div>
        {item.description && (
          <div style={{
            fontSize: '0.62rem', color: 'var(--fg-mono)', lineHeight: 1.5,
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

      {/* Status (+ Hero badge for prop with isHero=true) */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
        <ArtStatusBadge status={status} />
        {isHero && <HeroBadge />}
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
  const upsertProp = useUpsertPropSourced(projectId)
  const upsertWardrobe = useUpsertWardrobeSourced(projectId)

  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<ArtPillStatus>('needed')
  const [isHero, setIsHero] = useState(false)
  const [itemType, setItemType] = useState<ArtEntityType>('prop')

  useEffect(() => {
    if (item) {
      setName(item.name)
      setNotes(item.description ?? '')
      setStatus(getStatus(item))
      setIsHero(getIsHero(item))
      setItemType(item.type)
    } else {
      setName('')
      setNotes('')
      setStatus('needed')
      setIsHero(false)
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
      // Create the Entity first; on success, seed the matching production-side
      // row (PropSourced / WardrobeSourced) so getStatus reads the typed value
      // immediately. HMU writes to metadata.status as before.
      createArt.mutate(
        {
          projectId,
          type: itemType,
          name: name.trim(),
          description: notes || undefined,
          metadata: itemType === 'hmu' ? { status: status as HmuStatus } : undefined,
        },
        {
          onSuccess: (created: any) => {
            if (!created?.id) return
            if (itemType === 'prop') {
              upsertProp.mutate({
                entityId: created.id,
                fields: { status: status as PropStatus, isHero },
              })
            } else if (itemType === 'wardrobe') {
              upsertWardrobe.mutate({
                entityId: created.id,
                fields: { status: status as WardrobeStatus },
              })
            }
          },
        },
      )
    } else if (item) {
      // Edit-mode name/description always update Entity. Status is mutated
      // separately via handleStatusTap (it routes to the right table by type).
      updateArt.mutate({
        id: item.id,
        fields: {
          name: name.trim(),
          description: notes || null,
        },
      })
    }
    onClose()
  }

  function handleDelete() {
    if (!item) return
    haptic('warning')
    // Entity delete cascades to PropSourced/WardrobeSourced via onDelete: Cascade
    // on projectId — actually no, those cascade on Project, not Entity. SET NULL
    // on Entity FK leaves orphan PropSourced rows. Acceptable for v1; cleanup
    // job can sweep them later if it becomes a real concern.
    deleteArt.mutate(item.id)
    onClose()
  }

  function handleStatusTap(s: ArtPillStatus) {
    setStatus(s)
    if (isCreate || !item) return
    if (item.type === 'prop') {
      upsertProp.mutate({
        entityId: item.id,
        fields: { status: s as PropStatus },
      })
    } else if (item.type === 'wardrobe') {
      upsertWardrobe.mutate({
        entityId: item.id,
        fields: { status: s as WardrobeStatus },
      })
    } else {
      // HMU still writes through Entity.metadata until HmuSourced ships.
      updateArt.mutate({
        id: item.id,
        fields: { metadata: { ...(item.metadata ?? {}), status: s as HmuStatus } },
      })
    }
  }

  function handleHeroToggle() {
    if (!item || item.type !== 'prop') return
    const next = !isHero
    setIsHero(next)
    if (isCreate) return
    upsertProp.mutate({
      entityId: item.id,
      fields: { isHero: next },
    })
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border)',
    borderRadius: 7, padding: '10px 12px',
    color: 'var(--fg)', fontSize: '0.82rem',
    width: '100%', outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-geist-mono)',
    fontSize: '0.44rem', color: 'var(--fg-mono)',
    letterSpacing: '0.13em', textTransform: 'uppercase',
    display: 'block', marginBottom: 6,
  }

  return (
    <>
      {/* Handle */}
      <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.13)', margin: '12px auto 0', flexShrink: 0 }} />

      {/* Header — item name uses sheen-extrusion treatment per
          DESIGN_LANGUAGE.md detail-sheet-title rule. */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <span className="sheen-title" style={{ fontSize: '0.88rem', fontWeight: 700, letterSpacing: '0.01em' }}>
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

      {/* Hero image — 6px heavy letterbox bars per BRAND_TOKENS detail-hero rule. */}
      <div style={{
        width: '100%', aspectRatio: '4/3',
        background: 'rgba(255,255,255,0.04)',
        position: 'relative', flexShrink: 0, overflow: 'hidden',
      }}>
        <div className="letterbox-top" style={{ height: 6, position: 'absolute', left: 0, right: 0, top: 0 }} />
        <div className="letterbox-bottom" style={{ height: 6, position: 'absolute', left: 0, right: 0, bottom: 0 }} />
        {imgUrl ? (
          <>
            <StorageImage url={imgUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
            color: 'var(--fg-mono)', cursor: 'pointer',
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
            // Change-gated — matches the name input above. Focus shifts from
            // this textarea into the thread reply or start sheet used to fire
            // an unconditional save, which (combined with tied createdAt from
            // createMany seeds) reordered the item. Save only on real edits.
            onBlur={() => {
              if (!isCreate && item && (notes ?? '') !== (item.description ?? '')) handleSave()
            }}
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

        {/* Status pills — list scoped per type. Props show the 3-state
            PropStatus, Wardrobe shows the 4-state WardrobeStatus (with
            `fitted`), HMU shows the loose 3-state metadata vocabulary. */}
        <div>
          <label style={labelStyle}>Status</label>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {STATUSES_BY_TYPE[itemType].map(s => {
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

        {/* Hero toggle — props only. Boolean separate from status workflow
            (a prop can be in any state AND be the hero / featured prop). */}
        {itemType === 'prop' && (
          <div>
            <label style={labelStyle}>Hero</label>
            <button
              onClick={handleHeroToggle}
              className="font-mono uppercase"
              style={{
                fontSize: '0.44rem', letterSpacing: '0.08em',
                padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                background: isHero ? HERO_STYLE.bg : 'transparent',
                border: `1px solid ${isHero ? HERO_STYLE.border : 'rgba(255,255,255,0.09)'}`,
                color: isHero ? HERO_STYLE.color : 'rgba(255,255,255,0.3)',
                transition: 'all 0.14s',
              }}
            >
              {isHero ? '★ Hero' : 'Mark as Hero'}
            </button>
          </div>
        )}

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
      <div style={{ fontSize: 32, opacity: 0.2, color: 'var(--fg-mono)' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="8" cy="10" r="2" stroke="currentColor" strokeWidth="1.2" />
          <path d="M2 16l5-4 3 2 4-5 8 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="font-mono" style={{
        fontSize: '0.56rem', color: 'var(--fg-mono)',
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
  // Cinema-glass tokens: set --tile-rgb / --accent-rgb / --accent-glow-rgb
  // inline once at the screen root so .glass-tile and .sheen-title rules
  // inherit. +20 / +30 / +16 lifts the project rgb to its accent-glow apex.
  const [pr, pg, pb] = hexToRgb(accent)
  const glowR = Math.min(255, pr + 20)
  const glowG = Math.min(255, pg + 30)
  const glowB = Math.min(255, pb + 16)
  const { data: items, isLoading } = useArtItems(projectId)
  const allItems = (items ?? []) as ArtEntity[]

  const [activeTab, setActiveTab] = useState<ArtEntityType>('wardrobe')
  const [selected, setSelected] = useState<ArtEntity | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  // Register the + handler with the global ActionBar.
  useFabAction({ onPress: () => { haptic('light'); setShowCreate(true) } })

  const tabItems = allItems.filter(i => i.type === activeTab)
  // activeTab is a ThreadAttachmentType-compatible string (prop | wardrobe | hmu)
  const threadByItemId = useThreadsByEntity(projectId, activeTab as ThreadAttachmentType)

  // Counts for the section label
  // Ready count covers both `ready` (prop/wardrobe typed enums) and
  // `confirmed` (HMU's loose vocabulary) — they're the same logical state.
  const ready  = tabItems.filter(i => { const s = getStatus(i); return s === 'ready' || s === 'confirmed' }).length
  const needed = tabItems.filter(i => getStatus(i) === 'needed').length

  return (
    <div
      className="screen"
      style={{
        ['--tile-rgb' as string]: `${pr}, ${pg}, ${pb}`,
        ['--accent-rgb' as string]: `${pr}, ${pg}, ${pb}`,
        ['--accent-glow-rgb' as string]: `${glowR}, ${glowG}, ${glowB}`,
      } as React.CSSProperties}
    >
      <PageHeader
        projectId={projectId}
        title="Art"
        meta={project ? (
          <div className="flex flex-col items-center gap-1.5">
            <ProjectSwitcher projectId={projectId} projectName={project.name} accentColor={accent} variant="meta" />
            <span className={`ai-meta-pill ${statusToPhase(project.status)}`}>
              <span className="phase-dot" />
              {projectStatusLabel(project.status)}
            </span>
          </div>
        ) : ''}
        noBorder
      />

      {/* Tab bar — active tab text uses sheen-extrusion treatment per
          DESIGN_LANGUAGE.md tab-nav rule. */}
      <div className="flex">
        {TABS.map(tab => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 text-center uppercase cursor-pointer select-none relative transition-colors ${isActive ? 'sheen-title' : ''}`}
              style={{
                fontFamily: "'Geist', sans-serif", fontWeight: 700,
                padding: '11px 0', fontSize: '0.52rem', letterSpacing: '0.08em',
                color: isActive ? undefined : 'var(--fg-mono)',
                background: 'transparent', border: 'none',
              }}
            >
              {tab.label}
              {isActive && (
                <div className="absolute bottom-0" style={{
                  left: '10%', right: '10%', height: 2,
                  background: accent, borderRadius: '2px 2px 0 0',
                  boxShadow: `0 -2px 12px -4px rgba(${pr},${pg},${pb},0.45)`,
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
              <div key={i} className="glass-tile" style={{
                position: 'relative',
                display: 'flex', gap: 14, padding: 12,
              }}>
                <div className="letterbox-top" />
                <div className="letterbox-bottom" />
                <div className="sk-block" style={{ width: 80, height: 80, borderRadius: 10, flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
                  <div className="sk-block" style={{ width: 140, height: 12 }} />
                  <div className="sk-block" style={{ width: 200, height: 9 }} />
                  <div className="sk-block" style={{ width: 100, height: 9 }} />
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
              color: 'var(--fg-mono)',
              marginBottom: 8, marginTop: 4, paddingLeft: 2,
            }}>
              {tabItems.length} items · {ready} ready · {needed} needed
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

      {/* + handler registered above via useFabAction. ActionBar is mounted globally. */}

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
