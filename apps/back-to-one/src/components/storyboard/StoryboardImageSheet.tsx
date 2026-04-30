'use client'

// Sheet that appears when a producer/crew taps an empty storyboard thumbnail.
// Two actions in one place:
//   1. Upload from device — opens the native file picker.
//   2. Generate with Bria — text-to-image via /api/storyboard/generate.
//
// Both paths end with the same callback: a fresh `imageUrl` for the shot.
// Caller invalidates its React Query cache and updates any in-memory
// references (e.g. the open detail sheet).

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { uploadStoryboardImage } from '@/lib/db/queries'
import { haptic } from '@/lib/utils/haptics'

type Mode = 'menu' | 'bria'

export function StoryboardImageSheet({
  open,
  shotId,
  projectId,
  accentColor,
  initialPrompt,
  onClose,
  onComplete,
}: {
  open: boolean
  shotId: string | null
  projectId: string
  accentColor: string
  // Pre-populates the Create-image prompt so the user can iterate from the
  // shot description rather than retyping it. Empty string is fine.
  initialPrompt?: string
  onClose: () => void
  onComplete: (imageUrl: string) => void
}) {
  const [mode, setMode] = useState<Mode>('menu')
  const [prompt, setPrompt] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset internal state every time the sheet opens fresh.
  useEffect(() => {
    if (open) {
      setMode('menu')
      setPrompt(initialPrompt ?? '')
      setPending(false)
      setError(null)
    }
  }, [open, shotId, initialPrompt])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !shotId) return
    setPending(true)
    setError(null)
    try {
      const url = await uploadStoryboardImage(file, projectId, shotId)
      haptic('success')
      onComplete(url)
      onClose()
    } catch (err) {
      console.error('Upload failed:', err)
      setError((err as Error).message ?? 'Upload failed')
      setPending(false)
    }
  }

  async function handleGenerate() {
    if (!shotId || !prompt.trim() || pending) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/storyboard/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, shotId, prompt: prompt.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.detail || data?.error || `Generation failed (${res.status})`)
      }
      if (!data.imageUrl) throw new Error('Generation succeeded but no imageUrl returned')
      haptic('success')
      onComplete(data.imageUrl)
      onClose()
    } catch (err) {
      console.error('Bria generate failed:', err)
      setError((err as Error).message ?? 'Generation failed')
      setPending(false)
    }
  }

  return (
    <Sheet open={open} onClose={pending ? () => {} : onClose} maxHeight="60vh">
      <SheetHeader
        title={mode === 'menu' ? 'Storyboard image' : 'Create image'}
        onClose={pending ? () => {} : onClose}
      />
      <SheetBody>
        <AnimatePresence mode="wait" initial={false}>
          {mode === 'menu' ? (
            <motion.div
              key="menu"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-3"
              style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}
            >
              <ActionRow
                label="Upload from device"
                helper="Pick an image from your library or files."
                onClick={() => { haptic('light'); fileInputRef.current?.click() }}
                accentColor={accentColor}
                disabled={pending}
                icon={<UploadIcon />}
              />
              <ActionRow
                label="Create image"
                helper="Describe the shot and we'll render a draft frame."
                onClick={() => { haptic('light'); setMode('bria') }}
                accentColor={accentColor}
                disabled={pending}
                icon={<SparkleIcon />}
              />
              {error && <ErrorRow message={error} />}
            </motion.div>
          ) : (
            <motion.div
              key="bria"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-3"
              style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}
            >
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                disabled={pending}
                placeholder="Wide medium shot, golden hour, two characters silhouetted against an open field…"
                rows={5}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  color: '#dddde8',
                  fontSize: '0.82rem',
                  lineHeight: 1.5,
                  resize: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { haptic('light'); setMode('menu'); setError(null) }}
                  disabled={pending}
                  className="font-mono uppercase"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8,
                    padding: '10px 14px',
                    color: '#a8a8b8',
                    fontSize: '0.5rem',
                    letterSpacing: '0.08em',
                    cursor: pending ? 'not-allowed' : 'pointer',
                    opacity: pending ? 0.5 : 1,
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={pending || !prompt.trim()}
                  className="font-mono uppercase flex-1 flex items-center justify-center gap-2"
                  style={{
                    background: pending || !prompt.trim() ? 'rgba(255,255,255,0.05)' : accentColor,
                    border: '1px solid ' + (pending || !prompt.trim() ? 'rgba(255,255,255,0.08)' : accentColor),
                    borderRadius: 8,
                    padding: '10px 14px',
                    color: pending || !prompt.trim() ? '#62627a' : '#04040a',
                    fontSize: '0.5rem',
                    letterSpacing: '0.08em',
                    fontWeight: 700,
                    cursor: pending || !prompt.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {pending ? (
                    <>
                      <Spinner color="#62627a" />
                      <span>Generating…</span>
                    </>
                  ) : (
                    <span>Generate</span>
                  )}
                </button>
              </div>
              {pending && (
                <span className="font-mono" style={{ fontSize: '0.46rem', color: '#62627a', letterSpacing: '0.06em', textAlign: 'center' }}>
                  Image generation takes about 30–60 seconds. Don't close this sheet.
                </span>
              )}
              {error && <ErrorRow message={error} />}
            </motion.div>
          )}
        </AnimatePresence>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </SheetBody>
    </Sheet>
  )
}

function ActionRow({
  label, helper, onClick, accentColor, disabled, icon,
}: {
  label: string
  helper: string
  onClick: () => void
  accentColor: string
  disabled?: boolean
  icon?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center text-left w-full"
      style={{
        gap: 12,
        padding: '12px 14px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        className="rounded-full flex items-center justify-center flex-shrink-0"
        style={{ width: 32, height: 32, background: `${accentColor}1f`, color: accentColor }}
      >
        {icon}
      </span>
      <span className="flex-1 flex flex-col">
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#dddde8' }}>{label}</span>
        <span style={{ fontSize: '0.62rem', color: '#62627a', marginTop: 2 }}>{helper}</span>
      </span>
    </button>
  )
}

function ErrorRow({ message }: { message: string }) {
  return (
    <span style={{
      fontSize: '0.62rem',
      color: '#ff7b7b',
      background: 'rgba(255,123,123,0.06)',
      border: '1px solid rgba(255,123,123,0.15)',
      borderRadius: 6,
      padding: '8px 10px',
    }}>
      {message}
    </span>
  )
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 9.5V11.5h10V9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 2v8M4 5l3-3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1.5l1.4 3.6L12 6.5l-3.6 1.4L7 11.5l-1.4-3.6L2 6.5l3.6-1.4L7 1.5z" fill="currentColor" />
    </svg>
  )
}

function Spinner({ color }: { color: string }) {
  return (
    <span
      className="rounded-full border animate-spin inline-block"
      style={{
        width: 10,
        height: 10,
        borderColor: 'rgba(255,255,255,0.2)',
        borderTopColor: color,
      }}
      aria-label="Loading"
    />
  )
}
