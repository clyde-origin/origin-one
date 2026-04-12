'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils/cn'
import { haptic } from '@/lib/utils/haptics'

interface SheetProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  maxHeight?: string
  className?: string
}

export function Sheet({
  open,
  onClose,
  children,
  maxHeight = '50vh',
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

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          'fixed inset-0 z-50 transition-opacity duration-300',
          'bg-black/60 backdrop-blur-sm',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-51',
          'bg-surface border border-border2',
          'rounded-t-[20px]',
          'transition-transform duration-300',
          'ease-[cubic-bezier(0.32,0.72,0,1)]',
          open ? 'translate-y-0' : 'translate-y-full',
          className
        )}
        style={{
          maxHeight,
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
          zIndex: 51,
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-0">
          <div className="w-9 h-1 rounded-full bg-white/10" />
        </div>

        {children}
      </div>
    </>
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
