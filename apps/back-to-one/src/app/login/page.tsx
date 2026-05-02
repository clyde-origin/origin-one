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

const ROLE_OPTIONS: { value: RoleHint; label: string; accent: string; on: string }[] = [
  { value: 'producer', label: 'Producer', accent: '#6470f3', on: '#ffffff' },
  { value: 'crew',     label: 'Crew',     accent: '#e8a020', on: '#04040a' },
  { value: 'partner',  label: 'Partner',  accent: '#00b894', on: '#04040a' },
]

const TOOLTIP_BG = '#10101a'
const TOOLTIP_BORDER = 'rgba(255,255,255,0.08)'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const redirect = safeRedirectPath(params.get('redirect'), '/projects')

  // Role hint is purely visual — actual permissions come from RLS / session.
  const [roleHint, setRoleHint] = useState<RoleHint | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'err' | 'info'; text: string } | null>(null)

  const isPartnerSelected = roleHint === 'partner'
  const canSubmit = !!email && !!password && !isPartnerSelected

  const supabase = createBrowserAuthClient()

  function selectRole(next: RoleHint) {
    haptic('light')
    if (next === 'partner' && roleHint === 'partner') setRoleHint(null)
    else setRoleHint(next)
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
    <div className="relative w-full h-dvh overflow-hidden flex flex-col">
      {/* Background image */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-top"
        style={{ backgroundImage: "url('/images/b21_bg.jpg')" }}
      />

      {/* Gradient overlay */}
      <div
        className="absolute inset-0 z-10"
        style={{
          background:
            'linear-gradient(180deg, rgba(4,4,10,0.35) 0%, rgba(4,4,10,0.1) 30%, rgba(4,4,10,0.2) 55%, rgba(4,4,10,0.82) 75%, rgba(4,4,10,0.97) 100%)',
        }}
      />

      {/* Spacer */}
      <div className="flex-1 z-20 relative" />

      {/* Form */}
      <form
        onSubmit={signInPassword}
        className="relative z-20 px-8 pb-14 flex-shrink-0"
      >
        <p className="font-mono text-[0.44rem] tracking-[0.28em] uppercase text-white/30 mb-7">
          Origin One
        </p>

        {/* Role row (visual hint only) */}
        <label className="block font-mono text-[0.42rem] tracking-[0.18em] uppercase text-white/35 mb-2">
          Sign in as
        </label>
        <div className="flex gap-2 mb-5">
          {ROLE_OPTIONS.map(opt => {
            const selected = roleHint === opt.value
            const showTooltip = opt.value === 'partner' && selected
            return (
              <div key={opt.value} className="flex-1 relative">
                {showTooltip && (
                  <div
                    role="tooltip"
                    className="absolute left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap"
                    style={{
                      bottom: 'calc(100% + 8px)',
                      background: TOOLTIP_BG,
                      color: '#dddde8',
                      fontSize: 11,
                      lineHeight: 1,
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: `1px solid ${TOOLTIP_BORDER}`,
                      boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
                    }}
                  >
                    Coming soon
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'absolute', left: '50%', bottom: -4, marginLeft: -4,
                        width: 8, height: 8, background: TOOLTIP_BG,
                        borderRight: `1px solid ${TOOLTIP_BORDER}`,
                        borderBottom: `1px solid ${TOOLTIP_BORDER}`,
                        transform: 'rotate(45deg)',
                      }}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => selectRole(opt.value)}
                  aria-pressed={selected}
                  className="w-full py-2.5 rounded-xl text-[0.78rem] font-semibold transition-colors active:scale-[0.98]"
                  style={
                    selected
                      ? { background: opt.accent, color: opt.on, border: `1px solid ${opt.accent}` }
                      : { background: 'rgba(4,4,10,0.35)', color: '#a0a0b8', border: '1px solid rgba(255,255,255,0.10)' }
                  }
                >
                  {opt.label}
                </button>
              </div>
            )
          })}
        </div>

        {/* Email */}
        <label className="block font-mono text-[0.42rem] tracking-[0.18em] uppercase text-white/35 mb-2">
          Email
        </label>
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          autoComplete="email" required
          placeholder="you@example.com"
          className="w-full rounded-xl px-4 py-3 text-[0.92rem] font-medium text-text placeholder:text-white/20 outline-none transition-colors border border-white/10 focus:border-white/25 mb-3"
          style={{
            background: 'rgba(4,4,10,0.55)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        />

        {/* Password */}
        <label className="block font-mono text-[0.42rem] tracking-[0.18em] uppercase text-white/35 mb-2">
          Password
        </label>
        <input
          type="password" value={password} onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
          className="w-full rounded-xl px-4 py-3 text-[0.92rem] font-medium text-text placeholder:text-white/20 outline-none transition-colors border border-white/10 focus:border-white/25 mb-3"
          style={{
            background: 'rgba(4,4,10,0.55)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        />

        {/* Sign In button */}
        <button
          type="submit"
          disabled={busy || !canSubmit}
          className="w-full py-3.5 rounded-xl font-bold text-[0.88rem] text-[#04040a] transition-opacity active:scale-[0.98] disabled:opacity-25"
          style={{ background: 'rgba(255,255,255,0.92)' }}
        >
          {busy ? 'Signing in…' : 'Sign In'}
        </button>

        {/* Magic link / Forgot password */}
        <div className="flex items-center justify-between mt-3">
          <button
            type="button"
            onClick={sendMagicLink}
            disabled={busy}
            className="font-mono text-[0.50rem] tracking-[0.10em] uppercase"
            style={{ color: 'rgba(155,107,242,0.85)' }}
          >
            Email me a link
          </button>
          <button
            type="button"
            onClick={resetPassword}
            disabled={busy}
            className="font-mono text-[0.50rem] tracking-[0.10em] uppercase"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            Forgot password?
          </button>
        </div>

        {isPartnerSelected && (
          <p className="font-mono text-[0.42rem] tracking-[0.14em] uppercase text-center mt-3" style={{ color: '#62627a' }}>
            Partner access not yet available
          </p>
        )}

        {msg && (
          <p
            className="font-mono text-[0.50rem] tracking-[0.06em] text-center mt-3"
            style={{ color: msg.kind === 'err' ? '#e8a020' : '#00b894' }}
          >
            {msg.text}
          </p>
        )}

        <p className="font-mono text-[0.38rem] tracking-[0.2em] uppercase text-white/[0.14] text-center mt-5">
          Origin One &middot; Back to One
        </p>
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
