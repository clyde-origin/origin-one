// Convert a Project.aspectRatio string ('16:9', '2.39:1', etc.) to the
// CSS aspect-ratio property value ('16 / 9', '2.39 / 1', ...). Centralizes
// the conversion + null/malformed handling so render sites don't reimplement.

export function aspectRatioToCss(ratio: string | null | undefined): string {
  if (!ratio) return '16 / 9'
  const parts = ratio.split(':')
  if (parts.length !== 2) return '16 / 9'
  const [w, h] = parts
  if (!w || !h) return '16 / 9'
  const wn = Number(w), hn = Number(h)
  if (!Number.isFinite(wn) || !Number.isFinite(hn) || wn <= 0 || hn <= 0) return '16 / 9'
  return `${w} / ${h}`
}
