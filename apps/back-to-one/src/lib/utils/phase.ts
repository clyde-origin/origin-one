import type { ProjectStatus, MilestoneStatus } from '@/types'

// ── STATUS-BASED LOOKUPS (new schema) ───────────────────

export const STATUS_HEX: Record<string, string> = {
  development:     '#e8a020',
  pre_production:  '#e8a020',
  production:      '#6470f3',
  post_production: '#00b894',
  archived:        '#62627a',
}

export const STATUS_LABELS: Record<string, string> = {
  development:     'Development',
  pre_production:  'Pre-Production',
  production:      'Production',
  post_production: 'Post-Production',
  archived:        'Archived',
}

export const STATUS_LABELS_SHORT: Record<string, string> = {
  development:     'Dev',
  pre_production:  'Pre-Prod',
  production:      'Production',
  post_production: 'Post-Prod',
  archived:        'Archived',
}

export const STATUS_DOT: Record<string, string> = {
  development:     'bg-pre',
  pre_production:  'bg-pre',
  production:      'bg-prod',
  post_production: 'bg-post',
  archived:        'bg-muted',
}

export const STATUS_TEXT: Record<string, string> = {
  development:     'text-pre',
  pre_production:  'text-pre',
  production:      'text-prod',
  post_production: 'text-post',
  archived:        'text-muted',
}

export const MILESTONE_STATUS_HEX: Record<string, string> = {
  upcoming:    '#e8a020',
  in_progress: '#6470f3',
  completed:   '#00b894',
}

export const MILESTONE_STATUS_LABEL: Record<string, string> = {
  upcoming:    'Upcoming',
  in_progress: 'In Progress',
  completed:   'Completed',
}

// Keep Phase type for backwards compat in components that haven't migrated yet
export type Phase = 'pre' | 'prod' | 'post'

export const PHASE_HEX: Record<string, string> = {
  pre: '#e8a020', prod: '#6470f3', post: '#00b894',
  ...STATUS_HEX,
}

export const PHASE_LABELS: Record<string, string> = {
  pre: 'Pre', prod: 'Prod', post: 'Post',
}

export const PHASE_LABELS_LONG: Record<string, string> = {
  pre: 'In Pre-Production', prod: 'In Production', post: 'In Post-Production',
  ...STATUS_LABELS,
}

export const PHASE_LABELS_MID: Record<string, string> = {
  pre: 'Pre-prod', prod: 'Production', post: 'Post-prod',
  ...STATUS_LABELS_SHORT,
}

export const PHASE_DOT: Record<string, string> = {
  pre: 'bg-pre', prod: 'bg-prod', post: 'bg-post',
  ...STATUS_DOT,
}

export const PHASE_TEXT: Record<string, string> = {
  pre: 'text-pre', prod: 'text-prod', post: 'text-post',
  ...STATUS_TEXT,
}

export const PHASE_COLORS: Record<string, string> = {
  pre: 'text-pre', prod: 'text-prod', post: 'text-post',
  ...STATUS_TEXT,
}

export const PHASE_BG: Record<string, string> = {
  pre: 'bg-pre/10', prod: 'bg-prod/10', post: 'bg-post/10',
}

export function statusHex(status: string | undefined): string {
  return STATUS_HEX[status ?? ''] ?? '#62627a'
}

export function statusLabel(status: string | undefined): string {
  return STATUS_LABELS[status ?? ''] ?? status ?? ''
}

export const DEPT_COLORS: Record<string, string> = {
  Direction: '#9b6de0',  // purple
  Production: '#6470f3', // blue
  Camera: '#3eb8a8',     // teal
  Sound: '#e8a020',      // amber
  Art: '#e87060',        // coral
  Wardrobe: '#d96aac',   // pink
  HMU: '#e0708a',        // rose/warm pink
  Post: '#00b894',       // green
  Other: '#62627a',      // gray
  // Legacy aliases
  'G&E': '#3eb8a8', Casting: '#e87060', Client: '#6470f3',
}

export const DEPT_SHORT: Record<string, string> = {
  Direction: 'Dir', Production: 'Prod', Camera: 'Cam', Sound: 'Sound',
  Art: 'Art', Wardrobe: 'Ward', HMU: 'HMU', Post: 'Post', Other: 'Other',
}

export const DEPT_CLASSES: Record<string, string> = {
  Production: 'text-prod bg-prod/10', Direction: 'text-prod bg-prod/10',
  Camera: 'text-prod bg-prod/10', 'G&E': 'text-prod bg-prod/10',
  Art: 'text-pre bg-pre/10', Wardrobe: 'text-pre bg-pre/10',
  HMU: 'text-pre bg-pre/10', Casting: 'text-pre bg-pre/10',
  Sound: 'text-post bg-post/10', Post: 'text-post bg-post/10',
  Client: 'text-prod bg-prod/10', Other: 'text-muted bg-surface2',
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const months = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[date.getMonth()]} ${date.getDate()}`
}

export function isUrgent(dateStr: string): boolean {
  const diff = Math.ceil(
    (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
  return diff >= 0 && diff <= 5
}

export function isLate(dateStr: string): boolean {
  return new Date(dateStr) < new Date()
}

export const DEPARTMENTS = [
  'Production', 'Direction', 'Camera', 'G&E', 'Sound',
  'Art', 'Wardrobe', 'HMU', 'Casting', 'Post', 'Client', 'Other',
] as const

export type Department = typeof DEPARTMENTS[number]

export const DEPT_PHASE: Record<string, string> = {
  Production: 'prod', Direction: 'prod',
  Camera: 'prod', 'G&E': 'prod',
  Art: 'pre', Wardrobe: 'pre', HMU: 'pre', Casting: 'pre',
  Sound: 'post', Post: 'post',
  Client: 'prod', Other: 'prod',
}

// ── PROJECT ACCENT COLORS ────────────────────────────────

export const PROJECT_COLORS = [
  // Original 9
  '#c45adc', // Violet
  '#e8564a', // Crimson
  '#4ab8e8', // Sky
  '#e8c44a', // Gold
  '#e87a4a', // Ember
  '#4ae8a0', // Mint
  '#e84a9a', // Rose
  '#7ae84a', // Lime
  '#4a6ae8', // Cobalt
  // New 9
  '#a06ae8', // Lavender
  '#c87848', // Rust
  '#4ad8c8', // Teal
  '#e8b06a', // Peach
  '#e840b8', // Fuchsia
  '#c0e84a', // Chartreuse
  '#5a8ae8', // Steel
  '#e8d87a', // Sand
  '#e8a0c0', // Blush
]

export const PROJECT_COLOR_NAMES = [
  'Violet', 'Crimson', 'Sky', 'Gold', 'Ember', 'Mint', 'Rose', 'Lime', 'Cobalt',
  'Lavender', 'Rust', 'Teal', 'Peach', 'Fuchsia', 'Chartreuse', 'Steel', 'Sand', 'Blush',
]

export function getProjectColor(projectId: string): string {
  let hash = 0
  for (let i = 0; i < projectId.length; i++) {
    hash = projectId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length]
}

// ── SCENE COLOR SYSTEM — TEMPERATURE SHIFT ─────────────
// Early scenes: warm amber #e8a020
// Mid scenes: orange-rose #e87060
// Late scenes: cool violet #c45adc

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b] as const
}

function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('')
}

const SCENE_WARM   = hexToRgb('#e8a020') // amber
const SCENE_MID    = hexToRgb('#e87060') // orange-rose
const SCENE_COOL   = hexToRgb('#c45adc') // violet

function lerpColor(a: readonly [number, number, number], b: readonly [number, number, number], t: number) {
  return rgbToHex(
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  )
}

/**
 * Returns a temperature-shift color for a scene number.
 * Interpolates #e8a020 → #e87060 → #c45adc across total scene count.
 */
export function getSceneColor(sceneNumber: number, totalScenes: number): string {
  if (totalScenes <= 1) return rgbToHex(...SCENE_WARM)
  const t = (sceneNumber - 1) / (totalScenes - 1) // 0..1
  if (t <= 0.5) {
    return lerpColor(SCENE_WARM, SCENE_MID, t * 2)
  }
  return lerpColor(SCENE_MID, SCENE_COOL, (t - 0.5) * 2)
}

export function goldenSpiralPath(cx: number, cy: number, maxR: number, turns = 2.5, steps = 300): string {
  const PHI = 1.6180339887
  const b = Math.log(PHI) / (Math.PI / 2)
  const thetaMax = turns * 2 * Math.PI
  const a = maxR / Math.exp(b * thetaMax)
  let d = ''
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * thetaMax
    const r = a * Math.exp(b * theta)
    const angle = theta - Math.PI * 0.5
    const x = cx + r * Math.cos(angle)
    const y = cy + r * Math.sin(angle)
    d += i === 0 ? `M${x.toFixed(2)},${y.toFixed(2)}` : `L${x.toFixed(2)},${y.toFixed(2)}`
  }
  return d
}
