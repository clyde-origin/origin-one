// Pure: builds the default recipient list for a brand-new CallSheet.
// Includes all Talent + all ProjectMembers EXCEPT post-only departments.

import { isPostOnlyDepartment } from '@/lib/auth/call-sheet-permissions'

export type SeedTalent = {
  id: string
  email: string | null
  phone: string | null
}

export type SeedMember = {
  id: string
  department: string | null
  email: string | null
  phone: string | null
}

export type SeedRecipientRow = {
  callSheetId: string
  kind: 'talent' | 'crew' | 'client'
  talentId: string | null
  projectMemberId: string | null
  sendEmail: boolean
  sendSms: boolean
}

export function buildDefaultRecipients(input: {
  callSheetId: string
  talent: SeedTalent[]
  members: SeedMember[]
}): SeedRecipientRow[] {
  const talentRecipients: SeedRecipientRow[] = input.talent.map(t => ({
    callSheetId: input.callSheetId,
    kind: 'talent',
    talentId: t.id,
    projectMemberId: null,
    sendEmail: !!t.email,
    sendSms: !!t.phone,
  }))

  const memberRecipients: SeedRecipientRow[] = input.members
    .filter(m => !isPostOnlyDepartment(m.department))
    .map(m => ({
      callSheetId: input.callSheetId,
      kind: m.department === 'Client' ? 'client' : 'crew',
      talentId: null,
      projectMemberId: m.id,
      sendEmail: !!m.email,
      sendSms: !!m.phone,
    }))

  return [...talentRecipients, ...memberRecipients]
}
