'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useProject, useLocations, useCreateLocation, useUpdateLocation, useDeleteLocation } from '@/lib/hooks/useOriginOne'
import { PageHeader } from '@/components/ui/PageHeader'
import { FAB } from '@/components/ui/FAB'
import { haptic } from '@/lib/utils/haptics'
import { getProjectColor, statusHex, statusLabel } from '@/lib/utils/phase'
import { EmptyCTA } from '@/components/ui/EmptyState'
import type { Location, LocationStatus } from '@/types'

// ── Constants ────────────────────────────────────────────

const STATUSES: { value: LocationStatus; label: string; color: string }[] = [
  { value: 'booked',     label: 'Booked',     color: '#00b894' },
  { value: 'in_talks',   label: 'In Talks',   color: '#9b6de0' },
  { value: 'scouting',   label: 'Scouting',   color: '#e8a020' },
  { value: 'no_contact',  label: 'No Contact',  color: '#62627a' },
]

function statusColor(s: string) {
  return STATUSES.find(x => x.value === s)?.color ?? '#62627a'
}
function statusDisplay(s: string) {
  return STATUSES.find(x => x.value === s)?.label ?? s
}

// ── Location Card ────────────────────────────────────────

function LocationCard({ loc, accent, onTap }: { loc: Location; accent: string; onTap: (l: Location) => void }) {
  const sc = statusColor(loc.status)
  return (
    <div
      className="flex cursor-pointer active:opacity-90 transition-opacity"
      style={{
        background: 'rgba(10,10,18,0.42)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
      onClick={() => onTap(loc)}
    >
      {/* Hero image */}
      <div style={{ width: 96, height: 96, flexShrink: 0, background: '#0a0a12' }}>
        {loc.imageUrl ? (
          <img src={loc.imageUrl} alt={loc.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="4" width="20" height="16" rx="2" stroke="rgba(255,255,255,0.1)" strokeWidth="1.3" />
              <circle cx="8" cy="10" r="2" stroke="rgba(255,255,255,0.1)" strokeWidth="1.2" />
              <path d="M2 16l5-4 3 2 4-5 8 7" stroke="rgba(255,255,255,0.1)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
        <div>
          <div className="flex items-start justify-between gap-2">
            <span className="truncate" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#dddde8' }}>{loc.name}</span>
            <span className="font-mono uppercase flex-shrink-0" style={{
              fontSize: '0.36rem', letterSpacing: '0.06em',
              padding: '2px 7px', borderRadius: 10,
              background: `${sc}18`, color: sc,
            }}>{statusDisplay(loc.status)}</span>
          </div>
          {loc.address && (
            <div className="truncate" style={{ fontSize: '0.56rem', color: '#a0a0b8', marginTop: 2 }}>{loc.address}</div>
          )}
        </div>
        <div className="flex items-center justify-between" style={{ marginTop: 6 }}>
          {loc.shootDates ? (
            <span className="font-mono" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.04em' }}>{loc.shootDates}</span>
          ) : <span />}
          <button
            onClick={(e) => { e.stopPropagation() }}
            style={{
              fontSize: '0.38rem', fontFamily: 'var(--font-geist-mono)',
              letterSpacing: '0.06em', textTransform: 'uppercase',
              padding: '3px 8px', borderRadius: 10,
              background: loc.approved ? '#00b89418' : '#e8a02018',
              border: `1px solid ${loc.approved ? '#00b89440' : '#e8a02040'}`,
              color: loc.approved ? '#00b894' : '#e8a020',
              cursor: 'pointer',
            }}
          >{loc.approved ? 'Approved' : 'Option'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Create Location Sheet ────────────────────────────────

function CreateLocationSheet({ open, projectId, accent, onSave, onClose }: {
  open: boolean; projectId: string; accent: string
  onSave: (data: any) => void; onClose: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [address, setAddress] = useState('')
  const [keyContact, setKeyContact] = useState('')
  const [webLink, setWebLink] = useState('')
  const [shootDates, setShootDates] = useState('')
  const [status, setStatus] = useState<LocationStatus>('no_contact')
  const [approved, setApproved] = useState(false)
  const [notes, setNotes] = useState('')
  const [sceneTab, setSceneTab] = useState<string | null>(null)

  const canSave = name.trim().length > 0

  function handleSave() {
    if (!canSave) return
    haptic('light')
    onSave({
      projectId, name: name.trim(),
      description: description || null, address: address || null,
      keyContact: keyContact || null, webLink: webLink || null,
      shootDates: shootDates || null, status, approved,
      notes: notes || null, sceneTab,
    })
    reset()
  }

  function handleClose() { onClose(); reset() }

  function reset() {
    setName(''); setDescription(''); setAddress(''); setKeyContact('')
    setWebLink(''); setShootDates(''); setStatus('no_contact')
    setApproved(false); setNotes(''); setSceneTab(null)
  }

  function handleDragEnd(_: unknown, info: { offset: { y: number } }) {
    if (info.offset.y > 100) handleClose()
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 7, padding: '10px 12px',
    color: '#dddde8', fontSize: '0.82rem',
    width: '100%', outline: 'none',
  }

  const labelStyle = {
    fontSize: '0.44rem', color: '#62627a',
    letterSpacing: '0.08em', marginBottom: 6,
    textTransform: 'uppercase' as const,
    fontFamily: 'var(--font-geist-mono)',
    display: 'block',
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose}
            style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
          />
          <motion.div key="sheet"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y" dragConstraints={{ top: 0 }} dragElastic={0.1} onDragEnd={handleDragEnd}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 51,
              background: '#0e0e1a', borderRadius: '20px 20px 0 0',
              maxHeight: 'calc(100dvh - 100px)', overflowY: 'auto',
              paddingBottom: 'env(safe-area-inset-bottom, 24px)',
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '12px auto 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: '#dddde8' }}>New Location</span>
              <button onClick={handleSave} style={{
                fontFamily: 'var(--font-geist-mono)', fontSize: '0.48rem', letterSpacing: '0.06em', textTransform: 'uppercase',
                padding: '5px 10px', borderRadius: 20, cursor: canSave ? 'pointer' : 'default',
                background: canSave ? `${accent}1a` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${canSave ? `${accent}40` : 'rgba(255,255,255,0.05)'}`,
                color: canSave ? accent : '#62627a',
              }}>Save</button>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Location name" autoFocus autoComplete="off" spellCheck={false} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Address</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Street address or area" autoComplete="off" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description" rows={2} style={{ ...inputStyle, resize: 'none' }} />
              </div>
              <div className="flex gap-3">
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Key Contact</label>
                  <input type="text" value={keyContact} onChange={e => setKeyContact(e.target.value)} placeholder="Name / phone" autoComplete="off" style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Web Link</label>
                  <input type="text" value={webLink} onChange={e => setWebLink(e.target.value)} placeholder="URL" autoComplete="off" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Shoot Dates</label>
                <input type="text" value={shootDates} onChange={e => setShootDates(e.target.value)} placeholder="e.g. Apr 11-12" autoComplete="off" style={inputStyle} />
              </div>
              {/* Status pills */}
              <div>
                <label style={labelStyle}>Status</label>
                <div className="flex gap-2">
                  {STATUSES.map(s => (
                    <button key={s.value} onClick={() => setStatus(s.value)} style={{
                      flex: 1, fontFamily: 'var(--font-geist-mono)', fontSize: '0.40rem', letterSpacing: '0.06em', textTransform: 'uppercase',
                      padding: '7px 4px', borderRadius: 8, cursor: 'pointer',
                      background: status === s.value ? `${s.color}1a` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${status === s.value ? `${s.color}40` : 'rgba(255,255,255,0.05)'}`,
                      color: status === s.value ? s.color : '#62627a',
                    }}>{s.label}</button>
                  ))}
                </div>
              </div>
              {/* Approved / Option toggle */}
              <div>
                <label style={labelStyle}>Approval</label>
                <div className="flex gap-2">
                  <button onClick={() => setApproved(false)} style={{
                    flex: 1, fontFamily: 'var(--font-geist-mono)', fontSize: '0.44rem', letterSpacing: '0.06em', textTransform: 'uppercase',
                    padding: '8px 4px', borderRadius: 8, cursor: 'pointer',
                    background: !approved ? '#e8a0201a' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${!approved ? '#e8a02040' : 'rgba(255,255,255,0.05)'}`,
                    color: !approved ? '#e8a020' : '#62627a',
                  }}>Option</button>
                  <button onClick={() => setApproved(true)} style={{
                    flex: 1, fontFamily: 'var(--font-geist-mono)', fontSize: '0.44rem', letterSpacing: '0.06em', textTransform: 'uppercase',
                    padding: '8px 4px', borderRadius: 8, cursor: 'pointer',
                    background: approved ? '#00b8941a' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${approved ? '#00b89440' : 'rgba(255,255,255,0.05)'}`,
                    color: approved ? '#00b894' : '#62627a',
                  }}>Approved</button>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes" rows={2} style={{ ...inputStyle, resize: 'none' }} />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Detail Sheet (inline editable) ───────────────────────

function LocationDetailSheet({ loc, accent, onUpdate, onDelete, onClose }: {
  loc: Location; accent: string
  onUpdate: (fields: any) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(loc.name)
  const [description, setDescription] = useState(loc.description ?? '')
  const [address, setAddress] = useState(loc.address ?? '')
  const [keyContact, setKeyContact] = useState(loc.keyContact ?? '')
  const [webLink, setWebLink] = useState(loc.webLink ?? '')
  const [shootDates, setShootDates] = useState(loc.shootDates ?? '')
  const [status, setStatus] = useState(loc.status)
  const [approved, setApproved] = useState(loc.approved)
  const [notes, setNotes] = useState(loc.notes ?? '')

  const sc = statusColor(status)

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 7, padding: '10px 12px',
    color: '#dddde8', fontSize: '0.78rem',
    width: '100%', outline: 'none',
  }

  const labelStyle = {
    fontSize: '0.44rem', color: '#62627a',
    letterSpacing: '0.08em', marginBottom: 6,
    textTransform: 'uppercase' as const,
    fontFamily: 'var(--font-geist-mono)',
    display: 'block',
  }

  function save(fields: any) {
    onUpdate(fields)
  }

  return (
    <div style={{ padding: '0 20px 24px' }}>
      {/* Hero image */}
      {loc.imageUrl && (
        <div style={{ width: '100%', height: 160, borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
          <img src={loc.imageUrl} alt={loc.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}

      {/* Name */}
      <input type="text" value={name} onChange={e => setName(e.target.value)}
        onBlur={() => { if (name !== loc.name) save({ name }) }}
        style={{ ...inputStyle, fontSize: '1.1rem', fontWeight: 700, background: 'transparent', border: 'none', padding: '0 0 8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      />

      {/* Status pills */}
      <div style={{ marginTop: 14, marginBottom: 14 }}>
        <label style={labelStyle}>Status</label>
        <div className="flex gap-2">
          {STATUSES.map(s => (
            <button key={s.value} onClick={() => { setStatus(s.value); save({ status: s.value }) }} style={{
              flex: 1, fontFamily: 'var(--font-geist-mono)', fontSize: '0.40rem', letterSpacing: '0.06em', textTransform: 'uppercase',
              padding: '7px 4px', borderRadius: 8, cursor: 'pointer',
              background: status === s.value ? `${s.color}1a` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${status === s.value ? `${s.color}40` : 'rgba(255,255,255,0.05)'}`,
              color: status === s.value ? s.color : '#62627a',
            }}>{s.label}</button>
          ))}
        </div>
      </div>

      {/* Approved / Option toggle */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Approval</label>
        <div className="flex gap-2">
          <button onClick={() => { setApproved(false); save({ approved: false }) }} style={{
            flex: 1, fontFamily: 'var(--font-geist-mono)', fontSize: '0.44rem', letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '8px 4px', borderRadius: 8, cursor: 'pointer',
            background: !approved ? '#e8a0201a' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${!approved ? '#e8a02040' : 'rgba(255,255,255,0.05)'}`,
            color: !approved ? '#e8a020' : '#62627a',
          }}>Option</button>
          <button onClick={() => { setApproved(true); save({ approved: true }) }} style={{
            flex: 1, fontFamily: 'var(--font-geist-mono)', fontSize: '0.44rem', letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '8px 4px', borderRadius: 8, cursor: 'pointer',
            background: approved ? '#00b8941a' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${approved ? '#00b89440' : 'rgba(255,255,255,0.05)'}`,
            color: approved ? '#00b894' : '#62627a',
          }}>Approved</button>
        </div>
      </div>

      {/* Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={labelStyle}>Address</label>
          <input type="text" value={address} onChange={e => setAddress(e.target.value)}
            onBlur={() => save({ address: address || null })}
            placeholder="Street address or area" autoComplete="off" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            onBlur={() => save({ description: description || null })}
            placeholder="Brief description" rows={2} style={{ ...inputStyle, resize: 'none' }} />
        </div>
        <div className="flex gap-3">
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Key Contact</label>
            <input type="text" value={keyContact} onChange={e => setKeyContact(e.target.value)}
              onBlur={() => save({ keyContact: keyContact || null })}
              placeholder="Name / phone" autoComplete="off" style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Web Link</label>
            <input type="text" value={webLink} onChange={e => setWebLink(e.target.value)}
              onBlur={() => save({ webLink: webLink || null })}
              placeholder="URL" autoComplete="off" style={inputStyle} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Shoot Dates</label>
          <input type="text" value={shootDates} onChange={e => setShootDates(e.target.value)}
            onBlur={() => save({ shootDates: shootDates || null })}
            placeholder="e.g. Apr 11-12" autoComplete="off" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            onBlur={() => save({ notes: notes || null })}
            placeholder="Additional notes" rows={3} style={{ ...inputStyle, resize: 'none' }} />
        </div>
      </div>

      {/* Delete */}
      <button onClick={() => { haptic('warning'); onDelete(); onClose() }} style={{
        marginTop: 20, width: '100%', padding: '10px', borderRadius: 8,
        background: 'rgba(232,86,74,0.08)', border: '1px solid rgba(232,86,74,0.2)',
        color: '#e8564a', fontFamily: 'var(--font-geist-mono)', fontSize: '0.44rem',
        letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
      }}>Delete Location</button>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────

export default function LocationsPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const { data: project } = useProject(projectId)
  const accent = project?.color || getProjectColor(projectId)
  const { data: locations, isLoading } = useLocations(projectId)
  const createLoc = useCreateLocation(projectId)
  const updateLoc = useUpdateLocation(projectId)
  const deleteLoc = useDeleteLocation(projectId)

  const [selected, setSelected] = useState<Location | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [activeTab, setActiveTab] = useState('All')
  const [newTabName, setNewTabName] = useState('')
  const [showAddTab, setShowAddTab] = useState(false)
  const tabInputRef = useRef<HTMLInputElement>(null)

  const allLocations = (locations ?? []) as Location[]

  // Derive scene tabs from data
  const sceneTabs = Array.from(new Set(allLocations.map(l => l.sceneTab).filter(Boolean))) as string[]
  const tabs = ['All', ...sceneTabs]

  // Filter by active tab
  const filtered = activeTab === 'All'
    ? allLocations
    : allLocations.filter(l => l.sceneTab === activeTab)

  function handleAddTab() {
    if (!newTabName.trim()) return
    setActiveTab(newTabName.trim())
    setNewTabName('')
    setShowAddTab(false)
  }

  return (
    <div className="screen">
      <PageHeader projectId={projectId} title="Locations"
        meta={project ? (
          <div className="flex flex-col items-center gap-1.5">
            <span style={{ color: accent, fontSize: '0.50rem', letterSpacing: '0.06em' }}>{project.name}</span>
            <span className="font-mono uppercase" style={{
              fontSize: '0.38rem', padding: '2px 8px', borderRadius: 12,
              background: `${statusHex(project.status)}18`, color: statusHex(project.status),
            }}>{statusLabel(project.status)}</span>
          </div>
        ) : ''}
      />

      {/* Tabs */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', overflowX: 'auto',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        WebkitOverflowScrolling: 'touch',
      }}
        className="no-scrollbar"
      >
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            fontFamily: 'var(--font-geist-mono)', fontSize: '0.46rem',
            letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
            whiteSpace: 'nowrap', flexShrink: 0,
            background: activeTab === tab ? `${accent}1a` : 'rgba(255,255,255,0.04)',
            border: `1px solid ${activeTab === tab ? `${accent}40` : 'rgba(255,255,255,0.05)'}`,
            color: activeTab === tab ? accent : '#62627a',
          }}>{tab}{tab !== 'All' ? ` (${allLocations.filter(l => l.sceneTab === tab).length})` : ''}</button>
        ))}
        {/* Add Scene tab */}
        {showAddTab ? (
          <div className="flex items-center gap-2 flex-shrink-0">
            <input ref={tabInputRef} type="text" value={newTabName}
              onChange={e => setNewTabName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddTab(); if (e.key === 'Escape') setShowAddTab(false) }}
              autoFocus placeholder="Scene name"
              style={{
                fontFamily: 'var(--font-geist-mono)', fontSize: '0.44rem',
                width: 80, padding: '5px 8px', borderRadius: 8,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#dddde8', outline: 'none',
              }}
            />
            <button onClick={handleAddTab} style={{
              fontFamily: 'var(--font-geist-mono)', fontSize: '0.38rem',
              color: accent, cursor: 'pointer', background: 'none', border: 'none',
            }}>Add</button>
          </div>
        ) : (
          <button onClick={() => setShowAddTab(true)} style={{
            fontFamily: 'var(--font-geist-mono)', fontSize: '0.42rem',
            letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '5px 10px', borderRadius: 20, cursor: 'pointer',
            whiteSpace: 'nowrap', flexShrink: 0,
            background: 'rgba(255,255,255,0.02)',
            border: '1px dashed rgba(255,255,255,0.1)',
            color: '#62627a',
          }}>+ Scene</button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar" style={{ WebkitOverflowScrolling: 'touch', padding: '12px 16px 120px' }}>
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex" style={{ background: 'rgba(10,10,18,0.42)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ width: 96, height: 96, background: 'rgba(255,255,255,0.03)' }} />
                <div style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ width: 120, height: 12, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }} />
                  <div style={{ width: 180, height: 10, borderRadius: 4, background: 'rgba(255,255,255,0.04)' }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyCTA
            icon="📍"
            headline="Pin your locations."
            sub={activeTab === 'All' ? 'Where are you shooting?' : `No locations in "${activeTab}" yet.`}
            addLabel="+ Add location"
            onAdd={() => { haptic('light'); setShowCreate(true) }}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(loc => (
              <LocationCard key={loc.id} loc={loc} accent={accent} onTap={setSelected} />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <FAB accent={accent} projectId={projectId} onPress={() => { haptic('light'); setShowCreate(true) }} />

      {/* Create Sheet */}
      <CreateLocationSheet
        open={showCreate}
        projectId={projectId}
        accent={accent}
        onSave={(data) => {
          createLoc.mutate({ ...data, sceneTab: activeTab === 'All' ? null : activeTab })
          setShowCreate(false)
        }}
        onClose={() => setShowCreate(false)}
      />

      {/* Detail Sheet */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div key="detail-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
              style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
            />
            <motion.div key="detail-sheet"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              drag="y" dragConstraints={{ top: 0 }} dragElastic={0.1}
              onDragEnd={(_, info) => { if (info.offset.y > 100) setSelected(null) }}
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 51,
                background: '#0e0e1a', borderRadius: '20px 20px 0 0',
                maxHeight: 'calc(100dvh - 60px)', overflowY: 'auto',
                paddingBottom: 'env(safe-area-inset-bottom, 24px)',
              }}
            >
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '12px auto 16px' }} />
              <LocationDetailSheet
                loc={selected}
                accent={accent}
                onUpdate={(fields) => updateLoc.mutate({ id: selected.id, fields })}
                onDelete={() => deleteLoc.mutate(selected.id)}
                onClose={() => setSelected(null)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
