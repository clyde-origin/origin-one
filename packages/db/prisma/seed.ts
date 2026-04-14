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
  await prisma.teamMember.upsert({
    where:  { teamId_userId: { teamId, userId: user.id } },
    update: {},
    create: { teamId, userId: user.id, role },
  })
  return user
}

async function assignProjectCrew(
  projectId: string,
  userId: string,
  role: Role,
): Promise<void> {
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    update: {},
    create: { projectId, userId, role },
  })
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding — Origin Point projects...\n')

  // ── Wipe in reverse-dependency order ──────────────────────────────────────
  await prisma.moodboardRef.deleteMany()
  await prisma.moodboardTab.deleteMany()
  await prisma.location.deleteMany()
  await prisma.actionItem.deleteMany()
  await prisma.milestonePerson.deleteMany()
  await prisma.milestone.deleteMany()
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

  // ══════════════════════════════════════════════════════════════════════════
  // PROJECT 1 — SIMPLE SKIN PROMO
  // Client: Lumiере Skincare  Status: Pre-Production  Shoot in 7 days
  // 3 scenes  14 shots  24 crew
  // ══════════════════════════════════════════════════════════════════════════

  const sofiaReyes    = await upsertCrew(team.id, 'Sofia Reyes',    'director')
  const marcusWebb    = await upsertCrew(team.id, 'Marcus Webb',    'producer')
  const danaPark      = await upsertCrew(team.id, 'Dana Park',      'producer')
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
    { projectId: p1.id, type: 'character', name: 'Aria Stone',     description: 'Lead talent. Celebrity. On-camera throughout all three scenes.' },
    { projectId: p1.id, type: 'prop',      name: 'Lumiere Serum',  description: 'Hero product. Small amber bottle. On camera in scenes 1 and 2.' },
  ]})

  await prisma.document.create({ data: {
    projectId: p1.id, type: 'script', version: 1, createdBy: sofiaReyes.id,
    title: 'Simple Skin Promo — :60 Hero Spot',
    content: `SIMPLE SKIN PROMO
Lumiere Skincare. Director: Sofia Reyes. Draft 1, Apr 8.
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
  await assignProjectCrew(p1.id, sofiaReyes.id,    'director')
  await assignProjectCrew(p1.id, marcusWebb.id,    'producer')
  await assignProjectCrew(p1.id, danaPark.id,      'producer')
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
    { projectId: p1.id, title: 'Confirm estate permit + production insurance',  assignedTo: danaPark.id,      dueDate: new Date('2026-04-12'), status: 'in_progress' },
    { projectId: p1.id, title: "Issue talent rider to Aria's team",             assignedTo: veraHastings.id,  dueDate: new Date('2026-04-12'), status: 'open' },
    { projectId: p1.id, title: 'Compile department head contact sheet',         assignedTo: miaChen.id,       dueDate: new Date('2026-04-12'), status: 'in_progress' },
    { projectId: p1.id, title: "Create shot list from director's boards",       assignedTo: theoHartmann.id,  dueDate: new Date('2026-04-13'), status: 'in_progress' },
    { projectId: p1.id, title: 'Submit art department breakdown',               assignedTo: claireRenault.id, dueDate: new Date('2026-04-13'), status: 'open' },
    { projectId: p1.id, title: 'Tech scout attendance confirmed — all depts',   assignedTo: jamesCalloway.id, dueDate: new Date('2026-04-13'), status: 'done' },
    { projectId: p1.id, title: 'Confirm hair + MUA kit lists and prep day',     assignedTo: jasmineBell.id,   dueDate: new Date('2026-04-13'), status: 'open' },
    { projectId: p1.id, title: 'Book production trucks and basecamp',           assignedTo: danaPark.id,      dueDate: new Date('2026-04-13'), status: 'open' },
    { projectId: p1.id, title: 'Submit catering order — 50 person count',       assignedTo: miaChen.id,       dueDate: new Date('2026-04-14'), status: 'open' },
    { projectId: p1.id, title: 'Draft call sheet v1',                           assignedTo: jamesCalloway.id, dueDate: new Date('2026-04-15'), status: 'open' },
    { projectId: p1.id, title: 'Talent pickup and transport logistics',         assignedTo: danaPark.id,      dueDate: new Date('2026-04-15'), status: 'open' },
    { projectId: p1.id, title: 'Insurance certificate delivered to estate owner', assignedTo: marcusWebb.id,  dueDate: new Date('2026-04-12'), status: 'in_progress' },
  ]})

  // P1 — Locations (3)
  await prisma.location.createMany({ data: [
    {
      projectId: p1.id,
      name: 'Villa Serena — Bel Air Estate',
      description: 'Mediterranean-revival estate with infinity pool, marble terraces, and golden hour light through floor-to-ceiling windows. Hero location for the talent walk-through and product reveal.',
      address: '1240 Bel Air Rd, Los Angeles, CA 90077',
      keyContact: 'Patricia Hahn — Estate Rep — (310) 555-0188',
      shootDates: 'Apr 14–15',
      status: 'booked',
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
      status: 'booked',
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
  ]})

  // ══════════════════════════════════════════════════════════════════════════
  // PROJECT 2 — FULL SEND
  // Client: Vanta  Status: Production  Day 2 of 3  Run-and-gun
  // 3 scenes  15 shots  7 crew
  // ══════════════════════════════════════════════════════════════════════════

  const jakeMorales = await upsertCrew(team.id, 'Jake Morales', 'director')
  const caseyLin    = await upsertCrew(team.id, 'Casey Lin',   'producer')
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
    { projectId: p2.id, type: 'character', name: 'Marco Silva',            description: 'Athlete, surf. Day 1.' },
    { projectId: p2.id, type: 'character', name: 'Zoe Park',               description: 'Athlete, trail run. Day 2.' },
    { projectId: p2.id, type: 'character', name: 'Dev Okafor',             description: 'Athlete, skate. Day 3.' },
  ]})

  await prisma.document.create({ data: {
    projectId: p2.id, type: 'script', version: 1, createdBy: jakeMorales.id,
    title: 'Full Send — :60 Spot',
    content: `FULL SEND
Vanta Action Camera. Director/DP: Jake Morales. Shooting Apr 10-12.
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

  console.log('  P2: Full Send — 3 scenes, 15 shots, 7 crew')

  // P2 — ProjectMembers (7 crew)
  await assignProjectCrew(p2.id, jakeMorales.id, 'director')
  await assignProjectCrew(p2.id, caseyLin.id,    'producer')
  await assignProjectCrew(p2.id, daniReeves.id,  'crew')
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
    { projectId: p2.id, title: 'Confirm skatepark permit for Apr 12',            assignedTo: caseyLin.id,    dueDate: new Date('2026-04-11'), status: 'in_progress' },
    { projectId: p2.id, title: 'Athlete release forms — all three signed',       assignedTo: caseyLin.id,    dueDate: new Date('2026-04-11'), status: 'done' },
    { projectId: p2.id, title: 'Trail rig setup — helmet + chest mounts tested', assignedTo: daniReeves.id,  dueDate: new Date('2026-04-11'), status: 'done' },
    { projectId: p2.id, title: 'Backup Vanta units charged and tested',          assignedTo: jakeMorales.id, dueDate: new Date('2026-04-11'), status: 'done' },
    { projectId: p2.id, title: 'Day 1 selects log created for editor',           assignedTo: jakeMorales.id, dueDate: new Date('2026-04-12'), status: 'open' },
    { projectId: p2.id, title: 'Book edit suite for post',                       assignedTo: caseyLin.id,    dueDate: new Date('2026-04-12'), status: 'open' },
    { projectId: p2.id, title: 'Confirm music license direction with Vanta',     assignedTo: caseyLin.id,    dueDate: new Date('2026-04-14'), status: 'open' },
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
      status: 'booked',
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
      status: 'booked',
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
      sortOrder: 2,
    },
  ]})

  // ══════════════════════════════════════════════════════════════════════════
  // PROJECT 3 — IN VINO VERITAS
  // Client: Napa Collective  Status: Production  Day 2 of 3  Doc pilot
  // 3 sequences  14 shots  8 crew
  // ══════════════════════════════════════════════════════════════════════════

  const eliseMarchetti = await upsertCrew(team.id, 'Elise Marchetti', 'director')
  const owenBlakely    = await upsertCrew(team.id, 'Owen Blakely',   'crew')
  const tomVega        = await upsertCrew(team.id, 'Tom Vega',       'crew')
  const luciaFontaine  = await upsertCrew(team.id, 'Lucia Fontaine', 'producer')
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
    { projectId: p3.id, type: 'character', name: 'Paul Navarro',             description: 'Subject. Day 3 closing interview.' },
    { projectId: p3.id, type: 'character', name: 'Marcus Trent',             description: 'Subject. Day 2 barrel cellar interview.' },
    { projectId: p3.id, type: 'character', name: 'Jin Ho',                   description: 'Subject. Day 1 vineyard interview.' },
  ]})

  await prisma.document.create({ data: {
    projectId: p3.id, type: 'script', version: 1, createdBy: eliseMarchetti.id,
    title: 'In Vino Veritas — Treatment and Interview Guide',
    content: `IN VINO VERITAS
Napa Collective. Director: Elise Marchetti. Doc Pilot.

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

  console.log('  P3: In Vino Veritas — 3 sequences, 14 shots, 8 crew')

  // P3 — ProjectMembers (8 crew)
  await assignProjectCrew(p3.id, eliseMarchetti.id, 'director')
  await assignProjectCrew(p3.id, owenBlakely.id,    'crew')
  await assignProjectCrew(p3.id, tomVega.id,        'crew')
  await assignProjectCrew(p3.id, luciaFontaine.id,  'producer')
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
    { projectId: p3.id, title: 'Interview questions refined for cellar session',    assignedTo: eliseMarchetti.id, dueDate: new Date('2026-04-11'), status: 'done' },
    { projectId: p3.id, title: 'Barrel room winery access confirmed',              assignedTo: ryanCole.id,      dueDate: new Date('2026-04-11'), status: 'done' },
    { projectId: p3.id, title: 'Day 3 road route mapped + vista permits',          assignedTo: luciaFontaine.id, dueDate: new Date('2026-04-11'), status: 'done' },
    { projectId: p3.id, title: 'Transcription service booked for all interviews',  assignedTo: luciaFontaine.id, dueDate: new Date('2026-04-13'), status: 'open' },
    { projectId: p3.id, title: 'Cut structure outline — paper edit from Day 1',    assignedTo: eliseMarchetti.id, dueDate: new Date('2026-04-16'), status: 'open' },
    { projectId: p3.id, title: 'Temp music selects for assembly',                  assignedTo: eliseMarchetti.id, dueDate: new Date('2026-04-19'), status: 'open' },
    { projectId: p3.id, title: 'Archival wine footage licensing',                  assignedTo: luciaFontaine.id, dueDate: new Date('2026-04-18'), status: 'open' },
  ]})

  // P3 — Locations (3)
  await prisma.location.createMany({ data: [
    {
      projectId: p3.id,
      name: 'Oakville Estate Vineyard',
      description: 'Heritage vineyard with century-old vines. Main interview location for Day 1. Golden hour light through the rows.',
      address: '7801 St. Helena Hwy, Oakville, CA 94562',
      keyContact: 'Margaret Hess — Estate Manager — (707) 555-0142',
      shootDates: 'Apr 10 (completed)',
      status: 'booked',
      approved: true,
      notes: 'Gate code: 4418. Park in the gravel lot past the barn. No drones without 48h notice.',
      sceneTab: 'The Vine',
      sortOrder: 0,
    },
    {
      projectId: p3.id,
      name: 'St. Helena Barrel Cellar',
      description: 'Underground barrel aging room. Low ceilings, dramatic side light from small windows. Interview with the winemaker here.',
      address: '1220 Adams St, St. Helena, CA 94574',
      keyContact: 'Dan Moretti — Head Winemaker — (707) 555-0287',
      shootDates: 'Apr 11 (today)',
      status: 'booked',
      approved: true,
      notes: 'Temperature controlled — no hot lights. LED panels only. Access via loading dock on Adams St.',
      sceneTab: 'The Cellar',
      sortOrder: 1,
    },
    {
      projectId: p3.id,
      name: 'Silverado Trail Vista Point',
      description: 'Elevated overlook with panoramic valley views. Final driving sequence and closing shots.',
      address: 'Silverado Trail, near Deer Park Rd, Napa, CA',
      keyContact: 'Lucia Fontaine — permit on file',
      shootDates: 'Apr 12',
      status: 'in_talks',
      approved: false,
      notes: 'County film permit submitted. Awaiting confirmation. Backup: pull-off at mile marker 22.',
      sceneTab: 'The Road',
      sortOrder: 2,
    },
  ]})

  console.log('  P3: + 3 locations')

  // ══════════════════════════════════════════════════════════════════════════
  // PROJECT 4 — FLEXIBILITY COURSE A
  // Client: Kaia Mori  Status: Pre-Production  Episode 1 of 6
  // 3 sequences  11 shots  5 crew
  // ══════════════════════════════════════════════════════════════════════════

  const simonePark = await upsertCrew(team.id, 'Simone Park', 'director')
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
    { projectId: p4.id, type: 'character', name: 'Kaia Mori',               description: 'Instructor and on-camera talent. All sequences.' },
  ]})

  await prisma.document.create({ data: {
    projectId: p4.id, type: 'script', version: 1, createdBy: simonePark.id,
    title: 'Flexibility Course A — Episode 1 "Root"',
    content: `FLEXIBILITY COURSE A
Kaia Mori. Director: Simone Park. Episode 1 of 6. Approved Apr 7.
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

  console.log('  P4: Flexibility Course A — 3 sequences, 11 shots, 5 crew')

  // P4 — ProjectMembers (5 crew)
  await assignProjectCrew(p4.id, simonePark.id, 'director')
  await assignProjectCrew(p4.id, alexDrum.id,   'crew')
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
    { projectId: p4.id, title: 'Finalize Ep 1 practice sequence with Kaia',       assignedTo: simonePark.id, dueDate: new Date('2026-04-12'), status: 'done' },
    { projectId: p4.id, title: 'Wardrobe direction sent to Kaia',                 assignedTo: simonePark.id, dueDate: new Date('2026-04-12'), status: 'done' },
    { projectId: p4.id, title: 'Talent release form signed',                      assignedTo: hanaLiu.id,    dueDate: new Date('2026-04-12'), status: 'done' },
    { projectId: p4.id, title: 'Confirm studio lighting setup — two-cam positions', assignedTo: alexDrum.id,  dueDate: new Date('2026-04-13'), status: 'in_progress' },
    { projectId: p4.id, title: 'Outdoor location confirmed — Will Rogers',         assignedTo: tylerMoss.id,  dueDate: new Date('2026-04-13'), status: 'done' },
    { projectId: p4.id, title: 'Music licensing direction for series',             assignedTo: tylerMoss.id,  dueDate: new Date('2026-04-14'), status: 'open' },
    { projectId: p4.id, title: 'Episode 2 outline draft',                         assignedTo: simonePark.id, dueDate: new Date('2026-04-20'), status: 'open' },
    { projectId: p4.id, title: 'Series template locked after Ep 1 review',        assignedTo: simonePark.id, dueDate: new Date('2026-04-28'), status: 'open' },
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
      status: 'booked',
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
      status: 'booked',
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

  // ══════════════════════════════════════════════════════════════════════════
  // PROJECT 5 — NATURAL ORDER
  // Client: Meridian Climate  Status: Post-Production  Post-only sizzle
  // 3 sequences  14 elements  4 team
  // ══════════════════════════════════════════════════════════════════════════

  const rafiTorres = await upsertCrew(team.id, 'Rafi Torres', 'crew')
  const cleoStrand = await upsertCrew(team.id, 'Cleo Strand', 'crew')
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

  await prisma.entity.createMany({ data: [
    { projectId: p5.id, type: 'character', name: 'James North', description: 'VO talent. Recorded remotely Apr 10. All three sequences.' },
    { projectId: p5.id, type: 'character', name: 'Sarah Osei',  description: 'Brand Director, Meridian Climate. Client contact for all reviews.' },
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

  console.log('  P5: Natural Order — 3 sequences, 14 elements, 4 team')

  // P5 — ProjectMembers (4 crew)
  await assignProjectCrew(p5.id, rafiTorres.id, 'crew')
  await assignProjectCrew(p5.id, cleoStrand.id, 'crew')
  await assignProjectCrew(p5.id, jamesNorth.id, 'crew')
  await assignProjectCrew(p5.id, sarahOsei.id,  'crew')

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
    { projectId: p5.id, title: 'Stock clip licensing confirmation — all 42',    assignedTo: rafiTorres.id, dueDate: new Date('2026-04-12'), status: 'in_progress' },
    { projectId: p5.id, title: 'GFX style frame approval — Dr. Osei',          assignedTo: cleoStrand.id, dueDate: new Date('2026-04-12'), status: 'open' },
    { projectId: p5.id, title: 'Temp score confirmed for assembly',             assignedTo: rafiTorres.id, dueDate: new Date('2026-04-12'), status: 'done' },
    { projectId: p5.id, title: 'GFX Sequence 1 — global data map build',       assignedTo: cleoStrand.id, dueDate: new Date('2026-04-13'), status: 'in_progress' },
    { projectId: p5.id, title: 'Lower thirds and supers design',               assignedTo: cleoStrand.id, dueDate: new Date('2026-04-14'), status: 'open' },
    { projectId: p5.id, title: 'End card and Meridian logo lockup',            assignedTo: cleoStrand.id, dueDate: new Date('2026-04-14'), status: 'open' },
    { projectId: p5.id, title: 'Export specs confirmed with Meridian team',    assignedTo: rafiTorres.id, dueDate: new Date('2026-04-20'), status: 'open' },
  ]})

  // ── P5 Locations ────────────────────────────────────────────────────────
  await prisma.location.createMany({ data: [
    { projectId: p5.id, name: 'Westside Post — Suite 4', address: '1432 2nd St, Santa Monica, CA 90401', status: 'booked', approved: true, description: 'Dedicated edit suite with 5.1 monitoring and Resolve grading bay. Booked for two-week finishing window.', keyContact: 'Lena Marsh — Facility Manager', shootDates: 'Apr 14–25', sceneTab: 'Post', sortOrder: 1 },
  ]})

  // ══════════════════════════════════════════════════════════════════════════
  // PROJECT 6 — THE WEAVE
  // Client: B Story  Status: Production  Day 3 of 3  Night shoot tonight
  // 3 scenes  16 shots  15 crew  Sundance target
  // ══════════════════════════════════════════════════════════════════════════

  const nVale      = await upsertCrew(team.id, 'N Vale',      'director')
  const jessHuang  = await upsertCrew(team.id, 'Jess Huang',  'producer')
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

  await prisma.entity.createMany({ data: [
    { projectId: p6.id, type: 'location',  name: 'Desert Flats, Mojave',   description: 'Day 1 location. Eli sequences. Done.' },
    { projectId: p6.id, type: 'location',  name: 'Ravine, Malibu Creek',   description: 'Day 2 location. Mara sequences. Done.' },
    { projectId: p6.id, type: 'location',  name: 'Joshua Tree, Night Ext', description: 'Day 3 location. Collision scene. Tonight — call time 7PM.' },
    { projectId: p6.id, type: 'character', name: 'Eli',                    description: 'Lead — played by Leo Marsh. Drifting. The farthest point from everything.' },
    { projectId: p6.id, type: 'character', name: 'Mara',                   description: "Lead — played by Vera Koss. At the edge. Held by something we can't see." },
  ]})

  await prisma.document.create({ data: {
    projectId: p6.id, type: 'script', version: 3, createdBy: nVale.id,
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

  console.log('  P6: The Weave — 3 scenes, 16 shots, 15 crew\n')

  // P6 — ProjectMembers (15 crew)
  await assignProjectCrew(p6.id, nVale.id,      'director')
  await assignProjectCrew(p6.id, jessHuang.id,  'producer')
  await assignProjectCrew(p6.id, calebStone.id, 'crew')
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
    { projectId: p6.id, title: 'Night location permit confirmed — Joshua Tree NPS', assignedTo: jessHuang.id,  dueDate: new Date('2026-04-10'), status: 'done' },
    { projectId: p6.id, title: 'Assembly cut editor confirmed and booked',          assignedTo: jessHuang.id,  dueDate: new Date('2026-04-12'), status: 'in_progress' },
    { projectId: p6.id, title: 'Score composer brief',                              assignedTo: nVale.id,      dueDate: new Date('2026-04-20'), status: 'open' },
    { projectId: p6.id, title: 'Festival delivery specs — DCP + digital',          assignedTo: jessHuang.id,  dueDate: new Date('2026-05-25'), status: 'open' },
  ]})

  // ── P6 Locations ────────────────────────────────────────────────────────
  await prisma.location.createMany({ data: [
    { projectId: p6.id, name: 'Industrial Warehouse — Vernon', address: '2801 E Vernon Ave, Vernon, CA 90058', status: 'booked', approved: true, description: 'Raw concrete interior, 30-ft ceilings, loading dock. Dressed as the Fracture workshop. Days 1–2 primary.', keyContact: 'Tony Gutierrez — Owner', shootDates: 'Apr 11–12', sceneTab: 'INT', sortOrder: 1 },
    { projectId: p6.id, name: 'City Street — 6th & Spring', address: '600 S Spring St, Los Angeles, CA 90014', status: 'booked', approved: true, description: 'DTLA night exterior. Wet-down permitted. Film LA permit locked for overnight Apr 13 22:00–05:00.', keyContact: 'Film LA — Permit #FL-26-4481', shootDates: 'Apr 13 (overnight)', sceneTab: 'EXT Night', sortOrder: 2 },
    { projectId: p6.id, name: 'Brutalist Apartment — Crenshaw', address: '3450 W 43rd Pl, Los Angeles, CA 90008', status: 'in_talks', approved: false, description: 'Mid-century brutalist exterior and stairwell. Backup for protagonist apartment block. Owner interested, rate TBD.', keyContact: 'Diana Kwon — Building Manager', shootDates: 'TBD', sceneTab: 'EXT', sortOrder: 3 },
    { projectId: p6.id, name: 'Underground Parking — Bunker Hill', address: '333 S Hope St, Los Angeles, CA 90071', status: 'scouting', approved: false, description: 'Subterranean parking structure, fluorescent lighting, deep shadows. Potential chase sequence location.', keyContact: 'Property mgmt contacted — awaiting response', shootDates: 'TBD', sceneTab: 'INT', sortOrder: 4 },
  ]})

  // ── Final count ───────────────────────────────────────────────────────────
  const counts = {
    projects:       await prisma.project.count(),
    scenes:         await prisma.scene.count(),
    shots:          await prisma.shot.count(),
    entities:       await prisma.entity.count(),
    documents:      await prisma.document.count(),
    users:          await prisma.user.count(),
    teamMembers:    await prisma.teamMember.count(),
    projectMembers: await prisma.projectMember.count(),
    milestones:     await prisma.milestone.count(),
    actionItems:    await prisma.actionItem.count(),
    locations:      await prisma.location.count(),
  }

  console.log('  ─────────────────────────────')
  console.log(`  Projects:        ${counts.projects}`)
  console.log(`  Scenes:          ${counts.scenes}`)
  console.log(`  Shots:           ${counts.shots}`)
  console.log(`  Entities:        ${counts.entities}`)
  console.log(`  Documents:       ${counts.documents}`)
  console.log(`  Users:           ${counts.users}`)
  console.log(`  TeamMembers:     ${counts.teamMembers}`)
  console.log(`  ProjectMembers:  ${counts.projectMembers}`)
  console.log(`  Milestones:      ${counts.milestones}`)
  console.log(`  ActionItems:     ${counts.actionItems}`)
  console.log(`  Locations:       ${counts.locations}`)
  console.log('  ─────────────────────────────')
  console.log('  Done.\n')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
