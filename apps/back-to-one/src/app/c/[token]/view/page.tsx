// Public web view — full GB01-style call sheet, accessible without auth
// via the recipient's confirmToken. Marks openedAt on first load.
//
// Defense: token grants read access only, but it grants it to a public
// URL that may be archived in mailboxes/scanners forever. Reject access
// past shoot date + EXPIRY_GRACE_DAYS, and select only the User fields
// the call sheet actually renders (no avatarUrl, password digests,
// internal flags) — defensive trim against future User column drift.

import { getCallSheetAdminClient } from '@/lib/call-sheet/admin-client'
import { CallSheetView } from '@/components/call-sheets/CallSheetView'
import { deriveCallSheetViewModel } from '@/lib/call-sheet/derive-view-model'
import {
  isCallSheetAccessExpired,
  loadDeliveryForToken,
} from '@/lib/call-sheet/token-access'
import type { CallSheet, ShootDay, Project, ScheduleBlock, ProjectTalent, Location } from '@/types'

export const dynamic = 'force-dynamic'

function ExpiredOrMissing({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#04040a] text-white p-6">
      <p className="text-white/55">{message}</p>
    </div>
  )
}

export default async function PublicCallSheetView({ params }: { params: { token: string } }) {
  const delivery = await loadDeliveryForToken(params.token)
  if (!delivery) {
    return <ExpiredOrMissing message="Link expired or invalid." />
  }
  if (isCallSheetAccessExpired(delivery.shootDate)) {
    return <ExpiredOrMissing message="This call sheet is no longer available." />
  }

  const db = getCallSheetAdminClient()
  const { id: deliveryId, callSheetId, projectId, openedAt } = delivery

  if (!openedAt) {
    await db.from('CallSheetDelivery').update({
      openedAt: new Date().toISOString(),
      status: 'opened',
      updatedAt: new Date().toISOString(),
    }).eq('id', deliveryId)
  }

  const [cs, sd, project, schedule, talent, members, locations] = await Promise.all([
    db.from('CallSheet').select('*').eq('id', callSheetId).single(),
    db.from('CallSheet').select('shootDayId').eq('id', callSheetId).single().then(async (r) => {
      const sdId = r.data?.shootDayId
      if (!sdId) return { data: null }
      return db.from('ShootDay').select('*').eq('id', sdId).single()
    }),
    db.from('Project').select('*').eq('id', projectId).single(),
    db.from('CallSheet').select('shootDayId').eq('id', callSheetId).single().then(async (r) => {
      const sdId = r.data?.shootDayId
      if (!sdId) return { data: [] }
      return db.from('ScheduleBlock').select('*').eq('shootDayId', sdId).order('startTime')
    }),
    db.from('Talent')
      .select('id, projectId, name, role, email, phone, imageUrl')
      .eq('projectId', projectId),
    db.from('ProjectMember')
      .select('id, projectId, role, department, User(name, phone)')
      .eq('projectId', projectId),
    db.from('Location').select('*').eq('projectId', projectId),
  ])

  if (!cs.data || !sd.data || !project.data) {
    return <ExpiredOrMissing message="Call sheet not available." />
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
