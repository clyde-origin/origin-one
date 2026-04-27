'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, type PanInfo } from 'framer-motion'
import { TopsheetContent, type TopsheetContentProps } from './TopsheetContent'
import { haptic } from '@/lib/utils/haptics'

// Mobile bottom-pull-up drawer (drag-to-dismiss). Desktop right side panel
// at ≥1024px (no backdrop, slides in from right). Same TopsheetContent
// renders inside both — single visual contract whether printed (PR 13)
// or read on screen.

const DESKTOP_BREAKPOINT = 1024
const DISMISS_THRESHOLD = 100      // px drag-down before snap-close
const VELOCITY_THRESHOLD = 400     // px/s velocity that snap-closes
const DESKTOP_PANEL_WIDTH = 480

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`)
    const update = () => setIsDesktop(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])
  return isDesktop
}

interface TopsheetDrawerProps {
  open: boolean
  onClose: () => void
  accent: string
  content: TopsheetContentProps
}

export function TopsheetDrawer({ open, onClose, accent, content }: TopsheetDrawerProps) {
  const isDesktop = useIsDesktop()
  return isDesktop
    ? <TopsheetDesktopPanel open={open} onClose={onClose} accent={accent} content={content} />
    : <TopsheetMobileDrawer open={open} onClose={onClose} accent={accent} content={content} />
}

// ── Mobile bottom drawer ─────────────────────────────────────────────────

function TopsheetMobileDrawer({ open, onClose, accent, content }: TopsheetDrawerProps) {
  const dragY = useMotionValue(0)
  const overlayOpacity = useTransform(dragY, [0, 400], [1, 0])

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.offset.y > DISMISS_THRESHOLD || info.velocity.y > VELOCITY_THRESHOLD) {
        haptic('light')
        onClose()
      }
    },
    [onClose],
  )

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="topsheet-backdrop"
            className="fixed inset-0"
            style={{
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              opacity: overlayOpacity,
              zIndex: 40,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer */}
          <motion.div
            key="topsheet-drawer"
            className="fixed left-0 right-0 bottom-0"
            style={{
              maxHeight: '92vh',
              background: '#f4f1ea',
              borderTopLeftRadius: 20, borderTopRightRadius: 20,
              boxShadow: '0 -4px 30px rgba(0,0,0,0.6)',
              y: dragY,
              zIndex: 41,
              display: 'flex', flexDirection: 'column',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            role="dialog"
            aria-label="Topsheet"
            aria-modal="true"
          >
            {/* Grabber */}
            <div className="flex justify-center" style={{ paddingTop: 10, paddingBottom: 4 }}>
              <div
                style={{
                  width: 40, height: 4, borderRadius: 999,
                  background: 'rgba(26,26,38,0.18)',
                }}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <TopsheetContent {...content} />
            </div>
            <ExportRow accent={accent} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Desktop side panel ───────────────────────────────────────────────────

function TopsheetDesktopPanel({ open, onClose, accent, content }: TopsheetDrawerProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="topsheet-side-panel"
          className="fixed top-0 bottom-0 right-0"
          style={{
            width: DESKTOP_PANEL_WIDTH,
            background: '#f4f1ea',
            borderLeft: '1px solid rgba(26,26,38,0.15)',
            boxShadow: '-4px 0 30px rgba(0,0,0,0.4)',
            zIndex: 41,
            display: 'flex', flexDirection: 'column',
          }}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 280, mass: 0.7 }}
          role="dialog"
          aria-label="Topsheet"
        >
          {/* Close X */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close topsheet"
            style={{
              position: 'absolute', top: 12, right: 12,
              width: 32, height: 32, borderRadius: 999,
              background: 'rgba(26,26,38,0.06)', border: '1px solid rgba(26,26,38,0.10)',
              color: '#1a1a26', fontSize: 16, cursor: 'pointer', zIndex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <TopsheetContent {...content} />
          </div>
          <ExportRow accent={accent} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Export buttons row ───────────────────────────────────────────────────
//
// PR 10 renders these as DISABLED ("Coming in PR 13"). Visual contract
// is set; PR 13 wires the actual /api/budget/.../export endpoints + the
// download click handlers.

function ExportRow({ accent }: { accent: string }) {
  const buttons = [
    { label: 'PDF · TOPSHEET', primary: true },
    { label: 'PDF · DETAIL',   primary: false },
    { label: 'CSV',            primary: false },
  ]
  return (
    <div
      className="flex"
      style={{
        gap: 6, padding: '12px 16px calc(env(safe-area-inset-bottom, 0px) + 14px)',
        background: '#0a0a12',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {buttons.map(b => (
        <button
          key={b.label}
          type="button"
          disabled
          title="Coming in PR 13"
          className="font-mono uppercase"
          style={{
            flex: 1,
            padding: '9px 0', borderRadius: 8,
            background: b.primary ? `${accent}24` : 'rgba(255,255,255,0.03)',
            border: b.primary ? `1px solid ${accent}66` : '1px solid rgba(255,255,255,0.08)',
            color: b.primary ? accent : 'rgba(255,255,255,0.55)',
            fontSize: 10, letterSpacing: '0.08em',
            cursor: 'not-allowed',
            opacity: 0.6,
            textAlign: 'center',
          }}
        >{b.label}</button>
      ))}
    </div>
  )
}
