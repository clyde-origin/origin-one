'use client'

import { useState, useRef, useEffect } from 'react'
import { PROJECT_COLORS, PROJECT_COLOR_NAMES } from '@/lib/utils/phase'
import { haptic } from '@/lib/utils/haptics'

interface ProjectInfo {
  id: string
  name: string
  client: string
  type: string
  aspectRatio: string
  projectColor: string
}

interface ProjectActionSheetProps {
  project: ProjectInfo | null
  onArchive: () => void
  onDelete: () => void
  onRename: (name: string, client: string) => void
  onColorChange: (color: string) => void
  onTypeChange: (type: string) => void
  onAspectChange: (aspectRatio: string) => void
  onClose: () => void
}

const PROJECT_TYPES = [
  'Commercial', 'Branded Documentary', 'Narrative Short', 'Feature',
  'Music Video', 'Editorial', 'Educational', 'Event',
]

const ASPECT_RATIOS = ['16:9', '2.39:1', '4:3', '1:1', '9:16', '4:5']

type SubSheet = null | 'rename' | 'type' | 'aspect' | 'archive-confirm' | 'delete-confirm'

function hexToRgba(hex: string | null | undefined, a: number) {
  const h = hex || '#444444'
  const r = parseInt(h.slice(1, 3), 16)
  const g = parseInt(h.slice(3, 5), 16)
  const b = parseInt(h.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

export function ProjectActionSheet({ project, onArchive, onDelete, onRename, onColorChange, onTypeChange, onAspectChange, onClose }: ProjectActionSheetProps) {
  const [subSheet, setSubSheet] = useState<SubSheet>(null)
  const [renameName, setRenameName] = useState('')
  const [renameClient, setRenameClient] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Reset sub-sheet state when project changes
  useEffect(() => {
    if (project) {
      setSubSheet(null)
      setRenameName(project.name)
      setRenameClient(project.client)
    }
  }, [project])

  // Auto-focus rename input
  useEffect(() => {
    if (subSheet === 'rename') {
      setTimeout(() => nameInputRef.current?.focus(), 350)
    }
  }, [subSheet])

  if (!project) return null

  const color = project.projectColor

  const handleSaveRename = () => {
    const name = renameName.trim()
    const client = renameClient.trim()
    if (name) {
      haptic('light')
      onRename(name, client || project.client)
    }
    setSubSheet(null)
  }

  const handleArchive = () => {
    haptic('medium')
    onArchive()
    setSubSheet(null)
  }

  const handleDelete = () => {
    haptic('warning')
    onDelete()
    setSubSheet(null)
  }

  return (
    <>
      {/* Overlay */}
      <div
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
          zIndex: 100, opacity: 1, transition: 'opacity 0.25s',
        }}
        onClick={onClose}
      />

      {/* Main action sheet */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: '50%',
          transform: subSheet ? 'translateX(-50%) translateY(110%)' : 'translateX(-50%) translateY(0)',
          width: '100%', maxWidth: 390, background: '#111118',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '20px 20px 0 0', zIndex: 101,
          transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 20px)',
        }}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '12px auto 4px' }} />

        {/* Identity row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 18px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
            background: color,
            boxShadow: `0 0 6px ${hexToRgba(color, 0.5)}`,
          }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#dddde8' }}>{project.name}</div>
            <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '0.42rem', color: '#62627a', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
              {project.client}
            </div>
          </div>
        </div>

        {/* Rename action */}
        <ActionRow
          icon={<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M8.5 1.5L11 4L4.5 10.5H2V8L8.5 1.5Z" stroke="white" strokeWidth="1.2" strokeLinejoin="round" opacity="0.7"/><path d="M6.5 3.5L9 6" stroke="white" strokeWidth="1.2" opacity="0.7"/></svg>}
          label="Rename"
          sub="Change project name or client"
          onClick={() => { haptic('light'); setSubSheet('rename') }}
          showChevron
        />

        {/* Project Type */}
        <ActionRow
          icon={<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1.5" y="2.5" width="10" height="8" rx="1.5" stroke="white" strokeWidth="1.2" opacity="0.7"/><path d="M5 5.5L8.5 8" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/><path d="M5 8L8.5 5.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/></svg>}
          label="Project Type"
          sub={project.type || 'Not set'}
          onClick={() => { haptic('light'); setSubSheet('type') }}
          showChevron
        />

        {/* Aspect Ratio */}
        <ActionRow
          icon={<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1.5" y="3" width="10" height="7" rx="1" stroke="white" strokeWidth="1.2" opacity="0.7"/><path d="M4 6.5H9" stroke="white" strokeWidth="0.8" strokeLinecap="round" opacity="0.4"/><path d="M6.5 4.5V8.5" stroke="white" strokeWidth="0.8" strokeLinecap="round" opacity="0.4"/></svg>}
          label="Aspect Ratio"
          sub={project.aspectRatio || 'Not set'}
          onClick={() => { haptic('light'); setSubSheet('aspect') }}
          showChevron
        />

        {/* Color section */}
        <div style={{ padding: '8px 18px 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 7,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, background: 'rgba(255,255,255,0.05)',
            }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="white" strokeWidth="1.2" opacity="0.7"/><circle cx="6.5" cy="6.5" r="2" fill="white" opacity="0.7"/></svg>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.78rem', color: '#dddde8' }}>Change color</div>
              <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '0.38rem', color: '#62627a', letterSpacing: '0.04em', marginTop: 1 }}>18 accent colors</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 7 }}>
            {PROJECT_COLORS.map((c, i) => (
              <div
                key={c}
                title={PROJECT_COLOR_NAMES[i]}
                onClick={() => { haptic('light'); onColorChange(c) }}
                style={{
                  width: '100%', aspectRatio: '1', borderRadius: '50%',
                  background: c, cursor: 'pointer',
                  transition: 'transform 0.12s',
                  border: c === color ? '2px solid rgba(255,255,255,0.55)' : '2px solid transparent',
                  transform: c === color ? 'scale(1.18)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />

        {/* Archive */}
        <ActionRow
          icon={<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="4" width="11" height="8" rx="1" stroke="white" strokeWidth="1.2" opacity="0.7"/><path d="M1 4L2.5 1.5H10.5L12 4" stroke="white" strokeWidth="1.2" strokeLinejoin="round" opacity="0.7"/><path d="M4.5 7H8.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/></svg>}
          label="Archive"
          sub="Hide from active projects"
          onClick={() => { haptic('light'); setSubSheet('archive-confirm') }}
          showChevron
        />

        {/* Delete */}
        <ActionRow
          icon={<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3.5H11M4.5 3.5V2H8.5V3.5M5 5.5V10M8 5.5V10M2.5 3.5L3 11H10L10.5 3.5" stroke="#e8564a" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          iconBg="rgba(232,86,74,0.1)"
          label="Delete project"
          labelColor="#e8564a"
          sub="Permanent — requires confirmation"
          onClick={() => { haptic('light'); setSubSheet('delete-confirm') }}
          showChevron
          chevronColor="#e8564a"
        />
      </div>

      {/* ── RENAME SUB-SHEET ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%',
        transform: subSheet === 'rename' ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(110%)',
        width: '100%', maxWidth: 390, background: '#111118',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '20px 20px 0 0', zIndex: 102,
        transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 20px)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '12px auto 4px' }} />
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 18px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#dddde8' }}>Rename project</span>
          <button
            onClick={handleSaveRename}
            style={{
              fontFamily: 'var(--font-geist-mono)', fontSize: '0.48rem', color: '#c45adc',
              letterSpacing: '0.06em', textTransform: 'uppercase' as const,
              padding: '5px 10px', borderRadius: 20,
              background: 'rgba(196,90,220,0.1)', border: '1px solid rgba(196,90,220,0.25)',
              cursor: 'pointer',
            }}
          >Save</button>
        </div>
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{
              fontFamily: 'var(--font-geist-mono)', fontSize: '0.44rem', color: '#62627a',
              letterSpacing: '0.08em', textTransform: 'uppercase' as const,
              display: 'block', marginBottom: 6,
            }}>Project name</label>
            <input
              ref={nameInputRef}
              type="text"
              value={renameName}
              onChange={e => setRenameName(e.target.value)}
              placeholder="Project name"
              autoComplete="off"
              spellCheck={false}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7,
                padding: '10px 12px', color: '#dddde8',
                fontFamily: 'var(--font-geist-sans)', fontSize: '0.82rem',
                outline: 'none',
              }}
            />
          </div>
          <div>
            <label style={{
              fontFamily: 'var(--font-geist-mono)', fontSize: '0.44rem', color: '#62627a',
              letterSpacing: '0.08em', textTransform: 'uppercase' as const,
              display: 'block', marginBottom: 6,
            }}>Client</label>
            <input
              type="text"
              value={renameClient}
              onChange={e => setRenameClient(e.target.value)}
              placeholder="Client name"
              autoComplete="off"
              spellCheck={false}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7,
                padding: '10px 12px', color: '#dddde8',
                fontFamily: 'var(--font-geist-sans)', fontSize: '0.82rem',
                outline: 'none',
              }}
            />
          </div>
        </div>
      </div>

      {/* ── PROJECT TYPE SUB-SHEET ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%',
        transform: subSheet === 'type' ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(110%)',
        width: '100%', maxWidth: 390, background: '#111118',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '20px 20px 0 0', zIndex: 102,
        transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 20px)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '12px auto 4px' }} />
        <div style={{
          padding: '18px 18px 10px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#dddde8' }}>Project Type</span>
        </div>
        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column' }}>
          {PROJECT_TYPES.map(t => (
            <div
              key={t}
              onClick={() => { haptic('light'); onTypeChange(t); setSubSheet(null) }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 10px', borderRadius: 8, cursor: 'pointer',
                background: project.type === t ? 'rgba(255,255,255,0.05)' : 'transparent',
              }}
            >
              <span style={{ fontSize: '0.78rem', color: '#dddde8', fontWeight: project.type === t ? 700 : 500 }}>{t}</span>
              {project.type === t && (
                <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5L4.5 8.5L11 1.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── ASPECT RATIO SUB-SHEET ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%',
        transform: subSheet === 'aspect' ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(110%)',
        width: '100%', maxWidth: 390, background: '#111118',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '20px 20px 0 0', zIndex: 102,
        transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 20px)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '12px auto 4px' }} />
        <div style={{
          padding: '18px 18px 10px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#dddde8' }}>Aspect Ratio</span>
        </div>
        <div style={{ padding: '8px 10px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {ASPECT_RATIOS.map(r => (
            <div
              key={r}
              onClick={() => { haptic('light'); onAspectChange(r); setSubSheet(null) }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '14px 8px', borderRadius: 8, cursor: 'pointer',
                border: project.aspectRatio === r ? `1.5px solid ${hexToRgba(color, 0.5)}` : '1.5px solid rgba(255,255,255,0.06)',
                background: project.aspectRatio === r ? hexToRgba(color, 0.08) : 'rgba(255,255,255,0.02)',
              }}
            >
              <span style={{
                fontFamily: 'var(--font-geist-mono)', fontSize: '0.72rem', fontWeight: 700,
                color: project.aspectRatio === r ? color : '#a0a0b8',
                letterSpacing: '0.02em',
              }}>{r}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── ARCHIVE CONFIRM ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%',
        transform: subSheet === 'archive-confirm' ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(110%)',
        width: '100%', maxWidth: 390, background: '#111118',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '20px 20px 0 0', zIndex: 102,
        transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
        padding: '0 0 calc(env(safe-area-inset-bottom, 16px) + 20px)',
        textAlign: 'center' as const,
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '12px auto 4px' }} />
        <div style={{ fontWeight: 800, fontSize: '1rem', color: '#dddde8', padding: '24px 24px 6px' }}>
          Archive &ldquo;{project.name}&rdquo;?
        </div>
        <div style={{
          fontFamily: 'var(--font-geist-mono)', fontSize: '0.48rem', color: '#62627a',
          letterSpacing: '0.04em', padding: '0 24px 20px', lineHeight: 1.6,
        }}>
          Hide from active projects. You can restore from settings.
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '0 18px' }}>
          <button
            onClick={() => setSubSheet(null)}
            style={{
              flex: 1, padding: 13, borderRadius: 8, fontWeight: 700, fontSize: '0.78rem',
              cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)',
              background: 'rgba(255,255,255,0.06)', color: '#a0a0b8',
            }}
          >Cancel</button>
          <button
            onClick={handleArchive}
            style={{
              flex: 1, padding: 13, borderRadius: 8, fontWeight: 700, fontSize: '0.78rem',
              cursor: 'pointer', border: '1px solid rgba(232,160,32,0.25)',
              background: 'rgba(232,160,32,0.12)', color: '#e8a020',
            }}
          >Archive</button>
        </div>
      </div>

      {/* ── DELETE CONFIRM ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%',
        transform: subSheet === 'delete-confirm' ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(110%)',
        width: '100%', maxWidth: 390, background: '#111118',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '20px 20px 0 0', zIndex: 102,
        transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
        padding: '0 0 calc(env(safe-area-inset-bottom, 16px) + 20px)',
        textAlign: 'center' as const,
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '12px auto 4px' }} />
        <div style={{ fontWeight: 800, fontSize: '1rem', color: '#dddde8', padding: '24px 24px 6px' }}>
          Delete &ldquo;{project.name}&rdquo;?
        </div>
        <div style={{
          fontFamily: 'var(--font-geist-mono)', fontSize: '0.48rem', color: '#62627a',
          letterSpacing: '0.04em', padding: '0 24px 20px', lineHeight: 1.6,
        }}>
          All data permanently removed. This cannot be undone.
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '0 18px' }}>
          <button
            onClick={() => setSubSheet(null)}
            style={{
              flex: 1, padding: 13, borderRadius: 8, fontWeight: 700, fontSize: '0.78rem',
              cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)',
              background: 'rgba(255,255,255,0.06)', color: '#a0a0b8',
            }}
          >Cancel</button>
          <button
            onClick={handleDelete}
            style={{
              flex: 1, padding: 13, borderRadius: 8, fontWeight: 700, fontSize: '0.78rem',
              cursor: 'pointer', border: '1px solid rgba(232,86,74,0.25)',
              background: 'rgba(232,86,74,0.12)', color: '#e8564a',
            }}
          >Delete forever</button>
        </div>
      </div>
    </>
  )
}

// ── ACTION ROW ─────────────────────────────────────────────

function ActionRow({ icon, iconBg, label, labelColor, sub, onClick, showChevron, chevronColor }: {
  icon: React.ReactNode
  iconBg?: string
  label: string
  labelColor?: string
  sub: string
  onClick: () => void
  showChevron?: boolean
  chevronColor?: string
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 18px', cursor: 'pointer',
        transition: 'background 0.12s',
      }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 7,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, background: iconBg || 'rgba(255,255,255,0.05)',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '0.78rem', color: labelColor || '#dddde8' }}>{label}</div>
        <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '0.38rem', color: '#62627a', letterSpacing: '0.04em', marginTop: 1 }}>{sub}</div>
      </div>
      {showChevron && (
        <svg style={{ opacity: 0.2, marginLeft: 'auto', flexShrink: 0 }} width="5" height="9" viewBox="0 0 5 9" fill="none">
          <path d="M1 1L4 4.5L1 8" stroke={chevronColor || 'white'} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  )
}
