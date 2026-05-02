'use client'

import { useEffect, useRef, useState } from 'react'
import { CrewAvatar } from '@/components/ui'
import { SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { useDetailSheetThreads } from '@/components/threads/useDetailSheetThreads'
import {
  formatDate, isUrgent, isLate, MILESTONE_STATUS_HEX,
} from '@/lib/utils/phase'
import {
  useUpdateUserPhone, useUpdateProjectMemberProfile, useUploadAvatar,
} from '@/lib/hooks/useOriginOne'
import type { ActionItem, Milestone, CrewMember } from '@/types'

// Hub detail sheets — opened when a tile is tapped. Three sheets share
// the same Sheet shell from ui/Sheet so the open animation, dismiss
// behavior, and topbar pattern stay consistent.

export function AIDetailSheet({ item, crew, onClose }: { item: ActionItem | null; crew: CrewMember[]; onClose: () => void }) {
  if (!item) return null
  const assignee = crew.find(c => c.userId === item.assignedTo)
  const late = item.dueDate ? isLate(item.dueDate) : false
  const urgent = item.dueDate ? isUrgent(item.dueDate) : false
  const dateLabel = item.dueDate ? formatDate(item.dueDate) : '—'
  const isDone = item.status === 'done'
  return (
    <>
      <SheetHeader title={item.title} onClose={onClose} />
      <SheetBody>
        <div className="flex items-center gap-2 mb-4 p-3 bg-surface2 rounded-lg border border-border">
          <div className={`w-2 h-2 rounded-full ${isDone ? 'bg-post' : 'bg-muted'}`} />
          <span className="font-mono text-sm text-text2">{isDone ? 'Completed' : 'Open'}</span>
          <span className={`font-mono text-xs ml-auto ${late ? 'text-red' : urgent ? 'text-pre' : 'text-muted'}`}>{dateLabel}</span>
        </div>
        {assignee && (
          <div className="mb-4">
            <span className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Assigned to</span>
            <div className="flex items-center gap-3 p-3 bg-surface2 rounded-lg border border-border">
              <CrewAvatar name={assignee.User?.name ?? 'Unknown'} size={32} avatarUrl={assignee.User?.avatarUrl} />
              <div>
                <div className="text-base font-semibold text-text">{assignee.User?.name ?? 'Unknown'}</div>
                <div className="font-mono text-xs text-muted">{assignee.role}</div>
              </div>
            </div>
          </div>
        )}
        {item.description && (
          <div className="mb-4">
            <span className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Notes</span>
            <div className="text-base text-text2 leading-relaxed p-3 bg-surface2 rounded-lg border border-border">{item.description}</div>
          </div>
        )}
      </SheetBody>
    </>
  )
}

export function MSDetailSheet({ milestone, crew, onClose }: { milestone: Milestone | null; crew: CrewMember[]; onClose: () => void }) {
  if (!milestone) return null
  const past = isLate(milestone.date)
  const people = (milestone.people ?? []).map(id => crew.find(c => c.userId === id)).filter(Boolean) as CrewMember[]
  const statusColor = MILESTONE_STATUS_HEX[milestone.status] ?? '#62627a'
  return (
    <>
      <SheetHeader title={milestone.title} onClose={onClose} />
      <SheetBody>
        <div className="flex items-center gap-2 mb-4 p-3 bg-surface2 rounded-lg border border-border">
          <div className="w-2 h-2 rounded-full" style={{ background: statusColor }} />
          <span className="font-mono text-[0.5rem] tracking-widest uppercase px-2 py-0.5 rounded-sm" style={{ background: `${statusColor}1a`, color: statusColor }}>{milestone.status}</span>
          <span className={`font-mono text-xs ml-auto ${past ? 'text-red' : 'text-muted'}`}>{formatDate(milestone.date)}</span>
        </div>
        {people.length > 0 && (
          <div className="mb-4">
            <span className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">People</span>
            <div className="flex flex-col gap-2">
              {people.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 bg-surface2 rounded-lg border border-border">
                  <CrewAvatar name={p.User?.name ?? 'Unknown'} size={32} avatarUrl={p.User?.avatarUrl} />
                  <div>
                    <div className="text-base font-semibold text-text">{p.User?.name ?? 'Unknown'}</div>
                    <div className="font-mono text-xs text-muted">{p.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {milestone.notes && (
          <div className="mb-4">
            <span className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Notes</span>
            <div className="text-base text-text2 leading-relaxed p-3 bg-surface2 rounded-lg border border-border">{milestone.notes}</div>
          </div>
        )}
      </SheetBody>
    </>
  )
}

export function CrewDetailSheet({ member, projectId, onClose }: { member: CrewMember | null; projectId: string; onClose: () => void }) {
  // `member` is structurally a ProjectMember row with nested User — pull the
  // new fields via a typed view of the same value.
  const m = member as any
  const name = m?.User?.name ?? 'Unknown'
  const userId: string | null = m?.userId ?? null
  const projectMemberId: string | null = m?.id ?? null
  const role: string = m?.role ?? ''
  const department: string | null = m?.department ?? null
  const initialAvatarUrl: string | null = m?.User?.avatarUrl ?? null
  const initialPhone: string = m?.User?.phone ?? ''
  const initialNotes: string = m?.notes ?? ''
  const initialSkills: string[] = (m?.skills as string[] | null | undefined) ?? []

  const { TriggerIcon, PreviewRow, MessageZone, StartSheetOverlay } = useDetailSheetThreads({
    projectId,
    attachedToType: 'crew',
    // Crew threads are keyed by userId (matches getCrew's crewById index and
    // existing seed data). NOT the ProjectMember row id.
    attachedToId: userId,
    subjectLabel: name,
  })

  const [phone, setPhone] = useState(initialPhone)
  const [notes, setNotes] = useState(initialNotes)
  const [skills, setSkills] = useState<string[]>(initialSkills)
  const [skillDraft, setSkillDraft] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    setPhone(initialPhone)
    setNotes(initialNotes)
    setSkills(initialSkills)
    setAvatarUrl(initialAvatarUrl)
    setSkillDraft('')
    setUploadError(null)
    setUploading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectMemberId])

  const updatePhone = useUpdateUserPhone(projectId)
  const updateProfile = useUpdateProjectMemberProfile(projectId)
  const uploadAvatar = useUploadAvatar(projectId)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!member) return null

  const handlePhoneBlur = () => {
    if (!userId) return
    if ((phone.trim() || null) === (initialPhone.trim() || null)) return
    updatePhone.mutate({ userId, phone: phone.trim() || null })
  }
  const handleNotesBlur = () => {
    if (!projectMemberId) return
    if ((notes.trim() || null) === (initialNotes.trim() || null)) return
    updateProfile.mutate({ projectMemberId, fields: { notes: notes.trim() || null } })
  }
  const commitSkills = (next: string[]) => {
    if (!projectMemberId) return
    setSkills(next)
    updateProfile.mutate({ projectMemberId, fields: { skills: next } })
  }
  const addSkill = () => {
    const v = skillDraft.trim()
    if (!v) return
    if (skills.includes(v)) { setSkillDraft(''); return }
    commitSkills([...skills, v])
    setSkillDraft('')
  }
  const removeSkill = (s: string) => commitSkills(skills.filter(x => x !== s))

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setUploading(true)
    setUploadError(null)
    try {
      const url = await uploadAvatar.mutateAsync({ file, userId })
      setAvatarUrl(url)
    } catch (err: any) {
      setUploadError(err?.message ?? 'Avatar upload failed.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const labelCls = "font-mono uppercase text-[10px] tracking-[0.08em] text-muted mb-1.5 block"
  const inputCls = "w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm text-text outline-none focus:border-borderStrong"

  return (
    <>
      <SheetHeader
        title={name}
        onClose={onClose}
        action={TriggerIcon}
      />
      <SheetBody>
        <div className="flex items-center gap-4 mb-4 p-3 bg-surface2 rounded-lg border border-border">
          <button
            onClick={() => !uploading && fileRef.current?.click()}
            disabled={uploading || !userId}
            aria-label={avatarUrl ? 'Change avatar' : 'Upload avatar'}
            style={{
              position: 'relative', width: 56, height: 56,
              borderRadius: '50%', overflow: 'hidden',
              padding: 0, border: 'none', background: 'transparent',
              cursor: uploading ? 'wait' : 'pointer', flexShrink: 0,
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
              />
            ) : (
              <CrewAvatar name={name} size={56} />
            )}
            <span
              style={{
                position: 'absolute', bottom: -2, right: -2,
                width: 22, height: 22, borderRadius: '50%',
                background: '#0a0a12', border: '1px solid rgba(255,255,255,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              {uploading ? (
                <span style={{
                  width: 12, height: 12,
                  border: '2px solid rgba(255,255,255,0.18)',
                  borderTopColor: 'rgba(255,255,255,0.7)',
                  borderRadius: '50%',
                  animation: 'cps-spin 0.9s linear infinite',
                }}>
                  <style>{`@keyframes cps-spin { to { transform: rotate(360deg); } }`}</style>
                </span>
              ) : (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              )}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: 'none' }}
            onChange={handleAvatarPick}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="text-lg font-semibold text-text">{name}</div>
            <div className="font-mono text-xs text-muted" style={{ textTransform: 'capitalize' }}>
              {role}{department ? ` · ${department}` : ''}
            </div>
          </div>
        </div>

        {uploadError && (
          <div style={{
            marginBottom: 14, padding: '8px 10px', borderRadius: 8,
            background: 'rgba(232,72,72,0.06)', border: '0.5px solid rgba(232,72,72,0.25)',
            color: 'rgba(232,72,72,0.9)', fontFamily: "'Geist Mono', ui-monospace, monospace",
            fontSize: 11, letterSpacing: '0.04em',
          }}>
            {uploadError}
          </div>
        )}

        <div className="mb-4">
          <label className={labelCls}>Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={handlePhoneBlur}
            placeholder="+1 (555) 555-0000"
            autoComplete="tel"
            className={inputCls}
          />
        </div>

        <div className="mb-4">
          <label className={labelCls}>Skills</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {skills.length === 0 ? (
              <span className="font-mono text-xs text-faint">No skills listed yet.</span>
            ) : skills.map(s => (
              <span
                key={s}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '3px 4px 3px 10px', borderRadius: 999,
                  background: 'rgba(255,255,255,0.05)',
                  border: '0.5px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: 12,
                }}
              >
                {s}
                <button
                  onClick={() => removeSkill(s)}
                  aria-label={`Remove skill ${s}`}
                  style={{
                    width: 16, height: 16, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.5)',
                    fontSize: 11, lineHeight: 1, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >×</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={skillDraft}
              onChange={(e) => setSkillDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }}
              placeholder="Add a skill"
              className={inputCls}
              style={{ flex: 1 }}
            />
            <button
              onClick={addSkill}
              disabled={!skillDraft.trim()}
              className="font-mono uppercase text-xs"
              style={{
                padding: '0 14px', borderRadius: 6,
                background: skillDraft.trim() ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                border: '0.5px solid rgba(255,255,255,0.14)',
                color: skillDraft.trim() ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)',
                cursor: skillDraft.trim() ? 'pointer' : 'not-allowed',
                letterSpacing: '0.06em',
              }}
            >Add</button>
          </div>
        </div>

        <div className="mb-4">
          <label className={labelCls}>Notes <span className="text-faint normal-case tracking-normal">(this project)</span></label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Production-relevant context for this person on this project."
            rows={3}
            className={inputCls}
            style={{ resize: 'none', lineHeight: 1.5 }}
          />
        </div>

        {PreviewRow}
      </SheetBody>
      {MessageZone}
      {StartSheetOverlay}
    </>
  )
}
