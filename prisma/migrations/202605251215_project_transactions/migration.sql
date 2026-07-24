CREATE TABLE IF NOT EXISTS "ProjectTransaction" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "trackingId" INTEGER NOT NULL,
  "milestoneId" INTEGER,
  "completionId" INTEGER,
  "clientId" INTEGER NOT NULL,
  "professionalId" INTEGER NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "description" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "ProjectTransaction_trackingId_idx" ON "ProjectTransaction"("trackingId");
CREATE INDEX IF NOT EXISTS "ProjectTransaction_clientId_idx" ON "ProjectTransaction"("clientId");
CREATE INDEX IF NOT EXISTS "ProjectTransaction_professionalId_idx" ON "ProjectTransaction"("professionalId");
CREATE INDEX IF NOT EXISTS "ProjectTransaction_status_idx" ON "ProjectTransaction"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectTransaction_milestoneId_key" ON "ProjectTransaction"("milestoneId") WHERE "milestoneId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectTransaction_completionId_key" ON "ProjectTransaction"("completionId") WHERE "completionId" IS NOT NULL;
