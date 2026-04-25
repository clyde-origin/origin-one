'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { haptic } from '@/lib/utils/haptics'
import { useAllCrew } from '@/lib/hooks/useOriginOne'
import {
  readStoredViewerName,
  readStoredViewerRole,
  writeStoredViewer,
  type ViewerRole,
} from '@/lib/utils/viewerIdentity'
import type { TeamMember } from '@/types'

// Partner is a UI-only role on the entry screen — never persisted to
// localStorage and never resolved into a ProjectMember. It exists here so
// the button can show its "Coming soon" state without leaking past the gate.
type EntryRole = ViewerRole | 'partner'

// Selected-state accent per role. Producer maps to phase-prod indigo, Crew
// to phase-pre amber, Partner to phase-post teal — entry screen has no
// project context yet, so the accent encodes the role itself rather than a
// project palette. Foreground is per-accent for contrast: white reads on
// indigo, dark on amber and teal.
const ROLE_OPTIONS: { value: EntryRole; label: string; accent: string; on: string }[] = [
  { value: 'producer', label: 'Producer', accent: '#6470f3', on: '#ffffff' },
  { value: 'crew',     label: 'Crew',     accent: '#e8a020', on: '#04040a' },
  { value: 'partner',  label: 'Partner',  accent: '#00b894', on: '#04040a' },
]

const TOOLTIP_BG = '#10101a'
const TOOLTIP_BORDER = 'rgba(255,255,255,0.08)'

export default function LoginPage() {
  const [role, setRole] = useState<EntryRole | null>(null)
  const [name, setName] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  // Skip-on-revisit: only redirect when BOTH role and name are stored.
  // readStoredViewerRole rejects anything outside 'producer' | 'crew', so
  // a stale 'partner' (which we never write anyway) can't slip through.
  useEffect(() => {
    const r = readStoredViewerRole()
    const n = readStoredViewerName()
    if (r && n) router.replace('/projects')
  }, [router])

  const { data: allCrew } = useAllCrew()

  // Distinct names for the selected role across all six projects, deduped
  // case-insensitively (Tyler appears in every project — one entry, not
  // six). Partner has no seeded membership, so suggestions are empty.
  const suggestions = useMemo(() => {
    if (!role || role === 'partner' || !allCrew) return []
    const seen = new Set<string>()
    const out: string[] = []
    for (const m of allCrew as TeamMember[]) {
      if (m.role !== role) continue
      const display = m.User?.name?.trim()
      if (!display) continue
      const key = display.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(display)
    }
    return out.sort((a, b) => a.localeCompare(b))
  }, [role, allCrew])

  const filteredSuggestions = useMemo(() => {
    if (!showSuggestions || !role || role === 'partner') return []
    const q = name.trim().toLowerCase()
    if (q.length === 0) return []
    return suggestions.filter(s => s.toLowerCase().includes(q)).slice(0, 8)
  }, [suggestions, name, role, showSuggestions])

  const isPartnerSelected = role === 'partner'
  const canEnter = !!role && !isPartnerSelected && name.trim().length > 0

  function selectRole(next: EntryRole) {
    haptic('light')
    // Tap-again-to-deselect applies only to Partner. Producer and Crew stay
    // single-select with no toggle-off (PR #13 behaviour preserved).
    if (next === 'partner' && role === 'partner') {
      setRole(null)
    } else {
      setRole(next)
    }
    inputRef.current?.focus()
  }

  function handleEnter() {
    // canEnter already excludes the 'partner' branch; this narrows role to
    // ViewerRole for writeStoredViewer.
    if (!canEnter || !role) return
    haptic('medium')
    writeStoredViewer(role, name)
    router.push('/projects')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleEnter()
    else if (e.key === 'Escape') setShowSuggestions(false)
  }

  function pickSuggestion(s: string) {
    setName(s)
    setShowSuggestions(false)
  }

  return (
    <div className="relative w-full h-dvh overflow-hidden flex flex-col">

      {/* Background image */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-top"
        style={{ backgroundImage: "url('/images/b21_bg.png')" }}
      />

      {/* Gradient overlay */}
      <div
        className="absolute inset-0 z-10"
        style={{
          background: 'linear-gradient(180deg, rgba(4,4,10,0.35) 0%, rgba(4,4,10,0.1) 30%, rgba(4,4,10,0.2) 55%, rgba(4,4,10,0.82) 75%, rgba(4,4,10,0.97) 100%)',
        }}
      />

      {/* Spacer */}
      <div className="flex-1 z-20 relative" />

      {/* Form */}
      <div className="relative z-20 px-8 pb-14 flex-shrink-0">

        <p className="font-mono text-[0.44rem] tracking-[0.28em] uppercase text-white/30 mb-7">
          Origin Point
        </p>

        {/* Role row */}
        <label className="block font-mono text-[0.42rem] tracking-[0.18em] uppercase text-white/35 mb-2">
          Sign in as
        </label>
        <div className="flex gap-2 mb-5">
          {ROLE_OPTIONS.map(opt => {
            const selected = role === opt.value
            const showTooltip = opt.value === 'partner' && selected
            return (
              <div key={opt.value} className="flex-1 relative">
                {showTooltip && (
                  <div
                    role="tooltip"
                    className="absolute left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap"
                    style={{
                      bottom: 'calc(100% + 8px)',
                      background: TOOLTIP_BG,
                      color: '#dddde8',
                      fontSize: 11,
                      lineHeight: 1,
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: `1px solid ${TOOLTIP_BORDER}`,
                      boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
                    }}
                  >
                    Coming soon
                    {/* Caret — rotated square showing the bottom-right
                        edges so the border continues into the tooltip. */}
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        left: '50%',
                        bottom: -4,
                        marginLeft: -4,
                        width: 8,
                        height: 8,
                        background: TOOLTIP_BG,
                        borderRight: `1px solid ${TOOLTIP_BORDER}`,
                        borderBottom: `1px solid ${TOOLTIP_BORDER}`,
                        transform: 'rotate(45deg)',
                      }}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => selectRole(opt.value)}
                  aria-pressed={selected}
                  className="w-full py-2.5 rounded-xl text-[0.78rem] font-semibold transition-colors active:scale-[0.98]"
                  style={selected ? {
                    background: opt.accent,
                    color: opt.on,
                    border: `1px solid ${opt.accent}`,
                  } : {
                    background: 'rgba(4,4,10,0.35)',
                    color: '#a0a0b8',
                    border: '1px solid rgba(255,255,255,0.10)',
                  }}
                >
                  {opt.label}
                </button>
              </div>
            )
          })}
        </div>

        {/* Name autocomplete */}
        <label className="block font-mono text-[0.42rem] tracking-[0.18em] uppercase text-white/35 mb-2">
          Your name
        </label>

        <div className="relative mb-3">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setShowSuggestions(true) }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => { window.setTimeout(() => setShowSuggestions(false), 150) }}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Clyde"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full rounded-xl px-4 py-3.5 text-[0.92rem] font-semibold text-text placeholder:text-white/20 outline-none transition-colors border border-white/10 focus:border-white/25"
            style={{
              background: 'rgba(4,4,10,0.55)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          />

          {filteredSuggestions.length > 0 && (
            <ul
              className="absolute left-0 right-0 mt-1.5 rounded-xl overflow-hidden border border-white/10 z-30"
              style={{
                background: 'rgba(4,4,10,0.85)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
            >
              {filteredSuggestions.map(s => (
                <li key={s}>
                  <button
                    type="button"
                    onMouseDown={e => { e.preventDefault(); pickSuggestion(s) }}
                    className="block w-full text-left px-4 py-2.5 text-[0.85rem] font-medium text-white/85 hover:bg-white/[0.06] active:bg-white/[0.1]"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={handleEnter}
          disabled={!canEnter}
          className="w-full py-3.5 rounded-xl font-bold text-[0.88rem] text-[#04040a] transition-opacity active:scale-[0.98] disabled:opacity-25"
          style={{ background: 'rgba(255,255,255,0.92)' }}
        >
          Enter
        </button>

        {/* Partner-gate helper. Only renders when Partner is selected so the
            user knows the disabled Login is about Partner, not the name. */}
        {isPartnerSelected && (
          <p className="font-mono text-[0.42rem] tracking-[0.14em] uppercase text-center mt-3" style={{ color: '#62627a' }}>
            Partner access not yet available
          </p>
        )}

        <p className="font-mono text-[0.38rem] tracking-[0.2em] uppercase text-white/[0.14] text-center mt-4">
          Origin One &middot; Back to One
        </p>

      </div>
    </div>
  )
}
