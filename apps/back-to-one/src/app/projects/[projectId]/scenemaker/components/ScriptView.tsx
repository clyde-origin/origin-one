'use client'

import { useState, useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react'
import { getSceneColor } from '@/lib/utils/phase'
import type { Scene } from '@/types'

// ── Content block types ──────────────────────────────────
type ContentBlock =
  | { type: 'scene_heading'; id: string; content: string }
  | { type: 'action'; id: string; content: string }
  | { type: 'character'; id: string; content: string }
  | { type: 'dialogue'; id: string; content: string }

function parseBlocks(description: string | null): ContentBlock[] {
  if (!description) return []
  try {
    const parsed = JSON.parse(description)
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.type) {
      // Migrate old combined dialogue blocks → separate character + dialogue
      return parsed.flatMap((b: any) => {
        if (b.type === 'dialogue' && b.character !== undefined) {
          return [
            { type: 'character' as const, id: crypto.randomUUID(), content: b.character },
            { type: 'dialogue' as const, id: b.id || crypto.randomUUID(), content: b.content ?? '' },
          ]
        }
        return [{ ...b, id: b.id || crypto.randomUUID() }]
      })
    }
  } catch { /* not JSON — treat as plain text */ }
  return description.trim()
    ? [{ type: 'action' as const, id: crypto.randomUUID(), content: description }]
    : []
}

function serializeBlocks(blocks: ContentBlock[]): string {
  return JSON.stringify(blocks)
}

function mkBlock(type: ContentBlock['type'], content = ''): ContentBlock {
  return { type, id: crypto.randomUUID(), content } as ContentBlock
}

// ── Block placeholders ───────────────────────────────────
const PLACEHOLDER: Record<string, string> = {
  scene_heading: 'Scene Heading',
  action: 'Action / Description',
  character: 'Character',
  dialogue: 'Dialogue',
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
  const totalScenes = scenes.length
  const focusedSceneIndex = useRef(0)

  // Structural version — increment to re-render on block add/remove
  const [blocksVersion, setBlocksVersion] = useState(0)
  void blocksVersion // eslint-disable-line

  // Block data per scene (cached so React doesn't overwrite contentEditable)
  const blocksRef = useRef<Map<string, ContentBlock[]>>(new Map())

  // ID of a newly added block to auto-focus (with setTimeout for mobile)
  const newBlockIdRef = useRef<string | null>(null)
  // When true, place cursor at end of focused element (for Backspace focus-prev)
  const cursorToEndRef = useRef(false)

  // Pending edits + debounce
  const pendingEdits = useRef<Map<string, { title?: string; description?: string }>>(new Map())
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // ── Block helpers ──────────────────────────────────────
  const getSceneBlocks = useCallback((scene: Scene): ContentBlock[] => {
    if (blocksRef.current.has(scene.id)) return blocksRef.current.get(scene.id)!
    const blocks = parseBlocks(scene.description)
    if (blocks.length === 0) blocks.push(mkBlock('action'))
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
      saveScene(sceneId)
      debounceTimers.current.delete(sceneId)
    }, 2000)
    debounceTimers.current.set(sceneId, timer)
  }, [saveScene])

  /** Mutate blocks array, queue save, trigger re-render, schedule focus */
  const commitBlocks = useCallback((sceneId: string, blocks: ContentBlock[], focusId: string) => {
    blocksRef.current.set(sceneId, blocks)
    queueEdit(sceneId, { description: serializeBlocks(blocks) })
    scheduleDebounceSave(sceneId)
    newBlockIdRef.current = focusId
    setBlocksVersion(v => v + 1)
  }, [queueEdit, scheduleDebounceSave])

  // ── Auto-focus with mobile delay ───────────────────────
  useEffect(() => {
    if (newBlockIdRef.current) {
      const id = newBlockIdRef.current
      const placeCursorAtEnd = cursorToEndRef.current
      newBlockIdRef.current = null
      cursorToEndRef.current = false
      setTimeout(() => {
        const el = document.querySelector(`[data-block-id="${id}"]`) as HTMLElement | null
        if (!el) return
        el.focus()
        if (placeCursorAtEnd && el.childNodes.length > 0) {
          const range = document.createRange()
          const sel = window.getSelection()
          range.selectNodeContents(el)
          range.collapse(false) // false = collapse to end
          sel?.removeAllRanges()
          sel?.addRange(range)
        }
      }, 50)
    }
  }, [blocksVersion])

  // ── Flush on unmount ───────────────────────────────────
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      debounceTimers.current.forEach(t => clearTimeout(t))
      // eslint-disable-next-line react-hooks/exhaustive-deps
      pendingEdits.current.forEach((fields, sceneId) => {
        onUpdateScene(sceneId, fields)
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Imperative handle ──────────────────────────────────
  useImperativeHandle(ref, () => ({
    addScene: () => {}, // handled by parent
    addAction: () => {
      const sceneId = scenes[focusedSceneIndex.current]?.id
      if (!sceneId) return
      const blocks = blocksRef.current.get(sceneId) || []
      const nb = mkBlock('action')
      blocks.push(nb)
      commitBlocks(sceneId, blocks, nb.id)
    },
    addDialogue: () => {
      const sceneId = scenes[focusedSceneIndex.current]?.id
      if (!sceneId) return
      const blocks = blocksRef.current.get(sceneId) || []
      const nb = mkBlock('character')
      blocks.push(nb)
      commitBlocks(sceneId, blocks, nb.id)
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

  const handleBlockInput = useCallback((sceneId: string, blockIndex: number, e: React.FormEvent<HTMLDivElement>) => {
    const val = e.currentTarget.textContent?.trim() ?? ''
    const blocks = blocksRef.current.get(sceneId)
    if (!blocks || !blocks[blockIndex]) return
    blocks[blockIndex].content = val
    queueEdit(sceneId, { description: serializeBlocks(blocks) })
    scheduleDebounceSave(sceneId)
  }, [queueEdit, scheduleDebounceSave])

  const handleBlockBlur = useCallback((sceneId: string, e: React.FocusEvent<HTMLDivElement>) => {
    blurStyle(e)
    saveScene(sceneId)
  }, [saveScene])

  // ── Enter key: Final Draft flow ────────────────────────
  const handleTitleKeyDown = useCallback((sceneId: string, e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const blocks = blocksRef.current.get(sceneId) || []
    const nb = mkBlock('action')
    blocks.splice(0, 0, nb) // insert as first block
    commitBlocks(sceneId, blocks, nb.id)
  }, [commitBlocks])

  const handleBlockKeyDown = useCallback((
    sceneId: string,
    blockIndex: number,
    blockType: ContentBlock['type'],
    e: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    // Backspace on any empty block → delete it, focus previous block at end of text
    if (e.key === 'Backspace') {
      const content = e.currentTarget.textContent?.trim() ?? ''
      if (!content) {
        e.preventDefault()
        const blocks = blocksRef.current.get(sceneId) || []
        const focusTarget = blockIndex > 0
          ? blocks[blockIndex - 1].id
          : `title-${sceneId}`
        blocks.splice(blockIndex, 1)
        cursorToEndRef.current = true
        if (blocks.length === 0) {
          const fallback = mkBlock('action')
          blocks.push(fallback)
          commitBlocks(sceneId, blocks, fallback.id)
        } else {
          commitBlocks(sceneId, blocks, focusTarget)
        }
        return
      }
    }

    if (e.key !== 'Enter') return
    e.preventDefault()

    const blocks = blocksRef.current.get(sceneId) || []
    const content = e.currentTarget.textContent?.trim() ?? ''
    let nb: ContentBlock

    switch (blockType) {
      case 'scene_heading': {
        // → new action
        nb = mkBlock('action')
        blocks.splice(blockIndex + 1, 0, nb)
        commitBlocks(sceneId, blocks, nb.id)
        break
      }
      case 'action': {
        if (content) {
          // → new character
          nb = mkBlock('character')
          blocks.splice(blockIndex + 1, 0, nb)
          commitBlocks(sceneId, blocks, nb.id)
        } else {
          // Empty → delete this action, insert scene_heading in its place
          blocks.splice(blockIndex, 1)
          nb = mkBlock('scene_heading')
          blocks.splice(blockIndex, 0, nb)
          commitBlocks(sceneId, blocks, nb.id)
        }
        break
      }
      case 'character': {
        if (content) {
          // → new dialogue
          nb = mkBlock('dialogue')
          blocks.splice(blockIndex + 1, 0, nb)
          commitBlocks(sceneId, blocks, nb.id)
        } else {
          // Empty → delete this character, insert action in its place
          blocks.splice(blockIndex, 1)
          nb = mkBlock('action')
          blocks.splice(blockIndex, 0, nb)
          commitBlocks(sceneId, blocks, nb.id)
        }
        break
      }
      case 'dialogue': {
        // → new character
        nb = mkBlock('character')
        blocks.splice(blockIndex + 1, 0, nb)
        commitBlocks(sceneId, blocks, nb.id)
        break
      }
    }
  }, [commitBlocks])

  // ── Block style per type ───────────────────────────────
  const getBlockStyle = useCallback((type: ContentBlock['type']): React.CSSProperties => {
    switch (type) {
      case 'scene_heading':
        return {
          fontFamily: "'Geist', sans-serif", fontSize: '0.78rem', fontWeight: 700,
          color: accent, textTransform: 'uppercase', letterSpacing: '0.04em',
          lineHeight: 1.4, marginBottom: 10, outline: 'none', borderRadius: 4,
          cursor: 'text', minHeight: 20,
        }
      case 'action':
        return {
          fontFamily: "'Courier New', Courier, monospace", fontSize: '0.74rem',
          color: '#dddde8', lineHeight: 1.65, marginBottom: 10, outline: 'none',
          borderRadius: 4, cursor: 'text', minHeight: 20,
        }
      case 'character':
        return {
          fontFamily: "'Courier New', Courier, monospace", fontSize: '0.72rem',
          fontWeight: 700, color: '#a0a0b8', textTransform: 'uppercase',
          letterSpacing: '0.04em', textAlign: 'center', marginBottom: 3,
          outline: 'none', cursor: 'text', minHeight: 18,
        }
      case 'dialogue':
        return {
          fontFamily: "'Courier New', Courier, monospace", fontSize: '0.72rem',
          color: '#dddde8', lineHeight: 1.55, paddingLeft: 24, marginBottom: 10,
          outline: 'none', cursor: 'text', minHeight: 18,
        }
    }
  }, [accent])

  // ── Empty state ────────────────────────────────────────
  if (scenes.length === 0) return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: '60vh', gap: 10 }}>
      <div className="flex items-center justify-center cursor-pointer rounded-full" style={{ width: 40, height: 40, border: '1.5px dashed rgba(196,90,220,0.35)' }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1V11M1 6H11" stroke="rgba(196,90,220,0.5)" strokeWidth="1.4" strokeLinecap="round" /></svg>
      </div>
      <span style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.9rem', color: '#62627a', letterSpacing: '0.04em' }}>Write Now</span>
    </div>
  )

  // ── Compute scene heading numbers across all scenes ─────
  // Each DB scene gets its sceneNumber; scene_heading blocks within
  // get auto-incremented numbers starting after the highest DB scene number.
  const allBlocksList: { sceneId: string; blocks: ContentBlock[] }[] = []
  let headingCounter = totalScenes
  for (const scene of scenes) {
    allBlocksList.push({ sceneId: scene.id, blocks: getSceneBlocks(scene) })
  }
  // Build a map of block.id → display number for scene_heading blocks
  const headingNumbers = new Map<string, number>()
  for (const entry of allBlocksList) {
    for (const block of entry.blocks) {
      if (block.type === 'scene_heading') {
        headingCounter++
        headingNumbers.set(block.id, headingCounter)
      }
    }
  }

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

            {/* Scene number badge + Scene title (primary heading) */}
            <div className="flex items-start" style={{ gap: 8, marginBottom: 12 }}>
              <span className="font-mono flex-shrink-0" style={{ fontSize: '0.52rem', fontWeight: 700, color: sceneColor, background: `${sceneColor}1a`, borderRadius: 4, padding: '2px 5px', marginTop: 2 }}>
                {scene.sceneNumber.padStart(2, '0')}
              </span>
              <div contentEditable suppressContentEditableWarning
                data-block-id={`title-${scene.id}`}
                ref={el => {
                  if (el && !el.getAttribute('data-init')) {
                    el.textContent = scene.title ?? ''
                    el.setAttribute('data-init', '1')
                  }
                }}
                data-placeholder="Scene Heading"
                style={{
                  fontFamily: "'Geist', sans-serif", fontSize: '0.78rem', fontWeight: 700,
                  color: accent, textTransform: 'uppercase', letterSpacing: '0.04em',
                  lineHeight: 1.4, outline: 'none', borderRadius: 4, cursor: 'text',
                  flex: 1, minHeight: 20,
                }}
                onFocus={focusStyle}
                onInput={e => handleTitleInput(scene.id, e)}
                onBlur={e => handleTitleBlur(scene.id, e)}
                onKeyDown={e => handleTitleKeyDown(scene.id, e)}
              />
            </div>

            {/* Content blocks */}
            {blocks.map((block, bi) => {
              // Scene heading blocks get a numbered badge like DB scenes
              if (block.type === 'scene_heading') {
                const hNum = headingNumbers.get(block.id) ?? (totalScenes + 1)
                const hColor = getSceneColor(hNum, headingCounter)
                return (
                  <div key={block.id} className="flex items-start" style={{ gap: 8, marginBottom: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <span className="font-mono flex-shrink-0" style={{ fontSize: '0.52rem', fontWeight: 700, color: hColor, background: `${hColor}1a`, borderRadius: 4, padding: '2px 5px', marginTop: 2 }}>
                      {String(hNum).padStart(2, '0')}
                    </span>
                    <div
                      data-block-id={block.id}
                      contentEditable suppressContentEditableWarning
                      ref={el => {
                        if (el && !el.getAttribute('data-init')) {
                          el.textContent = block.content
                          el.setAttribute('data-init', '1')
                        }
                      }}
                      data-placeholder={PLACEHOLDER.scene_heading}
                      style={{ ...getBlockStyle('scene_heading'), flex: 1 }}
                      onFocus={focusStyle}
                      onInput={e => handleBlockInput(scene.id, bi, e)}
                      onBlur={e => handleBlockBlur(scene.id, e)}
                      onKeyDown={e => handleBlockKeyDown(scene.id, bi, block.type, e)}
                    />
                  </div>
                )
              }

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
                  data-placeholder={PLACEHOLDER[block.type] ?? ''}
                  style={getBlockStyle(block.type)}
                  onFocus={focusStyle}
                  onInput={e => handleBlockInput(scene.id, bi, e)}
                  onBlur={e => handleBlockBlur(scene.id, e)}
                  onKeyDown={e => handleBlockKeyDown(scene.id, bi, block.type, e)}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
})
