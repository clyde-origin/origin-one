'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { LoadingState } from '@/components/ui'
import { PageHeader } from '@/components/ui/PageHeader'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { useFabAction } from '@/lib/contexts/FabActionContext'
import { useCallSheets, useShootDays, useProject, useCreateCallSheet } from '@/lib/hooks/useOriginOne'
import { haptic } from '@/lib/utils/haptics'
import type { ShootDay } from '@/types'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const SHORT_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const PHASE_HEX: Record<string, string> = { pre: '#e8a020', prod: '#6470f3', post: '#00b894' }
const STATUS_HEX: Record<string, string> = { draft: '#62627a', sent: '#34d399' }

function formatShootDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const date = new Date(Date.UTC(y, m - 1, d))
  return `${DOW[date.getUTCDay()]} ${SHORT_MONTH[date.getUTCMonth()]} ${d}`
}

export default function CallSheetsListPage() {
  const params = useParams<{ projectId: string }>()
  const projectId = params?.projectId ?? ''
  const router = useRouter()

  const { data: project } = useProject(projectId)
  const { data: callSheets = [], isLoading } = useCallSheets(projectId)
  const { data: shootDays = [] } = useShootDays(projectId)

  const [createOpen, setCreateOpen] = useState(false)

  useFabAction({ onPress: () => setCreateOpen(true), label: 'New Call Sheet' })

  if (isLoading || !project) return <LoadingState />

  const shootDayById = new Map((shootDays as ShootDay[]).map(d => [d.id, d]))

  return (
    <div className="screen flex flex-col" style={{ overflow: 'hidden' }}>
      <PageHeader projectId={projectId} title="Call Sheets" meta={project.name} />

      <div className="flex-1 px-4 pb-32 pt-4 overflow-y-auto max-w-2xl mx-auto w-full">
        {callSheets.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center text-white/40">
            No call sheets yet. Tap + to create one.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {callSheets.map(cs => {
              const sd = shootDayById.get(cs.shootDayId)
              const phaseHex = sd ? PHASE_HEX[sd.type] : '#62627a'
              const statusHex = STATUS_HEX[cs.status] ?? '#62627a'
              return (
                <button
                  key={cs.id}
                  onClick={() => { haptic('light'); router.push(`/projects/${projectId}/call-sheets/${cs.id}`) }}
                  className="text-left bg-white/[0.04] border border-white/10 rounded-2xl p-4 active:bg-white/[0.08]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-white">{cs.title || 'Untitled call sheet'}</div>
                      <div className="font-mono uppercase tracking-wider text-[10px] text-white/50 mt-0.5">
                        {sd ? formatShootDate(sd.date) : 'No shoot day'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {sd && (
                        <span className="font-mono uppercase text-[9px] tracking-widest px-2 py-0.5 rounded-full"
                          style={{ background: `${phaseHex}1a`, color: phaseHex, border: `1px solid ${phaseHex}33` }}>
                          {sd.type === 'prod' ? 'Shoot' : sd.type === 'pre' ? 'Prep' : 'Post'}
                        </span>
                      )}
                      <span className="font-mono uppercase text-[9px] tracking-widest px-2 py-0.5 rounded-full"
                        style={{ background: `${statusHex}1a`, color: statusHex, border: `1px solid ${statusHex}33` }}>
                        {cs.status}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <CreateCallSheetSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        projectId={projectId}
        shootDays={shootDays as ShootDay[]}
        existingCallSheets={callSheets}
        onCreated={(csId) => {
          setCreateOpen(false)
          router.push(`/projects/${projectId}/call-sheets/${csId}`)
        }}
      />
    </div>
  )
}

function CreateCallSheetSheet({
  open, onClose, projectId, shootDays, existingCallSheets, onCreated,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  shootDays: ShootDay[]
  existingCallSheets: { shootDayId: string }[]
  onCreated: (callSheetId: string) => void
}) {
  const createMut = useCreateCallSheet(projectId)
  const [shootDayId, setShootDayId] = useState<string>('')
  const [title, setTitle] = useState('')

  const usedShootDayIds = new Set(existingCallSheets.map(cs => cs.shootDayId))
  const eligible = shootDays.filter(d => !usedShootDayIds.has(d.id) && d.type !== 'post')

  async function submit() {
    if (!shootDayId) return
    const cs = await createMut.mutateAsync({
      projectId,
      shootDayId,
      title: title.trim() || null,
    })
    if (cs?.id) onCreated(cs.id)
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader title="New Call Sheet" onClose={onClose} />
      <SheetBody>
        <div className="flex flex-col gap-4 pb-2">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono uppercase tracking-wider text-[10px] text-white/45">Shoot Day</span>
            <select
              value={shootDayId}
              onChange={e => setShootDayId(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white"
            >
              <option value="">Select a shoot day…</option>
              {eligible.map(d => (
                <option key={d.id} value={d.id}>{formatShootDate(d.date)} — {d.type}</option>
              ))}
            </select>
            {eligible.length === 0 && (
              <span className="text-xs text-white/40">All eligible shoot days already have call sheets.</span>
            )}
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono uppercase tracking-wider text-[10px] text-white/45">Title (optional)</span>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Gibbon Slackboard"
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white"
            />
          </label>
          <button
            onClick={submit}
            disabled={!shootDayId || createMut.isPending}
            className="bg-white text-black rounded-xl py-3 font-medium disabled:opacity-40"
          >
            {createMut.isPending ? 'Creating...' : 'Create call sheet'}
          </button>
        </div>
      </SheetBody>
    </Sheet>
  )
}
