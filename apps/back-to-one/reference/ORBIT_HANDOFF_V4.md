# PROJECT ORBIT — MASTER HANDOFF
## Version 4 — April 2026
## Drop this into every new Claude Code session before starting work

---

## WHAT THIS IS

Project Orbit is a production management PWA for Origin Point (Clyde's creative agency).
Stack: Next.js 14, TypeScript, Tailwind CSS, Supabase, React Query, Zod, React Hook Form.
Live app: https://orbit-alpha-vert.vercel.app
Local: ~/Desktop/orbit
Supabase: sgnjlzcffaptwzxtbefp.supabase.co
Git: initialized at ~/Desktop/orbit — deploy with `npx vercel --prod`

---

## ENVIRONMENT

- `.env.production` is NOT in the repo — env vars live in Vercel dashboard only
- `.claude/settings.local.json` stores approved terminal command patterns
- Never commit `.env.local` or `.env.production`

---

## THREE SEED PROJECTS

| Project      | Type                                | Phase      | Accent         |
|--------------|-------------------------------------|------------|----------------|
| Astra Lumina | Commercial                          | Pre        | Gold #e8c44a   |
| Drifting     | Narrative Short (FRACTURE universe) | Production | Violet #c45adc |
| Freehand     | Branded Documentary (Art is Free)   | Post       | Sky #4ab8e8    |

Project IDs: proj-lumina-001, proj-drifting-001, proj-freehand-001

---

## DESIGN SYSTEM — LOCKED

### Phase colors (immutable — never use for project identity)
- Pre: #e8a020 (amber)
- Prod: #6470f3 (blue-violet)
- Post: #00b894 (teal)

### Text hierarchy
- text: #dddde8 (primary)
- text2: #a0a0b8 (secondary)
- muted: #62627a (labels, timestamps, metadata)

### Backgrounds
- bg: #04040a
- card: #0a0a12
- border: rgba(255,255,255,0.05)

### 18 Project accent colors
getProjectColor(projectId) → deterministic hash → mod 18

**Original 9:** Violet #c45adc · Crimson #e8564a · Sky #4ab8e8 · Gold #e8c44a · Ember #e87a4a · Mint #4ae8a0 · Rose #e84a9a · Lime #7ae84a · Cobalt #4a6ae8

**New 9:** Lavender #a06ae8 · Rust #c87848 · Teal #4ad8c8 · Peach #e8b06a · Fuchsia #e840b8 · Chartreuse #c0e84a · Steel #5a8ae8 · Sand #e8d87a · Blush #e8a0c0

Never use accent colors for phase indicators. Only for topbar gradient, card borders, clapper tops, subtle tints.

### Fonts
- Manrope — headings, UI labels, module names
- DM Mono — metadata, timestamps, IDs, pills
- Courier New — SceneMaker script content ONLY

### Sigil
REMOVED from all screens. Do not add it back anywhere.

### App identity
- App name: "Back to One"
- Full name: "Back to One — Origin Point"
- Studio: Origin Point

### Border radius
- Cards: 9px · Pills: 20px · Sheets: 20px 20px 0 0 (locked, do not change)

---

## CORE DESIGN PHILOSOPHY — CENTERED & SYMMETRICAL

The app is called "Back to One" — it's about coming back to center, focus, presence.
This philosophy drives all layout decisions.

### Rules
- **Everything radiates from center.** Headers, module names, metadata — all centered.
- **Triangle composition.** Title is the point at top. Sub-info fans slightly wider below it. Content fills the base. Creates visual hierarchy through geometry.
- **Background: vertical center glow.** A soft radial gradient pools light down the center spine of every screen. Edges fall off to darkness. Like a spotlight from above.
  - Implementation: `radial-gradient(ellipse 60% 100% at 50% 0%, rgba(accent,0.07) 0%, transparent 65%)` + `linear-gradient(90deg, rgba(0,0,0,0.35) 0%, transparent 28%, transparent 72%, rgba(0,0,0,0.35) 100%)`
  - Accent color changes per project on hub. Neutral on selection screen.
- **List content stays left-aligned.** The centering lives in structural elements — headers, empty states, module names. Practical data (task lists, shot rows, milestone rows) stays left-aligned for readability.
- **All full pages follow this.** Not just the hub. Every module page, every sheet header.

### Module header pattern (centered)
```
      [icon]  Module Name  [chevron]
         metadata subtitle
```
- Icon + name + chevron on one centered row
- Meta (count, status) as a smaller line below, centered, DM Mono muted uppercase
- Meta written naturally: "Shoot in 14 days" not "SHOOT IN 14D", "3 open" not "3 OPEN"

### Topbar pattern (centered)
```
[back]     Project Name      [nothing]
        Type · Phase Pill
        [crew avatars row]
```
- Back button floats top-left, subtle (32px circle, rgba(255,255,255,0.05))
- Project name large and centered (Manrope 800 1.2rem)
- Type + phase pill on one centered row below
- Crew avatars centered below that
- No sigil, no right-side element competing with back button

---

## SHARED COMPONENTS — ALWAYS USE THESE

### PageHeader — src/components/ui/PageHeader.tsx
ALL full-page routes must use this component. Never roll a custom header.
- padding-top: 44px (status bar clearance)
- padding-bottom: 14px
- Consistent height matching hub topbar
- Centered layout (title centered, subtitle centered below)
- Back button top-left, subtle

### Sheet pattern (border-radius LOCKED at 20px)
- Overlay: rgba(0,0,0,0.6) + blur(3px)
- Sheet bg: #0e0e1a · border-radius: 20px 20px 0 0
- Handle: 36x4px rgba(255,255,255,0.1)
- Transition: cubic-bezier(0.32, 0.72, 0, 1) 0.3s

### Scroll vs Tap
- Movement threshold: 8px — if exceeded, cancel tap
- Apply to ALL tappable rows

---

## FAB SYSTEM — LOCKED

### Hub FAB (three-button system)
The bottom thumb zone has three elements, all starting centered and expanding on tap:

**Closed state:**
- Center: main plus FAB (52px, accent color, glowing shadow)
- Left and right FABs hidden behind center FAB (opacity 0, same position)

**On tap of main FAB:**
- Main FAB rotates 45° (plus becomes ×)
- Chat FAB slides left to -104px from center (34px, subtle dark circle)
- Threads FAB slides right to +104px from center (34px, subtle dark circle, blue unread dot)
- Three branch options fan upward symmetrically with dashed connector lines:
  - Left branch: Action Item (amber circle icon, "Action" label)
  - Center branch: Milestone (accent circle icon, "Milestone" label) — rises highest
  - Right branch: Creative (blue-violet circle icon, "Creative" label)
- Backdrop blurs and dims behind options
- Stagger: left+right first (0s), center (0.04s delay)
- Spring animation: cubic-bezier(0.34, 1.56, 0.64, 1)

**On close:** everything slides back to center, backdrop clears

**Side FABs always use true center as origin:**
- `left: 50%; transform: translate(-50%, -50%)` at rest
- Open: `transform: translate(calc(-50% ± 104px), -50%)`
- This ensures perfect symmetry

### Full page FAB (contextual)
On every full page the center FAB becomes contextual — no branching, just direct action:
- Action Items page → Add task
- Timeline page → Add milestone
- SceneMaker Script → Add scene
- SceneMaker Shotlist → Add shot
- Locations → Add location
- Casting → Add cast member
- Crew → Add crew member
- Chat → Compose message
- Threads → New thread

Chat FAB (left) and Threads FAB (right) persist on all pages for quick access.

---

## PROJECT SELECTION SCREEN

### Centered philosophy applied
- Header: "Back to One." (Manrope 800 1.5rem) — centered
- Subtitle: "Origin Point · Select a project" (DM Mono muted) — centered
- Logout button: top-right, subtle circle (not left — no back nav needed here)
- Background: space bg (CSS nebula + bokeh + stars) with center glow down the middle

### Film slate cards (2×2 grid, 16:9, 10px gap, 14px padding)
- Clapper top (16px): SVG diagonal stripe pattern, 3 wide stripes in project accent color, thin accent strip at bottom, two punch holes
- Body: dark tinted gradient from project color, scan line texture (::before)
- Project type (DM Mono, accent 55% opacity) + project name (Manrope 800)
- Phase pill (phase color always) + crew avatars
- Next milestone below (amber if urgent)
- Press: scale(0.96) + brightness(0.85)

### Long press action sheet
- Rename (project name + client) · Change color (18 swatches) · Archive · Delete

### No FAB on selection screen
Selection screen has no FAB — New Project tile in the grid handles creation.

---

## HUB — src/app/projects/[projectId]/page.tsx

### Module order (locked)
1. Timeline
2. Action Items
3. SceneMaker + Tone (fixed 140px row)
4. Locations / Art / Casting (mini-row)
5. Workflow (or Chat when built)

### Hub module header (centered pattern)
```
    [icon]  Module Name  [chevron]
         meta subtitle
```

### Modules spec — see full module sections below

---

## MODULE SPECS

### ACTION ITEMS

**Hub card (168px):**
- Filled: 3 task rows (mine = accent checkbox, others = muted + assignee), overdue = amber
- Empty: pulse ring + checkmark, "All clear, boss." / "No open items. Enjoy it while it lasts."
- Add task row at bottom of card (both states)

**Full page (/action-items):**
- Tabs: Me / Upcoming / Dept — centered tab bar, badge counts, accent active
- High priority: 2.5px left-edge accent bar
- Swipe right → complete (green), swipe left → delete (red)
- Completed: collapsed by default, chevron to expand
- Upcoming groups: Today (accent label) / This Week / Later
- Dept: collapsible sections, colored dot + name + count
- Task detail sheet: title, priority, due date, dept, assignee, notes, Mark complete + Reassign
- FAB: contextual "Add task"

---

### TIMELINE

**Hub card (168px) — FIRST MODULE on hub:**
- 3-track bar: Pre (amber) / Prod (violet) / Post (teal), 4px, independent fills
- Today marker: white 1.5px line + "today" label
- Delivery marker: red tick + dot cap, terminal phase only
- Milestone list: 3 rows, next milestone glows, delivery in red
- Add milestone row at bottom of card

**Full page (/timeline):**
- Calendar anchored top (flex-shrink 0), milestone list scrolls only
- Project/Master toggle in header (centered)
- Project active: project accent color tint + border
- Master active: neutral white
- Tap date → scroll milestone to top, brief highlight
- Master mode: per-project colored dots, tap date shows cross-project milestones
- Milestone detail sheet: title, date, phase, project (master), notes, crew chips, Save + Delete
- FAB: contextual "Add milestone"

---

### SCENEMAKER

**Hub card (140px row with Tone):**
- 4 states: shots+images / shots no images / scenes only / empty ("Make a Scene")
- NO plus FAB on filled states — FAB system handles adding

**Script page:**
- NO order toggle (Script only)
- Empty: "Write Now" (Courier) → new scene sheet
- Filled: Courier New, tap any text to inline edit
- FAB: "Add scene"

**Shotlist page:**
- Order toggle: Story / Shoot
- Scene slug dividers from Script (source of truth)
- Insert plus between every row → shot creation sheet
- Drag handle (≡) to reorder shots
- Single tap → detail sheet, long press → thread popup
- FAB: "Add shot"

**Storyboard page:** To be designed

---

### LOCATIONS / ART / CASTING
Mini-row on hub: 3 equal cards, icon + name + meta + 3px progress bar.
Full pages: to be designed.

### WORKFLOW
To be designed.

### CREW PANEL
Next feature to build. Full spec in CREW_PANEL_PROMPT.md — paste before starting.

### CHAT (replaces Resources as first-class module)
- Project-level open conversation, not tied to objects
- Threads FAB handles object-tied comments
- Documents belong in their contextual modules (script in SceneMaker, schedule in Timeline)
- FAB: "Compose message"

---

## POLISH (built)
1. Haptics — src/lib/utils/haptics.ts
2. Skeleton loaders — src/components/ui/Skeleton.tsx + HubSkeleton.tsx
3. Destructive confirmations — src/components/ui/DestructiveSheet.tsx
4. Keyboard behavior — src/lib/hooks/useKeyboardOffset.ts

---

## KEY FILES
- Hub: src/app/projects/[projectId]/page.tsx
- Selection: src/app/projects/page.tsx
- Login: src/app/page.tsx
- New Project: src/app/projects/new/page.tsx
- Hooks: src/lib/hooks/useOrbit.ts
- Phase utils: src/lib/utils/phase.ts (getProjectColor — mod 18)
- Shared header: src/components/ui/PageHeader.tsx
- App icons: public/icons/ (icon-192.png, icon-512.png, apple-touch-icon.png)
- Login BG: public/images/b21_bg.png

---

## SEED DATA

### Drifting timeline
Pre: Mar 1–Apr 16 2026 · Prod: Apr 17–May 1 · Post: May 2–May 20 · Delivery: May 20

### FRACTURE Scene 12 — EXT. RAVINE EDGE — DUSK
Characters: Lohm, Aleph
Story order: 12A–12J
Shoot order: 12D, 12E, 12F, 12B, 12C, 12G, 12A, 12H, 12I, 12J

### Crew
- Drifting: Clyde, Jordan R., Sam K., Mia T., Dev P.
- Astra Lumina: Clyde, Jordan R., Priya S., Lee W.
- Freehand: Clyde, Sam K., Marcus O., Yuki H.

---

## ROADMAP

### V1 (current)
- All hub modules
- Crew Panel
- Full pages for all modules
- Auth (Supabase Auth replacing localStorage)

### V2
- Google Calendar sync for Timeline milestones
- Push notifications (assigned task, due tomorrow, new comment)

### V3
- Slack channel sync per project

---

## REFERENCE FILES (outputs folder)
- ORBIT_HANDOFF_V4.md — this file (supersedes all previous versions)
- hub-centered-glow.html — centered hub design with glow bg
- hub-fab-concept.html — FAB system with branching options
- hub-add-options.html — add row options A/B comparison
- selection-screen.html — selection screen with long press sheet
- action-items-states.html — hub card both states
- action-items-full.html — full page
- timeline-states.html — hub card both states
- timeline-full.html — full page with master calendar
- scenemaker-states.html — all 4 hub states
- scenemaker-script.html — Script page
- scenemaker-shotlist.html — Shotlist page

---

## REFERENCE FILE PROTOCOL

### Where reference files live
All approved design reference HTML files must be saved to `~/Desktop/orbit/reference/` so Claude Code can access them directly.

### At the end of every planning session
Download all new HTML files from the planning chat outputs and place them in `~/Desktop/orbit/reference/`. Then tell Claude Code:
```
Reference files are in ~/Desktop/orbit/reference/. Read them before implementing.
```

### Current reference files to have on disk
- `hub-centered-glow.html` — centered hub layout with glow background
- `hub-fab-concept.html` — FAB branching system with side FABs
- `hub-add-options.html` — add row options
- `selection-screen.html` — selection screen with slate cards + long press sheet
- `action-items-states.html` — hub card empty + filled states
- `action-items-full.html` — full Action Items page
- `timeline-states.html` — hub card empty + filled states
- `timeline-full.html` — full Timeline page with master calendar
- `scenemaker-states.html` — all 4 SceneMaker hub states
- `scenemaker-script.html` — Script page
- `scenemaker-shotlist.html` — Shotlist page

### If reference files are missing
If a reference file can't be found, implement from the spec in this handoff document. All visual behavior, measurements, colors, and animation details are fully documented here. Do not guess — if something is unclear, ask before implementing.

---

## HUB VISUAL UPDATE — April 2026

### Background glow
- Full-height vertical center glow in project accent color
- Tapers: narrow at top, wider toward bottom
- Bright only at center spine, fades hard to black on both sides
- Runs behind everything including the header — no boundary
- Implementation (three stacked radial ellipses + edge darkening):
```css
background:
  radial-gradient(ellipse 20% 25% at 50% 0%, rgba(accent-bright, 0.08) 0%, transparent 100%),
  radial-gradient(ellipse 35% 45% at 50% 40%, rgba(accent-bright, 0.07) 0%, transparent 100%),
  radial-gradient(ellipse 50% 55% at 50% 90%, rgba(accent, 0.09) 0%, transparent 100%),
  linear-gradient(90deg, #04040a 0%, #04040a 8%, rgba(4,4,10,0.5) 30%, transparent 50%, rgba(4,4,10,0.5) 70%, #04040a 92%, #04040a 100%);
```
- accent = getProjectColor(projectId), accent-bright = slightly lighter version
- Lives at phone/page level z-index:0, covers full height

### Transparent header
- Topbar background: transparent
- No border-bottom on topbar
- Glow strip shows through header uninterrupted
- Header content floats on the background

### Frosted glass panels
- All module cards: background:rgba(10,10,18,0.42), backdrop-filter:blur(16px), border:1px solid rgba(255,255,255,0.07)
- Images and color swatches stay fully opaque
- Glow bleeds through panels subtly

### Module headers — no icons
- Icons removed from all module headers
- Header is purely typographic: Name + chevron on centered row, meta subtitle below
- Format: `Module Name ›` / `meta subtitle`

### Hub module structure
1. Timeline
2. Action Items
3. Creative (section header, no icon) grouping:
   - SceneMaker + Tone (50/50 split)
   - Locations / Art / Casting (mini-row)
- No add task / add milestone rows on cards — FAB handles all creation

### Glassmorphism FAB
- Main: background:rgba(accent,0.15), backdrop-filter:blur(16px), border:1.5px solid rgba(accent,0.45), box-shadow:0 4px 24px rgba(accent,0.25) + inset highlight
- Side FABs: same glass treatment, 34px
- All use project accent color

### Selection screen additions
- Centered layout: title + subtitle centered, logout top-right
- Client name on each slate below project name (DM Mono muted small)
- Slate grid centered horizontally
- New Project tile: below grid, standalone centered — NOT in the 2x2 grid
- 5-branch FAB: Tasks / Milestones / Schedule / Threads / Activity
- Activity branch opens notification sheet (see selection-fab-concept.html)

---

## SCENEMAKER — COMPLETE SPEC (April 2026)

### Header (all three modes)
- Client name: DM Mono muted uppercase small, centered
- Project name: Manrope 800 1.2rem, centered (largest element)
- Shot/scene count: DM Mono muted small, centered below project name
- Mode toggle: Script / Shotlist / Storyboard — centered pill toggle
- Version pill: right-aligned on same row as Story/Shoot order toggle
- Story/Shoot order toggle: centered (Shotlist and Storyboard only, not Script)
- Divider line below all header controls

---

### SCRIPT MODE

**Layout:** Pure text editor feel. Courier New throughout. Tap anywhere to place cursor and type. No sheets, no modals — everything happens inline in the document.

**Screenplay elements:**
- Slug line: uppercase bold, scene number badge (temp-shift color) left of slug text
- Action: Courier, text2 color, 1.7 line-height
- Character name: centered, uppercase, scene accent color
- Dialogue: centered, indented ~14% each side, text2 color

**Inline editing:** Tap any element → cursor appears, edit in place, tap away to commit.

**FAB branches: Add Scene / Add Action / Add Dialogue**
- Add Scene → cursor jumps to new slug line at insertion point, formatted uppercase
- Add Action → cursor jumps to new action paragraph
- Add Dialogue → inline 3-step flow:
  1. Character name field (centered uppercase) — type name
  2. Enter → drops to dialogue text (centered, indented) — type line
  3. Enter → returns to action mode
  No sheets. All inline. Script stays focused.

---

### SHOTLIST MODE

**Story order:**
- Scene dividers: scene number (temp-shift color, large DM Mono) + Courier slug text, drag handle left
- Chevron on each scene header, collapsed by default
- Shots grouped under correct scene — scene number determines letter prefix (12A, 12B...)
- Shot rows: drag handle (≡) left, shot ID large (DM Mono, scene color), description wraps naturally, thumbnail RIGHT
- Insert plus between every row
- Drag shots between scenes → renumbers by position within new scene
- Drag scene header → brings all shots, scenes renumber

**Shoot order:**
- Scene dividers replaced by Day 01, Day 02... dividers
- Shot IDs stay fixed (12A stays 12A regardless of day)
- Add shoot date button at top
- Drag shots between days
- V2: ties into day-of scheduling

**Shot detail sheet (tap shot):**
- Shot ID + description in header
- Type pills (MCU / MS / WS / ECU / POV etc) — tappable
- Lens pills (35mm / 50mm / 85mm etc) — tappable
- Movement pills (Static / Handheld etc) — tappable
- Notes textarea (editable)
- Tap thumbnail anywhere → image upload (syncs to storyboard)
- Save + Delete shot

**FAB branches (story order): New Scene / New Shot**
**FAB branches (shoot order): New Day / New Shot**

---

### STORYBOARD MODE

**Layout:** 3-column grid of glassmorphic cards. Flows continuously — no scene dividers. Scene color on shot number and card border tint is the only scene indicator.

**Board card:**
- Glassmorphism: rgba(10,10,18,0.42) + blur(16px) + rgba(255,255,255,0.07) border
- 16:9 image top, no inset
- Shot number top-left overlay (DM Mono, scene temp-shift color, dark pill bg)
- Description below, 2-line clamp
- Scene 12 cards get subtle accent border tint (rgba(accent, 0.18))
- Comment badge top-right if threads exist

**Tap card → detail sheet:**
- Large 16:9 image — tap anywhere to upload/replace (syncs to shotlist thumbnail)
- Shot ID + scene slug in header
- Editable description textarea — "↕ syncs with shotlist" note below
- Save + Delete board

**Drag to reorder:** Long press → drag. Order syncs bidirectionally with shotlist story order.

**FAB branches: Add Board / Add Scene**
- Add Board → blank detail sheet slides up: upload zone + description field
- Add Scene → slug input sheet slides up

---

### SCENE COLOR SYSTEM — TEMPERATURE SHIFT

Scene numbers and shot IDs in SceneMaker use a temperature shift palette that progresses as the film progresses. This is SEPARATE from project accent colors — it only appears inside SceneMaker.

- Early scenes: warm amber → #e8a020
- Mid scenes: orange-rose → #e87060
- Late scenes: cool violet → #c45adc

The shift is gradual and linear across the total scene count. A 20-scene film travels the full warm→cool arc. Generated with: `getSceneColor(sceneNumber, totalScenes)` → interpolates between #e8a020 and #c45adc through #e87060.

This color applies to:
- Scene number badge in script and shotlist
- Scene slug text (at 70-80% opacity)
- Shot ID text in shotlist and storyboard
- Scene divider line in shotlist

---

## GLOBAL FAB SYSTEM — LOCKED RULES

These rules apply to every page in the app. Do not deviate.

### FAB position
- **Main FAB:** `bottom: 68px` from phone bottom, horizontally centered
- This gives the Docs pill space below and clears the home indicator
- This position is IDENTICAL on every page — hub, all module pages, SceneMaker modes
- Use a shared src/components/ui/FAB.tsx component imported by all pages

### Back chevron position (closed state)
- Floats to the left of the Chat FAB
- Position: `translate(calc(-50% - 128px), -50%)` from FAB center
- Size: 28px circle, same glassmorphism treatment as side FABs but slightly smaller
- On FAB open: slides off-screen left (`translateX(-400px)`, opacity 0)
- On FAB close: springs back in

### Chat and Threads (closed state)
- Both hidden behind main FAB (opacity 0, position centered)
- On FAB open: Chat slides to `translate(calc(-50% - 78px), -50%)`, Threads to `translate(calc(-50% + 78px), -50%)`

### Docs pill (always present when FAB opens)
- Position: `top: 34px` below FAB center, `translateX(-50%) translateY(0)` when open
- Start: `translateY(8px)`, opacity 0
- End: `translateY(0)`, opacity 1 (0.08s delay)
- Tapping opens docs sheet for that module
- Appears on EVERY page when FAB opens — including Hub
- Must have visible space below it — FAB at bottom:68px ensures this

### Branch options (per-page, 2 or 3 branches)
- Fan upward in a tight semi-circle just above the FAB
- 2 branches: left `(left:-64px, bottom:21px)` and right `(left:22px, bottom:21px)`
- 3 branches: left `(left:-90px, bottom:22px)`, center `(left:-22px, bottom:72px)`, right `(left:46px, bottom:22px)`
- SVG branch lines connect FAB origin to each option endpoint
- Spring animation: cubic-bezier(0.34,1.56,0.64,1), stagger center 0.05s

### FAB glassmorphism
- Main: `background:rgba(accent,0.15)`, `backdrop-filter:blur(16px)`, `border:1.5px solid rgba(accent,0.45)`, `box-shadow:0 4px 20px rgba(accent,0.25), inset 0 1px 0 rgba(255,255,255,0.1)`
- Side FABs: `background:rgba(accent,0.08)`, `backdrop-filter:blur(12px)`, `border:1px solid rgba(accent,0.2)`
- All use project accent color (changes per project)

### Contextual branch options per page
| Page | Left | Center | Right |
|---|---|---|---|
| Hub | Action (amber) | Milestone (accent) | Creative (blue-violet) |
Note: Hub FAB — Chat on LEFT, Threads on RIGHT. No Resources FAB.
| Action Items | — | Add Task | — |
| Timeline | — | Add Milestone | — |
| SceneMaker Script | Add Scene (amber) | Add Action (blue-violet) | Add Dialogue (accent) |
| SceneMaker Shotlist Story | Add Scene (amber) | — | Add Shot (accent) |
| SceneMaker Shotlist Shoot | Add Day (amber) | — | Add Shot (accent) |
| SceneMaker Storyboard | Add Board (amber) | — | Add Scene (accent) |
| Locations | — | Add Location | — |
| Casting | — | Add Cast Member | — |
| Crew | — | Add Crew Member | — |
