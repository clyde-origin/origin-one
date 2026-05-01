'use client'

import { useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useProject, useCrew } from '@/lib/hooks/useOriginOne'

import { CrewAvatar } from '@/components/ui'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProjectSwitcher } from '@/components/ProjectSwitcher'
import { useFabAction } from '@/lib/contexts/FabActionContext'
import { InviteCrewSheet } from '@/components/crew/InviteCrewSheet'
import { haptic } from '@/lib/utils/haptics'
import { getProjectColor , statusHex, statusLabel } from '@/lib/utils/phase'
import type { TeamMember, Role } from '@/types'

// ── Role filter tabs ────────────────────────────────────

const ROLE_TABS = ['All', 'director', 'producer', 'coordinator', 'writer', 'crew'] as const
type RoleTab = typeof ROLE_TABS[number]

const ROLE_LABELS: Record<string, string> = {
  All: 'All', director: 'Director', producer: 'Producer',
  coordinator: 'Coordinator', writer: 'Writer', crew: 'Crew',
}

function RoleTabs({ active, onChange }: { active: RoleTab; onChange: (t: RoleTab) => void }) {
  return (
    <div className="flex border-b border-border overflow-x-auto" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
      {ROLE_TABS.map(t => (
        <button key={t} onClick={() => onChange(t)}
          className="relative flex-shrink-0 px-3 py-3 font-mono uppercase tracking-wider"
          style={{ fontSize: 11, color: active === t ? '#dddde8' : '#62627a', letterSpacing: '0.06em' }}>
          {ROLE_LABELS[t] ?? t}
          {active === t && <div style={{ position: 'absolute', bottom: -1, left: '20%', right: '20%', height: 1.5, background: '#c45adc', borderRadius: 1 }} />}
        </button>
      ))}
    </div>
  )
}

// ── Crew Row ─────────────────────────────────────────────

function CrewRow({ member, onTap }: { member: TeamMember; onTap: (m: TeamMember) => void }) {
  const name = member.User?.name ?? 'Unknown'
  return (
    <div className="flex items-center gap-3.5 px-5 py-2.5 cursor-pointer active:bg-white/[0.02] relative"
      onClick={() => onTap(member)}>
      <CrewAvatar name={name} size={40} avatarUrl={member.User?.avatarUrl} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span style={{ fontWeight: 600, fontSize: 14, color: '#dddde8' }}>{name}</span>
        </div>
        <div className="font-mono capitalize" style={{ fontSize: 11, color: '#a0a0b8', marginTop: 2 }}>{member.role}</div>
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 68, right: 20, height: 1, background: 'rgba(255,255,255,0.05)' }} />
    </div>
  )
}

// ── Role Header ─────────────────────────────────────────

function RoleHeader({ role, count }: { role: string; count: number }) {
  return (
    <div className="flex items-center justify-between px-5 pt-3.5 pb-2">
      <span className="font-mono uppercase tracking-wider capitalize" style={{ fontSize: 10, color: '#62627a', letterSpacing: '0.1em' }}>{role}</span>
      <span className="font-mono" style={{ fontSize: 10, color: '#62627a' }}>{count}</span>
    </div>
  )
}

// ── Avatar Strip ─────────────────────────────────────────

function AvatarStrip({ crew, selectedId, onSelect }: {
  crew: TeamMember[]; selectedId: string | null; onSelect: (m: TeamMember) => void
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
          const name = m.User?.name ?? 'Unknown'
          return (
            <div key={m.id} className="flex flex-col items-center flex-shrink-0 cursor-pointer" style={{ gap: 4 }}
              onClick={() => { haptic('light'); onSelect(m) }}>
              <div style={{
                ...(isSelected ? {
                  outline: '2.5px solid #c45adc', outlineOffset: 2,
                  boxShadow: '0 0 12px rgba(196,90,220,0.4)',
                } : {}),
                borderRadius: '50%',
              }}>
                <CrewAvatar name={name} size={44} avatarUrl={m.User?.avatarUrl} />
              </div>
              <span className="font-mono truncate" style={{ fontSize: 9, color: isSelected ? '#c45adc' : '#62627a', maxWidth: 52 }}>{name.split(' ')[0]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Member Detail Panel ──────────────────────────────────

function MemberPanel({ member, onClose }: {
  member: TeamMember; onClose: () => void
}) {
  const name = member.User?.name ?? 'Unknown'
  const email = member.User?.email ?? '—'

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
      <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, margin: '10px auto 0', flexShrink: 0 }} />

      <div className="flex items-center gap-3.5" style={{ padding: '12px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <CrewAvatar name={name} size={50} avatarUrl={member.User?.avatarUrl} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: '#dddde8' }}>{name}</div>
          <div className="font-mono capitalize" style={{ fontSize: 11, color: '#a0a0b8', marginTop: 2 }}>{member.role}</div>
        </div>
        <button onClick={onClose}
          style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#62627a', fontSize: 14, flexShrink: 0, border: 'none' }}>
          ×
        </button>
      </div>

      <div style={{ overflowY: 'auto', scrollbarWidth: 'none' }}>
        <div className="flex items-start justify-between" style={{ padding: '11px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <span className="font-mono uppercase" style={{ fontSize: 10, color: '#62627a', letterSpacing: '0.08em', paddingTop: 1, flexShrink: 0 }}>Email</span>
          <span style={{ fontSize: 13, color: '#c45adc', textAlign: 'right', maxWidth: 220 }}>{email}</span>
        </div>
        <div className="flex items-start justify-between" style={{ padding: '11px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <span className="font-mono uppercase" style={{ fontSize: 10, color: '#62627a', letterSpacing: '0.08em', paddingTop: 1, flexShrink: 0 }}>Role</span>
          <span className="capitalize" style={{ fontSize: 13, color: '#a0a0b8', textAlign: 'right' }}>{member.role}</span>
        </div>
      </div>
    </motion.div>
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
  const { data: project } = useProject(projectId)
  const accent = project?.color || getProjectColor(projectId)
  const [tab, setTab] = useState<RoleTab>('All')
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [showNewSheet, setShowNewSheet] = useState(false)
  // Register the + handler with the global ActionBar.
  useFabAction({ onPress: () => { haptic('light'); setShowNewSheet(true) } })

  const { data: crew, isLoading } = useCrew(projectId)

  const allCrew = crew ?? []

  // Filter by role tab
  const filtered = tab === 'All' ? allCrew : allCrew.filter(m => m.role === tab)

  // Group by role
  const roleOrder: Role[] = ['director', 'producer', 'coordinator', 'writer', 'crew']
  const grouped = roleOrder
    .map(role => ({ role, members: filtered.filter(m => m.role === role) }))
    .filter(g => g.members.length > 0)

  const handleSelectFromStrip = useCallback((m: TeamMember) => {
    setSelectedMember(prev => prev?.id === m.id ? null : m)
  }, [])

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#04040a' }}>
      <PageHeader projectId={projectId} title="Crew" meta={project ? (<div className="flex flex-col items-center gap-1.5"><ProjectSwitcher projectId={projectId} projectName={project.name} accentColor={accent} variant="meta" /><span className="font-mono uppercase" style={{ fontSize: '0.38rem', padding: '2px 8px', borderRadius: 12, background: `${statusHex(project.status)}18`, color: statusHex(project.status) }}>{statusLabel(project.status)}</span></div>) : ''} />
      <RoleTabs active={tab} onChange={setTab} />

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
          <div className="font-mono text-center py-12" style={{ fontSize: 11, color: '#62627a' }}>No crew with role {tab}</div>
        ) : (
          grouped.map(({ role, members }) => (
            <div key={role}>
              <RoleHeader role={role} count={members.length} />
              {members.map(m => (
                <CrewRow key={m.id} member={m} onTap={(m) => { haptic('light'); setSelectedMember(m) }} />
              ))}
            </div>
          ))
        )}
      </div>

      {allCrew.length > 0 && (
        <AvatarStrip crew={allCrew} selectedId={selectedMember?.id ?? null} onSelect={handleSelectFromStrip} />
      )}

      <AnimatePresence>
        {selectedMember && (
          <MemberPanel
            key={selectedMember.id}
            member={selectedMember}
            onClose={() => setSelectedMember(null)}
          />
        )}
      </AnimatePresence>

      {/* + handler registered above via useFabAction. ActionBar is mounted globally.
          SideFabs deleted in PR 2a — chat / threads now live in ActionBar (also
          incidentally fixes the broken Threads route that pointed at /resources). */}

      <InviteCrewSheet
        projectId={projectId}
        open={showNewSheet}
        onClose={() => setShowNewSheet(false)}
        onSuccess={() => setShowNewSheet(false)}
      />
    </div>
  )
}