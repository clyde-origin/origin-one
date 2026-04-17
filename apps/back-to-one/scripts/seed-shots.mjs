import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Parse .env.local manually
const envFile = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
const env = {}
for (const line of envFile.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx > 0) env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1)
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const now = new Date().toISOString()

// ── Step 1: Ensure versions exist ─────────────────────────

const PROJECTS = [
  { id: 'proj-drifting-001', label: 'v2' },
  { id: 'proj-lumina-001', label: 'v1' },
  { id: 'proj-freehand-001', label: 'v1' },
]

async function ensureVersions() {
  const versions = {}
  for (const proj of PROJECTS) {
    // Check if version exists
    const { data: existing } = await supabase
      .from('sm_versions')
      .select('id')
      .eq('project_id', proj.id)
      .limit(1)

    if (existing && existing.length > 0) {
      versions[proj.id] = existing[0].id
      console.log(`Version exists for ${proj.id}: ${existing[0].id}`)
    } else {
      const vId = genId()
      const { error } = await supabase
        .from('sm_versions')
        .insert({ id: vId, project_id: proj.id, label: proj.label, is_current: true, created_at: now })
      if (error) { console.error(`Failed to create version for ${proj.id}:`, error); continue }
      versions[proj.id] = vId
      console.log(`Created version for ${proj.id}: ${vId}`)
    }
  }
  return versions
}

// ── Step 2: Ensure scenes exist ───────────────────────────

const SCENES = {
  'proj-drifting-001': {
    num: 12,
    heading: 'EXT. RAVINE EDGE — DUSK',
    action: ['Lohm stands at the edge of the ravine, silhouetted against the dying light. Below, Aleph watches from a narrow ledge. The wind picks up. Neither speaks.'],
    dialogue: [{ char: 'LOHM', line: '(barely audible) I can see the bottom.' }],
  },
  'proj-lumina-001': {
    num: 1,
    heading: 'INT. STUDIO A — DAY',
    action: ['Bright, controlled light fills the studio. A sleek product sits center frame on a white surface. A MODEL enters from frame left, moving with deliberate grace toward the display.'],
    dialogue: [],
  },
  'proj-freehand-001': {
    num: 3,
    heading: 'EXT. DTLA WALL — GOLDEN HOUR',
    action: ['A massive blank wall catches the last warm light of the day. An ARTIST stands before it, spray cans at the ready. A small crowd has begun to gather on the sidewalk across the street.'],
    dialogue: [],
  },
}

async function ensureScenes(versions) {
  const scenes = {}
  for (const [projId, sceneData] of Object.entries(SCENES)) {
    const vId = versions[projId]
    if (!vId) continue

    const { data: existing } = await supabase
      .from('sm_scenes')
      .select('id')
      .eq('version_id', vId)
      .eq('num', sceneData.num)
      .limit(1)

    if (existing && existing.length > 0) {
      scenes[projId] = existing[0].id
      console.log(`Scene exists for ${projId}: ${existing[0].id}`)
    } else {
      const sId = genId()
      const { error } = await supabase
        .from('sm_scenes')
        .insert({
          id: sId, project_id: projId, version_id: vId,
          num: sceneData.num, heading: sceneData.heading,
          action: sceneData.action,
          dialogue: sceneData.dialogue.length > 0 ? sceneData.dialogue : [],
          action2: [], dialogue2: [], action3: [], dialogue3: [], action4: [],
          created_at: now,
        })
      if (error) { console.error(`Failed to create scene for ${projId}:`, error); continue }
      scenes[projId] = sId
      console.log(`Created scene for ${projId}: ${sId}`)
    }
  }
  return scenes
}

// ── Step 3: Insert shots ──────────────────────────────────

const SHOTS = {
  'proj-drifting-001': [
    { id: '12A', storyOrder: 1, shootOrder: 7, desc: 'Lohm at ravine edge, wind in hair', framing: 'CU', lens: '85mm', movement: 'Static' },
    { id: '12B', storyOrder: 2, shootOrder: 4, desc: 'Aleph watching from ledge below', framing: 'MS', lens: '50mm', movement: 'Static' },
    { id: '12C', storyOrder: 3, shootOrder: 5, desc: 'Wide — two figures, last light', framing: 'WS', lens: '24mm', movement: 'Slow push' },
    { id: '12D', storyOrder: 4, shootOrder: 1, desc: "Lohm's hands at sides, trembling", framing: 'ECU', lens: '100mm', movement: 'Static' },
    { id: '12E', storyOrder: 5, shootOrder: 2, desc: 'Aleph begins to climb toward edge', framing: 'MS', lens: '50mm', movement: 'Pan follow' },
    { id: '12F', storyOrder: 6, shootOrder: 3, desc: 'POV — looking down into ravine', framing: 'POV', lens: '24mm', movement: 'Handheld' },
    { id: '12G', storyOrder: 7, shootOrder: 6, desc: 'Lohm turns away from the edge', framing: 'MCU', lens: '85mm', movement: 'Static' },
    { id: '12H', storyOrder: 8, shootOrder: 8, desc: 'Reaction — Aleph stops climbing', framing: 'CU', lens: '85mm', movement: 'Static' },
    { id: '12I', storyOrder: 9, shootOrder: 9, desc: 'Two shot — facing each other, ridge bg', framing: 'MS', lens: '35mm', movement: 'Slow pull' },
    { id: '12J', storyOrder: 10, shootOrder: 10, desc: 'Final wide — dusk light fades', framing: 'WS', lens: '24mm', movement: 'Static' },
  ],
  'proj-lumina-001': [
    { id: '1A', storyOrder: 1, shootOrder: 1, desc: 'Product hero shot — table surface', framing: 'ECU', lens: '100mm', movement: 'Static' },
    { id: '1B', storyOrder: 2, shootOrder: 2, desc: 'Model enters frame left', framing: 'WS', lens: '35mm', movement: 'Static' },
    { id: '1C', storyOrder: 3, shootOrder: 3, desc: 'Close on hands interacting with product', framing: 'CU', lens: '85mm', movement: 'Static' },
    { id: '1D', storyOrder: 4, shootOrder: 4, desc: 'Over shoulder — model examining product', framing: 'OTS', lens: '50mm', movement: 'Static' },
    { id: '1E', storyOrder: 5, shootOrder: 5, desc: 'Low angle — product against window light', framing: 'CU', lens: '85mm', movement: 'Slow push' },
    { id: '1F', storyOrder: 6, shootOrder: 6, desc: 'Wide — full studio environment', framing: 'WS', lens: '24mm', movement: 'Static' },
    { id: '1G', storyOrder: 7, shootOrder: 7, desc: 'Tracking shot — model crosses frame', framing: 'MS', lens: '35mm', movement: 'Dolly' },
    { id: '1H', storyOrder: 8, shootOrder: 8, desc: 'Insert — product detail, logo', framing: 'ECU', lens: '100mm', movement: 'Static' },
    { id: '1I', storyOrder: 9, shootOrder: 9, desc: 'Two shot — model and director reviewing', framing: 'MS', lens: '50mm', movement: 'Static' },
    { id: '1J', storyOrder: 10, shootOrder: 10, desc: 'Final hero — product in spotlight', framing: 'CU', lens: '85mm', movement: 'Slow pull' },
  ],
  'proj-freehand-001': [
    { id: '3A', storyOrder: 1, shootOrder: 1, desc: 'Establish — artist facing the wall', framing: 'WS', lens: '24mm', movement: 'Static' },
    { id: '3B', storyOrder: 2, shootOrder: 2, desc: 'Close on spray can, first stroke', framing: 'CU', lens: '85mm', movement: 'Static' },
    { id: '3C', storyOrder: 3, shootOrder: 3, desc: 'Artist steps back, surveys work', framing: 'MS', lens: '50mm', movement: 'Handheld' },
    { id: '3D', storyOrder: 4, shootOrder: 4, desc: 'Time lapse anchor frame — mural emerging', framing: 'WS', lens: '24mm', movement: 'Static' },
    { id: '3E', storyOrder: 5, shootOrder: 5, desc: 'Interview insert — artist talking', framing: 'MCU', lens: '85mm', movement: 'Static' },
    { id: '3F', storyOrder: 6, shootOrder: 6, desc: 'Detail — paint layers, texture', framing: 'ECU', lens: '100mm', movement: 'Static' },
    { id: '3G', storyOrder: 7, shootOrder: 7, desc: 'Wide — crowd gathering to watch', framing: 'WS', lens: '24mm', movement: 'Slow pull' },
    { id: '3H', storyOrder: 8, shootOrder: 8, desc: 'Artist reaction — steps back, smiles', framing: 'CU', lens: '85mm', movement: 'Static' },
    { id: '3I', storyOrder: 9, shootOrder: 9, desc: 'Drone POV anchor — full wall reveal', framing: 'WS', lens: '24mm', movement: 'Static' },
    { id: '3J', storyOrder: 10, shootOrder: 10, desc: 'Final — artist signs the mural', framing: 'CU', lens: '85mm', movement: 'Static' },
  ],
}

async function insertShots(versions, scenes) {
  for (const [projId, shotList] of Object.entries(SHOTS)) {
    const vId = versions[projId]
    const sceneId = scenes[projId]
    if (!vId || !sceneId) { console.log(`Skipping shots for ${projId} — missing version or scene`); continue }

    // Delete existing shots for this version first
    const { error: delErr } = await supabase
      .from('sm_shots')
      .delete()
      .eq('version_id', vId)
    if (delErr) console.warn(`Warning deleting old shots for ${projId}:`, delErr.message)

    const rows = shotList.map(s => ({
      id: s.id,
      project_id: projId,
      version_id: vId,
      scene_id: sceneId,
      story_order: s.storyOrder,
      shoot_order: s.shootOrder,
      description: s.desc,
      framing: s.framing,
      movement: s.movement,
      lens: s.lens,
      dir_notes: '',
      prod_notes: '',
      elements: [],
      images: [],
      status: 'planned',
      created_at: now,
      updated_at: now,
    }))

    const { error } = await supabase.from('sm_shots').insert(rows)
    if (error) {
      console.error(`Failed to insert shots for ${projId}:`, error)
    } else {
      console.log(`Inserted ${rows.length} shots for ${projId}`)
    }
  }
}

// ── Run ───────────────────────────────────────────────────

async function main() {
  console.log('Seeding shot data...\n')
  const versions = await ensureVersions()
  const scenes = await ensureScenes(versions)
  await insertShots(versions, scenes)
  console.log('\nDone!')
}

main().catch(e => { console.error(e); process.exit(1) })
