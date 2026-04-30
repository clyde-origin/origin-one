// A "name" is: leading letter, then letters / apostrophes / hyphens / single
// internal spaces. Each space-separated component must start with a capital letter
// to be treated as part of the name (proper name components).
const MENTION_BODY = "[A-Z][A-Za-z'\\-]*(?: [A-Z][A-Za-z'\\-]*)*"

const AT_CURSOR_RE = new RegExp(`(?:^|\\s)@(${MENTION_BODY})?$`)
const TOKEN_RE = new RegExp(`(?:^|\\s)@(${MENTION_BODY})`, 'g')

export function findMentionAtCursor(text: string, cursorPos: number): string | null {
  const head = text.slice(0, cursorPos)
  const m = head.match(AT_CURSOR_RE)
  if (!m) return null
  return m[1] ?? ''
}

export interface MentionToken {
  start: number
  end: number
  name: string
}

export function tokenizeMentions(text: string): MentionToken[] {
  const out: MentionToken[] = []
  for (const m of text.matchAll(TOKEN_RE)) {
    const matchStart = m.index ?? 0
    const atOffset = m[0].indexOf('@')
    const start = matchStart + atOffset
    const name = m[1]
    // For multi-word names, include trailing space in the span boundary
    const hasSpace = name.includes(' ')
    const end = start + 1 + name.length + (hasSpace ? 1 : 0)
    out.push({ start, end, name })
  }
  return out
}
