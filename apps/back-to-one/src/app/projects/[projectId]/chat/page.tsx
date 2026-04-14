'use client'

import { PageHeader } from '@/components/ui/PageHeader'
import { FAB } from '@/components/ui/FAB'
import { getProjectColor, statusHex, statusLabel } from '@/lib/utils/phase'
import { useProject } from '@/lib/hooks/useOriginOne'
import { GhostRect, EmptyCTA } from '@/components/ui/EmptyState'

export default function ChatPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const accent = getProjectColor(projectId)
  const { data: project } = useProject(projectId)

  return (
    <div className="screen">
      <PageHeader projectId={projectId} title="Chat" meta={project ? (<div className="flex flex-col items-center gap-1.5"><span style={{ color: accent, fontSize: '0.50rem', letterSpacing: '0.06em' }}>{project.name}</span><span className="font-mono uppercase" style={{ fontSize: '0.38rem', padding: '2px 8px', borderRadius: 12, background: `${statusHex(project.status)}18`, color: statusHex(project.status) }}>{statusLabel(project.status)}</span></div>) : ''} />
      <div className="flex-1 overflow-y-auto no-scrollbar" style={{ paddingBottom: 24 }}>
        {/* Ghost message rows */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 10, paddingLeft: 38 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <GhostRect w={200} h={36} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <div style={{ maxWidth: 160, height: 28, borderRadius: 10, background: 'rgba(196,90,220,0.04)', border: '1px solid rgba(255,255,255,0.04)' }} />
          </div>
          <div style={{ display: 'flex', gap: 10, paddingLeft: 38 }}>
            <div style={{ flex: 1 }}>
              <GhostRect w={220} h={44} />
            </div>
          </div>
        </div>
        <EmptyCTA icon="💬" headline="Nothing yet." sub="Start the conversation. Your team is listening." addLabel="Say something →" />
      </div>
      <FAB accent={accent} projectId={projectId} hideChat />
    </div>
  )
}
