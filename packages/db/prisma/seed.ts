// packages/db/prisma/seed.ts
// Run with: pnpm db:seed
// Wipes all existing data and inserts the six Origin Point seed projects clean.

import { PrismaClient, Role } from '@prisma/client'

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
  await prisma.teamMember.upsert({
    where:  { teamId_userId: { teamId, userId: user.id } },
    update: {},
    create: { teamId, userId: user.id, role },
  })
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
  await prisma.crewTimecard.deleteMany()
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

  // P2 — Locations (3)
  await prisma.location.createMany({ data: [
    {
      projectId: p2.id,
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
      name: 'DTLA Rooftop Court',
      description: 'Private rooftop basketball court with downtown skyline backdrop. Final segment — golden hour, wide establishing and tight action cuts.',
      address: '888 S Hope St, Los Angeles, CA 90017 (roof level)',
      keyContact: 'Building management — Derek Sato — (213) 555-0442',
      shootDates: 'Apr 12',
      status: 'scouting',
      approved: false,
      notes: 'Scouted Apr 8. Access via freight elevator. Weight limit 3,000 lbs for gear. Backup: Grand Park courts.',
      // Note: no matching Entity(type=location) in seed — names differ from script locations
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

  // P4 — Locations (3)
  await prisma.location.createMany({ data: [
    {
      projectId: p4.id,
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
  // P8 — CREW TIMECARDS
  // 35 entries across 5 projects (P5 intentionally empty).
  // Distribution: 9 / 5 / 6 / 5 / 0 / 10 across P1–P6.
  // States: 26 approved, 6 submitted, 2 draft, 1 reopened.
  // Source of truth: apps/back-to-one/reference/crew-timecards-seed-v2.md
  // Eligibility: excludes Client + Other departments (11 talent rows, 2 clients).
  // ══════════════════════════════════════════════════════════════════════════

  // Resolve a ProjectMember by (projectId, crew display name). The display
  // name lives on the joined User row — ProjectMember has no name column.
  // Fails fast on miss, matching the mustFind pattern used in Threads.
  async function findMember(projectId: string, name: string) {
    const m = await prisma.projectMember.findFirst({
      where: { projectId, user: { is: { name } } },
    })
    if (!m) throw new Error(`[timecards seed] ProjectMember '${name}' not found on project ${projectId}`)
    return m
  }

  // Timestamp helpers — explicit UTC so behavior is stable across machines.
  //   tcDate(day)       → @db.Date column value (midnight UTC)
  //   tcStamp(day, hh)  → submittedAt / approvedAt / reopenedAt timestamps
  const tcDate  = (day: string) => new Date(`${day}T00:00:00.000Z`)
  const tcStamp = (day: string, hh: number) =>
    new Date(`${day}T${String(hh).padStart(2, '0')}:00:00.000Z`)

  // ── P1 Timecards (9) ────────────────────────────────────────────────────
  const p1PriyaMbr  = await findMember(p1.id, 'Priya Nair')
  const p1TheoMbr   = await findMember(p1.id, 'Theo Hartmann')
  const p1CarlosMbr = await findMember(p1.id, 'Carlos Vega')
  const p1TanyaMbr  = await findMember(p1.id, 'Tanya Mills')
  const p1DerekMbr  = await findMember(p1.id, 'Derek Huang')
  const p1NinaMbr   = await findMember(p1.id, 'Nina Osei')
  const p1FionaMbr  = await findMember(p1.id, 'Fiona Drake')
  const p1AndreMbr  = await findMember(p1.id, 'Andre Kim')
  const p1MiaMbr    = await findMember(p1.id, 'Mia Chen')
  const p1KellyMbr  = await findMember(p1.id, 'Kelly Pratt')
  const p1TylerHMbr = await findMember(p1.id, 'Tyler Heckerman')

  await prisma.crewTimecard.createMany({ data: [
    { projectId: p1.id, crewMemberId: p1PriyaMbr.id,  date: tcDate('2026-04-13'), hours: 12.0, description: 'Camera prep, beauty lighting tests at Bel Air estate', status: 'approved',  submittedAt: tcStamp('2026-04-13', 20), approvedAt: tcStamp('2026-04-14', 10), approvedBy: p1KellyMbr.id },
    { projectId: p1.id, crewMemberId: p1TheoMbr.id,   date: tcDate('2026-04-13'), hours: 12.0, description: 'B-cam coverage, hero product macro inserts',           status: 'approved',  submittedAt: tcStamp('2026-04-13', 20), approvedAt: tcStamp('2026-04-14', 10), approvedBy: p1KellyMbr.id },
    { projectId: p1.id, crewMemberId: p1CarlosMbr.id, date: tcDate('2026-04-14'), hours: 12.5, description: 'A-cam talent coverage, product reveals',               status: 'submitted', submittedAt: tcStamp('2026-04-14', 20) },
    { projectId: p1.id, crewMemberId: p1TanyaMbr.id,  date: tcDate('2026-04-13'), hours: 13.0, description: 'Key + fill beauty setup, diffusion pass',              status: 'approved',  submittedAt: tcStamp('2026-04-13', 20), approvedAt: tcStamp('2026-04-14', 10), approvedBy: p1KellyMbr.id },
    { projectId: p1.id, crewMemberId: p1DerekMbr.id,  date: tcDate('2026-04-14'), hours: 12.0, description: 'Grip rigging, dolly setup for beauty moves',           status: 'approved',  submittedAt: tcStamp('2026-04-14', 20), approvedAt: tcStamp('2026-04-15', 10), approvedBy: p1TylerHMbr.id },
    { projectId: p1.id, crewMemberId: p1NinaMbr.id,   date: tcDate('2026-04-13'), hours: 12.0, description: 'Hero product styling, set dressing',                   status: 'approved',  submittedAt: tcStamp('2026-04-13', 20), approvedAt: tcStamp('2026-04-14', 10), approvedBy: p1KellyMbr.id },
    { projectId: p1.id, crewMemberId: p1FionaMbr.id,  date: tcDate('2026-04-14'), hours: 10.5, description: 'Talent makeup, beauty continuity',                     status: 'submitted', submittedAt: tcStamp('2026-04-14', 20) },
    { projectId: p1.id, crewMemberId: p1AndreMbr.id,  date: tcDate('2026-04-14'), hours: 11.0, description: 'VO booth capture, room tone',                          status: 'approved',  submittedAt: tcStamp('2026-04-14', 20), approvedAt: tcStamp('2026-04-15', 10), approvedBy: p1KellyMbr.id },
    { projectId: p1.id, crewMemberId: p1MiaMbr.id,    date: tcDate('2026-04-13'), hours: 13.5, description: 'Crew coordination, talent wrangling, call sheets',     status: 'approved',  submittedAt: tcStamp('2026-04-13', 20), approvedAt: tcStamp('2026-04-14', 10), approvedBy: p1TylerHMbr.id },
  ]})

  // ── P2 Timecards (5) ────────────────────────────────────────────────────
  const p2DaniMbr   = await findMember(p2.id, 'Dani Reeves')
  const p2TylerGMbr = await findMember(p2.id, 'Tyler Green')
  const p2KellyMbr  = await findMember(p2.id, 'Kelly Pratt')
  const p2ClydeMbr  = await findMember(p2.id, 'Clyde Bessey')

  await prisma.crewTimecard.createMany({ data: [
    { projectId: p2.id, crewMemberId: p2DaniMbr.id,   date: tcDate('2026-04-14'), hours: 11.0, description: 'Mountain biking coverage, handheld + gimbal',   status: 'submitted', submittedAt: tcStamp('2026-04-14', 21) },
    { projectId: p2.id, crewMemberId: p2DaniMbr.id,   date: tcDate('2026-04-15'), hours: 12.5, description: 'Skate park session, slow-mo and standard',      status: 'submitted', submittedAt: tcStamp('2026-04-15', 21) },
    { projectId: p2.id, crewMemberId: p2TylerGMbr.id, date: tcDate('2026-04-14'), hours: 13.0, description: 'Location lockdown, athlete coordination',        status: 'approved',  submittedAt: tcStamp('2026-04-14', 20), approvedAt: tcStamp('2026-04-15', 10), approvedBy: p2KellyMbr.id },
    { projectId: p2.id, crewMemberId: p2KellyMbr.id,  date: tcDate('2026-04-15'), hours: 13.5, description: 'Multi-location producing, own-time logged',      status: 'submitted', submittedAt: tcStamp('2026-04-15', 21) },
    { projectId: p2.id, crewMemberId: p2ClydeMbr.id,  date: tcDate('2026-04-16'), hours: 10.0, description: 'Surf coverage directing at dawn',                status: 'draft' },
  ]})

  // ── P3 Timecards (6, incl. 1 reopened) ──────────────────────────────────
  const p3OwenMbr   = await findMember(p3.id, 'Owen Blakely')
  const p3TomMbr    = await findMember(p3.id, 'Tom Vega')
  const p3RyanMbr   = await findMember(p3.id, 'Ryan Cole')
  const p3TylerHMbr = await findMember(p3.id, 'Tyler Heckerman')
  const p3ClydeMbr  = await findMember(p3.id, 'Clyde Bessey')
  const p3KellyMbr  = await findMember(p3.id, 'Kelly Pratt')

  await prisma.crewTimecard.createMany({ data: [
    { projectId: p3.id, crewMemberId: p3OwenMbr.id,   date: tcDate('2026-04-06'), hours: 10.0, description: 'Vineyard establishing shots, golden hour', status: 'approved', submittedAt: tcStamp('2026-04-06', 20), approvedAt: tcStamp('2026-04-07', 10), approvedBy: p3KellyMbr.id },
    { projectId: p3.id, crewMemberId: p3OwenMbr.id,   date: tcDate('2026-04-08'), hours: 12.0, description: 'Harvest multi-cam coverage',                status: 'approved', submittedAt: tcStamp('2026-04-08', 20), approvedAt: tcStamp('2026-04-09', 10), approvedBy: p3KellyMbr.id },
    { projectId: p3.id, crewMemberId: p3TomMbr.id,    date: tcDate('2026-04-07'), hours: 10.5, description: 'Winemaker interview audio, lavs + boom',    status: 'approved', submittedAt: tcStamp('2026-04-07', 20), approvedAt: tcStamp('2026-04-08', 10), approvedBy: p3KellyMbr.id },
    // The single reopened entry in the seed — full lifecycle present:
    // submitted → approved (by Tyler H) → reopened (by Tyler H) with reason.
    {
      projectId: p3.id, crewMemberId: p3RyanMbr.id, date: tcDate('2026-04-08'), hours: 12.0,
      description: 'Harvest day coordination — hours need locations split',
      status: 'reopened',
      submittedAt:  tcStamp('2026-04-08', 20),
      approvedAt:   tcStamp('2026-04-09', 10),
      approvedBy:   p3TylerHMbr.id,
      reopenedAt:   tcStamp('2026-04-10', 14),
      reopenedBy:   p3TylerHMbr.id,
      reopenReason: 'Please split vineyard field hours from cellar hours — need locations broken out for the line-item audit.',
    },
    { projectId: p3.id, crewMemberId: p3TylerHMbr.id, date: tcDate('2026-04-06'), hours: 11.0, description: 'Vineyard owner coordination, location prep', status: 'approved', submittedAt: tcStamp('2026-04-06', 20), approvedAt: tcStamp('2026-04-07', 10), approvedBy: p3KellyMbr.id },
    { projectId: p3.id, crewMemberId: p3ClydeMbr.id,  date: tcDate('2026-04-10'), hours:  9.0, description: 'Pickups and drone directing, wrap',           status: 'approved', submittedAt: tcStamp('2026-04-10', 20), approvedAt: tcStamp('2026-04-11', 10), approvedBy: p3TylerHMbr.id },
  ]})

  // ── P4 Timecards (5) ────────────────────────────────────────────────────
  const p4AlexMbr   = await findMember(p4.id, 'Alex Drum')
  const p4HanaMbr   = await findMember(p4.id, 'Hana Liu')
  const p4TylerMMbr = await findMember(p4.id, 'Tyler Moss')
  const p4KellyMbr  = await findMember(p4.id, 'Kelly Pratt')
  const p4TylerHMbr = await findMember(p4.id, 'Tyler Heckerman')
  const p4ClydeMbr  = await findMember(p4.id, 'Clyde Bessey')

  await prisma.crewTimecard.createMany({ data: [
    { projectId: p4.id, crewMemberId: p4AlexMbr.id,   date: tcDate('2026-04-11'), hours: 9.0, description: 'Episode 1 yoga sequences, locked-off + handheld', status: 'approved',  submittedAt: tcStamp('2026-04-11', 20), approvedAt: tcStamp('2026-04-12', 10), approvedBy: p4KellyMbr.id },
    { projectId: p4.id, crewMemberId: p4HanaMbr.id,   date: tcDate('2026-04-11'), hours: 8.5, description: 'Instructor lavs, ambient room tone',                status: 'approved',  submittedAt: tcStamp('2026-04-11', 20), approvedAt: tcStamp('2026-04-12', 10), approvedBy: p4KellyMbr.id },
    { projectId: p4.id, crewMemberId: p4TylerMMbr.id, date: tcDate('2026-04-11'), hours: 9.0, description: 'Episode 1 coordination, talent support',            status: 'approved',  submittedAt: tcStamp('2026-04-11', 20), approvedAt: tcStamp('2026-04-12', 10), approvedBy: p4TylerHMbr.id },
    { projectId: p4.id, crewMemberId: p4AlexMbr.id,   date: tcDate('2026-04-16'), hours: 9.5, description: 'Episode 2 meditation segments, soft lighting',       status: 'submitted', submittedAt: tcStamp('2026-04-16', 20) },
    { projectId: p4.id, crewMemberId: p4ClydeMbr.id,  date: tcDate('2026-04-16'), hours: 8.0, description: 'Episode 2 directing, early cut review',              status: 'draft' },
  ]})

  // ── P5 Timecards (0) ────────────────────────────────────────────────────
  // Intentional empty state — Natural Order is a post-only project with no
  // production phase that would generate timecards. Exercises empty-state UI.

  // ── P6 Timecards (10, all approved — wrapped shoot) ─────────────────────
  const p6MayaMbr   = await findMember(p6.id, 'Maya Lin')
  const p6CalebMbr  = await findMember(p6.id, 'Caleb Stone')
  const p6ChrisMbr  = await findMember(p6.id, 'Chris Tan')
  const p6OmarMbr   = await findMember(p6.id, 'Omar Rashid')
  const p6DarioMbr  = await findMember(p6.id, 'Dario Reyes')
  const p6PetraMbr  = await findMember(p6.id, 'Petra Walsh')
  const p6SofiaMbr  = await findMember(p6.id, 'Sofia Avila')
  const p6RinaMbr   = await findMember(p6.id, 'Rina Cole')
  const p6KellyMbr  = await findMember(p6.id, 'Kelly Pratt')
  const p6TylerHMbr = await findMember(p6.id, 'Tyler Heckerman')
  const p6ClydeMbr  = await findMember(p6.id, 'Clyde Bessey')

  await prisma.crewTimecard.createMany({ data: [
    { projectId: p6.id, crewMemberId: p6MayaMbr.id,  date: tcDate('2026-04-01'), hours: 12.0, description: 'Day 1 exterior ravine sequences, magic hour', status: 'approved', submittedAt: tcStamp('2026-04-01', 20), approvedAt: tcStamp('2026-04-02', 10), approvedBy: p6KellyMbr.id },
    { projectId: p6.id, crewMemberId: p6CalebMbr.id, date: tcDate('2026-04-02'), hours: 13.5, description: 'Day 2 Lohm/Aleph dialogue coverage, A-cam',   status: 'approved', submittedAt: tcStamp('2026-04-02', 20), approvedAt: tcStamp('2026-04-03', 10), approvedBy: p6KellyMbr.id },
    { projectId: p6.id, crewMemberId: p6ChrisMbr.id, date: tcDate('2026-04-02'), hours: 13.0, description: 'Dialogue capture, multi-track, boom + lavs',  status: 'approved', submittedAt: tcStamp('2026-04-02', 20), approvedAt: tcStamp('2026-04-03', 10), approvedBy: p6KellyMbr.id },
    { projectId: p6.id, crewMemberId: p6OmarMbr.id,  date: tcDate('2026-04-03'), hours: 13.5, description: 'Scene 12 audio, dusk wind challenges',         status: 'approved', submittedAt: tcStamp('2026-04-03', 20), approvedAt: tcStamp('2026-04-04', 10), approvedBy: p6KellyMbr.id },
    { projectId: p6.id, crewMemberId: p6DarioMbr.id, date: tcDate('2026-04-03'), hours: 14.0, description: 'Magic hour rigging, sunset extension pass',   status: 'approved', submittedAt: tcStamp('2026-04-03', 20), approvedAt: tcStamp('2026-04-04', 10), approvedBy: p6KellyMbr.id },
    { projectId: p6.id, crewMemberId: p6PetraMbr.id, date: tcDate('2026-04-03'), hours: 13.0, description: 'Scene 12 prep, ravine practical effects',      status: 'approved', submittedAt: tcStamp('2026-04-03', 20), approvedAt: tcStamp('2026-04-04', 10), approvedBy: p6KellyMbr.id },
    { projectId: p6.id, crewMemberId: p6SofiaMbr.id, date: tcDate('2026-04-02'), hours: 13.5, description: 'Day 2 producing, schedule adjustments',        status: 'approved', submittedAt: tcStamp('2026-04-02', 20), approvedAt: tcStamp('2026-04-03', 10), approvedBy: p6KellyMbr.id },
    { projectId: p6.id, crewMemberId: p6RinaMbr.id,  date: tcDate('2026-04-01'), hours: 13.0, description: 'Day 1 coordination, call sheets, crafty',      status: 'approved', submittedAt: tcStamp('2026-04-01', 20), approvedAt: tcStamp('2026-04-02', 10), approvedBy: p6TylerHMbr.id },
    { projectId: p6.id, crewMemberId: p6KellyMbr.id, date: tcDate('2026-04-01'), hours: 13.5, description: 'Day 1 producing, own-time',                     status: 'approved', submittedAt: tcStamp('2026-04-01', 20), approvedAt: tcStamp('2026-04-02', 10), approvedBy: p6TylerHMbr.id },
    { projectId: p6.id, crewMemberId: p6ClydeMbr.id, date: tcDate('2026-04-04'), hours: 11.0, description: 'Day 4 pickups directing, wrap',                 status: 'approved', submittedAt: tcStamp('2026-04-04', 20), approvedAt: tcStamp('2026-04-05', 10), approvedBy: p6TylerHMbr.id },
  ]})

  console.log('  Timecards: 35 (9/5/6/5/0/10 across P1-P6; 26 approved, 6 submitted, 2 draft, 1 reopened)')

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
  console.log('  ─────────────────────────────')
  console.log('  Done.\n')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
