'use client'

import { useMemo, useState } from 'react'
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

// Per-type RGB triplet → drives the .res-icon background tint via --type-rgb
// (gallery #45 uses purple for templates/files, red for PDF-like docs, teal
// for links, blue for media). ResourceType enum maps onto this palette so
// new types fall back to the gray placeholder.
const TYPE_RGB: Record<ResourceType, string> = {
  document: '196, 90, 220',  // purple — templates / docs
  file:     '232, 80, 80',   // red — PDFs / files
  link:     '0, 184, 148',   // teal — external links
  image:    '100, 112, 243', // indigo — media
  video:    '100, 112, 243', // indigo — media
}

// Section grouping per gallery. ResourceType enum collapses onto three
// sheen-extrusion section headers: documents → "Templates", file →
// "Documents", link → "Links", image/video → "Media".
type ResSection = 'Templates' | 'Documents' | 'Links' | 'Media'
const SECTION_FOR: Record<ResourceType, ResSection> = {
  document: 'Templates',
  file:     'Documents',
  link:     'Links',
  image:    'Media',
  video:    'Media',
}
const SECTION_ORDER: ResSection[] = ['Templates', 'Documents', 'Links', 'Media']

// Filter pill row — gallery #45 has All / Templates / Docs / Links / Media.
// "Docs" is the gallery's pill label for the Documents section.
type ResFilter = 'all' | ResSection
const FILTER_PILLS: { key: ResFilter; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'Templates', label: 'Templates' },
  { key: 'Documents', label: 'Docs' },
  { key: 'Links',     label: 'Links' },
  { key: 'Media',     label: 'Media' },
]

// ── Type icon ─────────────────────────────────────────────

function ResIcon({ type }: { type: ResourceType }) {
  // PDF-like file gets a typographic "PDF" label; document/link/media get
  // SVG glyphs. Wrapper carries the type-tinted bg/border via .res-icon.
  if (type === 'file') {
    return <span className="res-icon-pdf-label">PDF</span>
  }
  if (type === 'link') {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.5 9.5a3 3 0 0 0 4.24 0l2-2a3 3 0 0 0-4.24-4.24l-1 1" />
        <path d="M9.5 6.5a3 3 0 0 0-4.24 0l-2 2a3 3 0 0 0 4.24 4.24l1-1" />
      </svg>
    )
  }
  if (type === 'image' || type === 'video') {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="12" height="10" rx="1.5" />
        <circle cx="6" cy="7" r="1.2" />
        <path d="M2 11l3.5-2.5L9 11l3-3 2 2" />
      </svg>
    )
  }
  // document — template-style page
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 1.5h7.5L13 4v10.5H3z" />
      <line x1="5" y1="6" x2="11" y2="6" />
      <line x1="5" y1="8.5" x2="11" y2="8.5" />
      <line x1="5" y1="11" x2="9" y2="11" />
    </svg>
  )
}

// ── Resource Row ──────────────────────────────────────────

function ResourceRow({ resource }: { resource: Resource }) {
  // Action label tracks gallery convention: file/document/image/video →
  // "Download", link → "Open". Behavior is identical (same href + target),
  // only the pill copy differs by type.
  const actionLabel = resource.type === 'link' ? 'Open' : 'Download'
  const typeRgb = TYPE_RGB[resource.type] ?? '122, 122, 130'
  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className="res-row"
      style={{ ['--type-rgb' as string]: typeRgb } as React.CSSProperties}
    >
      <div className="res-icon">
        <ResIcon type={resource.type} />
      </div>
      <div className="res-info">
        <span className="res-name">{resource.title}</span>
        <span className="res-meta">{resource.type}</span>
      </div>
      <span className="res-action">{actionLabel}</span>
    </a>
  )
}

// ── New Resource Sheet ────────────────────────────────────

const TYPE_ICONS: Record<ResourceType, string> = {
  link: '🔗', file: '📄', image: '🖼️', video: '🎬', document: '📝',
}

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
  const [activeFilter, setActiveFilter] = useState<ResFilter>('all')
  // Register the + handler with the global ActionBar.
  useFabAction({ onPress: () => { haptic('light'); setCreating(true) } })

  const { data: resources, isLoading } = useResources(projectId)
  const create = useCreateResource(projectId)
  // Resource.createdBy is a non-null FK to User. Resolve the current user
  // via useMeId() (placeholder pre-Auth, real session post-Auth) and inject
  // it when the sheet hands off the form payload — keeps NewSheet decoupled
  // from auth resolution.
  const meId = useMeId()

  const allResources = (resources ?? []) as Resource[]

  // Section + filter counts. Counts always reflect the unfiltered data so
  // pills show "where you could go" totals, not what's currently visible.
  const counts = useMemo(() => {
    const out: Record<ResFilter, number> = { all: allResources.length, Templates: 0, Documents: 0, Links: 0, Media: 0 }
    for (const r of allResources) out[SECTION_FOR[r.type]]++
    return out
  }, [allResources])

  // Group filtered resources by section (Templates / Documents / Links /
  // Media). Sections render in SECTION_ORDER; empty sections are skipped.
  const sections = useMemo(() => {
    const filtered = activeFilter === 'all'
      ? allResources
      : allResources.filter(r => SECTION_FOR[r.type] === activeFilter)
    const buckets: Record<ResSection, Resource[]> = { Templates: [], Documents: [], Links: [], Media: [] }
    for (const r of filtered) buckets[SECTION_FOR[r.type]].push(r)
    return SECTION_ORDER
      .map(label => ({ label, items: buckets[label] }))
      .filter(s => s.items.length > 0)
  }, [allResources, activeFilter])

  // Cinema-glass tokens consumed by .sheen-title / .ai-meta-pill /
  // .res-section-header at this scope.
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

      {/* Filter pill row — gallery #45 All / Templates / Docs / Links / Media */}
      {!isLoading && allResources.length > 0 && (
        <div className="ai-dept-filters">
          {FILTER_PILLS.map(p => (
            <button
              key={p.key}
              type="button"
              onClick={() => setActiveFilter(p.key)}
              className={`dept-pill${activeFilter === p.key ? ' active' : ''}`}
            >
              <span>{p.label}</span>
              <span className="dept-count">{counts[p.key]}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 80, padding: '0 14px 80px' }}>
        {isLoading ? <LoadingState /> : (
          allResources.length === 0 ? <EmptyState text="No resources yet" /> : (
            sections.length === 0 ? (
              <div className="font-mono uppercase" style={{
                fontSize: '0.5rem', letterSpacing: '0.10em',
                color: 'var(--fg-mono)', textAlign: 'center', padding: '32px 0',
              }}>
                No resources in this filter.
              </div>
            ) : (
              <div className="res-list">
                {sections.map(section => (
                  <div key={section.label} className="res-section">
                    <h2 className="res-section-header">{section.label}</h2>
                    <div className="res-rows">
                      {section.items.map(r => (
                        <ResourceRow key={r.id} resource={r} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
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
