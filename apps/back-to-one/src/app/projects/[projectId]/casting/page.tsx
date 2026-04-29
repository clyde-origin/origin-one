'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import {
  useProject,
  useCastRoles,
  useCreateCastRole,
  useUpdateCastEntity,
  useUpdateTalent,
  useAssignTalent,
  useDeleteCastRole,
} from '@/lib/hooks/useOriginOne'
import { LoadingState } from '@/components/ui'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProjectSwitcher } from '@/components/ProjectSwitcher'
import { StorageImage } from '@/components/ui/StorageImage'
import { useFabAction } from '@/lib/contexts/FabActionContext'
import { haptic } from '@/lib/utils/haptics'
import { getProjectColor, statusHex, statusLabel } from '@/lib/utils/phase'
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

// ── Cast Row ───────────────────────────────────────────────

function CastRow({ role, accent, onTap, threadEntry }: { role: CastRoleData; accent: string; onTap: () => void; threadEntry: ThreadRowBadgeEntry | undefined }) {
  if (role.cast && role.talent) {
    return (
      <div
        style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '11px 14px', borderRadius: 14,
          border: `1px solid ${accent}1e`, background: `${accent}0d`,
          marginBottom: 7, cursor: 'pointer', transition: 'background 0.15s',
        }}
        onClick={onTap}
      >
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: `${accent}20`, border: `1.5px solid ${accent}45`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, flexShrink: 0, color: accent,
          overflow: 'hidden',
        }}>
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
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {role.talent.name}
          </div>
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {role.role}
          </div>
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.13)', flexShrink: 0 }}>›</div>
        <ThreadRowBadge entry={threadEntry} />
      </div>
    )
  }

  // Uncast row: no Talent.id yet, so no cast thread bucket exists.
  // Badge is inherently absent — no badge rendered.
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '11px 14px', borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)',
        marginBottom: 7, cursor: 'pointer', transition: 'background 0.15s',
      }}
      onClick={onTap}
    >
      <div style={{
        width: 52, height: 52, borderRadius: '50%',
        background: 'rgba(255,255,255,0.03)', border: '1.5px dashed rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, fontWeight: 300, color: 'rgba(255,255,255,0.15)', flexShrink: 0,
      }}>+</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.18)', fontStyle: 'italic' }}>
          Uncast
        </div>
        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {role.role}
        </div>
      </div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.13)', flexShrink: 0 }}>›</div>
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
        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>
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
      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)', flexShrink: 0, minWidth: 72, paddingTop: alignStart ? 3 : 0 }}>
        {label}
      </span>
      <input
        type={type}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { if (v !== value) onSave(v) }}
        placeholder={placeholder}
        style={{
          fontSize: 13, color: 'rgba(255,255,255,0.65)', background: 'transparent',
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
      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)', flexShrink: 0, minWidth: 72, paddingTop: 3 }}>
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
              color: 'rgba(255,255,255,0.45)', cursor: 'pointer',
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
              color: '#fff', outline: 'none', width: 70,
            }}
          />
        ) : (
          <span
            onClick={() => setEditing(true)}
            style={{
              fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.07em',
              textTransform: 'uppercase', padding: '4px 9px', borderRadius: 20,
              border: '1px dashed rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.3)',
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

      {/* Role section */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: 10 }}>
          Role
        </div>
        <input
          defaultValue={role.role}
          placeholder="Role name"
          onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== role.role) saveEntity({ name: v }) }}
          style={{
            fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 8, lineHeight: 1.15,
            width: '100%', background: 'transparent', border: 'none', outline: 'none',
            fontFamily: "'Geist', sans-serif",
          }}
        />
        <textarea
          ref={roleDescRef}
          defaultValue={role.roleDesc}
          placeholder="Role description..."
          onBlur={(e) => { const v = e.target.value; if (v !== role.roleDesc) saveEntity({ description: v || null }) }}
          rows={2}
          style={{
            fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, marginBottom: 10,
            width: '100%', background: 'transparent', border: 'none', outline: 'none',
            fontFamily: "'Geist', sans-serif", resize: 'vertical', minHeight: 40,
          }}
        />
        {role.scenes.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: 10 }}>
            Actor
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: `${accent}20`, border: `1.5px solid ${accent}45`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700, flexShrink: 0, color: accent,
              overflow: 'hidden',
            }}>
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
            </div>
            <input
              ref={actorNameRef}
              defaultValue={role.talent.name}
              placeholder="Actor name"
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== role.talent?.name) saveTalent({ name: v }) }}
              style={{
                fontSize: 18, fontWeight: 700, color: '#fff', background: 'transparent',
                border: 'none', outline: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)',
                width: '100%', paddingBottom: 2, fontFamily: "'Geist', sans-serif",
              }}
            />
          </div>

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
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)',
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
              color: '#fff', outline: 'none', fontFamily: "'Geist', sans-serif",
              fontSize: 13, textAlign: 'center', width: '80%',
            }}
          />
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', lineHeight: 1.6, textAlign: 'center' }}>
            Type a name and press enter to assign.
          </div>
        </div>
      )}

      {/* Notes */}
      <div style={{ padding: '16px 20px 12px' }}>
        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: 8 }}>
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
            fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.65,
            resize: 'vertical', minHeight: 80, outline: 'none',
          }}
        />
      </div>

      {PreviewRow}
      {MessageZone}

      {/* Delete */}
      <div style={{ padding: '0 20px 24px' }}>
        <div
          onClick={() => { onDelete(role.id); onClose() }}
          style={{
            padding: 11, borderRadius: 10,
            background: 'rgba(231,76,60,0.07)', border: '1px solid rgba(231,76,60,0.14)',
            color: 'rgba(231,76,60,0.55)', fontFamily: "'Geist Mono', monospace",
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

  const fieldLabel = { fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.13em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.25)', display: 'block', marginBottom: 6 }
  const fieldInput = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '11px 14px', fontFamily: "'Geist', sans-serif", fontSize: 14, color: '#fff', outline: 'none' }

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

  // Group by section
  const grouped: { label: string; members: CastRoleData[] }[] = []
  const groupMap = new Map<string, CastRoleData[]>()
  for (const r of roles) {
    const k = r.section || 'Principal Cast'
    if (!groupMap.has(k)) groupMap.set(k, [])
    groupMap.get(k)!.push(r)
  }
  // Preserve stable order: Principal first, then Talent, then Background, then others
  const sectionOrder = ['Principal Cast', 'Principal Talent', 'Talent', 'Background']
  for (const label of sectionOrder) {
    if (groupMap.has(label)) grouped.push({ label, members: groupMap.get(label)! })
  }
  groupMap.forEach((members, label) => {
    if (!sectionOrder.includes(label)) grouped.push({ label, members })
  })

  const castCount = roles.filter(r => r.cast).length

  return (
    <div className="screen">
      <PageHeader projectId={projectId} title="Casting" meta={project ? (
        <div className="flex flex-col items-center gap-1.5">
          <ProjectSwitcher projectId={projectId} projectName={project.name} accentColor={accent} variant="meta" />
          <span className="font-mono uppercase" style={{ fontSize: '0.38rem', padding: '2px 8px', borderRadius: 12, background: `${statusHex(project.status)}18`, color: statusHex(project.status) }}>
            {statusLabel(project.status)}
          </span>
        </div>
      ) : ''} />

      {/* Count row + Characters dropdown — creative-side bridge into the
          shared character sheet (same sheet as Scenemaker EntityDrawer).
          Threads started from here land on the character Entity and
          stay separate from the per-row cast threads. */}
      {roles.length > 0 && (
        <div style={{ padding: '6px 20px 2px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <span className="font-mono" style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {roles.length} role{roles.length !== 1 ? 's' : ''} · {castCount} cast
          </span>
          <button
            onClick={() => { haptic('light'); setCharMenuOpen(v => !v) }}
            className="font-mono uppercase"
            style={{
              // Secondary affordance — pill outline in project accent, not filled.
              // Transparent w/ ~8% tint so it reads distinct from the count row
              // without becoming a primary action.
              fontSize: '0.52rem', letterSpacing: '0.12em', color: accent,
              background: `${accent}14`,
              border: `1px solid ${accent}`,
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
                  background: '#141420',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
                  padding: '6px 0',
                  boxShadow: '0 18px 40px rgba(0,0,0,0.55)',
                }}
              >
                {characters.length === 0 ? (
                  <div className="font-mono" style={{ padding: '8px 14px', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
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
                      cursor: 'pointer', textAlign: 'left', color: '#dddde8',
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

      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', padding: '8px 20px 100px' }}>
        {isLoading ? <LoadingState /> : (
          roles.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, padding: 40 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', border: '1.5px dashed rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 300, color: 'rgba(255,255,255,0.15)' }}>+</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>No cast yet</div>
              <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.07em', textAlign: 'center', lineHeight: 1.7 }}>
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
                <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginTop: 14, marginBottom: 8, paddingLeft: 2 }}>
                  {label}
                </div>
                {members.map(r => (
                  <CastRow
                    key={r.id}
                    role={r}
                    accent={accent}
                    onTap={() => { haptic('light'); setSelectedId(r.id) }}
                    threadEntry={r.talent ? threadByTalentId.get(r.talent.id) : undefined}
                  />
                ))}
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
