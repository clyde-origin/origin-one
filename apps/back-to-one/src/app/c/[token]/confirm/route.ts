// POST /c/[token]/confirm with form-data { action: 'confirm' | 'decline' }
// Sets confirmedAt or declinedAt on the matching delivery and redirects
// back to the public landing page where the recipient sees their state.

import { NextResponse } from 'next/server'
import { getCallSheetAdminClient } from '@/lib/call-sheet/admin-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const formData = await req.formData()
  const action = formData.get('action')
  const db = getCallSheetAdminClient()
  const now = new Date().toISOString()

  if (action === 'confirm') {
    await db.from('CallSheetDelivery').update({
      confirmedAt: now,
      declinedAt: null,
      clickedAt: now,
      updatedAt: now,
    }).eq('confirmToken', params.token)
  } else if (action === 'decline') {
    await db.from('CallSheetDelivery').update({
      declinedAt: now,
      confirmedAt: null,
      clickedAt: now,
      updatedAt: now,
    }).eq('confirmToken', params.token)
  }

  const url = new URL(`/c/${params.token}`, req.url)
  return NextResponse.redirect(url, 303)
}
