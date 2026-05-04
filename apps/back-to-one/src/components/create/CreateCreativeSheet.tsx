'use client'

import { useState } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/utils/haptics'

interface CreateCreativeSheetProps {
  open: boolean
  projectId: string
  accent: string
  onSelectScene: () => void
  onSelectShot: () => void
  onSelectTone: () => void
  onClose: () => void
}

const springSheet = { type: 'spring' as const, damping: 30, stiffness: 300 }

export function CreateCreativeSheet({ open, projectId, accent, onSelectScene, onSelectShot, onSelectTone, onClose }: CreateCreativeSheetProps) {

  function handleDragEnd(_: unknown, info: { offset: { y: number } }) {
    if (info.offset.y > 100) onClose()
  }

  const options = [
    {
      label: 'Scene',
      desc: 'Add a new scene to the script',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="2" y="4" width="16" height="12" rx="2" stroke={accent} strokeWidth="1.3" />
          <path d="M2 8h16" stroke={accent} strokeWidth="1.3" />
          <path d="M7 4V8M13 4V8" stroke={accent} strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      ),
      onTap: () => { haptic('light'); onClose(); onSelectScene() },
    },
    {
      label: 'Shot',
      desc: 'Add a shot to the shotlist',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="3" y="5" width="14" height="10" rx="1.5" stroke="#6470f3" strokeWidth="1.3" />
          <circle cx="10" cy="10" r="3" stroke="#6470f3" strokeWidth="1.3" />
          <circle cx="10" cy="10" r="1" fill="#6470f3" />
        </svg>
      ),
      onTap: () => { haptic('light'); onClose(); onSelectShot() },
    },
    {
      label: 'Tone reference',
      desc: 'Add to the moodboard',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="7" stroke="#c45adc" strokeWidth="1.3" />
          <circle cx="10" cy="10" r="3" fill="#c45adc" opacity="0.7" />
        </svg>
      ),
      onTap: () => { haptic('light'); onClose(); onSelectTone() },
    },
  ]

  return (
    <AnimatePresence>
      {open && (
        <>
          <m.div
            key="creative-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
          />

          <m.div
            key="creative-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={springSheet}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 51,
              background: '#0e0e1a', borderRadius: '20px 20px 0 0',
              paddingBottom: 'env(safe-area-inset-bottom, 24px)',
            }}
          >
            {/* Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '12px auto 0' }} />

            {/* Header */}
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: '#dddde8' }}>Create</span>
            </div>

            {/* Options */}
            <div style={{ padding: '12px 20px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {options.map(opt => (
                <button
                  key={opt.label}
                  onClick={opt.onTap}
                  className="active:bg-white/[0.03] transition-colors cursor-pointer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 12px', borderRadius: 9,
                    background: 'transparent', border: 'none', width: '100%', textAlign: 'left',
                  }}
                >
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {opt.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#dddde8' }}>{opt.label}</div>
                    <div className="font-mono" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.04em', marginTop: 2 }}>{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  )
}
