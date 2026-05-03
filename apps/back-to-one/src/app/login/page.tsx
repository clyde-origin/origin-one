'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { haptic } from '@/lib/utils/haptics'
import { createBrowserAuthClient } from '@origin-one/auth'

// Same-origin path validator. Mirrors lib/auth/server-authz.ts so the
// client-side login page rejects ?redirect=https://attacker.com without
// pulling the server module into the client bundle.
function safeRedirectPath(path: string | null | undefined, fallback = '/projects'): string {
  if (typeof path !== 'string' || path.length === 0) return fallback
  if (!path.startsWith('/')) return fallback
  if (path.startsWith('//')) return fallback
  if (path.includes('\\')) return fallback
  return path
}

type RoleHint = 'producer' | 'crew' | 'partner'

const ROLE_OPTIONS: { value: RoleHint; label: string }[] = [
  { value: 'producer', label: 'Producer' },
  { value: 'crew',     label: 'Crew' },
  { value: 'partner',  label: 'Partner' },
]

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const redirect = safeRedirectPath(params.get('redirect'), '/projects')

  // Role hint is purely visual — actual permissions come from RLS / session.
  const [roleHint, setRoleHint] = useState<RoleHint>('producer')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'err' | 'info'; text: string } | null>(null)

  const isPartnerSelected = roleHint === 'partner'
  const canSubmit = !!email && !!password && !isPartnerSelected

  const supabase = createBrowserAuthClient()

  function selectRole(next: RoleHint) {
    haptic('light')
    setRoleHint(next)
  }

  async function signInPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMsg({ kind: 'err', text: error.message })
      setBusy(false)
      return
    }
    haptic('medium')
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
    <div className="relative w-full min-h-dvh overflow-hidden">
      <div className="login-stage-bg" />

      <form onSubmit={signInPassword} className="login-stage-inner">
        <div className="login-brand-block">
          <h1 className="login-brand-title">Back to One</h1>
          <div className="login-brand-rule" />
        </div>

        <div className="login-form-block">
          <div className="login-form-eyebrow">Origin One</div>

          <div className="login-form-section">
            <div className="login-form-label">Sign in as</div>
            <div className="login-role-row">
              {ROLE_OPTIONS.map(opt => {
                const selected = roleHint === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => selectRole(opt.value)}
                    aria-pressed={selected}
                    data-role={opt.value}
                    className={`login-role-btn${selected ? ' active' : ''}`}
                  >
                    {opt.label}
                    {opt.value === 'partner' && (
                      <span className="login-role-btn-soon">Soon</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="login-form-section">
            <div className="login-form-label">Email</div>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              autoComplete="email" required
              placeholder="you@example.com"
              className="login-name-input"
            />
          </div>

          <div className="login-form-section">
            <div className="login-form-label">Password</div>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              className="login-name-input"
            />
          </div>

          <button
            type="submit"
            disabled={busy || !canSubmit}
            className="login-enter-btn"
          >
            {busy ? 'Signing in…' : 'Sign In'}
          </button>

          <div className="login-stage-link-row">
            <button
              type="button"
              onClick={sendMagicLink}
              disabled={busy}
              className="login-stage-link accent"
            >
              Email me a link
            </button>
            <button
              type="button"
              onClick={resetPassword}
              disabled={busy}
              className="login-stage-link"
            >
              Forgot password?
            </button>
          </div>

          {isPartnerSelected && (
            <p className="login-stage-note">Partner access not yet available</p>
          )}

          {msg && (
            <p className={`login-stage-msg ${msg.kind}`}>{msg.text}</p>
          )}
        </div>

        <div className="login-stage-footer">Origin One &middot; Back to One</div>
      </form>
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
