'use client'

import { useState, useRef, useCallback, useMemo, useEffect, memo } from 'react'
import { EMPTY_ARRAY } from '@/lib/empty-collections'
import { AnimatePresence } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { m } from 'framer-motion'
import dynamic from 'next/dynamic'
import { useProject, useShotlistVersions, useCreateShotlistVersion, useUpdateShotlistVersionLabel, useThreadPreviews } from '@/lib/hooks/useOriginOne'
import { getShotsByProject, updateShotOrder, updateShootOrder, createShot, createScene, createSceneAtPosition, uploadStoryboardImage, updateShot, updateScene, deleteScene } from '@/lib/db/queries'
import { PageHeader } from '@/components/ui/PageHeader'
import { ScenemakerSkeleton } from '@/components/scenemaker/ScenemakerSkeleton'
import { ProjectSwitcher } from '@/components/ProjectSwitcher'
import { StorageImage } from '@/components/ui/StorageImage'
import { Sheet } from '@/components/ui/Sheet'
import { haptic } from '@/lib/utils/haptics'
import { useFabAction } from '@/lib/contexts/FabActionContext'
import { deriveProjectColors, DEFAULT_PROJECT_HEX } from '@origin-one/ui'
import { getProjectColor, getSceneColor, statusLabel } from '@/lib/utils/phase'
import { aspectRatioToCss } from '@/lib/aspect-ratio'
import { STORYBOARD_STYLES, DEFAULT_STORYBOARD_STYLE, type StoryboardStyle } from '@/lib/bria/style'
import { SHOT_SIZE_OPTIONS, SHOT_SIZE_ABBREV } from '@/lib/shot-sizes'
import { ScriptView, type ScriptViewHandle } from './components/ScriptView'
import { ThreadRowBadge } from '@/components/threads/ThreadRowBadge'

// Heavy modules deferred until the surface that needs them mounts.
// PdfExport pulls in @react-pdf/renderer; EntityDrawer + ShotDetailSheet
// + StoryboardImageSheet only render on user interaction. Keeping them
// out of the initial SceneMaker chunk shrinks the navigation cost from
// the Hub.
const ShotDetailSheet = dynamic(
  () => import('./components/ShotDetailSheet').then(m => ({ default: m.ShotDetailSheet })),
  { ssr: false },
)
const EntityDrawer = dynamic(
  () => import('./components/EntityDrawer').then(m => ({ default: m.EntityDrawer })),
  { ssr: false },
)
const PdfExport = dynamic(
  () => import('./components/PdfExport').then(m => ({ default: m.PdfExport })),
  { ssr: false },
)
const StoryboardImageSheet = dynamic(
  () => import('@/components/storyboard/StoryboardImageSheet').then(m => ({ default: m.StoryboardImageSheet })),
  { ssr: false },
)
import { Toast, type ToastSpec } from '@/components/ui/Toast'
import {
  DndContext,
  closestCenter,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Scene, Shot, SceneMakerMode } from '@/types'

type StoryboardScale = 'feed' | '3up' | '2up' | 'all'
type ScriptPanel = 'characters' | 'locations' | 'props' | null

// Map ProjectStatus enum to the .ai-meta-pill modifier ('pre' / 'prod' / 'post').
// Cinema Glass chip pattern (DESIGN_LANGUAGE.md) only ships these three.
function statusToPhase(s: string | undefined): 'pre' | 'prod' | 'post' | '' {
  switch (s) {
    case 'development':
    case 'pre_production': return 'pre'
    case 'production': return 'prod'
    case 'post_production': return 'post'
    default: return ''
  }
}

// ── PILL SELECTOR ─────────────────────────────────────────

// PillSelector renders pills with a friendly `label` and emits the underlying
// `value` — so the DB receives the schema enum value, not the human label.
// The previous string[] shape sent UI labels (e.g. "ECU") straight into the
// ShotSize enum and 500'd with `invalid input value for enum`.
// PillSelector renders pills with a friendly `label` and emits the underlying
// `value`. The pill row is a single horizontal-scroll lane so 10+ options
// (Frame size has 10) stay one row on phone widths instead of wrapping into
// a tall grid. Selected pill gets a contrasting accent fill so it's findable
// even when scrolled off-screen and snapped back.
function PillSelector({ label, options, value, onChange, accent }: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
  accent: string
}) {
  return (
    <div>
      <span className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</span>
      <div
        className="flex no-scrollbar"
        style={{
          gap: 6,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 2,
        }}
      >
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            className="font-mono cursor-pointer select-none transition-all flex-shrink-0"
            style={{
              fontSize: '0.62rem', letterSpacing: '0.04em', padding: '8px 14px', borderRadius: 18,
              background: value === o.value ? `${accent}28` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${value === o.value ? `${accent}66` : 'rgba(255,255,255,0.06)'}`,
              color: value === o.value ? accent : '#a8a8b8',
              fontWeight: value === o.value ? 600 : 500,
              whiteSpace: 'nowrap',
            }}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── NEW SHOT SHEET ────────────────────────────────────────

// SIZE_ABBREV is the compact-badge map for hub/shotlist surfaces; the
// canonical schema values + UI options live in @/lib/shot-sizes.
const SIZE_ABBREV = SHOT_SIZE_ABBREV

function Spinner({ color }: { color: string }) {
  return (
    <span
      className="rounded-full border animate-spin inline-block"
      style={{ width: 12, height: 12, borderColor: 'rgba(255,255,255,0.18)', borderTopColor: color }}
      aria-label="Loading"
    />
  )
}

// Image source: Upload (file picker) OR Create (Bria-generated preview).
// Both paths produce a Blob held in NewShotSheet state and displayed in
// the hero area until the user taps Save (which createShot's, then uploads).
type ImageMode = 'upload' | 'create'

type NewShotSaveData = {
  description: string
  size: string
  // Final blob to attach. Same shape regardless of source — by the time we
  // hit Save, Upload-file and Bria-preview both look like bytes.
  imageBlob: Blob | null
}

function NewShotSheet({ autoId, projectId, accent, aspectRatio, pending, onSave, onClose }: {
  autoId: string
  projectId: string
  accent: string
  aspectRatio?: string | null
  pending: boolean
  onSave: (data: NewShotSaveData) => void
  onClose: () => void
}) {
  const [description, setDescription] = useState('')
  const [size, setSize] = useState('')
  const [imageMode, setImageMode] = useState<ImageMode>('create')
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState<StoryboardStyle>(DEFAULT_STORYBOARD_STYLE)
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Object-URL housekeeping — revoke on swap or unmount so we don't leak
  // blobs while the user iterates. The setter fires once per assignment;
  // the cleanup for the *previous* URL runs from inside setPreview.
  function setPreview(blob: Blob | null) {
    setPreviewBlob(blob)
    setPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return blob ? URL.createObjectURL(blob) : null
    })
  }

  useEffect(() => {
    return () => {
      // Revoke whatever URL is in flight when the component unmounts.
      // setPreviewUrl's setter runs once via the closure to do the cleanup.
      setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null })
    }
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) setPreview(f)
  }

  async function handleGenerate() {
    if (!prompt.trim() || generating) return
    setGenerating(true)
    setGenerateError(null)
    try {
      const res = await fetch('/api/storyboard/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, prompt: prompt.trim(), style }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.detail || body?.error || `Generation failed (${res.status})`)
      }
      const blob = await res.blob()
      haptic('success')
      setPreview(blob)
    } catch (err) {
      console.error('Bria preview failed:', err)
      setGenerateError((err as Error).message ?? 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const busy = pending || generating
  const canSave = !busy

  return (
    <>
      <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '12px auto 18px' }} />
      <div style={{ padding: '0 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div style={{ fontFamily: "'Geist', sans-serif", fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#dddde8' }}>New Shot</div>
        <span className="font-mono" style={{ fontSize: '0.62rem', fontWeight: 700, color: accent }}>{autoId}</span>
      </div>
      <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '70vh', overflowY: 'auto' }}>

        {/* Hero image area — mirrors ShotDetailSheet's hero block. Empty
            shows the dashed placeholder; populated shows the held blob via
            an object URL. Tap-to-upload only fires when no preview yet. */}
        <div
          className={previewBlob || imageMode !== 'upload' ? '' : 'cursor-pointer'}
          style={{
            borderRadius: 10,
            overflow: 'hidden',
            aspectRatio: aspectRatioToCss(aspectRatio),
            background: previewUrl ? 'transparent' : `linear-gradient(135deg, ${accent}12, ${accent}06)`,
            border: previewUrl ? 'none' : `1.5px dashed ${accent}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}
          onClick={() => {
            if (previewBlob || imageMode !== 'upload' || busy) return
            fileInputRef.current?.click()
          }}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div className="flex flex-col items-center gap-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="5" width="18" height="14" rx="2" stroke={accent} strokeWidth="1.5" opacity="0.5" />
                <path d="M12 10v4M10 12h4" stroke={accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
              </svg>
              <span className="font-mono uppercase" style={{ fontSize: '0.4rem', letterSpacing: '0.08em', color: accent, opacity: 0.6 }}>
                {generating ? 'Generating…' : imageMode === 'upload' ? 'Tap to upload' : 'No image yet'}
              </span>
            </div>
          )}
          {generating && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(4,4,10,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Spinner color={accent} />
            </div>
          )}
          {previewBlob && !busy && (
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="absolute top-2 right-2"
              style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(4,4,10,0.7)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', color: '#dddde8', fontSize: '0.7rem', cursor: 'pointer' }}
              aria-label="Remove image"
            >
              ✕
            </button>
          )}
        </div>

        <div>
          <span className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Description</span>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="describe your shot"
            autoFocus
            disabled={busy}
            className="w-full outline-none focus:border-white/20"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7, padding: '8px 12px', fontSize: '0.76rem', color: '#dddde8' }} />
        </div>
        <PillSelector label="Frame size" options={SHOT_SIZE_OPTIONS} value={size} onChange={setSize} accent={accent} />

        {/* Image source — Upload OR Create. Default is Create so the
            Generate button is one tap away. */}
        <div>
          <span className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Image source</span>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {(['create', 'upload'] as ImageMode[]).map(m => {
              const active = imageMode === m
              const label = m === 'upload' ? 'Upload' : 'Create image'
              return (
                <button
                  key={m}
                  type="button"
                  disabled={busy}
                  onClick={() => { haptic('light'); setImageMode(m); setPreview(null); setGenerateError(null) }}
                  className="font-mono uppercase flex-1"
                  style={{
                    background: active ? `${accent}28` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${active ? `${accent}66` : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 7,
                    padding: '8px 6px',
                    color: active ? accent : '#a8a8b8',
                    fontSize: '0.46rem',
                    letterSpacing: '0.08em',
                    cursor: busy ? 'not-allowed' : 'pointer',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {imageMode === 'upload' && (
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          )}

          {imageMode === 'create' && (
            <>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                disabled={busy}
                placeholder="describe your shot"
                rows={3}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  color: '#dddde8',
                  fontSize: '0.76rem',
                  lineHeight: 1.5,
                  resize: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              {description.trim() && !prompt.trim() && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { haptic('light'); setPrompt(description) }}
                  className="font-mono uppercase"
                  style={{ marginTop: 6, background: 'none', border: 'none', color: accent, fontSize: '0.46rem', letterSpacing: '0.08em', cursor: busy ? 'not-allowed' : 'pointer', padding: 0 }}
                >
                  Use shot description ↓
                </button>
              )}
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="font-mono uppercase" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em' }}>Style</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {STORYBOARD_STYLES.map(({ value: v, label }) => {
                    const active = style === v
                    return (
                      <button
                        key={v}
                        type="button"
                        disabled={busy}
                        onClick={() => { haptic('light'); setStyle(v) }}
                        className="font-mono uppercase flex-1"
                        style={{
                          background: active ? `${accent}28` : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${active ? `${accent}66` : 'rgba(255,255,255,0.06)'}`,
                          borderRadius: 7,
                          padding: '8px 6px',
                          color: active ? accent : '#a8a8b8',
                          fontSize: '0.46rem',
                          letterSpacing: '0.08em',
                          cursor: busy ? 'not-allowed' : 'pointer',
                          opacity: busy ? 0.5 : 1,
                        }}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Generate / Regenerate — its own button, distinct from Save.
                  User can iterate until happy, then commit with Save. */}
              <button
                type="button"
                disabled={busy || !prompt.trim()}
                onClick={handleGenerate}
                className="font-bold cursor-pointer transition-all flex items-center justify-center gap-2"
                style={{
                  marginTop: 10,
                  width: '100%',
                  padding: 11, borderRadius: 8, fontSize: '0.74rem',
                  background: busy || !prompt.trim() ? 'rgba(255,255,255,0.04)' : accent,
                  border: `1px solid ${busy || !prompt.trim() ? 'rgba(255,255,255,0.06)' : accent}`,
                  color: busy || !prompt.trim() ? '#62627a' : '#04040a',
                  cursor: busy || !prompt.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {generating && <Spinner color="#62627a" />}
                {generating ? 'Generating…' : previewBlob ? 'Regenerate' : 'Generate'}
              </button>
              <span className="font-mono block" style={{ marginTop: 6, fontSize: '0.42rem', color: '#62627a', letterSpacing: '0.06em', textAlign: 'center' }}>
                Image generation takes 30–60 seconds.
              </span>
              {generateError && (
                <span style={{ marginTop: 8, display: 'block', fontSize: '0.62rem', color: '#ff7b7b', background: 'rgba(255,123,123,0.06)', border: '1px solid rgba(255,123,123,0.15)', borderRadius: 6, padding: '8px 10px' }}>
                  {generateError}
                </span>
              )}
            </>
          )}
        </div>
      </div>
      <div style={{ padding: '14px 20px 0', display: 'flex', gap: 10 }}>
        <button className="flex-1 font-bold transition-all flex items-center justify-center gap-2"
          disabled={!canSave}
          style={{
            padding: 13, borderRadius: 8, fontSize: '0.78rem',
            background: canSave ? `${accent}1f` : 'rgba(255,255,255,0.04)',
            border: `1px solid ${canSave ? `${accent}40` : 'rgba(255,255,255,0.06)'}`,
            color: canSave ? accent : '#62627a',
            cursor: canSave ? 'pointer' : 'not-allowed',
          }}
          onClick={() => { haptic('medium'); onSave({ description, size, imageBlob: previewBlob }) }}>
          {pending && <Spinner color={accent} />}
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button className="flex-1 font-bold cursor-pointer transition-all"
          disabled={busy}
          style={{ padding: 13, borderRadius: 8, fontSize: '0.78rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)', color: '#a0a0b8', opacity: busy ? 0.5 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}
          onClick={onClose}>
          Cancel
        </button>
      </div>
    </>
  )
}

// ── SHOTLIST VIEW (drag via @dnd-kit) ────────────────────

// Scene-header droppable IDs are namespaced so they don't collide with
// shot IDs in the same DndContext. The prefix is stripped when resolving
// a drop target back to its scene id.
const SCENE_HEADER_DROPPABLE = 'scene-header-'

function ShotlistView({ scenes, shots, accent, sortMode = 'story', threadByShotId, onTapShot, onTapThumbnail, onInsert, onReorder, onReorderToScene, onRenameScene, onDeleteScene, onUpdateShot, onShootReorder }: {
  scenes: Scene[]; shots: Shot[]; accent: string
  sortMode?: 'story' | 'shooting'
  threadByShotId?: Map<string, { count: number; unread: boolean }>
  onTapShot: (s: Shot) => void; onTapThumbnail: (s: Shot) => void
  onInsert: (index: number, sceneId: string) => void
  onReorder: (shotId: string, newIndex: number) => void
  onReorderToScene: (shotId: string, sceneId: string) => void
  onRenameScene: (sceneId: string, title: string) => void
  onDeleteScene: (sceneId: string) => void
  onUpdateShot: (shotId: string, fields: { description?: string }) => void
  onShootReorder?: (shotId: string, newIndex: number) => void
}) {
  const totalScenes = scenes.length
  const [collapsedScenes, setCollapsedScenes] = useState<Set<string>>(new Set())
  const [wiggleMode, setWiggleMode] = useState(false)
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [editingDescShotId, setEditingDescShotId] = useState<string | null>(null)
  const [editingDescValue, setEditingDescValue] = useState('')
  const [blinkIds, setBlinkIds] = useState<Set<string>>(new Set())

  // dnd-kit drag state. Exposed to render so the live shot-number projection
  // can recompute "where would this shot land if released right now".
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  // Wiggle entry: dnd-kit's TouchSensor with a 250 ms delay handles the
  // press-and-hold gesture. When drag activates, handleDragStart flips
  // wiggleMode on so the visual state (handles, hidden thumbnails, no
  // scene-collapse on tap) appears at the same instant the row picks up.
  // The mode persists after the drag ends so subsequent reorders are
  // immediate; tap "Done" or tap outside to exit.

  // Flat list of shots in the current display order. This is the source of
  // truth for dnd-kit's SortableContext items.
  const flatShots = useMemo(() => {
    if (sortMode === 'shooting') {
      const scheduled = shots.filter(s => s.shootOrder != null).sort((a, b) => a.shootOrder! - b.shootOrder!)
      const unscheduled = shots.filter(s => s.shootOrder == null).sort((a, b) => a.shotNumber.localeCompare(b.shotNumber, undefined, { numeric: true }))
      return [...scheduled, ...unscheduled]
    }
    return [...shots].sort((a, b) => a.sortOrder - b.sortOrder)
  }, [shots, sortMode])
  const flatIds = useMemo(() => flatShots.map(s => s.id), [flatShots])

  // O(1) lookups for scene/shot relations. Built once per (scenes, shots)
  // change so the per-row render path doesn't re-scan the full lists.
  const sceneById = useMemo(() => {
    const m = new Map<string, Scene>()
    for (const sc of scenes) m.set(sc.id, sc)
    return m
  }, [scenes])

  const shotsByScene = useMemo(() => {
    const m = new Map<string, Shot[]>()
    for (const s of shots) {
      const arr = m.get(s.sceneId)
      if (arr) arr.push(s)
      else m.set(s.sceneId, [s])
    }
    for (const arr of m.values()) arr.sort((a, b) => a.sortOrder - b.sortOrder)
    return m
  }, [shots])

  const shotIndexInScene = useMemo(() => {
    const m = new Map<string, number>()
    for (const arr of shotsByScene.values()) {
      for (let i = 0; i < arr.length; i++) m.set(arr[i].id, i)
    }
    return m
  }, [shotsByScene])

  const shotById = useMemo(() => {
    const m = new Map<string, Shot>()
    for (const s of shots) m.set(s.id, s)
    return m
  }, [shots])

  const onUpdateShotDesc = useCallback((shotId: string, description: string) => {
    onUpdateShot(shotId, { description })
  }, [onUpdateShot])

  // Auto-numbered display string per scene (1A, 1B, 1C, …). Pure projection
  // off (sceneId, sortOrder) — never touches the persisted shot.shotNumber.
  const getShotDisplayNumber = useCallback((shot: Shot) => {
    const scene = sceneById.get(shot.sceneId)
    const prefix = scene?.sceneNumber ?? '1'
    const idx = shotIndexInScene.get(shot.id) ?? 0
    const letter = String.fromCharCode(65 + Math.max(0, idx))
    return `${prefix}${letter}`
  }, [sceneById, shotIndexInScene])

  // Live projected display number during drag — driven by dnd-kit's active/over
  // ids. Replaces the old hand-rolled rect-based recomputation.
  const getProjectedDisplayNumber = useCallback((shot: Shot, sceneId: string) => {
    if (!activeId || !overId || activeId === overId) return getShotDisplayNumber(shot)

    const overSceneTarget = overId.startsWith(SCENE_HEADER_DROPPABLE) ? overId.slice(SCENE_HEADER_DROPPABLE.length) : null
    let virtual: string[]
    let activeSceneId: string

    if (overSceneTarget) {
      // Drop on scene header → active shot lands at top of that scene
      const sceneFirst = flatShots.find(s => s.sceneId === overSceneTarget && s.id !== activeId)
      virtual = flatIds.filter(id => id !== activeId)
      const insertAt = sceneFirst ? virtual.indexOf(sceneFirst.id) : virtual.length
      virtual.splice(insertAt < 0 ? virtual.length : insertAt, 0, activeId)
      activeSceneId = overSceneTarget
    } else {
      const oldIdx = flatIds.indexOf(activeId)
      const newIdx = flatIds.indexOf(overId)
      if (oldIdx < 0 || newIdx < 0) return getShotDisplayNumber(shot)
      virtual = arrayMove(flatIds, oldIdx, newIdx)
      // Active shot inherits sceneId from its neighbor at landing position
      const ni = virtual.indexOf(activeId)
      const neighborId = virtual[ni === 0 ? 1 : ni - 1]
      const neighbor = shotById.get(neighborId)
      activeSceneId = neighbor?.sceneId ?? shot.sceneId
    }

    let letterIdx = 0
    for (const id of virtual) {
      const sid = id === activeId ? activeSceneId : (shotById.get(id)?.sceneId ?? '')
      if (sid !== sceneId) continue
      if (id === shot.id) {
        const scene = sceneById.get(sceneId)
        const prefix = scene?.sceneNumber ?? '1'
        return `${prefix}${String.fromCharCode(65 + letterIdx)}`
      }
      letterIdx++
    }
    return getShotDisplayNumber(shot)
  }, [activeId, overId, flatIds, flatShots, shotById, sceneById, getShotDisplayNumber])

  // Scene header that's currently being dragged over (visual cue)
  const dragOverSceneId = useMemo<string | null>(
    () => overId && overId.startsWith(SCENE_HEADER_DROPPABLE) ? overId.slice(SCENE_HEADER_DROPPABLE.length) : null,
    [overId],
  )

  // Sensors split by input type — TouchSensor uses non-passive listeners and
  // can preventDefault on touchmove (PointerSensor can't on iOS Safari, where
  // its listeners are passive). MouseSensor activates on 5 px movement;
  // TouchSensor activates after a 250 ms press-and-hold (≤5 px movement
  // during the hold, otherwise it's a scroll). The same continuous gesture
  // (press → hold → slide) flips wiggle visual on AND starts the drag in
  // handleDragStart below — no separate "enter wiggle, then drag" sequence.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
    setWiggleMode(true)
    haptic('medium')
  }
  function handleDragOver(event: DragOverEvent) {
    setOverId(event.over ? String(event.over.id) : null)
  }
  function handleDragEnd(event: DragEndEvent) {
    const aId = String(event.active.id)
    const oId = event.over ? String(event.over.id) : null
    setActiveId(null)
    setOverId(null)
    if (!oId || aId === oId) return

    if (sortMode === 'shooting') {
      if (!onShootReorder) return
      const newIndex = flatIds.indexOf(oId)
      if (newIndex >= 0) onShootReorder(aId, newIndex)
      return
    }

    // Story mode — scene header drop OR drop onto another shot
    const sceneTarget = oId.startsWith(SCENE_HEADER_DROPPABLE) ? oId.slice(SCENE_HEADER_DROPPABLE.length) : null
    if (sceneTarget) {
      onReorderToScene(aId, sceneTarget)
      setBlinkIds(new Set([aId]))
      setTimeout(() => setBlinkIds(new Set()), 700)
      return
    }
    const newIndex = flatIds.indexOf(oId)
    if (newIndex < 0) return

    // Cross-scene drop onto the FIRST shot of the destination scene → treat as
    // a scene-header drop. Without this, handleReorder's splice (drag-down
    // lands after over) would put the active shot at SECOND position in the
    // destination scene; drag-up onto first-of-cross-scene is even worse —
    // it would leave the active in the previous scene entirely. Either way,
    // "first of target scene" is the user-intended outcome.
    const overShot = shots.find(s => s.id === oId)
    const activeShot = shots.find(s => s.id === aId)
    if (overShot && activeShot && overShot.sceneId !== activeShot.sceneId) {
      const sceneShotsSorted = shots
        .filter(s => s.sceneId === overShot.sceneId)
        .sort((a, b) => a.sortOrder - b.sortOrder)
      if (sceneShotsSorted[0]?.id === overShot.id) {
        onReorderToScene(aId, overShot.sceneId)
        setBlinkIds(new Set([aId]))
        setTimeout(() => setBlinkIds(new Set()), 700)
        return
      }
    }

    // Snapshot display numbers before reorder so we can blink the changed ones
    const before = new Map<string, string>()
    shots.forEach(s => before.set(s.id, getShotDisplayNumber(s)))
    onReorder(aId, newIndex)
    requestAnimationFrame(() => {
      const changed = new Set<string>()
      shots.forEach(s => {
        const oldNum = before.get(s.id)
        const newNum = getShotDisplayNumber(s)
        if (oldNum && newNum !== oldNum) changed.add(s.id)
      })
      changed.add(aId)
      if (changed.size > 0) {
        setBlinkIds(changed)
        setTimeout(() => setBlinkIds(new Set()), 700)
      }
    })
  }

  const toggleScene = (sceneId: string) => {
    setCollapsedScenes(prev => {
      const next = new Set(prev)
      if (next.has(sceneId)) next.delete(sceneId); else next.add(sceneId)
      return next
    })
  }

  if (shots.length === 0) return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: '60vh', gap: 10 }}>
      <div className="flex items-center justify-center cursor-pointer rounded-full" style={{ width: 40, height: 40, border: '1.5px dashed rgba(196,90,220,0.35)' }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1V11M1 6H11" stroke="rgba(196,90,220,0.5)" strokeWidth="1.4" strokeLinecap="round" /></svg>
      </div>
      <span style={{ fontSize: '0.8rem', color: '#62627a', letterSpacing: '0.04em' }}>No Shots Yet</span>
    </div>
  )

  const InsertRow = ({ index, sceneId }: { index: number; sceneId: string }) => (
    <div className="flex items-center group" style={{ padding: '0 14px', height: 16, gap: 0 }}>
      <div className="flex-1 group-hover:bg-[rgba(196,90,220,0.15)] transition-colors" style={{ height: 1 }} />
      <button className="flex items-center justify-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
        style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
        onClick={() => { haptic('light'); onInsert(index, sceneId) }}>
        <svg width="7" height="7" viewBox="0 0 7 7" fill="none"><path d="M3.5 1V6M1 3.5H6" stroke="rgba(196,90,220,0.6)" strokeWidth="1.1" strokeLinecap="round" /></svg>
      </button>
      <div className="flex-1 group-hover:bg-[rgba(196,90,220,0.15)] transition-colors" style={{ height: 1 }} />
    </div>
  )

  const renderShootCard = (shot: Shot) => {
    const scene = sceneById.get(shot.sceneId)
    const sceneColor = scene ? getSceneColor(parseInt(scene.sceneNumber), totalScenes) : '#c45adc'
    return (
      <SortableShotRow
        key={shot.id}
        shot={shot}
        sceneColor={sceneColor}
        displayNum={shot.shotNumber}
        blinking={false}
        wiggleMode={wiggleMode}
        showThumbnail={!wiggleMode}
        descBehavior="tap-opens-detail"
        onTapShot={onTapShot}
        onTapShotThumbnail={onTapThumbnail}
        threadEntry={threadByShotId?.get(shot.id)}
      />
    )
  }

  // ── SHOOTING ORDER RENDER ──
  if (sortMode === 'shooting') {
    const scheduled = flatShots.filter(s => s.shootOrder != null)
    const unscheduled = flatShots.filter(s => s.shootOrder == null)

    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <SortableContext items={flatIds} strategy={verticalListSortingStrategy}>
          <div onClick={wiggleMode && !activeId ? () => setWiggleMode(false) : undefined}>
            {wiggleMode && (
              <div className="flex justify-center" style={{ padding: '8px 14px 4px' }}>
                <button className="font-mono uppercase cursor-pointer"
                  style={{ fontSize: '0.44rem', letterSpacing: '0.06em', padding: '5px 16px', borderRadius: 14, background: `${accent}1f`, border: `1px solid ${accent}40`, color: accent }}
                  onClick={(e) => { e.stopPropagation(); haptic('light'); setWiggleMode(false) }}>Done</button>
              </div>
            )}

            <div className="flex items-center" style={{ gap: 8, padding: '11px 14px 7px' }}>
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '0.52rem', fontWeight: 700, letterSpacing: '0.02em', color: '#a0a0b8', opacity: 0.7 }}>
                Shoot Order
              </span>
              <span className="font-mono flex-shrink-0" style={{ fontSize: '0.38rem', color: '#62627a', opacity: 0.55 }}>
                {scheduled.length}
              </span>
            </div>
            <div style={{ height: 1, margin: '0 14px 4px', background: '#a0a0b8', opacity: 0.15 }} />

            {scheduled.length === 0 && unscheduled.length > 0 && (
              <div className="flex items-center justify-center" style={{ padding: '16px 14px 8px' }}>
                <span className="font-mono" style={{ fontSize: '0.46rem', color: '#62627a' }}>No shoot order set yet</span>
              </div>
            )}
            {scheduled.map(renderShootCard)}

            {unscheduled.length > 0 && (
              <>
                <div className="flex items-center" style={{ gap: 8, padding: '16px 14px 7px' }}>
                  <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '0.52rem', fontWeight: 700, letterSpacing: '0.02em', color: '#62627a', opacity: 0.7 }}>
                    Unscheduled
                  </span>
                  <span className="font-mono flex-shrink-0" style={{ fontSize: '0.38rem', color: '#62627a', opacity: 0.4 }}>
                    {unscheduled.length}
                  </span>
                </div>
                <div style={{ height: 1, margin: '0 14px 4px', background: '#62627a', opacity: 0.15 }} />
                {unscheduled.map(renderShootCard)}
              </>
            )}
          </div>
        </SortableContext>
      </DndContext>
    )
  }

  // ── STORY ORDER RENDER ──
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <SortableContext items={flatIds} strategy={verticalListSortingStrategy}>
        <div onClick={wiggleMode && !activeId ? () => setWiggleMode(false) : undefined}>
          {wiggleMode && (
            <div className="flex justify-center" style={{ padding: '8px 14px 4px' }}>
              <button className="font-mono uppercase cursor-pointer"
                style={{ fontSize: '0.44rem', letterSpacing: '0.06em', padding: '5px 16px', borderRadius: 14, background: `${accent}1f`, border: `1px solid ${accent}40`, color: accent }}
                onClick={(e) => { e.stopPropagation(); haptic('light'); setWiggleMode(false) }}>Done</button>
            </div>
          )}

          {scenes.map(scene => {
            const sceneShots = shotsByScene.get(scene.id) ?? (EMPTY_ARRAY as readonly Shot[]) as Shot[]
            const sceneColor = getSceneColor(parseInt(scene.sceneNumber), totalScenes)
            const isOpen = !collapsedScenes.has(scene.id)

            return (
              <div key={scene.id}>
                <SceneHeaderDroppable
                  scene={scene}
                  sceneColor={sceneColor}
                  highlighted={dragOverSceneId === scene.id}
                  isEditing={editingSceneId === scene.id}
                  editingTitle={editingTitle}
                  setEditingTitle={setEditingTitle}
                  setEditingSceneId={setEditingSceneId}
                  onRenameScene={onRenameScene}
                  toggleScene={toggleScene}
                  wiggleMode={wiggleMode}
                  isOpen={isOpen}
                  accent={accent}
                  shotCount={sceneShots.length}
                  onConfirmDelete={() => { haptic('warning'); setConfirmDeleteId(scene.id) }}
                />

                {confirmDeleteId === scene.id && (
                  <div style={{ padding: '6px 14px 8px', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(232,86,74,0.06)', borderRadius: 6, margin: '0 14px 4px' }}>
                    <span style={{ fontSize: '0.56rem', color: '#e8564a', flex: 1 }}>Delete scene {scene.sceneNumber} and {sceneShots.length} shot{sceneShots.length !== 1 ? 's' : ''}?</span>
                    <button className="font-mono uppercase cursor-pointer"
                      style={{ fontSize: '0.4rem', letterSpacing: '0.06em', padding: '4px 10px', borderRadius: 10, background: 'rgba(232,86,74,0.15)', border: '1px solid rgba(232,86,74,0.3)', color: '#e8564a' }}
                      onClick={(e) => { e.stopPropagation(); onDeleteScene(scene.id); setConfirmDeleteId(null) }}>Delete</button>
                    <button className="font-mono uppercase cursor-pointer"
                      style={{ fontSize: '0.4rem', letterSpacing: '0.06em', padding: '4px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#a0a0b8' }}
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null) }}>Cancel</button>
                  </div>
                )}

                <div style={{ height: 1, margin: '0 14px 4px', background: sceneColor, opacity: 0.5 }} />

                {(isOpen || wiggleMode) && (
                  <>
                    {wiggleMode && sceneShots.length === 0 && (
                      <EmptySceneDropZone sceneColor={sceneColor} highlighted={dragOverSceneId === scene.id} />
                    )}
                    {sceneShots.map((shot, i) => {
                      const displayNum = activeId ? getProjectedDisplayNumber(shot, scene.id) : getShotDisplayNumber(shot)
                      return (
                        <div key={shot.id}>
                          {!wiggleMode && <InsertRow index={i} sceneId={scene.id} />}
                          <SortableShotRow
                            shot={shot}
                            sceneColor={sceneColor}
                            displayNum={displayNum}
                            blinking={blinkIds.has(shot.id)}
                            wiggleMode={wiggleMode}
                            showThumbnail={!wiggleMode}
                            descBehavior="tap-edits-inline"
                            onTapShot={onTapShot}
                            onTapShotThumbnail={onTapThumbnail}
                            threadEntry={threadByShotId?.get(shot.id)}
                            isEditingDesc={editingDescShotId === shot.id}
                            editingDescValue={editingDescValue}
                            setEditingDescValue={setEditingDescValue}
                            setEditingDescShotId={setEditingDescShotId}
                            onUpdateShotDesc={onUpdateShotDesc}
                          />
                        </div>
                      )
                    })}
                    {!wiggleMode && <InsertRow index={sceneShots.length} sceneId={scene.id} />}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </SortableContext>
    </DndContext>
  )
}

// ── SortableShotRow ─ used in both story and shoot modes ──

type DescBehavior = 'tap-opens-detail' | 'tap-edits-inline'

const SortableShotRow = memo(function SortableShotRow({
  shot, sceneColor, displayNum, blinking, wiggleMode, showThumbnail, descBehavior,
  onTapShot, onTapShotThumbnail, threadEntry,
  isEditingDesc, editingDescValue, setEditingDescValue, setEditingDescShotId, onUpdateShotDesc,
}: {
  shot: Shot
  sceneColor: string
  displayNum: string
  blinking: boolean
  wiggleMode: boolean
  showThumbnail: boolean
  descBehavior: DescBehavior
  onTapShot: (shot: Shot) => void
  onTapShotThumbnail: (shot: Shot) => void
  threadEntry?: { count: number; unread: boolean }
  isEditingDesc?: boolean
  editingDescValue?: string
  setEditingDescValue?: (v: string) => void
  setEditingDescShotId?: (id: string | null) => void
  onUpdateShotDesc?: (shotId: string, description: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: shot.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.85 : 1,
    padding: wiggleMode ? '0 14px 10px' : '0 14px 3px',
    position: 'relative',
  }

  // Per-row scene-rgb override — shot tag picks up the scene hue via
  // .scenemaker-shot-num's --tag-rgb consumer, and the row's glass-tile
  // bg/border re-tints to the scene via --tile-rgb. One inline triplet
  // does both.
  const sr = parseInt(sceneColor.slice(1, 3), 16)
  const sg = parseInt(sceneColor.slice(3, 5), 16)
  const sb = parseInt(sceneColor.slice(5, 7), 16)
  // Listeners + attributes are always attached. TouchSensor's 250 ms delay
  // handles the tap-vs-drag disambiguation: a quick tap doesn't activate
  // drag (preventDefault is never called), so onClick still flows to the
  // inline handlers (open detail, edit description). A press-and-hold
  // activates drag — and handleDragStart on the page flips wiggleMode on
  // at the same instant, so the visual state syncs with the gesture.
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        className={`glass-tile-sm flex items-center select-none relative${wiggleMode && !isDragging ? ' wiggle' : ''}`}
        style={{
          gap: 9,
          padding: '9px 10px',
          ['--tile-rgb' as string]: `${sr}, ${sg}, ${sb}`,
          ...(isDragging
            ? { boxShadow: '0 8px 32px rgba(0,0,0,0.6)', opacity: 0.85 }
            : {}),
        } as React.CSSProperties}
        {...listeners}
        onClick={(e) => { if (wiggleMode) e.stopPropagation() }}
      >
        {wiggleMode && (
          <div className="flex flex-col items-center justify-center flex-shrink-0"
            style={{ gap: 2.5, opacity: 0.4, minHeight: 44, width: 20 }}>
            <div style={{ width: 10, height: 1.5, background: 'white', borderRadius: 1 }} />
            <div style={{ width: 10, height: 1.5, background: 'white', borderRadius: 1 }} />
            <div style={{ width: 10, height: 1.5, background: 'white', borderRadius: 1 }} />
          </div>
        )}

        <span
          className={`scenemaker-shot-num cursor-pointer${blinking ? ' number-blink' : ''}`}
          style={{ ['--tag-rgb' as string]: `${sr}, ${sg}, ${sb}` } as React.CSSProperties}
          onClick={() => !wiggleMode && onTapShot(shot)}>
          {displayNum}
        </span>

        {shot.size && (
          <span className="scenemaker-aspect-label cursor-pointer"
            onClick={() => !wiggleMode && onTapShot(shot)}>
            {SIZE_ABBREV[shot.size] ?? shot.size}
          </span>
        )}

        {descBehavior === 'tap-edits-inline' && isEditingDesc && setEditingDescValue && setEditingDescShotId && onUpdateShotDesc ? (
          <input
            autoFocus
            value={editingDescValue ?? ''}
            onChange={e => setEditingDescValue(e.target.value)}
            onBlur={() => {
              const trimmed = (editingDescValue ?? '').trim()
              if (trimmed !== (shot.description ?? '')) onUpdateShotDesc(shot.id, trimmed)
              setEditingDescShotId(null)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() }
              if (e.key === 'Escape') setEditingDescShotId(null)
            }}
            className="flex-1 min-w-0 outline-none"
            style={{ fontSize: '0.58rem', fontWeight: 500, color: '#dddde8', lineHeight: 1.35, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '2px 6px' }}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="font-mono flex-1 min-w-0 cursor-text scenemaker-shot-desc"
            style={{ fontSize: '0.58rem', fontWeight: 500, color: 'var(--fg)', lineHeight: 1.35 }}
            onClick={(e) => {
              if (wiggleMode) return
              if (descBehavior === 'tap-edits-inline' && setEditingDescValue && setEditingDescShotId) {
                e.stopPropagation()
                setEditingDescValue(shot.description ?? '')
                setEditingDescShotId(shot.id)
              } else {
                onTapShot(shot)
              }
            }}>
            {shot.description || '—'}
          </span>
        )}

        {showThumbnail && (
          <div className="flex-shrink-0 overflow-hidden cursor-pointer"
            style={{ width: 72, height: 44, borderRadius: 6, marginLeft: 'auto' }}
            onClick={() => onTapShotThumbnail(shot)}>
            {shot.imageUrl ? (
              <StorageImage url={shot.imageUrl} alt={displayNum} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${sceneColor}18, ${sceneColor}08)` }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="2" y="3" width="10" height="8" rx="1.5" stroke={sceneColor} strokeWidth="1" opacity="0.35" />
                  <path d="M7 5.5v3M5.5 7h3" stroke={sceneColor} strokeWidth="1" strokeLinecap="round" opacity="0.35" />
                </svg>
              </div>
            )}
          </div>
        )}

        <ThreadRowBadge entry={threadEntry} />
      </div>
    </div>
  )
})

// ── SceneHeaderDroppable ─ scene header that doubles as a drop target ──

function SceneHeaderDroppable({
  scene, sceneColor, highlighted, isEditing, editingTitle, setEditingTitle, setEditingSceneId,
  onRenameScene, toggleScene, wiggleMode, isOpen, accent, shotCount, onConfirmDelete,
}: {
  scene: Scene
  sceneColor: string
  highlighted: boolean
  isEditing: boolean
  editingTitle: string
  setEditingTitle: (t: string) => void
  setEditingSceneId: (id: string | null) => void
  onRenameScene: (sceneId: string, title: string) => void
  toggleScene: (sceneId: string) => void
  wiggleMode: boolean
  isOpen: boolean
  accent: string
  shotCount: number
  onConfirmDelete: () => void
}) {
  const { setNodeRef } = useDroppable({ id: `${SCENE_HEADER_DROPPABLE}${scene.id}` })

  return (
    <div ref={setNodeRef} className="flex items-center select-none"
      style={{
        gap: 8, padding: '11px 14px 7px',
        ...(highlighted ? { background: `${sceneColor}12`, borderRadius: 6, margin: '0 4px' } : {}),
        transition: 'background 0.15s, margin 0.15s',
      }}>
      <span
        className="scenemaker-scene-num cursor-pointer"
        style={(() => {
          const r = parseInt(sceneColor.slice(1, 3), 16)
          const g = parseInt(sceneColor.slice(3, 5), 16)
          const b = parseInt(sceneColor.slice(5, 7), 16)
          return { ['--tag-rgb' as string]: `${r}, ${g}, ${b}` } as React.CSSProperties
        })()}
        onClick={() => !wiggleMode && toggleScene(scene.id)}>
        {scene.sceneNumber.padStart(2, '0')}
      </span>
      {isEditing ? (
        <input
          autoFocus
          value={editingTitle}
          onChange={e => setEditingTitle(e.target.value)}
          onBlur={() => {
            const trimmed = editingTitle.trim()
            if (trimmed !== (scene.title ?? '')) onRenameScene(scene.id, trimmed)
            setEditingSceneId(null)
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() }
            if (e.key === 'Escape') setEditingSceneId(null)
          }}
          className="flex-1 min-w-0 outline-none"
          style={{ fontFamily: "'Geist', sans-serif", fontSize: '0.52rem', fontWeight: 700, letterSpacing: '0.02em', color: accent, background: 'rgba(255,255,255,0.06)', border: `1px solid ${accent}40`, borderRadius: 4, padding: '2px 6px' }}
        />
      ) : (
        // Scene title — sheen-title applied per-scene by overriding
        // --accent-rgb inline with this scene's color so the gradient
        // re-tints to the scene hue (otherwise inherits project accent
        // from the .screen root).
        <span className="sheen-title flex-1 truncate cursor-pointer"
          style={(() => {
            const r = parseInt(sceneColor.slice(1, 3), 16)
            const g = parseInt(sceneColor.slice(3, 5), 16)
            const b = parseInt(sceneColor.slice(5, 7), 16)
            return {
              fontFamily: "'Geist', sans-serif", fontSize: '0.52rem', fontWeight: 700, letterSpacing: '0.02em',
              ['--accent-rgb' as string]: `${r}, ${g}, ${b}`,
              ['--accent-glow-rgb' as string]: `${Math.min(255, r + 20)}, ${Math.min(255, g + 30)}, ${Math.min(255, b + 16)}`,
            } as React.CSSProperties
          })()}
          onClick={() => { if (!wiggleMode) toggleScene(scene.id) }}
          onDoubleClick={() => {
            setEditingTitle(scene.title ?? '')
            setEditingSceneId(scene.id)
          }}>
          {scene.title || 'Untitled'}
        </span>
      )}
      <span className="font-mono flex-shrink-0" style={{ fontSize: '0.38rem', color: '#62627a', opacity: 0.55 }}>
        {shotCount}
      </span>
      {wiggleMode && (
        <button className="flex-shrink-0 cursor-pointer flex items-center justify-center"
          style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(232,86,74,0.1)', border: '1px solid rgba(232,86,74,0.25)' }}
          onClick={(e) => { e.stopPropagation(); onConfirmDelete() }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2l-6 6" stroke="#e8564a" strokeWidth="1.3" strokeLinecap="round" /></svg>
        </button>
      )}
      {!wiggleMode && !isEditing && (
        <svg width="5" height="9" viewBox="0 0 5 9" fill="none" className="flex-shrink-0 cursor-pointer"
          style={{ opacity: 0.5, transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
          onClick={() => toggleScene(scene.id)}>
          <path d="M1 1L4 4.5L1 8" stroke={sceneColor} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}

// ── EmptySceneDropZone ─ visual cue for an empty scene during wiggle drag ──

function EmptySceneDropZone({ sceneColor, highlighted }: { sceneColor: string; highlighted: boolean }) {
  // Drop is captured by the SceneHeaderDroppable above; this is a pure
  // visual hint so an empty scene reads as a valid target.
  return (
    <div style={{
      margin: '0 14px 8px', padding: '16px 0',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 8,
      border: highlighted ? `1.5px dashed ${sceneColor}60` : '1.5px dashed rgba(255,255,255,0.08)',
      background: highlighted ? `${sceneColor}08` : 'transparent',
      transition: 'all 0.15s',
    }}>
      <span className="font-mono uppercase" style={{ fontSize: '0.36rem', color: '#62627a', letterSpacing: '0.06em' }}>
        Drop shot here
      </span>
    </div>
  )
}

// ── STORYBOARD VIEW ──────────────────────────────────────

function StoryboardView({ scenes, shots, scale, aspectRatio, onTapShot, onReorder }: {
  scenes: Scene[]; shots: Shot[]; scale: StoryboardScale; aspectRatio?: string | null; onTapShot: (s: Shot) => void
  onReorder: (shotId: string, newIndex: number) => void
}) {
  const totalScenes = scenes.length
  const sorted = [...shots].sort((a, b) => a.sortOrder - b.sortOrder)
  // 2-up split state
  const [leftShotId, setLeftShotId] = useState<string | null>(null)
  const [rightShotId, setRightShotId] = useState<string | null>(null)
  // Initialize slot defaults when shots change
  const effectiveLeftId = leftShotId && sorted.some(s => s.id === leftShotId) ? leftShotId : sorted[0]?.id ?? null
  const effectiveRightId = rightShotId && sorted.some(s => s.id === rightShotId) ? rightShotId : sorted[1]?.id ?? null

  const [dragId, setDragId] = useState<string | null>(null)
  const dragIdRef = useRef<string | null>(null)
  const [dragTargetIdx, setDragTargetIdx] = useState(-1)
  const dragTargetIdxRef = useRef(-1)
  const dragElRef = useRef<HTMLDivElement | null>(null)
  const dragOrigin = useRef({ x: 0, y: 0 })
  const dragOrigIdx = useRef(-1)
  const cardRectsRef = useRef<Map<string, DOMRect>>(new Map())

  const snapshotCardRects = useCallback(() => {
    const map = new Map<string, DOMRect>()
    sorted.forEach(s => {
      const el = document.querySelector(`[data-board-id="${s.id}"]`) as HTMLElement | null
      if (el) map.set(s.id, el.getBoundingClientRect())
    })
    cardRectsRef.current = map
  }, [sorted])

  const getBoardDragState = useCallback((shotId: string): 'idle' | 'dragging' | 'shift' => {
    if (!dragId) return 'idle'
    if (shotId === dragId) return 'dragging'
    const fromIdx = sorted.findIndex(s => s.id === dragId)
    const myIdx = sorted.findIndex(s => s.id === shotId)
    if (fromIdx < 0 || myIdx < 0) return 'idle'
    if (dragTargetIdx > fromIdx && myIdx > fromIdx && myIdx <= dragTargetIdx) return 'shift'
    if (dragTargetIdx < fromIdx && myIdx >= dragTargetIdx && myIdx < fromIdx) return 'shift'
    return 'idle'
  }, [dragId, dragTargetIdx, sorted])

  const getSceneColorForShot = useCallback((shot: Shot) => {
    const scene = scenes.find(s => s.id === shot.sceneId)
    return scene ? getSceneColor(parseInt(scene.sceneNumber), totalScenes) : '#c45adc'
  }, [scenes, totalScenes])

  if (shots.length === 0) return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: '60vh', gap: 10 }}>
      <div className="flex items-center justify-center cursor-pointer rounded-full" style={{ width: 40, height: 40, border: '1.5px dashed rgba(196,90,220,0.35)' }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1V11M1 6H11" stroke="rgba(196,90,220,0.5)" strokeWidth="1.4" strokeLinecap="round" /></svg>
      </div>
      <span style={{ fontSize: '0.8rem', color: '#62627a', letterSpacing: '0.04em' }}>No Boards Yet</span>
    </div>
  )

  // ── FEED: single column, large frames ──
  if (scale === 'feed') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 10px' }}>
      {sorted.map(shot => {
        const sc = getSceneColorForShot(shot)
        const sr = parseInt(sc.slice(1, 3), 16)
        const sg = parseInt(sc.slice(3, 5), 16)
        const sb = parseInt(sc.slice(5, 7), 16)
        return (
          <div key={shot.id} className="glass-tile-sm cursor-pointer" onClick={() => onTapShot(shot)}
            style={{ ['--tile-rgb' as string]: `${sr}, ${sg}, ${sb}` } as React.CSSProperties}>
            <div className="relative" style={{ aspectRatio: aspectRatioToCss(aspectRatio) }}>
              <div className="letterbox-top" />
              {shot.imageUrl ? (
                <StorageImage url={shot.imageUrl} alt={shot.shotNumber} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${sc}15, ${sc}08)` }} />
              )}
              <div className="absolute top-2 left-2" style={{
                fontFamily: "'Geist', sans-serif", fontSize: '0.52rem', fontWeight: 700,
                color: sc, background: 'rgba(4,4,10,0.75)', borderRadius: 6, padding: '2px 8px',
                zIndex: 6,
              }}>{shot.shotNumber}</div>
              <div className="letterbox-bottom" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} />
            </div>
            <div style={{ padding: '8px 12px' }}>
              <div style={{ fontSize: '0.66rem', fontWeight: 600, color: '#dddde8', lineHeight: 1.4, marginBottom: 4 }}>{shot.description || '—'}</div>
              {shot.notes && <div style={{ fontSize: '0.54rem', color: '#62627a', lineHeight: 1.4 }}>{shot.notes}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )

  // ── 2-UP SPLIT: two large frames, each with own filmstrip ──
  if (scale === '2up') {
    const SLOT_COLORS = ['#6470f3', '#e8a020'] as const
    const slotIds = [effectiveLeftId, effectiveRightId]
    const setSlotId = [setLeftShotId, setRightShotId]
    const slotShots = slotIds.map(id => sorted.find(s => s.id === id) ?? null)

    return (
      <div>
        {/* Two large frames */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '8px 10px' }}>
          {[0, 1].map(slot => {
            const shot = slotShots[slot]
            const slotColor = SLOT_COLORS[slot]
            const sc = shot ? getSceneColorForShot(shot) : '#62627a'
            return (
              <div key={slot}
                style={{
                  aspectRatio: aspectRatioToCss(aspectRatio), borderRadius: 10, overflow: 'hidden', position: 'relative',
                  background: shot ? `linear-gradient(135deg, ${sc}15, ${sc}08)` : 'rgba(255,255,255,0.03)',
                  border: `2px solid ${slotColor}60`,
                  boxShadow: `0 0 12px ${slotColor}15`,
                }}>
                {shot?.imageUrl && <StorageImage url={shot.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                {shot && (
                  <div className="absolute top-1.5 left-1.5" style={{
                    fontFamily: "'Geist', sans-serif", fontSize: '0.44rem', fontWeight: 700,
                    color: '#fff', background: slotColor, borderRadius: 4, padding: '1px 6px',
                  }}>{shot.shotNumber}</div>
                )}
                {!shot && <div className="w-full h-full flex items-center justify-center" style={{ fontSize: '0.5rem', color: '#62627a' }}>Empty</div>}
              </div>
            )
          })}
        </div>

        {/* Two filmstrips — one per slot */}
        {[0, 1].map(slot => {
          const slotColor = SLOT_COLORS[slot]
          const selectedId = slotIds[slot]
          return (
            <div key={slot}>
              <div className="flex items-center" style={{ padding: '6px 10px 2px', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: slotColor, opacity: 0.7 }} />
                <span className="font-mono uppercase" style={{ fontSize: '0.36rem', color: slotColor, letterSpacing: '0.06em', opacity: 0.8 }}>
                  {slot === 0 ? 'Left' : 'Right'}
                </span>
              </div>
              <div className="no-scrollbar" style={{ display: 'flex', gap: 5, padding: '4px 10px 8px', overflowX: 'auto' }}>
                {sorted.map(shot => {
                  const sc = getSceneColorForShot(shot)
                  const isSelected = shot.id === selectedId
                  return (
                    <div key={shot.id} className="flex-shrink-0 cursor-pointer" style={{
                      width: 56, borderRadius: 6, overflow: 'hidden',
                      border: isSelected ? `2px solid ${slotColor}` : '1px solid rgba(255,255,255,0.07)',
                      opacity: isSelected ? 1 : 0.6,
                      transition: 'border 0.15s, opacity 0.15s',
                    }}
                      onClick={() => { haptic('light'); setSlotId[slot](shot.id) }}>
                      <div style={{ aspectRatio: aspectRatioToCss(aspectRatio), background: `linear-gradient(135deg, ${sc}15, ${sc}08)` }}>
                        {shot.imageUrl && <StorageImage url={shot.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </div>
                      <div style={{ padding: '2px 4px', fontSize: '0.3rem', fontWeight: 700, color: isSelected ? slotColor : sc, textAlign: 'center' }}>{shot.shotNumber}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── SEE ALL: everything scaled to fit, no scroll ──
  if (scale === 'all') {
    // Calculate columns to fit all items on screen
    const count = sorted.length
    const cols = count <= 4 ? 2 : count <= 9 ? 3 : count <= 16 ? 4 : count <= 25 ? 5 : 6
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 3, padding: '6px 6px', height: '100%' }}>
        {sorted.map(shot => {
          const sc = getSceneColorForShot(shot)
          return (
            <div key={shot.id} className="cursor-pointer" onClick={() => onTapShot(shot)}
              style={{ borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)', position: 'relative' }}>
              <div style={{ aspectRatio: aspectRatioToCss(aspectRatio), background: `linear-gradient(135deg, ${sc}12, ${sc}06)` }}>
                {shot.imageUrl && <StorageImage url={shot.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div className="absolute bottom-0 left-0 right-0" style={{
                fontSize: '0.28rem', fontWeight: 700, color: sc,
                background: 'rgba(4,4,10,0.8)', padding: '1px 3px', textAlign: 'center',
              }}>{shot.shotNumber}</div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── 3-UP GRID (default) ──
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, padding: '8px 10px' }}>
      {sorted.map((shot, idx) => {
        const sceneColor = getSceneColorForShot(shot)
        const state = getBoardDragState(shot.id)

        return (
          <BoardCard key={shot.id} shot={shot} sceneColor={sceneColor} aspectRatio={aspectRatio}
            isDragging={state === 'dragging'}
            isShifted={state === 'shift'}
            onTap={() => onTapShot(shot)}
            onDragStart={(x, y, innerEl) => {
              haptic('light')
              dragIdRef.current = shot.id
              setDragId(shot.id)
              dragTargetIdxRef.current = idx
              setDragTargetIdx(idx)
              dragOrigIdx.current = idx
              dragOrigin.current = { x, y }
              dragElRef.current = innerEl
              requestAnimationFrame(snapshotCardRects)
            }}
            onDragMove={(x, y) => {
              if (dragElRef.current) {
                const dx = x - dragOrigin.current.x
                const dy = y - dragOrigin.current.y
                dragElRef.current.style.transform = `translate(${dx}px, ${dy}px) scale(1.05)`
                dragElRef.current.style.transition = 'none'
              }
              const currentDragId = dragIdRef.current
              let nearest = sorted.findIndex(s => s.id === currentDragId)
              let minDist = Infinity
              cardRectsRef.current.forEach((rect, id) => {
                if (id === currentDragId) return
                const cx = rect.left + rect.width / 2
                const cy = rect.top + rect.height / 2
                const dist = Math.hypot(x - cx, y - cy)
                if (dist < minDist) {
                  minDist = dist
                  nearest = sorted.findIndex(s => s.id === id)
                }
              })
              dragTargetIdxRef.current = nearest
              setDragTargetIdx(nearest)
            }}
            onDragEnd={() => {
              if (dragElRef.current) {
                dragElRef.current.style.transform = ''
                dragElRef.current.style.transition = ''
              }
              const id = dragIdRef.current
              const targetIdx = dragTargetIdxRef.current
              if (id && targetIdx >= 0 && targetIdx !== dragOrigIdx.current) {
                onReorder(id, targetIdx)
              }
              dragIdRef.current = null
              setDragId(null)
              dragTargetIdxRef.current = -1
              setDragTargetIdx(-1)
              dragOrigIdx.current = -1
              dragElRef.current = null
            }} />
        )
      })}
    </div>
  )
}

function BoardCard({ shot, sceneColor, aspectRatio, isDragging, isShifted, onTap, onDragStart, onDragMove, onDragEnd }: {
  shot: Shot; sceneColor: string; aspectRatio?: string | null; isDragging: boolean; isShifted: boolean
  onTap: () => void; onDragStart: (x: number, y: number, el: HTMLDivElement | null) => void; onDragMove: (x: number, y: number) => void; onDragEnd: () => void
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const movedRef = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })
  const dragActive = useRef(false)
  const cardInnerRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    movedRef.current = false
    dragActive.current = false
    startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    timerRef.current = setTimeout(() => {
      if (!movedRef.current) {
        dragActive.current = true
        onDragStart(e.touches[0].clientX, e.touches[0].clientY, cardInnerRef.current)
        const onMove = (ev: TouchEvent) => {
          ev.preventDefault()
          onDragMove(ev.touches[0].clientX, ev.touches[0].clientY)
        }
        const onEnd = () => {
          dragActive.current = false
          onDragEnd()
          window.removeEventListener('touchmove', onMove)
          window.removeEventListener('touchend', onEnd)
          window.removeEventListener('touchcancel', onEnd)
        }
        window.addEventListener('touchmove', onMove, { passive: false })
        window.addEventListener('touchend', onEnd)
        window.addEventListener('touchcancel', onEnd)
      }
    }, 500)
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragActive.current) return
    const dx = Math.abs(e.touches[0].clientX - startPos.current.x)
    const dy = Math.abs(e.touches[0].clientY - startPos.current.y)
    if (dx > 8 || dy > 8) {
      movedRef.current = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }
  const handleTouchEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!dragActive.current && !movedRef.current) {
      onTap()
    }
  }

  // Per-frame scene-rgb override — drives the glass-tile tint per scene
  // so neighbouring frames in the storyboard read as their own scene.
  const sr = parseInt(sceneColor.slice(1, 3), 16)
  const sg = parseInt(sceneColor.slice(3, 5), 16)
  const sb = parseInt(sceneColor.slice(5, 7), 16)
  return (
    <div data-board-id={shot.id} style={{
      position: 'relative',
      zIndex: isDragging ? 50 : 0,
    }}
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd} onTouchCancel={() => { if (timerRef.current) clearTimeout(timerRef.current) }}>
      <div ref={cardInnerRef} className="glass-tile-sm cursor-pointer select-none"
        style={{
          // glass-tile-sm provides bg/blur/border/glow at radius:10. Override
          // tile-rgb per scene so each frame carries its scene hue while
          // staying inside the cinema-glass formula.
          ['--tile-rgb' as string]: `${sr}, ${sg}, ${sb}`,
          ...(isDragging ? {
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            opacity: 0.85,
          } : {
            transition: 'transform 0.25s ease, opacity 0.2s ease',
            opacity: isShifted ? 0.6 : 1,
            transform: isShifted ? 'scale(0.95)' : 'scale(1)',
          }),
        } as React.CSSProperties}>
        {/* shot image area — letterbox bars wrap the frame for the
            cinema frame-within-frame identity. */}
        <div className="relative" style={{ aspectRatio: aspectRatioToCss(aspectRatio) }}>
          <div className="letterbox-top" />
          <div className="w-full h-full absolute inset-0" style={{ background: `linear-gradient(135deg, ${sceneColor}15, ${sceneColor}08)` }} />
          {shot.imageUrl && (
            <StorageImage url={shot.imageUrl} alt={shot.shotNumber} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
          {/* Shot tag (top-left) + aspect label (top-right) — both sit
              above the letterbox z-index so they remain readable on the
              letterboxed image. The shot tag uses the dept-color outline
              rect; aspect is mono-caps in dept color. */}
          <span
            className="scenemaker-shot-num absolute"
            style={{
              top: 4, left: 4, zIndex: 6,
              backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
              ['--tag-rgb' as string]: `${sr}, ${sg}, ${sb}`,
            } as React.CSSProperties}>
            {shot.shotNumber}
          </span>
          {shot.size && (
            <span
              className="scenemaker-aspect-label absolute font-mono"
              style={{
                top: 6, right: 6, zIndex: 6,
                color: sceneColor,
                background: 'rgba(4,4,10,0.55)', borderRadius: 4, padding: '1px 5px',
                backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
              }}>
              {SIZE_ABBREV[shot.size] ?? shot.size}
            </span>
          )}
          <div className="letterbox-bottom" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} />
        </div>
        {/* Description — Geist Mono, --fg, 2-line truncate per
            DESIGN_LANGUAGE.md storyboard panel pattern. Explicit
            content-box height = lineHeight × 2 keeps the third-line
            top half from bleeding through into the gap below. */}
        <div className="font-mono scenemaker-board-desc">
          {shot.description}
        </div>
      </div>
    </div>
  )
}

// ── TIME AGO HELPER ──────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const d = new Date(dateStr).getTime()
  const diff = now - d
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── VERSION HISTORY PANEL ────────────────────────────────

function VersionHistoryPanel({ versions, accent, activeVersionId, onSelectVersion, onUpdateLabel, onClose }: {
  versions: any[]
  accent: string
  activeVersionId: string | null
  onSelectVersion: (v: { versionNumber: number; label?: string | null; shots: any; createdAt: string }) => void
  onUpdateLabel: (id: string, label: string | null) => void
  onClose: () => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')

  return (
    <m.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      style={{
        position: 'absolute', top: 0, right: 0, bottom: 0,
        width: 240, background: '#08081a',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column',
        zIndex: 10,
      }}>
      {/* Header */}
      <div className="flex items-center flex-shrink-0" style={{ height: 44, padding: '0 12px', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="font-mono uppercase flex-1" style={{ fontSize: '0.44rem', letterSpacing: '0.08em', color: '#a0a0b8' }}>Version History</span>
        <button className="flex items-center justify-center cursor-pointer" style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }}
          onClick={onClose}>
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 1l6 6M7 1l-6 6" stroke="#62627a" strokeWidth="1.2" strokeLinecap="round" /></svg>
        </button>
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto no-scrollbar" style={{ padding: '6px 0' }}>
        {versions.length === 0 && (
          <div className="flex flex-col items-center justify-center" style={{ padding: '40px 16px', gap: 8 }}>
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none"><path d="M8 3v5l3 1.5" stroke="#62627a" strokeWidth="1.1" strokeLinecap="round" /><circle cx="8" cy="8" r="6" stroke="#62627a" strokeWidth="1" /></svg>
            <span className="font-mono" style={{ fontSize: '0.46rem', color: '#62627a', textAlign: 'center', lineHeight: 1.4 }}>No saved versions yet.<br />Tap + to save one.</span>
          </div>
        )}
        {versions.map((v: any) => {
          const isActive = activeVersionId === String(v.versionNumber)
          return (
            <div key={v.id}
              className="cursor-pointer select-none"
              style={{
                padding: '10px 12px', margin: '0 6px 2px', borderRadius: 8,
                background: isActive ? `${accent}14` : 'transparent',
                border: isActive ? `1px solid ${accent}30` : '1px solid transparent',
                transition: 'background 0.15s, border 0.15s',
              }}
              onClick={() => onSelectVersion({ versionNumber: v.versionNumber, label: v.label, shots: v.shots, createdAt: v.createdAt })}>
              <div className="flex items-center" style={{ gap: 8 }}>
                <span className="font-mono flex-shrink-0" style={{ fontSize: '0.56rem', fontWeight: 700, color: isActive ? accent : '#dddde8' }}>
                  v{v.versionNumber}
                </span>
                {editingId === v.id ? (
                  <input
                    autoFocus
                    value={editingLabel}
                    onChange={e => setEditingLabel(e.target.value)}
                    onBlur={() => {
                      const trimmed = editingLabel.trim()
                      onUpdateLabel(v.id, trimmed || null)
                      setEditingId(null)
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    className="flex-1 min-w-0 outline-none"
                    style={{ fontSize: '0.48rem', color: '#dddde8', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '2px 6px' }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span className="flex-1 min-w-0 truncate cursor-text" style={{ fontSize: '0.48rem', color: v.label ? '#a0a0b8' : '#62627a', fontStyle: v.label ? 'normal' : 'italic' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingLabel(v.label ?? '')
                      setEditingId(v.id)
                    }}>
                    {v.label || 'Add label...'}
                  </span>
                )}
              </div>
              <span className="font-mono" style={{ fontSize: '0.38rem', color: '#62627a', marginTop: 3, display: 'block' }}>
                {timeAgo(v.createdAt)}
              </span>
            </div>
          )
        })}
      </div>
    </m.div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────

export default function SceneMakerPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const router = useRouter()
  const { data: project } = useProject(projectId)
  const colors = deriveProjectColors(project?.color || getProjectColor(projectId) || DEFAULT_PROJECT_HEX)
  const accent = colors.primary

  const searchParams = useSearchParams()
  const initialMode = (searchParams.get('mode') as SceneMakerMode) || 'shotlist'
  const [mode, setMode] = useState<SceneMakerMode>(initialMode)
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null)
  const { data: threadsData } = useThreadPreviews(projectId)
  const threadByShotId = useMemo(() => {
    const map = new Map<string, { count: number; unread: boolean }>()
    for (const t of (threadsData ?? [])) {
      if (t.attachedToType !== 'shot') continue
      map.set(t.attachedToId, { count: t.messages?.length ?? 0, unread: !!t.unread })
    }
    return map
  }, [threadsData])
  const [newShotAt, setNewShotAt] = useState<{ index: number; sceneId: string } | null>(null)
  const [boardScale, setBoardScale] = useState<StoryboardScale>('3up')
  const [scriptPanel, setScriptPanel] = useState<ScriptPanel>(null)
  const [shotOrder, setShotOrder] = useState<'story' | 'shooting'>('story')
  const [showExport, setShowExport] = useState(false)
  const [showVersionPanel, setShowVersionPanel] = useState(false)
  const [previewVersion, setPreviewVersion] = useState<{ versionNumber: number; label?: string | null; shots: any; createdAt: string } | null>(null)
  // Single toast surface — error toasts on persist failure, confirm toasts
  // on cross-scene drag (PR adds this in step 4). New toast replaces any
  // existing one; no queue.
  const [toast, setToast] = useState<ToastSpec | null>(null)
  const scriptRef = useRef<ScriptViewHandle>(null)
  // Storyboard upload-or-generate sheet — opens when an empty thumbnail
  // is tapped. The sheet itself owns the file picker + Bria call.
  const [imageMenuShotId, setImageMenuShotId] = useState<string | null>(null)
  // Loading state for the New Shot sheet's save → optional image attach flow.
  // Lives here (not inside NewShotSheet) so the sheet stays open and disabled
  // during the async work.
  const [newShotPending, setNewShotPending] = useState(false)

  const qc = useQueryClient()
  const { data: shotlistVersions } = useShotlistVersions(projectId)
  const createVersion = useCreateShotlistVersion(projectId)
  const updateVersionLabel = useUpdateShotlistVersionLabel(projectId)
  // getShotsByProject returns Scene rows (sorted by sortOrder asc) with
  // Shot(*) attached — same shape and sort as useScenes would have given.
  // Derive allScenes from this single fetch instead of round-tripping twice.
  const { data: scenesWithShots, isLoading: loadingShots } = useQuery({
    queryKey: ['shotsByProject', projectId],
    queryFn: () => getShotsByProject(projectId),
    enabled: !!projectId,
  })

  const allScenes: Scene[] = useMemo(() => {
    if (!scenesWithShots) return []
    return scenesWithShots.map((s: any) => {
      const { Shot: _shot, ...sceneFields } = s
      return sceneFields as Scene
    })
  }, [scenesWithShots])
  const allShots: Shot[] = useMemo(() => {
    if (!scenesWithShots) return []
    return scenesWithShots.flatMap((s: any) => s.Shot ?? [])
  }, [scenesWithShots])

  const loading = loadingShots

  // ── SCENE UPDATE HANDLER (script mode) ──────────────────
  const handleUpdateScene = useCallback((sceneId: string, fields: { title?: string; description?: string }) => {
    updateScene(sceneId, fields).then(() => {
      qc.invalidateQueries({ queryKey: ['scenes', projectId] })
      qc.invalidateQueries({ queryKey: ['shotsByProject', projectId] })
    })
  }, [projectId, qc])

  // ── DELETE SCENE HANDLER ────────────────────────────────
  const handleDeleteScene = useCallback((sceneId: string) => {
    deleteScene(sceneId)
      .then(() => {
        qc.invalidateQueries({ queryKey: ['scenes', projectId] })
        qc.invalidateQueries({ queryKey: ['shotsByProject', projectId] })
      })
      .catch(err => console.error('[SceneMaker] deleteScene FAILED:', err))
  }, [projectId, qc])

  // ── ADD SCENE HANDLER (creates DB record at cursor position) ──
  const handleAddScene = useCallback(() => {
    const focusedIdx = scriptRef.current?.getFocusedSceneIndex() ?? allScenes.length - 1
    // For empty projects (no scenes), use createScene with sortOrder 0
    if (allScenes.length === 0) {
      createScene(projectId, { sceneNumber: '1', sortOrder: 0 })
        .then(() => {
          qc.invalidateQueries({ queryKey: ['scenes', projectId] })
          qc.invalidateQueries({ queryKey: ['shotsByProject', projectId] })
        })
        .catch(err => console.error('[SceneMaker] createScene FAILED:', err))
      return
    }
    // Insert after the focused scene
    const afterSortOrder = allScenes[focusedIdx]?.sortOrder ?? allScenes[allScenes.length - 1].sortOrder
    createSceneAtPosition(projectId, afterSortOrder, {})
      .then(() => {
        qc.invalidateQueries({ queryKey: ['scenes', projectId] })
        qc.invalidateQueries({ queryKey: ['shotsByProject', projectId] })
      })
      .catch(err => console.error('[SceneMaker] createSceneAtPosition FAILED:', err))
  }, [projectId, allScenes, qc])

  // ── REORDER HANDLER ──────────────────────────────────────

  const handleReorder = useCallback((shotId: string, newIndex: number) => {
    const sorted = [...allShots].sort((a, b) => a.sortOrder - b.sortOrder)
    const without = sorted.filter(s => s.id !== shotId)
    const moved = sorted.find(s => s.id === shotId)
    if (!moved) return
    const clamped = Math.max(0, Math.min(newIndex, without.length))
    without.splice(clamped, 0, moved)

    // Derive sceneId from neighbor
    const neighborId = without[clamped === 0 ? 1 : clamped - 1]?.id
    const neighbor = allShots.find(s => s.id === neighborId)
    const targetSceneId = neighbor?.sceneId ?? moved.sceneId

    const updates = without.map((s, i) => ({
      id: s.id,
      order: i,
      sceneId: s.id === shotId ? targetSceneId : s.sceneId,
    }))

    // Snapshot the cache before mutating so a persist failure or an Undo
    // tap can roll back to it.
    const previousData = qc.getQueryData(['shotsByProject', projectId])

    // Optimistic local update — applied immediately even when we defer the
    // persist behind a confirmation toast, so the visual change is instant.
    qc.setQueryData(['shotsByProject', projectId], (old: any[] | undefined) => {
      if (!old) return old
      return old.map((scene: any) => ({
        ...scene,
        Shot: (scene.Shot ?? []).map((s: Shot) => {
          const u = updates.find(u => u.id === s.id)
          if (!u) return s
          return { ...s, sortOrder: u.order, sceneId: u.sceneId }
        }),
      }))
    })

    const persist = () => Promise.all(updates.map(u =>
      updateShotOrder(u.id, { sortOrder: u.order, ...(u.id === shotId && u.sceneId !== moved.sceneId ? { sceneId: u.sceneId } : {}) })
    )).catch(err => {
      console.error('Failed to persist reorder:', err)
      qc.setQueryData(['shotsByProject', projectId], previousData)
      setToast({
        kind: 'error',
        message: "Couldn't save reorder — try again.",
        autoMs: 4000,
        onDismiss: () => setToast(null),
      })
    })

    const isCrossScene = targetSceneId !== moved.sceneId
    if (isCrossScene) {
      // Defer the DB write behind a confirmation toast. The optimistic UI
      // change is already applied; Undo rolls it back, Move (or auto-commit
      // after 4s) fires the persist.
      const targetScene = allScenes.find(s => s.id === targetSceneId)
      const sceneLabel = targetScene ? `Scene ${targetScene.sceneNumber}` : 'this scene'
      setToast({
        kind: 'confirm',
        message: `Move shot ${moved.shotNumber} to ${sceneLabel}?`,
        actions: [
          {
            label: 'Undo',
            variant: 'ghost',
            onPress: () => {
              qc.setQueryData(['shotsByProject', projectId], previousData)
              setToast(null)
            },
          },
          {
            label: 'Move',
            variant: 'accent',
            onPress: () => {
              persist()
              setToast(null)
            },
          },
        ],
        autoMs: 4000,
        onAutoTimeout: () => persist(),
        onDismiss: () => setToast(null),
      })
      return
    }

    // Same-scene reorder — persist immediately, no confirmation
    persist()
  }, [allShots, allScenes, projectId, qc])

  // ── REORDER TO SCENE HANDLER (drop onto scene header) ──
  const handleReorderToScene = useCallback((shotId: string, targetSceneId: string) => {
    const sorted = [...allShots].sort((a, b) => a.sortOrder - b.sortOrder)
    const moved = sorted.find(s => s.id === shotId)
    if (!moved) return
    // Find first shot in target scene to place before it, or use scene boundary
    const sceneShotsSorted = sorted.filter(s => s.sceneId === targetSceneId)
    const without = sorted.filter(s => s.id !== shotId)
    // Insert at position of first shot in the target scene (top of scene)
    let insertAt: number
    if (sceneShotsSorted.length > 0) {
      insertAt = without.findIndex(s => s.id === sceneShotsSorted[0].id)
      if (insertAt < 0) insertAt = without.length
    } else {
      // Empty scene — insert after all shots belonging to scenes before this one
      const sceneIdx = allScenes.findIndex(s => s.id === targetSceneId)
      const precedingSceneIds = new Set(allScenes.slice(0, sceneIdx + 1).map(s => s.id))
      insertAt = without.filter(s => precedingSceneIds.has(s.sceneId)).length
    }
    without.splice(insertAt, 0, moved)

    const updates = without.map((s, i) => ({
      id: s.id,
      order: i,
      sceneId: s.id === shotId ? targetSceneId : s.sceneId,
    }))

    const previousData = qc.getQueryData(['shotsByProject', projectId])

    // Optimistic local update
    qc.setQueryData(['shotsByProject', projectId], (old: any[] | undefined) => {
      if (!old) return old
      return old.map((scene: any) => ({
        ...scene,
        Shot: (scene.Shot ?? []).map((s: Shot) => {
          const u = updates.find(u => u.id === s.id)
          if (!u) return s
          return { ...s, sortOrder: u.order, sceneId: u.sceneId }
        }),
      }))
    })

    const persist = () => Promise.all(updates.map(u =>
      updateShotOrder(u.id, { sortOrder: u.order, ...(u.id === shotId ? { sceneId: targetSceneId } : {}) })
    )).catch(err => {
      console.error('Failed to persist reorder to scene:', err)
      qc.setQueryData(['shotsByProject', projectId], previousData)
      setToast({
        kind: 'error',
        message: "Couldn't save reorder — try again.",
        autoMs: 4000,
        onDismiss: () => setToast(null),
      })
    })

    const isCrossScene = targetSceneId !== moved.sceneId
    if (isCrossScene) {
      // Same Move/Undo flow as handleReorder — see notes there.
      const targetScene = allScenes.find(s => s.id === targetSceneId)
      const sceneLabel = targetScene ? `Scene ${targetScene.sceneNumber}` : 'this scene'
      setToast({
        kind: 'confirm',
        message: `Move shot ${moved.shotNumber} to ${sceneLabel}?`,
        actions: [
          {
            label: 'Undo',
            variant: 'ghost',
            onPress: () => {
              qc.setQueryData(['shotsByProject', projectId], previousData)
              setToast(null)
            },
          },
          {
            label: 'Move',
            variant: 'accent',
            onPress: () => {
              persist()
              setToast(null)
            },
          },
        ],
        autoMs: 4000,
        onAutoTimeout: () => persist(),
        onDismiss: () => setToast(null),
      })
      return
    }

    // Drop on the shot's own scene header — move to top of current scene,
    // no confirmation needed.
    persist()
  }, [allShots, allScenes, projectId, qc])

  // ── SHOOT ORDER REORDER HANDLER ────────────────────────────
  const handleShootReorder = useCallback((shotId: string, newIndex: number) => {
    // Build ordered list: scheduled first (by shootOrder), then unscheduled
    const scheduled = allShots.filter(s => s.shootOrder != null).sort((a, b) => a.shootOrder! - b.shootOrder!)
    const unscheduled = allShots.filter(s => s.shootOrder == null).sort((a, b) => a.shotNumber.localeCompare(b.shotNumber, undefined, { numeric: true }))
    const allOrdered = [...scheduled, ...unscheduled]

    const without = allOrdered.filter(s => s.id !== shotId)
    const moved = allOrdered.find(s => s.id === shotId)
    if (!moved) return
    const clamped = Math.max(0, Math.min(newIndex, without.length))
    without.splice(clamped, 0, moved)

    // Assign shootOrder to all shots in their new positions
    const updates = without.map((s, i) => ({ id: s.id, shootOrder: i }))

    const previousData = qc.getQueryData(['shotsByProject', projectId])

    // Optimistic local update
    qc.setQueryData(['shotsByProject', projectId], (old: any[] | undefined) => {
      if (!old) return old
      return old.map((scene: any) => ({
        ...scene,
        Shot: (scene.Shot ?? []).map((s: Shot) => {
          const u = updates.find(u => u.id === s.id)
          if (!u) return s
          return { ...s, shootOrder: u.shootOrder }
        }),
      }))
    })

    // Persist — only updates shootOrder, never touches sortOrder or sceneId.
    // On failure restore the snapshot and surface a toast.
    updateShootOrder(updates).catch(err => {
      console.error('Failed to persist shoot reorder:', err)
      qc.setQueryData(['shotsByProject', projectId], previousData)
      setToast({
        kind: 'error',
        message: "Couldn't save reorder — try again.",
        autoMs: 4000,
        onDismiss: () => setToast(null),
      })
    })
  }, [allShots, projectId, qc])

  // ── AUTO-INITIALIZE SHOOT ORDER ──────────────────────────
  // When switching to shoot mode for the first time, if all shots
  // have null shootOrder, populate from story order (sortOrder)
  const shootOrderInitialized = useRef(false)
  const prevShotOrder = useRef(shotOrder)

  if (shotOrder === 'shooting' && prevShotOrder.current !== 'shooting') {
    shootOrderInitialized.current = false
  }
  prevShotOrder.current = shotOrder

  if (
    shotOrder === 'shooting' &&
    !shootOrderInitialized.current &&
    allShots.length > 0 &&
    allShots.every(s => s.shootOrder == null)
  ) {
    shootOrderInitialized.current = true
    const sorted = [...allShots].sort((a, b) => a.sortOrder - b.sortOrder)
    const updates = sorted.map((s, i) => ({ id: s.id, shootOrder: i }))

    // Optimistic local update
    qc.setQueryData(['shotsByProject', projectId], (old: any[] | undefined) => {
      if (!old) return old
      return old.map((scene: any) => ({
        ...scene,
        Shot: (scene.Shot ?? []).map((s: Shot) => {
          const u = updates.find(u => u.id === s.id)
          if (!u) return s
          return { ...s, shootOrder: u.shootOrder }
        }),
      }))
    })

    // Persist
    updateShootOrder(updates).catch(err => console.error('Failed to initialize shoot order:', err))
  }

  /** Auto-generate next shot number for a scene (e.g. if scene 2 has 2A-2C, returns "2D") */
  const nextShotNumber = useCallback((sceneId: string) => {
    const scene = allScenes.find(s => s.id === sceneId)
    const prefix = scene?.sceneNumber ?? '1'
    const sceneShots = allShots.filter(s => s.sceneId === sceneId)
    const letters = sceneShots.map(s => { const m = s.shotNumber.match(/[A-Z]$/); return m ? m[0] : '' }).filter(Boolean)
    const nextLetter = letters.length > 0 ? String.fromCharCode(Math.max(...letters.map((l: string) => l.charCodeAt(0))) + 1) : 'A'
    return `${prefix}${nextLetter}`
  }, [allScenes, allShots])

  // ── IMAGE UPLOAD HANDLER ───────────────────────────────────

  const handleUploadImage = useCallback(async (shotId: string, file: File) => {
    try {
      const url = await uploadStoryboardImage(file, projectId, shotId)
      await updateShot(shotId, { imageUrl: url })
      qc.invalidateQueries({ queryKey: ['shotsByProject', projectId] })
      // Update selectedShot in-place so the detail sheet shows the new image
      setSelectedShot(prev => prev?.id === shotId ? { ...prev, imageUrl: url } : prev)
    } catch (err) {
      console.error('Failed to upload storyboard image:', err)
    }
  }, [projectId, qc])

  const handleThumbnailTap = useCallback((shot: Shot) => {
    if (shot.imageUrl) {
      setSelectedShot(shot)
    } else {
      setImageMenuShotId(shot.id)
    }
  }, [])

  const handleImageGenerated = useCallback((shotId: string, url: string) => {
    qc.invalidateQueries({ queryKey: ['shotsByProject', projectId] })
    setSelectedShot(prev => prev?.id === shotId ? { ...prev, imageUrl: url } : prev)
  }, [projectId, qc])

  // ── SAVE SHOTLIST VERSION ──────────────────────────────────
  const handleSaveVersion = useCallback(() => {
    const nextVersion = (shotlistVersions?.[0]?.versionNumber ?? 0) + 1
    const snapshot = allScenes.map(scene => ({
      sceneId: scene.id,
      sceneNumber: scene.sceneNumber,
      title: scene.title,
      shots: allShots
        .filter(s => s.sceneId === scene.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(s => ({
          id: s.id,
          sceneId: s.sceneId,
          shotNumber: s.shotNumber,
          size: s.size,
          description: s.description,
          notes: (s as any).notes ?? null,
          imageUrl: s.imageUrl,
          status: s.status,
          sortOrder: s.sortOrder,
        })),
    }))
    createVersion.mutate({ versionNumber: nextVersion, shots: snapshot })
    haptic('medium')
  }, [shotlistVersions, allScenes, allShots, createVersion])

  // ── PREVIEW VERSION DATA ──────────────────────────────────
  const previewScenes: Scene[] = useMemo(() => {
    if (!previewVersion) return []
    return (previewVersion.shots as any[]).map((s: any) => ({
      id: s.sceneId,
      projectId,
      sceneNumber: s.sceneNumber,
      title: s.title ?? null,
      description: null,
      sortOrder: 0,
      createdAt: '',
      updatedAt: '',
    }))
  }, [previewVersion, projectId])

  const previewShots: Shot[] = useMemo(() => {
    if (!previewVersion) return []
    return (previewVersion.shots as any[]).flatMap((s: any) =>
      (s.shots ?? []).map((sh: any) => ({
        id: sh.id,
        sceneId: sh.sceneId,
        shotNumber: sh.shotNumber,
        size: sh.size ?? null,
        description: sh.description ?? null,
        imageUrl: sh.imageUrl ?? null,
        status: sh.status ?? 'planned',
        sortOrder: sh.sortOrder ?? 0,
        createdAt: '',
        updatedAt: '',
      }))
    )
  }, [previewVersion])

  const displayScenes = previewVersion ? previewScenes : allScenes
  const displayShots = previewVersion ? previewShots : allShots

  // Contextual branch options per mode
  type BranchDef = { label: string; color: string; icon: React.ReactNode; action: () => void }
  const branches: BranchDef[] = useMemo(() => {
    if (mode === 'script') {
      return [
        { label: 'Add Scene', color: '#e8a020', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 5h12M2 8h8M2 11h5" stroke="#e8a020" strokeWidth="1.3" strokeLinecap="round" /><path d="M13 10v4M11 12h4" stroke="#e8a020" strokeWidth="1.3" strokeLinecap="round" /></svg>, action: () => { handleAddScene() } },
        { label: 'Add Action', color: '#6470f3', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 5h12M2 8h12M2 11h8" stroke="#6470f3" strokeWidth="1.3" strokeLinecap="round" /></svg>, action: () => { scriptRef.current?.addAction() } },
        { label: 'Add Dialogue', color: accent, icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4h8M5 7h6M4 10h8" stroke={accent} strokeWidth="1.3" strokeLinecap="round" /></svg>, action: () => { scriptRef.current?.addDialogue() } },
      ]
    }
    if (mode === 'shotlist') {
      return [
        { label: 'New Scene', color: '#e8a020', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 5h12M2 8h8M2 11h5" stroke="#e8a020" strokeWidth="1.3" strokeLinecap="round" /><path d="M13 10v4M11 12h4" stroke="#e8a020" strokeWidth="1.3" strokeLinecap="round" /></svg>, action: () => { handleAddScene() } },
        { label: 'New Shot', color: accent, icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="8" height="6" rx="1" stroke={accent} strokeWidth="1.3" /><path d="M10 7L14 9L10 11V7Z" fill={accent} opacity="0.8" /></svg>, action: () => {
          const firstScene = allScenes[0]
          if (firstScene) {
            const sceneShots = allShots.filter(s => s.sceneId === firstScene.id)
            setNewShotAt({ index: sceneShots.length, sceneId: firstScene.id })
          }
        }},
      ]
    }
    // storyboard
    return [
      { label: 'Add Board', color: '#e8a020', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1.2" stroke="#e8a020" strokeWidth="1.3" /><path d="M8 6v4M6 8h4" stroke="#e8a020" strokeWidth="1.3" strokeLinecap="round" /></svg>, action: () => {
        const firstScene = allScenes[0]
        if (firstScene) {
          const sceneShots = allShots.filter(s => s.sceneId === firstScene.id)
          setNewShotAt({ index: sceneShots.length, sceneId: firstScene.id })
        }
      }},
      { label: 'Add Scene', color: accent, icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 5h12M2 8h8M2 11h5" stroke={accent} strokeWidth="1.3" strokeLinecap="round" /><path d="M13 10v4M11 12h4" stroke={accent} strokeWidth="1.3" strokeLinecap="round" /></svg>, action: () => { handleAddScene() } },
    ]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, accent, allScenes.length, allShots.length, handleAddScene])

  useFabAction({ branches }, [branches])

  // Cinema Glass project tokens — set once at the .screen root so every
  // .glass-tile (--tile-rgb) and .sheen-title (--accent-rgb / glow)
  // descendant inherits the project hue. Project-accent inline-hex on
  // individual JSX continues to follow the Locations/Art precedent.
  const pr = parseInt(accent.slice(1, 3), 16)
  const pg = parseInt(accent.slice(3, 5), 16)
  const pb = parseInt(accent.slice(5, 7), 16)
  const glowR = Math.min(255, pr + 20)
  const glowG = Math.min(255, pg + 30)
  const glowB = Math.min(255, pb + 16)
  const projectStyle = {
    ['--tile-rgb' as string]: `${pr}, ${pg}, ${pb}`,
    ['--accent-rgb' as string]: `${pr}, ${pg}, ${pb}`,
    ['--accent-glow-rgb' as string]: `${glowR}, ${glowG}, ${glowB}`,
    overflow: 'hidden',
  } as React.CSSProperties

  return (
    <div className="screen" style={projectStyle}>
      {/* Header */}
      <div className="hub-topbar flex-shrink-0">
        <PageHeader
          projectId={projectId}
          title=""
          meta={project ? (
            <div className="flex flex-col items-center gap-1.5">
              <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', color: accent }}>One Arc</span>
              <ProjectSwitcher projectId={projectId} projectName={project.name} accentColor={accent} variant="hub" />
              <span className={`ai-meta-pill ${statusToPhase(project.status)}`}>
                <span className="phase-dot" />
                {statusLabel(project.status)}
              </span>
            </div>
          ) : ''}
          right={
            <button
              className="flex items-center justify-center cursor-pointer"
              style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              onClick={() => { haptic('light'); setShowExport(true) }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 9.5V11.5h8V9.5" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 2v7M4.5 6.5L7 9l2.5-2.5" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          }
          noBorder
        />

        {/* Mode tabs — Hub-style segmented pill (.hub-toggle / -btn).
            Active segment widens, picks up the project accent tint + soft
            glow, with smooth flex-grow transition. Matches HubModeToggle
            so the two surfaces feel like the same control. */}
        <div style={{ width: '100%', padding: '0 14px 8px' }}>
          <div className="hub-toggle" role="tablist" aria-label="One Arc mode">
            {(['script', 'shotlist', 'storyboard'] as SceneMakerMode[]).map(m => {
              const active = mode === m
              return (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`hub-toggle-btn${active ? ' active' : ''}`}
                  onClick={() => { if (mode === 'script') scriptRef.current?.flush(); setMode(m) }}
                >
                  {m}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── MODE SUBHEADERS (consistent 44px height) ── */}

      {/* Script subheader — Characters / Locations / Props.
          DESIGN_LANGUAGE.md: rounded outline pills, mono caps,
          --fg-mono color, hairline border. Active swaps to project
          accent (read from --accent-rgb on .screen root). */}
      {mode === 'script' && (
        <div className="flex items-center justify-center flex-shrink-0" style={{ height: 44, padding: '0 14px', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {(['characters', 'locations', 'props'] as const).map(key => {
            const active = scriptPanel === key
            return (
              <button key={key}
                className={`scenemaker-filter-pill${active ? ' active' : ''}`}
                onClick={() => { haptic('light'); setScriptPanel(active ? null : key) }}>
                {key}
              </button>
            )
          })}
        </div>
      )}

      {/* Shotlist subheader: PDF chip | Story/Shooting toggle | V0 dropdown + add.
          DESIGN_LANGUAGE.md toolbar pattern — left chip, centered segmented
          toggle, right dropdown + add. Active states pull from --accent-rgb
          on the .screen root via .scenemaker-toolbar-chip / -toggle utilities. */}
      {mode === 'shotlist' && (
        <div className="flex items-center flex-shrink-0" style={{ height: 44, padding: '0 14px', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {/* Export PDF */}
          <button className="scenemaker-toolbar-chip"
            onClick={() => { haptic('light'); setShowExport(true) }}>
            <svg width="12" height="12" viewBox="0 0 10 10" fill="none"><path d="M2 7V8.5h6V7" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" /><path d="M5 1v5M3 4l2 2 2-2" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="font-mono uppercase" style={{ fontSize: '0.46rem', letterSpacing: '0.06em' }}>PDF</span>
          </button>

          <div className="flex-1" />

          {/* Story / Shooting toggle */}
          <div className="scenemaker-toggle">
            {(['story', 'shooting'] as const).map(o => (
              <button key={o}
                className={`scenemaker-toggle-btn${shotOrder === o ? ' active' : ''}`}
                onClick={() => { haptic('light'); setShotOrder(o) }}>
                {o}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Version selector */}
          <div className="flex items-center" style={{ gap: 5 }}>
            <button className={`scenemaker-toolbar-chip${showVersionPanel ? ' active' : ''}`}
              style={{ padding: '6px 12px' }}
              onClick={() => { haptic('light'); setShowVersionPanel(v => !v) }}>
              <span className="font-mono" style={{ fontSize: '0.5rem', fontWeight: 700 }}>
                {previewVersion ? `v${previewVersion.versionNumber}` : shotlistVersions?.[0] ? `v${shotlistVersions[0].versionNumber}` : 'v0'}
              </span>
              <svg width="7" height="7" viewBox="0 0 6 6" fill="none" style={{ transform: showVersionPanel ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                <path d="M1.5 2.5L3 4L4.5 2.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
              </svg>
            </button>
            <button className="flex items-center justify-center cursor-pointer"
              style={{
                width: 26, height: 26, borderRadius: '50%',
                background: 'transparent',
                border: `1px solid rgba(${pr},${pg},${pb},0.50)`,
                color: accent,
              }}
              onClick={() => { handleSaveVersion() }}>
              <svg width="10" height="10" viewBox="0 0 8 8" fill="none"><path d="M4 1.5v5M1.5 4h5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* Storyboard subheader — view-mode selector. Active mode reads as
          a glass-tile-sm chip with accent stroke + inset highlight; inactive
          stays flat with --fg-mono. Class lives in globals.css as
          .scenemaker-viewmode-btn so the active treatment composes with the
          .screen root's --accent-rgb. */}
      {mode === 'storyboard' && (
        <div className="flex items-center justify-center flex-shrink-0" style={{ height: 44, padding: '0 14px', gap: 6, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {([
            { key: 'feed' as const, label: 'Feed', icon: <><rect x="3" y="2" width="8" height="3" rx="0.5" /><rect x="3" y="6" width="8" height="3" rx="0.5" /><rect x="3" y="10" width="8" height="3" rx="0.5" /></> },
            { key: '3up' as const, label: '3-up', icon: <><rect x="1" y="3" width="3.5" height="3" rx="0.5" /><rect x="5.25" y="3" width="3.5" height="3" rx="0.5" /><rect x="9.5" y="3" width="3.5" height="3" rx="0.5" /><rect x="1" y="7" width="3.5" height="3" rx="0.5" /><rect x="5.25" y="7" width="3.5" height="3" rx="0.5" /><rect x="9.5" y="7" width="3.5" height="3" rx="0.5" /></> },
            { key: '2up' as const, label: 'Split', icon: <><rect x="1" y="2" width="6" height="5" rx="0.5" /><rect x="7.5" y="2" width="6" height="5" rx="0.5" /><rect x="1" y="9" width="2.5" height="2" rx="0.3" /><rect x="4" y="9" width="2.5" height="2" rx="0.3" /><rect x="7" y="9" width="2.5" height="2" rx="0.3" /><rect x="10" y="9" width="2.5" height="2" rx="0.3" /></> },
            { key: 'all' as const, label: 'All', icon: <>{[0,1,2,3].map(r => [0,1,2,3].map(c => <rect key={`${r}${c}`} x={1+c*3.25} y={1.5+r*3} width="2.5" height="2" rx="0.3" />))}</> },
          ]).map(s => {
            const active = boardScale === s.key
            return (
              <button key={s.key}
                className={`scenemaker-viewmode-btn${active ? ' active' : ''}`}
                onClick={() => { haptic('light'); setBoardScale(s.key) }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="0.7">
                  {s.icon}
                </svg>
                <span className="font-mono uppercase" style={{ fontSize: '0.3rem', letterSpacing: '0.04em' }}>{s.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Preview banner */}
      {previewVersion && mode === 'shotlist' && (
        <div className="flex items-center flex-shrink-0" style={{ height: 36, padding: '0 14px', gap: 8, background: `${accent}12`, borderBottom: `1px solid ${accent}30` }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v4l2.5 1.5" stroke={accent} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" /><circle cx="6" cy="6" r="4.5" stroke={accent} strokeWidth="1" /></svg>
          <span className="font-mono" style={{ fontSize: '0.5rem', fontWeight: 700, color: accent }}>
            Viewing v{previewVersion.versionNumber}
            {previewVersion.label ? ` — ${previewVersion.label}` : ''}
            {' — '}
            {new Date(previewVersion.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
          <div className="flex-1" />
          <button className="font-mono uppercase cursor-pointer select-none"
            style={{ fontSize: '0.42rem', letterSpacing: '0.06em', padding: '4px 12px', borderRadius: 12, background: `${accent}1f`, border: `1px solid ${accent}40`, color: accent }}
            onClick={() => { haptic('light'); setPreviewVersion(null) }}>
            Back to current
          </button>
        </div>
      )}

      {/* Content + Version Panel */}
      <div className="flex flex-1 overflow-hidden" style={{ position: 'relative' }}>
        {/* Main content */}
        <div className="flex-1 overflow-y-auto no-scrollbar" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 100 }}>
          {loading ? <ScenemakerSkeleton /> : (
            <>
              {mode === 'script' && <ScriptView ref={scriptRef} scenes={allScenes} accent={accent} onUpdateScene={handleUpdateScene} />}
              {mode === 'shotlist' && !previewVersion && <ShotlistView scenes={allScenes} shots={allShots} accent={accent} sortMode={shotOrder} threadByShotId={threadByShotId} onTapShot={setSelectedShot} onTapThumbnail={handleThumbnailTap} onInsert={(index, sceneId) => setNewShotAt({ index, sceneId })} onReorder={handleReorder} onReorderToScene={handleReorderToScene} onRenameScene={(sceneId, title) => handleUpdateScene(sceneId, { title })} onDeleteScene={handleDeleteScene} onUpdateShot={(shotId, fields) => { updateShot(shotId, fields).then(() => qc.invalidateQueries({ queryKey: ['shotsByProject', projectId] })).catch(err => console.error('Failed to update shot:', err)) }} onShootReorder={handleShootReorder} />}
              {mode === 'shotlist' && previewVersion && <ShotlistView scenes={displayScenes} shots={displayShots} accent={accent} sortMode={shotOrder} onTapShot={() => {}} onTapThumbnail={() => {}} onInsert={() => {}} onReorder={() => {}} onReorderToScene={() => {}} onRenameScene={() => {}} onDeleteScene={() => {}} onUpdateShot={() => {}} />}
              {mode === 'storyboard' && <StoryboardView scenes={allScenes} shots={allShots} scale={boardScale} aspectRatio={project?.aspectRatio} onTapShot={setSelectedShot} onReorder={handleReorder} />}
            </>
          )}
        </div>

        {/* Version history panel — slides in from right */}
        <AnimatePresence>
          {showVersionPanel && mode === 'shotlist' && (
            <VersionHistoryPanel
              versions={shotlistVersions ?? []}
              accent={accent}
              activeVersionId={previewVersion ? String(previewVersion.versionNumber) : null}
              onSelectVersion={(v) => { setPreviewVersion(v); haptic('light') }}
              onUpdateLabel={(id, label) => updateVersionLabel.mutate({ id, label })}
              onClose={() => setShowVersionPanel(false)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* FAB cluster lifted to global ActionBar; branches registered via useFabAction above. */}

      {/* Storyboard image sheet — Upload + Create image. Pre-fills the
          Create-image prompt with the shot's description so the user can
          iterate from the existing copy rather than retyping. */}
      <StoryboardImageSheet
        open={imageMenuShotId !== null}
        shotId={imageMenuShotId}
        projectId={projectId}
        accentColor={accent}
        initialPrompt={imageMenuShotId ? (allShots.find(s => s.id === imageMenuShotId)?.description ?? '') : ''}
        onClose={() => setImageMenuShotId(null)}
        onComplete={(url) => {
          if (imageMenuShotId) handleImageGenerated(imageMenuShotId, url)
        }}
      />

      {/* Shot detail sheet */}
      <Sheet open={!!selectedShot} onClose={() => setSelectedShot(null)} maxHeight="95vh">
        <ShotDetailSheet shot={selectedShot} accent={accent} projectId={projectId} aspectRatio={project?.aspectRatio} onClose={() => setSelectedShot(null)} onUploadImage={handleUploadImage} onOpenImageMenu={(shotId) => setImageMenuShotId(shotId)}
          onUpdateShot={(shotId, fields) => {
            updateShot(shotId, fields).then(() => {
              qc.invalidateQueries({ queryKey: ['shotsByProject', projectId] })
              // Update selectedShot in-place so the sheet reflects changes immediately
              setSelectedShot(prev => prev?.id === shotId ? { ...prev, ...fields } as Shot : prev)
            }).catch(err => console.error('Failed to update shot:', err))
          }} />
      </Sheet>

      {/* New shot sheet — hero image area + description/size + optional
          Upload-or-Create image flow with its own Generate/Regenerate
          button. The sheet preview uses /api/storyboard/preview (returns
          raw bytes, no shot row needed); Save here just creates the shot
          and uploads whatever blob is held. */}
      <Sheet open={!!newShotAt} onClose={() => { if (!newShotPending) setNewShotAt(null) }}>
        <NewShotSheet
          autoId={newShotAt ? nextShotNumber(newShotAt.sceneId) : ''}
          projectId={projectId}
          accent={accent}
          aspectRatio={project?.aspectRatio}
          pending={newShotPending}
          onSave={async (data) => {
            if (!newShotAt) return
            const shotNumber = nextShotNumber(newShotAt.sceneId)
            const sortOrder = allShots.length + 1
            setNewShotPending(true)
            try {
              const created = await createShot({
                sceneId: newShotAt.sceneId,
                shotNumber,
                size: data.size || null,
                description: data.description,
                status: 'planned',
                sortOrder,
              })
              const newShotId = (created as { id?: string } | null)?.id
              if (data.imageBlob && newShotId) {
                // Both Upload and Create-image paths produce a Blob; wrap as
                // File so the existing uploadStoryboardImage helper signature
                // (which expects File) keeps working unchanged.
                const file = new File([data.imageBlob], `${newShotId}.jpg`, { type: data.imageBlob.type || 'image/jpeg' })
                const url = await uploadStoryboardImage(file, projectId, newShotId)
                await updateShot(newShotId, { imageUrl: url })
              }
              qc.invalidateQueries({ queryKey: ['shotsByProject', projectId] })
              setNewShotAt(null)
            } catch (err) {
              console.error('Failed to create shot or attach image:', err)
              alert(`Couldn't save shot: ${(err as Error).message}`)
            } finally {
              setNewShotPending(false)
            }
          }}
          onClose={() => { if (!newShotPending) setNewShotAt(null) }}
        />
      </Sheet>

      {/* Entity drawers — Characters / Locations / Props */}
      <EntityDrawer type="characters" projectId={projectId} open={scriptPanel === 'characters'} onClose={() => setScriptPanel(null)} />
      <EntityDrawer type="locations" projectId={projectId} open={scriptPanel === 'locations'} onClose={() => setScriptPanel(null)} />
      <EntityDrawer type="props" projectId={projectId} open={scriptPanel === 'props'} onClose={() => setScriptPanel(null)} />

      {/* PDF Export overlay */}
      <AnimatePresence>
        {showExport && (
          <PdfExport
            scenes={allScenes}
            shots={allShots}
            projectName={project?.name ?? 'Untitled'}
            clientName={project?.client ?? ''}
            aspectRatio={project?.aspectRatio}
            onClose={() => setShowExport(false)}
          />
        )}
      </AnimatePresence>

      {toast && <Toast {...toast} />}
    </div>
  )
}