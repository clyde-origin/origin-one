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

// Selected-state accent per role. Producer maps to phase-prod indigo, Crew
// to phase-pre amber — entry screen has no project context yet, so the
// accent encodes the role itself rather than a project palette. Foreground
// is per-accent for contrast: white reads on indigo, dark on amber.
const ROLE_OPTIONS: { value: ViewerRole; label: string; accent: string; on: string }[] = [
  { value: 'producer', label: 'Producer', accent: '#6470f3', on: '#ffffff' },
  { value: 'crew',     label: 'Crew',     accent: '#e8a020', on: '#04040a' },
]

export default function LoginPage() {
  const [role, setRole] = useState<ViewerRole | null>(null)
  const [name, setName] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [partnerHint, setPartnerHint] = useState(false)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  // Skip-on-revisit: only redirect when BOTH role and name are stored.
  // If only one survived (corrupt/stale state), stay on entry screen.
  useEffect(() => {
    const r = readStoredViewerRole()
    const n = readStoredViewerName()
    if (r && n) router.replace('/projects')
  }, [router])

  const { data: allCrew } = useAllCrew()

  // Distinct names for the selected role across all six projects, deduped
  // case-insensitively (Tyler appears in every project — one entry, not six).
  const suggestions = useMemo(() => {
    if (!role || !allCrew) return []
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
    if (!showSuggestions || !role) return []
    const q = name.trim().toLowerCase()
    if (q.length === 0) return []
    return suggestions.filter(s => s.toLowerCase().includes(q)).slice(0, 8)
  }, [suggestions, name, role, showSuggestions])

  const canEnter = !!role && name.trim().length > 0

  function selectRole(next: ViewerRole) {
    haptic('light')
    setRole(next)
    setPartnerHint(false)
    inputRef.current?.focus()
  }

  function handleEnter() {
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
        <div className="flex gap-2 mb-2">
          {ROLE_OPTIONS.map(opt => {
            const selected = role === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => selectRole(opt.value)}
                className="flex-1 py-2.5 rounded-xl text-[0.78rem] font-semibold transition-colors active:scale-[0.98]"
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
            )
          })}
          <button
            type="button"
            disabled
            aria-disabled="true"
            onMouseEnter={() => setPartnerHint(true)}
            onMouseLeave={() => setPartnerHint(false)}
            onTouchStart={() => setPartnerHint(true)}
            onTouchEnd={() => { window.setTimeout(() => setPartnerHint(false), 1500) }}
            className="flex-1 py-2.5 rounded-xl text-[0.78rem] font-semibold cursor-not-allowed"
            style={{
              background: 'rgba(4,4,10,0.25)',
              color: '#62627a',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            Partner
          </button>
        </div>
        <div className="h-4 mb-3">
          {partnerHint && (
            <p className="font-mono text-[0.42rem] tracking-[0.14em] uppercase text-white/35">
              Coming soon — Partner access
            </p>
          )}
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

        <p className="font-mono text-[0.38rem] tracking-[0.2em] uppercase text-white/[0.14] text-center mt-4">
          Origin One &middot; Back to One
        </p>

      </div>
    </div>
  )
}
