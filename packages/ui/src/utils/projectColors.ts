// ══════════════════════════════════════════════════════════
// ORIGIN ONE — PROJECT COLOR DERIVATION
// Derives 11 semantic tokens from a single project hex.
// Verbatim from reference/one-arc-color-system.html.
// ══════════════════════════════════════════════════════════

export interface ProjectColors {
  primary: string
  sceneTitle: string
  sceneNum: string
  surface: string
  gradient: string
  tabUnderline: string
  avatarBg: string
  avatarText: string
  dateOverdue: string
  cardLabel: string
  checkBorder: string
}

export function hexToHsl(hex: string): [number, number, number] {
  let r = parseInt(hex.slice(1, 3), 16) / 255
  let g = parseInt(hex.slice(3, 5), 16) / 255
  let b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0, l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

export function deriveProjectColors(hex: string): ProjectColors {
  const [h, s, l] = hexToHsl(hex)
  const ws = Math.max(s, 55)
  const wl = Math.min(Math.max(l, 45), 65)
  return {
    primary:      hslToHex(h, ws, wl),
    sceneTitle:   hslToHex(h + 150, Math.max(ws - 5, 50), wl + 5),
    sceneNum:     hslToHex(h + 210, Math.max(ws - 10, 45), wl + 8),
    surface:      hex + '17',
    gradient:     hex + '1F',
    tabUnderline: hslToHex(h, ws, wl),
    avatarBg:     hex + '33',
    avatarText:   hslToHex(h, ws, Math.min(wl + 20, 85)),
    dateOverdue:  hslToHex(h + 150, ws, wl + 5),
    cardLabel:    hslToHex(h + 210, Math.max(ws - 10, 45), wl + 8),
    checkBorder:  hslToHex(h, ws, wl),
  }
}

/** Default fallback when project.color is null/undefined */
export const DEFAULT_PROJECT_HEX = '#6B7280'
