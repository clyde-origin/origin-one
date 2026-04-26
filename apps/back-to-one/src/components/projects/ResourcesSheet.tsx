'use client'

// Slide-up cross-project resources sheet. Toggled by ActionBarRoot's
// resources button via resourcesOpen in RootFabContext. Mirrors
// ChatSheet/ThreadsSheet shape and animation so the bar's three side
// sheets read as one visual language.
//
// Each row is a Resource with projectId IS NULL (made possible by the
// Resource.projectId nullable schema PR). Producers (post-Auth role gate)
// will be the only ones who can see and add to this surface; pre-Auth the
// sheet is open to whoever opens the bar slot.
//
// Add-resource UX is inline within the sheet header — there's no separate
// nested sheet, since the bar's + button is reserved for the 5-arc fan and
// nesting modals violates the design-system rule on this surface.

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAllResources, useCreateGlobalResource, useMeId } from '@/lib/hooks/useOriginOne'
import { haptic } from '@/lib/utils/haptics'
import type { ResourceType } from '@/types'

interface ResourcesSheetProps {
  open: boolean
}

interface GlobalResource {
  id: string
  title: string
  url: string
  type: ResourceType
  createdBy: string
  createdAt: string
}

const TYPES: ResourceType[] = ['link', 'file', 'image', 'video', 'document']

const TYPE_ICONS: Record<ResourceType, string> = {
  link:     '🔗',
  file:     '📄',
  image:    '🖼️',
  video:    '🎬',
  document: '📝',
}

function ResourceRow({ r }: { r: GlobalResource }) {
  return (
    <a
      href={r.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => haptic('light')}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 4px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        cursor: 'pointer',
        textDecoration: 'none',
      }}
      className="active:bg-white/[0.04] transition-colors"
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: 'rgba(100,112,243,0.12)',
        border: '1px solid rgba(100,112,243,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, fontSize: 16,
      }}>
        {TYPE_ICONS[r.type] ?? '📎'}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontSize: 13, fontWeight: 600, color: '#dddde8',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {r.title}
        </span>
        <span className="font-mono" style={{ fontSize: 9, color: '#62627a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {r.type}
        </span>
      </div>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, color: '#62627a' }}>
        <path d="M4 2h6v6M10 2L3 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </a>
  )
}

function AddForm({ onSubmit }: { onSubmit: (data: { title: string; url: string; type: ResourceType }) => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [type, setType] = useState<ResourceType>('link')

  const canSubmit = title.trim().length > 0 && url.trim().length > 0

  function reset() {
    setOpen(false); setTitle(''); setUrl(''); setType('link')
  }

  function submit() {
    if (!canSubmit) return
    haptic('light')
    onSubmit({ title: title.trim(), url: url.trim(), type })
    reset()
  }

  if (!open) {
    return (
      <button
        onClick={() => { haptic('light'); setOpen(true) }}
        className="active:opacity-70 transition-opacity"
        style={{
          width: '100%',
          marginTop: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '8px 14px',
          borderRadius: 20,
          border: '1px dashed rgba(100,112,243,0.3)',
          background: 'rgba(100,112,243,0.06)',
          color: 'rgba(100,112,243,0.85)',
          fontSize: 11, fontWeight: 500,
          letterSpacing: '0.04em',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
        <span className="font-mono uppercase" style={{ letterSpacing: '0.08em' }}>Add Resource</span>
      </button>
    )
  }

  return (
    <div style={{
      marginTop: 6,
      padding: 12,
      borderRadius: 12,
      border: '1px solid rgba(100,112,243,0.25)',
      background: 'rgba(100,112,243,0.05)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <input
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Title"
        style={{
          background: 'rgba(8,8,14,0.6)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8,
          padding: '8px 10px',
          color: '#dddde8',
          fontSize: 13,
          outline: 'none',
        }}
      />
      <input
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="https://…"
        style={{
          background: 'rgba(8,8,14,0.6)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8,
          padding: '8px 10px',
          color: '#dddde8',
          fontSize: 13,
          outline: 'none',
        }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {TYPES.map(t => (
          <button
            key={t}
            onClick={() => setType(t)}
            className="font-mono"
            style={{
              fontSize: 10,
              padding: '4px 9px',
              borderRadius: 20,
              border: `1px solid ${type === t ? 'rgba(100,112,243,0.5)' : 'rgba(255,255,255,0.08)'}`,
              background: type === t ? 'rgba(100,112,243,0.18)' : 'rgba(8,8,14,0.4)',
              color: type === t ? '#a8b0ff' : '#62627a',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            <span>{TYPE_ICONS[t]}</span>
            <span>{t}</span>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        <button
          onClick={reset}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'transparent',
            color: '#8a8a9a',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!canSubmit}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid rgba(100,112,243,0.6)',
            background: canSubmit ? '#6470f3' : 'rgba(100,112,243,0.2)',
            color: 'white',
            fontSize: 12, fontWeight: 600,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            opacity: canSubmit ? 1 : 0.6,
          }}
        >
          Add
        </button>
      </div>
    </div>
  )
}

export function ResourcesSheet({ open }: ResourcesSheetProps) {
  const meId = useMeId()
  const { data: resources, isLoading } = useAllResources()
  const allResources = (resources ?? []) as GlobalResource[]
  const create = useCreateGlobalResource()

  function handleAdd(data: { title: string; url: string; type: ResourceType }) {
    if (!meId) return // pre-Auth seed-empty edge; Resource.createdBy is non-null FK
    create.mutate({ ...data, createdBy: meId })
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="resources-sheet"
          initial={{ y: '110%' }}
          animate={{ y: 0 }}
          exit={{ y: '110%' }}
          transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
          style={{
            position: 'fixed',
            top: 156,
            bottom: 'calc(68px + 52px + 64px)',
            left: 14, right: 14,
            zIndex: 10,
            background: 'rgba(10,10,18,0.78)',
            backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 -1px 0 rgba(255,255,255,0.05), 0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {/* Accent line — brand indigo */}
          <div style={{
            height: 2, flexShrink: 0,
            background: 'linear-gradient(90deg, transparent 5%, rgba(100,112,243,0.45) 40%, rgba(100,112,243,0.45) 60%, transparent 95%)',
          }} />

          {/* Header */}
          <div style={{
            padding: '14px 18px 12px', flexShrink: 0,
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}>
            <div className="font-mono" style={{ fontSize: 9, color: 'rgba(100,112,243,0.5)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>All Projects</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#dddde8', letterSpacing: '-0.02em', marginTop: 2 }}>
              Resources
            </div>
            <div className="font-mono" style={{ fontSize: 10, color: '#62627a', marginTop: 4 }}>
              {isLoading ? 'Loading…' : `${allResources.length} resource${allResources.length !== 1 ? 's' : ''} · company-wide`}
            </div>
            <AddForm onSubmit={handleAdd} />
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 18px 18px' }}>
            {!isLoading && allResources.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', fontSize: 12, color: '#62627a' }}>
                No company resources yet
              </div>
            ) : (
              allResources.map((r) => <ResourceRow key={r.id} r={r} />)
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
