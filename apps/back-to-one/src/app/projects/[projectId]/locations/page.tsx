'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLocations, useUpdateLocationStatus } from '@/lib/hooks/useOriginOne'
import { LoadingState, EmptyState, StatusBadge } from '@/components/ui'
import { GhostRow, GhostBlock, GhostRect, GhostPill, SectionLabel, EmptyCTA } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { FAB } from '@/components/ui/FAB'
import { haptic } from '@/lib/utils/haptics'
import { getProjectColor } from '@/lib/utils/phase'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import type { LocationGroup, LocationOption, LocationStatus } from '@/types'

const STATUSES: LocationStatus[] = ['Scouted', 'Option', 'Selected', 'Confirmed']

const typeColor: Record<string, string> = {
  'VFX / Stage Build': 'text-accent-soft bg-accent/10',
  'Practical':         'text-post bg-post/10',
  'Mixed':             'text-pre bg-pre/10',
}

function OptionRow({ option, onTap }: { option: LocationOption; onTap: (o: LocationOption) => void }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b border-border cursor-pointer transition-colors active:bg-surface2"
      onClick={() => onTap(option)}
    >
      <div className="w-9 h-9 rounded-lg flex-shrink-0" style={{ background: option.gradient || 'linear-gradient(135deg,#1a1a2e,#2a2a4e)' }} />
      <div className="flex-1 min-w-0">
        <div className="text-base leading-snug text-text truncate">{option.name}</div>
        {option.note && <div className="font-mono text-xs text-muted truncate">{option.note}</div>}
      </div>
      <StatusBadge status={option.status} />
    </div>
  )
}

function DetailSheet({ option, projectId, onClose }: {
  option: LocationOption | null; projectId: string; onClose: () => void
}) {
  const updateStatus = useUpdateLocationStatus(projectId)
  if (!option) return null

  return (
    <>
      <SheetHeader title={option.name} onClose={onClose} />
      <SheetBody>
        <div className="h-32 w-full rounded-lg mb-4" style={{ background: option.gradient || 'linear-gradient(135deg,#1a1a2e,#2a2a4e)' }} />
        <div className="mb-4">
          <span className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Status</span>
          <div className="flex gap-2">
            {STATUSES.map(s => (
              <button key={s} onClick={() => updateStatus.mutate({ optionId: option.id, status: s })}
                className={`flex-1 font-mono text-xs tracking-widest uppercase py-2 rounded-md border transition-colors ${
                  option.status === s ? 'bg-accent/20 text-accent-soft border-accent/30' : 'bg-surface2 text-muted border-border'
                }`}
              >{s}</button>
            ))}
          </div>
        </div>
        {option.note && (
          <div className="mb-4">
            <span className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Note</span>
            <div className="text-base text-text2 leading-relaxed p-3 bg-surface2 rounded-lg border border-border">{option.note}</div>
          </div>
        )}
      </SheetBody>
    </>
  )
}

export default function LocationsPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const accent = getProjectColor(projectId)
  const [selected, setSelected] = useState<LocationOption | null>(null)
  const [creating, setCreating] = useState(false)

  const { data: groups, isLoading } = useLocations(projectId)
  const allGroups = groups ?? []

  return (
    <div className="screen">
      <PageHeader projectId={projectId} title="Locations" meta={`${allGroups.length} locations`} />

      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 24 }}>
        {isLoading ? <LoadingState /> : (
          allGroups.length === 0 ? (
            <>
              <SectionLabel>Scout</SectionLabel>
              <GhostRow><GhostBlock w={44} h={44} /><div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 2 }}><GhostRect w={110} h={12} /><GhostRect w={150} h={10} /><div style={{ display: 'flex', gap: 6, marginTop: 2 }}><GhostPill w={52} h={18} /><GhostPill w={36} h={18} /></div></div></GhostRow>
              <GhostRow><GhostBlock w={44} h={44} /><div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 2 }}><GhostRect w={90} h={12} /><GhostRect w={130} h={10} /><div style={{ display: 'flex', gap: 6, marginTop: 2 }}><GhostPill w={52} h={18} /><GhostPill w={36} h={18} /></div></div></GhostRow>
              <SectionLabel>Confirmed</SectionLabel>
              <GhostRow><GhostBlock w={44} h={44} /><div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 2 }}><GhostRect w={120} h={12} /><GhostRect w={160} h={10} /><div style={{ display: 'flex', gap: 6, marginTop: 2 }}><GhostPill w={60} h={18} /><GhostPill w={36} h={18} /></div></div></GhostRow>
              <EmptyCTA icon="📍" headline="Pin your locations." sub="Where are you shooting?" addLabel="+ Add location" onAdd={() => { haptic('light'); setCreating(true) }} />
            </>
          ) : (
            allGroups.map(group => (
              <div key={group.id}>
                <div className="px-4 py-2 font-mono text-sm text-muted tracking-widest uppercase border-b border-border flex items-center gap-2">
                  <span className="text-text font-medium">{group.scriptLocation}</span>
                  <span className={`font-mono text-[0.5rem] tracking-widest uppercase px-1.5 py-0.5 rounded-sm ${typeColor[group.type] ?? 'text-muted bg-surface2'}`}>
                    {group.type}
                  </span>
                  <span className="ml-auto text-muted">{group.options.length}</span>
                </div>
                {group.options.map((opt: any) => (
                  <OptionRow key={opt.id} option={opt} onTap={setSelected} />
                ))}
              </div>
            ))
          )
        )}
      </div>

      <Sheet open={!!selected} onClose={() => setSelected(null)}>
        <DetailSheet option={selected} projectId={projectId} onClose={() => setSelected(null)} />
      </Sheet>
      <FAB accent={accent} projectId={projectId} onPress={() => { haptic('light'); setCreating(true) }} />
    </div>
  )
}
