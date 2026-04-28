// Shot metadata keyed by projectKey + sceneNumber. Same shape as the rows
// passed to prisma.shot.createMany. Imported by prisma/seed.ts and by
// seed-images/shot-entries.ts (which uses size + description to build prompts).

import type { ShotSize, ShotStatus } from '@prisma/client'
import type { SeedProjectKey } from '../seed-images/paths'

export type { ShotSize, ShotStatus }

export type ShotSeedRow = {
  shotNumber: string
  size?: ShotSize
  status: ShotStatus
  sortOrder: number
  description: string
}

// Outer key: projectKey. Inner key: sceneNumber.
export const SHOTS: Record<SeedProjectKey, Record<string, ShotSeedRow[]>> = {
  p1: {
    '01': [
      { shotNumber: '01A', size: 'extreme_close_up', status: 'planned', sortOrder: 1, description: 'Fingers drawing a single drop from the bottle. The product in motion for the first time.' },
      { shotNumber: '01B', size: 'medium',           status: 'planned', sortOrder: 2, description: 'Aria at the mirror, unhurried. The quality of her attention. This is her morning.' },
      { shotNumber: '01C', size: 'close_up',         status: 'planned', sortOrder: 3, description: 'Light catching the cheekbone. The skin as landscape.' },
      { shotNumber: '01D', size: 'extreme_close_up', status: 'planned', sortOrder: 4, description: 'Eyes closing, then opening. Not a transformation. Recognition.' },
      { shotNumber: '01E', size: 'wide',             status: 'planned', sortOrder: 5, description: 'Full bathroom frame. The quality of the morning light. The room as a complete world.' },
    ],
    '02': [
      { shotNumber: '02A', size: 'wide',             status: 'planned', sortOrder: 1, description: 'Garden path. Aria walking slowly toward camera through dappled light. Unhurried.' },
      { shotNumber: '02B', size: 'medium',           status: 'planned', sortOrder: 2, description: 'She pauses at a stone wall. Looks up. Not posed. Just present in the afternoon.' },
      { shotNumber: '02C', size: 'extreme_close_up', status: 'planned', sortOrder: 3, description: 'Bottle placed on stone surface. Garden softly out of focus behind. Clean beauty shot.' },
      { shotNumber: '02D', size: 'medium',           status: 'planned', sortOrder: 4, description: 'Aria moves through the garden. Dappled light across hair and skin. Camera follows slow.' },
      { shotNumber: '02E', size: 'full',             status: 'planned', sortOrder: 5, description: 'Aria faces lens. Soft. The closest we get to her. No performance. Just presence.' },
    ],
    '03': [
      { shotNumber: '03A', size: 'medium_close_up', status: 'planned', sortOrder: 1, description: 'Aria sees herself in the full-length mirror. The moment of looking.' },
      { shotNumber: '03B', size: 'medium',          status: 'planned', sortOrder: 2, description: 'What she sees: herself, whole. The reflection is the point.' },
      { shotNumber: '03C', size: 'medium_close_up', status: 'planned', sortOrder: 3, description: 'Pushing slowly into her reflected face. The film ending in recognition.' },
      { shotNumber: '03D', size: 'insert',          status: 'planned', sortOrder: 4, description: 'Title card. Product name, tagline. Fade to black. Clean.' },
    ],
  },
  p2: {
    '01': [
      { shotNumber: '01A',                           status: 'completed', sortOrder: 1, description: 'Vanta unit on board nose. Ocean POV paddling out. Water rushing past lens.' },
      { shotNumber: '01B', size: 'wide',             status: 'completed', sortOrder: 2, description: 'Drone. Marco drops into a set wave from above. The full scale of the commitment.' },
      { shotNumber: '01C', size: 'wide',             status: 'completed', sortOrder: 3, description: 'Camera at break level. Board cutting directly past lens. Speed and spray.' },
      { shotNumber: '01D', size: 'extreme_close_up', status: 'completed', sortOrder: 4, description: "Marco's face mid-ride. Eyes locked ahead. Total presence." },
      { shotNumber: '01E', size: 'wide',             status: 'completed', sortOrder: 5, description: 'Post-wave. Board flat. Water settling around Marco. The exhale after the send.' },
    ],
    '02': [
      { shotNumber: '02A',                           status: 'in_progress', sortOrder: 1, description: 'Zoe running the ridge. City glow below, dawn sky above. The world as backdrop.' },
      { shotNumber: '02B', size: 'wide',             status: 'in_progress', sortOrder: 2, description: 'Camera low on trail surface. Feet pounding past directly over lens.' },
      { shotNumber: '02C', size: 'wide',             status: 'in_progress', sortOrder: 3, description: 'Drone tracking Zoe along the ridge. Drop visible on one side. Pure commitment.' },
      { shotNumber: '02D',                           status: 'in_progress', sortOrder: 4, description: 'Vanta helmet-mounted. POV of the path ahead. Breathing audible. Just the run.' },
      { shotNumber: '02E', size: 'wide',             status: 'in_progress', sortOrder: 5, description: 'Zoe crests the hill. Stops. Looks out over the city. Breathing hard. First light arrives.' },
    ],
    '03': [
      { shotNumber: '03A', size: 'wide',             status: 'planned', sortOrder: 1, description: 'Camera flat on concrete. Dev rolling toward lens. The texture of the approach.' },
      { shotNumber: '03B',                           status: 'planned', sortOrder: 2, description: 'Vanta mounted to helmet. POV of the approach to the drop. The decision point.' },
      { shotNumber: '03C', size: 'wide',             status: 'planned', sortOrder: 3, description: 'Full ramp in frame. Dev launches. The full send, held in a single wide shot.' },
      { shotNumber: '03D', size: 'extreme_close_up', status: 'planned', sortOrder: 4, description: "Dev's face mid-air. The full send moment. High-speed camera if available." },
      { shotNumber: '03E', size: 'insert',           status: 'planned', sortOrder: 5, description: 'Vanta unit held up to lens. Post-send grin. Tag card over black.' },
    ],
  },
  p3: {
    '01': [
      { shotNumber: '01A', size: 'wide',             status: 'completed', sortOrder: 1, description: 'Three men walking into the vine rows at golden hour. The valley spreads behind them.' },
      { shotNumber: '01B', size: 'extreme_close_up', status: 'completed', sortOrder: 2, description: 'Hands touching leaves, then reaching into the soil. Contact with the earth. Tactile and specific.' },
      { shotNumber: '01C', size: 'medium',           status: 'completed', sortOrder: 3, description: 'Paul crouches, lifts a handful of earth, smells it. Not performed — genuine.' },
      { shotNumber: '01D', size: 'medium_close_up',  status: 'completed', sortOrder: 4, description: 'Jin Ho, medium frame, vineyard behind. Interview on wine and time.' },
      { shotNumber: '01E', size: 'wide',             status: 'completed', sortOrder: 5, description: 'The valley from the ridge. Scale. Three tiny figures in the rows below.' },
    ],
    '02': [
      { shotNumber: '02A', size: 'wide',             status: 'in_progress', sortOrder: 1, description: 'Three men entering the cellar. Eyes adjusting to the dark. The weight of the space.' },
      { shotNumber: '02B', size: 'extreme_close_up', status: 'in_progress', sortOrder: 2, description: 'Barrel markings, chalk dates. Years of patience annotated in handwriting.' },
      { shotNumber: '02C', size: 'medium_close_up',  status: 'in_progress', sortOrder: 3, description: 'Marcus Trent, low light, barrels soft behind. Interview on time and making things.' },
      { shotNumber: '02D', size: 'medium',           status: 'in_progress', sortOrder: 4, description: 'Wine drawn directly from barrel with a thief. The tasting. Silence and expressions.' },
      { shotNumber: '02E', size: 'medium',           status: 'in_progress', sortOrder: 5, description: "All three, glasses up in the low light. No words. The moment when wine does what words can't." },
    ],
    '03': [
      { shotNumber: '03A', size: 'wide',             status: 'planned', sortOrder: 1, description: 'Car moving through valley road. Vines on both sides. The beauty of the place as transition.' },
      { shotNumber: '03B', size: 'medium',           status: 'planned', sortOrder: 2, description: 'Dashboard POV. Marcus driving, Paul in passenger. Conversation happening naturally.' },
      { shotNumber: '03C', size: 'wide',             status: 'planned', sortOrder: 3, description: 'Car pulled over at an unmarked vista. All three out, looking at the valley. Real.' },
      { shotNumber: '03D', size: 'medium_close_up',  status: 'planned', sortOrder: 4, description: 'Paul, roadside, valley behind. The concluding thought on what the trip was actually about.' },
    ],
  },
  p4: {
    '01': [
      { shotNumber: '01A', size: 'medium',           status: 'planned', sortOrder: 1, description: 'Kaia seated, direct address. Introduces herself, the series, what this episode is about.' },
      { shotNumber: '01B', size: 'wide',             status: 'planned', sortOrder: 2, description: 'Full body. Standing in the clean studio space. The scale and simplicity of the environment.' },
      { shotNumber: '01C', size: 'extreme_close_up', status: 'planned', sortOrder: 3, description: 'Hands in anjali mudra. The gesture of beginning. The practice starting before the body moves.' },
    ],
    '02': [
      { shotNumber: '02A', size: 'wide',             status: 'planned', sortOrder: 1, description: 'Full body profile. Continuous from standing through tree pose. Primary angle. Cam A.' },
      { shotNumber: '02B', size: 'wide',             status: 'planned', sortOrder: 2, description: 'Frontal angle. Same full sequence. Coverage for edit flexibility. Cam B.' },
      { shotNumber: '02C', size: 'extreme_close_up', status: 'planned', sortOrder: 3, description: 'Foot placement, hand position, eye line. Instructional close-up details for each key beat.' },
      { shotNumber: '02D', size: 'medium',           status: 'planned', sortOrder: 4, description: 'Kaia demonstrates common misalignment, then immediately corrects. The teaching moment.' },
      { shotNumber: '02E',                           status: 'planned', sortOrder: 5, description: 'Overhead top-down. Body in tree pose from directly above. Symmetry and root visible.' },
    ],
    '03': [
      { shotNumber: '03A', size: 'wide',             status: 'planned', sortOrder: 1, description: 'Kaia standing in the open field. Mountains visible behind. The studio practice placed in the world.' },
      { shotNumber: '03B', size: 'extreme_close_up', status: 'planned', sortOrder: 2, description: 'Bare feet in grass. The literal ground. Root pose on real earth.' },
      { shotNumber: '03C', size: 'medium',           status: 'planned', sortOrder: 3, description: 'Full tree pose in the open field. Wind present. Light natural. The pose as belonging.' },
      { shotNumber: '03D', size: 'close_up',         status: 'planned', sortOrder: 4, description: "Kaia's face. Eyes closed. The arrival at the end of practice. The return." },
    ],
  },
  p5: {
    '01': [
      { shotNumber: 'S1A', status: 'completed', sortOrder: 1, description: 'STOCK — Aerial ocean surface at dawn. Deep blue, barely moving. The scale of the system.' },
      { shotNumber: 'S1B', status: 'completed', sortOrder: 2, description: 'GFX — Global temperature anomaly map animating in across the surface of the earth.' },
      { shotNumber: 'S1C', status: 'completed', sortOrder: 3, description: 'STOCK — Storm system satellite footage. The data made visible.' },
      { shotNumber: 'S1D', status: 'completed', sortOrder: 4, description: 'VO — "There are 4.2 billion data points recorded every day. Most of them are telling us the same thing."' },
      { shotNumber: 'S1E', status: 'completed', sortOrder: 5, description: 'GFX — Data streams, chaotic particle system, beginning to converge toward a central point.' },
    ],
    '02': [
      { shotNumber: 'S2A', status: 'in_progress', sortOrder: 1, description: 'GFX — Platform interface animation, sensor network visualization. Product introduced visually.' },
      { shotNumber: 'S2B', status: 'in_progress', sortOrder: 2, description: 'STOCK — Scientists at field monitoring stations. The human layer behind the data.' },
      { shotNumber: 'S2C', status: 'in_progress', sortOrder: 3, description: 'GFX — Data points resolving into a coherent unified map. The one signal moment.' },
      { shotNumber: 'S2D', status: 'in_progress', sortOrder: 4, description: "VO — \"Meridian doesn't add more data. It makes the data that exists finally speak the same language.\"" },
      { shotNumber: 'S2E', status: 'in_progress', sortOrder: 5, description: 'STOCK — Clean aerial landscape, land and water, ordered and whole. The world post-signal.' },
    ],
    '03': [
      { shotNumber: 'S3A',                   status: 'planned', sortOrder: 1, description: 'GFX — Full global view. All sensors active, all data resolved. One unified picture of the world.' },
      { shotNumber: 'S3B',                   status: 'planned', sortOrder: 2, description: 'VO — "This is what natural order looks like. Every ocean. Every atmosphere. One signal. Everywhere."' },
      { shotNumber: 'S3C',                   status: 'planned', sortOrder: 3, description: 'GFX — Meridian logo resolves out of the data visualization. Brand as the resolution of the story.' },
      { shotNumber: 'S3D', size: 'insert',   status: 'planned', sortOrder: 4, description: 'Title card — Natural Order. Meridian Climate. URL. Fade to black.' },
    ],
  },
  p6: {
    '01': [
      { shotNumber: '01A', size: 'wide',             status: 'completed', sortOrder: 1, description: 'Eli walking across open desert. Horizon in every direction. No destination visible.' },
      { shotNumber: '01B', size: 'medium',           status: 'completed', sortOrder: 2, description: 'He stops. Looks up. The sky fills the entire upper frame. He is small in it.' },
      { shotNumber: '01C', size: 'extreme_close_up', status: 'completed', sortOrder: 3, description: 'His face. Not lost — too present for lost. Just far. The distinction matters.' },
      { shotNumber: '01D', size: 'wide',             status: 'completed', sortOrder: 4, description: 'Feet on cracked earth. The texture of distance. The ground not holding him — just bearing him.' },
      { shotNumber: '01E', size: 'wide',             status: 'completed', sortOrder: 5, description: 'Aerial. Tiny figure in the vast desert. The apogee — the farthest point from everything.' },
    ],
    '02': [
      { shotNumber: '02A', size: 'wide',             status: 'completed', sortOrder: 1, description: "Mara at the ravine edge. Malibu Creek below. The drop visible — she's not afraid of it." },
      { shotNumber: '02B', size: 'close_up',         status: 'completed', sortOrder: 2, description: "Profile. Wind. She's thinking. Not going anywhere. Held at the edge by something we can't see." },
      { shotNumber: '02C', size: 'extreme_close_up', status: 'completed', sortOrder: 3, description: "Hands on rock. Grounded. Her hands where Eli's feet were — both touching the earth." },
      { shotNumber: '02D', size: 'insert',           status: 'completed', sortOrder: 4, description: 'Her journal, open. Half a sentence — stopped mid-thought. The place where words ran out.' },
      { shotNumber: '02E',                           status: 'completed', sortOrder: 5, description: 'POV — what she sees from the edge: the ravine, the other side, the distance. The gap.' },
    ],
    '03': [
      { shotNumber: '03A', size: 'wide',             status: 'in_progress', sortOrder: 1, description: "Stars above. Two figures approaching from opposite directions. They don't know about each other yet." },
      { shotNumber: '03B', size: 'medium',           status: 'in_progress', sortOrder: 2, description: 'The moment they see each other. The stop. No words. The frame holds.' },
      { shotNumber: '03C', size: 'medium',           status: 'in_progress', sortOrder: 3, description: 'Two-shot. Face to face. The frame holds both of them. The first time the film puts them together.' },
      { shotNumber: '03D', size: 'extreme_close_up', status: 'in_progress', sortOrder: 4, description: "His face: recognition. Not of her specifically — of the fact that someone else is here." },
      { shotNumber: '03E', size: 'extreme_close_up', status: 'in_progress', sortOrder: 5, description: 'Her face: the same. The mirror that started in Scene 1 finally has something to reflect.' },
      { shotNumber: '03F', size: 'wide',             status: 'in_progress', sortOrder: 6, description: 'Camera pulls back slowly. Two figures, one frame, stars expanding above them. The film ends here.' },
    ],
  },
}
