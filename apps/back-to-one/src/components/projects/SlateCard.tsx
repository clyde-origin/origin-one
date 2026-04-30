'use client'

import { useCrew } from '@/lib/hooks/useOriginOne'
import { useLongPress } from '@/lib/hooks/useLongPress'
import { CrewAvatar } from '@/components/ui'
import { statusHex, STATUS_LABELS_SHORT } from '@/lib/utils/phase'
import type { Project } from '@/types'

export function hexToRgba(hex: string | null | undefined, a: number) {
  const h = hex || '#444444'
  const r = parseInt(h.slice(1, 3), 16)
  const g = parseInt(h.slice(3, 5), 16)
  const b = parseInt(h.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function slateBodyBg(color: string | null | undefined): string {
  const c = color || '#444444'
  const r = parseInt(c.slice(1, 3), 16)
  const g = parseInt(c.slice(3, 5), 16)
  const b = parseInt(c.slice(5, 7), 16)
  const dr = Math.round(r * 0.07)
  const dg = Math.round(g * 0.07)
  const db = Math.round(b * 0.07)
  const c1 = `rgb(${dr + 4},${dg + 4},${db + 4})`
  const c2 = `rgb(${Math.round(dr * 0.7) + 2},${Math.round(dg * 0.7) + 2},${Math.round(db * 0.7) + 2})`
  return `linear-gradient(135deg,${c1},${c2})`
}

function SlateLines({ color }: { color: string }) {
  const opacities = [0.28, 0, 0.15, 0, 0.07, 0]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 18, overflow: 'hidden' }}>
      {opacities.map((o, i) => (
        <div key={i} style={{ flex: 1, background: o > 0 ? hexToRgba(color, o) : 'transparent' }} />
      ))}
    </div>
  )
}

export function WiggleStyle() {
  return (
    <style>{`
      @keyframes wiggle {
        0%   { transform: rotate(0deg); }
        25%  { transform: rotate(-1.5deg); }
        75%  { transform: rotate(1.5deg); }
        100% { transform: rotate(0deg); }
      }
    `}</style>
  )
}

export type SlateCardProps = {
  project: Project
  color: string
  dimmed: boolean
  editMode: boolean
  isGhost: boolean
  isDragging: boolean
  wiggleDelay?: number
  onLongPress: () => void
  onClick: () => void
}

export function SlateCard({
  project, color, dimmed, editMode, isGhost, isDragging, wiggleDelay,
  onLongPress, onClick,
}: SlateCardProps) {
  const phaseColor = statusHex(project.status)
  const { data: crew } = useCrew(project.id)
  const allCrew = crew ?? []
  const longPressHandlers = useLongPress(onLongPress, 500, 8, onClick)

  if (isGhost) {
    return (
      <div style={{ borderRadius: 14, border: '1px dashed rgba(255,255,255,0.1)', opacity: 0.18, overflow: 'hidden' }}>
        <div style={{ height: 18 }} />
        <div style={{ height: 90 }} />
      </div>
    )
  }

  const wiggleStyle = editMode && !isDragging ? {
    animation: 'wiggle 0.5s ease-in-out infinite',
    animationDelay: `${wiggleDelay ?? 0}s`,
  } : {}

  const dragStyle = isDragging ? {
    transform: 'scale(1.06) rotate(1.5deg)',
    boxShadow: '0 16px 48px rgba(0,0,0,0.7), 0 0 0 1.5px rgba(255,255,255,0.12)',
    zIndex: 50, opacity: 0.95,
  } : {}

  return (
    <div
      {...longPressHandlers}
      data-project-id={project.id}
      style={{
        borderRadius: 14, overflow: 'hidden', position: 'relative', cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
        border: `1px solid rgba(255,255,255,${editMode ? '0.1' : '0.06'})`,
        background: 'rgba(10,10,18,0.6)',
        transition: isDragging ? 'none' : 'transform 0.12s ease, opacity 0.25s, filter 0.25s',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        opacity: dimmed ? 0.35 : 1,
        filter: dimmed ? 'blur(1px)' : 'none',
        ...wiggleStyle,
        ...dragStyle,
      }}
      className={editMode || isDragging ? '' : 'active:scale-[0.96] active:brightness-[0.85]'}
    >
      <SlateLines color={color} />
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '9px 10px 11px', position: 'relative', overflow: 'hidden',
        background: slateBodyBg(color),
        minHeight: 90,
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <div className="font-mono uppercase" style={{ fontSize: '0.42rem', letterSpacing: '0.08em', color: hexToRgba(color, 0.55) }}>{project.type}</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 20, background: hexToRgba(phaseColor, 0.12), border: `1px solid ${hexToRgba(phaseColor, 0.2)}`, flexShrink: 0 }}>
              <div style={{ width: 3, height: 3, borderRadius: '50%', background: phaseColor, boxShadow: `0 0 3px ${phaseColor}` }} />
              <span className="font-mono uppercase" style={{ fontSize: '0.34rem', letterSpacing: '0.04em', color: phaseColor }}>{STATUS_LABELS_SHORT[project.status] ?? project.status}</span>
            </div>
          </div>
          <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#dddde8', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{project.name}</div>
          {project.client && <div className="font-mono" style={{ fontSize: '0.38rem', color: '#62627a', letterSpacing: '0.06em', marginTop: 3 }}>{project.client}</div>}
        </div>
        <div style={{ position: 'relative', zIndex: 1, marginTop: 7 }}>
          {!editMode && allCrew.length > 0 && (
            <div style={{ display: 'flex' }}>
              {allCrew.slice(0, 5).map((c, i) => (
                <div key={c.id} style={{ marginLeft: i === 0 ? 0 : -3, position: 'relative', zIndex: 5 - i }}>
                  <CrewAvatar name={c.User?.name ?? 'Unknown'} size={20} avatarUrl={c.User?.avatarUrl} />
                </div>
              ))}
              {allCrew.length > 5 && (
                <div style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.32rem', fontWeight: 600, border: '1px solid rgba(0,0,0,0.5)', marginLeft: -3, fontFamily: 'var(--font-geist-mono)', background: hexToRgba(color, 0.12), color: '#62627a' }}>+{allCrew.length - 5}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
