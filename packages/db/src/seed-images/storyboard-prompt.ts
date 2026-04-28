// Pure prompt assembly for storyboard generation. No Prisma, no Supabase,
// no filesystem. The future in-app route imports this module unchanged.
//
// Recipe (from spec §3): tone primer + scene context + shot framing +
// shot description + style suffix.

import type { SceneSeedRow } from '../seed-data/scenes'
import type { ShotSeedRow, ShotSize } from '../seed-data/shots'

const STYLE_SUFFIX =
  'pencil storyboard sketch, loose ink lines, monochrome graphite, ' +
  'hand-drawn, single panel, no text or numbers in the frame.'

export function humanizeShotSize(size: ShotSize | undefined): string | null {
  if (!size) return null
  switch (size) {
    case 'extreme_close_up': return 'extreme close-up'
    case 'close_up':         return 'close-up'
    case 'medium_close_up':  return 'medium close-up'
    case 'medium':           return 'medium shot'
    case 'wide':             return 'wide shot'
    case 'full':             return 'full shot'
    case 'insert':           return 'insert shot'
  }
  // Note: ShotSize is the Prisma enum, which may include values our
  // seed data doesn't currently use (e.g. extreme_wide). If a new value
  // shows up here, return the raw enum string rather than throwing —
  // we'd rather generate a slightly off prompt than crash the fetch.
  return String(size).replace(/_/g, ' ')
}

export type BuildStoryboardPromptArgs = {
  shot: ShotSeedRow
  scene: SceneSeedRow
  tonePrimer: string
}

export function buildStoryboardPrompt(args: BuildStoryboardPromptArgs): string {
  const { shot, scene, tonePrimer } = args
  const framing = humanizeShotSize(shot.size)

  const lines: string[] = []
  lines.push(tonePrimer)
  lines.push('')
  lines.push(`Scene context: ${scene.description}`)
  lines.push('')
  if (framing) {
    lines.push(`Shot framing: ${framing}.`)
    lines.push('')
  }
  lines.push(`Action: ${shot.description}`)
  lines.push('')
  lines.push(`Style: ${STYLE_SUFFIX}`)
  return lines.join('\n')
}
