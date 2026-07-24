CREATE TABLE IF NOT EXISTS "ProjectReview" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "trackingId" INTEGER NOT NULL,
  "clientId" INTEGER NOT NULL,
  "professionalId" INTEGER NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectReview_trackingId_key" ON "ProjectReview"("trackingId");
CREATE INDEX IF NOT EXISTS "ProjectReview_clientId_idx" ON "ProjectReview"("clientId");
CREATE INDEX IF NOT EXISTS "ProjectReview_professionalId_idx" ON "ProjectReview"("professionalId");
