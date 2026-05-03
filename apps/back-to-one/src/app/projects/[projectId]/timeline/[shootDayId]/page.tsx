'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { LoadingState } from '@/components/ui'
import { PageHeader } from '@/components/ui/PageHeader'
import { ScheduleGrid } from '@/components/schedule/ScheduleGrid'
import { ScheduleCardStack } from '@/components/schedule/ScheduleCardStack'
import { AddScheduleBlockSheet } from '@/components/schedule/AddScheduleBlockSheet'
import { useScheduleBlocks, useShootDays, useProject, useCallSheetByShootDay, useCreateCallSheet } from '@/lib/hooks/useOriginOne'
import { useFabAction } from '@/lib/contexts/FabActionContext'
import { useViewerRole } from '@/lib/auth/useViewerRole'
import type { ScheduleBlock } from '@/types'

const SHORT_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const PHASE_HEX: Record<string, string> = {
  pre: '#e8a020',
  prod: '#6470f3',
  post: '#00b894',
}

const PHASE_LABEL: Record<string, string> = {
  pre: 'Prep',
  prod: 'Shoot',
  post: 'Post',
}

function shootDayDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const date = new Date(Date.UTC(y, m - 1, d))
  return `${DOW[date.getUTCDay()]} ${SHORT_MONTH[date.getUTCMonth()]} ${d}, ${y}`
}

export default function ShootDaySchedulePage() {
  const params = useParams<{ projectId: string; shootDayId: string }>()
  const router = useRouter()
  const projectId = params?.projectId ?? ''
  const shootDayId = params?.shootDayId ?? ''

  const { data: project } = useProject(projectId)
  const { data: shootDays = [] } = useShootDays(projectId)
  const { data: blocks = [], isLoading: blocksLoading } = useScheduleBlocks(shootDayId)
  const { data: callSheetForDay } = useCallSheetByShootDay(shootDayId)
  const createCallSheet = useCreateCallSheet(projectId)
  const shootDay = shootDays.find(d => d.id === shootDayId) ?? null

  // Edit gate — crew can view but not modify; producer/owner can edit.
  // Call sheet visibility (the green "Create / Open call sheet" button)
  // is gated identically.
  const role = useViewerRole(projectId)
  const canEdit = role === 'producer'

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState<ScheduleBlock | null>(null)

  function openAdd() {
    if (!canEdit) return
    setEditingBlock(null)
    setSheetOpen(true)
  }

  function openEdit(block: ScheduleBlock) {
    if (!canEdit) return
    setEditingBlock(block)
    setSheetOpen(true)
  }

  // FAB — "+ Add Block" only for editors. Hooks must be unconditional;
  // we register a no-op when read-only so the FAB slot stays hidden.
  useFabAction(
    canEdit
      ? { onPress: openAdd, label: 'Add Block' }
      : {},
    [canEdit],
  )

  if (blocksLoading || !shootDay || !project) {
    return (
      <div className="screen flex flex-col">
        <LoadingState />
      </div>
    )
  }

  const phase = shootDay.type
  const dateLabel = shootDayDateLabel(shootDay.date)

  return (
    <div className="screen flex flex-col" style={{ overflow: 'hidden' }}>
      <PageHeader
        projectId={projectId}
        title="Schedule"
        meta={
          <div className="flex items-center gap-2">
            <span className="font-mono uppercase text-[10px] text-white/55">{dateLabel}</span>
            {/* Phase chip — cinema-glass chip pattern (bg @ 0.20, border @ 0.50). */}
            <span
              className="font-mono uppercase inline-flex items-center"
              style={{
                gap: 4,
                padding: '2px 8px',
                borderRadius: 20,
                fontSize: '0.42rem',
                letterSpacing: '0.08em',
                fontWeight: 600,
                background: `${PHASE_HEX[phase]}33`,
                color: PHASE_HEX[phase],
                border: `1px solid ${PHASE_HEX[phase]}80`,
              }}
            >
              <span className="rounded-full" style={{ width: 4, height: 4, background: PHASE_HEX[phase], boxShadow: `0 0 4px ${PHASE_HEX[phase]}` }} />
              {PHASE_LABEL[phase]}
            </span>
          </div>
        }
        left={
          <button
            onClick={() => router.push(`/projects/${projectId}/timeline`)}
            className="font-mono uppercase"
            style={{ fontSize: '0.42rem', letterSpacing: '0.10em', color: '#7a7a82', padding: '6px 10px' }}
          >
            ← Days
          </button>
        }
      />

      <div className="flex-1 px-4 pb-32 pt-4 overflow-y-auto">
        {/* Call sheet link — producer-only. .glass-tile-sm with --tile-rgb
            keyed to phase-post-teal when a sheet exists, neutral white when
            prompting create. */}
        {canEdit && (
          <div className="max-w-2xl mx-auto mb-4">
            {callSheetForDay ? (
              <button
                onClick={() => router.push(`/projects/${projectId}/call-sheets/${callSheetForDay.id}`)}
                className="glass-tile-sm w-full flex items-center justify-between active:opacity-80 transition-opacity"
                style={{
                  ['--tile-rgb' as string]: '0, 184, 148',
                  padding: '14px 16px',
                  color: '#00b894',
                }}
              >
                <span className="text-sm font-medium">Open call sheet for this day</span>
                <span className="text-xs">→</span>
              </button>
            ) : (
              <button
                onClick={async () => {
                  const cs = await createCallSheet.mutateAsync({
                    projectId,
                    shootDayId,
                    title: project.name,
                  })
                  if (cs?.id) router.push(`/projects/${projectId}/call-sheets/${cs.id}`)
                }}
                disabled={createCallSheet.isPending}
                className="glass-tile-sm w-full flex items-center justify-between active:opacity-80 transition-opacity"
                style={{
                  ['--tile-rgb' as string]: '255, 255, 255',
                  padding: '14px 16px',
                  color: '#ebebef',
                }}
              >
                <span className="text-sm">+ Create call sheet for this day</span>
                <span className="text-xs text-white/40">→</span>
              </button>
            )}
          </div>
        )}

        {/* Desktop grid */}
        <div className="hidden md:block">
          <ScheduleGrid blocks={blocks} onEditBlock={openEdit} projectId={projectId} />
        </div>
        {/* Phone card stack */}
        <div className="md:hidden">
          <ScheduleCardStack blocks={blocks} onEditBlock={openEdit} projectId={projectId} />
        </div>
      </div>

      <AddScheduleBlockSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        projectId={projectId}
        shootDayId={shootDayId}
        editingBlock={editingBlock}
      />
    </div>
  )
}
