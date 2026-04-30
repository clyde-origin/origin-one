// 1x1 transparent GIF tracking pixel. Email templates embed
// <img src="{appUrl}/c/{token}/pixel.gif"> — first request marks
// the matching CallSheetDelivery row as opened.

import { NextResponse } from 'next/server'
import { getCallSheetAdminClient } from '@/lib/call-sheet/admin-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TRANSPARENT_GIF = Buffer.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
])

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  try {
    const db = getCallSheetAdminClient()
    const now = new Date().toISOString()
    // Only set openedAt if not already set + bump status to 'opened' if currently 'sent'/'delivered'
    await db.from('CallSheetDelivery')
      .update({ openedAt: now, status: 'opened', updatedAt: now })
      .eq('confirmToken', params.token)
      .is('openedAt', null)
  } catch (err) {
    console.error('[pixel] update failed:', err)
  }
  return new NextResponse(TRANSPARENT_GIF, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
