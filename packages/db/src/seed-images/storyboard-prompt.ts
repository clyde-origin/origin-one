// Pure prompt assembly for storyboard generation. No Prisma, no Supabase,
// no filesystem. The future in-app route imports this module unchanged.
//
// Recipe v2 (after the P1 visual gate showed inconsistent style):
//   - Lead with the medium/style so it anchors before subject content.
//   - Skip the project tone primer (its photography/color terms were
//     overriding the sketch directive on ~half of P1 frames).
//   - Repeat the style as a "render as" tail.

import type { SceneSeedRow } from '../seed-data/scenes'
import type { ShotSeedRow, ShotSize } from '../seed-data/shots'

const STYLE_LEAD =
  'A black-and-white pencil storyboard sketch, loose ink lines, monochrome ' +
  'graphite, hand-drawn, single panel. Not a photograph. Not photorealistic. ' +
  'No color. Storyboard concept frame, like a director\'s board.'

const STYLE_TAIL =
  'Render as a pencil and ink storyboard sketch — black and white only, ' +
  'no color, no photographic realism.'

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
  return String(size).replace(/_/g, ' ')
}

export type BuildStoryboardPromptArgs = {
  shot: ShotSeedRow
  scene: SceneSeedRow
}

export function buildStoryboardPrompt(args: BuildStoryboardPromptArgs): string {
  const { shot, scene } = args
  const framing = humanizeShotSize(shot.size)

  const lines: string[] = []
  lines.push(STYLE_LEAD)
  lines.push('')
  lines.push(`Scene: ${scene.description}`)
  lines.push('')
  if (framing) {
    lines.push(`Framing: ${framing}.`)
    lines.push('')
  }
  lines.push(`Action: ${shot.description}`)
  lines.push('')
  lines.push(STYLE_TAIL)
  return lines.join('\n')
}
