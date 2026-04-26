'use client'

// Cross-project Crew panel — slot 4 in projects-root's GlobalPanels switcher
// (replaces the former Threads panel, which is now a route at /projects/threads).
//
// Reads getAllCrew() — every ProjectMember row joined with User — and dedupes
// by userId to surface unique humans. Each row lists which projects the human
// is on. No schema change needed; aggregation is client-side.

import { useQuery } from '@tanstack/react-query'
import { getAllCrew } from '@/lib/db/queries'
import type { Project } from '@/types'

interface CrewRow {
  userId: string
  name: string
  avatarUrl: string | null
  projectIds: string[]
}

const AVATAR_COLORS = [
  { bg: 'rgba(100,112,243,0.2)', text: '#6470f3' },
  { bg: 'rgba(74,232,160,0.2)',  text: '#4ae8a0' },
  { bg: 'rgba(232,196,74,0.2)',  text: '#e8c44a' },
  { bg: 'rgba(74,184,232,0.2)',  text: '#4ab8e8' },
  { bg: 'rgba(196,90,220,0.2)',  text: '#c45adc' },
]

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function ProjPill({ name }: { name: string }) {
  return (
    <span style={{
      fontFamily: "'DM Mono', monospace", fontSize: 9, padding: '1px 6px',
      borderRadius: 20, background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.07)', color: '#62627a', whiteSpace: 'nowrap',
    }}>
      {name}
    </span>
  )
}

export function CrewPanel({ projects }: { projects: Project[] }) {
  const { data: rows } = useQuery({
    queryKey: ['allCrew'],
    queryFn: getAllCrew,
  })

  // Dedupe by userId; collect every project the human is on.
  // The ProjectMember row carries projectId + role + the joined User payload.
  const byUser = new Map<string, CrewRow>()
  for (const r of (rows ?? []) as Array<{ userId: string; projectId: string; User: { name: string; avatarUrl: string | null } | null }>) {
    if (!r.User) continue
    const existing = byUser.get(r.userId)
    if (existing) {
      if (!existing.projectIds.includes(r.projectId)) existing.projectIds.push(r.projectId)
    } else {
      byUser.set(r.userId, {
        userId: r.userId,
        name: r.User.name,
        avatarUrl: r.User.avatarUrl ?? null,
        projectIds: [r.projectId],
      })
    }
  }

  const crew = Array.from(byUser.values()).sort((a, b) => a.name.localeCompare(b.name))

  if (crew.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 12, color: '#62627a' }}>
        No crew yet
      </div>
    )
  }

  const projectName = (id: string) => projects.find(p => p.id === id)?.name ?? 'Project'

  return (
    <>
      <div className="font-mono" style={{ fontSize: 10, color: '#62627a', padding: '0 0 4px' }}>
        {crew.length} {crew.length === 1 ? 'person' : 'people'} · across all projects
      </div>
      {crew.map((c, i) => {
        const ac = AVATAR_COLORS[i % AVATAR_COLORS.length]
        return (
          <div key={c.userId} style={{
            padding: '9px 0',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            {c.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.avatarUrl} alt="" style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                objectFit: 'cover',
              }} />
            ) : (
              <div style={{
                width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 9, flexShrink: 0, marginTop: 1,
                background: ac.bg, color: ac.text,
              }}>
                {getInitials(c.name)}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#dddde8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                {c.projectIds.map(pid => (
                  <ProjPill key={pid} name={projectName(pid)} />
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}
