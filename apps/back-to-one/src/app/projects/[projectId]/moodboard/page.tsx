'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  useProject,
  useMoodboard,
  useMoodboardTabs,
  useCreateMoodboardRef,
  useUpdateMoodboardRef,
  useDeleteMoodboardRef,
  useReorderMoodboardRefs,
  useCreateMoodboardTab,
  useUpdateMoodboardTab,
  useDeleteMoodboardTab,
} from '@/lib/hooks/useOriginOne'
import { uploadMoodboardImage } from '@/lib/db/queries'
import { LoadingState } from '@/components/ui'
import { EmptyCTA } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { FAB } from '@/components/ui/FAB'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { haptic } from '@/lib/utils/haptics'
import { getProjectColor, statusHex, statusLabel } from '@/lib/utils/phase'
import { MOODBOARD_GRADIENTS } from '@/lib/utils/gradients'
import type { MoodboardRef, MoodboardTab } from '@/types'

type MoodCat = MoodboardRef['cat']
const GRADIENTS = MOODBOARD_GRADIENTS

const CATEGORIES: { key: MoodCat; label: string }[] = [
  { key: 'tone',    label: 'Tone' },
  { key: 'visual',  label: 'Visual' },
  { key: 'product', label: 'Product' },
  { key: 'music',   label: 'Music' },
]

// ── Tab Bar ───────────────────────────────────────────────

function TabBar({
  tabs,
  activeTabId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
}: {
  tabs: MoodboardTab[]
  activeTabId: string | null
  onSelect: (id: string | null) => void
  onAdd: () => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId) inputRef.current?.focus()
  }, [editingId])

  const commitRename = () => {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim())
    }
    setEditingId(null)
  }

  return (
    <div className="flex items-center gap-1 px-3.5 pt-2 pb-1 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* "All" tab */}
      <button
        onClick={() => onSelect(null)}
        className="shrink-0 font-mono text-xs tracking-wider uppercase px-3 py-1.5 rounded-md border transition-colors"
        style={activeTabId === null
          ? { background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)', color: '#fff' }
          : { background: 'transparent', borderColor: 'transparent', color: '#62627a' }
        }
      >All</button>

      {tabs.map(tab => (
        <div key={tab.id} className="shrink-0 relative group">
          {editingId === tab.id ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null) }}
              className="font-mono text-xs tracking-wider uppercase px-3 py-1.5 rounded-md border bg-surface2 border-accent/40 text-text outline-none"
              style={{ width: Math.max(60, editValue.length * 8 + 30) }}
            />
          ) : (
            <button
              onClick={() => {
                if (activeTabId === tab.id) {
                  // Double-tap active tab → rename
                  setEditValue(tab.name)
                  setEditingId(tab.id)
                } else {
                  onSelect(tab.id)
                }
              }}
              onContextMenu={e => { e.preventDefault(); onDelete(tab.id) }}
              className="font-mono text-xs tracking-wider uppercase px-3 py-1.5 rounded-md border transition-colors"
              style={activeTabId === tab.id
                ? { background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)', color: '#fff' }
                : { background: 'transparent', borderColor: 'transparent', color: '#62627a' }
              }
            >{tab.name}</button>
          )}
        </div>
      ))}

      {/* + button */}
      <button
        onClick={onAdd}
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md border transition-colors active:opacity-70"
        style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#62627a' }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M5 1V9M1 5H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

// ── Ref Card ──────────────────────────────────────────────

function RefCard({
  item,
  onTap,
  onLongPress,
  isDragging,
  dragHandleProps,
}: {
  item: MoodboardRef
  onTap: (r: MoodboardRef) => void
  onLongPress?: () => void
  isDragging?: boolean
  dragHandleProps?: any
}) {
  const [imgError, setImgError] = useState(false)
  const showImage = item.imageUrl && !item.imageUrl.startsWith('blob:') && !imgError
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      haptic('medium')
      onLongPress?.()
    }, 500)
  }
  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
  }

  return (
    <div
      className="rounded-lg border border-border overflow-hidden cursor-pointer active:opacity-80 transition-all"
      style={isDragging ? { opacity: 0.6, transform: 'scale(1.04)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' } : {}}
      onClick={() => !isDragging && onTap(item)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
      {...dragHandleProps}
    >
      {showImage ? (
        <img src={item.imageUrl!} alt={item.title} className="h-28 w-full object-cover" onError={() => setImgError(true)} />
      ) : (
        <div className="h-28 w-full" style={{ background: item.gradient || GRADIENTS[0] }} />
      )}
      <div className="px-3 py-2.5 bg-surface">
        <div className="text-sm font-medium text-text truncate">{item.title}</div>
        {item.note && <div className="font-mono text-xs text-muted truncate mt-0.5">{item.note}</div>}
      </div>
    </div>
  )
}

// ── Detail Sheet (view/edit/replace/delete) ───────────────

function DetailSheet({
  item,
  projectId,
  onClose,
  onUpdate,
  onDelete,
}: {
  item: MoodboardRef | null
  projectId: string
  onClose: () => void
  onUpdate: (id: string, fields: any) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [note, setNote] = useState(item?.note ?? '')
  const [title, setTitle] = useState(item?.title ?? '')
  const [replacing, setReplacing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const noteRef = useRef(item?.note ?? '')
  const titleRef = useRef(item?.title ?? '')

  // Sync when item changes
  useEffect(() => {
    if (item) {
      setNote(item.note ?? '')
      setTitle(item.title ?? '')
      noteRef.current = item.note ?? ''
      titleRef.current = item.title ?? ''
    }
  }, [item?.id])

  // Auto-save on close
  const handleClose = useCallback(async () => {
    if (item) {
      const changes: Record<string, string | null> = {}
      if (note !== noteRef.current) changes.note = note || null
      if (title !== titleRef.current) changes.title = title
      if (Object.keys(changes).length > 0) {
        try { await onUpdate(item.id, changes) } catch {}
      }
    }
    onClose()
  }, [item, note, title, onClose, onUpdate])

  if (!item) return null

  const handleReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setReplacing(true)
    setError(null)
    try {
      const imageUrl = await uploadMoodboardImage(file, projectId)
      await onUpdate(item.id, { imageUrl })
    } catch (err: any) {
      setError(err?.message || 'Replace failed')
    } finally {
      setReplacing(false)
      e.target.value = ''
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await onDelete(item.id)
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Delete failed')
      setDeleting(false)
    }
  }

  return (
    <>
      <SheetHeader title="" onClose={handleClose} />
      <SheetBody>
        {/* Title — inline editable */}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full text-lg font-semibold text-text bg-transparent outline-none mb-4 border-b border-transparent focus:border-border pb-1"
          placeholder="Title"
        />

        {/* Image */}
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.title} className="w-full rounded-lg mb-3 object-cover" style={{ maxHeight: 240 }} />
        ) : (
          <div className="h-40 w-full rounded-lg mb-3" style={{ background: item.gradient || GRADIENTS[0] }} />
        )}

        {/* Replace image */}
        <input ref={fileRef} type="file" accept="image/*" onChange={handleReplace} style={{ display: 'none' }} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={replacing}
          className="w-full py-2.5 rounded-lg border border-border text-sm font-mono text-muted tracking-wider uppercase mb-3 active:opacity-70 transition-opacity disabled:opacity-40"
        >
          {replacing ? 'Uploading...' : item.imageUrl ? 'Replace Image' : 'Add Image'}
        </button>

        {/* Notes */}
        <label className="font-mono text-xs text-muted tracking-widest uppercase block mb-1.5">Notes</label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={3}
          placeholder="Add notes..."
          className="w-full bg-surface2 border border-border2 rounded-lg px-3 py-2.5 text-text text-sm outline-none focus:border-accent transition-colors resize-none mb-4"
        />

        {/* Error */}
        {error && (
          <div className="rounded-lg px-3 py-2.5 text-sm mb-3" style={{ background: 'rgba(255,59,48,0.12)', color: '#ff6b6b', border: '1px solid rgba(255,59,48,0.2)' }}>
            {error}
          </div>
        )}

        {/* Delete */}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="w-full py-2.5 rounded-lg text-sm font-mono tracking-wider uppercase transition-opacity active:opacity-70 disabled:opacity-40"
          style={{ background: 'rgba(255,59,48,0.1)', color: '#ff6b6b', border: '1px solid rgba(255,59,48,0.15)' }}
        >
          {deleting ? 'Deleting...' : 'Delete Reference'}
        </button>
      </SheetBody>
    </>
  )
}

// ── New Reference Sheet ───────────────────────────────────

function NewRefSheet({ projectId, refCount, activeTabId, onClose, onSave }: {
  projectId: string; refCount: number; activeTabId: string | null
  onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [cat, setCat]     = useState<MoodCat>('tone')
  const [note, setNote]   = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  const handleSubmit = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      let imageUrl: string | null = null
      if (imageFile) {
        imageUrl = await uploadMoodboardImage(imageFile, projectId)
      }
      await onSave({
        projectId, title: title.trim(), cat, note,
        imageUrl,
        gradient: GRADIENTS[refCount % GRADIENTS.length],
        sortOrder: refCount,
        tabId: activeTabId,
      })
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to save reference.')
      setSaving(false)
    }
  }

  return (
    <>
      <SheetHeader title="New Reference" onClose={onClose} />
      <SheetBody>
        <div className="flex flex-col gap-4">
          {/* Image upload */}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
          {imagePreview ? (
            <div className="relative w-full rounded-lg overflow-hidden border border-border cursor-pointer" style={{ maxHeight: 140 }}
              onClick={() => fileRef.current?.click()}>
              <img src={imagePreview} alt="Preview" className="w-full object-cover" style={{ maxHeight: 140 }} />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.4)' }}>
                <span className="font-mono text-xs text-white">Change image</span>
              </div>
            </div>
          ) : (
            <div
              className="w-full rounded-lg border border-dashed cursor-pointer flex flex-col items-center justify-center gap-2 active:opacity-70 transition-opacity"
              style={{ borderColor: 'rgba(255,255,255,0.15)', padding: '20px 0' }}
              onClick={() => fileRef.current?.click()}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '1.5px dashed rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2V10M2 6H10" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </div>
              <span className="font-mono text-xs" style={{ color: '#62627a' }}>Upload image</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Title</label>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Reference name"
              className="w-full bg-surface2 border border-border2 rounded-lg px-3 py-2.5 text-text text-base outline-none focus:border-accent transition-colors" />
          </div>

          {/* Category */}
          <div>
            <label className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Category</label>
            <div className="flex gap-2">
              {CATEGORIES.map(c => (
                <button key={c.key} onClick={() => setCat(c.key)}
                  className={`flex-1 font-mono text-xs tracking-widest uppercase py-2 rounded-md border transition-colors ${
                    cat === c.key ? 'bg-accent/20 text-accent-soft border-accent/30' : 'bg-surface2 text-muted border-border'
                  }`}
                >{c.label}</button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Notes</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Optional"
              className="w-full bg-surface2 border border-border2 rounded-lg px-3 py-2.5 text-text text-base outline-none focus:border-accent transition-colors resize-none" />
          </div>

          {error && (
            <div className="rounded-lg px-3 py-2.5 text-sm" style={{ background: 'rgba(255,59,48,0.12)', color: '#ff6b6b', border: '1px solid rgba(255,59,48,0.2)' }}>
              {error}
            </div>
          )}
          <button onClick={handleSubmit} disabled={!title.trim() || saving}
            className="w-full py-3 rounded-lg bg-accent text-white font-semibold text-base transition-opacity disabled:opacity-40 active:opacity-80">
            {saving ? 'Saving...' : 'Add Reference'}
          </button>
        </div>
      </SheetBody>
    </>
  )
}

// ── Drag-to-Reorder Grid ─────────────────────────────────

function ReorderableGrid({
  items,
  onTap,
  onReorder,
}: {
  items: MoodboardRef[]
  onTap: (r: MoodboardRef) => void
  onReorder: (reordered: MoodboardRef[]) => void
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const [ordered, setOrdered] = useState(items)

  useEffect(() => { setOrdered(items) }, [items])

  const handleDragStart = (idx: number) => {
    setDragIdx(idx)
    haptic('medium')
  }

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    setOverIdx(idx)

    // Reorder in state
    const next = [...ordered]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(idx, 0, moved)
    setOrdered(next)
    setDragIdx(idx)
  }

  const handleDrop = () => {
    if (dragIdx !== null) {
      onReorder(ordered)
    }
    setDragIdx(null)
    setOverIdx(null)
  }

  // Touch-based long-press drag for mobile
  const longPressRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; idx: number | null }>({ timer: null, idx: null })
  const [touchDragIdx, setTouchDragIdx] = useState<number | null>(null)

  return (
    <div className="grid grid-cols-2 gap-2 px-3.5">
      {ordered.map((ref, idx) => (
        <div
          key={ref.id}
          draggable
          onDragStart={() => handleDragStart(idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDragEnd={handleDrop}
        >
          <RefCard
            item={ref}
            onTap={onTap}
            isDragging={dragIdx === idx}
            onLongPress={() => {
              setTouchDragIdx(idx)
              // For now, long-press selects for reorder on desktop drag
            }}
          />
        </div>
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────

export default function MoodboardPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const { data: project } = useProject(projectId)
  const accent = project?.color || getProjectColor(projectId)

  const [selected, setSelected] = useState<MoodboardRef | null>(null)
  const [creating, setCreating] = useState(false)
  const [activeTabId, setActiveTabId] = useState<string | null>(null)

  // Data
  const { data: refs, isLoading } = useMoodboard(projectId)
  const { data: tabs } = useMoodboardTabs(projectId)
  const create = useCreateMoodboardRef(projectId)
  const update = useUpdateMoodboardRef(projectId)
  const remove = useDeleteMoodboardRef(projectId)
  const reorder = useReorderMoodboardRefs(projectId)
  const createTab = useCreateMoodboardTab(projectId)
  const updateTab = useUpdateMoodboardTab(projectId)
  const deleteTab = useDeleteMoodboardTab(projectId)

  const allRefs = refs ?? []
  const allTabs = tabs ?? []

  // Filter refs by active tab
  const filtered = activeTabId === null
    ? allRefs
    : allRefs.filter(r => r.tabId === activeTabId)

  const startAdd = () => { haptic('light'); setCreating(true) }

  const handleAddTab = async () => {
    haptic('light')
    const name = `Board ${allTabs.length + 1}`
    const result = await createTab.mutateAsync({ projectId, name, sortOrder: allTabs.length })
    setActiveTabId(result.id)
  }

  const handleRenameTab = (id: string, name: string) => {
    updateTab.mutate({ id, fields: { name } })
  }

  const handleDeleteTab = (id: string) => {
    if (activeTabId === id) setActiveTabId(null)
    deleteTab.mutate(id)
  }

  const handleUpdate = async (id: string, fields: any) => {
    await update.mutateAsync({ id, fields })
    // Refresh selected item if it's the one being updated
    if (selected?.id === id) {
      setSelected(prev => prev ? { ...prev, ...fields } : null)
    }
  }

  const handleDelete = async (id: string) => {
    await remove.mutateAsync(id)
  }

  const handleReorder = (reordered: MoodboardRef[]) => {
    const updates = reordered.map((r, i) => ({ id: r.id, sortOrder: i }))
    reorder.mutate(updates)
  }

  return (
    <div className="screen">
      <PageHeader
        projectId={projectId}
        title="Moodboard"
        meta={project ? (
          <div className="flex flex-col items-center gap-1.5">
            <span style={{ color: accent, fontSize: '0.50rem', letterSpacing: '0.06em' }}>{project.name}</span>
            <span className="font-mono uppercase" style={{ fontSize: '0.38rem', padding: '2px 8px', borderRadius: 12, background: `${statusHex(project.status)}18`, color: statusHex(project.status) }}>
              {statusLabel(project.status)}
            </span>
          </div>
        ) : ''}
      />

      {/* Tab Bar */}
      <TabBar
        tabs={allTabs}
        activeTabId={activeTabId}
        onSelect={setActiveTabId}
        onAdd={handleAddTab}
        onRename={handleRenameTab}
        onDelete={handleDeleteTab}
      />

      {/* Divider */}
      <div className="mx-3.5 border-b border-border" />

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 80 }}>
        {isLoading ? <LoadingState /> : (
          filtered.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
              <EmptyCTA
                icon="🖼️"
                headline={activeTabId ? 'Empty board.' : 'Set the tone.'}
                sub={activeTabId ? 'Add references to this board.' : 'Drop in references. Build the world.'}
                addLabel="+ Add reference"
                onAdd={startAdd}
              />
            </div>
          ) : (
            <div className="pt-3 pb-4">
              <ReorderableGrid items={filtered} onTap={setSelected} onReorder={handleReorder} />
              <div className="px-3.5 mt-3">
                <span className="font-mono text-xs text-muted">{filtered.length} reference{filtered.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          )
        )}
      </div>

      <FAB accent={accent} projectId={projectId} onPress={startAdd} />

      {/* Detail Sheet */}
      <Sheet open={!!selected} onClose={() => {
        // Trigger auto-save via DetailSheet's handleClose
        const closeBtn = document.querySelector('[aria-label="Close"]') as HTMLButtonElement
        closeBtn?.click()
      }} maxHeight="85vh">
        <DetailSheet
          item={selected}
          projectId={projectId}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      </Sheet>

      {/* Create Sheet */}
      <Sheet open={creating} onClose={() => setCreating(false)} maxHeight="85vh">
        <NewRefSheet
          projectId={projectId}
          refCount={allRefs.length}
          activeTabId={activeTabId}
          onClose={() => setCreating(false)}
          onSave={async (data) => { await create.mutateAsync(data as any) }}
        />
      </Sheet>
    </div>
  )
}
