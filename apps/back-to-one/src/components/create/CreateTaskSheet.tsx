'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/utils/haptics'
import { DEPARTMENTS } from '@/lib/utils/phase'
import type { TeamMember, ActionItemStatus } from '@/types'

interface CreateTaskSheetProps {
  open: boolean
  projectId: string
  accent: string
  crew: TeamMember[]
  onSave: (data: { projectId: string; title: string; assignedTo: string | null; department: string | null; dueDate: string | null; description: string; status: ActionItemStatus }) => void
  onClose: () => void
}

export function CreateTaskSheet({ open, projectId, accent, crew, onSave, onClose }: CreateTaskSheetProps) {
  const [title, setTitle] = useState('')
  const [assignedTo, setAssignedTo] = useState<string | null>(null)
  const [department, setDepartment] = useState<string | null>(null)
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')
  const [showAssigneePicker, setShowAssigneePicker] = useState(false)

  const canSave = title.trim().length > 0
  const assigneeName = assignedTo ? crew.find(c => c.userId === assignedTo)?.User?.name ?? 'Unknown' : 'Unassigned'

  function handleSave() {
    if (!canSave) return
    haptic('light')
    onSave({ projectId, title: title.trim(), assignedTo, department, dueDate: dueDate || null, description, status: 'open' })
    resetForm()
  }

  function handleClose() {
    onClose()
    resetForm()
  }

  function resetForm() {
    setTitle(''); setAssignedTo(null); setDepartment(null); setDueDate(''); setDescription(''); setShowAssigneePicker(false)
  }

  function handleDragEnd(_: unknown, info: { offset: { y: number } }) {
    if (info.offset.y > 100) handleClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="task-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
          />

          <motion.div
            key="task-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 51,
              background: '#0e0e1a', borderRadius: '20px 20px 0 0',
              maxHeight: 'calc(100dvh - 100px)', overflowY: 'auto',
              paddingBottom: 'env(safe-area-inset-bottom, 24px)',
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '12px auto 0' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: '#dddde8' }}>New Action Item</span>
              <button
                onClick={handleSave}
                style={{
                  fontFamily: 'var(--font-geist-mono)', fontSize: '0.48rem', letterSpacing: '0.06em', textTransform: 'uppercase',
                  padding: '5px 10px', borderRadius: 20, cursor: canSave ? 'pointer' : 'default',
                  background: canSave ? `${accent}1a` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${canSave ? `${accent}40` : 'rgba(255,255,255,0.05)'}`,
                  color: canSave ? accent : '#62627a',
                }}
              >Save</button>
            </div>

            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Title */}
              <div>
                <label className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Task title</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs to be done?"
                  autoFocus autoComplete="off" spellCheck={false}
                  className="w-full outline-none focus:border-white/20"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7, padding: '10px 12px', color: '#dddde8', fontSize: '0.82rem' }}
                />
              </div>

              {/* Due date */}
              <div>
                <label className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Due date</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="w-full outline-none focus:border-white/20"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7, padding: '10px 12px', color: '#dddde8', fontSize: '0.78rem', fontFamily: 'var(--font-geist-mono)' }}
                />
              </div>

              {/* Assignee — compact dropdown trigger */}
              <div style={{ position: 'relative' }}>
                <label className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Assignee</label>
                <button
                  onClick={() => setShowAssigneePicker(!showAssigneePicker)}
                  className="w-full text-left"
                  style={{
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7,
                    padding: '10px 12px', color: assignedTo ? '#dddde8' : '#62627a', fontSize: '0.78rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  <span>{assigneeName}</span>
                  <svg width="8" height="5" viewBox="0 0 8 5" fill="none" style={{ opacity: 0.4 }}><path d="M1 1L4 4L7 1" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                {showAssigneePicker && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: 4,
                    background: '#151520', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                    maxHeight: 180, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  }}>
                    <div
                      onClick={() => { setAssignedTo(null); setShowAssigneePicker(false) }}
                      style={{ padding: '9px 14px', cursor: 'pointer', color: !assignedTo ? accent : '#a0a0b8', fontSize: '0.74rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                    >Unassigned</div>
                    {crew.map(c => (
                      <div key={c.id}
                        onClick={() => { setAssignedTo(c.userId); setShowAssigneePicker(false) }}
                        style={{ padding: '9px 14px', cursor: 'pointer', color: assignedTo === c.userId ? accent : '#a0a0b8', fontSize: '0.74rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                      >{c.User?.name ?? 'Unknown'}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* Department */}
              <div>
                <label className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Department</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  <button onClick={() => setDepartment(null)}
                    className="font-mono cursor-pointer"
                    style={{
                      fontSize: '0.42rem', padding: '5px 9px', borderRadius: 20,
                      background: department === null ? `${accent}1a` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${department === null ? `${accent}40` : 'rgba(255,255,255,0.05)'}`,
                      color: department === null ? accent : '#62627a',
                    }}
                  >None</button>
                  {DEPARTMENTS.map(d => (
                    <button key={d} onClick={() => setDepartment(d)}
                      className="font-mono cursor-pointer"
                      style={{
                        fontSize: '0.42rem', padding: '5px 9px', borderRadius: 20,
                        background: department === d ? `${accent}1a` : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${department === d ? `${accent}40` : 'rgba(255,255,255,0.05)'}`,
                        color: department === d ? accent : '#62627a',
                      }}
                    >{d}</button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Optional"
                  className="w-full outline-none focus:border-white/20 resize-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7, padding: '10px 12px', color: '#dddde8', fontSize: '0.78rem', lineHeight: 1.5 }}
                />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
