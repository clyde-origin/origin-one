'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, type PanInfo } from 'framer-motion'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getEntities, createEntity, updateEntity } from '@/lib/db/queries'
import { haptic } from '@/lib/utils/haptics'
import { useDetailSheetThreads } from '@/components/threads/useDetailSheetThreads'
import { ThreadRowBadge } from '@/components/threads/ThreadRowBadge'
import { useThreadsByEntity } from '@/components/threads/useThreadsByEntity'

// ── Entity type colors (from reference spec) ────────────
export const ENTITY_COLORS = {
  characters: { base: '#67E8F9', bg: 'rgba(103,232,249,0.13)', border: 'rgba(103,232,249,0.28)', bgLight: 'rgba(103,232,249,0.1)' },
  locations:  { base: '#A78BFA', bg: 'rgba(167,139,250,0.13)', border: 'rgba(167,139,250,0.28)', bgLight: 'rgba(167,139,250,0.1)' },
  props:      { base: '#FCD34D', bg: 'rgba(252,211,77,0.10)',   border: 'rgba(252,211,77,0.22)',  bgLight: 'rgba(252,211,77,0.08)' },
} as const

export type EntityType = 'characters' | 'locations' | 'props'

export interface EntityItem {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
}

export function getEntityInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// ── Shared spring transition ────────────────────────────
const spring = { type: 'spring' as const, damping: 28, stiffness: 280, mass: 0.8 }

// Drawer is a script-side surface — every type keys on Entity.id. Threads posted
// here travel with the scripted record. Production-side threads (Cast/Location/
// PropSourced) live on their own pages — see DECISIONS.md "Entity-vs-production-
// record threading rule".
const ENTITY_TYPE_FOR: Record<EntityType, 'character' | 'location' | 'prop'> = {
  characters: 'character',
  locations:  'location',
  props:      'prop',
}

// ── MAIN COMPONENT ──────────────────────────────────────

export function EntityDrawer({ type, projectId, open, onClose }: {
  type: EntityType
  projectId: string
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const colors = ENTITY_COLORS[type]
  const [editingEntity, setEditingEntity] = useState<EntityItem | null>(null)
  const [creating, setCreating] = useState(false)

  const entityType = ENTITY_TYPE_FOR[type]
  const threadByTileId = useThreadsByEntity(projectId, entityType)

  // Close detail sheet when drawer closes
  useEffect(() => {
    if (!open) { setEditingEntity(null); setCreating(false) }
  }, [open])

  // ── Fetch data ────────────────────────────────────────
  const { data: rawItems } = useQuery({
    queryKey: ['entities', projectId, type],
    queryFn: () => getEntities(projectId, entityType),
    enabled: open,
  })

  // Normalize to EntityItem[]
  const items: EntityItem[] = (rawItems ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    imageUrl: r.metadata?.imageUrl ?? null,
  }))

  const label = type === 'characters' ? 'Characters' : type === 'locations' ? 'Locations' : 'Props'
  const countLabel = items.length === 0 ? '0 added' : `${items.length} in script`

  // ── Save handler ──────────────────────────────────────
  const handleSave = useCallback(async (name: string, description: string, entityId?: string) => {
    try {
      if (entityId) {
        await updateEntity(entityId, { name, description })
      } else {
        await createEntity({ projectId, type: entityType, name, description })
      }
      qc.invalidateQueries({ queryKey: ['entities', projectId, type] })
    } catch (err) {
      console.error(`Failed to save ${type}:`, err)
    }
    setEditingEntity(null)
    setCreating(false)
  }, [type, entityType, projectId, qc])

  // ── Initials helper ───────────────────────────────────
  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            key="entity-overlay"
            className="fixed inset-0"
            style={{ background: 'rgba(0,0,0,0.5)', zIndex: 40 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            key="entity-drawer"
            className="fixed bottom-0 left-0 right-0"
            style={{
              background: '#111', borderTop: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '24px 24px 0 0',
              paddingBottom: 'calc(34px + env(safe-area-inset-bottom, 0px))',
              zIndex: 41,
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={spring}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_: any, info: PanInfo) => {
              if (info.offset.y > 80 || info.velocity.y > 400) onClose()
            }}
          >
            {/* Handle */}
            <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.13)', borderRadius: 2, margin: '12px auto 14px' }} />

            {/* Header */}
            <div className="flex items-center justify-between" style={{ padding: '0 20px 13px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>{label}</span>
              <span className="font-mono" style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.06em' }}>{countLabel}</span>
            </div>

            {/* Circle row or empty state */}
            {items.length === 0 ? (
              <div className="flex flex-col items-center" style={{ padding: '24px 20px 8px', gap: 10 }}>
                <div className="flex flex-col items-center" style={{ gap: 7, cursor: 'pointer' }}
                  onClick={() => { haptic('light'); setCreating(true) }}>
                  <div className="flex items-center justify-center" style={{
                    width: 56, height: 56, borderRadius: '50%',
                    border: `1.5px dashed ${colors.border}`, color: colors.base,
                    fontSize: 24, fontWeight: 300,
                  }}>+</div>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>Add</span>
                </div>
                <p className="font-mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em', textAlign: 'center' }}>
                  No {label.toLowerCase()} added yet.
                </p>
              </div>
            ) : (
              <div className="no-scrollbar" style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 20px 4px', overflowX: 'auto' }}>
                {items.map(item => (
                  <div key={item.id} className="flex flex-col items-center flex-shrink-0 cursor-pointer" style={{ gap: 7 }}
                    onClick={() => { haptic('light'); setEditingEntity(item) }}>
                    {/* Relative wrapper on the circle only — keeps the -6/-6 badge
                        anchored to the avatar edge, not under the label below. */}
                    <div style={{ position: 'relative' }}>
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} style={{
                          width: 56, height: 56, borderRadius: '50%', objectFit: 'cover',
                          border: `1.5px solid ${colors.border}`,
                        }} />
                      ) : (
                        <div className="flex items-center justify-center" style={{
                          width: 56, height: 56, borderRadius: '50%',
                          background: colors.bg, border: `1.5px solid ${colors.border}`,
                          color: colors.base, fontSize: 18, fontWeight: 700,
                        }}>
                          {getInitials(item.name)}
                        </div>
                      )}
                      <ThreadRowBadge entry={threadByTileId.get(item.id)} />
                    </div>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', maxWidth: 64, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name.split(/\s+/)[0]}
                    </span>
                  </div>
                ))}
                {/* + circle */}
                <div className="flex flex-col items-center flex-shrink-0 cursor-pointer" style={{ gap: 7 }}
                  onClick={() => { haptic('light'); setCreating(true) }}>
                  <div className="flex items-center justify-center" style={{
                    width: 56, height: 56, borderRadius: '50%',
                    border: `1.5px dashed ${colors.border}`, color: colors.base,
                    fontSize: 24, fontWeight: 300,
                  }}>+</div>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>Add</span>
                </div>
              </div>
            )}
          </motion.div>

          {/* Detail sheet — layers on top of drawer */}
          <AnimatePresence>
            {(creating || editingEntity) && (
              <EntityDetailSheet
                type={type}
                projectId={projectId}
                colors={colors}
                label={label}
                entity={editingEntity}
                onSave={handleSave}
                onClose={() => { setEditingEntity(null); setCreating(false) }}
                getInitials={getInitials}
              />
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  )
}

// ── DETAIL SHEET (create / edit) ────────────────────────

export function EntityDetailSheet({ type, projectId, colors, label, entity, onSave, onClose, getInitials }: {
  type: EntityType
  projectId: string
  colors: typeof ENTITY_COLORS[EntityType]
  label: string
  entity: EntityItem | null
  onSave: (name: string, description: string, entityId?: string) => void
  onClose: () => void
  getInitials: (name: string) => string
}) {
  const isEdit = !!entity
  const [name, setName] = useState(entity?.name ?? '')
  const [description, setDescription] = useState(entity?.description ?? '')
  const nameRef = useRef<HTMLInputElement>(null)

  const { TriggerIcon, PreviewRow, MessageZone, StartSheetOverlay } = useDetailSheetThreads({
    projectId,
    attachedToType: ENTITY_TYPE_FOR[type],
    attachedToId: entity?.id ?? null,
    subjectLabel: entity?.name ?? '',
  })

  useEffect(() => {
    // Autofocus name field on create
    if (!isEdit) setTimeout(() => nameRef.current?.focus(), 100)
  }, [isEdit])

  const handleSubmit = () => {
    const trimmedName = name.trim()
    if (!trimmedName) return
    onSave(trimmedName, description.trim(), entity?.id)
  }

  const singularLabel = label === 'Characters' ? 'Character' : label === 'Locations' ? 'Location' : 'Prop'

  return (
    <>
      {/* Sheet backdrop — sits above drawer */}
      <motion.div
        key="detail-backdrop"
        className="fixed inset-0"
        style={{ zIndex: 42 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      <motion.div
        key="detail-sheet"
        className="fixed bottom-0 left-0 right-0 no-scrollbar"
        style={{
          background: '#141414', borderTop: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '24px 24px 0 0', height: '87%',
          paddingBottom: 'calc(34px + env(safe-area-inset-bottom, 0px))',
          zIndex: 43, overflowY: 'auto', touchAction: 'pan-x',
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={spring}
        drag="y"
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0, bottom: 0.5 }}
        onDragEnd={(_: any, info: PanInfo) => {
          if (info.offset.y > 80 || info.velocity.y > 400) onClose()
        }}
      >
        {/* Sticky top */}
        <div style={{ position: 'sticky', top: 0, background: '#141414', zIndex: 1 }}>
          {/* Handle */}
          <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.13)', borderRadius: 2, margin: '12px auto 0' }} />

          {/* Header */}
          <div className="flex items-center justify-between" style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="font-mono uppercase" style={{ fontSize: '0.62rem', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)' }}>
              {isEdit ? singularLabel : `New ${singularLabel}`}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {isEdit && TriggerIcon}
              <button className="cursor-pointer" style={{
                fontSize: 14, fontWeight: 600, padding: '6px 18px', borderRadius: 20,
                background: colors.bgLight, border: `1px solid ${colors.border}`, color: colors.base,
              }}
                onClick={handleSubmit}>
                {isEdit ? 'Done' : 'Save'}
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Edit mode: avatar header row */}
          {isEdit && entity && (
            <div className="flex items-center" style={{ gap: 16, marginBottom: 4 }}>
              {entity.imageUrl ? (
                <img src={entity.imageUrl} alt={entity.name} style={{
                  width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
                  border: `1.5px solid ${colors.border}`,
                }} />
              ) : (
                <div className="flex items-center justify-center flex-shrink-0" style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: colors.bg, border: `1.5px solid ${colors.border}`,
                  color: colors.base, fontSize: 22, fontWeight: 700,
                }}>
                  {getInitials(entity.name)}
                </div>
              )}
              <div>
                <div style={{ fontSize: 20, fontWeight: 600, color: '#fff', lineHeight: 1.1 }}>{entity.name}</div>
                <div className="font-mono uppercase" style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.28)', letterSpacing: '0.1em', marginTop: 4 }}>
                  {singularLabel}
                </div>
              </div>
            </div>
          )}

          {/* Create mode: image upload circle */}
          {!isEdit && (
            <div className="flex items-center justify-center cursor-pointer" style={{
              width: 76, height: 76, borderRadius: '50%', margin: '0 auto 4px',
              border: '1.5px dashed rgba(255,255,255,0.15)',
              display: 'flex', flexDirection: 'column', gap: 4,
              color: 'rgba(255,255,255,0.22)',
            }}>
              <span style={{ fontSize: 20, lineHeight: 1 }}>+</span>
              <span className="font-mono" style={{ fontSize: '0.62rem', letterSpacing: '0.06em' }}>Photo</span>
            </div>
          )}

          {/* Name field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label className="font-mono uppercase" style={{ fontSize: '0.62rem', letterSpacing: '0.13em', color: 'rgba(255,255,255,0.28)' }}>Name</label>
            <input ref={nameRef} value={name} onChange={e => setName(e.target.value)}
              placeholder={`${singularLabel} name`}
              className="outline-none"
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10, padding: '12px 14px', fontSize: 15, color: '#fff', width: '100%',
              }}
              onFocus={e => (e.target.style.borderColor = colors.border)}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
            />
          </div>

          {/* Notes/Description field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label className="font-mono uppercase" style={{ fontSize: '0.62rem', letterSpacing: '0.13em', color: 'rgba(255,255,255,0.28)' }}>Notes</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Description, notes..."
              className="outline-none resize-none"
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10, padding: '12px 14px', fontSize: 15, color: '#fff', width: '100%',
                minHeight: 90, lineHeight: 1.55,
              }}
              onFocus={e => (e.target.style.borderColor = colors.border)}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
            />
          </div>

          {/* Reference image upload row (edit mode) */}
          {isEdit && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label className="font-mono uppercase" style={{ fontSize: '0.62rem', letterSpacing: '0.13em', color: 'rgba(255,255,255,0.28)' }}>Reference Image</label>
              <div className="flex items-center cursor-pointer" style={{
                background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)',
                borderRadius: 10, padding: 14, gap: 12, color: 'rgba(255,255,255,0.22)',
              }}>
                <span style={{ fontSize: 18 }}>+</span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Add reference photo</span>
              </div>
            </div>
          )}
        </div>

        {isEdit && PreviewRow}
        {isEdit && MessageZone}
        {StartSheetOverlay}
      </motion.div>
    </>
  )
}
