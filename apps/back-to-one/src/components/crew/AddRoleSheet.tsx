'use client'

import { useState } from 'react'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'

const ROLES = ['crew', 'producer', 'director', 'coordinator', 'writer'] as const
type RoleOption = typeof ROLES[number]

export function AddRoleSheet({
  projectId, memberId, memberName, open, onClose, onSuccess,
}: {
  projectId: string
  memberId: string
  memberName: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [role, setRole] = useState<RoleOption>('crew')
  const [department, setDepartment] = useState('')
  const [canEdit, setCanEdit] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const res = await fetch(`/projects/${projectId}/crew/${memberId}/add-role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, department: department || null, canEdit }),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) {
      setMsg({ kind: 'err', text: data.error ?? 'Add-role failed' })
      return
    }
    setMsg({ kind: 'ok', text: `Added ${role} role to ${memberName}` })
    onSuccess()
    setTimeout(onClose, 800)
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader title={`Add role to ${memberName}`} onClose={onClose} />
      <SheetBody>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
          <select value={role} onChange={e => setRole(e.target.value as RoleOption)}
            style={{ padding: '11px 12px', background: '#0a0a14', border: '1px solid #1a1a28', color: '#dddde8', borderRadius: 8, fontSize: 14, outline: 'none' }}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <input value={department} onChange={e => setDepartment(e.target.value)} placeholder="Department (optional)"
            style={{ padding: '11px 12px', background: '#0a0a14', border: '1px solid #1a1a28', color: '#dddde8', borderRadius: 8, fontSize: 14, outline: 'none' }} />
          <label style={{ fontSize: 12, color: '#a0a0b0', display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px' }}>
            <input type="checkbox" checked={canEdit} onChange={e => setCanEdit(e.target.checked)} />
            Trusted contributor (can edit high-trust surfaces)
          </label>
          <button type="submit" disabled={busy} style={{
            padding: '11px 12px', background: '#6470f3', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
            opacity: busy ? 0.6 : 1, cursor: busy ? 'wait' : 'pointer',
          }}>
            Add role
          </button>
          {msg && <div style={{ fontSize: 12, color: msg.kind === 'ok' ? '#00b894' : '#e8a020', textAlign: 'center' }}>{msg.text}</div>}
        </form>
      </SheetBody>
    </Sheet>
  )
}
