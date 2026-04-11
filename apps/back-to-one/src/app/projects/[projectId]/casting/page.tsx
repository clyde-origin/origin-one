'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useCastRoles } from '@/lib/hooks/useOriginOne'
import { LoadingState, EmptyState, StatusBadge } from '@/components/ui'
import { GhostRow, GhostCircle, GhostRect, GhostPill, SectionLabel, EmptyCTA } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { FAB } from '@/components/ui/FAB'
import { haptic } from '@/lib/utils/haptics'
import { getProjectColor } from '@/lib/utils/phase'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import type { CastRole } from '@/types'

const statusColor: Record<string, string> = {
  Uncast:    'bg-muted',
  Hold:      'bg-pre',
  Confirmed: 'bg-post',
}

function RoleRow({ role, onTap }: { role: CastRole; onTap: (r: CastRole) => void }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b border-border cursor-pointer transition-colors active:bg-surface2"
      onClick={() => onTap(role)}
    >
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusColor[role.status] ?? 'bg-muted'}`} />
      <div className="flex-1 min-w-0">
        <div className="text-base leading-snug text-text">{role.name}</div>
        <div className="font-mono text-xs text-muted truncate">{role.desc}</div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {role.talent && (
          <span className="font-mono text-xs text-text2">{role.talent.name}</span>
        )}
        <StatusBadge status={role.status} />
      </div>
    </div>
  )
}

function DetailSheet({ role, onClose }: { role: CastRole | null; onClose: () => void }) {
  if (!role) return null
  return (
    <>
      <SheetHeader title={role.name} onClose={onClose} />
      <SheetBody>
        <div className="flex items-center gap-2 mb-4 p-3 bg-surface2 rounded-lg border border-border">
          <div className={`w-2 h-2 rounded-full ${statusColor[role.status] ?? 'bg-muted'}`} />
          <StatusBadge status={role.status} />
        </div>

        <div className="mb-4">
          <span className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Description</span>
          <div className="text-base text-text2 leading-relaxed p-3 bg-surface2 rounded-lg border border-border">{role.desc || '—'}</div>
        </div>

        {role.talent && (
          <div className="mb-4">
            <span className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Talent</span>
            <div className="p-3 bg-surface2 rounded-lg border border-border">
              <div className="text-base font-semibold text-text">{role.talent.name}</div>
              {role.talent.note && <div className="font-mono text-xs text-muted mt-1">{role.talent.note}</div>}
            </div>
          </div>
        )}

        {role.scenes.length > 0 && (
          <div className="mb-4">
            <span className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Scenes</span>
            <div className="flex flex-wrap gap-1.5">
              {role.scenes.map(s => (
                <span key={s} className="font-mono text-xs px-2 py-1 rounded-sm bg-surface2 border border-border text-text2">{s}</span>
              ))}
            </div>
          </div>
        )}
      </SheetBody>
    </>
  )
}

export default function CastingPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const accent = getProjectColor(projectId)
  const [selected, setSelected] = useState<CastRole | null>(null)
  const [creating, setCreating] = useState(false)

  const { data: roles, isLoading } = useCastRoles(projectId)
  const allRoles = roles ?? []
  const confirmed = allRoles.filter(r => r.status === 'Confirmed').length

  return (
    <div className="screen">
      <PageHeader projectId={projectId} title="Casting" meta={`${confirmed}/${allRoles.length}`} />

      {/* Summary strip */}
      {allRoles.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
          <span className="font-mono text-[0.52rem] text-muted">{allRoles.length} roles</span>
          <span className="font-mono text-[0.52rem] text-post">{confirmed} confirmed</span>
          <span className="font-mono text-[0.52rem] text-pre">{allRoles.filter(r => r.status === 'Hold').length} on hold</span>
          <span className="font-mono text-[0.52rem] text-muted">{allRoles.filter(r => r.status === 'Uncast').length} uncast</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 24 }}>
        {isLoading ? <LoadingState /> : (
          allRoles.length === 0 ? (
            <>
              <SectionLabel>Principal</SectionLabel>
              <GhostRow><GhostCircle size={40} /><div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}><GhostRect w={80} h={12} /><GhostRect w={60} h={10} /><div style={{ display: 'flex', gap: 5, marginTop: 2 }}><GhostPill w={44} h={17} /><GhostPill w={52} h={17} /></div></div></GhostRow>
              <GhostRow><GhostCircle size={40} /><div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}><GhostRect w={70} h={12} /><GhostRect w={50} h={10} /><div style={{ display: 'flex', gap: 5, marginTop: 2 }}><GhostPill w={44} h={17} /><GhostPill w={52} h={17} /></div></div></GhostRow>
              <EmptyCTA icon="🎭" headline="Cast your film." sub="Characters, actors, offers out." addLabel="+ Add cast member" onAdd={() => { haptic('light'); setCreating(true) }} />
            </>
          ) : (
            allRoles.map(role => <RoleRow key={role.id} role={role} onTap={setSelected} />)
          )
        )}
      </div>

      <Sheet open={!!selected} onClose={() => setSelected(null)}>
        <DetailSheet role={selected} onClose={() => setSelected(null)} />
      </Sheet>
      <FAB accent={accent} projectId={projectId} onPress={() => { haptic('light'); setCreating(true) }} />
    </div>
  )
}
