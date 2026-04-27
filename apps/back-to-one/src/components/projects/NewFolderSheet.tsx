'use client'

// Explicit "create empty folder" flow — sibling to the drag-onto-project
// auto-create. Same name + color affordances as FolderActionSheet, no
// delete. Confirms via "Create" button which calls onCreate(name, color)
// and closes.

import { useEffect, useState } from 'react'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { PROJECT_COLORS } from '@/lib/utils/phase'
import { haptic } from '@/lib/utils/haptics'

interface NewFolderSheetProps {
  open: boolean
  onClose: () => void
  onCreate: (input: { name: string; color: string | null }) => void
}

export function NewFolderSheet({ open, onClose, onCreate }: NewFolderSheetProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState<string | null>(null)

  useEffect(() => {
    if (open) { setName(''); setColor(null) }
  }, [open])

  const trimmed = name.trim()
  const canCreate = trimmed.length > 0

  function commit() {
    if (!canCreate) return
    haptic('medium')
    onCreate({ name: trimmed, color })
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader title="New folder" onClose={onClose} />
      <SheetBody>
        <div className="flex flex-col gap-4">
          <div>
            <label className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canCreate) commit() }}
              placeholder="Untitled"
              className="w-full bg-surface2 border border-border2 rounded-lg px-3 py-2.5 text-text text-base outline-none focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Color</label>
            <div className="grid grid-cols-9 gap-2">
              {PROJECT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => { haptic('light'); setColor(c) }}
                  className="aspect-square rounded-full transition-transform active:scale-95"
                  style={{
                    background: c,
                    border: c === color ? '2px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                    boxShadow: c === color ? `0 0 0 2px ${c}66` : 'none',
                  }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>

          <button
            onClick={commit}
            disabled={!canCreate}
            className="w-full py-3 rounded-lg text-white font-semibold text-base transition-opacity disabled:opacity-40 active:opacity-80"
            style={{ background: color ?? '#6470f3' }}
          >
            Create folder
          </button>
        </div>
      </SheetBody>
    </Sheet>
  )
}
