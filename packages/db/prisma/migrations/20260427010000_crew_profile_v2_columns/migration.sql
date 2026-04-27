-- Crew Profile v2 (#20) — adds phone/notes/skills columns.
-- Pure additive migration. No data migration needed; existing rows get
-- the column defaults (NULL for nullable, empty array for skills).
--
-- Split between User and ProjectMember per BUILD_STATUS Apr 24 lock:
--   User.phone — global (the person's number; follows them across projects)
--   ProjectMember.notes — project-scoped (production-relevant context can
--                          differ between roles, e.g. "DP this project,
--                          Director the next")
--   ProjectMember.skills — project-scoped (relevant skills for this role
--                           on this project; Postgres TEXT[] for native
--                           array queries)

-- ─── User.phone ───────────────────────────────────────────────────────────
ALTER TABLE "User" ADD COLUMN "phone" TEXT;

-- ─── ProjectMember.notes + skills ─────────────────────────────────────────
ALTER TABLE "ProjectMember" ADD COLUMN "notes" TEXT;

-- skills is TEXT[] (Postgres native array). DEFAULT '{}' so existing rows
-- get an empty array rather than NULL — matches the Prisma schema's
-- @default([]) and avoids null-vs-empty edge cases in app code.
ALTER TABLE "ProjectMember" ADD COLUMN "skills" TEXT[] NOT NULL DEFAULT '{}';
