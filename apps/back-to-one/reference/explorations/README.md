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

The four directions converged into a hybrid — **Variant E ("Cinema Glass")** — combining the depth and tactility of Glass House (D) with the instrumentation-forward calm of Grading Suite (A) and the editorial warmth of Cinema House (C). Variant E expanded beyond the Hub during the convergence round to cover Action Items, Threads, Locations, Crew, and Timeline as well, providing one consistent visual vocabulary for the surfaces around the Hub.

The winner has been promoted to:

- `apps/back-to-one/reference/hub-full-preview-v2.html` — canonical visual reference (carries the visual-only banner that governs porting rules)
- `docs/DESIGN_LANGUAGE.md` — distilled written spec
- `BRAND_TOKENS.md` — completed reserved sections (typography scale, project accents, UI greys, status hexes)

The four exploration files (A–D) are kept in this folder as historical record of the divergent round. The pre-distillation Hub reference is preserved at `apps/back-to-one/reference/archive/hub-full-preview.html`.

Spec of record: `docs/superpowers/specs/2026-04-25-back-to-one-design-language-design.md`.
