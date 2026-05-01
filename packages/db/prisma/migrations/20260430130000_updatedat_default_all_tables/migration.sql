-- Backfill DB-level DEFAULT now() onto every "updatedAt" column that Prisma
-- declared with @updatedAt only.
--
-- Prisma's @updatedAt decorator runs in the Prisma client, not in Postgres.
-- Anything inserting through PostgREST (Supabase JS) bypasses Prisma and
-- violates the NOT NULL constraint, so the row silently never saves.
-- ActionItem caught us most recently; this generalises the fix the way
-- 20260427060800_folders_updated_at_default did for the folders tables.
--
-- See GOTCHAS.md → "Prisma defaults are client-level only".
--
-- Tables already safe (had @default(now()) @updatedAt or a prior fix):
--   Project, Thread, WorkflowNode, Deliverable,
--   UserProjectFolder, UserProjectPlacement.

ALTER TABLE "User"                 ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "Team"                 ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "CrewTimecard"         ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "Scene"                ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "Shot"                 ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "Entity"               ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "Document"             ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "ActionItem"           ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "EntityAttachment"     ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "Location"             ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "PropSourced"          ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "WardrobeSourced"      ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "InventoryItem"        ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "Talent"               ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "ShootDay"             ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "ScheduleBlock"        ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "CallSheet"            ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "CallSheetRecipient"   ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "CallSheetDelivery"    ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "Budget"               ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "BudgetVersion"        ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "BudgetAccount"        ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "BudgetLine"           ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "BudgetLineAmount"     ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "BudgetVariable"       ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "BudgetMarkup"         ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "Expense"              ALTER COLUMN "updatedAt" SET DEFAULT now();
