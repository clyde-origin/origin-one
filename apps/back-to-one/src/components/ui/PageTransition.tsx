'use client'

import { motion, useAnimationControls } from 'framer-motion'
import { useEffect } from 'react'
import { usePageExit } from '@/lib/context/PageExitContext'

const spring = { type: 'spring' as const, stiffness: 300, damping: 30 }

export function PageTransition({ children }: { children: React.ReactNode }) {
  const { exiting, onExitComplete } = usePageExit()
  const controls = useAnimationControls()

  // Entrance: slide up
  useEffect(() => {
    controls.start({ y: 0, opacity: 1 })
  }, [controls])

  // Exit: slide down, then navigate
  useEffect(() => {
    if (exiting) {
      controls.start({ y: '100%', opacity: 0.8 }).then(onExitComplete)
    }
  }, [exiting, controls, onExitComplete])

  return (
    <motion.div
      initial={{ y: '100%', opacity: 0.8 }}
      animate={controls}
      transition={spring}
      style={{ position: 'fixed', inset: 0, zIndex: 50, overflowY: 'auto' }}
    >
      {children}
    </motion.div>
  )
}
