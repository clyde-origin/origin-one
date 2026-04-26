'use client'

import { useEffect } from 'react'

// First Toast component in the codebase. Built minimal so the shotlist's two
// notification cases (persist-failure + cross-scene drag confirmation) share
// one surface. If a second consumer surfaces, this can grow into a provider/
// queue model — keep that out of scope until then.

export type ToastKind = 'info' | 'error' | 'confirm'

export type ToastAction = {
  label: string
  variant: 'ghost' | 'accent' | 'danger'
  onPress: () => void
}

export type ToastSpec = {
  message: string
  kind: ToastKind
  actions?: ToastAction[]
  // If set, the toast auto-dismisses after `autoMs` ms. For confirm-kind
  // toasts with a primary action, also pass `onAutoTimeout` to fire that
  // primary action when the timer elapses (e.g. "auto-commit after 4 s").
  autoMs?: number
  onAutoTimeout?: () => void
  onDismiss: () => void
}

export function Toast({ message, kind, actions, autoMs, onAutoTimeout, onDismiss }: ToastSpec) {
  useEffect(() => {
    if (!autoMs) return
    const t = setTimeout(() => {
      onAutoTimeout?.()
      onDismiss()
    }, autoMs)
    return () => clearTimeout(t)
  }, [autoMs, onAutoTimeout, onDismiss])

  const accent = kind === 'error' ? '#e8564a' : '#dddde8'
  const borderColor =
    kind === 'error' ? 'rgba(232,86,74,0.35)' :
    kind === 'confirm' ? 'rgba(255,255,255,0.18)' :
    'rgba(255,255,255,0.12)'

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
        zIndex: 9999,
        pointerEvents: 'none',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          maxWidth: 480,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'rgba(10,10,18,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `1px solid ${borderColor}`,
          borderRadius: 14,
          padding: '10px 12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: '0.62rem',
            fontWeight: 500,
            color: accent,
            lineHeight: 1.4,
          }}
        >
          {message}
        </span>
        {actions?.map((a, i) => (
          <ToastButton key={i} action={a} />
        ))}
      </div>
    </div>
  )
}

function ToastButton({ action }: { action: ToastAction }) {
  const styles = (() => {
    switch (action.variant) {
      case 'accent':
        return { background: 'rgba(196,90,220,0.22)', border: '1px solid rgba(196,90,220,0.45)', color: '#dccaf2' }
      case 'danger':
        return { background: 'rgba(232,86,74,0.18)', border: '1px solid rgba(232,86,74,0.4)', color: '#f0a8a0' }
      case 'ghost':
      default:
        return { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#a0a0b8' }
    }
  })()
  return (
    <button
      type="button"
      className="font-mono uppercase cursor-pointer"
      onClick={action.onPress}
      style={{
        flexShrink: 0,
        fontSize: '0.42rem',
        letterSpacing: '0.06em',
        padding: '5px 12px',
        borderRadius: 10,
        ...styles,
      }}
    >
      {action.label}
    </button>
  )
}
