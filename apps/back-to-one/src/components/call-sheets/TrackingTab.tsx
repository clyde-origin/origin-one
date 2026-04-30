'use client'

import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  useCallSheetRecipients,
  useCallSheetDeliveries,
  keys,
} from '@/lib/hooks/useOriginOne'
import type { CallSheet, CallSheetDelivery, CallSheetRecipient, Location, ProjectTalent, Project, ScheduleBlock, ShootDay } from '@/types'
import { formatTime } from '@/lib/schedule/format-time'

type FilterChip = 'all' | 'confirmed' | 'declined' | 'outdated' | 'not_sent' | 'bounced'

type RecipientStatus =
  | 'draft' | 'scheduled' | 'sent' | 'delivered' | 'opened'
  | 'confirmed' | 'declined' | 'outdated' | 'bounced' | 'failed'

const STATUS_LABEL: Record<RecipientStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sent: 'Sent',
  delivered: 'Delivered',
  opened: 'Opened',
  confirmed: 'Confirmed',
  declined: 'Declined',
  outdated: 'Outdated',
  bounced: 'Bounced',
  failed: 'Failed',
}

const STATUS_HEX: Record<RecipientStatus, string> = {
  draft: '#62627a',
  scheduled: '#9ba6ff',
  sent: '#9ba6ff',
  delivered: '#9ba6ff',
  opened: '#fbbf24',
  confirmed: '#34d399',
  declined: '#f87171',
  outdated: '#fbbf24',
  bounced: '#f87171',
  failed: '#f87171',
}

function deriveRecipientStatus(deliveries: CallSheetDelivery[]): { badge: RecipientStatus; views: number } {
  if (deliveries.length === 0) return { badge: 'draft', views: 0 }
  const sorted = [...deliveries].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
  const latest = sorted[0]
  const views = deliveries.filter(d => d.openedAt).length
  if (latest.outdatedAt) return { badge: 'outdated', views }
  if (latest.declinedAt) return { badge: 'declined', views }
  if (latest.confirmedAt) return { badge: 'confirmed', views }
  if (latest.bouncedAt) return { badge: 'bounced', views }
  if (latest.status === 'failed') return { badge: 'failed', views }
  if (latest.openedAt) return { badge: 'opened', views }
  if (latest.deliveredAt) return { badge: 'delivered', views }
  if (latest.sentAt) return { badge: 'sent', views }
  if (latest.scheduledFor) return { badge: 'scheduled', views }
  return { badge: 'draft', views }
}

export function TrackingTab({
  callSheetId,
  talent,
  crew,
}: {
  callSheetId: string
  project: Project
  callSheet: CallSheet
  shootDay: ShootDay
  schedule: ScheduleBlock[]
  talent: ProjectTalent[]
  crew: any[]
  locations: Location[]
}) {
  const { data: recipients = [] } = useCallSheetRecipients(callSheetId)
  const { data: deliveries = [] } = useCallSheetDeliveries(callSheetId)
  const [filter, setFilter] = useState<FilterChip>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [resending, setResending] = useState(false)
  const qc = useQueryClient()

  const talentById = useMemo(() => new Map(talent.map(t => [t.id, t])), [talent])
  const memberById = useMemo(() => new Map((crew as any[]).map((m: any) => [m.id, m])), [crew])
  const deliveriesByRecipient = useMemo(() => {
    const map = new Map<string, CallSheetDelivery[]>()
    for (const d of deliveries as CallSheetDelivery[]) {
      const arr = map.get(d.recipientId) ?? []
      arr.push(d)
      map.set(d.recipientId, arr)
    }
    return map
  }, [deliveries])

  function rowDisplay(r: CallSheetRecipient): { name: string; role: string; email: string | null; phone: string | null; initials: string } {
    if (r.kind === 'talent' && r.talentId) {
      const t = talentById.get(r.talentId)
      if (t) return { name: t.name, role: t.role ?? 'Talent', email: t.email, phone: t.phone, initials: initialsOf(t.name) }
    }
    if ((r.kind === 'crew' || r.kind === 'client') && r.projectMemberId) {
      const m: any = memberById.get(r.projectMemberId)
      if (m) {
        const name = m.User?.name ?? '—'
        return { name, role: m.role ?? m.department ?? 'Crew', email: m.User?.email ?? null, phone: m.User?.phone ?? null, initials: initialsOf(name) }
      }
    }
    return {
      name: r.freeformName ?? '—',
      role: r.freeformRole ?? r.kind,
      email: r.freeformEmail,
      phone: r.freeformPhone,
      initials: initialsOf(r.freeformName ?? '—'),
    }
  }

  const filtered = useMemo(() => {
    return (recipients as CallSheetRecipient[])
      .filter(r => !r.excluded)
      .map(r => {
        const ds = deliveriesByRecipient.get(r.id) ?? []
        const status = deriveRecipientStatus(ds)
        const callTime = (() => {
          // pull from latest delivery snapshot if present
          const latest = ds[0]
          const snap = latest?.personalizedSnapshot as any
          return r.callTimeOverride ?? snap?.callTime ?? null
        })()
        return { recipient: r, status: status.badge, views: status.views, callTime, display: rowDisplay(r) }
      })
      .filter(row => {
        switch (filter) {
          case 'all': return true
          case 'confirmed': return row.status === 'confirmed'
          case 'declined': return row.status === 'declined'
          case 'outdated': return row.status === 'outdated'
          case 'bounced': return row.status === 'bounced' || row.status === 'failed'
          case 'not_sent': return row.status === 'draft' || row.status === 'scheduled'
        }
      })
  }, [recipients, deliveriesByRecipient, filter])

  const counts = useMemo(() => {
    const c = { confirmed: 0, declined: 0, outdated: 0, sent: 0, total: 0 }
    for (const r of (recipients as CallSheetRecipient[])) {
      if (r.excluded) continue
      c.total++
      const ds = deliveriesByRecipient.get(r.id) ?? []
      const s = deriveRecipientStatus(ds).badge
      if (s === 'confirmed') c.confirmed++
      if (s === 'declined') c.declined++
      if (s === 'outdated') c.outdated++
      if (['sent', 'delivered', 'opened'].includes(s)) c.sent++
    }
    return c
  }, [recipients, deliveriesByRecipient])

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function resendSelected() {
    if (selected.size === 0) return
    setResending(true)
    try {
      const res = await fetch(`/api/call-sheets/${callSheetId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientIds: Array.from(selected),
          channels: ['email'],
        }),
      })
      if (res.ok) {
        setSelected(new Set())
        qc.invalidateQueries({ queryKey: keys.callSheetDeliveries(callSheetId) })
      }
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="px-4 lg:px-8 pb-32 max-w-6xl mx-auto">
      {/* Counts */}
      <div className="flex items-center gap-4 text-xs mb-4 flex-wrap">
        <span className="text-white/55">
          <strong className="text-white">{counts.confirmed}</strong>
          <span className="text-white/40"> / {counts.total}</span>
          <span className="ml-1.5 text-white/55">confirmed</span>
        </span>
        {counts.outdated > 0 && (
          <span className="text-yellow-400">{counts.outdated} outdated</span>
        )}
        {counts.declined > 0 && (
          <span className="text-red-300">{counts.declined} declined</span>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {(['all', 'confirmed', 'outdated', 'declined', 'not_sent', 'bounced'] as FilterChip[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="font-mono uppercase tracking-wider text-[10px] px-3 py-1.5 rounded-full"
            style={{
              background: filter === f ? 'rgba(100,112,243,0.18)' : 'rgba(255,255,255,0.04)',
              color: filter === f ? '#9ba6ff' : '#a0a0b8',
              border: filter === f ? '1px solid rgba(100,112,243,0.45)' : '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <table className="w-full text-xs text-white">
          <thead>
            <tr className="bg-white/5 text-white/40 font-mono uppercase tracking-widest text-[9px]">
              <th className="text-left p-3 w-8"></th>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3 w-24">Call</th>
              <th className="text-left p-3 w-32">Status</th>
              <th className="text-left p-3 w-20">Viewed</th>
              <th className="text-left p-3 w-44">Email</th>
              <th className="text-left p-3 w-32">Phone</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="p-12 text-center text-white/40">No recipients match this filter.</td></tr>
            )}
            {filtered.map(row => {
              const sel = selected.has(row.recipient.id)
              const hex = STATUS_HEX[row.status]
              return (
                <tr key={row.recipient.id} className="border-t border-white/5">
                  <td className="p-3">
                    <input type="checkbox" checked={sel} onChange={() => toggleSelect(row.recipient.id)} />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold tracking-tight bg-white/10 border border-white/15">
                        {row.display.initials}
                      </div>
                      <div>
                        <div className="font-medium">{row.display.name}</div>
                        <div className="text-white/40 text-[10px]">{row.display.role}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 font-mono">{row.callTime ? formatTime(row.callTime) : '—'}</td>
                  <td className="p-3">
                    <span
                      className="font-mono uppercase text-[9px] tracking-widest px-2 py-0.5 rounded-full inline-flex items-center gap-1.5"
                      style={{ background: `${hex}1a`, color: hex, border: `1px solid ${hex}33` }}
                    >
                      {row.status === 'confirmed' && '✓ '}
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>
                  <td className="p-3 text-white/55">{row.views > 0 ? `${row.views} view${row.views > 1 ? 's' : ''}` : '0 views'}</td>
                  <td className="p-3 text-white/55 text-[11px] truncate">{row.display.email ?? '—'}</td>
                  <td className="p-3 text-white/55 text-[11px]">{row.display.phone ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Multi-select footer */}
      {selected.size > 0 && (
        <div className="fixed left-0 right-0 bottom-0 px-4 pb-6 pt-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)', background: 'linear-gradient(to top, rgba(4,4,10,0.95) 60%, transparent)' }}>
          <div className="max-w-2xl mx-auto bg-white/10 border border-white/20 rounded-2xl p-3 flex items-center justify-between backdrop-blur">
            <span className="text-sm text-white">{selected.size} selected</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setSelected(new Set())} className="text-xs text-white/60 px-3 py-1.5">Cancel</button>
              <button
                onClick={resendSelected}
                disabled={resending}
                className="bg-white text-black rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {resending ? 'Sending…' : 'Resend to selected'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('')
}
