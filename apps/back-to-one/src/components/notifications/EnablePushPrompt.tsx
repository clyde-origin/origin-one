'use client'

import { useEffect, useState } from 'react'
import { isPushSupported, hasNotificationPermission, getCurrentSubscription, subscribeToPush } from '@/lib/push/client'

const DISMISS_KEY = 'bt1.push.prompt.dismissed'

export function EnablePushPrompt() {
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!isPushSupported()) return
      if (hasNotificationPermission()) {
        const sub = await getCurrentSubscription()
        if (sub) return
      }
      if (typeof localStorage !== 'undefined' && localStorage.getItem(DISMISS_KEY)) return
      if (!cancelled) setVisible(true)
    })()
    return () => { cancelled = true }
  }, [])

  if (!visible) return null

  const enable = async () => {
    setBusy(true)
    setError(null)
    try {
      await subscribeToPush()
      setVisible(false)
    } catch (err: any) {
      setError(err?.message ?? 'Could not enable notifications')
    } finally {
      setBusy(false)
    }
  }

  const dismiss = () => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  return (
    <div style={{
      margin: '8px 16px 12px',
      padding: '12px 14px',
      borderRadius: 12,
      background: 'rgba(100,112,243,0.08)',
      border: '1px solid rgba(100,112,243,0.22)',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ fontSize: 13, color: '#fff', fontWeight: 500, lineHeight: 1.4 }}>
        Get notified when you're not in the app?
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
        On iOS, add Back to One to your Home Screen first — system notifications only work for installed PWAs.
      </div>
      {error && (
        <div style={{ fontSize: 11, color: '#f87171' }}>{error}</div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          onClick={enable}
          disabled={busy}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 8,
            background: '#6470f3', color: '#fff', border: 'none',
            fontSize: 12, fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? 'Enabling…' : 'Enable'}
        </button>
        <button
          onClick={dismiss}
          disabled={busy}
          style={{
            padding: '8px 12px', borderRadius: 8,
            background: 'transparent', color: 'rgba(255,255,255,0.55)',
            border: '1px solid rgba(255,255,255,0.12)',
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
          }}
        >
          Not now
        </button>
      </div>
    </div>
  )
}
