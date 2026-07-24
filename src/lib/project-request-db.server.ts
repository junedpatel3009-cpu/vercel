import path from "node:path";
import Database from "better-sqlite3";

import { getOpenClientJobById } from "@/lib/job-db.server";

type BetterSqlite3Database = InstanceType<typeof Database>;
const REQUIRED_PROJECT_MILESTONES = 5;

export type ProjectRequestStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export type ProjectRequestInput = {
  jobId: number;
  professionalId: number;
  bidAmount: number | null;
  duration: string;
  coverLetter: string;
  attachments?: ProjectRequestAttachmentInput[];
};

export type ProjectRequestAttachmentInput = {
  fileName: string;
  fileType?: string | null;
  fileSize?: number | null;
  fileUrl?: string | null;
};

export type ProjectRequestRecord = {
  id: number;
  jobId: number;
  clientId: number;
  professionalId: number;
  bidAmount: number | null;
  duration: string | null;
  coverLetter: string;
  attachmentsJson: string | null;
  status: ProjectRequestStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProjectNegotiationSenderRole = "PROFESSIONAL" | "CLIENT";

export type ProjectNegotiationRecord = {
  id: number;
  requestId: number;
  jobId: number;
  clientId: number;
  professionalId: number;
  senderId: number;
  senderRole: ProjectNegotiationSenderRole;
  previousBidAmount: number | null;
  previousDuration: string | null;
  previousMessage: string | null;
  bidAmount: number | null;
  duration: string | null;
  message: string;
  createdAt: string;
};

export type ProjectNegotiationInput = {
  requestId: number;
  bidAmount: number | null;
  duration: string;
  message: string;
};

export type ClientProjectRequestRecord = ProjectRequestRecord & {
  projectTitle: string;
  projectCategory: string;
  projectBudgetMin: number | null;
  projectBudgetMax: number | null;
  professionalName: string;
  professionalEmail: string;
  professionalAvatarUrl: string | null;
  professionalCategory: string | null;
  trackingId: number | null;
  trackingStatus: ProjectTrackingStatus | null;
  acceptedAt: string | null;
};

export type ProjectTrackingStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

export type ProjectTrackingRecord = {
  id: number;
  requestId: number;
  jobId: number;
  clientId: number;
  professionalId: number;
  status: ProjectTrackingStatus;
  acceptedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectWorkUploadInput = {
  trackingId: number;
  title?: string;
  note?: string;
  fileName?: string | null;
  fileUrl?: string | null;
  files?: ProjectWorkUploadFileInput[];
};

export type ProjectWorkUploadFileInput = {
  fileName: string;
  fileUrl?: string | null;
  fileDataUrl?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
};

export type ProjectWorkUploadRecord = {
  id: number;
  trackingId: number;
  roundNumber: number;
  title: string;
  note: string;
  fileName: string | null;
  fileUrl: string | null;
  filesJson: string | null;
  createdAt: string;
};

export type ProjectRevisionStatus = "REQUESTED" | "ADDRESSED";

export type ProjectRevisionRequestInput = {
  trackingId: number;
  note: string;
};

export type ProjectRevisionRequestRecord = {
  id: number;
  trackingId: number;
  clientId: number;
  professionalId: number;
  note: string;
  status: ProjectRevisionStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProjectMilestoneStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "APPROVED"
  | "REVISION_REQUESTED"
  | "PAID";

export type ProjectMilestoneInput = {
  trackingId: number;
  title: string;
  description?: string | null;
  amount?: number | null;
  dueDate?: string | null;
};

export type ProjectMilestoneRecord = {
  id: number;
  trackingId: number;
  clientId: number;
  professionalId: number;
  title: string;
  description: string | null;
  amount: number | null;
  dueDate: string | null;
  status: ProjectMilestoneStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProjectTransactionType = "MILESTONE_PAYMENT" | "FINAL_PAYMENT";
export type ProjectTransactionStatus = "COMPLETED" | "CANCELLED";
export type ProjectWithdrawalStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "REJECTED";
export type ProjectWithdrawalDestinationType = "BANK" | "UPI" | "WALLET";

export type ProjectTransactionRecord = {
  id: number;
  trackingId: number;
  milestoneId: number | null;
  completionId: number | null;
  clientId: number;
  professionalId: number;
  amount: number;
  currency: string;
  type: ProjectTransactionType;
  status: ProjectTransactionStatus;
  description: string;
  createdAt: string;
  updatedAt: string;
  projectTitle: string | null;
  projectCategory: string | null;
};

export type ProjectWithdrawalRecord = {
  id: number;
  professionalId: number;
  amount: number;
  currency: string;
  destinationType: ProjectWithdrawalDestinationType;
  destinationLabel: string;
  status: ProjectWithdrawalStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectWithdrawalInput = {
  amount: number;
  destinationType: ProjectWithdrawalDestinationType;
  destinationLabel: string;
  note?: string | null;
};

export type ProjectCompletionStatus = "SUBMITTED" | "APPROVED" | "REVISION_REQUESTED";

export type ProjectCompletionRequestRecord = {
  id: number;
  trackingId: number;
  clientId: number;
  professionalId: number;
  note: string | null;
  status: ProjectCompletionStatus;
  submittedAt: string;
  updatedAt: string;
};

export type ProjectDisputeType =
  | "PAYMENT"
  | "WORK_QUALITY"
  | "DEADLINE_DELAY"
  | "COMMUNICATION"
  | "FILE_PROBLEM"
  | "OTHER";

export type ProjectDisputePriority = "LOW" | "MEDIUM" | "HIGH";
export type ProjectDisputeStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED";

export type ProjectDisputeRecord = {
  id: number;
  trackingId: number;
  reporterId: number;
  reporterRole: string;
  clientId: number;
  professionalId: number;
  issueType: ProjectDisputeType;
  priority: ProjectDisputePriority;
  message: string;
  attachmentsJson: string | null;
  status: ProjectDisputeStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProjectDisputeInput = {
  trackingId: number;
  issueType: ProjectDisputeType;
  priority: ProjectDisputePriority;
  message: string;
  attachments?: ProjectRequestAttachmentInput[];
};

export type ProfessionalTrackedProjectRecord = ProjectTrackingRecord & {
  projectTitle: string;
  projectCategory: string;
  clientName: string;
  clientAvatarUrl: string | null;
  bidAmount: number | null;
  duration: string | null;
  coverLetter: string;
  deadline: string;
  reviewRating: number | null;
  reviewComment: string | null;
  reviewResponse: string | null;
  reviewResponseAt: string | null;
  reviewCreatedAt: string | null;
  reviewRequestedAt: string | null;
  reviewRequestNote: string | null;
};

export type ClientTrackedProjectRecord = ProjectTrackingRecord & {
  projectTitle: string;
  projectCategory: string;
  professionalName: string;
  professionalAvatarUrl: string | null;
  professionalCategory: string | null;
  bidAmount: number | null;
  duration: string | null;
  coverLetter: string;
  deadline: string;
  reviewRating: number | null;
  reviewComment: string | null;
  reviewResponse: string | null;
  reviewResponseAt: string | null;
  reviewCreatedAt: string | null;
  reviewRequestedAt: string | null;
  reviewRequestNote: string | null;
};

export type ProjectReviewRecord = {
  id: number;
  trackingId: number;
  clientId: number;
  professionalId: number;
  rating: number;
  comment: string | null;
  professionalResponse: string | null;
  professionalResponseAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectReviewRequestRecord = {
  id: number;
  trackingId: number;
  clientId: number;
  professionalId: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProfessionalProjectRequestRecord = ProjectRequestRecord & {
  projectTitle: string;
  projectCategory: string;
  clientName: string;
  clientAvatarUrl: string | null;
  deadline: string;
  trackingId: number | null;
  trackingStatus: ProjectTrackingStatus | null;
  acceptedAt: string | null;
  reviewRating: number | null;
  reviewComment: string | null;
  reviewResponse: string | null;
  reviewResponseAt: string | null;
  reviewCreatedAt: string | null;
  reviewRequestedAt: string | null;
  reviewRequestNote: string | null;
};

export type ProjectTrackingDetailsRecord = ProjectTrackingRecord & {
  projectTitle: string;
  projectCategory: string;
  projectDescription: string;
  projectBudgetMin: number | null;
  projectBudgetMax: number | null;
  projectTimingType: string | null;
  projectUrgency: string;
  projectJobDate: string | null;
  projectDeadline: string;
  projectWorkMode: string;
  projectLocationLabel: string | null;
  projectLocationAddress: string | null;
  clientName: string;
  clientAvatarUrl: string | null;
  professionalName: string;
  professionalAvatarUrl: string | null;
  professionalCategory: string | null;
  professionalEmail: string;
  bidAmount: number | null;
  duration: string | null;
  coverLetter: string;
  attachmentsJson: string | null;
  requestStatus: ProjectRequestStatus;
  requestCreatedAt: string;
  requestUpdatedAt: string;
  reviewRating: number | null;
  reviewComment: string | null;
  reviewResponse: string | null;
  reviewResponseAt: string | null;
  reviewCreatedAt: string | null;
  reviewRequestedAt: string | null;
  reviewRequestNote: string | null;
  workUploads: ProjectWorkUploadRecord[];
  revisionRequests: ProjectRevisionRequestRecord[];
  milestones: ProjectMilestoneRecord[];
  completionRequests: ProjectCompletionRequestRecord[];
  transactions: ProjectTransactionRecord[];
  disputes: ProjectDisputeRecord[];
};

const globalForProjectRequestDb = globalThis as typeof globalThis & {
  projectRequestDb?: BetterSqlite3Database;
};

function getDatabase() {
  if (!globalForProjectRequestDb.projectRequestDb) {
    const databasePath = path.resolve(process.cwd(), "prisma", "app.db");
    globalForProjectRequestDb.projectRequestDb = new Database(databasePath);
  }

  ensureProjectRequestTables(globalForProjectRequestDb.projectRequestDb);
  return globalForProjectRequestDb.projectRequestDb;
}

function ensureProjectRequestTables(db: BetterSqlite3Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "ProjectRequest" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "jobId" INTEGER NOT NULL,
      "clientId" INTEGER NOT NULL,
      "professionalId" INTEGER NOT NULL,
      "bidAmount" INTEGER,
      "duration" TEXT,
      "coverLetter" TEXT NOT NULL,
      "attachmentsJson" TEXT,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "ProjectRequest_jobId_idx" ON "ProjectRequest"("jobId");
    CREATE INDEX IF NOT EXISTS "ProjectRequest_clientId_idx" ON "ProjectRequest"("clientId");
    CREATE INDEX IF NOT EXISTS "ProjectRequest_professionalId_idx" ON "ProjectRequest"("professionalId");
    DROP INDEX IF EXISTS "ProjectRequest_job_professional_key";
    CREATE INDEX IF NOT EXISTS "ProjectRequest_job_professional_idx" ON "ProjectRequest"("jobId", "professionalId");

    CREATE TABLE IF NOT EXISTS "ProjectNegotiation" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "requestId" INTEGER NOT NULL,
      "jobId" INTEGER NOT NULL,
      "clientId" INTEGER NOT NULL,
      "professionalId" INTEGER NOT NULL,
      "senderId" INTEGER NOT NULL,
      "senderRole" TEXT NOT NULL,
      "previousBidAmount" INTEGER,
      "previousDuration" TEXT,
      "previousMessage" TEXT,
      "bidAmount" INTEGER,
      "duration" TEXT,
      "message" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "ProjectNegotiation_requestId_idx" ON "ProjectNegotiation"("requestId");
    CREATE INDEX IF NOT EXISTS "ProjectNegotiation_clientId_idx" ON "ProjectNegotiation"("clientId");
    CREATE INDEX IF NOT EXISTS "ProjectNegotiation_professionalId_idx" ON "ProjectNegotiation"("professionalId");

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

    CREATE UNIQUE INDEX IF NOT EXISTS "ProjectTracking_requestId_key" ON "ProjectTracking"("requestId");
    CREATE INDEX IF NOT EXISTS "ProjectTracking_jobId_idx" ON "ProjectTracking"("jobId");
    CREATE INDEX IF NOT EXISTS "ProjectTracking_clientId_idx" ON "ProjectTracking"("clientId");
    CREATE INDEX IF NOT EXISTS "ProjectTracking_professionalId_idx" ON "ProjectTracking"("professionalId");

    CREATE TABLE IF NOT EXISTS "ProjectWorkUpload" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "trackingId" INTEGER NOT NULL,
      "roundNumber" INTEGER NOT NULL,
      "title" TEXT NOT NULL,
      "note" TEXT NOT NULL,
      "fileName" TEXT,
      "fileUrl" TEXT,
      "filesJson" TEXT,
      "createdAt" TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "ProjectWorkUpload_trackingId_idx" ON "ProjectWorkUpload"("trackingId");

    CREATE TABLE IF NOT EXISTS "ProjectRevisionRequest" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "trackingId" INTEGER NOT NULL,
      "clientId" INTEGER NOT NULL,
      "professionalId" INTEGER NOT NULL,
      "note" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'REQUESTED',
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "ProjectRevisionRequest_trackingId_idx" ON "ProjectRevisionRequest"("trackingId");
    CREATE INDEX IF NOT EXISTS "ProjectRevisionRequest_clientId_idx" ON "ProjectRevisionRequest"("clientId");
    CREATE INDEX IF NOT EXISTS "ProjectRevisionRequest_professionalId_idx" ON "ProjectRevisionRequest"("professionalId");

    CREATE TABLE IF NOT EXISTS "ProjectMilestone" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "trackingId" INTEGER NOT NULL,
      "clientId" INTEGER NOT NULL,
      "professionalId" INTEGER NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "amount" INTEGER,
      "dueDate" TEXT,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "ProjectMilestone_trackingId_idx" ON "ProjectMilestone"("trackingId");
    CREATE INDEX IF NOT EXISTS "ProjectMilestone_clientId_idx" ON "ProjectMilestone"("clientId");
    CREATE INDEX IF NOT EXISTS "ProjectMilestone_professionalId_idx" ON "ProjectMilestone"("professionalId");

    CREATE TABLE IF NOT EXISTS "ProjectCompletionRequest" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "trackingId" INTEGER NOT NULL,
      "clientId" INTEGER NOT NULL,
      "professionalId" INTEGER NOT NULL,
      "note" TEXT,
      "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
      "submittedAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "ProjectCompletionRequest_trackingId_idx" ON "ProjectCompletionRequest"("trackingId");
    CREATE INDEX IF NOT EXISTS "ProjectCompletionRequest_clientId_idx" ON "ProjectCompletionRequest"("clientId");
    CREATE INDEX IF NOT EXISTS "ProjectCompletionRequest_professionalId_idx" ON "ProjectCompletionRequest"("professionalId");

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

    CREATE TABLE IF NOT EXISTS "ProjectWithdrawal" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "professionalId" INTEGER NOT NULL,
      "amount" INTEGER NOT NULL,
      "currency" TEXT NOT NULL DEFAULT 'USD',
      "destinationType" TEXT NOT NULL,
      "destinationLabel" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "note" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "ProjectWithdrawal_professionalId_idx" ON "ProjectWithdrawal"("professionalId");
    CREATE INDEX IF NOT EXISTS "ProjectWithdrawal_status_idx" ON "ProjectWithdrawal"("status");

    CREATE TABLE IF NOT EXISTS "ProjectReview" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "trackingId" INTEGER NOT NULL,
      "clientId" INTEGER NOT NULL,
      "professionalId" INTEGER NOT NULL,
      "rating" INTEGER NOT NULL,
      "comment" TEXT,
      "professionalResponse" TEXT,
      "professionalResponseAt" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "ProjectReview_trackingId_key" ON "ProjectReview"("trackingId");
    CREATE INDEX IF NOT EXISTS "ProjectReview_clientId_idx" ON "ProjectReview"("clientId");
    CREATE INDEX IF NOT EXISTS "ProjectReview_professionalId_idx" ON "ProjectReview"("professionalId");

    CREATE TABLE IF NOT EXISTS "ProjectReviewRequest" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "trackingId" INTEGER NOT NULL,
      "clientId" INTEGER NOT NULL,
      "professionalId" INTEGER NOT NULL,
      "note" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "ProjectReviewRequest_trackingId_key" ON "ProjectReviewRequest"("trackingId");
    CREATE INDEX IF NOT EXISTS "ProjectReviewRequest_clientId_idx" ON "ProjectReviewRequest"("clientId");
    CREATE INDEX IF NOT EXISTS "ProjectReviewRequest_professionalId_idx" ON "ProjectReviewRequest"("professionalId");

    CREATE TABLE IF NOT EXISTS "ProjectDispute" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "trackingId" INTEGER NOT NULL,
      "reporterId" INTEGER NOT NULL,
      "reporterRole" TEXT NOT NULL,
      "clientId" INTEGER NOT NULL,
      "professionalId" INTEGER NOT NULL,
      "issueType" TEXT NOT NULL,
      "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
      "message" TEXT NOT NULL,
      "attachmentsJson" TEXT,
      "status" TEXT NOT NULL DEFAULT 'OPEN',
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "ProjectDispute_trackingId_idx" ON "ProjectDispute"("trackingId");
    CREATE INDEX IF NOT EXISTS "ProjectDispute_reporterId_idx" ON "ProjectDispute"("reporterId");
    CREATE INDEX IF NOT EXISTS "ProjectDispute_status_idx" ON "ProjectDispute"("status");
  `);

  const negotiationColumns = new Set(
    (
      db.prepare(`PRAGMA table_info("ProjectNegotiation")`).all() as Array<{
        name: string;
      }>
    ).map((column) => column.name),
  );

  if (!negotiationColumns.has("previousBidAmount")) {
    db.exec(`ALTER TABLE "ProjectNegotiation" ADD COLUMN "previousBidAmount" INTEGER`);
  }

  if (!negotiationColumns.has("previousDuration")) {
    db.exec(`ALTER TABLE "ProjectNegotiation" ADD COLUMN "previousDuration" TEXT`);
  }

  if (!negotiationColumns.has("previousMessage")) {
    db.exec(`ALTER TABLE "ProjectNegotiation" ADD COLUMN "previousMessage" TEXT`);
  }

  const columns = new Set(
    (
      db.prepare(`PRAGMA table_info("ProjectRequest")`).all() as Array<{
        name: string;
      }>
    ).map((column) => column.name),
  );

  if (!columns.has("attachmentsJson")) {
    db.exec(`ALTER TABLE "ProjectRequest" ADD COLUMN "attachmentsJson" TEXT`);
  }

  const workUploadColumns = new Set(
    (
      db.prepare(`PRAGMA table_info("ProjectWorkUpload")`).all() as Array<{
        name: string;
      }>
    ).map((column) => column.name),
  );

  if (!workUploadColumns.has("filesJson")) {
    db.exec(`ALTER TABLE "ProjectWorkUpload" ADD COLUMN "filesJson" TEXT`);
  }

  const reviewColumns = new Set(
    (
      db.prepare(`PRAGMA table_info("ProjectReview")`).all() as Array<{
        name: string;
      }>
    ).map((column) => column.name),
  );

  if (!reviewColumns.has("professionalResponse")) {
    db.exec(`ALTER TABLE "ProjectReview" ADD COLUMN "professionalResponse" TEXT`);
  }

  if (!reviewColumns.has("professionalResponseAt")) {
    db.exec(`ALTER TABLE "ProjectReview" ADD COLUMN "professionalResponseAt" TEXT`);
  }

  backfillProjectTransactions(db);
}

function getProjectWorkUploads(trackingId: number) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  return db
    .prepare(
      `
        SELECT *
        FROM "ProjectWorkUpload"
        WHERE trackingId = ?
        ORDER BY roundNumber ASC, id ASC
      `,
    )
    .all(trackingId) as ProjectWorkUploadRecord[];
}

function getProjectRevisionRequests(trackingId: number) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  return db
    .prepare(
      `
        SELECT *
        FROM "ProjectRevisionRequest"
        WHERE trackingId = ?
        ORDER BY datetime(createdAt) ASC, id ASC
      `,
    )
    .all(trackingId) as ProjectRevisionRequestRecord[];
}

function getProjectMilestones(trackingId: number) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  return db
    .prepare(
      `
        SELECT *
        FROM "ProjectMilestone"
        WHERE trackingId = ?
        ORDER BY datetime(createdAt) ASC, id ASC
      `,
    )
    .all(trackingId) as ProjectMilestoneRecord[];
}

function getProjectCompletionRequests(trackingId: number) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  return db
    .prepare(
      `
        SELECT *
        FROM "ProjectCompletionRequest"
        WHERE trackingId = ?
        ORDER BY datetime(submittedAt) ASC, id ASC
      `,
    )
    .all(trackingId) as ProjectCompletionRequestRecord[];
}

function getProjectDisputes(trackingId: number) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  return db
    .prepare(
      `
        SELECT *
        FROM "ProjectDispute"
        WHERE trackingId = ?
        ORDER BY datetime(createdAt) ASC, id ASC
      `,
    )
    .all(trackingId) as ProjectDisputeRecord[];
}

function getProjectTransactions(trackingId: number) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  return db
    .prepare(
      `
        SELECT *
        FROM "ProjectTransaction"
        WHERE trackingId = ?
        ORDER BY datetime(createdAt) ASC, id ASC
      `,
    )
    .all(trackingId) as ProjectTransactionRecord[];
}

function saveMilestoneTransaction(
  db: BetterSqlite3Database,
  milestone: ProjectMilestoneRecord,
  timestamp: string,
) {
  if (!milestone.amount || milestone.amount <= 0) {
    return;
  }

  db.prepare(
    `
      INSERT OR IGNORE INTO "ProjectTransaction" (
        trackingId,
        milestoneId,
        completionId,
        clientId,
        professionalId,
        amount,
        currency,
        type,
        status,
        description,
        createdAt,
        updatedAt
      )
      VALUES (?, ?, NULL, ?, ?, ?, 'USD', 'MILESTONE_PAYMENT', 'COMPLETED', ?, ?, ?)
    `,
  ).run(
    milestone.trackingId,
    milestone.id,
    milestone.clientId,
    milestone.professionalId,
    milestone.amount,
    `Milestone payment - ${milestone.title}`,
    timestamp,
    timestamp,
  );

  db.prepare(
    `
      UPDATE "ProjectTransaction"
      SET amount = ?,
        status = 'COMPLETED',
        description = ?,
        updatedAt = ?
      WHERE milestoneId = ?
    `,
  ).run(milestone.amount, `Milestone payment - ${milestone.title}`, timestamp, milestone.id);
}

function cancelMilestoneTransaction(
  db: BetterSqlite3Database,
  milestoneId: number,
  timestamp: string,
) {
  db.prepare(
    `
      UPDATE "ProjectTransaction"
      SET status = 'CANCELLED', updatedAt = ?
      WHERE milestoneId = ? AND status = 'COMPLETED'
    `,
  ).run(timestamp, milestoneId);
}

function saveCompletionTransaction(
  db: BetterSqlite3Database,
  completion: ProjectCompletionRequestRecord,
  timestamp: string,
) {
  const tracking = db
    .prepare(
      `
        SELECT
          ProjectTracking.*,
          ProjectRequest.bidAmount AS bidAmount,
          ClientJob.title AS projectTitle
        FROM "ProjectTracking"
        INNER JOIN "ProjectRequest" ON ProjectRequest.id = ProjectTracking.requestId
        INNER JOIN "ClientJob" ON ClientJob.id = ProjectTracking.jobId
        WHERE ProjectTracking.id = ?
        LIMIT 1
      `,
    )
    .get(completion.trackingId) as
    | (ProjectTrackingRecord & { bidAmount: number | null; projectTitle: string | null })
    | undefined;

  if (!tracking?.bidAmount || tracking.bidAmount <= 0) {
    return;
  }

  const paid = db
    .prepare(
      `
        SELECT COALESCE(SUM(amount), 0) AS amount
        FROM "ProjectTransaction"
        WHERE trackingId = ? AND status = 'COMPLETED' AND milestoneId IS NOT NULL
      `,
    )
    .get(completion.trackingId) as { amount: number };
  const remainingAmount = Math.max(0, Math.round(tracking.bidAmount - paid.amount));

  if (!remainingAmount) {
    return;
  }

  db.prepare(
    `
      INSERT OR IGNORE INTO "ProjectTransaction" (
        trackingId,
        milestoneId,
        completionId,
        clientId,
        professionalId,
        amount,
        currency,
        type,
        status,
        description,
        createdAt,
        updatedAt
      )
      VALUES (?, NULL, ?, ?, ?, ?, 'USD', 'FINAL_PAYMENT', 'COMPLETED', ?, ?, ?)
    `,
  ).run(
    completion.trackingId,
    completion.id,
    completion.clientId,
    completion.professionalId,
    remainingAmount,
    `Final payment - ${tracking.projectTitle || "Project"}`,
    timestamp,
    timestamp,
  );

  db.prepare(
    `
      UPDATE "ProjectTransaction"
      SET amount = ?,
        status = 'COMPLETED',
        description = ?,
        updatedAt = ?
      WHERE completionId = ?
    `,
  ).run(
    remainingAmount,
    `Final payment - ${tracking.projectTitle || "Project"}`,
    timestamp,
    completion.id,
  );
}

function cancelCompletionTransaction(
  db: BetterSqlite3Database,
  completionId: number,
  timestamp: string,
) {
  db.prepare(
    `
      UPDATE "ProjectTransaction"
      SET status = 'CANCELLED', updatedAt = ?
      WHERE completionId = ? AND status = 'COMPLETED'
    `,
  ).run(timestamp, completionId);
}

function backfillProjectTransactions(db: BetterSqlite3Database) {
  const paidMilestones = db
    .prepare(
      `
        SELECT *
        FROM "ProjectMilestone"
        WHERE status = 'PAID' AND amount IS NOT NULL AND amount > 0
      `,
    )
    .all() as ProjectMilestoneRecord[];

  for (const milestone of paidMilestones) {
    saveMilestoneTransaction(db, milestone, milestone.updatedAt || new Date().toISOString());
  }

  const approvedCompletions = db
    .prepare(
      `
        SELECT *
        FROM "ProjectCompletionRequest"
        WHERE status = 'APPROVED'
      `,
    )
    .all() as ProjectCompletionRequestRecord[];

  for (const completion of approvedCompletions) {
    saveCompletionTransaction(db, completion, completion.updatedAt || new Date().toISOString());
  }
}

function withTrackingActivity(
  tracking:
    | Omit<
        ProjectTrackingDetailsRecord,
        | "workUploads"
        | "revisionRequests"
        | "milestones"
        | "completionRequests"
        | "transactions"
        | "disputes"
      >
    | undefined,
) {
  if (!tracking) {
    return undefined;
  }

  return {
    ...tracking,
    workUploads: getProjectWorkUploads(tracking.id),
    revisionRequests: getProjectRevisionRequests(tracking.id),
    milestones: getProjectMilestones(tracking.id),
    completionRequests: getProjectCompletionRequests(tracking.id),
    transactions: getProjectTransactions(tracking.id),
    disputes: getProjectDisputes(tracking.id),
  } satisfies ProjectTrackingDetailsRecord;
}

export function submitProjectCompletion(
  professionalId: number,
  input: { trackingId: number; note?: string | null },
) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  const tracking = db
    .prepare(
      `
        SELECT *
        FROM "ProjectTracking"
        WHERE id = ? AND professionalId = ? AND status = 'ACTIVE'
        LIMIT 1
      `,
    )
    .get(input.trackingId, professionalId) as ProjectTrackingRecord | undefined;

  if (!tracking) {
    throw new Error(
      "Only the assigned professional can submit completion for this active project.",
    );
  }

  const milestoneSummary = db
    .prepare(
      `
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) AS paid
        FROM "ProjectMilestone"
        WHERE trackingId = ?
      `,
    )
    .get(tracking.id) as { total: number; paid: number | null };

  if (
    Number(milestoneSummary.total || 0) < REQUIRED_PROJECT_MILESTONES ||
    Number(milestoneSummary.paid || 0) < REQUIRED_PROJECT_MILESTONES
  ) {
    throw new Error(
      `Complete all ${REQUIRED_PROJECT_MILESTONES} milestones before final submission.`,
    );
  }

  const timestamp = new Date().toISOString();
  const note = input.note?.trim() || null;

  db.prepare(
    `
      INSERT INTO "ProjectCompletionRequest" (
        trackingId,
        clientId,
        professionalId,
        note,
        status,
        submittedAt,
        updatedAt
      )
      VALUES (?, ?, ?, ?, 'SUBMITTED', ?, ?)
    `,
  ).run(tracking.id, tracking.clientId, tracking.professionalId, note, timestamp, timestamp);

  db.prepare(`UPDATE "ProjectTracking" SET updatedAt = ? WHERE id = ?`).run(timestamp, tracking.id);

  return getProjectCompletionRequests(tracking.id);
}

export function updateProjectCompletionStatus(
  clientId: number,
  completionId: number,
  status: ProjectCompletionStatus,
) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  if (!["APPROVED", "REVISION_REQUESTED"].includes(status)) {
    throw new Error("Client can only approve or request revision for completion.");
  }

  const completion = db
    .prepare(
      `
        SELECT *
        FROM "ProjectCompletionRequest"
        WHERE id = ? AND clientId = ?
        LIMIT 1
      `,
    )
    .get(completionId, clientId) as ProjectCompletionRequestRecord | undefined;

  if (!completion) {
    throw new Error("Only the client can update this completion request.");
  }

  if (status === "APPROVED") {
    const milestoneSummary = db
      .prepare(
        `
          SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) AS paid
          FROM "ProjectMilestone"
          WHERE trackingId = ?
        `,
      )
      .get(completion.trackingId) as { total: number; paid: number | null };

    if (
      Number(milestoneSummary.total || 0) < REQUIRED_PROJECT_MILESTONES ||
      Number(milestoneSummary.paid || 0) < REQUIRED_PROJECT_MILESTONES
    ) {
      throw new Error(
        `Complete all ${REQUIRED_PROJECT_MILESTONES} milestones before approving final submission.`,
      );
    }
  }

  const timestamp = new Date().toISOString();

  db.prepare(
    `
      UPDATE "ProjectCompletionRequest"
      SET status = ?, updatedAt = ?
      WHERE id = ?
    `,
  ).run(status, timestamp, completionId);

  if (status === "APPROVED") {
    db.prepare(
      `
        UPDATE "ProjectTracking"
        SET status = 'COMPLETED', updatedAt = ?
        WHERE id = ? AND clientId = ?
      `,
    ).run(timestamp, completion.trackingId, clientId);

    db.prepare(
      `
        UPDATE "ClientJob"
        SET status = 'CLOSED', updatedAt = ?
        WHERE id = (
          SELECT jobId
          FROM "ProjectTracking"
          WHERE id = ? AND clientId = ?
          LIMIT 1
        )
      `,
    ).run(timestamp, completion.trackingId, clientId);
    saveCompletionTransaction(db, completion, timestamp);
  } else {
    db.prepare(`UPDATE "ProjectTracking" SET updatedAt = ? WHERE id = ?`).run(
      timestamp,
      completion.trackingId,
    );
    db.prepare(
      `
        UPDATE "ProjectTransaction"
        SET status = 'CANCELLED', updatedAt = ?
        WHERE completionId = ? AND status = 'COMPLETED'
      `,
    ).run(timestamp, completionId);
  }

  return getProjectCompletionRequests(completion.trackingId);
}

export function createProjectDispute(
  reporterId: number,
  reporterRole: string,
  input: ProjectDisputeInput,
) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  if (
    ![
      "PAYMENT",
      "WORK_QUALITY",
      "DEADLINE_DELAY",
      "COMMUNICATION",
      "FILE_PROBLEM",
      "OTHER",
    ].includes(input.issueType)
  ) {
    throw new Error("Choose a valid issue type.");
  }

  if (!["LOW", "MEDIUM", "HIGH"].includes(input.priority)) {
    throw new Error("Choose a valid priority.");
  }

  const message = input.message.trim();

  if (message.length < 10) {
    throw new Error("Add at least 10 characters describing the issue.");
  }

  const tracking = db
    .prepare(
      `
        SELECT *
        FROM "ProjectTracking"
        WHERE id = ? AND (clientId = ? OR professionalId = ?)
        LIMIT 1
      `,
    )
    .get(input.trackingId, reporterId, reporterId) as ProjectTrackingRecord | undefined;

  if (!tracking) {
    throw new Error("Only project participants can raise a dispute.");
  }

  const attachments = (input.attachments ?? [])
    .filter((attachment) => attachment.fileName?.trim())
    .map((attachment) => ({
      fileName: attachment.fileName.trim(),
      fileType: attachment.fileType?.trim() || null,
      fileSize: attachment.fileSize ?? null,
      fileUrl: attachment.fileUrl?.trim() || null,
    }));
  const timestamp = new Date().toISOString();

  const result = db
    .prepare(
      `
        INSERT INTO "ProjectDispute" (
          trackingId,
          reporterId,
          reporterRole,
          clientId,
          professionalId,
          issueType,
          priority,
          message,
          attachmentsJson,
          status,
          createdAt,
          updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?)
      `,
    )
    .run(
      tracking.id,
      reporterId,
      reporterRole,
      tracking.clientId,
      tracking.professionalId,
      input.issueType,
      input.priority,
      message,
      attachments.length ? JSON.stringify(attachments) : null,
      timestamp,
      timestamp,
    );

  db.prepare(`UPDATE "ProjectTracking" SET updatedAt = ? WHERE id = ?`).run(timestamp, tracking.id);

  return db
    .prepare(`SELECT * FROM "ProjectDispute" WHERE id = ? LIMIT 1`)
    .get(Number(result.lastInsertRowid)) as ProjectDisputeRecord;
}

export function createProjectMilestone(clientId: number, input: ProjectMilestoneInput) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  const tracking = db
    .prepare(
      `
        SELECT *
        FROM "ProjectTracking"
        WHERE id = ? AND clientId = ? AND status = 'ACTIVE'
        LIMIT 1
      `,
    )
    .get(input.trackingId, clientId) as ProjectTrackingRecord | undefined;

  if (!tracking) {
    throw new Error("Only the client can add milestones to this active project.");
  }

  const existingMilestoneCount = (
    db
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM "ProjectMilestone"
          WHERE trackingId = ?
        `,
      )
      .get(tracking.id) as { count: number }
  ).count;

  if (existingMilestoneCount >= REQUIRED_PROJECT_MILESTONES) {
    throw new Error("This project already has the required 5 milestones.");
  }

  const projectRequest = db
    .prepare(
      `
        SELECT bidAmount
        FROM "ProjectRequest"
        WHERE id = ?
        LIMIT 1
      `,
    )
    .get(tracking.requestId) as { bidAmount: number | null } | undefined;
  const milestoneNumber = existingMilestoneCount + 1;
  const requiredAmount = getRequiredMilestoneAmount(
    projectRequest?.bidAmount ?? 0,
    milestoneNumber,
  );
  const title = input.title.trim() || `Milestone ${milestoneNumber}/${REQUIRED_PROJECT_MILESTONES}`;
  const description = input.description?.trim() || null;
  const amount = requiredAmount > 0 ? requiredAmount : null;
  const schedule = getProjectSchedule(db, tracking.jobId);
  const dueDate = normalizeScheduleDate(input.dueDate);

  if (title.length < 3) {
    throw new Error("Add a milestone title.");
  }

  if (dueDate && schedule.startAt && compareScheduleDates(dueDate, schedule.startAt) < 0) {
    throw new Error("Milestone due date cannot be before the project start date.");
  }

  if (dueDate && schedule.endAt && compareScheduleDates(dueDate, schedule.endAt) > 0) {
    throw new Error("Milestone due date cannot be after the project deadline.");
  }

  const timestamp = new Date().toISOString();

  db.prepare(
    `
      INSERT INTO "ProjectMilestone" (
        trackingId,
        clientId,
        professionalId,
        title,
        description,
        amount,
        dueDate,
        status,
        createdAt,
        updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
    `,
  ).run(
    tracking.id,
    tracking.clientId,
    tracking.professionalId,
    title,
    description,
    amount,
    dueDate,
    timestamp,
    timestamp,
  );

  db.prepare(`UPDATE "ProjectTracking" SET updatedAt = ? WHERE id = ?`).run(timestamp, tracking.id);

  return getProjectMilestones(tracking.id);
}

function getRequiredMilestoneAmount(totalAmount: number, milestoneNumber: number) {
  const normalizedTotal = Math.max(0, Math.round(Number(totalAmount) || 0));
  const baseAmount = Math.floor(normalizedTotal / REQUIRED_PROJECT_MILESTONES);
  const remainder = normalizedTotal - baseAmount * REQUIRED_PROJECT_MILESTONES;

  return baseAmount + (milestoneNumber <= remainder ? 1 : 0);
}

export function updateProjectMilestoneStatus(
  userId: number,
  milestoneId: number,
  status: ProjectMilestoneStatus,
) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  const milestone = db
    .prepare(
      `
        SELECT *
        FROM "ProjectMilestone"
        WHERE id = ? AND (clientId = ? OR professionalId = ?)
        LIMIT 1
      `,
    )
    .get(milestoneId, userId, userId) as ProjectMilestoneRecord | undefined;

  if (!milestone) {
    throw new Error("You cannot update this milestone.");
  }

  const tracking = db
    .prepare(
      `
        SELECT *
        FROM "ProjectTracking"
        WHERE id = ?
        LIMIT 1
      `,
    )
    .get(milestone.trackingId) as ProjectTrackingRecord | undefined;

  if (!tracking || tracking.status !== "ACTIVE") {
    throw new Error("Milestones can only be updated while the project is active.");
  }

  const clientStatuses: ProjectMilestoneStatus[] = [
    "APPROVED",
    "REVISION_REQUESTED",
    "PAID",
    "PENDING",
  ];
  const professionalStatuses: ProjectMilestoneStatus[] = ["IN_PROGRESS", "SUBMITTED"];
  const isClient = milestone.clientId === userId;
  const allowedStatuses = isClient ? clientStatuses : professionalStatuses;

  if (!allowedStatuses.includes(status)) {
    throw new Error("This milestone status is not available for your role.");
  }

  const timestamp = new Date().toISOString();

  if (!isClient && compareScheduleDates(tracking.acceptedAt, timestamp) > 0) {
    throw new Error("This project cannot start before the scheduled job date.");
  }

  db.prepare(
    `
      UPDATE "ProjectMilestone"
      SET status = ?, updatedAt = ?
      WHERE id = ?
    `,
  ).run(status, timestamp, milestoneId);

  if (status === "PAID") {
    saveMilestoneTransaction(db, milestone, timestamp);
  } else {
    cancelMilestoneTransaction(db, milestone.id, timestamp);
  }

  const milestoneSummary = db
    .prepare(
      `
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) AS paid
        FROM "ProjectMilestone"
        WHERE trackingId = ?
      `,
    )
    .get(milestone.trackingId) as { total: number; paid: number | null };
  const isProjectComplete =
    status === "PAID" &&
    Number(milestoneSummary.total || 0) >= REQUIRED_PROJECT_MILESTONES &&
    Number(milestoneSummary.paid || 0) >= REQUIRED_PROJECT_MILESTONES;

  if (isProjectComplete) {
    db.prepare(
      `
        UPDATE "ProjectTracking"
        SET status = 'COMPLETED', updatedAt = ?
        WHERE id = ? AND status = 'ACTIVE'
      `,
    ).run(timestamp, milestone.trackingId);

    db.prepare(
      `
        UPDATE "ClientJob"
        SET status = 'CLOSED', updatedAt = ?
        WHERE id = ?
      `,
    ).run(timestamp, tracking.jobId);
  } else {
    db.prepare(`UPDATE "ProjectTracking" SET updatedAt = ? WHERE id = ?`).run(
      timestamp,
      milestone.trackingId,
    );
  }

  return getProjectMilestones(milestone.trackingId);
}

export function deleteProjectMilestone(clientId: number, milestoneId: number) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  const milestone = db
    .prepare(
      `
        SELECT *
        FROM "ProjectMilestone"
        WHERE id = ? AND clientId = ?
        LIMIT 1
      `,
    )
    .get(milestoneId, clientId) as ProjectMilestoneRecord | undefined;

  if (!milestone) {
    throw new Error("Only the client can delete this milestone.");
  }

  if (!["PENDING", "REVISION_REQUESTED"].includes(milestone.status)) {
    throw new Error("Only pending milestones can be deleted.");
  }

  db.prepare(`DELETE FROM "ProjectMilestone" WHERE id = ?`).run(milestoneId);

  return getProjectMilestones(milestone.trackingId);
}

export function createProjectWorkUpload(professionalId: number, input: ProjectWorkUploadInput) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  const tracking = db
    .prepare(
      `
        SELECT *
        FROM "ProjectTracking"
        WHERE id = ? AND professionalId = ? AND status = 'ACTIVE'
        LIMIT 1
      `,
    )
    .get(input.trackingId, professionalId) as ProjectTrackingRecord | undefined;

  if (!tracking) {
    throw new Error("Only the assigned professional can upload work for this active project.");
  }

  const files = (input.files ?? [])
    .map((file) => ({
      fileName: file.fileName.trim(),
      fileUrl: file.fileUrl?.trim() || null,
      fileDataUrl: file.fileDataUrl?.trim() || null,
      fileType: file.fileType?.trim() || null,
      fileSize: file.fileSize ?? null,
    }))
    .filter((file) => file.fileName);
  const title =
    input.title?.trim() || files[0]?.fileName || input.fileName?.trim() || "Uploaded work";
  const note = input.note?.trim() || "Work file uploaded.";

  if (!files.length && !input.fileName?.trim()) {
    throw new Error("Add at least one file before uploading work.");
  }

  const nextRound = Number(
    (
      db
        .prepare(
          `
            SELECT COALESCE(MAX(roundNumber), 0) + 1 AS roundNumber
            FROM "ProjectWorkUpload"
            WHERE trackingId = ?
          `,
        )
        .get(input.trackingId) as { roundNumber: number }
    ).roundNumber,
  );
  const timestamp = new Date().toISOString();

  const insertUpload = db.prepare(
    `
      INSERT INTO "ProjectWorkUpload" (
        trackingId,
        roundNumber,
        title,
        note,
        fileName,
        fileUrl,
        filesJson,
        createdAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
  );

  const filesToSave = files.length
    ? files
    : [
        {
          fileName: input.fileName?.trim() || "Uploaded work",
          fileUrl: input.fileUrl?.trim() || null,
          fileDataUrl: null,
          fileType: null,
          fileSize: null,
        },
      ];

  filesToSave.forEach((file, index) => {
    insertUpload.run(
      input.trackingId,
      nextRound + index,
      file.fileName,
      note,
      file.fileName,
      file.fileDataUrl || file.fileUrl,
      JSON.stringify([file]),
      timestamp,
    );
  });

  db.prepare(
    `
      UPDATE "ProjectTracking"
      SET updatedAt = ?
      WHERE id = ?
    `,
  ).run(timestamp, input.trackingId);

  db.prepare(
    `
      UPDATE "ProjectRevisionRequest"
      SET status = 'ADDRESSED', updatedAt = ?
      WHERE trackingId = ? AND status = 'REQUESTED'
    `,
  ).run(timestamp, input.trackingId);

  return getProjectWorkUploads(input.trackingId);
}

export function createProjectRevisionRequest(clientId: number, input: ProjectRevisionRequestInput) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  const tracking = db
    .prepare(
      `
        SELECT *
        FROM "ProjectTracking"
        WHERE id = ? AND clientId = ? AND status = 'ACTIVE'
        LIMIT 1
      `,
    )
    .get(input.trackingId, clientId) as ProjectTrackingRecord | undefined;

  if (!tracking) {
    throw new Error("Only the client can request a revision for this active project.");
  }

  const note = input.note.trim();

  if (note.length < 5) {
    throw new Error("Add a short revision note.");
  }

  const timestamp = new Date().toISOString();

  db.prepare(
    `
      INSERT INTO "ProjectRevisionRequest" (
        trackingId,
        clientId,
        professionalId,
        note,
        status,
        createdAt,
        updatedAt
      )
      VALUES (?, ?, ?, ?, 'REQUESTED', ?, ?)
    `,
  ).run(tracking.id, tracking.clientId, tracking.professionalId, note, timestamp, timestamp);

  db.prepare(
    `
      UPDATE "ProjectTracking"
      SET updatedAt = ?
      WHERE id = ?
    `,
  ).run(timestamp, tracking.id);

  return getProjectRevisionRequests(tracking.id);
}

export function deleteProjectRevisionRequest(clientId: number, revisionId: number) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  const revision = db
    .prepare(
      `
        SELECT *
        FROM "ProjectRevisionRequest"
        WHERE id = ? AND clientId = ?
        LIMIT 1
      `,
    )
    .get(revisionId, clientId) as ProjectRevisionRequestRecord | undefined;

  if (!revision) {
    throw new Error("Only the client can clear this revision request.");
  }

  db.prepare(`DELETE FROM "ProjectRevisionRequest" WHERE id = ?`).run(revisionId);

  return getProjectRevisionRequests(revision.trackingId);
}

export function deleteProjectWorkUpload(professionalId: number, uploadId: number) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  const upload = db
    .prepare(
      `
        SELECT ProjectWorkUpload.*
        FROM "ProjectWorkUpload"
        INNER JOIN "ProjectTracking" ON ProjectTracking.id = ProjectWorkUpload.trackingId
        WHERE ProjectWorkUpload.id = ? AND ProjectTracking.professionalId = ?
        LIMIT 1
      `,
    )
    .get(uploadId, professionalId) as ProjectWorkUploadRecord | undefined;

  if (!upload) {
    throw new Error("Only the assigned professional can delete this uploaded work.");
  }

  db.prepare(`DELETE FROM "ProjectWorkUpload" WHERE id = ?`).run(uploadId);

  return getProjectWorkUploads(upload.trackingId);
}

export function createProjectRequest(input: ProjectRequestInput) {
  const job = getOpenClientJobById(input.jobId);

  if (!job) {
    throw new Error("Project is not available for requests.");
  }

  if (!input.coverLetter.trim()) {
    throw new Error("Cover letter is required.");
  }

  const db = getDatabase();
  ensureProjectRequestTables(db);
  const timestamp = new Date().toISOString();
  const bidAmount = input.bidAmount && input.bidAmount > 0 ? Math.round(input.bidAmount) : null;
  const duration = input.duration.trim() || null;
  const coverLetter = input.coverLetter.trim();
  const attachmentsJson = JSON.stringify(
    (input.attachments ?? [])
      .filter((attachment) => attachment.fileName.trim())
      .map((attachment) => ({
        fileName: attachment.fileName.trim(),
        fileType: attachment.fileType?.trim() || null,
        fileSize: attachment.fileSize ?? null,
        fileUrl: attachment.fileUrl?.trim() || null,
      })),
  );

  const existingPending = db
    .prepare(
      `
        SELECT *
        FROM "ProjectRequest"
        WHERE jobId = ? AND professionalId = ? AND status = 'PENDING'
        ORDER BY datetime(updatedAt) DESC, id DESC
        LIMIT 1
      `,
    )
    .get(input.jobId, input.professionalId) as ProjectRequestRecord | undefined;

  if (existingPending) {
    db.prepare(
      `
        UPDATE "ProjectRequest"
        SET bidAmount = ?,
          duration = ?,
          coverLetter = ?,
          attachmentsJson = ?,
          updatedAt = ?
        WHERE id = ?
      `,
    ).run(bidAmount, duration, coverLetter, attachmentsJson, timestamp, existingPending.id);

    return getProjectRequestById(existingPending.id);
  }

  const result = db
    .prepare(
      `
      INSERT INTO "ProjectRequest" (
        jobId,
        clientId,
        professionalId,
        bidAmount,
        duration,
        coverLetter,
        attachmentsJson,
        status,
        createdAt,
        updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
    `,
    )
    .run(
      input.jobId,
      job.userId,
      input.professionalId,
      bidAmount,
      duration,
      coverLetter,
      attachmentsJson,
      timestamp,
      timestamp,
    );

  return getProjectRequestById(Number(result.lastInsertRowid));
}

function getProjectRequestById(requestId: number) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  return db
    .prepare(
      `
        SELECT *
        FROM "ProjectRequest"
        WHERE id = ?
        LIMIT 1
      `,
    )
    .get(requestId) as ProjectRequestRecord | undefined;
}

export function getProjectRequestByJobAndProfessional(jobId: number, professionalId: number) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  return db
    .prepare(
      `
        SELECT *
        FROM "ProjectRequest"
        WHERE jobId = ? AND professionalId = ?
        ORDER BY datetime(updatedAt) DESC, id DESC
        LIMIT 1
      `,
    )
    .get(jobId, professionalId) as ProjectRequestRecord | undefined;
}

export function getClientProjectRequests(clientId: number) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  return db
    .prepare(
      `
        SELECT
          ProjectRequest.*,
          ClientJob.title AS projectTitle,
          ClientJob.category AS projectCategory,
          ClientJob.budgetMin AS projectBudgetMin,
          ClientJob.budgetMax AS projectBudgetMax,
          TRIM(User.firstName || ' ' || User.lastName) AS professionalName,
          User.email AS professionalEmail,
          User.avatarUrl AS professionalAvatarUrl,
          User.professionalCategory AS professionalCategory,
          ProjectTracking.id AS trackingId,
          ProjectTracking.status AS trackingStatus,
          ProjectTracking.acceptedAt AS acceptedAt
        FROM "ProjectRequest"
        INNER JOIN "ClientJob" ON ClientJob.id = ProjectRequest.jobId
        INNER JOIN "User" ON User.id = ProjectRequest.professionalId
        LEFT JOIN "ProjectTracking" ON ProjectTracking.requestId = ProjectRequest.id
        WHERE ProjectRequest.clientId = ?
          AND ProjectRequest.status = 'PENDING'
          AND COALESCE(ProjectTracking.status, '') != 'CANCELLED'
        ORDER BY datetime(ProjectRequest.updatedAt) DESC, ProjectRequest.id DESC
      `,
    )
    .all(clientId) as ClientProjectRequestRecord[];
}

export function createProfessionalNegotiation(
  professionalId: number,
  input: ProjectNegotiationInput,
) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  const message = input.message.trim();
  const duration = input.duration.trim() || null;
  const bidAmount = input.bidAmount && input.bidAmount > 0 ? Math.round(input.bidAmount) : null;

  if (!message) {
    throw new Error("Negotiation message is required.");
  }

  const request = db
    .prepare(
      `
        SELECT *
        FROM "ProjectRequest"
        WHERE id = ? AND professionalId = ? AND status = 'PENDING'
        LIMIT 1
      `,
    )
    .get(input.requestId, professionalId) as ProjectRequestRecord | undefined;

  if (!request) {
    throw new Error("Only pending project requests can be negotiated.");
  }

  const timestamp = new Date().toISOString();

  db.prepare(
    `
      INSERT INTO "ProjectNegotiation" (
        requestId,
        jobId,
        clientId,
        professionalId,
        senderId,
        senderRole,
        previousBidAmount,
        previousDuration,
        previousMessage,
        bidAmount,
        duration,
        message,
        createdAt
      )
      VALUES (?, ?, ?, ?, ?, 'PROFESSIONAL', ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    request.id,
    request.jobId,
    request.clientId,
    request.professionalId,
    professionalId,
    request.bidAmount,
    request.duration,
    request.coverLetter,
    bidAmount,
    duration,
    message,
    timestamp,
  );

  db.prepare(
    `
      UPDATE "ProjectRequest"
      SET bidAmount = ?,
        duration = ?,
        coverLetter = ?,
        updatedAt = ?
      WHERE id = ?
    `,
  ).run(bidAmount, duration, message, timestamp, request.id);

  return getProjectRequestById(request.id);
}

export function getProjectNegotiationsForProfessional(professionalId: number) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  return db
    .prepare(
      `
        SELECT *
        FROM "ProjectNegotiation"
        WHERE professionalId = ?
        ORDER BY datetime(createdAt) ASC, id ASC
      `,
    )
    .all(professionalId) as ProjectNegotiationRecord[];
}

export function getProjectNegotiationsForClient(clientId: number) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  return db
    .prepare(
      `
        SELECT *
        FROM "ProjectNegotiation"
        WHERE clientId = ?
        ORDER BY datetime(createdAt) ASC, id ASC
      `,
    )
    .all(clientId) as ProjectNegotiationRecord[];
}

export function updateClientProjectRequestStatus(
  clientId: number,
  requestId: number,
  status: ProjectRequestStatus,
) {
  const db = getDatabase();
  ensureProjectRequestTables(db);
  const timestamp = new Date().toISOString();

  db.prepare(
    `
      UPDATE "ProjectRequest"
      SET status = ?, updatedAt = ?
      WHERE id = ? AND clientId = ?
    `,
  ).run(status, timestamp, requestId, clientId);

  if (status === "ACCEPTED") {
    const request = db
      .prepare(
        `
          SELECT *
          FROM "ProjectRequest"
          WHERE id = ? AND clientId = ?
          LIMIT 1
        `,
      )
      .get(requestId, clientId) as ProjectRequestRecord | undefined;

    if (request) {
      const schedule = getProjectSchedule(db, request.jobId);
      const startsAt = schedule.startAt || timestamp;

      db.prepare(
        `
          INSERT INTO "ProjectTracking" (
            requestId,
            jobId,
            clientId,
            professionalId,
            status,
            acceptedAt,
            createdAt,
            updatedAt
          )
          VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
          ON CONFLICT(requestId) DO UPDATE SET
            status = 'ACTIVE',
            updatedAt = excluded.updatedAt
        `,
      ).run(
        request.id,
        request.jobId,
        request.clientId,
        request.professionalId,
        startsAt,
        timestamp,
        timestamp,
      );

      db.prepare(
        `
          UPDATE "ClientJob"
          SET status = 'CLOSED', updatedAt = ?
          WHERE id = ? AND userId = ?
        `,
      ).run(timestamp, request.jobId, request.clientId);

      db.prepare(
        `
          UPDATE "ProjectRequest"
          SET status = 'DECLINED', updatedAt = ?
          WHERE jobId = ?
            AND clientId = ?
            AND id != ?
            AND status = 'PENDING'
        `,
      ).run(timestamp, request.jobId, request.clientId, request.id);
    }
  } else if (status === "DECLINED") {
    db.prepare(
      `
        UPDATE "ProjectTracking"
        SET status = 'CANCELLED', updatedAt = ?
        WHERE requestId = ? AND clientId = ?
      `,
    ).run(timestamp, requestId, clientId);
  }

  return db
    .prepare(
      `
        SELECT *
        FROM "ProjectRequest"
        WHERE id = ? AND clientId = ?
        LIMIT 1
      `,
    )
    .get(requestId, clientId) as ProjectRequestRecord | undefined;
}

export function getActiveProjectTrackingByJob(clientId: number, jobId: number) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  return db
    .prepare(
      `
        SELECT *
        FROM "ProjectTracking"
        WHERE clientId = ? AND jobId = ? AND status = 'ACTIVE'
        ORDER BY datetime(acceptedAt) DESC, id DESC
        LIMIT 1
      `,
    )
    .get(clientId, jobId) as ProjectTrackingRecord | undefined;
}

export function getProfessionalTrackedProjects(professionalId: number) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  return db
    .prepare(
      `
        SELECT
          ProjectTracking.*,
          COALESCE(ClientJob.title, ProjectRequest.coverLetter, 'Completed project') AS projectTitle,
          COALESCE(ClientJob.category, 'Project') AS projectCategory,
          COALESCE(ClientJob.deadline, ProjectTracking.updatedAt) AS deadline,
          TRIM(User.firstName || ' ' || User.lastName) AS clientName,
          User.avatarUrl AS clientAvatarUrl,
          ProjectRequest.bidAmount AS bidAmount,
          ProjectRequest.duration AS duration,
          COALESCE(ProjectRequest.coverLetter, '') AS coverLetter,
          ProjectReview.rating AS reviewRating,
          ProjectReview.comment AS reviewComment,
          ProjectReview.professionalResponse AS reviewResponse,
          ProjectReview.professionalResponseAt AS reviewResponseAt,
          ProjectReview.createdAt AS reviewCreatedAt,
          ProjectReviewRequest.createdAt AS reviewRequestedAt,
          ProjectReviewRequest.note AS reviewRequestNote
        FROM "ProjectTracking"
        LEFT JOIN "ClientJob" ON ClientJob.id = ProjectTracking.jobId
        LEFT JOIN "ProjectRequest" ON ProjectRequest.id = ProjectTracking.requestId
        INNER JOIN "User" ON User.id = ProjectTracking.clientId
        LEFT JOIN "ProjectReview" ON ProjectReview.trackingId = ProjectTracking.id
        LEFT JOIN "ProjectReviewRequest" ON ProjectReviewRequest.trackingId = ProjectTracking.id
        WHERE ProjectTracking.professionalId = ?
          AND ProjectTracking.status IN ('ACTIVE', 'COMPLETED')
        ORDER BY datetime(ProjectTracking.acceptedAt) DESC, ProjectTracking.id DESC
      `,
    )
    .all(professionalId) as ProfessionalTrackedProjectRecord[];
}

export function getClientTrackedProjects(clientId: number) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  return db
    .prepare(
      `
        SELECT
          ProjectTracking.*,
          COALESCE(ClientJob.title, ProjectRequest.coverLetter, 'Completed project') AS projectTitle,
          COALESCE(ClientJob.category, 'Project') AS projectCategory,
          COALESCE(ClientJob.deadline, ProjectTracking.updatedAt) AS deadline,
          TRIM(User.firstName || ' ' || User.lastName) AS professionalName,
          User.avatarUrl AS professionalAvatarUrl,
          User.professionalCategory AS professionalCategory,
          ProjectRequest.bidAmount AS bidAmount,
          ProjectRequest.duration AS duration,
          COALESCE(ProjectRequest.coverLetter, '') AS coverLetter,
          ProjectReview.rating AS reviewRating,
          ProjectReview.comment AS reviewComment,
          ProjectReview.professionalResponse AS reviewResponse,
          ProjectReview.professionalResponseAt AS reviewResponseAt,
          ProjectReview.createdAt AS reviewCreatedAt,
          ProjectReviewRequest.createdAt AS reviewRequestedAt,
          ProjectReviewRequest.note AS reviewRequestNote
        FROM "ProjectTracking"
        LEFT JOIN "ClientJob" ON ClientJob.id = ProjectTracking.jobId
        LEFT JOIN "ProjectRequest" ON ProjectRequest.id = ProjectTracking.requestId
        INNER JOIN "User" ON User.id = ProjectTracking.professionalId
        LEFT JOIN "ProjectReview" ON ProjectReview.trackingId = ProjectTracking.id
        LEFT JOIN "ProjectReviewRequest" ON ProjectReviewRequest.trackingId = ProjectTracking.id
        WHERE ProjectTracking.clientId = ?
          AND ProjectTracking.status IN ('ACTIVE', 'COMPLETED')
        ORDER BY
          CASE ProjectTracking.status WHEN 'ACTIVE' THEN 0 ELSE 1 END,
          datetime(ProjectTracking.updatedAt) DESC,
          ProjectTracking.id DESC
      `,
    )
    .all(clientId) as ClientTrackedProjectRecord[];
}

export function cancelProjectTracking(userId: number, trackingId: number) {
  const db = getDatabase();
  ensureProjectRequestTables(db);
  const timestamp = new Date().toISOString();

  const cancelProject = db.transaction(() => {
    const result = db
      .prepare(
        `
          UPDATE "ProjectTracking"
          SET status = 'CANCELLED', updatedAt = ?
          WHERE id = ?
            AND status = 'ACTIVE'
            AND (clientId = ? OR professionalId = ?)
        `,
      )
      .run(timestamp, trackingId, userId, userId);

    if (!result.changes) {
      throw new Error("Only active projects can be cancelled by project participants.");
    }

    db.prepare(
      `
        UPDATE "ProjectTransaction"
        SET status = 'CANCELLED', updatedAt = ?
        WHERE trackingId = ? AND status = 'COMPLETED'
      `,
    ).run(timestamp, trackingId);
  });

  cancelProject();

  return db
    .prepare(
      `
        SELECT *
        FROM "ProjectTracking"
        WHERE id = ?
        LIMIT 1
      `,
    )
    .get(trackingId) as ProjectTrackingRecord | undefined;
}

export function rateCompletedProject(
  clientId: number,
  input: { trackingId: number; rating: number; comment?: string | null },
) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  const rating = Math.max(1, Math.min(5, Math.round(input.rating)));
  const comment = input.comment?.trim() || null;

  const tracking = db
    .prepare(
      `
        SELECT *
        FROM "ProjectTracking"
        WHERE id = ? AND clientId = ? AND status = 'COMPLETED'
        LIMIT 1
      `,
    )
    .get(input.trackingId, clientId) as ProjectTrackingRecord | undefined;

  if (!tracking) {
    throw new Error("Only completed projects can be rated by the client.");
  }

  const existing = db
    .prepare(`SELECT * FROM "ProjectReview" WHERE trackingId = ? LIMIT 1`)
    .get(tracking.id) as ProjectReviewRecord | undefined;
  const timestamp = new Date().toISOString();

  if (existing) {
    db.prepare(
      `
        UPDATE "ProjectReview"
        SET rating = ?, comment = ?, updatedAt = ?
        WHERE id = ?
      `,
    ).run(rating, comment, timestamp, existing.id);
  } else {
    db.prepare(
      `
        INSERT INTO "ProjectReview" (
          trackingId,
          clientId,
          professionalId,
          rating,
          comment,
          createdAt,
          updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      tracking.id,
      tracking.clientId,
      tracking.professionalId,
      rating,
      comment,
      timestamp,
      timestamp,
    );
  }

  refreshProfessionalRating(db, tracking.professionalId);

  return db
    .prepare(`SELECT * FROM "ProjectReview" WHERE trackingId = ? LIMIT 1`)
    .get(tracking.id) as ProjectReviewRecord;
}

export function requestProjectReviewFromClient(
  professionalId: number,
  input: { trackingId: number; note?: string | null },
) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  const tracking = db
    .prepare(
      `
        SELECT *
        FROM "ProjectTracking"
        WHERE id = ? AND professionalId = ? AND status = 'COMPLETED'
        LIMIT 1
      `,
    )
    .get(input.trackingId, professionalId) as ProjectTrackingRecord | undefined;

  if (!tracking) {
    throw new Error("Only completed projects can request client reviews.");
  }

  const existingReview = db
    .prepare(`SELECT * FROM "ProjectReview" WHERE trackingId = ? LIMIT 1`)
    .get(tracking.id) as ProjectReviewRecord | undefined;

  if (existingReview) {
    throw new Error("Client already reviewed this project.");
  }

  const timestamp = new Date().toISOString();
  const note = input.note?.trim() || null;

  db.prepare(
    `
      INSERT INTO "ProjectReviewRequest" (
        trackingId,
        clientId,
        professionalId,
        note,
        createdAt,
        updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(trackingId) DO UPDATE SET
        note = excluded.note,
        updatedAt = excluded.updatedAt
    `,
  ).run(tracking.id, tracking.clientId, tracking.professionalId, note, timestamp, timestamp);

  return db
    .prepare(`SELECT * FROM "ProjectReviewRequest" WHERE trackingId = ? LIMIT 1`)
    .get(tracking.id) as ProjectReviewRequestRecord;
}

export function respondToProjectReview(
  professionalId: number,
  input: { trackingId: number; response: string },
) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  const response = input.response.trim();

  if (response.length < 2) {
    throw new Error("Write a short response before saving.");
  }

  if (response.length > 1000) {
    throw new Error("Review response must be 1000 characters or less.");
  }

  const review = db
    .prepare(
      `
        SELECT *
        FROM "ProjectReview"
        WHERE trackingId = ? AND professionalId = ?
        LIMIT 1
      `,
    )
    .get(input.trackingId, professionalId) as ProjectReviewRecord | undefined;

  if (!review) {
    throw new Error("Only reviewed projects assigned to you can be responded to.");
  }

  const timestamp = new Date().toISOString();

  db.prepare(
    `
      UPDATE "ProjectReview"
      SET professionalResponse = ?, professionalResponseAt = ?, updatedAt = ?
      WHERE id = ?
    `,
  ).run(response, timestamp, timestamp, review.id);

  return db
    .prepare(`SELECT * FROM "ProjectReview" WHERE id = ? LIMIT 1`)
    .get(review.id) as ProjectReviewRecord;
}

function refreshProfessionalRating(db: BetterSqlite3Database, professionalId: number) {
  const summary = db
    .prepare(
      `
        SELECT COALESCE(AVG(rating), 0) AS averageRating, COUNT(*) AS reviewCount
        FROM "ProjectReview"
        WHERE professionalId = ?
      `,
    )
    .get(professionalId) as { averageRating: number; reviewCount: number };

  db.prepare(
    `
      UPDATE "User"
      SET averageRating = ?, reviewCount = ?, updatedAt = ?
      WHERE id = ?
    `,
  ).run(
    Number(summary.averageRating || 0),
    Number(summary.reviewCount || 0),
    new Date().toISOString(),
    professionalId,
  );
}

export function getProfessionalTransactions(professionalId: number) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  return db
    .prepare(
      `
        SELECT
          ProjectTransaction.*,
          COALESCE(ClientJob.title, ProjectTransaction.description, 'Project payment') AS projectTitle,
          COALESCE(ClientJob.category, 'Project') AS projectCategory
        FROM "ProjectTransaction"
        LEFT JOIN "ProjectTracking" ON ProjectTracking.id = ProjectTransaction.trackingId
        LEFT JOIN "ClientJob" ON ClientJob.id = ProjectTracking.jobId
        WHERE ProjectTransaction.professionalId = ?
          AND ProjectTransaction.status = 'COMPLETED'
          AND COALESCE(ProjectTracking.status, '') != 'CANCELLED'
        ORDER BY datetime(ProjectTransaction.createdAt) DESC, ProjectTransaction.id DESC
      `,
    )
    .all(professionalId) as ProjectTransactionRecord[];
}

export function getUserProjectTransactions(userId: number) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  return db
    .prepare(
      `
        SELECT
          ProjectTransaction.*,
          COALESCE(ClientJob.title, ProjectTransaction.description, 'Project payment') AS projectTitle,
          COALESCE(ClientJob.category, 'Project') AS projectCategory
        FROM "ProjectTransaction"
        LEFT JOIN "ProjectTracking" ON ProjectTracking.id = ProjectTransaction.trackingId
        LEFT JOIN "ClientJob" ON ClientJob.id = ProjectTracking.jobId
        WHERE (ProjectTransaction.clientId = ? OR ProjectTransaction.professionalId = ?)
          AND ProjectTransaction.status = 'COMPLETED'
          AND COALESCE(ProjectTracking.status, '') != 'CANCELLED'
        ORDER BY datetime(ProjectTransaction.createdAt) DESC, ProjectTransaction.id DESC
      `,
    )
    .all(userId, userId) as ProjectTransactionRecord[];
}

export function getProfessionalWithdrawals(professionalId: number) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  return db
    .prepare(
      `
        SELECT *
        FROM "ProjectWithdrawal"
        WHERE professionalId = ?
        ORDER BY datetime(createdAt) DESC, id DESC
      `,
    )
    .all(professionalId) as ProjectWithdrawalRecord[];
}

export function getProfessionalAvailableWithdrawalBalance(professionalId: number) {
  const transactions = getProfessionalTransactions(professionalId);
  const withdrawals = getProfessionalWithdrawals(professionalId);
  const earned = transactions.reduce(
    (total, transaction) => total + Math.round(transaction.amount * 0.9),
    0,
  );
  const alreadyRequested = withdrawals
    .filter((withdrawal) => withdrawal.status !== "REJECTED")
    .reduce((total, withdrawal) => total + withdrawal.amount, 0);

  return Math.max(0, earned - alreadyRequested);
}

export function createProfessionalWithdrawalRequest(
  professionalId: number,
  input: ProjectWithdrawalInput,
) {
  const amount = Math.round(Number(input.amount));
  const destinationLabel = input.destinationLabel.trim();
  const note = input.note?.trim() || null;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a withdrawal amount greater than zero.");
  }

  if (!destinationLabel) {
    throw new Error("Add bank, UPI, or wallet details for this withdrawal.");
  }

  if (!["BANK", "UPI", "WALLET"].includes(input.destinationType)) {
    throw new Error("Select a valid withdrawal method.");
  }

  const availableBalance = getProfessionalAvailableWithdrawalBalance(professionalId);

  if (amount > availableBalance) {
    throw new Error("Withdrawal amount cannot be more than your available balance.");
  }

  const db = getDatabase();
  ensureProjectRequestTables(db);

  const timestamp = new Date().toISOString();
  const result = db
    .prepare(
      `
        INSERT INTO "ProjectWithdrawal" (
          professionalId,
          amount,
          currency,
          destinationType,
          destinationLabel,
          status,
          note,
          createdAt,
          updatedAt
        )
        VALUES (?, ?, 'USD', ?, ?, 'PENDING', ?, ?, ?)
      `,
    )
    .run(
      professionalId,
      amount,
      input.destinationType,
      destinationLabel,
      note,
      timestamp,
      timestamp,
    );

  return db
    .prepare(`SELECT * FROM "ProjectWithdrawal" WHERE id = ? LIMIT 1`)
    .get(result.lastInsertRowid) as ProjectWithdrawalRecord;
}

export function getProfessionalProjectRequests(professionalId: number) {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  return db
    .prepare(
      `
        SELECT
          ProjectRequest.*,
          ClientJob.title AS projectTitle,
          ClientJob.category AS projectCategory,
          ClientJob.deadline AS deadline,
          TRIM(User.firstName || ' ' || User.lastName) AS clientName,
          User.avatarUrl AS clientAvatarUrl,
          ProjectTracking.id AS trackingId,
          ProjectTracking.status AS trackingStatus,
          ProjectTracking.acceptedAt AS acceptedAt,
          ProjectReview.rating AS reviewRating,
          ProjectReview.comment AS reviewComment,
          ProjectReview.professionalResponse AS reviewResponse,
          ProjectReview.professionalResponseAt AS reviewResponseAt,
          ProjectReview.createdAt AS reviewCreatedAt,
          ProjectReviewRequest.createdAt AS reviewRequestedAt,
          ProjectReviewRequest.note AS reviewRequestNote
        FROM "ProjectRequest"
        INNER JOIN "ClientJob" ON ClientJob.id = ProjectRequest.jobId
        INNER JOIN "User" ON User.id = ProjectRequest.clientId
        LEFT JOIN "ProjectTracking" ON ProjectTracking.requestId = ProjectRequest.id
        LEFT JOIN "ProjectReview" ON ProjectReview.trackingId = ProjectTracking.id
        LEFT JOIN "ProjectReviewRequest" ON ProjectReviewRequest.trackingId = ProjectTracking.id
        LEFT JOIN contracts ON contracts.tracking_id = ProjectTracking.id
        WHERE ProjectRequest.professionalId = ?
          AND COALESCE(ProjectTracking.status, '') != 'CANCELLED'
          AND contracts.id IS NULL
          AND NOT (
            ProjectRequest.status = 'ACCEPTED'
            AND ProjectTracking.status IN ('ACTIVE', 'COMPLETED')
          )
          AND NOT (
            ProjectRequest.status = 'DECLINED'
            AND COALESCE(julianday(ProjectRequest.updatedAt), julianday(ProjectRequest.createdAt)) <= julianday('now', '-24 hours')
          )
        ORDER BY datetime(ProjectRequest.updatedAt) DESC, ProjectRequest.id DESC
      `,
    )
    .all(professionalId) as ProfessionalProjectRequestRecord[];
}

export function getProjectTrackingDetails(
  userId: number,
  trackingId: number,
): ProjectTrackingDetailsRecord | undefined {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  const tracking = db
    .prepare(
      `
        SELECT
          ProjectTracking.*,
          COALESCE(ClientJob.title, ProjectRequest.coverLetter, 'Completed project') AS projectTitle,
          COALESCE(ClientJob.category, 'Project') AS projectCategory,
          COALESCE(ClientJob.description, '') AS projectDescription,
          ClientJob.budgetMin AS projectBudgetMin,
          ClientJob.budgetMax AS projectBudgetMax,
          ClientJob.timingType AS projectTimingType,
          COALESCE(ClientJob.urgency, 'MEDIUM') AS projectUrgency,
          ClientJob.jobDate AS projectJobDate,
          COALESCE(ClientJob.deadline, ProjectTracking.updatedAt) AS projectDeadline,
          COALESCE(ClientJob.workMode, 'REMOTE') AS projectWorkMode,
          ClientJob.locationLabel AS projectLocationLabel,
          ClientJob.locationAddress AS projectLocationAddress,
          TRIM(ClientUser.firstName || ' ' || ClientUser.lastName) AS clientName,
          ClientUser.avatarUrl AS clientAvatarUrl,
          TRIM(ProUser.firstName || ' ' || ProUser.lastName) AS professionalName,
          ProUser.avatarUrl AS professionalAvatarUrl,
          ProUser.professionalCategory AS professionalCategory,
          ProUser.email AS professionalEmail,
          ProjectRequest.bidAmount AS bidAmount,
          ProjectRequest.duration AS duration,
          COALESCE(ProjectRequest.coverLetter, '') AS coverLetter,
          ProjectRequest.attachmentsJson AS attachmentsJson,
          COALESCE(ProjectRequest.status, 'ACCEPTED') AS requestStatus,
          COALESCE(ProjectRequest.createdAt, ProjectTracking.createdAt) AS requestCreatedAt,
          COALESCE(ProjectRequest.updatedAt, ProjectTracking.updatedAt) AS requestUpdatedAt,
          ProjectReview.rating AS reviewRating,
          ProjectReview.comment AS reviewComment,
          ProjectReview.professionalResponse AS reviewResponse,
          ProjectReview.professionalResponseAt AS reviewResponseAt,
          ProjectReview.createdAt AS reviewCreatedAt,
          ProjectReviewRequest.createdAt AS reviewRequestedAt,
          ProjectReviewRequest.note AS reviewRequestNote
        FROM "ProjectTracking"
        LEFT JOIN "ClientJob" ON ClientJob.id = ProjectTracking.jobId
        LEFT JOIN "ProjectRequest" ON ProjectRequest.id = ProjectTracking.requestId
        INNER JOIN "User" ClientUser ON ClientUser.id = ProjectTracking.clientId
        INNER JOIN "User" ProUser ON ProUser.id = ProjectTracking.professionalId
        LEFT JOIN "ProjectReview" ON ProjectReview.trackingId = ProjectTracking.id
        LEFT JOIN "ProjectReviewRequest" ON ProjectReviewRequest.trackingId = ProjectTracking.id
        WHERE ProjectTracking.id = ?
          AND ProjectTracking.status != 'CANCELLED'
          AND (ProjectTracking.clientId = ? OR ProjectTracking.professionalId = ?)
        LIMIT 1
      `,
    )
    .get(trackingId, userId, userId) as
    | Omit<
        ProjectTrackingDetailsRecord,
        | "workUploads"
        | "revisionRequests"
        | "milestones"
        | "completionRequests"
        | "transactions"
        | "disputes"
      >
    | undefined;

  return withTrackingActivity(tracking);
}

export function getOrCreateProjectTrackingDetails(
  userId: number,
  trackingKey: number,
): ProjectTrackingDetailsRecord | null {
  const existing =
    getProjectTrackingDetails(userId, trackingKey) ??
    getProjectTrackingDetailsByJob(userId, trackingKey);

  if (existing) {
    return existing;
  }

  const db = getDatabase();
  ensureProjectRequestTables(db);

  const request = db
    .prepare(
      `
        SELECT *
        FROM "ProjectRequest"
        WHERE status = 'ACCEPTED'
          AND (id = ? OR jobId = ?)
          AND (clientId = ? OR professionalId = ?)
        ORDER BY datetime(updatedAt) DESC, id DESC
        LIMIT 1
      `,
    )
    .get(trackingKey, trackingKey, userId, userId) as ProjectRequestRecord | undefined;

  if (!request) {
    return null;
  }

  const timestamp = request.updatedAt || new Date().toISOString();
  const schedule = getProjectSchedule(db, request.jobId);
  const startsAt = schedule.startAt || timestamp;

  db.prepare(
    `
      INSERT INTO "ProjectTracking" (
        requestId,
        jobId,
        clientId,
        professionalId,
        status,
        acceptedAt,
        createdAt,
        updatedAt
      )
      VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
      ON CONFLICT(requestId) DO UPDATE SET
        status = 'ACTIVE',
        updatedAt = excluded.updatedAt
    `,
  ).run(
    request.id,
    request.jobId,
    request.clientId,
    request.professionalId,
    startsAt,
    timestamp,
    timestamp,
  );

  return (
    getProjectTrackingDetailsByJob(userId, request.jobId) ??
    getProjectTrackingDetails(userId, trackingKey) ??
    null
  );
}

function getProjectSchedule(db: BetterSqlite3Database, jobId: number) {
  const row = db
    .prepare(
      `
        SELECT jobDate, deadline
        FROM "ClientJob"
        WHERE id = ?
        LIMIT 1
      `,
    )
    .get(jobId) as { jobDate: string | null; deadline: string | null } | undefined;

  return {
    startAt: normalizeScheduleDate(row?.jobDate) || null,
    endAt: normalizeScheduleDate(row?.deadline) || null,
  };
}

function normalizeScheduleDate(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const dateOnly = trimmed.match(/^\d{4}-\d{2}-\d{2}/)?.[0];

  if (!dateOnly) {
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return new Date(
      Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()),
    ).toISOString();
  }

  return new Date(`${dateOnly}T00:00:00.000Z`).toISOString();
}

function compareScheduleDates(a: string, b: string) {
  return new Date(a).getTime() - new Date(b).getTime();
}

export function getProjectTrackingDetailsByJob(
  userId: number,
  jobId: number,
): ProjectTrackingDetailsRecord | undefined {
  const db = getDatabase();
  ensureProjectRequestTables(db);

  const tracking = db
    .prepare(
      `
        SELECT
          ProjectTracking.*,
          COALESCE(ClientJob.title, ProjectRequest.coverLetter, 'Completed project') AS projectTitle,
          COALESCE(ClientJob.category, 'Project') AS projectCategory,
          COALESCE(ClientJob.description, '') AS projectDescription,
          ClientJob.budgetMin AS projectBudgetMin,
          ClientJob.budgetMax AS projectBudgetMax,
          ClientJob.timingType AS projectTimingType,
          COALESCE(ClientJob.urgency, 'MEDIUM') AS projectUrgency,
          ClientJob.jobDate AS projectJobDate,
          COALESCE(ClientJob.deadline, ProjectTracking.updatedAt) AS projectDeadline,
          COALESCE(ClientJob.workMode, 'REMOTE') AS projectWorkMode,
          ClientJob.locationLabel AS projectLocationLabel,
          ClientJob.locationAddress AS projectLocationAddress,
          TRIM(ClientUser.firstName || ' ' || ClientUser.lastName) AS clientName,
          ClientUser.avatarUrl AS clientAvatarUrl,
          TRIM(ProUser.firstName || ' ' || ProUser.lastName) AS professionalName,
          ProUser.avatarUrl AS professionalAvatarUrl,
          ProUser.professionalCategory AS professionalCategory,
          ProUser.email AS professionalEmail,
          ProjectRequest.bidAmount AS bidAmount,
          ProjectRequest.duration AS duration,
          COALESCE(ProjectRequest.coverLetter, '') AS coverLetter,
          ProjectRequest.attachmentsJson AS attachmentsJson,
          COALESCE(ProjectRequest.status, 'ACCEPTED') AS requestStatus,
          COALESCE(ProjectRequest.createdAt, ProjectTracking.createdAt) AS requestCreatedAt,
          COALESCE(ProjectRequest.updatedAt, ProjectTracking.updatedAt) AS requestUpdatedAt,
          ProjectReview.rating AS reviewRating,
          ProjectReview.comment AS reviewComment,
          ProjectReview.professionalResponse AS reviewResponse,
          ProjectReview.professionalResponseAt AS reviewResponseAt,
          ProjectReview.createdAt AS reviewCreatedAt,
          ProjectReviewRequest.createdAt AS reviewRequestedAt,
          ProjectReviewRequest.note AS reviewRequestNote
        FROM "ProjectTracking"
        LEFT JOIN "ClientJob" ON ClientJob.id = ProjectTracking.jobId
        LEFT JOIN "ProjectRequest" ON ProjectRequest.id = ProjectTracking.requestId
        INNER JOIN "User" ClientUser ON ClientUser.id = ProjectTracking.clientId
        INNER JOIN "User" ProUser ON ProUser.id = ProjectTracking.professionalId
        LEFT JOIN "ProjectReview" ON ProjectReview.trackingId = ProjectTracking.id
        LEFT JOIN "ProjectReviewRequest" ON ProjectReviewRequest.trackingId = ProjectTracking.id
        WHERE ProjectTracking.jobId = ?
          AND ProjectTracking.status = 'ACTIVE'
          AND (ProjectTracking.clientId = ? OR ProjectTracking.professionalId = ?)
        ORDER BY datetime(ProjectTracking.acceptedAt) DESC, ProjectTracking.id DESC
        LIMIT 1
      `,
    )
    .get(jobId, userId, userId) as
    | Omit<
        ProjectTrackingDetailsRecord,
        | "workUploads"
        | "revisionRequests"
        | "milestones"
        | "completionRequests"
        | "transactions"
        | "disputes"
      >
    | undefined;

  return withTrackingActivity(tracking);
}
