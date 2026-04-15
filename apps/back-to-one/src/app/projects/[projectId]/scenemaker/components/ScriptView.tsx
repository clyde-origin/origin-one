'use client'

import { useState, useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react'
import { getSceneColor } from '@/lib/utils/phase'
import type { Scene } from '@/types'

export interface ScriptViewHandle {
  addScene: () => void
  addAction: () => void
  addDialogue: () => void
  flush: () => void
}

interface ScriptViewProps {
  scenes: Scene[]
  accent: string
  onUpdateScene: (sceneId: string, fields: { title?: string; description?: string }) => void
}

export const ScriptView = forwardRef<ScriptViewHandle, ScriptViewProps>(function ScriptView({ scenes, accent, onUpdateScene }, ref) {
  console.log('ScriptView rendered', { sceneCount: scenes.length, accent })

  const [insertedBlocks, setInsertedBlocks] = useState<Array<{ type: 'scene' | 'action' | 'dialogue'; id: string }>>([])
  const newBlockRef = useRef<HTMLDivElement | null>(null)
  const [dialogueStep, setDialogueStep] = useState<'char' | 'line' | null>(null)
  const dialogueCharRef = useRef<HTMLDivElement | null>(null)
  const dialogueLineRef = useRef<HTMLDivElement | null>(null)
  const totalScenes = scenes.length

  // DEBUG: native event listener test on first scene title
  const debugTitleRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = debugTitleRef.current
    if (!el) return
    const handler = () => console.log('[ScriptView] native input fired', el.textContent)
    el.addEventListener('input', handler)
    console.log('[ScriptView] native listener attached to', el)
    return () => el.removeEventListener('input', handler)
  }, [scenes.length]) // re-attach if scene count changes

  // Track pending edits per scene — written by onInput, flushed by debounce / blur / tab switch / unmount
  const pendingEdits = useRef<Map<string, { title?: string; description?: string }>>(new Map())
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const queueEdit = useCallback((sceneId: string, fields: { title?: string; description?: string }) => {
    const existing = pendingEdits.current.get(sceneId) ?? {}
    pendingEdits.current.set(sceneId, { ...existing, ...fields })
    console.log('[ScriptView] queued edit', sceneId, pendingEdits.current.get(sceneId))
  }, [])

  const saveScene = useCallback((sceneId: string) => {
    const fields = pendingEdits.current.get(sceneId)
    if (fields) {
      console.log('[ScriptView] saving on flush/blur/debounce', sceneId, fields)
      onUpdateScene(sceneId, fields)
      pendingEdits.current.delete(sceneId)
    }
    // Clear any pending debounce for this scene
    const timer = debounceTimers.current.get(sceneId)
    if (timer) {
      clearTimeout(timer)
      debounceTimers.current.delete(sceneId)
    }
  }, [onUpdateScene])

  const flushEdits = useCallback(() => {
    pendingEdits.current.forEach((_fields, sceneId) => {
      saveScene(sceneId)
    })
  }, [saveScene])

  const scheduleDebounceSave = useCallback((sceneId: string) => {
    // Clear existing timer
    const existing = debounceTimers.current.get(sceneId)
    if (existing) clearTimeout(existing)
    // Set new 2-second debounce
    const timer = setTimeout(() => {
      console.log('[ScriptView] debounce fired for', sceneId)
      saveScene(sceneId)
      debounceTimers.current.delete(sceneId)
    }, 2000)
    debounceTimers.current.set(sceneId, timer)
  }, [saveScene])

  // Focus newly inserted block
  useEffect(() => {
    if (newBlockRef.current) {
      newBlockRef.current.focus()
      newBlockRef.current = null
    }
  }, [insertedBlocks.length])

  // Focus dialogue fields
  useEffect(() => {
    if (dialogueStep === 'char' && dialogueCharRef.current) {
      dialogueCharRef.current.focus()
    }
    if (dialogueStep === 'line' && dialogueLineRef.current) {
      dialogueLineRef.current.focus()
    }
  }, [dialogueStep])

  // Flush on unmount + clear debounce timers
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      debounceTimers.current.forEach(timer => clearTimeout(timer))
      // eslint-disable-next-line react-hooks/exhaustive-deps
      pendingEdits.current.forEach((fields, sceneId) => {
        console.log('[ScriptView] flush on unmount', sceneId, fields)
        onUpdateScene(sceneId, fields)
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(ref, () => ({
    addScene: () => {
      const id = `ins-scene-${Date.now()}`
      setInsertedBlocks(prev => [...prev, { type: 'scene', id }])
    },
    addAction: () => {
      const id = `ins-action-${Date.now()}`
      setInsertedBlocks(prev => [...prev, { type: 'action', id }])
    },
    addDialogue: () => {
      setDialogueStep('char')
    },
    flush: flushEdits,
  }))

  const focusStyle = (e: React.FocusEvent<HTMLDivElement>) => {
    e.currentTarget.style.background = `${accent}0d`
    e.currentTarget.style.boxShadow = `0 0 0 4px ${accent}0d`
  }

  // onInput: track changes in real time, schedule debounce save
  const handleTitleInput = useCallback((sceneId: string, e: React.FormEvent<HTMLDivElement>) => {
    const newVal = e.currentTarget.textContent?.trim() ?? ''
    queueEdit(sceneId, { title: newVal })
    scheduleDebounceSave(sceneId)
  }, [queueEdit, scheduleDebounceSave])

  const handleDescInput = useCallback((sceneId: string, e: React.FormEvent<HTMLDivElement>) => {
    const newVal = e.currentTarget.textContent?.trim() ?? ''
    queueEdit(sceneId, { description: newVal })
    scheduleDebounceSave(sceneId)
  }, [queueEdit, scheduleDebounceSave])

  // onBlur fallback: save immediately if there are pending edits
  const handleTitleBlur = useCallback((sceneId: string, e: React.FocusEvent<HTMLDivElement>) => {
    e.currentTarget.style.background = ''
    e.currentTarget.style.boxShadow = ''
    console.log('[ScriptView] title blur', sceneId)
    saveScene(sceneId)
  }, [saveScene])

  const handleDescBlur = useCallback((sceneId: string, e: React.FocusEvent<HTMLDivElement>) => {
    e.currentTarget.style.background = ''
    e.currentTarget.style.boxShadow = ''
    console.log('[ScriptView] desc blur', sceneId)
    saveScene(sceneId)
  }, [saveScene])

  if (scenes.length === 0 && insertedBlocks.length === 0) return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: '60vh', gap: 10 }}>
      <div className="flex items-center justify-center cursor-pointer rounded-full" style={{ width: 40, height: 40, border: '1.5px dashed rgba(196,90,220,0.35)' }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1V11M1 6H11" stroke="rgba(196,90,220,0.5)" strokeWidth="1.4" strokeLinecap="round" /></svg>
      </div>
      <span style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.9rem', color: '#62627a', letterSpacing: '0.04em' }}>Write Now</span>
    </div>
  )

  return (
    <div style={{ paddingBottom: 20 }}>
      {scenes.map((scene, si) => {
        const sceneNum = parseInt(scene.sceneNumber) || (si + 1)
        const sceneColor = getSceneColor(sceneNum, totalScenes)
        return (
          <div key={scene.id} style={{ padding: '20px 20px 0', borderTop: si > 0 ? '1px solid rgba(255,255,255,0.05)' : undefined }}>
            {/* Scene number badge + Slug */}
            <div className="flex items-start" style={{ gap: 8, marginBottom: 12 }}>
              <span className="font-mono flex-shrink-0" style={{ fontSize: '0.52rem', fontWeight: 700, color: sceneColor, background: `${sceneColor}1a`, borderRadius: 4, padding: '2px 5px', marginTop: 2 }}>
                {scene.sceneNumber.padStart(2, '0')}
              </span>
              <div contentEditable suppressContentEditableWarning
                ref={si === 0 ? debugTitleRef : undefined}
                style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.78rem', fontWeight: 700, color: '#dddde8', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.4, outline: 'none', borderRadius: 4, cursor: 'text', flex: 1 }}
                onFocus={focusStyle}
                onInput={e => { console.log('[ScriptView] React onInput fired', scene.id); handleTitleInput(scene.id, e) }}
                onBlur={e => handleTitleBlur(scene.id, e)}>
                {scene.title ?? ''}
              </div>
            </div>

            {/* Description as action block */}
            <div contentEditable suppressContentEditableWarning
              data-placeholder="Action description..."
              style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.74rem', color: '#a0a0b8', lineHeight: 1.65, marginBottom: 10, outline: 'none', borderRadius: 4, cursor: 'text', minHeight: 20 }}
              onFocus={focusStyle}
              onInput={e => handleDescInput(scene.id, e)}
              onBlur={e => handleDescBlur(scene.id, e)}>
              {scene.description ?? ''}
            </div>
          </div>
        )
      })}

      {/* Inserted blocks — appended at end of script */}
      {insertedBlocks.map(block => {
        if (block.type === 'scene') {
          return (
            <div key={block.id} style={{ padding: '20px 20px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-start" style={{ gap: 8, marginBottom: 12 }}>
                <span className="font-mono flex-shrink-0" style={{ fontSize: '0.52rem', fontWeight: 700, color: accent, background: `${accent}1a`, borderRadius: 4, padding: '2px 5px', marginTop: 2 }}>
                  {String(totalScenes + 1).padStart(2, '0')}
                </span>
                <div contentEditable suppressContentEditableWarning
                  ref={el => { if (el && !el.textContent) newBlockRef.current = el }}
                  data-placeholder="INT./EXT. LOCATION — TIME"
                  style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.78rem', fontWeight: 700, color: '#dddde8', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.4, outline: 'none', borderRadius: 4, cursor: 'text', flex: 1, minHeight: 24 }}
                  onFocus={focusStyle}
                  onBlur={e => { e.currentTarget.style.background = ''; e.currentTarget.style.boxShadow = '' }} />
              </div>
            </div>
          )
        }
        if (block.type === 'action') {
          return (
            <div key={block.id} style={{ padding: '0 20px' }}>
              <div contentEditable suppressContentEditableWarning
                ref={el => { if (el && !el.textContent) newBlockRef.current = el }}
                data-placeholder="Action description..."
                style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.74rem', color: '#a0a0b8', lineHeight: 1.65, marginBottom: 10, outline: 'none', borderRadius: 4, cursor: 'text', minHeight: 20 }}
                onFocus={focusStyle}
                onBlur={e => { e.currentTarget.style.background = ''; e.currentTarget.style.boxShadow = '' }} />
            </div>
          )
        }
        return null
      })}

      {/* Inline dialogue insertion — 2-step flow */}
      {dialogueStep && (
        <div style={{ padding: '10px 20px 10px 52px' }}>
          <div contentEditable suppressContentEditableWarning
            ref={dialogueCharRef}
            data-placeholder="CHARACTER NAME"
            style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.72rem', fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', marginBottom: 3, outline: 'none', cursor: 'text', minHeight: 18 }}
            onFocus={e => { e.currentTarget.style.background = `${accent}0d` }}
            onBlur={e => { e.currentTarget.style.background = '' }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                setDialogueStep('line')
              }
            }} />
          {dialogueStep === 'line' && (
            <div contentEditable suppressContentEditableWarning
              ref={dialogueLineRef}
              data-placeholder="Dialogue text..."
              style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.72rem', color: '#a0a0b8', lineHeight: 1.55, textAlign: 'center', maxWidth: 220, margin: '0 auto', outline: 'none', cursor: 'text', minHeight: 18 }}
              onFocus={e => { e.currentTarget.style.background = `${accent}0d` }}
              onBlur={e => { e.currentTarget.style.background = '' }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  setDialogueStep(null)
                }
              }} />
          )}
        </div>
      )}
    </div>
  )
})
