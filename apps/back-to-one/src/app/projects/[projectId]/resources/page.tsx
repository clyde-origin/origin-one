'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useResources, useCreateResource } from '@/lib/hooks/useOriginOne'
import { LoadingState, EmptyState } from '@/components/ui'
import { PageHeader } from '@/components/ui/PageHeader'
import { FAB } from '@/components/ui/FAB'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { haptic } from '@/lib/utils/haptics'
import { getProjectColor } from '@/lib/utils/phase'
import type { Resource, ResourceType, ResourceCategory } from '@/types'

// ── Constants ─────────────────────────────────────────────

const CATEGORIES: { key: ResourceCategory; label: string }[] = [
  { key: 'brief',        label: 'Brief' },
  { key: 'legal',        label: 'Legal' },
  { key: 'assets',       label: 'Assets' },
  { key: 'refs',         label: 'References' },
  { key: 'deliverables', label: 'Deliverables' },
  { key: 'audio',        label: 'Audio' },
]

const TYPES: ResourceType[] = ['link', 'deck', 'doc', 'folder', 'contract', 'video', 'audio']

const TYPE_ICONS: Record<ResourceType, string> = {
  link:     '🔗',
  deck:     '📊',
  doc:      '📄',
  folder:   '📁',
  contract: '📝',
  video:    '🎬',
  audio:    '🎵',
}

const catColor: Record<ResourceCategory, string> = {
  brief:        'text-prod bg-prod/10',
  legal:        'text-pre bg-pre/10',
  assets:       'text-post bg-post/10',
  refs:         'text-accent-soft bg-accent/10',
  deliverables: 'text-prod bg-prod/10',
  audio:        'text-pre bg-pre/10',
}

// ── Resource Row ──────────────────────────────────────────

function ResourceRow({ resource }: { resource: Resource }) {
  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-3 border-b border-border cursor-pointer transition-colors active:bg-surface2"
    >
      {/* Type icon */}
      <div className="w-9 h-9 rounded-lg bg-surface2 border border-border flex items-center justify-center flex-shrink-0 text-base">
        {TYPE_ICONS[resource.type]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-base leading-snug text-text truncate">
          {resource.title}
        </div>
        {resource.meta && (
          <div className="font-mono text-xs text-muted truncate">{resource.meta}</div>
        )}
      </div>

      {/* Pinned indicator */}
      {resource.pinned && (
        <div className="flex-shrink-0 font-mono text-[0.5rem] tracking-widest uppercase text-accent-soft bg-accent/10 px-1.5 py-0.5 rounded-sm">
          Pinned
        </div>
      )}

      {/* External link arrow */}
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0 text-muted">
        <path d="M4 2h6v6M10 2L3 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </a>
  )
}

// ── New Resource Sheet ────────────────────────────────────

function NewSheet({ projectId, onClose, onCreate }: {
  projectId: string
  onClose: () => void
  onCreate: (data: Omit<Resource, 'id' | 'createdAt'>) => void
}) {
  const [title, setTitle] = useState('')
  const [cat, setCat]     = useState<ResourceCategory>('brief')
  const [type, setType]   = useState<ResourceType>('link')
  const [url, setUrl]     = useState('')
  const [meta, setMeta]   = useState('')

  const handleSubmit = () => {
    if (!title.trim() || !url.trim()) return
    onCreate({ projectId, title: title.trim(), cat, type, url: url.trim(), meta: meta.trim(), pinned: false })
    onClose()
  }

  return (
    <>
      <SheetHeader title="New Resource" onClose={onClose} />
      <SheetBody>
        <div className="flex flex-col gap-4">
          <div>
            <label className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Title</label>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Resource name"
              className="w-full bg-surface2 border border-border2 rounded-lg px-3 py-2.5 text-text text-base outline-none focus:border-accent transition-colors" />
          </div>
          <div>
            <label className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button key={c.key} onClick={() => setCat(c.key)}
                  className={`font-mono text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    cat === c.key ? 'bg-accent/20 text-accent-soft border-accent/30' : 'bg-surface2 text-muted border-border'
                  }`}
                >{c.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Type</label>
            <div className="flex flex-wrap gap-2">
              {TYPES.map(t => (
                <button key={t} onClick={() => setType(t)}
                  className={`font-mono text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5 ${
                    type === t ? 'bg-accent/20 text-accent-soft border-accent/30' : 'bg-surface2 text-muted border-border'
                  }`}
                >
                  <span>{TYPE_ICONS[t]}</span>
                  <span className="capitalize">{t}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">URL</label>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..."
              className="w-full bg-surface2 border border-border2 rounded-lg px-3 py-2.5 text-text text-base outline-none focus:border-accent transition-colors" />
          </div>
          <div>
            <label className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Meta</label>
            <input value={meta} onChange={e => setMeta(e.target.value)} placeholder="e.g. Google Drive · 12 pages"
              className="w-full bg-surface2 border border-border2 rounded-lg px-3 py-2.5 text-text text-base outline-none focus:border-accent transition-colors" />
          </div>
          <button onClick={handleSubmit} disabled={!title.trim() || !url.trim()}
            className="w-full py-3 rounded-lg bg-accent text-white font-semibold text-base transition-opacity disabled:opacity-40 active:opacity-80">
            Add Resource
          </button>
        </div>
      </SheetBody>
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────

export default function ResourcesPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const accent = getProjectColor(projectId)
  const [creating, setCreating] = useState(false)

  const { data: resources, isLoading } = useResources(projectId)
  const create = useCreateResource(projectId)

  const allResources = resources ?? []

  // Group by category, pinned first within each group
  const grouped = CATEGORIES
    .map(c => ({
      ...c,
      items: allResources
        .filter(r => r.cat === c.key)
        .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)),
    }))
    .filter(g => g.items.length > 0)

  return (
    <div className="screen">
      <PageHeader projectId={projectId} title="Resources" meta={`${allResources.length}`} />

      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 80 }}>
        {isLoading ? <LoadingState /> : (
          allResources.length === 0 ? <EmptyState text="No resources yet" /> : (
            grouped.map(({ key, label, items }) => (
              <div key={key}>
                <div className="px-4 py-2 font-mono text-sm text-muted tracking-widest uppercase border-b border-border">
                  <span className={`px-1.5 py-0.5 rounded-sm ${catColor[key]}`}>{label}</span>
                  <span className="ml-2 text-muted">{items.length}</span>
                </div>
                {items.map(r => <ResourceRow key={r.id} resource={r} />)}
              </div>
            ))
          )
        )}
      </div>

      <FAB accent={accent} projectId={projectId} onPress={() => { haptic('light'); setCreating(true) }} />

      <Sheet open={creating} onClose={() => setCreating(false)}>
        <NewSheet projectId={projectId} onClose={() => setCreating(false)}
          onCreate={(data) => create.mutate(data as any)} />
      </Sheet>
    </div>
  )
}
