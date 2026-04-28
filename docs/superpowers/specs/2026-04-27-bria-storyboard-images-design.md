# Bria Storyboard Images — Design

**Date:** 2026-04-27
**Status:** Draft, awaiting user review
**Scope:** Generate pencil-sketch storyboard images for every seeded `Shot` using Bria.ai, sharing the client and prompt-shaper with a future in-app "regenerate storyboard" feature.

---

## Goal

Every seeded `Shot` gets a contextual storyboard frame on `pnpm db:seed` so the shotlist looks like real production planning. Same Bria call site is positioned to power an in-app "regenerate storyboard" button after Auth lands, with no architectural rework between the two consumers.

This explicitly reverses the "out of scope" line from `2026-04-27-seed-images-design.md`, which excluded per-shot storyboards as "disproportionate to the value." With Bria pricing at pay-as-you-go and the full seed costing under ~$5, the calculus changed.

## Non-goals

- Live image generation at runtime — the in-app integration is *designed for*, not built in this arc.
- Per-shot prompt overrides — `Shot.storyboardPromptOverride` is YAGNI until we see real bad frames in practice.
- Image-to-image refinement, character consistency models, or Bria's structured-prompt features.
- Replacing the existing OpenAI / Pexels clients.
- Modifying the `storyboard` Supabase bucket's permissive RLS posture (deferred to the #24 RLS pass with the other buckets).

---

## Locked decisions

1. **Shared Bria client** for seed (today) and in-app (future). One `bria.ts`, one `storyboard-prompt.ts`.
2. **Pencil/ink sketch style** — single hardcoded style suffix on every prompt, no per-project variation.
3. **Derive entries at fetch time** from shot rows in `seed.ts`. No manifest growth, no duplicated descriptions.
4. **Per-project aspect ratio** read from `Project.aspectRatio` (already in schema), with a UI prerequisite to actually plumb the field through 7 hardcoded `'16/9'` render sites.
5. **Prompt recipe C** — tone primer + scene description + framing word + shot description + style suffix.
6. **Bria direct, pay-as-you-go**, `api_token` header convention (literal `api_token`, not `Authorization: Bearer`), generate-then-fetch-image-URL two-hop pattern.
7. **`sharp` center-crop for 2.39:1** — Bria doesn't natively support that ratio; generate at 16:9, crop to 2.39:1 locally.
8. **Concurrency 3, retry 3 on transient errors, `--confirm-spend` gate** for the bulk run.

---

## Scope: three layers in one arc

### Layer 1 — Aspect-ratio plumbing (UI prerequisite)

`Project.aspectRatio` exists in the schema, is editable via `ProjectActionSheet`, and is stored — but is read nowhere downstream. Seven sites hardcode `'16/9'`:

- `apps/back-to-one/src/app/projects/[projectId]/scenemaker/page.tsx` lines 826, 865, 907, 934, 1092
- `apps/back-to-one/src/app/projects/[projectId]/scenemaker/components/ShotDetailSheet.tsx` line 101
- `apps/back-to-one/src/app/projects/[projectId]/scenemaker/components/PdfExport.tsx` line 195

Replace each with `aspectRatioToCss(project.aspectRatio)`, where the helper lives in **`apps/back-to-one/src/lib/aspect-ratio.ts`** (UI-side, not in `packages/db/`):

```ts
export function aspectRatioToCss(ratio: string | null | undefined): string {
  if (!ratio) return '16 / 9'
  const [w, h] = ratio.split(':')   // '2.39:1' → ['2.39', '1']
  return `${w} / ${h}`               //         → '2.39 / 1'
}
```

(The seed-side `briaAspect()` helper is a different function — it maps `Project.aspectRatio` to a value Bria's API accepts. It lives in `packages/db/src/seed-images/bria-aspect.ts`. Both helpers consume the same `Project.aspectRatio` strings but for different downstream consumers.)

Backfill `Project.aspectRatio` on the 6 seeded projects in `seed.ts`:

- P1 Simple Skin Promo → `16:9`
- P2 Full Send → `16:9`
- P3 In Vino Veritas → `16:9`
- P4 Flexibility Course A → `16:9`
- P5 Natural Order → `16:9`
- P6 The Weave → `2.39:1` (matches its tone primer's "anamorphic feel, 2.39:1 framing")

### Layer 2 — Bulk seed (the work)

A new surface in the existing fetch pipeline. The full architecture is in **Components** below.

### Layer 3 — In-app integration (designed, not built)

The pure-function boundary in Layer 2 is the deliverable here. No code is written for the in-app route in this arc — but the seed-side code is shaped so that when the in-app PR happens, it imports `bria.ts` and `storyboard-prompt.ts` unchanged and adds only Prisma + auth + upload glue.

---

## Architecture

```
packages/db/src/
├── seed-data/
│   └── shots.ts                    NEW — extracted from seed.ts; exports
│                                   the canonical (project, scene, shot)
│                                   triples for both the seed orchestrator
│                                   and the storyboard fetcher.
├── seed-images/
│   ├── clients/
│   │   ├── openai-images.ts        (existing)
│   │   ├── pexels.ts               (existing)
│   │   └── bria.ts                 NEW — generate(prompt, aspect) → bytes
│   ├── storyboard-prompt.ts        NEW — pure: (shot, scene, project, primer) → string
│   ├── shot-entries.ts             NEW — iterates seed-data/shots.ts to produce
│   │                               StoryboardEntry[] for the fetcher
│   ├── bria-aspect.ts              NEW — briaAspect('2.39:1') → '16:9' (with
│   │                               cropTarget hint), '16:9' → '16:9', etc.
│   │                               Lives here because only Bria callers need it.
│   ├── paths.ts                    + 'storyboard' added to Surface
│   │                               + 'storyboard' added to Bucket
│   ├── manifest.ts                 unchanged (no storyboard entries — derived)
│   ├── tone-primers.ts             unchanged
│   ├── uploader.ts                 unchanged
│   └── filter.ts                   unchanged
└── prisma/
    └── seed.ts                     imports from seed-data/shots.ts instead
                                    of inlining the arrays. Adds aspectRatio
                                    to each Project.create. Uploads
                                    storyboards via uploader.ts.
```

### Pure-function boundary

- **`bria.ts`** knows only Bria's HTTP API. No Prisma, no Supabase, no filesystem. Input: `{ prompt, aspectRatio }`. Output: `Buffer`.
- **`storyboard-prompt.ts`** knows only string composition. No Prisma, no Supabase. Input: `{ shot, scene, project, tonePrimer }` as plain objects. Output: prompt string.

Both are unit-testable without any external dependency. Both are re-imported by the future in-app route without modification.

### Data sharing between seed.ts and the fetch CLI

Today the shot arrays are inlined in `prisma/seed.ts`. To derive storyboard entries at fetch time without a database connection, they must be importable as plain TypeScript. Refactor:

- Move shot arrays to `packages/db/src/seed-data/shots.ts`. Same data, exported as typed const arrays keyed by project.
- Move scene metadata likewise to `packages/db/src/seed-data/scenes.ts` (so `Scene.description` is reachable).
- Add `aspectRatio` to `tone-primers.ts` (a `Record<ProjectKey, { primer: string; aspectRatio: string }>`) rather than introducing a parallel `seed-data/projects.ts`. The tone primer file is already the seed-side per-project metadata home; folding aspect ratio into it keeps related fields together.
- `prisma/seed.ts` imports shots and scenes from `seed-data/`, and reads `aspectRatio` from `tone-primers.ts` when constructing each `Project.create`.

This is a pure restructuring change with no logic change. Verify by running `db:seed` against a clean DB before and after — output rows should be identical.

### Storage layout

Bucket: `storyboard` (already exists, currently permissive RLS — see CLAUDE.md storage discipline note).

```
storyboard/<shotId>/<sceneNumber>-<shotNumber>.jpg
e.g. storyboard/abc-123/01-01A.jpg
```

Local mirror (committed to repo):

```
seed-images/files/storyboard/<projectKey>/<sceneNumber>-<shotNumber>.jpg
e.g. seed-images/files/storyboard/p1/01-01A.jpg
```

Local file count: 89. Average size: ~150–250 KB per pencil-sketch JPEG. Total committed bytes: ~15–25 MB, well within the existing seed-images budget pattern.

---

## Prompt recipe (Recipe C)

```
{tonePrimer}

Scene context: {scene.description}

Shot framing: {humanize(shot.size)}

Action: {shot.description}

Style: pencil storyboard sketch, loose ink lines, monochrome graphite,
hand-drawn, single panel, no text or numbers in the frame.
```

`humanize(shot.size)` mapping:

- `extreme_close_up` → "extreme close-up"
- `close_up` → "close-up"
- `medium_close_up` → "medium close-up"
- `medium` → "medium shot"
- `wide` → "wide shot"
- `full` → "full shot"
- `insert` → "insert shot"
- (null) → "" (omit the "Shot framing" line entirely)

### Worked example (P1 / scene 1 / shot 01A)

> Project: Lumière Skincare commercial — "Simple Skin Promo". Atmosphere: unhurried morning luxury. Soft window light through frosted glass. Calacatta marble, brushed brass, amber glass, glycerin-clean droplets. Skin as topography, not as catalog. Restraint over excess. Editorial beauty photography, magazine reference, never advertorial. Color: cream, ivory, brass, deep amber. Lens: medium, shallow. Mood: attention as luxury.
>
> Scene context: Bathroom. Marble surfaces, soft window light. The beginning of the day and the product.
>
> Shot framing: extreme close-up.
>
> Action: Fingers drawing a single drop from the bottle. The product in motion for the first time.
>
> Style: pencil storyboard sketch, loose ink lines, monochrome graphite, hand-drawn, single panel, no text or numbers in the frame.

### Why each piece earns its place

- **Tone primer** — scene-1 boards and scene-3 boards inherit shared light/material vocabulary, so the project reads coherently across all its boards.
- **Scene context** — every shot in scene 1 inherits "marble bathroom morning light" without repeating it per shot. Scene-level coherence is the level that matters when flipping through a scene's boards.
- **Framing** — gives Bria a real composition cue. Maps `Shot.size` enum cleanly.
- **Action** — the unmodified writer's voice goes straight to the model.
- **Style suffix** — hard-coded; storyboard convention from the visual-style decision.

---

## Bria client (`bria.ts`)

### Endpoint

```
POST https://engine.prod.bria-api.com/v2/image/generate
```

(Use Image Generate, not Image Generate Lite — quality matters more than throughput at 89 images one-time.)

### Request

```
Headers:
  api_token: ${BRIA_API_TOKEN}      ← literal "api_token", NOT "Authorization: Bearer"
  Content-Type: application/json

Body:
  {
    "prompt": "<assembled prompt>",
    "aspect_ratio": "16:9"           ← see briaAspect() below
  }
```

### Response

```
{
  "image_url": "https://...",        ← URL to fetch, not base64
  "structured_prompt": { ... }       ← discarded for now
}
```

The client makes a **second** HTTP call to `image_url` to get the bytes. Both hops share the retry policy.

### Aspect ratio mapping (`briaAspect`)

Bria supports natively: `1:1`, `16:9`, `9:16`, `4:5`, `3:2`.

| `Project.aspectRatio` | Bria request    | Post-processing                  |
|-----------------------|-----------------|----------------------------------|
| `16:9` (or null)      | `16:9`          | none                             |
| `9:16`                | `9:16`          | none                             |
| `1:1`                 | `1:1`           | none                             |
| `4:5`                 | `4:5`           | none                             |
| `3:2`                 | `3:2`           | none                             |
| `2.39:1`              | `16:9`          | `sharp` center-crop to 2.39:1    |
| `1.85:1`              | `16:9`          | `sharp` center-crop to 1.85:1    |

`sharp` is added as a `packages/db` devDependency if not already present.

### Retry

Mirror `uploader.ts`: 3 attempts, 2-second × attempt back-off. Retry only on transient: `5xx`, `gateway`, `network`, `timeout`. Hard-fail on `4xx` so a malformed prompt or expired token surfaces immediately rather than burning three attempts.

---

## Fetch CLI flow

`pnpm --filter @origin-one/db db:fetch-images` already supports `--only`, `--force`, `--dry-run`. Adding `'storyboard'` as a surface integrates with existing flags:

```
# Full storyboard run (gated by spend confirmation)
pnpm db:fetch-images --only=storyboard --confirm-spend

# Single project
pnpm db:fetch-images --only=storyboard.p1

# Single shot, force regeneration
pnpm db:fetch-images --only=storyboard.p1.01A --force

# Dry run (no API calls)
pnpm db:fetch-images --only=storyboard --dry-run
```

### Per-shot algorithm

1. Read `(project, scene, shot)` from `seed-data/shots.ts`.
2. Skip if `seed-images/files/storyboard/<projectKey>/<sceneNumber>-<shotNumber>.jpg` exists, unless `--force`.
3. Build prompt via `storyboard-prompt.ts`.
4. Resolve Bria aspect ratio via `briaAspect(project.aspectRatio)`.
5. Call `bria.generate({ prompt, aspectRatio })` → bytes.
6. If `project.aspectRatio` requires post-crop, apply `sharp.extract()`.
7. Write JPEG to disk.
8. Log: `[12/89] p1/01-01A → ok (4.2s)` or `→ fail: <reason>`.

### Concurrency

`p-limit(3)` by default, override with `--concurrency=N`. Sequential is too slow for 89 images; full parallel will hit Bria's unpublished rate limits.

### `--confirm-spend` gate

A bulk run on `storyboard` (alone or as part of a full `db:fetch-images` with no `--only`) prompts: `About to generate up to N storyboards via Bria (~$X estimated). Continue? [y/N]`. Single-shot runs (`--only=storyboard.p1.01A`) skip the gate. The exact dollar estimate is whatever Bria's per-image rate is at PAYG time — the CLI reads it from a `BRIA_PRICE_PER_IMAGE_USD` env var with a sensible default of `0.04`.

This protects against `--force` on the whole storyboard surface silently re-billing ~$5.

---

## Seed integration

`prisma/seed.ts` already calls `uploadSeedImage` for other surfaces. Add the same pattern for storyboards:

1. After all `Shot` rows exist, iterate through them.
2. For each shot, compute the local file path.
3. If the file exists on disk, upload via `uploader.ts` to `storyboard/<shotId>/<sceneNumber>-<shotNumber>.jpg`.
4. Update `Shot.imageUrl` to the public URL (matching the pattern from commit `5c664f4`: `seed: write full public URL for MoodboardRef.imageUrl`).
5. If the file is missing on disk, log a clear warning pointing to `db:fetch-images --only=storyboard.<projectKey>.<shotNumber>` to fetch it. Don't fail the seed — partial seed is fine, exists-on-disk is the source of truth.

---

## In-app integration (designed, not built)

For reference only — not in this arc. The seed-side code is shaped to make this PR mechanical.

**Route.** `apps/api/src/routes/shots/[id]/generate-storyboard.ts` (exact path TBD against actual `apps/api` conventions during the planning phase of that future arc).

**Behavior:**

1. Authn check (post-Auth: real session; pre-Auth: `readStoredViewerRole()` shim per existing producer-gating pattern).
2. Load `Shot + Scene + Project` via Prisma in one query with two joins.
3. Build prompt via `storyboard-prompt.ts` — same import the seed CLI uses.
4. Call `bria.ts` — same client, same retry policy.
5. Apply `sharp` post-crop if needed (same `briaAspect` mapping).
6. Upload to Supabase Storage at `storyboard/<shotId>/<filename>.jpg`.
7. Update `Shot.imageUrl`.
8. Return `{ imageUrl }`.

**UI surface.** A "Regenerate storyboard" action on the shot card / shot detail sheet — same `useFabAction` / ActionBar pattern as other producer actions. Optimistic React Query update.

**Failure modes.** Structured error codes returned to the UI: `RATE_LIMITED`, `BAD_PROMPT`, `BRIA_DOWN`, `STORAGE_FAIL`. No silent retries inside the route — let the user click again.

**What this future shape buys us today:** it forces `bria.ts` and `storyboard-prompt.ts` to be Prisma-free and Supabase-free pure modules right now. Without that constraint, the future PR would have to refactor them, and the seed-side and app-side would drift.

---

## Testing

### Unit (Vitest, on every commit)

- **`storyboard-prompt.test.ts`** — table-driven across a handful of `(shot, scene, project)` triples. Each asserts the assembled prompt contains the tone primer text, scene description text, the correct framing word, and the action text. Plain `expect(prompt).toContain(...)` — snapshot-style is overkill.
- **`bria.test.ts`** — mock `fetch`. Asserts:
  - Request URL is `https://engine.prod.bria-api.com/v2/image/generate`
  - Header is `api_token` (not `Authorization`)
  - Body has `prompt` and `aspect_ratio`
  - Response handling does the URL-then-bytes two-hop fetch
  - Retry triggers on 503/network errors and not on 400
- **`paths.test.ts`** — extend with `'storyboard'` cases for `bucketForSurface`.
- **`bria-aspect.test.ts`** (in `packages/db`) — `briaAspect('2.39:1') === { request: '16:9', crop: '2.39:1' }`, `briaAspect('16:9') === { request: '16:9', crop: null }`, `briaAspect(null) === { request: '16:9', crop: null }`, etc.
- **`aspect-ratio.test.ts`** (in `apps/back-to-one`) — `aspectRatioToCss('2.39:1') === '2.39 / 1'`, `aspectRatioToCss(null) === '16 / 9'`, etc.

### Smoke (manual, opt-in)

`pnpm db:fetch-images --only=storyboard --smoke` makes one real Bria call with a fixed prompt and asserts response shape. Costs one image (~$0.04). Verifies token, base URL, header format, response shape, and image-URL fetching all work end-to-end. Run before any full bulk run to catch a stale token without burning ~$5 on rate-limit failures.

### Integration (manual, the actual run)

1. `pnpm db:fetch-images --only=storyboard.p1 --concurrency=1` — one project sequentially. Eyeball the 14 frames. Iterate the prompt recipe if needed before fanning out.
2. `pnpm db:fetch-images --only=storyboard --confirm-spend` — full run, ~89 images, ~$3.56.
3. `pnpm db:seed` — uploads to Supabase, sets `Shot.imageUrl`. Verify in `apps/back-to-one`.

### No tests for the in-app route in this arc

That's a separate PR with its own tests.

---

## Risks and open questions

- **Bria pencil-sketch quality is unverified.** We don't actually know how good Bria's text-to-image is at pencil/ink storyboard style. Mitigation: the `--only=storyboard.p1 --concurrency=1` smoke loop in step 1 above is the gate. If frames look bad, iterate the style suffix (or fall back to a different model on the same client surface) before fanning out.
- **`Project.aspectRatio` is a free-form string.** Today the app's picker constrains it to a known set, but the schema allows anything. `briaAspect()` and `aspectRatioToCss()` handle null and unknown values defensively (default to 16:9).
- **2.39:1 cropping loses ~33% vertical pixel area.** Bria at 16:9 base resolution has enough resolution that the cropped 2.39:1 output is still acceptable for storyboard-quality reference, but worth eyeballing on the smoke run.
- **Retrying on a Bria URL fetch failure** (the second hop) requires re-doing the generate call too, since Bria's hosted URLs may not be permanent. The retry wrapper handles this by treating the whole `generate-then-fetch` as one attempt.
- **`seed-data/shots.ts` extraction touches `seed.ts`.** This is a refactor inside the same arc as the storyboard work. Per the schema discipline rule, schema changes need a dedicated PR — but this is not a schema change, just a code reorganization. Acceptable to bundle. Verified by diffing `db:seed` output before/after.
- **No test for `--confirm-spend`.** It's interactive. Acceptable; not a meaningful regression risk.

---

## Implementation sequence (for the planning skill)

This spec hands off to `writing-plans`. The plan will detail step-by-step, but the rough sequence:

1. Add `BRIA_API_TOKEN` to `.env.example` *(done as part of design)*.
2. Refactor: extract `seed-data/shots.ts`, `seed-data/scenes.ts`. Add `aspectRatio` to `tone-primers.ts`. Verify `db:seed` output unchanged.
3. Backfill `Project.aspectRatio` in seed (P1–P5 → `16:9`, P6 → `2.39:1`).
4. Plumb `Project.aspectRatio` through the 7 hardcoded UI sites; add `apps/back-to-one/src/lib/aspect-ratio.ts` helper.
5. Add `'storyboard'` to `paths.ts` Surface and Bucket types; update `bucketForSurface`.
6. Build `bria.ts` client with unit tests.
7. Build `storyboard-prompt.ts` with unit tests.
8. Build `shot-entries.ts` deriver.
9. Wire the storyboard surface into the fetch CLI (`--only=storyboard`, `--confirm-spend`, `--smoke`).
10. Smoke run, then P1 visual gate, then full run.
11. Add storyboard upload to `prisma/seed.ts`.
12. Run `db:seed` end-to-end. Verify in app.
13. Commit `seed-images/files/storyboard/` to the repo.
