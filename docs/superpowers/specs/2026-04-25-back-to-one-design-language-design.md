# Back to One — Design Language Exploration

**Status:** Spec
**Date:** 2026-04-25
**Owner:** Clyde (clydebessey@gmail.com)
**Surface under exploration:** Hub (`apps/back-to-one/reference/hub-full-preview.html`)

---

## Goal

Establish a unique, professional, cinematic design language for Back to One — discovered through divergent visual exploration on a single high-stakes surface (the Hub), then crystallized into a written language doc that every future feature PR conforms to.

The driving constraint: the visual identity in `BRAND_TOKENS.md` is partial. Only the Thread System is canonical; phase tokens, project accents, UI greys, status hexes, and typography are still marked "reserved for subsequent migration PRs." Screens look slightly different from each other because the scaffolding is incomplete. This work completes that scaffolding — but discovered, not theorized.

The North Star ("What's in your mind should be what ends up in the world") and the Four Questions from `CLAUDE.md` apply throughout.

## Non-goals

- Wiring tokens into Tailwind (a future, separate PR).
- Changing built React components (happens naturally as the feature sequence touches each surface).
- Other surfaces — Project Selection, Threads, Crew, etc. The Hub is the test bed; the winning *language* applies everywhere later.
- Sound design, haptics, copywriting voice — possible future phases.
- Pausing or reordering the active feature sequence (Phase 1A close → Location → Props → Wardrobe → Inventory → Crew Profile v2 → Auth → Dogfood). This work runs in parallel and produces artifacts only.

## Why this fits the project's discipline

- **Mirrors the schema-PR pattern.** Each piece is a complete arc, dedicated PR, no batching.
- **Mirrors the reference-HTML-as-spec pattern.** This project already treats reference HTMLs as the source of truth; we extend that pattern rather than replacing it.
- **Artifact-only.** No `apps/back-to-one/src/` changes. No active feature branches affected. Active sequence keeps moving.

## Aesthetic direction

**Cinematic / film-industry-native.** A tool that looks like it was made *by* people who shoot, not just *for* them. The existing hub already leans this way (`#04040a` background, Geist Mono labels, phase-glow gradients, blur'd cards) — the foundation is solid. Each variant pushes a different *interpretation* of that direction so the comparison reveals what the brand actually is.

---

## Process — divergent then converge

### Phase 1 — Exploration

Build **four** complete hub-page reference HTMLs. Each is a full-fidelity hub, comparable in scope to `hub-full-preview.html`. Each interprets "cinematic / film-industry-native" through a different lens. Self-contained, single-file, no build step.

### Phase 2 — Selection

Open all four side-by-side in a browser. Pick a winner — or call out elements to hybridize, which triggers a second exploration round (not a failure mode). Pick is judged against the success criteria below.

### Phase 3 — Distillation

Read the winning HTML carefully and extract its rules into:

- `docs/DESIGN_LANGUAGE.md` — written spec.
- Completed sections in `BRAND_TOKENS.md` — phase tokens, project accents, UI greys, status hexes, typography scale.
- A canonical `apps/back-to-one/reference/hub-full-preview-v2.html` — the winner, promoted. Old `hub-full-preview.html` archived (not deleted).

Distillation extracts: color tokens used, typography (sizes, weights, spacing, line-heights), motion (easings, durations, signature interactions), surface treatments (glass thickness, glow falloff, grain, density), and voice/personality with do/don't pairs.

The doc must be concrete enough that a future feature PR (e.g., the upcoming Inventory page) can be built to it without re-explaining the language each time.

---

## The four variants

All four share the foundation: dark background, Geist Sans + Geist Mono, blur'd cards, phase semantics (pre `#e8a020` / prod `#6470f3` / post `#00b894`), 20px sheet border-radius, mobile-first 358px-width PWA layout. They differ in *interpretation*.

### Variant A — "Grading Suite"

**Reference register:** DaVinci Resolve, Baselight, Premiere's color page. A senior colorist's tool at 2 AM.

- **Palette.** Deeper, more neutral charcoals. Background pushed quieter — `#020205` with a faint cool bias. Color is surgical: phase accents appear as small saturated dots in a sea of grey.
- **Typography.** Geist Sans tight (0.78–0.92 line-height on display). Geist Mono everywhere a number, label, or status appears. Tight letter-spacing. No flourish.
- **Density.** Forward. Compact list rows, more rows on screen. Calm because it's uniform, not because it's empty.
- **Motion.** Near-imperceptible. Short, near-linear easings. No bounces. Hover lifts ≤2px.
- **Signature element.** Monospaced **status rail** at the top of every card — tick marks, count, last-update timestamp. Reads as instrumentation, not decoration.
- **Personality.** "This tool is run by people who measure things." Quiet, deeply pro, slightly austere.
- **Signature autoplay loop.** Status-rail tick marks pulse like a scope refresh every few seconds.

### Variant B — "Production Paperwork"

**Reference register:** call sheets, slate boards, script supervisor's notes, Movie Magic Scheduling stripboards. The 1st AD's clipboard, digitized faithfully.

- **Palette.** Background still dark; content surfaces feel paper-like with slightly warmer near-whites and more contrast. Phase color appears as **stripboard bars** down the left side of cards. Project accent reserved for the project header only — the rest of the hub is monochrome with phase stripes.
- **Typography.** Geist Mono is the **dominant** voice (not the accent). Section headers in mono caps with letterspacing. Body in Geist Sans, used sparingly. Numbers and timecodes feel typed on a script supervisor's machine.
- **Density.** Mid. Cards look like printed forms — clear rule lines, rows that read like a stripboard or call sheet entry.
- **Motion.** Mechanical. Row tap "punches in" with a tiny hold-and-release — like a keystroke. Phase pills feel like vinyl strip tabs being moved.
- **Signature element.** Every card has a **slate header** — small mono ID, scene/setup number, timestamp at the top, formatted like the slate at the start of a take.
- **Personality.** "Made by people who actually keep the show running." Functional, not styled. Industry paperwork that's been thought about.
- **Signature autoplay loop.** A row periodically "punches in" with the keystroke hold-and-release.

### Variant C — "Cinema House"

**Reference register:** the inside of a Steenbeck, late-night dailies, projection-booth amber light, the warmth of the medium. Why we make movies.

- **Palette.** Background warms slightly — `#0a0608` with an almost imperceptible amber bias. Cards have a barely-there film-grain texture (~2% noise). Active surface gets a soft projector-glow halo. Phase colors stay correct but feel projected — slight bloom at edges.
- **Typography.** Editorial. Geist Sans with more breath — generous line-height on titles, bigger weight contrast between headings and body. Mono labels still present but smaller, more chamber-music than military.
- **Density.** Slightly more spacious. Cards have more air. Hub feels less like a control panel, more like a beautifully laid-out contact sheet.
- **Motion.** Filmic. Longer, more curved easings (cubic-bezier with overshoot on entrance). Cards "fade up" with the rhythm of a slow dissolve. Phase changes feel like a reel change — a brief flash of projector light.
- **Signature element.** **Aspect ratio as composition.** Crew avatars, project thumbnails, and image surfaces use 2.39:1 or 1.85:1 framing as deliberate visual rhythm. Cards have hairline letterbox bars at top/bottom — barely visible, but there.
- **Personality.** "Made by people who fell in love with movies." Warm, confident, slightly emotional.
- **Signature autoplay loop.** A soft projector-glow flicker passes through the active card on a slow loop.

### Variant D — "Glass House"

**Reference register:** a colorist's floating HUD, projection-booth glass, the slate read through the lens. High-end glassmorphism — informed by film, not by visionOS sterility.

- **Palette.** Background stays dark; cards are **thick frosted glass panes** with depth — heavy backdrop-blur (24–32px), subtle inner glow, hairline white border at top edge that catches "light." Slight chromatic aberration at card edges (1px cyan/red split) so the glass feels optical, not flat.
- **Typography.** Geist Sans with confident weight contrast. Type sits *on* the glass, not in it — slight text shadow gives the impression of etching. Mono labels in a softer grey, almost ghosted.
- **Density.** Mid — glass needs room to breathe or it loses depth.
- **Motion.** Glass *shifts*. On scroll, foreground glass moves slightly faster than background glow (parallax). Tap triggers a brief refraction ripple through the card. Phase changes pulse the inner glow.
- **Signature element.** **Layered z-axis.** Header pane in front, modules in mid-glass, project accent glow behind everything. Depth feels real on a 2D screen — floating slates over a projector beam.
- **Personality.** "Pro tools should also be beautiful." Modern, slightly futuristic, deeply tactile. Where A is austere and B is functional, D is seductive.
- **Signature autoplay loop.** Refraction ripple travels across the glass on page load, then on idle every ~10s.

---

## Universal rules (apply to every variant)

### Accent diversity

The design language must work with **all 18 project accents** plus the three phase colors, with no preference for any specific hue. The hub takes whichever accent is selected on Project Selection — the variant must look great with violet, muted earth-tone, vivid coral, forest green, etc.

**Stress test:** every variant HTML includes an **accent stress-test row** at the top — a small swatch strip showing the same hub layout previewed under 4 different project accents (e.g. violet, amber, teal, coral). Any variant that only sings under one hue is disqualified.

### Light interactivity

Motion described in prose isn't evaluable. Each HTML wires a baseline of light interactivity so the variant can be *felt*, not just read:

- Hover/active states on rows, cards, FAB.
- Tap a card → drawer slides in (open/close demo).
- FAB expand/collapse animation runs on click.
- One signature autoplay loop showing the variant's distinctive motion (described per-variant above).

This is **demo-level interactivity** only. No data, no routing, no state machines. Enough to judge the motion vocabulary, nothing more.

### Self-contained

Each HTML is a single file with inline `<style>`. No external CSS, no JS frameworks, no build step. Vanilla JS for interactivity. Matches the existing reference-HTML pattern.

---

## Deliverables

### Phase 1 (exploration)

```
apps/back-to-one/reference/explorations/
  README.md                            ← how to view, the four directions, accent stress-test legend
  hub-variant-a-grading-suite.html
  hub-variant-b-paperwork.html
  hub-variant-c-cinema-house.html
  hub-variant-d-glass-house.html
```

### Phase 2 (after winner picked)

```
docs/DESIGN_LANGUAGE.md                ← written spec of the winning language
BRAND_TOKENS.md                        ← completed sections (typography, phase, project, UI greys, status)
apps/back-to-one/reference/
  hub-full-preview-v2.html             ← winning variant promoted to canonical
  archive/hub-full-preview.html        ← old reference archived (not deleted)
```

---

## Success criteria for picking the winner

1. **It survives a day.** First reactions can mislead. The winner still feels right when revisited after some time has passed.
2. **It works with all 18 accents.** Verified via the stress-test row on each variant.
3. **It's describable.** The winning variant can be turned into rules in a doc. If the choice is "I dunno, it just feels right" without articulable reasons, the doc won't be writable and future PRs won't conform.
4. **It survives the Four Questions** from `CLAUDE.md`: reduces friction, protects vision, brings the team toward a unified workflow, could survive a real production day.
5. **It feels honest.** Made *by* film people, not styled to look like it. Tyler/Kelly should feel it's theirs the moment they see it.

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| All four variants feel close to current — no real divergence | The four axes are deliberately distinct registers (tool-pro / paperwork-pro / cinema-pro / glass-pro). If a variant ends up indistinguishable from the existing hub, it's a build problem, not a design problem — re-do that variant. |
| User can't pick a winner — likes pieces of multiple | Expected. Trigger one hybrid round combining the favorite elements. Not a failure. |
| Variant is beautiful with one accent, breaks with another | The stress-test row catches this. Disqualifies the variant unless rebalanced. |
| Distillation produces a doc too vague to enforce | Doc must contain concrete tokens, sizes, easings, and at least one do/don't pair per section. If a future PR can't tell whether it conforms, the doc is incomplete. |
| Scope creep into other surfaces during exploration | Hub-only. If a variant idea requires a non-hub surface to demonstrate, defer it — it'll be addressed when the language applies later. |
| Token wiring into Tailwind gets confused with this work | Out of scope. This produces docs and reference HTMLs only. Token wiring is a future, separate PR. |

---

## What "done" looks like for this spec

When the implementation plan derived from this spec is fully executed:

- Four hub variant HTMLs exist in `apps/back-to-one/reference/explorations/`, each with accent stress test and signature motion.
- A winner is picked (possibly after a hybrid round).
- `docs/DESIGN_LANGUAGE.md` is committed and describes the language with enough specificity that any future feature PR can conform without re-explanation.
- `BRAND_TOKENS.md` "reserved for subsequent migration PRs" sections are filled in.
- `hub-full-preview-v2.html` exists as the canonical reference; old version archived.
- Active feature sequence (Phase 1A close → Auth → Dogfood) is unaffected throughout.
