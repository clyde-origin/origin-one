'use client'

// Cross-project Threads route. Promotes the threads list from a fan-arc
// panel inside GlobalPanels to a discoverable bar destination — same data
// (useAllThreads), same row component (ThreadRow), full-page chrome.
//
// Inherits ActionBarRoot from projects/layout.tsx. The route page does
// not render its own bar.

import { useProjects, useAllThreads } from '@/lib/hooks/useOriginOne'
import { ThreadRow } from '@/components/threads/ThreadRow'
import type { Thread } from '@/types'

export default function ProjectsThreadsPage() {
  const { data: projects } = useProjects()
  const { data: threads, isLoading } = useAllThreads()
  const allProjects = projects ?? []
  const allThreads = (threads ?? []) as Thread[]

  return (
    <div style={{ minHeight: '100dvh', background: '#04040a', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div style={{
        maxWidth: 390, margin: '0 auto',
        padding: '40px 20px calc(120px + env(safe-area-inset-bottom, 0px))',
      }}>
        <div style={{ marginBottom: 18 }}>
          <p className="font-mono uppercase" style={{ fontSize: 9, color: 'rgba(196,90,220,0.5)', letterSpacing: '0.12em', marginBottom: 4 }}>
            All Projects
          </p>
          <h1 style={{ fontWeight: 800, fontSize: 26, color: '#dddde8', letterSpacing: '-0.02em', lineHeight: 1 }}>
            Threads
          </h1>
          <p className="font-mono" style={{ fontSize: 10, color: '#62627a', marginTop: 6 }}>
            {isLoading ? 'Loading…' : `${allThreads.length} thread${allThreads.length !== 1 ? 's' : ''} · all projects`}
          </p>
        </div>

        {!isLoading && allThreads.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', fontSize: 12, color: '#62627a' }}>
            No threads yet
          </div>
        ) : (
          <div>
            {allThreads.map((t, i) => (
              <ThreadRow key={t.id} thread={t} projects={allProjects} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
