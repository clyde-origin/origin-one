import { useRef, useCallback, useEffect } from 'react'

/**
 * Long-press hook with click-suppression.
 *
 * Returns event handlers to spread on an interactive element.
 *
 * If `onClick` is passed (4th arg), the returned handlers include a
 * wrapped `onClick` that suppresses the synthesized click event the
 * browser fires immediately after a long-press finishes (lift finger →
 * touchend → synthesized click). Without suppression, that click runs
 * the consumer's onClick path, which is almost never what the user
 * wants right after a long-press.
 *
 * If `onClick` is omitted, the consumer keeps full control of `onClick`
 * (no wrapping; no suppression) — useful when the consumer wants to
 * compose its own wrapper or is on an element that shouldn't have a
 * click handler at all.
 */
export function useLongPress(
  onLongPress: () => void,
  delay = 500,
  moveThreshold = 8,
  onClick?: () => void
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPos = useRef<{ x: number; y: number } | null>(null)
  const justFiredRef = useRef(false)

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    startPos.current = null
  }, [])

  useEffect(() => {
    return () => clear()
  }, [clear])

  const start = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    // Reset suppression flag at the start of every press cycle.
    justFiredRef.current = false
    // Prevent iOS text selection / Copy-Look Up bar on long press.
    if ('touches' in e) {
      e.preventDefault()
      startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    timerRef.current = setTimeout(() => {
      justFiredRef.current = true
      onLongPress()
      timerRef.current = null
    }, delay)
  }, [onLongPress, delay])

  const move = useCallback((e: React.TouchEvent) => {
    if (!startPos.current || !timerRef.current) return
    const dx = e.touches[0].clientX - startPos.current.x
    const dy = e.touches[0].clientY - startPos.current.y
    if (Math.abs(dx) > moveThreshold || Math.abs(dy) > moveThreshold) {
      clear()
    }
  }, [moveThreshold, clear])

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (justFiredRef.current) {
      // Suppress the synthesized click that follows a long-press.
      justFiredRef.current = false
      e.preventDefault()
      e.stopPropagation()
      return
    }
    onClick?.()
  }, [onClick])

  const base = {
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchStart: start,
    onTouchMove: move,
    onTouchEnd: clear,
    onTouchCancel: clear,
  }

  // Only include the onClick key when the consumer opted in by passing
  // an onClick. If we returned `onClick: undefined`, TypeScript would
  // still see a duplicate-prop conflict at any call site that also sets
  // onClick explicitly before the spread (e.g. budget/page.tsx).
  if (onClick) {
    return { ...base, onClick: handleClick }
  }
  return base
}
