import { Fragment } from 'react'
import { tokenizeMentions } from '@/lib/mentions/regex'

export interface MentionTextProps {
  text: string
  accent?: string
  className?: string
}

export function MentionText({ text, accent = '#6470f3', className }: MentionTextProps) {
  const tokens = tokenizeMentions(text)
  if (tokens.length === 0) return <span className={className}>{text}</span>

  const out: React.ReactNode[] = []
  let cursor = 0
  tokens.forEach((tok, i) => {
    if (tok.start > cursor) out.push(<Fragment key={`t${i}`}>{text.slice(cursor, tok.start)}</Fragment>)
    out.push(
      <span
        key={`m${i}`}
        style={{
          color: accent,
          background: `${accent}22`,
          padding: '1px 6px',
          borderRadius: 6,
          fontWeight: 600,
        }}
      >
        @{tok.name}
      </span>,
    )
    cursor = tok.end
  })
  if (cursor < text.length) out.push(<Fragment key="tail">{text.slice(cursor)}</Fragment>)
  return <span className={className}>{out}</span>
}
