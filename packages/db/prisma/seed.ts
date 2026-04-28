// packages/db/prisma/seed.ts
// Run with: pnpm db:seed
// Wipes all existing data and inserts the six Origin Point seed projects clean.

import { PrismaClient, Role } from '@prisma/client'
import { computeExpenseUnits, DEFAULT_AICP_ACCOUNTS } from '@origin-one/schema'
import { MANIFEST } from '../src/seed-images/manifest'
import { localFilePath, storagePath } from '../src/seed-images/paths'
import { uploadSeedImage, clearBucket } from '../src/seed-images/uploader'

const prisma = new PrismaClient()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emailFrom(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '.')
    + '@originpoint.com'
  )
}

const USER_NAMES = new Map<string, string>()

const DEPARTMENT_BY_NAME: Record<string, string> = {
  // Core team (always on every project)
  'Clyde Bessey': 'Direction',
  'Tyler Heckerman': 'Production',
  'Kelly Pratt': 'Production',

  // Camera (DP / AC / DIT)
  'Theo Hartmann': 'Camera',
  'Priya Nair': 'Camera',
  'Carlos Vega': 'Camera',
  'Sam Okafor': 'Camera',
  'Dani Reeves': 'Camera',
  'Owen Blakely': 'Camera',
  'Alex Drum': 'Camera',
  'Caleb Stone': 'Camera',
  'Maya Lin': 'Camera',

  // Lighting (Gaffer / Electric)
  'Rick Souza': 'Lighting',
  'Tanya Mills': 'Lighting',
  'Dario Reyes': 'Lighting',

  // G&E (Grip)
  'Derek Huang': 'G&E',
  'Luis Fernandez': 'G&E',
  'Sam Park': 'G&E',

  // Sound (Mixer / Boom)
  'Pete Larsson': 'Sound',
  'Andre Kim': 'Sound',
  'Tom Vega': 'Sound',
  'Hana Liu': 'Sound',
  'Omar Rashid': 'Sound',
  'Chris Tan': 'Sound',

  // Art (Art Director / Set Decorator / Props / Production Designer)
  'Claire Renault': 'Art',
  'Nina Osei': 'Art',
  'Brendan Walsh': 'Art',
  'Petra Walsh': 'Art',

  // Wardrobe
  'Isabel Torres': 'Wardrobe',

  // HMU
  'Jasmine Bell': 'HMU',
  'Fiona Drake': 'HMU',

  // Casting (Talent Agent treated as Casting)
  'Vera Hastings': 'Casting',

  // Post (Editor / GFX / Colorist / Sound Designer)
  'Rafi Torres': 'Post',
  'Cleo Strand': 'Post',

  // Production (AD / Coordinator / PA)
  'James Calloway': 'Production',
  'Mia Chen': 'Production',
  'Tyler Green': 'Production',
  'Ryan Cole': 'Production',
  'Tyler Moss': 'Production',
  'Rina Cole': 'Production',
  'Tyler Reed': 'Production',
  'Sofia Avila': 'Production',

  // Direction (Script Supervisor / Writer)
  'Dana Vance': 'Direction',

  // Client
  'Lena Farrow': 'Client',
  'Sarah Osei': 'Client',

  // Other — talent/subjects/athletes seeded as crew (no true department)
  'Aria Stone': 'Other',
  'Marco Silva': 'Other',
  'Zoe Park': 'Other',
  'Dev Okafor': 'Other',
  'Paul Navarro': 'Other',
  'Marcus Trent': 'Other',
  'Jin Ho': 'Other',
  'Kaia Mori': 'Other',
  'James North': 'Other',
  'Leo Marsh': 'Other',
  'Vera Koss': 'Other',
}

function departmentForUser(userId: string): string {
  const name = USER_NAMES.get(userId)
  if (!name) return 'Other'
  return DEPARTMENT_BY_NAME[name] ?? 'Other'
}

// ─── Timecard generation tables ──────────────────────────────────────────────
//
// Title + rate-tier maps used by the CrewTimecard generator further down. They
// live up here next to DEPARTMENT_BY_NAME so all crew metadata stays in one
// readable block. Demo data — a real production would derive titles and rates
// from a contract/HR system, not a hand-curated map.
//
// Derivation: titles below are inferred from
//   1. the role used in upsertCrew (director/producer/coordinator/crew),
//   2. the department in DEPARTMENT_BY_NAME (Camera, Lighting, Sound, etc.),
//   3. clues in the original 35-row timecards — descriptions like
//      "B-cam coverage", "key + fill setup", "VO booth capture" pin a name
//      to a likely title (DP / Gaffer / Sound Mixer).
// Names without a clear signal default to 'PA' via JOB_TITLE_DEFAULT.
//
// Eligibility filter (department NOT IN ('Client', 'Other')) drops 13 names
// upstream, so most 'Other'/'Client' crew never see this table.

const JOB_TITLE_BY_NAME: Record<string, string> = {
  // Direction
  'Clyde Bessey': 'Director',

  // Production (producer / coordinator / PA)
  'Tyler Heckerman': 'Producer',
  'Kelly Pratt': 'Producer',
  'Sofia Avila': 'Producer',
  'James Calloway': 'Production Coordinator',
  'Mia Chen': 'Production Coordinator',
  'Tyler Green': 'Production Coordinator',
  'Tyler Moss': 'Coordinator',
  'Ryan Cole': 'Production Coordinator',
  'Rina Cole': 'Coordinator',

  // Camera (DP / 1st AC / 2nd AC)
  'Priya Nair': 'DP',
  'Dani Reeves': 'DP',
  'Owen Blakely': 'DP',
  'Alex Drum': 'DP',
  'Caleb Stone': 'DP',
  'Theo Hartmann': '1st AC',
  'Sam Okafor': '1st AC',
  'Maya Lin': '1st AC',
  'Carlos Vega': '2nd AC',

  // Lighting
  'Tanya Mills': 'Gaffer',
  'Rick Souza': 'Gaffer',
  'Dario Reyes': 'Best Boy Electric',

  // G&E (Grip)
  'Derek Huang': 'Key Grip',
  'Luis Fernandez': 'Best Boy Grip',
  'Sam Park': 'Grip',

  // Sound (Mixer / Boom)
  'Andre Kim': 'Sound Mixer',
  'Tom Vega': 'Sound Mixer',
  'Chris Tan': 'Sound Mixer',
  'Pete Larsson': 'Sound Mixer',
  'Hana Liu': 'Boom Op',
  'Omar Rashid': 'Boom Op',

  // Art
  'Claire Renault': 'Art Director',
  'Petra Walsh': 'Art Director',
  'Nina Osei': 'Set Decorator',
  'Brendan Walsh': 'Props Master',

  // Wardrobe / HMU
  'Isabel Torres': 'Wardrobe Stylist',
  'Jasmine Bell': 'HMU Artist',
  'Fiona Drake': 'HMU Artist',

  // Casting (lone Casting-dept name) treated as Coordinator for rate purposes
  'Vera Hastings': 'Coordinator',

  // Post
  'Rafi Torres': 'Editor',
  'Cleo Strand': 'Colorist',

  // Direction-flavoured (Script Supervisor)
  'Dana Vance': 'Coordinator',
}
const JOB_TITLE_DEFAULT = 'PA'

function jobTitleForName(name: string): string {
  return JOB_TITLE_BY_NAME[name] ?? JOB_TITLE_DEFAULT
}

// Rate cards per tier. 'standard' covers branded/commercial work, 'indie'
// covers independent productions. Numbers are dollars/day. Titles missing
// from a tier table return null from rateFor() — drives the partial-rate-
// coverage realism in the generator.
const RATE_STANDARD: Record<string, number> = {
  'Director': 1000, 'Producer': 900, 'Coordinator': 600,
  'DP': 750, '1st AC': 550, '2nd AC': 400,
  'Gaffer': 650, 'Best Boy Electric': 500,
  'Key Grip': 600, 'Best Boy Grip': 475, 'Grip': 425,
  'Sound Mixer': 700, 'Boom Op': 450,
  'Art Director': 650, 'Set Decorator': 525, 'Props Master': 500,
  'Wardrobe Stylist': 550, 'HMU Artist': 500,
  'Editor': 700, 'Colorist': 750, 'GFX Artist': 650,
  'PA': 350, 'Production Coordinator': 500,
}
const RATE_INDIE: Record<string, number> = {
  'Director': 750, 'Producer': 650, 'Coordinator': 450,
  'DP': 500, '1st AC': 400, '2nd AC': 300,
  'Gaffer': 450, 'Best Boy Electric': 375,
  'Key Grip': 425, 'Best Boy Grip': 350, 'Grip': 300,
  'Sound Mixer': 475, 'Boom Op': 325,
  'Art Director': 475, 'Set Decorator': 400, 'Props Master': 375,
  'Wardrobe Stylist': 400, 'HMU Artist': 375,
  'Editor': 525, 'Colorist': 575, 'GFX Artist': 500,
  'PA': 250, 'Production Coordinator': 375,
}
type RateTier = 'standard' | 'indie'
function rateFor(jobTitle: string, tier: RateTier): number | null {
  const table = tier === 'standard' ? RATE_STANDARD : RATE_INDIE
  return table[jobTitle] ?? null
}

// Per-project rate tier. Branded/commercial jobs run standard; independent
// productions run lower indie rates.
const PROJECT_TIER: Record<string, RateTier> = {
  'Simple Skin Promo':     'standard',
  'Full Send':             'standard',
  'In Vino Veritas':       'standard',
  'Flexibility Course A':  'indie',
  'Natural Order':         'indie',
  'The Weave':             'indie',
}

// Description templates per title. Generator picks deterministically by
// (project, member, day-index) so a member's week reads varied without being
// random across re-runs of the same date.
const DESCRIPTION_TEMPLATES: Record<string, string[]> = {
  'Director': [
    'Director session: blocking and rehearsal with talent',
    'Coverage decisions on the day, scene-by-scene oneliners',
    'Edit review with cutter — notes pass on assembly',
    'Tone meeting with DP and gaffer for tomorrow',
  ],
  'Producer': [
    'Production wrap meeting, vendor payments, schedule confirms',
    'Crew calls, location locks, and cost report sync',
    'Insurance and permits review, day-of contingencies',
    'Talent agency follow-ups, deal memos out',
  ],
  'Production Coordinator': [
    'Call sheets out, crew roster reconcile, lodging confirms',
    'PO chase, payroll start packs, vendor onboarding',
    'Travel manifest and ground transport bookings',
  ],
  'Coordinator': [
    'Day-of coordination, crew ride share, runner support',
    'Continuity binder, paperwork chase across departments',
    'Talent wrangling and on-set hospitality',
  ],
  'DP': [
    'Coverage on hero scenes — wide masters and inserts',
    'Lensing tests, lighting walkthrough with gaffer',
    'Magic-hour scheduling, sun-path and exposure plan',
    'Operating A-cam, pickups and second-unit splinter',
  ],
  '1st AC': [
    'Pulling focus, lens swaps, mag loading for shoot day',
    'Camera prep — chip and check, monitors and follow-focus',
    'Slating coverage and managing camera report',
  ],
  '2nd AC': [
    'Camera report, slate, mag and battery rotation',
    'Equipment movement between setups, lens cleanings',
  ],
  'Gaffer': [
    'Key + fill setup, diffusion pass and color temp tune',
    'Blue-hour exterior lighting — practicals and bounce',
    'Pre-light for next day, generator and distro check',
  ],
  'Best Boy Electric': [
    'Cable runs, electrics rigging and load balance',
    'Generator runs, distro setup, lamp truck pulls',
  ],
  'Key Grip': [
    'Dolly and slider rigging, camera car prep',
    'Flag and cutter work, neg fill into the windows',
    'Rigging for tomorrow, scaffold and crane plan',
  ],
  'Best Boy Grip': [
    'Truck loadout, grip ordering and net build',
    'Stand work and overhead frame for the wide',
  ],
  'Grip': [
    'On-set rigging, swing/strike across scenes',
    'Apple-box wrangling, hand-held rig support',
  ],
  'Sound Mixer': [
    'Production audio, lavs and boom mix to multi-track',
    'Room tone and wild lines, sync claps with camera',
    'Cart setup and timecode jam, location ambient pre-roll',
  ],
  'Boom Op': [
    'Boom on dialogue scenes, lavs B and C',
    'Wireless management and battery rotations',
  ],
  'Art Director': [
    'Set dressing approvals, prep walk-through',
    'Continuity sweeps and color adjustments on set',
    'Vendor coordination, returns and damages walk',
  ],
  'Set Decorator': [
    'Hero set dress and detail pass on the close-ups',
    'Picture-vehicle styling and on-set adjustments',
  ],
  'Props Master': [
    'Hero prop continuity, on-set repairs and resets',
    'Action prop checks, rehearsal blocking with talent',
  ],
  'Wardrobe Stylist': [
    'Talent wardrobe continuity, set adjustments and steaming',
    'Pull returns and damages, fitting prep for next block',
  ],
  'HMU Artist': [
    'Talent makeup, beauty continuity through the day',
    'Touch-ups between takes, character looks for next scene',
  ],
  'Editor': [
    'Assembly cut, scenes 1–3 with sync audio',
    'Producer review notes pass, structural rebuild',
    'Selects and stringout, organizing dailies into bins',
  ],
  'Colorist': [
    'Dailies grade, look reference baked into proxies',
    'Final pass on scene 4, secondary skin pass',
  ],
  'GFX Artist': [
    'Title comps and lower-third design pass',
    'Cleanup VFX on hero shot, rotoscope plates',
  ],
  'PA': [
    'On-set support, runs and crafty resets',
    'Lockups during dialogue takes, traffic control',
    'Truck loadout and trash pulls between setups',
  ],
}
const FALLBACK_DESCRIPTIONS = [
  'On-set support across departments',
  'Day-of production work',
  'Setup and strike for the block',
]
function descriptionFor(jobTitle: string, salt: number): string {
  const list = DESCRIPTION_TEMPLATES[jobTitle] ?? FALLBACK_DESCRIPTIONS
  return list[salt % list.length]
}

// Tiny deterministic PRNG (mulberry32) so re-runs given the same date produce
// the same output. Seed it per-project from a simple string hash.
function strHash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function mulberry32(seed: number): () => number {
  let a = seed
  return function () {
    a = (a + 0x6D2B79F5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

async function upsertCrew(
  teamId: string,
  name: string,
  role: Role,
): Promise<{ id: string }> {
  const email = emailFrom(name)
  const user = await prisma.user.upsert({
    where:  { email },
    update: {},
    create: { email, name },
  })
  USER_NAMES.set(user.id, name)
  // Tenant model post auth-003: TeamMember = "team-tier access" (producer only).
  // Crew is ProjectMember-only; no TeamMember row.
  // Director also gets team-tier access since on this team directors produce.
  if (role === 'producer' || role === 'director') {
    await prisma.teamMember.upsert({
      where:  { teamId_userId: { teamId, userId: user.id } },
      update: {},
      create: { teamId, userId: user.id, role },
    })
  }
  return user
}

// `department` is optional: omit to fall back to DEPARTMENT_BY_NAME (one
// department per name — the original convention), pass explicitly to attach
// a different department to a same-user-different-role row (e.g. Clyde
// directing under 'Direction' AND producing under 'Production'). The
// composite unique (projectId, userId, role) is what makes multi-role
// possible; the upsert key follows it.
async function assignProjectCrew(
  projectId: string,
  userId: string,
  role: Role,
  department?: string,
): Promise<void> {
  const dept = department ?? departmentForUser(userId)
  await prisma.projectMember.upsert({
    where: { projectId_userId_role: { projectId, userId, role } },
    update: { department: dept },
    create: { projectId, userId, role, department: dept },
  })
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding — Origin Point projects...\n')

  // Anchor "today" once for the run so every relative-date helper that
  // references it stays consistent within a single seed (and the dates
  // shift forward naturally each time the seed runs).
  const TODAY = new Date()

  // ── Wipe in reverse-dependency order ──────────────────────────────────────
  await prisma.talentAssignment.deleteMany()
  await prisma.talent.deleteMany()
  await prisma.moodboardRef.deleteMany()
  await prisma.moodboardTab.deleteMany()
  await prisma.location.deleteMany()
  await prisma.actionItem.deleteMany()
  await prisma.milestonePerson.deleteMany()
  await prisma.milestone.deleteMany()
  await prisma.threadRead.deleteMany()
  await prisma.threadMessage.deleteMany()
  await prisma.thread.deleteMany()
  await prisma.entityAttachment.deleteMany()
  await prisma.propSourced.deleteMany()
  await prisma.wardrobeSourced.deleteMany()
  await prisma.crewTimecard.deleteMany()
  await prisma.inventoryItem.deleteMany()
  await prisma.projectMember.deleteMany()
  await prisma.document.deleteMany()
  await prisma.shot.deleteMany()
  await prisma.scene.deleteMany()
  await prisma.entity.deleteMany()
  await prisma.project.deleteMany()
  await prisma.teamMember.deleteMany()
  await prisma.user.deleteMany()
  await prisma.team.deleteMany()
  console.log('  Cleared\n')

  console.log('  Clearing storage buckets…')
  await clearBucket('entity-attachments')
  await clearBucket('moodboard')
  await clearBucket('avatars')
  console.log('  Buckets cleared.\n')

  // ── Team ──────────────────────────────────────────────────────────────────
  const team = await prisma.team.create({ data: { name: 'Origin Point' } })

  // ── Core team — Director and two Producers across every project ───────────
  const clydeBessey    = await upsertCrew(team.id, 'Clyde Bessey',    'director')
  const tylerHeckerman = await upsertCrew(team.id, 'Tyler Heckerman', 'producer')
  const kellyPratt     = await upsertCrew(team.id, 'Kelly Pratt',     'producer')

  // ── Cross-project post crew (Post department works across multiple jobs) ──
  const rafiTorres = await upsertCrew(team.id, 'Rafi Torres', 'crew')
  const cleoStrand = await upsertCrew(team.id, 'Cleo Strand', 'crew')

  // ══════════════════════════════════════════════════════════════════════════
  // PROJECT 1 — SIMPLE SKIN PROMO
  // Client: Lumiере Skincare  Status: Pre-Production  Shoot in 7 days
  // 3 scenes  14 shots  24 crew
  // ══════════════════════════════════════════════════════════════════════════


  const jamesCalloway = await upsertCrew(team.id, 'James Calloway', 'crew')
  const theoHartmann  = await upsertCrew(team.id, 'Theo Hartmann',  'crew')
  const priyaNair     = await upsertCrew(team.id, 'Priya Nair',     'crew')
  const carlosVega    = await upsertCrew(team.id, 'Carlos Vega',    'crew')
  const samOkafor     = await upsertCrew(team.id, 'Sam Okafor',     'crew')
  const rickSouza     = await upsertCrew(team.id, 'Rick Souza',     'crew')
  const tanyaMills    = await upsertCrew(team.id, 'Tanya Mills',    'crew')
  const derekHuang    = await upsertCrew(team.id, 'Derek Huang',    'crew')
  const luisFernandez = await upsertCrew(team.id, 'Luis Fernandez', 'crew')
  const claireRenault = await upsertCrew(team.id, 'Claire Renault', 'crew')
  const ninaOsei      = await upsertCrew(team.id, 'Nina Osei',      'crew')
  const brendanWalsh  = await upsertCrew(team.id, 'Brendan Walsh',  'crew')
  const isabelTorres  = await upsertCrew(team.id, 'Isabel Torres',  'crew')
  const jasmineBell   = await upsertCrew(team.id, 'Jasmine Bell',   'crew')
  const fionaDrake    = await upsertCrew(team.id, 'Fiona Drake',    'crew')
  const peteLarsson   = await upsertCrew(team.id, 'Pete Larsson',   'crew')
  const andreKim      = await upsertCrew(team.id, 'Andre Kim',      'crew')
  const miaChen       = await upsertCrew(team.id, 'Mia Chen',       'coordinator')
  const ariaStone     = await upsertCrew(team.id, 'Aria Stone',     'crew')
  const veraHastings  = await upsertCrew(team.id, 'Vera Hastings',  'crew')
  const lenaFarrow    = await upsertCrew(team.id, 'Lena Farrow',    'crew')

  const p1 = await prisma.project.create({
    data: { teamId: team.id, name: 'Simple Skin Promo', status: 'pre_production', client: 'Lumière Skincare', type: 'commercial', color: '#D4A847' },
  })

  const p1s1 = await prisma.scene.create({ data: {
    projectId: p1.id, sceneNumber: '01', title: 'The Ritual', sortOrder: 1,
    description: 'Bathroom. Marble surfaces, soft window light. The beginning of the day and the product.',
  }})
  await prisma.shot.createMany({ data: [
    { sceneId: p1s1.id, shotNumber: '01A', size: 'extreme_close_up', status: 'planned', sortOrder: 1, description: 'Fingers drawing a single drop from the bottle. The product in motion for the first time.' },
    { sceneId: p1s1.id, shotNumber: '01B', size: 'medium',           status: 'planned', sortOrder: 2, description: 'Aria at the mirror, unhurried. The quality of her attention. This is her morning.' },
    { sceneId: p1s1.id, shotNumber: '01C', size: 'close_up',         status: 'planned', sortOrder: 3, description: 'Light catching the cheekbone. The skin as landscape.' },
    { sceneId: p1s1.id, shotNumber: '01D', size: 'extreme_close_up', status: 'planned', sortOrder: 4, description: 'Eyes closing, then opening. Not a transformation. Recognition.' },
    { sceneId: p1s1.id, shotNumber: '01E', size: 'wide',             status: 'planned', sortOrder: 5, description: 'Full bathroom frame. The quality of the morning light. The room as a complete world.' },
  ]})

  const p1s2 = await prisma.scene.create({ data: {
    projectId: p1.id, sceneNumber: '02', title: 'The Light', sortOrder: 2,
    description: 'Estate garden. Dappled shade, old stone. The exterior world as an extension of the interior one.',
  }})
  await prisma.shot.createMany({ data: [
    { sceneId: p1s2.id, shotNumber: '02A', size: 'wide',             status: 'planned', sortOrder: 1, description: 'Garden path. Aria walking slowly toward camera through dappled light. Unhurried.' },
    { sceneId: p1s2.id, shotNumber: '02B', size: 'medium',           status: 'planned', sortOrder: 2, description: 'She pauses at a stone wall. Looks up. Not posed. Just present in the afternoon.' },
    { sceneId: p1s2.id, shotNumber: '02C', size: 'extreme_close_up', status: 'planned', sortOrder: 3, description: 'Bottle placed on stone surface. Garden softly out of focus behind. Clean beauty shot.' },
    { sceneId: p1s2.id, shotNumber: '02D', size: 'medium',           status: 'planned', sortOrder: 4, description: 'Aria moves through the garden. Dappled light across hair and skin. Camera follows slow.' },
    { sceneId: p1s2.id, shotNumber: '02E', size: 'full',             status: 'planned', sortOrder: 5, description: 'Aria faces lens. Soft. The closest we get to her. No performance. Just presence.' },
  ]})

  const p1s3 = await prisma.scene.create({ data: {
    projectId: p1.id, sceneNumber: '03', title: 'The Mirror', sortOrder: 3,
    description: 'Main salon. A full-length mirror. The final image of the film and the thesis of the campaign.',
  }})
  await prisma.shot.createMany({ data: [
    { sceneId: p1s3.id, shotNumber: '03A', size: 'medium_close_up', status: 'planned', sortOrder: 1, description: 'Aria sees herself in the full-length mirror. The moment of looking.' },
    { sceneId: p1s3.id, shotNumber: '03B', size: 'medium',          status: 'planned', sortOrder: 2, description: 'What she sees: herself, whole. The reflection is the point.' },
    { sceneId: p1s3.id, shotNumber: '03C', size: 'medium_close_up', status: 'planned', sortOrder: 3, description: 'Pushing slowly into her reflected face. The film ending in recognition.' },
    { sceneId: p1s3.id, shotNumber: '03D', size: 'insert',          status: 'planned', sortOrder: 4, description: 'Title card. Product name, tagline. Fade to black. Clean.' },
  ]})

  await prisma.entity.createMany({ data: [
    { projectId: p1.id, type: 'location',  name: 'Bel Air Estate', description: 'Private estate, Bel Air CA. Three shooting areas: bathroom, garden, salon.' },
    { projectId: p1.id, type: 'prop',      name: 'Lumiere Serum',  description: 'Hero product. Small amber bottle. On camera in scenes 1 and 2.' },
  ]})
  const p1Hero = await prisma.entity.create({ data: { projectId: p1.id, type: 'character', name: 'Hero Talent',      description: 'Face of the brand. Primary on-camera.' } })
  const p1Sec  = await prisma.entity.create({ data: { projectId: p1.id, type: 'character', name: 'Secondary Talent', description: 'Lifestyle, background/supporting.' } })

  // P1 — Talent
  const p1tCamille  = await prisma.talent.create({ data: { projectId: p1.id, name: 'Camille Rousseau', role: 'Lead Actor' } })
  const p1tDanielle = await prisma.talent.create({ data: { projectId: p1.id, name: 'Danielle Park',    role: 'Supporting' } })
  await prisma.talentAssignment.createMany({ data: [
    { talentId: p1tCamille.id,  entityId: p1Hero.id },
    { talentId: p1tDanielle.id, entityId: p1Sec.id },
  ]})

  // P1 — Art (props, wardrobe, hmu)
  await prisma.entity.createMany({ data: [
    { projectId: p1.id, type: 'prop',     name: 'Skincare Product Hero Set', description: 'Full Lumière lineup — serum, moisturizer, cleanser. Arranged on marble.', metadata: { status: 'confirmed' } },
    { projectId: p1.id, type: 'prop',     name: 'Vanity Mirror',             description: 'Circular brass vanity mirror. Catches light in bathroom scene.',       metadata: { status: 'confirmed' } },
    { projectId: p1.id, type: 'prop',     name: 'Marble Surface Tiles',      description: 'Calacatta marble tiles for tabletop product shots.',                  metadata: { status: 'confirmed' } },
    { projectId: p1.id, type: 'wardrobe', name: 'Hero — Clean White/Cream',  description: 'Luxury silk robe, cream camisole. Effortless morning look.',           metadata: { status: 'confirmed' } },
    { projectId: p1.id, type: 'wardrobe', name: 'Secondary — Soft Neutrals', description: 'Linen blouse, taupe trousers. Lifestyle/garden scene.',                metadata: { status: 'confirmed' } },
    { projectId: p1.id, type: 'hmu',      name: 'Hero — Flawless Dewy',      description: 'Dewy skin focus, luminous finish. Highlight cheekbones and brow bone.', metadata: { status: 'confirmed' } },
    { projectId: p1.id, type: 'hmu',      name: 'Secondary — Fresh Natural', description: 'Minimal base, natural lip, soft brows. Supporting, not competing.',    metadata: { status: 'confirmed' } },
  ]})

  await prisma.document.create({ data: {
    projectId: p1.id, type: 'script', version: 1, createdBy: clydeBessey.id,
    title: 'Simple Skin Promo — :60 Hero Spot',
    content: `SIMPLE SKIN PROMO
Lumiere Skincare. Director: Clyde Bessey. Draft 1, Apr 8.
:60 Hero Spot + Cutdowns.

SCENE 1 — INT. BATHROOM — DAWN

The room before the day begins. Marble. Morning light through frosted glass. Silence.

A HAND enters frame. Fingers close around a small amber bottle — LUMIERE SERUM. A single drop is drawn out, held between fingertips in the early light.

CLOSE ON: A FACE at the mirror. No performance. Just a woman at the beginning of her day, present with herself. She touches her cheek. The light finds the skin.

Her eyes close. They open. Something recognized. Not new — always there.

[No dialogue. Hold the image. Let it breathe.]

---

SCENE 2 — EXT. ESTATE GARDEN — SOFT AFTERNOON

The garden as an extension of the interior world. Stone paths. Old light through old trees. Dappled and slow.

ARIA moves through it — not walking toward anything. Walking through, the way you move when you belong somewhere completely.

She pauses at a stone wall. Looks up. The afternoon finds her exactly where she is.

CLOSE ON: The LUMIERE bottle resting on stone. Simple. Present. At home here.

She turns to the lens. Not posed. Just there.

[No dialogue. The garden is enough.]

---

SCENE 3 — INT. MAIN SALON — LATE AFTERNOON

The formal room. Long shadows stretching across marble. At the far end — a full-length mirror.

She walks toward it. Stops. She looks. Her reflection looks back.

PUSH SLOWLY INTO the glass — her face in the reflection filling the frame until there is nothing else.

Not transformed. Not corrected. Recognized.

LUMIERE. "You were always this."

FADE TO BLACK.`,
  }})

  console.log('  P1: Simple Skin Promo — 3 scenes, 14 shots, 24 crew')

  // P1 — ProjectMembers (24 crew)
  // Role mapping: director→director, producer→producer, coordinator→coordinator, crew→crew
  await assignProjectCrew(p1.id, clydeBessey.id,    'director')
  await assignProjectCrew(p1.id, clydeBessey.id,    'producer', 'Production')
  await assignProjectCrew(p1.id, tylerHeckerman.id, 'producer')
  await assignProjectCrew(p1.id, kellyPratt.id,     'producer')
  await assignProjectCrew(p1.id, jamesCalloway.id, 'coordinator')
  await assignProjectCrew(p1.id, theoHartmann.id,  'crew')
  await assignProjectCrew(p1.id, priyaNair.id,     'crew')
  await assignProjectCrew(p1.id, carlosVega.id,    'crew')
  await assignProjectCrew(p1.id, samOkafor.id,     'crew')
  await assignProjectCrew(p1.id, rickSouza.id,     'crew')
  await assignProjectCrew(p1.id, tanyaMills.id,    'crew')
  await assignProjectCrew(p1.id, derekHuang.id,    'crew')
  await assignProjectCrew(p1.id, luisFernandez.id, 'crew')
  await assignProjectCrew(p1.id, claireRenault.id, 'crew')
  await assignProjectCrew(p1.id, ninaOsei.id,      'crew')
  await assignProjectCrew(p1.id, brendanWalsh.id,  'crew')
  await assignProjectCrew(p1.id, isabelTorres.id,  'crew')
  await assignProjectCrew(p1.id, jasmineBell.id,   'crew')
  await assignProjectCrew(p1.id, fionaDrake.id,    'crew')
  await assignProjectCrew(p1.id, peteLarsson.id,   'crew')
  await assignProjectCrew(p1.id, andreKim.id,      'crew')
  await assignProjectCrew(p1.id, miaChen.id,       'coordinator')
  await assignProjectCrew(p1.id, ariaStone.id,     'crew')
  await assignProjectCrew(p1.id, veraHastings.id,  'crew')
  await assignProjectCrew(p1.id, lenaFarrow.id,    'crew')
  await assignProjectCrew(p1.id, rafiTorres.id,    'crew')
  await assignProjectCrew(p1.id, cleoStrand.id,    'crew')

  // P1 — Milestones (13)
  await prisma.milestone.createMany({ data: [
    { projectId: p1.id, title: 'Creative brief approved',                    date: new Date('2026-04-04'), status: 'completed' },
    { projectId: p1.id, title: 'Director and DP attached',                   date: new Date('2026-04-05'), status: 'completed' },
    { projectId: p1.id, title: 'Talent confirmed — Aria Stone',              date: new Date('2026-04-08'), status: 'completed' },
    { projectId: p1.id, title: 'Location shortlist submitted to client',     date: new Date('2026-04-07'), status: 'completed' },
    { projectId: p1.id, title: 'Location scout walk-through — Bel Air estate', date: new Date('2026-04-12'), status: 'in_progress' },
    { projectId: p1.id, title: 'Tech scout with all department heads',       date: new Date('2026-04-13'), status: 'upcoming' },
    { projectId: p1.id, title: 'All department heads locked and confirmed',  date: new Date('2026-04-14'), status: 'upcoming' },
    { projectId: p1.id, title: 'Call sheet v1 issued to full crew',          date: new Date('2026-04-16'), status: 'upcoming' },
    { projectId: p1.id, title: 'Shoot Day — Bel Air Estate',                 date: new Date('2026-04-17'), status: 'upcoming' },
    { projectId: p1.id, title: 'Selects to client for approval',             date: new Date('2026-04-20'), status: 'upcoming' },
    { projectId: p1.id, title: 'Rough cut v1 delivered',                     date: new Date('2026-04-24'), status: 'upcoming' },
    { projectId: p1.id, title: 'Client review — round 1',                   date: new Date('2026-04-26'), status: 'upcoming' },
    { projectId: p1.id, title: 'Final delivery — all cuts + formats',        date: new Date('2026-05-03'), status: 'upcoming' },
  ]})

  // P1 — Action Items (12)
  await prisma.actionItem.createMany({ data: [
    { projectId: p1.id, title: 'Confirm estate permit + production insurance',  assignedTo: tylerHeckerman.id, dueDate: new Date('2026-04-12'), status: 'in_progress' },
    { projectId: p1.id, title: "Issue talent rider to Aria's team",             assignedTo: veraHastings.id,  dueDate: new Date('2026-04-12'), status: 'open' },
    { projectId: p1.id, title: 'Compile department head contact sheet',         assignedTo: miaChen.id,       dueDate: new Date('2026-04-12'), status: 'in_progress' },
    { projectId: p1.id, title: "Create shot list from director's boards",       assignedTo: theoHartmann.id,  dueDate: new Date('2026-04-13'), status: 'in_progress' },
    { projectId: p1.id, title: 'Submit art department breakdown',               assignedTo: claireRenault.id, dueDate: new Date('2026-04-13'), status: 'open' },
    { projectId: p1.id, title: 'Tech scout attendance confirmed — all depts',   assignedTo: jamesCalloway.id, dueDate: new Date('2026-04-13'), status: 'done' },
    { projectId: p1.id, title: 'Confirm hair + MUA kit lists and prep day',     assignedTo: jasmineBell.id,   dueDate: new Date('2026-04-13'), status: 'open' },
    { projectId: p1.id, title: 'Book production trucks and basecamp',           assignedTo: tylerHeckerman.id, dueDate: new Date('2026-04-13'), status: 'open' },
    { projectId: p1.id, title: 'Submit catering order — 50 person count',       assignedTo: miaChen.id,       dueDate: new Date('2026-04-14'), status: 'open' },
    { projectId: p1.id, title: 'Draft call sheet v1',                           assignedTo: jamesCalloway.id, dueDate: new Date('2026-04-15'), status: 'open' },
    { projectId: p1.id, title: 'Talent pickup and transport logistics',         assignedTo: kellyPratt.id,    dueDate: new Date('2026-04-15'), status: 'open' },
    { projectId: p1.id, title: 'Insurance certificate delivered to estate owner', assignedTo: tylerHeckerman.id, dueDate: new Date('2026-04-12'), status: 'in_progress' },
  ]})

  // P1 — Locations (3 confirmed + 2 lifecycle examples)
  const p1EntBelAir = await prisma.entity.findFirst({ where: { projectId: p1.id, type: 'location', name: 'Bel Air Estate' } })
  await prisma.location.createMany({ data: [
    {
      projectId: p1.id,
      entityId: p1EntBelAir?.id ?? null,
      name: 'Villa Serena — Bel Air Estate',
      description: 'Mediterranean-revival estate with infinity pool, marble terraces, and golden hour light through floor-to-ceiling windows. Hero location for the talent walk-through and product reveal.',
      address: '1240 Bel Air Rd, Los Angeles, CA 90077',
      keyContact: 'Patricia Hahn — Estate Rep — (310) 555-0188',
      shootDates: 'Apr 14–15',
      status: 'confirmed',
      approved: true,
      notes: 'Load-in via service entrance on Copa de Oro. 20-amp circuits in east wing only — bring distro. Pool must be camera-ready by 6am call.',
      sortOrder: 0,
    },
    {
      projectId: p1.id,
      name: 'Milk Studios — Stage 3',
      description: 'Controlled studio environment for product close-ups, beauty lighting setups, and packshot photography. White cyc with overhead rig.',
      address: '1200 E 8th St, Los Angeles, CA 90021',
      keyContact: 'Studio bookings — (213) 555-0230',
      shootDates: 'Apr 16',
      status: 'confirmed',
      approved: true,
      notes: '12-hour hold confirmed. Makeup and talent holding in Suite B. Product samples arrive morning of.',
      sortOrder: 1,
    },
    {
      projectId: p1.id,
      name: 'Greystone Mansion Gardens',
      description: 'Formal English garden with stone pergola and hedgerows. Secondary outdoor coverage for lifestyle B-roll — soft, editorial, natural light.',
      address: '905 Loma Vista Dr, Beverly Hills, CA 90210',
      keyContact: 'Beverly Hills Rec & Parks — (310) 555-0145',
      shootDates: 'Apr 17',
      status: 'in_talks',
      approved: false,
      notes: 'Film permit application submitted. $2,500/day fee. No vehicles past the gate — grip carts only. Rain date TBD.',
      sortOrder: 2,
    },
    // Lifecycle examples — scouting alternative + passed, paired to Bel Air Estate entity
    {
      projectId: p1.id,
      entityId: p1EntBelAir?.id ?? null,
      name: 'Holmby Hills Villa (Option)',
      description: 'Secondary candidate for Bel Air Estate scenes. Mediterranean aesthetic, smaller footprint but available mid-week.',
      address: 'Holmby Hills, Los Angeles (exact address withheld)',
      keyContact: 'Scout referral — Patricia Hahn',
      shootDates: 'TBD',
      status: 'scouting',
      approved: false,
      notes: 'Walk-through scheduled Apr 13. Rate negotiable if we can move our dates.',
      sortOrder: 3,
    },
    {
      projectId: p1.id,
      entityId: p1EntBelAir?.id ?? null,
      name: 'Pasadena Craftsman Estate (Passed)',
      description: 'Scouted early — architecture was wrong for the brand tone. Too warm, too specific.',
      address: 'Pasadena, CA',
      keyContact: 'Owner — declined to negotiate',
      shootDates: 'n/a',
      status: 'passed',
      approved: false,
      notes: 'Passed Apr 6. Architecture mismatch. Kept on file as reference for future projects.',
      sortOrder: 4,
    },
  ]})

  // P1 — Workflow nodes (6). Rafi Torres (offline/online) not in P1 crew — assignee null, flagged.
  const p1wn1 = await prisma.workflowNode.create({ data: { projectId: p1.id, label: 'Camera Ingest',   type: 'ingest',   software: 'DaVinci Resolve',  assigneeId: theoHartmann.id, notes: 'RAW R3D from RED Komodo, proxies to ProRes 422 Proxy', sortOrder: 0 }})
  const p1wn2 = await prisma.workflowNode.create({ data: { projectId: p1.id, label: 'Offline Edit',    type: 'edit',     software: 'Premiere Pro',     assigneeId: rafiTorres.id,   notes: 'Selects-driven cut, :60 and cutdowns simultaneous',     sortOrder: 1 }})
  const p1wn3 = await prisma.workflowNode.create({ data: { projectId: p1.id, label: 'Color Grade',     type: 'color',    software: 'DaVinci Resolve',  assigneeId: null,            notes: 'Warm, skin-forward. Reference frames from director',    sortOrder: 2 }})
  const p1wn4 = await prisma.workflowNode.create({ data: { projectId: p1.id, label: 'Sound Design',    type: 'sound',    software: 'Pro Tools',        assigneeId: null,            notes: 'ASMR product texture + subtle room tone',               sortOrder: 3 }})
  const p1wn5 = await prisma.workflowNode.create({ data: { projectId: p1.id, label: 'Online / Conform',type: 'edit',     software: 'Premiere Pro',     assigneeId: rafiTorres.id,   notes: '',                                                       sortOrder: 4 }})
  const p1wn6 = await prisma.workflowNode.create({ data: { projectId: p1.id, label: 'Final Delivery',  type: 'delivery', software: 'Compressor',       assigneeId: miaChen.id,      notes: '',                                                       sortOrder: 5 }})

  // P1 — Workflow edges (5)
  await prisma.workflowEdge.createMany({ data: [
    { projectId: p1.id, sourceId: p1wn1.id, targetId: p1wn2.id, inputFormat: 'RAW R3D',                outputFormat: 'ProRes 422 Proxy',     format: 'Proxy' },
    { projectId: p1.id, sourceId: p1wn2.id, targetId: p1wn3.id, inputFormat: 'ProRes 422 Proxy',       outputFormat: 'ProRes 4444 XQ',       format: 'Conform' },
    { projectId: p1.id, sourceId: p1wn3.id, targetId: p1wn4.id, inputFormat: 'ProRes 4444',            outputFormat: 'ProRes 4444',          format: 'Reference mix' },
    { projectId: p1.id, sourceId: p1wn4.id, targetId: p1wn5.id, inputFormat: 'Stems + ProRes 4444',    outputFormat: 'ProRes 4444 XQ',       format: 'AAF + Picture' },
    { projectId: p1.id, sourceId: p1wn5.id, targetId: p1wn6.id, inputFormat: 'ProRes 4444 XQ',         outputFormat: 'H.264 + ProRes',       format: 'Master + Web' },
  ]})

  // P1 — Deliverables (4)
  await prisma.deliverable.createMany({ data: [
    { projectId: p1.id, title: 'Main Cut :60', length: '01:00', format: 'H.264', aspectRatio: '16:9', resolution: '3840x2160', colorSpace: 'Rec.709', soundSpecs: 'Stereo -14 LUFS', sortOrder: 0 },
    { projectId: p1.id, title: ':30 Cutdown',  length: '00:30', format: 'H.264', aspectRatio: '16:9', resolution: '1920x1080', colorSpace: 'Rec.709', soundSpecs: 'Stereo -14 LUFS', sortOrder: 1 },
    { projectId: p1.id, title: ':15 Cutdown',  length: '00:15', format: 'H.264', aspectRatio: '16:9', resolution: '1920x1080', colorSpace: 'Rec.709', soundSpecs: 'Stereo -14 LUFS', sortOrder: 2 },
    { projectId: p1.id, title: '9:16 Social',  length: '00:30', format: 'H.264', aspectRatio: '9:16', resolution: '1080x1920', colorSpace: 'Rec.709', soundSpecs: 'Stereo -14 LUFS', sortOrder: 3 },
  ]})

  // P1 — Moodboard (1 tab, 5 refs)
  const p1mbTab = await prisma.moodboardTab.create({ data: { projectId: p1.id, name: 'Tone & Light', sortOrder: 0 }})
  await prisma.moodboardRef.createMany({ data: [
    { projectId: p1.id, tabId: p1mbTab.id, title: 'Morning Ritual',         cat: 'tone',    note: 'The unhurried quality. Not luxury as excess — luxury as attention.', sortOrder: 0 },
    { projectId: p1.id, tabId: p1mbTab.id, title: 'Bathroom Light Study',   cat: 'visual',  note: 'Soft window light through frosted glass. White marble reflecting warm.', sortOrder: 1 },
    { projectId: p1.id, tabId: p1mbTab.id, title: 'Skin as Landscape',      cat: 'visual',  note: 'Textural close-ups. Not cosmetic — topographic.',                       sortOrder: 2 },
    { projectId: p1.id, tabId: p1mbTab.id, title: 'Hero Product Beauty',    cat: 'product', note: 'Amber bottle on marble. Backlit. Glycerin water drops.',                sortOrder: 3 },
    { projectId: p1.id, tabId: p1mbTab.id, title: 'Ambient Reference',      cat: 'music',   note: 'Nils Frahm — Says. Soft piano, breath-adjacent.',                       sortOrder: 4 },
  ]})

  // ══════════════════════════════════════════════════════════════════════════
  // PROJECT 2 — FULL SEND
  // Client: Vanta  Status: Production  Day 2 of 3  Run-and-gun
  // 3 scenes  15 shots  7 crew
  // ══════════════════════════════════════════════════════════════════════════

  const daniReeves  = await upsertCrew(team.id, 'Dani Reeves', 'crew')
  const tylerGreen  = await upsertCrew(team.id, 'Tyler Green', 'crew')
  const marcoSilva  = await upsertCrew(team.id, 'Marco Silva', 'crew')
  const zoePark     = await upsertCrew(team.id, 'Zoe Park',    'crew')
  const devOkafor   = await upsertCrew(team.id, 'Dev Okafor',  'crew')

  const p2 = await prisma.project.create({
    data: { teamId: team.id, name: 'Full Send', status: 'production', client: 'Vanta', type: 'commercial', color: '#E84225' },
  })

  // Scene 01 — The Drop. EXT. Dawn. Malibu Point. DONE.
  const p2s1 = await prisma.scene.create({ data: {
    projectId: p2.id, sceneNumber: '01', title: 'The Drop', sortOrder: 1,
    description: 'Surfing. First light. The wave is the commitment. Malibu Point.',
  }})
  await prisma.shot.createMany({ data: [
    { sceneId: p2s1.id, shotNumber: '01A',                           status: 'completed', sortOrder: 1, description: 'Vanta unit on board nose. Ocean POV paddling out. Water rushing past lens.' },
    { sceneId: p2s1.id, shotNumber: '01B', size: 'wide',            status: 'completed', sortOrder: 2, description: 'Drone. Marco drops into a set wave from above. The full scale of the commitment.' },
    { sceneId: p2s1.id, shotNumber: '01C', size: 'wide',            status: 'completed', sortOrder: 3, description: 'Camera at break level. Board cutting directly past lens. Speed and spray.' },
    { sceneId: p2s1.id, shotNumber: '01D', size: 'extreme_close_up',status: 'completed', sortOrder: 4, description: "Marco's face mid-ride. Eyes locked ahead. Total presence." },
    { sceneId: p2s1.id, shotNumber: '01E', size: 'wide',            status: 'completed', sortOrder: 5, description: 'Post-wave. Board flat. Water settling around Marco. The exhale after the send.' },
  ]})

  // Scene 02 — The Edge. EXT. Pre-Dawn. Griffith Ridge. SHOOTING TODAY.
  const p2s2 = await prisma.scene.create({ data: {
    projectId: p2.id, sceneNumber: '02', title: 'The Edge', sortOrder: 2,
    description: 'Trail run at the ridge. City lights below. The edge between dark and light. Griffith Park Ridge.',
  }})
  await prisma.shot.createMany({ data: [
    { sceneId: p2s2.id, shotNumber: '02A',                          status: 'in_progress', sortOrder: 1, description: 'Zoe running the ridge. City glow below, dawn sky above. The world as backdrop.' },
    { sceneId: p2s2.id, shotNumber: '02B', size: 'wide',            status: 'in_progress', sortOrder: 2, description: 'Camera low on trail surface. Feet pounding past directly over lens.' },
    { sceneId: p2s2.id, shotNumber: '02C', size: 'wide',            status: 'in_progress', sortOrder: 3, description: 'Drone tracking Zoe along the ridge. Drop visible on one side. Pure commitment.' },
    { sceneId: p2s2.id, shotNumber: '02D',                          status: 'in_progress', sortOrder: 4, description: 'Vanta helmet-mounted. POV of the path ahead. Breathing audible. Just the run.' },
    { sceneId: p2s2.id, shotNumber: '02E', size: 'wide',            status: 'in_progress', sortOrder: 5, description: 'Zoe crests the hill. Stops. Looks out over the city. Breathing hard. First light arrives.' },
  ]})

  // Scene 03 — The Send. EXT. Afternoon. DTLA Skatepark. TOMORROW.
  const p2s3 = await prisma.scene.create({ data: {
    projectId: p2.id, sceneNumber: '03', title: 'The Send', sortOrder: 3,
    description: "Urban concrete. The trick that either works or doesn't. DTLA Memorial Skatepark.",
  }})
  await prisma.shot.createMany({ data: [
    { sceneId: p2s3.id, shotNumber: '03A', size: 'wide',            status: 'planned', sortOrder: 1, description: 'Camera flat on concrete. Dev rolling toward lens. The texture of the approach.' },
    { sceneId: p2s3.id, shotNumber: '03B',                          status: 'planned', sortOrder: 2, description: 'Vanta mounted to helmet. POV of the approach to the drop. The decision point.' },
    { sceneId: p2s3.id, shotNumber: '03C', size: 'wide',            status: 'planned', sortOrder: 3, description: 'Full ramp in frame. Dev launches. The full send, held in a single wide shot.' },
    { sceneId: p2s3.id, shotNumber: '03D', size: 'extreme_close_up',status: 'planned', sortOrder: 4, description: "Dev's face mid-air. The full send moment. High-speed camera if available." },
    { sceneId: p2s3.id, shotNumber: '03E', size: 'insert',          status: 'planned', sortOrder: 5, description: 'Vanta unit held up to lens. Post-send grin. Tag card over black.' },
  ]})

  await prisma.entity.createMany({ data: [
    { projectId: p2.id, type: 'location',  name: 'Malibu Point',           description: 'Dawn surf location. Day 1 — completed.' },
    { projectId: p2.id, type: 'location',  name: 'Griffith Park Ridge',    description: 'Pre-dawn trail run location. Day 2 — shooting today.' },
    { projectId: p2.id, type: 'location',  name: 'DTLA Memorial Skatepark',description: 'Afternoon skate location. Day 3 — tomorrow.' },
  ]})
  const p2Skater  = await prisma.entity.create({ data: { projectId: p2.id, type: 'character', name: 'The Skater',  description: 'Urban, technical. Sport 1.' } })
  const p2Climber = await prisma.entity.create({ data: { projectId: p2.id, type: 'character', name: 'The Climber', description: 'Outdoor, vertical. Sport 2.' } })
  const p2Surfer  = await prisma.entity.create({ data: { projectId: p2.id, type: 'character', name: 'The Surfer',  description: 'Coastal, fluid. Sport 3.' } })

  // P2 — Talent
  const p2tDex   = await prisma.talent.create({ data: { projectId: p2.id, name: 'Dex Morales',   role: 'Lead Actor' } })
  const p2tAmara = await prisma.talent.create({ data: { projectId: p2.id, name: 'Amara Singh',   role: 'Lead Actor' } })
  const p2tKai   = await prisma.talent.create({ data: { projectId: p2.id, name: 'Kai Nakamura',  role: 'Lead Actor' } })
  await prisma.talentAssignment.createMany({ data: [
    { talentId: p2tDex.id,   entityId: p2Skater.id },
    { talentId: p2tAmara.id, entityId: p2Climber.id },
    { talentId: p2tKai.id,   entityId: p2Surfer.id },
  ]})

  // P2 — Art (props, wardrobe, hmu)
  await prisma.entity.createMany({ data: [
    { projectId: p2.id, type: 'prop',     name: 'Vanta Camera Hero Unit',       description: 'Hero product. Mounted and handheld configs. Clean, no scuffs.',         metadata: { status: 'confirmed' } },
    { projectId: p2.id, type: 'prop',     name: 'Skate Deck (Branded)',         description: 'Custom Vanta-branded deck. Matte black with logo. Skatepark scene.',    metadata: { status: 'confirmed' } },
    { projectId: p2.id, type: 'prop',     name: 'Chalk Bag',                    description: 'Climbing chalk bag. Worn, authentic. Climber close-ups.',               metadata: { status: 'confirmed' } },
    { projectId: p2.id, type: 'wardrobe', name: 'Skater — Urban Street',        description: 'Oversized tee, cargo pants, skate shoes. No visible logos.',            metadata: { status: 'confirmed' } },
    { projectId: p2.id, type: 'wardrobe', name: 'Climber — Technical Outdoor',  description: 'Tank top, climbing pants, approach shoes. Functional, not styled.',     metadata: { status: 'confirmed' } },
    { projectId: p2.id, type: 'wardrobe', name: 'Surfer — Coastal Casual',      description: 'Boardshorts, rash guard. Salt-faded, lived-in.',                       metadata: { status: 'confirmed' } },
    { projectId: p2.id, type: 'hmu',      name: 'All Athletes — Performance',   description: 'Sweat-proof base, sunscreen layer. Natural skin, no coverage.',        metadata: { status: 'confirmed' } },
  ]})

  await prisma.document.create({ data: {
    projectId: p2.id, type: 'script', version: 1, createdBy: clydeBessey.id,
    title: 'Full Send — :60 Spot',
    content: `FULL SEND
Vanta Action Camera. Director: Clyde Bessey. DP: Dani Reeves. Shooting Apr 10-12.
:60 Hero Spot.

SCENE 1 — EXT. MALIBU POINT — DAWN

Black. Then ocean.

First light splits the horizon. Long sets moving in from the west. The water is alive and indifferent.

MARCO SILVA paddles out. The VANTA CAMERA is mounted to the board nose. The ocean rushing past the lens, water over glass, everything moving.

A set comes in. Marco reads it, turns, paddles. The wave lifts him. He drops in.

AERIAL: The full drop — board and body committed completely to the wall of water.
GROUND LEVEL: The board slices past the lens at speed. Nothing but the sound of water and speed.
CLOSE ON MARCO'S FACE: Eyes locked ahead. Total. In it completely.

The wave releases him. He floats in the quiet after. The exhale.

[No dialogue. Sound design only. The ocean is the score.]

---

SCENE 2 — EXT. GRIFFITH PARK RIDGE — PRE-DAWN

The city below, still lit. The sky not yet decided between night and day.

ZOE PARK runs the ridge. VANTA unit on her chest. The city a glow behind her. She runs toward the drop edge of the ridge. She doesn't slow down.

GROUND LEVEL: Her feet hit the trail surface and pass directly over the lens. The ground as percussion.
AERIAL: The ridge. The city on one side, the void on the other. Zoe threading the exact line between them.

She crests the hill. She stops. First light arrives. She's already in it. Already there.

[No dialogue. Her breathing is the only sound we need.]

---

SCENE 3 — EXT. DTLA MEMORIAL SKATEPARK — AFTERNOON

Concrete. Hot afternoon light. The sound of wheels on smooth ground.

DEV OKAFOR approaches the drop. He's been looking at it. Now he rolls.

CLOSE ON THE APPROACH: The ramp edge coming fast. The last moment before the decision becomes irreversible.

He launches. For one frame — air. No ground. No outcome. Just the send, complete in itself.

CLOSE ON DEV'S FACE, MID-AIR: Eyes open. The full send.

He lands. He picks up the VANTA unit from his helmet. Holds it toward the lens. Grins.

VANTA. SEND IT.

CUT TO BLACK.`,
  }})

  console.log('  P2: Full Send — 3 scenes, 15 shots, 8 crew')

  // P2 — ProjectMembers (8 crew)
  await assignProjectCrew(p2.id, clydeBessey.id,    'director')
  await assignProjectCrew(p2.id, clydeBessey.id,    'producer', 'Production')
  await assignProjectCrew(p2.id, tylerHeckerman.id, 'producer')
  await assignProjectCrew(p2.id, kellyPratt.id,     'producer')
  await assignProjectCrew(p2.id, daniReeves.id,     'crew')
  await assignProjectCrew(p2.id, tylerGreen.id,  'crew')
  await assignProjectCrew(p2.id, marcoSilva.id,  'crew')
  await assignProjectCrew(p2.id, zoePark.id,     'crew')
  await assignProjectCrew(p2.id, devOkafor.id,   'crew')

  // P2 — Milestones (10)
  await prisma.milestone.createMany({ data: [
    { projectId: p2.id, title: 'Creative approved',                       date: new Date('2026-04-01'), status: 'completed' },
    { projectId: p2.id, title: 'Athlete agreements signed',               date: new Date('2026-04-03'), status: 'completed' },
    { projectId: p2.id, title: 'Location permits cleared — all 3 sites',  date: new Date('2026-04-05'), status: 'completed' },
    { projectId: p2.id, title: 'Day 1 — Surf · Malibu Point',            date: new Date('2026-04-10'), status: 'completed' },
    { projectId: p2.id, title: 'Day 2 — Trail Run · Griffith Park Ridge', date: new Date('2026-04-11'), status: 'in_progress' },
    { projectId: p2.id, title: 'Day 3 — Skate · DTLA Memorial Skatepark', date: new Date('2026-04-12'), status: 'upcoming' },
    { projectId: p2.id, title: 'All footage transferred and logged',      date: new Date('2026-04-13'), status: 'upcoming' },
    { projectId: p2.id, title: 'Cut v1 delivered to Vanta',              date: new Date('2026-04-17'), status: 'upcoming' },
    { projectId: p2.id, title: 'Client review',                          date: new Date('2026-04-19'), status: 'upcoming' },
    { projectId: p2.id, title: 'Final delivery — all formats',           date: new Date('2026-04-23'), status: 'upcoming' },
  ]})

  // P2 — Action Items (8)
  await prisma.actionItem.createMany({ data: [
    { projectId: p2.id, title: 'Transfer Day 1 footage to Vanta shared drive',   assignedTo: tylerGreen.id,  dueDate: new Date('2026-04-11'), status: 'done' },
    { projectId: p2.id, title: 'Confirm skatepark permit for Apr 12',            assignedTo: tylerHeckerman.id, dueDate: new Date('2026-04-11'), status: 'in_progress' },
    { projectId: p2.id, title: 'Athlete release forms — all three signed',       assignedTo: kellyPratt.id,     dueDate: new Date('2026-04-11'), status: 'done' },
    { projectId: p2.id, title: 'Trail rig setup — helmet + chest mounts tested', assignedTo: daniReeves.id,     dueDate: new Date('2026-04-11'), status: 'done' },
    { projectId: p2.id, title: 'Backup Vanta units charged and tested',          assignedTo: tylerHeckerman.id, dueDate: new Date('2026-04-11'), status: 'done' },
    { projectId: p2.id, title: 'Day 1 selects log created for editor',           assignedTo: kellyPratt.id,     dueDate: new Date('2026-04-12'), status: 'open' },
    { projectId: p2.id, title: 'Book edit suite for post',                       assignedTo: kellyPratt.id,     dueDate: new Date('2026-04-12'), status: 'open' },
    { projectId: p2.id, title: 'Confirm music license direction with Vanta',     assignedTo: kellyPratt.id,     dueDate: new Date('2026-04-14'), status: 'open' },
  ]})

  // P2 — Locations (3) — paired to script entities by Day 1/2/3 shoot order.
  // Names diverge between script and booking; pairing reflects the production
  // pivot within the same shoot day (e.g. Day 1 surf script → Day 1 skate booking).
  const p2EntMalibu   = await prisma.entity.findFirst({ where: { projectId: p2.id, type: 'location', name: 'Malibu Point' } })
  const p2EntGriffith = await prisma.entity.findFirst({ where: { projectId: p2.id, type: 'location', name: 'Griffith Park Ridge' } })
  const p2EntDTLA     = await prisma.entity.findFirst({ where: { projectId: p2.id, type: 'location', name: 'DTLA Memorial Skatepark' } })
  await prisma.location.createMany({ data: [
    {
      projectId: p2.id,
      entityId: p2EntMalibu?.id ?? null,
      name: 'Venice Beach Skatepark',
      description: 'Iconic concrete bowl and street course. High-energy skate segment — wide-angle hero shots and tracking coverage.',
      address: '1800 Ocean Front Walk, Venice, CA 90291',
      keyContact: 'LA Parks Film Unit — (213) 555-0310',
      shootDates: 'Apr 10 (completed)',
      status: 'confirmed',
      approved: true,
      notes: 'Permit #F-2026-4410. Dawn patrol — exclusive access 5:30–8:30am before public opens. Talent: Kai Reeves.',
      sortOrder: 0,
    },
    {
      projectId: p2.id,
      entityId: p2EntGriffith?.id ?? null,
      name: 'Turnbull Canyon Trail',
      description: 'Rugged single-track through coastal sage scrub. Mountain bike downhill segment — chase car rig and drone.',
      address: 'Turnbull Canyon Rd, Whittier, CA 90601',
      keyContact: 'Puente Hills Preserve — (562) 555-0177',
      shootDates: 'Apr 11 (completed)',
      status: 'confirmed',
      approved: true,
      notes: 'Drone FAA waiver approved. Trail closed to public 6–10am. Medic on standby — steep terrain.',
      sortOrder: 1,
    },
    {
      projectId: p2.id,
      entityId: p2EntDTLA?.id ?? null,
      name: 'DTLA Rooftop Court',
      description: 'Private rooftop basketball court with downtown skyline backdrop. Final segment — golden hour, wide establishing and tight action cuts.',
      address: '888 S Hope St, Los Angeles, CA 90017 (roof level)',
      keyContact: 'Building management — Derek Sato — (213) 555-0442',
      shootDates: 'Apr 12',
      status: 'scouting',
      approved: false,
      notes: 'Scouted Apr 8. Access via freight elevator. Weight limit 3,000 lbs for gear. Backup: Grand Park courts.',
      sortOrder: 2,
    },
  ]})

  // P2 — Workflow nodes (6)
  const p2wn1 = await prisma.workflowNode.create({ data: { projectId: p2.id, label: 'Camera Ingest',    type: 'ingest',   software: 'DaVinci Resolve', assigneeId: daniReeves.id, notes: 'Multi-cam action rigs, helmet + chest + drone', sortOrder: 0 }})
  const p2wn2 = await prisma.workflowNode.create({ data: { projectId: p2.id, label: 'Proxy Transcode', type: 'ingest',   software: 'DaVinci Resolve', assigneeId: tylerGreen.id, notes: 'ProRes 422 Proxy for field review',             sortOrder: 1 }})
  const p2wn3 = await prisma.workflowNode.create({ data: { projectId: p2.id, label: 'Offline Edit',    type: 'edit',     software: 'Premiere Pro',    assigneeId: null,          notes: 'Three athletes, three locations — one :60 spot', sortOrder: 2 }})
  const p2wn4 = await prisma.workflowNode.create({ data: { projectId: p2.id, label: 'Color Grade',     type: 'color',    software: 'DaVinci Resolve', assigneeId: null,          notes: 'Saturated, high contrast. Sport energy.',        sortOrder: 3 }})
  const p2wn5 = await prisma.workflowNode.create({ data: { projectId: p2.id, label: 'Sound Design',    type: 'sound',    software: 'Pro Tools',       assigneeId: null,          notes: 'Real audio from mounts + SFX + music bed',       sortOrder: 4 }})
  const p2wn6 = await prisma.workflowNode.create({ data: { projectId: p2.id, label: 'Final Delivery',  type: 'delivery', software: 'Compressor',      assigneeId: null,          notes: '',                                                sortOrder: 5 }})

  // P2 — Workflow edges (5)
  await prisma.workflowEdge.createMany({ data: [
    { projectId: p2.id, sourceId: p2wn1.id, targetId: p2wn2.id, inputFormat: 'RAW RED',           outputFormat: 'ProRes Proxy',    format: 'Proxy' },
    { projectId: p2.id, sourceId: p2wn2.id, targetId: p2wn3.id, inputFormat: 'ProRes Proxy',      outputFormat: 'ProRes Proxy',    format: 'Offline' },
    { projectId: p2.id, sourceId: p2wn3.id, targetId: p2wn4.id, inputFormat: 'ProRes Proxy',      outputFormat: 'ProRes 4444',     format: 'Conform' },
    { projectId: p2.id, sourceId: p2wn4.id, targetId: p2wn5.id, inputFormat: 'ProRes 4444',       outputFormat: 'ProRes 4444',     format: 'AAF + Picture' },
    { projectId: p2.id, sourceId: p2wn5.id, targetId: p2wn6.id, inputFormat: 'Stems + ProRes',    outputFormat: 'H.264 Master',    format: 'Master + Web' },
  ]})

  // P2 — Deliverables (4)
  await prisma.deliverable.createMany({ data: [
    { projectId: p2.id, title: 'Main :60',              length: '01:00', format: 'H.264',           aspectRatio: '16:9', resolution: '3840x2160', colorSpace: 'Rec.709',        soundSpecs: 'Stereo -14 LUFS',      sortOrder: 0 },
    { projectId: p2.id, title: ':30 Social Cutdown',    length: '00:30', format: 'H.264',           aspectRatio: '16:9', resolution: '1920x1080', colorSpace: 'Rec.709',        soundSpecs: 'Stereo -14 LUFS',      sortOrder: 1 },
    { projectId: p2.id, title: ':15 IG Reel (9:16)',    length: '00:15', format: 'H.264',           aspectRatio: '9:16', resolution: '1080x1920', colorSpace: 'Rec.709',        soundSpecs: 'Stereo -16 LUFS',      sortOrder: 2 },
    { projectId: p2.id, title: 'Archive Master',        length: '01:00', format: 'ProRes 4444 XQ',  aspectRatio: '16:9', resolution: '4096x2160', colorSpace: 'Rec.709 + P3 D65', soundSpecs: '5.1 Mix + Stereo',    sortOrder: 3 },
  ]})

  // P2 — Moodboard (1 tab, 5 refs)
  const p2mbTab = await prisma.moodboardTab.create({ data: { projectId: p2.id, name: 'Energy & Edge', sortOrder: 0 }})
  await prisma.moodboardRef.createMany({ data: [
    { projectId: p2.id, tabId: p2mbTab.id, title: 'First Light, First Drop', cat: 'tone',    note: 'Pre-dawn. The quiet before the commitment.',                         sortOrder: 0 },
    { projectId: p2.id, tabId: p2mbTab.id, title: 'Speed Streaks',            cat: 'visual',  note: 'Motion blur close-ups. Water, asphalt, ridge dust.',                 sortOrder: 1 },
    { projectId: p2.id, tabId: p2mbTab.id, title: 'Vanta Hero Unit',          cat: 'product', note: 'Matte black body. Lens element dominant. Never a banner shot.',     sortOrder: 2 },
    { projectId: p2.id, tabId: p2mbTab.id, title: 'POV Immersion',            cat: 'visual',  note: "Chest mount. Board nose. Helmet cam. The athlete's eye first.",     sortOrder: 3 },
    { projectId: p2.id, tabId: p2mbTab.id, title: 'Score Reference',          cat: 'music',   note: 'Nosaj Thing — Us. Electronic, propulsive, restrained.',             sortOrder: 4 },
  ]})

  // ══════════════════════════════════════════════════════════════════════════
  // PROJECT 3 — IN VINO VERITAS
  // Client: Napa Collective  Status: Production  Day 2 of 3  Doc pilot
  // 3 sequences  14 shots  8 crew
  // ══════════════════════════════════════════════════════════════════════════

  const owenBlakely    = await upsertCrew(team.id, 'Owen Blakely',   'crew')
  const tomVega        = await upsertCrew(team.id, 'Tom Vega',       'crew')
  const ryanCole       = await upsertCrew(team.id, 'Ryan Cole',      'crew')
  const paulNavarro    = await upsertCrew(team.id, 'Paul Navarro',   'crew')
  const marcusTrent    = await upsertCrew(team.id, 'Marcus Trent',   'crew')
  const jinHo          = await upsertCrew(team.id, 'Jin Ho',         'crew')

  const p3 = await prisma.project.create({
    data: { teamId: team.id, name: 'In Vino Veritas', status: 'production', client: 'Napa Collective', type: 'documentary', color: '#5B2333' },
  })

  // Sequence 01 — The Vine. EXT. Golden Hour. Oakville Estate. DONE.
  const p3s1 = await prisma.scene.create({ data: {
    projectId: p3.id, sceneNumber: '01', title: 'The Vine', sortOrder: 1,
    description: 'Morning arrival. Walking the rows. The land as context for everything that follows. Oakville Estate.',
  }})
  await prisma.shot.createMany({ data: [
    { sceneId: p3s1.id, shotNumber: '01A', size: 'wide',            status: 'completed', sortOrder: 1, description: 'Three men walking into the vine rows at golden hour. The valley spreads behind them.' },
    { sceneId: p3s1.id, shotNumber: '01B', size: 'extreme_close_up',status: 'completed', sortOrder: 2, description: 'Hands touching leaves, then reaching into the soil. Contact with the earth. Tactile and specific.' },
    { sceneId: p3s1.id, shotNumber: '01C', size: 'medium',          status: 'completed', sortOrder: 3, description: 'Paul crouches, lifts a handful of earth, smells it. Not performed — genuine.' },
    { sceneId: p3s1.id, shotNumber: '01D', size: 'medium_close_up', status: 'completed', sortOrder: 4, description: 'Jin Ho, medium frame, vineyard behind. Interview on wine and time.' },
    { sceneId: p3s1.id, shotNumber: '01E', size: 'wide',            status: 'completed', sortOrder: 5, description: 'The valley from the ridge. Scale. Three tiny figures in the rows below.' },
  ]})

  // Sequence 02 — The Dark. INT. Low Light. St. Helena Cellar. TODAY.
  const p3s2 = await prisma.scene.create({ data: {
    projectId: p3.id, sceneNumber: '02', title: 'The Dark', sortOrder: 2,
    description: 'Underground. Barrels. The cellar as a place where honesty happens naturally. St. Helena.',
  }})
  await prisma.shot.createMany({ data: [
    { sceneId: p3s2.id, shotNumber: '02A', size: 'wide',            status: 'in_progress', sortOrder: 1, description: 'Three men entering the cellar. Eyes adjusting to the dark. The weight of the space.' },
    { sceneId: p3s2.id, shotNumber: '02B', size: 'extreme_close_up',status: 'in_progress', sortOrder: 2, description: 'Barrel markings, chalk dates. Years of patience annotated in handwriting.' },
    { sceneId: p3s2.id, shotNumber: '02C', size: 'medium_close_up', status: 'in_progress', sortOrder: 3, description: 'Marcus Trent, low light, barrels soft behind. Interview on time and making things.' },
    { sceneId: p3s2.id, shotNumber: '02D', size: 'medium',          status: 'in_progress', sortOrder: 4, description: 'Wine drawn directly from barrel with a thief. The tasting. Silence and expressions.' },
    { sceneId: p3s2.id, shotNumber: '02E', size: 'medium',          status: 'in_progress', sortOrder: 5, description: "All three, glasses up in the low light. No words. The moment when wine does what words can't." },
  ]})

  // Sequence 03 — The Road. EXT. Afternoon. Valley Drive. TOMORROW.
  const p3s3 = await prisma.scene.create({ data: {
    projectId: p3.id, sceneNumber: '03', title: 'The Road', sortOrder: 3,
    description: 'The conversation that only happens inside a moving car. The valley unrolling outside the windows.',
  }})
  await prisma.shot.createMany({ data: [
    { sceneId: p3s3.id, shotNumber: '03A', size: 'wide',            status: 'planned', sortOrder: 1, description: 'Car moving through valley road. Vines on both sides. The beauty of the place as transition.' },
    { sceneId: p3s3.id, shotNumber: '03B', size: 'medium',          status: 'planned', sortOrder: 2, description: 'Dashboard POV. Marcus driving, Paul in passenger. Conversation happening naturally.' },
    { sceneId: p3s3.id, shotNumber: '03C', size: 'wide',            status: 'planned', sortOrder: 3, description: 'Car pulled over at an unmarked vista. All three out, looking at the valley. Real.' },
    { sceneId: p3s3.id, shotNumber: '03D', size: 'medium_close_up', status: 'planned', sortOrder: 4, description: 'Paul, roadside, valley behind. The concluding thought on what the trip was actually about.' },
  ]})

  await prisma.entity.createMany({ data: [
    { projectId: p3.id, type: 'location',  name: 'Oakville Vineyard Estate', description: 'Day 1 location, vine rows, golden hour. Done.' },
    { projectId: p3.id, type: 'location',  name: 'St. Helena Barrel Cellar', description: 'Day 2 location, underground, available light only. Shooting today.' },
    { projectId: p3.id, type: 'location',  name: 'Napa Valley Road',         description: 'Day 3 location, valley drive, vista points.' },
  ]})
  const p3Winemaker = await prisma.entity.create({ data: { projectId: p3.id, type: 'character', name: 'The Winemaker', description: 'Documentary subject. Owns the estate.' } })
  const p3Host      = await prisma.entity.create({ data: { projectId: p3.id, type: 'character', name: 'The Host',      description: 'Narrator/guide. On-camera presence.' } })

  // P3 — Talent
  const p3tRenata = await prisma.talent.create({ data: { projectId: p3.id, name: 'Renata Vasquez', role: 'Lead Actor' } })
  const p3tOliver = await prisma.talent.create({ data: { projectId: p3.id, name: 'Oliver Strand',  role: 'Lead Actor' } })
  await prisma.talentAssignment.createMany({ data: [
    { talentId: p3tRenata.id, entityId: p3Winemaker.id },
    { talentId: p3tOliver.id, entityId: p3Host.id },
  ]})

  // P3 — Art (props, wardrobe, hmu)
  await prisma.entity.createMany({ data: [
    { projectId: p3.id, type: 'prop',     name: 'Wine Barrel',                   description: 'French oak barrel, branded estate stamp. Cellar scene hero.',            metadata: { status: 'confirmed' } },
    { projectId: p3.id, type: 'prop',     name: 'Estate Signage',                description: 'Hand-painted estate entrance sign. Vineyard arrival establishing shot.', metadata: { status: 'confirmed' } },
    { projectId: p3.id, type: 'prop',     name: 'Harvest Basket',                description: 'Traditional wicker grape harvest basket. Golden hour vineyard scene.',    metadata: { status: 'confirmed' } },
    { projectId: p3.id, type: 'wardrobe', name: 'Winemaker — Estate Attire',     description: 'Worn work shirt, canvas apron, boots. Authentic, not costume.',          metadata: { status: 'confirmed' } },
    { projectId: p3.id, type: 'wardrobe', name: 'Host — Smart Casual',           description: 'Linen blazer, open collar, warm earth tones. Polished but approachable.', metadata: { status: 'confirmed' } },
    { projectId: p3.id, type: 'hmu',      name: 'Winemaker — Natural Documentary', description: 'No makeup. Documentary real. Skin and hands as-is.',                  metadata: { status: 'confirmed' } },
    { projectId: p3.id, type: 'hmu',      name: 'Host — Polished Relaxed',       description: 'Light base, groomed brows, matte finish. Camera-ready but not heavy.',   metadata: { status: 'confirmed' } },
  ]})

  await prisma.document.create({ data: {
    projectId: p3.id, type: 'script', version: 1, createdBy: clydeBessey.id,
    title: 'In Vino Veritas — Treatment and Interview Guide',
    content: `IN VINO VERITAS
Napa Collective. Director: Clyde Bessey. Doc Pilot.

LOGLINE
Three men, one valley, one bottle between them. Wine as the oldest technology for dissolving the distance between people.

DIRECTOR'S APPROACH
This is not a wine documentary. Wine is the vehicle. The subject is what happens to men when the distance between them closes.

No narration. No on-screen titles. Just Paul, Marcus, and Jin, moving through a place that has been making people honest for a very long time.

Camera approach: verite throughout. Follow, don't lead. If you have to choose between the shot and the moment, choose the moment.

---

SEQUENCE 1 — THE VINE. Oakville Vineyard. Golden Hour.

We arrive when they arrive. No setup, no orientation. Let the land introduce itself.

INTERVIEW — JIN HO
Location: End of a vine row, valley behind. Last golden light.

What does this place feel like to you the first time you're in it?
What does wine do that conversation can't — or won't?
When did you first understand that wine was something more than a drink?
What does it mean to make something that requires years to become what it is?

Don't push for conclusions. If he trails off, let him. The trailing off is the answer.

---

SEQUENCE 2 — THE DARK. St. Helena Barrel Cellar. Available light only.

The cellar is a different room than the vineyard. Something happens to people underground. Do not add light sources.

INTERVIEW — MARCUS TRENT
Location: Barrel corridor. One practical bare bulb above. No fill.

What do you think about when you're in a place like this?
Is there something about the dark that changes how you talk to people?
What's the difference between a bottle you open alone and one you open with the right people?

THE TASTING — No script. When the winemaker draws from the barrel, follow it. Let the silence after the first taste stay in the edit.

---

SEQUENCE 3 — THE ROAD. Valley Drive and Vista Points. Late afternoon.

The drive is the third character. The car is a confessional.

INTERVIEW — PAUL NAVARRO
Location: Roadside, valley behind him. Late afternoon. This is the closing interview.

What are you taking away from today that you didn't arrive with?
Is there a version of this day that happens without the wine? What's different?
What do you want people to feel watching this?

FINAL IMAGE — No direction. The car moves away down the valley road. Don't force a close.`,
  }})

  console.log('  P3: In Vino Veritas — 3 sequences, 14 shots, 9 crew')

  // P3 — ProjectMembers (9 crew)
  await assignProjectCrew(p3.id, clydeBessey.id,    'director')
  await assignProjectCrew(p3.id, clydeBessey.id,    'producer', 'Production')
  await assignProjectCrew(p3.id, tylerHeckerman.id, 'producer')
  await assignProjectCrew(p3.id, kellyPratt.id,     'producer')
  await assignProjectCrew(p3.id, owenBlakely.id,    'crew')
  await assignProjectCrew(p3.id, tomVega.id,        'crew')
  await assignProjectCrew(p3.id, ryanCole.id,       'crew')
  await assignProjectCrew(p3.id, paulNavarro.id,    'crew')
  await assignProjectCrew(p3.id, marcusTrent.id,    'crew')
  await assignProjectCrew(p3.id, jinHo.id,          'crew')

  // P3 — Milestones (10)
  await prisma.milestone.createMany({ data: [
    { projectId: p3.id, title: 'Concept approved by Napa Collective',        date: new Date('2026-04-03'), status: 'completed' },
    { projectId: p3.id, title: 'All three subjects confirmed and briefed',   date: new Date('2026-04-07'), status: 'completed' },
    { projectId: p3.id, title: 'Day 1 — Vineyard Estate, Oakville',         date: new Date('2026-04-10'), status: 'completed' },
    { projectId: p3.id, title: 'Day 2 — Barrel Cellar, St. Helena',         date: new Date('2026-04-11'), status: 'in_progress' },
    { projectId: p3.id, title: 'Day 3 — Valley Road + Vista Points',        date: new Date('2026-04-12'), status: 'upcoming' },
    { projectId: p3.id, title: 'Interview pickup day — Paul Navarro solo',  date: new Date('2026-04-15'), status: 'upcoming' },
    { projectId: p3.id, title: 'Assembly cut',                              date: new Date('2026-04-20'), status: 'upcoming' },
    { projectId: p3.id, title: "Director's cut delivered",                  date: new Date('2026-04-25'), status: 'upcoming' },
    { projectId: p3.id, title: 'Client screening — Napa Collective',        date: new Date('2026-04-28'), status: 'upcoming' },
    { projectId: p3.id, title: 'Pilot delivery + series pitch package',     date: new Date('2026-05-05'), status: 'upcoming' },
  ]})

  // P3 — Action Items (8)
  await prisma.actionItem.createMany({ data: [
    { projectId: p3.id, title: 'Log and sync Day 1 footage',                        assignedTo: owenBlakely.id,   dueDate: new Date('2026-04-11'), status: 'in_progress' },
    { projectId: p3.id, title: 'Interview questions refined for cellar session',    assignedTo: clydeBessey.id,    dueDate: new Date('2026-04-11'), status: 'done' },
    { projectId: p3.id, title: 'Barrel room winery access confirmed',              assignedTo: ryanCole.id,       dueDate: new Date('2026-04-11'), status: 'done' },
    { projectId: p3.id, title: 'Day 3 road route mapped + vista permits',          assignedTo: tylerHeckerman.id, dueDate: new Date('2026-04-11'), status: 'done' },
    { projectId: p3.id, title: 'Transcription service booked for all interviews',  assignedTo: kellyPratt.id,     dueDate: new Date('2026-04-13'), status: 'open' },
    { projectId: p3.id, title: 'Cut structure outline — paper edit from Day 1',    assignedTo: clydeBessey.id,    dueDate: new Date('2026-04-16'), status: 'open' },
    { projectId: p3.id, title: 'Temp music selects for assembly',                  assignedTo: kellyPratt.id,     dueDate: new Date('2026-04-19'), status: 'open' },
    { projectId: p3.id, title: 'Archival wine footage licensing',                  assignedTo: tylerHeckerman.id, dueDate: new Date('2026-04-18'), status: 'open' },
  ]})

  // P3 — Locations (3) — pair to matching Entity(type='location') rows where names align
  const p3EntOakville = await prisma.entity.findFirst({ where: { projectId: p3.id, type: 'location', name: 'Oakville Vineyard Estate' } })
  const p3EntCellar   = await prisma.entity.findFirst({ where: { projectId: p3.id, type: 'location', name: 'St. Helena Barrel Cellar' } })
  const p3EntRoad     = await prisma.entity.findFirst({ where: { projectId: p3.id, type: 'location', name: 'Napa Valley Road' } })
  await prisma.location.createMany({ data: [
    {
      projectId: p3.id,
      entityId: p3EntOakville?.id ?? null,
      name: 'Oakville Estate Vineyard',
      description: 'Heritage vineyard with century-old vines. Main interview location for Day 1. Golden hour light through the rows.',
      address: '7801 St. Helena Hwy, Oakville, CA 94562',
      keyContact: 'Margaret Hess — Estate Manager — (707) 555-0142',
      shootDates: 'Apr 10 (completed)',
      status: 'confirmed',
      approved: true,
      notes: 'Gate code: 4418. Park in the gravel lot past the barn. No drones without 48h notice.',
      sceneTab: 'The Vine',
      sortOrder: 0,
    },
    {
      projectId: p3.id,
      entityId: p3EntCellar?.id ?? null,
      name: 'St. Helena Barrel Cellar',
      description: 'Underground barrel aging room. Low ceilings, dramatic side light from small windows. Interview with the winemaker here.',
      address: '1220 Adams St, St. Helena, CA 94574',
      keyContact: 'Dan Moretti — Head Winemaker — (707) 555-0287',
      shootDates: 'Apr 11 (today)',
      status: 'confirmed',
      approved: true,
      notes: 'Temperature controlled — no hot lights. LED panels only. Access via loading dock on Adams St.',
      sceneTab: 'The Cellar',
      sortOrder: 1,
    },
    {
      projectId: p3.id,
      entityId: p3EntRoad?.id ?? null,
      name: 'Silverado Trail Vista Point',
      description: 'Elevated overlook with panoramic valley views. Final driving sequence and closing shots.',
      address: 'Silverado Trail, near Deer Park Rd, Napa, CA',
      keyContact: 'Tyler Heckerman — permit on file',
      shootDates: 'Apr 12',
      status: 'in_talks',
      approved: false,
      notes: 'County film permit submitted. Awaiting confirmation. Backup: pull-off at mile marker 22.',
      sceneTab: 'The Road',
      sortOrder: 2,
    },
  ]})

  console.log('  P3: + 3 locations')

  // P3 — Workflow nodes (7)
  const p3wn1 = await prisma.workflowNode.create({ data: { projectId: p3.id, label: 'Camera Ingest',    type: 'ingest',   software: 'DaVinci Resolve', assigneeId: owenBlakely.id, notes: 'Doc coverage — multi-cam verité',                        sortOrder: 0 }})
  const p3wn2 = await prisma.workflowNode.create({ data: { projectId: p3.id, label: 'Transcription',   type: 'other',    software: 'Descript',        assigneeId: kellyPratt.id,  notes: 'All interview dialogue transcribed for paper edit',      sortOrder: 1 }})
  const p3wn3 = await prisma.workflowNode.create({ data: { projectId: p3.id, label: 'Offline Edit',    type: 'edit',     software: 'Premiere Pro',    assigneeId: null,           notes: 'Story-driven cut from transcripts. Pilot length ~12 min.', sortOrder: 2 }})
  const p3wn4 = await prisma.workflowNode.create({ data: { projectId: p3.id, label: 'Color Grade',     type: 'color',    software: 'DaVinci Resolve', assigneeId: null,           notes: 'Documentary naturalism. Preserve natural vineyard light.', sortOrder: 3 }})
  const p3wn5 = await prisma.workflowNode.create({ data: { projectId: p3.id, label: 'Sound Mix',       type: 'sound',    software: 'Pro Tools',       assigneeId: null,           notes: 'Dialog-forward. Nat sound support. Minimal music.',       sortOrder: 4 }})
  const p3wn6 = await prisma.workflowNode.create({ data: { projectId: p3.id, label: 'Online / Conform',type: 'edit',     software: 'Premiere Pro',    assigneeId: null,           notes: '',                                                         sortOrder: 5 }})
  const p3wn7 = await prisma.workflowNode.create({ data: { projectId: p3.id, label: 'Final Delivery',  type: 'delivery', software: 'Compressor',      assigneeId: null,           notes: '',                                                         sortOrder: 6 }})

  // P3 — Workflow edges (6)
  await prisma.workflowEdge.createMany({ data: [
    { projectId: p3.id, sourceId: p3wn1.id, targetId: p3wn2.id, inputFormat: 'ProRes 422 HQ',              outputFormat: 'Text transcript + timecode', format: 'Transcript' },
    { projectId: p3.id, sourceId: p3wn2.id, targetId: p3wn3.id, inputFormat: 'Text transcript + timecode', outputFormat: 'ProRes 422 HQ',              format: 'Paper Edit' },
    { projectId: p3.id, sourceId: p3wn3.id, targetId: p3wn4.id, inputFormat: 'ProRes 422 HQ',              outputFormat: 'ProRes 4444',                format: 'Conform' },
    { projectId: p3.id, sourceId: p3wn4.id, targetId: p3wn5.id, inputFormat: 'ProRes 4444',                outputFormat: 'ProRes 4444',                format: 'AAF + Picture' },
    { projectId: p3.id, sourceId: p3wn5.id, targetId: p3wn6.id, inputFormat: 'Stems + ProRes 4444',        outputFormat: 'ProRes 4444 XQ',             format: 'Online' },
    { projectId: p3.id, sourceId: p3wn6.id, targetId: p3wn7.id, inputFormat: 'ProRes 4444 XQ',             outputFormat: 'H.264 + Archive Master',     format: 'Master + Web' },
  ]})

  // P3 — Deliverables (3)
  await prisma.deliverable.createMany({ data: [
    { projectId: p3.id, title: 'Pilot Master',    length: '12:00', format: 'ProRes 422 HQ', aspectRatio: '16:9', resolution: '3840x2160', colorSpace: 'Rec.709', soundSpecs: 'Stereo + 5.1 Mix',  sortOrder: 0 },
    { projectId: p3.id, title: 'Series Trailer',  length: '02:30', format: 'H.264',         aspectRatio: '16:9', resolution: '3840x2160', colorSpace: 'Rec.709', soundSpecs: 'Stereo -16 LUFS',  sortOrder: 1 },
    { projectId: p3.id, title: 'Social Teaser',   length: '01:00', format: 'H.264',         aspectRatio: '1:1',  resolution: '1080x1080', colorSpace: 'Rec.709', soundSpecs: 'Stereo -16 LUFS',  sortOrder: 2 },
  ]})

  // P3 — Moodboard (1 tab, 5 refs)
  const p3mbTab = await prisma.moodboardTab.create({ data: { projectId: p3.id, name: 'The Land Speaks', sortOrder: 0 }})
  await prisma.moodboardRef.createMany({ data: [
    { projectId: p3.id, tabId: p3mbTab.id, title: 'Golden Hour Vineyard',  cat: 'tone',   note: 'The hour where the light joins the subject matter. Warmth without sentimentality.', sortOrder: 0 },
    { projectId: p3.id, tabId: p3mbTab.id, title: 'Barrel Cellar Dark',    cat: 'visual', note: 'Available light only. Windows as single-source. Faces partially in shadow.',       sortOrder: 1 },
    { projectId: p3.id, tabId: p3mbTab.id, title: 'Hands in Soil',         cat: 'visual', note: 'Tactile close-ups. The land as character.',                                         sortOrder: 2 },
    { projectId: p3.id, tabId: p3mbTab.id, title: 'Valley Road Movement',  cat: 'visual', note: 'Car as confessional. Dashboard POV. Side window landscape.',                        sortOrder: 3 },
    { projectId: p3.id, tabId: p3mbTab.id, title: 'Spare Score',           cat: 'music',  note: 'Max Richter — On the Nature of Daylight. Pulled back, never leading.',              sortOrder: 4 },
  ]})

  // ══════════════════════════════════════════════════════════════════════════
  // PROJECT 4 — FLEXIBILITY COURSE A
  // Client: Kaia Mori  Status: Pre-Production  Episode 1 of 6
  // 3 sequences  11 shots  5 crew
  // ══════════════════════════════════════════════════════════════════════════

  const alexDrum   = await upsertCrew(team.id, 'Alex Drum',  'crew')
  const hanaLiu    = await upsertCrew(team.id, 'Hana Liu',   'crew')
  const tylerMoss  = await upsertCrew(team.id, 'Tyler Moss', 'crew')
  const kaiaMori   = await upsertCrew(team.id, 'Kaia Mori',  'crew')

  const p4 = await prisma.project.create({
    data: { teamId: team.id, name: 'Flexibility Course A', status: 'pre_production', client: 'Kaia Mori', type: 'educational', color: '#7AACB3' },
  })

  // Sequence 01 — The Welcome. INT. Studio. White Cyc.
  const p4s1 = await prisma.scene.create({ data: {
    projectId: p4.id, sceneNumber: '01', title: 'The Welcome', sortOrder: 1,
    description: 'Kaia introduces the episode. Direct to camera. Warm, specific, unhurried.',
  }})
  await prisma.shot.createMany({ data: [
    { sceneId: p4s1.id, shotNumber: '01A', size: 'medium',          status: 'planned', sortOrder: 1, description: 'Kaia seated, direct address. Introduces herself, the series, what this episode is about.' },
    { sceneId: p4s1.id, shotNumber: '01B', size: 'wide',            status: 'planned', sortOrder: 2, description: 'Full body. Standing in the clean studio space. The scale and simplicity of the environment.' },
    { sceneId: p4s1.id, shotNumber: '01C', size: 'extreme_close_up',status: 'planned', sortOrder: 3, description: 'Hands in anjali mudra. The gesture of beginning. The practice starting before the body moves.' },
  ]})

  // Sequence 02 — The Practice. INT. Studio. Full sequence.
  const p4s2 = await prisma.scene.create({ data: {
    projectId: p4.id, sceneNumber: '02', title: 'The Practice', sortOrder: 2,
    description: 'The full floor sequence. Tadasana through Vrksasana. Both cameras rolling. The unbroken instruction.',
  }})
  await prisma.shot.createMany({ data: [
    { sceneId: p4s2.id, shotNumber: '02A', size: 'wide',            status: 'planned', sortOrder: 1, description: 'Full body profile. Continuous from standing through tree pose. Primary angle. Cam A.' },
    { sceneId: p4s2.id, shotNumber: '02B', size: 'wide',            status: 'planned', sortOrder: 2, description: 'Frontal angle. Same full sequence. Coverage for edit flexibility. Cam B.' },
    { sceneId: p4s2.id, shotNumber: '02C', size: 'extreme_close_up',status: 'planned', sortOrder: 3, description: 'Foot placement, hand position, eye line. Instructional close-up details for each key beat.' },
    { sceneId: p4s2.id, shotNumber: '02D', size: 'medium',          status: 'planned', sortOrder: 4, description: 'Kaia demonstrates common misalignment, then immediately corrects. The teaching moment.' },
    { sceneId: p4s2.id, shotNumber: '02E',                          status: 'planned', sortOrder: 5, description: 'Overhead top-down. Body in tree pose from directly above. Symmetry and root visible.' },
  ]})

  // Sequence 03 — The Ground. EXT. Morning. Will Rogers State Park.
  const p4s3 = await prisma.scene.create({ data: {
    projectId: p4.id, sceneNumber: '03', title: 'The Ground', sortOrder: 3,
    description: 'Taking the practice outside. Feet in grass. The same pose, different earth. Will Rogers State Park.',
  }})
  await prisma.shot.createMany({ data: [
    { sceneId: p4s3.id, shotNumber: '03A', size: 'wide',            status: 'planned', sortOrder: 1, description: 'Kaia standing in the open field. Mountains visible behind. The studio practice placed in the world.' },
    { sceneId: p4s3.id, shotNumber: '03B', size: 'extreme_close_up',status: 'planned', sortOrder: 2, description: 'Bare feet in grass. The literal ground. Root pose on real earth.' },
    { sceneId: p4s3.id, shotNumber: '03C', size: 'medium',          status: 'planned', sortOrder: 3, description: 'Full tree pose in the open field. Wind present. Light natural. The pose as belonging.' },
    { sceneId: p4s3.id, shotNumber: '03D', size: 'close_up',        status: 'planned', sortOrder: 4, description: "Kaia's face. Eyes closed. The arrival at the end of practice. The return." },
  ]})

  await prisma.entity.createMany({ data: [
    { projectId: p4.id, type: 'location',  name: 'Cyc Studio, Downtown LA', description: 'White cyc studio. All interior sequences. Two shoot days.' },
    { projectId: p4.id, type: 'location',  name: 'Will Rogers State Park',  description: 'Outdoor location. Barefoot exterior sequences.' },
  ]})
  const p4Lead    = await prisma.entity.create({ data: { projectId: p4.id, type: 'character', name: 'Lead Instructor', description: 'Kaia Mori herself. On-camera talent.' } })
  /* Student — no talent assigned yet (pre-production) */
  await prisma.entity.create({ data: { projectId: p4.id, type: 'character', name: 'Student', description: 'Supporting presence. Practices alongside.' } })

  // P4 — Talent (only Lead Instructor assigned; Student is uncast)
  const p4tKaia = await prisma.talent.create({ data: { projectId: p4.id, name: 'Kaia Mori', role: 'Lead Actor' } })
  await prisma.talentAssignment.create({ data: { talentId: p4tKaia.id, entityId: p4Lead.id } })

  // P4 — Art (props, wardrobe, hmu)
  await prisma.entity.createMany({ data: [
    { projectId: p4.id, type: 'prop',     name: 'Yoga Mat (Branded Kaia Mori)', description: 'Custom mat with subtle Kaia Mori branding. All sequences.',             metadata: { status: 'sourced' } },
    { projectId: p4.id, type: 'prop',     name: 'Yoga Blocks',                  description: 'Cork yoga blocks x2. Standing balance and grounding sequences.',        metadata: { status: 'sourced' } },
    { projectId: p4.id, type: 'prop',     name: 'Bolster',                      description: 'Linen bolster cushion. Seated and supine sequences.',                    metadata: { status: 'needed' } },
    { projectId: p4.id, type: 'wardrobe', name: 'Kaia — Signature Activewear',  description: 'Kaia Mori branded set. Muted sage/charcoal. Two looks for two days.',   metadata: { status: 'sourced' } },
    { projectId: p4.id, type: 'wardrobe', name: 'Student — Neutral Activewear', description: 'Plain leggings and tank. Neutral tones, no branding. Supporting.',      metadata: { status: 'needed' } },
    { projectId: p4.id, type: 'hmu',      name: 'Kaia — Clean Glow',            description: 'Camera-ready natural. Light base, bronzer, clean brows. Sweat-proof.',  metadata: { status: 'sourced' } },
    { projectId: p4.id, type: 'hmu',      name: 'Student — Minimal',            description: 'Translucent powder only. Natural skin, no character look.',             metadata: { status: 'needed' } },
  ]})

  await prisma.document.create({ data: {
    projectId: p4.id, type: 'script', version: 1, createdBy: clydeBessey.id,
    title: 'Flexibility Course A — Episode 1 "Root"',
    content: `FLEXIBILITY COURSE A
Kaia Mori. Director: Clyde Bessey. DP: Alex Drum. Episode 1 of 6. Approved Apr 7.
Episode 1 — "Root". Standing Balance and Grounding. ~20 min.

SEQUENCE 1 — THE WELCOME. INT. Studio. Kaia seated on mat.

KAIA: Welcome to Flexibility Course A. I'm Kaia Mori, and this is the first episode of six.

[Beat. Let it settle.]

KAIA: Each episode is built around one practice. One idea. One return.

[She rises slowly to standing. Camera holds.]

KAIA: This episode is called Root. It's about standing — which sounds simple until you try to do it completely.

KAIA: We're going to work through a standing balance sequence today — from Tadasana, mountain pose, through Vrksasana, tree pose. If you've done these before, I want you to do them like you haven't. If this is your first time — there's nothing to get right. There's only paying attention.

KAIA: Find your mat. Come to standing. We'll begin together.

---

SEQUENCE 2 — THE PRACTICE. INT. Studio. Both cameras rolling.

KAIA: Stand with your feet hip-width apart. Feel the floor under you. Not gripping — just feeling it.

KAIA: This is Tadasana. Mountain pose. The beginning and the return of almost everything we do in standing practice.

[Beat. She lets the pose speak first.]

KAIA: Notice what your weight is doing right now. Is it forward on your toes? Back on your heels? See if you can find the middle of your foot — the place where the ground is meeting you evenly.

[She demonstrates the misalignment first.]

KAIA: This is what we often do — reaching forward before we've even moved. Come back. Root through the heel. Let the toes be light.

KAIA: Lengthen through the crown of the head. Shoulders back and down — not forced. Released.

[She shifts weight onto the left foot. Tree pose.]

KAIA: This is Vrksasana. Tree pose. And the tree does not grip the earth — it grows into it. Let your standing leg be that. Not locked. Alive.

KAIA: Find a point in front of you — a focal point. Let your gaze soften on it.

[She holds. Five full breaths. Counts quietly.]

KAIA: One. Two. Three. Four. Five.

[She releases. Returns to Tadasana.]

KAIA: Come back to mountain. Notice what changed. Then we take the other side.

---

SEQUENCE 3 — THE GROUND. EXT. Will Rogers State Park. Morning. Barefoot.

KAIA: The same practice. Different ground.

[She lets the field be present for a moment.]

KAIA: Notice this: the earth is uneven. Your foot has to read it in a way a studio floor doesn't require. That's not a problem — that's the practice asking more of you.

[She moves into tree pose. Wind moves through. She doesn't correct for it.]

KAIA: Let the wind be part of it. The tree doesn't resist the wind — it moves with it and stays rooted. That's what we're practicing.

[She holds. Eyes closed. The mountains behind her. A long, real moment.]

KAIA: Root is not about being still. It's about being connected. Come back to this whenever you need it.

KAIA: See you in Episode Two.

END EPISODE 1.`,
  }})

  console.log('  P4: Flexibility Course A — 3 sequences, 11 shots, 7 crew')

  // P4 — ProjectMembers (7 crew)
  await assignProjectCrew(p4.id, clydeBessey.id,    'director')
  await assignProjectCrew(p4.id, clydeBessey.id,    'producer', 'Production')
  await assignProjectCrew(p4.id, tylerHeckerman.id, 'producer')
  await assignProjectCrew(p4.id, kellyPratt.id,     'producer')
  await assignProjectCrew(p4.id, alexDrum.id,       'crew')
  await assignProjectCrew(p4.id, hanaLiu.id,    'crew')
  await assignProjectCrew(p4.id, tylerMoss.id,  'crew')
  await assignProjectCrew(p4.id, kaiaMori.id,   'crew')

  // P4 — Milestones (11)
  await prisma.milestone.createMany({ data: [
    { projectId: p4.id, title: 'Series outline approved by Kaia',            date: new Date('2026-04-01'), status: 'completed' },
    { projectId: p4.id, title: 'Episode 1 practice sequence locked',         date: new Date('2026-04-07'), status: 'completed' },
    { projectId: p4.id, title: 'Studio booked — cyc space, downtown LA',     date: new Date('2026-04-08'), status: 'completed' },
    { projectId: p4.id, title: 'Shot list v1 complete',                      date: new Date('2026-04-09'), status: 'completed' },
    { projectId: p4.id, title: 'Gear prep and two-camera test',              date: new Date('2026-04-13'), status: 'in_progress' },
    { projectId: p4.id, title: 'Studio Shoot Day — Ep 1 interior sequences', date: new Date('2026-04-16'), status: 'upcoming' },
    { projectId: p4.id, title: 'Outdoor Shoot Day — Will Rogers State Park', date: new Date('2026-04-17'), status: 'upcoming' },
    { projectId: p4.id, title: 'Episode 1 rough cut',                        date: new Date('2026-04-25'), status: 'upcoming' },
    { projectId: p4.id, title: 'Kaia review + notes',                        date: new Date('2026-04-27'), status: 'upcoming' },
    { projectId: p4.id, title: 'Episode 1 delivery',                         date: new Date('2026-05-02'), status: 'upcoming' },
    { projectId: p4.id, title: 'Episode 2 pre-production begins',            date: new Date('2026-05-05'), status: 'upcoming' },
  ]})

  // P4 — Action Items (8)
  await prisma.actionItem.createMany({ data: [
    { projectId: p4.id, title: 'Finalize Ep 1 practice sequence with Kaia',       assignedTo: clydeBessey.id,    dueDate: new Date('2026-04-12'), status: 'done' },
    { projectId: p4.id, title: 'Wardrobe direction sent to Kaia',                 assignedTo: clydeBessey.id,    dueDate: new Date('2026-04-12'), status: 'done' },
    { projectId: p4.id, title: 'Talent release form signed',                      assignedTo: hanaLiu.id,        dueDate: new Date('2026-04-12'), status: 'done' },
    { projectId: p4.id, title: 'Confirm studio lighting setup — two-cam positions', assignedTo: alexDrum.id,     dueDate: new Date('2026-04-13'), status: 'in_progress' },
    { projectId: p4.id, title: 'Outdoor location confirmed — Will Rogers',         assignedTo: tylerMoss.id,      dueDate: new Date('2026-04-13'), status: 'done' },
    { projectId: p4.id, title: 'Music licensing direction for series',             assignedTo: kellyPratt.id,     dueDate: new Date('2026-04-14'), status: 'open' },
    { projectId: p4.id, title: 'Episode 2 outline draft',                         assignedTo: clydeBessey.id,    dueDate: new Date('2026-04-20'), status: 'open' },
    { projectId: p4.id, title: 'Series template locked after Ep 1 review',        assignedTo: kellyPratt.id,     dueDate: new Date('2026-04-28'), status: 'open' },
  ]})

  // P4 — Locations (3) — paired interior-to-interior, exterior-to-exterior.
  // Silver Lake intentionally unpaired: production-only location with no
  // scripted counterpart (legitimate "production added something not in the
  // script" case).
  const p4EntCyc        = await prisma.entity.findFirst({ where: { projectId: p4.id, type: 'location', name: 'Cyc Studio, Downtown LA' } })
  const p4EntWillRogers = await prisma.entity.findFirst({ where: { projectId: p4.id, type: 'location', name: 'Will Rogers State Park' } })
  await prisma.location.createMany({ data: [
    {
      projectId: p4.id,
      entityId: p4EntCyc?.id ?? null,
      name: 'The Stillpoint — Private Studio',
      description: 'Kaia\'s personal yoga studio. Clean white walls, polished concrete floor, north-facing windows. Primary teaching location for all six episodes.',
      address: '4521 York Blvd, Suite 200, Los Angeles, CA 90042',
      keyContact: 'Kaia Mori — (323) 555-0198',
      shootDates: 'Apr 20–21',
      status: 'confirmed',
      approved: true,
      notes: 'Studio holds 8 people max including crew. No shoes past the threshold. Temperature must stay at 72°F for talent comfort.',
      sortOrder: 0,
    },
    {
      projectId: p4.id,
      entityId: p4EntWillRogers?.id ?? null,
      name: 'Point Dume Blufftop',
      description: 'Coastal cliffside with panoramic ocean views. Outdoor practice sequence — sunrise shoot. Wind-protected clearing above the cove.',
      address: 'Point Dume State Beach, Malibu, CA 90265',
      keyContact: 'CA State Parks — Permit desk — (818) 555-0290',
      shootDates: 'Apr 22',
      status: 'confirmed',
      approved: true,
      notes: 'Film permit #SP-26-0414. Call time 5:15am for sunrise at 6:12am. Talent warming area in parking lot. No generator — battery power only.',
      sortOrder: 1,
    },
    {
      projectId: p4.id,
      name: 'Minimalist Home — Silver Lake',
      description: 'Mid-century modern interior. Large windows, warm wood floors, minimal furnishing. Episode 3 home practice environment — intimate, personal.',
      address: 'Silver Lake, Los Angeles (address TBD)',
      keyContact: 'Location scout pending',
      shootDates: 'Apr 24',
      status: 'in_talks',
      approved: false,
      notes: 'Three options scouted. Awaiting homeowner confirmation. Must have living room clear of furniture for full-body framing.',
      sortOrder: 2,
    },
  ]})

  // P4 — Workflow nodes (5)
  const p4wn1 = await prisma.workflowNode.create({ data: { projectId: p4.id, label: 'Camera Ingest',   type: 'ingest',   software: 'DaVinci Resolve', assigneeId: alexDrum.id, notes: 'Multi-cam studio + exterior B-cam',                        sortOrder: 0 }})
  const p4wn2 = await prisma.workflowNode.create({ data: { projectId: p4.id, label: 'Offline Edit',   type: 'edit',     software: 'Premiere Pro',    assigneeId: null,        notes: 'Instructional flow — cut for clarity not drama',           sortOrder: 1 }})
  const p4wn3 = await prisma.workflowNode.create({ data: { projectId: p4.id, label: 'Color Grade',    type: 'color',    software: 'DaVinci Resolve', assigneeId: null,        notes: 'Clean daylight. Skin accurate. Studio white = true white.', sortOrder: 2 }})
  const p4wn4 = await prisma.workflowNode.create({ data: { projectId: p4.id, label: 'Sound Mix',      type: 'sound',    software: 'Pro Tools',       assigneeId: null,        notes: 'Dialog clarity priority. Subtle ambient layer.',           sortOrder: 3 }})
  const p4wn5 = await prisma.workflowNode.create({ data: { projectId: p4.id, label: 'Final Delivery', type: 'delivery', software: 'Compressor',      assigneeId: null,        notes: 'Multi-episode master template',                           sortOrder: 4 }})

  // P4 — Workflow edges (4)
  await prisma.workflowEdge.createMany({ data: [
    { projectId: p4.id, sourceId: p4wn1.id, targetId: p4wn2.id, inputFormat: 'ProRes 422 HQ',        outputFormat: 'ProRes 422 HQ',   format: 'Offline' },
    { projectId: p4.id, sourceId: p4wn2.id, targetId: p4wn3.id, inputFormat: 'ProRes 422 HQ',        outputFormat: 'ProRes 4444',     format: 'Conform' },
    { projectId: p4.id, sourceId: p4wn3.id, targetId: p4wn4.id, inputFormat: 'ProRes 4444',          outputFormat: 'ProRes 4444',     format: 'AAF + Picture' },
    { projectId: p4.id, sourceId: p4wn4.id, targetId: p4wn5.id, inputFormat: 'Stems + ProRes 4444',  outputFormat: 'H.264 Master',    format: 'Master + Web' },
  ]})

  // P4 — Deliverables (3)
  await prisma.deliverable.createMany({ data: [
    { projectId: p4.id, title: 'Episode 1 Master', length: '20:00', format: 'H.264', aspectRatio: '16:9', resolution: '3840x2160', colorSpace: 'Rec.709', soundSpecs: 'Stereo -14 LUFS', sortOrder: 0 },
    { projectId: p4.id, title: 'Course Trailer',   length: '00:30', format: 'H.264', aspectRatio: '16:9', resolution: '1920x1080', colorSpace: 'Rec.709', soundSpecs: 'Stereo -14 LUFS', sortOrder: 1 },
    { projectId: p4.id, title: 'Social Cutdown',   length: '00:45', format: 'H.264', aspectRatio: '9:16', resolution: '1080x1920', colorSpace: 'Rec.709', soundSpecs: 'Stereo -16 LUFS', sortOrder: 2 },
  ]})

  // P4 — Moodboard (1 tab, 4 refs)
  const p4mbTab = await prisma.moodboardTab.create({ data: { projectId: p4.id, name: 'Stillness & Practice', sortOrder: 0 }})
  await prisma.moodboardRef.createMany({ data: [
    { projectId: p4.id, tabId: p4mbTab.id, title: 'White Cyc Studio',         cat: 'visual',  note: 'The practice space as a clean stage. No distraction. Full attention on the body.', sortOrder: 0 },
    { projectId: p4.id, tabId: p4mbTab.id, title: 'Bare Feet, Real Ground',   cat: 'visual',  note: 'Interior/exterior bridge. The pose placed in the world.',                          sortOrder: 1 },
    { projectId: p4.id, tabId: p4mbTab.id, title: 'Kaia — Signature Tone',    cat: 'product', note: 'Muted sage, charcoal. Never fashion — always practice.',                           sortOrder: 2 },
    { projectId: p4.id, tabId: p4mbTab.id, title: 'Breath as Pacing',         cat: 'music',   note: 'Ólafur Arnalds — Near Light. Space for the instruction to land.',                  sortOrder: 3 },
  ]})

  // ══════════════════════════════════════════════════════════════════════════
  // PROJECT 5 — NATURAL ORDER
  // Client: Meridian Climate  Status: Post-Production  Post-only sizzle
  // 3 sequences  14 elements  4 team
  // ══════════════════════════════════════════════════════════════════════════

  const jamesNorth = await upsertCrew(team.id, 'James North', 'crew')
  const sarahOsei  = await upsertCrew(team.id, 'Sarah Osei',  'crew')

  const p5 = await prisma.project.create({
    data: { teamId: team.id, name: 'Natural Order', status: 'post_production', client: 'Meridian Climate', type: 'branded', color: '#6B7F3B' },
  })

  // Sequence 01 — The Problem. 0:00-0:45.
  const p5s1 = await prisma.scene.create({ data: {
    projectId: p5.id, sceneNumber: '01', title: 'The Problem', sortOrder: 1,
    description: 'Stock-driven. Ocean, weather, data. Setting the scale of the world the product addresses. 0:00-0:45.',
  }})
  await prisma.shot.createMany({ data: [
    { sceneId: p5s1.id, shotNumber: 'S1A', status: 'completed', sortOrder: 1, description: 'STOCK — Aerial ocean surface at dawn. Deep blue, barely moving. The scale of the system.' },
    { sceneId: p5s1.id, shotNumber: 'S1B', status: 'completed', sortOrder: 2, description: 'GFX — Global temperature anomaly map animating in across the surface of the earth.' },
    { sceneId: p5s1.id, shotNumber: 'S1C', status: 'completed', sortOrder: 3, description: 'STOCK — Storm system satellite footage. The data made visible.' },
    { sceneId: p5s1.id, shotNumber: 'S1D', status: 'completed', sortOrder: 4, description: 'VO — "There are 4.2 billion data points recorded every day. Most of them are telling us the same thing."' },
    { sceneId: p5s1.id, shotNumber: 'S1E', status: 'completed', sortOrder: 5, description: 'GFX — Data streams, chaotic particle system, beginning to converge toward a central point.' },
  ]})

  // Sequence 02 — The System. 0:45-1:30.
  const p5s2 = await prisma.scene.create({ data: {
    projectId: p5.id, sceneNumber: '02', title: 'The System', sortOrder: 2,
    description: "Introducing Meridian's platform. How it unifies the signal into a single readable picture. 0:45-1:30.",
  }})
  await prisma.shot.createMany({ data: [
    { sceneId: p5s2.id, shotNumber: 'S2A', status: 'in_progress', sortOrder: 1, description: 'GFX — Platform interface animation, sensor network visualization. Product introduced visually.' },
    { sceneId: p5s2.id, shotNumber: 'S2B', status: 'in_progress', sortOrder: 2, description: 'STOCK — Scientists at field monitoring stations. The human layer behind the data.' },
    { sceneId: p5s2.id, shotNumber: 'S2C', status: 'in_progress', sortOrder: 3, description: 'GFX — Data points resolving into a coherent unified map. The one signal moment.' },
    { sceneId: p5s2.id, shotNumber: 'S2D', status: 'in_progress', sortOrder: 4, description: "VO — \"Meridian doesn't add more data. It makes the data that exists finally speak the same language.\"" },
    { sceneId: p5s2.id, shotNumber: 'S2E', status: 'in_progress', sortOrder: 5, description: 'STOCK — Clean aerial landscape, land and water, ordered and whole. The world post-signal.' },
  ]})

  // Sequence 03 — The Signal. 1:30-2:00.
  const p5s3 = await prisma.scene.create({ data: {
    projectId: p5.id, sceneNumber: '03', title: 'The Signal', sortOrder: 3,
    description: 'Resolution. The world legible. The brand and the call to action. 1:30-2:00.',
  }})
  await prisma.shot.createMany({ data: [
    { sceneId: p5s3.id, shotNumber: 'S3A',                          status: 'planned', sortOrder: 1, description: 'GFX — Full global view. All sensors active, all data resolved. One unified picture of the world.' },
    { sceneId: p5s3.id, shotNumber: 'S3B',                          status: 'planned', sortOrder: 2, description: 'VO — "This is what natural order looks like. Every ocean. Every atmosphere. One signal. Everywhere."' },
    { sceneId: p5s3.id, shotNumber: 'S3C',                          status: 'planned', sortOrder: 3, description: 'GFX — Meridian logo resolves out of the data visualization. Brand as the resolution of the story.' },
    { sceneId: p5s3.id, shotNumber: 'S3D', size: 'insert',          status: 'planned', sortOrder: 4, description: 'Title card — Natural Order. Meridian Climate. URL. Fade to black.' },
  ]})

  const p5VO = await prisma.entity.create({ data: { projectId: p5.id, type: 'character', name: 'VO Artist', description: 'The only talent. Voice only.' } })

  // P5 — Talent
  const p5tSimone = await prisma.talent.create({ data: { projectId: p5.id, name: 'Simone Achebe', role: 'VO Artist' } })
  await prisma.talentAssignment.create({ data: { talentId: p5tSimone.id, entityId: p5VO.id } })

  // P5 — Art (props, wardrobe, hmu)
  await prisma.entity.createMany({ data: [
    { projectId: p5.id, type: 'prop',     name: 'Data Terminal (Hero Practical)', description: 'Futuristic data display terminal. Hero insert shot for GFX composite.', metadata: { status: 'confirmed' } },
    { projectId: p5.id, type: 'prop',     name: 'Branded Climate Report',        description: 'Meridian-branded printed report. Desk scene insert.',                    metadata: { status: 'confirmed' } },
    { projectId: p5.id, type: 'wardrobe', name: 'VO Artist — Minimal',           description: 'On-camera corrective only. Dark solid top for potential behind-scenes.',  metadata: { status: 'confirmed' } },
    { projectId: p5.id, type: 'hmu',      name: 'VO Artist — Base Look',         description: 'Translucent base, no character. Corrective only for behind-scenes BTS.', metadata: { status: 'confirmed' } },
  ]})

  await prisma.document.create({ data: {
    projectId: p5.id, type: 'script', version: 1, createdBy: rafiTorres.id,
    title: 'Natural Order — VO Script',
    content: `NATURAL ORDER
Meridian Climate. VO Talent: James North. Recorded Apr 10. Runtime ~2:00.
Voiceover Script — Final Draft. Apr 5.

SEQUENCE 1 — THE PROBLEM. 0:00-0:45.

[Open on ocean. Hold 4 seconds of silence before VO begins. Let the scale settle.]

VO — JAMES NORTH:
There are 4.2 billion data points recorded every day.

[Beat. Storm system data begins animating.]

Most of them are telling us the same thing.

[The data multiplies — scattered, nowhere to go.]

But they're not speaking to each other. Every sensor, every satellite, every buoy in every ocean — recording, transmitting, disappearing into separate systems that were never built to connect.

We have never had more information about this planet.

[Hold. One beat of silence.]

We have never understood it less.

---

SEQUENCE 2 — THE SYSTEM. 0:45-1:30.

[Meridian platform interface begins to appear. The scattered signals start organizing.]

VO — JAMES NORTH:
Meridian doesn't add more data.

[The particles begin to resolve — finding each other, moving together.]

It makes the data that exists finally speak the same language.

One platform. Every signal source. A single unified picture of the systems that govern this planet — updated in real time, readable by anyone who needs to make decisions based on what's actually happening.

Not more noise.

One signal.

---

SEQUENCE 3 — THE SIGNAL. 1:30-2:00.

[Full global view. Every sensor active. Meridian logo resolves from the data itself.]

VO — JAMES NORTH:
This is what natural order looks like.

Every ocean. Every atmosphere. Every system — speaking together, finally, as one.

Natural order.

MERIDIAN CLIMATE. meridianclimate.io

[Silence. Slow fade. Do not rush it.]

FADE TO BLACK.`,
  }})

  console.log('  P5: Natural Order — 3 sequences, 14 elements, 7 team')

  // P5 — ProjectMembers (7 crew)
  await assignProjectCrew(p5.id, clydeBessey.id,    'director')
  await assignProjectCrew(p5.id, clydeBessey.id,    'producer', 'Production')
  await assignProjectCrew(p5.id, tylerHeckerman.id, 'producer')
  await assignProjectCrew(p5.id, kellyPratt.id,     'producer')
  await assignProjectCrew(p5.id, rafiTorres.id,     'crew')
  await assignProjectCrew(p5.id, cleoStrand.id,     'crew')
  await assignProjectCrew(p5.id, jamesNorth.id,     'crew')
  await assignProjectCrew(p5.id, sarahOsei.id,      'crew')

  // P5 — Milestones (10)
  await prisma.milestone.createMany({ data: [
    { projectId: p5.id, title: 'VO script approved by Dr. Osei',             date: new Date('2026-04-05'), status: 'completed' },
    { projectId: p5.id, title: 'Stock footage selects locked — 42 clips',    date: new Date('2026-04-08'), status: 'completed' },
    { projectId: p5.id, title: 'VO recording session — James North, remote', date: new Date('2026-04-10'), status: 'completed' },
    { projectId: p5.id, title: 'GFX v1 — data visualization sequences',     date: new Date('2026-04-13'), status: 'in_progress' },
    { projectId: p5.id, title: 'Assembly cut with VO synced',                date: new Date('2026-04-14'), status: 'upcoming' },
    { projectId: p5.id, title: 'Client review round 1 — Dr. Osei',          date: new Date('2026-04-18'), status: 'upcoming' },
    { projectId: p5.id, title: 'GFX revisions v2',                          date: new Date('2026-04-21'), status: 'upcoming' },
    { projectId: p5.id, title: 'Color grade',                               date: new Date('2026-04-23'), status: 'upcoming' },
    { projectId: p5.id, title: 'Final mix',                                 date: new Date('2026-04-24'), status: 'upcoming' },
    { projectId: p5.id, title: 'Final delivery — all formats',              date: new Date('2026-04-25'), status: 'upcoming' },
  ]})

  // P5 — Action Items (8)
  await prisma.actionItem.createMany({ data: [
    { projectId: p5.id, title: 'VO file QC and sync to Premiere timeline',      assignedTo: rafiTorres.id, dueDate: new Date('2026-04-11'), status: 'in_progress' },
    { projectId: p5.id, title: 'Stock clip licensing confirmation — all 42',    assignedTo: tylerHeckerman.id, dueDate: new Date('2026-04-12'), status: 'in_progress' },
    { projectId: p5.id, title: 'GFX style frame approval — Dr. Osei',          assignedTo: kellyPratt.id,     dueDate: new Date('2026-04-12'), status: 'open' },
    { projectId: p5.id, title: 'Temp score confirmed for assembly',             assignedTo: kellyPratt.id,     dueDate: new Date('2026-04-12'), status: 'done' },
    { projectId: p5.id, title: 'GFX Sequence 1 — global data map build',       assignedTo: cleoStrand.id, dueDate: new Date('2026-04-13'), status: 'in_progress' },
    { projectId: p5.id, title: 'Lower thirds and supers design',               assignedTo: cleoStrand.id, dueDate: new Date('2026-04-14'), status: 'open' },
    { projectId: p5.id, title: 'End card and Meridian logo lockup',            assignedTo: cleoStrand.id, dueDate: new Date('2026-04-14'), status: 'open' },
    { projectId: p5.id, title: 'Export specs confirmed with Meridian team',    assignedTo: tylerHeckerman.id, dueDate: new Date('2026-04-20'), status: 'open' },
  ]})

  // ── P5 Locations ────────────────────────────────────────────────────────
  await prisma.location.createMany({ data: [
    { projectId: p5.id, name: 'Westside Post — Suite 4', address: '1432 2nd St, Santa Monica, CA 90401', status: 'confirmed', approved: true, description: 'Dedicated edit suite with 5.1 monitoring and Resolve grading bay. Booked for two-week finishing window.', keyContact: 'Lena Marsh — Facility Manager', shootDates: 'Apr 14–25', sceneTab: 'Post', sortOrder: 1 },
  ]})

  // P5 — Workflow nodes (6)
  const p5wn1 = await prisma.workflowNode.create({ data: { projectId: p5.id, label: 'VO Sync',         type: 'ingest',   software: 'Pro Tools',                  assigneeId: rafiTorres.id, notes: 'James North VO recorded remote, synced to timeline', sortOrder: 0 }})
  const p5wn2 = await prisma.workflowNode.create({ data: { projectId: p5.id, label: 'GFX Build',       type: 'vfx',      software: 'Cinema 4D + After Effects',  assigneeId: cleoStrand.id, notes: 'Full piece — no live action',                         sortOrder: 1 }})
  const p5wn3 = await prisma.workflowNode.create({ data: { projectId: p5.id, label: 'Offline Edit',    type: 'edit',     software: 'Premiere Pro',               assigneeId: rafiTorres.id, notes: 'VO-driven cut + stock + GFX',                        sortOrder: 2 }})
  const p5wn4 = await prisma.workflowNode.create({ data: { projectId: p5.id, label: 'Color Grade',     type: 'color',    software: 'DaVinci Resolve',            assigneeId: null,          notes: 'Data-viz precision. Clean highs, deep blues.',        sortOrder: 3 }})
  const p5wn5 = await prisma.workflowNode.create({ data: { projectId: p5.id, label: 'Sound Mix',       type: 'sound',    software: 'Pro Tools',                  assigneeId: null,          notes: 'VO + music bed + subtle FX',                          sortOrder: 4 }})
  const p5wn6 = await prisma.workflowNode.create({ data: { projectId: p5.id, label: 'Final Delivery',  type: 'delivery', software: 'Compressor',                 assigneeId: null,          notes: '',                                                     sortOrder: 5 }})

  // P5 — Workflow edges (5)
  await prisma.workflowEdge.createMany({ data: [
    { projectId: p5.id, sourceId: p5wn1.id, targetId: p5wn3.id, inputFormat: 'VO WAV',                   outputFormat: 'Synced VO',           format: 'VO Sync' },
    { projectId: p5.id, sourceId: p5wn2.id, targetId: p5wn3.id, inputFormat: 'Animated sequences (EXR)', outputFormat: 'ProRes 4444',         format: 'GFX Plates' },
    { projectId: p5.id, sourceId: p5wn3.id, targetId: p5wn4.id, inputFormat: 'ProRes 4444',              outputFormat: 'ProRes 4444 XQ',      format: 'Conform' },
    { projectId: p5.id, sourceId: p5wn4.id, targetId: p5wn5.id, inputFormat: 'ProRes 4444 XQ',           outputFormat: 'ProRes 4444 XQ',      format: 'AAF + Picture' },
    { projectId: p5.id, sourceId: p5wn5.id, targetId: p5wn6.id, inputFormat: 'Stems + ProRes 4444 XQ',   outputFormat: 'H.264 Master',        format: 'Master + Web' },
  ]})

  // P5 — Deliverables (3)
  await prisma.deliverable.createMany({ data: [
    { projectId: p5.id, title: 'Hero Film',           length: '02:00', format: 'H.264',           aspectRatio: '16:9', resolution: '3840x2160', colorSpace: 'Rec.709',         soundSpecs: 'Stereo -14 LUFS',    sortOrder: 0 },
    { projectId: p5.id, title: 'Social :30 Cutdown',  length: '00:30', format: 'H.264',           aspectRatio: '1:1',  resolution: '1080x1080', colorSpace: 'Rec.709',         soundSpecs: 'Stereo -16 LUFS',    sortOrder: 1 },
    { projectId: p5.id, title: 'Archive Master',      length: '02:00', format: 'ProRes 4444 XQ',  aspectRatio: '16:9', resolution: '4096x2160', colorSpace: 'Rec.709 + P3 D65', soundSpecs: '5.1 + Stereo Mix',  sortOrder: 2 },
  ]})

  // P5 — Moodboard (1 tab, 5 refs)
  const p5mbTab = await prisma.moodboardTab.create({ data: { projectId: p5.id, name: 'Data as Landscape', sortOrder: 0 }})
  await prisma.moodboardRef.createMany({ data: [
    { projectId: p5.id, tabId: p5mbTab.id, title: 'The Problem — Scale',       cat: 'tone',    note: 'Ocean aerials. Vastness before resolution.',                             sortOrder: 0 },
    { projectId: p5.id, tabId: p5mbTab.id, title: 'Sensor Networks',           cat: 'visual',  note: 'Abstract particle flows resolving into structure.',                      sortOrder: 1 },
    { projectId: p5.id, tabId: p5mbTab.id, title: 'Meridian Platform UI',      cat: 'product', note: 'The product visual. Clean, legible, authoritative.',                    sortOrder: 2 },
    { projectId: p5.id, tabId: p5mbTab.id, title: 'Unified Signal Moment',     cat: 'visual',  note: 'The resolution shot — scattered data becoming one readable picture.',   sortOrder: 3 },
    { projectId: p5.id, tabId: p5mbTab.id, title: 'Score Reference',           cat: 'music',   note: 'Jóhann Jóhannsson — Flight From the City. Patient. Earned.',              sortOrder: 4 },
  ]})

  // ══════════════════════════════════════════════════════════════════════════
  // PROJECT 6 — THE WEAVE
  // Client: B Story  Status: Production  Day 3 of 3  Night shoot tonight
  // 3 scenes  16 shots  15 crew  Sundance target
  // ══════════════════════════════════════════════════════════════════════════

  const calebStone = await upsertCrew(team.id, 'Caleb Stone', 'crew')
  const mayaLin    = await upsertCrew(team.id, 'Maya Lin',    'crew')
  const darioReyes = await upsertCrew(team.id, 'Dario Reyes', 'crew')
  const samPark    = await upsertCrew(team.id, 'Sam Park',    'crew')
  const petraWalsh = await upsertCrew(team.id, 'Petra Walsh', 'crew')
  const omarRashid = await upsertCrew(team.id, 'Omar Rashid', 'crew')
  const chrisTan   = await upsertCrew(team.id, 'Chris Tan',   'crew')
  const rinaCole   = await upsertCrew(team.id, 'Rina Cole',   'crew')
  const leoMarsh   = await upsertCrew(team.id, 'Leo Marsh',   'crew')
  const veraKoss   = await upsertCrew(team.id, 'Vera Koss',   'crew')
  const danaVance  = await upsertCrew(team.id, 'Dana Vance',  'crew')
  const tylerReed  = await upsertCrew(team.id, 'Tyler Reed',  'crew')
  const sofiaAvila = await upsertCrew(team.id, 'Sofia Avila', 'crew')

  const p6 = await prisma.project.create({
    data: { teamId: team.id, name: 'The Weave', status: 'production', client: 'B Story', type: 'narrative', color: '#6B3FA0' },
  })

  const PROJECT_ID_BY_KEY: Record<'p1'|'p2'|'p3'|'p4'|'p5'|'p6', string> = {
    p1: p1.id, p2: p2.id, p3: p3.id, p4: p4.id, p5: p5.id, p6: p6.id,
  }
  function projectIdByKey(key: 'p1'|'p2'|'p3'|'p4'|'p5'|'p6'|'crew'): string {
    if (key === 'crew') throw new Error('projectIdByKey called with "crew"')
    return PROJECT_ID_BY_KEY[key]
  }

  // Scene 01 — Apogee: Eli. EXT. Day. Desert Flats, Mojave. DONE.
  const p6s1 = await prisma.scene.create({ data: {
    projectId: p6.id, sceneNumber: '01', title: 'Apogee — Eli', sortOrder: 1,
    description: 'Eli alone. The farthest point. The silence before anything begins. Desert Flats, Mojave.',
  }})
  await prisma.shot.createMany({ data: [
    { sceneId: p6s1.id, shotNumber: '01A', size: 'wide',            status: 'completed', sortOrder: 1, description: 'Eli walking across open desert. Horizon in every direction. No destination visible.' },
    { sceneId: p6s1.id, shotNumber: '01B', size: 'medium',          status: 'completed', sortOrder: 2, description: 'He stops. Looks up. The sky fills the entire upper frame. He is small in it.' },
    { sceneId: p6s1.id, shotNumber: '01C', size: 'extreme_close_up',status: 'completed', sortOrder: 3, description: 'His face. Not lost — too present for lost. Just far. The distinction matters.' },
    { sceneId: p6s1.id, shotNumber: '01D', size: 'wide',            status: 'completed', sortOrder: 4, description: 'Feet on cracked earth. The texture of distance. The ground not holding him — just bearing him.' },
    { sceneId: p6s1.id, shotNumber: '01E', size: 'wide',            status: 'completed', sortOrder: 5, description: 'Aerial. Tiny figure in the vast desert. The apogee — the farthest point from everything.' },
  ]})

  // Scene 02 — The Edge: Mara. EXT. Day. Ravine, Malibu Creek. DONE.
  const p6s2 = await prisma.scene.create({ data: {
    projectId: p6.id, sceneNumber: '02', title: 'The Edge — Mara', sortOrder: 2,
    description: "Mara at the ravine edge. Her version of the same solitude. Mirror to Scene 1. Malibu Creek.",
  }})
  await prisma.shot.createMany({ data: [
    { sceneId: p6s2.id, shotNumber: '02A', size: 'wide',            status: 'completed', sortOrder: 1, description: "Mara at the ravine edge. Malibu Creek below. The drop visible — she's not afraid of it." },
    { sceneId: p6s2.id, shotNumber: '02B', size: 'close_up',        status: 'completed', sortOrder: 2, description: "Profile. Wind. She's thinking. Not going anywhere. Held at the edge by something we can't see." },
    { sceneId: p6s2.id, shotNumber: '02C', size: 'extreme_close_up',status: 'completed', sortOrder: 3, description: "Hands on rock. Grounded. Her hands where Eli's feet were — both touching the earth." },
    { sceneId: p6s2.id, shotNumber: '02D', size: 'insert',          status: 'completed', sortOrder: 4, description: 'Her journal, open. Half a sentence — stopped mid-thought. The place where words ran out.' },
    { sceneId: p6s2.id, shotNumber: '02E',                          status: 'completed', sortOrder: 5, description: 'POV — what she sees from the edge: the ravine, the other side, the distance. The gap.' },
  ]})

  // Scene 03 — Collision. EXT. Night. Joshua Tree. TONIGHT.
  const p6s3 = await prisma.scene.create({ data: {
    projectId: p6.id, sceneNumber: '03', title: 'Collision', sortOrder: 3,
    description: 'The meeting. Stars above. Two threads becoming one. The weave. Joshua Tree. Call time 7PM.',
  }})
  await prisma.shot.createMany({ data: [
    { sceneId: p6s3.id, shotNumber: '03A', size: 'wide',            status: 'in_progress', sortOrder: 1, description: "Stars above. Two figures approaching from opposite directions. They don't know about each other yet." },
    { sceneId: p6s3.id, shotNumber: '03B', size: 'medium',          status: 'in_progress', sortOrder: 2, description: 'The moment they see each other. The stop. No words. The frame holds.' },
    { sceneId: p6s3.id, shotNumber: '03C', size: 'medium',          status: 'in_progress', sortOrder: 3, description: 'Two-shot. Face to face. The frame holds both of them. The first time the film puts them together.' },
    { sceneId: p6s3.id, shotNumber: '03D', size: 'extreme_close_up',status: 'in_progress', sortOrder: 4, description: "His face: recognition. Not of her specifically — of the fact that someone else is here." },
    { sceneId: p6s3.id, shotNumber: '03E', size: 'extreme_close_up',status: 'in_progress', sortOrder: 5, description: 'Her face: the same. The mirror that started in Scene 1 finally has something to reflect.' },
    { sceneId: p6s3.id, shotNumber: '03F', size: 'wide',            status: 'in_progress', sortOrder: 6, description: 'Camera pulls back slowly. Two figures, one frame, stars expanding above them. The film ends here.' },
  ]})

  const p6EntDesert = await prisma.entity.create({ data: { projectId: p6.id, type: 'location', name: 'Desert Flats',        description: 'Scene 1 script location — open flats. Eli sequences.' } })
  const p6EntRavine = await prisma.entity.create({ data: { projectId: p6.id, type: 'location', name: 'Ravine Edge',         description: 'Scene 2 script location — canyon ravine. Mara sequences.' } })
  const p6EntJT     = await prisma.entity.create({ data: { projectId: p6.id, type: 'location', name: 'Joshua Tree — Night', description: 'Scene 3 script location — night desert. Collision scene.' } })
  const p6Eli      = await prisma.entity.create({ data: { projectId: p6.id, type: 'character', name: 'Eli',          description: 'Solitary, desert archetype. Lead.' } })
  const p6Mara     = await prisma.entity.create({ data: { projectId: p6.id, type: 'character', name: 'Mara',         description: 'Mirror character, ravine edge. Lead.' } })
  const p6Stranger = await prisma.entity.create({ data: { projectId: p6.id, type: 'character', name: 'The Stranger', description: 'Appears Scene 3. Catalyst.' } })

  // P6 — Talent
  const p6tMarcus = await prisma.talent.create({ data: { projectId: p6.id, name: 'Marcus Webb',   role: 'Lead Actor' } })
  const p6tSola   = await prisma.talent.create({ data: { projectId: p6.id, name: 'Sola Adeyemi',  role: 'Lead Actor' } })
  const p6tJin    = await prisma.talent.create({ data: { projectId: p6.id, name: 'Jin Park',      role: 'Supporting' } })
  await prisma.talentAssignment.createMany({ data: [
    { talentId: p6tMarcus.id, entityId: p6Eli.id },
    { talentId: p6tSola.id,   entityId: p6Mara.id },
    { talentId: p6tJin.id,    entityId: p6Stranger.id },
  ]})

  // P6 — Art (props, wardrobe, hmu)
  await prisma.entity.createMany({ data: [
    { projectId: p6.id, type: 'prop',     name: 'Journal (Mara\'s)',            description: 'Leather-bound journal, hand-written pages. Ravine scene, close-ups.',   metadata: { status: 'confirmed' } },
    { projectId: p6.id, type: 'prop',     name: 'Worn Rope',                    description: 'Frayed hemp rope, aged. Desert and ravine scenes. Symbolic prop.',      metadata: { status: 'confirmed' } },
    { projectId: p6.id, type: 'prop',     name: 'Handheld Lantern',             description: 'Oil lantern, practical flame. Night exterior Scene 3.',                 metadata: { status: 'confirmed' } },
    { projectId: p6.id, type: 'wardrobe', name: 'Eli — Desert Layers',          description: 'Worn denim jacket, faded henley, dusty boots. Weathered, lived-in.',   metadata: { status: 'confirmed' } },
    { projectId: p6.id, type: 'wardrobe', name: 'Mara — Light Linen',           description: 'Flowing linen shirt, earth-tone trousers. Natural, windswept.',        metadata: { status: 'confirmed' } },
    { projectId: p6.id, type: 'hmu',      name: 'Eli — Dusty Sun-Worn',         description: 'Weathered skin, cracked lips, dust in hair. Days in the desert.',      metadata: { status: 'confirmed' } },
    { projectId: p6.id, type: 'hmu',      name: 'Mara — Natural Minimal',       description: 'Clean skin, no makeup visible. Wind-tousled hair. Organic.',           metadata: { status: 'confirmed' } },
  ]})

  await prisma.document.create({ data: {
    projectId: p6.id, type: 'script', version: 3, createdBy: clydeBessey.id,
    title: 'The Weave — Full Screenplay',
    content: `THE WEAVE
Written by N. Vale.
A FRACTURE Universe Film. Draft 3 — Mar 28.
Script Lock Mar 28. B Story.

FADE IN:

EXT. DESERT FLATS, MOJAVE — DAY

Flat white sky. The ground cracked, pale, and ancient — like something that was never young.

ELI (30s, lean, moving like someone who has been moving for a while) walks across the open desert. No bag. No visible destination. He's not lost. He's just far.

He walks.

The sound is wind. Only wind.

He stops.

He looks up. The sky takes the whole frame. There is a lot of it.

ELI
(to himself, barely)
Still here.

He looks down at his feet on the cracked earth. He keeps walking.

AERIAL: A tiny figure. The desert extends to every edge of the frame. The farthest point from everything.

---

EXT. RAVINE — MALIBU CREEK — DAY

Different landscape entirely. Green where the desert was white. A ravine cuts through layered sandstone. Malibu Creek moves far below.

MARA (30s, still, a person who watches things) stands at the edge of the ravine. The other side is visible — close enough to call across, far enough to matter.

She's been here a while.

She holds an open journal. Looks down at it. Something she was writing — half a sentence, stopped mid-thought. She closes the journal.

She looks across the gap.

MARA
(to the other side, almost inaudible)
I know.

Wind moves through the ravine.

She puts her palm flat against the rock beside her. Presses it.

She looks down at the water below. She doesn't move.

---

EXT. JOSHUA TREE — NIGHT

Stars. All of them.

The desert at night is a different planet than the desert in daylight. Cooler. The silence has more weight to it.

Two FIGURES approach from opposite directions — small in the wide frame, the stars enormous above them. They haven't seen each other.

They get closer.

ELI stops walking.

MARA stops walking.

A long moment. Neither speaks. Neither moves. The stars turn above them at the speed of the earth.

ELI
You're the first person I've seen.

MARA
In how long?

ELI
(considers this honestly)
Three days.

She looks at him. He looks at her. The stars look at both of them.

MARA
I've been here since yesterday morning.

ELI
Waiting for something?

MARA
(a beat — the honest answer)
I don't think so. I think I was just... here.

He understands that. He nods the way you nod at something true.

He sits down on a rock. She sits on another, a few feet away. Not close. Not far.

The stars above them. The desert around them.

A long silence that isn't empty.

MARA (CONT'D)
What are you doing out here?

ELI
Same thing you are.

She almost smiles. Not quite. Close enough.

MARA
The world's pretty broken.

ELI
Yeah.

He looks up at the sky for a moment.

ELI (CONT'D)
Still some good pieces though.

She looks up at the stars. He looks up at the stars.

WIDE PULL: Camera moves slowly back. Two figures in one frame, the desert expanding around them, the stars enormous and indifferent and beautiful above. They stay where they are. Together without touching. Present without performing.

The camera keeps pulling back until they are very small and the sky is very large.

Then smaller.

Then gone into the dark.

THE WEAVE

FADE TO BLACK.`,
  }})

  console.log('  P6: The Weave — 3 scenes, 16 shots, 16 crew\n')

  // P6 — ProjectMembers (16 crew)
  await assignProjectCrew(p6.id, clydeBessey.id,    'director')
  await assignProjectCrew(p6.id, clydeBessey.id,    'producer', 'Production')
  await assignProjectCrew(p6.id, tylerHeckerman.id, 'producer')
  await assignProjectCrew(p6.id, kellyPratt.id,     'producer')
  await assignProjectCrew(p6.id, calebStone.id,     'crew')
  await assignProjectCrew(p6.id, mayaLin.id,    'crew')
  await assignProjectCrew(p6.id, darioReyes.id, 'crew')
  await assignProjectCrew(p6.id, samPark.id,    'crew')
  await assignProjectCrew(p6.id, petraWalsh.id, 'crew')
  await assignProjectCrew(p6.id, omarRashid.id, 'crew')
  await assignProjectCrew(p6.id, chrisTan.id,   'crew')
  await assignProjectCrew(p6.id, rinaCole.id,   'coordinator')
  await assignProjectCrew(p6.id, leoMarsh.id,   'crew')
  await assignProjectCrew(p6.id, veraKoss.id,   'crew')
  await assignProjectCrew(p6.id, danaVance.id,  'crew')
  await assignProjectCrew(p6.id, tylerReed.id,  'crew')
  await assignProjectCrew(p6.id, sofiaAvila.id, 'crew')

  // P6 — Milestones (11)
  await prisma.milestone.createMany({ data: [
    { projectId: p6.id, title: 'Script locked',                                date: new Date('2026-03-28'), status: 'completed' },
    { projectId: p6.id, title: 'Full crew deals closed',                      date: new Date('2026-04-01'), status: 'completed' },
    { projectId: p6.id, title: 'All location permits cleared',                date: new Date('2026-04-05'), status: 'completed' },
    { projectId: p6.id, title: 'Day 1 — Desert Flats, Mojave',               date: new Date('2026-04-09'), status: 'completed' },
    { projectId: p6.id, title: 'Day 2 — Ravine, Malibu Creek',               date: new Date('2026-04-10'), status: 'completed' },
    { projectId: p6.id, title: 'Day 3 — Night Exterior, Joshua Tree',        date: new Date('2026-04-11'), status: 'in_progress' },
    { projectId: p6.id, title: 'Company wrap',                               date: new Date('2026-04-12'), status: 'upcoming' },
    { projectId: p6.id, title: 'Assembly cut',                               date: new Date('2026-04-26'), status: 'upcoming' },
    { projectId: p6.id, title: "Director's cut delivered",                   date: new Date('2026-05-05'), status: 'upcoming' },
    { projectId: p6.id, title: 'Sound design + original score complete',     date: new Date('2026-05-15'), status: 'upcoming' },
    { projectId: p6.id, title: 'Picture lock',                               date: new Date('2026-05-20'), status: 'upcoming' },
  ]})

  // P6 — Action Items (8)
  await prisma.actionItem.createMany({ data: [
    { projectId: p6.id, title: 'Night shoot equipment check — full lighting rig',    assignedTo: darioReyes.id, dueDate: new Date('2026-04-11'), status: 'done' },
    { projectId: p6.id, title: 'Generator fuel and placement confirmed',             assignedTo: tylerReed.id,  dueDate: new Date('2026-04-11'), status: 'done' },
    { projectId: p6.id, title: 'Night location walk — DP + Director + AD',          assignedTo: calebStone.id, dueDate: new Date('2026-04-11'), status: 'done' },
    { projectId: p6.id, title: 'Continuity notes Days 1+2 compiled',               assignedTo: danaVance.id,  dueDate: new Date('2026-04-11'), status: 'done' },
    { projectId: p6.id, title: 'Night location permit confirmed — Joshua Tree NPS', assignedTo: tylerHeckerman.id, dueDate: new Date('2026-04-10'), status: 'done' },
    { projectId: p6.id, title: 'Assembly cut editor confirmed and booked',          assignedTo: kellyPratt.id,     dueDate: new Date('2026-04-12'), status: 'in_progress' },
    { projectId: p6.id, title: 'Score composer brief',                              assignedTo: clydeBessey.id,    dueDate: new Date('2026-04-20'), status: 'open' },
    { projectId: p6.id, title: 'Festival delivery specs — DCP + digital',          assignedTo: tylerHeckerman.id, dueDate: new Date('2026-05-25'), status: 'open' },
  ]})

  // ── P6 Locations ────────────────────────────────────────────────────────
  // Replaced the prior "Industrial Warehouse" entries (never matched the script)
  // with three script-accurate physical locations, one per scene.
  await prisma.location.createMany({ data: [
    { projectId: p6.id, entityId: p6EntDesert.id, name: 'Mojave Desert — open flats',         address: 'Mojave, CA (dispersed BLM use area)',       status: 'confirmed', approved: true, description: 'Flat pale scrubland. Scene 1 "Apogee — Eli". Wide horizons, aerial access, no structure in frame.', keyContact: 'BLM Barstow Field Office — (760) 555-0211', shootDates: 'Apr 9 (completed)',  sceneTab: 'EXT Day',   sortOrder: 0 },
    { projectId: p6.id, entityId: p6EntRavine.id, name: 'Malibu Creek State Park — ravine edge', address: '1925 Las Virgenes Rd, Calabasas, CA 91302', status: 'confirmed', approved: true, description: 'Sandstone ravine above Malibu Creek. Scene 2 "The Edge — Mara". Cliffside staging with approved safety setback.', keyContact: 'CA State Parks Film Unit — (818) 555-0290', shootDates: 'Apr 10 (completed)', sceneTab: 'EXT Day',   sortOrder: 1 },
    { projectId: p6.id, entityId: p6EntJT.id,     name: 'Joshua Tree National Park — night stars', address: 'Joshua Tree National Park, CA 92277',    status: 'confirmed', approved: true, description: 'Night desert under full stars. Scene 3 "Collision". NPS film permit — cold-light only, no generator lights on the skyline.', keyContact: 'NPS Film Unit — JT — (760) 555-0362',      shootDates: 'Apr 11 (tonight, call 7PM)', sceneTab: 'EXT Night', sortOrder: 2 },
  ]})

  // P6 — Workflow nodes (9)
  const p6wn1 = await prisma.workflowNode.create({ data: { projectId: p6.id, label: 'Camera Ingest',    type: 'ingest',   software: 'DaVinci Resolve',      assigneeId: calebStone.id, notes: 'ARRI Alexa Mini LF, multi-cam',                                sortOrder: 0 }})
  const p6wn2 = await prisma.workflowNode.create({ data: { projectId: p6.id, label: 'Dailies',          type: 'ingest',   software: 'DaVinci Resolve',      assigneeId: mayaLin.id,    notes: 'Same-day proxy delivery for director review',                  sortOrder: 1 }})
  const p6wn3 = await prisma.workflowNode.create({ data: { projectId: p6.id, label: 'Offline Edit',     type: 'edit',     software: 'Avid Media Composer',  assigneeId: null,          notes: 'Feature assembly. Sundance target.',                           sortOrder: 2 }})
  const p6wn4 = await prisma.workflowNode.create({ data: { projectId: p6.id, label: 'VFX',              type: 'vfx',      software: 'Nuke',                 assigneeId: null,          notes: 'Night sky enhancement, seamless compositing for collision scene', sortOrder: 3 }})
  const p6wn5 = await prisma.workflowNode.create({ data: { projectId: p6.id, label: 'Color Grade',      type: 'color',    software: 'DaVinci Resolve',      assigneeId: null,          notes: 'Cinematic filmic. Deep shadows, protected highlights.',        sortOrder: 4 }})
  const p6wn6 = await prisma.workflowNode.create({ data: { projectId: p6.id, label: 'Sound Design',     type: 'sound',    software: 'Pro Tools',            assigneeId: null,          notes: 'Desert wind, night ambience — immersive bed',                  sortOrder: 5 }})
  const p6wn7 = await prisma.workflowNode.create({ data: { projectId: p6.id, label: 'Sound Mix',        type: 'sound',    software: 'Pro Tools',            assigneeId: null,          notes: '5.1 theatrical + stereo downmix',                              sortOrder: 6 }})
  const p6wn8 = await prisma.workflowNode.create({ data: { projectId: p6.id, label: 'Online / Conform', type: 'edit',     software: 'DaVinci Resolve',      assigneeId: null,          notes: 'Picture lock conform + final grade match',                     sortOrder: 7 }})
  const p6wn9 = await prisma.workflowNode.create({ data: { projectId: p6.id, label: 'Final Delivery',   type: 'delivery', software: 'DCP-o-matic',          assigneeId: null,          notes: 'DCP + digital deliverables',                                    sortOrder: 8 }})

  // P6 — Workflow edges (8)
  await prisma.workflowEdge.createMany({ data: [
    { projectId: p6.id, sourceId: p6wn1.id, targetId: p6wn2.id, inputFormat: 'ARRIRAW',                   outputFormat: 'ProRes Proxy',                 format: 'Dailies' },
    { projectId: p6.id, sourceId: p6wn2.id, targetId: p6wn3.id, inputFormat: 'ProRes Proxy',              outputFormat: 'AAF + Picture',                format: 'Offline' },
    { projectId: p6.id, sourceId: p6wn3.id, targetId: p6wn4.id, inputFormat: 'AAF + Picture',             outputFormat: 'EXR plates + Nuke scripts',    format: 'VFX Pull' },
    { projectId: p6.id, sourceId: p6wn4.id, targetId: p6wn5.id, inputFormat: 'EXR plates + Nuke scripts', outputFormat: 'ProRes 4444 XQ',               format: 'VFX Comps' },
    { projectId: p6.id, sourceId: p6wn5.id, targetId: p6wn6.id, inputFormat: 'ProRes 4444 XQ',            outputFormat: 'Pro Tools session',            format: 'Sound Design' },
    { projectId: p6.id, sourceId: p6wn6.id, targetId: p6wn7.id, inputFormat: 'Pro Tools session',         outputFormat: 'Printmaster + stems',          format: 'Mix' },
    { projectId: p6.id, sourceId: p6wn7.id, targetId: p6wn8.id, inputFormat: 'Printmaster + stems',       outputFormat: 'ProRes 4444 XQ',               format: 'Online' },
    { projectId: p6.id, sourceId: p6wn8.id, targetId: p6wn9.id, inputFormat: 'ProRes 4444 XQ',            outputFormat: 'DCP + H.264',                  format: 'Master + Web' },
  ]})

  // P6 — Deliverables (3)
  await prisma.deliverable.createMany({ data: [
    { projectId: p6.id, title: 'Feature DCP',      length: '87:00', format: 'DCP',   aspectRatio: '2.39:1', resolution: '4096x1716', colorSpace: "X'Y'Z' (DCI-P3)", soundSpecs: '5.1 Surround Mix',  sortOrder: 0 },
    { projectId: p6.id, title: 'Festival Trailer', length: '02:00', format: 'H.264', aspectRatio: '2.39:1', resolution: '3840x1608', colorSpace: 'Rec.709',          soundSpecs: 'Stereo -14 LUFS',  sortOrder: 1 },
    { projectId: p6.id, title: 'Social Cutdown',   length: '01:30', format: 'H.264', aspectRatio: '16:9',   resolution: '1920x1080', colorSpace: 'Rec.709',          soundSpecs: 'Stereo -16 LUFS',  sortOrder: 2 },
  ]})

  // P6 — Moodboard (1 tab, 6 refs)
  const p6mbTab = await prisma.moodboardTab.create({ data: { projectId: p6.id, name: 'FRACTURE — The Weave', sortOrder: 0 }})
  await prisma.moodboardRef.createMany({ data: [
    { projectId: p6.id, tabId: p6mbTab.id, title: 'Apogee',                cat: 'tone',   note: 'The farthest point from everything. Solitude as state, not circumstance.', sortOrder: 0 },
    { projectId: p6.id, tabId: p6mbTab.id, title: 'The Mirror Structure',  cat: 'tone',   note: 'Eli and Mara — same scene, different earth. Everything rhymes.',          sortOrder: 1 },
    { projectId: p6.id, tabId: p6mbTab.id, title: 'Night Stars — Mojave',  cat: 'visual', note: 'Natural starlight. Practical lanterns only. The sky as third character.', sortOrder: 2 },
    { projectId: p6.id, tabId: p6mbTab.id, title: 'Wardrobe Texture',      cat: 'visual', note: 'Weathered linen, dusty denim. Lived-in, never styled.',                   sortOrder: 3 },
    { projectId: p6.id, tabId: p6mbTab.id, title: 'Score Reference',       cat: 'music',  note: 'Bobby Krlic — Midsommar. Spare, unsettling beauty.',                      sortOrder: 4 },
    { projectId: p6.id, tabId: p6mbTab.id, title: 'FRACTURE Universe',     cat: 'tone',   note: 'Part of the B Story FRACTURE multiverse. Threads weave into larger work.', sortOrder: 5 },
  ]})

  // ── Seed images: MoodboardRef ────────────────────────────────────────────
  console.log('  Uploading moodboard images…')
  const moodboardEntries = MANIFEST.filter((e) => e.surface === 'moodboard')
  let moodboardUploaded = 0, moodboardMissing = 0
  for (const entry of moodboardEntries) {
    if (entry.projectKey === 'crew') continue
    const projectId = projectIdByKey(entry.projectKey)
    const ref = await prisma.moodboardRef.findFirst({
      where: { projectId, title: entry.matchByName },
    })
    if (!ref) {
      console.warn(`    ! moodboard ref not found: ${entry.projectKey}/${entry.matchByName}`)
      moodboardMissing++
      continue
    }
    const sp = storagePath(entry, projectId)
    await uploadSeedImage({
      localRelativePath: localFilePath(entry),
      bucket: 'moodboard',
      storagePath: sp,
    })
    // MoodboardRef.imageUrl convention is a full public URL (matches what
    // uploadMoodboardImage returns from the app — see queries.ts).
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/moodboard/${sp}`
    await prisma.moodboardRef.update({
      where: { id: ref.id },
      data: { imageUrl: publicUrl },
    })
    moodboardUploaded++
  }
  console.log(`  Moodboard images: uploaded ${moodboardUploaded}, missing-row ${moodboardMissing}`)

  // ══════════════════════════════════════════════════════════════════════════
  // P7 — THREADS
  // 26 threads across all 6 projects. 9 unread, 10 read, 7 resolved.
  // Clyde Bessey is "me" for inbox purposes — unread = no ThreadRead for Clyde.
  // ══════════════════════════════════════════════════════════════════════════

  // P7 Threads — wipe and reseed (redundant with main wipe above, but safe)
  await prisma.threadRead.deleteMany()
  await prisma.threadMessage.deleteMany()
  await prisma.thread.deleteMany()
  console.log('  Threads: cleared')

  const NOW = new Date('2026-04-20T14:00:00Z')
  const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 60 * 60 * 1000)
  const daysAgo  = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000)

  async function mustFind<T>(label: string, p: Promise<T | null | undefined>): Promise<T> {
    const r = await p
    if (!r) throw new Error(`[threads seed] lookup failed: ${label}`)
    return r
  }

  // ── Entity / record lookups ─────────────────────────────────────────────

  // P1
  const p1LocVilla    = await mustFind('P1 location Villa Serena',          prisma.location.findFirst({ where: { projectId: p1.id, name: { contains: 'Villa Serena' } } }))
  const p1Shot03C     = await mustFind('P1 shot 03C',                       prisma.shot.findFirst({ where: { shotNumber: '03C', scene: { projectId: p1.id } } }))
  const p1PropSerum   = await mustFind('P1 prop Lumiere Serum',             prisma.entity.findFirst({ where: { projectId: p1.id, type: 'prop', name: 'Lumiere Serum' } }))
  const p1MilestoneLS = await mustFind('P1 milestone Location shortlist',   prisma.milestone.findFirst({ where: { projectId: p1.id, title: { contains: 'Location shortlist' } } }))
  const p1AiPermit    = await mustFind('P1 actionItem estate permit',       prisma.actionItem.findFirst({ where: { projectId: p1.id, title: { contains: 'estate permit' } } }))

  // P2
  const p2Shot02A     = await mustFind('P2 shot 02A',                       prisma.shot.findFirst({ where: { shotNumber: '02A', scene: { projectId: p2.id } } }))
  const p2LocRooftop  = await mustFind('P2 location DTLA Rooftop',          prisma.location.findFirst({ where: { projectId: p2.id, name: { contains: 'Rooftop' } } }))
  const p2DelivIG     = await mustFind('P2 deliverable IG Reel',            prisma.deliverable.findFirst({ where: { projectId: p2.id, title: { contains: 'IG Reel' } } }))
  const p2AiReleases  = await mustFind('P2 actionItem athlete releases',    prisma.actionItem.findFirst({ where: { projectId: p2.id, title: { contains: 'release forms' } } }))

  // P3
  const p3CharWine    = await mustFind('P3 character The Winemaker',        prisma.entity.findFirst({ where: { projectId: p3.id, type: 'character', name: 'The Winemaker' } }))
  const p3LocCellar   = await mustFind('P3 location St. Helena Cellar',     prisma.location.findFirst({ where: { projectId: p3.id, name: { contains: 'Barrel Cellar' } } }))
  const p3MilestoneD1 = await mustFind('P3 milestone Day 1 Vineyard',       prisma.milestone.findFirst({ where: { projectId: p3.id, title: { contains: 'Day 1 — Vineyard' } } }))

  // P4
  const p4PropBolster = await mustFind('P4 prop Bolster',                   prisma.entity.findFirst({ where: { projectId: p4.id, type: 'prop', name: 'Bolster' } }))
  const p4Shot02E     = await mustFind('P4 shot 02E',                       prisma.shot.findFirst({ where: { shotNumber: '02E', scene: { projectId: p4.id } } }))

  // P5
  const p5DelivHero   = await mustFind('P5 deliverable Hero Film',          prisma.deliverable.findFirst({ where: { projectId: p5.id, title: 'Hero Film' } }))
  const p5MilestoneVO = await mustFind('P5 milestone VO recording',         prisma.milestone.findFirst({ where: { projectId: p5.id, title: { contains: 'VO recording session' } } }))

  // P6
  // NOTE: "Joshua Tree, Night Ext" exists only as an Entity (type=location), not in
  // the Location table. Attaching T22 to the matching milestone instead — flagged in report.
  const p6MilestoneJT = await mustFind('P6 milestone Day 3 Joshua Tree',    prisma.milestone.findFirst({ where: { projectId: p6.id, title: { contains: 'Day 3 — Night Exterior, Joshua Tree' } } }))
  const p6Shot03A     = await mustFind('P6 shot 03A',                       prisma.shot.findFirst({ where: { shotNumber: '03A', scene: { projectId: p6.id } } }))
  const p6MoodNight   = await mustFind('P6 moodboardRef Night Stars',       prisma.moodboardRef.findFirst({ where: { projectId: p6.id, title: { contains: 'Night Stars' } } }))
  const p6AiPermit    = await mustFind('P6 actionItem Joshua Tree permit',  prisma.actionItem.findFirst({ where: { projectId: p6.id, title: { contains: 'Night location permit' } } }))

  // ── P1 Threads (6) ──────────────────────────────────────────────────────

  const t1 = await prisma.thread.create({ data: { projectId: p1.id, attachedToType: 'location', attachedToId: p1LocVilla.id,    createdBy: tylerHeckerman.id, createdAt: hoursAgo(3),  updatedAt: hoursAgo(3)  } })
  await prisma.threadMessage.createMany({ data: [
    { threadId: t1.id, createdBy: tylerHeckerman.id, createdAt: hoursAgo(3),   content: "Called Patricia at Villa Serena — she's asking if we can push load-in from 5am to 5:30am. Says neighbors complained last shoot. Manageable?" },
    { threadId: t1.id, createdBy: tylerHeckerman.id, createdAt: hoursAgo(2.5), content: "Also confirming the 20-amp circuits are only east wing. Distro'll handle it but wanted you to know for placement." },
  ]})

  const t2 = await prisma.thread.create({ data: { projectId: p1.id, attachedToType: 'cast', attachedToId: p1tCamille.id, createdBy: veraHastings.id, createdAt: hoursAgo(6), updatedAt: hoursAgo(6) } })
  await prisma.threadMessage.create({ data: {
    threadId: t2.id, createdBy: veraHastings.id, createdAt: hoursAgo(6),
    content: "Camille's team is asking about hair length for the bathroom scene — they want to trim 2 inches before shoot day. Said they'll hold unless you say otherwise.",
  }})

  const t3 = await prisma.thread.create({ data: { projectId: p1.id, attachedToType: 'shot', attachedToId: p1Shot03C.id, createdBy: clydeBessey.id, createdAt: daysAgo(2), updatedAt: daysAgo(2) } })
  await prisma.threadMessage.createMany({ data: [
    { threadId: t3.id, createdBy: clydeBessey.id,  createdAt: daysAgo(2),                                                   content: "Theo — for the final push-in on 03C, I want us on a slider not a dolly. The move needs to be mechanical, not emotional." },
    { threadId: t3.id, createdBy: theoHartmann.id, createdAt: new Date(daysAgo(2).getTime() + 30 * 60 * 1000),              content: "On it. I'll set the slider up by the mirror before first light so we can rehearse with Camille." },
    { threadId: t3.id, createdBy: clydeBessey.id,  createdAt: new Date(daysAgo(2).getTime() + 45 * 60 * 1000),              content: "Good. And let's not push past her eyes — hold on the reflection, not the face." },
  ]})
  await prisma.threadRead.create({ data: { threadId: t3.id, userId: clydeBessey.id, lastReadAt: daysAgo(1) } })

  const t4 = await prisma.thread.create({ data: { projectId: p1.id, attachedToType: 'prop', attachedToId: p1PropSerum.id, createdBy: claireRenault.id, createdAt: daysAgo(1), updatedAt: daysAgo(1) } })
  await prisma.threadMessage.createMany({ data: [
    { threadId: t4.id, createdBy: claireRenault.id, createdAt: daysAgo(1),                                                   content: "Product arrives tomorrow. Brand is sending 6 units total — 4 hero, 2 backup. Want them all chilled for the glycerin drop shot?" },
    { threadId: t4.id, createdBy: clydeBessey.id,   createdAt: new Date(daysAgo(1).getTime() + 20 * 60 * 1000),              content: "Chill all 6. Backup bottles for insert coverage in case we lose one." },
  ]})
  await prisma.threadRead.create({ data: { threadId: t4.id, userId: clydeBessey.id, lastReadAt: hoursAgo(20) } })

  const t5 = await prisma.thread.create({ data: {
    projectId: p1.id, attachedToType: 'milestone', attachedToId: p1MilestoneLS.id, createdBy: tylerHeckerman.id,
    createdAt: daysAgo(6), updatedAt: daysAgo(3),
    resolvedAt: daysAgo(3), resolvedBy: clydeBessey.id,
  }})
  await prisma.threadMessage.createMany({ data: [
    { threadId: t5.id, createdBy: tylerHeckerman.id, createdAt: daysAgo(6),                                                  content: "Client approved Villa Serena and Milk Studios. Greystone still pending but I have Will Rogers as backup if it falls through." },
    { threadId: t5.id, createdBy: clydeBessey.id,    createdAt: new Date(daysAgo(6).getTime() + 60 * 60 * 1000),             content: "Great. Let's not wait on Greystone past Wednesday — pivot to backup if we don't have paper." },
    { threadId: t5.id, createdBy: tylerHeckerman.id, createdAt: new Date(daysAgo(6).getTime() + 90 * 60 * 1000),             content: "Understood. Deadline set internally." },
  ]})

  const t6 = await prisma.thread.create({ data: {
    projectId: p1.id, attachedToType: 'actionItem', attachedToId: p1AiPermit.id, createdBy: tylerHeckerman.id,
    createdAt: daysAgo(4), updatedAt: daysAgo(2),
    resolvedAt: daysAgo(2), resolvedBy: clydeBessey.id,
  }})
  await prisma.threadMessage.createMany({ data: [
    { threadId: t6.id, createdBy: tylerHeckerman.id, createdAt: daysAgo(4),                                                  content: "Insurance certificate delivered. Permit signed by estate owner. All paper done." },
    { threadId: t6.id, createdBy: clydeBessey.id,    createdAt: new Date(daysAgo(4).getTime() + 15 * 60 * 1000),             content: "Clean. Thanks." },
  ]})

  // ── P2 Threads (5) ──────────────────────────────────────────────────────

  const t7 = await prisma.thread.create({ data: { projectId: p2.id, attachedToType: 'shot', attachedToId: p2Shot02A.id, createdBy: daniReeves.id, createdAt: hoursAgo(2), updatedAt: hoursAgo(2) } })
  await prisma.threadMessage.create({ data: {
    threadId: t7.id, createdBy: daniReeves.id, createdAt: hoursAgo(2),
    content: "Zoe wants a second take after the ridge crest — she says her eyeline was wrong on the first and she can nail it. Do we have time before we lose light?",
  }})

  const t8 = await prisma.thread.create({ data: { projectId: p2.id, attachedToType: 'location', attachedToId: p2LocRooftop.id, createdBy: tylerHeckerman.id, createdAt: hoursAgo(5), updatedAt: hoursAgo(4.5) } })
  await prisma.threadMessage.createMany({ data: [
    { threadId: t8.id, createdBy: tylerHeckerman.id, createdAt: hoursAgo(5),   content: "Derek at the building just flagged — freight elevator has a weight limit of 3000 lbs. We're borderline with the full grip package. Do we trim?" },
    { threadId: t8.id, createdBy: tylerHeckerman.id, createdAt: hoursAgo(4.5), content: "Backup is Grand Park courts but we lose the skyline. Your call." },
  ]})

  const t9 = await prisma.thread.create({ data: { projectId: p2.id, attachedToType: 'workflowStage', attachedToId: p2wn2.id, createdBy: tylerGreen.id, createdAt: daysAgo(1), updatedAt: daysAgo(1) } })
  await prisma.threadMessage.createMany({ data: [
    { threadId: t9.id, createdBy: tylerGreen.id, createdAt: daysAgo(1),                                              content: "Day 1 proxies are done, on the shared drive. Started Day 2 ingest — will have proxies for your review by 8pm." },
    { threadId: t9.id, createdBy: clydeBessey.id, createdAt: new Date(daysAgo(1).getTime() + 30 * 60 * 1000),        content: "Good. Let me know if any of the helmet cam footage has rolling shutter issues — I want to flag before we shoot Day 3." },
    { threadId: t9.id, createdBy: tylerGreen.id, createdAt: new Date(daysAgo(1).getTime() + 45 * 60 * 1000),         content: "Will do. First pass looks clean so far." },
  ]})
  await prisma.threadRead.create({ data: { threadId: t9.id, userId: clydeBessey.id, lastReadAt: hoursAgo(18) } })

  const t10 = await prisma.thread.create({ data: { projectId: p2.id, attachedToType: 'deliverable', attachedToId: p2DelivIG.id, createdBy: kellyPratt.id, createdAt: daysAgo(2), updatedAt: daysAgo(2) } })
  await prisma.threadMessage.createMany({ data: [
    { threadId: t10.id, createdBy: kellyPratt.id,  createdAt: daysAgo(2),                                             content: "Vanta's social lead asked if the 9:16 cut can feature all three athletes in one — not three separate cuts. Thoughts?" },
    { threadId: t10.id, createdBy: clydeBessey.id, createdAt: new Date(daysAgo(2).getTime() + 60 * 60 * 1000),        content: "Yes. Make it a sequence — one athlete per 5 seconds. Build to the skate landing." },
  ]})
  await prisma.threadRead.create({ data: { threadId: t10.id, userId: clydeBessey.id, lastReadAt: daysAgo(1) } })

  const t11 = await prisma.thread.create({ data: {
    projectId: p2.id, attachedToType: 'actionItem', attachedToId: p2AiReleases.id, createdBy: kellyPratt.id,
    createdAt: daysAgo(5), updatedAt: daysAgo(3),
    resolvedAt: daysAgo(3), resolvedBy: clydeBessey.id,
  }})
  await prisma.threadMessage.createMany({ data: [
    { threadId: t11.id, createdBy: kellyPratt.id,  createdAt: daysAgo(5),                                             content: "All three signed and filed. Marco's came in last — his agent wanted one extra clause on social usage." },
    { threadId: t11.id, createdBy: clydeBessey.id, createdAt: new Date(daysAgo(5).getTime() + 30 * 60 * 1000),        content: "Good work. Let's proceed." },
  ]})

  // ── P3 Threads (4) ──────────────────────────────────────────────────────

  // T12 creator: Dana Vance (per PR spec). Dana is on P6 crew, not P3 — flagged in report.
  const t12 = await prisma.thread.create({ data: { projectId: p3.id, attachedToType: 'character', attachedToId: p3CharWine.id, createdBy: danaVance.id, createdAt: hoursAgo(4), updatedAt: hoursAgo(4) } })
  await prisma.threadMessage.create({ data: {
    threadId: t12.id, createdBy: danaVance.id, createdAt: hoursAgo(4),
    content: "Reviewing Day 1 transcripts — Marcus talks less than we thought. Most of his answers are under 30 seconds. Is that working for you or do we push him more on Day 2?",
  }})

  const t13 = await prisma.thread.create({ data: { projectId: p3.id, attachedToType: 'location', attachedToId: p3LocCellar.id, createdBy: ryanCole.id, createdAt: daysAgo(1), updatedAt: daysAgo(1) } })
  await prisma.threadMessage.createMany({ data: [
    { threadId: t13.id, createdBy: ryanCole.id,    createdAt: daysAgo(1),                                              content: "Dan Moretti confirmed the cellar is ours from 10am. He wants us to use the loading dock entrance — NOT the main door, it disrupts the tasting room." },
    { threadId: t13.id, createdBy: clydeBessey.id, createdAt: new Date(daysAgo(1).getTime() + 20 * 60 * 1000),         content: "Copy. Let's all come in through the dock. No exceptions." },
  ]})
  await prisma.threadRead.create({ data: { threadId: t13.id, userId: clydeBessey.id, lastReadAt: hoursAgo(16) } })

  const t14 = await prisma.thread.create({ data: { projectId: p3.id, attachedToType: 'crew', attachedToId: owenBlakely.id, createdBy: owenBlakely.id, createdAt: daysAgo(2), updatedAt: daysAgo(2) } })
  await prisma.threadMessage.createMany({ data: [
    { threadId: t14.id, createdBy: owenBlakely.id, createdAt: daysAgo(2),                                              content: "For the cellar interview — I want to use natural light from the single window only, no fill. Darker than my Day 1 setup but truer to the space. OK to try?" },
    { threadId: t14.id, createdBy: clydeBessey.id, createdAt: new Date(daysAgo(2).getTime() + 30 * 60 * 1000),         content: "Yes. If it's too dark we'll adjust but I want to see what that looks like first." },
  ]})
  await prisma.threadRead.create({ data: { threadId: t14.id, userId: clydeBessey.id, lastReadAt: daysAgo(1) } })

  const t15 = await prisma.thread.create({ data: {
    projectId: p3.id, attachedToType: 'milestone', attachedToId: p3MilestoneD1.id, createdBy: clydeBessey.id,
    createdAt: daysAgo(7), updatedAt: daysAgo(4),
    resolvedAt: daysAgo(4), resolvedBy: clydeBessey.id,
  }})
  await prisma.threadMessage.createMany({ data: [
    { threadId: t15.id, createdBy: clydeBessey.id,    createdAt: daysAgo(7),                                           content: "Day 1 done. Paul was remarkable — we got the take on the dirt where he actually smells it and it lands. That's our anchor." },
    { threadId: t15.id, createdBy: tylerHeckerman.id, createdAt: new Date(daysAgo(7).getTime() + 45 * 60 * 1000),      content: "Great day. Wrapped early enough to pre-light for Day 2." },
  ]})

  // ── P4 Threads (3) ──────────────────────────────────────────────────────

  // T16 creator: Tyler Moss (per PR reassignment — Claire not on P4)
  const t16 = await prisma.thread.create({ data: { projectId: p4.id, attachedToType: 'prop', attachedToId: p4PropBolster.id, createdBy: tylerMoss.id, createdAt: hoursAgo(8), updatedAt: hoursAgo(8) } })
  await prisma.threadMessage.create({ data: {
    threadId: t16.id, createdBy: tylerMoss.id, createdAt: hoursAgo(8),
    content: "The linen bolster isn't in yet — vendor says 48 hours. Do we push the supine sequences to Day 2 or use a substitute?",
  }})

  const t17 = await prisma.thread.create({ data: { projectId: p4.id, attachedToType: 'shot', attachedToId: p4Shot02E.id, createdBy: alexDrum.id, createdAt: daysAgo(2), updatedAt: daysAgo(2) } })
  await prisma.threadMessage.createMany({ data: [
    { threadId: t17.id, createdBy: alexDrum.id,    createdAt: daysAgo(2),                                              content: "For the overhead — I want to rig directly above Kaia, not a jib arm. Cleaner, more meditative. Takes 45 min to set. OK for the schedule?" },
    { threadId: t17.id, createdBy: clydeBessey.id, createdAt: new Date(daysAgo(2).getTime() + 25 * 60 * 1000),         content: "Yes. That's worth the time." },
  ]})
  await prisma.threadRead.create({ data: { threadId: t17.id, userId: clydeBessey.id, lastReadAt: daysAgo(1) } })

  const t18 = await prisma.thread.create({ data: {
    projectId: p4.id, attachedToType: 'cast', attachedToId: p4tKaia.id, createdBy: kellyPratt.id,
    createdAt: daysAgo(6), updatedAt: daysAgo(3),
    resolvedAt: daysAgo(3), resolvedBy: clydeBessey.id,
  }})
  await prisma.threadMessage.createMany({ data: [
    { threadId: t18.id, createdBy: kellyPratt.id,  createdAt: daysAgo(6),                                              content: "Kaia approved the Episode 1 outline and the wardrobe direction. She's all in." },
    { threadId: t18.id, createdBy: clydeBessey.id, createdAt: new Date(daysAgo(6).getTime() + 60 * 60 * 1000),         content: "Great. Let's lock prep for next week." },
  ]})

  // ── P5 Threads (3) ──────────────────────────────────────────────────────

  const t19 = await prisma.thread.create({ data: { projectId: p5.id, attachedToType: 'workflowStage', attachedToId: p5wn2.id, createdBy: cleoStrand.id, createdAt: hoursAgo(9), updatedAt: hoursAgo(9) } })
  await prisma.threadMessage.create({ data: {
    threadId: t19.id, createdBy: cleoStrand.id, createdAt: hoursAgo(9),
    content: "Style frames attached in the shared drive — pulled the blue from the Meridian brand palette, made the data streams translucent not solid. Want your eyes before I commit to full build.",
  }})

  const t20 = await prisma.thread.create({ data: { projectId: p5.id, attachedToType: 'deliverable', attachedToId: p5DelivHero.id, createdBy: rafiTorres.id, createdAt: daysAgo(3), updatedAt: daysAgo(3) } })
  await prisma.threadMessage.createMany({ data: [
    { threadId: t20.id, createdBy: rafiTorres.id,  createdAt: daysAgo(3),                                              content: "VO synced to timeline. Total runtime is 2:07 — seven seconds over. Where do I pull from?" },
    { threadId: t20.id, createdBy: clydeBessey.id, createdAt: new Date(daysAgo(3).getTime() + 35 * 60 * 1000),         content: "Cut the second mention of 'every sensor every satellite every buoy' down to just 'every sensor.' That gets you the time." },
    { threadId: t20.id, createdBy: rafiTorres.id,  createdAt: new Date(daysAgo(3).getTime() + 50 * 60 * 1000),         content: "On it." },
  ]})
  await prisma.threadRead.create({ data: { threadId: t20.id, userId: clydeBessey.id, lastReadAt: daysAgo(2) } })

  const t21 = await prisma.thread.create({ data: {
    projectId: p5.id, attachedToType: 'milestone', attachedToId: p5MilestoneVO.id, createdBy: rafiTorres.id,
    createdAt: daysAgo(5), updatedAt: daysAgo(3),
    resolvedAt: daysAgo(3), resolvedBy: clydeBessey.id,
  }})
  await prisma.threadMessage.createMany({ data: [
    { threadId: t21.id, createdBy: rafiTorres.id,  createdAt: daysAgo(5),                                              content: "VO session done. James nailed the 'we have never understood it less' beat on take 2. Files uploaded." },
    { threadId: t21.id, createdBy: clydeBessey.id, createdAt: new Date(daysAgo(5).getTime() + 20 * 60 * 1000),         content: "Perfect. Trust James." },
  ]})

  // ── P6 Threads (5) ──────────────────────────────────────────────────────

  // T22: original spec asked for location "Joshua Tree, Night Ext" — that name exists only
  // as an Entity row, not in the Location table. Re-attached to the matching milestone.
  const t22 = await prisma.thread.create({ data: { projectId: p6.id, attachedToType: 'milestone', attachedToId: p6MilestoneJT.id, createdBy: tylerHeckerman.id, createdAt: hoursAgo(1.5), updatedAt: hoursAgo(1.5) } })
  await prisma.threadMessage.create({ data: {
    threadId: t22.id, createdBy: tylerHeckerman.id, createdAt: hoursAgo(1.5),
    content: "NPS ranger just called — they want us off by 5am for sunrise tours. We had 6am. Tight but doable. Confirming with Caleb on shot order.",
  }})

  const t23 = await prisma.thread.create({ data: { projectId: p6.id, attachedToType: 'character', attachedToId: p6Eli.id, createdBy: danaVance.id, createdAt: hoursAgo(7), updatedAt: hoursAgo(7) } })
  await prisma.threadMessage.create({ data: {
    threadId: t23.id, createdBy: danaVance.id, createdAt: hoursAgo(7),
    content: "Continuity note — Marcus's jacket in Scene 1 had a torn left pocket. On Day 3 tonight the pocket is intact (new jacket from wardrobe). Do we address or let it breathe?",
  }})

  const t24 = await prisma.thread.create({ data: { projectId: p6.id, attachedToType: 'shot', attachedToId: p6Shot03A.id, createdBy: calebStone.id, createdAt: daysAgo(1), updatedAt: daysAgo(1) } })
  await prisma.threadMessage.createMany({ data: [
    { threadId: t24.id, createdBy: calebStone.id,  createdAt: daysAgo(1),                                              content: "For 03A — I want to start tight on the sky and pull back to reveal them. Opposite of the script (which is wide down to medium). Feels more right for the reveal. Thoughts?" },
    { threadId: t24.id, createdBy: clydeBessey.id, createdAt: new Date(daysAgo(1).getTime() + 30 * 60 * 1000),         content: "I'm open. Let's shoot both — script first, then your version. We'll decide in the edit." },
    { threadId: t24.id, createdBy: calebStone.id,  createdAt: new Date(daysAgo(1).getTime() + 45 * 60 * 1000),         content: "Copy. Thanks for trusting the instinct." },
  ]})
  await prisma.threadRead.create({ data: { threadId: t24.id, userId: clydeBessey.id, lastReadAt: hoursAgo(22) } })

  const t25 = await prisma.thread.create({ data: { projectId: p6.id, attachedToType: 'moodboardRef', attachedToId: p6MoodNight.id, createdBy: darioReyes.id, createdAt: daysAgo(2), updatedAt: daysAgo(2) } })
  await prisma.threadMessage.createMany({ data: [
    { threadId: t25.id, createdBy: darioReyes.id,  createdAt: daysAgo(2),                                              content: "Saw this moodboard ref — if we go full practical lanterns for the collision scene, we need 6 lanterns minimum for the full wide. We have 3. Can pick up more today." },
    { threadId: t25.id, createdBy: clydeBessey.id, createdAt: new Date(daysAgo(2).getTime() + 40 * 60 * 1000),         content: "Get 6. I want the light to feel earned — no augmentation." },
  ]})
  await prisma.threadRead.create({ data: { threadId: t25.id, userId: clydeBessey.id, lastReadAt: daysAgo(1) } })

  const t26 = await prisma.thread.create({ data: {
    projectId: p6.id, attachedToType: 'actionItem', attachedToId: p6AiPermit.id, createdBy: tylerHeckerman.id,
    createdAt: daysAgo(3), updatedAt: daysAgo(2),
    resolvedAt: daysAgo(2), resolvedBy: clydeBessey.id,
  }})
  await prisma.threadMessage.createMany({ data: [
    { threadId: t26.id, createdBy: tylerHeckerman.id, createdAt: daysAgo(3),                                           content: "Permit signed, on file. NPS is good with generator placement and lantern rig. We're clear for tonight." },
    { threadId: t26.id, createdBy: clydeBessey.id,    createdAt: new Date(daysAgo(3).getTime() + 10 * 60 * 1000),      content: "Thank you." },
  ]})

  console.log('  Threads: 26 (9 unread, 10 read, 7 resolved)')

  // ══════════════════════════════════════════════════════════════════════════
  // P8 — CREW TIMECARDS  (now-relative, generator-driven)
  // ~170-210 entries across all 6 projects, anchored on TODAY:
  //   - prep window:  TODAY-21 .. TODAY-12  (sparse, ~20% density)
  //   - shoot window: TODAY-10 .. TODAY-2   (heavy,  ~50% density)
  //   - wrap window:  TODAY-0  .. TODAY+2   (light,  ~15% density)
  // P5 (Natural Order) seeds a thin slice (4 shoot days, no reopens) so the
  // app sees a sparsely-populated project state without testing empty-state.
  // Status correlates with date: older = approved-heavy, newer = draft-heavy.
  // Rate coverage ~70%; per-project rate tier from PROJECT_TIER.
  // Clyde Bessey logs separately on his director and producer rows so the
  // multi-role schema (PR #16) is visibly exercised across all 6 projects.
  // Eligibility: department NOT IN ('Client', 'Other').
  // ══════════════════════════════════════════════════════════════════════════

  // Resolve a ProjectMember by (projectId, crew display name). Role-blind —
  // returns the first match. After PR #16/#17 a single User can hold multiple
  // ProjectMember rows per project under different roles, so callers that
  // care about the role must use findMemberByRole.
  // Kept for backward reference; new generator below uses findMemberByRole.
  async function findMember(projectId: string, name: string) {
    const m = await prisma.projectMember.findFirst({
      where: { projectId, user: { is: { name } } },
    })
    if (!m) throw new Error(`[timecards seed] ProjectMember '${name}' not found on project ${projectId}`)
    return m
  }

  // Role-aware variant — required for Clyde, who has both director and
  // producer rows per project (PR #17). Lets the generator place director-
  // flavour timecards on the director row and producer-flavour on the
  // producer row without ambiguity.
  async function findMemberByRole(projectId: string, name: string, role: Role) {
    const m = await prisma.projectMember.findFirst({
      where: { projectId, role, user: { is: { name } } },
    })
    if (!m) throw new Error(`[timecards seed] ProjectMember '${name}' (role=${role}) not found on project ${projectId}`)
    return m
  }

  // Legacy fixed-date helpers — preserved to keep older comment references
  // intact. The new generator uses relativeDate / relativeStamp instead.
  const tcDate  = (day: string) => new Date(`${day}T00:00:00.000Z`)
  const tcStamp = (day: string, hh: number) =>
    new Date(`${day}T${String(hh).padStart(2, '0')}:00:00.000Z`)
  void tcDate; void tcStamp; void findMember  // satisfy no-unused while keeping helpers documented

  // Now-relative date helpers. Negative = past, positive = future. Returned
  // as midnight UTC for date columns; relativeStamp adds an hour offset for
  // submittedAt / approvedAt / reopenedAt timestamps.
  function relativeDate(daysFromToday: number): Date {
    const d = new Date(TODAY)
    d.setUTCHours(0, 0, 0, 0)
    d.setUTCDate(d.getUTCDate() + daysFromToday)
    return d
  }
  function relativeStamp(daysFromToday: number, hour: number): Date {
    const d = relativeDate(daysFromToday)
    d.setUTCHours(hour, 0, 0, 0)
    return d
  }

  // Status by recency. Older entries skew approved, today/future skew draft.
  // The 'reopened' bucket is provisional — picked from approved entries by
  // a post-pass so the lifecycle (submitted → approved → reopened) is intact.
  type TStatus = 'draft' | 'submitted' | 'approved'
  function statusForDate(daysAgo: number, rng: () => number): TStatus {
    const r = rng()
    if (daysAgo >= 7) return r < 0.85 ? 'approved' : 'submitted'
    if (daysAgo >= 3) return r < 0.55 ? 'approved' : r < 0.85 ? 'submitted' : 'draft'
    if (daysAgo >= 0) return r < 0.15 ? 'approved' : r < 0.50 ? 'submitted' : 'draft'
    return 'draft' // future
  }

  // Random hours in 0.5 increments within [min, max].
  function randomHours(rng: () => number, min: number, max: number): number {
    const steps = Math.round((max - min) / 0.5)
    const k = Math.floor(rng() * (steps + 1))
    return min + k * 0.5
  }

  // Deterministic Fisher-Yates pick of N from arr.
  function pickN<T>(arr: readonly T[], n: number, rng: () => number): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a.slice(0, Math.max(0, Math.min(n, a.length)))
  }

  // Producer-pick for approvedBy / reopenedBy — deterministic: idx 0 approves,
  // idx 1 (or 0 if singleton) reopens. Producer pool typically includes
  // Tyler Heckerman, Kelly Pratt, and Clyde Bessey (post PR #17).
  function pickApprover(producers: { id: string }[]): string {
    return producers[0]?.id ?? '' // safe — every project has at least one producer
  }
  function pickReopener(producers: { id: string }[]): string {
    return (producers[1] ?? producers[0])?.id ?? ''
  }

  type Phase = 'prep' | 'shoot' | 'wrap'
  type ProjectMemberLite = { id: string; userId: string; user: { name: string } }

  type GenOpts = {
    project: { id: string; name: string }
    prepDayCount:   number
    shootDayCount:  number
    wrapDayCount:   number
    prepDensity:    number
    shootDensity:   number
    wrapDensity:    number
    activeLoggerCap: number
    clydeDirectorCount: number
    clydeProducerCount: number
    includeReopened: boolean
    reopenedTarget:  number  // 0 if !includeReopened
  }

  type TCRow = {
    projectId: string
    crewMemberId: string
    date: Date
    hours: number
    rate: number | null
    rateUnit: 'day' | 'hour' | null
    description: string
    status: TStatus | 'reopened'
    submittedAt?: Date
    approvedAt?: Date | null
    approvedBy?: string | null
    reopenedAt?: Date | null
    reopenedBy?: string | null
    reopenReason?: string | null
  }

  // Reopen-reason templates — kickbacks a real producer would actually send.
  const REOPEN_REASONS = [
    'Please split out the location move time as separate entries — needs to break out for the line-item audit.',
    'Hours look high for a prep day — confirm and resubmit, or break out activity if there was an evening pickup.',
    'Add detail to the description — what was the rebuild for, exactly?',
    'Rate looks off for this role — please double-check your day rate before resubmitting.',
  ]

  async function generateProjectTimecards(opts: GenOpts): Promise<TCRow[]> {
    const { project } = opts
    const tier = PROJECT_TIER[project.name] ?? 'standard'
    const rng = mulberry32(strHash(project.name))

    // Eligible crew (excl. Client/Other and excl. Clyde — Clyde is placed
    // explicitly below on his director and producer rows).
    const eligibleAll = await prisma.projectMember.findMany({
      where: {
        projectId: project.id,
        department: { notIn: ['Client', 'Other'] },
        user: { name: { not: 'Clyde Bessey' } },
      },
      select: { id: true, userId: true, user: { select: { name: true } } },
    }) as ProjectMemberLite[]

    // Producer pool for approvedBy / reopenedBy lookups. Includes Clyde's
    // producer row post-#17, so a project's "approver" can plausibly be any
    // producer including Clyde.
    const producers = await prisma.projectMember.findMany({
      where: { projectId: project.id, role: 'producer' },
      select: { id: true },
    })

    // Deterministically cap "active loggers" — not every eligible crew member
    // logs every day. The cap models real attendance.
    const activeLoggers = pickN(eligibleAll, Math.min(opts.activeLoggerCap, eligibleAll.length), rng)

    const rows: TCRow[] = []

    // ── Day windows ────────────────────────────────────────────────────────
    const prepDays:  number[] = []
    const shootDays: number[] = []
    const wrapDays:  number[] = []
    // Prep: -21 .. -(21 - prepCount + 1), inclusive
    for (let i = 0; i < opts.prepDayCount;  i++) prepDays.push(-21 + i)
    // Shoot: -10 .. -(10 - shootCount + 1)
    for (let i = 0; i < opts.shootDayCount; i++) shootDays.push(-10 + i)
    // Wrap: 0 .. wrapCount-1
    for (let i = 0; i < opts.wrapDayCount;  i++) wrapDays.push(i)

    // ── Per-day generation ─────────────────────────────────────────────────
    function pushDayEntries(dayOffset: number, phase: Phase, density: number) {
      const count = Math.round(activeLoggers.length * density)
      const todays = pickN(activeLoggers, count, rng)
      for (let i = 0; i < todays.length; i++) {
        const m = todays[i]
        rows.push(buildEntry(m, dayOffset, phase, i))
      }
    }
    function buildEntry(m: ProjectMemberLite, dayOffset: number, phase: Phase, salt: number): TCRow {
      const title = jobTitleForName(m.user.name)
      const rateBase = rateFor(title, tier)
      // 70% rate-populated, 30% null (drives the partial-coverage UI realism).
      const rate = rng() < 0.70 ? rateBase : null

      const hours =
        phase === 'prep'  ? randomHours(rng, 6, 10) :
        phase === 'shoot' ? randomHours(rng, 10, 14) :
                            randomHours(rng, 4, 8)

      const status = statusForDate(-dayOffset, rng)
      const description = descriptionFor(title, salt + Math.abs(dayOffset))

      const row: TCRow = {
        projectId: project.id,
        crewMemberId: m.id,
        date: relativeDate(dayOffset),
        hours,
        rate,
        // All seed rates are day rates (lowest rate is $250 — production-realistic
        // day rates, not hourly). When rate is null, rateUnit is null too.
        rateUnit: rate !== null ? 'day' : null,
        description,
        status,
      }
      if (status === 'submitted') {
        row.submittedAt = relativeStamp(dayOffset, 20)
      } else if (status === 'approved') {
        row.submittedAt = relativeStamp(dayOffset, 20)
        row.approvedAt  = relativeStamp(dayOffset + 1, 10)
        row.approvedBy  = pickApprover(producers)
      }
      return row
    }

    for (const d of prepDays)  pushDayEntries(d, 'prep',  opts.prepDensity)
    for (const d of shootDays) pushDayEntries(d, 'shoot', opts.shootDensity)
    for (const d of wrapDays)  pushDayEntries(d, 'wrap',  opts.wrapDensity)

    // ── Clyde dual-role placement ──────────────────────────────────────────
    // Director entries on shoot days; producer entries on different days
    // (offset to prep/shoot transitions and wrap) so the seed reads cleanly.
    const clydeDir = await findMemberByRole(project.id, 'Clyde Bessey', 'director')
    const clydeProd = await findMemberByRole(project.id, 'Clyde Bessey', 'producer')

    // Director days drawn from shoot window middle.
    const dirDayPool = shootDays.length > 0
      ? shootDays
      : [-5, -4, -3] // P5-style fallback
    const dirDays = pickN(dirDayPool, opts.clydeDirectorCount, rng)
    for (let i = 0; i < dirDays.length; i++) {
      const d = dirDays[i]
      const dirRate = rng() < 0.85 ? rateFor('Director', tier) : null   // Clyde almost always logs his rate
      rows.push({
        projectId: project.id,
        crewMemberId: clydeDir.id,
        date: relativeDate(d),
        hours: randomHours(rng, 8, 12),
        rate: dirRate,
        rateUnit: dirRate !== null ? 'day' : null,
        description: descriptionFor('Director', i + 7 + Math.abs(d)),
        status: statusForDate(-d, rng),
      })
      // Fill timestamps based on status
      const last = rows[rows.length - 1]
      if (last.status === 'submitted') {
        last.submittedAt = relativeStamp(d, 20)
      } else if (last.status === 'approved') {
        last.submittedAt = relativeStamp(d, 20)
        last.approvedAt = relativeStamp(d + 1, 10)
        last.approvedBy = pickApprover(producers)
      }
    }

    // Producer days drawn from wrap + late shoot, distinct from director days.
    const prodDayPool = [...wrapDays, ...shootDays.slice(-2)].filter(d => !dirDays.includes(d))
    const prodDays = pickN(prodDayPool.length > 0 ? prodDayPool : [-2, -1, 0], opts.clydeProducerCount, rng)
    for (let i = 0; i < prodDays.length; i++) {
      const d = prodDays[i]
      const prodRate = rng() < 0.85 ? rateFor('Producer', tier) : null
      rows.push({
        projectId: project.id,
        crewMemberId: clydeProd.id,
        date: relativeDate(d),
        hours: randomHours(rng, 6, 10),
        rate: prodRate,
        rateUnit: prodRate !== null ? 'day' : null,
        description: descriptionFor('Producer', i + 13 + Math.abs(d)),
        status: statusForDate(-d, rng),
      })
      const last = rows[rows.length - 1]
      if (last.status === 'submitted') {
        last.submittedAt = relativeStamp(d, 20)
      } else if (last.status === 'approved') {
        last.submittedAt = relativeStamp(d, 20)
        last.approvedAt = relativeStamp(d + 1, 10)
        last.approvedBy = pickApprover(producers)
      }
    }

    // ── Reopen post-pass — convert N old approved entries to full lifecycle ─
    if (opts.includeReopened && opts.reopenedTarget > 0) {
      const candidates = rows
        .map((r, idx) => ({ r, idx, age: Math.round((TODAY.getTime() - r.date.getTime()) / 86400000) }))
        .filter(x => x.r.status === 'approved' && x.age >= 7)
        .sort((a, b) => b.age - a.age)
      const picks = candidates.slice(0, opts.reopenedTarget)
      for (let i = 0; i < picks.length; i++) {
        const { r } = picks[i]
        // Reopen lands 2-3 days after the approval.
        const dayOffset = Math.round((r.date.getTime() - TODAY.getTime()) / 86400000)
        r.status = 'reopened'
        r.reopenedAt   = relativeStamp(dayOffset + 3, 14)
        r.reopenedBy   = pickReopener(producers)
        r.reopenReason = REOPEN_REASONS[i % REOPEN_REASONS.length]
      }
    }

    return rows
  }

  // Per-project options.
  const fullProject = (projectIdArg: { id: string; name: string }): GenOpts => ({
    project: projectIdArg,
    prepDayCount:  6,
    shootDayCount: 5,
    wrapDayCount:  3,
    prepDensity:   0.20,
    shootDensity:  0.50,
    wrapDensity:   0.15,
    activeLoggerCap:    8,
    clydeDirectorCount: 3,
    clydeProducerCount: 3,
    includeReopened:    true,
    reopenedTarget:     1,
  })
  const lightProject = (projectIdArg: { id: string; name: string }): GenOpts => ({
    project: projectIdArg,
    prepDayCount:  0,
    shootDayCount: 4,
    wrapDayCount:  1,
    prepDensity:   0,
    shootDensity:  0.30,
    wrapDensity:   0.20,
    activeLoggerCap:    5,
    clydeDirectorCount: 1,
    clydeProducerCount: 1,
    includeReopened:    false,
    reopenedTarget:     0,
  })

  const allRows: TCRow[] = []
  for (const proj of [
    fullProject(p1),
    fullProject(p2),
    fullProject(p3),
    fullProject(p4),
    lightProject(p5),
    fullProject(p6),
  ]) {
    const rows = await generateProjectTimecards(proj)
    allRows.push(...rows)
  }

  await prisma.crewTimecard.createMany({ data: allRows })

  // Per-project + status breakdown for the summary log.
  const perProjectCounts: Record<string, number> = {}
  const statusCounts: Record<string, number> = { draft: 0, submitted: 0, approved: 0, reopened: 0 }
  let withRate = 0
  for (const r of allRows) {
    perProjectCounts[r.projectId] = (perProjectCounts[r.projectId] ?? 0) + 1
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1
    if (r.rate !== null) withRate++
  }
  const perCount = (id: string) => perProjectCounts[id] ?? 0
  console.log(
    `  Timecards: ${allRows.length} ` +
    `(${perCount(p1.id)}/${perCount(p2.id)}/${perCount(p3.id)}/${perCount(p4.id)}/${perCount(p5.id)}/${perCount(p6.id)} across P1-P6; ` +
    `${statusCounts.approved} approved, ${statusCounts.submitted} submitted, ${statusCounts.draft} draft, ${statusCounts.reopened} reopened; ` +
    `${withRate}/${allRows.length} with rates)`
  )

  // ══════════════════════════════════════════════════════════════════════════
  // P9 — INVENTORY ITEMS
  // Six hand-written per-project blocks, Location-style. Status mix targets
  // a realistic mid-production portfolio with packed-heavy weight; per-project
  // skew respects each show's phase (P1 packed-heavy one-day, P2 needed/
  // ordered-heavy pre-pro, P3 producing, P4 prepping, P5 in production with
  // a couple returned, P6 even-spread festival short). ImportSource biased to
  // 'manual' (~80%); 'pdf' marks rental-house bundles (Camera + G&E),
  // 'excel' marks production-coordinator master lists.
  // Eligibility for assignees: any ProjectMember on the project; falls back
  // to null when the role isn't on the project (e.g. P5 has no DP/Gaffer).
  // ══════════════════════════════════════════════════════════════════════════

  // Per-project ProjectMember lookup — one query per project, then in-memory
  // index by user name (and role for Clyde, who holds two rows per project).
  type InvMember = { id: string; role: string; user: { name: string } }
  async function membersFor(projectId: string): Promise<InvMember[]> {
    const rows = await prisma.projectMember.findMany({
      where: { projectId },
      select: { id: true, role: true, user: { select: { name: true } } },
    })
    return rows as InvMember[]
  }
  const findInvAssignee = (members: InvMember[], name: string, role?: string): string | null =>
    members.find(m => m.user.name === name && (!role || m.role === role))?.id ?? null

  // ── P1 — Simple Skin Promo (one-day product spot, packed-heavy) ─────────
  const p1Members = await membersFor(p1.id)
  const p1Priya  = findInvAssignee(p1Members, 'Priya Nair')         // DP
  const p1Theo   = findInvAssignee(p1Members, 'Theo Hartmann')      // 1st AC
  const p1Carlos = findInvAssignee(p1Members, 'Carlos Vega')        // 2nd AC
  const p1Tanya  = findInvAssignee(p1Members, 'Tanya Mills')        // Gaffer
  const p1Derek  = findInvAssignee(p1Members, 'Derek Huang')        // Key Grip
  const p1Luis   = findInvAssignee(p1Members, 'Luis Fernandez')     // Best Boy Grip
  const p1Claire = findInvAssignee(p1Members, 'Claire Renault')     // Art Director
  const p1Nina   = findInvAssignee(p1Members, 'Nina Osei')          // Set Decorator
  const p1Brendan = findInvAssignee(p1Members, 'Brendan Walsh')     // Props Master
  const p1Andre  = findInvAssignee(p1Members, 'Andre Kim')          // Sound Mixer

  await prisma.inventoryItem.createMany({ data: [
    // Camera
    { projectId: p1.id, name: 'ARRI Amira camera body w/ EVF',           quantity: 1, description: 'EF + PL mount, internal ND',                department: 'Camera',     status: 'packed',   source: 'Keslow Camera',          importSource: 'manual', assigneeId: p1Priya,  sortOrder: 0  },
    { projectId: p1.id, name: 'ARRI Master Primes (32, 50, 75, 100mm)',   quantity: 4, description: 'T1.3 PL primes, hero lensing',             department: 'Camera',     status: 'packed',   source: 'Keslow Camera',          importSource: 'pdf',    assigneeId: p1Theo,   sortOrder: 10 },
    { projectId: p1.id, name: 'Master Prime extras (14mm, 135mm)',       quantity: 2, description: 'Wide and tele extras held in case',        department: 'Camera',     status: 'returned', source: 'Keslow Camera',          importSource: 'manual', assigneeId: p1Theo,   sortOrder: 20 },
    { projectId: p1.id, name: 'Probe macro lens kit',                     quantity: 1, description: 'Laowa 24mm probe macro for product macro', department: 'Camera',     status: 'arrived',  source: 'Camtec',                 importSource: 'manual', assigneeId: p1Theo,   sortOrder: 30 },
    { projectId: p1.id, name: 'Polarizer + diffusion filter set',         quantity: 1, description: '4x5.65 IRND + Pola + 1/4 Black Pro-Mist',  department: 'Camera',     status: 'arrived',  source: 'Tiffen',                 importSource: 'manual', assigneeId: p1Theo,   sortOrder: 40 },
    { projectId: p1.id, name: 'Cambo Multi-Stand product table',          quantity: 1, description: 'Pro tabletop rig with hi/lo column',       department: 'Camera',     status: 'packed',   source: 'Cambo USA',              importSource: 'manual', assigneeId: p1Carlos, sortOrder: 50 },

    // Lighting
    { projectId: p1.id, name: 'Aputure 600d Pro',                          quantity: 2, description: 'Daylight COB w/ light dome and snoot',     department: 'Lighting',   status: 'packed',   source: 'VER Rentals',            importSource: 'manual', assigneeId: p1Tanya,  sortOrder: 0  },
    { projectId: p1.id, name: 'Astera Titan tubes',                        quantity: 4, description: 'RGB tunable, beauty fill and rim',         department: 'Lighting',   status: 'packed',   source: 'VER Rentals',            importSource: 'pdf',    assigneeId: p1Tanya,  sortOrder: 10 },
    { projectId: p1.id, name: 'Diffusion / negative-fill flag kit',        quantity: 1, description: '4x4 silks, neg flags, scrims',             department: 'Lighting',   status: 'arrived',  source: 'VER Rentals',            importSource: 'manual', assigneeId: p1Tanya,  sortOrder: 20 },

    // G&E
    { projectId: p1.id, name: 'C-stand kit + sandbags',                    quantity: 6, description: 'Hi-roller stands and 25lb shotbags',       department: 'G&E',        status: 'packed',   source: 'VER Rentals',            importSource: 'manual', assigneeId: p1Derek,  sortOrder: 0  },
    { projectId: p1.id, name: 'Apple boxes (full + halves)',               quantity: 4, description: 'Standard + half-apple sets, painted black', department: 'G&E',        status: 'packed',   source: 'VER Rentals',            importSource: 'manual', assigneeId: p1Luis,   sortOrder: 10 },

    // Art
    { projectId: p1.id, name: 'Lumière hero product samples (×30 SKUs)',  quantity: 30, description: 'Full product line, hero + macro continuity', department: 'Art',        status: 'arrived',  source: 'Client (Lumière)',       importSource: 'excel',  assigneeId: p1Nina,    sortOrder: 0  },
    { projectId: p1.id, name: 'Beauty styling kit',                        quantity: 1, description: 'Lint rollers, anti-static spray, gloves',  department: 'Art',        status: 'packed',   source: 'Hand & Tool',            importSource: 'manual', assigneeId: p1Brendan, sortOrder: 10 },
    { projectId: p1.id, name: 'Marble + acrylic tabletop surfaces',        quantity: 6, description: 'Hero surfaces for product stills',         department: 'Art',        status: 'ordered',  source: 'Set Decorators Inc.',    importSource: 'manual', assigneeId: p1Claire,  sortOrder: 20 },

    // (Sound — minimal, VO only — folded into above counts via 14 total items)
  ]})

  // ── P2 — Full Send (action piece, even spread + needed/ordered-heavy) ───
  const p2Members = await membersFor(p2.id)
  const p2Dani    = findInvAssignee(p2Members, 'Dani Reeves')        // DP
  const p2TylerG  = findInvAssignee(p2Members, 'Tyler Green')        // Production Coordinator
  const p2TylerH  = findInvAssignee(p2Members, 'Tyler Heckerman')    // Producer
  const p2Kelly   = findInvAssignee(p2Members, 'Kelly Pratt')        // Producer

  await prisma.inventoryItem.createMany({ data: [
    // Camera
    { projectId: p2.id, name: 'RED V-Raptor 8K body',                      quantity: 1, description: 'A-cam, full-frame VV',                       department: 'Camera',     status: 'packed',   source: 'Keslow Camera',          importSource: 'pdf',    assigneeId: p2Dani,   sortOrder: 0  },
    { projectId: p2.id, name: 'RED Komodo-X B-cam body',                   quantity: 1, description: 'B-cam + crash-cam, helmet rig compatible',  department: 'Camera',     status: 'packed',   source: 'Keslow Camera',          importSource: 'manual', assigneeId: p2Dani,   sortOrder: 10 },
    { projectId: p2.id, name: 'DZOFilm Vespid prime set (25/35/50/75/100)', quantity: 5, description: 'T2.1 EF/PL primes, action lensing',          department: 'Camera',     status: 'packed',   source: 'Old Fast Glass',         importSource: 'pdf',    assigneeId: p2Dani,   sortOrder: 20 },
    { projectId: p2.id, name: 'Sigma 18-35mm Cine zoom',                   quantity: 1, description: 'Fast cine zoom for handheld coverage',      department: 'Camera',     status: 'arrived',  source: 'Old Fast Glass',         importSource: 'manual', assigneeId: p2Dani,   sortOrder: 30 },
    { projectId: p2.id, name: 'DJI Ronin 4D 6K',                           quantity: 1, description: 'Combo gimbal/cam, LiDAR autofocus',         department: 'Camera',     status: 'packed',   source: 'DJI Direct',             importSource: 'manual', assigneeId: p2Dani,   sortOrder: 40 },
    { projectId: p2.id, name: 'Tilta Float arm + Easyrig Vario 5',         quantity: 1, description: 'Float arm + Vario 5 vest combo',            department: 'Camera',     status: 'arrived',  source: 'Tilta',                  importSource: 'manual', assigneeId: p2Dani,   sortOrder: 50 },
    { projectId: p2.id, name: 'cforce mini RF wireless follow focus',      quantity: 1, description: 'For drone + gimbal lensing',                department: 'Camera',     status: 'needed',   source: 'Backorder — ARRI',       importSource: 'manual', assigneeId: p2Dani,   sortOrder: 60 },
    { projectId: p2.id, name: 'Variable ND + Polarizer kit',               quantity: 1, description: '4x5.65 ND set + circular pola',            department: 'Camera',     status: 'packed',   source: 'Tiffen',                 importSource: 'manual', assigneeId: p2Dani,   sortOrder: 70 },

    // G&E (no Gaffer on P2 — null assignees)
    { projectId: p2.id, name: 'Aputure Nova P600c',                        quantity: 2, description: 'RGBWW color-mixing panel, weather-rated',  department: 'G&E',        status: 'arrived',  source: 'VER Rentals',            importSource: 'manual', assigneeId: null,     sortOrder: 0  },
    { projectId: p2.id, name: 'Aputure Light Storm 600d Pro',              quantity: 1, description: 'Daylight COB for sun-fill action plates',  department: 'G&E',        status: 'packed',   source: 'VER Rentals',            importSource: 'manual', assigneeId: null,     sortOrder: 10 },
    { projectId: p2.id, name: 'Astera Helios tubes',                       quantity: 8, description: 'Battery-powered tubes for night shoots',   department: 'G&E',        status: 'packed',   source: 'VER Rentals',            importSource: 'pdf',    assigneeId: null,     sortOrder: 20 },
    { projectId: p2.id, name: 'Heavy-duty C-stand + sandbag kit',          quantity: 8, description: 'Steel hi-rollers, 35lb shotbags',          department: 'G&E',        status: 'packed',   source: 'VER Rentals',            importSource: 'manual', assigneeId: null,     sortOrder: 30 },
    { projectId: p2.id, name: 'Tilta Nucleus-M wireless follow focus',     quantity: 1, description: 'Backup wireless follow focus for B-cam',   department: 'G&E',        status: 'needed',   source: 'Backorder',              importSource: 'manual', assigneeId: null,     sortOrder: 40 },

    // Sound (no mixer on P2 — null assignees)
    { projectId: p2.id, name: 'Sennheiser MKE 600 boom + windjammer',      quantity: 1, description: 'Outdoor boom, action coverage',            department: 'Sound',      status: 'arrived',  source: 'Coffey Sound',           importSource: 'manual', assigneeId: null,     sortOrder: 0  },
    { projectId: p2.id, name: 'Lectrosonics SMV wireless',                 quantity: 4, description: 'Body packs for athlete lavs',              department: 'Sound',      status: 'ordered',  source: 'Coffey Sound',           importSource: 'manual', assigneeId: null,     sortOrder: 10 },
    { projectId: p2.id, name: 'Sound Devices MixPre-10 II',                quantity: 1, description: '10-input recorder for run-and-gun',         department: 'Sound',      status: 'ordered',  source: 'Coffey Sound',           importSource: 'manual', assigneeId: null,     sortOrder: 20 },

    // Drone
    { projectId: p2.id, name: 'DJI Inspire 3 + camera package',            quantity: 1, description: 'X9-8K camera, RTK module',                  department: 'Camera',     status: 'packed',   source: 'DJI Direct',             importSource: 'manual', assigneeId: p2Dani,   sortOrder: 80 },
    { projectId: p2.id, name: 'DJI X9-8K Air gimbal lens kit',             quantity: 1, description: 'DL primes 18/24/35mm',                      department: 'Camera',     status: 'arrived',  source: 'DJI Direct',             importSource: 'manual', assigneeId: p2Dani,   sortOrder: 90 },

    // Production
    { projectId: p2.id, name: 'Comtek M-216 walkies',                      quantity: 8, description: 'Single-channel walkies + batteries',       department: 'Production', status: 'arrived',  source: 'Coffey Sound',           importSource: 'excel',  assigneeId: p2TylerG, sortOrder: 0  },
    { projectId: p2.id, name: 'Pelican 1610 cases',                        quantity: 6, description: 'Cube cases for camera + grip travel',      department: 'Production', status: 'packed',   source: 'Pelican',                importSource: 'manual', assigneeId: p2TylerG, sortOrder: 10 },
    { projectId: p2.id, name: 'Hi-vis safety vests',                       quantity: 12, description: 'Class 2 retroreflective vests, action set', department: 'Production', status: 'packed',   source: 'Grainger',               importSource: 'manual', assigneeId: p2TylerG, sortOrder: 20 },
    { projectId: p2.id, name: 'Talent waivers + release forms',            quantity: 1, description: 'Athlete release packets, master template',  department: 'Production', status: 'needed',   source: 'Internal — legal',       importSource: 'excel',  assigneeId: p2TylerG, sortOrder: 30 },
    { projectId: p2.id, name: 'Production wrap-out sheets',                quantity: 1, description: 'Wrap kit, tag printers, return manifests',  department: 'Production', status: 'needed',   source: 'Internal',               importSource: 'manual', assigneeId: p2TylerG, sortOrder: 40 },

    // Grip
    { projectId: p2.id, name: 'Kessler Pocket Dolly Plus',                 quantity: 1, description: '2ft track, low-profile slider',             department: 'G&E',        status: 'packed',   source: 'Kessler',                importSource: 'manual', assigneeId: null,     sortOrder: 50 },
    { projectId: p2.id, name: 'Magic Arm + super-clamp set',               quantity: 1, description: '3-arm rigging kit, pipe clamps',            department: 'G&E',        status: 'packed',   source: 'Manfrotto',              importSource: 'manual', assigneeId: null,     sortOrder: 60 },
    { projectId: p2.id, name: '4x4 frame kit (silk + neg)',                quantity: 1, description: '1/4 silk + neg fills with frame',           department: 'G&E',        status: 'arrived',  source: 'VER Rentals',            importSource: 'manual', assigneeId: null,     sortOrder: 70 },

    // Misc
    { projectId: p2.id, name: 'Action sports padding kit',                 quantity: 1, description: 'Crash pads + safety mats for talent',       department: 'Production', status: 'ordered',  source: 'Stunt Supply',           importSource: 'manual', assigneeId: p2TylerH, sortOrder: 50 },
    { projectId: p2.id, name: 'Branded Vanta wardrobe pieces',             quantity: 8, description: 'Hero athlete jackets and tees',             department: 'Wardrobe',   status: 'needed',   source: 'Client (Vanta)',         importSource: 'manual', assigneeId: p2Kelly,  sortOrder: 0  },
  ]})

  // ── P3 — In Vino Veritas (wine doc, arrived/packed-heavy) ──────────────
  const p3Members = await membersFor(p3.id)
  const p3Owen  = findInvAssignee(p3Members, 'Owen Blakely')    // DP
  const p3Tom   = findInvAssignee(p3Members, 'Tom Vega')        // Sound Mixer
  const p3Ryan  = findInvAssignee(p3Members, 'Ryan Cole')       // Production Coordinator

  await prisma.inventoryItem.createMany({ data: [
    // Camera
    { projectId: p3.id, name: 'ARRI Alexa Mini LF body',                   quantity: 1, description: 'Hero body, beauty + interview coverage',     department: 'Camera',     status: 'packed',   source: 'Keslow Camera',          importSource: 'manual', assigneeId: p3Owen, sortOrder: 0  },
    { projectId: p3.id, name: 'Cooke S7/i prime set (32/40/50/65/75/100)', quantity: 6, description: 'Beauty primes for vintner interviews',       department: 'Camera',     status: 'packed',   source: 'Old Fast Glass',         importSource: 'pdf',    assigneeId: p3Owen, sortOrder: 10 },
    { projectId: p3.id, name: 'Atlas Orion anamorphic 50mm',               quantity: 1, description: 'B-roll texture lens for vineyard wides',     department: 'Camera',     status: 'arrived',  source: 'Old Fast Glass',         importSource: 'manual', assigneeId: p3Owen, sortOrder: 20 },
    { projectId: p3.id, name: 'Tilta Nucleus-M wireless follow focus',     quantity: 1, description: 'For Steadicam handoffs',                     department: 'Camera',     status: 'packed',   source: 'Tilta',                  importSource: 'manual', assigneeId: p3Owen, sortOrder: 30 },
    { projectId: p3.id, name: 'Steadicam M-1 rig',                         quantity: 1, description: 'Cellar walk-throughs, harvest coverage',     department: 'Camera',     status: 'packed',   source: 'Owen Blakely (owner-op)', importSource: 'manual', assigneeId: p3Owen, sortOrder: 40 },
    { projectId: p3.id, name: 'ARRI EVF-2 monitor',                        quantity: 1, description: 'Director on-set monitor',                    department: 'Camera',     status: 'arrived',  source: 'Keslow Camera',          importSource: 'manual', assigneeId: p3Owen, sortOrder: 50 },
    { projectId: p3.id, name: 'Variable ND filter kit',                    quantity: 1, description: 'Tiffen IRND 0.3 to 3.0',                     department: 'Camera',     status: 'packed',   source: 'Tiffen',                 importSource: 'manual', assigneeId: p3Owen, sortOrder: 60 },
    { projectId: p3.id, name: 'Lens cleaning kit + sensor swabs',          quantity: 1, description: 'Field cleaning, vineyard dust',              department: 'Camera',     status: 'ordered',  source: 'B&H Photo',              importSource: 'manual', assigneeId: p3Owen, sortOrder: 70 },

    // Sound
    { projectId: p3.id, name: 'Sound Devices 833 mixer-recorder',          quantity: 1, description: '12-input bag-mounted recorder',              department: 'Sound',      status: 'packed',   source: 'Coffey Sound',           importSource: 'manual', assigneeId: p3Tom,  sortOrder: 0  },
    { projectId: p3.id, name: 'DPA 4060 lavs',                             quantity: 6, description: 'Beauty lavs, multi-lav vintner interviews',  department: 'Sound',      status: 'packed',   source: 'Coffey Sound',           importSource: 'manual', assigneeId: p3Tom,  sortOrder: 10 },
    { projectId: p3.id, name: 'Sennheiser MKH 416 boom',                   quantity: 1, description: 'Long shotgun for interview B-channel',       department: 'Sound',      status: 'packed',   source: 'Coffey Sound',           importSource: 'manual', assigneeId: p3Tom,  sortOrder: 20 },
    { projectId: p3.id, name: 'Tentacle Sync E',                           quantity: 4, description: 'Timecode boxes, jam-sync per body',          department: 'Sound',      status: 'packed',   source: 'Coffey Sound',           importSource: 'manual', assigneeId: p3Tom,  sortOrder: 30 },

    // Lighting
    { projectId: p3.id, name: 'Aputure 600d Pro',                          quantity: 3, description: 'Daylight key + bounce for cellar interiors', department: 'Lighting',   status: 'packed',   source: 'VER Rentals',            importSource: 'manual', assigneeId: null,   sortOrder: 0  },
    { projectId: p3.id, name: 'Astera Titan tubes',                        quantity: 6, description: 'Tunable tubes for harvest hour fill',         department: 'Lighting',   status: 'packed',   source: 'VER Rentals',            importSource: 'manual', assigneeId: null,   sortOrder: 10 },
    { projectId: p3.id, name: 'Quasar Q-LED Crossfade',                    quantity: 4, description: 'Tunable rim + practical augmentation',       department: 'Lighting',   status: 'packed',   source: 'VER Rentals',            importSource: 'manual', assigneeId: null,   sortOrder: 20 },

    // Art / Food
    { projectId: p3.id, name: 'Food styling kit',                          quantity: 1, description: 'Tweezers, brushes, mister set, garnish kit', department: 'Art',        status: 'needed',   source: 'Sourcing — TBD',         importSource: 'manual', assigneeId: null,   sortOrder: 0  },
    { projectId: p3.id, name: 'Wine pour rigs + spit cup props',           quantity: 1, description: 'Hero rigs for ceremonial pour shots',         department: 'Art',        status: 'arrived',  source: 'Set Decorators Inc.',    importSource: 'manual', assigneeId: null,   sortOrder: 10 },
    { projectId: p3.id, name: 'Vintage harvest baskets',                   quantity: 6, description: 'Period-correct baskets — director rejected',  department: 'Art',        status: 'returned', source: 'Period Props LA',        importSource: 'manual', assigneeId: null,   sortOrder: 20 },

    // Production
    { projectId: p3.id, name: 'Pelican 1510 cases',                        quantity: 8, description: 'Carry-on cases for vineyard travel',          department: 'Production', status: 'packed',   source: 'Pelican',                importSource: 'excel',  assigneeId: p3Ryan, sortOrder: 0  },
    { projectId: p3.id, name: 'Vineyard NDA + filming permits',            quantity: 1, description: 'Multi-property releases, signed',             department: 'Production', status: 'arrived',  source: 'Internal — legal',       importSource: 'excel',  assigneeId: p3Ryan, sortOrder: 10 },
  ]})

  // ── P4 — Flexibility Course A (studio prep, needed/ordered-heavy) ───────
  const p4Members = await membersFor(p4.id)
  const p4Alex   = findInvAssignee(p4Members, 'Alex Drum')        // DP
  const p4Hana   = findInvAssignee(p4Members, 'Hana Liu')         // Boom Op
  const p4TylerM = findInvAssignee(p4Members, 'Tyler Moss')       // Coordinator
  const p4Kelly  = findInvAssignee(p4Members, 'Kelly Pratt')      // Producer

  await prisma.inventoryItem.createMany({ data: [
    // Camera
    { projectId: p4.id, name: 'Sony FX6 (A-cam)',                          quantity: 1, description: 'Multi-cam A unit, 4K interview-style',       department: 'Camera',     status: 'arrived',  source: 'Keslow Camera',          importSource: 'pdf',    assigneeId: p4Alex,   sortOrder: 0  },
    { projectId: p4.id, name: 'Sony FX6 (B-cam)',                          quantity: 1, description: 'Multi-cam B unit for split coverage',        department: 'Camera',     status: 'ordered',  source: 'Keslow Camera',          importSource: 'pdf',    assigneeId: p4Alex,   sortOrder: 10 },
    { projectId: p4.id, name: 'Sony FE 24-70 GM',                          quantity: 1, description: 'A-cam zoom for instructional coverage',      department: 'Camera',     status: 'packed',   source: 'Keslow Camera',          importSource: 'manual', assigneeId: p4Alex,   sortOrder: 20 },
    { projectId: p4.id, name: 'Sony FE 70-200 GM',                         quantity: 1, description: 'Tele compression for tight detail shots',    department: 'Camera',     status: 'needed',   source: 'Backorder — Sony',       importSource: 'manual', assigneeId: p4Alex,   sortOrder: 30 },
    { projectId: p4.id, name: 'Atomos Ninja V+',                           quantity: 1, description: 'External 8K ProRes RAW recorder',            department: 'Camera',     status: 'arrived',  source: 'B&H Photo',              importSource: 'manual', assigneeId: p4Alex,   sortOrder: 40 },
    { projectId: p4.id, name: 'Tilta Float arm',                           quantity: 1, description: 'Body-mount stabilizer for moving demos',     department: 'Camera',     status: 'needed',   source: 'Tilta',                  importSource: 'manual', assigneeId: p4Alex,   sortOrder: 50 },

    // Lighting
    { projectId: p4.id, name: 'Litepanels Gemini 2x1',                     quantity: 3, description: 'Soft RGBWW key, fill, and rim',              department: 'Lighting',   status: 'ordered',  source: 'VER Rentals',            importSource: 'pdf',    assigneeId: null,     sortOrder: 0  },
    { projectId: p4.id, name: 'Aputure Light Dome SE (large)',             quantity: 1, description: 'Soft key for instructor close-ups',          department: 'Lighting',   status: 'arrived',  source: 'B&H Photo',              importSource: 'manual', assigneeId: null,     sortOrder: 10 },
    { projectId: p4.id, name: 'Astera Titan tubes',                        quantity: 4, description: 'Backdrop fill and rim, color-matched',       department: 'Lighting',   status: 'arrived',  source: 'VER Rentals',            importSource: 'manual', assigneeId: null,     sortOrder: 20 },
    { projectId: p4.id, name: 'White paper backdrop (8ft)',                quantity: 1, description: 'Studio sweep for clean key',                 department: 'Lighting',   status: 'packed',   source: 'Savage Universal',       importSource: 'manual', assigneeId: null,     sortOrder: 30 },

    // Sound
    { projectId: p4.id, name: 'Sennheiser EW-DX wireless',                 quantity: 2, description: 'Instructor lavs, dual-channel',              department: 'Sound',      status: 'ordered',  source: 'Coffey Sound',           importSource: 'manual', assigneeId: p4Hana,   sortOrder: 0  },
    { projectId: p4.id, name: 'Røde NTG5 boom',                            quantity: 1, description: 'Light shotgun for studio dialogue',          department: 'Sound',      status: 'arrived',  source: 'B&H Photo',              importSource: 'manual', assigneeId: p4Hana,   sortOrder: 10 },
    { projectId: p4.id, name: 'Zoom F8 Pro recorder',                      quantity: 1, description: 'Backup sync recorder, 8 inputs',             department: 'Sound',      status: 'needed',   source: 'B&H Photo',              importSource: 'manual', assigneeId: p4Hana,   sortOrder: 20 },

    // Production
    { projectId: p4.id, name: 'Atomos Shogun Connect (livestream check)',  quantity: 1, description: 'Network-aware monitor for stream test',      department: 'Production', status: 'needed',   source: 'B&H Photo',              importSource: 'excel',  assigneeId: p4TylerM, sortOrder: 0  },
    { projectId: p4.id, name: 'Teleprompter rig (small)',                  quantity: 1, description: 'On-cam prompter for instructor cue cards',   department: 'Production', status: 'ordered',  source: 'Prompter People',        importSource: 'manual', assigneeId: p4TylerM, sortOrder: 10 },

    // Wardrobe / Misc
    { projectId: p4.id, name: 'Yoga mat set (×6 colors)',                  quantity: 6, description: 'Hero mat colors for talent continuity',      department: 'Wardrobe',   status: 'arrived',  source: 'Manduka',                importSource: 'manual', assigneeId: null,     sortOrder: 0  },
    { projectId: p4.id, name: 'Insurance + permit binder',                 quantity: 1, description: 'Studio rider, gen-liability docs',           department: 'Production', status: 'packed',   source: 'Internal',               importSource: 'excel',  assigneeId: p4Kelly,  sortOrder: 20 },
  ]})

  // ── P5 — Natural Order (climate doc, packed-heavy + a couple returned) ──
  // Note: P5 has a lean post-only crew on the seed. Most camera/sound items
  // run unassigned. Producer/coordinator items go to Tyler H / Kelly / Clyde.
  const p5Members = await membersFor(p5.id)
  const p5TylerH = findInvAssignee(p5Members, 'Tyler Heckerman')
  const p5Kelly  = findInvAssignee(p5Members, 'Kelly Pratt')

  await prisma.inventoryItem.createMany({ data: [
    // Camera (10) — heavy on durable bodies, mostly packed for travel
    { projectId: p5.id, name: 'Sony FX3 (A-cam)',                          quantity: 1, description: 'Compact A-cam, multi-location coverage',     department: 'Camera',     status: 'packed',   source: 'Keslow Camera',          importSource: 'pdf',    assigneeId: null, sortOrder: 0   },
    { projectId: p5.id, name: 'Sony FX3 (B-cam)',                          quantity: 1, description: 'Compact B-cam, run-and-gun',                 department: 'Camera',     status: 'packed',   source: 'Keslow Camera',          importSource: 'pdf',    assigneeId: null, sortOrder: 10  },
    { projectId: p5.id, name: 'Sony FX6 (long-form interview)',            quantity: 1, description: 'Stationary interview rig',                   department: 'Camera',     status: 'packed',   source: 'Keslow Camera',          importSource: 'pdf',    assigneeId: null, sortOrder: 20  },
    { projectId: p5.id, name: 'Canon RF 24-105mm L',                       quantity: 1, description: 'A-cam workhorse zoom',                       department: 'Camera',     status: 'packed',   source: 'B&H Photo',              importSource: 'manual', assigneeId: null, sortOrder: 30  },
    { projectId: p5.id, name: 'Canon RF 70-200mm L',                       quantity: 1, description: 'Wildlife and tele-coverage',                 department: 'Camera',     status: 'packed',   source: 'B&H Photo',              importSource: 'manual', assigneeId: null, sortOrder: 40  },
    { projectId: p5.id, name: 'Sigma 24-70mm Art (Sony E)',                quantity: 1, description: 'B-cam zoom backup',                          department: 'Camera',     status: 'arrived',  source: 'B&H Photo',              importSource: 'manual', assigneeId: null, sortOrder: 50  },
    { projectId: p5.id, name: 'Tamron 17-28mm',                            quantity: 1, description: 'Wide for landscape and field interview B',   department: 'Camera',     status: 'arrived',  source: 'B&H Photo',              importSource: 'manual', assigneeId: null, sortOrder: 60  },
    { projectId: p5.id, name: 'SmallHD Ultra 7 monitor',                   quantity: 1, description: 'High-bright field monitor',                  department: 'Camera',     status: 'packed',   source: 'B&H Photo',              importSource: 'manual', assigneeId: null, sortOrder: 70  },
    { projectId: p5.id, name: 'Atomos Ninja V+',                           quantity: 1, description: 'External recorder for 4K ProRes RAW',        department: 'Camera',     status: 'packed',   source: 'B&H Photo',              importSource: 'manual', assigneeId: null, sortOrder: 80  },
    { projectId: p5.id, name: 'Variable ND filter set',                    quantity: 1, description: 'Failed spec — returned to vendor',           department: 'Camera',     status: 'returned', source: 'B&H Photo',              importSource: 'manual', assigneeId: null, sortOrder: 90  },

    // Sound (5)
    { projectId: p5.id, name: 'Lectrosonics SMV wireless',                 quantity: 3, description: 'Subject lavs, multi-channel field',          department: 'Sound',      status: 'packed',   source: 'Coffey Sound',           importSource: 'pdf',    assigneeId: null, sortOrder: 0  },
    { projectId: p5.id, name: 'Sennheiser MKH 416 boom',                   quantity: 1, description: 'Outdoor shotgun, climate-rated',             department: 'Sound',      status: 'packed',   source: 'Coffey Sound',           importSource: 'manual', assigneeId: null, sortOrder: 10 },
    { projectId: p5.id, name: 'Zoom F8 Pro recorder',                      quantity: 1, description: 'Bag-mounted backup recorder',                department: 'Sound',      status: 'packed',   source: 'B&H Photo',              importSource: 'manual', assigneeId: null, sortOrder: 20 },
    { projectId: p5.id, name: 'Røde Wind Protect (large)',                 quantity: 2, description: 'Heavy weather windjammers',                  department: 'Sound',      status: 'arrived',  source: 'B&H Photo',              importSource: 'manual', assigneeId: null, sortOrder: 30 },
    { projectId: p5.id, name: 'Tentacle Sync E',                           quantity: 3, description: 'Sync timecode across cameras',               department: 'Sound',      status: 'packed',   source: 'Coffey Sound',           importSource: 'manual', assigneeId: null, sortOrder: 40 },

    // G&E / Power (4)
    { projectId: p5.id, name: 'Aputure F22c (battery panel)',              quantity: 1, description: 'Battery-powered RGB panel for field use',    department: 'G&E',        status: 'packed',   source: 'B&H Photo',              importSource: 'pdf',    assigneeId: null, sortOrder: 0  },
    { projectId: p5.id, name: 'Anton/Bauer Titon Base packs',              quantity: 8, description: '14.4V 240Wh field batteries',                 department: 'G&E',        status: 'packed',   source: 'Anton/Bauer Direct',     importSource: 'manual', assigneeId: null, sortOrder: 10 },
    { projectId: p5.id, name: 'Battery charger station (Gold mount)',      quantity: 1, description: '4-bay rapid charger',                        department: 'G&E',        status: 'packed',   source: 'Anton/Bauer Direct',     importSource: 'manual', assigneeId: null, sortOrder: 20 },
    { projectId: p5.id, name: 'Power station 220Wh',                       quantity: 4, description: 'Field AC/DC power packs for remote shoots',  department: 'G&E',        status: 'arrived',  source: 'EcoFlow',                importSource: 'manual', assigneeId: null, sortOrder: 30 },

    // Cases / Travel (5)
    { projectId: p5.id, name: 'Pelican 1610 cases',                        quantity: 8, description: 'Cube cases for camera + lighting travel',    department: 'Production', status: 'packed',   source: 'Pelican',                importSource: 'excel',  assigneeId: p5TylerH, sortOrder: 0  },
    { projectId: p5.id, name: 'Pelican 1510 carry-on cases',               quantity: 4, description: 'Air-travel-rated carry-ons',                 department: 'Production', status: 'packed',   source: 'Pelican',                importSource: 'excel',  assigneeId: p5TylerH, sortOrder: 10 },
    { projectId: p5.id, name: 'Custom foam inserts',                       quantity: 1, description: 'CNC-cut foam for camera + lens layouts',     department: 'Production', status: 'arrived',  source: 'CNC Foam',               importSource: 'manual', assigneeId: p5TylerH, sortOrder: 20 },
    { projectId: p5.id, name: 'Tundra duffles',                            quantity: 4, description: 'Soft-side travel duffles for grip kit',      department: 'Production', status: 'packed',   source: 'Yeti',                   importSource: 'excel',  assigneeId: p5Kelly,  sortOrder: 30 },
    { projectId: p5.id, name: 'Coolers + ice packs',                       quantity: 4, description: 'Field hydration + battery cool-down',        department: 'Production', status: 'needed',   source: 'Sourcing — local',       importSource: 'manual', assigneeId: p5Kelly,  sortOrder: 40 },

    // Misc (3)
    { projectId: p5.id, name: 'Permit binders + remote location forms',    quantity: 1, description: 'BLM, NPS, state-park release packets',       department: 'Production', status: 'packed',   source: 'Internal — legal',       importSource: 'excel',  assigneeId: p5Kelly,  sortOrder: 50 },
    { projectId: p5.id, name: 'Rain covers (camera + crew)',               quantity: 4, description: 'Storm-proof covers for body + gear',         department: 'G&E',        status: 'arrived',  source: 'Think Tank Photo',       importSource: 'manual', assigneeId: null,     sortOrder: 40 },
    { projectId: p5.id, name: 'Lens-rain covers',                          quantity: 4, description: 'Wrong size — vendor exchange pending',       department: 'Camera',     status: 'returned', source: 'Think Tank Photo',       importSource: 'manual', assigneeId: null,     sortOrder: 100 },
  ]})

  // ── P6 — The Weave (festival short, even spread) ────────────────────────
  const p6Members = await membersFor(p6.id)
  const p6Caleb  = findInvAssignee(p6Members, 'Caleb Stone')      // DP
  const p6Maya   = findInvAssignee(p6Members, 'Maya Lin')         // 1st AC
  const p6SamP   = findInvAssignee(p6Members, 'Sam Park')         // Grip
  const p6Dario  = findInvAssignee(p6Members, 'Dario Reyes')      // Best Boy Electric
  const p6Chris  = findInvAssignee(p6Members, 'Chris Tan')        // Sound Mixer
  const p6Omar   = findInvAssignee(p6Members, 'Omar Rashid')      // Boom Op
  const p6Petra  = findInvAssignee(p6Members, 'Petra Walsh')      // Art Director
  const p6Sofia  = findInvAssignee(p6Members, 'Sofia Avila')      // Producer
  const p6Rina   = findInvAssignee(p6Members, 'Rina Cole')        // Coordinator

  await prisma.inventoryItem.createMany({ data: [
    // Camera (10)
    { projectId: p6.id, name: 'ARRI Alexa Mini LF',                        quantity: 1, description: 'Hero body, large-format narrative',          department: 'Camera',     status: 'packed',   source: 'Keslow Camera',          importSource: 'pdf',    assigneeId: p6Caleb, sortOrder: 0   },
    { projectId: p6.id, name: 'Cooke S4/i mini prime set (18/25/32/50/75)', quantity: 5, description: 'Vintage character primes, narrative lens kit', department: 'Camera',     status: 'packed',   source: 'Old Fast Glass',         importSource: 'pdf',    assigneeId: p6Caleb, sortOrder: 10  },
    { projectId: p6.id, name: 'Angenieux 25-250mm Optimo',                 quantity: 1, description: 'Hero zoom for select wide → tight pushes',   department: 'Camera',     status: 'arrived',  source: 'Old Fast Glass',         importSource: 'manual', assigneeId: p6Caleb, sortOrder: 20  },
    { projectId: p6.id, name: 'Steadicam M-1 rig',                         quantity: 1, description: 'Owner-op rig for ravine sequences',          department: 'Camera',     status: 'packed',   source: 'Caleb Stone (owner-op)', importSource: 'manual', assigneeId: p6Caleb, sortOrder: 30  },
    { projectId: p6.id, name: 'Tilta Float arm',                           quantity: 1, description: 'Stabilizer for run-and-gun coverage',        department: 'Camera',     status: 'arrived',  source: 'Tilta',                  importSource: 'manual', assigneeId: p6Caleb, sortOrder: 40  },
    { projectId: p6.id, name: 'Tilta Nucleus-M wireless follow focus',     quantity: 1, description: 'Hero wireless FF',                            department: 'Camera',     status: 'packed',   source: 'Tilta',                  importSource: 'manual', assigneeId: p6Maya,  sortOrder: 50  },
    { projectId: p6.id, name: 'Cmotion lens encoder',                      quantity: 1, description: 'For metadata-correct lens recording',         department: 'Camera',     status: 'packed',   source: 'cmotion',                importSource: 'manual', assigneeId: p6Maya,  sortOrder: 60  },
    { projectId: p6.id, name: 'ND filter set (Tiffen IRND 0.3-3.0)',       quantity: 1, description: '4x5.65 IRND set, full stops',                department: 'Camera',     status: 'packed',   source: 'Tiffen',                 importSource: 'manual', assigneeId: p6Maya,  sortOrder: 70  },
    { projectId: p6.id, name: 'ARRI EVF-2 monitor',                        quantity: 2, description: 'Director + DP monitors',                     department: 'Camera',     status: 'arrived',  source: 'Keslow Camera',          importSource: 'manual', assigneeId: p6Maya,  sortOrder: 80  },
    { projectId: p6.id, name: 'Camera report binder + slate',              quantity: 1, description: '1st AC kit, slate + reports',                department: 'Camera',     status: 'packed',   source: 'Internal',               importSource: 'manual', assigneeId: p6Maya,  sortOrder: 90  },

    // Lighting (6)
    { projectId: p6.id, name: 'ARRI SkyPanel S60-C',                       quantity: 2, description: 'Hero soft RGB panels for night INT',         department: 'Lighting',   status: 'arrived',  source: 'VER Rentals',            importSource: 'manual', assigneeId: null,    sortOrder: 0  },
    { projectId: p6.id, name: 'ARRI SkyPanel S30-C',                       quantity: 2, description: 'Mid-size RGB for lift, fill',                department: 'Lighting',   status: 'ordered',  source: 'VER Rentals',            importSource: 'manual', assigneeId: null,    sortOrder: 10 },
    { projectId: p6.id, name: 'Astera Titan tubes',                        quantity: 8, description: 'Practical augmentation, period bias',         department: 'Lighting',   status: 'packed',   source: 'VER Rentals',            importSource: 'manual', assigneeId: null,    sortOrder: 20 },
    { projectId: p6.id, name: 'Aputure Nova P600c',                        quantity: 2, description: 'RGBWW for color-rich night exterior',        department: 'Lighting',   status: 'ordered',  source: 'VER Rentals',            importSource: 'manual', assigneeId: null,    sortOrder: 30 },
    { projectId: p6.id, name: 'Quasar Q-LED Crossfade',                    quantity: 6, description: 'In-frame practicals',                         department: 'Lighting',   status: 'arrived',  source: 'VER Rentals',            importSource: 'manual', assigneeId: null,    sortOrder: 40 },
    { projectId: p6.id, name: 'Diffusion / silk frame kit',                quantity: 1, description: '8x8 + 12x12 silks, soft frames',             department: 'Lighting',   status: 'needed',   source: 'Sourcing — VER',         importSource: 'manual', assigneeId: null,    sortOrder: 50 },

    // G&E / Grip (5)
    { projectId: p6.id, name: 'Magic Arm + super-clamp kit',               quantity: 1, description: '3-arm rigging kit, period set work',         department: 'G&E',        status: 'packed',   source: 'Manfrotto',              importSource: 'manual', assigneeId: p6SamP,  sortOrder: 0  },
    { projectId: p6.id, name: 'C-stand kit (×12) + sandbags',              quantity: 12, description: 'Heavy-duty hi-rollers, 35lb shotbags',       department: 'G&E',        status: 'packed',   source: 'VER Rentals',            importSource: 'manual', assigneeId: p6SamP,  sortOrder: 10 },
    { projectId: p6.id, name: '4x4, 6x6, 8x8 frame kits',                  quantity: 3, description: 'Silk + neg + 1/4 grid set',                  department: 'G&E',        status: 'arrived',  source: 'VER Rentals',            importSource: 'manual', assigneeId: p6SamP,  sortOrder: 20 },
    { projectId: p6.id, name: 'Furniture pads + duvetyne (×20yds)',        quantity: 1, description: 'Sound damp, set-bounce control',              department: 'G&E',        status: 'ordered',  source: 'VER Rentals',            importSource: 'manual', assigneeId: p6SamP,  sortOrder: 30 },
    { projectId: p6.id, name: 'Generator (Multiquip Whisperwatt 25kva)',   quantity: 1, description: 'Sound-rated genny for night exterior',        department: 'G&E',        status: 'packed',   source: 'Multiquip',              importSource: 'manual', assigneeId: p6Dario, sortOrder: 40 },

    // Sound (5)
    { projectId: p6.id, name: 'Sound Devices 833 mixer-recorder',          quantity: 1, description: 'Hero recorder for narrative scenes',          department: 'Sound',      status: 'arrived',  source: 'Coffey Sound',           importSource: 'manual', assigneeId: p6Chris, sortOrder: 0  },
    { projectId: p6.id, name: 'DPA 4060 lavs',                             quantity: 8, description: 'Period-friendly micro lavs',                 department: 'Sound',      status: 'packed',   source: 'Coffey Sound',           importSource: 'manual', assigneeId: p6Chris, sortOrder: 10 },
    { projectId: p6.id, name: 'Sennheiser MKH 416 boom',                   quantity: 1, description: 'Hero shotgun for outdoor scenes',             department: 'Sound',      status: 'packed',   source: 'Coffey Sound',           importSource: 'manual', assigneeId: p6Chris, sortOrder: 20 },
    { projectId: p6.id, name: 'Sennheiser MKH 50 boom',                    quantity: 1, description: 'Interior dialogue, tighter pickup',           department: 'Sound',      status: 'arrived',  source: 'Coffey Sound',           importSource: 'manual', assigneeId: p6Chris, sortOrder: 30 },
    { projectId: p6.id, name: 'Lectrosonics SMV wireless',                 quantity: 6, description: 'Multi-talent wireless body packs',            department: 'Sound',      status: 'packed',   source: 'Coffey Sound',           importSource: 'manual', assigneeId: p6Omar,  sortOrder: 40 },

    // Art (5)
    { projectId: p6.id, name: 'Hero books + leather-bound props',          quantity: 1, description: 'Hero practical books, period continuity',     department: 'Art',        status: 'arrived',  source: 'Period Props LA',        importSource: 'manual', assigneeId: p6Petra, sortOrder: 0  },
    { projectId: p6.id, name: 'Period-correct stationery + ink set',       quantity: 1, description: 'Letter-writing scenes, hand-prop continuity', department: 'Art',        status: 'arrived',  source: 'Period Props LA',        importSource: 'manual', assigneeId: p6Petra, sortOrder: 10 },
    { projectId: p6.id, name: 'FRACTURE-universe set dressing crate',      quantity: 1, description: 'Show-bible-canon dressing for hero set',      department: 'Art',        status: 'packed',   source: 'B Story Internal',       importSource: 'manual', assigneeId: p6Petra, sortOrder: 20 },
    { projectId: p6.id, name: 'Picture vehicle (1973 Mercedes 280SE)',     quantity: 1, description: 'Hero PV — vintage rental still being sourced', department: 'Art',        status: 'needed',   source: 'Sourcing — Cinema Vehicles', importSource: 'manual', assigneeId: p6Petra, sortOrder: 30 },
    { projectId: p6.id, name: 'Practical electrical (lanterns, sconces)',  quantity: 1, description: 'Bulbs, gels, dimmers for in-frame practicals', department: 'Art',        status: 'ordered',  source: 'Period Props LA',        importSource: 'manual', assigneeId: p6Petra, sortOrder: 40 },

    // HMU + Wardrobe (3)
    { projectId: p6.id, name: 'Period wardrobe (3 talents × 4 changes)',   quantity: 12, description: '12 hero looks, fittings complete',           department: 'Wardrobe',   status: 'packed',   source: 'Costume House',          importSource: 'manual', assigneeId: null,    sortOrder: 0  },
    { projectId: p6.id, name: 'Hair piece + period wig set',               quantity: 1, description: 'One wig wrong — vendor exchange pending',     department: 'HMU',        status: 'returned', source: 'Western Costume',        importSource: 'manual', assigneeId: null,    sortOrder: 0  },
    { projectId: p6.id, name: 'Distressing kit + bloodwork supplies',      quantity: 1, description: 'Aging fabric, bloodwork for the climax',     department: 'HMU',        status: 'packed',   source: 'Frend\'s Beauty',        importSource: 'manual', assigneeId: null,    sortOrder: 10 },

    // Production (4)
    { projectId: p6.id, name: 'Pelican 1610 cases',                        quantity: 12, description: 'Cube cases for camera + grip travel',         department: 'Production', status: 'packed',   source: 'Pelican',                importSource: 'excel',  assigneeId: p6Sofia, sortOrder: 0  },
    { projectId: p6.id, name: 'Walkie packages',                           quantity: 16, description: 'Multi-channel walkies + 16 chargers',         department: 'Production', status: 'packed',   source: 'Coffey Sound',           importSource: 'manual', assigneeId: p6Sofia, sortOrder: 10 },
    { projectId: p6.id, name: 'Crafty + on-set hospitality kit',           quantity: 1, description: 'Coffee, snacks, dietary continuity',          department: 'Production', status: 'arrived',  source: 'Sourcing — Local',       importSource: 'manual', assigneeId: p6Rina,  sortOrder: 20 },
    { projectId: p6.id, name: 'Production binders (calls, scripts, breakdown)', quantity: 1, description: 'Master prod binder per department',     department: 'Production', status: 'needed',   source: 'Internal',               importSource: 'manual', assigneeId: p6Rina,  sortOrder: 30 },
  ]})

  // Inventory summary log — counts per project + status + source breakdown
  const invAll = await prisma.inventoryItem.findMany({
    select: { projectId: true, status: true, importSource: true, assigneeId: true },
  })
  const invByProject = new Map<string, number>()
  const invByStatus: Record<string, number> = { needed: 0, ordered: 0, arrived: 0, packed: 0, returned: 0 }
  const invBySource: Record<string, number> = { manual: 0, pdf: 0, excel: 0 }
  let invUnassigned = 0
  for (const r of invAll) {
    invByProject.set(r.projectId, (invByProject.get(r.projectId) ?? 0) + 1)
    invByStatus[r.status]++
    invBySource[r.importSource]++
    if (!r.assigneeId) invUnassigned++
  }
  const invCount = (id: string) => invByProject.get(id) ?? 0
  console.log(
    `  Inventory: ${invAll.length} ` +
    `(${invCount(p1.id)}/${invCount(p2.id)}/${invCount(p3.id)}/${invCount(p4.id)}/${invCount(p5.id)}/${invCount(p6.id)} across P1-P6; ` +
    `${invByStatus.needed} needed, ${invByStatus.ordered} ordered, ${invByStatus.arrived} arrived, ${invByStatus.packed} packed, ${invByStatus.returned} returned; ` +
    `${invBySource.manual} manual, ${invBySource.pdf} pdf, ${invBySource.excel} excel; ` +
    `${invUnassigned} unassigned)`
  )

  // ── ShootDays — all 6 projects (now-relative) ───────────────────────────
  // Day counts feed budget formula globals (prepDays/shootDays/postDays) per
  // spec §5.3: count(ShootDay where projectId=X AND type=Y) at evaluation time.
  // centerOffset = days from NOW to the first prod day (negative = past).

  type ShootDayProfile = {
    project: { id: string; name: string }
    pre: number; prod: number; post: number; centerOffset: number
  }
  const shootDayProfiles: ShootDayProfile[] = [
    { project: p1, pre: 4, prod: 5, post: 3, centerOffset: -10 },
    { project: p2, pre: 3, prod: 6, post: 4, centerOffset:  -3 },
    { project: p3, pre: 5, prod: 8, post: 6, centerOffset:  -8 },  // IVV — drives the sample budget
    { project: p4, pre: 6, prod: 5, post: 3, centerOffset:   2 },
    { project: p5, pre: 0, prod: 4, post: 1, centerOffset:   5 },
    { project: p6, pre: 4, prod: 7, post: 5, centerOffset: -15 },
  ]
  let shootDayTotal = 0
  for (const { project, pre, prod, post, centerOffset } of shootDayProfiles) {
    type DayPlan = { type: 'pre' | 'prod' | 'post'; offset: number }
    const days: DayPlan[] = []
    for (let i = 0; i < pre;  i++) days.push({ type: 'pre',  offset: centerOffset - pre + i })
    for (let i = 0; i < prod; i++) days.push({ type: 'prod', offset: centerOffset + i })
    for (let i = 0; i < post; i++) days.push({ type: 'post', offset: centerOffset + prod + 1 + i })
    for (let i = 0; i < days.length; i++) {
      const d = days[i]
      await prisma.shootDay.create({ data: {
        projectId: project.id,
        date: daysAgo(-d.offset),                 // negative offset → future date
        type: d.type,
        sortOrder: i + 1,
      }})
    }
    shootDayTotal += days.length
  }
  console.log(`  ShootDays: ${shootDayTotal} across P1-P6 (` +
    shootDayProfiles.map(p => `${p.pre + p.prod + p.post}`).join('/') + ')')

  // ── Budget — In Vino Veritas (full sample) ──────────────────────────────
  // Per spec §3 / plan PR 5. Demonstrates the full v1 surface area:
  //   AICP skeleton (2 ATL + 12 BTL accounts, 30 lines across 9 of them),
  //   3 versions (Estimate / Working / Committed),
  //   formula qty (`shootDays`, `crewSize * shootDays`),
  //   fringe rates (0.18 on labor lines),
  //   tags (dept:*, location:*),
  //   2 markups (one accountSubtotal-targeted, one grandTotal),
  //   2 variables (one budget-level, one version-scoped override),
  //   ~20 expenses (12 sourced from approved IVV timecards, 8 manual).
  //
  // Math fix that consumes rateUnit lands in budget-library (PR 6); seeding
  // here uses the day-unit pattern inline (units=1, unit='DAY') since all
  // existing timecards backfilled to 'day' in feat/rate-unit-schema.

  // Resolve Clyde-on-IVV ProjectMember row for Expense.createdBy. Spec says
  // createdBy is a ProjectMember.id pre-Auth (User.id post-Auth).
  const clydeOnIvv = await prisma.projectMember.findFirst({
    where: { projectId: p3.id, userId: clydeBessey.id, role: 'producer' },
  })
  if (!clydeOnIvv) throw new Error('Clyde Bessey ProjectMember on IVV not found — expected from earlier seed.')

  const ivvBudget = await prisma.budget.create({
    data: { projectId: p3.id, currency: 'USD', varianceThreshold: '0.10' },
  })

  const [estimateV, workingV, committedV] = await Promise.all([
    prisma.budgetVersion.create({ data: { budgetId: ivvBudget.id, name: 'Estimate',  kind: 'estimate',  sortOrder: 1, state: 'draft' } }),
    prisma.budgetVersion.create({ data: { budgetId: ivvBudget.id, name: 'Working',   kind: 'working',   sortOrder: 2, state: 'draft' } }),
    prisma.budgetVersion.create({ data: { budgetId: ivvBudget.id, name: 'Committed', kind: 'committed', sortOrder: 3, state: 'draft' } }),
  ])
  await prisma.budget.update({
    where: { id: ivvBudget.id },
    data:  { rateSourceVersionId: committedV.id },
  })

  // 14 AICP accounts — imported from @origin-one/schema. Single source of
  // truth: same fixture is used by the (future) "Start from default AICP
  // template" affordance in TemplatePicker (PR 11).
  const accountByCode = new Map<string, { id: string }>()
  for (const a of DEFAULT_AICP_ACCOUNTS) {
    const created = await prisma.budgetAccount.create({ data: {
      budgetId: ivvBudget.id, code: a.code, name: a.name, section: a.section, sortOrder: a.sortOrder,
    } })
    accountByCode.set(a.code, created)
  }

  type LineSpec = {
    code: string
    description: string
    unit: 'DAY' | 'WEEK' | 'HOUR' | 'FLAT' | 'UNIT'
    fringeRate: string                           // Decimal(5,4)
    tags?: string[]
    qty:  { estimate: string; working: string; committed: string }
    rate: { estimate: string; working: string; committed: string }
  }
  const lineSpecs: LineSpec[] = [
    // AA — Director / Creative
    { code: 'AA', description: 'Director Fee',                              unit: 'FLAT', fringeRate: '0',    tags: ['dept:creative'],
      qty:  { estimate: '1',                          working: '1',                          committed: '1' },
      rate: { estimate: '15000.00',                   working: '17500.00',                   committed: '17500.00' } },
    // BB — Producer
    { code: 'BB', description: 'Line Producer',                             unit: 'FLAT', fringeRate: '0',    tags: ['dept:production'],
      qty:  { estimate: '1',                          working: '1',                          committed: '1' },
      rate: { estimate: '12000.00',                   working: '14000.00',                   committed: '14000.00' } },
    // A — Pre-Production Wages
    { code: 'A',  description: 'Production Coordinator',                    unit: 'WEEK', fringeRate: '0.18', tags: ['dept:production'],
      qty:  { estimate: '2',                          working: '3',                          committed: '3' },
      rate: { estimate: '2200.00',                    working: '2400.00',                    committed: '2400.00' } },
    { code: 'A',  description: 'Office Rental (prep)',                      unit: 'FLAT', fringeRate: '0',    tags: [],
      qty:  { estimate: '1',                          working: '1',                          committed: '1' },
      rate: { estimate: '1500.00',                    working: '1800.00',                    committed: '1800.00' } },
    // B — Shooting Crew (formula qty: shootDays — resolves to 8 from ShootDay count above)
    { code: 'B',  description: 'Director of Photography',                   unit: 'DAY',  fringeRate: '0.18', tags: ['dept:camera'],
      qty:  { estimate: 'shootDays',                  working: 'shootDays',                  committed: 'shootDays' },
      rate: { estimate: '1100.00',                    working: '1200.00',                    committed: '1200.00' } },
    { code: 'B',  description: '1st AC',                                    unit: 'DAY',  fringeRate: '0.18', tags: ['dept:camera'],
      qty:  { estimate: 'shootDays',                  working: 'shootDays',                  committed: 'shootDays' },
      rate: { estimate: '650.00',                     working: '700.00',                     committed: '700.00' } },
    { code: 'B',  description: 'Gaffer',                                    unit: 'DAY',  fringeRate: '0.18', tags: ['dept:lighting'],
      qty:  { estimate: 'shootDays',                  working: 'shootDays',                  committed: 'shootDays' },
      rate: { estimate: '750.00',                     working: '800.00',                     committed: '800.00' } },
    { code: 'B',  description: 'Key Grip',                                  unit: 'DAY',  fringeRate: '0.18', tags: ['dept:grip'],
      qty:  { estimate: 'shootDays',                  working: 'shootDays',                  committed: 'shootDays' },
      rate: { estimate: '700.00',                     working: '750.00',                     committed: '750.00' } },
    { code: 'B',  description: 'Sound Mixer',                               unit: 'DAY',  fringeRate: '0.18', tags: ['dept:sound'],
      qty:  { estimate: 'shootDays',                  working: 'shootDays',                  committed: 'shootDays' },
      rate: { estimate: '650.00',                     working: '700.00',                     committed: '700.00' } },
    { code: 'B',  description: 'Boom Operator',                             unit: 'DAY',  fringeRate: '0.18', tags: ['dept:sound'],
      qty:  { estimate: 'shootDays',                  working: 'shootDays',                  committed: 'shootDays' },
      rate: { estimate: '450.00',                     working: '500.00',                     committed: '500.00' } },
    // C — Wrap Wages (uses postDays = 6)
    { code: 'C',  description: 'Wrap PA',                                   unit: 'DAY',  fringeRate: '0.18', tags: ['dept:production'],
      qty:  { estimate: 'postDays',                   working: 'postDays',                   committed: 'postDays' },
      rate: { estimate: '300.00',                     working: '350.00',                     committed: '350.00' } },
    // D — Locations & Travel
    { code: 'D',  description: 'Vineyard Location Fee',                     unit: 'DAY',  fringeRate: '0',    tags: ['location:vineyard'],
      qty:  { estimate: 'shootDays * 0.5',            working: 'shootDays * 0.5',            committed: 'shootDays * 0.5' },
      rate: { estimate: '1200.00',                    working: '1200.00',                    committed: '1200.00' } },
    { code: 'D',  description: 'Crew Travel (flights + ground)',            unit: 'FLAT', fringeRate: '0',    tags: [],
      qty:  { estimate: '1',                          working: '1',                          committed: '1' },
      rate: { estimate: '4500.00',                    working: '5200.00',                    committed: '5200.00' } },
    { code: 'D',  description: 'Per Diem',                                  unit: 'DAY',  fringeRate: '0',    tags: [],
      qty:  { estimate: 'crewSize * shootDays',       working: 'crewSize * shootDays',       committed: 'crewSize * shootDays' },
      rate: { estimate: '60.00',                      working: '70.00',                      committed: '70.00' } },
    // E — Props/Wardrobe/HMU
    { code: 'E',  description: 'Props Rental & Purchase',                   unit: 'FLAT', fringeRate: '0',    tags: ['dept:art'],
      qty:  { estimate: '1',                          working: '1',                          committed: '1' },
      rate: { estimate: '2200.00',                    working: '2800.00',                    committed: '2800.00' } },
    { code: 'E',  description: 'HMU Kit',                                   unit: 'FLAT', fringeRate: '0',    tags: ['dept:hmu'],
      qty:  { estimate: '1',                          working: '1',                          committed: '1' },
      rate: { estimate: '600.00',                     working: '750.00',                     committed: '750.00' } },
    // H — Equipment
    { code: 'H',  description: 'Camera Package (Sony FX9 + lenses)',        unit: 'DAY',  fringeRate: '0',    tags: ['dept:camera'],
      qty:  { estimate: 'shootDays',                  working: 'shootDays',                  committed: 'shootDays' },
      rate: { estimate: '850.00',                     working: '950.00',                     committed: '950.00' } },
    { code: 'H',  description: 'Lighting Package',                          unit: 'DAY',  fringeRate: '0',    tags: ['dept:lighting'],
      qty:  { estimate: 'shootDays',                  working: 'shootDays',                  committed: 'shootDays' },
      rate: { estimate: '600.00',                     working: '700.00',                     committed: '700.00' } },
    { code: 'H',  description: 'Grip Package',                              unit: 'DAY',  fringeRate: '0',    tags: ['dept:grip'],
      qty:  { estimate: 'shootDays',                  working: 'shootDays',                  committed: 'shootDays' },
      rate: { estimate: '500.00',                     working: '550.00',                     committed: '550.00' } },
    { code: 'H',  description: 'Specialty Lenses (anamorphic adapter)',     unit: 'FLAT', fringeRate: '0',    tags: ['dept:camera'],
      qty:  { estimate: '1',                          working: '1',                          committed: '1' },
      rate: { estimate: '900.00',                     working: '1100.00',                    committed: '1100.00' } },
    // I — Media / Data Management
    { code: 'I',  description: 'DIT (Digital Imaging Technician)',          unit: 'DAY',  fringeRate: '0.18', tags: ['dept:camera'],
      qty:  { estimate: 'shootDays',                  working: 'shootDays',                  committed: 'shootDays' },
      rate: { estimate: '700.00',                     working: '750.00',                     committed: '750.00' } },
    { code: 'I',  description: 'Hard Drives + Backup Media',                unit: 'FLAT', fringeRate: '0',    tags: [],
      qty:  { estimate: '1',                          working: '1',                          committed: '1' },
      rate: { estimate: '900.00',                     working: '1200.00',                    committed: '1200.00' } },
    // J — Talent
    { code: 'J',  description: 'Lead Talent (winemaker)',                   unit: 'DAY',  fringeRate: '0',    tags: [],
      qty:  { estimate: 'shootDays',                  working: 'shootDays',                  committed: 'shootDays' },
      rate: { estimate: '800.00',                     working: '1000.00',                    committed: '1000.00' } },
    { code: 'J',  description: 'Supporting Talent (vineyard hands)',        unit: 'DAY',  fringeRate: '0',    tags: [],
      qty:  { estimate: 'shootDays * 2',              working: 'shootDays * 2',              committed: 'shootDays * 2' },
      rate: { estimate: '350.00',                     working: '400.00',                     committed: '400.00' } },
    // K — Editorial
    { code: 'K',  description: 'Editor',                                    unit: 'WEEK', fringeRate: '0',    tags: ['dept:post'],
      qty:  { estimate: '4',                          working: '6',                          committed: '6' },
      rate: { estimate: '2800.00',                    working: '3000.00',                    committed: '3000.00' } },
    { code: 'K',  description: 'Color Grade',                               unit: 'FLAT', fringeRate: '0',    tags: ['dept:post'],
      qty:  { estimate: '1',                          working: '1',                          committed: '1' },
      rate: { estimate: '4500.00',                    working: '5500.00',                    committed: '5500.00' } },
    { code: 'K',  description: 'Sound Mix',                                 unit: 'FLAT', fringeRate: '0',    tags: ['dept:post'],
      qty:  { estimate: '1',                          working: '1',                          committed: '1' },
      rate: { estimate: '2500.00',                    working: '3000.00',                    committed: '3000.00' } },
    { code: 'K',  description: 'Music License',                             unit: 'FLAT', fringeRate: '0',    tags: ['dept:post'],
      qty:  { estimate: '1',                          working: '1',                          committed: '1' },
      rate: { estimate: '1500.00',                    working: '2500.00',                    committed: '2500.00' } },
    // L — Insurance / Misc
    { code: 'L',  description: 'Production Insurance',                      unit: 'FLAT', fringeRate: '0',    tags: [],
      qty:  { estimate: '1',                          working: '1',                          committed: '1' },
      rate: { estimate: '2800.00',                    working: '3200.00',                    committed: '3200.00' } },
    { code: 'L',  description: 'Petty Cash + Misc',                         unit: 'FLAT', fringeRate: '0',    tags: [],
      qty:  { estimate: '1',                          working: '1',                          committed: '1' },
      rate: { estimate: '500.00',                     working: '750.00',                     committed: '750.00' } },
  ]

  let lineSortOrder = 1
  const linesByDescription = new Map<string, { id: string }>()
  for (const spec of lineSpecs) {
    const account = accountByCode.get(spec.code)
    if (!account) throw new Error(`Budget seed: account ${spec.code} not found`)
    const created = await prisma.budgetLine.create({ data: {
      budgetId: ivvBudget.id, accountId: account.id,
      description: spec.description, unit: spec.unit, fringeRate: spec.fringeRate,
      tags: spec.tags ?? [], sortOrder: lineSortOrder++,
    } })
    linesByDescription.set(spec.description, created)
    await prisma.budgetLineAmount.createMany({ data: [
      { lineId: created.id, versionId: estimateV.id,  qty: spec.qty.estimate,  rate: spec.rate.estimate },
      { lineId: created.id, versionId: workingV.id,   qty: spec.qty.working,   rate: spec.rate.working },
      { lineId: created.id, versionId: committedV.id, qty: spec.qty.committed, rate: spec.rate.committed },
    ] })
  }

  // Variables — `crewSize` budget-level + version-scoped override on Working.
  await prisma.budgetVariable.createMany({ data: [
    { budgetId: ivvBudget.id, versionId: null,        name: 'crewSize', value: '12', notes: '12 crew on the hero shoot days' },
    { budgetId: ivvBudget.id, versionId: workingV.id, name: 'crewSize', value: '14', notes: 'override — bigger crew on Working version' },
  ] })

  // Markups — one accountSubtotal-targeted, one grandTotal.
  const insuranceAccount = accountByCode.get('L')
  if (!insuranceAccount) throw new Error('Budget seed: account L not found for Contingency markup')
  await prisma.budgetMarkup.createMany({ data: [
    { budgetId: ivvBudget.id, versionId: null, name: 'Contingency',
      percent: '0.10', appliesTo: 'accountSubtotal', accountId: insuranceAccount.id, sortOrder: 1 },
    { budgetId: ivvBudget.id, versionId: null, name: 'Agency Fee',
      percent: '0.05', appliesTo: 'grandTotal', accountId: null, sortOrder: 2 },
  ] })

  // Expenses — 12 from approved IVV timecards (mapped round-robin to crew labor lines).
  // Uses computeExpenseUnits from @origin-one/schema (PR 6) — single source of
  // truth for the rate-unit math; same helper that powers the EntryCard total
  // computation and the future timecard-to-expense flow (PR 8).
  const ivvCrewLines = [
    'Director of Photography', '1st AC', 'Gaffer', 'Key Grip', 'Sound Mixer', 'Boom Operator',
  ].map(d => linesByDescription.get(d)!).filter(Boolean)

  const approvedIvvTimecards = await prisma.crewTimecard.findMany({
    where: { projectId: p3.id, status: 'approved', rate: { not: null }, rateUnit: { not: null } },
    select: { id: true, date: true, rate: true, hours: true, rateUnit: true, crewMemberId: true, approvedBy: true },
    orderBy: { date: 'asc' },
    take: 12,
  })
  const expenseRowsFromTimecards = approvedIvvTimecards.map((t, i) => {
    const line = ivvCrewLines[i % ivvCrewLines.length]
    const rate = Number(t.rate)
    const { units, unit } = computeExpenseUnits(t.rateUnit!, Number(t.hours))
    const amount = units * rate
    return {
      budgetId: ivvBudget.id, lineId: line.id, source: 'timecard' as const,
      amount: amount.toFixed(2), date: t.date,
      units: units.toFixed(2), unitRate: rate.toFixed(2), unit,
      timecardId: t.id, createdBy: t.approvedBy ?? clydeOnIvv.id,
    }
  })
  if (expenseRowsFromTimecards.length > 0) {
    await prisma.expense.createMany({ data: expenseRowsFromTimecards })
  }

  // Manual expenses — receipts-style entries across 5 lines.
  const propsLine     = linesByDescription.get('Props Rental & Purchase')!
  const hmuLine       = linesByDescription.get('HMU Kit')!
  const travelLine    = linesByDescription.get('Crew Travel (flights + ground)')!
  const perDiemLine   = linesByDescription.get('Per Diem')!
  const driveLine     = linesByDescription.get('Hard Drives + Backup Media')!
  const insuranceLine = linesByDescription.get('Production Insurance')!
  const pettyCashLine = linesByDescription.get('Petty Cash + Misc')!

  const manualExpenses = [
    { line: propsLine,     amount:  '420.00', date: daysAgo(7),  vendor: 'Napa Antique Co.', notes: 'Vintage decanters for cellar scene' },
    { line: hmuLine,       amount:   '85.00', date: daysAgo(6),  vendor: 'Sephora',           notes: 'Replenish HMU kit — winemaker dust look' },
    { line: travelLine,    amount: '1240.00', date: daysAgo(12), vendor: 'United',            notes: 'DP flight SFO → BOI roundtrip' },
    { line: perDiemLine,   amount:  '420.00', date: daysAgo(5),  vendor: 'Cash advance',      notes: 'Day 3 per diem (12 crew × $35)' },
    { line: driveLine,     amount:  '380.00', date: daysAgo(10), vendor: 'B&H',               notes: '4× LaCie 4TB SSDs for camera ingest' },
    { line: insuranceLine, amount: '3200.00', date: daysAgo(20), vendor: 'Hub Intl',          notes: 'Production insurance — full shoot window' },
    { line: pettyCashLine, amount:   '64.00', date: daysAgo(4),  vendor: 'Walgreens',         notes: 'Sunscreen + first aid resupply' },
    { line: pettyCashLine, amount:   '38.00', date: daysAgo(3),  vendor: 'Vineyard Cafe',     notes: 'Crew coffee runs' },
  ]
  await prisma.expense.createMany({ data: manualExpenses.map(e => ({
    budgetId: ivvBudget.id, lineId: e.line.id, source: 'manual' as const,
    amount: e.amount, date: e.date,
    units: null, unitRate: null, unit: null,
    vendor: e.vendor, notes: e.notes, receiptUrl: null,
    timecardId: null, createdBy: clydeOnIvv.id,
  })) })

  console.log(`  Budgets:    1 (In Vino Veritas — ` +
    `${DEFAULT_AICP_ACCOUNTS.length} accounts, ${lineSpecs.length} lines, ` +
    `${expenseRowsFromTimecards.length} timecard + ${manualExpenses.length} manual expenses)`)

  // ── Crew Profile v2 demo data (#20) ──────────────────────────────────────
  // Sprinkle realistic phone/skills onto a handful of well-known crew so the
  // upcoming Crew Profile UI (#22) has populated data to render against. Most
  // crew stay sparse so empty states get exercised too.
  const demoCrewProfiles: { name: string; phone: string; skills: string[] }[] = [
    { name: 'Clyde Bessey',       phone: '+1 213 555 0102', skills: ['Direction', 'Camera Operation', 'Color', 'Steadicam'] },
    { name: 'Tyler Heckerman',    phone: '+1 310 555 0214', skills: ['Producing', 'Budgeting', 'Permitting'] },
    { name: 'Kelly Pratt',        phone: '+1 323 555 0388', skills: ['Producing', 'Talent Relations'] },
    { name: 'Alex Drum',          phone: '+1 415 555 0411', skills: ['Cinematography', 'Lighting', 'Color Theory'] },
    { name: 'Owen Blakely',       phone: '+1 213 555 0577', skills: ['Cinematography', 'Documentary'] },
    { name: 'Rafi Torres',        phone: '+1 646 555 0698', skills: ['Editorial', 'Premiere Pro', 'DaVinci Resolve'] },
    { name: 'Cleo Strand',        phone: '+1 718 555 0723', skills: ['Motion Design', 'Nuke', 'After Effects'] },
  ]
  // Project-scoped notes — a few examples of how notes vary per role.
  // Format: [project, userName, role, notes]
  const demoProjectNotes: { project: { id: string }; userName: string; role: Role; notes: string }[] = [
    { project: p1, userName: 'Clyde Bessey',    role: 'director', notes: 'Owns the creative vision; loop in early on storyboard reviews.' },
    { project: p3, userName: 'Owen Blakely',    role: 'crew',     notes: 'Brings Sony FX9 + glimmerglass package; vineyard-light specialist.' },
    { project: p3, userName: 'Rafi Torres',     role: 'crew',     notes: 'Cross-project post — also editing Natural Order. Schedule rough cut for Apr 22.' },
    { project: p5, userName: 'Cleo Strand',     role: 'crew',     notes: 'GFX hero composite for Climate Report sequence. Needs storyboard lock by week 2.' },
  ]
  let profileUpdates = 0
  for (const profile of demoCrewProfiles) {
    const u = await prisma.user.findFirst({ where: { name: profile.name }, select: { id: true } })
    if (!u) continue
    await prisma.user.update({ where: { id: u.id }, data: { phone: profile.phone } })
    // Apply skills to ALL ProjectMember rows for this user — skills are
    // role-relevant and the same person's skill list is the same regardless
    // of which project they're on for v1. Future PRs can diverge per-role
    // if real productions surface the need.
    await prisma.projectMember.updateMany({ where: { userId: u.id }, data: { skills: profile.skills } })
    profileUpdates++
  }
  let noteUpdates = 0
  for (const n of demoProjectNotes) {
    const u = await prisma.user.findFirst({ where: { name: n.userName }, select: { id: true } })
    if (!u) continue
    const updated = await prisma.projectMember.updateMany({
      where: { projectId: n.project.id, userId: u.id, role: n.role },
      data: { notes: n.notes },
    })
    noteUpdates += updated.count
  }
  console.log(`  CrewProfileV2: ${profileUpdates} users with phone/skills, ${noteUpdates} project-scoped notes`)

  // ── PropSourced — production-side counterpart to Entity(type='prop') ────
  // Dual-write during the lift-and-break transition: Entity.metadata.status
  // remains the read path until #14 swaps art/page.tsx to PropSourced.status.
  // Same mapping as migration `20260426210000_add_prop_sourced`.
  const allPropEntities = await prisma.entity.findMany({
    where: { type: 'prop' },
    select: { id: true, projectId: true, metadata: true },
  })
  const propSourcedRows = allPropEntities.map(e => {
    const status = ((e.metadata as any)?.status ?? null) as string | null
    let mapped: 'needed' | 'sourced' | 'ready' = 'needed'
    let isHero = false
    if (status === 'sourced')        mapped = 'sourced'
    else if (status === 'confirmed') mapped = 'ready'
    else if (status === 'hero')    { mapped = 'ready'; isHero = true }
    else if (status === 'needed')    mapped = 'needed'
    // anything else → default 'needed'
    return {
      projectId: e.projectId,
      entityId: e.id,
      status: mapped,
      isHero,
    }
  })
  if (propSourcedRows.length > 0) {
    await prisma.propSourced.createMany({ data: propSourcedRows })
    const breakdown = propSourcedRows.reduce(
      (acc, r) => {
        acc[r.status]++
        if (r.isHero) acc.hero++
        return acc
      },
      { needed: 0, sourced: 0, ready: 0, hero: 0 } as Record<string, number>,
    )
    console.log(
      `  PropSourced: ${propSourcedRows.length} ` +
      `(${breakdown.needed} needed, ${breakdown.sourced} sourced, ${breakdown.ready} ready` +
      `${breakdown.hero > 0 ? `, ${breakdown.hero} hero` : ''})`
    )
  }

  // ── WardrobeSourced — production-side counterpart to Entity(type='wardrobe')
  // Dual-write during the lift-and-break transition: Entity.metadata.status
  // remains the read path until #16 swaps art/page.tsx. Same mapping as
  // migration `20260427000000_add_wardrobe_sourced`. No isHero — wardrobe
  // doesn't carry the hero concept (per DECISIONS "WardrobeSourced schema").
  const allWardrobeEntities = await prisma.entity.findMany({
    where: { type: 'wardrobe' },
    select: { id: true, projectId: true, metadata: true },
  })
  const wardrobeSourcedRows = allWardrobeEntities.map(e => {
    const status = ((e.metadata as any)?.status ?? null) as string | null
    let mapped: 'needed' | 'sourced' | 'fitted' | 'ready' = 'needed'
    if (status === 'sourced')        mapped = 'sourced'
    else if (status === 'confirmed') mapped = 'ready'
    else if (status === 'fitted')    mapped = 'fitted'
    else if (status === 'needed')    mapped = 'needed'
    // anything else → default 'needed'
    return { projectId: e.projectId, entityId: e.id, status: mapped }
  })
  if (wardrobeSourcedRows.length > 0) {
    await prisma.wardrobeSourced.createMany({ data: wardrobeSourcedRows })
    const wbreakdown = wardrobeSourcedRows.reduce(
      (acc, r) => { acc[r.status]++; return acc },
      { needed: 0, sourced: 0, fitted: 0, ready: 0 } as Record<string, number>,
    )
    console.log(
      `  WardrobeSourced: ${wardrobeSourcedRows.length} ` +
      `(${wbreakdown.needed} needed, ${wbreakdown.sourced} sourced, ${wbreakdown.fitted} fitted, ${wbreakdown.ready} ready)`
    )
  }

  // ── Seed images: EntityAttachment surfaces ───────────────────────────────
  // Walks MANIFEST for every EntityAttachment surface and uploads + records.
  //
  // matchByName resolution per surface:
  //   location           → Location.where({ projectId, name })            → Location.id
  //   narrativeLocation  → Entity.where({ projectId, type:'location', name }) → Entity.id
  //   prop               → Entity.where({ projectId, type:'prop', name })     → Entity.id
  //   wardrobe           → Entity.where({ projectId, type:'wardrobe', name }) → Entity.id
  //   hmu                → Entity.where({ projectId, type:'hmu', name })      → Entity.id
  //   cast               → Talent.where({ projectId, name })                  → Talent.id

  const ENTITY_ATTACHMENT_SURFACES = ['location', 'narrativeLocation', 'prop', 'wardrobe', 'hmu', 'cast'] as const
  type EaSurface = typeof ENTITY_ATTACHMENT_SURFACES[number]

  async function resolveAttachedToId(
    projectId: string,
    surface: EaSurface,
    name: string,
  ): Promise<string | null> {
    switch (surface) {
      case 'location': {
        const r = await prisma.location.findFirst({ where: { projectId, name } })
        return r?.id ?? null
      }
      case 'narrativeLocation': {
        const r = await prisma.entity.findFirst({ where: { projectId, type: 'location', name } })
        return r?.id ?? null
      }
      case 'prop': {
        const r = await prisma.entity.findFirst({ where: { projectId, type: 'prop', name } })
        return r?.id ?? null
      }
      case 'wardrobe': {
        const r = await prisma.entity.findFirst({ where: { projectId, type: 'wardrobe', name } })
        return r?.id ?? null
      }
      case 'hmu': {
        const r = await prisma.entity.findFirst({ where: { projectId, type: 'hmu', name } })
        return r?.id ?? null
      }
      case 'cast': {
        const r = await prisma.talent.findFirst({ where: { projectId, name } })
        return r?.id ?? null
      }
    }
  }

  console.log('  Uploading EntityAttachment images…')
  const eaEntries = MANIFEST.filter((e): e is typeof e & { surface: EaSurface } =>
    (ENTITY_ATTACHMENT_SURFACES as readonly string[]).includes(e.surface),
  )
  const attachmentRows: Array<{
    projectId: string
    attachedToType: string
    attachedToId: string
    storagePath: string
    caption: string | null
    uploadedById: string | null
    mimeType: string
  }> = []
  let eaUploaded = 0
  let eaMissing = 0
  for (const entry of eaEntries) {
    if (entry.projectKey === 'crew') continue
    const projectId = projectIdByKey(entry.projectKey)
    const attachedToId = await resolveAttachedToId(projectId, entry.surface, entry.matchByName)
    if (!attachedToId) {
      console.warn(`    ! ${entry.surface} not found: ${entry.projectKey}/${entry.matchByName}`)
      eaMissing++
      continue
    }
    const sp = storagePath(entry, attachedToId)  // 'location/<id>/<slug>.jpg'
    await uploadSeedImage({
      localRelativePath: localFilePath(entry),
      bucket: 'entity-attachments',
      storagePath: sp,
    })
    attachmentRows.push({
      projectId,
      attachedToType: entry.surface,
      attachedToId,
      storagePath: sp,
      caption: entry.caption ?? null,
      uploadedById: clydeBessey.id,
      mimeType: 'image/jpeg',
    })

    // Per-row image fields (used by UIs that read directly rather than
    // through the EntityAttachment gallery — Art page reads
    // Entity.metadata.imageUrl, Casting reads Talent.imageUrl).
    // Locations have already migrated to EA-only (Location.imageUrl removed).
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/entity-attachments/${sp}`
    if (entry.surface === 'cast') {
      await prisma.talent.update({ where: { id: attachedToId }, data: { imageUrl: publicUrl } })
    } else if (entry.surface === 'prop' || entry.surface === 'wardrobe' || entry.surface === 'hmu') {
      const ent = await prisma.entity.findUnique({ where: { id: attachedToId } })
      const meta = (ent?.metadata && typeof ent.metadata === 'object' && !Array.isArray(ent.metadata))
        ? (ent.metadata as Record<string, unknown>) : {}
      await prisma.entity.update({
        where: { id: attachedToId },
        data: { metadata: { ...meta, imageUrl: publicUrl } },
      })
    }

    eaUploaded++
  }
  if (attachmentRows.length > 0) {
    await prisma.entityAttachment.createMany({ data: attachmentRows })
  }
  console.log(`  EntityAttachments: uploaded ${eaUploaded}, missing-row ${eaMissing}`)

  // ── Seed images: User avatars ────────────────────────────────────────────
  console.log('  Uploading crew avatars…')
  const avatarEntries = MANIFEST.filter((e) => e.surface === 'avatar')
  let avatarUploaded = 0, avatarMissing = 0
  for (const entry of avatarEntries) {
    const user = await prisma.user.findFirst({ where: { name: entry.matchByName } })
    if (!user) {
      console.warn(`    ! user not found: ${entry.matchByName}`)
      avatarMissing++
      continue
    }
    const sp = storagePath(entry, user.id)  // '<userId>/<slug>.jpg'
    await uploadSeedImage({
      localRelativePath: localFilePath(entry),
      bucket: 'avatars',
      storagePath: sp,
    })
    // CrewPanel and HubContent render <img src={avatarUrl}> directly, so the
    // value must be a full public URL (matching the convention of the
    // uploadAvatar helper in queries.ts).
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${sp}`
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: publicUrl },
    })
    avatarUploaded++
  }
  console.log(`  Avatars: uploaded ${avatarUploaded}, missing-user ${avatarMissing}`)

  // ── Final count ───────────────────────────────────────────────────────────
  const counts = {
    projects:          await prisma.project.count(),
    scenes:            await prisma.scene.count(),
    shots:             await prisma.shot.count(),
    entities:          await prisma.entity.count(),
    documents:         await prisma.document.count(),
    users:             await prisma.user.count(),
    teamMembers:       await prisma.teamMember.count(),
    projectMembers:    await prisma.projectMember.count(),
    milestones:        await prisma.milestone.count(),
    actionItems:       await prisma.actionItem.count(),
    locations:         await prisma.location.count(),
    inventoryItems:    await prisma.inventoryItem.count(),
    talents:           await prisma.talent.count(),
    talentAssignments: await prisma.talentAssignment.count(),
    workflowNodes:     await prisma.workflowNode.count(),
    workflowEdges:     await prisma.workflowEdge.count(),
    deliverables:      await prisma.deliverable.count(),
    moodboardTabs:     await prisma.moodboardTab.count(),
    moodboardRefs:     await prisma.moodboardRef.count(),
    threads:           await prisma.thread.count(),
    threadMessages:    await prisma.threadMessage.count(),
    threadReads:       await prisma.threadRead.count(),
    resolvedThreads:   await prisma.thread.count({ where: { resolvedAt: { not: null } } }),
    shootDays:         await prisma.shootDay.count(),
    budgets:           await prisma.budget.count(),
    budgetVersions:    await prisma.budgetVersion.count(),
    budgetAccounts:    await prisma.budgetAccount.count(),
    budgetLines:       await prisma.budgetLine.count(),
    budgetLineAmounts: await prisma.budgetLineAmount.count(),
    budgetVariables:   await prisma.budgetVariable.count(),
    budgetMarkups:     await prisma.budgetMarkup.count(),
    expenses:          await prisma.expense.count(),
    entityAttachments: await prisma.entityAttachment.count(),
    propSourced:       await prisma.propSourced.count(),
    wardrobeSourced:   await prisma.wardrobeSourced.count(),
  }

  console.log('  ─────────────────────────────')
  console.log(`  Projects:           ${counts.projects}`)
  console.log(`  Scenes:             ${counts.scenes}`)
  console.log(`  Shots:              ${counts.shots}`)
  console.log(`  Entities:           ${counts.entities}`)
  console.log(`  Documents:          ${counts.documents}`)
  console.log(`  Users:              ${counts.users}`)
  console.log(`  TeamMembers:        ${counts.teamMembers}`)
  console.log(`  ProjectMembers:     ${counts.projectMembers}`)
  console.log(`  Milestones:         ${counts.milestones}`)
  console.log(`  ActionItems:        ${counts.actionItems}`)
  console.log(`  Locations:          ${counts.locations}`)
  console.log(`  InventoryItems:     ${counts.inventoryItems}`)
  console.log(`  Talents:            ${counts.talents}`)
  console.log(`  TalentAssignments:  ${counts.talentAssignments}`)
  console.log(`  WorkflowNodes:      ${counts.workflowNodes}`)
  console.log(`  WorkflowEdges:      ${counts.workflowEdges}`)
  console.log(`  Deliverables:       ${counts.deliverables}`)
  console.log(`  MoodboardTabs:      ${counts.moodboardTabs}`)
  console.log(`  MoodboardRefs:      ${counts.moodboardRefs}`)
  console.log(`  Threads:            ${counts.threads}`)
  console.log(`  ThreadMessages:     ${counts.threadMessages}`)
  console.log(`  ThreadReads:        ${counts.threadReads}`)
  console.log(`  ResolvedThreads:    ${counts.resolvedThreads}`)
  console.log(`  ShootDays:          ${counts.shootDays}`)
  console.log(`  Budgets:            ${counts.budgets}`)
  console.log(`  BudgetVersions:     ${counts.budgetVersions}`)
  console.log(`  BudgetAccounts:     ${counts.budgetAccounts}`)
  console.log(`  BudgetLines:        ${counts.budgetLines}`)
  console.log(`  BudgetLineAmounts:  ${counts.budgetLineAmounts}`)
  console.log(`  BudgetVariables:    ${counts.budgetVariables}`)
  console.log(`  BudgetMarkups:      ${counts.budgetMarkups}`)
  console.log(`  Expenses:           ${counts.expenses}`)
  console.log(`  EntityAttachments:  ${counts.entityAttachments}`)
  console.log(`  PropSourced:        ${counts.propSourced}`)
  console.log(`  WardrobeSourced:    ${counts.wardrobeSourced}`)
  console.log('  ─────────────────────────────')
  console.log('  Done.\n')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
