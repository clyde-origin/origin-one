'use client'

import { useState } from 'react'
import type { Milestone } from '@/types'

// Hub timeline visualization — three colored phase segments with
// milestone tick markers, today indicator, and final-delivery marker.
// Selecting a milestone reveals a detail row with prev/next chevrons.

export function GanttChart({ milestones, projectStatus }: { milestones: Milestone[]; projectStatus: string }) {
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

  const nextMs = milestones.filter(m => new Date(m.date) >= today).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
  const [selectedMsId, setSelectedMsId] = useState<string | null>(nextMs?.id ?? null)

  const finalMs = milestones.length > 0 ? milestones.reduce((a, b) => new Date(a.date) > new Date(b.date) ? a : b) : null
  const finalPct = finalMs ? toPercent(new Date(finalMs.date)) : null

  const activePhaseIndex = projectStatus === 'pre_production' || projectStatus === 'development' ? 0
    : projectStatus === 'production' ? 1
    : projectStatus === 'post_production' ? 2
    : -1

  const segments = [
    { label: 'Pre', color: '#e8a020', leftPct: 0, widthPct: 33.3 },
    { label: 'Prod', color: '#6470f3', leftPct: 33.3, widthPct: 33.4 },
    { label: 'Post', color: '#00b894', leftPct: 66.7, widthPct: 33.3 },
  ]

  return (
    <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1, alignItems: 'center' }}>
      <div style={{ width: '100%', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span className="font-mono" style={{ fontSize: '0.46rem', color: '#62627a' }}>{fmt(rangeStart)}</span>
          <span className="font-mono" style={{ fontSize: '0.46rem', color: '#62627a' }}>{fmt(rangeEnd)}</span>
        </div>

        <div style={{ width: '100%', height: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 4, position: 'relative', overflow: 'visible' }}>
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

          {milestones.map(ms => {
            const pct = toPercent(new Date(ms.date))
            const isCompleted = ms.status === 'completed'
            const isSelected = selectedMsId === ms.id
            return (
              <button key={ms.id}
                type="button"
                aria-label={`Milestone ${ms.title}`}
                aria-pressed={isSelected}
                onClick={(e) => { e.stopPropagation(); setSelectedMsId(prev => prev === ms.id ? null : ms.id) }}
                style={{
                  position: 'absolute', top: -4, left: `${pct}%`, transform: 'translateX(-50%)',
                  width: 8, height: 16, cursor: 'pointer', zIndex: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0, background: 'transparent', border: 'none',
                }}>
                <div style={{
                  width: isSelected ? 4 : 3, height: isSelected ? 14 : 12, borderRadius: 1,
                  background: isSelected ? '#dddde8' : isCompleted ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.45)',
                  transition: 'all 0.15s',
                }} />
              </button>
            )
          })}

          <div style={{
            position: 'absolute', top: -3, bottom: -3,
            left: `${todayPct}%`, transform: 'translateX(-50%)',
            width: 2, borderRadius: 1,
            background: '#e8564a',
            boxShadow: '0 0 4px #e8564a',
            zIndex: 3,
          }} />

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
          <div style={{ width: '100%', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              aria-label="Previous milestone"
              disabled={!hasPrev}
              onClick={(e) => { e.stopPropagation(); if (hasPrev) setSelectedMsId(sorted[idx - 1].id) }}
              style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: hasPrev ? 'pointer' : 'default', opacity: hasPrev ? 0.5 : 0.15, flexShrink: 0, background: 'transparent', border: 'none', padding: 0 }}
            >
              <svg width="6" height="10" viewBox="0 0 6 10" fill="none"><path d="M5 1L1 5L5 9" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <div style={{
              flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: statusColor }} />
              <span style={{
                fontSize: '0.72rem', fontWeight: 600, color: '#dddde8',
                flex: 1, minWidth: 0,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{ms.title}</span>
              <span className="font-mono" style={{ fontSize: '0.48rem', color: '#62627a', flexShrink: 0 }}>{fmt(msDate)}</span>
              <span className="font-mono" style={{ fontSize: '0.46rem', color: statusColor, flexShrink: 0 }}>{daysLabel}</span>
            </div>
            <button
              type="button"
              aria-label="Next milestone"
              disabled={!hasNext}
              onClick={(e) => { e.stopPropagation(); if (hasNext) setSelectedMsId(sorted[idx + 1].id) }}
              style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: hasNext ? 'pointer' : 'default', opacity: hasNext ? 0.5 : 0.15, flexShrink: 0, background: 'transparent', border: 'none', padding: 0 }}
            >
              <svg width="6" height="10" viewBox="0 0 6 10" fill="none"><path d="M1 1L5 5L1 9" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        )
      })()}
    </div>
  )
}
