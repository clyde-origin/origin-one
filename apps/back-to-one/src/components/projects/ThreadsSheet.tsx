'use client'

// Slide-up threads sheet rendered on the projects-root page. Toggled by
// ActionBarRoot's threads button via threadsOpen in RootFabContext. Shape
// mirrors GlobalPanels' panel frame (same top/bottom offsets, glass +
// accent line + header) so the two surfaces read as one visual language;
// the entry animation is a full slide-up from below the viewport rather
// than the panels' subtle fade-up.
//
// Same data + row component as the standalone /projects/threads route —
// useAllThreads + ThreadRow — so promoting between the two is one swap
// rather than a rewrite.

import { motion, AnimatePresence } from 'framer-motion'
import { useProjects, useAllThreads } from '@/lib/hooks/useOriginOne'
import { ThreadRow } from '@/components/threads/ThreadRow'
import type { Thread } from '@/types'

interface ThreadsSheetProps {
  open: boolean
}

export function ThreadsSheet({ open }: ThreadsSheetProps) {
  const { data: projects } = useProjects()
  const { data: threads, isLoading } = useAllThreads()
  const allProjects = projects ?? []
  const allThreads = (threads ?? []) as Thread[]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="threads-sheet"
          initial={{ y: '110%' }}
          animate={{ y: 0 }}
          exit={{ y: '110%' }}
          transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
          style={{
            position: 'fixed',
            top: 156,
            bottom: 'calc(68px + 52px + 64px + env(safe-area-inset-bottom, 0px))',
            left: 14, right: 14,
            zIndex: 10,
            background: 'rgba(10,10,18,0.78)',
            backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 -1px 0 rgba(255,255,255,0.05), 0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {/* Accent line — uses brand indigo (matches ActionBarRoot accent) */}
          <div style={{
            height: 2, flexShrink: 0,
            background: 'linear-gradient(90deg, transparent 5%, rgba(100,112,243,0.45) 40%, rgba(100,112,243,0.45) 60%, transparent 95%)',
          }} />

          {/* Header */}
          <div style={{
            padding: '14px 18px 12px', flexShrink: 0,
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}>
            <div className="font-mono" style={{ fontSize: 9, color: 'rgba(100,112,243,0.5)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>All Projects</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#dddde8', letterSpacing: '-0.02em', marginTop: 2 }}>
              Threads
            </div>
            <div className="font-mono" style={{ fontSize: 10, color: '#62627a', marginTop: 4 }}>
              {isLoading ? 'Loading…' : `${allThreads.length} thread${allThreads.length !== 1 ? 's' : ''}`}
            </div>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 18px 18px', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
            {!isLoading && allThreads.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', fontSize: 12, color: '#62627a' }}>
                No threads yet
              </div>
            ) : (
              allThreads.map((t, i) => (
                <ThreadRow key={t.id} thread={t} projects={allProjects} index={i} />
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
