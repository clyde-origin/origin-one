# Origin One — Monorepo

Three apps. One shared backend. One schema. One login.

## Apps
- `apps/back-to-one` — Next.js PWA + Electron. Full production OS. Active development.
- `apps/one-arc` — Next.js. Script, shotlist, board. Planned, not yet built.
- `apps/one-lore` — Next.js. World-building and lore. Planned, not yet built.
- `apps/api` — Shared backend. All three apps talk to this.

## The One-Way Rule
Apps import from packages. Packages never import from apps.
Apps never import from each other. This rule is never broken.

## packages/schema is sacred
Do not change schema types without a dedicated PR.
A schema change affects all three apps simultaneously.

## Active work
Only apps/back-to-one is in active development.
Do not add features to one-arc or one-lore.
Do not create files in stub app folders beyond CLAUDE.md and README.md.

## Build order
Back to One → One Arc → One Lore
This order is intentional and non-negotiable.
