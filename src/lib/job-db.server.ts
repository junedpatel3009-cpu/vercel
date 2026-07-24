import path from "node:path";
import Database from "better-sqlite3";
import { io as clientIo } from "socket.io-client";

import type { ClientJobAttachmentInput, ClientJobInput } from "@/lib/validation/client-job";

type BetterSqlite3Database = InstanceType<typeof Database>;

export type JobUrgency = "LOW" | "MEDIUM" | "HIGH";
export type JobWorkMode = "ON_SITE" | "REMOTE" | "BOTH";
export type JobTimingType = "FIXED" | "HOURLY" | "WEEKLY";
export type JobStatus = "DRAFT" | "OPEN" | "CLOSED";

export type ClientJobRecord = {
  id: number;
  userId: number;
  category: string;
  title: string;
  description: string;
  budgetMin: number | null;
  budgetMax: number | null;
  urgency: JobUrgency;
  timingType: JobTimingType;
  hourlyRate: number | null;
  jobDate: string | null;
  deadline: string;
  workMode: JobWorkMode;
  locationLabel: string | null;
  locationAddress: string | null;
  locationLat: number | null;
  locationLng: number | null;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  attachments: ClientJobAttachmentRecord[];
};

export type PublicClientJobRecord = ClientJobRecord & {
  clientName: string;
  clientCompanyName: string | null;
  clientAvatarUrl: string | null;
};

export type ClientJobAttachmentRecord = {
  id: number;
  jobId: number;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  previewUrl: string | null;
  createdAt: string;
};

const globalForJobDb = globalThis as typeof globalThis & {
  jobDb?: BetterSqlite3Database;
};

function getDatabase() {
  if (!globalForJobDb.jobDb) {
    const databasePath = path.resolve(process.cwd(), "prisma", "app.db");
    globalForJobDb.jobDb = new Database(databasePath);
    ensureClientJobTables(globalForJobDb.jobDb);
  }

  return globalForJobDb.jobDb;
}

function ensureClientJobTables(db: BetterSqlite3Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "ClientJob" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "userId" INTEGER NOT NULL,
      "category" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "budgetMin" INTEGER,
      "budgetMax" INTEGER,
      "urgency" TEXT NOT NULL DEFAULT 'MEDIUM',
      "timingType" TEXT NOT NULL DEFAULT 'FIXED',
      "hourlyRate" INTEGER,
      "jobDate" TEXT,
      "deadline" TEXT NOT NULL,
      "workMode" TEXT NOT NULL DEFAULT 'BOTH',
      "locationLabel" TEXT,
      "locationAddress" TEXT,
      "locationLat" REAL,
      "locationLng" REAL,
      "status" TEXT NOT NULL DEFAULT 'OPEN',
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "ClientJobAttachment" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "jobId" INTEGER NOT NULL,
      "fileName" TEXT NOT NULL,
      "fileType" TEXT,
      "fileSize" INTEGER,
      "previewUrl" TEXT,
      "createdAt" TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "ClientJob_userId_idx" ON "ClientJob"("userId");
    CREATE INDEX IF NOT EXISTS "ClientJob_status_idx" ON "ClientJob"("status");
    CREATE INDEX IF NOT EXISTS "ClientJobAttachment_jobId_idx" ON "ClientJobAttachment"("jobId");

    CREATE TABLE IF NOT EXISTS "FavoriteJob" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "userId" INTEGER NOT NULL,
      "jobId" INTEGER NOT NULL,
      "createdAt" TEXT NOT NULL,
      UNIQUE("userId", "jobId")
    );

    CREATE INDEX IF NOT EXISTS "FavoriteJob_userId_idx" ON "FavoriteJob"("userId");
    CREATE INDEX IF NOT EXISTS "FavoriteJob_jobId_idx" ON "FavoriteJob"("jobId");

    CREATE TABLE IF NOT EXISTS "ProjectTracking" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "requestId" INTEGER NOT NULL,
      "jobId" INTEGER NOT NULL,
      "clientId" INTEGER NOT NULL,
      "professionalId" INTEGER NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "acceptedAt" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "ProjectTracking_jobId_idx" ON "ProjectTracking"("jobId");
  `);

  ensureColumn(
    db,
    "ClientJob",
    "timingType",
    `ALTER TABLE "ClientJob" ADD COLUMN "timingType" TEXT NOT NULL DEFAULT 'FIXED'`,
  );
  ensureColumn(
    db,
    "ClientJob",
    "hourlyRate",
    `ALTER TABLE "ClientJob" ADD COLUMN "hourlyRate" INTEGER`,
  );
}

function ensureFavoriteJobTable(db: BetterSqlite3Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "FavoriteJob" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "userId" INTEGER NOT NULL,
      "jobId" INTEGER NOT NULL,
      "createdAt" TEXT NOT NULL,
      UNIQUE("userId", "jobId")
    );

    CREATE INDEX IF NOT EXISTS "FavoriteJob_userId_idx" ON "FavoriteJob"("userId");
    CREATE INDEX IF NOT EXISTS "FavoriteJob_jobId_idx" ON "FavoriteJob"("jobId");
  `);
}

function normalizeDateValue(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return new Date(`${trimmed}T00:00:00.000Z`).toISOString();
}

function mapJob(
  row: Omit<ClientJobRecord, "attachments">,
  attachments: ClientJobAttachmentRecord[],
) {
  return {
    ...row,
    timingType: row.timingType ?? (row.hourlyRate ? "HOURLY" : "FIXED"),
    hourlyRate: row.hourlyRate ?? null,
    attachments,
  } satisfies ClientJobRecord;
}

function tableExists(db: BetterSqlite3Database, tableName: string) {
  const result = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`)
    .get(tableName) as { name: string } | undefined;

  return Boolean(result);
}

function ensureColumn(
  db: BetterSqlite3Database,
  tableName: string,
  columnName: string,
  alterSql: string,
) {
  const columns = db.prepare(`PRAGMA table_info("${tableName}")`).all() as Array<{ name: string }>;

  if (!columns.some((column) => column.name === columnName)) {
    db.exec(alterSql);
  }
}

function availableJobPredicate() {
  return `
    ClientJob.status = 'OPEN'
    AND NOT EXISTS (
      SELECT 1
      FROM "ProjectTracking"
      WHERE "ProjectTracking".jobId = ClientJob.id
        AND "ProjectTracking".status = 'ACTIVE'
    )
  `;
}

export function createClientJob(userId: number, input: ClientJobInput) {
  const db = getDatabase();
  const timestamp = new Date().toISOString();

  const createJob = db.transaction((attachments: ClientJobAttachmentInput[]) => {
    const result = db
      .prepare(
        `
          INSERT INTO "ClientJob" (
            userId,
            category,
            title,
            description,
            budgetMin,
            budgetMax,
            urgency,
            timingType,
            hourlyRate,
            jobDate,
            deadline,
            workMode,
            locationLabel,
            locationAddress,
            locationLat,
            locationLng,
            status,
            createdAt,
            updatedAt
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        userId,
        input.category.trim(),
        input.title.trim(),
        input.description.trim(),
        input.budgetMin ?? null,
        input.budgetMax ?? null,
        input.urgency,
        input.timingType,
        input.hourlyRate ?? null,
        normalizeDateValue(input.jobDate),
        normalizeDateValue(input.deadline) ?? timestamp,
        input.workMode,
        input.locationLabel?.trim() || null,
        input.locationAddress?.trim() || null,
        input.locationLat ?? null,
        input.locationLng ?? null,
        input.status,
        timestamp,
        timestamp,
      );

    const jobId = Number(result.lastInsertRowid);
    const insertAttachment = db.prepare(
      `
        INSERT INTO "ClientJobAttachment" (
          jobId,
          fileName,
          fileType,
          fileSize,
          previewUrl,
          createdAt
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    );

    for (const attachment of attachments) {
      insertAttachment.run(
        jobId,
        attachment.fileName.trim(),
        attachment.fileType?.trim() || null,
        attachment.fileSize ?? null,
        attachment.previewUrl?.trim() || null,
        timestamp,
      );
    }

    return jobId;
  });

  const jobId = createJob(input.attachments ?? []);

  // Notify admin room via socket server (best-effort, do not fail job creation)
  try {
    const socketUrl =
      process.env.SOCKET_URL || `http://localhost:${process.env.SOCKET_PORT || 4001}`;
    const sock = clientIo(socketUrl, { autoConnect: false });
    sock.connect();
    sock.emit("admin:activity", { reason: "client job posted" });
    sock.disconnect();
  } catch (e) {
    // ignore errors — admin refresh is best-effort
  }

  return getClientJobById(userId, jobId);
}

export function getClientJobById(userId: number, jobId: number) {
  const db = getDatabase();
  const job = db
    .prepare(
      `
        SELECT *
        FROM "ClientJob"
        WHERE id = ? AND userId = ?
        LIMIT 1
      `,
    )
    .get(jobId, userId) as Omit<ClientJobRecord, "attachments"> | undefined;

  if (!job) {
    return null;
  }

  const attachments = db
    .prepare(
      `
        SELECT *
        FROM "ClientJobAttachment"
        WHERE jobId = ?
        ORDER BY id ASC
      `,
    )
    .all(job.id) as ClientJobAttachmentRecord[];

  return mapJob(job, attachments);
}

export function getClientJobsByUserId(userId: number) {
  const db = getDatabase();
  const jobs = db
    .prepare(
      `
        SELECT *
        FROM "ClientJob"
        WHERE userId = ?
        ORDER BY datetime(createdAt) DESC, id DESC
      `,
    )
    .all(userId) as Array<Omit<ClientJobRecord, "attachments">>;

  if (!jobs.length) {
    return [];
  }

  const attachmentRows = db
    .prepare(
      `
        SELECT *
        FROM "ClientJobAttachment"
        WHERE jobId IN (${jobs.map(() => "?").join(",")})
        ORDER BY id ASC
      `,
    )
    .all(...jobs.map((job) => job.id)) as ClientJobAttachmentRecord[];

  return jobs.map((job) =>
    mapJob(
      job,
      attachmentRows.filter((attachment) => attachment.jobId === job.id),
    ),
  );
}

export function getOpenClientJobs() {
  const db = getDatabase();
  const jobs = db
    .prepare(
      `
        SELECT
          ClientJob.*,
          TRIM(User.firstName || ' ' || User.lastName) AS clientName,
          User.companyName AS clientCompanyName,
          User.avatarUrl AS clientAvatarUrl
        FROM "ClientJob"
        INNER JOIN "User" ON User.id = ClientJob.userId
        WHERE ${availableJobPredicate()}
        ORDER BY datetime(ClientJob.createdAt) DESC, ClientJob.id DESC
      `,
    )
    .all() as Array<Omit<PublicClientJobRecord, "attachments">>;

  if (!jobs.length) {
    return [];
  }

  const attachmentRows = db
    .prepare(
      `
        SELECT *
        FROM "ClientJobAttachment"
        WHERE jobId IN (${jobs.map(() => "?").join(",")})
        ORDER BY id ASC
      `,
    )
    .all(...jobs.map((job) => job.id)) as ClientJobAttachmentRecord[];

  return jobs.map((job) => ({
    ...mapJob(
      job,
      attachmentRows.filter((attachment) => attachment.jobId === job.id),
    ),
    clientName: job.clientName,
    clientCompanyName: job.clientCompanyName,
    clientAvatarUrl: job.clientAvatarUrl,
  }));
}

export function getOpenClientJobById(jobId: number) {
  const db = getDatabase();
  const job = db
    .prepare(
      `
        SELECT
          ClientJob.*,
          TRIM(User.firstName || ' ' || User.lastName) AS clientName,
          User.companyName AS clientCompanyName,
          User.avatarUrl AS clientAvatarUrl
        FROM "ClientJob"
        INNER JOIN "User" ON User.id = ClientJob.userId
        WHERE ClientJob.id = ? AND ${availableJobPredicate()}
        LIMIT 1
      `,
    )
    .get(jobId) as Omit<PublicClientJobRecord, "attachments"> | undefined;

  if (!job) {
    return null;
  }

  const attachments = db
    .prepare(
      `
        SELECT *
        FROM "ClientJobAttachment"
        WHERE jobId = ?
        ORDER BY id ASC
      `,
    )
    .all(job.id) as ClientJobAttachmentRecord[];

  return {
    ...mapJob(job, attachments),
    clientName: job.clientName,
    clientCompanyName: job.clientCompanyName,
    clientAvatarUrl: job.clientAvatarUrl,
  };
}

export function getFavoriteJobIds(userId: number) {
  const db = getDatabase();
  ensureFavoriteJobTable(db);

  return (
    db
      .prepare(
        `
          SELECT jobId
          FROM "FavoriteJob"
          WHERE userId = ?
          ORDER BY datetime(createdAt) DESC, id DESC
        `,
      )
      .all(userId) as Array<{ jobId: number }>
  ).map((row) => row.jobId);
}

export function getFavoriteJobsByUserId(userId: number) {
  const favoriteIds = getFavoriteJobIds(userId);

  if (!favoriteIds.length) {
    return [];
  }

  const favoriteIdSet = new Set(favoriteIds);
  const favoriteOrder = new Map(favoriteIds.map((jobId, index) => [jobId, index]));

  return getOpenClientJobs()
    .filter((job) => favoriteIdSet.has(job.id))
    .sort((a, b) => (favoriteOrder.get(a.id) ?? 0) - (favoriteOrder.get(b.id) ?? 0));
}

export function isFavoriteJob(userId: number, jobId: number) {
  const db = getDatabase();
  ensureFavoriteJobTable(db);
  const row = db
    .prepare(
      `
        SELECT id
        FROM "FavoriteJob"
        WHERE userId = ? AND jobId = ?
        LIMIT 1
      `,
    )
    .get(userId, jobId) as { id: number } | undefined;

  return Boolean(row);
}

export function setFavoriteJob(userId: number, jobId: number, favorite: boolean) {
  const db = getDatabase();
  ensureFavoriteJobTable(db);

  if (favorite) {
    const job = db
      .prepare(
        `
          SELECT id
          FROM "ClientJob"
          WHERE ClientJob.id = ? AND ${availableJobPredicate()}
          LIMIT 1
        `,
      )
      .get(jobId) as { id: number } | undefined;

    if (!job) {
      throw new Error("This job is not available.");
    }

    db.prepare(
      `
        INSERT OR IGNORE INTO "FavoriteJob" (userId, jobId, createdAt)
        VALUES (?, ?, ?)
      `,
    ).run(userId, jobId, new Date().toISOString());

    return true;
  }

  db.prepare(
    `
      DELETE FROM "FavoriteJob"
      WHERE userId = ? AND jobId = ?
    `,
  ).run(userId, jobId);

  return false;
}

export function updateClientJobStatus(userId: number, jobId: number, status: JobStatus) {
  const db = getDatabase();
  const timestamp = new Date().toISOString();
  const existing = getClientJobById(userId, jobId);

  if (!existing) {
    return undefined;
  }

  const updateJobStatus = db.transaction(() => {
    if (status === "OPEN" && existing.status === "CLOSED") {
      clearReopenedJobRequestDrafts(db, jobId);
    }

    db.prepare(
      `
        UPDATE "ClientJob"
        SET status = ?, updatedAt = ?
        WHERE id = ? AND userId = ?
      `,
    ).run(status, timestamp, jobId, userId);
  });

  updateJobStatus();

  return getClientJobById(userId, jobId);
}

function clearReopenedJobRequestDrafts(db: BetterSqlite3Database, jobId: number) {
  if (!tableExists(db, "ProjectRequest")) {
    return;
  }

  if (tableExists(db, "ProjectNegotiation")) {
    db.prepare(
      `
        DELETE FROM "ProjectNegotiation"
        WHERE requestId IN (
          SELECT id
          FROM "ProjectRequest"
          WHERE jobId = ? AND status IN ('PENDING', 'DECLINED')
        )
      `,
    ).run(jobId);
  }

  db.prepare(
    `
      DELETE FROM "ProjectRequest"
      WHERE jobId = ? AND status IN ('PENDING', 'DECLINED')
    `,
  ).run(jobId);
}

export function updateClientJob(userId: number, jobId: number, input: ClientJobInput) {
  const db = getDatabase();
  const timestamp = new Date().toISOString();
  const existing = getClientJobById(userId, jobId);

  if (!existing) {
    return null;
  }

  const updateJob = db.transaction((attachments: ClientJobAttachmentInput[]) => {
    db.prepare(
      `
        UPDATE "ClientJob"
        SET
          category = ?,
          title = ?,
          description = ?,
          budgetMin = ?,
          budgetMax = ?,
          urgency = ?,
          timingType = ?,
          hourlyRate = ?,
          jobDate = ?,
          deadline = ?,
          workMode = ?,
          locationLabel = ?,
          locationAddress = ?,
          locationLat = ?,
          locationLng = ?,
          status = ?,
          updatedAt = ?
        WHERE id = ? AND userId = ?
      `,
    ).run(
      input.category.trim(),
      input.title.trim(),
      input.description.trim(),
      input.budgetMin ?? null,
      input.budgetMax ?? null,
      input.urgency,
      input.timingType,
      input.hourlyRate ?? null,
      normalizeDateValue(input.jobDate),
      normalizeDateValue(input.deadline) ?? timestamp,
      input.workMode,
      input.locationLabel?.trim() || null,
      input.locationAddress?.trim() || null,
      input.locationLat ?? null,
      input.locationLng ?? null,
      input.status,
      timestamp,
      jobId,
      userId,
    );

    db.prepare(`DELETE FROM "ClientJobAttachment" WHERE jobId = ?`).run(jobId);

    const insertAttachment = db.prepare(
      `
        INSERT INTO "ClientJobAttachment" (
          jobId,
          fileName,
          fileType,
          fileSize,
          previewUrl,
          createdAt
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    );

    for (const attachment of attachments) {
      insertAttachment.run(
        jobId,
        attachment.fileName.trim(),
        attachment.fileType?.trim() || null,
        attachment.fileSize ?? null,
        attachment.previewUrl?.trim() || null,
        timestamp,
      );
    }
  });

  updateJob(input.attachments ?? []);

  // Notify admin room about updated job (best-effort)
  try {
    const socketUrl =
      process.env.SOCKET_URL || `http://localhost:${process.env.SOCKET_PORT || 4001}`;
    const sock = clientIo(socketUrl, { autoConnect: false });
    sock.connect();
    sock.emit("admin:activity", { reason: "client job updated" });
    sock.disconnect();
  } catch (e) {
    // ignore errors
  }

  return getClientJobById(userId, jobId);
}

export function deleteClientJob(userId: number, jobId: number) {
  const db = getDatabase();
  const job = getClientJobById(userId, jobId);

  if (!job) {
    return false;
  }

  const deleteJob = db.transaction(() => {
    if (tableExists(db, "ProjectTracking")) {
      const retainedTracking = db
        .prepare(
          `
            SELECT id, status
            FROM "ProjectTracking"
            WHERE jobId = ?
              AND clientId = ?
              AND status IN ('ACTIVE', 'COMPLETED')
            LIMIT 1
          `,
        )
        .get(jobId, userId) as { id: number; status: string } | undefined;

      if (retainedTracking) {
        throw new Error(
          retainedTracking.status === "COMPLETED"
            ? "Completed projects stay in account history and cannot be deleted."
            : "Active projects must be cancelled or completed before the job can be deleted.",
        );
      }
    }

    const trackingIds = tableExists(db, "ProjectTracking")
      ? (db
          .prepare(`SELECT id FROM "ProjectTracking" WHERE jobId = ? AND clientId = ?`)
          .all(jobId, userId) as Array<{ id: number }>)
      : [];
    const trackingIdValues = trackingIds.map((tracking) => tracking.id);

    if (trackingIdValues.length) {
      const placeholders = trackingIdValues.map(() => "?").join(",");
      const trackingTables = [
        "ProjectTransaction",
        "ProjectReview",
        "ProjectDispute",
        "ProjectCompletionRequest",
        "ProjectMilestone",
        "ProjectRevisionRequest",
        "ProjectWorkUpload",
      ];

      for (const table of trackingTables) {
        if (tableExists(db, table)) {
          db.prepare(`DELETE FROM "${table}" WHERE trackingId IN (${placeholders})`).run(
            ...trackingIdValues,
          );
        }
      }
    }

    if (tableExists(db, "ProjectTracking")) {
      db.prepare(`DELETE FROM "ProjectTracking" WHERE jobId = ? AND clientId = ?`).run(
        jobId,
        userId,
      );
    }

    if (tableExists(db, "ProjectRequest")) {
      db.prepare(`DELETE FROM "ProjectRequest" WHERE jobId = ? AND clientId = ?`).run(
        jobId,
        userId,
      );
    }

    db.prepare(`DELETE FROM "FavoriteJob" WHERE jobId = ?`).run(jobId);
    db.prepare(`DELETE FROM "ClientJobAttachment" WHERE jobId = ?`).run(jobId);
    db.prepare(`DELETE FROM "ClientJob" WHERE id = ? AND userId = ?`).run(jobId, userId);
  });

  deleteJob();

  return true;
}
