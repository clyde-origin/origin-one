'use client'

import { useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, type PanInfo } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { haptic } from '@/lib/utils/haptics'

interface SheetProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  maxHeight?: string
  className?: string
}

const DISMISS_THRESHOLD = 80    // px drag before snap-close
const VELOCITY_THRESHOLD = 400  // px/s velocity snap-close

const springTransition = {
  type: 'spring' as const,
  damping: 30,
  stiffness: 300,
  mass: 0.8,
}

export function Sheet({
  open,
  onClose,
  children,
  maxHeight = '85vh',
  className,
}: SheetProps) {
  // Haptic on open/close
  const prevOpen = useRef(open)
  useEffect(() => {
    if (open !== prevOpen.current) {
      haptic('light')
      prevOpen.current = open
    }
  }, [open])

  // Close on back button / history pop
  useEffect(() => {
    if (!open) return
    const handler = () => onClose()
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [open, onClose])

  // ── Drag-to-dismiss ──
  const dragY = useMotionValue(0)
  // Dim overlay as user drags down
  const overlayOpacity = useTransform(dragY, [0, 400], [1, 0])

  const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > DISMISS_THRESHOLD || info.velocity.y > VELOCITY_THRESHOLD) {
      haptic('light')
      onClose()
    }
  }, [onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            key="sheet-overlay"
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', opacity: overlayOpacity }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sheet */}
          <motion.div
            key="sheet-panel"
            className={cn(
              'fixed bottom-0 left-0 right-0',
              'bg-surface border-t border-border2',
              'rounded-t-[20px]',
              className
            )}
            style={{
              maxHeight,
              paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
              zIndex: 51,
              overflowY: 'auto',
              touchAction: 'pan-x',
              boxShadow: '0 -4px 30px rgba(0,0,0,0.6)',
              y: dragY,
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={springTransition}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            role="dialog"
            aria-modal="true"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-0">
              <div className="w-9 h-1 rounded-full bg-white/10" />
            </div>

            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Sheet sub-components for consistent structure
export function SheetHeader({
  title,
  onClose,
  action,
}: {
  title: string
  onClose: () => void
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center px-4 pt-3 pb-0 gap-3">
      <span className="font-semibold text-[0.9rem] text-text flex-1">{title}</span>
      {action}
      <button
        onClick={onClose}
        className="text-muted text-sm w-11 h-11 flex items-center justify-center"
        aria-label="Close"
      >
        ✕
      </button>
    </div>
  )
}

export function SheetBody({ children, className }: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('px-4 pt-4 pb-2 overflow-y-auto', className)}>
      {children}
    </div>
  )
}
