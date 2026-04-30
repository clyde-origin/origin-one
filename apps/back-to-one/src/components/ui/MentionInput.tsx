'use client'

import { useRef, useState, useMemo, useCallback } from 'react'
import { findMentionAtCursor } from '@/lib/mentions/regex'
import { initials } from '@/lib/utils/formatting'
import type { MentionRosterEntry } from '@/lib/mentions/types'

// Local copy of the chat picker's hash-to-HSL color helper. The original lives
// inline in apps/back-to-one/src/app/projects/[projectId]/chat/page.tsx and is
// removed by the chat-integration task when this component replaces it.
function stableColor(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h)
  return `hsl(${((h % 360) + 360) % 360}, 55%, 55%)`
}

export interface MentionInputProps {
  value: string
  mentions: string[]
  onChange: (text: string, mentions: string[]) => void
  multiline?: boolean
  roster: MentionRosterEntry[]
  placeholder?: string
  accent?: string
  onSubmit?: () => void
  className?: string
}

const MAX_PICKER_ROWS = 8

export function MentionInput({
  value, mentions, onChange, multiline = false, roster,
  placeholder, accent = '#6470f3', onSubmit, className,
}: MentionInputProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const [cursor, setCursor] = useState(0)
  const [hoveredIdx, setHoveredIdx] = useState(0)

  const query = findMentionAtCursor(value, cursor)
  const pickerOpen = query !== null

  const filtered = useMemo(() => {
    if (!pickerOpen) return []
    if (query === '') {
      return [...roster]
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, MAX_PICKER_ROWS)
    }
    const q = query.toLowerCase()
    return roster
      .filter((r) => r.name.toLowerCase().includes(q))
      .slice(0, MAX_PICKER_ROWS)
  }, [pickerOpen, query, roster])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(e.target.value, mentions)
    setCursor(e.target.selectionStart ?? e.target.value.length)
    setHoveredIdx(0)
  }

  const pick = useCallback((entry: MentionRosterEntry) => {
    const head = value.slice(0, cursor)
    const tail = value.slice(cursor)
    const newHead = head.replace(/@([A-Za-z][A-Za-z'\- ]*)?$/, `@${entry.name} `)
    const newText = newHead + tail
    const newMentions = [...mentions, entry.userId]
    onChange(newText, newMentions)
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      const pos = newHead.length
      el.setSelectionRange(pos, pos)
      setCursor(pos)
    })
  }, [value, cursor, mentions, onChange])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (pickerOpen && filtered.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHoveredIdx((i) => Math.min(i + 1, filtered.length - 1)); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setHoveredIdx((i) => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter')     { e.preventDefault(); pick(filtered[hoveredIdx]); return }
      if (e.key === 'Escape')    { e.preventDefault(); setCursor(-1); return }
    }
    if (!multiline && e.key === 'Enter' && !e.shiftKey && onSubmit) {
      e.preventDefault()
      onSubmit()
    }
  }

  const handleSelect = (e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setCursor(e.currentTarget.selectionStart ?? 0)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'transparent', border: 'none', outline: 'none',
    fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#fff',
    resize: multiline ? 'vertical' : 'none',
  }

  return (
    <div style={{ position: 'relative', width: '100%' }} className={className}>
      {pickerOpen && filtered.length > 0 && (
        <div
          role="listbox"
          style={{
            position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 8,
            background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, overflow: 'hidden', zIndex: 30,
          }}
        >
          {filtered.map((entry, i) => {
            const c = stableColor(entry.name)
            return (
              <div
                key={entry.userId}
                role="option"
                aria-selected={i === hoveredIdx}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseDown={(e) => { e.preventDefault(); pick(entry) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', cursor: 'pointer',
                  background: i === hoveredIdx ? 'rgba(255,255,255,0.06)' : 'transparent',
                  borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: `${c}22`, border: `1px solid ${c}44`, color: c,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700,
                }}>
                  {initials(entry.name)}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{entry.name}</span>
                {entry.role && (
                  <span style={{
                    marginLeft: 'auto', fontFamily: "'Geist Mono', monospace",
                    fontSize: 9, color: 'rgba(255,255,255,0.3)',
                    letterSpacing: '0.05em', textTransform: 'uppercase',
                  }}>
                    {entry.role}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={handleSelect}
          placeholder={placeholder}
          style={{ ...inputStyle, minHeight: 60 }}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={handleSelect}
          placeholder={placeholder}
          style={inputStyle}
        />
      )}
    </div>
  )
}
