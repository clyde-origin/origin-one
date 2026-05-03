# Origin One — Design Language

The North Star treatment for all surfaces. Implementation-ready reference.

- **Spec source**: `apps/back-to-one/reference/explorations/hub-variant-e-cinema-glass.html` (locked)
- **Live**: https://gallery-theta-amber.vercel.app
- **Tokens**: see `BRAND_TOKENS.md` for hex / RGB / type scale values

---

## When to use which treatment

### Sheen+Extrusion Title — primary identity heading

White spotlight at the top, fading through accent-glow to accent to
accent-at-78%. Drop-shadowed for extrusion.

Use on:
- Page titles (Crew, Locations, Workflow, Action Items, Inventory…)
- Detail-sheet titles (Casting Locked, Riley Tan, Aperture 600d)
- Section dividers (PRODUCTION, CAMERA, PROPS)
- Calendar / month headers (April 2026)
- Active tab text
- Project Selection card titles

NOT used for: eyebrows, body text, mono labels, timestamps, inactive UI.

In **light mode** the gradient is replaced with solid `var(--fg)` (sepia)
because the white spotlight reads worse than a clean sepia against beige.

### Glass Card — frosted accent surface

Stacked: project-tinted vertical gradient over neutral dark scrim, blurred,
inset top highlight, accent-tinted outer glow. Used everywhere a card needs
to feel like a tile of frosted accent glass.

Use on:
- Project tiles, crew cards, location cards, art cards
- Detail-sheet meta cards
- Calendar cards, brand-key panel, FAB cluster
- Workflow nodes, inventory chips

### Letterbox bars — cinematic frame

2px black bars top + bottom on cards (`.card`, `.sm-card`, `.tone-card`,
`.cast-card-image`, `.thread-thumb`).

Heavy variant: 6px on detail-sheet 16:9 hero images (`.detail-hero`,
`.loc-image-hero`).

Always above content (`z-index: 5`). The frame-within-frame is the cinema
identity — letterbox the content, not the chrome.

### FAB Cluster — back · chat · + · inbox · book

Anchored bottom: 14px on every authenticated content phone. Glass
backing + accent glow + inset top highlight. The center "+" button gets
a stronger accent tint and a subtle scale-up to mark it as primary.

The FAB cluster *is* the primary navigation. Back lives here, not at the
top of the screen. Chat / inbox lives here, not in a header bell.

---

## Page header pattern

```
[ai-header] = h1 (sheen-title) + meta-row (project name + phase pill)
```

- No date stamp.
- No back button at top — back lives in FAB cluster.
- Phase pill is the **only** chip in the meta row.

```html
<div class="ai-header">
  <h1 class="ai-title">Crew</h1>
  <div class="ai-meta-row">
    <span class="ai-meta-name">The Weave</span>
    <span class="ai-meta-pill prod"><span class="phase-dot"></span>Production</span>
  </div>
</div>
```

---

## Overlay sheet pattern

Every detail sheet uses the same anatomy.

```
[overlay-parent dimmed by overlay-scrim] + [overlay-sheet at bottom]
```

- Sheet height: **660px** (or auto for floating panels — see below).
- Top corners: 24px radius, bottom corners flush with phone frame.
- Drag handle at top.
- Padding: 18 / 14 / 88 (top / sides / bottom — bottom leaves room for FAB).
- Scrim: `rgba(0,0,0,0.55)` over the parent, blur 4px.

### Floating panel variant — Archive, Folder Open

- `top: 200px`, `left/right: 16px`
- All four corners rounded (not just top)
- `max-height: 520px`
- Used for ephemeral selections that aren't a primary surface

---

## Theme: Dark vs Light

**Dark** (default) — cinematic. Background `#07070b`. Card backings dark
neutral. Per-project accent reads vivid against the void.

**Light** (opt-in via `body.light-mode`) — warm beige cinema paper. Page
bg `#ebe2cd`, surface cream `rgba(248, 240, 220, 0.85)`, fg deep sepia
`#1f160a`. Per-project accent stays vivid in both modes.

Sheen titles collapse to solid sepia in light mode. Active tab text
becomes solid `var(--accent)`.

---

## Departments (12)

Each department has a fixed accent. The accent travels with the department
across crew cards, dept filter pills, and action-items dept groupings.

| Department  | Accent     | Icon                       |
|-------------|------------|----------------------------|
| Direction   | `#c45adc`  | clapperboard frame         |
| Production  | `#e8a020`  | binder / clipboard         |
| Writing     | `#9b6ef3`  | quill / pen                |
| Camera      | `#6470f3`  | camera body + lens         |
| G&E         | `#e8c44a`  | bulb / power               |
| Sound       | `#22d4d4`  | mic                        |
| Art         | `#f08030`  | paint stroke               |
| Wardrobe    | `#e868c8`  | hanger                     |
| HMU         | `#50d898`  | brush / palette            |
| Locations   | `#3cbe6a`  | pin                        |
| Post        | `#a8d428`  | scissors / cut             |
| Other       | `#7a7a82`  | dot grid                   |

Department accent never overrides project accent — they coexist on the
same card. The crew card's outer glow uses `--proj-rgb`; the avatar fill
uses `--dept-rgb`.

---

## Phase pills + status pills

### Phase pill (canonical template)

```html
<span class="ai-meta-pill pre|prod|post">
  <span class="phase-dot"></span>Pre-Prod|Production|Post-Prod
</span>
```

- Dot: `width: 5px; height: 5px;` filled with the phase hex, `box-shadow: 0 0 4px <hex>`
- Bg: phase-rgb @ 0.20
- Border: phase-rgb @ 0.50
- Text: phase hex, mono, uppercase, 0.06em tracking

Used on: page header meta row, project tile (slate-card), gantt section.

### Status pill (canonical template)

Same chip pattern as phase pill but with the per-domain status hex
(see `BRAND_TOKENS.md` Status Palettes).

```html
<span class="status-pill needed|ordered|arrived|packed|returned">Needed</span>
```

- Bg: status-rgb @ 0.10
- Border: status-rgb @ 0.22
- Text: status hex @ 0.9, mono, uppercase

Used on: inventory rows, location cards, prop cards, wardrobe cards,
HMU cards, action item rows.

---

## Project tile pattern

Three layers stacked top-to-bottom inside a glass card:

1. **Color stripe** — 4px tall, full-width, `background: var(--accent)`. Top edge of card.
2. **Brand eyebrow** — client name, mono caps, 0.36rem, color `var(--fg-mono)`.
3. **Sheen title** — project name, sheen+extrusion treatment, 0.84rem 700.
4. **Type label** — `Narrative | Commercial | Music Video | Doc`, mono caps.
5. **Phase pill** — bottom-right corner of card.
6. **Next event row** — calendar icon + date · name (or "Just created" placeholder).

Cards are **1:1 squares** in the project selection grid (3 columns).

---

## Folder pattern

Folders are projects-grouped-by-client. Visually rendered as a manila
folder silhouette.

- SVG path: paper rectangle with a tab cut at the top-left
- Tab width: **70%** of card width (asymmetric — file-folder feel)
- Tab height: 14px
- Folder fill: `rgba(var(--proj-rgb), 0.18)` over the dark phone bg
- Border: `rgba(var(--proj-rgb), 0.32)` 1px
- Inside the open state: 2x2 grid of contained slate-cards (mini variant)

Open state uses the floating-panel overlay pattern.

---

## Tab nav

Inactive tab: mono caps, `var(--fg-mono)`, 0.36rem.

Active tab:
- Same size, but **sheen+extrusion title** treatment on the text
- 1px solid accent underline at the bottom of the tab cell
- Glow: `box-shadow: 0 -2px 12px -4px rgba(var(--accent-rgb), 0.45)` from below

Tab row sits flush with the page header, full-bleed on the phone width.

Used by: Action Items (Me / Dept), Threads (Unread / Recent / Resolved),
Chat (Channels / Direct), Art (Props / Wardrobe / HMU), Timeline (Master / Days),
Crew (List / Timecards), Casting (in-progress tabs).

---

## Filter pill rows

`.dept-pill` row sits below the tab nav on filterable lists.

Two variants:

### Plain text+count (Crew page roles)

```
[All · 13]  [Director · 1]  [Producer · 2]  [Coordinator · 1]  [Writer · 1]  [Crew · 8]
```

Mono caps, 0.36rem, count separated by middle dot. Active pill has accent
text + accent border at 0.32 alpha.

### Icon-stacked-above-label (Action Items dept filter)

```
[ icon ]   [ icon ]   [ icon ]
 Camera    Sound       Art
   4         3           2
```

Vertical stack inside the pill: dept icon (12px) + dept name (mono, 0.34rem)
+ count (mono, 0.36rem 600). Each pill carries `--dept-rgb`; active pill
gets the dept color treatment (bg @ 0.18, border @ 0.50).

---

## Loading skeleton

Shimmer animation on placeholder rectangles.

```css
animation: sk-shimmer 2.2s linear infinite;
```

- Linear (not ease) — feels like a film leader, not a UI bounce
- 2.2s — slow enough to register as "in motion" without feeling jittery
- Same shimmer hex stack in both themes (warmer alpha in light mode)

Skeleton blocks should match the silhouette of the loaded UI. Don't
display a generic spinner or a centered loader — show the page's bones.

---

## What this design language is NOT

- Not a Tailwind config (yet) — token consumption is inline CSS custom
  properties; Tailwind wiring is a follow-up PR.
- Not opinionated about routing — visual treatment only.
- Not a component library spec — this is the visual contract; component
  APIs live in `packages/ui` and `apps/back-to-one/src/components/`.

---

## North Star

What's in your mind should be what ends up in the world. The cinema-glass
treatment exists to make the production OS feel like the production
itself: framed, lit, cut, cinematic. Every surface earns its weight.
