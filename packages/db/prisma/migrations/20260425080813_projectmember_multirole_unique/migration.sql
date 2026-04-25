-- DropIndex
DROP INDEX "ProjectMember_projectId_userId_key";

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_role_key" ON "ProjectMember"("projectId", "userId", "role");
