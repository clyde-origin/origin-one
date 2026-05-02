'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import {
  useProject,
  useCastRoles,
  useCreateCastRole,
  useUpdateCastEntity,
  useUpdateTalent,
  useUploadTalentImage,
  useAssignTalent,
  useDeleteCastRole,
} from '@/lib/hooks/useOriginOne'
import { ProjectSwitcher } from '@/components/ProjectSwitcher'
import { StorageImage } from '@/components/ui/StorageImage'
import { useFabAction } from '@/lib/contexts/FabActionContext'
import { haptic } from '@/lib/utils/haptics'
import { getProjectColor, statusLabel } from '@/lib/utils/phase'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { useDetailSheetThreads } from '@/components/threads/useDetailSheetThreads'
import { ThreadRowBadge, type ThreadRowBadgeEntry } from '@/components/threads/ThreadRowBadge'
import { useThreadsByEntity } from '@/components/threads/useThreadsByEntity'
import {
  EntityDetailSheet,
  ENTITY_COLORS,
  getEntityInitials,
  type EntityItem,
} from '@/app/projects/[projectId]/scenemaker/components/EntityDrawer'
import { updateEntity as dbUpdateEntity } from '@/lib/db/queries'
import { useQueryClient } from '@tanstack/react-query'

// ── Types ──────────────────────────────────────────────────

interface CastRoleData {
  id: string
  projectId: string
  role: string
  roleDesc: string
  section: string
  scenes: string[]
  roleNotes: string
  assignmentId: string | null
  cast: boolean
  talent: {
    id: string
    name: string
    initials: string
    imageUrl: string | null
    agency: string
    email: string
    phone: string
    repName: string
    repEmail: string
    repPhone: string
    dietary: string
    shootDates: string[]
    notes: string
  } | null
  createdAt: string
  updatedAt: string
}

// Maps ProjectStatus enum onto cinema-glass .ai-meta-pill classes.
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

// Scene-color palette per character. The gallery (#29 CASTING) tints each
// cast-card with a `--scene-rgb` derived from the character's signature scene
// (Eli amber, Mara rose, etc.). Live data has no scene-color metadata yet, so
// we hash the role.id deterministically into this palette — same role always
// gets the same color across reloads, characters within the same project read
// as visually distinct.
const SCENE_PALETTE: [number, number, number][] = [
  [240, 128, 48],   // amber (Eli)
  [232, 80, 122],   // rose (Mara)
  [245, 165, 50],   // ochre (The Voice)
  [155, 110, 243],  // violet (Eli's Mother)
  [80, 216, 152],   // mint (Park Ranger)
  [100, 112, 243],  // indigo (Hiker)
  [240, 112, 80],   // coral (Driver)
  [168, 212, 40],   // lime (Conv. Clerk)
]
const UNCAST_RGB: [number, number, number] = [122, 122, 130] // gray

function sceneRgbFor(role: CastRoleData): [number, number, number] {
  if (!role.cast) return UNCAST_RGB
  let hash = 0
  for (let i = 0; i < role.id.length; i++) hash = role.id.charCodeAt(i) + ((hash << 5) - hash)
  return SCENE_PALETTE[Math.abs(hash) % SCENE_PALETTE.length]
}

// Filter-pill label derivation: maps the live `role.section` string
// (Principal Cast / Talent / Background) into the gallery's pill labels
// (Leads / Supporting / Day Players). Falls back to the literal section name
// when no mapping applies. Sections without explicit mapping render under
// their live name.
function pillLabelFor(section: string): string {
  if (section === 'Principal Cast' || section === 'Principal Talent') return 'Leads'
  if (section === 'Talent') return 'Supporting'
  if (section === 'Background') return 'Day Players'
  return section
}

// ── Cast Card ──────────────────────────────────────────────

function CastCard({ role, onTap, threadEntry }: { role: CastRoleData; onTap: () => void; threadEntry: ThreadRowBadgeEntry | undefined }) {
  const isCast = role.cast && !!role.talent
  const [r, g, b] = sceneRgbFor(role)
  const sceneRgbStr = `${r}, ${g}, ${b}`
  // Role pill copy: Leads → "Lead", Supporting → "Supporting", Day Players →
  // "Day Player", Uncast → "Uncast". Singularises pill copy per gallery.
  const pillFromSection = pillLabelFor(role.section || 'Principal Cast')
  const rolePillLabel = !isCast
    ? 'Uncast'
    : pillFromSection === 'Leads'
      ? 'Lead'
      : pillFromSection === 'Day Players'
        ? 'Day Player'
        : pillFromSection

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={onTap}
        className="cursor-pointer active:opacity-90 transition-opacity w-full"
        style={{
          // .cast-card per spec: subtle hairline + soft shadow, NOT the
          // project-tinted glass-tile (cards stand apart from each other
          // by their per-character scene-rgb).
          position: 'relative',
          display: 'flex', flexDirection: 'column', gap: 6,
          padding: 8, borderRadius: 12,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 14px -8px rgba(0,0,0,0.55)',
          textAlign: 'center',
          color: 'inherit',
          font: 'inherit',
          ...(isCast ? {} : { filter: 'saturate(0.6)', borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.14)' }),
        }}
      >
        {/* Hero color block — 4:5 portrait, scene-color gradient, letterbox
            bars top/bottom (cinema identity). Role pill sits absolute
            top-right INSIDE the hero per gallery. */}
        <div style={{
          position: 'relative',
          aspectRatio: '4 / 5',
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid rgba(0,0,0,0.45)',
          background: isCast
            ? `linear-gradient(165deg, rgba(${sceneRgbStr},0.70) 0%, rgba(${sceneRgbStr},0.32) 50%, rgba(8,8,14,0.92) 100%)`
            : 'linear-gradient(165deg, #14141a 0%, #1c1c24 50%, #0a0a10 100%)',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'rgba(0,0,0,0.6)', zIndex: 2 }} />
          {isCast && role.talent?.imageUrl ? (
            <StorageImage
              url={role.talent.imageUrl}
              alt={role.talent.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(ev) => { (ev.target as HTMLImageElement).style.display = 'none' }}
            />
          ) : isCast ? (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 700, color: `rgb(${sceneRgbStr})`,
              fontFamily: "'Geist Mono', monospace",
            }}>{role.talent?.initials}</div>
          ) : (
            // Uncast plus marker — matches .cast-card-uncast-plus in spec.
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                border: '1px dashed rgba(255,255,255,0.30)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.40)',
                fontFamily: "'Geist Mono', monospace",
                fontSize: '0.90rem', fontWeight: 300, lineHeight: 1,
              }}>+</div>
            </div>
          )}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'rgba(0,0,0,0.6)', zIndex: 2 }} />

          {/* Role pill — absolute top-right INSIDE the hero. Tinted with
              the character's scene rgb per gallery (LEAD amber, SUPPORTING
              in character color, DAY PLAYER blue, UNCAST gray). */}
          <span className="font-mono uppercase" style={{
            position: 'absolute', top: 12, right: 12, zIndex: 4,
            padding: '2px 6px', borderRadius: 4,
            fontSize: '0.36rem', letterSpacing: '0.10em',
            color: `rgb(${sceneRgbStr})`,
            background: `rgba(${sceneRgbStr}, 0.12)`,
            border: `1px solid rgba(${sceneRgbStr}, 0.32)`,
          }}>{rolePillLabel}</span>
        </div>

        {/* Character name — large semi-bold, scene-color sheen gradient, uppercase. */}
        <div
          className="truncate"
          style={{
            fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.02em',
            textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.05,
            background: `linear-gradient(180deg,
              rgba(${sceneRgbStr}, 1) 0%,
              rgba(${sceneRgbStr}, 0.92) 55%,
              rgba(${sceneRgbStr}, 0.72) 100%)`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
            filter: `drop-shadow(0 1px 0 rgba(0,0,0,0.45)) drop-shadow(0 0 6px rgba(${sceneRgbStr}, 0.22))`,
            padding: '0 2px',
          }}
        >{role.role}</div>

        {/* Actor name — mono caps in --fg-mono. */}
        <div
          className="font-mono uppercase truncate"
          style={{
            fontSize: '0.42rem', letterSpacing: '0.10em',
            color: 'var(--fg-mono)', textAlign: 'center',
          }}
        >{isCast ? role.talent?.name : 'Uncast'}</div>
      </button>
      <ThreadRowBadge entry={threadEntry} />
    </div>
  )
}

// ── Collapsible ────────────────────────────────────────────

function Collapsible({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 2 }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0 10px', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => { haptic('light'); setOpen(o => !o) }}
      >
        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--fg-mono)' }}>
          {title}
        </span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', transition: 'transform 0.2s ease', transform: open ? 'rotate(90deg)' : 'none', lineHeight: 1 }}>
          ›
        </span>
      </div>
      <div style={{ overflow: 'hidden', maxHeight: open ? 400 : 0, transition: 'max-height 0.25s ease' }}>
        {children}
      </div>
    </div>
  )
}

// ── Info Row (editable) ────────────────────────────────────

function InfoRow({
  label, value, placeholder, onSave, type = 'text', alignStart,
}: {
  label: string; value: string; placeholder?: string; onSave: (v: string) => void; type?: string; alignStart?: boolean
}) {
  const [v, setV] = useState(value)
  return (
    <div style={{ display: 'flex', alignItems: alignStart ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-mono)', flexShrink: 0, minWidth: 72, paddingTop: alignStart ? 3 : 0 }}>
        {label}
      </span>
      <input
        type={type}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { if (v !== value) onSave(v) }}
        placeholder={placeholder}
        style={{
          fontSize: 13, color: 'var(--fg)', background: 'transparent',
          border: 'none', outline: 'none', textAlign: 'right', flex: 1,
          fontFamily: "'Geist', sans-serif",
          borderBottom: '1px solid transparent', paddingBottom: 1,
        }}
      />
    </div>
  )
}

// ── Shoot Days Editor ──────────────────────────────────────

function ShootDaysEditor({ dates, onSave }: { dates: string[]; onSave: (d: string[]) => void }) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const removeDay = (idx: number) => {
    const next = dates.filter((_, i) => i !== idx)
    onSave(next)
  }

  const addDay = () => {
    const v = inputRef.current?.value?.trim()
    if (!v) return
    onSave([...dates, v])
    if (inputRef.current) inputRef.current.value = ''
    setEditing(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '8px 0 6px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-mono)', flexShrink: 0, minWidth: 72, paddingTop: 3 }}>
        Shoot Days
      </span>
      <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
        {dates.map((d, i) => (
          <span
            key={`${d}-${i}`}
            onClick={() => removeDay(i)}
            style={{
              fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.07em',
              textTransform: 'uppercase', padding: '4px 9px', borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
              color: 'var(--fg-mono)', cursor: 'pointer',
            }}>
            {d} ×
          </span>
        ))}
        {editing ? (
          <input
            ref={inputRef}
            autoFocus
            placeholder="Day 1"
            onBlur={addDay}
            onKeyDown={(e) => { if (e.key === 'Enter') addDay() }}
            style={{
              fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.07em',
              textTransform: 'uppercase', padding: '4px 9px', borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.06)',
              color: 'var(--fg)', outline: 'none', width: 70,
            }}
          />
        ) : (
          <span
            onClick={() => setEditing(true)}
            style={{
              fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.07em',
              textTransform: 'uppercase', padding: '4px 9px', borderRadius: 20,
              border: '1px dashed rgba(255,255,255,0.15)', color: 'var(--fg-mono)',
              cursor: 'pointer',
            }}>
            + Day
          </span>
        )}
      </div>
    </div>
  )
}

// ── Detail Sheet ───────────────────────────────────────────

function CastDetailSheet({
  role, accent, projectId, onClose, onUpdateEntity, onUpdateTalent, onAssignTalent, onDelete,
}: {
  role: CastRoleData | null
  accent: string
  projectId: string
  onClose: () => void
  onUpdateEntity: (id: string, updates: any) => void
  onUpdateTalent: (id: string, fields: any) => void
  onAssignTalent: (entityId: string, actorName: string) => void
  onDelete: (id: string) => void
}) {
  const roleDescRef = useRef<HTMLTextAreaElement>(null)
  const actorNameRef = useRef<HTMLInputElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const newActorRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const uploadTalentImage = useUploadTalentImage(projectId)
  const [imageError, setImageError] = useState<string | null>(null)

  const onPickImage = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !role?.talent) return
    setImageError(null)
    haptic('light')
    uploadTalentImage.mutate(
      { file, talentId: role.talent.id },
      { onError: (err: any) => setImageError(err?.message ?? 'Upload failed') },
    )
  }, [role?.talent, uploadTalentImage])

  const { TriggerIcon, PreviewRow, MessageZone, StartSheetOverlay } = useDetailSheetThreads({
    projectId,
    // Cast = real human on this production. Thread attaches to the Talent row
    // (stable cast id). Keeps cast/logistics threads separate from the
    // creative-side 'character' threads opened via Scenemaker EntityDrawer.
    // Uncast roles (role.talent === null) render the trigger in disabled
    // state — no cast thread exists until a person is attached.
    attachedToType: 'cast',
    attachedToId: role?.talent?.id ?? null,
    subjectLabel: role ? (role.talent?.name ?? role.role) : '',
  })

  const saveEntity = useCallback((patch: any) => {
    if (!role) return
    onUpdateEntity(role.id, patch)
  }, [role, onUpdateEntity])

  const saveTalent = useCallback((patch: any) => {
    if (role?.talent) onUpdateTalent(role.talent.id, patch)
  }, [role?.talent, onUpdateTalent])

  if (!role) return null

  const sectionLabel = role.section || 'Principal Cast'
  const [r, g, b] = sceneRgbFor(role)
  const sceneRgbStr = `${r}, ${g}, ${b}`
  const pillFromSection = pillLabelFor(sectionLabel)
  const rolePillLabel = !role.cast
    ? 'Uncast'
    : pillFromSection === 'Leads'
      ? 'Lead'
      : pillFromSection === 'Day Players'
        ? 'Day Player'
        : pillFromSection

  return (
    <>
      <SheetHeader
        title={role.cast ? 'Cast' : 'Role'}
        onClose={onClose}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {TriggerIcon}
            <button onClick={onClose} style={{ fontSize: 14, fontWeight: 600, color: accent, background: 'none', border: 'none', cursor: 'pointer' }}>Done</button>
          </div>
        }
      />

      {/* V2: Hero color block — full-width 4:5 portrait, scene-color
          gradient, letterbox bars top/bottom (cinema identity). Photo, when
          present, crops into the rounded hero. */}
      <div style={{ padding: '8px 20px 0' }}>
        <div style={{
          position: 'relative',
          aspectRatio: '4 / 5',
          maxHeight: 280,
          borderRadius: 16,
          overflow: 'hidden',
          border: '1px solid var(--border)',
          background: role.cast
            ? `linear-gradient(165deg, rgba(${sceneRgbStr},0.70) 0%, rgba(${sceneRgbStr},0.32) 50%, rgba(8,8,14,0.92) 100%)`
            : 'linear-gradient(165deg, #14141a 0%, #1c1c24 50%, #0a0a10 100%)',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'rgba(0,0,0,0.85)', zIndex: 2 }} />
          {role.cast && role.talent?.imageUrl ? (
            <StorageImage
              url={role.talent.imageUrl}
              alt={role.talent.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(ev) => { (ev.target as HTMLImageElement).style.display = 'none' }}
            />
          ) : null}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 6, background: 'rgba(0,0,0,0.85)', zIndex: 2 }} />
        </div>
      </div>

      {/* V2: Centered detail-heading beneath hero — sheen character name in
          project accent, mono-caps actor in --fg-mono, scene-tinted role pill. */}
      <div className="flex flex-col items-center" style={{ padding: '12px 20px 14px', gap: 4 }}>
        <input
          defaultValue={role.role}
          placeholder="Role name"
          onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== role.role) saveEntity({ name: v }) }}
          className="sheen-title"
          style={{
            fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.02em',
            textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.05,
            width: '100%', background: 'transparent', border: 'none', outline: 'none',
            fontFamily: "'Geist', sans-serif",
          }}
        />
        <span className="font-mono uppercase" style={{
          fontSize: '0.42rem', letterSpacing: '0.10em',
          color: 'var(--fg-mono)', textAlign: 'center',
        }}>{role.cast && role.talent ? role.talent.name : 'Uncast'}</span>
        <div className="flex items-center justify-center" style={{ gap: 6, marginTop: 2 }}>
          <span className="font-mono uppercase" style={{
            padding: '2px 8px', borderRadius: 20,
            fontSize: '0.40rem', letterSpacing: '0.10em',
            color: `rgb(${sceneRgbStr})`,
            background: `rgba(${sceneRgbStr}, 0.12)`,
            border: `1px solid rgba(${sceneRgbStr}, 0.32)`,
          }}>{rolePillLabel}</span>
        </div>
      </div>

      {/* Role description — sentence-case body text, no longer wrapped in a
          framed box (the hero + heading carry the chrome). */}
      <div style={{ padding: '0 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <textarea
          ref={roleDescRef}
          defaultValue={role.roleDesc}
          placeholder="Role description..."
          onBlur={(e) => { const v = e.target.value; if (v !== role.roleDesc) saveEntity({ description: v || null }) }}
          rows={2}
          style={{
            fontSize: 13, color: 'var(--fg)', opacity: 0.7, lineHeight: 1.65,
            width: '100%', background: 'transparent', border: 'none', outline: 'none',
            fontFamily: "'Geist', sans-serif", resize: 'vertical', minHeight: 40,
          }}
        />
        {role.scenes.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {role.scenes.map(s => (
              <span key={s} style={{
                fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.07em',
                textTransform: 'uppercase', padding: '4px 9px', borderRadius: 20,
                background: 'rgba(103,232,249,0.07)', border: '1px solid rgba(103,232,249,0.15)',
                color: 'rgba(103,232,249,0.65)',
              }}>
                Scene {s}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actor section */}
      {role.cast && role.talent ? (
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--fg-mono)', marginBottom: 10 }}>
            Actor
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <button
              type="button"
              onClick={() => { if (!uploadTalentImage.isPending) imageInputRef.current?.click() }}
              aria-label={role.talent.imageUrl ? 'Replace photo' : 'Upload photo'}
              disabled={uploadTalentImage.isPending}
              style={{
                position: 'relative',
                width: 52, height: 52, borderRadius: '50%',
                background: `${accent}20`, border: `1.5px solid ${accent}45`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, flexShrink: 0, color: accent,
                overflow: 'hidden', padding: 0,
                cursor: uploadTalentImage.isPending ? 'wait' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {role.talent.imageUrl ? (
                <StorageImage
                  url={role.talent.imageUrl}
                  alt={role.talent.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(ev) => { (ev.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                role.talent.initials
              )}
              {uploadTalentImage.isPending && (
                <span style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.45)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{
                    width: 18, height: 18,
                    border: '2px solid rgba(255,255,255,0.25)',
                    borderTopColor: 'rgba(255,255,255,0.85)',
                    borderRadius: '50%',
                    animation: 'cast-avatar-spin 0.9s linear infinite',
                  }} />
                  <style>{`@keyframes cast-avatar-spin { to { transform: rotate(360deg); } }`}</style>
                </span>
              )}
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onPickImage}
              style={{ display: 'none' }}
            />
            <input
              ref={actorNameRef}
              defaultValue={role.talent.name}
              placeholder="Actor name"
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== role.talent?.name) saveTalent({ name: v }) }}
              style={{
                fontSize: 18, fontWeight: 700, color: 'var(--fg)', background: 'transparent',
                border: 'none', outline: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)',
                width: '100%', paddingBottom: 2, fontFamily: "'Geist', sans-serif",
              }}
            />
          </div>
          {imageError && (
            <div style={{
              marginBottom: 10, padding: '7px 10px', borderRadius: 8,
              background: 'rgba(232,72,72,0.10)', border: '1px solid rgba(232,72,72,0.22)',
              color: '#e84848', fontFamily: "'Geist Mono', monospace",
              fontSize: 11, letterSpacing: '0.04em',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
            }}>
              <span style={{ flex: 1 }}>{imageError}</span>
              <button type="button" onClick={() => setImageError(null)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#e84848', fontSize: 12,
              }}>✕</button>
            </div>
          )}

          {/* Agency row */}
          <InfoRow
            label="Agency"
            value={role.talent.agency}
            placeholder="Direct"
            onSave={(v) => saveTalent({ agency: v || null })}
          />

          {/* Contact collapsible */}
          <Collapsible title="Contact">
            <InfoRow label="Email" type="email" value={role.talent.email} placeholder="Email" onSave={(v) => saveTalent({ email: v || null })} />
            <InfoRow label="Phone" type="tel" value={role.talent.phone} placeholder="Phone" onSave={(v) => saveTalent({ phone: v || null })} />
          </Collapsible>

          {/* Rep collapsible */}
          <Collapsible title="Representation" defaultOpen={!!role.talent.repName}>
            <InfoRow label="Rep Name" value={role.talent.repName} placeholder="Name" onSave={(v) => saveTalent({ repName: v || null })} />
            <InfoRow label="Rep Email" type="email" value={role.talent.repEmail} placeholder="Email" onSave={(v) => saveTalent({ repEmail: v || null })} />
            <InfoRow label="Rep Phone" type="tel" value={role.talent.repPhone} placeholder="Phone" onSave={(v) => saveTalent({ repPhone: v || null })} />
          </Collapsible>

          {/* Always-visible rows */}
          <div style={{ marginTop: 4 }}>
            <InfoRow label="Dietary" value={role.talent.dietary} placeholder="None noted" onSave={(v) => saveTalent({ dietaryRestrictions: v || null })} />
            <ShootDaysEditor dates={role.talent.shootDates} onSave={(d) => saveTalent({ shootDates: d.length ? d : null })} />
          </div>
        </div>
      ) : (
        <div style={{ padding: 20, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            border: '2px dashed rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 300, color: 'rgba(255,255,255,0.12)',
          }}>+</div>
          <span style={{
            fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--fg-mono)',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20, padding: '4px 12px',
          }}>
            Uncast
          </span>
          <input
            ref={newActorRef}
            placeholder="Cast an actor..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const v = (e.target as HTMLInputElement).value.trim()
                if (v) { onAssignTalent(role.id, v); (e.target as HTMLInputElement).value = '' }
              }
            }}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v) { onAssignTalent(role.id, v); e.target.value = '' }
            }}
            style={{
              marginTop: 4, padding: '8px 14px', borderRadius: 10,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--fg)', outline: 'none', fontFamily: "'Geist', sans-serif",
              fontSize: 13, textAlign: 'center', width: '80%',
            }}
          />
          <div style={{ fontSize: 12, color: 'var(--fg-mono)', lineHeight: 1.6, textAlign: 'center' }}>
            Type a name and press enter to assign.
          </div>
        </div>
      )}

      {/* Notes */}
      <div style={{ padding: '16px 20px 12px' }}>
        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--fg-mono)', marginBottom: 8 }}>
          Notes
        </div>
        <textarea
          ref={notesRef}
          defaultValue={role.cast ? (role.talent?.notes ?? '') : role.roleNotes}
          placeholder={role.cast ? 'Add notes...' : 'Casting notes, ideas, references...'}
          onBlur={(e) => {
            const v = e.target.value
            if (role.cast && role.talent) {
              if (v !== role.talent.notes) saveTalent({ notes: v || null })
            } else {
              if (v !== role.roleNotes) saveEntity({ metadata: { section: role.section, scenes: role.scenes, notes: v || null } })
            }
          }}
          rows={4}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10,
            padding: '12px 14px', fontFamily: "'Geist', sans-serif",
            fontSize: 13, color: 'var(--fg)', lineHeight: 1.65,
            resize: 'vertical', minHeight: 80, outline: 'none',
          }}
        />
      </div>

      {/* V2: 3-step status row — visual treatment only per brief.
          Hard-coded labels (Cast Confirmed / Wardrobe Fitted / Camera Test)
          and placeholder dates ('—'). The data flow that drives real dates
          is out of scope for this PR; the visual lands now so the surface
          reads as designed. Each step: post-teal dot (matches DESIGN_LANGUAGE
          phase-post token) with glow halo + mono-caps label + mono date. */}
      {role.cast && (
        <div style={{ padding: '4px 20px 16px' }}>
          <div
            className="glass-tile-sm"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 8, padding: '10px 14px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border)',
            }}
          >
            {[
              { label: 'Cast Confirmed', date: '—' },
              { label: 'Wardrobe Fitted', date: '—' },
              { label: 'Camera Test', date: '—' },
            ].map((step) => (
              <div
                key={step.label}
                className="flex flex-col items-center"
                style={{ gap: 3, flex: 1, minWidth: 0 }}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--phase-post)',
                  boxShadow: '0 0 4px rgba(0,184,148,0.5)',
                }} />
                <span className="font-mono uppercase" style={{
                  fontSize: '0.36rem', letterSpacing: '0.08em',
                  color: 'var(--fg)', textAlign: 'center',
                }}>{step.label}</span>
                <span className="font-mono" style={{
                  fontSize: '0.34rem', letterSpacing: '0.06em',
                  color: 'var(--fg-mono)',
                }}>{step.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {PreviewRow}
      {MessageZone}

      {/* Delete */}
      <div style={{ padding: '0 20px 24px' }}>
        <div
          onClick={() => { onDelete(role.id); onClose() }}
          style={{
            padding: 11, borderRadius: 10,
            background: 'rgba(232,72,72,0.10)', border: '1px solid rgba(232,72,72,0.22)',
            color: '#e84848', fontFamily: "'Geist Mono', monospace",
            fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
            cursor: 'pointer', textAlign: 'center',
          }}>
          Remove Role
        </div>
      </div>

      {StartSheetOverlay}
    </>
  )
}

// ── Create Sheet ───────────────────────────────────────────

function CreateCastSheet({ accent, onClose, onCreate }: { accent: string; onClose: () => void; onCreate: (fields: { role: string; roleDesc?: string; section?: string; actorName?: string }) => void }) {
  const roleRef = useRef<HTMLInputElement>(null)
  const actorRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLTextAreaElement>(null)
  const sectionRef = useRef<HTMLInputElement>(null)

  const submit = () => {
    const role = roleRef.current?.value?.trim()
    if (!role) return
    onCreate({
      role,
      roleDesc: descRef.current?.value?.trim() || undefined,
      section: sectionRef.current?.value?.trim() || undefined,
      actorName: actorRef.current?.value?.trim() || undefined,
    })
    onClose()
  }

  const fieldLabel = { fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.13em', textTransform: 'uppercase' as const, color: 'var(--fg-mono)', display: 'block', marginBottom: 6 }
  const fieldInput = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '11px 14px', fontFamily: "'Geist', sans-serif", fontSize: 14, color: 'var(--fg)', outline: 'none' }

  return (
    <>
      <SheetHeader
        title="Add Cast"
        onClose={onClose}
        action={<button onClick={submit} style={{ fontSize: 14, fontWeight: 600, color: accent, background: 'none', border: 'none', cursor: 'pointer' }}>Save</button>}
      />
      <SheetBody>
        <div style={{ marginBottom: 16 }}>
          <span style={fieldLabel}>Role Name</span>
          <input ref={roleRef} autoFocus placeholder="e.g. Eli, The Stranger" style={fieldInput} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <span style={fieldLabel}>Role Description</span>
          <textarea ref={descRef} placeholder="Brief character description" rows={2} style={{ ...fieldInput, resize: 'vertical', minHeight: 60 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <span style={fieldLabel}>Section</span>
          <input ref={sectionRef} defaultValue="Principal Cast" placeholder="Principal Cast / Talent / Background" style={fieldInput} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <span style={fieldLabel}>Actor (optional)</span>
          <input ref={actorRef} placeholder="Leave blank to create uncast role" style={fieldInput} />
        </div>
      </SheetBody>
    </>
  )
}

// ── Page ───────────────────────────────────────────────────

export default function CastingPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const { data: project } = useProject(projectId)
  const accent = project?.color || getProjectColor(projectId)

  const { data: rolesData, isLoading } = useCastRoles(projectId)
  const roles = (rolesData ?? []) as CastRoleData[]

  const createRole = useCreateCastRole(projectId)
  const updateEntity = useUpdateCastEntity(projectId)
  const updateTalent = useUpdateTalent(projectId)
  const assignTalent = useAssignTalent(projectId)
  const deleteRole = useDeleteCastRole(projectId)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  // V2: filter pill state. 'All' | 'Uncast' | live section name (e.g.
  // 'Principal Cast' / 'Talent' / 'Background'). Pills render with
  // gallery-style labels (Leads / Supporting / Day Players) via
  // pillLabelFor(), but the underlying filter key matches live data.
  const [activeFilter, setActiveFilter] = useState<string>('All')
  // Register the + handler with the global ActionBar.
  useFabAction({ onPress: () => { haptic('light'); setCreating(true) } })
  const [charMenuOpen, setCharMenuOpen] = useState(false)
  const [charDetail, setCharDetail] = useState<EntityItem | null>(null)
  const qc = useQueryClient()
  const selected = roles.find(r => r.id === selectedId) ?? null

  // Cast-stream thread bucket: keyed by Talent.id (the real person on this
  // production). Uncast rows have no Talent, so never match — badge absent.
  const threadByTalentId = useThreadsByEntity(projectId, 'cast')
  // Character-stream bucket for the Characters dropdown avatars. Same key
  // the Scenemaker EntityDrawer tiles use, so counts stay consistent across
  // entry points (see DECISIONS.md § Entity-vs-production-record threading).
  const threadByCharacterId = useThreadsByEntity(projectId, 'character')

  // Character list for the dropdown — reuses the roles query (Entity type=character).
  // Alphabetically sorted. Includes uncast roles so every character is reachable.
  const characters: EntityItem[] = useMemo(() => {
    return roles
      .map(r => ({ id: r.id, name: r.role, description: r.roleDesc || null, imageUrl: null }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [roles])

  // Close dropdown on outside tap / escape
  useEffect(() => {
    if (!charMenuOpen) return
    const close = () => setCharMenuOpen(false)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [charMenuOpen])

  // EntityDetailSheet save handler — updates the character Entity row.
  // Threads inside the sheet use ('character', entity.id); same tuple as
  // Scenemaker EntityDrawer, so the conversation unifies.
  const handleCharSave = useCallback(async (name: string, description: string, entityId?: string) => {
    if (!entityId) { setCharDetail(null); return }
    try {
      await dbUpdateEntity(entityId, { name, description })
      qc.invalidateQueries({ queryKey: ['castRoles', projectId] })
      qc.invalidateQueries({ queryKey: ['entities', projectId, 'characters'] })
    } catch (err) {
      console.error('Failed to save character from Casting:', err)
    }
    setCharDetail(null)
  }, [qc, projectId])

  // Filter pill counts (per live section + uncast bucket). Counts always
  // reflect the unfiltered data so pills show "where you could go" totals,
  // not what's currently visible.
  const sectionOrder = ['Principal Cast', 'Principal Talent', 'Talent', 'Background']
  const sectionKeys = Array.from(new Set(roles.map(r => r.section || 'Principal Cast')))
  const orderedSectionKeys = [
    ...sectionOrder.filter(s => sectionKeys.includes(s)),
    ...sectionKeys.filter(s => !sectionOrder.includes(s)),
  ]
  const uncastCount = roles.filter(r => !r.cast).length
  const filterPills: { key: string; label: string; count: number }[] = [
    { key: 'All', label: 'All', count: roles.length },
    ...orderedSectionKeys.map(s => ({
      key: s,
      label: pillLabelFor(s),
      count: roles.filter(r => (r.section || 'Principal Cast') === s).length,
    })),
    ...(uncastCount > 0 ? [{ key: 'Uncast', label: 'Uncast', count: uncastCount }] : []),
  ]

  // Apply active filter before grouping.
  const filteredRoles = activeFilter === 'All'
    ? roles
    : activeFilter === 'Uncast'
      ? roles.filter(r => !r.cast)
      : roles.filter(r => (r.section || 'Principal Cast') === activeFilter)

  // Group by section (post-filter).
  const grouped: { label: string; members: CastRoleData[] }[] = []
  const groupMap = new Map<string, CastRoleData[]>()
  for (const r of filteredRoles) {
    const k = r.section || 'Principal Cast'
    if (!groupMap.has(k)) groupMap.set(k, [])
    groupMap.get(k)!.push(r)
  }
  // Preserve stable order: Principal first, then Talent, then Background, then others
  for (const label of sectionOrder) {
    if (groupMap.has(label)) grouped.push({ label, members: groupMap.get(label)! })
  }
  groupMap.forEach((members, label) => {
    if (!sectionOrder.includes(label)) grouped.push({ label, members })
  })

  const castCount = roles.filter(r => r.cast).length

  // Cinema Glass: project accent triplet drives the sheen-title gradient and
  // glass-tile tint. +20/+30/+16 lights the spec's accent-glow apex.
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
      {/* Cinema Glass page header — sheen Casting title + project meta + phase pill.
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
            Casting
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

      {/* Count row + Characters dropdown — creative-side bridge into the
          shared character sheet (same sheet as Scenemaker EntityDrawer).
          Threads started from here land on the character Entity and
          stay separate from the per-row cast threads. */}
      {roles.length > 0 && (
        <div style={{ padding: '6px 20px 2px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <span className="font-mono" style={{ fontSize: '0.52rem', color: 'var(--fg-mono)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {roles.length} role{roles.length !== 1 ? 's' : ''} · {castCount} cast
          </span>
          <button
            onClick={() => { haptic('light'); setCharMenuOpen(v => !v) }}
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
            aria-expanded={charMenuOpen}
          >
            Characters ▾
          </button>
          {charMenuOpen && (
            <>
              <div
                onClick={() => setCharMenuOpen(false)}
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
                {characters.length === 0 ? (
                  <div className="font-mono" style={{ padding: '8px 14px', fontSize: 10, color: 'var(--fg-mono)' }}>
                    No characters yet
                  </div>
                ) : characters.map(c => (
                  <button
                    key={c.id}
                    role="menuitem"
                    onClick={() => {
                      haptic('light')
                      setCharMenuOpen(false)
                      setCharDetail(c)
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
                        background: ENTITY_COLORS.characters.bg,
                        border: `1px solid ${ENTITY_COLORS.characters.border}`,
                        color: ENTITY_COLORS.characters.base,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 700,
                      }}>{getEntityInitials(c.name)}</span>
                      <ThreadRowBadge entry={threadByCharacterId.get(c.id)} />
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* V2: Filter pill row — DESIGN_LANGUAGE.md "filter pill row · plain
          text+count". Mono-caps via existing pill class shape; active pill
          gets project accent border + accent text. Hidden until data loads
          to avoid pill-flash before counts settle. */}
      {!isLoading && roles.length > 0 && (
        <div
          className="flex items-center gap-2 overflow-x-auto no-scrollbar"
          style={{ padding: '4px 16px 8px', WebkitOverflowScrolling: 'touch' }}
        >
          {filterPills.map(p => {
            const isActive = activeFilter === p.key
            return (
              <button
                key={p.key}
                onClick={() => { haptic('light'); setActiveFilter(p.key) }}
                className="font-mono uppercase"
                style={{
                  fontSize: '0.40rem', letterSpacing: '0.10em',
                  padding: '5px 10px', borderRadius: 999, cursor: 'pointer',
                  whiteSpace: 'nowrap', flexShrink: 0,
                  background: isActive ? `${accent}1f` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isActive ? `${accent}55` : 'var(--border)'}`,
                  color: isActive ? accent : 'var(--fg-mono)',
                  fontWeight: 600,
                }}
              >
                {p.label} · {p.count}
              </button>
            )
          })}
        </div>
      )}

      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', padding: '8px 20px 100px' }}>
        {isLoading ? (
          // V2: in-page React-Query loading state. Mirrors the SSR Suspense
          // fallback in `loading.tsx` so the route reads identically whether
          // it's the suspense fallback or a stale-data refetch. Uses the new
          // `.sk-grid-3` + `.sk-pill` + `.sk-line` cinema-glass primitives.
          <>
            <div style={{ display: 'flex', gap: 8, marginTop: 4, marginBottom: 14 }}>
              <div className="sk sk-pill" />
              <div className="sk sk-pill" style={{ width: 70 }} />
              <div className="sk sk-pill" style={{ width: 90 }} />
              <div className="sk sk-pill" style={{ width: 80 }} />
            </div>
            <div className="sk-grid-3">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i}>
                  <div className="sk" style={{ aspectRatio: '3 / 4', borderRadius: 8, marginBottom: 6 }} />
                  <div className={`sk sk-line ${i % 3 === 0 ? 'short' : i % 3 === 1 ? 'long' : 'med'}`} />
                </div>
              ))}
            </div>
          </>
        ) : (
          roles.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, padding: 40 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', border: '1.5px dashed rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 300, color: 'rgba(255,255,255,0.15)' }}>+</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg)', textAlign: 'center', opacity: 0.7 }}>No cast yet</div>
              <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'var(--fg-mono)', letterSpacing: '0.07em', textAlign: 'center', lineHeight: 1.7 }}>
                Add roles, cast actors.
              </div>
              <div
                onClick={() => { haptic('light'); setCreating(true) }}
                style={{
                  marginTop: 8, padding: '10px 24px', borderRadius: 24,
                  background: `${accent}26`, border: `1px solid ${accent}4d`,
                  color: accent, fontFamily: "'Geist Mono', monospace",
                  fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
                }}>
                Add First Role
              </div>
            </div>
          ) : (
            grouped.map(({ label, members }) => (
              <div key={label}>
                {/* Sheen section divider — DESIGN_LANGUAGE.md section dividers
                    use the sheen+extrusion title treatment. */}
                <div className="flex flex-col items-center" style={{ marginTop: 18, marginBottom: 10 }}>
                  <span className="sheen-title" style={{ fontSize: '0.84rem', fontWeight: 700, letterSpacing: '-0.01em' }}>{label}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {members.map(r => (
                    <CastCard
                      key={r.id}
                      role={r}
                      onTap={() => { haptic('light'); setSelectedId(r.id) }}
                      threadEntry={r.talent ? threadByTalentId.get(r.talent.id) : undefined}
                    />
                  ))}
                </div>
              </div>
            ))
          )
        )}
      </div>

      {/* Detail sheet */}
      <Sheet open={!!selected} onClose={() => setSelectedId(null)} maxHeight="94vh">
        <CastDetailSheet
          role={selected}
          accent={accent}
          projectId={projectId}
          onClose={() => setSelectedId(null)}
          onUpdateEntity={(id, updates) => updateEntity.mutate({ id, updates })}
          onUpdateTalent={(id, fields) => updateTalent.mutate({ id, fields })}
          onAssignTalent={(entityId, actorName) => assignTalent.mutate({ projectId, entityId, actorName })}
          onDelete={(id) => deleteRole.mutate(id)}
        />
      </Sheet>

      {/* Create sheet */}
      <Sheet open={creating} onClose={() => setCreating(false)} maxHeight="85vh">
        <CreateCastSheet
          accent={accent}
          onClose={() => setCreating(false)}
          onCreate={(fields) => {
            haptic('light')
            createRole.mutate({ projectId, ...fields })
          }}
        />
      </Sheet>

      {/* Characters bridge — shared EntityDetailSheet, same surface as Scenemaker
          EntityDrawer. Threads here attach as ('character', entity.id), keeping
          creative discussion separate from the per-row 'cast' threads above. */}
      <AnimatePresence>
        {charDetail && (
          <EntityDetailSheet
            key="char-bridge-sheet"
            type="characters"
            projectId={projectId}
            colors={ENTITY_COLORS.characters}
            label="Characters"
            entity={charDetail}
            onSave={handleCharSave}
            onClose={() => setCharDetail(null)}
            getInitials={getEntityInitials}
          />
        )}
      </AnimatePresence>

      {/* + handler registered above via useFabAction. ActionBar is mounted globally. */}
    </div>
  )
}
