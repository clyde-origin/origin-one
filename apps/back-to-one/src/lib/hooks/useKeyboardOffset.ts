import { useEffect, useState } from 'react'

export function useKeyboardOffset(): number {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return
    const vv = window.visualViewport
    const handler = () => {
      // documentElement.clientHeight is more stable than window.innerHeight on
      // iOS — innerHeight has shrunk to match visualViewport.height in some
      // iOS versions, which would mask the keyboard rise. clientHeight stays
      // anchored to the layout viewport.
      const layoutHeight = document.documentElement.clientHeight || window.innerHeight
      const keyboardHeight = layoutHeight - vv.height - vv.offsetTop
      setOffset(Math.max(0, keyboardHeight))
    }
    handler() // measure on mount in case the keyboard is already up
    vv.addEventListener('resize', handler)
    vv.addEventListener('scroll', handler)
    return () => {
      vv.removeEventListener('resize', handler)
      vv.removeEventListener('scroll', handler)
    }
  }, [])

  return offset
}
