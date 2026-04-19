-- AlterTable
ALTER TABLE "Thread" ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedBy" TEXT;

-- CreateTable
CREATE TABLE "ThreadRead" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThreadRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ThreadRead_threadId_userId_key" ON "ThreadRead"("threadId", "userId");

-- CreateIndex
CREATE INDEX "ThreadRead_userId_lastReadAt_idx" ON "ThreadRead"("userId", "lastReadAt");

-- AddForeignKey
ALTER TABLE "Thread" ADD CONSTRAINT "Thread_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadRead" ADD CONSTRAINT "ThreadRead_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadRead" ADD CONSTRAINT "ThreadRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
