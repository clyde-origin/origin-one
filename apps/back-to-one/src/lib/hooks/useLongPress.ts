import { useRef, useCallback, useEffect } from 'react'

export function useLongPress(onLongPress: () => void, delay = 500, moveThreshold = 8) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPos = useRef<{ x: number; y: number } | null>(null)

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
    // Prevent iOS text selection / Copy-Look Up bar on long press
    if ('touches' in e) {
      e.preventDefault()
      startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    timerRef.current = setTimeout(() => {
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

  return {
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchStart: start,
    onTouchMove: move,
    onTouchEnd: clear,
    onTouchCancel: clear,
  }
}
