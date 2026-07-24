CREATE TABLE IF NOT EXISTS "ClientJob" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "userId" INTEGER NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "budgetMin" INTEGER,
  "budgetMax" INTEGER,
  "urgency" TEXT NOT NULL DEFAULT 'MEDIUM',
  "jobDate" TEXT,
  "deadline" TEXT NOT NULL,
  "workMode" TEXT NOT NULL DEFAULT 'BOTH',
  "locationLabel" TEXT,
  "locationAddress" TEXT,
  "locationLat" REAL,
  "locationLng" REAL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  CONSTRAINT "ClientJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ClientJobAttachment" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "jobId" INTEGER NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileType" TEXT,
  "fileSize" INTEGER,
  "previewUrl" TEXT,
  "createdAt" TEXT NOT NULL,
  CONSTRAINT "ClientJobAttachment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ClientJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ClientJob_userId_idx" ON "ClientJob" ("userId");
CREATE INDEX IF NOT EXISTS "ClientJob_status_idx" ON "ClientJob" ("status");
CREATE INDEX IF NOT EXISTS "ClientJobAttachment_jobId_idx" ON "ClientJobAttachment" ("jobId");
