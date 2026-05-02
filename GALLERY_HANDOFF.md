# Gallery → Implementation Handoff

- **Spec**: https://gallery-theta-amber.vercel.app
- **Source**: `apps/back-to-one/reference/explorations/hub-variant-e-cinema-glass.html` @ tag `design-locked-2026-04-30`
- **Tokens**: `BRAND_TOKENS.md`
- **Treatment rules**: `DESIGN_LANGUAGE.md`

## How to use this doc

For each phone, port the cinema-glass visual treatment onto the
**already-wired structure** in the listed file. Don't add functionality.
Don't change tab counts or filter labels — they've been audited against
current code. Just apply the visuals.

Loading-state phones are skeleton placeholders for the same routes; they
are intentionally excluded from this handoff (apply the loading skeleton
pattern from `DESIGN_LANGUAGE.md` to each route's `loading.tsx`).

Status checkboxes: `[ ]` not started · `[W]` in progress · `[x]` done

---

## Row 1 — Entry

- [ ] **#1 Login** → `src/app/login/page.tsx`
  - Cormorant Garamond title "Back to One" centered ~1/3 from top
  - Cinematic stage gradient bg (login-stage-bg)
  - Role buttons: Producer (active violet) / Crew / Partner ("Soon" pill on Partner only)
  - White Enter button with dark text
  - No FAB cluster (pre-auth)

- [ ] **#2 Project Selection** → `src/app/projects/page.tsx`
  - Eyebrow "Back to One" + bold sheen "Origin Point" + "Select a Project" subtitle
  - 3-column grid of slate-cards, 1:1 squares
  - Each card: project-color top stripe, brand eyebrow, sheen title, type label, phase pill, "next" row
  - "+ NEW PROJECT" (teal pill) + "+ NEW FOLDER" (purple pill)
  - "Archive · 14" silver pill below
  - Logout icon top-right; FAB cluster bottom

- [ ] **#3 Folder · B Story Pictures** → folder open state on `src/app/projects/page.tsx`
  - Floating panel pattern (`top: 200px`, all corners rounded, `max-height: 520px`)
  - Manila-folder silhouette as panel chrome
  - 2x2 (or 3-col) grid of contained slate-cards inside

- [ ] **#4 Archive** → archive open state on `src/app/projects/page.tsx`
  - Same floating-panel pattern as Folder
  - Silver-toned (vs Plum-toned for distinct visual identity)
  - Lists archived projects with same slate-card treatment, slightly desaturated

---

## Row 2 — Hub

- [ ] **#5 Hub** → `src/app/projects/[projectId]/page.tsx`
  - Sheen page title (project name) + phase pill in meta row
  - Inv-strip horizontal scroller (preview chips for each module)
  - Wf-node grid (workflow-node tiles) for primary modules
  - Hub preview blocks ARE the project nav (no separate nav strip)
  - FAB cluster bottom

---

## Row 3 — Timeline

- [ ] **#6 Timeline** → `src/app/projects/[projectId]/timeline/page.tsx`
  - Sheen "Timeline" title + project meta + phase pill
  - Tab nav: Master / Days
  - Default view shows Master gantt with 3 phase segments (pre/prod/post)
  - Below: scrollable milestone list with date · name rows

- [ ] **#7 Timeline · Master** → same route, Master tab active
  - Gantt with active segment glowing (phase color box-shadow)
  - Per-milestone master rows; each carries its own `--proj-rgb`

- [ ] **#8 Timeline · Days** → same route, Days tab active
  - Calendar grid (cal-card glass treatment)
  - Month header sheen title (e.g. "April 2026")
  - Active day highlighted with accent fill

- [ ] **#9 Milestone Detail** → overlay sheet on timeline route
  - Standard 660px overlay sheet
  - Sheen detail-name title + date stamp eyebrow
  - Date, owner, attached scenes/locations meta cards

---

## Row 4 — Budget

- [ ] **#10 Budget** → `src/app/projects/[projectId]/budget/page.tsx`
  - Sheen "Budget" title + meta row
  - Top summary card: spent / total with phase-tinted progress bar
  - Category list rows below with bgt-meta amounts (mono)

- [ ] **#11 Budget Detail** → overlay sheet on budget route
  - 660px overlay sheet
  - Sheen line-item title
  - Vendor / category / amount cards

---

## Row 5 — Tasks (Action Items)

- [ ] **#12 Action Items · Me** → `src/app/projects/[projectId]/action-items/page.tsx`
  - Sheen "Action Items" title
  - Tab nav: All / Me / Dept (Me active in spec)
  - Task rows: checkbox + name + dept chip + due date
  - Open / Done section dividers (sheen section headers)

- [ ] **#13 Action Items · Dept** → same route, Dept tab active
  - Dept filter pill row (icon-stacked-above-label variant) below tab nav
  - Dept-grouped task list using `--dept-rgb` for left edge stripe

- [ ] **#14 Task Detail** → overlay sheet on action-items route
  - 660px overlay sheet
  - Sheen task title + dept chip + due date eyebrow
  - Notes (MentionInput), assignee, attached entities

---

## Row 6 — Threads

- [ ] **#15 Threads** → `src/app/projects/[projectId]/threads/page.tsx`
  - Sheen "Threads" title
  - Tab nav: Unread / Recent / Resolved
  - Thread rows: object-chip (per attachment type, see `BRAND_TOKENS.md`) + name + last message + timestamp

- [ ] **#16 Thread Detail** → overlay sheet on threads route
  - 660px overlay sheet
  - Sheen thread title + object chip eyebrow
  - Message stream + reply input

- [ ] **#17 Location Thread** → overlay sheet variant
  - Same shape, with location object chip (`obj-location` green)
  - Header includes the linked location's hero image (letterboxed)

---

## Row 7 — Chat

- [ ] **#18 Chat** → `src/app/projects/[projectId]/chat/page.tsx`
  - Sheen "Chat" title + meta row
  - Tab nav: Channels / Direct
  - Channel rows: # icon + name + unread dot

- [ ] **#19 Chat · Direct** → same route, Direct tab active
  - DM rows: avatar + name + last message snippet + timestamp

- [ ] **#20 Chat Detail** → overlay sheet on chat route
  - 660px overlay sheet
  - Channel/DM header (sheen title)
  - Message stream with day dividers; composer at bottom

---

## Row 8 — Script (Scenemaker)

- [ ] **#21 Script** → `src/app/projects/[projectId]/scenemaker/page.tsx` (script tab)
  - Sheen "Script" title
  - Scene list with sc-num pill + sc-loc + scene heading
  - Script formatting in script-page below: Scene heading / action / character / dialogue

---

## Row 9 — Shotlist

- [ ] **#22 Shotlist** → `src/app/projects/[projectId]/scenemaker/page.tsx` (shotlist tab)
  - Sheen "Shotlist" title
  - Scene-grouped shot rows (sc-num + sc-loc section header)
  - Shot row: shot-num pill (12A) + size + angle + brief description

- [ ] **#23 Shot Detail** → overlay sheet on scenemaker route
  - 660px overlay sheet
  - Sheen shot-num + size + angle title
  - 16:9 letterboxed reference image
  - Description, lens, equipment meta cards

---

## Row 10 — Storyboard

- [ ] **#24 Storyboard** → `src/app/projects/[projectId]/scenemaker/page.tsx` (storyboard tab)
  - Sheen "Storyboard" title
  - 2-column grid of sm-cards (storyboard frames)
  - Each frame: 16:9 image with letterbox bars + shot-num pill overlay
  - Frame-within-frame hairline letterbox on the storyboard frame itself

---

## Row 11 — Tone (Moodboard)

- [ ] **#25 Tone** → `src/app/projects/[projectId]/moodboard/page.tsx`
  - Sheen "Tone" title
  - Section dividers: Story / Look / Tone (sheen section headers, var(--accent))
  - Tone-card grid: 3-col, each card with letterbox bars + caption

- [ ] **#26 Tone Detail** → overlay sheet on moodboard route
  - 660px overlay sheet
  - Sheen reference title
  - Full-bleed image (letterboxed) + source link + tags

---

## Row 12 — Locations

- [ ] **#27 Locations** → `src/app/projects/[projectId]/locations/page.tsx`
  - Sheen "Locations" title
  - Status filter pill row (unscouted / scouting / in_talks / confirmed / passed)
  - Location cards: hero image (letterboxed) + name + status pill + address

- [ ] **#28 Location Detail** → overlay sheet on locations route
  - 660px overlay sheet
  - 6px-tall heavy letterbox on the 16:9 hero image
  - Sheen location name + status pill eyebrow
  - Address, contact, attached scenes meta cards

---

## Row 13 — Casting

- [ ] **#29 Casting** → `src/app/projects/[projectId]/casting/page.tsx`
  - Sheen "Casting" title
  - Section dividers per character role (sheen section headers)
  - Talent cards: cast-card-image (letterboxed) + name + role + status pill

- [ ] **#30 Talent Detail** → overlay sheet on casting route
  - 660px overlay sheet
  - 6px heavy letterbox on detail-hero
  - Sheen talent name + role eyebrow ("Casting Locked" status pill)
  - Reel link, contact, audition notes meta cards

---

## Row 14 — Crew

- [ ] **#31 Crew** → `src/app/projects/[projectId]/crew/page.tsx`
  - Sheen "Crew" title + project meta + phase pill
  - Role filter pill row (plain text+count): All · Director · Producer · Coordinator · Writer · Crew
  - Dept-grouped crew grid: section header (sheen) per dept, then 3-col crew-card grid
  - Crew card: avatar (dept-tinted) + name + role; outer glow uses `--proj-rgb`, avatar uses `--dept-rgb`

- [ ] **#32 Crew Profile** → overlay sheet on crew route
  - 660px overlay sheet
  - Sheen crew member name + role eyebrow
  - Avatar, dept chip, contact, day rate, attached departments

- [ ] **#33 Timecards** → overlay or layer state on crew route
  - Sheen "Timecards" title
  - Week selector at top (cal-card)
  - Crew row list with status pill (open / submitted / approved / reopened)

- [ ] **#34 Timecard Detail** → drilldown layer / overlay
  - Sheen crew member + week eyebrow
  - Day-by-day clock-in/out rows
  - Submit / approve action buttons (accent-tinted)

---

## Row 15 — Art

- [ ] **#35 Art** → `src/app/projects/[projectId]/art/page.tsx` (Props default)
  - Sheen "Art" title
  - Tab nav: Props / Wardrobe / HMU
  - Status filter pill row (needed / sourced / ready)
  - Prop cards: image (letterboxed) + name + status pill + isHero badge if applicable

- [ ] **#36 Art · Wardrobe** → same route, Wardrobe tab active
  - Same shape, status states: needed / sourced / fitted / ready

- [ ] **#37 Art · HMU** → same route, HMU tab active
  - Same shape, status states: needed / sourced / confirmed

- [ ] **#38 Prop Detail** → overlay sheet on art route
  - 660px overlay sheet
  - 6px heavy letterbox on prop hero image
  - Sheen prop name + status pill eyebrow
  - Sourced-from, scenes-used, hero badge meta cards

---

## Row 16 — Inventory

- [ ] **#39 Inventory** → `src/app/projects/[projectId]/inventory/page.tsx`
  - Sheen "Inventory" title
  - Status filter pill row (needed / ordered / arrived / packed / returned)
  - Inv-chip strip horizontal scroller for category jump
  - Item rows: name + category + status pill + qty

- [ ] **#40 Item Detail** → overlay sheet on inventory route
  - 660px overlay sheet
  - Sheen item name + status pill eyebrow
  - Vendor, qty, category, attached scenes/locations meta cards

---

## Row 17 — Workflow

- [ ] **#41 Workflow** → `src/app/projects/[projectId]/workflow/page.tsx`
  - Sheen "Workflow" title
  - 7 nodes as alternating-side circles (130×130) connected by diagonal lines
  - Per-node color via `--tag-rgb` (Ingest amber / Other gray / Edit violet / Color red / Sound amber / Edit violet / Delivery green)
  - Final Delivery node has nested deliverable rows below
  - Connector pills at inflection points

- [ ] **#42 Node Detail** → overlay sheet on workflow route
  - 660px overlay sheet
  - Sheen node name + tag eyebrow
  - Owner, due date, attached deliverables, status meta cards

- [ ] **#43 Path Detail** → overlay sheet variant
  - Shows the connector path between two nodes
  - Sheen path label + dependency direction

- [ ] **#44 Deliverable Detail** → overlay sheet on workflow route
  - 660px overlay sheet
  - Sheen deliverable name + due date eyebrow
  - Spec, recipient, format meta cards
  - Final-mile checklist if applicable

---

## Row 18 — Resources

- [ ] **#45 Resources** → `src/app/projects/[projectId]/resources/page.tsx`
  - Sheen "Resources" title
  - Category-grouped resource list (sheen section headers)
  - Resource rows: type icon + name + source + access state

- [ ] **#46 Resource Detail** → overlay sheet on resources route
  - 660px overlay sheet
  - Sheen resource name + type eyebrow
  - Source link, access, attached entities meta cards

---

## Loading-state phones — apply pattern, don't enumerate

These phones are not actionable rows — they map to each route's
`loading.tsx`. Apply the skeleton shimmer pattern from
`DESIGN_LANGUAGE.md` (sk-shimmer 2.2s linear, silhouette-matching blocks).

- Hub · Loading
- Timeline · Loading
- Budget · Loading
- Action Items · Loading
- Threads · Loading
- Chat · Loading
- Script · Loading
- Shotlist · Loading
- Storyboard · Loading
- Tone · Loading
- Locations · Loading
- Casting · Loading
- Crew · Loading
- Art · Loading
- Inventory · Loading
- Workflow · Loading
- Resources · Loading

---

## Implementation order

The visual port is independent of the build sequence in `BUILD_STATUS.md`.
However: respect the Phase 1A milestone before starting wide visual work
on stub-only modules. Specifically — do not visual-port Inventory until
the inventory schema PR has merged (the page won't exist yet).

Routes that are wired today and ready for visual port:
Login, Project Selection (incl. Folder/Archive overlays), Hub, Timeline,
Budget, Action Items, Threads, Chat, Scenemaker (Script/Shotlist/Storyboard),
Moodboard (Tone), Locations, Casting, Crew (incl. Timecards layer states),
Art (Props/Wardrobe/HMU), Workflow, Resources.

Routes pending schema/feature work — port visuals only after the
underlying feature lands:
- Inventory (#39, #40) — pending InventoryItem schema PR
- Crew Profile v2 fields (#32) — pending Crew Profile v2 feature
- Wardrobe sourcing fields (#36) — pending WardrobeSourced
- Prop sourcing fields (#35, #38) — pending PropSourced

---

## Audit reference

Each phone's tab labels, filter labels, and section count have been
verified against the live app's wired structure. If a structure mismatch
is discovered during port, treat it as a bug in the audit (file an issue),
not as license to deviate from the gallery.
