'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// Swipeable card used across the Hub for ad-hoc previews. Visual shape
// is sacred — every Hub tile inherits the same outer chrome — so the
// a11y additions here (tabIndex, role, keyboard nav) layer on without
// changing styling. Touch swipe paginates items; arrow keys do the
// same; Enter/Space (or click) navigates to href.

export function SwipePanel<T>({
  items, label, labelColor, emptyIcon, emptyLabel, emptyContent, href, renderItem, showLabel = true,
}: {
  items: T[]
  label: string
  labelColor: string
  emptyIcon?: string
  emptyLabel?: string
  emptyContent?: React.ReactNode
  href: string
  renderItem: (item: T, index: number) => React.ReactNode
  /** When false, the inside mono-caps label is not rendered (the parent
   *  is presumed to provide an external header). aria-label still uses
   *  `label` for accessibility regardless. Default: true. */
  showLabel?: boolean
}) {
  const [page, setPage] = useState(0)
  const touchStart = useRef<number | null>(null)
  const router = useRouter()

  const onTS = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX }
  const onTE = (e: React.TouchEvent) => {
    if (touchStart.current === null) return
    const dx = e.changedTouches[0].clientX - touchStart.current
    touchStart.current = null
    if (Math.abs(dx) < 40) return
    if (dx < 0 && page < items.length - 1) setPage(p => p + 1)
    if (dx > 0 && page > 0) setPage(p => p - 1)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      router.push(href)
      return
    }
    if (e.key === 'ArrowRight' && page < items.length - 1) {
      e.preventDefault()
      setPage(p => p + 1)
      return
    }
    if (e.key === 'ArrowLeft' && page > 0) {
      e.preventDefault()
      setPage(p => p - 1)
    }
  }

  return (
    <div
      className="glass-tile flex-1 cursor-pointer active:opacity-90 transition-opacity"
      style={{ minHeight: 90, display: 'flex', flexDirection: 'column' }}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      tabIndex={0}
      onTouchStart={onTS}
      onTouchEnd={onTE}
      onClick={() => router.push(href)}
      onKeyDown={onKeyDown}
    >
      <div className="letterbox-top" />
      {showLabel && (
        <div className="font-mono uppercase" style={{ fontSize: '0.44rem', fontWeight: 700, color: labelColor, letterSpacing: '0.06em', textAlign: 'center', padding: '7px 0 0', position: 'relative', zIndex: 6 }}>{label}</div>
      )}
      {items.length > 0 ? (
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', width: `${items.length * 100}%`, height: '100%', transform: `translateX(-${page * (100 / items.length)}%)`, transition: 'transform 0.28s ease' }}>
            {items.map((item, i) => (
              <div key={i} style={{ width: `${100 / items.length}%`, height: '100%' }} aria-hidden={i !== page}>
                {renderItem(item, i)}
              </div>
            ))}
          </div>
          {items.length > 1 && (
            <div style={{ position: 'absolute', bottom: 4, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 3 }} aria-hidden="true">
              {items.map((_, i) => (
                <div key={i} style={{ width: page === i ? 10 : 4, height: 3, borderRadius: 2, background: page === i ? labelColor : 'rgba(255,255,255,0.2)', transition: 'all 0.2s' }} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          {emptyContent ?? (
            <>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px dashed rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 2V8M2 5H8" stroke="rgba(255,255,255,0.25)" strokeWidth="1.3" strokeLinecap="round" /></svg>
              </div>
              {emptyLabel && <span className="font-mono" style={{ fontSize: '0.36rem', color: 'var(--fg-mono)' }}>{emptyLabel}</span>}
            </>
          )}
        </div>
      )}
      <div className="letterbox-bottom" />
    </div>
  )
}
