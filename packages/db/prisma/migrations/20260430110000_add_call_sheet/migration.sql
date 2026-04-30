-- CallSheet — Arc B of the Daily Schedule + Call Sheets feature.
-- See docs/superpowers/specs/2026-04-30-daily-schedule-and-call-sheets-design.md

CREATE TYPE "CallSheetStatus" AS ENUM ('draft', 'sent');

CREATE TABLE "CallSheet" (
  "id"                     TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "projectId"              TEXT NOT NULL,
  "shootDayId"             TEXT NOT NULL,
  "status"                 "CallSheetStatus" NOT NULL DEFAULT 'draft',
  "publishedAt"            TIMESTAMP(3),
  "title"                  TEXT,
  "subtitle"               TEXT,
  "episodeOrEvent"         TEXT,
  "generalCallTime"        TEXT,
  "crewCallTime"           TEXT,
  "shootingCallTime"       TEXT,
  "lunchTime"              TEXT,
  "estWrapTime"            TEXT,
  "weatherTempHigh"        INTEGER,
  "weatherTempLow"         INTEGER,
  "weatherCondition"       TEXT,
  "sunriseTime"            TEXT,
  "sunsetTime"             TEXT,
  "nearestHospitalName"    TEXT,
  "nearestHospitalAddress" TEXT,
  "nearestHospitalPhone"   TEXT,
  "productionNotes"        TEXT,
  "parkingNotes"           TEXT,
  "includeSchedule"        BOOLEAN NOT NULL DEFAULT true,
  "replyToEmail"           TEXT,
  "customFromName"         TEXT,
  "customFromEmail"        TEXT,
  "attachmentPaths"        TEXT[] NOT NULL DEFAULT '{}',
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CallSheet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CallSheet_shootDayId_key" ON "CallSheet"("shootDayId");

ALTER TABLE "CallSheet"
  ADD CONSTRAINT "CallSheet_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CallSheet"
  ADD CONSTRAINT "CallSheet_shootDayId_fkey"
  FOREIGN KEY ("shootDayId") REFERENCES "ShootDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "CallSheet_projectId_idx" ON "CallSheet"("projectId");
CREATE INDEX "CallSheet_projectId_status_idx" ON "CallSheet"("projectId", "status");

GRANT ALL ON TABLE "CallSheet" TO anon, authenticated, service_role;

-- Storage bucket: call-sheet-attachments (5MB cap, MIME allowlist)
-- Permissive RLS pre-Auth (tightens on Auth Day in #24 RLS pass)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'call-sheet-attachments',
  'call-sheet-attachments',
  false,
  5242880,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "call_sheet_attachments_anon_all" ON storage.objects;
CREATE POLICY "call_sheet_attachments_anon_all"
  ON storage.objects FOR ALL
  USING (bucket_id = 'call-sheet-attachments')
  WITH CHECK (bucket_id = 'call-sheet-attachments');
