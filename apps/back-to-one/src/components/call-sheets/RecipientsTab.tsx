'use client'

import type { ProjectTalent } from '@/types'

export function RecipientsTab(_props: {
  projectId: string
  callSheetId: string
  talent: ProjectTalent[]
  crew: any[]
}) {
  return (
    <div className="px-4 py-12 text-center text-white/40 max-w-2xl mx-auto">
      Recipients UI lands in Arc C. The schema is in place; the table and send dialog are coming next.
    </div>
  )
}
