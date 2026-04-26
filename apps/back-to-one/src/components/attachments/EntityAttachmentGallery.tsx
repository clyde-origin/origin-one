'use client'

// Polymorphic image gallery — renders on any entity surface (Locations,
// Props/Wardrobe/HMU when those land, future cast reference photos).
// Spec: apps/back-to-one/reference/back-to-one-entity-attachments.html
// DECISIONS: "EntityAttachment storage — v1 unsigned public URLs, RLS deferred."

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence, type PanInfo } from 'framer-motion'
import {
  uploadEntityAttachment,
  listEntityAttachments,
  deleteEntityAttachment,
  updateEntityAttachmentCaption,
  type EntityAttachmentType,
  type EntityAttachmentRow,
} from '@/lib/db/queries'
import { useMeId, useAllCrew } from '@/lib/hooks/useOriginOne'
import { haptic } from '@/lib/utils/haptics'

export type EntityAttachmentGalleryVariant = 'row' | 'sheet'

interface EntityAttachmentGalleryProps {
  projectId: string
  attachedToType: EntityAttachmentType
  attachedToId: string
  variant: EntityAttachmentGalleryVariant
  readOnly?: boolean
  maxFiles?: number
  onCountChange?: (n: number) => void
}

const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024

// ── Public component ────────────────────────────────────────────────────────

export function EntityAttachmentGallery(props: EntityAttachmentGalleryProps) {
  const { projectId, attachedToType, attachedToId, variant, readOnly = false, onCountChange } = props
  const qc = useQueryClient()
  const meId = useMeId()

  const queryKey = ['entityAttachments', projectId, attachedToType, attachedToId] as const

  const { data: items = [] } = useQuery({
    queryKey,
    queryFn: () => listEntityAttachments(projectId, attachedToType, attachedToId),
    enabled: !!attachedToId,
  })

  useEffect(() => { onCountChange?.(items.length) }, [items.length, onCountChange])

  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadEntityAttachment({
      file, projectId, attachedToType, attachedToId, uploadedById: meId ?? null,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey as any }),
  })

  const handleFiles = useCallback(async (files: File[]) => {
    setError(null)
    const valid: File[] = []
    for (const f of files) {
      if (!ALLOWED_MIMES.includes(f.type)) {
        setError(`Skipped ${f.name}: only PNG, JPEG, WebP supported.`)
        continue
      }
      if (f.size > MAX_BYTES) {
        setError(`Skipped ${f.name}: over 10 MB limit.`)
        continue
      }
      valid.push(f)
    }
    if (valid.length === 0) return
    setUploading(true)
    setProgress({ done: 0, total: valid.length })
    try {
      // Sequential so partial failures surface the offending file in the toast.
      for (let i = 0; i < valid.length; i++) {
        await uploadMutation.mutateAsync(valid[i])
        setProgress({ done: i + 1, total: valid.length })
      }
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed')
    } finally {
      setUploading(false)
      setProgress({ done: 0, total: 0 })
    }
  }, [uploadMutation])

  const onPickFiles = () => fileRef.current?.click()

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length) handleFiles(files)
  }

  // Drag-and-drop (sheet only)
  const [dragOver, setDragOver] = useState(false)
  const onDragEnter = (e: React.DragEvent) => { e.preventDefault(); if (!readOnly) setDragOver(true) }
  const onDragOver = (e: React.DragEvent) => { e.preventDefault() }
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    // Only clear when leaving the actual zone, not when crossing into a child.
    if ((e.target as HTMLElement) === e.currentTarget) setDragOver(false)
  }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (readOnly) return
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (files.length) handleFiles(files)
  }

  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const lightboxOpen = lightboxIndex != null
  const setIndex = (i: number) => setLightboxIndex(((i % items.length) + items.length) % items.length)

  if (variant === 'row') {
    return <RowVariant items={items} uploading={uploading} />
  }

  // SHEET variant
  return (
    <>
      <SheetVariant
        items={items}
        uploading={uploading}
        progress={progress}
        error={error}
        dragOver={dragOver}
        readOnly={readOnly}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onPickFiles={onPickFiles}
        onTileClick={(i) => { haptic('light'); setLightboxIndex(i) }}
        onClearError={() => setError(null)}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        style={{ display: 'none' }}
        onChange={onInputChange}
      />
      <AnimatePresence>
        {lightboxOpen && items[lightboxIndex!] && (
          <Lightbox
            key="entity-attachment-lightbox"
            items={items}
            index={lightboxIndex!}
            onIndex={setIndex}
            onClose={() => setLightboxIndex(null)}
            readOnly={readOnly}
            queryKey={queryKey as any}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ── ROW variant ──────────────────────────────────────────────────────────────

function RowVariant({ items, uploading }: { items: EntityAttachmentRow[]; uploading: boolean }) {
  if (uploading && items.length === 0) {
    return <RowThumb empty><Spinner /></RowThumb>
  }
  if (items.length === 0) return <RowThumb empty><PlaceholderIcon /></RowThumb>
  if (items.length === 1) return <RowThumb imageUrl={items[0].publicUrl} />
  // Stacked
  return (
    <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 36, height: 36, borderRadius: 7,
        backgroundImage: `url(${items[2]?.publicUrl ?? items[0].publicUrl})`, backgroundSize: 'cover', backgroundPosition: 'center',
        border: '0.5px solid rgba(0,0,0,0.4)' }} />
      <div style={{ position: 'absolute', top: 4, left: 4, width: 36, height: 36, borderRadius: 7,
        backgroundImage: `url(${items[1]?.publicUrl ?? items[0].publicUrl})`, backgroundSize: 'cover', backgroundPosition: 'center',
        border: '0.5px solid rgba(0,0,0,0.4)' }} />
      <div style={{ position: 'absolute', bottom: 0, right: 0, width: 36, height: 36, borderRadius: 7,
        backgroundImage: `url(${items[0].publicUrl})`, backgroundSize: 'cover', backgroundPosition: 'center',
        boxShadow: '0 0 0 1.5px #04040a' }} />
      <span style={{
        position: 'absolute', bottom: -2, right: -2,
        background: '#04040a', color: 'rgba(255,255,255,0.85)',
        fontFamily: "'Geist Mono', ui-monospace, monospace",
        fontSize: 10, padding: '1px 5px', borderRadius: 8,
        border: '0.5px solid rgba(255,255,255,0.18)',
      }}>
        +{items.length - 1}
      </span>
    </div>
  )
}

function RowThumb({ imageUrl, empty, children }: { imageUrl?: string; empty?: boolean; children?: React.ReactNode }) {
  if (empty) {
    return (
      <div style={{
        width: 44, height: 44, borderRadius: 8, flexShrink: 0,
        background: 'rgba(255,255,255,0.04)',
        border: '0.5px dashed rgba(255,255,255,0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(255,255,255,0.32)',
      }}>{children}</div>
    )
  }
  return (
    <div style={{
      width: 44, height: 44, borderRadius: 8, flexShrink: 0,
      backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center',
    }} />
  )
}

function PlaceholderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  )
}

function Spinner() {
  return (
    <div style={{
      width: 18, height: 18,
      border: '2px solid rgba(255,255,255,0.15)',
      borderTopColor: 'rgba(255,255,255,0.6)',
      borderRadius: '50%',
      animation: 'eag-spin 0.9s linear infinite',
    }}>
      <style>{`@keyframes eag-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── SHEET variant ────────────────────────────────────────────────────────────

interface SheetVariantProps {
  items: EntityAttachmentRow[]
  uploading: boolean
  progress: { done: number; total: number }
  error: string | null
  dragOver: boolean
  readOnly: boolean
  onDragEnter: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onPickFiles: () => void
  onTileClick: (i: number) => void
  onClearError: () => void
}

function SheetVariant(p: SheetVariantProps) {
  const empty = p.items.length === 0 && !p.uploading

  return (
    <div onDragEnter={p.onDragEnter} onDragOver={p.onDragOver} onDragLeave={p.onDragLeave} onDrop={p.onDrop}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        margin: '14px 0 8px',
      }}>
        <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.42)' }}>
          Photos
        </span>
        <span className="font-mono" style={{ fontSize: 10, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.32)' }}>
          {p.dragOver ? 'drop to upload' : p.items.length}
        </span>
      </div>

      {p.dragOver ? (
        <DropZone populated={p.items.length > 0} count={p.items.length} />
      ) : empty ? (
        <EmptyAdd onPickFiles={p.onPickFiles} disabled={p.readOnly} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {p.items.map((item, i) => (
            <Tile
              key={item.id}
              item={item}
              onClick={() => p.onTileClick(i)}
            />
          ))}
          {p.uploading && <UploadingTile progress={p.progress} />}
          {!p.readOnly && !p.uploading && <AddTile onPickFiles={p.onPickFiles} />}
        </div>
      )}

      {p.error && (
        <div style={{
          marginTop: 10, padding: '8px 10px', borderRadius: 8,
          background: 'rgba(232,72,72,0.06)', border: '0.5px solid rgba(232,72,72,0.25)',
          color: 'rgba(232,72,72,0.9)', fontFamily: "'Geist Mono', ui-monospace, monospace",
          fontSize: 11, letterSpacing: '0.04em',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
        }}>
          <span style={{ flex: 1 }}>{p.error}</span>
          <button onClick={p.onClearError} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(232,72,72,0.7)', fontSize: 12,
          }}>✕</button>
        </div>
      )}
    </div>
  )
}

function Tile({ item, onClick }: { item: EntityAttachmentRow; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        aspectRatio: '1 / 1',
        borderRadius: 10,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.04)',
        cursor: 'pointer',
        backgroundImage: `url(${item.publicUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {item.caption && (
        <span style={{
          position: 'absolute', top: 6, right: 6,
          width: 6, height: 6, borderRadius: '50%',
          background: 'rgba(255,255,255,0.7)',
        }} />
      )}
    </div>
  )
}

function UploadingTile({ progress }: { progress: { done: number; total: number } }) {
  return (
    <div style={{
      position: 'relative', aspectRatio: '1 / 1', borderRadius: 10,
      background: 'rgba(255,255,255,0.04)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6,
    }}>
      <Spinner />
      {progress.total > 1 && (
        <span style={{ fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
          {progress.done}/{progress.total}
        </span>
      )}
    </div>
  )
}

function AddTile({ onPickFiles }: { onPickFiles: () => void }) {
  return (
    <button
      onClick={onPickFiles}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '0.5px dashed rgba(255,255,255,0.18)',
        borderRadius: 10,
        aspectRatio: '1 / 1',
        background: 'transparent',
        color: 'rgba(255,255,255,0.38)',
        fontSize: 22, fontWeight: 300,
        cursor: 'pointer',
      }}
    >+</button>
  )
}

function EmptyAdd({ onPickFiles, disabled }: { onPickFiles: () => void; disabled: boolean }) {
  return (
    <div style={{
      border: '0.5px dashed rgba(255,255,255,0.18)',
      borderRadius: 12,
      padding: '22px 16px',
      textAlign: 'center',
      background: 'rgba(255,255,255,0.02)',
    }}>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: '0 0 4px' }}>No photos yet</p>
      <p className="font-mono" style={{
        fontSize: 11, color: 'rgba(255,255,255,0.38)', margin: '0 0 12px', letterSpacing: '0.04em',
      }}>Drag images here or tap to upload</p>
      {!disabled && (
        <button
          onClick={onPickFiles}
          className="font-mono uppercase"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8,
            background: 'rgba(255,255,255,0.06)',
            border: '0.5px solid rgba(255,255,255,0.16)',
            fontSize: 11, letterSpacing: '0.06em',
            color: 'rgba(255,255,255,0.82)', cursor: 'pointer',
          }}
        >
          + Add photos
        </button>
      )}
    </div>
  )
}

function DropZone({ populated, count }: { populated: boolean; count: number }) {
  return (
    <div style={{
      border: '1px dashed rgba(60,190,106,0.65)',
      background: 'rgba(60,190,106,0.06)',
      borderRadius: 12,
      padding: populated ? '18px 16px' : '28px 16px',
      textAlign: 'center',
    }}>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', margin: '0 0 4px' }}>
        {populated ? 'Drop to add more' : 'Drop images'}
      </p>
      <p className="font-mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.58)', margin: 0, letterSpacing: '0.04em' }}>
        {populated ? `existing ${count} photo${count === 1 ? '' : 's'} preserved` : 'jpg · png · webp · up to 10mb each'}
      </p>
    </div>
  )
}

// ── LIGHTBOX ─────────────────────────────────────────────────────────────────

interface LightboxProps {
  items: EntityAttachmentRow[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
  readOnly: boolean
  queryKey: readonly unknown[]
}

function Lightbox(p: LightboxProps) {
  const item = p.items[p.index]
  const qc = useQueryClient()
  const { data: allCrew = [] } = useAllCrew()
  const uploaderName = item.uploadedById
    ? (allCrew.find((c: any) => c.user?.id === item.uploadedById)?.user?.name ?? 'Unknown')
    : null

  const [caption, setCaption] = useState(item.caption ?? '')
  const [savedFlash, setSavedFlash] = useState(false)
  const [busy, setBusy] = useState(false)

  // Sync local state when navigating to a different item
  useEffect(() => { setCaption(item.caption ?? ''); setSavedFlash(false) }, [item.id, item.caption])

  // Keyboard nav + close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') p.onClose()
      else if (e.key === 'ArrowLeft') p.onIndex(p.index - 1)
      else if (e.key === 'ArrowRight') p.onIndex(p.index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [p])

  const saveCaption = async () => {
    const next = caption.trim() || null
    if ((next ?? null) === (item.caption ?? null)) return
    try {
      await updateEntityAttachmentCaption(item.id, next)
      qc.invalidateQueries({ queryKey: p.queryKey as any })
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1400)
    } catch (e) {
      console.error('Caption save failed:', e)
    }
  }

  const onCopyShare = async () => {
    haptic('light')
    try {
      await navigator.clipboard.writeText(item.publicUrl)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1400)
    } catch {
      // Fallback no-op; browsers without clipboard access just don't copy.
    }
  }

  const onDownload = () => {
    haptic('light')
    const a = document.createElement('a')
    a.href = item.publicUrl
    a.download = item.storagePath.split('/').pop() ?? 'attachment'
    a.target = '_blank'
    a.rel = 'noopener'
    document.body.appendChild(a); a.click(); a.remove()
  }

  const onDelete = async () => {
    if (busy) return
    if (!window.confirm('Delete this photo?')) return
    setBusy(true)
    try {
      await deleteEntityAttachment(item.id)
      qc.invalidateQueries({ queryKey: p.queryKey as any })
      // Close if it was the last; otherwise step to a valid index
      if (p.items.length <= 1) p.onClose()
      else p.onIndex(Math.min(p.index, p.items.length - 2))
    } catch (e: any) {
      window.alert(e?.message ?? 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  const uploadedDateLabel = (() => {
    try {
      const d = new Date(item.uploadedAt)
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    } catch { return '' }
  })()

  return (
    <>
      <motion.div
        key="lightbox-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={p.onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.78)' }}
      />
      <motion.div
        key="lightbox-sheet"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        drag="y" dragConstraints={{ top: 0 }} dragElastic={0.1}
        onDragEnd={(_: any, info: PanInfo) => { if (info.offset.y > 100) p.onClose() }}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 61,
          background: '#04040a', borderRadius: '20px 20px 0 0',
          maxHeight: 'calc(100dvh - 30px)', overflowY: 'auto',
          padding: '18px 16px',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
          border: '0.5px solid rgba(255,255,255,0.14)',
        }}
      >
        <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.18)', borderRadius: 2, margin: '0 auto 14px' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.58)' }}>
            Photo
          </span>
          <span className="font-mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.58)' }}>
            {p.index + 1} / {p.items.length}
          </span>
        </div>

        <div style={{
          aspectRatio: '4 / 3', borderRadius: 10, marginBottom: 14, position: 'relative',
          backgroundImage: `url(${item.publicUrl})`, backgroundSize: 'cover', backgroundPosition: 'center',
          background: '#0a0a12',
        }}>
          {p.items.length > 1 && (
            <>
              <button onClick={() => p.onIndex(p.index - 1)} aria-label="Previous photo" style={navBtnStyle('left')}>‹</button>
              <button onClick={() => p.onIndex(p.index + 1)} aria-label="Next photo" style={navBtnStyle('right')}>›</button>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 14 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onBlur={saveCaption}
              placeholder="Add caption…"
              readOnly={p.readOnly}
              rows={2}
              style={{
                width: '100%', resize: 'none',
                padding: '10px 12px', borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                border: '0.5px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.88)',
                fontSize: 13, lineHeight: 1.5, outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            {savedFlash && (
              <span className="font-mono" style={{
                position: 'absolute', bottom: -16, left: 0,
                fontSize: 10, color: '#3cbe6a', letterSpacing: '0.04em',
              }}>✓ Saved</span>
            )}
          </div>
          {!p.readOnly && (
            <div style={{ display: 'flex', gap: 6 }}>
              <ActionBtn title="Copy link" onClick={onCopyShare}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
              </ActionBtn>
              <ActionBtn title="Download" onClick={onDownload}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </ActionBtn>
              <ActionBtn title="Delete" danger onClick={onDelete} disabled={busy}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1.5 14a2 2 0 0 1-2 2H8.5a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                </svg>
              </ActionBtn>
            </div>
          )}
        </div>

        <div style={{
          display: 'flex', gap: 12, alignItems: 'center',
          padding: '10px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,0.025)',
        }}>
          <div>
            <p className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.38)', margin: 0 }}>
              Uploaded
            </p>
            <p className="font-mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.78)', margin: '2px 0 0' }}>
              {uploadedDateLabel}{uploaderName ? ` · by ${uploaderName.split(' ')[0]}` : ''}
            </p>
          </div>
        </div>
      </motion.div>
    </>
  )
}

function ActionBtn({ children, title, onClick, danger, disabled }: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        width: 36, height: 36, borderRadius: 8,
        background: danger ? 'rgba(232,72,72,0.05)' : 'rgba(255,255,255,0.04)',
        border: `0.5px solid ${danger ? 'rgba(232,72,72,0.25)' : 'rgba(255,255,255,0.12)'}`,
        color: danger ? 'rgba(232,72,72,0.85)' : 'rgba(255,255,255,0.7)',
        cursor: disabled ? 'wait' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}

// ── COVER variant ────────────────────────────────────────────────────────────
// Card-style hero for surfaces with their own visual prominence (LocationCard's
// 96×96 thumb in particular). Different from the `row` variant — covers fill
// the parent's area; rows are compact stacked previews for list contexts.

export function EntityAttachmentCover({
  projectId,
  attachedToType,
  attachedToId,
  size = 96,
  alt,
}: {
  projectId: string
  attachedToType: EntityAttachmentType
  attachedToId: string
  size?: number | string
  alt?: string
}) {
  const { data: items = [] } = useQuery({
    queryKey: ['entityAttachments', projectId, attachedToType, attachedToId],
    queryFn: () => listEntityAttachments(projectId, attachedToType, attachedToId),
    enabled: !!attachedToId,
  })

  const dim = typeof size === 'number' ? `${size}px` : size

  if (items.length === 0) {
    return (
      <div style={{
        width: dim, height: dim,
        background: '#0a0a12',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <PlaceholderIcon />
      </div>
    )
  }

  return (
    <div style={{
      width: dim, height: dim, position: 'relative',
      backgroundImage: `url(${items[0].publicUrl})`,
      backgroundSize: 'cover', backgroundPosition: 'center',
      background: '#0a0a12',
    }}
      role="img"
      aria-label={alt}
    >
      {items.length > 1 && (
        <span className="font-mono" style={{
          position: 'absolute', bottom: 4, right: 4,
          background: 'rgba(0,0,0,0.7)',
          color: 'rgba(255,255,255,0.92)',
          fontSize: 9, padding: '1px 6px', borderRadius: 8,
          letterSpacing: '0.04em',
          border: '0.5px solid rgba(255,255,255,0.15)',
        }}>
          +{items.length - 1}
        </span>
      )}
    </div>
  )
}

function navBtnStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    [side]: 8 as any,
    width: 32, height: 32, borderRadius: '50%',
    background: 'rgba(0,0,0,0.55)',
    color: 'rgba(255,255,255,0.9)',
    border: '0.5px solid rgba(255,255,255,0.18)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, lineHeight: 1, cursor: 'pointer',
  }
}
