// Derives storyboard entries from the seed-data tables. Each entry
// contains everything the fetch CLI needs to build a prompt and write
// the output file — without touching the database.

import { SCENES, type SceneSeedRow } from '../seed-data/scenes'
import { SHOTS, type ShotSeedRow } from '../seed-data/shots'
import { PROJECT_META } from './tone-primers'
import type { SeedProjectKey } from './paths'

export type StoryboardEntry = {
  projectKey: SeedProjectKey
  scene: SceneSeedRow
  shot: ShotSeedRow
  tonePrimer: string
  aspectRatio: string  // raw Project.aspectRatio (e.g. '16:9', '2.39:1')
  // localFilePath = `storyboard/<projectKey>/<sceneNumber>-<shotNumber>.jpg`
  // (relative to seed-images/files/)
  localRelativePath: string
}

export function listStoryboardEntries(): StoryboardEntry[] {
  const out: StoryboardEntry[] = []
  for (const projectKey of Object.keys(SCENES) as SeedProjectKey[]) {
    const meta = PROJECT_META[projectKey]
    for (const scene of SCENES[projectKey]) {
      const shotRows = SHOTS[projectKey][scene.sceneNumber] ?? []
      for (const shot of shotRows) {
        out.push({
          projectKey,
          scene,
          shot,
          tonePrimer: meta.primer,
          aspectRatio: meta.aspectRatio,
          localRelativePath: `storyboard/${projectKey}/${scene.sceneNumber}-${shot.shotNumber}.jpg`,
        })
      }
    }
  }
  return out
}
