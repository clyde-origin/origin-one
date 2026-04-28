// Scene metadata for all six seeded projects, in the same shape as the
// arguments to prisma.scene.create. Imported by prisma/seed.ts (which
// supplies the projectId at insert time) and by seed-images/shot-entries.ts
// (which uses sceneNumber + description to build storyboard prompts).

import type { SeedProjectKey } from '../seed-images/paths'

export type SceneSeedRow = {
  sceneNumber: string
  title: string
  sortOrder: number
  description: string
}

export const SCENES: Record<SeedProjectKey, SceneSeedRow[]> = {
  p1: [
    { sceneNumber: '01', title: 'The Ritual', sortOrder: 1, description: 'Bathroom. Marble surfaces, soft window light. The beginning of the day and the product.' },
    { sceneNumber: '02', title: 'The Light',  sortOrder: 2, description: 'Estate garden. Dappled shade, old stone. The exterior world as an extension of the interior one.' },
    { sceneNumber: '03', title: 'The Mirror', sortOrder: 3, description: 'Main salon. A full-length mirror. The final image of the film and the thesis of the campaign.' },
  ],
  p2: [
    { sceneNumber: '01', title: 'The Drop', sortOrder: 1, description: 'Surfing. First light. The wave is the commitment. Malibu Point.' },
    { sceneNumber: '02', title: 'The Edge', sortOrder: 2, description: 'Trail run at the ridge. City lights below. The edge between dark and light. Griffith Park Ridge.' },
    { sceneNumber: '03', title: 'The Send', sortOrder: 3, description: "Urban concrete. The trick that either works or doesn't. DTLA Memorial Skatepark." },
  ],
  p3: [
    { sceneNumber: '01', title: 'The Vine', sortOrder: 1, description: 'Morning arrival. Walking the rows. The land as context for everything that follows. Oakville Estate.' },
    { sceneNumber: '02', title: 'The Dark', sortOrder: 2, description: 'Underground. Barrels. The cellar as a place where honesty happens naturally. St. Helena.' },
    { sceneNumber: '03', title: 'The Road', sortOrder: 3, description: 'The conversation that only happens inside a moving car. The valley unrolling outside the windows.' },
  ],
  p4: [
    { sceneNumber: '01', title: 'The Welcome',  sortOrder: 1, description: 'Kaia introduces the episode. Direct to camera. Warm, specific, unhurried.' },
    { sceneNumber: '02', title: 'The Practice', sortOrder: 2, description: 'The full floor sequence. Tadasana through Vrksasana. Both cameras rolling. The unbroken instruction.' },
    { sceneNumber: '03', title: 'The Ground',   sortOrder: 3, description: 'Taking the practice outside. Feet in grass. The same pose, different earth. Will Rogers State Park.' },
  ],
  p5: [
    { sceneNumber: '01', title: 'The Problem', sortOrder: 1, description: 'Stock-driven. Ocean, weather, data. Setting the scale of the world the product addresses. 0:00-0:45.' },
    { sceneNumber: '02', title: 'The System',  sortOrder: 2, description: "Introducing Meridian's platform. How it unifies the signal into a single readable picture. 0:45-1:30." },
    { sceneNumber: '03', title: 'The Signal',  sortOrder: 3, description: 'Resolution. The world legible. The brand and the call to action. 1:30-2:00.' },
  ],
  p6: [
    { sceneNumber: '01', title: 'Apogee — Eli',   sortOrder: 1, description: 'Eli alone. The farthest point. The silence before anything begins. Desert Flats, Mojave.' },
    { sceneNumber: '02', title: 'The Edge — Mara', sortOrder: 2, description: "Mara at the ravine edge. Her version of the same solitude. Mirror to Scene 1. Malibu Creek." },
    { sceneNumber: '03', title: 'Collision',        sortOrder: 3, description: 'The meeting. Stars above. Two threads becoming one. The weave. Joshua Tree. Call time 7PM.' },
  ],
}
