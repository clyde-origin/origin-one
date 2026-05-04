'use client'

import { useEffect, useRef, useState } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/utils/haptics'

interface TeamNameSheetProps {
  open: boolean
  currentName: string
  onClose: () => void
  onSave: (name: string) => Promise<void> | void
}

export function TeamNameSheet({ open, currentName, onClose, onSave }: TeamNameSheetProps) {
  const [name, setName] = useState(currentName)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName(currentName)
      // Defer focus a tick so the slide-in animation doesn't fight the keyboard.
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [open, currentName])

  const trimmed = name.trim()
  const canSave = trimmed.length > 0 && trimmed !== currentName.trim()

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)
    haptic('medium')
    try {
      await onSave(trimmed)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <m.div
          key="team-name-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 30,
            background: 'rgba(4,4,10,0.78)',
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'flex-end',
          }}
        >
          <m.div
            key="team-name-sheet"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 36 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              padding: '20px 18px calc(28px + env(safe-area-inset-bottom, 0px))',
              background: 'rgba(10,10,18,0.95)',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '20px 20px 0 0',
              display: 'flex', flexDirection: 'column', gap: 14,
              boxShadow: '0 -32px 80px rgba(0,0,0,0.5)',
            }}
          >
            <div className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: '0.12em', color: 'rgba(196,90,220,0.6)' }}>
              Team Name
            </div>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
              maxLength={80}
              placeholder="Production company"
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#dddde8',
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={onClose}
                disabled={saving}
                style={{
                  flex: 1, padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#dddde8', fontSize: 13,
                  cursor: saving ? 'default' : 'pointer',
                  opacity: saving ? 0.5 : 1,
                }}
              >Cancel</button>
              <button
                onClick={handleSave}
                disabled={!canSave || saving}
                style={{
                  flex: 1, padding: '12px 14px', borderRadius: 10,
                  background: canSave && !saving ? '#c45adc' : 'rgba(196,90,220,0.3)',
                  border: '1px solid rgba(196,90,220,0.6)',
                  color: 'white', fontSize: 13, fontWeight: 600,
                  cursor: canSave && !saving ? 'pointer' : 'default',
                  opacity: canSave && !saving ? 1 : 0.6,
                }}
              >{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
