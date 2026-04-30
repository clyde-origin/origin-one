'use client'

import { useMemo, useState } from 'react'
import { useCallSheetRecipients, useUpdateCallSheetRecipient, useDeleteCallSheetRecipient, useAddCallSheetRecipient } from '@/lib/hooks/useOriginOne'
import type { ProjectTalent, CallSheetRecipient } from '@/types'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { SendDialog } from './SendDialog'

type TalentMap = Map<string, ProjectTalent>
type MemberMap = Map<string, any>

export function RecipientsTab({
  projectId,
  callSheetId,
  talent,
  crew,
}: {
  projectId: string
  callSheetId: string
  talent: ProjectTalent[]
  crew: any[]
}) {
  const { data: recipients = [], isLoading } = useCallSheetRecipients(callSheetId)
  const update = useUpdateCallSheetRecipient(callSheetId)
  const del = useDeleteCallSheetRecipient(callSheetId)
  const addMut = useAddCallSheetRecipient(callSheetId)

  const [sendOpen, setSendOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const talentById: TalentMap = useMemo(() => new Map(talent.map(t => [t.id, t])), [talent])
  const memberById: MemberMap = useMemo(() => new Map((crew as any[]).map((m: any) => [m.id, m])), [crew])

  function rowDisplay(r: CallSheetRecipient): { name: string; role: string; email: string | null; phone: string | null } {
    if (r.kind === 'talent' && r.talentId) {
      const t = talentById.get(r.talentId)
      if (t) return { name: t.name, role: t.role ?? 'Talent', email: t.email, phone: t.phone }
    }
    if ((r.kind === 'crew' || r.kind === 'client') && r.projectMemberId) {
      const m: any = memberById.get(r.projectMemberId)
      if (m) {
        const name = m.User?.name ?? '—'
        const role = m.role ?? m.department ?? 'Crew'
        return { name, role, email: m.User?.email ?? null, phone: m.User?.phone ?? null }
      }
    }
    return {
      name: r.freeformName ?? '—',
      role: r.freeformRole ?? r.kind,
      email: r.freeformEmail,
      phone: r.freeformPhone,
    }
  }

  if (isLoading) {
    return <div className="p-6 text-white/40 text-center">Loading recipients…</div>
  }

  const eligibleCount = recipients.filter(r => !r.excluded && (r.sendEmail || r.sendSms)).length

  return (
    <div className="px-4 lg:px-8 pb-32 max-w-5xl mx-auto">
      {/* Header actions */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="text-sm text-white/60">
          <span className="font-mono uppercase tracking-wider text-[10px] text-white/40">Recipients</span>
          <span className="ml-2">{recipients.length} total · {eligibleCount} eligible to send</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAddOpen(true)}
            className="text-xs font-medium text-white/70 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 hover:bg-white/10"
          >
            + Add
          </button>
          <button
            onClick={() => setSendOpen(true)}
            className="text-xs font-semibold text-black bg-white rounded-lg px-3 py-1.5 disabled:opacity-40"
            disabled={eligibleCount === 0}
          >
            Send / Schedule
          </button>
        </div>
      </div>

      {recipients.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center text-white/40">
          No recipients yet. Tap "+ Add" to add one.
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
          <table className="w-full text-xs text-white">
            <thead>
              <tr className="bg-white/5 text-white/40 font-mono uppercase tracking-widest text-[9px]">
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3 w-16">Email</th>
                <th className="text-left p-3 w-16">SMS</th>
                <th className="text-left p-3 w-32">Override</th>
                <th className="text-left p-3 w-16">Excl.</th>
                <th className="text-left p-3 w-44">Email</th>
                <th className="text-left p-3 w-32">Phone</th>
                <th className="p-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {recipients.map(r => {
                const d = rowDisplay(r)
                return (
                  <tr key={r.id} className={`border-t border-white/5 ${r.excluded ? 'opacity-40' : ''}`}>
                    <td className="p-3">
                      <div className="font-medium">{d.name}</div>
                      <div className="text-white/40 text-[11px] mt-0.5">{d.role}</div>
                    </td>
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={r.sendEmail}
                        onChange={e => update.mutate({ id: r.id, fields: { sendEmail: e.target.checked } })}
                        disabled={!d.email}
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={r.sendSms}
                        onChange={e => update.mutate({ id: r.id, fields: { sendSms: e.target.checked } })}
                        disabled={!d.phone}
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="time"
                        value={r.callTimeOverride ?? ''}
                        onChange={e => update.mutate({ id: r.id, fields: { callTimeOverride: e.target.value || null } })}
                        className="bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] w-24"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={r.excluded}
                        onChange={e => update.mutate({ id: r.id, fields: { excluded: e.target.checked } })}
                      />
                    </td>
                    <td className="p-3 text-white/55 text-[11px] truncate">{d.email ?? '—'}</td>
                    <td className="p-3 text-white/55 text-[11px]">{d.phone ?? '—'}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          if (confirm('Remove this recipient?')) del.mutate(r.id)
                        }}
                        className="text-white/40 hover:text-red-300 text-base leading-none"
                        title="Remove"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <SendDialog
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        callSheetId={callSheetId}
      />

      <AddRecipientSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        callSheetId={callSheetId}
        talent={talent}
        crew={crew}
        onAdded={() => setAddOpen(false)}
      />
    </div>
  )
}

function AddRecipientSheet({
  open, onClose, callSheetId, talent, crew, onAdded,
}: {
  open: boolean
  onClose: () => void
  callSheetId: string
  talent: ProjectTalent[]
  crew: any[]
  onAdded: () => void
}) {
  const addMut = useAddCallSheetRecipient(callSheetId)
  const [mode, setMode] = useState<'talent' | 'crew' | 'freeform'>('freeform')
  const [pickedId, setPickedId] = useState<string>('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('')

  async function add() {
    if (mode === 'talent' && pickedId) {
      const t = talent.find(x => x.id === pickedId)
      if (t) {
        await addMut.mutateAsync({
          callSheetId,
          kind: 'talent',
          talentId: t.id,
          sendEmail: !!t.email,
          sendSms: !!t.phone,
        })
      }
    } else if (mode === 'crew' && pickedId) {
      const m: any = (crew as any[]).find((c: any) => c.id === pickedId)
      if (m) {
        await addMut.mutateAsync({
          callSheetId,
          kind: m.department === 'Client' ? 'client' : 'crew',
          projectMemberId: m.id,
          sendEmail: !!m.User?.email,
          sendSms: !!m.User?.phone,
        })
      }
    } else if (mode === 'freeform' && name.trim()) {
      await addMut.mutateAsync({
        callSheetId,
        kind: 'freeform',
        freeformName: name.trim(),
        freeformEmail: email.trim() || null,
        freeformPhone: phone.trim() || null,
        freeformRole: role.trim() || null,
        sendEmail: !!email.trim(),
        sendSms: !!phone.trim(),
      })
    }
    onAdded()
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader title="Add Recipient" onClose={onClose} />
      <SheetBody>
        <div className="flex flex-col gap-4 pb-2">
          <div className="grid grid-cols-3 gap-2">
            {(['talent', 'crew', 'freeform'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-lg px-3 py-2 text-sm border transition-colors ${
                  mode === m ? 'bg-white/15 border-white/30 text-white' : 'bg-white/5 border-white/10 text-white/60'
                }`}
              >
                {m === 'freeform' ? 'Free-form' : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          {mode === 'talent' && (
            <select
              value={pickedId}
              onChange={e => setPickedId(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white"
            >
              <option value="">Pick a talent…</option>
              {talent.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}

          {mode === 'crew' && (
            <select
              value={pickedId}
              onChange={e => setPickedId(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white"
            >
              <option value="">Pick a crew member…</option>
              {(crew as any[]).map((c: any) => (
                <option key={c.id} value={c.id}>{c.User?.name ?? '—'} — {c.role ?? c.department}</option>
              ))}
            </select>
          )}

          {mode === 'freeform' && (
            <>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white" />
              <input value={role} onChange={e => setRole(e.target.value)} placeholder="Role (optional)" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white" />
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white" />
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone (E.164 e.g. +13105551234)" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white" />
            </>
          )}

          <button
            onClick={add}
            disabled={addMut.isPending || (mode === 'freeform' ? !name.trim() : !pickedId)}
            className="bg-white text-black rounded-xl py-3 font-medium disabled:opacity-40"
          >
            Add recipient
          </button>
        </div>
      </SheetBody>
    </Sheet>
  )
}
