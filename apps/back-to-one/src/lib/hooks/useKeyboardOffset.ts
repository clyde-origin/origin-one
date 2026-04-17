import { useEffect, useState } from 'react'

export function useKeyboardOffset(): number {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return
    const handler = () => {
      const keyboardHeight = window.innerHeight - (window.visualViewport?.height ?? window.innerHeight)
      setOffset(Math.max(0, keyboardHeight))
    }
    window.visualViewport.addEventListener('resize', handler)
    return () => window.visualViewport?.removeEventListener('resize', handler)
  }, [])

  return offset
}
