'use client'

import { useState, useRef, useEffect } from 'react'
import { haptic } from '@/lib/utils/haptics'
import { aspectRatioToCss } from '@/lib/aspect-ratio'
import { useDetailSheetThreads } from '@/components/threads/useDetailSheetThreads'
import { TV } from '@/lib/thread-tokens'
import { StorageImage } from '@/components/ui/StorageImage'
import type { Shot } from '@/types'
// Single source of truth for ShotSize lives in @/lib/shot-sizes — keeps the
// pill list, the schema enum, and the badge abbreviations in lockstep.
// `aerial` / `pov` were previously listed here but aren't in the DB enum;
// selecting them 500'd updates with `invalid input value for enum`.
import { SHOT_SIZE_OPTIONS as SHOT_SIZES, SHOT_SIZE_ABBREV as SIZE_ABBREV } from '@/lib/shot-sizes'

export function ShotDetailSheet({ shot, accent, projectId, aspectRatio, onClose, onUploadImage, onUpdateShot, onOpenImageMenu }: {
  shot: Shot | null
  accent: string
  projectId: string
  aspectRatio?: string | null
  onClose: () => void
  onUploadImage: (shotId: string, file: File) => void
  onUpdateShot: (shotId: string, fields: { description?: string; size?: string | null; notes?: string }) => void
  // When provided, tapping the hero image area opens the storyboard image
  // menu (Upload / Create image) instead of the bare native file picker.
  // The detail sheet closes itself first so the menu isn't stacked on top.
  onOpenImageMenu?: (shotId: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [editingDesc, setEditingDesc] = useState(false)
  const [descValue, setDescValue] = useState('')
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')

  const subjectLabel = shot
    ? `Shot ${shot.shotNumber}${shot.size ? ` · ${SIZE_ABBREV[shot.size] ?? shot.size}` : ''}`
    : ''

  const { TriggerIcon, PreviewRow, MessageZone, StartSheetOverlay } = useDetailSheetThreads({
    projectId,
    attachedToType: 'shot',
    attachedToId: shot?.id ?? null,
    subjectLabel,
  })

  useEffect(() => {
    if (!shot) { setEditingDesc(false); setEditingNotes(false) }
  }, [shot])

  if (!shot) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onUploadImage(shot.id, file)
    e.target.value = ''
  }

  const commitDesc = () => {
    setEditingDesc(false)
    const trimmed = descValue.trim()
    if (trimmed !== (shot.description ?? '')) onUpdateShot(shot.id, { description: trimmed })
  }

  const commitNotes = () => {
    setEditingNotes(false)
    const trimmed = notesValue.trim()
    if (trimmed !== (shot.notes ?? '')) onUpdateShot(shot.id, { notes: trimmed })
  }

  return (
    <>
      {/* Sheet header — Shot type + thread icon + Done */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.3)' }}>Shot</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {TriggerIcon}
          <button
            onClick={() => { haptic('medium'); onClose() }}
            style={{ fontSize: 14, fontWeight: 600, color: TV, background: 'transparent', border: 'none', cursor: 'pointer' }}
          >Done</button>
        </div>
      </div>

      {/* Hero image area — taps open the storyboard image menu (Upload /
          Create image) when onOpenImageMenu is wired; falls back to the
          native file picker if not. The detail sheet closes itself before
          the menu opens so we don't stack two sheets.
          DESIGN_LANGUAGE.md heavy-letterbox variant: 6px bars top/bottom
          mark detail-sheet hero images vs the 2px standard on cards. */}
      <div
        className="cursor-pointer"
        style={{
          margin: '4px 16px 14px',
          borderRadius: 10,
          overflow: 'hidden',
          aspectRatio: aspectRatioToCss(aspectRatio),
          background: shot.imageUrl ? 'transparent' : `linear-gradient(135deg, ${accent}12, ${accent}06)`,
          border: shot.imageUrl ? 'none' : `1.5px dashed ${accent}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}
        onClick={() => {
          if (onOpenImageMenu) {
            onClose()
            onOpenImageMenu(shot.id)
          } else {
            fileRef.current?.click()
          }
        }}
      >
        <div className="letterbox-top" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6 }} />
        {shot.imageUrl ? (
          <StorageImage url={shot.imageUrl} alt={shot.shotNumber} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="5" width="18" height="14" rx="2" stroke={accent} strokeWidth="1.5" opacity="0.5" />
              <path d="M12 10v4M10 12h4" stroke={accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            </svg>
            <span className="font-mono uppercase" style={{ fontSize: '0.4rem', letterSpacing: '0.08em', color: accent, opacity: 0.6 }}>
              {onOpenImageMenu ? 'Tap to add image' : 'Tap to upload'}
            </span>
          </div>
        )}
        {shot.imageUrl && (
          <div className="absolute bottom-2 right-2 flex items-center justify-center" style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(4,4,10,0.7)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.15)',
            zIndex: 6,
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 3v6M3 6h6" stroke="rgba(255,255,255,0.6)" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </div>
        )}
        <div className="letterbox-bottom" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 6 }} />
      </div>

      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

      {/* Shot info */}
      <div style={{ padding: '0 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
          <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em', color: accent }}>
            {shot.shotNumber}
          </span>
          {shot.size && (
            <span className="font-mono uppercase" style={{ fontSize: '0.38rem', letterSpacing: '0.06em', padding: '2px 7px', borderRadius: 10, background: `${accent}14`, border: `1px solid ${accent}30`, color: accent }}>
              {SIZE_ABBREV[shot.size] ?? shot.size}
            </span>
          )}
        </div>

        {editingDesc ? (
          <textarea
            value={descValue}
            onChange={e => setDescValue(e.target.value)}
            autoFocus
            onBlur={commitDesc}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitDesc() } }}
            rows={2}
            className="w-full outline-none resize-none"
            style={{ fontSize: '0.82rem', fontWeight: 600, color: '#dddde8', lineHeight: 1.4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '6px 8px' }}
          />
        ) : (
          <div
            className="cursor-text"
            style={{ fontSize: '0.82rem', fontWeight: 600, color: shot.description ? '#dddde8' : '#62627a', lineHeight: 1.4, minHeight: 22, borderRadius: 6, padding: '2px 0' }}
            onClick={() => { setDescValue(shot.description ?? ''); setEditingDesc(true) }}>
            {shot.description || 'Tap to add description...'}
          </div>
        )}
      </div>

      {/* Frame size selector — single horizontal-scroll row matches the
          New Shot sheet so the same pill list reads identically across
          surfaces. */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 8 }}>Frame size</span>
        <div
          className="flex no-scrollbar"
          style={{ gap: 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}
        >
          {SHOT_SIZES.map(s => (
            <button key={s.value}
              type="button"
              className="font-mono cursor-pointer select-none transition-all flex-shrink-0"
              style={{
                fontSize: '0.62rem', letterSpacing: '0.04em', padding: '8px 14px', borderRadius: 18,
                background: shot.size === s.value ? `${accent}28` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${shot.size === s.value ? `${accent}66` : 'rgba(255,255,255,0.06)'}`,
                color: shot.size === s.value ? accent : '#a8a8b8',
                fontWeight: shot.size === s.value ? 600 : 500,
                whiteSpace: 'nowrap',
              }}
              onClick={() => {
                haptic('light')
                onUpdateShot(shot.id, { size: s.value })
              }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Meta data card — Status + Notes wrapped in a single glass-tile.
          DESIGN_LANGUAGE.md detail-sheet meta card pattern: mono caps
          labels left at fixed width, value right. Notes value spans full
          width and wraps. Lens / Move / Cast / Props / Location rows are
          deferred to a follow-up that adds the corresponding fields to
          the Shot type (see PR description). */}
      <div style={{ padding: '0 16px 14px' }}>
        <div className="glass-tile" style={{ borderRadius: 12 }}>
          <div className="scenemaker-meta-row">
            <span className="scenemaker-meta-label">Status</span>
            <span className="scenemaker-meta-value capitalize">{shot.status.replace(/_/g, ' ')}</span>
          </div>
          <div className="scenemaker-meta-row">
            <span className="scenemaker-meta-label">Notes</span>
            {editingNotes ? (
              <textarea
                value={notesValue}
                onChange={e => setNotesValue(e.target.value)}
                autoFocus
                onBlur={commitNotes}
                rows={3}
                placeholder="Crew instructions, reminders..."
                className="scenemaker-meta-value outline-none resize-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '6px 8px' }}
              />
            ) : (
              <div
                className="scenemaker-meta-value cursor-text"
                style={{ color: shot.notes ? 'var(--fg)' : 'var(--fg-mono)', minHeight: 20, padding: '2px 0' }}
                onClick={() => { setNotesValue(shot.notes ?? ''); setEditingNotes(true) }}>
                {shot.notes || 'Tap to add notes...'}
              </div>
            )}
          </div>
        </div>
      </div>

      {PreviewRow}
      {MessageZone}

      {/* Buttons */}
      <div style={{ padding: '14px 20px 0', display: 'flex', gap: 10 }}>
        <button className="flex-1 font-bold cursor-pointer transition-all"
          style={{ padding: 13, borderRadius: 8, fontSize: '0.78rem', background: `${accent}1f`, border: `1px solid ${accent}40`, color: accent }}
          onClick={() => { haptic('medium'); onClose() }}>Done</button>
        <button className="flex-1 font-bold cursor-pointer transition-all"
          style={{ padding: 13, borderRadius: 8, fontSize: '0.78rem', background: 'rgba(232,86,74,0.08)', border: '1px solid rgba(232,86,74,0.2)', color: '#e8564a' }}
          onClick={() => { haptic('warning'); onClose() }}>Delete shot</button>
      </div>

      {StartSheetOverlay}
    </>
  )
}
