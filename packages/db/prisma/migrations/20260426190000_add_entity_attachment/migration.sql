-- EntityAttachment polymorphic gallery — closes BUILD_STATUS #11.
-- Reference spec: apps/back-to-one/reference/back-to-one-entity-attachments.html
-- Decision log: DECISIONS.md "EntityAttachment storage — v1 unsigned public
-- URLs, RLS deferred." (Apr 26, 2026)
--
-- Three things land in this migration:
--   1. EntityAttachment table + indexes + FKs (Project, User cascade rules)
--   2. Location.imageUrl column dropped — superseded by EntityAttachment rows
--      attached as ('location', Location.id). LocationCard renders the most
--      recent attachment as the hero.
--   3. entity-attachments storage bucket with permissive RLS — matches
--      moodboard's pre-Auth posture per the DECISIONS entry above. Tightening
--      to authenticated-only happens on Auth day along with table RLS.

-- ─── 1. EntityAttachment table ───────────────────────────────────────────
CREATE TABLE "EntityAttachment" (
  "id"             TEXT     NOT NULL DEFAULT gen_random_uuid(),
  "projectId"      TEXT     NOT NULL,
  "attachedToType" TEXT     NOT NULL,
  "attachedToId"   TEXT     NOT NULL,
  "storagePath"    TEXT     NOT NULL,
  "caption"        TEXT,
  "uploadedById"   TEXT,
  "uploadedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "width"          INTEGER,
  "height"         INTEGER,
  "mimeType"       TEXT,
  "sizeBytes"      INTEGER,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EntityAttachment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "EntityAttachment"
  ADD CONSTRAINT "EntityAttachment_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EntityAttachment"
  ADD CONSTRAINT "EntityAttachment_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "EntityAttachment_projectId_idx"
  ON "EntityAttachment"("projectId");

CREATE INDEX "EntityAttachment_attachedToType_attachedToId_idx"
  ON "EntityAttachment"("attachedToType", "attachedToId");

CREATE INDEX "EntityAttachment_uploadedById_idx"
  ON "EntityAttachment"("uploadedById");

-- ─── 2. Drop Location.imageUrl ───────────────────────────────────────────
-- Superseded by EntityAttachment rows. Hero on LocationCard becomes the most
-- recent ('location', Location.id) attachment, queried alongside the location.
ALTER TABLE "Location" DROP COLUMN "imageUrl";

-- ─── 3. entity-attachments bucket + permissive RLS ───────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'entity-attachments',
  'entity-attachments',
  true,
  10485760,  -- 10 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "entity_attachments_public_read" ON storage.objects;
DROP POLICY IF EXISTS "entity_attachments_anon_insert" ON storage.objects;
DROP POLICY IF EXISTS "entity_attachments_anon_update" ON storage.objects;
DROP POLICY IF EXISTS "entity_attachments_anon_delete" ON storage.objects;

CREATE POLICY "entity_attachments_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'entity-attachments');

CREATE POLICY "entity_attachments_anon_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'entity-attachments');

CREATE POLICY "entity_attachments_anon_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'entity-attachments');

CREATE POLICY "entity_attachments_anon_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'entity-attachments');
