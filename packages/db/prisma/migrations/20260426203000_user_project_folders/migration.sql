-- CreateTable
CREATE TABLE "UserProjectFolder" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Untitled',
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProjectFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProjectPlacement" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "folderId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProjectPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserProjectFolder_userId_sortOrder_idx" ON "UserProjectFolder"("userId", "sortOrder");

-- CreateIndex
CREATE INDEX "UserProjectPlacement_userId_folderId_sortOrder_idx" ON "UserProjectPlacement"("userId", "folderId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "UserProjectPlacement_userId_projectId_key" ON "UserProjectPlacement"("userId", "projectId");

-- AddForeignKey
ALTER TABLE "UserProjectFolder" ADD CONSTRAINT "UserProjectFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProjectPlacement" ADD CONSTRAINT "UserProjectPlacement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProjectPlacement" ADD CONSTRAINT "UserProjectPlacement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProjectPlacement" ADD CONSTRAINT "UserProjectPlacement_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "UserProjectFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
