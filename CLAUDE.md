# Origin One — Monorepo

What's in your mind should be what ends up in the world.

Three apps. One shared backend. One schema. One login.

Last updated: April 22, 2026

---

## Read before you start

Every Claude Code session should skim these first. They exist so you don't
reconstruct the architecture and rediscover the same bugs every session.

- **`SCHEMA.md`** — Consolidated schema reference. Polymorphic patterns,
  14 threadable types, canonical department list, entity routing. The
  source of truth is `packages/db/prisma/schema.prisma`; this file is the
  curated view.
- **`GOTCHAS.md`** — Hard-won operational rules. Prisma client regeneration,
  Supabase pooler config, policy syntax, Figma plugin quirks. Read before
  touching migrations, seeds, or the DB.
- **`DECISIONS.md`** — Architectural and strategic decisions with rationale.
  Before relitigating any call, read this.
- **`BUILD_STATUS.md`** — Current state of the build. Updated at the end of
  every Claude Code session.
- **`BRAND_TOKENS.md`** — Visual identity tokens. Colors, typography,
  spacing, motion.

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

See `SCHEMA.md` for the current state. See `DECISIONS.md` → "Schema changes
require a dedicated PR" for the rule itself.

## Active work

Only `apps/back-to-one` is in active development.
Do not add features to one-arc or one-lore.
Do not create files in stub app folders beyond CLAUDE.md and README.md.

## Build order

Back to One → One Arc → One Lore
This order is intentional and non-negotiable.

## Current build focus

Phase 1A completion. Remaining: PR #2c detail sheet thread wiring, Chat,
Deliverables page, Crew timecards, Script drag-reorder, FAB safe-area rollout.
Auth and Settings are deferred until Phase 1A is complete. See
`BUILD_STATUS.md` for current state.

## The Four Questions

Every decision gets tested against these:
1. Does this reduce friction?
2. Does this protect vision?
3. Does this bring the team closer to a unified workflow?
4. Is it proven on a real production before it ships to anyone else?

## Tech stack

Next.js 14, TypeScript, Tailwind CSS, Supabase (Postgres + RLS), Prisma ORM,
Framer Motion, React Query, Zod, React Hook Form. Turborepo + pnpm monorepo.
Deployed on Vercel at backtoone.app.
Auth: Supabase native (not Clerk — see `DECISIONS.md`).

## Reference files

All HTML design prototypes are in `apps/back-to-one/reference/`.
Read the relevant reference HTML before building any page or component.
The reference file is the spec. Match it exactly unless there is a
documented reason not to.

## North Star

When decisions get hard: What's in your mind should be what ends up in the world.
Everything else is friction.
