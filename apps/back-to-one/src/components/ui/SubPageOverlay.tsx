'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

const spring = { type: 'spring' as const, stiffness: 300, damping: 30 }

export function SubPageOverlay({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={spring}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: '#04040a',
        overflowY: 'auto',
      }}
    >
      {children}
    </motion.div>
  )
}
