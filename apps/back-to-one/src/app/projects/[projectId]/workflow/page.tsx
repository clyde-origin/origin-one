'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useProject, useWorkflowNodes } from '@/lib/hooks/useOriginOne'

import { LoadingState, EmptyState } from '@/components/ui'
import { GhostRow, GhostCircle, GhostRect, GhostPill, GhostBlock, SectionLabel, EmptyCTA } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { FAB } from '@/components/ui/FAB'
import { getProjectColor , statusHex, statusLabel } from '@/lib/utils/phase'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import type { WorkflowNode, WorkflowPhase, WorkflowNodeType } from '@/types'

const PHASES: { key: WorkflowPhase; label: string }[] = [
  { key: 'onset',    label: 'On Set' },
  { key: 'post',     label: 'Post' },
  { key: 'delivery', label: 'Delivery' },
]

const phaseColor: Record<WorkflowPhase, string> = {
  onset:    'text-prod bg-prod/10',
  post:     'text-post bg-post/10',
  delivery: 'text-pre bg-pre/10',
}

const typeIcons: Record<WorkflowNodeType, string> = {
  storage:     '\u{1F4BE}',
  software:    '\u{1F4BB}',
  system:      '\u{2699}\uFE0F',
  transfer:    '\u{1F504}',
  phase:       '\u{1F3AF}',
  deliverable: '\u{1F4E6}',
}

function NodeRow({ node, onTap }: { node: WorkflowNode; onTap: (n: WorkflowNode) => void }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b border-border cursor-pointer transition-colors active:bg-surface2"
      onClick={() => onTap(node)}
    >
      <div className="w-9 h-9 rounded-lg bg-surface2 border border-border flex items-center justify-center flex-shrink-0 text-base">
        {typeIcons[node.type] ?? '\u{1F4CB}'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-base leading-snug text-text truncate">{node.label}</div>
        {node.note && <div className="font-mono text-xs text-muted truncate">{node.note}</div>}
      </div>
      <span className="font-mono text-[0.5rem] tracking-widest uppercase text-muted flex-shrink-0 capitalize">{node.type}</span>
    </div>
  )
}

function DetailSheet({ node, onClose }: { node: WorkflowNode | null; onClose: () => void }) {
  if (!node) return null
  return (
    <>
      <SheetHeader title={node.label} onClose={onClose} />
      <SheetBody>
        <div className="flex items-center gap-2 mb-4 p-3 bg-surface2 rounded-lg border border-border">
          <span className="text-xl">{typeIcons[node.type] ?? '\u{1F4CB}'}</span>
          <span className="font-mono text-sm text-text2 capitalize">{node.type}</span>
          <span className={`font-mono text-xs px-2 py-1 rounded-sm ml-auto ${phaseColor[node.phase]}`}>
            {PHASES.find(p => p.key === node.phase)?.label ?? node.phase}
          </span>
        </div>

        {node.note && (
          <div className="mb-4">
            <span className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Note</span>
            <div className="text-base text-text2 leading-relaxed p-3 bg-surface2 rounded-lg border border-border">{node.note}</div>
          </div>
        )}

        <div className="mb-4">
          <span className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Order</span>
          <span className="font-mono text-sm text-text2">Step {node.order}</span>
        </div>
      </SheetBody>
    </>
  )
}

export default function WorkflowPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const { data: project } = useProject(projectId)
  const accent = getProjectColor(projectId)
  const [selected, setSelected] = useState<WorkflowNode | null>(null)

  const { data: nodes, isLoading } = useWorkflowNodes(projectId)
  const allNodes = nodes ?? []

  const grouped = PHASES
    .map(p => ({ ...p, nodes: allNodes.filter(n => n.phase === p.key).sort((a, b) => a.order - b.order) }))
    .filter(g => g.nodes.length > 0)

  return (
    <div className="screen">
      <PageHeader projectId={projectId} title="Workflow" meta={project ? (<div className="flex flex-col items-center gap-1.5"><span style={{ color: accent, fontSize: '0.50rem', letterSpacing: '0.06em' }}>{project.name}</span><span className="font-mono uppercase" style={{ fontSize: '0.38rem', padding: '2px 8px', borderRadius: 12, background: `${statusHex(project.status)}18`, color: statusHex(project.status) }}>{statusLabel(project.status)}</span></div>) : ''} />

      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 24 }}>
        {isLoading ? <LoadingState /> : (
          allNodes.length === 0 ? (
            <>
              {/* Ghost pipeline strip */}
              <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 0 }}>
                {[0,1,2,3,4].map(i => (
                  <div key={i} style={{ display: 'contents' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                      <GhostCircle size={36} />
                      <GhostRect w={24} h={8} />
                    </div>
                    {i < 4 && <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.04)', marginBottom: 18 }} />}
                  </div>
                ))}
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.04)' }} />

              <SectionLabel>Active Stage</SectionLabel>
              {/* Ghost stage card */}
              <div style={{ margin: '4px 16px 8px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: 9, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <GhostCircle size={8} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}><GhostRect w={140} h={13} /><GhostRect w={100} h={10} /></div>
                  <GhostPill w={36} h={22} />
                </div>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 2, marginBottom: 14 }} />
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <GhostCircle size={18} /><GhostRect w="100%" h={11} /><GhostCircle size={22} />
                    </div>
                  ))}
                </div>
              </div>

              <SectionLabel>Upcoming</SectionLabel>
              {/* Two collapsed ghost cards */}
              {[{ w1: 100, w2: 80 }, { w1: 120, w2: 90 }].map((s, i) => (
                <div key={i} style={{ margin: i === 0 ? '4px 16px 8px' : '0 16px 8px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: 9, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <GhostCircle size={8} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}><GhostRect w={s.w1} h={12} /><GhostRect w={s.w2} h={9} /></div>
                    <GhostPill w={36} h={22} />
                  </div>
                </div>
              ))}

              <EmptyCTA icon="⬡" headline="Map your workflow." sub="Stages, tasks, owners — start to delivery." addLabel="+ Add stage" />
            </>
          ) : (
            grouped.map(({ key, label, nodes: phaseNodes }) => (
              <div key={key}>
                <div className="px-4 py-2 font-mono text-sm text-muted tracking-widest uppercase border-b border-border">
                  <span className={`px-1.5 py-0.5 rounded-sm ${phaseColor[key]}`}>{label}</span>
                  <span className="ml-2 text-muted">{phaseNodes.length}</span>
                </div>
                {phaseNodes.map(node => <NodeRow key={node.id} node={node} onTap={setSelected} />)}
              </div>
            ))
          )
        )}
      </div>

      <Sheet open={!!selected} onClose={() => setSelected(null)}>
        <DetailSheet node={selected} onClose={() => setSelected(null)} />
      </Sheet>
      <FAB accent={accent} projectId={projectId} />
    </div>
  )
}
