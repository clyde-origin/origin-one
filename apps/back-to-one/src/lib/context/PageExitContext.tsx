'use client'

import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from 'react'

interface PageExitContextValue {
  exiting: boolean
  triggerExit: (cb: () => void) => void
  onExitComplete: () => void
}

const PageExitContext = createContext<PageExitContextValue>({
  exiting: false,
  triggerExit: () => {},
  onExitComplete: () => {},
})

export function PageExitProvider({ children }: { children: ReactNode }) {
  const [exiting, setExiting] = useState(false)
  const cbRef = useRef<(() => void) | null>(null)

  const triggerExit = useCallback((cb: () => void) => {
    cbRef.current = cb
    setExiting(true)
  }, [])

  const onExitComplete = useCallback(() => {
    cbRef.current?.()
    cbRef.current = null
  }, [])

  return (
    <PageExitContext.Provider value={{ exiting, triggerExit, onExitComplete }}>
      {children}
    </PageExitContext.Provider>
  )
}

export function usePageExit() {
  return useContext(PageExitContext)
}
