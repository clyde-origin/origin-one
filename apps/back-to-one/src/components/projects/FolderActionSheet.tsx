'use client'

// Folder action sheet — mirror of ProjectActionSheet for projects, used
// when a folder card is tapped in wiggle/edit mode. Inline rename, color
// picker (18 PROJECT_COLORS), delete with confirmation. Matches the
// existing sheet visual language.

import { useEffect, useState } from 'react'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { PROJECT_COLORS } from '@/lib/utils/phase'
import { haptic } from '@/lib/utils/haptics'

interface FolderActionSheetProps {
  folder: { id: string; name: string; color: string | null } | null
  onClose: () => void
  onRename: (name: string) => void
  onColorChange: (color: string) => void
  onDelete: () => void
}

export function FolderActionSheet({ folder, onClose, onRename, onColorChange, onDelete }: FolderActionSheetProps) {
  const [name, setName] = useState(folder?.name ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    if (folder) { setName(folder.name); setConfirmingDelete(false) }
  }, [folder?.id])

  if (!folder) return null

  const accent = folder.color ?? '#6470f3'

  function commitRename() {
    const trimmed = name.trim()
    if (trimmed.length > 0 && trimmed !== folder!.name) onRename(trimmed)
  }

  return (
    <Sheet open={!!folder} onClose={onClose}>
      <SheetHeader title="Folder" onClose={onClose} />
      <SheetBody>
        <div className="flex flex-col gap-4">
          <div>
            <label className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => { if (e.key === 'Enter') { commitRename(); e.currentTarget.blur() } }}
              className="w-full bg-surface2 border border-border2 rounded-lg px-3 py-2.5 text-text text-base outline-none focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Color</label>
            <div className="grid grid-cols-9 gap-2">
              {PROJECT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => { haptic('light'); onColorChange(c) }}
                  className="aspect-square rounded-full transition-transform active:scale-95"
                  style={{
                    background: c,
                    border: c === folder.color ? '2px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                    boxShadow: c === folder.color ? `0 0 0 2px ${c}66` : 'none',
                  }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>

          {confirmingDelete ? (
            <div className="flex flex-col gap-2">
              <div className="text-sm text-muted">
                Delete <b style={{ color: accent }}>{folder.name}</b>? Projects inside fall back to the home grid.
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="flex-1 py-3 rounded-lg bg-surface2 border border-border text-text"
                >Cancel</button>
                <button
                  onClick={() => { haptic('medium'); onDelete() }}
                  className="flex-1 py-3 rounded-lg text-white font-semibold"
                  style={{ background: '#e8564a' }}
                >Delete</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="w-full py-3 rounded-lg border text-base font-medium active:opacity-80"
              style={{ background: 'rgba(232,86,74,0.08)', borderColor: 'rgba(232,86,74,0.3)', color: '#e8564a' }}
            >
              Delete folder
            </button>
          )}
        </div>
      </SheetBody>
    </Sheet>
  )
}
