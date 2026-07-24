CREATE TABLE IF NOT EXISTS "ProjectNegotiation" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "requestId" INTEGER NOT NULL,
  "jobId" INTEGER NOT NULL,
  "clientId" INTEGER NOT NULL,
  "professionalId" INTEGER NOT NULL,
  "senderId" INTEGER NOT NULL,
  "senderRole" TEXT NOT NULL,
  "bidAmount" INTEGER,
  "duration" TEXT,
  "message" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ProjectNegotiation_requestId_idx" ON "ProjectNegotiation"("requestId");
CREATE INDEX IF NOT EXISTS "ProjectNegotiation_clientId_idx" ON "ProjectNegotiation"("clientId");
CREATE INDEX IF NOT EXISTS "ProjectNegotiation_professionalId_idx" ON "ProjectNegotiation"("professionalId");
