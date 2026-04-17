'use client'

import { haptic } from '@/lib/utils/haptics'

interface DestructiveSheetProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function DestructiveSheet({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: DestructiveSheetProps) {
  if (!open) return null
  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onCancel}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-surface border border-white/10 rounded-t-2xl p-5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 20px)' }}
      >
        <div className="w-9 h-1 bg-white/10 rounded-full mx-auto mb-5" />
        <p className="text-sm font-bold text-text mb-1">{title}</p>
        {description && (
          <p className="text-xs text-text2 mb-5">{description}</p>
        )}
        <button
          className="w-full py-3.5 rounded-xl font-bold text-sm text-white mb-2 active:opacity-80"
          style={{ background: 'rgba(239,68,68,0.9)' }}
          onClick={() => { haptic('warning'); onConfirm() }}
        >
          {confirmLabel}
        </button>
        <button
          className="w-full py-3.5 rounded-xl bg-surface2 text-text2 font-semibold text-sm active:opacity-80"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </>
  )
}
