'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { useProject, useCrew } from '@/lib/hooks/useOriginOne'

import { CrewAvatar } from '@/components/ui'
import { ProjectSwitcher } from '@/components/ProjectSwitcher'
import { useFabAction } from '@/lib/contexts/FabActionContext'
import { InviteCrewSheet } from '@/components/crew/InviteCrewSheet'
import { haptic } from '@/lib/utils/haptics'
import { getProjectColor, statusLabel, DEPT_COLORS } from '@/lib/utils/phase'
import type { TeamMember, Role } from '@/types'

// ── Role filter tabs ────────────────────────────────────

const ROLE_TABS = ['All', 'director', 'producer', 'coordinator', 'writer', 'crew'] as const
type RoleTab = typeof ROLE_TABS[number]

const ROLE_LABELS: Record<string, string> = {
  All: 'All', director: 'Director', producer: 'Producer',
  coordinator: 'Coordinator', writer: 'Writer', crew: 'Crew',
}

// Maps ProjectStatus enum onto the cinema-glass .ai-meta-pill phase classes.
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

function RolePillRow({ active, onChange, counts, accent }: {
  active: RoleTab; onChange: (t: RoleTab) => void; counts: Record<string, number>; accent: string
}) {
  return (
    <div
      className="flex items-center gap-2 overflow-x-auto no-scrollbar"
      style={{ padding: '8px 16px 6px', borderBottom: '1px solid rgba(255,255,255,0.05)', WebkitOverflowScrolling: 'touch' }}
    >
      {ROLE_TABS.map(t => {
        const isActive = active === t
        const label = ROLE_LABELS[t] ?? t
        const count = counts[t] ?? 0
        // Title-case pill text per Crew V2 — mono uppercase is reserved for
        // field labels only (e.g. EMAIL, PHONE). Pill content is sentence-case
        // display text so "All · 13" reads as written, not "ALL · 13".
        return (
          <button key={t} onClick={() => onChange(t)} className="font-mono" style={{
            fontSize: '0.52rem', letterSpacing: 0,
            padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
            whiteSpace: 'nowrap', flexShrink: 0,
            background: isActive ? `${accent}1f` : 'rgba(255,255,255,0.04)',
            border: `1px solid ${isActive ? `${accent}55` : 'rgba(255,255,255,0.05)'}`,
            color: isActive ? accent : 'var(--fg-mono)',
          }}>
            {label} · {count}
          </button>
        )
      })}
    </div>
  )
}

// ── Crew Card (3-col grid) ──────────────────────────────
//
// Per `GALLERY_HANDOFF` row 14 spec: "Dept-grouped crew grid: section header
// (sheen) per dept, then 3-col crew-card grid. Crew card: avatar (dept-tinted)
// + name + role; outer glow uses `--proj-rgb`, avatar uses `--dept-rgb`."
//
// V2 fix: avatar is now genuinely dept-tinted. V1 wrapped CrewAvatar
// (name-hash colored) in a thin tinted ring, so Camera-dept members like
// Riley Tan and Tyler Brooks rendered with arbitrary hash colors instead
// of indigo. V2 renders the dept-tinted initials inline (matching the
// spec's `.crew-card-avatar` rule); when a User.avatarUrl exists, the
// photo crops into the dept-tinted circle.
function avatarInitialsOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  return (name[0] ?? '?').toUpperCase()
}

function CrewCard({ member, onTap, deptRgb }: { member: TeamMember; onTap: (m: TeamMember) => void; deptRgb: [number, number, number] }) {
  const name = member.User?.name ?? 'Unknown'
  const [r, g, b] = deptRgb
  const avatarUrl = member.User?.avatarUrl
  return (
    <button
      type="button"
      onClick={() => onTap(member)}
      className="glass-tile flex flex-col items-center cursor-pointer active:opacity-90 transition-opacity"
      style={{
        padding: '12px 8px 10px',
        textAlign: 'center',
        color: 'inherit',
        font: 'inherit',
        gap: 6,
      }}
    >
      <div style={{
        position: 'relative',
        width: 44, height: 44, borderRadius: '50%',
        background: `rgba(${r},${g},${b},0.18)`,
        border: `1px solid rgba(${r},${g},${b},0.45)`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        color: `rgb(${r},${g},${b})`,
        fontFamily: 'var(--font-geist-mono), monospace',
        fontSize: '0.68rem',
        fontWeight: 600,
        letterSpacing: '0.04em',
      }}>
        {avatarUrl ? (
          <Image src={avatarUrl} alt={name} fill sizes="44px" style={{ objectFit: 'cover' }} />
        ) : (
          avatarInitialsOf(name)
        )}
      </div>
      {/* Person name — display text, sentence case, NOT uppercase. */}
      <div className="truncate w-full" style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--fg)', lineHeight: 1.2 }}>{name}</div>
      {/* Role title — title-case via `capitalize` (live role enum is single-
          word lowercase; capitalize gives "Director" / "Producer" / etc.). */}
      <div className="font-mono capitalize truncate w-full" style={{ fontSize: '0.40rem', letterSpacing: '0.06em', color: 'var(--fg-mono)' }}>{member.role}</div>
    </button>
  )
}

// ── Member Detail Panel ──────────────────────────────────

function MemberPanel({ member, accent, onClose }: {
  member: TeamMember; accent: string; onClose: () => void
}) {
  const name = member.User?.name ?? 'Unknown'
  const email = member.User?.email ?? '—'

  return (
    <motion.div
      initial={{ y: '-100%' }} animate={{ y: 0 }} exit={{ y: '-100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 320 }}
      style={{
        position: 'fixed', left: 0, right: 0, top: 0, zIndex: 8,
        background: 'rgba(13,13,26,0.96)',
        backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
        borderRadius: '0 0 24px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
        maxHeight: 'calc(100% - 180px)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
      <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2, margin: '10px auto 0', flexShrink: 0 }} />

      <div className="flex items-center gap-3.5" style={{ padding: '12px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <CrewAvatar name={name} size={50} avatarUrl={member.User?.avatarUrl} />
        <div style={{ flex: 1 }}>
          {/* Profile name — cream display text, NOT accent sheen. The sheen
              treatment is reserved for actual section / module / dept headers;
              person names are display content. (Crew V2 fix.) */}
          <div style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.01em', color: 'var(--fg)' }}>{name}</div>
          <div className="font-mono capitalize" style={{ fontSize: 11, color: 'var(--fg-mono)', marginTop: 2 }}>{member.role}</div>
        </div>
        <button onClick={onClose}
          style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-mono)', fontSize: 14, flexShrink: 0, border: 'none' }}>
          ×
        </button>
      </div>

      <div style={{ overflowY: 'auto', scrollbarWidth: 'none' }}>
        <div className="flex items-start justify-between" style={{ padding: '11px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <span className="font-mono uppercase" style={{ fontSize: 10, color: 'var(--fg-mono)', letterSpacing: '0.08em', paddingTop: 1, flexShrink: 0 }}>Email</span>
          <span style={{ fontSize: 13, color: accent, textAlign: 'right', maxWidth: 220 }}>{email}</span>
        </div>
        <div className="flex items-start justify-between" style={{ padding: '11px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <span className="font-mono uppercase" style={{ fontSize: 10, color: 'var(--fg-mono)', letterSpacing: '0.08em', paddingTop: 1, flexShrink: 0 }}>Role</span>
          <span className="capitalize" style={{ fontSize: 13, color: 'var(--fg)', textAlign: 'right' }}>{member.role}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ── Avatar Strip ─────────────────────────────────────────

function AvatarStrip({ crew, selectedId, accent, onSelect }: {
  crew: TeamMember[]; selectedId: string | null; accent: string; onSelect: (m: TeamMember) => void
}) {
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0,
      bottom: 'calc(68px + 60px)',
      zIndex: 6,
      padding: '12px 20px 10px',
      background: 'linear-gradient(transparent, rgba(4,4,10,0.96) 28%)',
    }}>
      <div className="font-mono uppercase" style={{ fontSize: 9, color: 'var(--fg-mono)', letterSpacing: '0.1em', marginBottom: 8 }}>Tap to view</div>
      <div className="flex gap-2.5 overflow-x-auto" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {crew.map(m => {
          const isSelected = selectedId === m.id
          const name = m.User?.name ?? 'Unknown'
          return (
            <div key={m.id} className="flex flex-col items-center flex-shrink-0 cursor-pointer" style={{ gap: 4 }}
              onClick={() => { haptic('light'); onSelect(m) }}>
              <div style={{
                ...(isSelected ? {
                  outline: `2.5px solid ${accent}`, outlineOffset: 2,
                  boxShadow: `0 0 12px ${accent}66`,
                } : {}),
                borderRadius: '50%',
              }}>
                <CrewAvatar name={name} size={44} avatarUrl={m.User?.avatarUrl} />
              </div>
              <span className="font-mono truncate" style={{ fontSize: 9, color: isSelected ? accent : 'var(--fg-mono)', maxWidth: 52 }}>{name.split(' ')[0]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Empty State ──────────────────────────────────────────

function CrewEmpty({ accent, onAdd }: { accent: string; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-16" style={{ flex: 1 }}>
      <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }}>👤</div>
      <div className="sheen-title" style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4, letterSpacing: '0.01em' }}>Build your crew.</div>
      <div className="font-mono text-center" style={{ fontSize: 11, color: 'var(--fg-mono)', marginBottom: 20 }}>Add the people who make this happen.</div>
      <button onClick={onAdd}
        style={{
          padding: '8px 20px', borderRadius: 20,
          background: `${accent}1f`, border: `1px solid ${accent}55`,
          color: accent, fontWeight: 600, fontSize: 13, cursor: 'pointer',
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

  // Counts per role-tab (for the role-pill row count badges).
  const counts: Record<string, number> = {
    All: allCrew.length,
    director: allCrew.filter(m => m.role === 'director').length,
    producer: allCrew.filter(m => m.role === 'producer').length,
    coordinator: allCrew.filter(m => m.role === 'coordinator').length,
    writer: allCrew.filter(m => m.role === 'writer').length,
    crew: allCrew.filter(m => m.role === 'crew').length,
  }

  const handleSelectFromStrip = useCallback((m: TeamMember) => {
    setSelectedMember(prev => prev?.id === m.id ? null : m)
  }, [])

  // Cinema Glass: project accent triplet drives the sheen-title gradient and
  // glass-tile tint. +20/+30/+16 lights the spec's accent-glow apex.
  const [pr, pg, pb] = hexToRgb(accent)
  const glowR = Math.min(255, pr + 20)
  const glowG = Math.min(255, pg + 30)
  const glowB = Math.min(255, pb + 16)

  const phase = phaseClass(project?.status)

  // Per the brief / GALLERY_HANDOFF row 14: avatar uses --dept-rgb. Resolves
  // department first (so a "crew" role member working in Camera reads as
  // indigo, not gray), then falls back to the role-based mapping for
  // producer-tier roles whose dept is implied by their role identity.
  // (Crew V2 fix — V1 mapped role → dept only, which dropped Camera/G&E/
  // Sound/Art/Wardrobe/HMU/Locations/Post members into the gray "Other"
  // bucket.)
  function deptRgbFor(member: TeamMember): [number, number, number] {
    const dept = (member as TeamMember & { department?: string | null }).department
    if (dept && DEPT_COLORS[dept]) return hexToRgb(DEPT_COLORS[dept])
    const role = member.role
    const hex = DEPT_COLORS[
      role === 'director' ? 'Direction'
      : role === 'producer' ? 'Production'
      : role === 'writer' ? 'Writing'
      : role === 'coordinator' ? 'Production'
      : 'Other'
    ] ?? '#7a7a82'
    return hexToRgb(hex)
  }

  return (
    <div
      className="screen"
      style={{
        ['--tile-rgb' as string]: `${pr}, ${pg}, ${pb}`,
        ['--accent-rgb' as string]: `${pr}, ${pg}, ${pb}`,
        ['--accent-glow-rgb' as string]: `${glowR}, ${glowG}, ${glowB}`,
        display: 'flex', flexDirection: 'column', height: '100dvh',
      } as React.CSSProperties}
    >
      {/* Cinema Glass page header — sheen Crew title + project meta + phase pill.
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
            Crew
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

      <RolePillRow active={tab} onChange={setTab} counts={counts} accent={accent} />

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', paddingBottom: 200 }}>
        {isLoading ? (
          <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass-tile" style={{ padding: '12px 8px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div className="sk-block" style={{ width: 44, height: 44, borderRadius: '50%' }} />
                <div className="sk-block" style={{ width: '70%', height: 10 }} />
                <div className="sk-block" style={{ width: '50%', height: 8 }} />
              </div>
            ))}
          </div>
        ) : allCrew.length === 0 ? (
          <CrewEmpty accent={accent} onAdd={() => { haptic('light'); setShowNewSheet(true) }} />
        ) : filtered.length === 0 ? (
          <div className="font-mono text-center py-12" style={{ fontSize: 11, color: 'var(--fg-mono)' }}>No crew with role {tab}</div>
        ) : (
          grouped.map(({ role, members }) => {
            return (
              <div key={role} style={{ padding: '0 16px' }}>
                {/* Sheen section divider — DESIGN_LANGUAGE.md section dividers
                    use the sheen+extrusion title treatment. Per Hub PR convention
                    (revert 80a8164), every section header collapses to a single
                    .sheen-title class that inherits the project accent. */}
                <div className="flex flex-col items-center" style={{ marginTop: 18, marginBottom: 10 }}>
                  <span className="sheen-title capitalize" style={{ fontSize: '0.84rem', fontWeight: 700, letterSpacing: '-0.01em' }}>{role}</span>
                  <span className="font-mono uppercase" style={{ fontSize: '0.36rem', letterSpacing: '0.1em', color: 'var(--fg-mono)', marginTop: 2 }}>{members.length}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {members.map(m => (
                    <CrewCard
                      key={m.id}
                      member={m}
                      deptRgb={deptRgbFor(m)}
                      onTap={(m) => { haptic('light'); setSelectedMember(m) }}
                    />
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>

      {allCrew.length > 0 && (
        <AvatarStrip crew={allCrew} selectedId={selectedMember?.id ?? null} accent={accent} onSelect={handleSelectFromStrip} />
      )}

      <AnimatePresence>
        {selectedMember && (
          <MemberPanel
            key={selectedMember.id}
            member={selectedMember}
            accent={accent}
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
