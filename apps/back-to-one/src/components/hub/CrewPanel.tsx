'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import { useCrew, useRemoveCrewMember, useUpdateCrewMember } from '@/lib/hooks/useOriginOne'
import { CrewAvatar } from '@/components/ui'
import { haptic } from '@/lib/utils/haptics'
import { DEPARTMENTS } from '@/lib/utils/phase'
import type { TeamMember } from '@/types'

const spring = { type: 'spring' as const, stiffness: 400, damping: 40 }

/** Get the department string from a crew member (field exists on ProjectMember but not yet on the TS type) */
function getMemberDepartment(member: TeamMember): string | null {
  return (member as TeamMember & { department?: string | null }).department ?? null
}

/** Group crew by department in fixed display order, nulls last */
function groupByDepartment(crew: TeamMember[]): { department: string | null; members: TeamMember[] }[] {
  const groups: Record<string, TeamMember[]> = {}
  const nullGroup: TeamMember[] = []

  for (const m of crew) {
    const dept = getMemberDepartment(m)
    if (dept === null) {
      nullGroup.push(m)
    } else {
      if (!groups[dept]) groups[dept] = []
      groups[dept].push(m)
    }
  }

  // Sort members within each group alphabetically by name
  const sortMembers = (arr: TeamMember[]) => arr.sort((a: TeamMember, b: TeamMember) => a.User.name.localeCompare(b.User.name))
  Object.keys(groups).forEach(k => sortMembers(groups[k]))
  sortMembers(nullGroup)

  // Build ordered result: known departments first (in fixed order), then extras, then null
  const result: { department: string | null; members: TeamMember[] }[] = []
  const seen = new Set<string>()

  for (const dept of DEPARTMENTS) {
    if (groups[dept]) { result.push({ department: dept, members: groups[dept] }); seen.add(dept) }
  }

  // Any departments not in the fixed order (future-proofing)
  Object.keys(groups).forEach(dept => {
    if (!seen.has(dept)) result.push({ department: dept, members: groups[dept] })
  })

  // Null department last
  if (nullGroup.length > 0) result.push({ department: null, members: nullGroup })

  return result
}

// ── LAYER 2A: CREW MEMBER DETAIL ─────────────────────────

function CrewDetail({ member, accent, projectId, onBack, onRemoved }: {
  member: TeamMember; accent: string; projectId: string; onBack: () => void; onRemoved: () => void
}) {
  const update = useUpdateCrewMember(projectId)
  const remove = useRemoveCrewMember(projectId)
  const [showConfirm, setShowConfirm] = useState(false)
  const [role, setRole] = useState<string>(member.role)

  const saveRole = () => {
    update.mutate({ id: member.id, fields: { role } })
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
        <CrewAvatar name={member.User.name} size={56} />
        <div className="mt-3 text-center">
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#dddde8' }}>{member.User.name}</div>
          <div className="text-text2 mt-0.5" style={{ fontSize: '0.82rem' }}>{member.User.email}</div>
        </div>
      </div>

      {/* Role field */}
      <div className="flex-1 overflow-y-auto px-5" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 14 }}>
          <div className="font-mono uppercase" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Role</div>
          <input
            type="text"
            value={role}
            onChange={e => setRole(e.target.value)}
            onBlur={saveRole}
            autoComplete="off"
            spellCheck={false}
            className="w-full outline-none focus:border-white/20"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7, padding: '10px 12px', color: '#dddde8', fontSize: '0.82rem' }}
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
              Remove {member.User.name} from this project?
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

// ── CREW CELL (avatar + name + role, horizontal grid) ───

function CrewCell({ member, onTap }: { member: TeamMember; onTap: () => void }) {
  return (
    <div
      className="flex flex-col items-center cursor-pointer active:opacity-70"
      style={{ width: 68, gap: 4 }}
      onClick={onTap}
    >
      <CrewAvatar name={member.User.name} size={42} />
      <div className="text-center w-full" style={{
        fontSize: '0.62rem', fontWeight: 500, color: '#dddde8', lineHeight: 1.25,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
        overflow: 'hidden', wordBreak: 'break-word' as const,
      }}>
        {member.User.name}
      </div>
      <div className="text-center w-full" style={{
        fontSize: '0.48rem', color: '#62627a', lineHeight: 1.2, marginTop: -1,
      }}>
        {member.role}
      </div>
    </div>
  )
}

// ── MAIN CREW PANEL ──────────────────────────────────────

type Layer = 'list' | 'detail'

export function CrewPanel({ open, projectId, accent, onClose }: {
  open: boolean; projectId: string; accent: string; onClose: () => void
}) {
  const { data: crew } = useCrew(projectId)
  const allCrew = crew ?? []
  const [layer, setLayer] = useState<Layer>('list')
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)

  // Reset to list when panel opens
  useEffect(() => {
    if (open) { setLayer('list'); setSelectedMember(null) }
  }, [open])

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

              {/* Crew grid — grouped by department */}
              <div className="flex-1 overflow-y-auto min-h-0" style={{ WebkitOverflowScrolling: 'touch', padding: '0 16px 20px' }}>
                {groupByDepartment(allCrew).map(({ department, members }) => (
                  <div key={department ?? '__none'} style={{ marginTop: 16 }}>
                    {/* Section header */}
                    <div style={{ marginBottom: 10 }}>
                      <div className="uppercase" style={{
                        fontSize: 13, fontWeight: 600, color: accent,
                        letterSpacing: '0.08em', paddingBottom: 6,
                      }}>
                        {department ?? 'Crew (untagged)'}
                      </div>
                      <div style={{ height: 1, background: `${accent}20` }} />
                    </div>
                    {/* Avatar row — wrapping flex */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                      {members.map(m => (
                        <CrewCell key={m.id} member={m} onTap={() => { haptic('light'); setSelectedMember(m); setLayer('detail') }} />
                      ))}
                    </div>
                  </div>
                ))}
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
