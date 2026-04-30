// Pure: combines CallSheet + ShootDay + ScheduleBlocks + Talent + Crew +
// Locations into the renderable view model used by the Compose preview,
// the public web view, and the PDF render.

import type {
  CallSheet,
  ShootDay,
  ScheduleBlock,
  ProjectTalent,
  Project,
  Location,
  CrewMember,
} from '@/types'
import { deriveCallTimes } from '@/lib/schedule/derive-call-times'
import { addMinutesToTime } from '@/lib/schedule/format-time'
import { isPostOnlyDepartment } from '@/lib/auth/call-sheet-permissions'

export type CallSheetCrewRow = {
  id: string
  name: string
  role: string
  callTime: string
  department: string
}

export type CallSheetTalentRow = {
  id: string
  name: string
  role: string | null
  callTime: string
  hmuTime: string | null
  email: string | null
  phone: string | null
  initials: string
}

export type CallSheetClientRow = {
  id: string
  name: string
  role: string
  callTime: string
}

export interface CallSheetViewModel {
  project: { id: string; name: string }
  callSheet: CallSheet
  shootDay: { id: string; date: string; type: string; locationName: string | null; locationAddress: string | null }
  primaryLocation: Location | null
  schedule: ScheduleBlock[]
  productionRoles: { name: string; phone: string | null; role: string }[]
  talentRows: CallSheetTalentRow[]
  crewRowsByDept: Record<string, CallSheetCrewRow[]>
  clientRows: CallSheetClientRow[]
  totalCrewCount: number
  totalTalentCount: number
  totalClientCount: number
}

const PRODUCTION_ROLE_NAMES = ['Producer', 'Director', '1st AD', 'Production Asst.']

function nameInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function deriveCallSheetViewModel(input: {
  project: Project
  callSheet: CallSheet
  shootDay: ShootDay
  schedule: ScheduleBlock[]
  talent: ProjectTalent[]
  crew: CrewMember[]
  locations: Location[]
}): CallSheetViewModel {
  const { project, callSheet, shootDay, schedule, talent, crew, locations } = input

  const primaryLocation = shootDay.locationId
    ? locations.find(l => l.id === shootDay.locationId) ?? null
    : null

  // Talent rows
  const talentCallMap = deriveCallTimes(schedule, talent.map(t => t.id))
  const generalCall = callSheet.generalCallTime ?? '08:00'
  const talentRows: CallSheetTalentRow[] = talent.map(t => {
    const callTime = talentCallMap[t.id] ?? generalCall
    const hmuTime = addMinutesToTime(callTime, 30)
    return {
      id: t.id,
      name: t.name,
      role: t.role,
      callTime,
      hmuTime: schedule.some(b => b.talentIds.includes(t.id)) ? hmuTime : null,
      email: t.email,
      phone: t.phone,
      initials: nameInitials(t.name),
    }
  })

  // Crew rows — exclude post-only
  const crewCallTime = callSheet.crewCallTime ?? generalCall
  const crewMembers = crew.filter(m => {
    const dept = (m as any).Department ?? (m as any).department ?? null
    return !isPostOnlyDepartment(dept)
  })

  const crewRowsByDept: Record<string, CallSheetCrewRow[]> = {}
  const clientRows: CallSheetClientRow[] = []
  const productionRoles: { name: string; phone: string | null; role: string }[] = []

  for (const m of crewMembers) {
    const member = m as any
    const dept = (member.department ?? 'Other') as string
    const role = (member.role ?? '') as string
    const userName = member.User?.name ?? member.name ?? '—'
    const phone = member.User?.phone ?? member.phone ?? null

    if (PRODUCTION_ROLE_NAMES.includes(role) || dept === 'Production') {
      productionRoles.push({ name: userName, phone, role: role || 'Production' })
    }

    const row: CallSheetCrewRow = {
      id: member.id,
      name: userName,
      role: role || dept,
      callTime: crewCallTime,
      department: dept,
    }

    if (dept === 'Client') {
      clientRows.push({ id: row.id, name: row.name, role: row.role, callTime: row.callTime })
    } else {
      if (!crewRowsByDept[dept]) crewRowsByDept[dept] = []
      crewRowsByDept[dept].push(row)
    }
  }

  return {
    project: { id: project.id, name: project.name },
    callSheet,
    shootDay: {
      id: shootDay.id,
      date: shootDay.date,
      type: shootDay.type,
      locationName: primaryLocation?.name ?? null,
      locationAddress: primaryLocation?.address ?? null,
    },
    primaryLocation,
    schedule,
    productionRoles,
    talentRows,
    crewRowsByDept,
    clientRows,
    totalCrewCount: Object.values(crewRowsByDept).reduce((acc, rows) => acc + rows.length, 0),
    totalTalentCount: talentRows.length,
    totalClientCount: clientRows.length,
  }
}
