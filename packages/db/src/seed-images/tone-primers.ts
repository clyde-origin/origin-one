import type { ProjectKey } from './paths'

export type ProjectMeta = {
  primer: string
  aspectRatio: string  // '16:9', '2.39:1', etc. Read by both the seed
                       // (Project.aspectRatio backfill) and the storyboard
                       // fetcher (briaAspect mapping).
}

// Each primer is ~80 words of *atmosphere* — light, materials, mood. The fetch
// script prepends the relevant primer to every AI prompt for that project so
// "amber serum bottle on marble" inherits "soft window light, glycerin droplets,
// editorial restraint" without re-stating it on every entry.
export const PROJECT_META: Record<Exclude<ProjectKey, 'crew'>, ProjectMeta> = {
  p1: { aspectRatio: '16:9', primer: `Project: Lumière Skincare commercial — "Simple Skin Promo".
Atmosphere: unhurried morning luxury. Soft window light through frosted glass.
Calacatta marble, brushed brass, amber glass, glycerin-clean droplets.
Skin as topography, not as catalog. Restraint over excess. Editorial beauty
photography, magazine reference, never advertorial. Color: cream, ivory, brass,
deep amber. Lens: medium, shallow. Mood: attention as luxury.` },

  p2: { aspectRatio: '16:9', primer: `Project: Vanta camera commercial — "Full Send".
Atmosphere: kinetic, sweat-real, sport-magazine. Pre-dawn or golden hour, never
noon. Salt, dust, chalk, friction, lived-in gear. Athletes captured in
commitment moments — drop-in, send, exhale. Hard light, motion blur acceptable.
Color: salt-faded blacks, ocean greys, dust orange, sky cobalt. Lens: telephoto
for action, wide for environment. Mood: presence under pressure.` },

  p3: { aspectRatio: '16:9', primer: `Project: Napa Collective documentary — "In Vino Veritas".
Atmosphere: terroir documentary, slow earth time. Golden hour vineyards,
weathered hands, oak barrels in low light. Material: dust, vine, cork, stone,
oxidized iron. Honest portraiture — winemakers in their element, no styling.
Color: oxblood, burgundy, ochre, dried-leaf brown. Lens: 35mm or 50mm,
naturalistic. Mood: patient making, generational craft.` },

  p4: { aspectRatio: '16:9', primer: `Project: Kaia Mori educational series — "Flexibility Course A".
Atmosphere: studio cyclorama, controlled warm light. Yoga and movement —
clean lines, calm bodies, no distraction. Material: matte studio floor,
wool blocks, cotton straps, bare skin. Direct-to-camera energy: warm, specific,
unhurried. Color: dove grey, sand, terracotta, deep moss. Lens: medium,
even exposure, soft shadows. Mood: instructional intimacy.` },

  p5: { aspectRatio: '16:9', primer: `Project: Meridian Climate branded film — "Natural Order".
Atmosphere: stock-driven climate visuals — ocean, weather, satellite, data
overlay. Scale and consequence, not panic. Material: water surface, cloud
formations, ice, machined metal sensors. Color: deep blue, glacial white,
storm grey, copper instrument. Lens: wide environmental, occasional macro for
detail. Mood: scale rendered legible.` },

  p6: { aspectRatio: '2.39:1', primer: `Project: B Story narrative film — "The Weave".
Atmosphere: cinematic narrative, three intercut storylines (desert, urban, coastal).
Mojave flats at apogee — silence, scale, isolation. Material varies by storyline:
sun-bleached wood, cracked asphalt, kelp wet stone. Performances over plot beats.
Color: dust orange, bone white, neon teal (urban), kelp green (coastal). Lens:
anamorphic feel, 2.39:1 framing in mind. Mood: parallel lives, single weather.` },
}

export function tonePrimer(projectKey: ProjectKey): string {
  if (projectKey === 'crew') {
    return `Editorial environmental portrait, natural light, neutral background, professional crew aesthetic. Real-feeling, never glossy or stocky.`
  }
  return PROJECT_META[projectKey].primer
}

export function projectAspectRatio(projectKey: Exclude<ProjectKey, 'crew'>): string {
  return PROJECT_META[projectKey].aspectRatio
}
