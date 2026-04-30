// Single source of truth for the ShotSize enum + display labels.
// Mirrors `enum ShotSize` in packages/db/prisma/schema.prisma exactly —
// any drift here produces "invalid input value for enum" 500s on save.
//
// `full` is in the schema enum (2 prod shots reference it) but intentionally
// omitted from SHOT_SIZE_OPTIONS — it isn't surfaced as a new selection.
// SHOT_SIZE_ABBREV still includes it so historical rows render their badge.

export type ShotSize =
  | 'extreme_wide'
  | 'wide'
  | 'cowboy'
  | 'full'
  | 'medium'
  | 'two_shot'
  | 'over_the_shoulder'
  | 'medium_close_up'
  | 'close_up'
  | 'extreme_close_up'
  | 'insert'

// UI options — order is the producer-friendly framing scale: widest to
// tightest, with two-shot / OTS slotted between Medium and MCU. Labels are
// short and pill-readable; full label appears in the badge map below.
export const SHOT_SIZE_OPTIONS: { value: ShotSize; label: string }[] = [
  { value: 'extreme_wide',      label: 'X-Wide' },
  { value: 'wide',              label: 'Wide' },
  { value: 'cowboy',            label: 'Cowboy' },
  { value: 'medium',            label: 'Med' },
  { value: 'two_shot',          label: '2-Shot' },
  { value: 'over_the_shoulder', label: 'OTS' },
  { value: 'medium_close_up',   label: 'MCU' },
  { value: 'close_up',          label: 'CU' },
  { value: 'extreme_close_up',  label: 'ECU' },
  { value: 'insert',            label: 'INS' },
]

// Compact badge display for tight surfaces (Hub strips, Shotlist row).
// `full` retained for legacy rows; passthrough handles anything unmapped.
export const SHOT_SIZE_ABBREV: Record<string, string> = {
  extreme_wide:      'X-WIDE',
  wide:              'WIDE',
  cowboy:            'COWBOY',
  full:              'FULL',
  medium:            'MED',
  two_shot:          '2-SHOT',
  over_the_shoulder: 'OTS',
  medium_close_up:   'MCU',
  close_up:          'CU',
  extreme_close_up:  'ECU',
  insert:            'INS',
}
