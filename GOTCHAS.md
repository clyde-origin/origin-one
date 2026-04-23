# Origin One — Gotchas

Hard-won rules. Each one cost time the first time it was discovered. The
point of this file is to never pay that cost twice.

Read this before starting any Claude Code session that touches Prisma,
Supabase, migrations, or the Figma plugin.

Last updated: April 22, 2026

---

## Prisma

### Regenerate the client after any schema change — before seeding

```bash
pnpm --filter @origin-one/db prisma generate
```

**Why it matters:** `db:seed` runs `deleteMany` before the inserts that
reference the new field. If the client is stale, `deleteMany` succeeds, the
inserts fail on the unknown field, and you're sitting on a wiped database
with a failed seed.

**Discovered:** April 19, 2026. Wiped local DB.
**Rule:** Generate before seed. Every time. Build the habit.

### Prisma defaults are client-level only

`@default(uuid())`, `@default(now())`, `@updatedAt` — Prisma applies these
in the Prisma client, not in Postgres. They do nothing for inserts that
bypass the client (PostgREST, raw SQL, Supabase Studio).

**Fix:** Add DB-level defaults via `ALTER TABLE`:

```sql
ALTER TABLE "Thread" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Thread" ALTER COLUMN "createdAt" SET DEFAULT now();
```

This is a schema migration. Dedicated PR.

### Prisma migrations live in `packages/db/`

Not in `apps/back-to-one/`. Always scope migration commands to the package:

```bash
pnpm --filter @origin-one/db prisma migrate dev
pnpm --filter @origin-one/db prisma migrate deploy
```

Running them at the app level either fails or (worse) writes migration files
to the wrong directory.

### `0_init` baseline — never run against an empty DB

The live DB was baselined Apr 19, 2026. `0_init` contains the full schema as
it existed that day. It is marked applied but is **incorrect to execute**.

New environments: restore from a DB dump or apply the full migration history
from scratch. Do not use `prisma migrate dev` to bootstrap a fresh copy.

### Drift — reconcile before migrating on top of it

If `prisma migrate diff` (or any other signal) shows the live DB out of sync
with `schema.prisma`:

1. Stop.
2. `prisma db pull` to reconcile `schema.prisma` to DB state.
3. Review the diff. Intentional? Merge it. Unintentional? Generate a
   migration to fix the DB.
4. Only then apply new migrations.

**Never** layer a new migration on top of unacknowledged drift. It compounds
the problem and makes future debugging catastrophically worse.

---

## Supabase / Postgres

### Use the session pooler (port 5432), not the transaction pooler

For **both** `DATABASE_URL` and `DIRECT_URL`:

```
postgresql://postgres.<projectref>:<password>@aws-0-us-west-2.pooler.supabase.com:5432/postgres
```

- Username format: `postgres.<projectref>` (e.g. `postgres.sgnjlzcffaptwzxtbefp`)
- Host: `aws-0-us-west-2.pooler.supabase.com`
- **Port: 5432** (session pooler)
- Do **not** use port 6543 (transaction pooler) — it rejects the
  `postgres.<projectref>` username format for this project.

**Discovered:** April 20, 2026. Hours lost.

### `CREATE POLICY IF NOT EXISTS` is not valid Postgres

Unlike tables and indexes, policies don't support `IF NOT EXISTS`. Use the
idempotent pattern:

```sql
DROP POLICY IF EXISTS "policy_name" ON "table_name";
CREATE POLICY "policy_name" ON "table_name" ...;
```

Safe to run repeatedly. Won't error on first run or re-run.

### Prisma is canonical — no Supabase Studio schema edits

All schema changes go through `prisma migrate dev` → commit →
`prisma migrate deploy`. No direct edits in Supabase Studio. No ad-hoc SQL
files in `apps/back-to-one/supabase/migrations/`.

The cost of parallel migration systems already materialized — months of
drift between `schema.prisma` and the live DB, fields in the DB that Prisma
didn't know about. Never again.

---

## Figma Plugin (MCP)

### Plugin code must return a promise explicitly

Async without a returned promise produces blank frames. Always use:

```javascript
return (async () => {
  // your code here
})();
```

Not:

```javascript
// WRONG — produces blank frames
(async () => {
  // ...
})();
```

### Figma file reference

- Account: originpoint.io
- planKey: `team::1608020014199735211`
- Origin One deck file key: `aNyE2cT7EEUiZfYsQgkAnK`

---

## Seed Data

### Hoist cross-project crew to global scope

Post editors, GFX artists, and other people who realistically work across
multiple productions at the same studio (e.g. Rafi Torres, Cleo Strand) are
declared **once at global scope** in the seed, then assigned to multiple
projects.

When a new project needs post crew, extend the global declarations — don't
re-declare inside the project block.

### After a schema change, regenerate before re-seeding

See Prisma → Regenerate the client. Same rule, doubly important here —
seeds touch every table.

---

## Web Research / Competitor Work

Direct URL fetching with `html_extraction_method: markdown` is more reliable
than name-based search for competitor research.

For full coverage, fetch:
- Root domain
- `/pricing`
- `/help` or `/docs`

Name-based search often returns aggregator pages or stale marketing copy.

---

## How to Add to This File

New rule gets added the moment it costs time. Format:

```
### Short imperative rule title

One-paragraph explanation of the rule and why.

**Discovered:** Date.
**Why it matters:** What broke / what it cost.
**Fix / rule:** What to do instead.
```

Don't wait until you have five more rules. One at a time, as they come up.
The discipline is: if it cost you an hour, it costs the next person an hour
too unless it's written down.
