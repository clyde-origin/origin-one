-- CreateEnum
CREATE TYPE "TimecardStatus" AS ENUM ('draft', 'submitted', 'approved', 'reopened');

-- CreateTable
CREATE TABLE "CrewTimecard" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "crewMemberId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hours" DECIMAL(4,2) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TimecardStatus" NOT NULL DEFAULT 'draft',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenedBy" TEXT,
    "reopenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrewTimecard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrewTimecard_projectId_idx" ON "CrewTimecard"("projectId");

-- CreateIndex
CREATE INDEX "CrewTimecard_crewMemberId_idx" ON "CrewTimecard"("crewMemberId");

-- CreateIndex
CREATE INDEX "CrewTimecard_projectId_date_idx" ON "CrewTimecard"("projectId", "date");

-- CreateIndex
CREATE INDEX "CrewTimecard_crewMemberId_date_idx" ON "CrewTimecard"("crewMemberId", "date");

-- CreateIndex
CREATE INDEX "CrewTimecard_status_idx" ON "CrewTimecard"("status");

-- AddForeignKey
ALTER TABLE "CrewTimecard" ADD CONSTRAINT "CrewTimecard_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewTimecard" ADD CONSTRAINT "CrewTimecard_crewMemberId_fkey" FOREIGN KEY ("crewMemberId") REFERENCES "ProjectMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewTimecard" ADD CONSTRAINT "CrewTimecard_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "ProjectMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewTimecard" ADD CONSTRAINT "CrewTimecard_reopenedBy_fkey" FOREIGN KEY ("reopenedBy") REFERENCES "ProjectMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
