'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { keys } from '@/lib/hooks/useOriginOne'

export function SendDialog({
  open,
  onClose,
  callSheetId,
}: {
  open: boolean
  onClose: () => void
  callSheetId: string
}) {
  const [mode, setMode] = useState<'now' | 'schedule'>('now')
  const [scheduledFor, setScheduledFor] = useState<string>('')
  const [includeEmail, setIncludeEmail] = useState(true)
  const [includeSms, setIncludeSms] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const qc = useQueryClient()

  async function submit() {
    if (!includeEmail && !includeSms) {
      setResult({ ok: false, message: 'Pick at least one channel.' })
      return
    }
    setSubmitting(true)
    setResult(null)
    try {
      const channels: ('email' | 'sms')[] = []
      if (includeEmail) channels.push('email')
      if (includeSms) channels.push('sms')

      const body: Record<string, unknown> = { channels }
      if (mode === 'schedule' && scheduledFor) {
        body.scheduledFor = new Date(scheduledFor).toISOString()
      }

      const res = await fetch(`/api/call-sheets/${callSheetId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setResult({ ok: false, message: data?.error ?? `HTTP ${res.status}` })
      } else {
        const queued = data?.queued ?? 0
        const immediate = data?.immediate
        const sentNow = immediate?.sent ?? 0
        const errs = immediate?.errors ?? 0
        let msg = ''
        if (mode === 'now') {
          msg = `Queued ${queued}, sent ${sentNow}` + (errs > 0 ? `, ${errs} failed` : '')
        } else {
          msg = `Queued ${queued} for ${new Date(scheduledFor).toLocaleString()}`
        }
        setResult({ ok: true, message: msg })
        qc.invalidateQueries({ queryKey: keys.callSheetDeliveries(callSheetId) })
        qc.invalidateQueries({ queryKey: keys.callSheet(callSheetId) })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error'
      setResult({ ok: false, message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader title="Send Call Sheet" onClose={onClose} />
      <SheetBody>
        <div className="flex flex-col gap-4 pb-2">
          {/* Channels */}
          <div>
            <p className="font-mono uppercase tracking-wider text-[10px] text-white/40 mb-2">Channels</p>
            <div className="grid grid-cols-2 gap-2">
              <label className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm border ${includeEmail ? 'bg-white/15 border-white/30' : 'bg-white/5 border-white/10'}`}>
                <input type="checkbox" checked={includeEmail} onChange={e => setIncludeEmail(e.target.checked)} />
                <span>Email</span>
              </label>
              <label className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm border ${includeSms ? 'bg-white/15 border-white/30' : 'bg-white/5 border-white/10'}`}>
                <input type="checkbox" checked={includeSms} onChange={e => setIncludeSms(e.target.checked)} />
                <span>SMS</span>
              </label>
            </div>
          </div>

          {/* When */}
          <div>
            <p className="font-mono uppercase tracking-wider text-[10px] text-white/40 mb-2">When</p>
            <div className="grid grid-cols-2 gap-2">
              {(['now', 'schedule'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-lg px-3 py-2.5 text-sm border ${mode === m ? 'bg-white/15 border-white/30 text-white' : 'bg-white/5 border-white/10 text-white/60'}`}
                >
                  {m === 'now' ? 'Send now' : 'Schedule for…'}
                </button>
              ))}
            </div>
            {mode === 'schedule' && (
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={e => setScheduledFor(e.target.value)}
                className="mt-2 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white"
              />
            )}
          </div>

          {/* Note about stub mode */}
          <p className="text-xs text-white/40 leading-relaxed">
            Without RESEND_API_KEY / TWILIO_* env vars, sends fall back to <strong>stub provider</strong>: payloads
            log to the server console and the delivery row writes through, so the tracking tab populates
            even before you wire credentials.
          </p>

          <button
            onClick={submit}
            disabled={submitting || (mode === 'schedule' && !scheduledFor)}
            className="bg-white text-black rounded-xl py-3 font-medium disabled:opacity-40"
          >
            {submitting ? 'Working…' : mode === 'now' ? 'Send now' : 'Schedule send'}
          </button>

          {result && (
            <p className={`text-sm ${result.ok ? 'text-emerald-400' : 'text-red-300'}`}>{result.message}</p>
          )}
        </div>
      </SheetBody>
    </Sheet>
  )
}
