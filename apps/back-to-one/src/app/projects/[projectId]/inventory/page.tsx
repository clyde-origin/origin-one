'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence, type PanInfo } from 'framer-motion'
import {
  useProject, useInventoryItems, useCrew,
  useCreateInventoryItem, useUpdateInventoryItem, useDeleteInventoryItem,
} from '@/lib/hooks/useOriginOne'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProjectSwitcher } from '@/components/ProjectSwitcher'
import { haptic } from '@/lib/utils/haptics'
import { useFabAction } from '@/lib/contexts/FabActionContext'
import { DEPARTMENTS, getProjectColor, statusLabel as projectStatusLabel } from '@/lib/utils/phase'
import { deriveProjectColors, DEFAULT_PROJECT_HEX } from '@origin-one/ui'
import { useDetailSheetThreads } from '@/components/threads/useDetailSheetThreads'
import type { InventoryItem, InventoryItemStatus, TeamMember } from '@/types'

// ── Status palette (BRAND_TOKENS § Inventory Item Status) ─────────────
// Inline per the Locations / Art convention. The phase-color reuse for
// ordered/packed/returned is documented in BRAND_TOKENS.md.
// Alphas match the cinema-glass chip pattern (bg @ 0.10, border @ 0.22,
// color @ 0.9 implied) per DESIGN_LANGUAGE.md status-pill rule.

const STATUS_COLORS: Record<InventoryItemStatus, { color: string; border: string; bg: string }> = {
  needed:   { color: '#e84848', border: 'rgba(232, 72, 72, 0.22)',  bg: 'rgba(232, 72, 72, 0.10)' },
  ordered:  { color: '#e8a020', border: 'rgba(232, 160, 32, 0.22)', bg: 'rgba(232, 160, 32, 0.10)' },
  arrived:  { color: '#4ab8e8', border: 'rgba(74, 184, 232, 0.22)', bg: 'rgba(74, 184, 232, 0.10)' },
  packed:   { color: '#6470f3', border: 'rgba(100, 112, 243, 0.22)', bg: 'rgba(100, 112, 243, 0.10)' },
  returned: { color: '#00b894', border: 'rgba(0, 184, 148, 0.22)',   bg: 'rgba(0, 184, 148, 0.10)' },
}

// V2: --status-rgb triplets feeding `.inv-status-pill` and `.inv-thumb`
// gradients per gallery phone #39. Mirrors STATUS_COLORS hex values.
const STATUS_RGB: Record<InventoryItemStatus, string> = {
  needed:   '232, 72, 72',
  ordered:  '232, 160, 32',
  arrived:  '74, 184, 232',
  packed:   '100, 112, 243',
  returned: '0, 184, 148',
}

const STATUS_LABEL: Record<InventoryItemStatus, string> = {
  needed: 'Needed', ordered: 'Ordered', arrived: 'Arrived', packed: 'Packed', returned: 'Returned',
}

const ALL_STATUSES: InventoryItemStatus[] = ['needed', 'ordered', 'arrived', 'packed', 'returned']

// Tooltip tokens — match the PR #14 disabled-with-tooltip pattern.
const TOOLTIP_BG = '#10101a'
const TOOLTIP_BORDER = 'rgba(255,255,255,0.08)'

// ── Helpers ────────────────────────────────────────────────────────────

// Decompose a #rrggbb hex into a [r,g,b] triplet so the screen root can set
// `--tile-rgb` / `--accent-rgb` / `--accent-glow-rgb` for the cinema-glass
// classes (`glass-tile`, `sheen-title`, `ai-meta-pill`) to consume.
function hexToRgb(hex: string | null | undefined): [number, number, number] {
  const h = (hex && /^#[0-9a-f]{6}$/i.test(hex)) ? hex : '#c45adc'
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}

// Project status → ai-meta-pill phase modifier (.pre / .prod / .post).
// development + pre_production both ride pre amber; archived collapses to
// pre as a neutral fallback (the pill is omitted upstream when project is null).
function statusToPhase(s: string | undefined): 'pre' | 'prod' | 'post' {
  if (s === 'production') return 'prod'
  if (s === 'post_production') return 'post'
  return 'pre'
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '??'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function capitalize(s: string): string {
  if (!s) return s
  return s[0].toUpperCase() + s.slice(1)
}

// ── InventoryItemRow ───────────────────────────────────────────────────
// V2 (reskin/v2-tab-list): inv-row anatomy from gallery phone #39 —
// 52px thumb (status-tinted gradient placeholder; no thumbnail field on
// InventoryItem yet) + inv-info column (name + dept · qty meta) + right
// inv-status-pill driven by --status-rgb. Notes / assignee / source
// are surfaced in the detail sheet rather than the row.
function InventoryItemRow({ item, onTap }: { item: InventoryItem; onTap: () => void }) {
  const rgb = STATUS_RGB[item.status]
  const dept = item.department ?? 'Other'
  const unitLabel = item.quantity === 1 ? 'unit' : 'units'
  return (
    <div onClick={onTap} className="inv-row">
      <div
        className="inv-thumb"
        style={{ ['--thumb-rgb' as string]: rgb }}
      >
        <div className="letterbox-top" />
        <div className="letterbox-bottom" />
      </div>
      <div className="inv-info">
        <div className="inv-name">{item.name}</div>
        <div className="inv-meta">
          {dept} · {item.quantity} {unitLabel}
        </div>
      </div>
      <span
        className="inv-status-pill"
        style={{ ['--status-rgb' as string]: rgb }}
      >
        {STATUS_LABEL[item.status]}
      </span>
    </div>
  )
}

// ── DetailSheet ────────────────────────────────────────────────────────

function InventoryDetailSheet({
  item, isCreate, projectId, allCrew, onClose,
}: {
  item: InventoryItem | null
  isCreate: boolean
  projectId: string
  allCrew: TeamMember[]
  onClose: () => void
}) {
  const createMut = useCreateInventoryItem(projectId)
  const updateMut = useUpdateInventoryItem(projectId)
  const deleteMut = useDeleteInventoryItem(projectId)

  // Thread surface — wired only on edit (no thread before the row exists).
  // attachedToId falls back to '' on create; the hook guards against that.
  const { TriggerIcon, PreviewRow, MessageZone, StartSheetOverlay } = useDetailSheetThreads({
    projectId,
    attachedToType: 'inventoryItem',
    attachedToId: !isCreate && item ? item.id : null,
    subjectLabel: item?.name ?? '',
  })

  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState<number>(1)
  const [department, setDepartment] = useState<string>('Camera')
  const [status, setStatus] = useState<InventoryItemStatus>('needed')
  const [source, setSource] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  useEffect(() => {
    if (item) {
      setName(item.name)
      setQuantity(item.quantity)
      setDepartment(item.department ?? 'Camera')
      setStatus(item.status)
      setSource(item.source ?? '')
      setNotes(item.notes ?? '')
    } else if (isCreate) {
      setName('')
      setQuantity(1)
      setDepartment('Camera')
      setStatus('needed')
      setSource('')
      setNotes('')
    }
  }, [item, isCreate])

  const assigneeId = item?.assigneeId ?? null
  const assignee = useMemo(
    () => allCrew.find(m => m.id === assigneeId) ?? null,
    [allCrew, assigneeId],
  )

  function handleSave() {
    if (!name.trim()) return
    haptic('light')
    if (isCreate) {
      createMut.mutate(
        {
          projectId,
          name: name.trim(),
          quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
          department,
          status,
          source: source.trim() || null,
          notes: notes.trim() || null,
          importSource: 'manual',
          assigneeId: null,
          sortOrder: 0,
        },
        { onSuccess: onClose },
      )
    } else if (item) {
      updateMut.mutate(
        {
          id: item.id,
          fields: {
            name: name.trim(),
            quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
            department,
            status,
            source: source.trim() || null,
            notes: notes.trim() || null,
          },
        },
        { onSuccess: onClose },
      )
    }
  }

  function handleDelete() {
    if (!item) return
    haptic('warning')
    deleteMut.mutate(item.id, { onSuccess: onClose })
  }

  // Role-context line under the assignee name. The schema gives us the
  // ProjectMember.role enum (capitalized) + ProjectMember.department.
  // Reference HTML's "Director of Photography" copy is more granular than
  // the schema supports; this is the honest derivable variant.
  const roleContext = useMemo(() => {
    if (!assignee) return ''
    const role = capitalize(assignee.role)
    const dept = (assignee as TeamMember & { department?: string | null }).department
    return dept ? `${role} · ${dept}` : role
  }, [assignee])

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border)',
    borderRadius: 7, padding: '10px 12px',
    color: 'var(--fg)', fontSize: '0.82rem',
    width: '100%', outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-geist-mono)',
    fontSize: '0.44rem', color: 'var(--fg-mono)',
    letterSpacing: '0.1em', textTransform: 'uppercase',
    display: 'block', marginBottom: 6,
  }

  const subjectLabel = isCreate ? 'New Inventory Item' : 'Inventory Item'

  return (
    <>
      <motion.div
        key="inv-overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
        }}
      />
      <motion.div
        key="inv-sheet"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        drag="y"
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        onDragEnd={(_: any, info: PanInfo) => {
          if (info.offset.y > 100 || info.velocity.y > 500) onClose()
        }}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 61,
          background: '#111',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '24px 24px 0 0',
          height: '88%',
          display: 'flex', flexDirection: 'column',
        }}
        className="no-scrollbar"
      >
        {/* Handle */}
        <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.13)', borderRadius: 2, margin: '12px auto 0', flexShrink: 0 }} />

        {/* Header */}
        <div
          className="flex items-center justify-between flex-shrink-0"
          style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span className="font-mono uppercase" style={{ fontSize: '0.62rem', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)' }}>
            {subjectLabel}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!isCreate && TriggerIcon}
            <button
              onClick={onClose}
              style={{
                fontSize: 14, fontWeight: 600,
                padding: '6px 14px', borderRadius: 20,
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.55)',
                cursor: 'pointer',
              }}
            >Cancel</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div style={{ padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Name */}
            <div>
              <label style={labelStyle}>Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Item name"
                style={{ ...inputStyle, fontSize: '1rem', fontWeight: 600 }}
              />
            </div>

            {/* Quantity + Department */}
            <div className="flex" style={{ gap: 12 }}>
              <div style={{ flex: '0 0 96px' }}>
                <label style={labelStyle}>Qty</label>
                <input
                  type="number" min={1} step={1}
                  value={quantity}
                  onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={labelStyle}>Department</label>
                <select
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
                >
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            {/* Status picker */}
            <div>
              <label style={labelStyle}>Status</label>
              <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>
                {ALL_STATUSES.map(s => {
                  const c = STATUS_COLORS[s]
                  const selected = status === s
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => { haptic('light'); setStatus(s) }}
                      className="font-mono uppercase"
                      style={{
                        fontSize: '0.46rem', letterSpacing: '0.1em',
                        padding: '6px 12px', borderRadius: 20,
                        cursor: 'pointer',
                        background: selected ? c.bg : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${selected ? c.border : 'rgba(255,255,255,0.08)'}`,
                        color: selected ? c.color : 'rgba(255,255,255,0.45)',
                        transition: 'background 0.12s, border 0.12s, color 0.12s',
                      }}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Assigned to (render-only — picker is a follow-up) */}
            <div>
              <label style={labelStyle}>Assigned to</label>
              {assignee ? (
                <div
                  className="flex items-center"
                  style={{
                    gap: 12, padding: '10px 12px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div
                    className="font-mono"
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: 'rgba(255,255,255,0.75)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.62rem', fontWeight: 600,
                    }}
                  >
                    {getInitials(assignee.User.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: '0.78rem', fontWeight: 500, color: '#dddde8' }}>
                      {assignee.User.name}
                    </div>
                    {roleContext && (
                      <div className="font-mono" style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.04em', marginTop: 2 }}>
                        {roleContext}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: '10px 12px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px dashed rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.35)',
                    fontSize: '0.72rem',
                  }}
                >
                  Unassigned
                </div>
              )}
              {/* TODO PR follow-up — wire full assignee picker (search +
                  select from useCrew). Render-only for PR C1. */}
            </div>

            {/* Source */}
            <div>
              <label style={labelStyle}>Source</label>
              <input
                value={source}
                onChange={e => setSource(e.target.value)}
                placeholder="Rental house, owned, purchased…"
                style={inputStyle}
              />
            </div>

            {/* Notes */}
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Anything the team should know about this item"
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
              />
            </div>

            {/* Thread surface — only on edit (no thread before the row exists). */}
            {!isCreate && item && (
              <>
                {PreviewRow}
                {MessageZone}
              </>
            )}

            {/* Destructive */}
            {!isCreate && item && (
              <button
                onClick={handleDelete}
                style={{
                  marginTop: 6,
                  padding: '11px 12px', borderRadius: 8,
                  background: 'transparent',
                  border: '1px solid rgba(232, 72, 72, 0.25)',
                  color: '#e84848',
                  fontSize: '0.72rem', fontWeight: 600,
                  cursor: 'pointer',
                  opacity: deleteMut.isPending ? 0.5 : 1,
                }}
                disabled={deleteMut.isPending}
              >
                Remove from inventory
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end flex-shrink-0"
          style={{
            gap: 10,
            padding: '12px 20px',
            paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: '#111',
          }}
        >
          <button
            onClick={handleSave}
            disabled={!name.trim() || createMut.isPending || updateMut.isPending}
            style={{
              padding: '10px 18px', borderRadius: 20,
              background: name.trim() ? 'rgba(100, 112, 243, 0.16)' : 'rgba(255,255,255,0.04)',
              border: name.trim() ? '1px solid rgba(100, 112, 243, 0.45)' : '1px solid rgba(255,255,255,0.06)',
              color: name.trim() ? '#9ba6ff' : 'rgba(255,255,255,0.3)',
              fontSize: '0.78rem', fontWeight: 600,
              cursor: name.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            {isCreate ? 'Create item' : 'Save changes'}
          </button>
        </div>
      </motion.div>

      {/* Thread "start" sheet — only mounts when the user opens it from the
          TriggerIcon. Lives at sibling depth so it overlays the detail sheet. */}
      {!isCreate && StartSheetOverlay}
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────

export default function InventoryPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const { data: project } = useProject(projectId)
  const { data: items, isLoading } = useInventoryItems(projectId)
  const { data: crew } = useCrew(projectId)

  const colors = deriveProjectColors(project?.color || getProjectColor(projectId) || DEFAULT_PROJECT_HEX)
  const accent = colors.primary
  // Cinema-glass tokens consumed by .glass-tile / .sheen-title / .ai-meta-pill.
  const [pr, pg, pb] = hexToRgb(accent)
  const glowR = Math.min(255, pr + 20)
  const glowG = Math.min(255, pg + 30)
  const glowB = Math.min(255, pb + 16)

  const allItems = (items ?? []) as InventoryItem[]
  const allCrew = (crew ?? []) as TeamMember[]

  const [activeTab, setActiveTab] = useState<string>('Camera')
  const [selected, setSelected] = useState<InventoryItem | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [importHint, setImportHint] = useState(false)

  useFabAction({ onPress: () => { haptic('light'); setShowCreate(true) } })

  const countsByDept = useMemo(() => {
    const m = new Map<string, number>()
    for (const it of allItems) {
      const k = it.department ?? 'Other'
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }, [allItems])

  const tabItems = useMemo(
    () => allItems.filter(i => (i.department ?? 'Other') === activeTab),
    [allItems, activeTab],
  )

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
        title="Inventory"
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

      {/* V2 (reskin/v2-tab-list): page meta line dropped — gallery moves
          counts into the dept-pill row (each pill shows its dept's count
          chip); the total/needed counts are now derivable per-section
          from the inv-section-header groups. */}

      {/* Actions row — Import (disabled w/ tooltip). Add item lives on the global ActionBar +. */}
      <div className="flex flex-shrink-0" style={{ gap: 8, padding: '0 16px 12px' }}>
        <div className="flex-1 relative">
          {importHint && (
            <div
              role="tooltip"
              className="absolute left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap"
              style={{
                bottom: 'calc(100% + 8px)',
                background: TOOLTIP_BG, color: '#dddde8',
                fontSize: 11, lineHeight: 1, padding: '6px 10px',
                borderRadius: 6, border: `1px solid ${TOOLTIP_BORDER}`,
                boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
              }}
            >
              Coming soon — PDF / Excel import
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute', left: '50%', bottom: -4, marginLeft: -4,
                  width: 8, height: 8,
                  background: TOOLTIP_BG,
                  borderRight: `1px solid ${TOOLTIP_BORDER}`,
                  borderBottom: `1px solid ${TOOLTIP_BORDER}`,
                  transform: 'rotate(45deg)',
                }}
              />
            </div>
          )}
          <button
            type="button" disabled aria-disabled="true"
            onMouseEnter={() => setImportHint(true)}
            onMouseLeave={() => setImportHint(false)}
            onTouchStart={() => setImportHint(true)}
            onTouchEnd={() => { window.setTimeout(() => setImportHint(false), 1500) }}
            className="w-full flex items-center justify-center cursor-not-allowed"
            style={{
              gap: 7, padding: '11px 14px', borderRadius: 10,
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.3)',
              fontSize: '0.78rem', fontWeight: 600,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Import PDF / Excel
          </button>
        </div>
      </div>

      {/* Tab bar — 13 departments, horizontal scroll. Active chip uses
          project accent so the whole route reads as project-tinted. */}
      <div
        className="flex-shrink-0 overflow-x-auto no-scrollbar"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex" style={{ gap: 6, padding: '0 16px 12px' }}>
          {DEPARTMENTS.map(d => {
            const count = countsByDept.get(d) ?? 0
            const isActive = activeTab === d
            return (
              <button
                key={d}
                onClick={() => { haptic('light'); setActiveTab(d) }}
                className="font-mono uppercase flex items-center cursor-pointer transition-colors flex-shrink-0"
                style={{
                  gap: 6, padding: '7px 12px', borderRadius: 20,
                  background: isActive ? `rgba(${pr}, ${pg}, ${pb}, 0.12)` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isActive ? `rgba(${pr}, ${pg}, ${pb}, 0.40)` : 'rgba(255,255,255,0.06)'}`,
                  color: isActive ? accent : 'var(--fg-mono)',
                  fontSize: '0.5rem', letterSpacing: '0.08em',
                }}
              >
                {d}
                <span
                  className="font-mono"
                  style={{
                    fontSize: 10,
                    padding: '1px 6px', borderRadius: 9,
                    background: isActive ? `rgba(${pr}, ${pg}, ${pb}, 0.22)` : 'rgba(255,255,255,0.05)',
                    color: isActive ? accent : 'var(--fg-mono)',
                  }}
                >{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Scroll area — V2: items grouped by status within the active
          dept tab. Section headers carry the sheen-extrusion treatment;
          rows live inside .inv-rows. */}
      <div
        className="flex-1 overflow-y-auto no-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch', padding: '4px 16px 100px' }}
      >
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 10 }}>
            {[0, 1, 2].map(i => (
              <div key={i} className="inv-row sk-block" style={{ height: 68 }} />
            ))}
          </div>
        ) : tabItems.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center text-center"
            style={{ gap: 8, padding: '40px 20px' }}
          >
            <div className="font-mono" style={{ fontSize: '0.56rem', color: 'var(--fg-mono)', letterSpacing: '0.06em', lineHeight: 1.6 }}>
              No items in {activeTab} yet.
              <br />
              Tap + to start.
            </div>
          </div>
        ) : (
          ALL_STATUSES.map(s => {
            const sectionItems = tabItems.filter(i => i.status === s)
            if (sectionItems.length === 0) return null
            return (
              <div key={s} className="inv-section">
                <h2 className="inv-section-header">{STATUS_LABEL[s]}</h2>
                <div className="inv-rows">
                  {sectionItems.map(item => (
                    <InventoryItemRow
                      key={item.id}
                      item={item}
                      onTap={() => { haptic('light'); setSelected(item) }}
                    />
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Detail sheet */}
      <AnimatePresence>
        {(selected || showCreate) && (
          <InventoryDetailSheet
            item={selected}
            isCreate={showCreate && !selected}
            projectId={projectId}
            allCrew={allCrew}
            onClose={() => { setSelected(null); setShowCreate(false) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
