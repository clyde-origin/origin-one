'use client'

import { useState, useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react'
import { getSceneColor } from '@/lib/utils/phase'
import type { Scene } from '@/types'

// ── Content block types ──────────────────────────────────
type ContentBlock =
  | { type: 'action'; id: string; content: string }
  | { type: 'dialogue'; id: string; character: string; content: string }

function parseBlocks(description: string | null): ContentBlock[] {
  if (!description) return []
  try {
    const parsed = JSON.parse(description)
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.type) {
      // Ensure every block has an id
      return parsed.map((b: ContentBlock) => ({ ...b, id: b.id || crypto.randomUUID() }))
    }
  } catch { /* not JSON — treat as plain text */ }
  return description.trim()
    ? [{ type: 'action' as const, id: crypto.randomUUID(), content: description }]
    : []
}

function serializeBlocks(blocks: ContentBlock[]): string {
  return JSON.stringify(blocks)
}

// ── Public handle ────────────────────────────────────────
export interface ScriptViewHandle {
  addScene: () => void
  addAction: () => void
  addDialogue: () => void
  flush: () => void
  getFocusedSceneIndex: () => number
}

interface ScriptViewProps {
  scenes: Scene[]
  accent: string
  onUpdateScene: (sceneId: string, fields: { title?: string; description?: string }) => void
}

export const ScriptView = forwardRef<ScriptViewHandle, ScriptViewProps>(function ScriptView({ scenes, accent, onUpdateScene }, ref) {
  console.log('ScriptView rendered', { sceneCount: scenes.length, accent })

  const totalScenes = scenes.length
  const focusedSceneIndex = useRef(0)

  // Structural version counter — increment to re-render when blocks are added/removed
  const [blocksVersion, setBlocksVersion] = useState(0)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void blocksVersion // used implicitly via setBlocksVersion triggering re-render

  // Block data per scene (cached so React doesn't overwrite contentEditable)
  const blocksRef = useRef<Map<string, ContentBlock[]>>(new Map())

  // ID of a newly added block to auto-focus
  const newBlockIdRef = useRef<string | null>(null)

  // Pending edits + debounce
  const pendingEdits = useRef<Map<string, { title?: string; description?: string }>>(new Map())
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // ── Block helpers ──────────────────────────────────────
  const getSceneBlocks = useCallback((scene: Scene): ContentBlock[] => {
    if (blocksRef.current.has(scene.id)) return blocksRef.current.get(scene.id)!
    const blocks = parseBlocks(scene.description)
    if (blocks.length === 0) blocks.push({ type: 'action', id: crypto.randomUUID(), content: '' })
    blocksRef.current.set(scene.id, blocks)
    return blocks
  }, [])

  // ── Save helpers ───────────────────────────────────────
  const queueEdit = useCallback((sceneId: string, fields: { title?: string; description?: string }) => {
    const existing = pendingEdits.current.get(sceneId) ?? {}
    pendingEdits.current.set(sceneId, { ...existing, ...fields })
  }, [])

  const saveScene = useCallback((sceneId: string) => {
    const fields = pendingEdits.current.get(sceneId)
    if (fields) {
      console.log('[ScriptView] saving', sceneId, fields)
      onUpdateScene(sceneId, fields)
      pendingEdits.current.delete(sceneId)
    }
    const timer = debounceTimers.current.get(sceneId)
    if (timer) { clearTimeout(timer); debounceTimers.current.delete(sceneId) }
  }, [onUpdateScene])

  const flushEdits = useCallback(() => {
    pendingEdits.current.forEach((_f, sceneId) => saveScene(sceneId))
  }, [saveScene])

  const scheduleDebounceSave = useCallback((sceneId: string) => {
    const existing = debounceTimers.current.get(sceneId)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      console.log('[ScriptView] debounce fired for', sceneId)
      saveScene(sceneId)
      debounceTimers.current.delete(sceneId)
    }, 2000)
    debounceTimers.current.set(sceneId, timer)
  }, [saveScene])

  // ── Auto-focus newly added blocks ──────────────────────
  useEffect(() => {
    if (newBlockIdRef.current) {
      const el = document.querySelector(`[data-block-id="${newBlockIdRef.current}"]`) as HTMLElement | null
      if (el) el.focus()
      newBlockIdRef.current = null
    }
  }, [blocksVersion])

  // ── Flush on unmount ───────────────────────────────────
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      debounceTimers.current.forEach(t => clearTimeout(t))
      // eslint-disable-next-line react-hooks/exhaustive-deps
      pendingEdits.current.forEach((fields, sceneId) => {
        console.log('[ScriptView] flush on unmount', sceneId, fields)
        onUpdateScene(sceneId, fields)
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Imperative handle ──────────────────────────────────
  useImperativeHandle(ref, () => ({
    addScene: () => {}, // handled by parent via handleAddScene
    addAction: () => {
      const sceneId = scenes[focusedSceneIndex.current]?.id
      if (!sceneId) return
      const blocks = blocksRef.current.get(sceneId) || []
      const newBlock: ContentBlock = { type: 'action', id: crypto.randomUUID(), content: '' }
      blocks.push(newBlock)
      blocksRef.current.set(sceneId, blocks)
      queueEdit(sceneId, { description: serializeBlocks(blocks) })
      scheduleDebounceSave(sceneId)
      newBlockIdRef.current = newBlock.id
      setBlocksVersion(v => v + 1)
    },
    addDialogue: () => {
      const sceneId = scenes[focusedSceneIndex.current]?.id
      if (!sceneId) return
      const blocks = blocksRef.current.get(sceneId) || []
      const newBlock: ContentBlock = { type: 'dialogue', id: crypto.randomUUID(), character: '', content: '' }
      blocks.push(newBlock)
      blocksRef.current.set(sceneId, blocks)
      queueEdit(sceneId, { description: serializeBlocks(blocks) })
      newBlockIdRef.current = newBlock.id
      setBlocksVersion(v => v + 1)
    },
    flush: flushEdits,
    getFocusedSceneIndex: () => focusedSceneIndex.current,
  }))

  // ── Style helpers ──────────────────────────────────────
  const focusStyle = (e: React.FocusEvent<HTMLDivElement>) => {
    e.currentTarget.style.background = `${accent}0d`
    e.currentTarget.style.boxShadow = `0 0 0 4px ${accent}0d`
  }
  const blurStyle = (e: React.FocusEvent<HTMLDivElement>) => {
    e.currentTarget.style.background = ''
    e.currentTarget.style.boxShadow = ''
  }

  // ── Input handlers ─────────────────────────────────────
  const handleTitleInput = useCallback((sceneId: string, e: React.FormEvent<HTMLDivElement>) => {
    const val = e.currentTarget.textContent?.trim() ?? ''
    queueEdit(sceneId, { title: val })
    scheduleDebounceSave(sceneId)
  }, [queueEdit, scheduleDebounceSave])

  const handleTitleBlur = useCallback((sceneId: string, e: React.FocusEvent<HTMLDivElement>) => {
    blurStyle(e)
    saveScene(sceneId)
  }, [saveScene])

  const handleBlockInput = useCallback((sceneId: string, blockIndex: number, field: 'content' | 'character', e: React.FormEvent<HTMLDivElement>) => {
    const val = e.currentTarget.textContent?.trim() ?? ''
    const blocks = blocksRef.current.get(sceneId)
    if (!blocks || !blocks[blockIndex]) return
    ;(blocks[blockIndex] as any)[field] = val
    queueEdit(sceneId, { description: serializeBlocks(blocks) })
    scheduleDebounceSave(sceneId)
  }, [queueEdit, scheduleDebounceSave])

  const handleBlockBlur = useCallback((sceneId: string, e: React.FocusEvent<HTMLDivElement>) => {
    blurStyle(e)
    saveScene(sceneId)
  }, [saveScene])

  // ── Empty state ────────────────────────────────────────
  if (scenes.length === 0) return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: '60vh', gap: 10 }}>
      <div className="flex items-center justify-center cursor-pointer rounded-full" style={{ width: 40, height: 40, border: '1.5px dashed rgba(196,90,220,0.35)' }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1V11M1 6H11" stroke="rgba(196,90,220,0.5)" strokeWidth="1.4" strokeLinecap="round" /></svg>
      </div>
      <span style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.9rem', color: '#62627a', letterSpacing: '0.04em' }}>Write Now</span>
    </div>
  )

  // ── Main render ────────────────────────────────────────
  return (
    <div style={{ paddingBottom: 20 }}>
      {scenes.map((scene, si) => {
        const sceneNum = parseInt(scene.sceneNumber) || (si + 1)
        const sceneColor = getSceneColor(sceneNum, totalScenes)
        const blocks = getSceneBlocks(scene)

        return (
          <div key={scene.id}
            style={{ padding: '20px 20px 0', borderTop: si > 0 ? '1px solid rgba(255,255,255,0.05)' : undefined }}
            onFocus={() => { focusedSceneIndex.current = si }}>

            {/* Scene number badge + Title */}
            <div className="flex items-start" style={{ gap: 8, marginBottom: 12 }}>
              <span className="font-mono flex-shrink-0" style={{ fontSize: '0.52rem', fontWeight: 700, color: sceneColor, background: `${sceneColor}1a`, borderRadius: 4, padding: '2px 5px', marginTop: 2 }}>
                {scene.sceneNumber.padStart(2, '0')}
              </span>
              <div contentEditable suppressContentEditableWarning
                ref={el => {
                  if (el && !el.getAttribute('data-init')) {
                    el.textContent = scene.title ?? ''
                    el.setAttribute('data-init', '1')
                  }
                }}
                style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.78rem', fontWeight: 700, color: '#dddde8', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.4, outline: 'none', borderRadius: 4, cursor: 'text', flex: 1, minHeight: 20 }}
                onFocus={focusStyle}
                onInput={e => handleTitleInput(scene.id, e)}
                onBlur={e => handleTitleBlur(scene.id, e)}
              />
            </div>

            {/* Content blocks */}
            {blocks.map((block, bi) => {
              if (block.type === 'action') {
                return (
                  <div key={block.id}
                    data-block-id={block.id}
                    contentEditable suppressContentEditableWarning
                    ref={el => {
                      if (el && !el.getAttribute('data-init')) {
                        el.textContent = block.content
                        el.setAttribute('data-init', '1')
                      }
                    }}
                    data-placeholder="Action description..."
                    style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.74rem', color: '#a0a0b8', lineHeight: 1.65, marginBottom: 10, outline: 'none', borderRadius: 4, cursor: 'text', minHeight: 20 }}
                    onFocus={focusStyle}
                    onInput={e => handleBlockInput(scene.id, bi, 'content', e)}
                    onBlur={e => handleBlockBlur(scene.id, e)}
                  />
                )
              }

              if (block.type === 'dialogue') {
                return (
                  <div key={block.id} style={{ padding: '6px 0 6px 32px', marginBottom: 10 }}>
                    <div
                      data-block-id={block.id}
                      contentEditable suppressContentEditableWarning
                      ref={el => {
                        if (el && !el.getAttribute('data-init')) {
                          el.textContent = block.character
                          el.setAttribute('data-init', '1')
                        }
                      }}
                      data-placeholder="CHARACTER NAME"
                      style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.72rem', fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', marginBottom: 3, outline: 'none', cursor: 'text', minHeight: 18 }}
                      onFocus={focusStyle}
                      onInput={e => handleBlockInput(scene.id, bi, 'character', e)}
                      onBlur={e => handleBlockBlur(scene.id, e)}
                    />
                    <div
                      contentEditable suppressContentEditableWarning
                      ref={el => {
                        if (el && !el.getAttribute('data-init')) {
                          el.textContent = block.content
                          el.setAttribute('data-init', '1')
                        }
                      }}
                      data-placeholder="Dialogue text..."
                      style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.72rem', color: '#a0a0b8', lineHeight: 1.55, textAlign: 'center', maxWidth: 220, margin: '0 auto', outline: 'none', cursor: 'text', minHeight: 18 }}
                      onFocus={focusStyle}
                      onInput={e => handleBlockInput(scene.id, bi, 'content', e)}
                      onBlur={e => handleBlockBlur(scene.id, e)}
                    />
                  </div>
                )
              }

              return null
            })}
          </div>
        )
      })}
    </div>
  )
})
