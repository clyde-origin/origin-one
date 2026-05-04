// Entity type colors + helpers — lifted out of EntityDrawer so casting and
// locations pages can reference them without pulling the heavy drawer module
// into their initial chunks. See `EntityDrawer.tsx` for the consumer side.

// ── Entity type colors (from reference spec) ────────────
export const ENTITY_COLORS = {
  characters: { base: '#67E8F9', bg: 'rgba(103,232,249,0.13)', border: 'rgba(103,232,249,0.28)', bgLight: 'rgba(103,232,249,0.1)' },
  locations:  { base: '#A78BFA', bg: 'rgba(167,139,250,0.13)', border: 'rgba(167,139,250,0.28)', bgLight: 'rgba(167,139,250,0.1)' },
  props:      { base: '#FCD34D', bg: 'rgba(252,211,77,0.10)',   border: 'rgba(252,211,77,0.22)',  bgLight: 'rgba(252,211,77,0.08)' },
} as const

export type EntityType = 'characters' | 'locations' | 'props'

export interface EntityItem {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
}

export function getEntityInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}
