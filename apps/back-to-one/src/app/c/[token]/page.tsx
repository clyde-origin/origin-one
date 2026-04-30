// Public confirm/decline landing — accessible without auth. The token
// is the CallSheetDelivery.confirmToken issued at send time.

import Link from 'next/link'
import { getCallSheetAdminClient } from '@/lib/call-sheet/admin-client'
import { formatTime } from '@/lib/schedule/format-time'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const SHORT_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatShootDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const date = new Date(Date.UTC(y, m - 1, d))
  return `${DOW[date.getUTCDay()]}, ${SHORT_MONTH[date.getUTCMonth()]} ${d}, ${y}`
}

export const dynamic = 'force-dynamic'

export default async function ConfirmLanding({ params }: { params: { token: string } }) {
  const db = getCallSheetAdminClient()
  const { data: delivery } = await db
    .from('CallSheetDelivery')
    .select(`
      id, confirmedAt, declinedAt, openedAt,
      personalizedSnapshot,
      CallSheetRecipient!inner(
        id, kind, freeformName,
        Talent(name),
        ProjectMember(role, User(name)),
        CallSheet!inner(id, title, productionNotes, parkingNotes, ShootDay!inner(date, type, Location(name, address)), Project(name))
      )
    `)
    .eq('confirmToken', params.token)
    .maybeSingle()

  if (!delivery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#04040a] text-white p-6">
        <div className="text-center">
          <h1 className="text-xl font-medium mb-2">Link expired or invalid</h1>
          <p className="text-white/50 text-sm">If you think this is a mistake, contact production.</p>
        </div>
      </div>
    )
  }

  // Mark opened on first land
  if (!delivery.openedAt) {
    await db.from('CallSheetDelivery').update({
      openedAt: new Date().toISOString(),
      status: 'opened',
      updatedAt: new Date().toISOString(),
    }).eq('id', delivery.id)
  }

  const r: any = delivery.CallSheetRecipient
  const cs: any = r?.CallSheet
  const sd: any = cs?.ShootDay
  const project: any = cs?.Project

  const recipientName = r?.Talent?.name ?? r?.ProjectMember?.User?.name ?? r?.freeformName ?? 'There'
  const callTime = (delivery.personalizedSnapshot as any)?.callTime ?? null
  const setAddress = sd?.Location?.address ?? null
  const isConfirmed = !!delivery.confirmedAt
  const isDeclined = !!delivery.declinedAt

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#04040a] text-white p-6">
      <div className="max-w-md w-full text-center">
        <div className="font-mono uppercase tracking-widest text-[10px] text-white/40 mb-2">{project?.name ?? ''}</div>
        <h1 className="text-2xl font-semibold mb-2">{cs?.title || 'Call Sheet'}</h1>
        <p className="text-white/60 mb-1">{sd?.date ? formatShootDate(sd.date) : ''}</p>

        <p className="text-sm text-white/55 mt-6 mb-1">Hi {recipientName},</p>
        <p className="text-white/40 text-xs uppercase tracking-widest mt-2 mb-1">Your Call Time</p>
        <p className="text-5xl font-light mb-6">{callTime ? formatTime(callTime) : '—'}</p>

        {setAddress && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 text-left">
            <p className="font-mono uppercase tracking-widest text-[10px] text-white/40 mb-1">Location</p>
            <p className="text-sm text-white whitespace-pre-line">{setAddress}</p>
          </div>
        )}

        {!isConfirmed && !isDeclined && (
          <form method="POST" action={`/c/${params.token}/confirm`} className="flex gap-3 justify-center">
            <button name="action" value="confirm" className="bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl px-7 py-3 font-medium">
              Confirm
            </button>
            <button name="action" value="decline" className="bg-white/10 hover:bg-white/15 text-white/85 rounded-xl px-7 py-3 font-medium border border-white/15">
              Decline
            </button>
          </form>
        )}
        {isConfirmed && (
          <div className="text-emerald-400 text-base font-medium">
            ✓ Confirmed
            <form method="POST" action={`/c/${params.token}/confirm`} className="mt-3">
              <button name="action" value="decline" className="text-white/40 text-xs underline hover:text-white/70">Change to Decline</button>
            </form>
          </div>
        )}
        {isDeclined && (
          <div className="text-red-300 text-base font-medium">
            Declined
            <form method="POST" action={`/c/${params.token}/confirm`} className="mt-3">
              <button name="action" value="confirm" className="text-white/40 text-xs underline hover:text-white/70">Change to Confirm</button>
            </form>
          </div>
        )}

        <Link href={`/c/${params.token}/view`} className="block mt-8 text-white/55 underline text-sm">
          See full call sheet
        </Link>

        {(cs?.productionNotes || cs?.parkingNotes) && (
          <div className="mt-8 text-left bg-white/5 border border-white/10 rounded-2xl p-4 text-sm">
            {cs.productionNotes && (
              <>
                <p className="font-mono uppercase tracking-widest text-[10px] text-white/40 mb-1">Production Notes</p>
                <p className="whitespace-pre-line text-white/85 mb-3">{cs.productionNotes}</p>
              </>
            )}
            {cs.parkingNotes && (
              <>
                <p className="font-mono uppercase tracking-widest text-[10px] text-white/40 mb-1">Parking</p>
                <p className="whitespace-pre-line text-white/85">{cs.parkingNotes}</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
