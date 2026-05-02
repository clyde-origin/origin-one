'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useProject, useResources, useCreateResource, useMeId } from '@/lib/hooks/useOriginOne'

import { LoadingState, EmptyState } from '@/components/ui'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProjectSwitcher } from '@/components/ProjectSwitcher'
import { useFabAction } from '@/lib/contexts/FabActionContext'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { haptic } from '@/lib/utils/haptics'
import { getProjectColor, statusLabel } from '@/lib/utils/phase'
import type { Resource, ResourceType } from '@/types'

// ── Helpers ────────────────────────────────────────────────

// Decompose a #rrggbb hex into a [r,g,b] triplet so the screen root can set
// `--tile-rgb` / `--accent-rgb` / `--accent-glow-rgb` for the cinema-glass
// classes (`glass-tile`, `sheen-title`, `ai-meta-pill`) to consume.
function hexToRgb(hex: string | null | undefined): [number, number, number] {
  const h = (hex && /^#[0-9a-f]{6}$/i.test(hex)) ? hex : '#c45adc'
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}

// Project status → ai-meta-pill phase modifier (.pre / .prod / .post).
function statusToPhase(s: string | undefined): 'pre' | 'prod' | 'post' {
  if (s === 'production') return 'prod'
  if (s === 'post_production') return 'post'
  return 'pre'
}

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
      className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors active:opacity-80"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border)',
        }}
      >
        {TYPE_ICONS[resource.type] ?? '📎'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-base leading-snug truncate" style={{ color: 'var(--fg)' }}>
          {resource.title}
        </div>
        <div className="font-mono text-xs truncate capitalize" style={{ color: 'var(--fg-mono)' }}>{resource.type}</div>
      </div>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0" style={{ color: 'var(--fg-mono)' }}>
        <path d="M4 2h6v6M10 2L3 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </a>
  )
}

// ── New Resource Sheet ────────────────────────────────────

function NewSheet({ projectId, onClose, onCreate }: {
  projectId: string
  onClose: () => void
  onCreate: (data: { projectId: string; title: string; url: string; type: ResourceType }) => void
}) {
  const [title, setTitle] = useState('')
  const [type, setType]   = useState<ResourceType>('link')
  const [url, setUrl]     = useState('')

  const handleSubmit = () => {
    if (!title.trim() || !url.trim()) return
    onCreate({ projectId, title: title.trim(), url: url.trim(), type })
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
  const accent = project?.color || getProjectColor(projectId)
  const [creating, setCreating] = useState(false)
  // Register the + handler with the global ActionBar.
  useFabAction({ onPress: () => { haptic('light'); setCreating(true) } })

  const { data: resources, isLoading } = useResources(projectId)
  const create = useCreateResource(projectId)
  // Resource.createdBy is a non-null FK to User. Resolve the current user
  // via useMeId() (placeholder pre-Auth, real session post-Auth) and inject
  // it when the sheet hands off the form payload — keeps NewSheet decoupled
  // from auth resolution.
  const meId = useMeId()

  const allResources = resources ?? []
  // Cinema-glass tokens consumed by .sheen-title / .ai-meta-pill at this scope.
  const [pr, pg, pb] = hexToRgb(accent)
  const glowR = Math.min(255, pr + 20)
  const glowG = Math.min(255, pg + 30)
  const glowB = Math.min(255, pb + 16)

  return (
    <div
      className="screen"
      style={{
        ['--tile-rgb' as string]: `${pr}, ${pg}, ${pb}`,
        ['--accent-rgb' as string]: `${pr}, ${pg}, ${pb}`,
        ['--accent-glow-rgb' as string]: `${glowR}, ${glowG}, ${glowB}`,
      } as React.CSSProperties}
    >
      <PageHeader projectId={projectId} title="Resources" meta={project ? (
        <div className="flex flex-col items-center gap-1.5">
          <ProjectSwitcher projectId={projectId} projectName={project.name} accentColor={accent} variant="meta" />
          <span className={`ai-meta-pill ${statusToPhase(project.status)}`}>
            <span className="phase-dot" />
            {statusLabel(project.status)}
          </span>
        </div>
      ) : ''} />

      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 80 }}>
        {isLoading ? <LoadingState /> : (
          allResources.length === 0 ? <EmptyState text="No resources yet" /> : (
            allResources.map(r => <ResourceRow key={r.id} resource={r} />)
          )
        )}
      </div>

      {/* + handler registered above via useFabAction. ActionBar is mounted globally. */}

      <Sheet open={creating} onClose={() => setCreating(false)}>
        <NewSheet projectId={projectId} onClose={() => setCreating(false)}
          onCreate={(data) => {
            if (!meId) return // pre-Auth seed-empty edge case; sheet will close, no row written
            create.mutate({ ...data, createdBy: meId })
          }} />
      </Sheet>
    </div>
  )
}