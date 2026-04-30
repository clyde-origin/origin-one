'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { LoadingState } from '@/components/ui'
import { PageHeader } from '@/components/ui/PageHeader'
import { ScheduleGrid } from '@/components/schedule/ScheduleGrid'
import { ScheduleCardStack } from '@/components/schedule/ScheduleCardStack'
import { AddScheduleBlockSheet } from '@/components/schedule/AddScheduleBlockSheet'
import { useScheduleBlocks, useShootDays, useProject } from '@/lib/hooks/useOriginOne'
import { useFabAction } from '@/lib/contexts/FabActionContext'
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
  const shootDay = shootDays.find(d => d.id === shootDayId) ?? null

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState<ScheduleBlock | null>(null)

  function openAdd() {
    setEditingBlock(null)
    setSheetOpen(true)
  }

  function openEdit(block: ScheduleBlock) {
    setEditingBlock(block)
    setSheetOpen(true)
  }

  // FAB — "+ Add Block"
  useFabAction({
    onPress: openAdd,
    label: 'Add Block',
  })

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
            <span
              className="font-mono uppercase text-[9px] tracking-widest"
              style={{
                padding: '2px 8px',
                borderRadius: 12,
                background: `${PHASE_HEX[phase]}1a`,
                color: PHASE_HEX[phase],
                border: `1px solid ${PHASE_HEX[phase]}33`,
              }}
            >
              {PHASE_LABEL[phase]}
            </span>
          </div>
        }
        left={
          <button
            onClick={() => router.push(`/projects/${projectId}/timeline`)}
            className="text-white/60 text-sm font-medium px-2 py-1"
          >
            ← Days
          </button>
        }
      />

      <div className="flex-1 px-4 pb-32 pt-4 overflow-y-auto">
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
