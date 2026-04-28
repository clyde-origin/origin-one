'use client'

import { useState } from 'react'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'

const ROLES = ['crew', 'producer', 'director', 'coordinator', 'writer'] as const
type RoleOption = typeof ROLES[number]

export function InviteCrewSheet({
  projectId, open, onClose, onSuccess,
}: {
  projectId: string
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<RoleOption>('crew')
  const [department, setDepartment] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const res = await fetch(`/projects/${projectId}/crew/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        role,
        department: department || null,
      }),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) {
      setMsg({ kind: 'err', text: data.error ?? 'Invite failed' })
      return
    }
    setMsg({ kind: 'ok', text: `Invite sent to ${email}` })
    setName(''); setEmail(''); setDepartment(''); setRole('crew')
    onSuccess?.()
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader title="Invite crew" onClose={onClose} />
      <SheetBody>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
          <input required value={name} onChange={e => setName(e.target.value)} placeholder="Full name"
            style={{ padding: '11px 12px', background: '#0a0a14', border: '1px solid #1a1a28', color: '#dddde8', borderRadius: 8, fontSize: 14, outline: 'none' }} />
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com"
            autoComplete="off"
            style={{ padding: '11px 12px', background: '#0a0a14', border: '1px solid #1a1a28', color: '#dddde8', borderRadius: 8, fontSize: 14, outline: 'none' }} />
          <select value={role} onChange={e => setRole(e.target.value as RoleOption)}
            style={{ padding: '11px 12px', background: '#0a0a14', border: '1px solid #1a1a28', color: '#dddde8', borderRadius: 8, fontSize: 14, outline: 'none' }}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <input value={department} onChange={e => setDepartment(e.target.value)} placeholder="Department (optional)"
            style={{ padding: '11px 12px', background: '#0a0a14', border: '1px solid #1a1a28', color: '#dddde8', borderRadius: 8, fontSize: 14, outline: 'none' }} />
          <button type="submit" disabled={busy} style={{
            padding: '11px 12px', background: '#6470f3', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
            opacity: busy ? 0.6 : 1, cursor: busy ? 'wait' : 'pointer',
          }}>
            Send invite
          </button>
          {msg && <div style={{ fontSize: 12, color: msg.kind === 'ok' ? '#00b894' : '#e8a020', textAlign: 'center' }}>{msg.text}</div>}
        </form>
      </SheetBody>
    </Sheet>
  )
}
