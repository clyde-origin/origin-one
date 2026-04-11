'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import { useCrew, useAllCrew, useAddCrewMember, useRemoveCrewMember, useUpdateCrewMember } from '@/lib/hooks/useOriginOne'
import { CrewAvatar } from '@/components/ui'
import { haptic } from '@/lib/utils/haptics'
import { DEPT_COLORS, DEPARTMENTS } from '@/lib/utils/phase'
import { pickGradient } from '@/lib/utils/gradients'
import type { CrewMember } from '@/types'

const spring = { type: 'spring' as const, stiffness: 400, damping: 40 }

// ── LAYER 2A: CREW MEMBER DETAIL ─────────────────────────

function CrewDetail({ member, accent, projectId, onBack, onRemoved }: {
  member: CrewMember; accent: string; projectId: string; onBack: () => void; onRemoved: () => void
}) {
  const update = useUpdateCrewMember(projectId)
  const remove = useRemoveCrewMember(projectId)
  const [showConfirm, setShowConfirm] = useState(false)
  const [phone, setPhone] = useState((member as any).phone ?? '')
  const [email, setEmail] = useState((member as any).email ?? '')
  const [handle, setHandle] = useState((member as any).handle ?? '')
  const [notes, setNotes] = useState((member as any).notes ?? '')

  const saveField = (fields: Record<string, string>) => {
    update.mutate({ id: member.id, fields })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center px-5 pt-4 pb-3 gap-3 flex-shrink-0">
        <button onClick={onBack} className="flex items-center justify-center w-11 h-11 -ml-2 active:opacity-60">
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div className="flex-1" />
      </div>

      {/* Profile */}
      <div className="flex flex-col items-center px-5 pb-5 flex-shrink-0">
        <CrewAvatar first={member.first} last={member.last} color1={member.color1} color2={member.color2} size={56} />
        <div className="mt-3 text-center">
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#dddde8' }}>{member.first} {member.last}</div>
          <div className="text-text2 mt-0.5" style={{ fontSize: '0.82rem' }}>{member.role}</div>
          <span className="font-mono inline-block mt-2" style={{
            fontSize: '0.46rem', letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: 4,
            background: `${DEPT_COLORS[member.dept] ?? '#62627a'}18`,
            color: DEPT_COLORS[member.dept] ?? '#62627a',
          }}>{member.dept}</span>
        </div>
      </div>

      {/* Contact fields */}
      <div className="flex-1 overflow-y-auto px-5" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <ContactField icon="phone" label="Phone" value={phone}
            placeholder="Add phone" onChange={setPhone}
            onBlur={() => saveField({ phone })}
            href={phone ? `tel:${phone}` : undefined} />
          <ContactField icon="email" label="Email" value={email}
            placeholder="Add email" onChange={setEmail}
            onBlur={() => saveField({ email })}
            href={email ? `mailto:${email}` : undefined} />
          <ContactField icon="handle" label="Handle" value={handle}
            placeholder="Add handle" onChange={setHandle}
            onBlur={() => saveField({ handle })} />
        </div>

        {/* Notes */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 14, marginTop: 4 }}>
          <div className="font-mono uppercase" style={{ fontSize: '0.52rem', letterSpacing: '0.2em', color: '#62627a', marginBottom: 8 }}>Notes</div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={() => saveField({ notes })}
            placeholder="Add notes about this crew member..."
            className="w-full outline-none resize-none text-text"
            style={{
              minHeight: 80, background: 'transparent', fontSize: '0.82rem',
              lineHeight: 1.6, border: 'none',
            }}
          />
        </div>
      </div>

      {/* Remove */}
      <div className="flex-shrink-0 px-5 pb-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        {!showConfirm ? (
          <button onClick={() => { haptic('light'); setShowConfirm(true) }}
            className="w-full py-3 text-center active:opacity-60" style={{ fontSize: '0.82rem', color: '#e8564a' }}>
            Remove from project
          </button>
        ) : (
          <div className="py-3">
            <p className="text-center mb-3" style={{ fontSize: '0.78rem', color: '#dddde8' }}>
              Remove {member.first} from this project?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 rounded-lg font-semibold active:opacity-80"
                style={{ fontSize: '0.78rem', background: 'rgba(255,255,255,0.06)', color: '#a0a0b8' }}>
                Cancel
              </button>
              <button onClick={() => { haptic('warning'); remove.mutate(member.id); onRemoved() }}
                className="flex-1 py-3 rounded-lg font-semibold active:opacity-80"
                style={{ fontSize: '0.78rem', background: 'rgba(232,86,74,0.12)', color: '#e8564a' }}>
                Remove
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ContactField({ icon, label, value, placeholder, onChange, onBlur, href }: {
  icon: string; label: string; value: string; placeholder: string
  onChange: (v: string) => void; onBlur: () => void; href?: string
}) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const iconSvg = icon === 'phone'
    ? <><path d="M3 1.5h8a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1v-9a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" /><circle cx="7" cy="10.5" r="0.7" fill="currentColor" /></>
    : icon === 'email'
    ? <path d="M2 3h10v8H2V3zm0 0l5 4 5-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    : <path d="M7 1v3M4.5 2.5l1 1.7M9.5 2.5l-1 1.7M4 6.5c0-1.7 1.3-3 3-3s3 1.3 3 3v1a1 1 0 01-1 1H5a1 1 0 01-1-1v-1zM5 9v3M9 9v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />

  return (
    <div className="flex items-center gap-3 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-muted flex-shrink-0">{iconSvg}</svg>
      {editing ? (
        <input ref={inputRef} value={value} onChange={e => onChange(e.target.value)}
          onBlur={() => { setEditing(false); onBlur() }}
          className="flex-1 outline-none bg-transparent text-text"
          style={{ fontSize: '0.82rem' }} />
      ) : (
        <div className="flex-1 cursor-pointer min-h-[44px] flex items-center"
          onClick={() => {
            if (value && href) { window.open(href, '_self') }
            else { setEditing(true) }
          }}>
          <span style={{ fontSize: '0.82rem', color: value ? '#dddde8' : '#62627a' }}>
            {value || placeholder}
          </span>
        </div>
      )}
    </div>
  )
}

// ── LAYER 2B: ADD NEW MEMBER ─────────────────────────────

function AddNewMember({ accent, projectId, crewCount, onBack, onAdded }: {
  accent: string; projectId: string; crewCount: number; onBack: () => void; onAdded: () => void
}) {
  const addMember = useAddCrewMember(projectId)
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [role, setRole] = useState('')
  const [dept, setDept] = useState('Production')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  const canSave = first.trim().length > 0 && role.trim().length > 0

  const handleSave = () => {
    if (!canSave) return
    haptic('medium')
    const g = pickGradient(crewCount)
    addMember.mutate({
      projectId, first: first.trim(), last: last.trim(), role: role.trim(),
      dept, color1: g.color1, color2: g.color2,
      phone: phone.trim(), email: email.trim(),
      allergies: '', dealMemoUrl: '', notes: '', avatarUrl: '',
      displayOrder: crewCount, createdAt: new Date().toISOString(),
    })
    onAdded()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-5 pt-4 pb-3 gap-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={onBack} className="flex items-center justify-center w-11 h-11 -ml-2 active:opacity-60">
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#dddde8', flex: 1 }}>New Crew Member</span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-4" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="flex flex-col gap-4">
          <FormField label="First Name" value={first} onChange={setFirst} placeholder="First name" />
          <FormField label="Last Name" value={last} onChange={setLast} placeholder="Last name" />
          <FormField label="Role" value={role} onChange={setRole} placeholder="e.g. Director of Photography" />
          <div>
            <div className="font-mono uppercase" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Department</div>
            <div className="flex flex-wrap gap-1.5">
              {DEPARTMENTS.map(d => (
                <button key={d} onClick={() => setDept(d)} className="font-mono uppercase cursor-pointer"
                  style={{
                    fontSize: '0.42rem', letterSpacing: '0.05em', padding: '5px 8px', borderRadius: 16,
                    background: dept === d ? `${DEPT_COLORS[d] ?? '#62627a'}18` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${dept === d ? `${DEPT_COLORS[d] ?? '#62627a'}40` : 'rgba(255,255,255,0.05)'}`,
                    color: dept === d ? (DEPT_COLORS[d] ?? '#62627a') : '#62627a',
                  }}>{d}</button>
              ))}
            </div>
          </div>
          <FormField label="Phone" value={phone} onChange={setPhone} placeholder="Optional" />
          <FormField label="Email" value={email} onChange={setEmail} placeholder="Optional" />
        </div>
      </div>

      <div className="flex-shrink-0 px-5 pt-3 pb-2">
        <button onClick={handleSave} disabled={!canSave}
          className="w-full py-3.5 rounded-xl font-bold active:scale-[0.98] disabled:opacity-30 transition-all"
          style={{ fontSize: '0.82rem', background: accent, color: '#04040a', minHeight: 44 }}>
          Add to Project
        </button>
      </div>
    </div>
  )
}

function FormField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string
}) {
  return (
    <div>
      <div className="font-mono uppercase" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        autoComplete="off" spellCheck={false}
        className="w-full outline-none focus:border-white/20"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7, padding: '10px 12px', color: '#dddde8', fontSize: '0.82rem' }} />
    </div>
  )
}

// ── LAYER 2C: FROM PAST PROJECTS ─────────────────────────

function PastCrewPicker({ projectId, currentCrewIds, onBack, onAdded }: {
  projectId: string; currentCrewIds: Set<string>; onBack: () => void; onAdded: () => void
}) {
  const { data: allCrew } = useAllCrew()
  const addMember = useAddCrewMember(projectId)
  const [search, setSearch] = useState('')
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())

  const otherCrew = (allCrew ?? []).filter(c => c.projectId !== projectId)

  // Group by project, filter by search
  const filtered = search.trim()
    ? otherCrew.filter(c => `${c.first} ${c.last} ${c.role}`.toLowerCase().includes(search.toLowerCase()))
    : otherCrew

  const grouped = filtered.reduce<Record<string, { name: string; members: (typeof otherCrew[0])[] }>>((acc, c) => {
    const key = c.projectId
    if (!acc[key]) acc[key] = { name: (c as any).projectName ?? 'Unknown', members: [] }
    acc[key].members.push(c)
    return acc
  }, {})

  const isOnProject = (c: typeof otherCrew[0]) => {
    // Check by name match since IDs differ across projects
    return currentCrewIds.has(c.id) || addedIds.has(`${c.first}-${c.last}`)
  }

  const handleAdd = (c: typeof otherCrew[0]) => {
    haptic('light')
    addMember.mutate({
      projectId, first: c.first, last: c.last, role: c.role,
      dept: c.dept, color1: c.color1, color2: c.color2,
      phone: c.phone || '', email: c.email || '',
      allergies: c.allergies || '', dealMemoUrl: c.dealMemoUrl || '',
      notes: '', avatarUrl: c.avatarUrl || '',
      displayOrder: currentCrewIds.size, createdAt: new Date().toISOString(),
    })
    setAddedIds(prev => new Set(prev).add(`${c.first}-${c.last}`))
    onAdded()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-5 pt-4 pb-3 gap-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={onBack} className="flex items-center justify-center w-11 h-11 -ml-2 active:opacity-60">
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#dddde8', flex: 1 }}>Past Crew</span>
      </div>

      {/* Search */}
      <div className="px-5 pt-3 pb-2 flex-shrink-0">
        <div className="relative">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or role..."
            autoComplete="off" spellCheck={false}
            className="w-full outline-none focus:border-white/20 font-mono"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7, padding: '10px 12px 10px 34px', color: '#dddde8', fontSize: '0.76rem' }} />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3" />
            <path d="M8.5 8.5L11.5 11.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted w-6 h-6 flex items-center justify-center">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        {Object.entries(grouped).map(([projId, group]) => (
          <div key={projId}>
            <div className="flex items-center gap-2 px-5 pt-4 pb-2">
              <div className="rounded-full flex-shrink-0" style={{ width: 5, height: 5, background: '#6470f3' }} />
              <span className="font-mono uppercase" style={{ fontSize: '0.52rem', letterSpacing: '0.2em', color: '#62627a' }}>
                {group.name}
              </span>
            </div>
            {group.members.map(c => {
              const already = isOnProject(c)
              return (
                <div key={c.id}
                  className={`flex items-center gap-3 px-5 py-2.5 ${already ? 'opacity-40' : 'cursor-pointer active:bg-white/[0.03]'}`}
                  onClick={() => { if (!already) handleAdd(c) }}
                  style={{ minHeight: 44 }}>
                  <CrewAvatar first={c.first} last={c.last} color1={c.color1} color2={c.color2} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-text truncate" style={{ fontSize: '0.82rem', fontWeight: 600 }}>{c.first} {c.last}</div>
                    <div className="text-text2" style={{ fontSize: '0.7rem' }}>{c.role}</div>
                  </div>
                  {already && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
                      <path d="M3 7l3 3 5-6" stroke="#00b894" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              )
            })}
          </div>
        ))}
        {Object.keys(grouped).length === 0 && (
          <div className="flex items-center justify-center py-12">
            <span className="font-mono text-muted" style={{ fontSize: '0.52rem', letterSpacing: '0.1em' }}>
              {search ? 'No matches' : 'No crew from other projects'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── CREW ROW (shared) ────────────────────────────────────

function CrewRow({ member, onTap }: { member: CrewMember; onTap: () => void }) {
  const [swiped, setSwiped] = useState(false)

  return (
    <div className="relative overflow-hidden" style={{ minHeight: 44 }}>
      {/* Swipe reveal */}
      {swiped && (
        <div className="absolute right-0 top-0 bottom-0 flex items-center pr-4" style={{ background: 'rgba(232,86,74,0.15)' }}>
          <span className="font-mono uppercase" style={{ fontSize: '0.46rem', color: '#e8564a', letterSpacing: '0.06em' }}>Remove</span>
        </div>
      )}
      <motion.div
        className="flex items-center gap-3 px-5 py-2.5 cursor-pointer active:bg-white/[0.03] relative bg-surface"
        style={{ minHeight: 44 }}
        drag="x" dragConstraints={{ left: -80, right: 0 }} dragElastic={0.1}
        onDragEnd={(_, info: PanInfo) => setSwiped(info.offset.x < -40)}
        onClick={() => { if (!swiped) onTap(); else setSwiped(false) }}
      >
        <CrewAvatar first={member.first} last={member.last} color1={member.color1} color2={member.color2} size={36} />
        <div className="flex-1 min-w-0">
          <div className="text-text truncate" style={{ fontSize: '0.86rem', fontWeight: 600 }}>{member.first} {member.last}</div>
          <div className="text-text2" style={{ fontSize: '0.74rem' }}>{member.role}</div>
        </div>
        <span className="font-mono flex-shrink-0" style={{
          fontSize: '0.44rem', letterSpacing: '0.06em', textTransform: 'uppercase',
          padding: '3px 7px', borderRadius: 4,
          background: `${DEPT_COLORS[member.dept] ?? '#62627a'}18`,
          color: DEPT_COLORS[member.dept] ?? '#62627a',
        }}>{member.dept}</span>
      </motion.div>
    </div>
  )
}

// ── MAIN CREW PANEL ──────────────────────────────────────

type Layer = 'list' | 'detail' | 'add' | 'past'

export function CrewPanel({ open, projectId, accent, onClose }: {
  open: boolean; projectId: string; accent: string; onClose: () => void
}) {
  const { data: crew } = useCrew(projectId)
  const allCrew = crew ?? []
  const [layer, setLayer] = useState<Layer>('list')
  const [selectedMember, setSelectedMember] = useState<CrewMember | null>(null)

  // Reset to list when panel opens
  useEffect(() => {
    if (open) { setLayer('list'); setSelectedMember(null) }
  }, [open])

  const currentCrewIds = new Set(allCrew.map(c => c.id))

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-51 bg-surface rounded-t-[20px] border-t border-border2 flex flex-col"
            style={{
              top: 100,
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              zIndex: 51,
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={spring}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info: PanInfo) => {
              if (info.offset.y > 100 || info.velocity.y > 500) onClose()
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-0 flex-shrink-0">
              <div className="w-9 h-1 rounded-full bg-white/10" />
            </div>

            {/* Layer 1 — Crew List */}
            <motion.div
              className="flex flex-col flex-1 min-h-0"
              animate={{
                x: layer !== 'list' ? -20 : 0,
                opacity: layer !== 'list' ? 0 : 1,
              }}
              transition={{ duration: 0.2 }}
              style={{ display: layer === 'list' ? 'flex' : 'none' }}
            >
              {/* Header */}
              <div className="flex items-center px-5 pt-3 pb-3 flex-shrink-0">
                <div className="flex-1">
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#dddde8' }}>Crew</div>
                  <div className="font-mono" style={{ fontSize: '0.48rem', color: '#62627a', marginTop: 2 }}>{allCrew.length} members</div>
                </div>
                <button onClick={onClose} className="text-muted w-11 h-11 flex items-center justify-center active:opacity-60">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                </button>
              </div>

              {/* Crew list */}
              <div className="flex-1 overflow-y-auto min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
                {allCrew.map(m => (
                  <CrewRow key={m.id} member={m} onTap={() => { haptic('light'); setSelectedMember(m); setLayer('detail') }} />
                ))}
              </div>

              {/* Add crew buttons */}
              <div className="flex-shrink-0 px-5 pt-3 pb-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex gap-3">
                  <button onClick={() => { haptic('light'); setLayer('add') }}
                    className="flex-1 py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform"
                    style={{ fontSize: '0.78rem', minHeight: 44, border: `1px solid ${accent}40`, color: accent, background: `${accent}0d` }}>
                    + New Member
                  </button>
                  <button onClick={() => { haptic('light'); setLayer('past') }}
                    className="flex-1 py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform"
                    style={{ fontSize: '0.78rem', minHeight: 44, background: 'rgba(255,255,255,0.05)', color: '#a0a0b8' }}>
                    + Past Projects
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Layer 2A — Detail */}
            {layer === 'detail' && selectedMember && (
              <motion.div
                className="flex flex-col flex-1 min-h-0"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                transition={spring}
              >
                <CrewDetail
                  member={selectedMember}
                  accent={accent}
                  projectId={projectId}
                  onBack={() => setLayer('list')}
                  onRemoved={() => { setLayer('list'); setSelectedMember(null) }}
                />
              </motion.div>
            )}

            {/* Layer 2B — Add New */}
            {layer === 'add' && (
              <motion.div
                className="flex flex-col flex-1 min-h-0"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                transition={spring}
              >
                <AddNewMember
                  accent={accent}
                  projectId={projectId}
                  crewCount={allCrew.length}
                  onBack={() => setLayer('list')}
                  onAdded={() => setLayer('list')}
                />
              </motion.div>
            )}

            {/* Layer 2C — Past Projects */}
            {layer === 'past' && (
              <motion.div
                className="flex flex-col flex-1 min-h-0"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                transition={spring}
              >
                <PastCrewPicker
                  projectId={projectId}
                  currentCrewIds={currentCrewIds}
                  onBack={() => setLayer('list')}
                  onAdded={() => { /* stay on past crew screen, row updates via addedIds */ }}
                />
              </motion.div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
