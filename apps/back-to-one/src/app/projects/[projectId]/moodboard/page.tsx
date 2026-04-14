'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useProject, useMoodboard, useCreateMoodboardRef } from '@/lib/hooks/useOriginOne'

import { uploadMoodboardImage } from '@/lib/db/queries'
import { LoadingState, EmptyState } from '@/components/ui'
import { EmptyCTA } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { FAB } from '@/components/ui/FAB'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { haptic } from '@/lib/utils/haptics'
import { getProjectColor , statusHex, statusLabel } from '@/lib/utils/phase'
import { MOODBOARD_GRADIENTS } from '@/lib/utils/gradients'
import type { MoodboardRef } from '@/types'

type MoodCat = MoodboardRef['cat']

const CATEGORIES: { key: MoodCat; label: string }[] = [
  { key: 'tone',    label: 'Tone' },
  { key: 'visual',  label: 'Visual' },
  { key: 'product', label: 'Product' },
  { key: 'music',   label: 'Music' },
]

const catColor: Record<MoodCat, string> = {
  tone:    'text-prod bg-prod/10',
  visual:  'text-accent-soft bg-accent/10',
  product: 'text-pre bg-pre/10',
  music:   'text-post bg-post/10',
}

const GRADIENTS = MOODBOARD_GRADIENTS

function RefCard({ item, onTap }: { item: MoodboardRef; onTap: (r: MoodboardRef) => void }) {
  const [imgError, setImgError] = useState(false)
  const showImage = item.imageUrl && !item.imageUrl.startsWith('blob:') && !imgError

  return (
    <div
      className="rounded-lg border border-border overflow-hidden cursor-pointer active:opacity-80 transition-opacity"
      onClick={() => onTap(item)}
    >
      {showImage ? (
        <img src={item.imageUrl!} alt={item.title} className="h-24 w-full object-cover" onError={() => setImgError(true)} />
      ) : (
        <div className="h-24 w-full" style={{ background: item.gradient || GRADIENTS[0] }} />
      )}
      <div className="px-3 py-2.5 bg-surface">
        <div className="text-sm font-medium text-text truncate">{item.title}</div>
        {item.note && <div className="font-mono text-xs text-muted truncate mt-0.5">{item.note}</div>}
      </div>
    </div>
  )
}

function DetailSheet({ item, onClose }: { item: MoodboardRef | null; onClose: () => void }) {
  if (!item) return null
  return (
    <>
      <SheetHeader title={item.title} onClose={onClose} />
      <SheetBody>
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.title} className="w-full rounded-lg mb-4 object-cover" style={{ maxHeight: 200 }} />
        ) : (
          <div className="h-40 w-full rounded-lg mb-4" style={{ background: item.gradient || GRADIENTS[0] }} />
        )}
        <div className="mb-4">
          <span className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Category</span>
          <span className={`font-mono text-xs px-2 py-1 rounded-sm ${catColor[item.cat]}`}>
            {CATEGORIES.find(c => c.key === item.cat)?.label ?? item.cat}
          </span>
        </div>
        {item.note && (
          <div className="mb-4">
            <span className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Note</span>
            <div className="text-base text-text2 leading-relaxed p-3 bg-surface2 rounded-lg border border-border">{item.note}</div>
          </div>
        )}
      </SheetBody>
    </>
  )
}

// ── New Reference Sheet — image upload optional, inside the sheet ──

function NewRefSheet({ projectId, refCount, onClose, onSave }: {
  projectId: string; refCount: number
  onClose: () => void
  onSave: (data: Omit<MoodboardRef, 'id' | 'createdAt'>) => Promise<void>
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
      // Step 1: Upload image to storage
      let imageUrl: string | null = null
      if (imageFile) {
        console.log('[moodboard] uploading image to storage…')
        imageUrl = await uploadMoodboardImage(imageFile, projectId)
        console.log('[moodboard] upload OK → ', imageUrl)
      }

      // Step 2: Write to DB (wait for it to complete before closing)
      console.log('[moodboard] writing to DB…', { projectId, title: title.trim(), cat, imageUrl })
      await onSave({
        projectId, title: title.trim(), cat, note,
        imageUrl,
        gradient: GRADIENTS[refCount % GRADIENTS.length],
      })
      console.log('[moodboard] DB write OK')
      onClose()
    } catch (err: any) {
      const msg = err?.message || 'Failed to save reference. Please try again.'
      console.error('[moodboard] FAILED:', err)
      setError(msg)
      setSaving(false)
    }
  }

  return (
    <>
      <SheetHeader title="New Reference" onClose={onClose} />
      <SheetBody>
        <div className="flex flex-col gap-4">
          {/* Image upload area */}
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

          <div>
            <label className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Title</label>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Reference name"
              className="w-full bg-surface2 border border-border2 rounded-lg px-3 py-2.5 text-text text-base outline-none focus:border-accent transition-colors" />
          </div>
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

// ── Main Page ────────────────────────────────────────────

export default function MoodboardPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const { data: project } = useProject(projectId)
  const accent = getProjectColor(projectId)
  const [selected, setSelected] = useState<MoodboardRef | null>(null)
  const [creating, setCreating] = useState(false)

  const { data: refs, isLoading } = useMoodboard(projectId)
  const create = useCreateMoodboardRef(projectId)

  const allRefs = refs ?? []

  const grouped = CATEGORIES
    .map(c => ({ ...c, items: allRefs.filter(r => r.cat === c.key) }))
    .filter(g => g.items.length > 0)

  const startAdd = () => { haptic('light'); setCreating(true) }

  return (
    <div className="screen">
      <PageHeader projectId={projectId} title="Moodboard" meta={project ? (<div className="flex flex-col items-center gap-1.5"><span style={{ color: accent, fontSize: '0.50rem', letterSpacing: '0.06em' }}>{project.name}</span><span className="font-mono uppercase" style={{ fontSize: '0.38rem', padding: '2px 8px', borderRadius: 12, background: `${statusHex(project.status)}18`, color: statusHex(project.status) }}>{statusLabel(project.status)}</span></div>) : ''} />

      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 80 }}>
        {isLoading ? <LoadingState /> : (
          allRefs.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
              <EmptyCTA icon="🖼️" headline="Set the tone." sub="Drop in references. Build the world." addLabel="+ Add reference" onAdd={startAdd} />
            </div>
          ) : (
            grouped.map(({ key, label, items }) => (
              <div key={key} className="px-3.5 pt-3">
                <div className="font-mono text-sm text-muted tracking-widest uppercase mb-2 pb-1.5 border-b border-border">
                  <span className={`px-1.5 py-0.5 rounded-sm ${catColor[key]}`}>{label}</span>
                  <span className="ml-2 text-muted">{items.length}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {items.map(r => <RefCard key={r.id} item={r} onTap={setSelected} />)}
                </div>
              </div>
            ))
          )
        )}
      </div>

      <FAB accent={accent} projectId={projectId} onPress={startAdd} />

      <Sheet open={!!selected} onClose={() => setSelected(null)}>
        <DetailSheet item={selected} onClose={() => setSelected(null)} />
      </Sheet>

      <Sheet open={creating} onClose={() => setCreating(false)} maxHeight="85vh">
        <NewRefSheet
          projectId={projectId}
          refCount={allRefs.length}
          onClose={() => setCreating(false)}
          onSave={async (data) => { await create.mutateAsync(data as any) }}
        />
      </Sheet>
    </div>
  )
}