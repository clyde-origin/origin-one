'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserAuthClient } from '@origin-one/auth'

export default function SetupPasswordPage() {
  const router = useRouter()
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    const supabase = createBrowserAuthClient()
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) { setErr(error.message); return }
    router.push('/projects')
  }

  return (
    <main style={{
      minHeight: '100svh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#04040a', color: '#dddde8', padding: '0 32px',
    }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 4 }}>Set a password</h1>
        <input
          type="password" required minLength={8} value={pw}
          onChange={e => setPw(e.target.value)} placeholder="new password (min 8)"
          autoComplete="new-password"
          style={{
            padding: '12px 14px', background: '#0a0a12',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 9, color: '#dddde8', fontSize: '0.82rem',
            outline: 'none',
          }}
        />
        <button type="submit" disabled={busy} style={{
          padding: '12px', background: '#6470f3', color: '#fff',
          border: 'none', borderRadius: 9, fontSize: '0.82rem', fontWeight: 600,
          opacity: busy ? 0.6 : 1, cursor: busy ? 'wait' : 'pointer',
        }}>
          Save password
        </button>
        {err && <div style={{ fontSize: 12, color: '#e8a020' }}>{err}</div>}
      </form>
    </main>
  )
}
