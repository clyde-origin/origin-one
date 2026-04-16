'use client'

import { useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { getShotsByProject } from '@/lib/db/queries'
import {
  useProjects, useProject, useActionItems, useToggleActionItem, useCreateActionItem, useMilestones, useCreateMilestone, useCrew,
  useScenes, useMoodboard, useThreads,
  useLocations, useArtItems, useCastRoles, useWorkflowNodes,
} from '@/lib/hooks/useOriginOne'
import { CrewAvatar, ThreadsIcon } from '@/components/ui'
import { HubSkeleton } from '@/components/hub/HubSkeleton'
import { CrewPanel } from '@/components/hub/CrewPanel'
import { CreateTaskSheet, CreateMilestoneSheet, CreateCreativeSheet } from '@/components/create'
import { haptic } from '@/lib/utils/haptics'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import {
  formatDate, isUrgent, isLate, getProjectColor,
  PHASE_HEX, STATUS_DOT, STATUS_TEXT, MILESTONE_STATUS_HEX,
  statusLabel,
} from '@/lib/utils/phase'
import type { ActionItem, Milestone, CrewMember, Project, WorkflowNode } from '@/types'

// ── HELPERS ───────────────────────────────────────────────

function hexToRgb(hex: string | null | undefined): [number, number, number] {
  const h = hex || '#444444'
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}

const SCENE_GRAD: Record<number, string> = {
  1: 'linear-gradient(160deg,#0c0810,#1a0c20)',
  2: 'linear-gradient(160deg,#0a0c10,#161820)',
  3: 'linear-gradient(160deg,#060c08,#0c1610)',
}

const WF_ICONS: Record<string, string> = {
  storage: '💾', software: '🖥', system: '⚙', transfer: '↗', phase: '◆', deliverable: '📦',
}

// ── MODULE HEADER — item 7: second-tier section headers ───

function ModuleHeader({ name, meta }: { name: string; meta?: string }) {
  return (
    <div className="flex flex-col items-center mb-2.5">
      <div className="flex items-center gap-1.5">
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#dddde8' }}>{name}</span>
      </div>
      {meta && (
        <span className="font-mono" style={{ fontSize: '0.50rem', color: '#62627a', letterSpacing: '0.06em', marginTop: 2 }}>
          {meta}
        </span>
      )}
    </div>
  )
}

function SectionHeader({ name, meta }: { name: string; meta?: string }) {
  return (
    <div className="flex flex-col items-center mb-2.5">
      <div className="flex items-center gap-1.5">
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#dddde8' }}>{name}</span>
      </div>
      {meta && (
        <span className="font-mono" style={{ fontSize: '0.50rem', color: '#62627a', letterSpacing: '0.06em', marginTop: 2 }}>
          {meta}
        </span>
      )}
    </div>
  )
}

// Module icons (13x13)
const ActionItemsIcon = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="white" strokeWidth="1.2"/><path d="M4 6.5l1.8 1.8L9 4.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
const TimelineIcon = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><line x1="1" y1="6.5" x2="12" y2="6.5" stroke="white" strokeWidth="1.2" strokeLinecap="round"/><circle cx="4.5" cy="6.5" r="1.5" fill="white"/><circle cx="9" cy="6.5" r="1.5" fill="white"/></svg>
const SceneMakerIcon = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="3" width="11" height="8" rx="1.2" stroke="white" strokeWidth="1.2"/><path d="M1 5.5h11M4 3V1.5M9 3V1.5" stroke="white" strokeWidth="1.2" strokeLinecap="round"/></svg>
const ToneIcon = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="white" strokeWidth="1.2"/><circle cx="6.5" cy="6.5" r="2" fill="white" opacity="0.7"/></svg>
const LocationsIcon = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1.5C4.6 1.5 3 3.1 3 5c0 2.5 3.5 6.5 3.5 6.5S10 7.5 10 5c0-1.9-1.6-3.5-3.5-3.5z" stroke="white" strokeWidth="1.2"/><circle cx="6.5" cy="5" r="1.2" fill="white" opacity="0.7"/></svg>
const ArtIcon = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 10.5l2.5-2.5 5.5-5.5 1.5 1.5-5.5 5.5L2 10.5z" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 3l1.5 1.5" stroke="white" strokeWidth="1.2" strokeLinecap="round"/></svg>
const CastingIcon = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="4.5" r="2" stroke="white" strokeWidth="1.2"/><path d="M2 11.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="white" strokeWidth="1.2" strokeLinecap="round"/></svg>
const WorkflowIcon = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="2.5" cy="6.5" r="1.5" stroke="white" strokeWidth="1.2"/><circle cx="6.5" cy="6.5" r="1.5" stroke="white" strokeWidth="1.2"/><circle cx="10.5" cy="6.5" r="1.5" stroke="white" strokeWidth="1.2"/><line x1="4" y1="6.5" x2="5" y2="6.5" stroke="white" strokeWidth="1.2" strokeLinecap="round"/><line x1="8" y1="6.5" x2="9" y2="6.5" stroke="white" strokeWidth="1.2" strokeLinecap="round"/></svg>

// Mini card icons for Locations/Art/Casting
const MINI_ICONS: Record<string, React.ReactNode> = {
  locations: <LocationsIcon />,
  art: <ArtIcon />,
  casting: <CastingIcon />,
}

// ── SWIPE PANEL — reusable swipeable card ─────────────────

function SwipePanel<T>({ items, label, labelColor, emptyIcon, emptyLabel, emptyContent, href, renderItem }: {
  items: T[]; label: string; labelColor: string; emptyIcon?: string; emptyLabel?: string; emptyContent?: React.ReactNode; href: string
  renderItem: (item: T, index: number) => React.ReactNode
}) {
  const [page, setPage] = useState(0)
  const touchStart = useRef<number | null>(null)
  const router = useRouter()

  const onTS = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX }
  const onTE = (e: React.TouchEvent) => {
    if (touchStart.current === null) return
    const dx = e.changedTouches[0].clientX - touchStart.current
    touchStart.current = null
    if (Math.abs(dx) < 40) return
    if (dx < 0 && page < items.length - 1) setPage(p => p + 1)
    if (dx > 0 && page > 0) setPage(p => p - 1)
  }

  return (
    <div
      className="flex-1 relative overflow-hidden cursor-pointer active:opacity-90 transition-opacity"
      style={{ background: 'rgba(10,10,18,0.42)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, minHeight: 90, display: 'flex', flexDirection: 'column' }}
      onTouchStart={onTS}
      onTouchEnd={onTE}
      onClick={() => router.push(href)}
    >
      <div className="font-mono uppercase" style={{ fontSize: '0.44rem', fontWeight: 700, color: labelColor, letterSpacing: '0.06em', textAlign: 'center', padding: '7px 0 0', position: 'relative', zIndex: 2 }}>{label}</div>
      {items.length > 0 ? (
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', width: `${items.length * 100}%`, height: '100%', transform: `translateX(-${page * (100 / items.length)}%)`, transition: 'transform 0.28s ease' }}>
            {items.map((item, i) => (
              <div key={i} style={{ width: `${100 / items.length}%`, height: '100%' }}>
                {renderItem(item, i)}
              </div>
            ))}
          </div>
          {/* Dot indicators */}
          {items.length > 1 && (
            <div style={{ position: 'absolute', bottom: 4, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 3 }}>
              {items.map((_, i) => (
                <div key={i} style={{ width: page === i ? 10 : 4, height: 3, borderRadius: 2, background: page === i ? labelColor : 'rgba(255,255,255,0.2)', transition: 'all 0.2s' }} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          {emptyContent ?? (
            <>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px dashed rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 2V8M2 5H8" stroke="rgba(255,255,255,0.25)" strokeWidth="1.3" strokeLinecap="round" /></svg>
              </div>
              {emptyLabel && <span className="font-mono" style={{ fontSize: '0.36rem', color: '#62627a' }}>{emptyLabel}</span>}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── GANTT CHART — item 10 ─────────────────────────────────

function GanttChart({ milestones, projectStatus }: { milestones: Milestone[]; projectStatus: string }) {
  const today = new Date()

  const allDates = milestones.map(m => new Date(m.date))
  const earliest = allDates.length > 0
    ? new Date(Math.min(...allDates.map(d => d.getTime())))
    : new Date(today.getFullYear(), today.getMonth() - 2, 1)
  const latest = allDates.length > 0
    ? new Date(Math.max(...allDates.map(d => d.getTime())))
    : new Date(today.getFullYear(), today.getMonth() + 4, 1)

  const rangeStart = new Date(earliest)
  rangeStart.setDate(rangeStart.getDate() - 7)
  const rangeEnd = new Date(latest)
  rangeEnd.setDate(rangeEnd.getDate() + 7)
  const totalMs = rangeEnd.getTime() - rangeStart.getTime()

  function toPercent(date: Date) {
    return Math.max(0, Math.min(100, ((date.getTime() - rangeStart.getTime()) / totalMs) * 100))
  }

  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const todayPct = toPercent(today)

  // Find the next upcoming milestone — pre-select it on load
  const nextMs = milestones.filter(m => new Date(m.date) >= today).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
  const [selectedMsId, setSelectedMsId] = useState<string | null>(nextMs?.id ?? null)

  // Final delivery = last milestone
  const finalMs = milestones.length > 0 ? milestones.reduce((a, b) => new Date(a.date) > new Date(b.date) ? a : b) : null
  const finalPct = finalMs ? toPercent(new Date(finalMs.date)) : null

  // Production range — milestones in the active phase
  const activePhaseIndex = projectStatus === 'pre_production' || projectStatus === 'development' ? 0
    : projectStatus === 'production' ? 1
    : projectStatus === 'post_production' ? 2
    : -1

  const phaseColors = ['#e8a020', '#6470f3', '#00b894']
  const phaseLabels = ['Pre', 'Prod', 'Post']

  // Single unified bar with colored segments
  const thirdMs = totalMs / 3
  const segments = [
    { label: 'Pre', color: '#e8a020', leftPct: 0, widthPct: 33.3 },
    { label: 'Prod', color: '#6470f3', leftPct: 33.3, widthPct: 33.4 },
    { label: 'Post', color: '#00b894', leftPct: 66.7, widthPct: 33.3 },
  ]

  return (
    <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1, alignItems: 'center' }}>
      {/* Unified Gantt bar */}
      <div style={{ width: '100%', position: 'relative' }}>
        {/* Date labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span className="font-mono" style={{ fontSize: '0.46rem', color: '#62627a' }}>{fmt(rangeStart)}</span>
          <span className="font-mono" style={{ fontSize: '0.46rem', color: '#62627a' }}>{fmt(rangeEnd)}</span>
        </div>

        {/* Bar track */}
        <div
          style={{ width: '100%', height: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 4, position: 'relative', overflow: 'visible' }}
        >
          {/* Phase color segments */}
          {segments.map((seg, i) => (
            <div key={seg.label} style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `${seg.leftPct}%`, width: `${seg.widthPct}%`,
              background: i === activePhaseIndex ? seg.color : `${seg.color}33`,
              borderRadius: i === 0 ? '4px 0 0 4px' : i === 2 ? '0 4px 4px 0' : 0,
              transition: 'background 0.3s',
              boxShadow: i === activePhaseIndex ? `0 0 8px ${seg.color}55` : undefined,
            }} />
          ))}

          {/* Milestone markers — tappable ticks */}
          {milestones.map(ms => {
            const pct = toPercent(new Date(ms.date))
            const isCompleted = ms.status === 'completed'
            const isSelected = selectedMsId === ms.id
            return (
              <div key={ms.id}
                onClick={(e) => { e.stopPropagation(); setSelectedMsId(prev => prev === ms.id ? null : ms.id) }}
                style={{
                  position: 'absolute', top: -4, left: `${pct}%`, transform: 'translateX(-50%)',
                  width: 8, height: 16, cursor: 'pointer', zIndex: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                <div style={{
                  width: isSelected ? 4 : 3, height: isSelected ? 14 : 12, borderRadius: 1,
                  background: isSelected ? '#dddde8' : isCompleted ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.45)',
                  transition: 'all 0.15s',
                }} />
              </div>
            )
          })}

          {/* Today marker */}
          <div style={{
            position: 'absolute', top: -3, bottom: -3,
            left: `${todayPct}%`, transform: 'translateX(-50%)',
            width: 2, borderRadius: 1,
            background: '#e8564a',
            boxShadow: '0 0 4px #e8564a',
            zIndex: 3,
          }} />

          {/* Final delivery marker */}
          {finalPct !== null && (
            <div style={{
              position: 'absolute', top: -2, bottom: -2,
              left: `${finalPct}%`, transform: 'translateX(-50%)',
              width: 2, borderRadius: 1,
              background: '#dddde8',
              opacity: 0.6,
              zIndex: 2,
            }} />
          )}
        </div>

        {/* Phase labels below bar */}
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 3 }}>
          {segments.map((seg, i) => (
            <span key={seg.label} className="font-mono" style={{
              fontSize: '0.46rem', letterSpacing: '0.06em',
              color: i === activePhaseIndex ? seg.color : '#62627a',
              opacity: i === activePhaseIndex ? 1 : 0.5,
            }}>{seg.label}</span>
          ))}
        </div>
      </div>

      {/* Selected milestone — single row with prev/next chevrons */}
      {selectedMsId && (() => {
        const sorted = [...milestones].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        const idx = sorted.findIndex(m => m.id === selectedMsId)
        const ms = sorted[idx]
        if (!ms) return null
        const statusColor = ms.status === 'completed' ? '#00b894' : ms.status === 'in_progress' ? '#e8a020' : '#62627a'
        const msDate = new Date(ms.date)
        const daysAway = Math.ceil((msDate.getTime() - today.getTime()) / 86400000)
        const daysLabel = daysAway === 0 ? 'Today' : daysAway === 1 ? 'Tomorrow' : daysAway > 0 ? `${daysAway}d` : `${Math.abs(daysAway)}d ago`
        const hasPrev = idx > 0
        const hasNext = idx < sorted.length - 1
        return (
          <div style={{
            width: '100%', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {/* Prev chevron */}
            <div
              onClick={(e) => { e.stopPropagation(); if (hasPrev) setSelectedMsId(sorted[idx - 1].id) }}
              style={{ width: 24, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: hasPrev ? 'pointer' : 'default', opacity: hasPrev ? 0.5 : 0.15, flexShrink: 0 }}
            >
              <svg width="6" height="10" viewBox="0 0 6 10" fill="none"><path d="M5 1L1 5L5 9" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            {/* Milestone row */}
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: statusColor }} />
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#dddde8', flex: 1 }}>{ms.title}</span>
              <span className="font-mono" style={{ fontSize: '0.48rem', color: '#62627a', flexShrink: 0 }}>{fmt(msDate)}</span>
              <span className="font-mono" style={{ fontSize: '0.46rem', color: statusColor, flexShrink: 0 }}>{daysLabel}</span>
            </div>
            {/* Next chevron */}
            <div
              onClick={(e) => { e.stopPropagation(); if (hasNext) setSelectedMsId(sorted[idx + 1].id) }}
              style={{ width: 24, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: hasNext ? 'pointer' : 'default', opacity: hasNext ? 0.5 : 0.15, flexShrink: 0 }}
            >
              <svg width="6" height="10" viewBox="0 0 6 10" fill="none"><path d="M1 1L5 5L1 9" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ── SWIPEABLE SCENEMAKER — item 12 ───────────────────────

function SwipeableSceneMaker({
  projectId, projectColor, pr, pg, pb,
  allShots, allScenes, allMoodRefs, shuffledMood,
  router,
}: {
  projectId: string; projectColor: string; pr: number; pg: number; pb: number;
  allShots: any[]; allScenes: any[]; allMoodRefs: any[]; shuffledMood: any[];
  router: ReturnType<typeof useRouter>;
}) {
  const SIZE_SHORT: Record<string, string> = {
    extreme_wide: 'EWS', wide: 'WS', full: 'FS', medium: 'MS',
    medium_close_up: 'MCU', close_up: 'CU', extreme_close_up: 'ECU', insert: 'INS',
  }

  // Pages: 0=Script, 1=Shotlist (default), 2=Storyboard
  const [page, setPage] = useState(1)
  const touchStart = useRef<number | null>(null)
  const touchDelta = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)

  function onTouchStart(e: React.TouchEvent) {
    touchStart.current = e.touches[0].clientX
    touchDelta.current = 0
    setDragging(true)
    setDragOffset(0)
  }

  function onTouchMove(e: React.TouchEvent) {
    if (touchStart.current === null) return
    touchDelta.current = e.touches[0].clientX - touchStart.current
    setDragOffset(touchDelta.current)
  }

  function onTouchEnd() {
    const delta = touchDelta.current
    setDragging(false)
    setDragOffset(0)
    touchStart.current = null
    if (Math.abs(delta) > 40) {
      if (delta < 0 && page < 2) setPage(p => p + 1)
      if (delta > 0 && page > 0) setPage(p => p - 1)
    }
  }

  const translateX = (page * -100) + (dragging ? (dragOffset / 2) : 0)
  const pageLabels = ['Script', 'Shotlist', 'Storyboard']

  return (
    <div
      style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={() => {
        const mode = page === 0 ? 'script' : page === 2 ? 'storyboard' : 'shotlist'
        router.push(`/projects/${projectId}/scenemaker?mode=${mode}`)
      }}
    >
      {/* Page indicator — top */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, padding: '7px 9px 2px', alignItems: 'center' }}>
        {pageLabels.map((label, i) => (
          <span key={label} className="font-mono uppercase" style={{
            fontSize: '0.44rem',
            letterSpacing: '0.06em',
            color: page === i ? projectColor : '#62627a',
            fontWeight: page === i ? 700 : 400,
            opacity: page === i ? 1 : 0.5,
            transition: 'all 0.2s ease',
          }}>{label}</span>
        ))}
      </div>

      <div style={{
        display: 'flex', width: '300%', flex: 1,
        transform: `translateX(calc(${translateX / 3}%))`,
        transition: dragging ? 'none' : 'transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)',
        willChange: 'transform',
      }}>
        {/* Page 0: Script */}
        <div style={{ width: '33.333%', flex: '0 0 33.333%', padding: '8px 9px', display: 'flex', flexDirection: 'column' }}>
          {allScenes.length > 0 ? (
            <div className="flex flex-col flex-1 justify-center" style={{ gap: 5 }}>
              {allScenes.slice(0, 2).map(sc => (
                <div key={sc.id} style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="font-mono uppercase" style={{ fontSize: '0.32rem', color: projectColor, marginBottom: 2, letterSpacing: '0.06em' }}>{sc.title ?? ''}</div>
                  <div style={{ fontSize: '0.38rem', color: '#a0a0b8', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{sc.description ?? ''}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center">
              <span className="font-mono" style={{ fontSize: '0.38rem', color: '#62627a' }}>No script yet</span>
            </div>
          )}
        </div>

        {/* Page 1: Shotlist (default) — first 3 shots as rows */}
        <div style={{ width: '33.333%', flex: '0 0 33.333%', padding: '8px 9px', display: 'flex', flexDirection: 'column' }}>
          {allShots.length > 0 ? (
            <div className="flex flex-col flex-1 justify-center" style={{ gap: 3 }}>
              {allShots.slice(0, 3).map((shot: any) => (
                <div key={shot.id} className="flex items-center" style={{ gap: 7, padding: '5px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: 5, border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="font-mono flex-shrink-0" style={{ fontSize: '0.42rem', fontWeight: 700, color: projectColor, letterSpacing: '0.04em', width: 22 }}>{shot.shotNumber}</span>
                  <span className="font-mono flex-shrink-0" style={{ fontSize: '0.34rem', color: '#62627a', letterSpacing: '0.04em', width: 24, textAlign: 'center' }}>{SIZE_SHORT[shot.size] ?? '—'}</span>
                  <span className="truncate" style={{ fontSize: '0.40rem', color: '#a0a0b8', flex: 1 }}>{shot.description ?? ''}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center" style={{ gap: 6 }}>
              <div className="flex items-center justify-center rounded-full" style={{ width: 28, height: 28, border: `1.5px dashed rgba(${pr},${pg},${pb},0.35)` }}>
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M5 1V9M1 5H9" stroke={`rgba(${pr},${pg},${pb},0.5)`} strokeWidth="1.3" strokeLinecap="round" /></svg>
              </div>
              <span className="font-mono" style={{ fontSize: '0.42rem', color: '#62627a', letterSpacing: '0.06em' }}>No shots yet</span>
            </div>
          )}
        </div>

        {/* Page 2: Storyboard — first 3 cards */}
        <div style={{ width: '33.333%', flex: '0 0 33.333%', padding: '8px 9px', display: 'flex', flexDirection: 'column' }}>
          <div className="flex flex-1 items-stretch" style={{ gap: 3 }}>
            {allShots.length > 0 ? allShots.slice(0, 3).map((shot: any, i: number) => (
              <div key={shot.id} className="flex-1 flex flex-col overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 5 }}>
                <div className="flex-shrink-0" style={{ height: 46, background: SCENE_GRAD[(i % 3) + 1] ?? SCENE_GRAD[1] }} />
                <div style={{ padding: '3px 4px' }}>
                  <div className="font-mono" style={{ fontSize: '0.30rem', color: projectColor }}>{shot.shotNumber}</div>
                  <div className="truncate" style={{ fontSize: '0.26rem', color: '#62627a' }}>{shot.description ?? ''}</div>
                </div>
              </div>
            )) : (
              <div className="flex-1 flex items-center justify-center">
                <span className="font-mono" style={{ fontSize: '0.38rem', color: '#62627a' }}>No boards yet</span>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}

// ── DETAIL SHEETS ─────────────────────────────────────────

function AIDetailSheet({ item, crew, onClose }: { item: ActionItem | null; crew: CrewMember[]; onClose: () => void }) {
  if (!item) return null
  const assignee = crew.find(c => c.id === item.assignedTo)
  const late = item.dueDate ? isLate(item.dueDate) : false
  const urgent = item.dueDate ? isUrgent(item.dueDate) : false
  const dateLabel = item.dueDate ? formatDate(item.dueDate) : '—'
  const isDone = item.status === 'done'
  return (
    <>
      <SheetHeader title={item.title} onClose={onClose} />
      <SheetBody>
        <div className="flex items-center gap-2 mb-4 p-3 bg-surface2 rounded-lg border border-border">
          <div className={`w-2 h-2 rounded-full ${isDone ? 'bg-post' : 'bg-muted'}`} />
          <span className="font-mono text-sm text-text2">{isDone ? 'Completed' : 'Open'}</span>
          <span className={`font-mono text-xs ml-auto ${late ? 'text-red' : urgent ? 'text-pre' : 'text-muted'}`}>{dateLabel}</span>
        </div>
        {assignee && (
          <div className="mb-4">
            <span className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Assigned to</span>
            <div className="flex items-center gap-3 p-3 bg-surface2 rounded-lg border border-border">
              <CrewAvatar name={assignee.User?.name ?? 'Unknown'} size={32} />
              <div>
                <div className="text-base font-semibold text-text">{assignee.User?.name ?? 'Unknown'}</div>
                <div className="font-mono text-xs text-muted">{assignee.role}</div>
              </div>
            </div>
          </div>
        )}
        {item.description && (
          <div className="mb-4">
            <span className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Notes</span>
            <div className="text-base text-text2 leading-relaxed p-3 bg-surface2 rounded-lg border border-border">{item.description}</div>
          </div>
        )}
      </SheetBody>
    </>
  )
}

function MSDetailSheet({ milestone, crew, onClose }: { milestone: Milestone | null; crew: CrewMember[]; onClose: () => void }) {
  if (!milestone) return null
  const past = isLate(milestone.date)
  const people = (milestone.people ?? []).map(id => crew.find(c => c.userId === id)).filter(Boolean) as CrewMember[]
  const statusColor = MILESTONE_STATUS_HEX[milestone.status] ?? '#62627a'
  return (
    <>
      <SheetHeader title={milestone.title} onClose={onClose} />
      <SheetBody>
        <div className="flex items-center gap-2 mb-4 p-3 bg-surface2 rounded-lg border border-border">
          <div className="w-2 h-2 rounded-full" style={{ background: statusColor }} />
          <span className="font-mono text-[0.5rem] tracking-widest uppercase px-2 py-0.5 rounded-sm" style={{ background: `${statusColor}1a`, color: statusColor }}>{milestone.status}</span>
          <span className={`font-mono text-xs ml-auto ${past ? 'text-red' : 'text-muted'}`}>{formatDate(milestone.date)}</span>
        </div>
        {people.length > 0 && (
          <div className="mb-4">
            <span className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">People</span>
            <div className="flex flex-col gap-2">
              {people.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 bg-surface2 rounded-lg border border-border">
                  <CrewAvatar name={p.User?.name ?? 'Unknown'} size={32} />
                  <div>
                    <div className="text-base font-semibold text-text">{p.User?.name ?? 'Unknown'}</div>
                    <div className="font-mono text-xs text-muted">{p.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {milestone.notes && (
          <div className="mb-4">
            <span className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Notes</span>
            <div className="text-base text-text2 leading-relaxed p-3 bg-surface2 rounded-lg border border-border">{milestone.notes}</div>
          </div>
        )}
      </SheetBody>
    </>
  )
}

function CrewDetailSheet({ member, onClose }: { member: CrewMember | null; onClose: () => void }) {
  if (!member) return null
  const name = member.User?.name ?? 'Unknown'
  return (
    <>
      <SheetHeader title={name} onClose={onClose} />
      <SheetBody>
        <div className="flex items-center gap-4 mb-4 p-3 bg-surface2 rounded-lg border border-border">
          <CrewAvatar name={name} size={48} />
          <div>
            <div className="text-lg font-semibold text-text">{name}</div>
            <div className="font-mono text-xs text-muted">{member.role}</div>
          </div>
        </div>
      </SheetBody>
    </>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────

export function HubContent({ projectId }: { projectId: string }) {
  const router = useRouter()
  const { data: project, isLoading: loadingProject } = useProject(projectId)
  const projectColor = project?.color || getProjectColor(projectId)
  const [pr, pg, pb] = hexToRgb(projectColor)
  const { data: actionItems, isLoading: loadingAI } = useActionItems(projectId)
  const { data: milestones, isLoading: loadingMS } = useMilestones(projectId)
  const { data: crew, isLoading: loadingCrew } = useCrew(projectId)
  const { data: scenes } = useScenes(projectId)
  const { data: scenesWithShots } = useQuery({
    queryKey: ['shotsByProject', projectId],
    queryFn: () => getShotsByProject(projectId),
    enabled: !!projectId,
  })
  const { data: moodRefs } = useMoodboard(projectId)
  const { data: threads } = useThreads(projectId)
  const { data: locations } = useLocations(projectId)
  const { data: artItems } = useArtItems(projectId)
  const { data: castRoles } = useCastRoles(projectId)
  const { data: workflowNodes } = useWorkflowNodes(projectId)
  const toggle = useToggleActionItem(projectId)
  const createTask = useCreateActionItem(projectId)
  const createMilestone = useCreateMilestone(projectId)

  const [fabOpen, setFabOpen] = useState(false)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [showCreateMilestone, setShowCreateMilestone] = useState(false)
  const [showCreateCreative, setShowCreateCreative] = useState(false)
  const [selectedAI, setSelectedAI] = useState<ActionItem | null>(null)
  const [selectedMS, setSelectedMS] = useState<Milestone | null>(null)
  const [selectedCrew, setSelectedCrew] = useState<CrewMember | null>(null)
  const [crewPanelOpen, setCrewPanelOpen] = useState(false)

  // Swipe between projects
  const { data: allProjectsList } = useProjects()
  const projectIds = (allProjectsList ?? []).map(p => p.id)
  const currentIdx = projectIds.indexOf(projectId)
  const swipeStartX = useRef<number | null>(null)
  const handleHubTouchStart = (e: React.TouchEvent) => { swipeStartX.current = e.touches[0].clientX }
  const handleHubTouchEnd = (e: React.TouchEvent) => {
    if (swipeStartX.current === null) return
    const dx = e.changedTouches[0].clientX - swipeStartX.current
    swipeStartX.current = null
    if (Math.abs(dx) < 80) return
    if (dx < 0 && currentIdx < projectIds.length - 1) router.push(`/projects/${projectIds[currentIdx + 1]}`)
    if (dx > 0 && currentIdx > 0) router.push(`/projects/${projectIds[currentIdx - 1]}`)
  }

  const allItems = actionItems ?? [], allMS = milestones ?? [], allCrew = crew ?? []
  const allScenes = scenes ?? []
  const allShots: any[] = (scenesWithShots ?? []).flatMap((s: any) => s.Shot ?? [])
  const allMoodRefs = moodRefs ?? []
  const allLocations = locations ?? [], allArt = artItems ?? [], allCast = castRoles ?? []
  const allWorkflow = workflowNodes ?? []
  const allThreads = threads ?? []

  const openItems = allItems.filter(i => i.status !== 'done')
  const previewTasks = openItems.slice(0, 3)
  const upcoming3 = allMS.filter(m => new Date(m.date) >= new Date()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3)
  const unreadThreads = allThreads.filter(t => t.unread).length

  const shuffledMood = useMemo(() => {
    const refs = [...allMoodRefs]
    let seed = 0
    for (let i = 0; i < projectId.length; i++) seed = ((seed << 5) - seed + projectId.charCodeAt(i)) | 0
    for (let i = refs.length - 1; i > 0; i--) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; const j = seed % (i + 1); [refs[i], refs[j]] = [refs[j], refs[i]] }
    return refs.slice(0, 4)
  }, [allMoodRefs, projectId])

  if (loadingProject) return <HubSkeleton />
  if (!project) return <div className="screen flex items-center justify-center"><p className="text-muted font-mono text-xs">Project not found</p></div>

  const locConfirmed = allLocations.filter((l: any) => l.status === 'booked').length
  const locTotal = allLocations.length
  const artApproved = allArt.filter(a => a.status === 'Approved').length
  const castConfirmed = allCast.filter(r => r.status === 'Confirmed').length

  const cardStyle = { background: 'rgba(10,10,18,0.42)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' as const }

  return (
    <div className="screen" onTouchStart={handleHubTouchStart} onTouchEnd={handleHubTouchEnd}>
      {/* ══ CENTER GLOW — 3 stacked radial ellipses ══ */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: [
          `radial-gradient(ellipse 20% 25% at 50% 0%, rgba(${pr},${pg},${pb},0.08) 0%, transparent 100%)`,
          `radial-gradient(ellipse 35% 45% at 50% 40%, rgba(${pr},${pg},${pb},0.07) 0%, transparent 100%)`,
          `radial-gradient(ellipse 50% 55% at 50% 90%, rgba(${pr},${pg},${pb},0.09) 0%, transparent 100%)`,
          `linear-gradient(90deg, #04040a 0%, #04040a 8%, rgba(4,4,10,0.5) 30%, transparent 50%, rgba(4,4,10,0.5) 70%, #04040a 92%, #04040a 100%)`,
        ].join(', '),
      }} />

      {/* ══ TOPBAR — frosted surface + radial accent glow from above ══ */}
      <div className="relative flex flex-col items-center justify-end px-5 flex-shrink-0" style={{
        minHeight: 100, paddingTop: 'calc(var(--safe-top) + 10px)', paddingBottom: 12,
        background: `rgba(4,4,10,0.65)`,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        zIndex: 10,
        overflow: 'hidden',
      }}>
        {/* Radial accent glow from above */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '140%', height: '120%',
          background: `radial-gradient(ellipse 50% 70% at 50% 35%, rgba(${pr},${pg},${pb},0.15) 0%, rgba(${pr},${pg},${pb},0.04) 55%, transparent 80%)`,
          pointerEvents: 'none',
        }} />
        {/* Client name — muted secondary */}
        {project.client && (
          <span className="font-mono uppercase" style={{ fontSize: '0.52rem', letterSpacing: '0.1em', marginBottom: 4, color: projectColor, opacity: 0.85, position: 'relative' }}>
            {project.client}
          </span>
        )}

        {/* Project name — item 7: largest text element */}
        <span className="text-text leading-none text-center" style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
          {project.name}
        </span>

        {/* Type + Status pill — centered */}
        <div className="flex items-center justify-center gap-2" style={{ marginTop: 4 }}>
          <span className="font-mono text-text2 uppercase" style={{ fontSize: '0.48rem' }}>{project.type}</span>
          <span className="text-muted" style={{ fontSize: '0.48rem' }}>&middot;</span>
          <div className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[project.status]}`} />
          <span className={`font-mono uppercase ${STATUS_TEXT[project.status]}`} style={{ fontSize: '0.48rem' }}>{statusLabel(project.status)}</span>
        </div>

        {/* Crew avatars */}
        <div
          className="flex items-center justify-center cursor-pointer"
          style={{ marginTop: 10 }}
          onClick={() => { haptic('light'); setCrewPanelOpen(true) }}>
          {allCrew.slice(0, 4).map((m, i) => (
            <div key={m.id} className="relative" style={{ marginLeft: i === 0 ? 0 : -7, zIndex: 4 - i }}>
              <CrewAvatar name={m.User?.name ?? 'Unknown'} size={28} />
            </div>
          ))}
          {allCrew.length > 4 && (
            <div className="rounded-full bg-surface2 border border-border flex items-center justify-center" style={{ width: 28, height: 28, marginLeft: -7 }}>
              <span className="font-mono text-muted" style={{ fontSize: 9 }}>+{allCrew.length - 4}</span>
            </div>
          )}
          {allCrew.length === 0 && (
            <span className="font-mono" style={{ fontSize: '0.38rem', color: '#62627a', letterSpacing: '0.06em' }}>No crew yet</span>
          )}
        </div>
      </div>

      {/* ══ BODY ══ */}
      {/* item 15: paddingBottom increased to clear FAB at bottom: 68px */}
      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', padding: '18px 16px 140px' }}>
        <div className="flex flex-col gap-6">

          {/* 1. TIMELINE (first) — item 9: no chevron, item 10: Gantt */}
          <div className="cursor-pointer" onClick={() => router.push(`/projects/${projectId}/timeline`)}>
            <ModuleHeader name="Timeline" meta={new Date().toLocaleDateString('en-US', { weekday: 'short', month: '2-digit', day: '2-digit' }).replace(',', ' ·')} />
            {loadingMS ? (
              <div style={{ ...cardStyle, height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="w-4 h-4 rounded-full border border-border2 border-t-accent animate-spin" />
              </div>
            ) : allMS.length === 0 ? (
              <div style={{ ...cardStyle, height: 130, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '12px 12px 0', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                  {(['Pre', 'Prod', 'Post'] as const).map((label, i) => {
                    const color = ['#e8a020', '#6470f3', '#00b894'][i]
                    return (
                      <div key={label} className="flex items-center gap-1.5">
                        <span className="font-mono uppercase text-right flex-shrink-0" style={{ fontSize: '0.42rem', color: '#62627a', width: 28, letterSpacing: '0.06em' }}>{label}</span>
                        <div className="flex-1 rounded-sm" style={{ height: 5, background: `${color}1a`, animation: `pulse 2.4s ease-in-out infinite ${i * 0.3}s` }} />
                      </div>
                    )
                  })}
                </div>
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-4">
                  <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#dddde8', letterSpacing: '-0.01em' }}>The time is now.</div>
                  <div className="font-mono" style={{ fontSize: '0.47rem', color: '#62627a', letterSpacing: '0.03em', lineHeight: 1.6 }}>No milestones yet.<br />Add milestones to start the clock.</div>
                </div>
              </div>
            ) : (
              // item 10: Gantt chart replaces milestone list
              <div style={{ ...cardStyle, height: 130, display: 'flex', flexDirection: 'column' }}>
                <GanttChart milestones={allMS} projectStatus={project.status} />
              </div>
            )}
          </div>

          {/* 2. ACTION ITEMS (second) — item 9: no chevron, item 13: assignee pills + navigate */}
          <div className="cursor-pointer" onClick={() => router.push(`/projects/${projectId}/action-items`)}>
            <ModuleHeader name="My Action Items" meta={openItems.length > 0 ? `${openItems.length} open` : 'All clear'} />
            {loadingAI ? (
              <div style={{ ...cardStyle, height: 148, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="w-4 h-4 rounded-full border border-border2 border-t-accent animate-spin" />
              </div>
            ) : previewTasks.length === 0 ? (
              <div style={{ ...cardStyle, height: 148, display: 'flex', flexDirection: 'column' }}>
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-4">
                  <div className="relative flex-shrink-0" style={{ width: 34, height: 34 }}>
                    <div className="absolute inset-0 rounded-full" style={{ border: `1px solid rgba(${pr},${pg},${pb},0.3)`, animation: 'ring-pulse 2.4s ease-out infinite' }} />
                    <div className="absolute inset-0 rounded-full" style={{ background: `rgba(${pr},${pg},${pb},0.08)`, border: `1px solid rgba(${pr},${pg},${pb},0.15)` }} />
                    <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 15 15" fill="none">
                      <path d="M2.5 7.5L6 11L12.5 4" stroke={projectColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#dddde8', letterSpacing: '-0.01em' }}>All clear, boss.</div>
                  <div className="font-mono" style={{ fontSize: '0.48rem', color: '#62627a', letterSpacing: '0.03em', lineHeight: 1.6 }}>No open items on this one.<br />Enjoy it while it lasts.</div>
                </div>
              </div>
            ) : (
              <div style={{ ...cardStyle, height: 148, display: 'flex', flexDirection: 'column' }}>
                {previewTasks.map((item, i) => {
                  const isMine = true
                  const dateLabel = item.dueDate ? formatDate(item.dueDate) : null
                  const overdue = item.dueDate ? isLate(item.dueDate) : false
                  // item 13: look up assignee name from crew
                  const assigneeMember = item.assignedTo ? allCrew.find(c => c.id === item.assignedTo) : null
                  const assigneeName = assigneeMember?.User?.name ?? null
                  return (
                    <div key={item.id} className="flex items-start cursor-pointer" style={{ gap: 10, padding: '9px 12px', borderBottom: i < previewTasks.length - 1 ? '1px solid rgba(255,255,255,0.05)' : undefined }}
                      onClick={e => { e.stopPropagation(); router.push(`/projects/${projectId}/action-items`) }}>
                      <div className="flex-shrink-0 rounded-full" style={{ width: 14, height: 14, marginTop: 1, border: `1.5px solid ${isMine ? projectColor : '#62627a'}` }}
                        onClick={e => { e.stopPropagation(); haptic('success'); toggle.mutate({ id: item.id, done: item.status !== 'done' }) }} />
                      <div className="flex-1 min-w-0">
                        {/* item 7: third-tier label size */}
                        <div className="truncate" style={{ fontSize: '0.66rem', fontWeight: 600, lineHeight: 1.3, color: isMine ? '#dddde8' : '#62627a' }}>{item.title}</div>
                        {dateLabel && <div className="font-mono" style={{ fontSize: '0.50rem', marginTop: 2, letterSpacing: '0.03em', color: overdue ? '#e8a020' : '#62627a' }}>{dateLabel}</div>}
                      </div>
                      {/* item 13: assignee pill */}
                      {assigneeName && (
                        <div style={{
                          flexShrink: 0,
                          padding: '2px 7px',
                          borderRadius: 20,
                          background: `rgba(${pr},${pg},${pb},0.08)`,
                          border: `1px solid rgba(${pr},${pg},${pb},0.2)`,
                          display: 'flex', alignItems: 'center',
                          alignSelf: 'center',
                        }}>
                          <span className="font-mono" style={{ fontSize: '0.32rem', color: '#a0a0b8', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{assigneeName.split(' ')[0]}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 3. CREATIVE SECTION — item 9: no chevron on header */}
          <div>
            <SectionHeader name="Creative" meta={`${allScenes.length > 0 ? `SC.${allScenes[0].num}` : ''}${allMoodRefs.length > 0 ? ' · Tone' : ''}${allLocations.length > 0 ? ` · ${allLocations.length} locations` : ''}`} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* SceneMaker + Tone 50/50 — item 8: labels moved INSIDE panels */}
              <div className="flex" style={{ gap: 8, height: 148 }}>
                {/* SceneMaker card — item 12: swipeable */}
                <div className="flex-1 min-w-0 cursor-pointer" style={{ background: 'rgba(10,10,18,0.42)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <SwipeableSceneMaker
                    projectId={projectId}
                    projectColor={projectColor}
                    pr={pr} pg={pg} pb={pb}
                    allShots={allShots}
                    allScenes={allScenes}
                    allMoodRefs={allMoodRefs}
                    shuffledMood={shuffledMood}
                    router={router}
                  />
                </div>

                {/* Tone panel — swipeable moodboard images */}
                <SwipePanel
                  items={allMoodRefs}
                  label="Tone"
                  labelColor={projectColor}
                  href={`/projects/${projectId}/moodboard`}
                  emptyContent={
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: 0.35 }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                        <rect x="2" y="4" width="20" height="16" rx="2" stroke="#62627a" strokeWidth="1.3" />
                        <circle cx="8" cy="10" r="2" stroke="#62627a" strokeWidth="1.2" />
                        <path d="M2 16l5-4 3 2 4-5 8 7" stroke="#62627a" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="font-mono" style={{ fontSize: '0.38rem', color: '#62627a' }}>Set the tone</span>
                    </div>
                  }
                  renderItem={(ref) => (
                    ref.imageUrl ? (
                      <img src={ref.imageUrl} alt={ref.title} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: ref.gradient || '#0a0a12', opacity: 0.7 }} />
                    )
                  )}
                />
              </div>

              {/* Locations / Casting / Art row */}
              <div className="flex" style={{ gap: 8 }}>
                {/* Locations panel — swipeable location images */}
                <SwipePanel
                  items={allLocations}
                  label="Locations"
                  labelColor="#e8a020"
                  emptyIcon="📍"
                  href={`/projects/${projectId}/locations`}
                  renderItem={(loc: any) => (
                    loc.imageUrl ? (
                      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                        <img src={loc.imageUrl} alt={loc.name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 6px', background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}>
                          <span style={{ fontSize: '0.38rem', fontWeight: 600, color: '#dddde8' }}>{loc.name}</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                        <span style={{ fontSize: '0.50rem', fontWeight: 600, color: '#dddde8', textAlign: 'center' }}>{loc.name ?? ''}</span>
                        <span className="font-mono capitalize" style={{ fontSize: '0.34rem', color: '#62627a', marginTop: 2 }}>{loc.status?.replace('_', ' ') ?? ''}</span>
                      </div>
                    )
                  )}
                />

                {/* Casting panel — swipeable cast headshots */}
                <SwipePanel
                  items={allCast}
                  label="Casting"
                  labelColor="#00b894"
                  emptyIcon="🎭"
                  href={`/projects/${projectId}/casting`}
                  renderItem={(role: any) => (
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 16 }}>🎭</span>
                      </div>
                      <span style={{ fontSize: '0.46rem', fontWeight: 600, color: '#dddde8' }}>{role.name}</span>
                      <span className="font-mono capitalize" style={{ fontSize: '0.32rem', color: '#62627a' }}>{role.status}</span>
                    </div>
                  )}
                />

                {/* Art panel — swipeable tabs: Wardrobe, Props, HMU */}
                <SwipePanel
                  items={['wardrobe', 'props', 'hmu'] as const}
                  label="Art"
                  labelColor="#6470f3"
                  emptyIcon="🎨"
                  href={`/projects/${projectId}/art`}
                  renderItem={(cat: string) => {
                    const catItems = allArt.filter(a => a.cat === cat)
                    const latest = catItems.find(a => a.imageUrl) ?? catItems[0]
                    const catLabel = cat === 'hmu' ? 'HMU' : cat === 'wardrobe' ? 'Wardrobe' : 'Props'
                    return (
                      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 6 }}>
                        {latest?.imageUrl ? (
                          <img src={latest.imageUrl} alt={catLabel} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                        ) : (
                          <>
                            <span className="font-mono uppercase" style={{ fontSize: '0.38rem', color: '#6470f3', letterSpacing: '0.06em' }}>{catLabel}</span>
                            <span className="font-mono" style={{ fontSize: '0.30rem', color: '#62627a', marginTop: 2 }}>{catItems.length > 0 ? `${catItems.length} items` : 'Empty'}</span>
                          </>
                        )}
                      </div>
                    )
                  }}
                />
              </div>
            </div>
          </div>

          {/* 4. WORKFLOW */}
          <div className="cursor-pointer" style={{ padding: '0 2px' }} onClick={() => router.push(`/projects/${projectId}/workflow`)}>
            <ModuleHeader name="Workflow" meta={`${allWorkflow.length} nodes`} />
            {allWorkflow.length > 0 ? (
              <div className="flex items-start">
                {allWorkflow.slice(0, 5).map((node, i, arr) => (
                  <div key={node.id} className="flex items-center" style={{ flex: 1 }}>
                    <div className="flex flex-col items-center gap-1" style={{ flex: 1 }}>
                      <div className="flex items-center justify-center border border-border" style={{ width: 36, height: 36, borderRadius: 10, background: '#0f0f1a' }}>
                        <span style={{ fontSize: 15 }}>{WF_ICONS[node.type] ?? '⚙'}</span>
                      </div>
                      {/* item 7: third-tier label */}
                      <span className="font-mono text-center" style={{ fontSize: '0.36rem', color: '#a0a0b8', maxWidth: 48, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{node.label}</span>
                    </div>
                    {i < arr.length - 1 && <div style={{ width: 12, height: 1, background: 'linear-gradient(90deg, rgba(100,112,243,0.3), rgba(0,184,148,0.3))', flexShrink: 0, marginBottom: 16 }} />}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-3">
                <div className="flex items-center gap-2">
                  {[0,1,2,3,4].map(i => <div key={i} className="flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px dashed rgba(255,255,255,0.09)' }}><div className="rounded-full bg-muted/30" style={{ width: 4, height: 4 }} /></div>)}
                </div>
                <span className="font-mono" style={{ fontSize: 9, color: '#62627a' }}>No workflow yet</span>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ══ FAB SYSTEM (Framer Motion) ══ */}
      {/* Overlay */}
      <AnimatePresence>
        {fabOpen && (
          <motion.div
            key="fab-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setFabOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 20,
              background: 'rgba(4,4,10,0.75)',
              backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)',
            }}
          />
        )}
      </AnimatePresence>

      {/* Branch lines SVG */}
      <AnimatePresence>
        {fabOpen && (
          <motion.svg
            key="fab-branches"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              bottom: 'calc(54px + env(safe-area-inset-bottom, 0px))',
              left: '50%', x: '-50%',
              zIndex: 28, pointerEvents: 'none',
            }}
            width="220" height="110" viewBox="0 0 220 110"
          >
            <line x1="110" y1="98" x2="22" y2="46" stroke={`rgba(${pr},${pg},${pb},0.2)`} strokeWidth="1" strokeDasharray="3 3" />
            <line x1="110" y1="98" x2="110" y2="8" stroke={`rgba(${pr},${pg},${pb},0.2)`} strokeWidth="1" strokeDasharray="3 3" />
            <line x1="110" y1="98" x2="198" y2="46" stroke={`rgba(${pr},${pg},${pb},0.2)`} strokeWidth="1" strokeDasharray="3 3" />
            <circle cx="110" cy="98" r="3" fill={`rgba(${pr},${pg},${pb},0.35)`} />
          </motion.svg>
        )}
      </AnimatePresence>

      {/* Branch options — symmetric fan from center anchor */}
      <div style={{
        position: 'fixed',
        bottom: 'calc(54px + env(safe-area-inset-bottom, 0px))',
        left: '50%', transform: 'translateX(-50%)',
        width: 0, height: 0, zIndex: 30, pointerEvents: 'none',
      }}>
        {/* Left: Action Item */}
        <motion.button
          onClick={() => { setFabOpen(false); haptic('light'); setShowCreateTask(true) }}
          animate={fabOpen ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 20, stiffness: 280 }}
          style={{
            position: 'absolute', bottom: 26, left: -90,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            pointerEvents: fabOpen ? 'auto' : 'none',
          }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(232,160,32,0.1)', border: '1px solid rgba(232,160,32,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="7" stroke="#e8a020" strokeWidth="1.3" />
              <path d="M5.5 9L8 11.5L12.5 6.5" stroke="#e8a020" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="font-mono uppercase" style={{ fontSize: '0.38rem', letterSpacing: '0.06em', color: '#e8a020', whiteSpace: 'nowrap' }}>Action</span>
        </motion.button>

        {/* Center: Milestone — rises highest, 0.05s delay */}
        <motion.button
          onClick={() => { setFabOpen(false); haptic('light'); setShowCreateMilestone(true) }}
          animate={fabOpen ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ type: 'spring', damping: 20, stiffness: 280, delay: fabOpen ? 0.05 : 0 }}
          style={{
            position: 'absolute', bottom: 90, left: -22,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            pointerEvents: fabOpen ? 'auto' : 'none',
          }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: `rgba(${pr},${pg},${pb},0.12)`, border: `1px solid rgba(${pr},${pg},${pb},0.35)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <line x1="2" y1="9" x2="16" y2="9" stroke={projectColor} strokeWidth="1.3" />
              <circle cx="6" cy="9" r="2.5" fill={projectColor} />
              <circle cx="12" cy="9" r="2.5" fill={projectColor} />
            </svg>
          </div>
          <span className="font-mono uppercase" style={{ fontSize: '0.38rem', letterSpacing: '0.06em', color: projectColor, whiteSpace: 'nowrap' }}>Milestone</span>
        </motion.button>

        {/* Right: Creative */}
        <motion.button
          onClick={() => { setFabOpen(false); haptic('light'); setShowCreateCreative(true) }}
          animate={fabOpen ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 20, stiffness: 280 }}
          style={{
            position: 'absolute', bottom: 26, left: 46,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            pointerEvents: fabOpen ? 'auto' : 'none',
          }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(100,112,243,0.1)', border: '1px solid rgba(100,112,243,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="3" width="14" height="12" rx="1.5" stroke="#6470f3" strokeWidth="1.3" />
              <path d="M2 7.5H16" stroke="#6470f3" strokeWidth="1.3" />
              <path d="M6.5 3V7.5M11.5 3V7.5" stroke="#6470f3" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </div>
          <span className="font-mono uppercase" style={{ fontSize: '0.38rem', letterSpacing: '0.06em', color: '#6470f3', whiteSpace: 'nowrap' }}>Add Crew</span>
        </motion.button>
      </div>

      {/* FAB zone — main + side FABs + back chevron */}
      <div style={{
        position: 'fixed',
        bottom: 68,
        left: 0, right: 0, zIndex: 30,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 52,
      }}>
        {/* Back chevron — further left of Chat, slides off-screen when FAB opens */}
        <motion.div
          onClick={() => { haptic('light'); router.push('/projects') }}
          animate={fabOpen ? { x: -200, opacity: 0 } : { x: -58, opacity: 1 }}
          transition={{ type: 'spring', damping: 25, stiffness: 260 }}
          style={{
            position: 'absolute', width: 36, height: 36, borderRadius: '50%',
            background: `rgba(${pr},${pg},${pb},0.1)`,
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            border: `1px solid rgba(${pr},${pg},${pb},0.2)`,
            boxShadow: `0 2px 12px rgba(${pr},${pg},${pb},0.12), inset 0 1px 0 rgba(255,255,255,0.08)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            top: '50%', left: '50%', marginLeft: -18, marginTop: -18,
            cursor: 'pointer',
          }}
        >
          <svg width="8" height="12" viewBox="0 0 6 10" fill="none"><path d="M5 1L1 5L5 9" stroke="rgba(255,255,255,0.5)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </motion.div>

        {/* Chat FAB — slides left from center, glass */}
        <motion.div
          onClick={() => { haptic('light'); setFabOpen(false); router.push(`/projects/${projectId}/chat`) }}
          animate={fabOpen ? { x: -110, opacity: 1 } : { x: 0, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 280 }}
          style={{
            position: 'absolute', width: 38, height: 38, borderRadius: '50%',
            background: `rgba(${pr},${pg},${pb},0.08)`,
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid rgba(${pr},${pg},${pb},0.2)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            top: '50%', left: '50%', marginLeft: -19, marginTop: -19,
            cursor: 'pointer', pointerEvents: fabOpen ? 'auto' : 'none',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2h10a1 1 0 011 1v5.5a1 1 0 01-1 1H5l-3 2.5V3a1 1 0 011-1z" stroke="rgba(255,255,255,0.55)" strokeWidth="1.1" strokeLinejoin="round" />
          </svg>
        </motion.div>

        {/* Main FAB — glassmorphism */}
        <motion.button
          onClick={() => { haptic('medium'); setFabOpen(prev => !prev) }}
          animate={{ rotate: fabOpen ? 45 : 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 280 }}
          style={{
            width: 52, height: 52, borderRadius: '50%',
            background: `rgba(${pr},${pg},${pb},0.15)`,
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            border: `1.5px solid rgba(${pr},${pg},${pb},0.45)`,
            boxShadow: `0 4px 24px rgba(${pr},${pg},${pb},0.25), inset 0 1px 0 rgba(255,255,255,0.1)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', position: 'relative', zIndex: 31, flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 3V15M3 9H15" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </motion.button>

        {/* Threads FAB — slides right from center, glass */}
        <motion.div
          onClick={() => { haptic('light'); setFabOpen(false); router.push(`/projects/${projectId}/threads`) }}
          animate={fabOpen ? { x: 110, opacity: 1 } : { x: 0, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 280 }}
          style={{
            position: 'absolute', width: 38, height: 38, borderRadius: '50%',
            background: `rgba(${pr},${pg},${pb},0.08)`,
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid rgba(${pr},${pg},${pb},0.2)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            top: '50%', left: '50%', marginLeft: -19, marginTop: -19,
            cursor: 'pointer', pointerEvents: fabOpen ? 'auto' : 'none',
          }}
        >
          <ThreadsIcon size={14} unreadCount={unreadThreads} />
        </motion.div>
      </div>

      {/* ══ SHEETS ══ */}
      <Sheet open={!!selectedAI} onClose={() => setSelectedAI(null)}><AIDetailSheet item={selectedAI} crew={allCrew} onClose={() => setSelectedAI(null)} /></Sheet>
      <Sheet open={!!selectedMS} onClose={() => setSelectedMS(null)}><MSDetailSheet milestone={selectedMS} crew={allCrew} onClose={() => setSelectedMS(null)} /></Sheet>
      <Sheet open={!!selectedCrew} onClose={() => setSelectedCrew(null)}><CrewDetailSheet member={selectedCrew} onClose={() => setSelectedCrew(null)} /></Sheet>

      {/* ══ CREATION SHEETS ══ */}
      <CreateTaskSheet
        open={showCreateTask}
        projectId={projectId}
        accent={projectColor}
        crew={allCrew}
        onSave={(data) => { createTask.mutate(data as any); setShowCreateTask(false) }}
        onClose={() => setShowCreateTask(false)}
      />
      <CreateMilestoneSheet
        open={showCreateMilestone}
        projectId={projectId}
        accent={projectColor}
        onSave={(data) => { createMilestone.mutate(data as any); setShowCreateMilestone(false) }}
        onClose={() => setShowCreateMilestone(false)}
      />
      <CreateCreativeSheet
        open={showCreateCreative}
        projectId={projectId}
        accent={projectColor}
        onSelectScene={() => router.push(`/projects/${projectId}/scenemaker`)}
        onSelectShot={() => router.push(`/projects/${projectId}/scenemaker`)}
        onSelectTone={() => router.push(`/projects/${projectId}/moodboard`)}
        onClose={() => setShowCreateCreative(false)}
      />

      {/* ══ CREW PANEL ══ */}
      <CrewPanel open={crewPanelOpen} projectId={projectId} accent={projectColor} onClose={() => setCrewPanelOpen(false)} />
    </div>
  )
}
