// Public web view — full GB01-style call sheet, accessible without auth
// via the recipient's confirmToken. Marks openedAt on first load.

import { getCallSheetAdminClient } from '@/lib/call-sheet/admin-client'
import { CallSheetView } from '@/components/call-sheets/CallSheetView'
import { deriveCallSheetViewModel } from '@/lib/call-sheet/derive-view-model'
import type { CallSheet, ShootDay, Project, ScheduleBlock, ProjectTalent, Location } from '@/types'

export const dynamic = 'force-dynamic'

export default async function PublicCallSheetView({ params }: { params: { token: string } }) {
  const db = getCallSheetAdminClient()

  const { data: delivery } = await db
    .from('CallSheetDelivery')
    .select('id, openedAt, CallSheetRecipient!inner(callSheetId)')
    .eq('confirmToken', params.token)
    .maybeSingle()

  if (!delivery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#04040a] text-white p-6">
        <p className="text-white/55">Link expired or invalid.</p>
      </div>
    )
  }

  const callSheetId = (delivery.CallSheetRecipient as any).callSheetId

  // Mark opened on first view
  if (!delivery.openedAt) {
    await db.from('CallSheetDelivery').update({
      openedAt: new Date().toISOString(),
      status: 'opened',
      updatedAt: new Date().toISOString(),
    }).eq('id', delivery.id)
  }

  const [cs, sd, project, schedule, talent, members, locations] = await Promise.all([
    db.from('CallSheet').select('*').eq('id', callSheetId).single(),
    db.from('CallSheet').select('shootDayId').eq('id', callSheetId).single().then(async (r) => {
      const sdId = r.data?.shootDayId
      if (!sdId) return { data: null }
      return db.from('ShootDay').select('*').eq('id', sdId).single()
    }),
    db.from('CallSheet').select('projectId').eq('id', callSheetId).single().then(async (r) => {
      const pid = r.data?.projectId
      if (!pid) return { data: null }
      return db.from('Project').select('*').eq('id', pid).single()
    }),
    db.from('CallSheet').select('shootDayId').eq('id', callSheetId).single().then(async (r) => {
      const sdId = r.data?.shootDayId
      if (!sdId) return { data: [] }
      return db.from('ScheduleBlock').select('*').eq('shootDayId', sdId).order('startTime')
    }),
    db.from('CallSheet').select('projectId').eq('id', callSheetId).single().then(async (r) => {
      const pid = r.data?.projectId
      if (!pid) return { data: [] }
      return db.from('Talent').select('id, projectId, name, role, email, phone, imageUrl').eq('projectId', pid)
    }),
    db.from('CallSheet').select('projectId').eq('id', callSheetId).single().then(async (r) => {
      const pid = r.data?.projectId
      if (!pid) return { data: [] }
      return db.from('ProjectMember').select('*, User(*)').eq('projectId', pid)
    }),
    db.from('CallSheet').select('projectId').eq('id', callSheetId).single().then(async (r) => {
      const pid = r.data?.projectId
      if (!pid) return { data: [] }
      return db.from('Location').select('*').eq('projectId', pid)
    }),
  ])

  if (!cs.data || !sd.data || !project.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#04040a] text-white p-6">
        <p className="text-white/55">Call sheet not available.</p>
      </div>
    )
  }

  const vm = deriveCallSheetViewModel({
    project: project.data as Project,
    callSheet: cs.data as CallSheet,
    shootDay: sd.data as ShootDay,
    schedule: (schedule.data ?? []) as ScheduleBlock[],
    talent: (talent.data ?? []) as ProjectTalent[],
    crew: (members.data ?? []) as any[],
    locations: (locations.data ?? []) as Location[],
  })

  return (
    <div className="min-h-screen bg-[#04040a] py-6 px-4">
      <CallSheetView vm={vm} />
    </div>
  )
}
