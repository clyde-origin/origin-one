-- Add archived flag to UserProjectFolder so dragging a folder into the archive
-- preserves its identity instead of deleting the folder + archiving its
-- projects loose. See spec: docs/superpowers/specs/2026-04-27-folder-archive-design.md.

ALTER TABLE "UserProjectFolder"
  ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "UserProjectFolder_userId_archived_idx"
  ON "UserProjectFolder"("userId", "archived");
