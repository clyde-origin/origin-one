'use client'

import { useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { LoadingState } from '@/components/ui'
import { PageHeader } from '@/components/ui/PageHeader'
import { ComposeTab } from '@/components/call-sheets/ComposeTab'
import { RecipientsTab } from '@/components/call-sheets/RecipientsTab'
import { TrackingTab } from '@/components/call-sheets/TrackingTab'
import {
  useCallSheet,
  useShootDays,
  useProject,
  useScheduleBlocks,
  useProjectTalent,
  useCrew,
  useLocations,
} from '@/lib/hooks/useOriginOne'

type Tab = 'compose' | 'recipients' | 'tracking'

export default function CallSheetDetailPage() {
  const params = useParams<{ projectId: string; callSheetId: string }>()
  const projectId = params?.projectId ?? ''
  const callSheetId = params?.callSheetId ?? ''
  const router = useRouter()
  const search = useSearchParams()
  const initialTab = (search?.get('tab') as Tab) || 'compose'
  const [tab, setTab] = useState<Tab>(initialTab)

  const { data: project } = useProject(projectId)
  const { data: callSheet, isLoading } = useCallSheet(callSheetId)
  const { data: shootDays = [] } = useShootDays(projectId)
  const { data: schedule = [] } = useScheduleBlocks(callSheet?.shootDayId ?? null)
  const { data: talent = [] } = useProjectTalent(projectId)
  const { data: crew = [] } = useCrew(projectId)
  const { data: locations = [] } = useLocations(projectId)

  if (isLoading || !callSheet || !project) return <LoadingState />

  const shootDay = shootDays.find(d => d.id === callSheet.shootDayId)

  if (!shootDay) {
    return (
      <div className="p-6 text-white/60">
        Shoot day for this call sheet was deleted.{' '}
        <button onClick={() => router.push(`/projects/${projectId}/call-sheets`)} className="underline">
          Back to call sheets
        </button>
      </div>
    )
  }

  return (
    <div className="screen flex flex-col" style={{ overflow: 'hidden' }}>
      <PageHeader
        projectId={projectId}
        title="Call Sheet"
        meta={callSheet.title || 'Untitled'}
        left={
          <button
            onClick={() => router.push(`/projects/${projectId}/call-sheets`)}
            className="text-white/60 text-sm font-medium px-2 py-1"
          >
            ← All
          </button>
        }
      />

      {/* Tab strip */}
      <div className="flex items-center justify-center gap-1 px-4 pb-3 border-b border-white/5">
        {(['compose', 'recipients', 'tracking'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="font-mono uppercase tracking-wider text-[10px] px-4 py-2 rounded-full"
            style={{
              background: tab === t ? 'rgba(100,112,243,0.18)' : 'transparent',
              color: tab === t ? '#9ba6ff' : '#62627a',
              border: tab === t ? '1px solid rgba(100,112,243,0.45)' : '1px solid transparent',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pt-6">
        {tab === 'compose' && (
          <ComposeTab
            project={project}
            callSheet={callSheet}
            shootDay={shootDay}
            schedule={schedule}
            talent={talent}
            crew={crew}
            locations={locations}
          />
        )}
        {tab === 'recipients' && (
          <RecipientsTab
            projectId={projectId}
            callSheetId={callSheetId}
            talent={talent}
            crew={crew}
          />
        )}
        {tab === 'tracking' && (
          <TrackingTab
            callSheetId={callSheetId}
            project={project}
            callSheet={callSheet}
            shootDay={shootDay}
            schedule={schedule}
            talent={talent}
            crew={crew}
            locations={locations}
          />
        )}
      </div>
    </div>
  )
}
