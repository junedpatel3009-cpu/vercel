CREATE TABLE "FavoriteJob" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "userId" INTEGER NOT NULL,
  "jobId" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FavoriteJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FavoriteJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ClientJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "FavoriteJob_userId_jobId_key" ON "FavoriteJob"("userId", "jobId");
CREATE INDEX "FavoriteJob_userId_idx" ON "FavoriteJob"("userId");
CREATE INDEX "FavoriteJob_jobId_idx" ON "FavoriteJob"("jobId");
