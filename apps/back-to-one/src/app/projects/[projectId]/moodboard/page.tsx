'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMoodboard, useCreateMoodboardRef } from '@/lib/hooks/useOriginOne'
import { LoadingState, EmptyState } from '@/components/ui'
import { GhostCircle, GhostRect, GhostPill, GhostBlock, EmptyCTA } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { FAB } from '@/components/ui/FAB'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { haptic } from '@/lib/utils/haptics'
import { getProjectColor } from '@/lib/utils/phase'
import { MOODBOARD_GRADIENTS } from '@/lib/utils/gradients'
import type { MoodboardRef } from '@/types'

type MoodCat = MoodboardRef['cat']

const CATEGORIES: { key: MoodCat; label: string }[] = [
  { key: 'tone',    label: 'Tone' },
  { key: 'visual',  label: 'Visual' },
  { key: 'product', label: 'Product' },
  { key: 'music',   label: 'Music' },
]

const catColor: Record<MoodCat, string> = {
  tone:    'text-prod bg-prod/10',
  visual:  'text-accent-soft bg-accent/10',
  product: 'text-pre bg-pre/10',
  music:   'text-post bg-post/10',
}

const GRADIENTS = MOODBOARD_GRADIENTS

function RefCard({ item, onTap }: { item: MoodboardRef; onTap: (r: MoodboardRef) => void }) {
  return (
    <div
      className="rounded-lg border border-border overflow-hidden cursor-pointer active:opacity-80 transition-opacity"
      onClick={() => onTap(item)}
    >
      <div className="h-24 w-full" style={{ background: item.gradient || GRADIENTS[0] }} />
      <div className="px-3 py-2.5 bg-surface">
        <div className="text-sm font-medium text-text truncate">{item.title}</div>
        {item.note && <div className="font-mono text-xs text-muted truncate mt-0.5">{item.note}</div>}
      </div>
    </div>
  )
}

function DetailSheet({ item, onClose }: { item: MoodboardRef | null; onClose: () => void }) {
  if (!item) return null
  return (
    <>
      <SheetHeader title={item.title} onClose={onClose} />
      <SheetBody>
        <div className="h-40 w-full rounded-lg mb-4" style={{ background: item.gradient || GRADIENTS[0] }} />
        <div className="mb-4">
          <span className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Category</span>
          <span className={`font-mono text-xs px-2 py-1 rounded-sm ${catColor[item.cat]}`}>
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

function NewSheet({ projectId, refCount, onClose, onCreate }: {
  projectId: string; refCount: number; onClose: () => void
  onCreate: (data: Omit<MoodboardRef, 'id' | 'createdAt'>) => void
}) {
  const [title, setTitle] = useState('')
  const [cat, setCat]     = useState<MoodCat>('tone')
  const [note, setNote]   = useState('')

  const handleSubmit = () => {
    if (!title.trim()) return
    onCreate({ projectId, title: title.trim(), cat, note, imageUrl: null, gradient: GRADIENTS[refCount % GRADIENTS.length] })
    onClose()
  }

  return (
    <>
      <SheetHeader title="New Reference" onClose={onClose} />
      <SheetBody>
        <div className="flex flex-col gap-4">
          <div>
            <label className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Title</label>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Reference name"
              className="w-full bg-surface2 border border-border2 rounded-lg px-3 py-2.5 text-text text-base outline-none focus:border-accent transition-colors" />
          </div>
          <div>
            <label className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Category</label>
            <div className="flex gap-2">
              {CATEGORIES.map(c => (
                <button key={c.key} onClick={() => setCat(c.key)}
                  className={`flex-1 font-mono text-xs tracking-widest uppercase py-2 rounded-md border transition-colors ${
                    cat === c.key ? 'bg-accent/20 text-accent-soft border-accent/30' : 'bg-surface2 text-muted border-border'
                  }`}
                >{c.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Note</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Optional note..."
              className="w-full bg-surface2 border border-border2 rounded-lg px-3 py-2.5 text-text text-base outline-none focus:border-accent transition-colors resize-none" />
          </div>
          <button onClick={handleSubmit} disabled={!title.trim()}
            className="w-full py-3 rounded-lg bg-accent text-white font-semibold text-base transition-opacity disabled:opacity-40 active:opacity-80">
            Add Reference
          </button>
        </div>
      </SheetBody>
    </>
  )
}

export default function MoodboardPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const accent = getProjectColor(projectId)
  const [selected, setSelected] = useState<MoodboardRef | null>(null)
  const [creating, setCreating] = useState(false)

  const { data: refs, isLoading } = useMoodboard(projectId)
  const create = useCreateMoodboardRef(projectId)

  const allRefs = refs ?? []

  const grouped = CATEGORIES
    .map(c => ({ ...c, items: allRefs.filter(r => r.cat === c.key) }))
    .filter(g => g.items.length > 0)

  return (
    <div className="screen">
      <PageHeader projectId={projectId} title="Moodboard" meta={`${allRefs.length}`} />

      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 80 }}>
        {isLoading ? <LoadingState /> : (
          allRefs.length === 0 ? (
            <>
              {/* Ghost palette row */}
              <div style={{ display: 'flex', gap: 8, padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                    <GhostCircle size={36} />
                    <GhostRect w={36} h={8} />
                  </div>
                ))}
              </div>
              {/* Ghost filter pills */}
              <div style={{ display: 'flex', gap: 6, padding: '12px 16px', overflow: 'hidden' }}>
                <GhostPill w={32} h={28} /><GhostPill w={48} h={28} /><GhostPill w={56} h={28} /><GhostPill w={64} h={28} /><GhostPill w={80} h={28} />
              </div>
              {/* Ghost masonry grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3, padding: '0 16px' }}>
                <GhostBlock style={{ gridColumn: 'span 2', aspectRatio: '2/1' }} />
                <GhostBlock style={{ aspectRatio: '1' }} />
                <GhostBlock style={{ aspectRatio: '1' }} />
                <GhostBlock style={{ aspectRatio: '1' }} />
                <GhostBlock style={{ aspectRatio: '1' }} />
              </div>
              <EmptyCTA icon="🖼️" headline="Set the tone." sub="Drop in references. Build the world." addLabel="+ Add reference" onAdd={() => { haptic('light'); setCreating(true) }} />
            </>
          ) : (
            grouped.map(({ key, label, items }) => (
              <div key={key} className="px-3.5 pt-3">
                <div className="font-mono text-sm text-muted tracking-widest uppercase mb-2 pb-1.5 border-b border-border">
                  <span className={`px-1.5 py-0.5 rounded-sm ${catColor[key]}`}>{label}</span>
                  <span className="ml-2 text-muted">{items.length}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {items.map(r => <RefCard key={r.id} item={r} onTap={setSelected} />)}
                </div>
              </div>
            ))
          )
        )}
      </div>

      <FAB accent={accent} projectId={projectId} onPress={() => { haptic('light'); setCreating(true) }} />

      <Sheet open={!!selected} onClose={() => setSelected(null)}>
        <DetailSheet item={selected} onClose={() => setSelected(null)} />
      </Sheet>

      <Sheet open={creating} onClose={() => setCreating(false)}>
        <NewSheet projectId={projectId} refCount={allRefs.length} onClose={() => setCreating(false)}
          onCreate={(data) => create.mutate(data as any)} />
      </Sheet>
    </div>
  )
}
