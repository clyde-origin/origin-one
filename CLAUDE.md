# Origin One — Monorepo

What's in your mind should be what ends up in the world.

Three apps. One shared backend. One schema. One login.

Last updated: April 24, 2026

---

## Apps

- `apps/back-to-one` — Next.js 14 PWA. Full production OS. **Active development.**
- `apps/one-arc` — Stub only. Script, shotlist, board. Planned, not yet built as standalone.
- `apps/one-lore` — Stub only. World-building and lore. Planned, not yet built.
- `apps/api` — Shared backend. All three apps talk to this.

## The One-Way Rule

Apps import from packages. Packages never import from apps.
Apps never import from each other. This rule is never broken.

## packages/schema is sacred

Do not change schema types without a dedicated PR.
A schema change affects all three apps simultaneously.
All three apps must compile after any schema change before it merges.

## Active work

Only `apps/back-to-one` is in active development.
Do not add features to one-arc or one-lore.
Do not create files in stub app folders beyond CLAUDE.md and README.md.

## Build order

Back to One → One Arc → One Lore
This order is intentional and non-negotiable.

## Current build focus — sequence to Auth

Each feature is a complete arc (schema PR → seed update if needed → UI PR → merge) before the next begins. No batched schema days, no batched UI passes. Main stays green at every stop.

**Phase 1A milestone** lands when Script drag-reorder and FAB safe-area rollout ship.

**After 1A, in sequence:** Location cleanup → Location parent/child UI → Storage discipline PR → Location images → Department enum conversion → PropSourced (schema then UI) → WardrobeSourced (schema then UI) → InventoryItem (schema then page then hub preview) → Crew Profile v2 (schema → avatars bucket → UI) → Auth.

**Anchor:** The resolve to complete the project effectively and efficiently. No fixed calendar date for Auth or first dogfood. First dogfood (Tyler + Kelly) happens when the app does what they'd do on a real production day — every surface honest, the data real enough to think with. Auth lands when it's right, not when the calendar says.

See `BUILD_STATUS.md` for feature-by-feature status and decisions locked on each (PropSourced 1:1 with Entity, lift-and-break on `metadata.status`, auth-check RLS template for new buckets, InventoryItem ImportSource scope).

## The Four Questions

Every decision gets tested against these:
1. Does this reduce friction?
2. Does this protect vision?
3. Does this bring the team closer to a unified workflow?
4. Is it proven on a real production before it ships to anyone else?

## Tech stack

Next.js 14, TypeScript, Tailwind CSS, Supabase, Framer Motion, React Query, Zod, React Hook Form.
Deployed on Vercel. Turborepo + pnpm monorepo. Prisma for DB layer.
Auth: Supabase native (not Clerk — see DECISIONS.md).

## Reference files

All HTML design prototypes are in `apps/back-to-one/reference/`.
Read the relevant reference HTML before building any page or component.
The reference file is the spec. Match it exactly unless there is a documented reason not to.

## Movielabs OMC alignment

Back to One's core schema expresses the Movielabs Ontology for Media Creation (OMC) v2.8 **Narrative/Production split**:

- `Entity(type='character')` = Narrative Character → `Cast` = Portrayal ✅ live
- `Entity(type='location')` = Narrative Location → `Location` = Depiction ✅ live (parent/child UI upcoming)
- `Entity(type='prop')` = Narrative Prop → `PropSourced` = Depiction ⬜ upcoming
- `Entity(type='wardrobe')` = Narrative Wardrobe → `WardrobeSourced` = Depiction ⬜ upcoming

This alignment is deliberate and foundational. When making schema decisions involving narrative elements or their production-side pairings, use OMC terminology in PR descriptions and inline code comments to preserve ontological legibility.

**Do not let OMC alignment drive speculative schema work.** The rule stands: if a real production needs it, model it. OMC vocabulary alignment is for documentation clarity, not schema expansion. See `MOVIELABS_ALIGNMENT.md` for the schema-to-OMC mapping.

## Schema discipline

1. Schema changes require a **dedicated PR**. Never bundle with features.
2. Each feature is a complete arc: schema PR → `prisma generate` → seed update if needed → all-three-apps compile → UI PR → merge. Then next feature.
3. Use `--create-only` on `prisma migrate dev` when a migration might touch unexpected state (drift detection).
4. Regenerate Prisma client after schema changes before running seed: `pnpm --filter @origin-one/db prisma generate`.
5. Apps compile check across all three (`pnpm -w build`) before merging any schema PR.
6. Migrations land on feature branches, never on main directly.
7. `git fetch origin` before any branch-pointer operation referencing remote tracking refs.

## Storage discipline

Supabase Storage buckets and RLS policies live in Prisma migrations, not as manual SQL scripts. If a fresh environment can't recreate the full database + storage state from one command, the environment isn't reproducible.

New buckets ship with `auth.role() = 'authenticated'` RLS checks from day one. The pre-existing permissive `moodboard` and `storyboard` policies are a known open door — tightened on Auth day alongside table RLS.

## North Star

When decisions get hard: What's in your mind should be what ends up in the world.
Everything else is friction.
