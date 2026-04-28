'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserAuthClient } from '@origin-one/auth'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const redirect = params.get('redirect') ?? '/projects'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'err' | 'info'; text: string } | null>(null)

  const supabase = createBrowserAuthClient()

  async function signInPassword(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMsg({ kind: 'err', text: error.message })
      setBusy(false)
      return
    }
    router.push(redirect)
  }

  async function sendMagicLink() {
    if (!email) { setMsg({ kind: 'err', text: 'Enter your email first' }); return }
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}` },
    })
    setBusy(false)
    if (error) { setMsg({ kind: 'err', text: error.message }); return }
    setMsg({ kind: 'info', text: 'Check your email — a sign-in link is on the way.' })
  }

  async function resetPassword() {
    if (!email) { setMsg({ kind: 'err', text: 'Enter your email first' }); return }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/setup-password`,
    })
    setMsg({ kind: error ? 'err' : 'info', text: error ? error.message : 'Password reset email sent.' })
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-8"
      style={{
        background: '#04040a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100svh',
        padding: '0 32px',
      }}
    >
      {/* Wordmark */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{
          fontFamily: 'var(--font-geist-sans)',
          fontSize: '1.65rem',
          fontWeight: 800,
          color: '#6470f3',
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          marginBottom: 5,
        }}>
          Origin One
        </div>
        <div style={{
          fontFamily: 'var(--font-geist-mono)',
          fontSize: '0.5rem',
          fontWeight: 300,
          color: '#8080a0',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}>
          By Origin Point
        </div>
      </div>

      {/* Form */}
      <form onSubmit={signInPassword} style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '0.48rem', fontWeight: 300, color: '#42425a', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            Email
          </label>
          <input
            type="email" required value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            style={{
              width: '100%', background: '#0a0a12',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 9, padding: '12px 14px',
              color: '#dddde8', fontSize: '0.82rem',
              outline: 'none', WebkitAppearance: 'none',
              fontFamily: 'var(--font-geist-sans)',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '0.48rem', fontWeight: 300, color: '#42425a', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            Password
          </label>
          <input
            type="password" value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            style={{
              width: '100%', background: '#0a0a12',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 9, padding: '12px 14px',
              color: '#dddde8', fontSize: '0.82rem',
              outline: 'none', WebkitAppearance: 'none',
              fontFamily: 'var(--font-geist-sans)',
            }}
          />
        </div>

        <button type="submit" disabled={busy} style={{
          width: '100%', marginTop: 4, padding: '14px',
          background: '#6470f3', border: 'none', borderRadius: 9,
          color: 'white', fontSize: '0.88rem', fontWeight: 700,
          fontFamily: 'var(--font-geist-sans)',
          cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
        }}>
          Sign In
        </button>

        <button type="button" onClick={sendMagicLink} disabled={busy} style={{
          width: '100%', padding: '12px',
          background: 'transparent', border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 9, color: '#9b6bf2', fontSize: '0.78rem', fontWeight: 500,
          fontFamily: 'var(--font-geist-sans)',
          cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
        }}>
          Email me a sign-in link
        </button>

        <button type="button" onClick={resetPassword} disabled={busy} style={{
          width: '100%', padding: '6px',
          background: 'transparent', border: 'none',
          color: '#62627a', fontSize: '0.7rem',
          fontFamily: 'var(--font-geist-sans)',
          cursor: busy ? 'wait' : 'pointer',
        }}>
          Forgot password?
        </button>

        {msg && (
          <div style={{
            fontSize: '0.72rem', textAlign: 'center', marginTop: 4,
            color: msg.kind === 'err' ? '#e8a020' : '#00b894',
          }}>
            {msg.text}
          </div>
        )}
      </form>

      {/* Footer */}
      <div style={{
        marginTop: 28,
        fontFamily: 'var(--font-geist-mono)',
        fontSize: '0.44rem',
        fontWeight: 300,
        color: 'rgba(66,66,90,0.5)',
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
      }}>
        Invited access only
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100svh', background: '#04040a' }} />}>
      <LoginForm />
    </Suspense>
  )
}
