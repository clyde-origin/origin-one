'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import type { Scene, Shot } from '@/types'

const SIZE_ABBREV: Record<string, string> = {
  extreme_wide: 'EWS', wide: 'WIDE', full: 'FS', medium: 'MED',
  medium_close_up: 'MCU', close_up: 'CU', extreme_close_up: 'ECU', insert: 'INS',
}

// Pastel color blocks for image placeholders
const PLACEHOLDER_COLORS = ['#C8E6C9', '#B3E5FC', '#F8BBD9', '#FFE0B2', '#E1BEE7', '#B2EBF2']
function colorBlock(seed: number) { return PLACEHOLDER_COLORS[seed % PLACEHOLDER_COLORS.length] }

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Extract plain text from a scene description that may be JSON (script content blocks) or plain text */
function parseSceneDescription(desc: string | null): string {
  if (!desc) return ''
  // Try to parse as JSON array of content blocks
  try {
    const blocks = JSON.parse(desc)
    if (Array.isArray(blocks)) {
      return blocks.map((b: any) => {
        if (b.type === 'action') return b.content || ''
        if (b.type === 'dialogue') return `${b.character || ''}: ${b.content || ''}`
        if (typeof b === 'string') return b
        return b.content || ''
      }).filter(Boolean).join('\n')
    }
  } catch {
    // Not JSON — return as plain text
  }
  return desc
}

// ── TOGGLE CHECKBOX ──────────────────────────────────────────
function ToggleCheck({ on }: { on: boolean }) {
  return (
    <div style={{
      width: 14, height: 14, borderRadius: 4, flexShrink: 0,
      border: on ? 'none' : '1.5px solid rgba(255,255,255,0.18)',
      background: on ? '#67E8F9' : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s',
    }}>
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ opacity: on ? 1 : 0, transition: 'opacity 0.12s' }}>
        <polyline points="1,4 3,6 7,2" stroke="#080808" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

// ── PAGE HEADER (inside paper) ───────────────────────────────
function PageHeader({ projectName, clientName, version, sectionLabel }: {
  projectName: string; clientName: string; version: string; sectionLabel: string
}) {
  return (
    <div style={{
      padding: '10px 18px 8px', borderBottom: '1px solid #e0e0e0',
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    }}>
      <div>
        <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 9, fontWeight: 700, color: '#000', textTransform: 'uppercase', letterSpacing: '0.1em', lineHeight: 1.2 }}>
          {projectName}
        </div>
        <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 7, color: '#888', marginTop: 2, lineHeight: 1.4 }}>
          {clientName}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 7, color: '#aaa', lineHeight: 1.4 }}>
          {version}
        </div>
        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 6, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#bbb', marginTop: 1 }}>
          {sectionLabel}
        </div>
      </div>
    </div>
  )
}

// ── SCRIPT PAGE ──────────────────────────────────────────────
function ScriptPage({ scenes, orientation, projectName, clientName, version }: {
  scenes: Scene[]; orientation: 'portrait' | 'landscape'
  projectName: string; clientName: string; version: string
}) {
  return (
    <div className={`paper-page ${orientation}`} style={{
      background: '#fff', borderRadius: 6, overflow: 'hidden', flexShrink: 0,
      width: '100%', aspectRatio: orientation === 'portrait' ? '8.5 / 11' : '11 / 8.5',
    }}>
      <PageHeader projectName={projectName} clientName={clientName} version={version} sectionLabel="Script" />
      <div style={{ padding: '8px 18px 18px' }}>
        {scenes.map(scene => (
          <div key={scene.id} style={{ marginBottom: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
              <span style={{
                fontFamily: "'Geist Mono', monospace", fontSize: 6, fontWeight: 700,
                background: '#f5f5f5', color: '#333', borderRadius: 2, padding: '1px 4px', letterSpacing: '0.05em',
              }}>{scene.sceneNumber}</span>
              <span style={{
                fontFamily: "'Geist', sans-serif", fontSize: 7, fontWeight: 700,
                color: '#000', textTransform: 'uppercase', letterSpacing: '0.07em',
              }}>{scene.title || 'Untitled'}</span>
            </div>
            <div style={{
              fontFamily: "'Geist Mono', monospace", fontSize: 6, color: '#444', lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}>{parseSceneDescription(scene.description)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── SHOTLIST PAGE ────────────────────────────────────────────
function ShotlistPage({ shots, orientation, projectName, clientName, version }: {
  shots: Shot[]; orientation: 'portrait' | 'landscape'
  projectName: string; clientName: string; version: string
}) {
  return (
    <div className={`paper-page ${orientation}`} style={{
      background: '#fff', borderRadius: 6, overflow: 'hidden', flexShrink: 0,
      width: '100%', aspectRatio: orientation === 'portrait' ? '8.5 / 11' : '11 / 8.5',
    }}>
      <PageHeader projectName={projectName} clientName={clientName} version={version} sectionLabel="Shotlist" />
      <div style={{ padding: '8px 18px 18px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 2 }}>
          <thead>
            <tr>
              {['Shot', 'Size', 'Description', 'Notes', 'Frame'].map(h => (
                <th key={h} style={{
                  fontFamily: "'Geist Mono', monospace", fontSize: 6, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: '#999', borderBottom: '1px solid #e8e8e8',
                  padding: '3px 4px', textAlign: 'left', fontWeight: 400,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shots.map((shot, i) => (
              <tr key={shot.id}>
                <td style={{
                  fontFamily: "'Geist Mono', monospace", fontWeight: 700, color: '#000',
                  whiteSpace: 'nowrap', fontSize: 6, padding: '3px 4px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top',
                }}>{shot.shotNumber}</td>
                <td style={{ fontFamily: "'Geist', sans-serif", fontSize: 6, color: '#333', padding: '3px 4px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top', lineHeight: 1.5 }}>
                  {SIZE_ABBREV[shot.size ?? ''] ?? shot.size ?? ''}
                </td>
                <td style={{ fontFamily: "'Geist', sans-serif", fontSize: 6, color: '#333', padding: '3px 4px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top', lineHeight: 1.5 }}>
                  {shot.description || ''}
                </td>
                <td style={{ fontFamily: "'Geist', sans-serif", fontSize: 6, color: '#333', padding: '3px 4px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top', lineHeight: 1.5 }}>
                  {shot.notes || ''}
                </td>
                <td style={{ width: 28, padding: '3px 4px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' }}>
                  {shot.imageUrl ? (
                    <img src={shot.imageUrl} alt="" style={{ width: 26, height: 18, borderRadius: 2, objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: 26, height: 18, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: '#f0f0f0',
                    }} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── STORYBOARD PAGE ─────────────────────────────────────────
function StoryboardPage({ shots, orientation, projectName, clientName, version }: {
  shots: Shot[]; orientation: 'portrait' | 'landscape'
  projectName: string; clientName: string; version: string
}) {
  return (
    <div className={`paper-page ${orientation}`} style={{
      background: '#fff', borderRadius: 6, overflow: 'hidden', flexShrink: 0,
      width: '100%', aspectRatio: orientation === 'portrait' ? '8.5 / 11' : '11 / 8.5',
    }}>
      <PageHeader projectName={projectName} clientName={clientName} version={version} sectionLabel="Storyboard" />
      <div style={{ padding: '8px 18px 18px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, padding: '2px 0' }}>
          {shots.map((shot, i) => (
            <div key={shot.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: 2, overflow: 'hidden' }}>
                {shot.imageUrl ? (
                  <img src={shot.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: '#f0f0f0' }} />
                )}
              </div>
              <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 5, color: '#aaa', letterSpacing: '0.05em' }}>
                {shot.shotNumber}
              </div>
              <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 5, color: '#555', lineHeight: 1.4 }}>
                {shot.description || ''}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── MAIN EXPORT COMPONENT ────────────────────────────────────

export function PdfExport({ scenes, shots, projectName, clientName, onClose }: {
  scenes: Scene[]; shots: Shot[]
  projectName: string; clientName: string
  onClose: () => void
}) {
  const [includeScript, setIncludeScript] = useState(true)
  const [includeShotlist, setIncludeShotlist] = useState(false)
  const [includeStoryboard, setIncludeStoryboard] = useState(false)
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const [version, setVersion] = useState('v1')

  const anySelected = includeScript || includeShotlist || includeStoryboard

  const sortedShots = useMemo(() =>
    [...shots].sort((a, b) => a.sortOrder - b.sortOrder),
    [shots]
  )

  const pages = useMemo(() => {
    const p: { key: string; node: React.ReactNode }[] = []
    if (includeScript) {
      p.push({ key: 'script', node: <ScriptPage scenes={scenes} orientation={orientation} projectName={projectName} clientName={clientName} version={version} /> })
    }
    if (includeShotlist) {
      p.push({ key: 'shotlist', node: <ShotlistPage shots={sortedShots} orientation={orientation} projectName={projectName} clientName={clientName} version={version} /> })
    }
    if (includeStoryboard) {
      p.push({ key: 'storyboard', node: <StoryboardPage shots={sortedShots} orientation={orientation} projectName={projectName} clientName={clientName} version={version} /> })
    }
    return p
  }, [includeScript, includeShotlist, includeStoryboard, orientation, version, scenes, sortedShots, projectName, clientName])

  const handleShare = () => {
    if (!anySelected) return
    window.print()
  }

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 100,
        top: 'var(--safe-top, 0px)',
        background: '#080808', display: 'flex', flexDirection: 'column',
        borderTopLeftRadius: 12, borderTopRightRadius: 12,
      }}>
      {/* ── Export Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 20px 14px', flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <span style={{ fontSize: 13, color: '#67E8F9', cursor: 'pointer' }} onClick={onClose}>
          ← Back
        </span>
        <span style={{
          fontFamily: "'Geist Mono', monospace", fontSize: 11, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)',
        }}>Export</span>
        <span style={{
          fontSize: 13, fontWeight: 600, color: '#67E8F9', cursor: 'pointer',
          opacity: anySelected ? 1 : 0.3,
          pointerEvents: anySelected ? 'auto' : 'none',
        }} onClick={handleShare}>
          Share PDF
        </span>
      </div>

      {/* ── Options Panel ── */}
      <div style={{
        flexShrink: 0, padding: '16px 20px 14px',
        display: 'flex', flexDirection: 'column', gap: 16,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        {/* Include toggles */}
        <div>
          <div style={{
            fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.15em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)', marginBottom: 8,
          }}>Include</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {([
              { key: 'script' as const, label: 'Script', on: includeScript, toggle: () => setIncludeScript(v => !v) },
              { key: 'shotlist' as const, label: 'Shotlist', on: includeShotlist, toggle: () => setIncludeShotlist(v => !v) },
              { key: 'storyboard' as const, label: 'Storyboard', on: includeStoryboard, toggle: () => setIncludeStoryboard(v => !v) },
            ]).map(t => (
              <div key={t.key} onClick={t.toggle} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                padding: '9px 6px', borderRadius: 10, cursor: 'pointer', userSelect: 'none',
                transition: 'all 0.16s',
                background: t.on ? 'rgba(103,232,249,0.08)' : 'rgba(255,255,255,0.03)',
                border: t.on ? '1px solid rgba(103,232,249,0.25)' : '1px solid rgba(255,255,255,0.09)',
              }}>
                <ToggleCheck on={t.on} />
                <span style={{
                  fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.1em',
                  textTransform: 'uppercase', transition: 'color 0.15s',
                  color: t.on ? '#67E8F9' : 'rgba(255,255,255,0.3)',
                }}>{t.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Orientation */}
        <div>
          <div style={{
            fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.15em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)', marginBottom: 8,
          }}>Orientation · 8.5 × 11&quot;</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {([
              { key: 'portrait' as const, label: 'Portrait', w: 10, h: 14 },
              { key: 'landscape' as const, label: 'Landscape', w: 14, h: 10 },
            ]).map(o => {
              const on = orientation === o.key
              return (
                <div key={o.key} onClick={() => setOrientation(o.key)} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '9px 10px', borderRadius: 10, cursor: 'pointer', userSelect: 'none',
                  transition: 'all 0.16s',
                  background: on ? 'rgba(103,232,249,0.08)' : 'rgba(255,255,255,0.03)',
                  border: on ? '1px solid rgba(103,232,249,0.25)' : '1px solid rgba(255,255,255,0.09)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{
                      width: o.w, height: o.h, borderRadius: 2,
                      border: `1.5px solid ${on ? '#67E8F9' : 'rgba(255,255,255,0.2)'}`,
                      transition: 'border-color 0.15s',
                    }} />
                  </div>
                  <span style={{
                    fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.1em',
                    textTransform: 'uppercase', transition: 'color 0.15s',
                    color: on ? '#67E8F9' : 'rgba(255,255,255,0.3)',
                  }}>{o.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Version */}
        <div>
          <div style={{
            fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.15em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)', marginBottom: 8,
          }}>Version</div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, padding: '0 14px', height: 38,
          }}>
            <span style={{
              fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.13em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)', flexShrink: 0,
            }}>Version</span>
            <input
              type="text"
              value={version}
              onChange={e => setVersion(e.target.value)}
              placeholder="e.g. v1, Draft, Final"
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontFamily: "'Geist', sans-serif", fontSize: 14, color: '#fff', textAlign: 'right',
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Preview Panel ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 20px 8px', flexShrink: 0,
        }}>
          <span style={{
            fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.15em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)',
          }}>Preview</span>
          <span style={{
            fontFamily: "'Geist Mono', monospace", fontSize: 9,
            color: 'rgba(255,255,255,0.15)', letterSpacing: '0.06em',
          }}>
            {anySelected ? `${pages.length} page${pages.length === 1 ? '' : 's'}` : '—'}
          </span>
        </div>

        <div className="no-scrollbar" style={{
          flex: 1, overflowY: 'auto', padding: '0 20px 20px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {anySelected ? (
            pages.map(p => <div key={p.key}>{p.node}</div>)
          ) : (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 20,
            }}>
              <p style={{
                fontFamily: "'Geist Mono', monospace", fontSize: 10,
                color: 'rgba(255,255,255,0.18)', letterSpacing: '0.08em', textAlign: 'center',
              }}>
                Select at least one section<br />to preview
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Print-only: render full pages for window.print() ── */}
      <div className="print-pages">
        {pages.map(p => (
          <div key={p.key} className="print-page">
            {p.node}
          </div>
        ))}
      </div>
    </motion.div>
  )
}
