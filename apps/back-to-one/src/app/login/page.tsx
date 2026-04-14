// ── LOGIN SCREEN ──────────────────────────────────────────
// "Origin One / By Origin Point" wordmark in accent color
// Auth wired after all screens are stable.

export default function LoginPage() {
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
      <div style={{ textAlign: 'center', marginBottom: 44 }}>
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
      <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '0.48rem', fontWeight: 300, color: '#42425a', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            Email
          </label>
          <input
            type="email"
            autoComplete="email"
            placeholder="you@originpoint.co"
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
            type="password"
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

        <button
          style={{
            width: '100%', marginTop: 4,
            padding: '14px', background: '#6470f3',
            border: 'none', borderRadius: 9,
            color: 'white', fontSize: '0.88rem',
            fontWeight: 700, cursor: 'pointer',
            fontFamily: 'var(--font-geist-sans)',
          }}
        >
          Sign In
        </button>
      </div>

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
