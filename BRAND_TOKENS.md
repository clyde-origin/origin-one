# Origin One — Brand Tokens

Single source of truth for the brand's color, gradient, and typography tokens.

The full brand-token migration (phase accents, project accents, UI greys, status
hexes, typography scale) is a separate follow-up. This file is created now so
the Thread System has a canonical home — tokens here are imported and consumed
directly, not re-derived.

---

## Thread System

Thread colors are **fixed** — they are never project-derived, never phase-derived.
A thread looks the same in every project, on every screen, across every app.

### Core palette

| Token     | Hex       | Use                                                            |
|-----------|-----------|----------------------------------------------------------------|
| `TV`      | `#7C3AED` | Thread violet — primary thread color. Icons, CTAs, read dots.  |
| `TA`      | `#F59E0B` | Thread amber — unread state. Badges, pulse, unread dots.       |
| `TA_DEEP` | `#D97706` | Unread badge background — higher-contrast amber for count pill. |

### Usage rules

- **Unread state** → `TA` (dot, left rail, border tint). `TA_DEEP` for count
  badge backgrounds where higher contrast against `#080808` is needed.
- **Read state** → `TV` (icon fill, small presence dot, send-reply chevron).
- **Resolved state** → muted white (`rgba(255,255,255,0.22)`) — no thread color.
- **Never** mix thread colors with project accents. A thread surface uses
  thread tokens only. A project surface uses project tokens only. They share no
  pixels.

### Object/chip accents (per attachment type)

These color threads by what they're attached to — shot threads look different
from location threads. Non-phase accents only (amber / indigo / teal are
reserved for Pre / Prod / Post phase semantics).

| Chip key            | Hex       | Meaning               |
|---------------------|-----------|-----------------------|
| `obj-shot`          | `#9b6ef3` | violet                |
| `obj-scene`         | `#b890f0` | lavender              |
| `obj-location`      | `#3cbe6a` | green                 |
| `obj-character`     | `#e8507a` | rose                  |
| `obj-cast`          | `#f07050` | coral                 |
| `obj-crew`          | `#6888b8` | slate                 |
| `obj-prop`          | `#f08030` | orange                |
| `obj-wardrobe`      | `#e868c8` | pink                  |
| `obj-hmu`           | `#50d898` | mint                  |
| `obj-moodboardRef`  | `#e8e0d0` | warm white            |
| `obj-actionItem`    | `#e8c44a` | gold                  |
| `obj-milestone`     | `#22d4d4` | cyan                  |
| `obj-deliverable`   | `#e84848` | red                   |
| `obj-workflowStage` | `#a8d428` | lime                  |
| `obj-inventoryItem` | `#3a98c8` | cerulean              |
| `obj-budgetLine`    | `#34d399` | emerald               |

Chip pattern: `bg = base @ 0.10 alpha`, `border = base @ 0.22`, `color = base @ 0.9`.

### TypeScript export

Canonical values live at `apps/back-to-one/src/lib/thread-tokens.ts`. Every
surface that renders thread UI imports from there — no inline hex literals.

---

## Inventory Item Status

Inventory items move through a five-state production lifecycle:
needed → ordered → arrived → packed → returned. The status colors
intentionally reuse the phase palette where the meaning is parallel,
plus a standalone red for `needed`.

### Status palette

| Token             | Hex       | Phase reuse | Meaning                            |
|-------------------|-----------|-------------|------------------------------------|
| `STATUS_NEEDED`   | `#e84848` | none        | Not yet sourced. Action required.  |
| `STATUS_ORDERED`  | `#e8a020` | = pre amber | Sourced, in transit or on order.   |
| `STATUS_ARRIVED`  | `#4ab8e8` | none (sky)  | Received, awaiting pack.           |
| `STATUS_PACKED`   | `#6470f3` | = prod indigo | On-truck, ready for production.  |
| `STATUS_RETURNED` | `#00b894` | = post teal | Wrapped and returned to source.    |

### Phase color reuse rule

Phase colors (amber / indigo / teal) are reserved for Pre / Prod / Post
phase semantics globally. Inventory item status is the **only sanctioned
exception** to that rule, and only for these three reuses:

- `ordered` reuses pre-amber — an ordered item is in pre-production motion
- `packed` reuses prod-indigo — a packed item is production-ready
- `returned` reuses post-teal — a returned item has wrapped

No other surface may reuse phase colors for non-phase semantics. Any
future status palette must use non-phase hex values or propose a
parallel justification PR.

### Chip pattern

Match the thread chip pattern: `bg = base @ 0.10 alpha`,
`border = base @ 0.22`, `color = base @ 0.9`.

### Convention

Inventory pages may inline these hex values directly per the Locations /
Art precedent (see `locations/page.tsx:21-26`, `art/page.tsx:41-46`).
TypeScript export to a shared tokens file is deferred until a second
surface needs the same palette.

---

## Project Accent Palette (18 options)

Each project picks one accent from this fixed palette. The accent drives
card edge glow, project-tile color, header sheen, and per-page identity
hints. Defined as RGB triplets so they compose into `rgba()` for surface
washes, glows, borders, and dot fills.

Spec source: gallery `stress-row` row, `apps/back-to-one/reference/explorations/hub-variant-e-cinema-glass.html`.

| #  | Name    | Accent (Hex) | Accent RGB     | Glow RGB        | Notes                               |
|----|---------|--------------|----------------|-----------------|-------------------------------------|
| 1  | Violet  | `#c45adc`    | 196, 90, 220   | 216, 124, 236   | The Weave's accent in seed; gallery default |
| 2  | Plum    | `#82488c`    | 130, 72, 140   | 158, 108, 168   | Deeper purple, low-saturation       |
| 3  | Magenta | `#dc46b4`    | 220, 70, 180   | 236, 108, 200   |                                     |
| 4  | Pink    | `#f578aa`    | 245, 120, 170  | 252, 156, 196   |                                     |
| 5  | Rose    | `#c8788c`    | 200, 120, 140  | 220, 156, 172   | Muted, dusty rose                   |
| 6  | Crimson | `#c83246`    | 200, 50, 70    | 232, 92, 108    |                                     |
| 7  | Coral   | `#f07050`    | 240, 112, 80   | 248, 144, 112   |                                     |
| 8  | Orange  | `#f59628`    | 245, 150, 40   | 252, 180, 84    |                                     |
| 9  | Amber   | `#ebac1e`    | 235, 172, 30   | 252, 196, 72    | Distinct from `--phase-pre`         |
| 10 | Tan     | `#b89656`    | 184, 150, 86   | 212, 180, 124   | Warm neutral                        |
| 11 | Yellow  | `#f0d028`    | 240, 208, 40   | 248, 224, 84    |                                     |
| 12 | Olive   | `#7a8c2c`    | 122, 140, 44   | 158, 176, 80    |                                     |
| 13 | Lime    | `#a8d428`    | 168, 212, 40   | 196, 232, 84    |                                     |
| 14 | Forest  | `#2c8050`    | 44, 128, 80    | 84, 168, 120    | Deeper green                        |
| 15 | Teal    | `#00b894`    | 0, 184, 148    | 64, 212, 180    | Distinct from `--phase-post`        |
| 16 | Cyan    | `#28cad8`    | 40, 202, 216   | 92, 224, 236    |                                     |
| 17 | Blue    | `#3c8cf5`    | 60, 140, 245   | 120, 176, 252   |                                     |
| 18 | Indigo  | `#6464e6`    | 100, 100, 230  | 144, 144, 244   | Distinct from `--phase-prod`        |

### Convention

Set `--proj-rgb` and `--accent-glow-rgb` as inline custom properties on the
project root container; downstream rules compose with `rgba(var(--proj-rgb), <alpha>)`.
Sheen+extrusion title rules also expect `--accent` (hex) and `--accent-rgb`.

```css
.proj-the-weave {
  --proj-rgb: 196, 90, 220;
  --accent: #c45adc;
  --accent-rgb: 196, 90, 220;
  --accent-glow-rgb: 216, 124, 236;
}
```

---

## Phase Tokens

Production phase coloring. Reserved for the 3 phase pills + the gantt
segments — never used for project tinting (avoid color collision).

| Token          | Hex       | RGB             | Use                     |
|----------------|-----------|-----------------|-------------------------|
| `--phase-pre`  | `#e8a020` | 232, 160, 32    | Pre-production amber    |
| `--phase-prod` | `#6470f3` | 100, 112, 243   | Production indigo       |
| `--phase-post` | `#00b894` | 0, 184, 148     | Post-production teal    |

Phase pill chip pattern (matches thread chip): `bg = base @ 0.20`,
`border = base @ 0.50`, dot `box-shadow: 0 0 4px <hex>`.

Phase color reuse exception: only the inventory item status palette
(see Inventory section above) and the workflow-stage gantt segment may
reuse phase hexes. No other surface.

---

## Status Palettes (per domain)

### Inventory — 5-state pipeline

(Authoritative palette is in the Inventory Item Status section above.)
Visual summary:

| State    | Hex       | Visual         |
|----------|-----------|----------------|
| needed   | `#e84848` | red            |
| ordered  | `#e8a020` | amber          |
| arrived  | `#4ab8e8` | sky            |
| packed   | `#6470f3` | indigo         |
| returned | `#00b894` | teal           |

### Locations — 5-state

| State      | Hex       | Visual    | Meaning                  |
|------------|-----------|-----------|--------------------------|
| unscouted  | `#aaaab4` | gray      | Not yet visited          |
| scouting   | `#e8a020` | amber     | In active scouting       |
| in_talks   | `#6470f3` | indigo    | Negotiating with owner   |
| confirmed  | `#00b894` | teal      | Locked, paperwork done   |
| passed     | `#e84848` | red       | Considered then declined |

### Art — Props

| State   | Hex       | Visual | Meaning                   |
|---------|-----------|--------|---------------------------|
| needed  | `#e84848` | red    | Not yet sourced           |
| sourced | `#00b894` | teal   | Found / on order          |
| ready   | `#a8d428` | green  | On set, ready to shoot    |

Plus `isHero` badge: `#E07B39` orange — overlaid on prop card meta strip.

### Art — Wardrobe

| State   | Hex       | Visual  | Meaning                    |
|---------|-----------|---------|----------------------------|
| needed  | `#e84848` | red     | Not yet sourced            |
| sourced | `#00b894` | teal    | Found / on order           |
| fitted  | `#9b6ef3` | purple  | Talent fitting complete    |
| ready   | `#a8d428` | green   | On set, ready              |

### Art — HMU

| State     | Hex       | Visual  | Meaning                  |
|-----------|-----------|---------|--------------------------|
| needed    | `#e84848` | red     | Not yet sourced          |
| sourced   | `#00b894` | teal    | Found / on order         |
| confirmed | `#9b6ef3` | purple  | Look approved / locked   |

All status pills use the chip pattern: `bg = base @ 0.10`, `border = base @ 0.22`,
`color = base @ 0.9`.

---

## Department Palette (12 depts)

Per-department accent for crew cards, dept filter pills, action-items dept
groupings. Set as inline `--dept-rgb` on the surface; never overridden by
project accent (a department always reads as that department).

| Department  | Hex       | RGB           | Notes                        |
|-------------|-----------|---------------|------------------------------|
| Direction   | `#c45adc` | 196, 90, 220  | violet — director identity   |
| Production  | `#e8a020` | 232, 160, 32  | amber — producer / coord     |
| Writing     | `#9b6ef3` | 155, 110, 243 | lavender                     |
| Camera      | `#6470f3` | 100, 112, 243 | indigo                       |
| G&E         | `#e8c44a` | 232, 196, 74  | gold — gaffer / grip         |
| Sound       | `#22d4d4` | 34, 212, 212  | cyan                         |
| Art         | `#f08030` | 240, 128, 48  | orange                       |
| Wardrobe    | `#e868c8` | 232, 104, 200 | pink                         |
| HMU         | `#50d898` | 80, 216, 152  | mint                         |
| Locations   | `#3cbe6a` | 60, 190, 106  | green                        |
| Post        | `#a8d428` | 168, 212, 40  | lime                         |
| Other       | `#7a7a82` | 122, 122, 130 | neutral mono                 |

The role filter (Crew page) uses plain text+count, not dept icons —
roles aren't departments. Dept icons live with the dept-pill row only.

---

## Typography

### Font stack

- Body: **Geist Sans** (300 / 400 / 500 / 600 / 700 / 800)
- Labels & timestamps: **Geist Mono** (400 / 500 / 600)
- Display serif (login title only): **Cormorant Garamond** (400 / 500)

### Scale (rem, base 16px)

| Use                              | Size            | Weight   | Letter-spacing       |
|----------------------------------|-----------------|----------|----------------------|
| Hero / detail-name               | 1.05rem (~17px) | 700      | 0.02em               |
| Page title (`.ai-title`)         | 0.86rem (~14px) | 700      | 0.04em uppercase     |
| Section header (sheen)           | 0.84rem         | 700      | -0.01em              |
| Body row name                    | 0.66rem         | 500-600  | 0.005em              |
| Mono caps label                  | 0.36rem         | 500-600  | 0.10-0.22em uppercase|
| Tiny mono pill                   | 0.30-0.36rem    | 600-700  | 0.10em uppercase     |

The phone is rendered at 0.6 device-pixel scale in the gallery; rem values
above match what reads correctly at the gallery scale. When the visual
moves to a real device, ratios hold — multiply by the platform-correct
base if needed.

---

## Glass Card Pattern

Frosted glass card backing — used on `.card`, `.ai-list`, `.slate-card`,
`.crew-card`, `.cal-card`, `.wf-node`, `.inv-chip`, etc. Reusable formula:

```css
.glass-card {
  background:
    linear-gradient(180deg,
      rgba(var(--proj-rgb), 0.16) 0%,
      rgba(var(--proj-rgb), 0.08) 45%,
      rgba(var(--proj-rgb), 0.03) 100%),
    rgba(20, 20, 28, 0.55);
  backdrop-filter: blur(16px) saturate(135%);
  -webkit-backdrop-filter: blur(16px) saturate(135%);
  border: 1px solid rgba(var(--proj-rgb), 0.32);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 0 24px -8px rgba(var(--proj-rgb), 0.32),
    0 4px 20px -8px rgba(0, 0, 0, 0.55);
}
```

Per-domain variants change only the `--proj-rgb` source: `--dept-rgb` for
crew cards, `--tag-rgb` for workflow nodes. Everything else stays identical.

---

## Sheen+Extrusion Title

Used on page titles, section headers, detail names, active tabs, hero
treatments. Anything that's a "primary identity heading."

```css
.sheen-title {
  background: linear-gradient(180deg,
    rgba(255, 255, 255, 0.96) 0%,
    rgba(var(--accent-glow-rgb), 1) 32%,
    var(--accent) 55%,
    rgba(var(--accent-rgb), 0.78) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter:
    drop-shadow(0 1px 0 rgba(0, 0, 0, 0.45))
    drop-shadow(0 0 6px rgba(var(--accent-rgb), 0.22));
}
```

NOT used for: eyebrows, body text, mono labels, timestamps, inactive UI.
In light mode this gradient is replaced with solid `var(--fg)` (sepia).

---

## Light Mode (Beige Cinema Paper)

Opt-in via `body.light-mode`. Warm cinema-paper aesthetic — like aged
script stock or a darkroom development tray.

| Token                   | Light Value                                                          | Notes                                |
|-------------------------|----------------------------------------------------------------------|--------------------------------------|
| `--bg`                  | `#ebe2cd`                                                            | warm cream page bg                   |
| Page surface column     | `#c8bb9c` with deep-tannin gradient down the middle                  | atmospheric depth                    |
| `--surface`             | `rgba(248, 240, 220, 0.85)`                                          | card surface                         |
| `--border`              | `rgba(60, 38, 14, 0.14)`                                             | warm tannin                          |
| `--fg`                  | `#1f160a`                                                            | deep sepia                           |
| `--fg-mono`             | `#6a5840`                                                            | warm gray-brown                      |
| Phone bg                | `linear-gradient(180deg, #f5edd6 0%, #e6dab9 50%, #f5edd6 100%)`     | column variation for glass blur      |

Project accent tokens are **not** overridden in light mode — every project
keeps its full vivid accent against the beige base.

Sheen+extrusion title gradients are replaced with solid sepia (`var(--fg)`)
in light mode. Active tab text uses solid `var(--accent)`. The white
spotlight at the top of the dark-mode gradient disappears against beige
and reads worse than a clean sepia.

---

## Loading Skeleton

Shimmer pattern for skeleton placeholder rectangles.

```css
.sk-block {
  background: linear-gradient(90deg,
    rgba(255, 255, 255, 0.04) 0%,
    rgba(255, 255, 255, 0.10) 50%,
    rgba(255, 255, 255, 0.04) 100%);
  background-size: 200% 100%;
  animation: sk-shimmer 2.2s linear infinite;
  border-radius: 4px;
}

@keyframes sk-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

Light-mode shimmer warms the tint to `rgba(60, 38, 14, 0.06 / 0.14)`.

---

## Other sections

*Reserved for subsequent token migration PRs.* TypeScript export of project
accent / phase / department palettes is deferred until a second surface
needs a programmatic lookup (current usage is inline CSS custom properties).
