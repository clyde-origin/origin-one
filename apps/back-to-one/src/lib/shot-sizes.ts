// Single source of truth for the ShotSize enum + display labels.
// Mirrors `enum ShotSize` in packages/db/prisma/schema.prisma exactly —
// any drift here produces "invalid input value for enum" 500s on save.
//
// Keep both arrays' values in lockstep with the schema. If a new size
// ever lands in the schema (e.g. cinema-style two-shot), add it here in
// the same PR and update consumers (NewShotSheet pills, ShotDetailSheet
// pills, hub badges).

export type ShotSize =
  | 'extreme_wide'
  | 'wide'
  | 'full'
  | 'medium'
  | 'medium_close_up'
  | 'close_up'
  | 'extreme_close_up'
  | 'insert'

export const SHOT_SIZE_OPTIONS: { value: ShotSize; label: string }[] = [
  { value: 'extreme_wide',     label: 'Extreme Wide' },
  { value: 'wide',             label: 'Wide' },
  { value: 'full',             label: 'Full' },
  { value: 'medium',           label: 'Medium' },
  { value: 'medium_close_up',  label: 'Med Close-Up' },
  { value: 'close_up',         label: 'Close-Up' },
  { value: 'extreme_close_up', label: 'Extreme CU' },
  { value: 'insert',           label: 'Insert' },
]

// Compact badge display for tight surfaces (Hub strips, Shotlist row).
// Includes a passthrough so legacy values render as-is until cleaned up.
export const SHOT_SIZE_ABBREV: Record<string, string> = {
  extreme_wide:     'EWS',
  wide:             'WIDE',
  full:             'FS',
  medium:           'MED',
  medium_close_up:  'MCU',
  close_up:         'CU',
  extreme_close_up: 'ECU',
  insert:           'INS',
}
