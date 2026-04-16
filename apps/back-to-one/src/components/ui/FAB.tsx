'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { haptic } from '@/lib/utils/haptics'
import { ThreadsIcon } from '@/components/ui/ThreadsIcon'

// ── Types ────────────────────────────────────────────────

export interface FABBranch {
  label: string
  color: string
  icon: ReactNode
  action: () => void
}

interface FABProps {
  /** Project accent color hex */
  accent: string
  /** Project ID for navigation */
  projectId: string
  /** Branch options — 0 = simple +, 1-3 = branching FAB */
  branches?: FABBranch[]
  /** Simple onClick when no branches (opens a sheet etc) */
  onPress?: () => void
  /** Hide back chevron (e.g. on selection screen) */
  hideBack?: boolean
  /** Hide chat FAB */
  hideChat?: boolean
  /** Hide threads FAB */
  hideThreads?: boolean
}

// ── Component ────────────────────────────────────────────

export function FAB({ accent, projectId, branches = [], onPress, hideBack, hideChat, hideThreads }: FABProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const hasBranches = branches.length > 0

  const toggle = () => {
    haptic('light')
    if (hasBranches) {
      setOpen(o => !o)
    } else {
      onPress?.()
    }
  }
  const close = () => setOpen(false)

  return (
    <>
      {/* Overlay */}
      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(4,4,10,0.75)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', zIndex: 20 }}
          onClick={close} />
      )}

      {/* FAB zone — anchored at bottom center */}
      <div style={{ position: 'fixed', bottom: 68, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, zIndex: 30 }}>

        {/* Branch lines SVG */}
        {open && branches.length > 0 && (
          <svg style={{ position: 'absolute', bottom: -4, left: branches.length === 3 ? -100 : -80, opacity: 1, pointerEvents: 'none', transition: 'opacity 0.2s' }}
            width={branches.length === 3 ? 200 : 160} height="90" viewBox={branches.length === 3 ? '0 0 200 90' : '0 0 160 90'}>
            {branches.length === 3 ? (
              <>
                <line x1="100" y1="86" x2="18" y2="28" stroke="rgba(196,90,220,0.22)" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="100" y1="86" x2="100" y2="8" stroke="rgba(196,90,220,0.22)" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="100" y1="86" x2="182" y2="28" stroke="rgba(196,90,220,0.22)" strokeWidth="1" strokeDasharray="3 3" />
                <circle cx="100" cy="86" r="2.5" fill="rgba(196,90,220,0.4)" />
              </>
            ) : branches.length === 2 ? (
              <>
                <line x1="80" y1="86" x2="37" y2="30" stroke="rgba(196,90,220,0.22)" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="80" y1="86" x2="123" y2="30" stroke="rgba(196,90,220,0.22)" strokeWidth="1" strokeDasharray="3 3" />
                <circle cx="80" cy="86" r="2.5" fill="rgba(196,90,220,0.4)" />
              </>
            ) : (
              <>
                <line x1="80" y1="86" x2="80" y2="10" stroke="rgba(196,90,220,0.22)" strokeWidth="1" strokeDasharray="3 3" />
                <circle cx="80" cy="86" r="2.5" fill="rgba(196,90,220,0.4)" />
              </>
            )}
          </svg>
        )}

        {/* Branch options */}
        {open && branches.map((b, i) => {
          const pos = branches.length === 3
            ? [{ left: -90, bottom: 22 }, { left: -22, bottom: 72 }, { left: 46, bottom: 22 }][i]
            : branches.length === 2
              ? [{ left: -64, bottom: 21 }, { left: 22, bottom: 21 }][i]
              : [{ left: -22, bottom: 68 }][i]
          return (
            <div key={b.label} className="flex flex-col items-center cursor-pointer"
              style={{
                position: 'absolute', bottom: pos.bottom, left: pos.left,
                gap: 5, opacity: 1, pointerEvents: 'all',
                transition: `opacity 0.22s ease 0.04s, transform 0.32s cubic-bezier(0.34,1.56,0.64,1) ${i === 1 && branches.length === 3 ? '0.05s' : '0.04s'}`,
              }}
              onClick={() => { close(); b.action() }}>
              <div className="flex items-center justify-center" style={{
                width: 48, height: 48, borderRadius: '50%',
                background: `${b.color}1a`, border: `1px solid ${b.color}4d`,
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              }}>
                {b.icon}
              </div>
              <span className="font-mono uppercase whitespace-nowrap" style={{ fontSize: '0.34rem', letterSpacing: '0.06em', color: b.color }}>
                {b.label}
              </span>
            </div>
          )
        })}

        {/* Back chevron — glassmorphism, closer to FAB */}
        {!hideBack && (
          <div className="flex items-center justify-center cursor-pointer"
            style={{
              position: 'absolute', top: -18, left: -76,
              width: 36, height: 36, borderRadius: '50%',
              background: `${accent}18`, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              border: `1px solid ${accent}33`,
              boxShadow: `0 2px 12px ${accent}20, inset 0 1px 0 rgba(255,255,255,0.08)`,
              transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s',
              ...(open ? { transform: 'translateX(-300px)', opacity: 0, pointerEvents: 'none' as const } : {}),
            }}
            onClick={() => router.back()}>
            <svg width="8" height="12" viewBox="0 0 6 10" fill="none"><path d="M5 1L1 5L5 9" stroke="rgba(255,255,255,0.5)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        )}

        {/* Chat FAB — slides left on open */}
        {!hideChat && (
          <div className="flex items-center justify-center cursor-pointer"
            style={{
              position: 'absolute', top: -20, left: -20,
              width: 40, height: 40, borderRadius: '50%',
              background: `${accent}14`, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              border: `1px solid ${accent}33`,
              opacity: open ? 1 : 0, pointerEvents: open ? 'all' : 'none',
              transform: open ? 'translateX(-110px)' : 'translateX(0)',
              transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.28s',
            }}
            onClick={() => router.push(`/projects/${projectId}/chat`)}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 2h9a1 1 0 011 1v5a1 1 0 01-1 1H5l-3 2.5V3a1 1 0 011-1z" stroke="rgba(255,255,255,0.7)" strokeWidth="1.1" strokeLinejoin="round" /></svg>
          </div>
        )}

        {/* Main FAB — matches hub: 52×52 */}
        <div className="flex items-center justify-center cursor-pointer"
          style={{
            position: 'absolute', top: -26, left: -26,
            width: 52, height: 52, borderRadius: '50%',
            background: `${accent}26`, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            border: `1.5px solid ${accent}73`,
            boxShadow: `0 4px 24px ${accent}40, 0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)`,
            zIndex: 31,
            transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
            transition: 'transform 0.28s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s',
          }}
          onClick={toggle}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2V14M2 8H14" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" /></svg>
        </div>

        {/* Docs pill — below FAB */}
        <div className="flex items-center cursor-pointer"
          style={{
            position: 'absolute', top: 34, left: '50%',
            transform: open ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(8px)',
            background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20,
            padding: '5px 14px', gap: 5, whiteSpace: 'nowrap', zIndex: 32,
            opacity: open ? 1 : 0, pointerEvents: open ? 'all' : 'none',
            transition: 'opacity 0.2s ease 0.08s, transform 0.28s cubic-bezier(0.34,1.56,0.64,1) 0.08s',
          }}
          onClick={() => router.push(`/projects/${projectId}/resources`)}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x="2" y="1" width="6" height="8" rx="1" stroke="rgba(255,255,255,0.35)" strokeWidth="1" /><path d="M4 4h2M4 6h2" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" strokeLinecap="round" /></svg>
          <span className="font-mono uppercase" style={{ fontSize: '0.38rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.06em' }}>Docs</span>
        </div>

        {/* Threads FAB — slides right on open */}
        {!hideThreads && (
          <div className="flex items-center justify-center cursor-pointer relative"
            style={{
              position: 'absolute', top: -20, left: -20,
              width: 40, height: 40, borderRadius: '50%',
              background: `${accent}14`, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              border: `1px solid ${accent}33`,
              opacity: open ? 1 : 0, pointerEvents: open ? 'all' : 'none',
              transform: open ? 'translateX(110px)' : 'translateX(0)',
              transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.28s',
            }}
            onClick={() => router.push(`/projects/${projectId}/threads`)}>
            <ThreadsIcon size={13} color="rgba(255,255,255,0.7)" />
          </div>
        )}
      </div>
    </>
  )
}
