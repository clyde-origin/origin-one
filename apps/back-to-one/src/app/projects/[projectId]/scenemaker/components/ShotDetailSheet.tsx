import { haptic } from '@/lib/utils/haptics'
import type { Shot } from '@/types'

export function ShotDetailSheet({ shot, accent, onClose }: { shot: Shot | null; accent: string; onClose: () => void }) {
  if (!shot) return null
  return (
    <>
      <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '12px auto 18px' }} />
      <div style={{ padding: '0 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="font-mono" style={{ fontSize: '0.5rem', color: accent, letterSpacing: '0.08em', marginBottom: 5 }}>{shot.id}</div>
        <div style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#dddde8' }}>{shot.desc}</div>
      </div>
      <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div className="flex items-start gap-3">
          <span className="font-mono uppercase flex-shrink-0" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', width: 68, paddingTop: 2 }}>Type</span>
          <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#dddde8' }}>{shot.framing || '—'}</span>
        </div>
        <div className="flex items-start gap-3">
          <span className="font-mono uppercase flex-shrink-0" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', width: 68, paddingTop: 2 }}>Lens</span>
          <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#dddde8' }}>{shot.lens || '—'}</span>
        </div>
        <div className="flex items-start gap-3">
          <span className="font-mono uppercase flex-shrink-0" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', width: 68, paddingTop: 2 }}>Movement</span>
          <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#dddde8' }}>{shot.movement || '—'}</span>
        </div>
      </div>
      {/* Notes */}
      <div style={{ padding: '0 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Notes</span>
        <textarea defaultValue={shot.dirNotes} placeholder="Add a note..."
          className="outline-none" style={{ width: '100%', minHeight: 64, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7, padding: '10px 12px', fontSize: '0.74rem', color: '#dddde8', lineHeight: 1.5, resize: 'none', fontFamily: 'inherit' }}
          onFocus={e => { e.target.style.borderColor = `${accent}66` }}
          onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.05)' }} />
      </div>
      {/* Buttons */}
      <div style={{ padding: '14px 20px 0', display: 'flex', gap: 10 }}>
        <button className="flex-1 font-bold cursor-pointer transition-all"
          style={{ padding: 13, borderRadius: 8, fontSize: '0.78rem', background: `${accent}1f`, border: `1px solid ${accent}40`, color: accent }}
          onClick={() => { haptic('medium'); onClose() }}>Save</button>
        <button className="flex-1 font-bold cursor-pointer transition-all"
          style={{ padding: 13, borderRadius: 8, fontSize: '0.78rem', background: 'rgba(232,86,74,0.08)', border: '1px solid rgba(232,86,74,0.2)', color: '#e8564a' }}
          onClick={() => { haptic('warning'); onClose() }}>Delete shot</button>
      </div>
    </>
  )
}
