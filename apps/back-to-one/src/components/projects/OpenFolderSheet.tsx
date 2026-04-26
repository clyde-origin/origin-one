'use client'

// iOS-style "open folder" — a glass card layered over the projects grid
// when the user taps a folder outside wiggle. Renders the folder's
// projects in the same 2-col SlateCard grid the home grid uses, but
// scoped to the folder. Closing handled by the bar's Back button via
// RootFabContext.closeOpenFolder() (already wired in PR #37 stack
// extension), tap on the dim backdrop, or escape (later).

import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { getProjectColor } from '@/lib/utils/phase'
import { haptic } from '@/lib/utils/haptics'
import type { Project } from '@/types'

interface OpenFolderSheetProps {
  open: boolean
  folder: { id: string; name: string; color: string | null } | null
  projects: Project[]
  onClose: () => void
}

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

export function OpenFolderSheet({ open, folder, projects, onClose }: OpenFolderSheetProps) {
  const router = useRouter()
  const accent = folder?.color ?? '#6470f3'

  return (
    <AnimatePresence>
      {open && folder && (
        <motion.div
          key="open-folder"
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 12 }}
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          style={{
            position: 'fixed',
            top: 156,
            bottom: 'calc(68px + 52px + 64px + env(safe-area-inset-bottom, 0px))',
            left: 14, right: 14,
            zIndex: 12,
            background: 'rgba(10,10,18,0.78)',
            backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
            border: `1px solid ${hexToRgba(accent, 0.3)}`,
            borderRadius: 20, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 -1px 0 rgba(255,255,255,0.05), 0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {/* Accent line */}
          <div style={{
            height: 2, flexShrink: 0,
            background: `linear-gradient(90deg, transparent 5%, ${hexToRgba(accent, 0.45)} 40%, ${hexToRgba(accent, 0.45)} 60%, transparent 95%)`,
          }} />

          {/* Header */}
          <div style={{ padding: '14px 18px 12px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="font-mono" style={{ fontSize: 9, color: hexToRgba(accent, 0.6), textTransform: 'uppercase', letterSpacing: '0.12em' }}>Folder</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#dddde8', letterSpacing: '-0.02em', marginTop: 2 }}>{folder.name}</div>
            <div className="font-mono" style={{ fontSize: 10, color: '#62627a', marginTop: 4 }}>
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Grid */}
          <div style={{
            flex: 1, minHeight: 0, overflowY: 'auto',
            WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
            padding: '12px 14px 18px',
          }}>
            {projects.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', fontSize: 12, color: '#62627a' }}>
                No projects yet — drop one in from the home grid
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                {projects.map(p => {
                  const color = p.color || getProjectColor(p.id)
                  return (
                    <button
                      key={p.id}
                      onClick={() => { haptic('light'); onClose(); router.push(`/projects/${p.id}`) }}
                      className="active:scale-[0.96] active:brightness-[0.85]"
                      style={{
                        aspectRatio: '4 / 3',
                        borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
                        border: '1px solid rgba(255,255,255,0.06)',
                        background: 'rgba(10,10,18,0.6)',
                        padding: 0, textAlign: 'left',
                      }}
                    >
                      <div style={{
                        height: 18,
                        backgroundColor: color,
                        backgroundImage:
                          `linear-gradient(rgba(255,255,255,0.28), rgba(255,255,255,0.28)) 0 1px / 100% 1px no-repeat,
                           linear-gradient(rgba(255,255,255,0.15), rgba(255,255,255,0.15)) 0 4px / 100% 1px no-repeat,
                           linear-gradient(rgba(255,255,255,0.07), rgba(255,255,255,0.07)) 0 7px / 100% 1px no-repeat`,
                      }} />
                      <div style={{ padding: '9px 10px 11px' }}>
                        <div style={{ fontWeight: 800, fontSize: 13, color: '#dddde8', letterSpacing: '-0.02em' }}>{p.name}</div>
                        <div className="font-mono" style={{ fontSize: 9, color: '#62627a', letterSpacing: '0.06em', marginTop: 2 }}>
                          {p.client || ''}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
