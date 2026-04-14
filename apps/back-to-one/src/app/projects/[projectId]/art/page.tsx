'use client'
import { PageTransition } from '@/components/ui/PageTransition'

import { useState } from 'react'
import Link from 'next/link'
import { useProject, useArtItems } from '@/lib/hooks/useOriginOne'

import { LoadingState, EmptyState, StatusBadge } from '@/components/ui'
import { GhostRow, GhostCircle, GhostRect, GhostPill, SectionLabel, EmptyCTA } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { FAB } from '@/components/ui/FAB'
import { getProjectColor , statusHex, statusLabel } from '@/lib/utils/phase'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import type { ArtItem, ArtCategory } from '@/types'

const CATEGORIES: { key: ArtCategory; label: string }[] = [
  { key: 'props',    label: 'Props' },
  { key: 'hmu',      label: 'Hair / Makeup' },
  { key: 'wardrobe', label: 'Wardrobe' },
]

const catColor: Record<ArtCategory, string> = {
  props:    'text-prod bg-prod/10',
  hmu:      'text-pre bg-pre/10',
  wardrobe: 'text-post bg-post/10',
}

function ArtRow({ item, onTap }: { item: ArtItem; onTap: (i: ArtItem) => void }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b border-border cursor-pointer transition-colors active:bg-surface2"
      onClick={() => onTap(item)}
    >
      <div className="w-9 h-9 rounded-lg flex-shrink-0" style={{ background: item.gradient || 'linear-gradient(135deg,#1a1a2e,#2a2a4e)' }} />
      <div className="flex-1 min-w-0">
        <div className="text-base leading-snug text-text truncate">{item.name}</div>
        {item.note && <div className="font-mono text-xs text-muted truncate">{item.note}</div>}
      </div>
      <StatusBadge status={item.status} />
    </div>
  )
}

function DetailSheet({ item, onClose }: { item: ArtItem | null; onClose: () => void }) {
  if (!item) return null
  return (
    <>
      <SheetHeader title={item.name} onClose={onClose} />
      <SheetBody>
        <div className="h-32 w-full rounded-lg mb-4" style={{ background: item.gradient || 'linear-gradient(135deg,#1a1a2e,#2a2a4e)' }} />

        <div className="flex items-center gap-2 mb-4 p-3 bg-surface2 rounded-lg border border-border">
          <StatusBadge status={item.status} />
          <span className={`font-mono text-xs px-2 py-1 rounded-sm ml-auto ${catColor[item.cat]}`}>
            {CATEGORIES.find(c => c.key === item.cat)?.label ?? item.cat}
          </span>
        </div>

        {item.note && (
          <div className="mb-4">
            <span className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Note</span>
            <div className="text-base text-text2 leading-relaxed p-3 bg-surface2 rounded-lg border border-border">{item.note}</div>
          </div>
        )}
      </SheetBody>
    </>
  )
}

export default function ArtPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const { data: project } = useProject(projectId)
  const accent = getProjectColor(projectId)
  const [selected, setSelected] = useState<ArtItem | null>(null)

  const { data: items, isLoading } = useArtItems(projectId)
  const allItems = items ?? []

  const grouped = CATEGORIES
    .map(c => ({ ...c, items: allItems.filter(i => i.cat === c.key) }))
    .filter(g => g.items.length > 0)

  return (
    <PageTransition><div className="screen">
      <PageHeader projectId={projectId} title="Art Department" meta={project ? (<div className="flex flex-col items-center gap-1.5"><span style={{ color: accent, fontSize: '0.50rem', letterSpacing: '0.06em' }}>{project.name}</span><span className="font-mono uppercase" style={{ fontSize: '0.38rem', padding: '2px 8px', borderRadius: 12, background: `${statusHex(project.status)}18`, color: statusHex(project.status) }}>{statusLabel(project.status)}</span></div>) : ''} />

      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 24 }}>
        {isLoading ? <LoadingState /> : (
          allItems.length === 0 ? (
            <>
              <SectionLabel>Needed</SectionLabel>
              <GhostRow><GhostCircle size={28} /><div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}><GhostRect w={100} h={11} /><GhostRect w={130} h={9} /></div><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}><GhostPill w={52} h={18} /><GhostPill w={36} h={16} /></div></GhostRow>
              <GhostRow><GhostCircle size={28} /><div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}><GhostRect w={88} h={11} /><GhostRect w={110} h={9} /></div><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}><GhostPill w={52} h={18} /><GhostPill w={36} h={16} /></div></GhostRow>
              <SectionLabel>Ready</SectionLabel>
              <GhostRow><GhostCircle size={28} /><div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}><GhostRect w={112} h={11} /><GhostRect w={90} h={9} /></div><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}><GhostPill w={40} h={18} /></div></GhostRow>
              <EmptyCTA icon="🎨" headline="Track your art." sub="Props, sets, palette — all in one place." addLabel="+ Add art item" />
            </>
          ) : (
            grouped.map(({ key, label, items: catItems }) => (
              <div key={key}>
                <div className="px-4 py-2 font-mono text-sm text-muted tracking-widest uppercase border-b border-border">
                  <span className={`px-1.5 py-0.5 rounded-sm ${catColor[key]}`}>{label}</span>
                  <span className="ml-2 text-muted">{catItems.length}</span>
                </div>
                {catItems.map(item => <ArtRow key={item.id} item={item} onTap={setSelected} />)}
              </div>
            ))
          )
        )}
      </div>

      <Sheet open={!!selected} onClose={() => setSelected(null)}>
        <DetailSheet item={selected} onClose={() => setSelected(null)} />
      </Sheet>
      <FAB accent={accent} projectId={projectId} />
    </div>
    </PageTransition>
  )
}