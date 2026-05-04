'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { EMPTY_ARRAY } from '@/lib/empty-collections'
import { m, AnimatePresence } from 'framer-motion'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useProject, useLocations, useCreateLocation, useUpdateLocation, useDeleteLocation } from '@/lib/hooks/useOriginOne'
import { ProjectSwitcher } from '@/components/ProjectSwitcher'
import { useFabAction } from '@/lib/contexts/FabActionContext'
import { haptic } from '@/lib/utils/haptics'
import { getProjectColor, statusLabel } from '@/lib/utils/phase'
import { EmptyCTA } from '@/components/ui/EmptyState'
import { useDetailSheetThreads } from '@/components/threads/useDetailSheetThreads'
import { ThreadRowBadge, type ThreadRowBadgeEntry } from '@/components/threads/ThreadRowBadge'
import { useThreadsByEntity } from '@/components/threads/useThreadsByEntity'
import dynamic from 'next/dynamic'
import {
  ENTITY_COLORS,
  getEntityInitials,
  type EntityItem,
} from '@/app/projects/[projectId]/scenemaker/components/entity-meta'
import { getEntities, updateEntity as dbUpdateEntity } from '@/lib/db/queries'

// EntityDetailSheet ships in EntityDrawer's chunk — dynamic-import so the
// drawer's heavy dependencies don't inflate the locations page's initial
// bundle. Only loaded when the producer taps a scripted-location row.
const EntityDetailSheet = dynamic(
  () =>
    import('@/app/projects/[projectId]/scenemaker/components/EntityDrawer').then(m => ({
      default: m.EntityDetailSheet,
    })),
  { ssr: false },
)
import {
  EntityAttachmentGallery,
  EntityAttachmentCover,
} from '@/components/attachments/EntityAttachmentGallery'
import type { Location, LocationStatus } from '@/types'

// ── Constants ────────────────────────────────────────────

const STATUSES: { value: LocationStatus; label: string; color: string }[] = [
  { value: 'unscouted', label: 'Unscouted', color: '#aaaab4' },
  { value: 'scouting',  label: 'Scouting',  color: '#e8a020' },
  { value: 'in_talks',  label: 'In Talks',  color: '#6470f3' },
  { value: 'confirmed', label: 'Confirmed', color: '#00b894' },
  { value: 'passed',    label: 'Passed',    color: '#e84848' },
]

function statusColor(s: string) {
  return STATUSES.find(x => x.value === s)?.color ?? '#aaaab4'
}
function statusDisplay(s: string) {
  return STATUSES.find(x => x.value === s)?.label ?? s
}

// Maps ProjectStatus enum (development | pre_production | production | post_production | archived)
// onto the cinema-glass .ai-meta-pill phase classes (.pre / .prod / .post).
function phaseClass(status: string | undefined): 'pre' | 'prod' | 'post' | '' {
  if (status === 'pre_production' || status === 'development') return 'pre'
  if (status === 'production') return 'prod'
  if (status === 'post_production') return 'post'
  return ''
}

function hexToRgb(hex: string | null | undefined): [number, number, number] {
  const h = hex || '#444444'
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}

// ── Location Card ────────────────────────────────────────

// Per-location hero gradient palette. Gallery (#27 Locations) tints each
// loc-image-hero with a locale-specific dark gradient (Ravine Edge ochre,
// Lohm's Apartment indigo, City Plaza ember, Studio C teal). Live data has
// no scene-color metadata, so we hash the location id deterministically into
// this palette — same location always reads the same hue.
const LOC_HERO_GRADIENTS: string[] = [
  'linear-gradient(165deg, #2a1a0d 0%, #4a2a1a 35%, #1a0a05 100%)',  // ochre / earth
  'linear-gradient(165deg, #0d0a1f 0%, #1a1228 60%, #0a0815 100%)',  // indigo / dusk
  'linear-gradient(165deg, #1a0d05 0%, #3a2510 50%, #0a0500 100%)',  // ember
  'linear-gradient(165deg, #0d1a1a 0%, #1a2828 50%, #0a1212 100%)',  // teal / studio
  'linear-gradient(165deg, #1f0d1a 0%, #2c1428 60%, #100716 100%)',  // plum
  'linear-gradient(165deg, #1a1505 0%, #2c220c 50%, #100a02 100%)',  // mustard
]
function locGradientFor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return LOC_HERO_GRADIENTS[Math.abs(hash) % LOC_HERO_GRADIENTS.length]
}

function LocationCard({ loc, projectId, onTap, threadEntry }: { loc: Location; projectId: string; onTap: (l: Location) => void; threadEntry: ThreadRowBadgeEntry | undefined }) {
  return (
    // Wrapper gives the -6/-6 ThreadRowBadge an overflow-visible positioning
    // context while the card itself clips its image hero.
    <div style={{ position: 'relative' }}>
      <div
        className="loc-card"
        onClick={() => onTap(loc)}
        style={{ ['--loc-bg' as string]: locGradientFor(loc.id) } as React.CSSProperties}
      >
        {/* Title at top — sheen+extrusion treatment via .loc-title */}
        <div className="loc-title">{loc.name}</div>

        {/* 16:9 hero image with letterbox bars (cinema frame) */}
        <div className="loc-image-hero">
          <div className="letterbox-top" />
          <EntityAttachmentCover
            projectId={projectId}
            attachedToType="location"
            attachedToId={loc.id}
            size="100%"
            alt={loc.name}
          />
          <div className="letterbox-bottom" />
        </div>

        {/* Meta — address + dates row + approval pill + status pill */}
        <div className="loc-meta">
          {loc.address && <span className="loc-address">{loc.address}</span>}
          <div className="loc-dates-row">
            {loc.shootDates && <span className="loc-dates">{loc.shootDates}</span>}
            {loc.approved && <span className="loc-approval approved">Approved</span>}
            <span className={`loc-status-pill ${loc.status}`}>{statusDisplay(loc.status)}</span>
          </div>
        </div>
      </div>
      <ThreadRowBadge entry={threadEntry} />
    </div>
  )
}

// ── Create Location Sheet ────────────────────────────────

function CreateLocationSheet({ open, projectId, accent, onSave, onClose }: {
  open: boolean; projectId: string; accent: string
  onSave: (data: any) => void; onClose: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [address, setAddress] = useState('')
  const [keyContact, setKeyContact] = useState('')
  const [webLink, setWebLink] = useState('')
  const [shootDates, setShootDates] = useState('')
  const [status, setStatus] = useState<LocationStatus>('unscouted')
  const [approved, setApproved] = useState(false)
  const [notes, setNotes] = useState('')
  const [sceneTab, setSceneTab] = useState<string | null>(null)

  const canSave = name.trim().length > 0

  function handleSave() {
    if (!canSave) return
    haptic('light')
    onSave({
      projectId, name: name.trim(),
      description: description || null, address: address || null,
      keyContact: keyContact || null, webLink: webLink || null,
      shootDates: shootDates || null, status, approved,
      notes: notes || null, sceneTab,
    })
    reset()
  }

  function handleClose() { onClose(); reset() }

  function reset() {
    setName(''); setDescription(''); setAddress(''); setKeyContact('')
    setWebLink(''); setShootDates(''); setStatus('unscouted')
    setApproved(false); setNotes(''); setSceneTab(null)
  }

  function handleDragEnd(_: unknown, info: { offset: { y: number } }) {
    if (info.offset.y > 100) handleClose()
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 7, padding: '10px 12px',
    color: 'var(--fg)', fontSize: '0.82rem',
    width: '100%', outline: 'none',
  }

  const labelStyle = {
    fontSize: '0.44rem', color: 'var(--fg-mono)',
    letterSpacing: '0.08em', marginBottom: 6,
    textTransform: 'uppercase' as const,
    fontFamily: 'var(--font-geist-mono)',
    display: 'block',
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <m.div key="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose}
            style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
          />
          <m.div key="sheet"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y" dragConstraints={{ top: 0 }} dragElastic={0.1} onDragEnd={handleDragEnd}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 51,
              background: '#0e0e1a', borderRadius: '24px 24px 0 0',
              maxHeight: 'calc(100dvh - 100px)', overflowY: 'auto',
              paddingBottom: 'env(safe-area-inset-bottom, 24px)',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.55)',
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.12)', margin: '12px auto 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="sheen-title" style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '0.01em' }}>New Location</span>
              <button onClick={handleSave} style={{
                fontFamily: 'var(--font-geist-mono)', fontSize: '0.48rem', letterSpacing: '0.06em', textTransform: 'uppercase',
                padding: '5px 10px', borderRadius: 20, cursor: canSave ? 'pointer' : 'default',
                background: canSave ? `${accent}1a` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${canSave ? `${accent}40` : 'rgba(255,255,255,0.05)'}`,
                color: canSave ? accent : 'var(--fg-mono)',
              }}>Save</button>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="flex gap-3">
                <div style={{ flex: 2 }}>
                  <label style={labelStyle}>Name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Location name" autoFocus autoComplete="off" spellCheck={false} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Shoot Dates</label>
                  <input type="text" value={shootDates} onChange={e => setShootDates(e.target.value)} placeholder="Apr 11-12" autoComplete="off" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Address</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Street address or area" autoComplete="off" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description" rows={2} style={{ ...inputStyle, resize: 'none' }} />
              </div>
              <div className="flex gap-3">
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Key Contact</label>
                  <input type="text" value={keyContact} onChange={e => setKeyContact(e.target.value)} placeholder="Name / phone" autoComplete="off" style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Web Link</label>
                  <input type="text" value={webLink} onChange={e => setWebLink(e.target.value)} placeholder="URL" autoComplete="off" style={inputStyle} />
                </div>
              </div>
              {/* Status pills + inline Approved toggle */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Status</label>
                  <button onClick={() => setApproved(a => !a)} style={{
                    fontFamily: 'var(--font-geist-mono)', fontSize: '0.44rem', letterSpacing: '0.06em', textTransform: 'uppercase',
                    padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                    background: approved ? '#00b8941a' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${approved ? '#00b89438' : 'rgba(255,255,255,0.05)'}`,
                    color: approved ? '#00b894' : 'var(--fg-mono)',
                  }}>{approved ? '✓ Approved' : 'Approved'}</button>
                </div>
                <div className="flex gap-2">
                  {STATUSES.map(s => (
                    <button key={s.value} onClick={() => setStatus(s.value)} style={{
                      flex: 1, fontFamily: 'var(--font-geist-mono)', fontSize: '0.40rem', letterSpacing: '0.06em', textTransform: 'uppercase',
                      padding: '7px 4px', borderRadius: 8, cursor: 'pointer',
                      background: status === s.value ? `${s.color}1a` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${status === s.value ? `${s.color}38` : 'rgba(255,255,255,0.05)'}`,
                      color: status === s.value ? s.color : 'var(--fg-mono)',
                    }}>{s.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes" rows={2} style={{ ...inputStyle, resize: 'none' }} />
              </div>
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Detail Sheet (inline editable) ───────────────────────

function LocationDetailSheet({ loc, accent, projectId, onUpdate, onDelete, onClose }: {
  loc: Location; accent: string; projectId: string
  onUpdate: (fields: any) => void
  onDelete: () => void
  onClose: () => void
}) {
  const { TriggerIcon, PreviewRow, MessageZone, StartSheetOverlay } = useDetailSheetThreads({
    projectId,
    attachedToType: 'location',
    attachedToId: loc.id,
    subjectLabel: loc.name,
  })
  const [name, setName] = useState(loc.name)
  const [description, setDescription] = useState(loc.description ?? '')
  const [address, setAddress] = useState(loc.address ?? '')
  const [keyContact, setKeyContact] = useState(loc.keyContact ?? '')
  const [webLink, setWebLink] = useState(loc.webLink ?? '')
  const [shootDates, setShootDates] = useState(loc.shootDates ?? '')
  const [status, setStatus] = useState(loc.status)
  const [approved, setApproved] = useState(loc.approved)
  const [notes, setNotes] = useState(loc.notes ?? '')

  const sc = statusColor(status)

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 7, padding: '10px 12px',
    color: 'var(--fg)', fontSize: '0.78rem',
    width: '100%', outline: 'none',
  }

  const labelStyle = {
    fontSize: '0.44rem', color: 'var(--fg-mono)',
    letterSpacing: '0.08em', marginBottom: 6,
    textTransform: 'uppercase' as const,
    fontFamily: 'var(--font-geist-mono)',
    display: 'block',
  }

  function save(fields: any) {
    onUpdate(fields)
  }

  return (
    <div style={{ padding: '0 20px 24px' }}>
      {/* Thread trigger — pinned top-right above the hero */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        {TriggerIcon}
      </div>

      {/* Photo gallery — replaces the legacy single-imageUrl hero. Drag images
          in or tap "+ Add photos" to upload. Tile tap opens the lightbox.
          Spec: apps/back-to-one/reference/back-to-one-entity-attachments.html */}
      <EntityAttachmentGallery
        projectId={projectId}
        attachedToType="location"
        attachedToId={loc.id}
        variant="sheet"
      />

      {/* Sheen detail name + status eyebrow — DESIGN_LANGUAGE.md detail-name */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 6, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          onBlur={() => { if (name !== loc.name) save({ name }) }}
          className="sheen-title"
          style={{ flex: 1, fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.02em', background: 'transparent', border: 'none', padding: 0, outline: 'none' }}
        />
        <span className="font-mono uppercase flex-shrink-0" style={{
          fontSize: '0.40rem', letterSpacing: '0.08em',
          padding: '3px 8px', borderRadius: 10,
          background: `${sc}1a`, border: `1px solid ${sc}38`, color: sc,
        }}>{statusDisplay(status)}</span>
      </div>

      {/* Status pills */}
      <div style={{ marginTop: 14, marginBottom: 14 }}>
        <label style={labelStyle}>Status</label>
        <div className="flex gap-2">
          {STATUSES.map(s => (
            <button key={s.value} onClick={() => { setStatus(s.value); save({ status: s.value }) }} style={{
              flex: 1, fontFamily: 'var(--font-geist-mono)', fontSize: '0.40rem', letterSpacing: '0.06em', textTransform: 'uppercase',
              padding: '7px 4px', borderRadius: 8, cursor: 'pointer',
              background: status === s.value ? `${s.color}1a` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${status === s.value ? `${s.color}38` : 'rgba(255,255,255,0.05)'}`,
              color: status === s.value ? s.color : 'var(--fg-mono)',
            }}>{s.label}</button>
          ))}
        </div>
      </div>

      {/* Approved / Option toggle */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Approval</label>
        <div className="flex gap-2">
          <button onClick={() => { setApproved(false); save({ approved: false }) }} style={{
            flex: 1, fontFamily: 'var(--font-geist-mono)', fontSize: '0.44rem', letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '8px 4px', borderRadius: 8, cursor: 'pointer',
            background: !approved ? '#e8a0201a' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${!approved ? '#e8a02038' : 'rgba(255,255,255,0.05)'}`,
            color: !approved ? '#e8a020' : 'var(--fg-mono)',
          }}>Option</button>
          <button onClick={() => { setApproved(true); save({ approved: true }) }} style={{
            flex: 1, fontFamily: 'var(--font-geist-mono)', fontSize: '0.44rem', letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '8px 4px', borderRadius: 8, cursor: 'pointer',
            background: approved ? '#00b8941a' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${approved ? '#00b89438' : 'rgba(255,255,255,0.05)'}`,
            color: approved ? '#00b894' : 'var(--fg-mono)',
          }}>Approved</button>
        </div>
      </div>

      {/* Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={labelStyle}>Address</label>
          <input type="text" value={address} onChange={e => setAddress(e.target.value)}
            onBlur={() => save({ address: address || null })}
            placeholder="Street address or area" autoComplete="off" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            onBlur={() => save({ description: description || null })}
            placeholder="Brief description" rows={2} style={{ ...inputStyle, resize: 'none' }} />
        </div>
        <div className="flex gap-3">
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Key Contact</label>
            <input type="text" value={keyContact} onChange={e => setKeyContact(e.target.value)}
              onBlur={() => save({ keyContact: keyContact || null })}
              placeholder="Name / phone" autoComplete="off" style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Web Link</label>
            <input type="text" value={webLink} onChange={e => setWebLink(e.target.value)}
              onBlur={() => save({ webLink: webLink || null })}
              placeholder="URL" autoComplete="off" style={inputStyle} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Shoot Dates</label>
          <input type="text" value={shootDates} onChange={e => setShootDates(e.target.value)}
            onBlur={() => save({ shootDates: shootDates || null })}
            placeholder="e.g. Apr 11-12" autoComplete="off" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            onBlur={() => save({ notes: notes || null })}
            placeholder="Additional notes" rows={3} style={{ ...inputStyle, resize: 'none' }} />
        </div>
      </div>

      {PreviewRow}
      {MessageZone}

      {/* Delete */}
      <button onClick={() => { haptic('warning'); onDelete(); onClose() }} style={{
        marginTop: 20, width: '100%', padding: '10px', borderRadius: 8,
        background: 'rgba(232,72,72,0.10)', border: '1px solid rgba(232,72,72,0.22)',
        color: '#e84848', fontFamily: 'var(--font-geist-mono)', fontSize: '0.44rem',
        letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
      }}>Delete Location</button>

      {StartSheetOverlay}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────

export default function LocationsPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const { data: project } = useProject(projectId)
  const accent = project?.color || getProjectColor(projectId)
  const { data: locations, isLoading } = useLocations(projectId)
  const createLoc = useCreateLocation(projectId)
  const updateLoc = useUpdateLocation(projectId)
  const deleteLoc = useDeleteLocation(projectId)
  const qc = useQueryClient()
  // Single thread bucket for attachedToType='location'. Production-side keys
  // by Location.id; creative-side (the Scripted Locations dropdown below) keys
  // by Entity.id. Same bucket, different ID spaces — no collision since the
  // tables are separate. Streams stay separate per DECISIONS.md
  // "Entity-vs-production-record threading rule".
  const threadByLocationId = useThreadsByEntity(projectId, 'location')

  // Script-side Entity(type='location') rows for the Scripted Locations
  // dropdown — creative-side bridge that mirrors Casting's Characters dropdown.
  // Cache key matches EntityDrawer (`['entities', projectId, 'locations']`) so
  // edits made here invalidate the drawer's view too.
  const { data: locationEntities } = useQuery({
    queryKey: ['entities', projectId, 'locations'],
    queryFn: () => getEntities(projectId, 'location'),
  })
  const scriptLocations: EntityItem[] = useMemo(() => {
    return (locationEntities ?? [])
      .map((e: any) => ({
        id: e.id,
        name: e.name,
        description: e.description ?? null,
        imageUrl: e.metadata?.imageUrl ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [locationEntities])

  const [selected, setSelected] = useState<Location | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  // Register the + handler with the global ActionBar.
  useFabAction({ onPress: () => { haptic('light'); setShowCreate(true) } })
  const [activeTab, setActiveTab] = useState('All')
  const [newTabName, setNewTabName] = useState('')
  const [showAddTab, setShowAddTab] = useState(false)
  const tabInputRef = useRef<HTMLInputElement>(null)

  // Scripted Locations dropdown state — mirrors Casting's Characters bridge.
  const [scriptMenuOpen, setScriptMenuOpen] = useState(false)
  const [scriptDetail, setScriptDetail] = useState<EntityItem | null>(null)

  useEffect(() => {
    if (!scriptMenuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setScriptMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [scriptMenuOpen])

  const handleScriptSave = useCallback(async (name: string, description: string, entityId?: string) => {
    if (!entityId) { setScriptDetail(null); return }
    try {
      await dbUpdateEntity(entityId, { name, description })
      qc.invalidateQueries({ queryKey: ['entities', projectId, 'locations'] })
      qc.invalidateQueries({ queryKey: ['locations', projectId] })
    } catch (err) {
      console.error('Failed to save scripted location from Locations:', err)
    }
    setScriptDetail(null)
  }, [qc, projectId])

  const allLocations = (locations ?? EMPTY_ARRAY) as Location[]

  // Per-tab counts in one pass, plus the derived tab list. Replaces the
  // per-pill `allLocations.filter(...)` walk.
  const countsByTab = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of allLocations) {
      if (!l.sceneTab) continue
      m.set(l.sceneTab, (m.get(l.sceneTab) ?? 0) + 1)
    }
    return m
  }, [allLocations])
  const tabs = useMemo(() => ['All', ...Array.from(countsByTab.keys())], [countsByTab])

  // Filter by active tab
  const filtered = activeTab === 'All'
    ? allLocations
    : allLocations.filter(l => l.sceneTab === activeTab)

  function handleAddTab() {
    if (!newTabName.trim()) return
    setActiveTab(newTabName.trim())
    setNewTabName('')
    setShowAddTab(false)
  }

  // Cinema Glass: project accent triplet drives the sheen-title gradient and
  // glass-tile tint. +20/+30/+16 lights the spec's accent-glow apex without a
  // separate token export.
  const [pr, pg, pb] = hexToRgb(accent)
  const glowR = Math.min(255, pr + 20)
  const glowG = Math.min(255, pg + 30)
  const glowB = Math.min(255, pb + 16)

  const phase = phaseClass(project?.status)

  return (
    <div
      className="screen"
      style={{
        ['--tile-rgb' as string]: `${pr}, ${pg}, ${pb}`,
        ['--accent-rgb' as string]: `${pr}, ${pg}, ${pb}`,
        ['--accent-glow-rgb' as string]: `${glowR}, ${glowG}, ${glowB}`,
      } as React.CSSProperties}
    >
      {/* Cinema Glass page header — sheen Locations title + project meta + phase pill.
          Inlines the .ai-header pattern (DESIGN_LANGUAGE.md page header) so the title
          can carry the .sheen-title treatment. PageHeader is a shared component reskin
          deferred to its own PR. */}
      <div
        className="hub-topbar relative flex flex-col items-center justify-end px-5 flex-shrink-0 sticky top-0 z-20"
        style={{
          minHeight: 100,
          paddingTop: 'calc(var(--safe-top) + 10px)',
          paddingBottom: 12,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          overflow: 'hidden',
        }}
      >
        <div className="flex flex-col items-center text-center" style={{ maxWidth: '70%', position: 'relative' }}>
          <h1 className="sheen-title leading-none truncate" style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
            Locations
          </h1>
          {project && (
            <div className="flex flex-col items-center gap-1.5" style={{ marginTop: 4 }}>
              <ProjectSwitcher projectId={projectId} projectName={project.name} accentColor={accent} variant="meta" />
              {phase && (
                <span className={`ai-meta-pill ${phase}`}>
                  <span className="phase-dot" />
                  {statusLabel(project.status)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Count row + Scripted Locations dropdown — creative-side bridge into
          the shared Entity sheet (same sheet as Scenemaker EntityDrawer).
          Threads started from here land on the Entity and stay separate from
          the per-card production threads on the Locations list below.
          Mirrors the Characters dropdown on the Casting page. */}
      {(allLocations.length > 0 || scriptLocations.length > 0) && (
        <div style={{ padding: '6px 20px 2px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <span className="font-mono" style={{ fontSize: '0.52rem', color: 'var(--fg-mono)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {allLocations.length} booked · {scriptLocations.length} scripted
          </span>
          <button
            onClick={() => { haptic('light'); setScriptMenuOpen(v => !v) }}
            className="font-mono uppercase"
            style={{
              fontSize: '0.52rem', letterSpacing: '0.12em', color: accent,
              background: `${accent}1a`,
              border: `1px solid ${accent}55`,
              borderRadius: 999,
              padding: '4px 10px',
              cursor: 'pointer',
            }}
            aria-haspopup="menu"
            aria-expanded={scriptMenuOpen}
          >
            Scripted ▾
          </button>
          {scriptMenuOpen && (
            <>
              <div
                onClick={() => setScriptMenuOpen(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 30 }}
              />
              <div
                role="menu"
                style={{
                  position: 'absolute', top: '100%', right: 20, zIndex: 31,
                  marginTop: 4, minWidth: 200, maxHeight: 320, overflowY: 'auto',
                  background: 'rgba(14,14,26,0.96)',
                  backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
                  padding: '6px 0',
                  boxShadow: '0 18px 40px rgba(0,0,0,0.55)',
                }}
              >
                {scriptLocations.length === 0 ? (
                  <div className="font-mono" style={{ padding: '8px 14px', fontSize: 10, color: 'var(--fg-mono)' }}>
                    No scripted locations yet
                  </div>
                ) : scriptLocations.map(s => (
                  <button
                    key={s.id}
                    role="menuitem"
                    onClick={() => {
                      haptic('light')
                      setScriptMenuOpen(false)
                      setScriptDetail(s)
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '8px 14px', background: 'transparent', border: 'none',
                      cursor: 'pointer', textAlign: 'left', color: 'var(--fg)',
                      fontSize: 13, fontFamily: "'Geist', sans-serif",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                  >
                    <span style={{ position: 'relative', flexShrink: 0 }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: ENTITY_COLORS.locations.bg,
                        border: `1px solid ${ENTITY_COLORS.locations.border}`,
                        color: ENTITY_COLORS.locations.base,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 700,
                      }}>{getEntityInitials(s.name)}</span>
                      <ThreadRowBadge entry={threadByLocationId.get(s.id)} />
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', overflowX: 'auto',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        WebkitOverflowScrolling: 'touch',
      }}
        className="no-scrollbar"
      >
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            fontFamily: 'var(--font-geist-mono)', fontSize: '0.46rem',
            letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
            whiteSpace: 'nowrap', flexShrink: 0,
            background: activeTab === tab ? `${accent}1f` : 'rgba(255,255,255,0.04)',
            border: `1px solid ${activeTab === tab ? `${accent}55` : 'rgba(255,255,255,0.05)'}`,
            color: activeTab === tab ? accent : 'var(--fg-mono)',
          }}>{tab}{tab !== 'All' ? ` (${countsByTab.get(tab) ?? 0})` : ''}</button>
        ))}
        {/* Add Scene tab */}
        {showAddTab ? (
          <div className="flex items-center gap-2 flex-shrink-0">
            <input ref={tabInputRef} type="text" value={newTabName}
              onChange={e => setNewTabName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddTab(); if (e.key === 'Escape') setShowAddTab(false) }}
              autoFocus placeholder="Scene name"
              style={{
                fontFamily: 'var(--font-geist-mono)', fontSize: '0.44rem',
                width: 80, padding: '5px 8px', borderRadius: 8,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--fg)', outline: 'none',
              }}
            />
            <button onClick={handleAddTab} style={{
              fontFamily: 'var(--font-geist-mono)', fontSize: '0.38rem',
              color: accent, cursor: 'pointer', background: 'none', border: 'none',
            }}>Add</button>
          </div>
        ) : (
          <button onClick={() => setShowAddTab(true)} style={{
            fontFamily: 'var(--font-geist-mono)', fontSize: '0.42rem',
            letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '5px 10px', borderRadius: 20, cursor: 'pointer',
            whiteSpace: 'nowrap', flexShrink: 0,
            background: 'rgba(255,255,255,0.02)',
            border: '1px dashed rgba(255,255,255,0.1)',
            color: 'var(--fg-mono)',
          }}>+ Scene</button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar" style={{ WebkitOverflowScrolling: 'touch', padding: '12px 16px 120px' }}>
        {isLoading ? (
          <div className="loc-grid">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="loc-card" style={{ padding: 0 }}>
                <div className="sk-block" style={{ width: '60%', height: 11, margin: '10px auto 8px', borderRadius: 4 }} />
                <div className="sk-block" style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 0 }} />
                <div style={{ padding: '8px 8px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <div className="sk-block" style={{ width: '70%', height: 7 }} />
                  <div className="sk-block" style={{ width: '50%', height: 8 }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyCTA
            icon="📍"
            headline="Pin your locations."
            sub={activeTab === 'All' ? 'Where are you shooting?' : `No locations in "${activeTab}" yet.`}
            addLabel="+ Add location"
            onAdd={() => { haptic('light'); setShowCreate(true) }}
          />
        ) : (
          <div className="loc-grid">
            {filtered.map(loc => (
              <LocationCard key={loc.id} loc={loc} projectId={projectId} onTap={setSelected} threadEntry={threadByLocationId.get(loc.id)} />
            ))}
          </div>
        )}
      </div>

      {/* + handler registered above via useFabAction. ActionBar is mounted globally. */}

      {/* Create Sheet */}
      <CreateLocationSheet
        open={showCreate}
        projectId={projectId}
        accent={accent}
        onSave={(data) => {
          createLoc.mutate({ ...data, sceneTab: activeTab === 'All' ? null : activeTab })
          setShowCreate(false)
        }}
        onClose={() => setShowCreate(false)}
      />

      {/* Detail Sheet */}
      <AnimatePresence>
        {selected && (
          <>
            <m.div key="detail-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
              style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
            />
            <m.div key="detail-sheet"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              drag="y" dragConstraints={{ top: 0 }} dragElastic={0.1}
              onDragEnd={(_, info) => { if (info.offset.y > 100) setSelected(null) }}
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 51,
                background: '#0e0e1a', borderRadius: '24px 24px 0 0',
                maxHeight: 'calc(100dvh - 60px)', overflowY: 'auto',
                paddingBottom: 'env(safe-area-inset-bottom, 24px)',
                boxShadow: '0 -8px 32px rgba(0,0,0,0.55)',
              }}
            >
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.12)', margin: '12px auto 16px' }} />
              <LocationDetailSheet
                loc={selected}
                accent={accent}
                projectId={projectId}
                onUpdate={(fields) => updateLoc.mutate({ id: selected.id, fields })}
                onDelete={() => deleteLoc.mutate(selected.id)}
                onClose={() => setSelected(null)}
              />
            </m.div>
          </>
        )}
      </AnimatePresence>

      {/* Scripted Locations bridge — shared EntityDetailSheet, same surface
          as Scenemaker EntityDrawer. Threads here attach as
          ('location', entity.id), keeping creative discussion separate from
          the per-card production threads on each Location row. */}
      <AnimatePresence>
        {scriptDetail && (
          <EntityDetailSheet
            key="scripted-loc-bridge-sheet"
            type="locations"
            projectId={projectId}
            colors={ENTITY_COLORS.locations}
            label="Locations"
            entity={scriptDetail}
            onSave={handleScriptSave}
            onClose={() => setScriptDetail(null)}
            getInitials={getEntityInitials}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
