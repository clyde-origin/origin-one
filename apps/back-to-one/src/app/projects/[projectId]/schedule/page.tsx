'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useProject, useShootDays, useLocations,
  useCreateShootDay, useUpdateShootDay, useDeleteShootDay,
} from '@/lib/hooks/useOriginOne'
import { PageHeader } from '@/components/ui/PageHeader'
import { haptic } from '@/lib/utils/haptics'
import { useFabAction } from '@/lib/contexts/FabActionContext'
import { getProjectColor, statusHex, statusLabel as projectStatusLabel } from '@/lib/utils/phase'
import { deriveProjectColors, DEFAULT_PROJECT_HEX } from '@origin-one/ui'
import { readStoredViewerRole, type ViewerRole } from '@/lib/utils/viewerIdentity'
import type { ShootDay, ShootDayType, Location } from '@/types'

// ── Phase tokens (BRAND_TOKENS § Phase tints) ──────────────────────────

const PHASE_HEX: Record<ShootDayType, string> = {
  pre:  '#e8a020',
  prod: '#6470f3',
  post: '#00b894',
}

const PHASE_LABEL: Record<ShootDayType, string> = {
  pre:  'Prep',
  prod: 'Shoot',
  post: 'Post',
}

const PHASE_ORDER: ShootDayType[] = ['pre', 'prod', 'post']

// ── Helpers ────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  // 'YYYY-MM-DD' → 'Mon Apr 26' (day-of-week + short month + day, no year — schedule UX is tight & local).
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const date = new Date(Date.UTC(y, m - 1, d))
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()]
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getUTCMonth()]
  return `${dow} ${mon} ${d}`
}

function todayISO(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ── Phase chip ─────────────────────────────────────────────────────────

function PhaseChip({ type }: { type: ShootDayType }) {
  const c = PHASE_HEX[type]
  return (
    <span
      className="font-mono uppercase"
      style={{
        fontSize: '0.42rem', letterSpacing: '0.1em',
        padding: '3px 8px', borderRadius: 20,
        background: `${c}14`, border: `1px solid ${c}59`, color: c,
        flexShrink: 0,
      }}
    >
      {PHASE_LABEL[type]}
    </span>
  )
}

// ── Day row ────────────────────────────────────────────────────────────

function ShootDayRow({
  day, locationName, onTap,
}: {
  day: ShootDay
  locationName: string | null
  onTap: () => void
}) {
  return (
    <button
      type="button"
      onClick={() => { haptic('light'); onTap() }}
      className="w-full text-left active:opacity-80 transition-opacity"
      style={{
        padding: '12px 14px', borderRadius: 14,
        background: 'rgba(10,10,18,0.42)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.07)',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gridTemplateRows: 'auto auto',
        rowGap: 4, columnGap: 8,
        alignItems: 'center',
      }}
    >
      <div style={{ fontSize: '0.85rem', color: '#e8e8f0', fontWeight: 500 }}>
        {formatDate(day.date)}
      </div>
      <PhaseChip type={day.type} />
      <div
        className="font-mono uppercase"
        style={{
          fontSize: '0.42rem', letterSpacing: '0.08em', color: '#62627a',
          gridColumn: '1 / span 2',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {locationName ?? (day.notes ? day.notes : 'No location')}
      </div>
    </button>
  )
}

// ── Add / edit sheet ───────────────────────────────────────────────────

function ShootDayEditSheet({
  mode, day, projectId, locations,
  onClose, onSubmitted,
}: {
  mode: 'create' | 'edit'
  day: ShootDay | null
  projectId: string
  locations: Location[]
  onClose: () => void
  onSubmitted: () => void
}) {
  const [date, setDate] = useState<string>(day?.date ?? todayISO())
  const [type, setType] = useState<ShootDayType>(day?.type ?? 'prod')
  const [locationId, setLocationId] = useState<string | null>(day?.locationId ?? null)
  const [notes, setNotes] = useState<string>(day?.notes ?? '')

  const create = useCreateShootDay(projectId)
  const update = useUpdateShootDay(projectId)
  const del    = useDeleteShootDay(projectId)

  const submit = async () => {
    if (!date) return
    haptic('medium')
    if (mode === 'create') {
      await create.mutateAsync({
        projectId, date, type,
        locationId, notes: notes.trim() || null,
      })
    } else if (day) {
      await update.mutateAsync({
        id: day.id,
        fields: { date, type, locationId, notes: notes.trim() || null },
      })
    }
    onSubmitted()
  }

  const remove = async () => {
    if (!day) return
    if (!confirm('Delete this shoot day?')) return
    haptic('warning')
    await del.mutateAsync(day.id)
    onSubmitted()
  }

  return (
    <motion.div
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 280 }}
      className="fixed inset-x-0 bottom-0 z-50"
      style={{
        background: 'rgba(8,8,14,0.96)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: '20px 18px calc(env(safe-area-inset-bottom, 0px) + 24px)',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}
    >
      {/* Grabber */}
      <div className="self-center" style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }} />

      <div className="font-mono uppercase" style={{ fontSize: '0.50rem', letterSpacing: '0.1em', color: '#9ba6ff' }}>
        {mode === 'create' ? 'Add shoot day' : 'Edit shoot day'}
      </div>

      {/* Date */}
      <label className="flex flex-col" style={{ gap: 6 }}>
        <span className="font-mono uppercase" style={{ fontSize: '0.42rem', letterSpacing: '0.1em', color: '#62627a' }}>Date</span>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="font-mono"
          style={{
            padding: '10px 12px', borderRadius: 10,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#e8e8f0', fontSize: '0.78rem',
          }}
        />
      </label>

      {/* Phase */}
      <div className="flex flex-col" style={{ gap: 6 }}>
        <span className="font-mono uppercase" style={{ fontSize: '0.42rem', letterSpacing: '0.1em', color: '#62627a' }}>Phase</span>
        <div className="flex" style={{ gap: 8 }}>
          {PHASE_ORDER.map(t => {
            const active = type === t
            const c = PHASE_HEX[t]
            return (
              <button
                key={t} type="button"
                onClick={() => { haptic('light'); setType(t) }}
                className="font-mono uppercase flex-1"
                style={{
                  padding: '10px 0', borderRadius: 10,
                  background: active ? `${c}26` : 'rgba(255,255,255,0.04)',
                  border: active ? `1px solid ${c}73` : '1px solid rgba(255,255,255,0.08)',
                  color: active ? c : '#62627a',
                  fontSize: '0.5rem', letterSpacing: '0.1em',
                }}
              >
                {PHASE_LABEL[t]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Location */}
      {locations.length > 0 && (
        <label className="flex flex-col" style={{ gap: 6 }}>
          <span className="font-mono uppercase" style={{ fontSize: '0.42rem', letterSpacing: '0.1em', color: '#62627a' }}>Location (optional)</span>
          <select
            value={locationId ?? ''}
            onChange={e => setLocationId(e.target.value || null)}
            className="font-mono"
            style={{
              padding: '10px 12px', borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#e8e8f0', fontSize: '0.78rem',
            }}
          >
            <option value="">— None —</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
      )}

      {/* Notes */}
      <label className="flex flex-col" style={{ gap: 6 }}>
        <span className="font-mono uppercase" style={{ fontSize: '0.42rem', letterSpacing: '0.1em', color: '#62627a' }}>Notes (optional)</span>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          style={{
            padding: '10px 12px', borderRadius: 10,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#e8e8f0', fontSize: '0.78rem', resize: 'none',
            fontFamily: 'inherit',
          }}
        />
      </label>

      {/* Actions */}
      <div className="flex items-center" style={{ gap: 10, marginTop: 4 }}>
        {mode === 'edit' && (
          <button
            type="button" onClick={remove}
            className="font-mono uppercase"
            style={{
              padding: '10px 14px', borderRadius: 20,
              background: 'rgba(232,72,72,0.10)', border: '1px solid rgba(232,72,72,0.35)',
              color: '#e84848', fontSize: '0.5rem', letterSpacing: '0.1em',
            }}
          >Delete</button>
        )}
        <button
          type="button" onClick={onClose}
          className="font-mono uppercase"
          style={{
            padding: '10px 14px', borderRadius: 20,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#a0a0b8', fontSize: '0.5rem', letterSpacing: '0.1em',
            marginLeft: 'auto',
          }}
        >Cancel</button>
        <button
          type="button" onClick={submit}
          disabled={!date}
          className="font-mono uppercase"
          style={{
            padding: '10px 18px', borderRadius: 20,
            background: date ? 'rgba(100,112,243,0.16)' : 'rgba(255,255,255,0.04)',
            border: date ? '1px solid rgba(100,112,243,0.45)' : '1px solid rgba(255,255,255,0.06)',
            color: date ? '#9ba6ff' : 'rgba(255,255,255,0.3)',
            fontSize: '0.5rem', letterSpacing: '0.1em',
            cursor: date ? 'pointer' : 'not-allowed',
          }}
        >{mode === 'create' ? 'Add' : 'Save'}</button>
      </div>
    </motion.div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────

export default function SchedulePage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const router = useRouter()

  // ── Producer gate (Q8 — pre-Auth viewer-identity shim).
  // Until Supabase Auth lands, role lives in localStorage; readStoredViewerRole()
  // returns null until first useEffect runs. Render nothing pre-hydration to
  // avoid flashing the page to a non-producer.
  const [role, setRole] = useState<ViewerRole | null>(null)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    setRole(readStoredViewerRole())
    setHydrated(true)
  }, [])
  useEffect(() => {
    if (hydrated && role !== 'producer') {
      router.replace(`/projects/${projectId}`)
    }
  }, [hydrated, role, router, projectId])

  const { data: project } = useProject(projectId)
  const { data: shootDays, isLoading } = useShootDays(projectId)
  const { data: locationsRaw } = useLocations(projectId)

  const colors = deriveProjectColors(project?.color || getProjectColor(projectId) || DEFAULT_PROJECT_HEX)
  const accent = colors.primary

  const days = (shootDays ?? []) as ShootDay[]
  const locations = (locationsRaw ?? []) as Location[]
  const locationsById = useMemo(() => {
    const m = new Map<string, Location>()
    for (const l of locations) m.set(l.id, l)
    return m
  }, [locations])

  const counts = useMemo(() => {
    const c: Record<ShootDayType, number> = { pre: 0, prod: 0, post: 0 }
    for (const d of days) c[d.type]++
    return c
  }, [days])

  const [editing, setEditing] = useState<ShootDay | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  useFabAction({
    onPress: () => { haptic('light'); setShowCreate(true) },
    label: 'Add shoot day',
  })

  // Pre-hydration / non-producer: render nothing. The redirect effect above
  // routes them away; rendering null avoids a layout flash.
  if (!hydrated || role !== 'producer') return null

  return (
    <div className="screen">
      <PageHeader
        projectId={projectId}
        title="Schedule"
        meta={project ? (
          <div className="flex flex-col items-center gap-1.5">
            <span style={{ color: accent, fontSize: '0.50rem', letterSpacing: '0.06em' }}>{project.name}</span>
            <span
              className="font-mono uppercase"
              style={{
                fontSize: '0.38rem', padding: '2px 8px', borderRadius: 12,
                background: `${statusHex(project.status)}18`, color: statusHex(project.status),
              }}
            >{projectStatusLabel(project.status)}</span>
          </div>
        ) : ''}
        noBorder
      />

      {/* Phase counts strip */}
      <div
        className="flex items-center justify-center font-mono uppercase flex-shrink-0"
        style={{ gap: 14, padding: '6px 16px 14px', fontSize: '0.5rem', letterSpacing: '0.1em' }}
      >
        {PHASE_ORDER.map(t => (
          <span key={t} style={{ color: counts[t] > 0 ? PHASE_HEX[t] : '#62627a' }}>
            {PHASE_LABEL[t].toUpperCase()} {counts[t]}
          </span>
        ))}
      </div>

      {/* Day list */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          padding: '0 16px 24px',
          display: 'flex', flexDirection: 'column', gap: 8,
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
        }}
      >
        {isLoading && (
          <div className="font-mono uppercase text-center" style={{ fontSize: '0.42rem', letterSpacing: '0.1em', color: '#62627a', padding: '32px 0' }}>
            Loading…
          </div>
        )}
        {!isLoading && days.length === 0 && (
          <div className="text-center" style={{ padding: '40px 8px' }}>
            <div className="font-mono uppercase" style={{ fontSize: '0.5rem', letterSpacing: '0.1em', color: '#62627a', marginBottom: 8 }}>
              No shoot days yet
            </div>
            <div style={{ fontSize: '0.78rem', color: '#a0a0b8' }}>
              Tap + to add prep, shoot, or post days. Day counts feed the budget's schedule globals.
            </div>
          </div>
        )}
        {days.map(day => (
          <ShootDayRow
            key={day.id}
            day={day}
            locationName={day.locationId ? (locationsById.get(day.locationId)?.name ?? null) : null}
            onTap={() => setEditing(day)}
          />
        ))}
      </div>

      <AnimatePresence>
        {showCreate && (
          <ShootDayEditSheet
            key="create"
            mode="create"
            day={null}
            projectId={projectId}
            locations={locations}
            onClose={() => setShowCreate(false)}
            onSubmitted={() => setShowCreate(false)}
          />
        )}
        {editing && (
          <ShootDayEditSheet
            key={editing.id}
            mode="edit"
            day={editing}
            projectId={projectId}
            locations={locations}
            onClose={() => setEditing(null)}
            onSubmitted={() => setEditing(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
