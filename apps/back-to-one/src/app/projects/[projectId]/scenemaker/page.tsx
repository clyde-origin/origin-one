'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useProject, useScenes } from '@/lib/hooks/useOriginOne'
import { getShotsByProject, updateShotOrder, createShot } from '@/lib/db/queries'
import { LoadingState } from '@/components/ui'
import { PageHeader } from '@/components/ui/PageHeader'
import { Sheet } from '@/components/ui/Sheet'
import { haptic } from '@/lib/utils/haptics'
import { getProjectColor, getSceneColor, statusHex, statusLabel } from '@/lib/utils/phase'
import { ScriptView, type ScriptViewHandle } from './components/ScriptView'
import { ShotDetailSheet } from './components/ShotDetailSheet'
import type { Scene, Shot, SceneMakerMode } from '@/types'

// ── PILL SELECTOR ─────────────────────────────────────────

function PillSelector({ label, options, value, onChange, accent }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void; accent: string
}) {
  return (
    <div>
      <span className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</span>
      <div className="flex flex-wrap" style={{ gap: 5 }}>
        {options.map(o => (
          <button key={o} className="font-mono cursor-pointer select-none transition-all"
            style={{ fontSize: '0.46rem', letterSpacing: '0.04em', padding: '4px 9px', borderRadius: 16,
              background: value === o ? `${accent}1f` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${value === o ? `${accent}4d` : 'rgba(255,255,255,0.05)'}`,
              color: value === o ? accent : '#62627a' }}
            onClick={() => onChange(o)}>
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── NEW SHOT SHEET ────────────────────────────────────────

const SHOT_SIZES = ['CU', 'MS', 'WS', 'ECU', 'POV', 'MCU']

function NewShotSheet({ autoId, accent, onSave, onClose }: {
  autoId: string; accent: string
  onSave: (data: { description: string; size: string }) => void
  onClose: () => void
}) {
  const [description, setDescription] = useState('')
  const [size, setSize] = useState('')

  return (
    <>
      <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '12px auto 18px' }} />
      <div style={{ padding: '0 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#dddde8' }}>New Shot</div>
        <span className="font-mono" style={{ fontSize: '0.62rem', fontWeight: 700, color: accent }}>{autoId}</span>
      </div>
      <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '60vh', overflowY: 'auto' }}>
        <div>
          <span className="font-mono uppercase block" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.08em', marginBottom: 6 }}>Description</span>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Shot description..."
            autoFocus
            className="w-full outline-none focus:border-white/20"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7, padding: '8px 12px', fontSize: '0.76rem', color: '#dddde8' }} />
        </div>
        <PillSelector label="Size" options={SHOT_SIZES} value={size} onChange={setSize} accent={accent} />
      </div>
      <div style={{ padding: '14px 20px 0', display: 'flex', gap: 10 }}>
        <button className="flex-1 font-bold cursor-pointer transition-all"
          style={{ padding: 13, borderRadius: 8, fontSize: '0.78rem', background: `${accent}1f`, border: `1px solid ${accent}40`, color: accent }}
          onClick={() => { haptic('medium'); onSave({ description, size }) }}>
          Save
        </button>
        <button className="flex-1 font-bold cursor-pointer transition-all"
          style={{ padding: 13, borderRadius: 8, fontSize: '0.78rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)', color: '#a0a0b8' }}
          onClick={onClose}>
          Cancel
        </button>
      </div>
    </>
  )
}

// ── SHOTLIST VIEW ─────────────────────────────────────────

function ShotlistView({ scenes, shots, accent, onTapShot, onInsert, onReorder }: {
  scenes: Scene[]; shots: Shot[]; accent: string
  onTapShot: (s: Shot) => void; onInsert: (index: number, sceneId: string) => void
  onReorder: (shotId: string, newIndex: number) => void
}) {
  const [collapsedScenes, setCollapsedScenes] = useState<Set<string>>(new Set())
  const totalScenes = scenes.length

  // ── Drag state ──
  const [dragShotId, setDragShotId] = useState<string | null>(null)
  const dragShotIdRef = useRef<string | null>(null)
  const [dragTargetIdx, setDragTargetIdx] = useState(-1)
  const dragTargetIdxRef = useRef(-1)
  const dragElRef = useRef<HTMLDivElement | null>(null)
  const dragOriginY = useRef(0)
  const flatShotOrder = useRef<string[]>([])
  const shotRectsRef = useRef<Map<string, DOMRect>>(new Map())
  const headerRectsRef = useRef<Map<string, DOMRect>>(new Map())

  const snapshotRects = useCallback(() => {
    const map = new Map<string, DOMRect>()
    flatShotOrder.current.forEach(id => {
      const el = document.querySelector(`[data-shot-id="${id}"]`) as HTMLElement | null
      if (el) map.set(id, el.getBoundingClientRect())
    })
    shotRectsRef.current = map
    const hmap = new Map<string, DOMRect>()
    document.querySelectorAll('[data-scene-header]').forEach(el => {
      const id = el.getAttribute('data-scene-header')!
      hmap.set(id, el.getBoundingClientRect())
    })
    headerRectsRef.current = hmap
  }, [])

  const handleDragStart = useCallback((shotId: string, touchY: number, el: HTMLDivElement) => {
    const allFlat = [...shots].sort((a, b) => a.sortOrder - b.sortOrder).map(s => s.id)
    flatShotOrder.current = allFlat
    dragElRef.current = el
    dragOriginY.current = touchY
    dragShotIdRef.current = shotId
    setDragShotId(shotId)
    dragTargetIdxRef.current = allFlat.indexOf(shotId)
    setDragTargetIdx(dragTargetIdxRef.current)
    haptic('medium')
    requestAnimationFrame(snapshotRects)
  }, [shots, snapshotRects])

  const handleDragMove = useCallback((touchY: number) => {
    if (!dragShotIdRef.current || !dragElRef.current) return
    const dy = touchY - dragOriginY.current
    dragElRef.current.style.transform = `translateY(${dy}px)`
    dragElRef.current.style.transition = 'none'

    let targetIdx = dragTargetIdxRef.current
    const order = flatShotOrder.current
    let closest = { dist: Infinity, idx: targetIdx }
    shotRectsRef.current.forEach((rect, id) => {
      if (id === dragShotIdRef.current) return
      const mid = rect.top + rect.height / 2
      const dist = Math.abs(touchY - mid)
      const idx = order.indexOf(id)
      if (dist < closest.dist) {
        closest = { dist, idx }
      }
    })
    const closestRect = shotRectsRef.current.get(order[closest.idx])
    if (closestRect) {
      const mid = closestRect.top + closestRect.height / 2
      const fromIdx = order.indexOf(dragShotIdRef.current!)
      if (touchY < mid && closest.idx < fromIdx) targetIdx = closest.idx
      if (touchY > mid && closest.idx > fromIdx) targetIdx = closest.idx
    }
    const firstId = order[0]
    const firstRect = shotRectsRef.current.get(firstId)
    if (firstRect && touchY < firstRect.top + firstRect.height / 2) {
      targetIdx = 0
    }
    headerRectsRef.current.forEach((rect, headerId) => {
      if (touchY >= rect.top && touchY <= rect.bottom) {
        const headerShots = order.filter(id => {
          const shotRect = shotRectsRef.current.get(id)
          return shotRect && shotRect.top >= rect.bottom
        })
        if (headerShots.length > 0) {
          targetIdx = order.indexOf(headerShots[0])
        } else {
          let insertIdx = order.length
          for (let i = 0; i < order.length; i++) {
            const shotRect = shotRectsRef.current.get(order[i])
            if (shotRect && shotRect.top > rect.bottom) {
              insertIdx = i
              break
            }
          }
          targetIdx = insertIdx
        }
      }
    })
    dragTargetIdxRef.current = targetIdx
    setDragTargetIdx(targetIdx)
  }, [])

  const handleDragEnd = useCallback(() => {
    if (dragElRef.current) {
      dragElRef.current.style.transform = ''
      dragElRef.current.style.transition = ''
    }
    const shotId = dragShotIdRef.current
    const targetIdx = dragTargetIdxRef.current
    if (shotId && targetIdx >= 0) {
      onReorder(shotId, targetIdx)
    }
    dragShotIdRef.current = null
    setDragShotId(null)
    dragTargetIdxRef.current = -1
    setDragTargetIdx(-1)
    dragElRef.current = null
  }, [onReorder])

  const getDragState = useCallback((shotId: string): 'idle' | 'dragging' | 'displaced-down' | 'displaced-up' => {
    if (!dragShotId) return 'idle'
    if (shotId === dragShotId) return 'dragging'
    const order = flatShotOrder.current
    const fromIdx = order.indexOf(dragShotId)
    const myIdx = order.indexOf(shotId)
    if (fromIdx < 0 || myIdx < 0) return 'idle'
    if (dragTargetIdx > fromIdx && myIdx > fromIdx && myIdx <= dragTargetIdx) return 'displaced-up'
    if (dragTargetIdx < fromIdx && myIdx >= dragTargetIdx && myIdx < fromIdx) return 'displaced-down'
    return 'idle'
  }, [dragShotId, dragTargetIdx])

  const toggleScene = (sceneId: string) => {
    setCollapsedScenes(prev => {
      const next = new Set(prev)
      if (next.has(sceneId)) next.delete(sceneId); else next.add(sceneId)
      return next
    })
  }

  if (shots.length === 0) return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: '60vh', gap: 10 }}>
      <div className="flex items-center justify-center cursor-pointer rounded-full" style={{ width: 40, height: 40, border: '1.5px dashed rgba(196,90,220,0.35)' }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1V11M1 6H11" stroke="rgba(196,90,220,0.5)" strokeWidth="1.4" strokeLinecap="round" /></svg>
      </div>
      <span style={{ fontSize: '0.8rem', color: '#62627a', letterSpacing: '0.04em' }}>No Shots Yet</span>
    </div>
  )

  const InsertRow = ({ index, sceneId }: { index: number; sceneId: string }) => (
    <div className="flex items-center group" style={{ padding: '0 14px', height: 16, gap: 0 }}>
      <div className="flex-1 group-hover:bg-[rgba(196,90,220,0.15)] transition-colors" style={{ height: 1 }} />
      <button className="flex items-center justify-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
        style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
        onClick={() => { haptic('light'); onInsert(index, sceneId) }}>
        <svg width="7" height="7" viewBox="0 0 7 7" fill="none"><path d="M3.5 1V6M1 3.5H6" stroke="rgba(196,90,220,0.6)" strokeWidth="1.1" strokeLinecap="round" /></svg>
      </button>
      <div className="flex-1 group-hover:bg-[rgba(196,90,220,0.15)] transition-colors" style={{ height: 1 }} />
    </div>
  )

  // Story order — grouped by scene
  return (
    <div>
      {scenes.map(scene => {
        const sceneShots = shots.filter(s => s.sceneId === scene.id).sort((a, b) => a.sortOrder - b.sortOrder)
        const sceneColor = getSceneColor(parseInt(scene.sceneNumber), totalScenes)
        const isOpen = !collapsedScenes.has(scene.id)
        const numStr = scene.sceneNumber

        return (
          <div key={scene.id}>
            {/* Scene divider header */}
            <div className="flex items-center select-none cursor-pointer"
              data-scene-header={scene.id}
              style={{ gap: 8, padding: '11px 14px 7px' }}
              onClick={() => toggleScene(scene.id)}>
              {/* Drag handle */}
              <div className="flex flex-col flex-shrink-0" style={{ gap: 2.5, opacity: 0.2 }}>
                <div style={{ width: 12, height: 1.5, background: 'white', borderRadius: 1 }} />
                <div style={{ width: 12, height: 1.5, background: 'white', borderRadius: 1 }} />
                <div style={{ width: 12, height: 1.5, background: 'white', borderRadius: 1 }} />
              </div>
              {/* Scene number */}
              <span className="font-mono flex-shrink-0" style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.04em', color: sceneColor, minWidth: 20 }}>
                {numStr}
              </span>
              {/* Scene title */}
              <span className="flex-1 truncate" style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.52rem', letterSpacing: '0.02em', color: sceneColor, opacity: 0.7 }}>
                {scene.title ?? ''}
              </span>
              {/* Shot count */}
              <span className="font-mono flex-shrink-0" style={{ fontSize: '0.38rem', color: '#62627a', opacity: 0.55 }}>
                {sceneShots.length}
              </span>
              {/* Chevron */}
              <svg width="5" height="9" viewBox="0 0 5 9" fill="none" className="flex-shrink-0"
                style={{ opacity: 0.5, transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                <path d="M1 1L4 4.5L1 8" stroke={sceneColor} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            {/* Scene color line */}
            <div style={{ height: 1, margin: '0 14px 4px', background: sceneColor, opacity: 0.5 }} />

            {/* Shots — only when expanded */}
            {isOpen && (
              <>
                {sceneShots.map((shot, i) => (
                  <div key={shot.id}>
                    <InsertRow index={i} sceneId={scene.id} />
                    <ShotRow shot={shot} sceneColor={sceneColor}
                      dragState={getDragState(shot.id)}
                      onTapDetail={() => onTapShot(shot)}
                      onSwipeThread={() => { /* TODO: open thread sheet */ }}
                      onDescChange={(desc) => { console.log('Shot desc update:', shot.id, desc) }}
                      onDragStart={(y, el) => handleDragStart(shot.id, y, el)}
                      onDragMove={handleDragMove}
                      onDragEnd={handleDragEnd} />
                  </div>
                ))}
                <InsertRow index={sceneShots.length} sceneId={scene.id} />
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ShotRow({ shot, sceneColor, dragState, onTapDetail, onDescChange, onSwipeThread, onDragStart, onDragMove, onDragEnd }: {
  shot: Shot; sceneColor: string
  dragState: 'idle' | 'dragging' | 'displaced-down' | 'displaced-up'
  onTapDetail: () => void
  onDescChange?: (desc: string) => void
  onSwipeThread?: () => void
  onDragStart: (touchY: number, el: HTMLDivElement) => void
  onDragMove: (touchY: number) => void
  onDragEnd: () => void
}) {
  const [swipeX, setSwipeX] = useState(0)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(shot.description ?? '')
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const rowElRef = useRef<HTMLDivElement>(null)
  const dragCardRef = useRef<HTMLDivElement>(null)
  const dragHandleActive = useRef(false)
  const dragMoved = useRef(false)
  const dragStartY = useRef(0)

  // Swipe on row body
  const handleRowTouchStart = (e: React.TouchEvent) => {
    if (dragHandleActive.current) return
    swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const handleRowTouchMove = (e: React.TouchEvent) => {
    if (dragHandleActive.current || !swipeStart.current) return
    const dx = e.touches[0].clientX - swipeStart.current.x
    const dy = Math.abs(e.touches[0].clientY - swipeStart.current.y)
    if (dy > 20) { swipeStart.current = null; return }
    if (dx < -10) setSwipeX(Math.max(dx, -80))
  }
  const handleRowTouchEnd = () => {
    if (dragHandleActive.current) return
    if (swipeX < -40 && onSwipeThread) setSwipeX(-72)
    else setSwipeX(0)
    swipeStart.current = null
  }

  // Drag handle: short tap → detail sheet, drag → reorder
  const handleHandleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation()
    dragHandleActive.current = true
    dragMoved.current = false
    dragStartY.current = e.touches[0].clientY

    const startY = e.touches[0].clientY
    let activated = false

    const onMove = (ev: TouchEvent) => {
      const dy = Math.abs(ev.touches[0].clientY - startY)
      if (!activated && dy > 4) {
        activated = true
        ev.preventDefault()
        if (dragCardRef.current) onDragStart(startY, dragCardRef.current)
      }
      if (activated) {
        ev.preventDefault()
        dragMoved.current = true
        onDragMove(ev.touches[0].clientY)
      }
    }
    const onEnd = () => {
      if (activated) {
        onDragEnd()
      } else {
        onTapDetail()
      }
      dragHandleActive.current = false
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
  }

  const commitEdit = () => {
    setEditing(false)
    if (editValue !== (shot.description ?? '')) onDescChange?.(editValue)
  }

  const transform = dragState === 'displaced-down' ? 'translateY(60px)'
    : dragState === 'displaced-up' ? 'translateY(-60px)'
    : 'translateY(0)'

  return (
    <div ref={rowElRef} data-shot-id={shot.id}
      style={{
        padding: '0 14px 3px', position: 'relative',
        ...(dragState === 'dragging' ? { zIndex: 50 } : {
          transform,
          transition: 'transform 0.25s ease',
          zIndex: 1,
        }),
      }}>
      {/* Thread reveal behind */}
      {swipeX < -10 && (
        <div className="flex items-center justify-center cursor-pointer"
          style={{ position: 'absolute', right: 14, top: 0, bottom: 3, width: 68, borderRadius: '0 8px 8px 0', background: `${sceneColor}26`, zIndex: 0 }}
          onClick={() => { setSwipeX(0); onSwipeThread?.() }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 3h12a1 1 0 011 1v7a1 1 0 01-1 1H6l-4 3V4a1 1 0 011-1z" stroke={sceneColor} strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      <div ref={dragCardRef} className="flex items-center select-none relative"
        style={{
          gap: 9,
          background: dragState === 'dragging' ? 'rgba(10,10,18,0.7)' : 'rgba(10,10,18,0.42)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: dragState === 'dragging' ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.07)',
          borderRadius: 8, padding: '9px 10px',
          transform: `translateX(${swipeX}px)`, transition: swipeStart.current ? 'none' : 'transform 0.25s ease',
          boxShadow: dragState === 'dragging' ? '0 8px 32px rgba(0,0,0,0.6)' : 'none',
        }}
        onTouchStart={handleRowTouchStart} onTouchMove={handleRowTouchMove} onTouchEnd={handleRowTouchEnd}
        onTouchCancel={() => { setSwipeX(0); swipeStart.current = null }}>

        {/* Drag handle — also short tap to open detail */}
        <div className="flex flex-col items-center justify-center flex-shrink-0"
          style={{ gap: 2.5, opacity: dragState === 'dragging' ? 0.5 : 0.18, minHeight: 44, width: 24, cursor: 'grab' }}
          onTouchStart={handleHandleTouchStart}>
          <div style={{ width: 10, height: 1.5, background: 'white', borderRadius: 1 }} />
          <div style={{ width: 10, height: 1.5, background: 'white', borderRadius: 1 }} />
          <div style={{ width: 10, height: 1.5, background: 'white', borderRadius: 1 }} />
        </div>

        {/* Shot number — tap opens detail */}
        <span className="font-mono flex-shrink-0 cursor-pointer" style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.02em', color: sceneColor }}
          onClick={onTapDetail}>
          {shot.shotNumber}
        </span>

        {/* Description — tap to edit inline */}
        {editing ? (
          <input value={editValue} onChange={e => setEditValue(e.target.value)}
            autoFocus onBlur={commitEdit}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit() }}
            className="flex-1 min-w-0 outline-none"
            style={{ fontSize: '0.58rem', fontWeight: 500, color: '#dddde8', lineHeight: 1.35, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '2px 6px' }} />
        ) : (
          <span className="flex-1 min-w-0 truncate cursor-text" style={{ fontSize: '0.58rem', fontWeight: 500, color: '#a0a0b8', lineHeight: 1.35 }}
            onClick={() => setEditing(true)}>
            {shot.description}
          </span>
        )}

        {/* Size badge */}
        {shot.size && (
          <span className="font-mono flex-shrink-0" style={{ fontSize: '0.42rem', letterSpacing: '0.04em', color: sceneColor, opacity: 0.7 }}>
            {shot.size}
          </span>
        )}

        {/* Thumbnail placeholder */}
        <div className="flex-shrink-0 overflow-hidden cursor-pointer" style={{ width: 52, height: 34, borderRadius: 5, marginLeft: 'auto' }}
          onClick={onTapDetail}>
          <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${sceneColor}18, ${sceneColor}08)` }} />
        </div>
      </div>
    </div>
  )
}

// ── STORYBOARD VIEW ──────────────────────────────────────

function StoryboardView({ scenes, shots, onTapShot, onReorder }: {
  scenes: Scene[]; shots: Shot[]; onTapShot: (s: Shot) => void
  onReorder: (shotId: string, newIndex: number) => void
}) {
  const totalScenes = scenes.length
  const sorted = [...shots].sort((a, b) => a.sortOrder - b.sortOrder)

  const [dragId, setDragId] = useState<string | null>(null)
  const dragIdRef = useRef<string | null>(null)
  const [dragTargetIdx, setDragTargetIdx] = useState(-1)
  const dragTargetIdxRef = useRef(-1)
  const dragElRef = useRef<HTMLDivElement | null>(null)
  const dragOrigin = useRef({ x: 0, y: 0 })
  const dragOrigIdx = useRef(-1)
  const cardRectsRef = useRef<Map<string, DOMRect>>(new Map())

  const snapshotCardRects = useCallback(() => {
    const map = new Map<string, DOMRect>()
    sorted.forEach(s => {
      const el = document.querySelector(`[data-board-id="${s.id}"]`) as HTMLElement | null
      if (el) map.set(s.id, el.getBoundingClientRect())
    })
    cardRectsRef.current = map
  }, [sorted])

  const getBoardDragState = useCallback((shotId: string): 'idle' | 'dragging' | 'shift' => {
    if (!dragId) return 'idle'
    if (shotId === dragId) return 'dragging'
    const fromIdx = sorted.findIndex(s => s.id === dragId)
    const myIdx = sorted.findIndex(s => s.id === shotId)
    if (fromIdx < 0 || myIdx < 0) return 'idle'
    if (dragTargetIdx > fromIdx && myIdx > fromIdx && myIdx <= dragTargetIdx) return 'shift'
    if (dragTargetIdx < fromIdx && myIdx >= dragTargetIdx && myIdx < fromIdx) return 'shift'
    return 'idle'
  }, [dragId, dragTargetIdx, sorted])

  if (shots.length === 0) return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: '60vh', gap: 10 }}>
      <div className="flex items-center justify-center cursor-pointer rounded-full" style={{ width: 40, height: 40, border: '1.5px dashed rgba(196,90,220,0.35)' }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1V11M1 6H11" stroke="rgba(196,90,220,0.5)" strokeWidth="1.4" strokeLinecap="round" /></svg>
      </div>
      <span style={{ fontSize: '0.8rem', color: '#62627a', letterSpacing: '0.04em' }}>No Boards Yet</span>
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, padding: '8px 10px' }}>
      {sorted.map((shot, idx) => {
        const scene = scenes.find(s => s.id === shot.sceneId)
        const sceneColor = scene ? getSceneColor(parseInt(scene.sceneNumber), totalScenes) : '#c45adc'
        const state = getBoardDragState(shot.id)

        return (
          <BoardCard key={shot.id} shot={shot} sceneColor={sceneColor}
            isDragging={state === 'dragging'}
            isShifted={state === 'shift'}
            onTap={() => onTapShot(shot)}
            onDragStart={(x, y, innerEl) => {
              haptic('light')
              dragIdRef.current = shot.id
              setDragId(shot.id)
              dragTargetIdxRef.current = idx
              setDragTargetIdx(idx)
              dragOrigIdx.current = idx
              dragOrigin.current = { x, y }
              dragElRef.current = innerEl
              requestAnimationFrame(snapshotCardRects)
            }}
            onDragMove={(x, y) => {
              if (dragElRef.current) {
                const dx = x - dragOrigin.current.x
                const dy = y - dragOrigin.current.y
                dragElRef.current.style.transform = `translate(${dx}px, ${dy}px) scale(1.05)`
                dragElRef.current.style.transition = 'none'
              }
              const currentDragId = dragIdRef.current
              let nearest = sorted.findIndex(s => s.id === currentDragId)
              let minDist = Infinity
              cardRectsRef.current.forEach((rect, id) => {
                if (id === currentDragId) return
                const cx = rect.left + rect.width / 2
                const cy = rect.top + rect.height / 2
                const dist = Math.hypot(x - cx, y - cy)
                if (dist < minDist) {
                  minDist = dist
                  nearest = sorted.findIndex(s => s.id === id)
                }
              })
              dragTargetIdxRef.current = nearest
              setDragTargetIdx(nearest)
            }}
            onDragEnd={() => {
              if (dragElRef.current) {
                dragElRef.current.style.transform = ''
                dragElRef.current.style.transition = ''
              }
              const id = dragIdRef.current
              const targetIdx = dragTargetIdxRef.current
              if (id && targetIdx >= 0 && targetIdx !== dragOrigIdx.current) {
                onReorder(id, targetIdx)
              }
              dragIdRef.current = null
              setDragId(null)
              dragTargetIdxRef.current = -1
              setDragTargetIdx(-1)
              dragOrigIdx.current = -1
              dragElRef.current = null
            }} />
        )
      })}
    </div>
  )
}

function BoardCard({ shot, sceneColor, isDragging, isShifted, onTap, onDragStart, onDragMove, onDragEnd }: {
  shot: Shot; sceneColor: string; isDragging: boolean; isShifted: boolean
  onTap: () => void; onDragStart: (x: number, y: number, el: HTMLDivElement | null) => void; onDragMove: (x: number, y: number) => void; onDragEnd: () => void
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const movedRef = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })
  const dragActive = useRef(false)
  const cardInnerRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    movedRef.current = false
    dragActive.current = false
    startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    timerRef.current = setTimeout(() => {
      if (!movedRef.current) {
        dragActive.current = true
        onDragStart(e.touches[0].clientX, e.touches[0].clientY, cardInnerRef.current)
        const onMove = (ev: TouchEvent) => {
          ev.preventDefault()
          onDragMove(ev.touches[0].clientX, ev.touches[0].clientY)
        }
        const onEnd = () => {
          dragActive.current = false
          onDragEnd()
          window.removeEventListener('touchmove', onMove)
          window.removeEventListener('touchend', onEnd)
          window.removeEventListener('touchcancel', onEnd)
        }
        window.addEventListener('touchmove', onMove, { passive: false })
        window.addEventListener('touchend', onEnd)
        window.addEventListener('touchcancel', onEnd)
      }
    }, 500)
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragActive.current) return
    const dx = Math.abs(e.touches[0].clientX - startPos.current.x)
    const dy = Math.abs(e.touches[0].clientY - startPos.current.y)
    if (dx > 8 || dy > 8) {
      movedRef.current = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }
  const handleTouchEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!dragActive.current && !movedRef.current) {
      onTap()
    }
  }

  return (
    <div data-board-id={shot.id} style={{
      position: 'relative',
      zIndex: isDragging ? 50 : 0,
    }}
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd} onTouchCancel={() => { if (timerRef.current) clearTimeout(timerRef.current) }}>
      <div ref={cardInnerRef} className="cursor-pointer select-none"
        style={{
          background: 'rgba(10,10,18,0.42)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: isDragging ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.07)',
          borderRadius: 8, overflow: 'hidden',
          ...(isDragging ? {
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            opacity: 0.85,
          } : {
            transition: 'transform 0.25s ease, opacity 0.2s ease',
            boxShadow: 'none',
            opacity: isShifted ? 0.6 : 1,
            transform: isShifted ? 'scale(0.95)' : 'scale(1)',
          }),
        }}>
        {/* 16:9 image area */}
        <div className="relative" style={{ aspectRatio: '16/9' }}>
          <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${sceneColor}15, ${sceneColor}08)` }} />
          <div className="absolute top-1 left-1 font-mono" style={{
            fontSize: '0.38rem', fontWeight: 700, letterSpacing: '0.04em',
            color: sceneColor, background: 'rgba(4,4,10,0.7)',
            borderRadius: 4, padding: '1px 4px',
          }}>
            {shot.shotNumber}
          </div>
        </div>
        {/* Description */}
        <div style={{
          padding: '5px 6px', fontSize: '0.44rem', fontWeight: 500,
          color: '#a0a0b8', lineHeight: 1.35,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {shot.description}
        </div>
      </div>
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────

export default function SceneMakerPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const router = useRouter()
  const { data: project } = useProject(projectId)
  const accent = project?.color || getProjectColor(projectId)

  const searchParams = useSearchParams()
  const initialMode = (searchParams.get('mode') as SceneMakerMode) || 'shotlist'
  const [mode, setMode] = useState<SceneMakerMode>(initialMode)
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null)
  const [newShotAt, setNewShotAt] = useState<{ index: number; sceneId: string } | null>(null)
  const [fabOpen, setFabOpen] = useState(false)
  const scriptRef = useRef<ScriptViewHandle>(null)

  const toggleFab = () => { haptic('light'); setFabOpen(o => !o) }
  const closeFab = () => setFabOpen(false)

  const qc = useQueryClient()
  const { data: scenes, isLoading: loadingScenes } = useScenes(projectId)
  const { data: scenesWithShots, isLoading: loadingShots } = useQuery({
    queryKey: ['shotsByProject', projectId],
    queryFn: () => getShotsByProject(projectId),
    enabled: !!projectId,
  })

  const allScenes: Scene[] = scenes ?? []
  const allShots: Shot[] = useMemo(() => {
    if (!scenesWithShots) return []
    return scenesWithShots.flatMap((s: any) => s.Shot ?? [])
  }, [scenesWithShots])

  const loading = loadingScenes || loadingShots

  // ── REORDER HANDLER ──────────────────────────────────────

  const handleReorder = useCallback((shotId: string, newIndex: number) => {
    const sorted = [...allShots].sort((a, b) => a.sortOrder - b.sortOrder)
    const without = sorted.filter(s => s.id !== shotId)
    const moved = sorted.find(s => s.id === shotId)
    if (!moved) return
    const clamped = Math.max(0, Math.min(newIndex, without.length))
    without.splice(clamped, 0, moved)

    // Derive sceneId from neighbor
    const neighborId = without[clamped === 0 ? 1 : clamped - 1]?.id
    const neighbor = allShots.find(s => s.id === neighborId)
    const targetSceneId = neighbor?.sceneId ?? moved.sceneId

    const updates = without.map((s, i) => ({
      id: s.id,
      order: i,
      sceneId: s.id === shotId ? targetSceneId : s.sceneId,
    }))

    // Optimistic local update
    qc.setQueryData(['shotsByProject', projectId], (old: any[] | undefined) => {
      if (!old) return old
      return old.map((scene: any) => ({
        ...scene,
        Shot: (scene.Shot ?? []).map((s: Shot) => {
          const u = updates.find(u => u.id === s.id)
          if (!u) return s
          return { ...s, sortOrder: u.order, sceneId: u.sceneId }
        }),
      }))
    })

    // Persist
    Promise.all(updates.map(u =>
      updateShotOrder(u.id, { sortOrder: u.order, ...(u.id === shotId && u.sceneId !== moved.sceneId ? { sceneId: u.sceneId } : {}) })
    )).catch(err => console.error('Failed to persist reorder:', err))
  }, [allShots, projectId, qc])

  /** Auto-generate next shot number for a scene (e.g. if scene 2 has 2A-2C, returns "2D") */
  const nextShotNumber = useCallback((sceneId: string) => {
    const scene = allScenes.find(s => s.id === sceneId)
    const prefix = scene?.sceneNumber ?? '1'
    const sceneShots = allShots.filter(s => s.sceneId === sceneId)
    const letters = sceneShots.map(s => { const m = s.shotNumber.match(/[A-Z]$/); return m ? m[0] : '' }).filter(Boolean)
    const nextLetter = letters.length > 0 ? String.fromCharCode(Math.max(...letters.map((l: string) => l.charCodeAt(0))) + 1) : 'A'
    return `${prefix}${nextLetter}`
  }, [allScenes, allShots])

  // Contextual branch options per mode
  type BranchDef = { label: string; color: string; icon: React.ReactNode; action: () => void }
  const branches: BranchDef[] = useMemo(() => {
    if (mode === 'script') {
      return [
        { label: 'Add Scene', color: '#e8a020', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 5h12M2 8h8M2 11h5" stroke="#e8a020" strokeWidth="1.3" strokeLinecap="round" /><path d="M13 10v4M11 12h4" stroke="#e8a020" strokeWidth="1.3" strokeLinecap="round" /></svg>, action: () => { scriptRef.current?.addScene() } },
        { label: 'Add Action', color: '#6470f3', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 5h12M2 8h12M2 11h8" stroke="#6470f3" strokeWidth="1.3" strokeLinecap="round" /></svg>, action: () => { scriptRef.current?.addAction() } },
        { label: 'Add Dialogue', color: accent, icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4h8M5 7h6M4 10h8" stroke={accent} strokeWidth="1.3" strokeLinecap="round" /></svg>, action: () => { scriptRef.current?.addDialogue() } },
      ]
    }
    if (mode === 'shotlist') {
      return [
        { label: 'New Scene', color: '#e8a020', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 5h12M2 8h8M2 11h5" stroke="#e8a020" strokeWidth="1.3" strokeLinecap="round" /><path d="M13 10v4M11 12h4" stroke="#e8a020" strokeWidth="1.3" strokeLinecap="round" /></svg>, action: () => { /* TODO */ } },
        { label: 'New Shot', color: accent, icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="8" height="6" rx="1" stroke={accent} strokeWidth="1.3" /><path d="M10 7L14 9L10 11V7Z" fill={accent} opacity="0.8" /></svg>, action: () => {
          const firstScene = allScenes[0]
          if (firstScene) {
            const sceneShots = allShots.filter(s => s.sceneId === firstScene.id)
            setNewShotAt({ index: sceneShots.length, sceneId: firstScene.id })
          }
        }},
      ]
    }
    // storyboard
    return [
      { label: 'Add Board', color: '#e8a020', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1.2" stroke="#e8a020" strokeWidth="1.3" /><path d="M8 6v4M6 8h4" stroke="#e8a020" strokeWidth="1.3" strokeLinecap="round" /></svg>, action: () => {
        const firstScene = allScenes[0]
        if (firstScene) {
          const sceneShots = allShots.filter(s => s.sceneId === firstScene.id)
          setNewShotAt({ index: sceneShots.length, sceneId: firstScene.id })
        }
      }},
      { label: 'Add Scene', color: accent, icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 5h12M2 8h8M2 11h5" stroke={accent} strokeWidth="1.3" strokeLinecap="round" /><path d="M13 10v4M11 12h4" stroke={accent} strokeWidth="1.3" strokeLinecap="round" /></svg>, action: () => { /* TODO */ } },
    ]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, accent, allScenes.length, allShots.length])

  return (
    <div className="screen" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div className="flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#04040a' }}>
        <PageHeader
          projectId={projectId}
          title="SceneMaker"
          meta={project ? (<div className="flex flex-col items-center gap-1.5"><span style={{ color: accent, fontSize: '0.50rem', letterSpacing: '0.06em' }}>{project.name}</span><span className="font-mono uppercase" style={{ fontSize: '0.38rem', padding: '2px 8px', borderRadius: 12, background: `${statusHex(project.status)}18`, color: statusHex(project.status) }}>{statusLabel(project.status)}</span></div>) : ''}
          noBorder
        />

        {/* Mode tabs */}
        <div className="flex">
          {(['script', 'shotlist', 'storyboard'] as SceneMakerMode[]).map(m => (
            <button key={m} className="flex-1 text-center font-mono uppercase cursor-pointer select-none relative transition-colors"
              style={{ padding: '11px 0', fontSize: '0.52rem', letterSpacing: '0.06em', color: mode === m ? '#dddde8' : '#62627a' }}
              onClick={() => setMode(m)}>
              {m}
              {mode === m && <div className="absolute bottom-0" style={{ left: '10%', right: '10%', height: 2, background: accent, borderRadius: '2px 2px 0 0' }} />}
            </button>
          ))}
        </div>
      </div>

      {/* Shot count bar (shotlist/storyboard only) */}
      {(mode === 'shotlist' || mode === 'storyboard') && (
        <div className="flex items-center flex-shrink-0" style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span className="font-mono" style={{ fontSize: '0.44rem', color: '#62627a', letterSpacing: '0.06em' }}>
            {allShots.length} shots
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 100 }}>
        {loading ? <LoadingState /> : (
          <>
            {mode === 'script' && <ScriptView ref={scriptRef} scenes={allScenes} accent={accent} />}
            {mode === 'shotlist' && <ShotlistView scenes={allScenes} shots={allShots} accent={accent} onTapShot={setSelectedShot} onInsert={(index, sceneId) => setNewShotAt({ index, sceneId })} onReorder={handleReorder} />}
            {mode === 'storyboard' && <StoryboardView scenes={allScenes} shots={allShots} onTapShot={setSelectedShot} onReorder={handleReorder} />}
          </>
        )}
      </div>

      {/* ── BRANCHING FAB SYSTEM ── */}
      {/* Overlay */}
      {fabOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(4,4,10,0.75)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', zIndex: 20 }}
          onClick={closeFab} />
      )}

      {/* FAB zone — anchored at bottom center */}
      <div style={{ position: 'fixed', bottom: 68, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, zIndex: 30 }}>

        {/* Branch lines SVG */}
        {fabOpen && branches.length > 0 && (
          <svg style={{ position: 'absolute', bottom: -4, left: branches.length === 3 ? -100 : -80, opacity: 1, pointerEvents: 'none', transition: 'opacity 0.2s' }}
            width={branches.length === 3 ? 200 : 160} height="90" viewBox={branches.length === 3 ? '0 0 200 90' : '0 0 160 90'}>
            {branches.length === 3 ? (
              <>
                <line x1="100" y1="86" x2="18" y2="28" stroke="rgba(196,90,220,0.22)" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="100" y1="86" x2="100" y2="8" stroke="rgba(196,90,220,0.22)" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="100" y1="86" x2="182" y2="28" stroke="rgba(196,90,220,0.22)" strokeWidth="1" strokeDasharray="3 3" />
                <circle cx="100" cy="86" r="2.5" fill="rgba(196,90,220,0.4)" />
              </>
            ) : (
              <>
                <line x1="80" y1="86" x2="37" y2="30" stroke="rgba(196,90,220,0.22)" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="80" y1="86" x2="123" y2="30" stroke="rgba(196,90,220,0.22)" strokeWidth="1" strokeDasharray="3 3" />
                <circle cx="80" cy="86" r="2.5" fill="rgba(196,90,220,0.4)" />
              </>
            )}
          </svg>
        )}

        {/* Branch options */}
        {fabOpen && branches.map((b, i) => {
          const pos = branches.length === 3
            ? [{ left: -90, bottom: 22 }, { left: -22, bottom: 72 }, { left: 46, bottom: 22 }][i]
            : [{ left: -64, bottom: 21 }, { left: 22, bottom: 21 }][i]
          return (
            <div key={b.label} className="flex flex-col items-center"
              style={{
                position: 'absolute', bottom: pos.bottom, left: pos.left,
                gap: 5, opacity: 1, pointerEvents: 'all',
                transition: `opacity 0.22s ease ${i === 1 && branches.length === 3 ? '0.05s' : '0.04s'}, transform 0.32s cubic-bezier(0.34,1.56,0.64,1) ${i === 1 && branches.length === 3 ? '0.05s' : '0.04s'}`,
              }}
              onClick={() => { closeFab(); b.action() }}>
              <div className="flex items-center justify-center" style={{
                width: 48, height: 48, borderRadius: '50%',
                background: `${b.color}1a`, border: `1px solid ${b.color}4d`,
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              }}>
                {b.icon}
              </div>
              <span className="font-mono uppercase whitespace-nowrap" style={{ fontSize: '0.34rem', letterSpacing: '0.06em', color: b.color }}>
                {b.label}
              </span>
            </div>
          )
        })}

        {/* Back chevron — matches hub: 36×36, left -58 */}
        <div className="flex items-center justify-center cursor-pointer"
          style={{
            position: 'absolute', top: -18, left: -76,
            width: 36, height: 36, borderRadius: '50%',
            background: `${accent}18`, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            border: `1px solid ${accent}33`,
            boxShadow: `0 2px 12px ${accent}20, inset 0 1px 0 rgba(255,255,255,0.08)`,
            transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s',
            ...(fabOpen ? { transform: 'translateX(-300px)', opacity: 0, pointerEvents: 'none' as const } : {}),
          }}
          onClick={() => router.back()}>
          <svg width="8" height="12" viewBox="0 0 6 10" fill="none"><path d="M5 1L1 5L5 9" stroke="rgba(255,255,255,0.5)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>

        {/* Chat FAB — slides left on open */}
        <div className="flex items-center justify-center cursor-pointer"
          style={{
            position: 'absolute', top: -19, left: -19,
            width: 38, height: 38, borderRadius: '50%',
            background: `${accent}14`, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid ${accent}33`,
            opacity: fabOpen ? 1 : 0, pointerEvents: fabOpen ? 'all' : 'none',
            transform: fabOpen ? 'translateX(-110px)' : 'translateX(0)',
            transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.28s',
          }}
          onClick={() => router.push(`/projects/${projectId}/chat`)}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 2h9a1 1 0 011 1v5a1 1 0 01-1 1H5l-3 2.5V3a1 1 0 011-1z" stroke="rgba(255,255,255,0.45)" strokeWidth="1.1" strokeLinejoin="round" /></svg>
        </div>

        {/* Main FAB */}
        <div className="flex items-center justify-center cursor-pointer"
          style={{
            position: 'absolute', top: -26, left: -26,
            width: 52, height: 52, borderRadius: '50%',
            background: `${accent}26`, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            border: `1.5px solid ${accent}73`,
            boxShadow: `0 4px 24px ${accent}40, 0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)`,
            zIndex: 31,
            transform: fabOpen ? 'rotate(45deg)' : 'rotate(0deg)',
            transition: 'transform 0.28s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s',
          }}
          onClick={toggleFab}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2V14M2 8H14" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" /></svg>
        </div>

        {/* Docs pill — below FAB */}
        <div className="flex items-center cursor-pointer"
          style={{
            position: 'absolute', top: 32, left: '50%',
            transform: fabOpen ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(6px)',
            background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20,
            padding: '5px 14px', gap: 5, whiteSpace: 'nowrap', zIndex: 32,
            opacity: fabOpen ? 1 : 0, pointerEvents: fabOpen ? 'all' : 'none',
            transition: 'opacity 0.2s ease 0.08s, transform 0.28s cubic-bezier(0.34,1.56,0.64,1) 0.08s',
          }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x="2" y="1" width="6" height="8" rx="1" stroke="rgba(255,255,255,0.35)" strokeWidth="1" /><path d="M4 4h2M4 6h2" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" strokeLinecap="round" /></svg>
          <span className="font-mono uppercase" style={{ fontSize: '0.38rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.06em' }}>Docs</span>
        </div>

        {/* Threads FAB — slides right on open */}
        <div className="flex items-center justify-center cursor-pointer relative"
          style={{
            position: 'absolute', top: -19, left: -19,
            width: 38, height: 38, borderRadius: '50%',
            background: `${accent}14`, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid ${accent}33`,
            opacity: fabOpen ? 1 : 0, pointerEvents: fabOpen ? 'all' : 'none',
            transform: fabOpen ? 'translateX(110px)' : 'translateX(0)',
            transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.28s',
          }}
          onClick={() => router.push(`/projects/${projectId}/threads`)}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2.5 2h8a1 1 0 011 1v4.5a1 1 0 01-1 1H5l-2.5 2.5V3a1 1 0 011-1z" stroke="rgba(255,255,255,0.45)" strokeWidth="1.1" strokeLinejoin="round" /></svg>
        </div>

      </div>

      {/* Shot detail sheet */}
      <Sheet open={!!selectedShot} onClose={() => setSelectedShot(null)}>
        <ShotDetailSheet shot={selectedShot} accent={accent} onClose={() => setSelectedShot(null)} />
      </Sheet>

      {/* New shot sheet */}
      <Sheet open={!!newShotAt} onClose={() => setNewShotAt(null)}>
        <NewShotSheet
          autoId={newShotAt ? nextShotNumber(newShotAt.sceneId) : ''}
          accent={accent}
          onSave={(data) => {
            if (!newShotAt) return
            const shotNumber = nextShotNumber(newShotAt.sceneId)
            const sortOrder = allShots.length + 1
            createShot({
              sceneId: newShotAt.sceneId,
              shotNumber,
              size: data.size || null,
              description: data.description,
              status: 'planned',
              sortOrder,
            }).then(() => {
              qc.invalidateQueries({ queryKey: ['shotsByProject', projectId] })
            }).catch(err => console.error('Failed to create shot:', err))
            setNewShotAt(null)
          }}
          onClose={() => setNewShotAt(null)}
        />
      </Sheet>
    </div>
  )
}