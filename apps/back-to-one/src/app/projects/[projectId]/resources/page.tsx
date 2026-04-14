'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useProject, useResources, useCreateResource } from '@/lib/hooks/useOriginOne'

import { LoadingState, EmptyState } from '@/components/ui'
import { PageHeader } from '@/components/ui/PageHeader'
import { FAB } from '@/components/ui/FAB'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { haptic } from '@/lib/utils/haptics'
import { getProjectColor , statusHex, statusLabel } from '@/lib/utils/phase'
import type { Resource, ResourceType } from '@/types'

// ── Constants ─────────────────────────────────────────────

const TYPES: ResourceType[] = ['link', 'file', 'image', 'video', 'document']

const TYPE_ICONS: Record<ResourceType, string> = {
  link:     '🔗',
  file:     '📄',
  image:    '🖼️',
  video:    '🎬',
  document: '📝',
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
      <div className="w-9 h-9 rounded-lg bg-surface2 border border-border flex items-center justify-center flex-shrink-0 text-base">
        {TYPE_ICONS[resource.type] ?? '📎'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-base leading-snug text-text truncate">
          {resource.title}
        </div>
        <div className="font-mono text-xs text-muted truncate capitalize">{resource.type}</div>
      </div>
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
  onCreate: (data: { projectId: string; title: string; url: string; type: ResourceType; createdBy: string }) => void
}) {
  const [title, setTitle] = useState('')
  const [type, setType]   = useState<ResourceType>('link')
  const [url, setUrl]     = useState('')

  const handleSubmit = () => {
    if (!title.trim() || !url.trim()) return
    onCreate({ projectId, title: title.trim(), url: url.trim(), type, createdBy: '' })
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
  const { data: project } = useProject(projectId)
  const accent = getProjectColor(projectId)
  const [creating, setCreating] = useState(false)

  const { data: resources, isLoading } = useResources(projectId)
  const create = useCreateResource(projectId)

  const allResources = resources ?? []

  return (
    <div className="screen">
      <PageHeader projectId={projectId} title="Resources" meta={project ? (<div className="flex flex-col items-center gap-1.5"><span style={{ color: accent, fontSize: '0.50rem', letterSpacing: '0.06em' }}>{project.name}</span><span className="font-mono uppercase" style={{ fontSize: '0.38rem', padding: '2px 8px', borderRadius: 12, background: `${statusHex(project.status)}18`, color: statusHex(project.status) }}>{statusLabel(project.status)}</span></div>) : ''} />

      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 80 }}>
        {isLoading ? <LoadingState /> : (
          allResources.length === 0 ? <EmptyState text="No resources yet" /> : (
            allResources.map(r => <ResourceRow key={r.id} resource={r} />)
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
