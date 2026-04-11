'use client'

// ── Ghost primitives for empty states ─────────────────────

export function GhostCircle({ size }: { size: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      border: '1px dashed rgba(255,255,255,0.07)',
      background: 'rgba(255,255,255,0.02)',
    }} />
  )
}

export function GhostRect({ w, h }: { w: number | string; h: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 4, flexShrink: 0,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.04)',
    }} />
  )
}

export function GhostPill({ w, h }: { w: number; h: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 20, flexShrink: 0,
      background: 'rgba(255,255,255,0.02)',
      border: '1px dashed rgba(255,255,255,0.07)',
    }} />
  )
}

export function GhostBlock({ w, h, style }: { w?: number | string; h?: number | string; style?: React.CSSProperties }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 9, flexShrink: 0,
      background: 'rgba(255,255,255,0.02)',
      border: '1px dashed rgba(255,255,255,0.07)',
      ...style,
    }} />
  )
}

export function GhostRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '12px 20px', gap: 14,
      position: 'relative',
    }}>
      {children}
      <div style={{
        position: 'absolute', bottom: 0, left: 20, right: 20,
        height: 1, background: 'rgba(255,255,255,0.03)',
      }} />
    </div>
  )
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '16px 20px 8px',
      fontFamily: "'DM Mono', monospace",
      fontSize: 10, color: 'rgba(98,98,122,0.4)',
      textTransform: 'uppercase', letterSpacing: '0.1em',
    }}>
      {children}
    </div>
  )
}

export function EmptyCTA({ icon, headline, sub, addLabel, onAdd }: {
  icon: string
  headline: string
  sub: string
  addLabel?: string
  onAdd?: () => void
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 10, padding: '40px 32px', textAlign: 'center',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: '50%',
        border: '1.5px dashed rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22,
      }}>
        {icon}
      </div>
      <div style={{
        fontFamily: "'Manrope', sans-serif", fontWeight: 700,
        fontSize: 15, color: 'rgba(221,221,232,0.35)',
      }}>
        {headline}
      </div>
      <div style={{
        fontFamily: "'DM Mono', monospace", fontSize: 11,
        color: 'rgba(98,98,122,0.5)', lineHeight: 1.6, marginTop: -4,
      }}>
        {sub}
      </div>
      {addLabel && (
        <button onClick={onAdd} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 18px', borderRadius: 20, marginTop: 4,
          border: '1px dashed rgba(196,90,220,0.2)',
          background: 'rgba(196,90,220,0.05)',
          fontFamily: "'DM Mono', monospace", fontSize: 11,
          color: 'rgba(196,90,220,0.4)', cursor: 'pointer',
        }}>
          {addLabel}
        </button>
      )}
    </div>
  )
}
