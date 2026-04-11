'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useCrew, useAddCrewMember, useUpdateCrewMember, useAllCrew } from '@/lib/hooks/useOriginOne'
import { CrewAvatar } from '@/components/ui'
import { PageHeader } from '@/components/ui/PageHeader'
import { FAB } from '@/components/ui/FAB'
import { SideFabs } from '@/components/ui/SideFabs'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { haptic } from '@/lib/utils/haptics'
import { DEPARTMENTS, DEPT_COLORS, getProjectColor } from '@/lib/utils/phase'
import { pickGradient } from '@/lib/utils/gradients'
import type { CrewMember } from '@/types'

// ── Department filter tabs ───────────────────────────────

const CREW_TABS = ['All', 'Direction', 'Camera', 'Art', 'Sound', 'Production', 'Post'] as const
type CrewTab = typeof CREW_TABS[number]

function DeptTabs({ active, onChange }: { active: CrewTab; onChange: (t: CrewTab) => void }) {
  return (
    <div className="flex border-b border-border overflow-x-auto" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
      {CREW_TABS.map(t => (
        <button key={t} onClick={() => onChange(t)}
          className="relative flex-shrink-0 px-3 py-3 font-mono uppercase tracking-wider"
          style={{ fontSize: 11, color: active === t ? '#dddde8' : '#62627a', letterSpacing: '0.06em' }}>
          {t}
          {active === t && <div style={{ position: 'absolute', bottom: -1, left: '20%', right: '20%', height: 1.5, background: '#c45adc', borderRadius: 1 }} />}
        </button>
      ))}
    </div>
  )
}

// ── Crew Row ─────────────────────────────────────────────

function CrewRow({ member, onTap }: { member: CrewMember; onTap: (m: CrewMember) => void }) {
  const deptColor = DEPT_COLORS[member.dept] || '#62627a'
  return (
    <div className="flex items-center gap-3.5 px-5 py-2.5 cursor-pointer active:bg-white/[0.02] relative"
      onClick={() => onTap(member)}>
      <CrewAvatar first={member.first} last={member.last} color1={member.color1} color2={member.color2} size={40} online={member.online} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span style={{ fontWeight: 600, fontSize: 14, color: '#dddde8' }}>{member.first} {member.last}</span>
        </div>
        <div className="font-mono" style={{ fontSize: 11, color: '#a0a0b8', marginTop: 2 }}>{member.role}</div>
      </div>
      {/* Divider */}
      <div style={{ position: 'absolute', bottom: 0, left: 68, right: 20, height: 1, background: 'rgba(255,255,255,0.05)' }} />
    </div>
  )
}

// ── Department Header ────────────────────────────────────

function DeptHeader({ dept, count }: { dept: string; count: number }) {
  const dotColor = DEPT_COLORS[dept] || '#62627a'
  return (
    <div className="flex items-center justify-between px-5 pt-3.5 pb-2">
      <div className="flex items-center gap-2">
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor }} />
        <span className="font-mono uppercase tracking-wider" style={{ fontSize: 10, color: '#62627a', letterSpacing: '0.1em' }}>{dept}</span>
      </div>
      <span className="font-mono" style={{ fontSize: 10, color: '#62627a' }}>{count}</span>
    </div>
  )
}

// ── Avatar Strip ─────────────────────────────────────────

function AvatarStrip({ crew, selectedId, onSelect }: {
  crew: CrewMember[]; selectedId: string | null; onSelect: (m: CrewMember) => void
}) {
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0,
      bottom: 'calc(68px + 60px)',
      zIndex: 6,
      padding: '12px 20px 10px',
      background: 'linear-gradient(transparent, rgba(4,4,10,0.96) 28%)',
    }}>
      <div className="font-mono uppercase" style={{ fontSize: 9, color: '#62627a', letterSpacing: '0.1em', marginBottom: 8 }}>Tap to view</div>
      <div className="flex gap-2.5 overflow-x-auto" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {crew.map(m => {
          const isSelected = selectedId === m.id
          return (
            <div key={m.id} className="flex flex-col items-center flex-shrink-0 cursor-pointer" style={{ gap: 4 }}
              onClick={() => { haptic('light'); onSelect(m) }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: `linear-gradient(135deg, ${m.color1}, ${m.color2})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 13, color: '#04040a',
                ...(isSelected ? {
                  outline: '2.5px solid #c45adc', outlineOffset: 2,
                  boxShadow: '0 0 12px rgba(196,90,220,0.4)',
                } : {}),
              }}>
                {m.first[0]}{m.last?.[0] || ''}
              </div>
              <span className="font-mono" style={{ fontSize: 9, color: isSelected ? '#c45adc' : '#62627a' }}>{m.first}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Member Detail Panel ──────────────────────────────────

function MemberPanel({ member, onClose, onUpdate }: {
  member: CrewMember; onClose: () => void
  onUpdate: (id: string, fields: Record<string, string>) => void
}) {
  const [notes, setNotes] = useState(member.notes || '')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  // Reset notes when member changes
  useEffect(() => { setNotes(member.notes || ''); setSaveStatus('idle') }, [member.id, member.notes])

  const handleNotesChange = useCallback((val: string) => {
    setNotes(val)
    setSaveStatus('saving')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onUpdate(member.id, { notes: val })
      setSaveStatus('saved')
    }, 800)
  }, [member.id, onUpdate])

  const fields: { label: string; value: string; isLink?: boolean }[] = [
    { label: 'Phone', value: member.phone || '—', isLink: !!member.phone },
    { label: 'Email', value: member.email || '—', isLink: !!member.email },
    { label: 'Allergies', value: member.allergies || 'None known' },
  ]

  return (
    <motion.div
      initial={{ y: '-100%' }} animate={{ y: 0 }} exit={{ y: '-100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 320 }}
      style={{
        position: 'fixed', left: 0, right: 0, top: 0, zIndex: 8,
        background: '#0d0d1a',
        borderRadius: '0 0 22px 22px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
        maxHeight: 'calc(100% - 180px)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
      {/* Handle */}
      <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, margin: '10px auto 0', flexShrink: 0 }} />

      {/* Header */}
      <div className="flex items-center gap-3.5" style={{ padding: '12px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <div style={{
          width: 50, height: 50, borderRadius: '50%',
          background: `linear-gradient(135deg, ${member.color1}, ${member.color2})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 16, color: '#04040a', flexShrink: 0,
        }}>
          {member.first[0]}{member.last?.[0] || ''}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: '#dddde8' }}>{member.first} {member.last}</div>
          <div className="font-mono" style={{ fontSize: 11, color: '#a0a0b8', marginTop: 2 }}>{member.role} · {member.dept}</div>
        </div>
        <button onClick={onClose}
          style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#62627a', fontSize: 14, flexShrink: 0, border: 'none' }}>
          ×
        </button>
      </div>

      {/* Fields */}
      <div style={{ overflowY: 'auto', scrollbarWidth: 'none' }}>
        {fields.map(f => (
          <div key={f.label} className="flex items-start justify-between" style={{ padding: '11px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span className="font-mono uppercase" style={{ fontSize: 10, color: '#62627a', letterSpacing: '0.08em', paddingTop: 1, flexShrink: 0 }}>{f.label}</span>
            <span style={{ fontSize: 13, color: f.isLink ? '#c45adc' : '#a0a0b8', textAlign: 'right', maxWidth: 220 }}>{f.value}</span>
          </div>
        ))}

        {/* Notes */}
        <div style={{ padding: '11px 20px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span className="font-mono uppercase" style={{ fontSize: 10, color: '#62627a', letterSpacing: '0.08em' }}>Notes</span>
          <textarea
            value={notes}
            onChange={e => handleNotesChange(e.target.value)}
            placeholder="Add notes..."
            style={{
              width: '100%', fontSize: 13, color: '#a0a0b8',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 8, padding: '9px 12px', resize: 'none', outline: 'none',
              lineHeight: 1.5, minHeight: 60, fontFamily: 'inherit',
            }}
          />
          {saveStatus !== 'idle' && (
            <div className="font-mono" style={{ fontSize: 9, color: saveStatus === 'saved' ? 'rgba(0,184,148,0.5)' : 'rgba(255,255,255,0.2)', textAlign: 'right' }}>
              {saveStatus === 'saved' ? 'Saved ✓' : 'Saving...'}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ── Add New Member Sheet ─────────────────────────────────

const DEPT_OPTIONS = ['Direction', 'Camera', 'Art', 'Sound', 'Production', 'Post'] as const

function NewMemberSheet({ projectId, crewCount, onClose, onCreate }: {
  projectId: string; crewCount: number; onClose: () => void
  onCreate: (data: Omit<CrewMember, 'id' | 'online'>) => void
}) {
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [role, setRole] = useState('')
  const [dept, setDept] = useState<string>('Direction')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [allergies, setAllergies] = useState('')

  const handleSubmit = () => {
    if (!first.trim()) return
    const { color1, color2 } = pickGradient(crewCount)
    onCreate({
      projectId, first: first.trim(), last: last.trim(),
      role: role.trim() || 'Crew', dept,
      color1, color2, phone, email, allergies,
      dealMemoUrl: '', notes: '', avatarUrl: '',
      displayOrder: crewCount,
      createdAt: new Date().toISOString(),
    })
    onClose()
  }

  const fieldStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '13px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)',
  } as const
  const inputStyle = {
    fontFamily: 'inherit', fontSize: 13, color: '#dddde8',
    background: 'none', border: 'none', outline: 'none', textAlign: 'right' as const, maxWidth: 200,
  }
  const labelStyle = { fontFamily: 'var(--font-mono)', fontSize: 11, color: '#62627a', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }

  return (
    <>
      <SheetHeader title="New Crew Member" onClose={onClose} />
      <SheetBody className="!px-0 !pt-0">
        <div style={{ overflowY: 'auto', scrollbarWidth: 'none' }}>
          <div style={fieldStyle}>
            <span style={labelStyle}>Name</span>
            <input autoFocus value={first} onChange={e => setFirst(e.target.value)} placeholder="First" style={{ ...inputStyle, maxWidth: 90 }} />
            <input value={last} onChange={e => setLast(e.target.value)} placeholder="Last" style={{ ...inputStyle, maxWidth: 90 }} />
          </div>
          <div style={fieldStyle}>
            <span style={labelStyle}>Role</span>
            <input value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. 1st AC" style={inputStyle} />
          </div>
          <div style={{ padding: '12px 24px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="font-mono uppercase block" style={{ fontSize: 10, color: '#62627a', letterSpacing: '0.08em', marginBottom: 8 }}>Department</span>
            <div className="flex flex-wrap gap-1.5">
              {DEPT_OPTIONS.map(d => (
                <button key={d} onClick={() => setDept(d)}
                  className="font-mono"
                  style={{
                    fontSize: 10, padding: '4px 12px', borderRadius: 20, cursor: 'pointer', border: 'none',
                    background: dept === d ? 'rgba(196,90,220,0.15)' : 'rgba(255,255,255,0.04)',
                    borderWidth: 1, borderStyle: 'solid',
                    borderColor: dept === d ? 'rgba(196,90,220,0.35)' : 'rgba(255,255,255,0.08)',
                    color: dept === d ? '#c45adc' : '#62627a',
                  }}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div style={fieldStyle}>
            <span style={labelStyle}>Phone</span>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (000) 000-0000" type="tel" style={inputStyle} />
          </div>
          <div style={fieldStyle}>
            <span style={labelStyle}>Email</span>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@domain.com" type="email" style={inputStyle} />
          </div>
          <div style={fieldStyle}>
            <span style={labelStyle}>Allergies</span>
            <input value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="None" style={inputStyle} />
          </div>
        </div>
        <div className="flex gap-2.5" style={{ padding: '18px 24px 0' }}>
          <button onClick={onClose}
            style={{
              flex: 1, height: 44, borderRadius: 9,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              color: '#a0a0b8', fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}>Cancel</button>
          <button onClick={handleSubmit} disabled={!first.trim()}
            style={{
              flex: 2, height: 44, borderRadius: 9,
              background: 'rgba(196,90,220,0.15)', border: '1px solid rgba(196,90,220,0.35)',
              color: '#c45adc', fontWeight: 600, fontSize: 14, cursor: 'pointer',
              opacity: first.trim() ? 1 : 0.4,
            }}>Add to Crew</button>
        </div>
      </SheetBody>
    </>
  )
}

// ── Add Existing Sheet ───────────────────────────────────

function AddExistingSheet({ projectId, currentCrew, onClose, onAdd }: {
  projectId: string; currentCrew: CrewMember[]; onClose: () => void
  onAdd: (member: Omit<CrewMember, 'id' | 'online'>) => void
}) {
  const { data: allCrew } = useAllCrew()
  const [tab, setTab] = useState<string>('All')

  const currentIds = new Set(currentCrew.map(c => `${c.first}-${c.last}-${c.role}`))
  const otherCrew = (allCrew ?? []).filter(c => c.projectId !== projectId)

  // Deduplicate by name+role
  const deduped = Array.from(
    otherCrew.reduce((map, c) => {
      const key = `${c.first}-${c.last}-${c.role}`
      if (!map.has(key)) map.set(key, c)
      return map
    }, new Map<string, typeof otherCrew[0]>()).values()
  )

  const filtered = tab === 'All' ? deduped : deduped.filter(c => c.dept === tab)
  const alreadyAdded = (id: string, c: typeof deduped[0]) => currentIds.has(`${c.first}-${c.last}-${c.role}`)

  return (
    <>
      <SheetHeader title="Add Existing Crew" onClose={onClose} />
      {/* Dept tabs */}
      <div className="flex overflow-x-auto border-b border-border" style={{ scrollbarWidth: 'none', padding: '0 16px' }}>
        {['All', ...DEPT_OPTIONS].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="relative flex-shrink-0 font-mono uppercase"
            style={{ padding: '10px 12px', fontSize: 10, color: tab === t ? '#dddde8' : '#62627a', letterSpacing: '0.06em', background: 'none', border: 'none' }}>
            {t}
            {tab === t && <div style={{ position: 'absolute', bottom: -1, left: '10%', right: '10%', height: 1.5, background: '#c45adc', borderRadius: 1 }} />}
          </button>
        ))}
      </div>
      <SheetBody className="!px-0">
        <div style={{ overflowY: 'auto', maxHeight: '50vh', scrollbarWidth: 'none' }}>
          {filtered.length === 0 ? (
            <div className="font-mono text-center py-8" style={{ fontSize: 11, color: '#62627a' }}>No crew found</div>
          ) : (
            filtered.map(c => {
              const added = alreadyAdded(c.id, c)
              return (
                <div key={c.id} className="flex items-center gap-3 px-5 py-2.5 border-b border-border"
                  style={added ? { opacity: 0.35, pointerEvents: 'none' } : {}}>
                  <CrewAvatar first={c.first} last={c.last} color1={c.color1} color2={c.color2} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#dddde8' }}>{c.first} {c.last}</div>
                    <div className="font-mono" style={{ fontSize: 10, color: '#a0a0b8', marginTop: 2 }}>{c.role}</div>
                    {'projectName' in c && (c as any).projectName && (
                      <div className="font-mono" style={{ fontSize: 9, color: '#62627a' }}>{(c as any).projectName}</div>
                    )}
                  </div>
                  {added ? (
                    <span className="font-mono" style={{ fontSize: 9, color: '#00b894', padding: '3px 8px', borderRadius: 20, background: 'rgba(0,184,148,0.1)', border: '1px solid rgba(0,184,148,0.2)' }}>Added</span>
                  ) : (
                    <button onClick={() => {
                      haptic('light')
                      onAdd({
                        projectId, first: c.first, last: c.last, role: c.role, dept: c.dept,
                        color1: c.color1, color2: c.color2,
                        phone: c.phone || '', email: c.email || '', allergies: c.allergies || '',
                        dealMemoUrl: c.dealMemoUrl || '', notes: '', avatarUrl: c.avatarUrl || '',
                        displayOrder: currentCrew.length,
                        createdAt: new Date().toISOString(),
                      })
                    }}
                      style={{
                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(196,90,220,0.15)', border: '1px solid rgba(196,90,220,0.35)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#c45adc', fontSize: 16, cursor: 'pointer',
                      }}>+</button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </SheetBody>
    </>
  )
}

// ── Empty State ──────────────────────────────────────────

function CrewEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-16" style={{ flex: 1 }}>
      <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }}>👤</div>
      <div style={{ fontWeight: 700, fontSize: 16, color: '#dddde8', marginBottom: 4 }}>Build your crew.</div>
      <div className="font-mono text-center" style={{ fontSize: 11, color: '#62627a', marginBottom: 20 }}>Add the people who make this happen.</div>
      <button onClick={onAdd}
        style={{
          padding: '8px 20px', borderRadius: 20,
          background: 'rgba(196,90,220,0.12)', border: '1px solid rgba(196,90,220,0.3)',
          color: '#c45adc', fontWeight: 600, fontSize: 13, cursor: 'pointer',
        }}>+ Add crew member</button>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────

export default function CrewPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const accent = getProjectColor(projectId)
  const [tab, setTab] = useState<CrewTab>('All')
  const [selectedMember, setSelectedMember] = useState<CrewMember | null>(null)
  const [showNewSheet, setShowNewSheet] = useState(false)
  const [showExistingSheet, setShowExistingSheet] = useState(false)

  const { data: crew, isLoading } = useCrew(projectId)
  const addMember = useAddCrewMember(projectId)
  const updateMember = useUpdateCrewMember(projectId)

  const allCrew = crew ?? []

  // Filter by tab
  const filtered = tab === 'All' ? allCrew : allCrew.filter(m => m.dept === tab)

  // Group by department
  const grouped = (DEPARTMENTS as readonly string[])
    .map(dept => ({ dept, members: filtered.filter(m => m.dept === dept) }))
    .filter(g => g.members.length > 0)

  const handleUpdate = useCallback((id: string, fields: Record<string, string>) => {
    updateMember.mutate({ id, fields })
  }, [updateMember])

  const handleSelectFromStrip = useCallback((m: CrewMember) => {
    setSelectedMember(prev => prev?.id === m.id ? null : m)
  }, [])

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#04040a' }}>
      <PageHeader projectId={projectId} title="Crew" meta={`${allCrew.length} members · ${grouped.length} departments`} />
      <DeptTabs active={tab} onChange={setTab} />

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', paddingBottom: 200 }}>
        {isLoading ? (
          <div className="px-5 py-4 flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
                <div className="flex-1 flex flex-col gap-1.5">
                  <div style={{ width: '60%', height: 12, borderRadius: 4, background: 'rgba(255,255,255,0.04)' }} />
                  <div style={{ width: '40%', height: 10, borderRadius: 4, background: 'rgba(255,255,255,0.03)' }} />
                </div>
              </div>
            ))}
          </div>
        ) : allCrew.length === 0 ? (
          <CrewEmpty onAdd={() => { haptic('light'); setShowNewSheet(true) }} />
        ) : filtered.length === 0 ? (
          <div className="font-mono text-center py-12" style={{ fontSize: 11, color: '#62627a' }}>No crew in {tab}</div>
        ) : (
          grouped.map(({ dept, members }) => (
            <div key={dept}>
              <DeptHeader dept={dept} count={members.length} />
              {members.map(m => (
                <CrewRow key={m.id} member={m} onTap={(m) => { haptic('light'); setSelectedMember(m) }} />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Avatar strip — fixed above FAB */}
      {allCrew.length > 0 && (
        <AvatarStrip crew={allCrew} selectedId={selectedMember?.id ?? null} onSelect={handleSelectFromStrip} />
      )}

      {/* Member detail panel — slides from top */}
      <AnimatePresence>
        {selectedMember && (
          <MemberPanel
            key={selectedMember.id}
            member={selectedMember}
            onClose={() => setSelectedMember(null)}
            onUpdate={handleUpdate}
          />
        )}
      </AnimatePresence>

      {/* FAB with branches */}
      <FAB accent={accent} projectId={projectId}
        branches={[
          {
            label: 'Add New',
            color: '#c45adc',
            icon: <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1V12M1 6.5H12" stroke="#c45adc" strokeWidth="1.5" strokeLinecap="round" /></svg>,
            action: () => { haptic('light'); setShowNewSheet(true) },
          },
          {
            label: 'Add Existing',
            color: '#6470f3',
            icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="5" cy="5" r="3" stroke="#6470f3" strokeWidth="1.2" /><circle cx="9" cy="5" r="3" stroke="#6470f3" strokeWidth="1.2" /><path d="M3 10c0-2 2-3 4-3s4 1 4 3" stroke="#6470f3" strokeWidth="1.2" strokeLinecap="round" /></svg>,
            action: () => { haptic('light'); setShowExistingSheet(true) },
          },
        ]}
      />
      <SideFabs projectId={projectId} />

      {/* Add New sheet */}
      <Sheet open={showNewSheet} onClose={() => setShowNewSheet(false)}>
        <NewMemberSheet
          projectId={projectId}
          crewCount={allCrew.length}
          onClose={() => setShowNewSheet(false)}
          onCreate={(data) => addMember.mutate(data as any)}
        />
      </Sheet>

      {/* Add Existing sheet */}
      <Sheet open={showExistingSheet} onClose={() => setShowExistingSheet(false)}>
        <AddExistingSheet
          projectId={projectId}
          currentCrew={allCrew}
          onClose={() => setShowExistingSheet(false)}
          onAdd={(data) => addMember.mutate(data as any)}
        />
      </Sheet>
    </div>
  )
}
