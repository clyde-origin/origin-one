-- CreateEnum
CREATE TYPE "ShootDayType" AS ENUM ('pre', 'prod', 'post');

-- CreateTable
CREATE TABLE "ShootDay" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "ShootDayType" NOT NULL,
    "notes" TEXT,
    "locationId" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShootDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShootDay_projectId_idx" ON "ShootDay"("projectId");

-- CreateIndex
CREATE INDEX "ShootDay_projectId_type_idx" ON "ShootDay"("projectId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ShootDay_projectId_date_key" ON "ShootDay"("projectId", "date");

-- AddForeignKey
ALTER TABLE "ShootDay" ADD CONSTRAINT "ShootDay_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShootDay" ADD CONSTRAINT "ShootDay_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
