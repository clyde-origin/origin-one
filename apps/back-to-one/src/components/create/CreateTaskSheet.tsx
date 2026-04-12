'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/utils/haptics'
import type { TeamMember, ActionItemStatus } from '@/types'

interface CreateTaskSheetProps {
  open: boolean
  projectId: string
  accent: string
  crew: TeamMember[]
  onSave: (data: { projectId: string; title: string; assignedTo: string | null; dueDate: string | null; description: string; status: ActionItemStatus }) => void
  onClose: () => void
}

export function CreateTaskSheet({ open, projectId, accent, crew, onSave, onClose }: CreateTaskSheetProps) {
  const [title, setTitle] = useState('')
  const [assignedTo, setAssignedTo] = useState<string | null>(null)
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<'normal' | 'high'>('normal')
  const [description, setDescription] = useState('')

  const canSave = title.trim().length > 0

  function handleSave() {
    if (!canSave) return
    haptic('light')
    onSave({ projectId, title: title.trim(), assignedTo, dueDate: dueDate || null, description, status: 'open' })
    resetForm()
  }

  function handleClose() {
    onClose()
    resetForm()
  }

  function resetForm() {
    setTitle(''); setAssignedTo(null); setDueDate(''); setPriority('normal'); setDescription('')
  }

  function handleDragEnd(_: unknown, info: { offset: { y: number } }) {
    if (info.offset.y > 100) handleClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            key="task-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
          />

          {/* Sheet */}
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
              maxHeight: '85vh', overflowY: 'auto',
              paddingBottom: 'env(safe-area-inset-bottom, 24px)',
            }}
          >
            {/* Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '12px auto 0' }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: '#dddde8' }}>New Action Item</span>
              <button
                onClick={handleSave}
                style={{
                  fontFamily: 'var(--font-dm-mono)', fontSize: '0.48rem', letterSpacing: '0.06em', textTransform: 'uppercase',
                  padding: '5px 10px', borderRadius: 20, cursor: canSave ? 'pointer' : 'default',
                  background: canSave ? `${accent}1a` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${canSave ? `${accent}40` : 'rgba(255,255,255,0.05)'}`,
                  color: canSave ? accent : '#62627a',
                }}
              >Save</button>
            </div>

            {/* Fields */}
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Task title</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs to be done?"
                  autoFocus autoComplete="off" spellCheck={false}
                  className="w-full outline-none focus:border-white/20"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7, padding: '10px 12px', color: '#dddde8', fontSize: '0.82rem' }}
                />
              </div>

              <div>
                <label className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Due date</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="w-full outline-none focus:border-white/20"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7, padding: '10px 12px', color: '#dddde8', fontSize: '0.78rem', fontFamily: 'var(--font-dm-mono)' }}
                />
              </div>

              <div>
                <label className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Assignee</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  <button onClick={() => setAssignedTo(null)}
                    className="font-mono uppercase cursor-pointer"
                    style={{
                      fontSize: '0.44rem', padding: '5px 9px', borderRadius: 20,
                      background: assignedTo === null ? `${accent}1a` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${assignedTo === null ? `${accent}40` : 'rgba(255,255,255,0.05)'}`,
                      color: assignedTo === null ? accent : '#62627a',
                    }}
                  >Unassigned</button>
                  {crew.map(c => (
                    <button key={c.id} onClick={() => setAssignedTo(c.userId)}
                      className="font-mono cursor-pointer"
                      style={{
                        fontSize: '0.44rem', padding: '5px 9px', borderRadius: 20,
                        background: assignedTo === c.userId ? `${accent}1a` : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${assignedTo === c.userId ? `${accent}40` : 'rgba(255,255,255,0.05)'}`,
                        color: assignedTo === c.userId ? accent : '#62627a',
                      }}
                    >{c.User.name}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Priority</label>
                <div style={{ display: 'flex', gap: 5 }}>
                  {(['normal', 'high'] as const).map(p => (
                    <button key={p} onClick={() => setPriority(p)}
                      className="font-mono uppercase cursor-pointer flex-1"
                      style={{
                        fontSize: '0.44rem', letterSpacing: '0.05em', padding: '7px 9px', borderRadius: 20, textAlign: 'center',
                        background: priority === p ? (p === 'high' ? 'rgba(232,86,74,0.15)' : `${accent}1a`) : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${priority === p ? (p === 'high' ? 'rgba(232,86,74,0.4)' : `${accent}40`) : 'rgba(255,255,255,0.05)'}`,
                        color: priority === p ? (p === 'high' ? '#e8564a' : accent) : '#62627a',
                      }}
                    >{p}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Optional"
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
