-- Budget core: 8 models + 6 enums + 3 modifications to existing models +
-- the receipts Supabase Storage bucket with auth-check RLS from day one.
-- Per spec §3 / plan PR 4.
--
-- Hand-authored (not generated via `prisma migrate dev --create-only`)
-- because the shadow DB step fails on the storage-discipline migration's
-- references to storage.buckets — see origin_one_db_migration_patterns.md.
-- Apply via `prisma migrate deploy`, which doesn't use a shadow DB.

-- CreateEnum
CREATE TYPE "BudgetAccountSection" AS ENUM ('ATL', 'BTL');
CREATE TYPE "BudgetUnit" AS ENUM ('DAY', 'WEEK', 'HOUR', 'FLAT', 'UNIT');
CREATE TYPE "BudgetVersionKind" AS ENUM ('estimate', 'working', 'committed', 'other');
CREATE TYPE "BudgetVersionState" AS ENUM ('draft', 'locked');
CREATE TYPE "ExpenseSource" AS ENUM ('timecard', 'manual');
CREATE TYPE "MarkupTarget" AS ENUM ('grandTotal', 'accountSubtotal');

-- AlterTable — add nullable budget columns to existing tables.
-- Nullable so existing rows don't need backfill. FKs added at the bottom.
ALTER TABLE "ProjectMember" ADD COLUMN "defaultLineItemId" TEXT;
ALTER TABLE "CrewTimecard"  ADD COLUMN "lineItemId"        TEXT;

-- CreateTable Budget
CREATE TABLE "Budget" (
    "id"                  TEXT NOT NULL,
    "projectId"           TEXT NOT NULL,
    "currency"            TEXT NOT NULL DEFAULT 'USD',
    "rateSourceVersionId" TEXT,
    "varianceThreshold"   DECIMAL(5,4) NOT NULL DEFAULT 0.10,
    "clonedFromProjectId" TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Budget_projectId_key" ON "Budget"("projectId");
CREATE INDEX        "Budget_projectId_idx" ON "Budget"("projectId");

-- CreateTable BudgetVersion
-- No UNIQUE on (budgetId, kind) by design — uniqueness for estimate/working/
-- committed is enforced in app code (creation guard); 'other' kind is allowed
-- multiple times for "Final Cost", "Plan B", etc.
CREATE TABLE "BudgetVersion" (
    "id"        TEXT NOT NULL,
    "budgetId"  TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "kind"      "BudgetVersionKind" NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "state"     "BudgetVersionState" NOT NULL DEFAULT 'draft',
    "lockedAt"  TIMESTAMP(3),
    "lockedBy"  TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BudgetVersion_budgetId_idx"      ON "BudgetVersion"("budgetId");
CREATE INDEX "BudgetVersion_budgetId_kind_idx" ON "BudgetVersion"("budgetId", "kind");

-- CreateTable BudgetAccount (self-referential tree via parentId)
CREATE TABLE "BudgetAccount" (
    "id"        TEXT NOT NULL,
    "budgetId"  TEXT NOT NULL,
    "parentId"  TEXT,
    "section"   "BudgetAccountSection" NOT NULL DEFAULT 'BTL',
    "code"      TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BudgetAccount_budgetId_code_key" ON "BudgetAccount"("budgetId", "code");
CREATE INDEX        "BudgetAccount_budgetId_idx"      ON "BudgetAccount"("budgetId");
CREATE INDEX        "BudgetAccount_parentId_idx"     ON "BudgetAccount"("parentId");

-- CreateTable BudgetLine
-- BudgetLine.tags GIN index — fast contains-any queries on the tag array.
CREATE TABLE "BudgetLine" (
    "id"          TEXT NOT NULL,
    "budgetId"    TEXT NOT NULL,
    "accountId"   TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit"        "BudgetUnit" NOT NULL,
    "fringeRate"  DECIMAL(5,4) NOT NULL DEFAULT 0,
    "tags"        TEXT[] DEFAULT ARRAY[]::TEXT[],
    "actualsRate" DECIMAL(12,2),
    "sortOrder"   INTEGER NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BudgetLine_budgetId_idx"  ON "BudgetLine"("budgetId");
CREATE INDEX "BudgetLine_accountId_idx" ON "BudgetLine"("accountId");
CREATE INDEX "BudgetLine_tags_idx"      ON "BudgetLine" USING GIN ("tags");

-- CreateTable BudgetLineAmount (per-version qty/rate)
CREATE TABLE "BudgetLineAmount" (
    "id"        TEXT NOT NULL,
    "lineId"    TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "qty"       TEXT NOT NULL DEFAULT '0',
    "rate"      DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetLineAmount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BudgetLineAmount_lineId_versionId_key" ON "BudgetLineAmount"("lineId", "versionId");
CREATE INDEX        "BudgetLineAmount_versionId_idx"        ON "BudgetLineAmount"("versionId");

-- CreateTable BudgetVariable (versionId nullable — null = budget-level)
CREATE TABLE "BudgetVariable" (
    "id"        TEXT NOT NULL,
    "budgetId"  TEXT NOT NULL,
    "versionId" TEXT,
    "name"      TEXT NOT NULL,
    "value"     TEXT NOT NULL,
    "notes"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetVariable_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BudgetVariable_budgetId_versionId_name_key" ON "BudgetVariable"("budgetId", "versionId", "name");
CREATE INDEX        "BudgetVariable_budgetId_idx"               ON "BudgetVariable"("budgetId");

-- CreateTable BudgetMarkup (versionId nullable — null = applies to all versions)
CREATE TABLE "BudgetMarkup" (
    "id"        TEXT NOT NULL,
    "budgetId"  TEXT NOT NULL,
    "versionId" TEXT,
    "name"      TEXT NOT NULL,
    "percent"   DECIMAL(5,4) NOT NULL,
    "appliesTo" "MarkupTarget" NOT NULL,
    "accountId" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetMarkup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BudgetMarkup_budgetId_idx" ON "BudgetMarkup"("budgetId");

-- CreateTable Expense
-- Expense.timecardId @unique guarantees one expense per approved timecard.
-- The PR 8 timecard-to-expense upsert/delete pattern depends on this.
CREATE TABLE "Expense" (
    "id"         TEXT NOT NULL,
    "budgetId"   TEXT NOT NULL,
    "lineId"     TEXT NOT NULL,
    "source"     "ExpenseSource" NOT NULL,
    "amount"     DECIMAL(12,2) NOT NULL,
    "date"       DATE NOT NULL,
    "units"      DECIMAL(8,2),
    "unitRate"   DECIMAL(12,2),
    "unit"       "BudgetUnit",
    "vendor"     TEXT,
    "notes"      TEXT,
    "receiptUrl" TEXT,
    "timecardId" TEXT,
    "createdBy"  TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Expense_timecardId_key" ON "Expense"("timecardId");
CREATE INDEX        "Expense_budgetId_idx"   ON "Expense"("budgetId");
CREATE INDEX        "Expense_lineId_idx"     ON "Expense"("lineId");
CREATE INDEX        "Expense_date_idx"       ON "Expense"("date");
CREATE INDEX        "Expense_source_idx"     ON "Expense"("source");

-- CreateIndex on the modified existing tables.
CREATE INDEX "ProjectMember_defaultLineItemId_idx" ON "ProjectMember"("defaultLineItemId");
CREATE INDEX "CrewTimecard_lineItemId_idx"         ON "CrewTimecard"("lineItemId");

-- AddForeignKey — declared after all tables exist so order doesn't matter.

ALTER TABLE "Budget"
  ADD CONSTRAINT "Budget_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BudgetVersion"
  ADD CONSTRAINT "BudgetVersion_budgetId_fkey"
  FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BudgetAccount"
  ADD CONSTRAINT "BudgetAccount_budgetId_fkey"
  FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BudgetAccount"
  ADD CONSTRAINT "BudgetAccount_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "BudgetAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BudgetLine"
  ADD CONSTRAINT "BudgetLine_budgetId_fkey"
  FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BudgetLine"
  ADD CONSTRAINT "BudgetLine_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "BudgetAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BudgetLineAmount"
  ADD CONSTRAINT "BudgetLineAmount_lineId_fkey"
  FOREIGN KEY ("lineId") REFERENCES "BudgetLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BudgetLineAmount"
  ADD CONSTRAINT "BudgetLineAmount_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "BudgetVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BudgetVariable"
  ADD CONSTRAINT "BudgetVariable_budgetId_fkey"
  FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BudgetVariable"
  ADD CONSTRAINT "BudgetVariable_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "BudgetVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BudgetMarkup"
  ADD CONSTRAINT "BudgetMarkup_budgetId_fkey"
  FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BudgetMarkup"
  ADD CONSTRAINT "BudgetMarkup_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "BudgetVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BudgetMarkup"
  ADD CONSTRAINT "BudgetMarkup_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "BudgetAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_budgetId_fkey"
  FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_lineId_fkey"
  FOREIGN KEY ("lineId") REFERENCES "BudgetLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_timecardId_fkey"
  FOREIGN KEY ("timecardId") REFERENCES "CrewTimecard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectMember"
  ADD CONSTRAINT "ProjectMember_defaultLineItemId_fkey"
  FOREIGN KEY ("defaultLineItemId") REFERENCES "BudgetLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CrewTimecard"
  ADD CONSTRAINT "CrewTimecard_lineItemId_fkey"
  FOREIGN KEY ("lineItemId") REFERENCES "BudgetLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── receipts bucket ─────────────────────────────────────────────────────
-- Mirrors the moodboard/storyboard pattern from
-- 20260426170000_storage_discipline_moodboard_storyboard but stricter:
-- auth-check RLS from day one (storage discipline rule for new buckets).
-- Receipts are sensitive financial documents — bucket is private
-- (public=false), 5 MB limit per spec §11.1 risk mitigation, common image
-- MIME types plus PDF (some accountants email PDF receipts).
--
-- Idempotent — ON CONFLICT DO UPDATE on the bucket row; DROP POLICY IF
-- EXISTS before each CREATE.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('receipts', 'receipts', false, 5242880,
        ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "receipts_auth_read"   ON storage.objects;
DROP POLICY IF EXISTS "receipts_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "receipts_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "receipts_auth_delete" ON storage.objects;

CREATE POLICY "receipts_auth_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'receipts' AND auth.role() = 'authenticated');

CREATE POLICY "receipts_auth_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'receipts' AND auth.role() = 'authenticated');

CREATE POLICY "receipts_auth_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'receipts' AND auth.role() = 'authenticated');

CREATE POLICY "receipts_auth_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'receipts' AND auth.role() = 'authenticated');
