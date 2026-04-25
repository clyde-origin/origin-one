-- CreateEnum
CREATE TYPE "InventoryItemStatus" AS ENUM ('needed', 'ordered', 'arrived', 'packed', 'returned');

-- CreateEnum
CREATE TYPE "ImportSource" AS ENUM ('manual', 'pdf', 'excel');

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "department" TEXT,
    "status" "InventoryItemStatus" NOT NULL DEFAULT 'needed',
    "source" TEXT,
    "notes" TEXT,
    "importSource" "ImportSource" NOT NULL DEFAULT 'manual',
    "assigneeId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryItem_projectId_idx" ON "InventoryItem"("projectId");

-- CreateIndex
CREATE INDEX "InventoryItem_assigneeId_idx" ON "InventoryItem"("assigneeId");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "ProjectMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
