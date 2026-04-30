const LIMIT = 140

export function buildExcerpt(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= LIMIT) return cleaned
  const lastSpace = cleaned.lastIndexOf(' ', LIMIT)
  const cut = lastSpace > 0 ? lastSpace : LIMIT
  return cleaned.slice(0, cut) + '…'
}
