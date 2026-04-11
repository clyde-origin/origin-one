'use client'

import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react'
import { getSceneColor } from '@/lib/utils/phase'
import type { Scene } from '@/types'

export interface ScriptViewHandle {
  addScene: () => void
  addAction: () => void
  addDialogue: () => void
}

interface ScriptViewProps {
  scenes: Scene[]
  accent: string
}

export const ScriptView = forwardRef<ScriptViewHandle, ScriptViewProps>(function ScriptView({ scenes, accent }, ref) {
  // Track inserted inline elements
  const [insertedBlocks, setInsertedBlocks] = useState<Array<{ type: 'scene' | 'action' | 'dialogue'; id: string }>>([])
  const newBlockRef = useRef<HTMLDivElement | null>(null)
  const [dialogueStep, setDialogueStep] = useState<'char' | 'line' | null>(null)
  const dialogueCharRef = useRef<HTMLDivElement | null>(null)
  const dialogueLineRef = useRef<HTMLDivElement | null>(null)
  const totalScenes = scenes.length

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
  }))

  const focusStyle = (e: React.FocusEvent<HTMLDivElement>) => {
    e.currentTarget.style.background = `${accent}0d`
    e.currentTarget.style.boxShadow = `0 0 0 4px ${accent}0d`
  }
  const blurStyle = (e: React.FocusEvent<HTMLDivElement>) => {
    e.currentTarget.style.background = ''
    e.currentTarget.style.boxShadow = ''
  }

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
        const sceneColor = getSceneColor(scene.num, totalScenes)
        return (
          <div key={scene.id} style={{ padding: '20px 20px 0', borderTop: si > 0 ? '1px solid rgba(255,255,255,0.05)' : undefined }}>
            {/* Scene number badge + Slug */}
            <div className="flex items-start" style={{ gap: 8, marginBottom: 12 }}>
              <span className="font-mono flex-shrink-0" style={{ fontSize: '0.52rem', fontWeight: 700, color: sceneColor, background: `${sceneColor}1a`, borderRadius: 4, padding: '2px 5px', marginTop: 2 }}>
                {String(scene.num).padStart(2, '0')}
              </span>
              <div contentEditable suppressContentEditableWarning
                style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.78rem', fontWeight: 700, color: '#dddde8', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.4, outline: 'none', borderRadius: 4, cursor: 'text', flex: 1 }}
                onFocus={focusStyle} onBlur={blurStyle}>
                {scene.heading}
              </div>
            </div>

            {/* Action blocks */}
            {[scene.action, scene.action2, scene.action3, scene.action4].map((block, bi) =>
              block && block.length > 0 ? block.map((para, pi) => (
                <div key={`a${bi}-${pi}`} contentEditable suppressContentEditableWarning
                  style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.74rem', color: '#a0a0b8', lineHeight: 1.65, marginBottom: 10, outline: 'none', borderRadius: 4, cursor: 'text' }}
                  onFocus={focusStyle} onBlur={blurStyle}>
                  {para}
                </div>
              )) : null
            )}

            {/* Dialogue blocks */}
            {[scene.dialogue, scene.dialogue2, scene.dialogue3].map((block, di) =>
              block && block.length > 0 ? block.map((dl, li) => (
                <div key={`d${di}-${li}`} style={{ margin: '10px 0 10px 32px' }}>
                  <div contentEditable suppressContentEditableWarning
                    style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.72rem', fontWeight: 700, color: sceneColor, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', marginBottom: 3, outline: 'none', cursor: 'text' }}
                    onFocus={e => { e.currentTarget.style.background = `${accent}0d` }}
                    onBlur={e => { e.currentTarget.style.background = '' }}>
                    {dl.char}
                  </div>
                  <div contentEditable suppressContentEditableWarning
                    style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.72rem', color: '#a0a0b8', lineHeight: 1.55, textAlign: 'center', maxWidth: 220, margin: '0 auto', outline: 'none', cursor: 'text' }}
                    onFocus={e => { e.currentTarget.style.background = `${accent}0d` }}
                    onBlur={e => { e.currentTarget.style.background = '' }}>
                    {dl.line}
                  </div>
                </div>
              )) : null
            )}
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
                  onFocus={focusStyle} onBlur={blurStyle} />
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
                onFocus={focusStyle} onBlur={blurStyle} />
            </div>
          )
        }
        return null
      })}

      {/* Inline dialogue insertion — 3-step flow */}
      {dialogueStep && (
        <div style={{ padding: '10px 20px 10px 52px' }}>
          {/* Step 1: Character name */}
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
          {/* Step 2: Dialogue line — only shows after Enter on character */}
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
                  // Return to action mode — end dialogue flow
                  setDialogueStep(null)
                }
              }} />
          )}
        </div>
      )}
    </div>
  )
})
