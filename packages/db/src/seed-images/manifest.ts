import type { ImageEntry } from './paths'

// Single source of truth for every seed image. Populated mechanically from
// packages/db/prisma/seed.ts — every Location, MoodboardRef, narrative Entity
// (prop/wardrobe/hmu/character→cast Talent), and seeded crew User gets one entry.
//
// Operator workflow:
//   1. Run `pnpm --filter @origin-one/db db:fetch-images` to populate
//      packages/db/seed-images/files/ from this manifest.
//   2. `git add packages/db/seed-images/files/ && git commit`
//   3. `pnpm --filter @origin-one/db prisma db seed` reads the files and
//      uploads them through Supabase Storage.
//
// Bad output? Edit the entry, run with `--force --only=<filter>`, recommit.

export const MANIFEST: ImageEntry[] = [

  // ── p1 Simple Skin Promo ─────────────────────────────────────────────────

  // locations
  {
    projectKey: 'p1', surface: 'location', slug: 'villa-serena-bel-air-estate',
    source: 'stock',
    query: 'luxury mediterranean revival estate marble terrace infinity pool california morning light',
    caption: 'Hero angle from scout',
    matchByName: 'Villa Serena — Bel Air Estate',
  },
  {
    projectKey: 'p1', surface: 'location', slug: 'milk-studios-stage-3',
    source: 'stock',
    query: 'white cyclorama studio professional photography lighting setup clean',
    caption: 'Studio reference, product setup',
    matchByName: 'Milk Studios — Stage 3',
  },
  {
    projectKey: 'p1', surface: 'location', slug: 'greystone-mansion-gardens',
    source: 'stock',
    query: 'formal english garden stone pergola hedgerow beverly hills soft afternoon light',
    caption: 'Garden reference, scout',
    matchByName: 'Greystone Mansion Gardens',
  },
  {
    projectKey: 'p1', surface: 'location', slug: 'holmby-hills-villa-option',
    source: 'stock',
    query: 'mediterranean style villa los angeles exterior courtyard daylight',
    caption: 'Alternative option scouted',
    matchByName: 'Holmby Hills Villa (Option)',
  },
  {
    projectKey: 'p1', surface: 'location', slug: 'pasadena-craftsman-estate-passed',
    source: 'stock',
    query: 'craftsman bungalow estate pasadena california warm wood exterior',
    caption: 'Passed — architecture mismatch',
    matchByName: 'Pasadena Craftsman Estate (Passed)',
  },

  // narrativeLocation
  {
    projectKey: 'p1', surface: 'narrativeLocation', slug: 'bel-air-estate-narrative',
    source: 'stock',
    query: 'luxury private estate california morning aerial bel air',
    caption: 'Script reference — initial board image',
    matchByName: 'Bel Air Estate',
  },

  // moodboard
  {
    projectKey: 'p1', surface: 'moodboard', slug: 'morning-ritual',
    source: 'stock',
    query: 'unhurried morning skincare ritual editorial luxury quiet',
    caption: null,
    matchByName: 'Morning Ritual',
  },
  {
    projectKey: 'p1', surface: 'moodboard', slug: 'bathroom-light-study',
    source: 'stock',
    query: 'soft window light frosted glass white marble bathroom warm morning glow',
    caption: null,
    matchByName: 'Bathroom Light Study',
  },
  {
    projectKey: 'p1', surface: 'moodboard', slug: 'skin-as-landscape',
    source: 'stock',
    query: 'skin texture close-up beauty editorial topographic cheekbone light',
    caption: null,
    matchByName: 'Skin as Landscape',
  },
  {
    projectKey: 'p1', surface: 'moodboard', slug: 'hero-product-beauty',
    source: 'stock',
    query: 'amber glass bottle marble surface backlit glycerin water drops beauty product',
    caption: null,
    matchByName: 'Hero Product Beauty',
  },
  {
    projectKey: 'p1', surface: 'moodboard', slug: 'ambient-reference',
    source: 'stock',
    query: 'piano keys soft light minimal ambient music studio',
    caption: null,
    matchByName: 'Ambient Reference',
  },

  // props
  {
    projectKey: 'p1', surface: 'prop', slug: 'lumiere-serum',
    source: 'ai',
    prompt: 'Hero product still life: small amber glass serum bottle with brushed brass dropper on a calacatta marble surface, glycerin water droplets on the bottle, soft raking shadow, macro detail.',
    caption: null,
    matchByName: 'Lumiere Serum',
  },
  {
    projectKey: 'p1', surface: 'prop', slug: 'skincare-product-hero-set',
    source: 'ai',
    prompt: 'Product still life flat-lay: three luxury skincare bottles — serum, moisturizer, and cleanser — arranged in a row on white marble, editorial spacing, soft top light.',
    caption: null,
    matchByName: 'Skincare Product Hero Set',
  },
  {
    projectKey: 'p1', surface: 'prop', slug: 'vanity-mirror',
    source: 'ai',
    prompt: 'Prop close-up: circular brass vanity mirror leaning on a marble shelf, light catching the polished rim, reflection of a bright bathroom window, no person visible.',
    caption: null,
    matchByName: 'Vanity Mirror',
  },
  {
    projectKey: 'p1', surface: 'prop', slug: 'marble-surface-tiles',
    source: 'ai',
    prompt: 'Material reference flat-lay: calacatta marble tiles on a clean surface, dramatic veining, soft side light, no props on top — pure texture reference.',
    caption: null,
    matchByName: 'Marble Surface Tiles',
  },

  // wardrobe
  {
    projectKey: 'p1', surface: 'wardrobe', slug: 'hero-clean-white-cream',
    source: 'ai',
    prompt: 'Wardrobe lookbook still: cream silk robe and ivory camisole on a wooden hanger, neutral linen background, soft window light, no model.',
    caption: null,
    matchByName: 'Hero — Clean White/Cream',
  },
  {
    projectKey: 'p1', surface: 'wardrobe', slug: 'secondary-soft-neutrals',
    source: 'ai',
    prompt: 'Wardrobe flat-lay: linen blouse and taupe wide-leg trousers neatly arranged on a light stone surface, natural daylight.',
    caption: null,
    matchByName: 'Secondary — Soft Neutrals',
  },

  // hmu
  {
    projectKey: 'p1', surface: 'hmu', slug: 'hero-flawless-dewy',
    source: 'ai',
    prompt: 'Beauty close-up of dewy luminous skin texture, highlight on cheekbone and brow bone, no model identifiable, no makeup product visible, editorial framing.',
    caption: null,
    matchByName: 'Hero — Flawless Dewy',
  },
  {
    projectKey: 'p1', surface: 'hmu', slug: 'secondary-fresh-natural',
    source: 'ai',
    prompt: 'Beauty reference: minimal skin, soft natural lip, groomed brows, matte finish, no identifiable subject, neutral background.',
    caption: null,
    matchByName: 'Secondary — Fresh Natural',
  },

  // cast
  {
    projectKey: 'p1', surface: 'cast', slug: 'camille-rousseau',
    source: 'ai',
    prompt: 'Editorial portrait of a 30-year-old woman with shoulder-length brown hair, calm expression, slight smile, magazine beauty editorial framing, soft studio window light.',
    caption: null,
    matchByName: 'Camille Rousseau',
  },
  {
    projectKey: 'p1', surface: 'cast', slug: 'danielle-park',
    source: 'ai',
    prompt: 'Editorial portrait of a woman in her late 20s, soft neutral background, relaxed supporting presence, natural daylight, approachable expression.',
    caption: null,
    matchByName: 'Danielle Park',
  },

  // ── p2 Full Send ─────────────────────────────────────────────────────────

  // locations
  {
    projectKey: 'p2', surface: 'location', slug: 'venice-beach-skatepark',
    source: 'stock',
    query: 'venice beach skatepark concrete bowl street course dawn light',
    caption: 'Day 1 completed — scout reference',
    matchByName: 'Venice Beach Skatepark',
  },
  {
    projectKey: 'p2', surface: 'location', slug: 'turnbull-canyon-trail',
    source: 'stock',
    query: 'rugged single track mountain bike trail coastal sage scrub canyon california',
    caption: 'Day 2 trail reference',
    matchByName: 'Turnbull Canyon Trail',
  },
  {
    projectKey: 'p2', surface: 'location', slug: 'dtla-rooftop-court',
    source: 'stock',
    query: 'rooftop basketball court downtown los angeles skyline golden hour',
    caption: 'Day 3 scout — scouting',
    matchByName: 'DTLA Rooftop Court',
  },

  // narrativeLocations
  {
    projectKey: 'p2', surface: 'narrativeLocation', slug: 'malibu-point-narrative',
    source: 'stock',
    query: 'malibu point surf break dawn ocean first light wave',
    caption: 'Script reference — surf location',
    matchByName: 'Malibu Point',
  },
  {
    projectKey: 'p2', surface: 'narrativeLocation', slug: 'griffith-park-ridge-narrative',
    source: 'stock',
    query: 'griffith park ridge trail run pre-dawn city lights below',
    caption: 'Script reference — ridge run',
    matchByName: 'Griffith Park Ridge',
  },
  {
    projectKey: 'p2', surface: 'narrativeLocation', slug: 'dtla-memorial-skatepark-narrative',
    source: 'stock',
    query: 'urban skatepark concrete ramp afternoon sun skateboarding',
    caption: 'Script reference — skate location',
    matchByName: 'DTLA Memorial Skatepark',
  },

  // moodboard
  {
    projectKey: 'p2', surface: 'moodboard', slug: 'first-light-first-drop',
    source: 'stock',
    query: 'pre-dawn ocean horizon first light surfing commitment wave',
    caption: null,
    matchByName: 'First Light, First Drop',
  },
  {
    projectKey: 'p2', surface: 'moodboard', slug: 'speed-streaks',
    source: 'stock',
    query: 'motion blur close-up action sports water asphalt speed trail dust',
    caption: null,
    matchByName: 'Speed Streaks',
  },
  {
    projectKey: 'p2', surface: 'moodboard', slug: 'vanta-hero-unit',
    source: 'stock',
    query: 'matte black action camera lens element close-up minimal product',
    caption: null,
    matchByName: 'Vanta Hero Unit',
  },
  {
    projectKey: 'p2', surface: 'moodboard', slug: 'pov-immersion',
    source: 'stock',
    query: 'pov helmet camera athlete chest mount surfing skateboarding trail run',
    caption: null,
    matchByName: 'POV Immersion',
  },
  {
    projectKey: 'p2', surface: 'moodboard', slug: 'score-reference',
    source: 'stock',
    query: 'electronic music production minimal dark ambient restrained energy',
    caption: null,
    matchByName: 'Score Reference',
  },

  // props
  {
    projectKey: 'p2', surface: 'prop', slug: 'vanta-camera-hero-unit',
    source: 'ai',
    prompt: 'Product close-up: matte black compact action camera with prominent lens, mounted helmet bracket attached, clean white table surface, direct front angle, no scratches.',
    caption: null,
    matchByName: 'Vanta Camera Hero Unit',
  },
  {
    projectKey: 'p2', surface: 'prop', slug: 'skate-deck-branded',
    source: 'ai',
    prompt: 'Prop flat-lay: skateboard deck in matte black with a minimal logo print, trucks removed, laid on concrete surface, overhead angle.',
    caption: null,
    matchByName: 'Skate Deck (Branded)',
  },
  {
    projectKey: 'p2', surface: 'prop', slug: 'chalk-bag',
    source: 'ai',
    prompt: 'Prop close-up: worn canvas climbing chalk bag with white chalk dust on and around it, carabiner clip visible, rock texture background.',
    caption: null,
    matchByName: 'Chalk Bag',
  },

  // wardrobe
  {
    projectKey: 'p2', surface: 'wardrobe', slug: 'skater-urban-street',
    source: 'ai',
    prompt: 'Wardrobe flat-lay: oversized white t-shirt, olive cargo pants, and low-profile skate shoes arranged on concrete, no visible brand logos.',
    caption: null,
    matchByName: 'Skater — Urban Street',
  },
  {
    projectKey: 'p2', surface: 'wardrobe', slug: 'climber-technical-outdoor',
    source: 'ai',
    prompt: 'Wardrobe flat-lay: athletic tank top, slim climbing pants, and approach shoes on a rock surface, functional and unbranded, natural light.',
    caption: null,
    matchByName: 'Climber — Technical Outdoor',
  },
  {
    projectKey: 'p2', surface: 'wardrobe', slug: 'surfer-coastal-casual',
    source: 'ai',
    prompt: 'Wardrobe flat-lay: faded boardshorts and a rash guard on a sandy surface, salt-weathered look, sun-bleached colours, overhead angle.',
    caption: null,
    matchByName: 'Surfer — Coastal Casual',
  },

  // hmu
  {
    projectKey: 'p2', surface: 'hmu', slug: 'all-athletes-performance',
    source: 'ai',
    prompt: 'Beauty reference: natural athletic skin close-up, light sweat visible, sun-kissed skin with sunscreen sheen, no product or model identifiable.',
    caption: null,
    matchByName: 'All Athletes — Performance',
  },

  // cast
  {
    projectKey: 'p2', surface: 'cast', slug: 'dex-morales',
    source: 'ai',
    prompt: 'Environmental portrait of a male skateboarder in his mid-20s, urban setting, confident stance, concrete background, natural midday light.',
    caption: null,
    matchByName: 'Dex Morales',
  },
  {
    projectKey: 'p2', surface: 'cast', slug: 'amara-singh',
    source: 'ai',
    prompt: 'Environmental portrait of a woman in her mid-20s, outdoor setting, athletic build, relaxed posture, mountain or rock face background, natural daylight.',
    caption: null,
    matchByName: 'Amara Singh',
  },
  {
    projectKey: 'p2', surface: 'cast', slug: 'kai-nakamura',
    source: 'ai',
    prompt: 'Environmental portrait of a male surfer in his mid-20s, coastal setting, post-session relaxed expression, board visible at edge of frame, dawn light.',
    caption: null,
    matchByName: 'Kai Nakamura',
  },

  // ── p3 In Vino Veritas ───────────────────────────────────────────────────

  // locations
  {
    projectKey: 'p3', surface: 'location', slug: 'oakville-estate-vineyard',
    source: 'stock',
    query: 'heritage vineyard century old vines napa valley golden hour rows california',
    caption: 'Day 1 completed — hero location',
    matchByName: 'Oakville Estate Vineyard',
  },
  {
    projectKey: 'p3', surface: 'location', slug: 'st-helena-barrel-cellar',
    source: 'stock',
    query: 'underground wine barrel cellar french oak low ceiling single window dramatic side light',
    caption: 'Day 2 — available light only',
    matchByName: 'St. Helena Barrel Cellar',
  },
  {
    projectKey: 'p3', surface: 'location', slug: 'silverado-trail-vista-point',
    source: 'stock',
    query: 'napa valley overlook panoramic vines road vista point afternoon light',
    caption: 'Day 3 scout reference',
    matchByName: 'Silverado Trail Vista Point',
  },

  // narrativeLocations
  {
    projectKey: 'p3', surface: 'narrativeLocation', slug: 'oakville-vineyard-estate-narrative',
    source: 'stock',
    query: 'oakville napa vineyard estate aerial golden hour valley rows',
    caption: 'Script reference — vine rows',
    matchByName: 'Oakville Vineyard Estate',
  },
  {
    projectKey: 'p3', surface: 'narrativeLocation', slug: 'st-helena-barrel-cellar-narrative',
    source: 'stock',
    query: 'wine barrel cellar underground aging room st helena napa dark atmospheric',
    caption: 'Script reference — cellar dark',
    matchByName: 'St. Helena Barrel Cellar',
  },
  {
    projectKey: 'p3', surface: 'narrativeLocation', slug: 'napa-valley-road-narrative',
    source: 'stock',
    query: 'napa valley road drive vines both sides moving car window afternoon',
    caption: 'Script reference — valley road',
    matchByName: 'Napa Valley Road',
  },

  // moodboard
  {
    projectKey: 'p3', surface: 'moodboard', slug: 'golden-hour-vineyard',
    source: 'stock',
    query: 'golden hour vineyard warm light vine rows napa valley documentary',
    caption: null,
    matchByName: 'Golden Hour Vineyard',
  },
  {
    projectKey: 'p3', surface: 'moodboard', slug: 'barrel-cellar-dark',
    source: 'stock',
    query: 'wine cellar available light faces partially shadow single practical window',
    caption: null,
    matchByName: 'Barrel Cellar Dark',
  },
  {
    projectKey: 'p3', surface: 'moodboard', slug: 'hands-in-soil',
    source: 'stock',
    query: 'hands touching vineyard soil earth tactile close-up documentary',
    caption: null,
    matchByName: 'Hands in Soil',
  },
  {
    projectKey: 'p3', surface: 'moodboard', slug: 'valley-road-movement',
    source: 'stock',
    query: 'car driving through napa valley road dashboard pov window landscape',
    caption: null,
    matchByName: 'Valley Road Movement',
  },
  {
    projectKey: 'p3', surface: 'moodboard', slug: 'spare-score',
    source: 'stock',
    query: 'string quartet minimal classical score studio recording intimate',
    caption: null,
    matchByName: 'Spare Score',
  },

  // props
  {
    projectKey: 'p3', surface: 'prop', slug: 'wine-barrel',
    source: 'ai',
    prompt: 'Prop close-up: French oak wine barrel with branded estate stamp burnt into the wood, cellar environment, low warm light from a bare practical bulb, chalk date visible.',
    caption: null,
    matchByName: 'Wine Barrel',
  },
  {
    projectKey: 'p3', surface: 'prop', slug: 'estate-signage',
    source: 'ai',
    prompt: 'Prop establishing shot: hand-painted wooden estate entrance sign on a post, vineyard rows visible behind, golden late-afternoon light, aged paint texture.',
    caption: null,
    matchByName: 'Estate Signage',
  },
  {
    projectKey: 'p3', surface: 'prop', slug: 'harvest-basket',
    source: 'ai',
    prompt: 'Prop close-up: traditional wicker grape harvest basket, partially filled with dark grapes, vineyard row background soft and out of focus, golden hour light.',
    caption: null,
    matchByName: 'Harvest Basket',
  },

  // wardrobe
  {
    projectKey: 'p3', surface: 'wardrobe', slug: 'winemaker-estate-attire',
    source: 'ai',
    prompt: 'Wardrobe reference: worn chambray work shirt, canvas apron with soil marks, and aged leather boots on a rough wooden shelf, natural light, authentic texture.',
    caption: null,
    matchByName: 'Winemaker — Estate Attire',
  },
  {
    projectKey: 'p3', surface: 'wardrobe', slug: 'host-smart-casual',
    source: 'ai',
    prompt: 'Wardrobe reference: unstructured linen blazer in warm earth tone and open-collar shirt on a wooden hanger, polished but relaxed, natural window light.',
    caption: null,
    matchByName: 'Host — Smart Casual',
  },

  // hmu
  {
    projectKey: 'p3', surface: 'hmu', slug: 'winemaker-natural-documentary',
    source: 'ai',
    prompt: 'HMU reference: documentary-style male skin close-up, no makeup, natural pores and texture, sun and wind lines visible, authentic ageing — no retouching.',
    caption: null,
    matchByName: 'Winemaker — Natural Documentary',
  },
  {
    projectKey: 'p3', surface: 'hmu', slug: 'host-polished-relaxed',
    source: 'ai',
    prompt: 'HMU reference: light matte base on male skin, groomed brows, camera-ready finish without heaviness, clean neutral light, no identifiable subject.',
    caption: null,
    matchByName: 'Host — Polished Relaxed',
  },

  // cast
  {
    projectKey: 'p3', surface: 'cast', slug: 'renata-vasquez',
    source: 'ai',
    prompt: 'Documentary portrait of a woman in her 40s, confident and grounded, outdoor vineyard setting, natural afternoon light, direct eye contact, no performance.',
    caption: null,
    matchByName: 'Renata Vasquez',
  },
  {
    projectKey: 'p3', surface: 'cast', slug: 'oliver-strand',
    source: 'ai',
    prompt: 'Documentary portrait of a man in his late 30s, warm and approachable, semi-formal linen jacket, natural light, slight smile, wine country background.',
    caption: null,
    matchByName: 'Oliver Strand',
  },

  // ── p4 Flexibility Course A ──────────────────────────────────────────────

  // locations
  {
    projectKey: 'p4', surface: 'location', slug: 'the-stillpoint-private-studio',
    source: 'stock',
    query: 'private yoga studio clean white walls polished concrete north-facing windows minimal',
    caption: 'Primary studio — confirmed',
    matchByName: 'The Stillpoint — Private Studio',
  },
  {
    projectKey: 'p4', surface: 'location', slug: 'point-dume-blufftop',
    source: 'stock',
    query: 'coastal bluff ocean view malibu sunrise yoga practice cliff top',
    caption: 'Exterior shoot — sunrise confirmed',
    matchByName: 'Point Dume Blufftop',
  },
  {
    projectKey: 'p4', surface: 'location', slug: 'minimalist-home-silver-lake',
    source: 'stock',
    query: 'mid-century modern interior large windows warm wood floor minimal furnishing los angeles',
    caption: 'Episode 3 option — in talks',
    matchByName: 'Minimalist Home — Silver Lake',
  },

  // narrativeLocations
  {
    projectKey: 'p4', surface: 'narrativeLocation', slug: 'cyc-studio-downtown-la-narrative',
    source: 'stock',
    query: 'white cyclorama studio interior yoga teaching clean space minimal',
    caption: 'Script reference — studio sequences',
    matchByName: 'Cyc Studio, Downtown LA',
  },
  {
    projectKey: 'p4', surface: 'narrativeLocation', slug: 'will-rogers-state-park-narrative',
    source: 'stock',
    query: 'will rogers state park open meadow mountains behind morning light grass',
    caption: 'Script reference — outdoor ground sequence',
    matchByName: 'Will Rogers State Park',
  },

  // moodboard
  {
    projectKey: 'p4', surface: 'moodboard', slug: 'white-cyc-studio',
    source: 'stock',
    query: 'white cyclorama studio yoga body movement clean stage full attention',
    caption: null,
    matchByName: 'White Cyc Studio',
  },
  {
    projectKey: 'p4', surface: 'moodboard', slug: 'bare-feet-real-ground',
    source: 'stock',
    query: 'bare feet grass earth close-up yoga grounding outdoor practice natural',
    caption: null,
    matchByName: 'Bare Feet, Real Ground',
  },
  {
    projectKey: 'p4', surface: 'moodboard', slug: 'kaia-signature-tone',
    source: 'stock',
    query: 'muted sage charcoal activewear yoga practice editorial athletic minimal',
    caption: null,
    matchByName: 'Kaia — Signature Tone',
  },
  {
    projectKey: 'p4', surface: 'moodboard', slug: 'breath-as-pacing',
    source: 'stock',
    query: 'minimal piano ambient music soft space meditative breath pacing',
    caption: null,
    matchByName: 'Breath as Pacing',
  },

  // props
  {
    projectKey: 'p4', surface: 'prop', slug: 'yoga-mat-branded-kaia-mori',
    source: 'ai',
    prompt: 'Prop top-down flat-lay: rolled-out yoga mat with subtle logo mark in the corner, clean studio floor, minimal side light, no human element.',
    caption: null,
    matchByName: 'Yoga Mat (Branded Kaia Mori)',
  },
  {
    projectKey: 'p4', surface: 'prop', slug: 'yoga-blocks',
    source: 'ai',
    prompt: 'Prop still life: two cork yoga blocks stacked at a slight angle on a wooden floor, natural side light, clean background.',
    caption: null,
    matchByName: 'Yoga Blocks',
  },
  {
    projectKey: 'p4', surface: 'prop', slug: 'bolster',
    source: 'ai',
    prompt: 'Prop still life: cylindrical linen bolster cushion on a yoga mat surface, natural daylight, neutral tones, simple overhead framing.',
    caption: null,
    matchByName: 'Bolster',
  },

  // wardrobe
  {
    projectKey: 'p4', surface: 'wardrobe', slug: 'kaia-signature-activewear',
    source: 'ai',
    prompt: 'Wardrobe flat-lay: branded sage-green yoga set — high-waisted leggings and matching sports bra — on a clean white surface, subtle logo visible, natural light.',
    caption: null,
    matchByName: 'Kaia — Signature Activewear',
  },
  {
    projectKey: 'p4', surface: 'wardrobe', slug: 'student-neutral-activewear',
    source: 'ai',
    prompt: 'Wardrobe flat-lay: plain neutral-coloured leggings and a fitted tank top on a light surface, no branding, clean daylight.',
    caption: null,
    matchByName: 'Student — Neutral Activewear',
  },

  // hmu
  {
    projectKey: 'p4', surface: 'hmu', slug: 'kaia-clean-glow',
    source: 'ai',
    prompt: 'HMU reference: camera-ready natural finish, light bronzer on cheekbones, clean defined brows, sweat-proof texture visible — bright studio light, no identifiable subject.',
    caption: null,
    matchByName: 'Kaia — Clean Glow',
  },
  {
    projectKey: 'p4', surface: 'hmu', slug: 'student-minimal',
    source: 'ai',
    prompt: 'HMU reference: bare translucent-powder skin close-up, no colour product, natural pores and light, honest texture — instructional supporting look.',
    caption: null,
    matchByName: 'Student — Minimal',
  },

  // cast
  {
    projectKey: 'p4', surface: 'cast', slug: 'kaia-mori',
    source: 'ai',
    prompt: 'Editorial portrait of a woman in her mid-30s with an athletic, grounded presence, yoga instructor energy, clean studio background, warm direct gaze, natural light.',
    caption: null,
    matchByName: 'Kaia Mori',
  },

  // ── p5 Natural Order ─────────────────────────────────────────────────────

  // location
  {
    projectKey: 'p5', surface: 'location', slug: 'westside-post-suite-4',
    source: 'stock',
    query: 'professional post production edit suite 5.1 monitoring grading bay santa monica',
    caption: 'Finishing suite — two-week hold',
    matchByName: 'Westside Post — Suite 4',
  },

  // moodboard
  {
    projectKey: 'p5', surface: 'moodboard', slug: 'the-problem-scale',
    source: 'stock',
    query: 'aerial ocean surface dawn deep blue vast scale climate data',
    caption: null,
    matchByName: 'The Problem — Scale',
  },
  {
    projectKey: 'p5', surface: 'moodboard', slug: 'sensor-networks',
    source: 'stock',
    query: 'abstract particle flow data visualization resolving into structure network',
    caption: null,
    matchByName: 'Sensor Networks',
  },
  {
    projectKey: 'p5', surface: 'moodboard', slug: 'meridian-platform-ui',
    source: 'stock',
    query: 'climate data dashboard interface clean authoritative data visualization screen',
    caption: null,
    matchByName: 'Meridian Platform UI',
  },
  {
    projectKey: 'p5', surface: 'moodboard', slug: 'unified-signal-moment',
    source: 'stock',
    query: 'scattered data particles resolving converging single point resolution visualization',
    caption: null,
    matchByName: 'Unified Signal Moment',
  },
  {
    projectKey: 'p5', surface: 'moodboard', slug: 'score-reference-p5',
    source: 'stock',
    query: 'orchestral minimal score recording studio strings patient earned film music',
    caption: null,
    matchByName: 'Score Reference',
  },

  // props
  {
    projectKey: 'p5', surface: 'prop', slug: 'data-terminal-hero-practical',
    source: 'ai',
    prompt: 'Prop close-up: sleek futuristic data display terminal with glowing screen on a dark desk, hero insert angle, reflections of soft ambient studio light, no branding visible.',
    caption: null,
    matchByName: 'Data Terminal (Hero Practical)',
  },
  {
    projectKey: 'p5', surface: 'prop', slug: 'branded-climate-report',
    source: 'ai',
    prompt: 'Prop flat-lay: printed technical report with a professional branded cover, charts partially visible on the open pages, clean desk surface, overhead angle, neutral light.',
    caption: null,
    matchByName: 'Branded Climate Report',
  },

  // wardrobe
  {
    projectKey: 'p5', surface: 'wardrobe', slug: 'vo-artist-minimal',
    source: 'ai',
    prompt: 'Wardrobe reference: plain dark navy crew-neck top neatly folded on a clean surface, no logos, soft side light — corrective VO session look.',
    caption: null,
    matchByName: 'VO Artist — Minimal',
  },

  // hmu
  {
    projectKey: 'p5', surface: 'hmu', slug: 'vo-artist-base-look',
    source: 'ai',
    prompt: 'HMU reference: translucent corrective base on neutral skin close-up, no colour visible, camera-ready texture, behind-scenes studio light — no identifiable subject.',
    caption: null,
    matchByName: 'VO Artist — Base Look',
  },

  // cast
  {
    projectKey: 'p5', surface: 'cast', slug: 'simone-achebe',
    source: 'ai',
    prompt: 'Portrait of a woman in her late 30s with a composed, authoritative voice-over artist presence, dark solid top, neutral studio background, warm direct gaze.',
    caption: null,
    matchByName: 'Simone Achebe',
  },

  // ── p6 The Weave ─────────────────────────────────────────────────────────

  // locations
  {
    projectKey: 'p6', surface: 'location', slug: 'mojave-desert-open-flats',
    source: 'stock',
    query: 'mojave desert open scrubland flat pale cracked earth wide horizon aerial',
    caption: 'Day 1 completed — Eli scenes',
    matchByName: 'Mojave Desert — open flats',
  },
  {
    projectKey: 'p6', surface: 'location', slug: 'malibu-creek-state-park-ravine-edge',
    source: 'stock',
    query: 'malibu creek sandstone ravine cliff edge canyon layered rock daylight',
    caption: 'Day 2 completed — Mara scenes',
    matchByName: 'Malibu Creek State Park — ravine edge',
  },
  {
    projectKey: 'p6', surface: 'location', slug: 'joshua-tree-national-park-night-stars',
    source: 'stock',
    query: 'joshua tree national park night sky full stars desert dark clear milky way',
    caption: 'Day 3 tonight — night shoot',
    matchByName: 'Joshua Tree National Park — night stars',
  },

  // narrativeLocations
  {
    projectKey: 'p6', surface: 'narrativeLocation', slug: 'desert-flats-narrative',
    source: 'stock',
    query: 'mojave desert flats cracked earth pale sky open horizon solitude',
    caption: 'Script reference — Eli apogee',
    matchByName: 'Desert Flats',
  },
  {
    projectKey: 'p6', surface: 'narrativeLocation', slug: 'ravine-edge-narrative',
    source: 'stock',
    query: 'canyon ravine edge cliff malibu creek sandstone woman standing still',
    caption: 'Script reference — Mara edge',
    matchByName: 'Ravine Edge',
  },
  {
    projectKey: 'p6', surface: 'narrativeLocation', slug: 'joshua-tree-night-narrative',
    source: 'stock',
    query: 'joshua tree desert night stars two figures meeting dark vast sky',
    caption: 'Script reference — collision night',
    matchByName: 'Joshua Tree — Night',
  },

  // moodboard
  {
    projectKey: 'p6', surface: 'moodboard', slug: 'apogee',
    source: 'stock',
    query: 'solitude desert vast landscape figure small horizon farthest point',
    caption: null,
    matchByName: 'Apogee',
  },
  {
    projectKey: 'p6', surface: 'moodboard', slug: 'the-mirror-structure',
    source: 'stock',
    query: 'mirror parallel scenes two characters different landscapes same emotion',
    caption: null,
    matchByName: 'The Mirror Structure',
  },
  {
    projectKey: 'p6', surface: 'moodboard', slug: 'night-stars-mojave',
    source: 'stock',
    query: 'mojave desert night natural starlight milky way practical lantern warm darkness',
    caption: null,
    matchByName: 'Night Stars — Mojave',
  },
  {
    projectKey: 'p6', surface: 'moodboard', slug: 'wardrobe-texture',
    source: 'stock',
    query: 'weathered denim linen dusty worn fabric texture lived-in desert traveller',
    caption: null,
    matchByName: 'Wardrobe Texture',
  },
  {
    projectKey: 'p6', surface: 'moodboard', slug: 'score-reference-p6',
    source: 'stock',
    query: 'spare orchestral score film music recording studio strings unsettling beauty',
    caption: null,
    matchByName: 'Score Reference',
  },
  {
    projectKey: 'p6', surface: 'moodboard', slug: 'fracture-universe',
    source: 'stock',
    query: 'cinematic narrative universe threads connecting multiple stories film still',
    caption: null,
    matchByName: 'FRACTURE Universe',
  },

  // props
  {
    projectKey: 'p6', surface: 'prop', slug: 'journal-maras',
    source: 'ai',
    prompt: 'Prop close-up: leather-bound journal open to a page with handwritten text stopping mid-sentence, pen resting across the page, natural daylight on rough rock surface.',
    caption: null,
    matchByName: "Journal (Mara's)",
  },
  {
    projectKey: 'p6', surface: 'prop', slug: 'worn-rope',
    source: 'ai',
    prompt: 'Prop still life: frayed hemp rope coiled loosely on cracked desert earth, aged and weathered, warm midday light, symbolic and tactile close-up.',
    caption: null,
    matchByName: 'Worn Rope',
  },
  {
    projectKey: 'p6', surface: 'prop', slug: 'handheld-lantern',
    source: 'ai',
    prompt: 'Prop close-up: oil lantern with practical flame burning, held in darkness, warm amber glow against night exterior, no background visible beyond soft flicker.',
    caption: null,
    matchByName: 'Handheld Lantern',
  },

  // wardrobe
  {
    projectKey: 'p6', surface: 'wardrobe', slug: 'eli-desert-layers',
    source: 'ai',
    prompt: 'Wardrobe flat-lay: worn denim jacket, faded henley shirt, and dusty leather boots arranged on cracked earth, sun-bleached and weathered texture, overhead angle.',
    caption: null,
    matchByName: 'Eli — Desert Layers',
  },
  {
    projectKey: 'p6', surface: 'wardrobe', slug: 'mara-light-linen',
    source: 'ai',
    prompt: 'Wardrobe reference: flowing linen shirt in earth tone and wide-leg trousers on a wooden hanger, windswept texture, natural outdoor light, no model.',
    caption: null,
    matchByName: 'Mara — Light Linen',
  },

  // hmu
  {
    projectKey: 'p6', surface: 'hmu', slug: 'eli-dusty-sun-worn',
    source: 'ai',
    prompt: 'HMU reference: male skin with sun and wind wear visible, cracked lip, fine dust texture on forehead, no identifiable subject — desert-worn realism close-up.',
    caption: null,
    matchByName: 'Eli — Dusty Sun-Worn',
  },
  {
    projectKey: 'p6', surface: 'hmu', slug: 'mara-natural-minimal',
    source: 'ai',
    prompt: 'HMU reference: clean bare female skin, wind-tousled hair framing the face, zero visible product, organic texture — outdoor natural light, no identifiable subject.',
    caption: null,
    matchByName: 'Mara — Natural Minimal',
  },

  // cast
  {
    projectKey: 'p6', surface: 'cast', slug: 'marcus-webb',
    source: 'ai',
    prompt: 'Editorial portrait of a lean man in his mid-30s, weathered outdoor presence, calm introspective expression, desert landscape background, natural daylight.',
    caption: null,
    matchByName: 'Marcus Webb',
  },
  {
    projectKey: 'p6', surface: 'cast', slug: 'sola-adeyemi',
    source: 'ai',
    prompt: 'Editorial portrait of a woman in her mid-30s, still and watchful, ravine or cliff edge background, natural daylight, understated emotional depth.',
    caption: null,
    matchByName: 'Sola Adeyemi',
  },
  {
    projectKey: 'p6', surface: 'cast', slug: 'jin-park',
    source: 'ai',
    prompt: 'Editorial portrait of a man in his early 30s, quiet supporting presence, night exterior setting, practical warm light source at edge of frame, candid expression.',
    caption: null,
    matchByName: 'Jin Park',
  },

  // ── Crew avatars (project-agnostic) ──────────────────────────────────────

  {
    projectKey: 'crew', surface: 'avatar', slug: 'clyde-bessey',
    source: 'ai',
    prompt: 'Square environmental portrait of a film director on set, mid-30s, thoughtful expression, monitor or camera visible at edge of frame, natural daylight, documentary style.',
    caption: null,
    matchByName: 'Clyde Bessey',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'tyler-heckerman',
    source: 'ai',
    prompt: 'Square environmental portrait of a film producer on set, clipboard or phone in hand, natural daylight, organized and focused energy, no logo visible.',
    caption: null,
    matchByName: 'Tyler Heckerman',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'kelly-pratt',
    source: 'ai',
    prompt: 'Square environmental portrait of a film producer, warm and capable demeanor, on-set environment, natural daylight, candid expression, documentary style.',
    caption: null,
    matchByName: 'Kelly Pratt',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'rafi-torres',
    source: 'ai',
    prompt: 'Square environmental portrait of a film editor at a workstation, multiple monitors visible, post production suite, warm practical light, focused expression.',
    caption: null,
    matchByName: 'Rafi Torres',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'cleo-strand',
    source: 'ai',
    prompt: 'Square environmental portrait of a colorist at a grading workstation, DaVinci Resolve visible on screen, dark grading suite, focused and precise expression.',
    caption: null,
    matchByName: 'Cleo Strand',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'james-calloway',
    source: 'ai',
    prompt: 'Square environmental portrait of a production coordinator on set, walkie talkie or headset, natural daylight, organized multitasking energy, candid documentary style.',
    caption: null,
    matchByName: 'James Calloway',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'theo-hartmann',
    source: 'ai',
    prompt: 'Square environmental portrait of a 1st AC on a film set, pulling focus on a camera rig, natural daylight, precise and technical expression, no logo visible.',
    caption: null,
    matchByName: 'Theo Hartmann',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'priya-nair',
    source: 'ai',
    prompt: 'Square environmental portrait of a cinematographer (DP) on set, looking through a camera eyepiece or monitor, natural daylight, creative and decisive energy.',
    caption: null,
    matchByName: 'Priya Nair',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'carlos-vega',
    source: 'ai',
    prompt: 'Square environmental portrait of a 2nd AC on a film set, holding a slate or managing media cards, natural daylight, attentive candid expression.',
    caption: null,
    matchByName: 'Carlos Vega',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'sam-okafor',
    source: 'ai',
    prompt: 'Square environmental portrait of a camera crew member on set, focus puller role, natural daylight, candid attentive expression, no logo visible.',
    caption: null,
    matchByName: 'Sam Okafor',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'rick-souza',
    source: 'ai',
    prompt: 'Square environmental portrait of a gaffer on a film set, adjusting a light fixture or diffusion, natural and artificial mixed light, focused technical expression.',
    caption: null,
    matchByName: 'Rick Souza',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'tanya-mills',
    source: 'ai',
    prompt: 'Square environmental portrait of a female gaffer on set, directing lighting setup, confident and decisive energy, mixed natural and artificial light, candid.',
    caption: null,
    matchByName: 'Tanya Mills',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'derek-huang',
    source: 'ai',
    prompt: 'Square environmental portrait of a key grip on a film set, managing a camera support rig or dolly, natural daylight, hands-on practical energy.',
    caption: null,
    matchByName: 'Derek Huang',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'luis-fernandez',
    source: 'ai',
    prompt: 'Square environmental portrait of a grip crew member on set, moving equipment or rigging, natural daylight, candid working expression, no logo visible.',
    caption: null,
    matchByName: 'Luis Fernandez',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'claire-renault',
    source: 'ai',
    prompt: 'Square environmental portrait of an art director on a film set, reviewing set dressing or a sketch, focused creative expression, soft natural light.',
    caption: null,
    matchByName: 'Claire Renault',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'nina-osei',
    source: 'ai',
    prompt: 'Square environmental portrait of a set decorator on location, arranging props or dressing a surface, natural light, attentive and creative expression.',
    caption: null,
    matchByName: 'Nina Osei',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'brendan-walsh',
    source: 'ai',
    prompt: 'Square environmental portrait of a props master on a film set, organizing or handling a prop, natural daylight, practical focused energy.',
    caption: null,
    matchByName: 'Brendan Walsh',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'isabel-torres',
    source: 'ai',
    prompt: 'Square environmental portrait of a wardrobe stylist on set, steaming or adjusting a garment on a rack, soft natural light, detail-oriented expression.',
    caption: null,
    matchByName: 'Isabel Torres',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'jasmine-bell',
    source: 'ai',
    prompt: 'Square environmental portrait of an HMU artist applying makeup to a subject partially visible at frame edge, bright warm light, focused artisan expression.',
    caption: null,
    matchByName: 'Jasmine Bell',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'fiona-drake',
    source: 'ai',
    prompt: 'Square environmental portrait of a makeup and hair artist on set, brushes or tools visible, warm bright light, calm and professional expression.',
    caption: null,
    matchByName: 'Fiona Drake',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'pete-larsson',
    source: 'ai',
    prompt: 'Square environmental portrait of a sound mixer on set, wearing over-ear headphones, holding a mixer or boom pole nearby, natural daylight, listening expression.',
    caption: null,
    matchByName: 'Pete Larsson',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'andre-kim',
    source: 'ai',
    prompt: 'Square environmental portrait of a sound mixer on a film set, boom pole or bag rig visible, outdoor or mixed light, attentive candid expression.',
    caption: null,
    matchByName: 'Andre Kim',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'mia-chen',
    source: 'ai',
    prompt: 'Square environmental portrait of a production coordinator, organized and multitasking on set, tablet or clipboard visible, natural daylight, warm candid expression.',
    caption: null,
    matchByName: 'Mia Chen',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'aria-stone',
    source: 'ai',
    prompt: 'Square environmental portrait of a woman in her late 20s with a calm on-camera presence, natural light, relaxed expression, no specific setting identifiable.',
    caption: null,
    matchByName: 'Aria Stone',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'vera-hastings',
    source: 'ai',
    prompt: 'Square environmental portrait of a casting coordinator, professional and composed, office or studio environment, natural light, direct gaze.',
    caption: null,
    matchByName: 'Vera Hastings',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'lena-farrow',
    source: 'ai',
    prompt: 'Square environmental portrait of a client representative, polished and attentive, neutral office or production environment, natural light, professional expression.',
    caption: null,
    matchByName: 'Lena Farrow',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'dani-reeves',
    source: 'ai',
    prompt: 'Square environmental portrait of a film camera operator (DP) on set, natural daylight, candid expression, camera rig visible at edge of frame, documentary style.',
    caption: null,
    matchByName: 'Dani Reeves',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'tyler-green',
    source: 'ai',
    prompt: 'Square environmental portrait of a production coordinator on location, run-and-gun energy, natural daylight, practical on-set expression, no logo visible.',
    caption: null,
    matchByName: 'Tyler Green',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'marco-silva',
    source: 'ai',
    prompt: 'Square environmental portrait of a male surfer in his late 20s, coastal setting, sun-bleached hair, relaxed athletic energy, natural ocean light.',
    caption: null,
    matchByName: 'Marco Silva',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'zoe-park',
    source: 'ai',
    prompt: 'Square environmental portrait of a female trail runner, outdoor ridge setting, athletic and determined expression, natural dawn or early morning light.',
    caption: null,
    matchByName: 'Zoe Park',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'dev-okafor',
    source: 'ai',
    prompt: 'Square environmental portrait of a male skateboarder in his mid-20s, concrete skatepark setting, post-trick relaxed expression, strong midday light.',
    caption: null,
    matchByName: 'Dev Okafor',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'owen-blakely',
    source: 'ai',
    prompt: 'Square environmental portrait of a cinematographer on a documentary shoot, handheld camera visible, available light interior, candid engaged expression.',
    caption: null,
    matchByName: 'Owen Blakely',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'tom-vega',
    source: 'ai',
    prompt: 'Square environmental portrait of a sound mixer in a documentary setting, sound bag rig and headphones, outdoor available light, focused listening expression.',
    caption: null,
    matchByName: 'Tom Vega',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'ryan-cole',
    source: 'ai',
    prompt: 'Square environmental portrait of a production coordinator on location, organized and calm, natural daylight, no logo visible, documentary candid style.',
    caption: null,
    matchByName: 'Ryan Cole',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'paul-navarro',
    source: 'ai',
    prompt: 'Square environmental portrait of a man in his 40s, documentary subject quality, thoughtful and natural, outdoor setting, wine country or natural landscape behind.',
    caption: null,
    matchByName: 'Paul Navarro',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'marcus-trent',
    source: 'ai',
    prompt: 'Square environmental portrait of a man in his 40s, strong quiet presence, outdoor or cellar setting, natural or low available light, candid documentary expression.',
    caption: null,
    matchByName: 'Marcus Trent',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'jin-ho',
    source: 'ai',
    prompt: 'Square environmental portrait of a man in his late 30s, thoughtful and composed, vineyard or outdoor natural setting, warm golden light, candid expression.',
    caption: null,
    matchByName: 'Jin Ho',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'alex-drum',
    source: 'ai',
    prompt: 'Square environmental portrait of a cinematographer (DP) in a studio setting, two-camera setup visible in background, clean daylight, focused technical expression.',
    caption: null,
    matchByName: 'Alex Drum',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'hana-liu',
    source: 'ai',
    prompt: 'Square environmental portrait of a boom operator on a film set, boom pole visible, natural light interior, attentive listening expression, no logo visible.',
    caption: null,
    matchByName: 'Hana Liu',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'tyler-moss',
    source: 'ai',
    prompt: 'Square environmental portrait of a production coordinator on a small crew shoot, practical outdoors setting, natural daylight, organized calm energy.',
    caption: null,
    matchByName: 'Tyler Moss',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'kaia-mori-crew',
    source: 'ai',
    prompt: 'Square environmental portrait of a yoga instructor in her mid-30s on set as both talent and client, friendly and grounded expression, studio or outdoor natural light.',
    caption: null,
    matchByName: 'Kaia Mori',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'james-north',
    source: 'ai',
    prompt: 'Square environmental portrait of a voice-over artist in a professional recording booth, microphone visible at frame edge, warm studio light, composed voice-ready expression.',
    caption: null,
    matchByName: 'James North',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'sarah-osei',
    source: 'ai',
    prompt: 'Square environmental portrait of a client representative, composed and professional, office or post-production suite environment, natural light, direct gaze.',
    caption: null,
    matchByName: 'Sarah Osei',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'caleb-stone',
    source: 'ai',
    prompt: 'Square environmental portrait of a cinematographer (DP) on a feature film set, ARRI camera rig visible, natural or mixed light, decisive and focused expression.',
    caption: null,
    matchByName: 'Caleb Stone',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'maya-lin',
    source: 'ai',
    prompt: 'Square environmental portrait of a 1st AC on a narrative film set, pulling focus on a camera rig, natural or available light, precise and technical expression.',
    caption: null,
    matchByName: 'Maya Lin',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'dario-reyes',
    source: 'ai',
    prompt: 'Square environmental portrait of a best boy electric on a night film set, lighting equipment visible in background, warm mixed light, hands-on technical expression.',
    caption: null,
    matchByName: 'Dario Reyes',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'sam-park',
    source: 'ai',
    prompt: 'Square environmental portrait of a grip on a film set, grip equipment visible nearby, natural daylight exterior, candid practical expression.',
    caption: null,
    matchByName: 'Sam Park',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'petra-walsh',
    source: 'ai',
    prompt: 'Square environmental portrait of a female art director on a narrative film set, reviewing set dressing or production design, natural light, focused creative expression.',
    caption: null,
    matchByName: 'Petra Walsh',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'omar-rashid',
    source: 'ai',
    prompt: 'Square environmental portrait of a boom operator on location, boom pole and sound bag visible, outdoor natural light, attentive and responsive expression.',
    caption: null,
    matchByName: 'Omar Rashid',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'chris-tan',
    source: 'ai',
    prompt: 'Square environmental portrait of a sound mixer on a narrative film set, headphones and sound bag rig, natural available light, listening and calibrating expression.',
    caption: null,
    matchByName: 'Chris Tan',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'rina-cole',
    source: 'ai',
    prompt: 'Square environmental portrait of a production coordinator on a narrative film set, walkie talkie or paperwork visible, natural light, calm multitasking expression.',
    caption: null,
    matchByName: 'Rina Cole',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'leo-marsh',
    source: 'ai',
    prompt: 'Square environmental portrait of a crew member on a feature film set, desert exterior environment, natural daylight, candid at-work expression, no logo visible.',
    caption: null,
    matchByName: 'Leo Marsh',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'vera-koss',
    source: 'ai',
    prompt: 'Square environmental portrait of a crew member on a narrative film production, outdoor location, natural light, candid relaxed expression, no logo visible.',
    caption: null,
    matchByName: 'Vera Koss',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'dana-vance',
    source: 'ai',
    prompt: 'Square environmental portrait of a script supervisor on a film set, continuity binder or notebook visible, natural daylight, detail-focused attentive expression.',
    caption: null,
    matchByName: 'Dana Vance',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'tyler-reed',
    source: 'ai',
    prompt: 'Square environmental portrait of a production crew member on a night exterior shoot, warm practical light source nearby, calm and reliable expression, no logo.',
    caption: null,
    matchByName: 'Tyler Reed',
  },
  {
    projectKey: 'crew', surface: 'avatar', slug: 'sofia-avila',
    source: 'ai',
    prompt: 'Square environmental portrait of a female producer on a feature film, organized and composed, mixed on-set environment, natural or warm practical light, professional expression.',
    caption: null,
    matchByName: 'Sofia Avila',
  },
]
