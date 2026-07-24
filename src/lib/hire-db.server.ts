import { randomUUID } from "node:crypto";
import path from "node:path";
import Database from "better-sqlite3";

type BetterSqlite3Database = InstanceType<typeof Database>;

export type HireAttachmentInput = {
  fileName: string;
  fileType?: string;
  fileSize?: number;
  fileUrl?: string;
};

export type HireMilestoneInput = {
  title: string;
  amount: number | null;
};

export type HireContractInput = {
  professionalId: number;
  clientProjectId?: number | null;
  hiringTeam: string;
  contractTitle: string;
  workDescription: string;
  jobDate: string;
  deadline: string;
  workMode: "onsite" | "remote" | "both";
  location: string;
  paymentOption: "hourly" | "fixed";
  hourlyRate: number | null;
  fixedPrice: number | null;
  paymentSchedule: "whole" | "milestones";
  acceptedTerms: boolean;
  attachments: HireAttachmentInput[];
  milestones: HireMilestoneInput[];
};

export type HireContractStatus = "pending" | "accepted" | "rejected" | "started" | "cancelled";

export type ProfessionalHireRequestRecord = {
  contractId: string;
  jobId: string;
  clientProjectId: number | null;
  trackingId: number | null;
  clientId: string;
  professionalId: string;
  totalAmount: number | null;
  platformFee: number | null;
  status: HireContractStatus;
  startDate: string | null;
  endDate: string | null;
  updatedAt: string | null;
  title: string;
  description: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  workMode: string | null;
  location: string | null;
  jobDate: string | null;
  deadline: string | null;
  createdAt: string;
  clientName: string | null;
  clientAvatarUrl: string | null;
  attachmentsJson: string | null;
  milestonesJson: string | null;
};

export type ClientHireRequestRecord = ProfessionalHireRequestRecord & {
  professionalName: string | null;
  professionalAvatarUrl: string | null;
  professionalCategory: string | null;
};

export type DirectHireNegotiationRecord = {
  id: number;
  contractId: string;
  jobId: string;
  clientId: string;
  professionalId: string;
  senderId: string;
  senderRole: "PROFESSIONAL" | "CLIENT";
  bidAmount: number | null;
  duration: string | null;
  message: string;
  createdAt: string;
};

export type DirectHireNegotiationInput = {
  contractId: string;
  bidAmount: number | null;
  duration: string;
  message: string;
};

const globalForHireDb = globalThis as typeof globalThis & {
  hireDb?: BetterSqlite3Database;
};

function getDatabase() {
  if (!globalForHireDb.hireDb) {
    const databasePath = path.resolve(process.cwd(), "prisma", "app.db");
    globalForHireDb.hireDb = new Database(databasePath);
  }

  ensureHireTables(globalForHireDb.hireDb);
  return globalForHireDb.hireDb;
}

function ensureHireTables(db: BetterSqlite3Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "jobs" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "client_id" TEXT NOT NULL,
      "category_id" INTEGER,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "budget_min" REAL,
      "budget_max" REAL,
      "currency" TEXT NOT NULL DEFAULT 'INR',
      "job_type" TEXT,
      "lat" REAL,
      "lng" REAL,
      "city" TEXT,
      "job_date" TEXT,
      "deadline" TEXT,
      "urgency" TEXT,
      "status" TEXT NOT NULL DEFAULT 'draft',
      "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "job_attachments" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "job_id" TEXT NOT NULL,
      "file_url" TEXT,
      "file_type" TEXT,
      "uploaded_by" TEXT
    );

    CREATE TABLE IF NOT EXISTS "contracts" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "job_id" TEXT NOT NULL,
      "client_id" TEXT NOT NULL,
      "professional_id" TEXT NOT NULL,
      "proposal_id" TEXT,
      "client_project_id" INTEGER,
      "tracking_id" INTEGER,
      "total_amount" REAL,
      "platform_fee" REAL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "start_date" TEXT,
      "end_date" TEXT,
      "updated_at" TEXT
    );

    CREATE TABLE IF NOT EXISTS "milestones" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "contract_id" TEXT NOT NULL,
      "title" TEXT,
      "amount" REAL,
      "due_date" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "completed_proof" TEXT
    );

    CREATE TABLE IF NOT EXISTS "SocketConversation" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userAId" INTEGER NOT NULL,
      "userBId" INTEGER NOT NULL,
      "userAName" TEXT NOT NULL,
      "userBName" TEXT NOT NULL,
      "userAAvatarUrl" TEXT,
      "userBAvatarUrl" TEXT,
      "job" TEXT NOT NULL DEFAULT 'Direct message',
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "SocketMessage" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "conversationId" TEXT NOT NULL,
      "senderId" INTEGER NOT NULL,
      "receiverId" INTEGER NOT NULL,
      "body" TEXT NOT NULL,
      "kind" TEXT NOT NULL DEFAULT 'text',
      "createdAt" TEXT NOT NULL
    );

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
      "updatedAt" TEXT NOT NULL
    );

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

    CREATE TABLE IF NOT EXISTS "DirectHireNegotiation" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "contractId" TEXT NOT NULL,
      "jobId" TEXT NOT NULL,
      "clientId" TEXT NOT NULL,
      "professionalId" TEXT NOT NULL,
      "senderId" TEXT NOT NULL,
      "senderRole" TEXT NOT NULL,
      "bidAmount" REAL,
      "duration" TEXT,
      "message" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "DirectHireNegotiation_contractId_idx" ON "DirectHireNegotiation"("contractId");
    CREATE INDEX IF NOT EXISTS "DirectHireNegotiation_professionalId_idx" ON "DirectHireNegotiation"("professionalId");
  `);

  const contractColumns = new Set(
    (
      db.prepare(`PRAGMA table_info("contracts")`).all() as Array<{
        name: string;
      }>
    ).map((column) => column.name),
  );

  if (!contractColumns.has("updated_at")) {
    db.exec(`ALTER TABLE "contracts" ADD COLUMN "updated_at" TEXT`);
  }

  if (!contractColumns.has("client_project_id")) {
    db.exec(`ALTER TABLE "contracts" ADD COLUMN "client_project_id" INTEGER`);
  }

  if (!contractColumns.has("tracking_id")) {
    db.exec(`ALTER TABLE "contracts" ADD COLUMN "tracking_id" INTEGER`);
  }
}

function normalizeDate(value: string) {
  return value.trim() || null;
}

export function createHireContract(clientId: number, input: HireContractInput) {
  if (!input.acceptedTerms) {
    throw new Error("Please accept the terms and conditions.");
  }

  if (!input.contractTitle.trim()) {
    throw new Error("Contract title is required.");
  }

  if (!input.workDescription.trim()) {
    throw new Error("Work description is required.");
  }

  const db = getDatabase();
  const timestamp = new Date().toISOString();
  const jobId = randomUUID();
  const contractId = randomUUID();
  const totalAmount = input.paymentOption === "fixed" ? input.fixedPrice : null;
  const platformFee = totalAmount != null ? Number((totalAmount * 0.1).toFixed(2)) : null;
  const clientProjectId = input.clientProjectId ?? null;

  if (clientProjectId != null) {
    const project = db
      .prepare(
        `
          SELECT id
          FROM "ClientJob"
          WHERE id = ? AND userId = ?
          LIMIT 1
        `,
      )
      .get(clientProjectId, clientId) as { id: number } | undefined;

    if (!project) {
      throw new Error("Selected project was not found.");
    }
  }

  const createRecord = db.transaction(() => {
    db.prepare(
      `
        INSERT INTO "jobs" (
          id,
          client_id,
          title,
          description,
          budget_min,
          budget_max,
          currency,
          job_type,
          city,
          job_date,
          deadline,
          urgency,
          status,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      jobId,
      String(clientId),
      input.contractTitle.trim(),
      input.workDescription.trim(),
      input.paymentOption === "hourly" ? input.hourlyRate : input.fixedPrice,
      input.paymentOption === "hourly" ? input.hourlyRate : input.fixedPrice,
      "INR",
      input.workMode,
      input.location.trim() || null,
      normalizeDate(input.jobDate),
      normalizeDate(input.deadline),
      "medium",
      "draft",
      timestamp,
    );

    const insertAttachment = db.prepare(
      `
        INSERT INTO "job_attachments" (
          id,
          job_id,
          file_url,
          file_type,
          uploaded_by
        )
        VALUES (?, ?, ?, ?, ?)
      `,
    );

    for (const attachment of input.attachments) {
      insertAttachment.run(
        randomUUID(),
        jobId,
        attachment.fileUrl?.trim() || attachment.fileName.trim(),
        attachment.fileType?.trim() || "document",
        String(clientId),
      );
    }

    db.prepare(
      `
        INSERT INTO "contracts" (
          id,
          job_id,
          client_id,
          professional_id,
          client_project_id,
          total_amount,
          platform_fee,
          status,
          start_date,
          end_date,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      contractId,
      jobId,
      String(clientId),
      String(input.professionalId),
      clientProjectId,
      totalAmount,
      platformFee,
      "pending",
      normalizeDate(input.jobDate),
      normalizeDate(input.deadline),
      timestamp,
    );

    const insertMilestone = db.prepare(
      `
        INSERT INTO "milestones" (
          id,
          contract_id,
          title,
          amount,
          due_date,
          status,
          completed_proof
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    );

    const milestones =
      input.paymentSchedule === "milestones"
        ? input.milestones.filter((milestone) => milestone.title.trim())
        : [{ title: "Whole contract", amount: totalAmount }];

    for (const milestone of milestones) {
      insertMilestone.run(
        randomUUID(),
        contractId,
        milestone.title.trim(),
        milestone.amount,
        normalizeDate(input.deadline),
        "pending",
        null,
      );
    }
  });

  createRecord();

  return {
    jobId,
    contractId,
  };
}

export function getProfessionalHireRequests(professionalId: number) {
  const db = getDatabase();

  return db
    .prepare(
      `
        SELECT
          contracts.id AS contractId,
          contracts.job_id AS jobId,
          contracts.client_project_id AS clientProjectId,
          contracts.tracking_id AS trackingId,
          contracts.client_id AS clientId,
          contracts.professional_id AS professionalId,
          contracts.total_amount AS totalAmount,
          contracts.platform_fee AS platformFee,
          contracts.status AS status,
          contracts.start_date AS startDate,
          contracts.end_date AS endDate,
          contracts.updated_at AS updatedAt,
          jobs.title AS title,
          jobs.description AS description,
          jobs.budget_min AS budgetMin,
          jobs.budget_max AS budgetMax,
          jobs.job_type AS workMode,
          jobs.city AS location,
          jobs.job_date AS jobDate,
          jobs.deadline AS deadline,
          jobs.created_at AS createdAt,
          TRIM(User.firstName || ' ' || User.lastName) AS clientName,
          CASE WHEN User.avatarUrl LIKE 'data:%' THEN NULL ELSE User.avatarUrl END AS clientAvatarUrl,
          (
            SELECT json_group_array(json_object(
              'fileUrl', job_attachments.file_url,
              'fileType', job_attachments.file_type
            ))
            FROM job_attachments
            WHERE job_attachments.job_id = contracts.job_id
          ) AS attachmentsJson,
          (
            SELECT json_group_array(json_object(
              'title', milestones.title,
              'amount', milestones.amount,
              'dueDate', milestones.due_date,
              'status', milestones.status
            ))
            FROM milestones
            WHERE milestones.contract_id = contracts.id
          ) AS milestonesJson
        FROM contracts
        INNER JOIN jobs ON jobs.id = contracts.job_id
        LEFT JOIN "User" ON User.id = CAST(contracts.client_id AS INTEGER)
        WHERE contracts.professional_id = ?
          AND NOT (
            contracts.status = 'rejected'
            AND COALESCE(julianday(contracts.updated_at), julianday(jobs.created_at)) <= julianday('now', '-1 minute')
          )
        ORDER BY datetime(jobs.created_at) DESC, contracts.id DESC
      `,
    )
    .all(String(professionalId)) as ProfessionalHireRequestRecord[];
}

export function getClientHireRequests(clientId: number) {
  const db = getDatabase();

  return db
    .prepare(
      `
        SELECT
          contracts.id AS contractId,
          contracts.job_id AS jobId,
          contracts.client_project_id AS clientProjectId,
          contracts.tracking_id AS trackingId,
          contracts.client_id AS clientId,
          contracts.professional_id AS professionalId,
          contracts.total_amount AS totalAmount,
          contracts.platform_fee AS platformFee,
          contracts.status AS status,
          contracts.start_date AS startDate,
          contracts.end_date AS endDate,
          contracts.updated_at AS updatedAt,
          jobs.title AS title,
          jobs.description AS description,
          jobs.budget_min AS budgetMin,
          jobs.budget_max AS budgetMax,
          jobs.job_type AS workMode,
          jobs.city AS location,
          jobs.job_date AS jobDate,
          jobs.deadline AS deadline,
          jobs.created_at AS createdAt,
          TRIM(ClientUser.firstName || ' ' || ClientUser.lastName) AS clientName,
          CASE WHEN ClientUser.avatarUrl LIKE 'data:%' THEN NULL ELSE ClientUser.avatarUrl END AS clientAvatarUrl,
          TRIM(ProUser.firstName || ' ' || ProUser.lastName) AS professionalName,
          CASE WHEN ProUser.avatarUrl LIKE 'data:%' THEN NULL ELSE ProUser.avatarUrl END AS professionalAvatarUrl,
          ProUser.professionalCategory AS professionalCategory,
          (
            SELECT json_group_array(json_object(
              'fileUrl', job_attachments.file_url,
              'fileType', job_attachments.file_type
            ))
            FROM job_attachments
            WHERE job_attachments.job_id = contracts.job_id
          ) AS attachmentsJson,
          (
            SELECT json_group_array(json_object(
              'title', milestones.title,
              'amount', milestones.amount,
              'dueDate', milestones.due_date,
              'status', milestones.status
            ))
            FROM milestones
            WHERE milestones.contract_id = contracts.id
          ) AS milestonesJson
        FROM contracts
        INNER JOIN jobs ON jobs.id = contracts.job_id
        LEFT JOIN "User" ClientUser ON ClientUser.id = CAST(contracts.client_id AS INTEGER)
        LEFT JOIN "User" ProUser ON ProUser.id = CAST(contracts.professional_id AS INTEGER)
        WHERE contracts.client_id = ?
          AND NOT (
            contracts.status = 'rejected'
            AND COALESCE(julianday(contracts.updated_at), julianday(jobs.created_at)) <= julianday('now', '-1 minute')
          )
        ORDER BY datetime(COALESCE(contracts.updated_at, jobs.created_at)) DESC, contracts.id DESC
      `,
    )
    .all(String(clientId)) as ClientHireRequestRecord[];
}

export function updateProfessionalHireContractStatus(
  professionalId: number,
  contractId: string,
  status: HireContractStatus,
) {
  if (!["accepted", "rejected"].includes(status)) {
    throw new Error("Hire request status is not available.");
  }

  const db = getDatabase();

  const timestamp = new Date().toISOString();

  const result = db
    .prepare(
      `
        UPDATE contracts
        SET status = ?, updated_at = ?
        WHERE id = ? AND professional_id = ? AND status = 'pending'
      `,
    )
    .run(status, timestamp, contractId, String(professionalId));

  if (!result.changes) {
    throw new Error("Only pending hire requests can be updated.");
  }

  if (status === "accepted") {
    const contract = db
      .prepare(
        `
          SELECT client_id AS clientId, client_project_id AS clientProjectId
          FROM contracts
          WHERE id = ? AND professional_id = ?
          LIMIT 1
        `,
      )
      .get(contractId, String(professionalId)) as
      | { clientId: string; clientProjectId: number | null }
      | undefined;

    if (contract?.clientProjectId) {
      db.prepare(
        `
          UPDATE "ClientJob"
          SET status = 'CLOSED', updatedAt = ?
          WHERE id = ? AND userId = ?
        `,
      ).run(timestamp, contract.clientProjectId, Number(contract.clientId));

      db.prepare(
        `
          UPDATE "ProjectRequest"
          SET status = 'DECLINED', updatedAt = ?
          WHERE jobId = ?
            AND clientId = ?
            AND status = 'PENDING'
        `,
      ).run(timestamp, contract.clientProjectId, Number(contract.clientId));
    }
  }

  return db
    .prepare(
      `
        SELECT *
        FROM contracts
        WHERE id = ? AND professional_id = ?
        LIMIT 1
      `,
    )
    .get(contractId, String(professionalId));
}

export function createProfessionalHireNegotiation(
  professionalId: number,
  input: DirectHireNegotiationInput,
) {
  const db = getDatabase();
  const message = input.message.trim();
  const duration = input.duration.trim() || null;
  const bidAmount = input.bidAmount && input.bidAmount > 0 ? Math.round(input.bidAmount) : null;
  const timestamp = new Date().toISOString();

  if (!message) {
    throw new Error("Negotiation message is required.");
  }

  const contract = db
    .prepare(
      `
        SELECT
          contracts.id AS contractId,
          contracts.job_id AS jobId,
          contracts.client_id AS clientId,
          contracts.professional_id AS professionalId
        FROM contracts
        WHERE contracts.id = ?
          AND contracts.professional_id = ?
          AND contracts.status = 'pending'
        LIMIT 1
      `,
    )
    .get(input.contractId, String(professionalId)) as
    | {
        contractId: string;
        jobId: string;
        clientId: string;
        professionalId: string;
      }
    | undefined;

  if (!contract) {
    throw new Error("Only pending direct hire requests can be negotiated.");
  }

  const saveOffer = db.transaction(() => {
    db.prepare(
      `
        INSERT INTO "DirectHireNegotiation" (
          contractId,
          jobId,
          clientId,
          professionalId,
          senderId,
          senderRole,
          bidAmount,
          duration,
          message,
          createdAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      contract.contractId,
      contract.jobId,
      contract.clientId,
      contract.professionalId,
      String(professionalId),
      "PROFESSIONAL",
      bidAmount,
      duration,
      message,
      timestamp,
    );

    db.prepare(
      `
        UPDATE contracts
        SET total_amount = COALESCE(?, total_amount),
          updated_at = ?
        WHERE id = ?
      `,
    ).run(bidAmount, timestamp, contract.contractId);

    if (bidAmount != null) {
      db.prepare(
        `
          UPDATE jobs
          SET budget_min = ?, budget_max = ?
          WHERE id = ?
        `,
      ).run(bidAmount, bidAmount, contract.jobId);
    }
  });

  saveOffer();

  return getDirectHireNegotiationsByContract(contract.contractId).at(-1) ?? null;
}

export function getProfessionalHireNegotiations(professionalId: number) {
  const db = getDatabase();

  return db
    .prepare(
      `
        SELECT *
        FROM "DirectHireNegotiation"
        WHERE professionalId = ?
        ORDER BY datetime(createdAt) ASC, id ASC
      `,
    )
    .all(String(professionalId)) as DirectHireNegotiationRecord[];
}

function getDirectHireNegotiationsByContract(contractId: string) {
  const db = getDatabase();

  return db
    .prepare(
      `
        SELECT *
        FROM "DirectHireNegotiation"
        WHERE contractId = ?
        ORDER BY datetime(createdAt) ASC, id ASC
      `,
    )
    .all(contractId) as DirectHireNegotiationRecord[];
}

export function startClientHireProject(clientId: number, contractId: string) {
  const db = getDatabase();
  const timestamp = new Date().toISOString();

  const contract = db
    .prepare(
      `
        SELECT
          contracts.id AS contractId,
          contracts.job_id AS jobId,
          contracts.client_project_id AS clientProjectId,
          contracts.tracking_id AS trackingId,
          contracts.client_id AS clientId,
          contracts.professional_id AS professionalId,
          jobs.title AS title,
          jobs.description AS description,
          jobs.budget_min AS budgetMin,
          jobs.budget_max AS budgetMax,
          jobs.job_type AS workMode,
          jobs.city AS location,
          jobs.job_date AS jobDate,
          jobs.deadline AS deadline,
          TRIM(ClientUser.firstName || ' ' || ClientUser.lastName) AS clientName,
          CASE WHEN ClientUser.avatarUrl LIKE 'data:%' THEN NULL ELSE ClientUser.avatarUrl END AS clientAvatarUrl,
          TRIM(ProUser.firstName || ' ' || ProUser.lastName) AS professionalName,
          CASE WHEN ProUser.avatarUrl LIKE 'data:%' THEN NULL ELSE ProUser.avatarUrl END AS professionalAvatarUrl
        FROM contracts
        INNER JOIN jobs ON jobs.id = contracts.job_id
        LEFT JOIN "User" ClientUser ON ClientUser.id = CAST(contracts.client_id AS INTEGER)
        LEFT JOIN "User" ProUser ON ProUser.id = CAST(contracts.professional_id AS INTEGER)
        WHERE contracts.id = ? AND contracts.client_id = ? AND contracts.status = 'accepted'
        LIMIT 1
      `,
    )
    .get(contractId, String(clientId)) as
    | {
        contractId: string;
        jobId: string;
        clientProjectId: number | null;
        clientId: string;
        professionalId: string;
        title: string;
        description: string | null;
        budgetMin: number | null;
        budgetMax: number | null;
        workMode: string | null;
        location: string | null;
        jobDate: string | null;
        deadline: string | null;
        clientName: string | null;
        clientAvatarUrl: string | null;
        professionalName: string | null;
        professionalAvatarUrl: string | null;
      }
    | undefined;

  if (!contract) {
    throw new Error("Only accepted direct hires can be started.");
  }

  if (!contract.clientProjectId) {
    throw new Error("This hire request is not linked to a client project.");
  }

  const professionalId = Number(contract.professionalId);
  const clientProjectId = Number(contract.clientProjectId);
  const conversationId = `client-${contract.clientId}-pro-${contract.professionalId}`;
  const clientName = contract.clientName || `Client ${contract.clientId}`;
  const professionalName = contract.professionalName || "Professional";
  const message = {
    id: randomUUID(),
    conversationId,
    senderId: clientId,
    receiverId: professionalId,
    body: `Hi ${professionalName}, you are in. The project "${contract.title}" has started.`,
    kind: "text",
    createdAt: timestamp,
  };
  const userAId = Math.min(clientId, professionalId);
  const userBId = Math.max(clientId, professionalId);
  const userAIsClient = userAId === clientId;

  const startProject = db.transaction(() => {
    const project = db
      .prepare(
        `
        SELECT id
        FROM "ClientJob"
        WHERE id = ? AND userId = ?
        LIMIT 1
      `,
      )
      .get(clientProjectId, clientId) as { id: number } | undefined;

    if (!project) {
      throw new Error("Selected project was not found.");
    }

    const projectRequest = db
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        clientProjectId,
        clientId,
        professionalId,
        Math.round(contract.budgetMax ?? contract.budgetMin ?? 0),
        "",
        "Direct hire project started by the client.",
        null,
        "ACCEPTED",
        timestamp,
        timestamp,
      );
    const projectRequestId = Number(projectRequest.lastInsertRowid);

    const tracking = db
      .prepare(
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        projectRequestId,
        clientProjectId,
        clientId,
        professionalId,
        "ACTIVE",
        timestamp,
        timestamp,
        timestamp,
      );
    const trackingId = Number(tracking.lastInsertRowid);

    db.prepare(
      `
        UPDATE "ClientJob"
        SET status = 'CLOSED', updatedAt = ?
        WHERE id = ? AND userId = ?
      `,
    ).run(timestamp, clientProjectId, clientId);

    db.prepare(
      `
        UPDATE "ProjectRequest"
        SET status = 'DECLINED', updatedAt = ?
        WHERE jobId = ?
          AND clientId = ?
          AND id != ?
          AND status = 'PENDING'
      `,
    ).run(timestamp, clientProjectId, clientId, projectRequestId);

    db.prepare(
      `
        UPDATE contracts
        SET status = 'started', updated_at = ?, client_project_id = ?, tracking_id = ?
        WHERE id = ? AND client_id = ? AND status = 'accepted'
      `,
    ).run(timestamp, clientProjectId, trackingId, contractId, String(clientId));

    db.prepare(
      `
        INSERT INTO "SocketConversation" (
          id,
          userAId,
          userBId,
          userAName,
          userBName,
          userAAvatarUrl,
          userBAvatarUrl,
          job,
          createdAt,
          updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          job = excluded.job,
          updatedAt = excluded.updatedAt
      `,
    ).run(
      conversationId,
      userAId,
      userBId,
      userAIsClient ? clientName : professionalName,
      userAIsClient ? professionalName : clientName,
      userAIsClient ? contract.clientAvatarUrl : contract.professionalAvatarUrl,
      userAIsClient ? contract.professionalAvatarUrl : contract.clientAvatarUrl,
      contract.title,
      timestamp,
      timestamp,
    );

    db.prepare(
      `
        INSERT INTO "SocketMessage" (
          id,
          conversationId,
          senderId,
          receiverId,
          body,
          kind,
          createdAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      message.id,
      message.conversationId,
      message.senderId,
      message.receiverId,
      message.body,
      message.kind,
      message.createdAt,
    );
  });

  startProject();

  return {
    contractId,
    conversationId,
    message,
  };
}

export function cancelHireProject(userId: number, contractId: string) {
  const db = getDatabase();
  const timestamp = new Date().toISOString();

  const contract = db
    .prepare(
      `
        SELECT id, tracking_id AS trackingId
        FROM contracts
        WHERE id = ?
          AND status = 'started'
          AND (client_id = ? OR professional_id = ?)
        LIMIT 1
      `,
    )
    .get(contractId, String(userId), String(userId)) as
    | { id: string; trackingId: number | null }
    | undefined;

  if (!contract) {
    throw new Error("Only started direct hire projects can be cancelled by project participants.");
  }

  const cancelProject = db.transaction(() => {
    db.prepare(
      `
        UPDATE contracts
        SET status = 'cancelled', updated_at = ?
        WHERE id = ?
      `,
    ).run(timestamp, contractId);

    if (contract.trackingId) {
      db.prepare(
        `
          UPDATE "ProjectTracking"
          SET status = 'CANCELLED', updatedAt = ?
          WHERE id = ? AND status = 'ACTIVE'
        `,
      ).run(timestamp, contract.trackingId);

      db.prepare(
        `
          UPDATE "ProjectTransaction"
          SET status = 'CANCELLED', updatedAt = ?
          WHERE trackingId = ? AND status = 'COMPLETED'
        `,
      ).run(timestamp, contract.trackingId);
    }
  });

  cancelProject();

  return {
    contractId,
    status: "cancelled" as const,
  };
}

export function deleteRejectedHireRequest(userId: number, contractId: string) {
  const db = getDatabase();

  const contract = db
    .prepare(
      `
        SELECT id, job_id AS jobId
        FROM contracts
        WHERE id = ?
          AND status = 'rejected'
          AND (client_id = ? OR professional_id = ?)
        LIMIT 1
      `,
    )
    .get(contractId, String(userId), String(userId)) as { id: string; jobId: string } | undefined;

  if (!contract) {
    throw new Error("Only rejected direct hire requests can be deleted by project participants.");
  }

  const deleteRequest = db.transaction(() => {
    db.prepare(`DELETE FROM "DirectHireNegotiation" WHERE contractId = ?`).run(contract.id);
    db.prepare(`DELETE FROM milestones WHERE contract_id = ?`).run(contract.id);
    db.prepare(`DELETE FROM contracts WHERE id = ?`).run(contract.id);
    db.prepare(`DELETE FROM job_attachments WHERE job_id = ?`).run(contract.jobId);
    db.prepare(`DELETE FROM jobs WHERE id = ?`).run(contract.jobId);
  });

  deleteRequest();

  return {
    contractId,
    deleted: true,
  };
}
