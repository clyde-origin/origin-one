// POST /c/[token]/confirm with form-data { action: 'confirm' | 'decline' }
// Sets confirmedAt or declinedAt on the matching delivery and redirects
// back to the public landing page where the recipient sees their state.
//
// Defense: this is an unauthenticated state-change endpoint reached only
// by the confirmToken. Two checks before mutating:
//   - Same-origin POST (CSRF) — refuses third-party auto-submits.
//   - Expiry — refuses access past shoot date + EXPIRY_GRACE_DAYS.

import { NextResponse } from 'next/server'
import { getCallSheetAdminClient } from '@/lib/call-sheet/admin-client'
import {
  isCallSheetAccessExpired,
  isSameOriginRequest,
  loadDeliveryForToken,
} from '@/lib/call-sheet/token-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: { token: string } }) {
  if (!isSameOriginRequest(req)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const delivery = await loadDeliveryForToken(params.token)
  if (!delivery) {
    return new NextResponse('Link expired or invalid.', { status: 404 })
  }
  if (isCallSheetAccessExpired(delivery.shootDate)) {
    return new NextResponse('Link expired.', { status: 410 })
  }

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
    }).eq('id', delivery.id)
  } else if (action === 'decline') {
    await db.from('CallSheetDelivery').update({
      declinedAt: now,
      confirmedAt: null,
      clickedAt: now,
      updatedAt: now,
    }).eq('id', delivery.id)
  }

  const url = new URL(`/c/${params.token}`, req.url)
  return NextResponse.redirect(url, 303)
}
