'use client'

import { useRef } from 'react'
import { haptic } from '@/lib/utils/haptics'
import type { Shot } from '@/types'

const SIZE_ABBREV: Record<string, string> = {
  extreme_wide: 'EWS', wide: 'WIDE', full: 'FS', medium: 'MED',
  medium_close_up: 'MCU', close_up: 'CU', extreme_close_up: 'ECU', insert: 'INS',
}

export function ShotDetailSheet({ shot, accent, onClose, onUploadImage }: {
  shot: Shot | null
  accent: string
  onClose: () => void
  onUploadImage: (shotId: string, file: File) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  if (!shot) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onUploadImage(shot.id, file)
    }
    // Reset so the same file can be re-selected
    e.target.value = ''
  }

  return (
    <>
      <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '12px auto 14px' }} />

      {/* Hero image area */}
      <div
        className="cursor-pointer"
        style={{
          margin: '0 16px 14px',
          borderRadius: 10,
          overflow: 'hidden',
          aspectRatio: '16/9',
          background: shot.imageUrl ? 'transparent' : `linear-gradient(135deg, ${accent}12, ${accent}06)`,
          border: shot.imageUrl ? 'none' : `1.5px dashed ${accent}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}
        onClick={() => fileRef.current?.click()}
      >
        {shot.imageUrl ? (
          <img
            src={shot.imageUrl}
            alt={shot.shotNumber}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="5" width="18" height="14" rx="2" stroke={accent} strokeWidth="1.5" opacity="0.5" />
              <path d="M12 10v4M10 12h4" stroke={accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            </svg>
            <span className="font-mono uppercase" style={{ fontSize: '0.4rem', letterSpacing: '0.08em', color: accent, opacity: 0.6 }}>
              Tap to upload
            </span>
          </div>
        )}
        {shot.imageUrl && (
          <div className="absolute bottom-2 right-2 flex items-center justify-center" style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(4,4,10,0.7)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 3v6M3 6h6" stroke="rgba(255,255,255,0.6)" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

      {/* Shot info */}
      <div style={{ padding: '0 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 5 }}>
          <span style={{ fontFamily: "'Geist', sans-serif", fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em', color: accent }}>{shot.shotNumber}</span>
          {shot.size && (
            <span className="font-mono uppercase" style={{ fontSize: '0.38rem', letterSpacing: '0.06em', padding: '2px 7px', borderRadius: 10, background: `${accent}14`, border: `1px solid ${accent}30`, color: accent }}>
              {SIZE_ABBREV[shot.size] ?? shot.size}
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#dddde8', lineHeight: 1.35 }}>{shot.description || '—'}</div>
      </div>

      {/* Metadata rows */}
      <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div className="flex items-start gap-3">
          <span className="font-mono uppercase flex-shrink-0" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', width: 68, paddingTop: 2 }}>Status</span>
          <span className="capitalize" style={{ fontSize: '0.76rem', fontWeight: 600, color: '#dddde8' }}>{shot.status.replace(/_/g, ' ')}</span>
        </div>
      </div>

      {/* Buttons */}
      <div style={{ padding: '14px 20px 0', display: 'flex', gap: 10 }}>
        <button className="flex-1 font-bold cursor-pointer transition-all"
          style={{ padding: 13, borderRadius: 8, fontSize: '0.78rem', background: `${accent}1f`, border: `1px solid ${accent}40`, color: accent }}
          onClick={() => { haptic('medium'); onClose() }}>Done</button>
        <button className="flex-1 font-bold cursor-pointer transition-all"
          style={{ padding: 13, borderRadius: 8, fontSize: '0.78rem', background: 'rgba(232,86,74,0.08)', border: '1px solid rgba(232,86,74,0.2)', color: '#e8564a' }}
          onClick={() => { haptic('warning'); onClose() }}>Delete shot</button>
      </div>
    </>
  )
}
