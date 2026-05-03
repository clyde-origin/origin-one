'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  useProject,
  useCrew,
  useWorkflowNodes,
  useWorkflowEdges,
  useDeliverables,
  useCreateWorkflowNode,
  useUpdateWorkflowNode,
  useDeleteWorkflowNode,
  useCreateWorkflowEdge,
  useUpdateWorkflowEdge,
  useCreateDeliverable,
  useUpdateDeliverable,
  useDeleteDeliverable,
} from '@/lib/hooks/useOriginOne'

import { LoadingState } from '@/components/ui'
import { GhostCircle, GhostRect, GhostPill, SectionLabel, EmptyCTA } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProjectSwitcher } from '@/components/ProjectSwitcher'
import { useFabAction } from '@/lib/contexts/FabActionContext'
import { haptic } from '@/lib/utils/haptics'
import { getProjectColor, statusLabel } from '@/lib/utils/phase'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { initials } from '@/lib/utils/formatting'
import { ThreadRowBadge, type ThreadRowBadgeEntry } from '@/components/threads/ThreadRowBadge'
import { useThreadsByEntity } from '@/components/threads/useThreadsByEntity'
import { useDetailSheetThreads } from '@/components/threads/useDetailSheetThreads'

// ── Type colors ────────────────────────────────────────────

type NodeType = 'ingest' | 'edit' | 'color' | 'vfx' | 'sound' | 'delivery' | 'other'

const TYPE_LABELS: Record<string, string> = {
  ingest: 'Ingest', edit: 'Edit', color: 'Color', vfx: 'VFX',
  sound: 'Sound', delivery: 'Delivery', other: 'Other',
}

// Per-node tag colors. Hex values match the gallery's `--tag-rgb`
// declarations on each `.wf-node` (hub-full-preview-v2.html row 17).
// vfx is not in the gallery's mapping; it inherits the cyan from the
// thread `obj-milestone` token (#22d4d4) which is the closest non-phase
// non-collision available to OMC's "VFX" production semantic.
const TYPE_COLORS: Record<string, string> = {
  ingest: '#f5a532', edit: '#9b6ef3', color: '#e8507a', vfx: '#22d4d4',
  sound: '#f5a532', delivery: '#00b894', other: '#aaaab4',
}
const TYPE_RGB: Record<string, string> = {
  ingest:   '245, 165, 50',
  edit:     '155, 110, 243',
  color:    '232, 80, 122',
  vfx:      '34, 212, 212',
  sound:    '245, 165, 50',
  delivery: '0, 184, 148',
  other:    '170, 170, 180',
}

const ALL_TYPES: NodeType[] = ['ingest', 'edit', 'color', 'vfx', 'sound', 'delivery', 'other']

// ── Helpers ─────────────────────────────────────────────────

function stableColor(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h)
  return `hsl(${((h % 360) + 360) % 360}, 55%, 50%)`
}

// Decompose a #rrggbb hex into a [r,g,b] triplet so the screen root can set
// `--accent-rgb` / `--accent-glow-rgb` for `.sheen-title` and `.ai-meta-pill`.
function hexToRgb(hex: string | null | undefined): [number, number, number] {
  const h = (hex && /^#[0-9a-f]{6}$/i.test(hex)) ? hex : '#c45adc'
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}

// Project status → ai-meta-pill phase modifier (.pre / .prod / .post).
function statusToPhase(s: string | undefined): 'pre' | 'prod' | 'post' {
  if (s === 'production') return 'prod'
  if (s === 'post_production') return 'post'
  return 'pre'
}

// ── Node Card ──────────────────────────────────────────────
// V2 (reskin/v2-workflow): rectangular .wf-node card per audit. Tag in
// its own top row, body holds title + tool, right column carries the
// assignee avatar + name+role stack. Tag tint flows from --tag-rgb;
// the screen's --accent-rgb stays the project accent so connector pills
// render in project color rather than per-node tint.

function NodeCard({
  node, crew, onTap, onAssign, threadEntry,
}: {
  node: any; crew: any[]; onTap: (n: any) => void; onAssign: (n: any) => void
  threadEntry: ThreadRowBadgeEntry | undefined
}) {
  const person = node.assigneeId
    ? crew.find((m: any) => m.userId === node.assigneeId || m.User?.id === node.assigneeId)
    : null
  const user = person?.User ?? person
  const tagRgb = TYPE_RGB[node.type] ?? TYPE_RGB.other

  return (
    <div
      className="wf-node"
      style={{ ['--tag-rgb' as string]: tagRgb } as React.CSSProperties}
      onClick={() => onTap(node)}
    >
      <span className="wf-node-tag">{TYPE_LABELS[node.type] ?? 'Other'}</span>

      <div className="wf-node-body">
        <div className="wf-node-title">{node.label}</div>
        {node.software && <div className="wf-node-tool">{node.software}</div>}
      </div>

      {user ? (
        <div
          className="wf-node-assignee"
          onClick={(e) => { e.stopPropagation(); onAssign(node) }}
        >
          <div
            className="wf-node-avatar"
            style={{
              background: `${stableColor(user.name ?? '')}22`,
              border: `1px solid ${stableColor(user.name ?? '')}44`,
              color: stableColor(user.name ?? ''),
            }}
          >
            {initials(user.name ?? '?')}
          </div>
          <div className="wf-node-name-block">
            <span className="wf-node-name">{(user.name ?? '').split(' ')[0]}</span>
            {person?.role && <span className="wf-node-role">{person.role}</span>}
          </div>
        </div>
      ) : (
        <div
          className="wf-node-assignee"
          onClick={(e) => { e.stopPropagation(); onAssign(node) }}
        >
          <div className="wf-node-avatar is-empty">+</div>
        </div>
      )}

      <ThreadRowBadge entry={threadEntry} />
    </div>
  )
}

// ── Connector ──────────────────────────────────────────────
// V2 (reskin/v2-workflow): single mono-caps `.wf-connector-pill` with
// `.wf-arrow ›` glyph inside, sitting on a centred hairline drawn by
// `.wf-connector::before`. Tap-to-edit format conversion remains.

function Connector({
  edge, accent, openId, onToggle, onUpdateEdge,
}: {
  edge: any | null; accent: string; openId: string | null; onToggle: (id: string) => void; onUpdateEdge: (id: string, fields: any) => void
}) {
  const eid = edge?.id ?? 'none'
  const isOpen = openId === eid
  const hasFormat = edge && (edge.format || edge.inputFormat || edge.outputFormat)
  const formatLabel = edge?.format || [edge?.inputFormat, edge?.outputFormat].filter(Boolean).join(' -> ') || null

  const inputRef = useRef<HTMLInputElement>(null)
  const outputRef = useRef<HTMLInputElement>(null)
  const handoffRef = useRef<HTMLTextAreaElement>(null)

  const saveEdge = useCallback(() => {
    if (!edge) return
    const fields: any = {}
    if (inputRef.current) fields.inputFormat = inputRef.current.value || null
    if (outputRef.current) fields.outputFormat = outputRef.current.value || null
    if (handoffRef.current) fields.handoff = handoffRef.current.value || null
    // Derive format label from output or input
    fields.format = fields.outputFormat || fields.inputFormat || null
    onUpdateEdge(edge.id, fields)
  }, [edge, onUpdateEdge])

  return (
    <>
      <div className="wf-connector">
        {hasFormat ? (
          <div
            className="wf-connector-pill"
            onClick={() => onToggle(eid)}
          >
            {formatLabel}
            <span className="wf-arrow" style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : undefined }}>›</span>
          </div>
        ) : edge ? (
          <div
            className="wf-connector-pill is-empty"
            onClick={() => onToggle(eid)}
          >
            + format
            <span className="wf-arrow">›</span>
          </div>
        ) : null}
      </div>

      {edge && isOpen && (
        <div style={{
          width: '100%', background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12,
          padding: '10px 12px', margin: '4px 0',
        }}>
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: 8 }}>
            Format conversion
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              ref={inputRef}
              defaultValue={edge.inputFormat ?? ''}
              placeholder="From format"
              onBlur={saveEdge}
              style={{
                flex: 1, background: `${accent}0f`, border: `1px solid ${accent}26`,
                borderRadius: 8, padding: '7px 10px', fontFamily: "'Geist Mono', monospace",
                fontSize: 10, color: '#E07B60', letterSpacing: '0.05em',
                textTransform: 'uppercase', outline: 'none',
              }}
            />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>→</span>
            <input
              ref={outputRef}
              defaultValue={edge.outputFormat ?? ''}
              placeholder="To format"
              onBlur={saveEdge}
              style={{
                flex: 1, background: `${accent}0f`, border: `1px solid ${accent}26`,
                borderRadius: 8, padding: '7px 10px', fontFamily: "'Geist Mono', monospace",
                fontSize: 10, color: '#E07B60', letterSpacing: '0.05em',
                textTransform: 'uppercase', outline: 'none',
              }}
            />
          </div>
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: 6 }}>
              Handoff
            </div>
            <textarea
              ref={handoffRef}
              defaultValue={edge.handoff ?? ''}
              placeholder="Delivery method, folder path, naming convention..."
              onBlur={saveEdge}
              style={{
                width: '100%', background: `${accent}0a`, border: `1px solid ${accent}1f`,
                borderRadius: 8, padding: '8px 10px', fontFamily: "'Geist', sans-serif",
                fontSize: 12, color: '#E07B60', lineHeight: 1.55,
                resize: 'none', minHeight: 60, outline: 'none',
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}

// ── Deliverable Row ────────────────────────────────────────

function DeliverableRow({ del, onTap, threadEntry }: { del: any; onTap: (d: any) => void; threadEntry: ThreadRowBadgeEntry | undefined }) {
  const specs1 = [del.format, del.resolution, del.aspectRatio].filter(Boolean).join(' · ')
  const specs2 = [del.colorSpace, del.soundSpecs].filter(Boolean).join(' · ')

  return (
    <div
      className="glass-tile"
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 12px',
        marginBottom: 7, cursor: 'pointer', transition: 'background 0.15s',
      }}
      onClick={() => onTap(del)}
    >
      <div className="letterbox-top" />
      <div className="letterbox-bottom" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {del.title}
        </div>
        {specs1 && (
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.05em', color: '#E07B60', marginTop: 3, opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {specs1}
          </div>
        )}
        {specs2 && (
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 8, letterSpacing: '0.05em', color: '#E07B60', marginTop: 2, opacity: 0.65, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {specs2}
          </div>
        )}
      </div>
      <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, fontWeight: 700, color: 'var(--fg-mono)', flexShrink: 0 }}>
        {del.length || '—'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--fg-mono)', opacity: 0.4, flexShrink: 0 }}>›</div>
      <ThreadRowBadge entry={threadEntry} />
    </div>
  )
}

// ── Node Detail Sheet ──────────────────────────────────────

function NodeDetailSheet({
  node, crew, accent, projectId, onClose, onSave, onDelete, onAssign,
}: {
  node: any; crew: any[]; accent: string; projectId: string; onClose: () => void; onSave: (id: string, fields: any) => void; onDelete: (id: string) => void; onAssign: (n: any) => void
}) {
  const { TriggerIcon, PreviewRow, MessageZone, StartSheetOverlay } = useDetailSheetThreads({
    projectId,
    attachedToType: 'workflowStage',
    attachedToId: node?.id ?? null,
    subjectLabel: node?.label ?? '',
  })

  if (!node) return null
  const [type, setType] = useState<string>(node.type)
  const labelRef = useRef<HTMLInputElement>(null)
  const softwareRef = useRef<HTMLInputElement>(null)
  const notesRef = useRef<HTMLInputElement>(null)

  const save = useCallback(() => {
    onSave(node.id, {
      type,
      label: labelRef.current?.value || node.label,
      software: softwareRef.current?.value || null,
      notes: notesRef.current?.value || null,
    })
  }, [node, type, onSave])

  return (
    <>
      <SheetHeader
        title="Edit Node"
        onClose={() => { save(); onClose() }}
        action={TriggerIcon}
      />
      <SheetBody>
        {/* Type selector */}
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', display: 'block', marginBottom: 8 }}>
            Type
          </span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ALL_TYPES.map(t => {
              const c = TYPE_COLORS[t]
              const sel = t === type
              return (
                <div key={t}
                  onClick={() => setType(t)}
                  style={{
                    fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.08em',
                    textTransform: 'uppercase', padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
                    transition: 'all 0.14s',
                    background: sel ? `${c}1f` : 'transparent',
                    border: sel ? `1px solid ${c}4d` : '1px solid rgba(255,255,255,0.09)',
                    color: sel ? c : 'rgba(255,255,255,0.28)',
                  }}>
                  {TYPE_LABELS[t]}
                </div>
              )
            })}
          </div>
        </div>

        {/* Label */}
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', display: 'block', marginBottom: 6 }}>
            Label
          </span>
          <input ref={labelRef} defaultValue={node.label}
            placeholder="e.g. Offline Edit"
            onBlur={save}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: '11px 14px', fontFamily: "'Geist', sans-serif",
              fontSize: 14, color: '#fff', outline: 'none',
            }}
          />
        </div>

        {/* Software */}
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', display: 'block', marginBottom: 6 }}>
            Software
          </span>
          <input ref={softwareRef} defaultValue={node.software ?? ''}
            placeholder="e.g. DaVinci Resolve"
            onBlur={save}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: '11px 14px', fontFamily: "'Geist', sans-serif",
              fontSize: 14, color: '#fff', outline: 'none',
            }}
          />
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', display: 'block', marginBottom: 6 }}>
            Notes
          </span>
          <input ref={notesRef} defaultValue={node.notes ?? ''}
            placeholder="Any notes about this phase"
            onBlur={save}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: '11px 14px', fontFamily: "'Geist', sans-serif",
              fontSize: 14, color: '#fff', outline: 'none',
            }}
          />
        </div>

        {/* Assigned person */}
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', display: 'block', marginBottom: 8 }}>
            Assigned
          </span>
          {node.assigneeId ? (() => {
            const person = crew.find((m: any) => m.userId === node.assigneeId || m.User?.id === node.assigneeId)
            const user = person?.User ?? person
            return user ? (
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 10, background: `${accent}14`, border: `1px solid ${accent}33`, cursor: 'pointer' }}
                onClick={() => onAssign(node)}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${stableColor(user.name ?? '')}22`, border: `1px solid ${stableColor(user.name ?? '')}44`, color: stableColor(user.name ?? ''), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                  {initials(user.name ?? '?')}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>{user.name}</div>
                  {person?.role && <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 1 }}>{person.role}</div>}
                </div>
              </div>
            ) : (
              <div style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px dashed rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.2)', fontFamily: "'Geist Mono', monospace", fontSize: 10, cursor: 'pointer' }}
                onClick={() => onAssign(node)}>
                + Assign person
              </div>
            )
          })() : (
            <div style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px dashed rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.2)', fontFamily: "'Geist Mono', monospace", fontSize: 10, cursor: 'pointer' }}
              onClick={() => onAssign(node)}>
              + Assign person
            </div>
          )}
        </div>

        {PreviewRow}
        {MessageZone}

        {/* Delete */}
        <div
          onClick={() => { onDelete(node.id); onClose() }}
          style={{
            marginTop: 8, padding: 11, borderRadius: 10,
            background: 'rgba(231,76,60,0.07)', border: '1px solid rgba(231,76,60,0.14)',
            color: 'rgba(231,76,60,0.55)', fontFamily: "'Geist Mono', monospace",
            fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
            cursor: 'pointer', textAlign: 'center',
          }}>
          Remove Node
        </div>
      </SheetBody>
      {StartSheetOverlay}
    </>
  )
}

// ── Assign Sheet ───────────────────────────────────────────

function AssignSheet({
  node, crew, accent, onClose, onSelect,
}: {
  node: any; crew: any[]; accent: string; onClose: () => void; onSelect: (nodeId: string, userId: string | null) => void
}) {
  if (!node) return null
  return (
    <>
      <SheetHeader title={`Assign to ${node.label}`} onClose={onClose} />
      <SheetBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Unassign option */}
          {node.assigneeId && (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '9px 12px', borderRadius: 10,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                cursor: 'pointer',
              }}
              onClick={() => { onSelect(node.id, null); onClose() }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', border: '1.5px dashed rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>—</div>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Unassign</span>
            </div>
          )}

          {crew.map((m: any) => {
            const user = m.User ?? m
            const sel = node.assigneeId === (m.userId || user?.id)
            const c = stableColor(user?.name ?? '')
            return (
              <div key={m.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '9px 12px', borderRadius: 10,
                  background: sel ? `${accent}14` : 'rgba(255,255,255,0.03)',
                  border: sel ? `1px solid ${accent}33` : '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer', transition: 'all 0.14s',
                }}
                onClick={() => { onSelect(node.id, m.userId || user?.id); onClose() }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${c}22`, border: `1px solid ${c}44`, color: c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                  {initials(user?.name ?? '?')}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>{user?.name}</div>
                  {m.role && <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 1 }}>{m.role}</div>}
                </div>
                {sel && <span style={{ fontSize: 14, color: accent, flexShrink: 0 }}>✓</span>}
              </div>
            )
          })}
        </div>
      </SheetBody>
    </>
  )
}

// ── Create Node Sheet ──────────────────────────────────────

function CreateNodeSheet({
  accent, onClose, onCreate,
}: {
  accent: string; onClose: () => void; onCreate: (fields: { label: string; type: string; software?: string; notes?: string }) => void
}) {
  const [type, setType] = useState<string>('edit')
  const labelRef = useRef<HTMLInputElement>(null)
  const softwareRef = useRef<HTMLInputElement>(null)
  const notesRef = useRef<HTMLInputElement>(null)

  const submit = () => {
    const label = labelRef.current?.value?.trim()
    if (!label) return
    onCreate({
      label,
      type,
      software: softwareRef.current?.value?.trim() || undefined,
      notes: notesRef.current?.value?.trim() || undefined,
    })
    onClose()
  }

  return (
    <>
      <SheetHeader title="Add Node" onClose={onClose}
        action={<button onClick={submit} style={{ fontSize: 14, fontWeight: 600, color: accent, background: 'none', border: 'none', cursor: 'pointer' }}>Save</button>}
      />
      <SheetBody>
        {/* Type selector */}
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', display: 'block', marginBottom: 8 }}>
            Type
          </span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ALL_TYPES.map(t => {
              const c = TYPE_COLORS[t]
              const sel = t === type
              return (
                <div key={t}
                  onClick={() => setType(t)}
                  style={{
                    fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.08em',
                    textTransform: 'uppercase', padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
                    background: sel ? `${c}1f` : 'transparent',
                    border: sel ? `1px solid ${c}4d` : '1px solid rgba(255,255,255,0.09)',
                    color: sel ? c : 'rgba(255,255,255,0.28)',
                  }}>
                  {TYPE_LABELS[t]}
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', display: 'block', marginBottom: 6 }}>Label</span>
          <input ref={labelRef} placeholder="e.g. Offline Edit" autoFocus
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '11px 14px', fontFamily: "'Geist', sans-serif", fontSize: 14, color: '#fff', outline: 'none' }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', display: 'block', marginBottom: 6 }}>Software</span>
          <input ref={softwareRef} placeholder="e.g. DaVinci Resolve"
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '11px 14px', fontFamily: "'Geist', sans-serif", fontSize: 14, color: '#fff', outline: 'none' }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', display: 'block', marginBottom: 6 }}>Notes</span>
          <input ref={notesRef} placeholder="Any notes about this phase"
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '11px 14px', fontFamily: "'Geist', sans-serif", fontSize: 14, color: '#fff', outline: 'none' }}
          />
        </div>
      </SheetBody>
    </>
  )
}

// ── Deliverable Detail Sheet ───────────────────────────────

function DeliverableDetailSheet({
  del, accent, projectId, onClose, onSave, onDelete, isNew,
}: {
  del: any; accent: string; projectId: string; onClose: () => void; onSave: (id: string | null, fields: any) => void; onDelete?: (id: string) => void; isNew?: boolean
}) {
  const { TriggerIcon, PreviewRow, MessageZone, StartSheetOverlay } = useDetailSheetThreads({
    projectId,
    attachedToType: 'deliverable',
    // When isNew the deliverable doesn't exist yet — null disables the trigger
    // icon. Same pattern used for uncast cast rows.
    attachedToId: del?.id ?? null,
    subjectLabel: del?.title ?? 'Deliverable',
  })
  const titleRef = useRef<HTMLInputElement>(null)
  const lengthRef = useRef<HTMLInputElement>(null)
  const formatRef = useRef<HTMLInputElement>(null)
  const arRef = useRef<HTMLInputElement>(null)
  const resRef = useRef<HTMLInputElement>(null)
  const colorRef = useRef<HTMLInputElement>(null)
  const soundRef = useRef<HTMLInputElement>(null)
  const notesRef = useRef<HTMLInputElement>(null)

  const save = useCallback(() => {
    const fields = {
      title: titleRef.current?.value?.trim() || (del?.title ?? ''),
      length: lengthRef.current?.value?.trim() || null,
      format: formatRef.current?.value?.trim() || null,
      aspectRatio: arRef.current?.value?.trim() || null,
      resolution: resRef.current?.value?.trim() || null,
      colorSpace: colorRef.current?.value?.trim() || null,
      soundSpecs: soundRef.current?.value?.trim() || null,
      notes: notesRef.current?.value?.trim() || null,
    }
    if (!fields.title) return
    onSave(del?.id ?? null, fields)
  }, [del, onSave])

  const fieldLabel = { fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.13em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.25)', display: 'block', marginBottom: 6 }
  const fieldInput = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '11px 14px', fontFamily: "'Geist', sans-serif", fontSize: 14, color: '#fff', outline: 'none' }

  return (
    <>
      <SheetHeader title={isNew ? 'Add Deliverable' : 'Deliverable'} onClose={() => { save(); onClose() }}
        action={
          isNew ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {TriggerIcon}
              <button onClick={() => { save(); onClose() }} style={{ fontSize: 14, fontWeight: 600, color: accent, background: 'none', border: 'none', cursor: 'pointer' }}>Save</button>
            </div>
          ) : TriggerIcon
        }
      />
      <SheetBody>
        <div style={{ marginBottom: 16 }}>
          <span style={fieldLabel}>Title</span>
          <input ref={titleRef} defaultValue={del?.title ?? ''} placeholder="e.g. Main Cut — :60" autoFocus={!!isNew} style={fieldInput} onBlur={!isNew ? save : undefined} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <span style={fieldLabel}>Length</span>
          <input ref={lengthRef} defaultValue={del?.length ?? ''} placeholder="e.g. 01:00, 00:30" style={fieldInput} onBlur={!isNew ? save : undefined} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <span style={fieldLabel}>Format · Aspect Ratio · Resolution</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <input ref={formatRef} defaultValue={del?.format ?? ''} placeholder="Format" style={{ ...fieldInput, flex: 1.4 }} onBlur={!isNew ? save : undefined} />
            <input ref={arRef} defaultValue={del?.aspectRatio ?? ''} placeholder="16:9" style={{ ...fieldInput, flex: 0.8 }} onBlur={!isNew ? save : undefined} />
            <input ref={resRef} defaultValue={del?.resolution ?? ''} placeholder="3840x2160" style={{ ...fieldInput, flex: 1.2 }} onBlur={!isNew ? save : undefined} />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <span style={fieldLabel}>Color Space</span>
          <input ref={colorRef} defaultValue={del?.colorSpace ?? ''} placeholder="e.g. Rec.709, P3 D65" style={fieldInput} onBlur={!isNew ? save : undefined} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <span style={fieldLabel}>Sound Specs</span>
          <input ref={soundRef} defaultValue={del?.soundSpecs ?? ''} placeholder="e.g. Stereo -14 LUFS, 5.1 Mix" style={fieldInput} onBlur={!isNew ? save : undefined} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <span style={fieldLabel}>Notes</span>
          <input ref={notesRef} defaultValue={del?.notes ?? ''} placeholder="Any additional delivery notes" style={fieldInput} onBlur={!isNew ? save : undefined} />
        </div>

        {PreviewRow}
        {MessageZone}

        {!isNew && onDelete && (
          <div
            onClick={() => { onDelete(del.id); onClose() }}
            style={{
              marginTop: 8, padding: 11, borderRadius: 10,
              background: 'rgba(231,76,60,0.07)', border: '1px solid rgba(231,76,60,0.14)',
              color: 'rgba(231,76,60,0.55)', fontFamily: "'Geist Mono', monospace",
              fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
              cursor: 'pointer', textAlign: 'center',
            }}>
            Remove Deliverable
          </div>
        )}
      </SheetBody>
      {StartSheetOverlay}
    </>
  )
}

// ── Page ───────────────────────────────────────────────────

export default function WorkflowPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const { data: project } = useProject(projectId)
  const accent = project?.color || getProjectColor(projectId)
  const { data: crewData } = useCrew(projectId)
  const crew = crewData ?? []

  const { data: nodesData, isLoading: nodesLoading } = useWorkflowNodes(projectId)
  const { data: edgesData, isLoading: edgesLoading } = useWorkflowEdges(projectId)
  const { data: delsData, isLoading: delsLoading } = useDeliverables(projectId)

  const nodes = nodesData ?? []
  const edges = edgesData ?? []
  const deliverables = delsData ?? []
  const isLoading = nodesLoading || edgesLoading || delsLoading

  const threadByWorkflowNodeId = useThreadsByEntity(projectId, 'workflowStage')
  const threadByDeliverableId = useThreadsByEntity(projectId, 'deliverable')

  // Mutations
  const createNode = useCreateWorkflowNode(projectId)
  const updateNode = useUpdateWorkflowNode(projectId)
  const deleteNode = useDeleteWorkflowNode(projectId)
  const createEdge = useCreateWorkflowEdge(projectId)
  const updateEdge = useUpdateWorkflowEdge(projectId)
  const createDel = useCreateDeliverable(projectId)
  const updateDel = useUpdateDeliverable(projectId)
  const deleteDel = useDeleteDeliverable(projectId)

  // Sheet state
  const [selectedNode, setSelectedNode] = useState<any>(null)
  const [assignNode, setAssignNode] = useState<any>(null)
  const [creating, setCreating] = useState(false)
  // Register the + handler with the global ActionBar.
  useFabAction({ onPress: () => { haptic('light'); setCreating(true) } })
  const [selectedDel, setSelectedDel] = useState<any>(null)
  const [creatingDel, setCreatingDel] = useState(false)
  const [openConnector, setOpenConnector] = useState<string | null>(null)

  // Find edge between consecutive nodes (by sortOrder)
  const getEdgeBetween = (sourceId: string, targetId: string) =>
    edges.find((e: any) => e.sourceId === sourceId && e.targetId === targetId)

  // Handlers
  const handleCreateNode = async (fields: { label: string; type: string; software?: string; notes?: string }) => {
    haptic('light')
    const sortOrder = nodes.length
    const newNode = await createNode.mutateAsync({ projectId, ...fields, sortOrder })

    // Auto-create edge from previous node
    if (nodes.length > 0) {
      const prevNode = nodes[nodes.length - 1]
      await createEdge.mutateAsync({ projectId, sourceId: prevNode.id, targetId: newNode.id })
    }
  }

  const handleUpdateNode = (id: string, fields: any) => {
    updateNode.mutate({ id, fields })
  }

  const handleDeleteNode = (id: string) => {
    haptic('light')
    deleteNode.mutate(id)
  }

  const handleAssign = (nodeId: string, userId: string | null) => {
    haptic('light')
    updateNode.mutate({ id: nodeId, fields: { assigneeId: userId } })
  }

  const handleUpdateEdge = (id: string, fields: any) => {
    updateEdge.mutate({ id, fields })
  }

  const handleSaveDel = (id: string | null, fields: any) => {
    haptic('light')
    if (id) {
      updateDel.mutate({ id, fields })
    } else {
      createDel.mutate({ projectId, ...fields, sortOrder: deliverables.length })
    }
  }

  const handleDeleteDel = (id: string) => {
    haptic('light')
    deleteDel.mutate(id)
  }

  // Cinema-glass tokens for screen-root sheen-title / ai-meta-pill consumers
  // (e.g. project status pill in the header). Per-node tiles override these
  // with their own --tag-rgb.
  const [pr, pg, pb] = hexToRgb(accent)
  const glowR = Math.min(255, pr + 20)
  const glowG = Math.min(255, pg + 30)
  const glowB = Math.min(255, pb + 16)

  return (
    <div
      className="screen"
      style={{
        ['--tile-rgb' as string]: `${pr}, ${pg}, ${pb}`,
        ['--accent-rgb' as string]: `${pr}, ${pg}, ${pb}`,
        ['--accent-glow-rgb' as string]: `${glowR}, ${glowG}, ${glowB}`,
      } as React.CSSProperties}
    >
      <PageHeader projectId={projectId} title="Workflow" meta={project ? (
        <div className="flex flex-col items-center gap-1.5">
          <ProjectSwitcher projectId={projectId} projectName={project.name} accentColor={accent} variant="meta" />
          <span className={`ai-meta-pill ${statusToPhase(project.status)}`}>
            <span className="phase-dot" />
            {statusLabel(project.status)}
          </span>
        </div>
      ) : ''} />

      {/* V2: sheen-adjacent count subtitle (.wf-count) per gallery #41. */}
      {nodes.length > 0 && (
        <div className="wf-count" style={{ padding: '6px 24px 2px' }}>
          {nodes.length} Node{nodes.length !== 1 ? 's' : ''}
        </div>
      )}

      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 100 }}>
        {isLoading ? <LoadingState /> : (
          nodes.length === 0 ? (
            /* ── Empty state ── */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, padding: 40 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', border: '1.5px dashed rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 300, color: 'rgba(255,255,255,0.15)' }}>+</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>No workflow yet</div>
              <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.07em', textAlign: 'center', lineHeight: 1.7 }}>
                Map your post workflow —<br />ingest, edit, color, sound, delivery.
              </div>
              <div
                onClick={() => { haptic('light'); setCreating(true) }}
                style={{
                  marginTop: 8, padding: '10px 24px', borderRadius: 24,
                  background: `${accent}26`, border: `1px solid ${accent}4d`,
                  color: accent, fontFamily: "'Geist Mono', monospace",
                  fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
                }}>
                Add First Node
              </div>
            </div>
          ) : (
            (() => {
              // V2: nest deliverables under the Final Delivery node when
              // the last node carries type='delivery' AND there are
              // deliverables — gallery anatomy. The standalone Deliverables
              // section below stays so the data is editable for projects
              // whose chains don't end with a delivery node, and so the
              // create affordance has a stable home.
              const lastNode = nodes[nodes.length - 1]
              const nestUnderLast = lastNode && lastNode.type === 'delivery' && deliverables.length > 0
              return (
              <>
                {/* ── Flow chain ── */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 0, padding: '8px 24px 0' }}>
                  {nodes.map((node: any, i: number) => (
                    <div key={node.id} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                      <NodeCard
                        node={node}
                        crew={crew}
                        onTap={(n) => { haptic('light'); setSelectedNode(n) }}
                        onAssign={(n) => { haptic('light'); setAssignNode(n) }}
                        threadEntry={threadByWorkflowNodeId.get(node.id)}
                      />
                      {nestUnderLast && i === nodes.length - 1 && (
                        <div className="wf-node-deliverables">
                          <span className="wf-node-deliverables-label">
                            Deliverables · {deliverables.length}
                          </span>
                          {deliverables.map((d: any) => {
                            const specs = [d.format, d.resolution, d.aspectRatio].filter(Boolean).join(' · ')
                            return (
                              <div
                                key={d.id}
                                className="wf-node-deliverable-row"
                                onClick={() => { haptic('light'); setSelectedDel(d) }}
                              >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div className="wf-node-deliverable-name">{d.title}</div>
                                  {specs && <div className="wf-node-deliverable-specs">{specs}</div>}
                                </div>
                                <div className="wf-node-deliverable-runtime">{d.length || '—'}</div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {i < nodes.length - 1 && (
                        <Connector
                          edge={getEdgeBetween(node.id, nodes[i + 1].id)}
                          accent={accent}
                          openId={openConnector}
                          onToggle={(id) => setOpenConnector(prev => prev === id ? null : id)}
                          onUpdateEdge={handleUpdateEdge}
                        />
                      )}
                    </div>
                  ))}

                  {/* Add node button */}
                  <div
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 14, cursor: 'pointer' }}
                    onClick={() => { haptic('light'); setCreating(true) }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', border: '1.5px dashed rgba(255,255,255,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20, fontWeight: 300, color: 'rgba(255,255,255,0.2)', transition: 'all 0.15s',
                    }}>+</div>
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)' }}>
                      Add Node
                    </span>
                  </div>
                </div>

                {/* ── Deliverables section ── */}
                <div style={{ margin: '24px 24px 0', paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span className="sheen-title" style={{ fontSize: '0.84rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
                      Deliverables
                    </span>
                    <span
                      style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: accent, cursor: 'pointer', opacity: 0.7 }}
                      onClick={() => { haptic('light'); setCreatingDel(true) }}>
                      + Add
                    </span>
                  </div>

                  {deliverables.length === 0 ? (
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        padding: '14px 12px', borderRadius: 12,
                        border: '1.5px dashed rgba(255,255,255,0.08)', cursor: 'pointer',
                      }}
                      onClick={() => { haptic('light'); setCreatingDel(true) }}>
                      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.18)' }}>
                        + Add first deliverable
                      </span>
                    </div>
                  ) : (
                    deliverables.map((d: any) => (
                      <DeliverableRow key={d.id} del={d} onTap={(del) => { haptic('light'); setSelectedDel(del) }} threadEntry={threadByDeliverableId.get(d.id)} />
                    ))
                  )}
                </div>
              </>
              )
            })()
          )
        )}
      </div>

      {/* ── Sheets ── */}

      {/* Node detail */}
      <Sheet open={!!selectedNode} onClose={() => setSelectedNode(null)} maxHeight="88vh">
        <NodeDetailSheet
          node={selectedNode}
          crew={crew}
          accent={accent}
          projectId={projectId}
          onClose={() => setSelectedNode(null)}
          onSave={handleUpdateNode}
          onDelete={handleDeleteNode}
          onAssign={(n) => { setSelectedNode(null); setTimeout(() => setAssignNode(n), 300) }}
        />
      </Sheet>

      {/* Assign person */}
      <Sheet open={!!assignNode} onClose={() => setAssignNode(null)}>
        <AssignSheet
          node={assignNode}
          crew={crew}
          accent={accent}
          onClose={() => setAssignNode(null)}
          onSelect={handleAssign}
        />
      </Sheet>

      {/* Create node */}
      <Sheet open={creating} onClose={() => setCreating(false)}>
        <CreateNodeSheet
          accent={accent}
          onClose={() => setCreating(false)}
          onCreate={handleCreateNode}
        />
      </Sheet>

      {/* Deliverable detail */}
      <Sheet open={!!selectedDel} onClose={() => setSelectedDel(null)} maxHeight="88vh">
        <DeliverableDetailSheet
          del={selectedDel}
          accent={accent}
          projectId={projectId}
          onClose={() => setSelectedDel(null)}
          onSave={handleSaveDel}
          onDelete={handleDeleteDel}
        />
      </Sheet>

      {/* Create deliverable */}
      <Sheet open={creatingDel} onClose={() => setCreatingDel(false)} maxHeight="88vh">
        <DeliverableDetailSheet
          del={null}
          accent={accent}
          projectId={projectId}
          isNew
          onClose={() => setCreatingDel(false)}
          onSave={handleSaveDel}
        />
      </Sheet>

      {/* + handler registered above via useFabAction. ActionBar is mounted globally. */}
    </div>
  )
}
