-- CallSheetRecipient + CallSheetDelivery — Arcs C + D.
-- Tracking columns (openedAt, clickedAt, confirmedAt, declinedAt, outdatedAt,
-- personalizedSnapshot) are included up front so the migration is one shot.
-- See docs/superpowers/specs/2026-04-30-daily-schedule-and-call-sheets-design.md

CREATE TYPE "CallSheetRecipientKind" AS ENUM ('talent', 'crew', 'client', 'freeform');
CREATE TYPE "CallSheetDeliveryChannel" AS ENUM ('email', 'sms');
CREATE TYPE "CallSheetDeliveryProvider" AS ENUM ('resend', 'twilio', 'stub');
CREATE TYPE "CallSheetDeliveryStatus" AS ENUM (
  'queued', 'sent', 'delivered', 'opened', 'bounced', 'failed'
);

CREATE TABLE "CallSheetRecipient" (
  "id"               TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "callSheetId"      TEXT NOT NULL,
  "kind"             "CallSheetRecipientKind" NOT NULL,
  "talentId"         TEXT,
  "projectMemberId"  TEXT,
  "freeformName"     TEXT,
  "freeformEmail"    TEXT,
  "freeformPhone"    TEXT,
  "freeformRole"     TEXT,
  "callTimeOverride" TEXT,
  "sendEmail"        BOOLEAN NOT NULL DEFAULT true,
  "sendSms"          BOOLEAN NOT NULL DEFAULT false,
  "excluded"         BOOLEAN NOT NULL DEFAULT false,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CallSheetRecipient_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CallSheetRecipient"
  ADD CONSTRAINT "CallSheetRecipient_callSheetId_fkey"
  FOREIGN KEY ("callSheetId") REFERENCES "CallSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CallSheetRecipient"
  ADD CONSTRAINT "CallSheetRecipient_talentId_fkey"
  FOREIGN KEY ("talentId") REFERENCES "Talent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CallSheetRecipient"
  ADD CONSTRAINT "CallSheetRecipient_projectMemberId_fkey"
  FOREIGN KEY ("projectMemberId") REFERENCES "ProjectMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CallSheetRecipient_callSheetId_idx" ON "CallSheetRecipient"("callSheetId");
CREATE INDEX "CallSheetRecipient_callSheetId_excluded_idx" ON "CallSheetRecipient"("callSheetId", "excluded");

CREATE TABLE "CallSheetDelivery" (
  "id"                 TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "recipientId"        TEXT NOT NULL,
  "channel"            "CallSheetDeliveryChannel" NOT NULL,
  "provider"           "CallSheetDeliveryProvider" NOT NULL,
  "status"             "CallSheetDeliveryStatus" NOT NULL DEFAULT 'queued',
  "scheduledFor"       TIMESTAMP(3),
  "sentAt"             TIMESTAMP(3),
  "deliveredAt"        TIMESTAMP(3),
  "bouncedAt"          TIMESTAMP(3),
  "failedReason"       TEXT,
  "externalId"         TEXT,
  "confirmToken"       TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "openedAt"           TIMESTAMP(3),
  "clickedAt"          TIMESTAMP(3),
  "confirmedAt"        TIMESTAMP(3),
  "declinedAt"         TIMESTAMP(3),
  "outdatedAt"         TIMESTAMP(3),
  "personalizedSnapshot" JSONB,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CallSheetDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CallSheetDelivery_confirmToken_key" ON "CallSheetDelivery"("confirmToken");

ALTER TABLE "CallSheetDelivery"
  ADD CONSTRAINT "CallSheetDelivery_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "CallSheetRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "CallSheetDelivery_recipientId_idx" ON "CallSheetDelivery"("recipientId");
CREATE INDEX "CallSheetDelivery_scheduledFor_sentAt_idx" ON "CallSheetDelivery"("scheduledFor", "sentAt");
CREATE INDEX "CallSheetDelivery_confirmToken_idx" ON "CallSheetDelivery"("confirmToken");
