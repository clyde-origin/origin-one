'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/utils/haptics'
import { MILESTONE_STATUS_HEX, MILESTONE_STATUS_LABEL } from '@/lib/utils/phase'
import type { MilestoneStatus } from '@/types'

interface CreateMilestoneSheetProps {
  open: boolean
  projectId: string
  accent: string
  onSave: (data: { projectId: string; title: string; status: MilestoneStatus; date: string; notes: string; people: string[] }) => void
  onClose: () => void
}

export function CreateMilestoneSheet({ open, projectId, accent, onSave, onClose }: CreateMilestoneSheetProps) {
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<MilestoneStatus>('upcoming')
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')

  const canSave = title.trim().length > 0 && date.length > 0

  function handleSave() {
    if (!canSave) return
    haptic('light')
    onSave({ projectId, title: title.trim(), status, date, notes, people: [] })
    resetForm()
  }

  function handleClose() {
    onClose()
    resetForm()
  }

  function resetForm() {
    setTitle(''); setStatus('upcoming'); setDate(''); setNotes('')
  }

  function handleDragEnd(_: unknown, info: { offset: { y: number } }) {
    if (info.offset.y > 100) handleClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="ms-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
          />

          <motion.div
            key="ms-sheet"
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
              <span style={{ fontWeight: 800, fontSize: '1rem', color: '#dddde8' }}>New Milestone</span>
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

            {/* Fields */}
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Milestone title</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Rough cut review"
                  autoFocus autoComplete="off" spellCheck={false}
                  className="w-full outline-none focus:border-white/20"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7, padding: '10px 12px', color: '#dddde8', fontSize: '0.82rem' }}
                />
              </div>

              <div>
                <label className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full outline-none focus:border-white/20"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7, padding: '10px 12px', color: '#dddde8', fontSize: '0.78rem', fontFamily: 'var(--font-geist-mono)' }}
                />
              </div>

              <div>
                <label className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Status</label>
                <div style={{ display: 'flex', gap: 5 }}>
                  {(['upcoming', 'in_progress', 'completed'] as MilestoneStatus[]).map(s => (
                    <button key={s} onClick={() => setStatus(s)}
                      className="font-mono uppercase cursor-pointer flex-1"
                      style={{
                        fontSize: '0.44rem', letterSpacing: '0.05em', padding: '7px 9px', borderRadius: 20, textAlign: 'center',
                        background: status === s ? `${MILESTONE_STATUS_HEX[s]}1a` : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${status === s ? `${MILESTONE_STATUS_HEX[s]}40` : 'rgba(255,255,255,0.05)'}`,
                        color: status === s ? MILESTONE_STATUS_HEX[s] : '#62627a',
                      }}
                    >{MILESTONE_STATUS_LABEL[s]}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Note</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Optional"
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
