# Hub Variant Explorations

Four full-fidelity Hub references, each exploring a different interpretation of Back to One's "cinematic / film-industry-native" aesthetic. Open in any browser at 358px width (phone-frame). Designed to be compared side-by-side to pick a winning visual language.

## How to view

Open all four files at once in browser tabs:

```
open hub-variant-a-grading-suite.html
open hub-variant-b-paperwork.html
open hub-variant-c-cinema-house.html
open hub-variant-d-glass-house.html
```

Or double-click each in Finder.

## The four directions

| Variant | Register | Personality |
|---|---|---|
| A — Grading Suite | DaVinci Resolve / Baselight / scope panels | "Run by people who measure things." Quiet, austere, instrumentation-forward. |
| B — Production Paperwork | call sheets, slate boards, Movie Magic stripboards | "Made by people who keep the show running." Functional, type-led, paperwork-honest. |
| C — Cinema House | Steenbeck, dailies, projection-booth amber | "Made by people who fell in love with movies." Warm, editorial, slightly emotional. |
| D — Glass House | colorist's HUD over the reference monitor; cinematic glassmorphism | "Pro tools should also be beautiful." Modern, tactile, depth-rich. |

## Accent stress-test row

Every variant has a strip across the top showing the same hub layout previewed under 4 different project accents (violet, amber, teal, coral). The design must hold up across all 18 project accents — any variant that only works in one hue is disqualified.

## Light interactivity

Each variant supports:
- Hover/active states on rows, cards, and FAB
- Tap a card → drawer slides in (demo open/close)
- FAB expand/collapse on click
- One signature autoplay loop per variant (described in the variant file)

This is demo-level only — no data, no routing, no state machines.

## Selection — outcome

The four directions converged into a hybrid — **Variant E ("Cinema Glass")** — combining the depth and tactility of Glass House (D) with the instrumentation-forward calm of Grading Suite (A) and the editorial warmth of Cinema House (C).

During the convergence round, Variant E grew well past the Hub: it now covers **every shipped surface in Back to One**, including Login, Project Selection, Folder Open, Archive, all project-side pages (Hub, Timeline / Master / Days, Budget, Action Items, Threads, Chat, Script, Shotlist, Storyboard, Tone, Locations, Casting, Crew, Timecards, Art / Wardrobe / HMU, Inventory, Workflow, Resources) and their detail / overlay sheets. It also adds:

- A **Theme Toggle** (pill at the top of the gallery) flipping the entire gallery between Dark and Light themes — Light is a warm cinema-paper beige; project accents stay vivid in both.
- A **BRAND LANGUAGE KEY** panel with typography samples, treatment swatches, status pill rows, the schema-accurate Departments grid (with icons), and the 18-color project palette stress test.

The mockups are content-accurate to the live app — the same labels, the same buttons, the same affordances. They are a **visual** spec, not a content spec.

The winner has been promoted to:

- `apps/back-to-one/reference/hub-full-preview-v2.html` — canonical visual reference for every surface (carries the visual-only banner that governs porting rules)
- `docs/DESIGN_LANGUAGE.md` — distilled written spec
- `BRAND_TOKENS.md` — completed reserved sections (typography scale, project accents, UI greys, status hexes, themes)
- Tag `design-locked-2026-05-01` — frozen snapshot of the gallery; anything that changes after this is post-spec iteration.

The four exploration files (A–D) are kept in this folder as historical record of the divergent round. The pre-distillation Hub reference is preserved at `apps/back-to-one/reference/archive/hub-full-preview.html`.

Spec of record: `docs/superpowers/specs/2026-04-25-back-to-one-design-language-design.md`.
