import path from "node:path";
import Database from "better-sqlite3";

type BetterSqlite3Database = InstanceType<typeof Database>;

export type NotificationType = "project" | "work" | "message" | "payment" | "review";

export type UserNotification = {
  key: string;
  type: NotificationType;
  title: string;
  description: string;
  href: string;
  createdAt: string;
  readAt: string | null;
};

type NotificationStateRow = {
  notificationKey: string;
  readAt: string | null;
  clearedAt: string | null;
};

type ManualNotificationRow = {
  id: number;
  type: NotificationType;
  title: string;
  description: string;
  href: string | null;
  createdAt: string;
  readAt: string | null;
  clearedAt: string | null;
};

type MessageNotificationRow = {
  id: string;
  conversationId: string;
  senderId: number;
  receiverId: number;
  body: string;
  kind: string;
  createdAt: string;
  job: string | null;
  senderFirstName: string | null;
  senderLastName: string | null;
  senderEmail: string | null;
};

type ProjectRequestNotificationRow = {
  id: number;
  jobId: number;
  clientId: number;
  professionalId: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  projectTitle: string | null;
  professionalFirstName: string | null;
  professionalLastName: string | null;
  professionalEmail: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientEmail: string | null;
  trackingId: number | null;
};

type WorkUploadNotificationRow = {
  id: number;
  trackingId: number;
  clientId: number;
  professionalId: number;
  title: string;
  fileName: string | null;
  createdAt: string;
  projectTitle: string | null;
  professionalFirstName: string | null;
  professionalLastName: string | null;
  professionalEmail: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientEmail: string | null;
};

type RevisionNotificationRow = {
  id: number;
  trackingId: number;
  clientId: number;
  professionalId: number;
  note: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  projectTitle: string | null;
  professionalFirstName: string | null;
  professionalLastName: string | null;
  professionalEmail: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientEmail: string | null;
};

type MilestoneNotificationRow = {
  id: number;
  trackingId: number;
  clientId: number;
  professionalId: number;
  title: string;
  amount: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  projectTitle: string | null;
  professionalFirstName: string | null;
  professionalLastName: string | null;
  professionalEmail: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientEmail: string | null;
};

type CompletionNotificationRow = {
  id: number;
  trackingId: number;
  clientId: number;
  professionalId: number;
  note: string | null;
  status: string;
  submittedAt: string;
  updatedAt: string;
  projectTitle: string | null;
  professionalFirstName: string | null;
  professionalLastName: string | null;
  professionalEmail: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientEmail: string | null;
};

type HireContractNotificationRow = {
  contractId: string;
  jobId: string;
  clientId: string;
  professionalId: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  updatedAt: string | null;
  title: string | null;
  description: string | null;
  createdAt: string;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientEmail: string | null;
  professionalFirstName: string | null;
  professionalLastName: string | null;
  professionalEmail: string | null;
};

const globalForNotificationDb = globalThis as typeof globalThis & {
  notificationDb?: BetterSqlite3Database;
};

function getDatabase() {
  if (!globalForNotificationDb.notificationDb) {
    const databasePath = path.resolve(process.cwd(), "prisma", "app.db");
    globalForNotificationDb.notificationDb = new Database(databasePath);
  }

  ensureNotificationTables(globalForNotificationDb.notificationDb);
  return globalForNotificationDb.notificationDb;
}

function ensureNotificationTables(db: BetterSqlite3Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "UserNotification" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "userId" INTEGER NOT NULL,
      "type" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "href" TEXT,
      "createdAt" TEXT NOT NULL,
      "readAt" TEXT,
      "clearedAt" TEXT
    );

    CREATE TABLE IF NOT EXISTS "UserNotificationState" (
      "userId" INTEGER NOT NULL,
      "notificationKey" TEXT NOT NULL,
      "readAt" TEXT,
      "clearedAt" TEXT,
      PRIMARY KEY ("userId", "notificationKey")
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

    CREATE TABLE IF NOT EXISTS "SocketConversationClear" (
      "conversationId" TEXT NOT NULL,
      "userId" INTEGER NOT NULL,
      "clearedAt" TEXT NOT NULL,
      PRIMARY KEY ("conversationId", "userId")
    );

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

    CREATE TABLE IF NOT EXISTS "contracts" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "job_id" TEXT NOT NULL,
      "client_id" TEXT NOT NULL,
      "professional_id" TEXT NOT NULL,
      "proposal_id" TEXT,
      "total_amount" REAL,
      "platform_fee" REAL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "start_date" TEXT,
      "end_date" TEXT,
      "updated_at" TEXT
    );

    CREATE INDEX IF NOT EXISTS "UserNotification_userId_idx" ON "UserNotification"("userId");
    CREATE INDEX IF NOT EXISTS "UserNotificationState_userId_idx" ON "UserNotificationState"("userId");
    CREATE INDEX IF NOT EXISTS "ProjectRequest_clientId_idx" ON "ProjectRequest"("clientId");
    CREATE INDEX IF NOT EXISTS "ProjectRequest_professionalId_idx" ON "ProjectRequest"("professionalId");
    CREATE INDEX IF NOT EXISTS "ProjectWorkUpload_trackingId_idx" ON "ProjectWorkUpload"("trackingId");
    CREATE INDEX IF NOT EXISTS "ProjectRevisionRequest_trackingId_idx" ON "ProjectRevisionRequest"("trackingId");
    CREATE INDEX IF NOT EXISTS "ProjectRevisionRequest_professionalId_idx" ON "ProjectRevisionRequest"("professionalId");
    CREATE INDEX IF NOT EXISTS "ProjectMilestone_trackingId_idx" ON "ProjectMilestone"("trackingId");
    CREATE INDEX IF NOT EXISTS "ProjectMilestone_clientId_idx" ON "ProjectMilestone"("clientId");
    CREATE INDEX IF NOT EXISTS "ProjectMilestone_professionalId_idx" ON "ProjectMilestone"("professionalId");
    CREATE INDEX IF NOT EXISTS "ProjectCompletionRequest_trackingId_idx" ON "ProjectCompletionRequest"("trackingId");
    CREATE INDEX IF NOT EXISTS "ProjectCompletionRequest_clientId_idx" ON "ProjectCompletionRequest"("clientId");
    CREATE INDEX IF NOT EXISTS "ProjectCompletionRequest_professionalId_idx" ON "ProjectCompletionRequest"("professionalId");
    CREATE INDEX IF NOT EXISTS "SocketMessage_receiverId_idx" ON "SocketMessage"("receiverId");
    CREATE INDEX IF NOT EXISTS "SocketConversationClear_userId_idx" ON "SocketConversationClear"("userId");
    CREATE INDEX IF NOT EXISTS "contracts_client_id_idx" ON "contracts"("client_id");
    CREATE INDEX IF NOT EXISTS "contracts_professional_id_idx" ON "contracts"("professional_id");
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
}

export function getUserNotifications(userId: number, role: "CLIENT" | "PROFESSIONAL" | "ADMIN") {
  const db = getDatabase();
  const notifications = [
    ...getManualNotifications(db, userId),
    ...(role === "ADMIN"
      ? getAdminActivityNotifications(db)
      : [
          ...getMessageNotifications(db, userId, role),
          ...getProjectRequestNotifications(db, userId, role),
          ...getHireContractNotifications(db, userId, role),
          ...getWorkUploadNotifications(db, userId, role),
          ...getRevisionNotifications(db, userId, role),
          ...getMilestoneNotifications(db, userId, role),
          ...getCompletionNotifications(db, userId, role),
        ]),
  ];

  const states = getNotificationStates(db, userId);

  return notifications
    .map((notification) => {
      const state = states.get(notification.key);

      if (state?.clearedAt) {
        return null;
      }

      return {
        ...notification,
        readAt: notification.readAt ?? state?.readAt ?? null,
      } satisfies UserNotification;
    })
    .filter((notification): notification is UserNotification => Boolean(notification))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function markUserNotificationsRead(
  userId: number,
  role: "CLIENT" | "PROFESSIONAL" | "ADMIN",
) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const notifications = getUserNotifications(userId, role);

  const markDerived = db.prepare(`
    INSERT INTO "UserNotificationState" (userId, notificationKey, readAt, clearedAt)
    VALUES (?, ?, ?, NULL)
    ON CONFLICT(userId, notificationKey) DO UPDATE SET readAt = excluded.readAt
  `);

  const transaction = db.transaction(() => {
    for (const notification of notifications) {
      markDerived.run(userId, notification.key, now);
    }

    db.prepare(
      `
      UPDATE "UserNotification"
      SET readAt = ?
      WHERE userId = ? AND clearedAt IS NULL
    `,
    ).run(now, userId);
  });

  transaction();
}

export function clearUserNotifications(userId: number, role: "CLIENT" | "PROFESSIONAL" | "ADMIN") {
  const db = getDatabase();
  const now = new Date().toISOString();
  const notifications = getUserNotifications(userId, role);

  const clearDerived = db.prepare(`
    INSERT INTO "UserNotificationState" (userId, notificationKey, readAt, clearedAt)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(userId, notificationKey) DO UPDATE SET
      readAt = COALESCE("UserNotificationState".readAt, excluded.readAt),
      clearedAt = excluded.clearedAt
  `);

  const transaction = db.transaction(() => {
    for (const notification of notifications) {
      clearDerived.run(userId, notification.key, notification.readAt ?? now, now);
    }

    db.prepare(
      `
      UPDATE "UserNotification"
      SET clearedAt = ?, readAt = COALESCE(readAt, ?)
      WHERE userId = ? AND clearedAt IS NULL
    `,
    ).run(now, now, userId);
  });

  transaction();
}

function getAdminActivityNotifications(db: BetterSqlite3Database): UserNotification[] {
  const users = db
    .prepare(
      `
    SELECT id, firstName, lastName, email, role, createdAt
    FROM "User"
    WHERE role != 'ADMIN'
    ORDER BY datetime(createdAt) DESC
    LIMIT 30
  `,
    )
    .all() as Array<{
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    createdAt: string;
  }>;

  const jobs = db
    .prepare(
      `
    SELECT ClientJob.id, ClientJob.title, ClientJob.createdAt,
      TRIM(User.firstName || ' ' || User.lastName) AS clientName
    FROM "ClientJob"
    LEFT JOIN "User" ON User.id = ClientJob.userId
    ORDER BY datetime(ClientJob.createdAt) DESC
    LIMIT 30
  `,
    )
    .all() as Array<{ id: number; title: string; createdAt: string; clientName: string | null }>;

  const disputes = db
    .prepare(
      `
    SELECT ProjectDispute.id, ProjectDispute.status, ProjectDispute.priority,
      ProjectDispute.createdAt, COALESCE(ClientJob.title, 'Project') AS jobTitle
    FROM "ProjectDispute"
    LEFT JOIN "ProjectTracking" ON ProjectTracking.id = ProjectDispute.trackingId
    LEFT JOIN "ClientJob" ON ClientJob.id = ProjectTracking.jobId
    ORDER BY datetime(ProjectDispute.createdAt) DESC
    LIMIT 30
  `,
    )
    .all() as Array<{
    id: number;
    status: string;
    priority: string;
    createdAt: string;
    jobTitle: string;
  }>;

  const payments = db
    .prepare(
      `
    SELECT ProjectTransaction.id, ProjectTransaction.amount, ProjectTransaction.currency,
      ProjectTransaction.createdAt, COALESCE(ClientJob.title, ProjectTransaction.description, 'Project') AS jobTitle
    FROM "ProjectTransaction"
    LEFT JOIN "ProjectTracking" ON ProjectTracking.id = ProjectTransaction.trackingId
    LEFT JOIN "ClientJob" ON ClientJob.id = ProjectTracking.jobId
    WHERE ProjectTransaction.status = 'COMPLETED'
    ORDER BY datetime(ProjectTransaction.createdAt) DESC
    LIMIT 30
  `,
    )
    .all() as Array<{
    id: number;
    amount: number;
    currency: string;
    createdAt: string;
    jobTitle: string;
  }>;

  return [
    ...users.map((user) => ({
      key: `admin:user:${user.id}`,
      type: "review" as const,
      title: "New user registered",
      description: `${`${user.firstName} ${user.lastName}`.trim() || user.email} joined as ${user.role.toLowerCase()}.`,
      href: "/user-management",
      createdAt: user.createdAt,
      readAt: null,
    })),
    ...jobs.map((job) => ({
      key: `admin:job:${job.id}`,
      type: "project" as const,
      title: "New job posted",
      description: `${job.clientName || "A client"} posted “${job.title}”.`,
      href: "/job-management",
      createdAt: job.createdAt,
      readAt: null,
    })),
    ...disputes.map((dispute) => ({
      key: `admin:dispute:${dispute.id}`,
      type: "review" as const,
      title: "New dispute raised",
      description: `${dispute.priority.toLowerCase()} priority dispute for “${dispute.jobTitle}”.`,
      href: "/job-management",
      createdAt: dispute.createdAt,
      readAt: null,
    })),
    ...payments.map((payment) => ({
      key: `admin:payment:${payment.id}`,
      type: "payment" as const,
      title: "Payment completed",
      description: `${payment.currency} ${payment.amount.toLocaleString()} paid for “${payment.jobTitle}”.`,
      href: "/earnings-reports",
      createdAt: payment.createdAt,
      readAt: null,
    })),
  ];
}

function getManualNotifications(db: BetterSqlite3Database, userId: number) {
  return db
    .prepare(
      `
        SELECT id, type, title, description, href, createdAt, readAt, clearedAt
        FROM "UserNotification"
        WHERE userId = ? AND clearedAt IS NULL
      `,
    )
    .all(userId)
    .map((row) => {
      const notification = row as ManualNotificationRow;

      return {
        key: `manual:${notification.id}`,
        type: notification.type,
        title: notification.title,
        description: notification.description,
        href: notification.href || "/notifications",
        createdAt: notification.createdAt,
        readAt: notification.readAt,
      } satisfies UserNotification;
    });
}

function getMessageNotifications(
  db: BetterSqlite3Database,
  userId: number,
  role: "CLIENT" | "PROFESSIONAL",
) {
  return db
    .prepare(
      `
        SELECT
          message.id,
          message.conversationId,
          message.senderId,
          message.receiverId,
          message.body,
          message.kind,
          message.createdAt,
          conversation.job,
          sender.firstName AS senderFirstName,
          sender.lastName AS senderLastName,
          sender.email AS senderEmail
        FROM "SocketMessage" message
        LEFT JOIN "SocketConversation" conversation ON conversation.id = message.conversationId
        LEFT JOIN "User" sender ON sender.id = message.senderId
        LEFT JOIN "SocketConversationClear" cleared
          ON cleared.conversationId = message.conversationId AND cleared.userId = ?
        WHERE message.receiverId = ?
          AND (cleared.clearedAt IS NULL OR datetime(message.createdAt) > datetime(cleared.clearedAt))
        ORDER BY datetime(message.createdAt) DESC
        LIMIT 50
      `,
    )
    .all(userId, userId)
    .map((row) => {
      const message = row as MessageNotificationRow;
      const senderName = formatName(
        message.senderFirstName,
        message.senderLastName,
        message.senderEmail,
      );
      const preview = message.kind === "attachment" ? "Sent an attachment" : message.body;

      return {
        key: `message:${message.id}`,
        type: "message",
        title: `New message from ${senderName}`,
        description: `${message.job || "Direct message"}: ${preview}`,
        href: role === "PROFESSIONAL" ? "/professional-messages" : "/messages",
        createdAt: message.createdAt,
        readAt: null,
      } satisfies UserNotification;
    });
}

function getProjectRequestNotifications(
  db: BetterSqlite3Database,
  userId: number,
  role: "CLIENT" | "PROFESSIONAL",
) {
  return db
    .prepare(
      `
        SELECT
          request.id,
          request.jobId,
          request.clientId,
          request.professionalId,
          request.status,
          request.createdAt,
          request.updatedAt,
          job.title AS projectTitle,
          professional.firstName AS professionalFirstName,
          professional.lastName AS professionalLastName,
          professional.email AS professionalEmail,
          client.firstName AS clientFirstName,
          client.lastName AS clientLastName,
          client.email AS clientEmail,
          tracking.id AS trackingId
        FROM "ProjectRequest" request
        LEFT JOIN "ClientJob" job ON job.id = request.jobId
        LEFT JOIN "User" professional ON professional.id = request.professionalId
        LEFT JOIN "User" client ON client.id = request.clientId
        LEFT JOIN "ProjectTracking" tracking ON tracking.requestId = request.id
        WHERE request.clientId = ? OR request.professionalId = ?
      `,
    )
    .all(userId, userId)
    .map((row) => {
      const request = row as ProjectRequestNotificationRow;
      const projectTitle = request.projectTitle || "Project";

      if (role === "CLIENT" && request.clientId === userId) {
        const proName = formatName(
          request.professionalFirstName,
          request.professionalLastName,
          request.professionalEmail,
        );

        return {
          key: `project-request:${request.id}:${request.updatedAt}`,
          type: "project",
          title: `${proName} sent a project request`,
          description: `${projectTitle} is waiting for your review.`,
          href: "/projects",
          createdAt: request.updatedAt,
          readAt: null,
        } satisfies UserNotification;
      }

      if (role === "PROFESSIONAL" && request.professionalId === userId) {
        const clientName = formatName(
          request.clientFirstName,
          request.clientLastName,
          request.clientEmail,
        );
        const statusLabel = formatStatus(request.status);

        return {
          key: `project-request-status:${request.id}:${request.status}`,
          type: "project",
          title: `${clientName} ${statusLabel} your request`,
          description: `${projectTitle} request status is ${statusLabel}.`,
          href: request.trackingId ? `/project-track/${request.trackingId}` : "/professional-stats",
          createdAt: request.updatedAt,
          readAt: null,
        } satisfies UserNotification;
      }

      return null;
    })
    .filter((notification): notification is UserNotification => Boolean(notification));
}

function getHireContractNotifications(
  db: BetterSqlite3Database,
  userId: number,
  role: "CLIENT" | "PROFESSIONAL",
) {
  return db
    .prepare(
      `
        SELECT
          contracts.id AS contractId,
          contracts.job_id AS jobId,
          contracts.client_id AS clientId,
          contracts.professional_id AS professionalId,
          contracts.status AS status,
          contracts.start_date AS startDate,
          contracts.end_date AS endDate,
          contracts.updated_at AS updatedAt,
          jobs.title AS title,
          jobs.description AS description,
          jobs.created_at AS createdAt,
          client.firstName AS clientFirstName,
          client.lastName AS clientLastName,
          client.email AS clientEmail,
          professional.firstName AS professionalFirstName,
          professional.lastName AS professionalLastName,
          professional.email AS professionalEmail
        FROM contracts
        INNER JOIN jobs ON jobs.id = contracts.job_id
        LEFT JOIN "User" client ON client.id = CAST(contracts.client_id AS INTEGER)
        LEFT JOIN "User" professional ON professional.id = CAST(contracts.professional_id AS INTEGER)
        WHERE contracts.client_id = ? OR contracts.professional_id = ?
      `,
    )
    .all(String(userId), String(userId))
    .map((row) => {
      const contract = row as HireContractNotificationRow;
      const title = contract.title || "Direct hire request";

      if (role === "PROFESSIONAL" && Number(contract.professionalId) === userId) {
        const clientName = formatName(
          contract.clientFirstName,
          contract.clientLastName,
          contract.clientEmail,
        );

        return {
          key: `hire-contract:${contract.contractId}:${contract.status}`,
          type: "project",
          title:
            contract.status === "pending"
              ? "New direct hire request"
              : `Hire request ${contract.status}`,
          description:
            contract.status === "pending"
              ? `${clientName} sent you a hire request for ${title}.`
              : `${title} is now ${contract.status}.`,
          href: "/professional-stats",
          createdAt:
            contract.status === "pending"
              ? contract.createdAt
              : contract.updatedAt || contract.createdAt,
          readAt: null,
        } satisfies UserNotification;
      }

      if (
        role === "CLIENT" &&
        Number(contract.clientId) === userId &&
        contract.status !== "pending"
      ) {
        const proName = formatName(
          contract.professionalFirstName,
          contract.professionalLastName,
          contract.professionalEmail,
        );

        return {
          key: `hire-contract-client:${contract.contractId}:${contract.status}`,
          type: "project",
          title: `Hire request ${contract.status}`,
          description: `${proName} ${contract.status} your hire request for ${title}.`,
          href: "/projects",
          createdAt: contract.updatedAt || contract.createdAt,
          readAt: null,
        } satisfies UserNotification;
      }

      return null;
    })
    .filter((notification): notification is UserNotification => Boolean(notification));
}

function getWorkUploadNotifications(
  db: BetterSqlite3Database,
  userId: number,
  role: "CLIENT" | "PROFESSIONAL",
) {
  return db
    .prepare(
      `
        SELECT
          upload.id,
          upload.trackingId,
          tracking.clientId,
          tracking.professionalId,
          upload.title,
          upload.fileName,
          upload.createdAt,
          job.title AS projectTitle,
          professional.firstName AS professionalFirstName,
          professional.lastName AS professionalLastName,
          professional.email AS professionalEmail,
          client.firstName AS clientFirstName,
          client.lastName AS clientLastName,
          client.email AS clientEmail
        FROM "ProjectWorkUpload" upload
        INNER JOIN "ProjectTracking" tracking ON tracking.id = upload.trackingId
        LEFT JOIN "ClientJob" job ON job.id = tracking.jobId
        LEFT JOIN "User" professional ON professional.id = tracking.professionalId
        LEFT JOIN "User" client ON client.id = tracking.clientId
        WHERE tracking.clientId = ? OR tracking.professionalId = ?
      `,
    )
    .all(userId, userId)
    .map((row) => {
      const upload = row as WorkUploadNotificationRow;
      const projectTitle = upload.projectTitle || "Project";
      const fileLabel = upload.fileName || upload.title || "work file";

      if (role === "CLIENT" && upload.clientId === userId) {
        const proName = formatName(
          upload.professionalFirstName,
          upload.professionalLastName,
          upload.professionalEmail,
        );

        return {
          key: `work-upload:${upload.id}`,
          type: "work",
          title: "New work file uploaded",
          description: `${proName} uploaded ${fileLabel} for ${projectTitle}.`,
          href: `/project-track/${upload.trackingId}`,
          createdAt: upload.createdAt,
          readAt: null,
        } satisfies UserNotification;
      }

      if (role === "PROFESSIONAL" && upload.professionalId === userId) {
        return {
          key: `work-upload:${upload.id}`,
          type: "work",
          title: "Work upload saved",
          description: `${fileLabel} is saved for ${projectTitle}.`,
          href: `/project-track/${upload.trackingId}`,
          createdAt: upload.createdAt,
          readAt: null,
        } satisfies UserNotification;
      }

      return null;
    })
    .filter((notification): notification is UserNotification => Boolean(notification));
}

function getRevisionNotifications(
  db: BetterSqlite3Database,
  userId: number,
  role: "CLIENT" | "PROFESSIONAL",
) {
  return db
    .prepare(
      `
        SELECT
          revision.id,
          revision.trackingId,
          revision.clientId,
          revision.professionalId,
          revision.note,
          revision.status,
          revision.createdAt,
          revision.updatedAt,
          job.title AS projectTitle,
          professional.firstName AS professionalFirstName,
          professional.lastName AS professionalLastName,
          professional.email AS professionalEmail,
          client.firstName AS clientFirstName,
          client.lastName AS clientLastName,
          client.email AS clientEmail
        FROM "ProjectRevisionRequest" revision
        INNER JOIN "ProjectTracking" tracking ON tracking.id = revision.trackingId
        LEFT JOIN "ClientJob" job ON job.id = tracking.jobId
        LEFT JOIN "User" professional ON professional.id = revision.professionalId
        LEFT JOIN "User" client ON client.id = revision.clientId
        WHERE revision.clientId = ? OR revision.professionalId = ?
      `,
    )
    .all(userId, userId)
    .map((row) => {
      const revision = row as RevisionNotificationRow;
      const projectTitle = revision.projectTitle || "Project";

      if (role === "PROFESSIONAL" && revision.professionalId === userId) {
        const clientName = formatName(
          revision.clientFirstName,
          revision.clientLastName,
          revision.clientEmail,
        );

        return {
          key: `revision:${revision.id}`,
          type: "work",
          title: "Revision requested",
          description: `${clientName} requested changes for ${projectTitle}: ${revision.note}`,
          href: `/project-track/${revision.trackingId}`,
          createdAt: revision.createdAt,
          readAt: null,
        } satisfies UserNotification;
      }

      if (role === "CLIENT" && revision.clientId === userId) {
        return {
          key: `revision:${revision.id}`,
          type: "work",
          title: revision.status === "ADDRESSED" ? "Revision addressed" : "Revision request saved",
          description: `${projectTitle}: ${revision.note}`,
          href: `/project-track/${revision.trackingId}`,
          createdAt: revision.status === "ADDRESSED" ? revision.updatedAt : revision.createdAt,
          readAt: null,
        } satisfies UserNotification;
      }

      return null;
    })
    .filter((notification): notification is UserNotification => Boolean(notification));
}

function getMilestoneNotifications(
  db: BetterSqlite3Database,
  userId: number,
  role: "CLIENT" | "PROFESSIONAL",
) {
  return db
    .prepare(
      `
        SELECT
          milestone.id,
          milestone.trackingId,
          milestone.clientId,
          milestone.professionalId,
          milestone.title,
          milestone.amount,
          milestone.status,
          milestone.createdAt,
          milestone.updatedAt,
          job.title AS projectTitle,
          professional.firstName AS professionalFirstName,
          professional.lastName AS professionalLastName,
          professional.email AS professionalEmail,
          client.firstName AS clientFirstName,
          client.lastName AS clientLastName,
          client.email AS clientEmail
        FROM "ProjectMilestone" milestone
        INNER JOIN "ProjectTracking" tracking ON tracking.id = milestone.trackingId
        LEFT JOIN "ClientJob" job ON job.id = tracking.jobId
        LEFT JOIN "User" professional ON professional.id = milestone.professionalId
        LEFT JOIN "User" client ON client.id = milestone.clientId
        WHERE milestone.clientId = ? OR milestone.professionalId = ?
      `,
    )
    .all(userId, userId)
    .map((row) => {
      const milestone = row as MilestoneNotificationRow;
      const projectTitle = milestone.projectTitle || "Project";
      const amountLabel = milestone.amount ? ` (${formatMoney(milestone.amount)})` : "";

      if (role === "PROFESSIONAL" && milestone.professionalId === userId) {
        const clientName = formatName(
          milestone.clientFirstName,
          milestone.clientLastName,
          milestone.clientEmail,
        );
        const isNew = milestone.status === "PENDING";

        return {
          key: `milestone:${milestone.id}:${milestone.status}`,
          type: milestone.status === "PAID" ? "payment" : "project",
          title: isNew
            ? "New milestone added"
            : `Milestone ${formatMilestoneStatus(milestone.status)}`,
          description: `${clientName} ${isNew ? "added" : "updated"} ${milestone.title}${amountLabel} for ${projectTitle}.`,
          href: `/project-track/${milestone.trackingId}`,
          createdAt: isNew ? milestone.createdAt : milestone.updatedAt,
          readAt: null,
        } satisfies UserNotification;
      }

      if (role === "CLIENT" && milestone.clientId === userId) {
        const proName = formatName(
          milestone.professionalFirstName,
          milestone.professionalLastName,
          milestone.professionalEmail,
        );
        const statusLabel = formatMilestoneStatus(milestone.status);

        return {
          key: `milestone:${milestone.id}:${milestone.status}`,
          type: milestone.status === "PAID" ? "payment" : "project",
          title: `Milestone ${statusLabel}`,
          description: `${proName} milestone update: ${milestone.title}${amountLabel} for ${projectTitle}.`,
          href: `/project-track/${milestone.trackingId}`,
          createdAt: milestone.status === "PENDING" ? milestone.createdAt : milestone.updatedAt,
          readAt: null,
        } satisfies UserNotification;
      }

      return null;
    })
    .filter((notification): notification is UserNotification => Boolean(notification));
}

function getCompletionNotifications(
  db: BetterSqlite3Database,
  userId: number,
  role: "CLIENT" | "PROFESSIONAL",
) {
  return db
    .prepare(
      `
        SELECT
          completion.id,
          completion.trackingId,
          completion.clientId,
          completion.professionalId,
          completion.note,
          completion.status,
          completion.submittedAt,
          completion.updatedAt,
          job.title AS projectTitle,
          professional.firstName AS professionalFirstName,
          professional.lastName AS professionalLastName,
          professional.email AS professionalEmail,
          client.firstName AS clientFirstName,
          client.lastName AS clientLastName,
          client.email AS clientEmail
        FROM "ProjectCompletionRequest" completion
        INNER JOIN "ProjectTracking" tracking ON tracking.id = completion.trackingId
        LEFT JOIN "ClientJob" job ON job.id = tracking.jobId
        LEFT JOIN "User" professional ON professional.id = completion.professionalId
        LEFT JOIN "User" client ON client.id = completion.clientId
        WHERE completion.clientId = ? OR completion.professionalId = ?
      `,
    )
    .all(userId, userId)
    .map((row) => {
      const completion = row as CompletionNotificationRow;
      const projectTitle = completion.projectTitle || "Project";

      if (role === "CLIENT" && completion.clientId === userId) {
        const proName = formatName(
          completion.professionalFirstName,
          completion.professionalLastName,
          completion.professionalEmail,
        );

        return {
          key: `completion:${completion.id}:${completion.status}`,
          type: "project",
          title:
            completion.status === "SUBMITTED"
              ? "Final work submitted"
              : `Final work ${completion.status.toLowerCase().replace(/_/g, " ")}`,
          description: `${proName} submitted final work for ${projectTitle}.`,
          href: `/project-track/${completion.trackingId}`,
          createdAt:
            completion.status === "SUBMITTED" ? completion.submittedAt : completion.updatedAt,
          readAt: null,
        } satisfies UserNotification;
      }

      if (role === "PROFESSIONAL" && completion.professionalId === userId) {
        const clientName = formatName(
          completion.clientFirstName,
          completion.clientLastName,
          completion.clientEmail,
        );

        return {
          key: `completion:${completion.id}:${completion.status}`,
          type: "project",
          title:
            completion.status === "APPROVED"
              ? "Project approved"
              : completion.status === "REVISION_REQUESTED"
                ? "Final revision requested"
                : "Final work submitted",
          description: `${clientName} updated final work review for ${projectTitle}.`,
          href: `/project-track/${completion.trackingId}`,
          createdAt:
            completion.status === "SUBMITTED" ? completion.submittedAt : completion.updatedAt,
          readAt: null,
        } satisfies UserNotification;
      }

      return null;
    })
    .filter((notification): notification is UserNotification => Boolean(notification));
}

function getNotificationStates(db: BetterSqlite3Database, userId: number) {
  const rows = db
    .prepare(
      `
        SELECT notificationKey, readAt, clearedAt
        FROM "UserNotificationState"
        WHERE userId = ?
      `,
    )
    .all(userId) as NotificationStateRow[];

  return new Map(rows.map((row) => [row.notificationKey, row]));
}

function formatName(firstName: string | null, lastName: string | null, fallback: string | null) {
  return `${firstName || ""} ${lastName || ""}`.trim() || fallback || "Someone";
}

function formatStatus(status: string) {
  return status.toLowerCase() === "accepted"
    ? "accepted"
    : status.toLowerCase() === "declined"
      ? "declined"
      : "received";
}

function formatMilestoneStatus(status: string) {
  return status.toLowerCase().replace(/_/g, " ");
}

function formatMoney(value: number) {
  return `$${value.toLocaleString()}`;
}
