import { haptic } from '@/lib/utils/haptics'

export function ThreadPopup({ x, y, onStart, onClose }: { x: number; y: number; onStart: () => void; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-[199]" onClick={onClose} />
      <div className="fixed z-[200]" style={{ left: Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 390) - 180), top: Math.max(y - 50, 10), background: '#1a1228', border: '1px solid rgba(196,90,220,0.25)', borderRadius: 10, padding: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', minWidth: 160 }}>
        <button className="flex items-center w-full cursor-pointer transition-colors rounded-[7px]"
          style={{ gap: 8, padding: '10px 12px', fontSize: '0.76rem', fontWeight: 600, color: '#dddde8' }}
          onClick={() => { haptic('light'); onStart(); onClose() }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ opacity: 0.7 }}>
            <path d="M2 3.5a1.5 1.5 0 011.5-1.5h7A1.5 1.5 0 0112 3.5v5a1.5 1.5 0 01-1.5 1.5H5.5L2 12.5V3.5z" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Start a thread
        </button>
      </div>
    </>
  )
}
