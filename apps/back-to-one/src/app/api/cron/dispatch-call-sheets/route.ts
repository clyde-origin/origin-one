import { NextResponse } from 'next/server'
import { dispatchPendingDeliveries } from '@/lib/call-sheet/dispatch'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Vercel Cron — `vercel.json` is configured to GET this path every minute.
// The CRON_SECRET is automatically set by Vercel for cron requests; in dev
// any caller can hit this endpoint.

export async function GET(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }
  }
  try {
    const result = await dispatchPendingDeliveries()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
