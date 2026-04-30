-- ScheduleBlock — Arc A of the Daily Schedule + Call Sheets feature.
-- See docs/superpowers/specs/2026-04-30-daily-schedule-and-call-sheets-design.md
--
-- Note: existing tables in this codebase store ids as TEXT with
-- `(gen_random_uuid())::text` defaults. FK columns must be TEXT to match.

CREATE TYPE "ScheduleBlockTrack" AS ENUM ('main', 'secondary', 'tertiary');

CREATE TYPE "ScheduleBlockKind" AS ENUM (
  'work',
  'load_in',
  'talent_call',
  'lunch',
  'wrap',
  'tail_lights',
  'meal_break',
  'custom'
);

CREATE TABLE "ScheduleBlock" (
  "id"            TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "projectId"     TEXT NOT NULL,
  "shootDayId"    TEXT NOT NULL,
  "track"         "ScheduleBlockTrack" NOT NULL DEFAULT 'main',
  "kind"          "ScheduleBlockKind" NOT NULL DEFAULT 'work',
  "startTime"     VARCHAR(5) NOT NULL,
  "endTime"       VARCHAR(5),
  "description"   TEXT NOT NULL,
  "customLabel"   TEXT,
  "locationId"    TEXT,
  "talentIds"     TEXT[] NOT NULL DEFAULT '{}',
  "crewMemberIds" TEXT[] NOT NULL DEFAULT '{}',
  "sceneIds"      TEXT[] NOT NULL DEFAULT '{}',
  "sortOrder"     INTEGER NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScheduleBlock_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ScheduleBlock"
  ADD CONSTRAINT "ScheduleBlock_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScheduleBlock"
  ADD CONSTRAINT "ScheduleBlock_shootDayId_fkey"
  FOREIGN KEY ("shootDayId") REFERENCES "ShootDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScheduleBlock"
  ADD CONSTRAINT "ScheduleBlock_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ScheduleBlock_projectId_idx" ON "ScheduleBlock"("projectId");
CREATE INDEX "ScheduleBlock_shootDayId_startTime_idx" ON "ScheduleBlock"("shootDayId", "startTime");
CREATE INDEX "ScheduleBlock_shootDayId_track_sortOrder_idx" ON "ScheduleBlock"("shootDayId", "track", "sortOrder");
