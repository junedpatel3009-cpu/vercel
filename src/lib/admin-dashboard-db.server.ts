import Database from "better-sqlite3";
import path from "node:path";
import type { Database as BetterSqlite3Database } from "better-sqlite3";

export type AdminDashboardSnapshot = {
  generatedAt: string;
  stats: {
    totalUsers: number;
    clients: number;
    professionals: number;
    admins: number;
    activeUsers: number;
    todayUsers: number;
    totalJobs: number;
    openJobs: number;
    draftJobs: number;
    closedJobs: number;
    todayJobs: number;
    pendingRequests: number;
    activeProjects: number;
    completedTransactions: number;
    todayTransactions: number;
    totalRevenue: number;
    todayRevenue: number;
    openDisputes: number;
  };
  recentJobs: AdminRecentJob[];
  recentTransactions: AdminRecentTransaction[];
};

export type AdminRecentJob = {
  id: number;
  title: string;
  category: string;
  status: string;
  budgetMin: number | null;
  budgetMax: number | null;
  createdAt: string;
  clientName: string;
  clientEmail: string;
};

export type AdminJobRecord = AdminRecentJob & {
  description: string;
  urgency: string;
  timingType: string;
  jobDate: string | null;
  deadline: string;
  workMode: string;
  locationLabel: string | null;
  locationAddress: string | null;
  locationLat: number | null;
  locationLng: number | null;
  updatedAt: string;
  trackingId: number | null;
  requestId: number | null;
  trackingStatus: string | null;
  acceptedAt: string | null;
  completedAt: string | null;
  completionSubmittedAt: string | null;
  professionalName: string | null;
  professionalEmail: string | null;
  attachments: AdminJobAttachmentRecord[];
  requests: AdminJobRequestRecord[];
  workUploads: AdminJobWorkUploadRecord[];
};

export type AdminJobAttachmentRecord = {
  id: number;
  jobId: number;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  previewUrl: string | null;
  createdAt: string;
};

export type AdminJobRequestRecord = {
  id: number;
  jobId: number;
  professionalId: number;
  professionalName: string;
  professionalEmail: string;
  bidAmount: number | null;
  duration: string | null;
  coverLetter: string;
  attachmentsJson: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminJobWorkUploadRecord = {
  id: number;
  trackingId: number;
  jobId: number;
  professionalName: string;
  professionalEmail: string;
  roundNumber: number;
  title: string;
  note: string;
  fileName: string | null;
  fileUrl: string | null;
  filesJson: string | null;
  createdAt: string;
};

export type AdminDisputeRecord = {
  id: number;
  trackingId: number;
  jobId: number | null;
  jobTitle: string;
  issueType: string;
  priority: string;
  status: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  reporterRole: string;
  reporterName: string;
  reporterEmail: string;
  clientName: string;
  clientEmail: string;
  professionalName: string;
  professionalEmail: string;
};

export type AdminRecentTransaction = {
  id: number;
  amount: number;
  currency: string;
  type: string;
  status: string;
  description: string;
  createdAt: string;
  projectTitle: string;
  clientName: string;
  professionalName: string;
};

export type AdminPaymentTransaction = {
  id: number;
  jobTitle: string;
  clientName: string;
  clientEmail: string;
  professionalName: string;
  professionalEmail: string;
  amount: number;
  currency: string;
  paymentType: string;
  status: string;
  dateTime: string;
};

export type AdminEarningsTransactionRecord = AdminPaymentTransaction & {
  trackingId: number;
  milestoneId: number | null;
  completionId: number | null;
  professionalId: number;
  description: string;
  projectCategory: string;
  grossAmount: number;
  commissionAmount: number;
  netPayoutAmount: number;
  platformShareRate: number;
};

export type AdminPayoutRecord = {
  id: number;
  professionalId: number;
  professionalName: string;
  professionalEmail: string;
  amount: number;
  currency: string;
  destinationType: string;
  destinationLabel: string;
  status: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminProfessionalEarningsSummary = {
  professionalId: number;
  professionalName: string;
  professionalEmail: string;
  grossEarnings: number;
  commissionAmount: number;
  netEarnings: number;
  requestedPayouts: number;
  paidPayouts: number;
  pendingPayouts: number;
  rejectedPayouts: number;
  availableBalance: number;
  transactionCount: number;
  payoutCount: number;
  lastTransactionAt: string | null;
  lastPayoutAt: string | null;
};

export type AdminEarningsReport = {
  generatedAt: string;
  commissionRate: number;
  totals: {
    grossEarnings: number;
    commissionAmount: number;
    netEarnings: number;
    requestedPayouts: number;
    paidPayouts: number;
    pendingPayouts: number;
    processingPayouts: number;
    rejectedPayouts: number;
    availableBalance: number;
    transactionCount: number;
    payoutCount: number;
    professionalsWithEarnings: number;
  };
  transactions: AdminEarningsTransactionRecord[];
  payouts: AdminPayoutRecord[];
  professionals: AdminProfessionalEarningsSummary[];
};

export type AdminManagedUserProject = {
  id: number;
  title: string;
  category: string;
  status: string;
  trackingStatus: string | null;
  counterpartName: string | null;
  counterpartEmail: string | null;
  agreedAmount: number | null;
  createdAt: string;
};

export type AdminManagedUserTransaction = {
  id: number;
  projectTitle: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  counterpartName: string;
  createdAt: string;
};

export type AdminManagedUserDetail = {
  userId: number;
  projectCount: number;
  activeProjectCount: number;
  completedProjectCount: number;
  totalMoney: number;
  projects: AdminManagedUserProject[];
  transactions: AdminManagedUserTransaction[];
};

const globalForAdminDashboardDb = globalThis as typeof globalThis & {
  adminDashboardDb?: BetterSqlite3Database;
};

const PLATFORM_COMMISSION_RATE = 0.1;

function getDatabase() {
  if (!globalForAdminDashboardDb.adminDashboardDb) {
    const databasePath = path.resolve(process.cwd(), "prisma", "app.db");
    globalForAdminDashboardDb.adminDashboardDb = new Database(databasePath);
  }

  return globalForAdminDashboardDb.adminDashboardDb;
}

export function getAdminDashboardSnapshot(): AdminDashboardSnapshot {
  const db = getDatabase();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const jobs = getAdminJobRecords();

  return {
    generatedAt: now.toISOString(),
    stats: {
      totalUsers: count(db, `"User"`),
      clients: count(db, `"User"`, `role = 'CLIENT'`),
      professionals: count(db, `"User"`, `role = 'PROFESSIONAL'`),
      admins: count(db, `"User"`, `role = 'ADMIN'`),
      activeUsers: count(db, `"User"`, `isActive = 1`),
      todayUsers: countSince(db, `"User"`, "createdAt", todayStart),
      totalJobs: jobs.length,
      openJobs: jobs.filter((job) => job.status === "OPEN").length,
      draftJobs: jobs.filter((job) => job.status === "DRAFT").length,
      closedJobs: jobs.filter((job) => job.status === "CLOSED").length,
      todayJobs: jobs.filter(
        (job) => new Date(job.createdAt).getTime() >= new Date(todayStart).getTime(),
      ).length,
      pendingRequests: count(db, `"ProjectRequest"`, `status = 'PENDING'`),
      activeProjects: count(db, `"ProjectTracking"`, `status = 'ACTIVE'`),
      completedTransactions: count(db, `"ProjectTransaction"`, `status = 'COMPLETED'`),
      todayTransactions: countSince(
        db,
        `"ProjectTransaction"`,
        "createdAt",
        todayStart,
        `status = 'COMPLETED'`,
      ),
      totalRevenue: sumAmount(db, null),
      todayRevenue: sumAmount(db, todayStart),
      openDisputes: count(db, `"ProjectDispute"`, `status IN ('OPEN', 'UNDER_REVIEW')`),
    },
    recentJobs: jobs.slice(0, 8).map((job) => ({
      id: job.id,
      title: job.title,
      category: job.category,
      status: job.status,
      budgetMin: job.budgetMin,
      budgetMax: job.budgetMax,
      createdAt: job.createdAt,
      clientName: job.clientName,
      clientEmail: job.clientEmail,
    })),
    recentTransactions: getRecentTransactions(db),
  };
}

export function getAdminManagedUserDetails(
  users: Array<{ id: number; role: "CLIENT" | "PROFESSIONAL" }>,
) {
  const db = getDatabase();

  return Object.fromEntries(
    users.map((user) => {
      const projects = getManagedUserProjects(db, user.id, user.role);
      const transactions = getManagedUserTransactions(db, user.id, user.role);
      const completedTransactions = transactions.filter(
        (transaction) => transaction.status === "COMPLETED",
      );

      return [
        user.id,
        {
          userId: user.id,
          projectCount: projects.length,
          activeProjectCount: projects.filter((project) => project.trackingStatus === "ACTIVE")
            .length,
          completedProjectCount: projects.filter(
            (project) => project.trackingStatus === "COMPLETED",
          ).length,
          totalMoney: completedTransactions.reduce(
            (total, transaction) => total + transaction.amount,
            0,
          ),
          projects,
          transactions,
        } satisfies AdminManagedUserDetail,
      ];
    }),
  ) as Record<number, AdminManagedUserDetail>;
}

function getManagedUserProjects(
  db: BetterSqlite3Database,
  userId: number,
  role: "CLIENT" | "PROFESSIONAL",
) {
  const modernProjects = getModernManagedUserProjects(db, userId, role);
  const modernJobIds = new Set(modernProjects.map((project) => project.id));
  const legacyProjects = getLegacyManagedUserProjects(db, userId, role, modernJobIds);

  return [...modernProjects, ...legacyProjects].sort(
    (a, b) =>
      managedProjectStatusOrder(a.trackingStatus) - managedProjectStatusOrder(b.trackingStatus) ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function getModernManagedUserProjects(
  db: BetterSqlite3Database,
  userId: number,
  role: "CLIENT" | "PROFESSIONAL",
) {
  if (!tableExists(db, `"ClientJob"`)) {
    return [] as AdminManagedUserProject[];
  }

  const hasTracking = tableExists(db, `"ProjectTracking"`);
  const hasRequests = tableExists(db, `"ProjectRequest"`);
  const trackingJoin = hasTracking
    ? `LEFT JOIN "ProjectTracking" ON ProjectTracking.id = (
        SELECT latest.id FROM "ProjectTracking" AS latest
        WHERE latest.jobId = ClientJob.id
        ORDER BY datetime(latest.updatedAt) DESC, latest.id DESC LIMIT 1
      )`
    : "";
  const userJoin = hasTracking
    ? `LEFT JOIN "User" AS Counterpart ON Counterpart.id = ${role === "CLIENT" ? "ProjectTracking.professionalId" : "ProjectTracking.clientId"}`
    : "";
  const requestJoin =
    hasTracking && hasRequests
      ? `LEFT JOIN "ProjectRequest" ON ProjectRequest.id = ProjectTracking.requestId`
      : "";
  const where =
    role === "CLIENT"
      ? "ClientJob.userId = ?"
      : hasTracking
        ? "ProjectTracking.professionalId = ?"
        : "1 = 0";

  return db
    .prepare(
      `
      SELECT
        ClientJob.id,
        ClientJob.title,
        ClientJob.category,
        ClientJob.status,
        ${hasTracking ? "ProjectTracking.status" : "NULL"} AS trackingStatus,
        ${hasTracking ? "TRIM(Counterpart.firstName || ' ' || Counterpart.lastName)" : "NULL"} AS counterpartName,
        ${hasTracking ? "Counterpart.email" : "NULL"} AS counterpartEmail,
        ${hasTracking && hasRequests ? "ProjectRequest.bidAmount" : "NULL"} AS agreedAmount,
        ClientJob.createdAt
      FROM "ClientJob"
      ${trackingJoin}
      ${userJoin}
      ${requestJoin}
      WHERE ${where}
      ORDER BY
        CASE ${hasTracking ? "ProjectTracking.status" : "NULL"} WHEN 'ACTIVE' THEN 0 WHEN 'COMPLETED' THEN 1 ELSE 2 END,
        datetime(ClientJob.createdAt) DESC
    `,
    )
    .all(userId) as AdminManagedUserProject[];
}

function getLegacyManagedUserProjects(
  db: BetterSqlite3Database,
  userId: number,
  role: "CLIENT" | "PROFESSIONAL",
  modernJobIds: Set<number>,
) {
  if (!tableExists(db, `"jobs"`)) {
    return [] as AdminManagedUserProject[];
  }

  const hasContracts = tableExists(db, `"contracts"`);
  const hasTracking = tableExists(db, `"ProjectTracking"`);

  if (role === "PROFESSIONAL" && !hasContracts) {
    return [] as AdminManagedUserProject[];
  }

  const contractJoin = hasContracts
    ? `
        LEFT JOIN "contracts" AS Contract ON Contract.id = (
          SELECT latestContract.id
          FROM "contracts" AS latestContract
          WHERE latestContract.job_id = LegacyJob.id
            ${role === "PROFESSIONAL" ? "AND CAST(latestContract.professional_id AS INTEGER) = ?" : ""}
          ORDER BY datetime(latestContract.updated_at) DESC, latestContract.id DESC
          LIMIT 1
        )
      `
    : "";
  const trackingJoin =
    hasContracts && hasTracking
      ? `
          LEFT JOIN "ProjectTracking" ON ProjectTracking.id = COALESCE(
            Contract.tracking_id,
            (
              SELECT latestTracking.id
              FROM "ProjectTracking" AS latestTracking
              WHERE latestTracking.jobId = Contract.client_project_id
                AND latestTracking.clientId = CAST(Contract.client_id AS INTEGER)
                AND latestTracking.professionalId = CAST(Contract.professional_id AS INTEGER)
              ORDER BY datetime(latestTracking.updatedAt) DESC, latestTracking.id DESC
              LIMIT 1
            )
          )
        `
      : "";
  const counterpartJoin =
    role === "CLIENT"
      ? hasContracts
        ? `LEFT JOIN "User" AS Counterpart ON Counterpart.id = CAST(Contract.professional_id AS INTEGER)`
        : ""
      : `LEFT JOIN "User" AS Counterpart ON Counterpart.id = CAST(LegacyJob.client_id AS INTEGER)`;
  const where =
    role === "CLIENT"
      ? `CAST(LegacyJob.client_id AS INTEGER) = ?`
      : `Contract.id IS NOT NULL AND CAST(Contract.professional_id AS INTEGER) = ?`;
  const parameters = role === "PROFESSIONAL" ? [userId, userId] : [userId];

  const rows = db
    .prepare(
      `
        SELECT
          LegacyJob.id AS legacyId,
          LegacyJob.title,
          'Legacy project' AS category,
          LegacyJob.status AS jobStatus,
          ${hasContracts ? "Contract.status" : "NULL"} AS contractStatus,
          ${hasContracts ? "Contract.client_project_id" : "NULL"} AS linkedJobId,
          ${hasContracts ? "Contract.total_amount" : "NULL"} AS contractAmount,
          ${hasContracts && hasTracking ? "ProjectTracking.status" : "NULL"} AS trackingStatus,
          ${
            hasContracts
              ? "COALESCE(Contract.total_amount, LegacyJob.budget_max, LegacyJob.budget_min)"
              : "COALESCE(LegacyJob.budget_max, LegacyJob.budget_min)"
          } AS agreedAmount,
          ${
            counterpartJoin ? "TRIM(Counterpart.firstName || ' ' || Counterpart.lastName)" : "NULL"
          } AS counterpartName,
          ${counterpartJoin ? "Counterpart.email" : "NULL"} AS counterpartEmail,
          LegacyJob.created_at AS createdAt
        FROM "jobs" AS LegacyJob
        ${contractJoin}
        ${trackingJoin}
        ${counterpartJoin}
        WHERE ${where}
        ORDER BY datetime(LegacyJob.created_at) DESC
      `,
    )
    .all(...parameters) as Array<{
    legacyId: string;
    title: string;
    category: string;
    jobStatus: string;
    contractStatus: string | null;
    linkedJobId: number | null;
    contractAmount: number | null;
    trackingStatus: string | null;
    agreedAmount: number | null;
    counterpartName: string | null;
    counterpartEmail: string | null;
    createdAt: string;
  }>;

  const contractProjects = rows
    .filter((project) => !project.linkedJobId || !modernJobIds.has(project.linkedJobId))
    .map((project, index) => {
      const normalizedTrackingStatus = normalizeManagedProjectTrackingStatus(
        project.trackingStatus,
        project.contractStatus,
      );

      return {
        id: -(index + 1),
        title: project.title || "Untitled project",
        category: project.category,
        status: normalizeLegacyJobStatus(
          project.jobStatus,
          project.contractStatus,
          normalizedTrackingStatus,
        ),
        trackingStatus: normalizedTrackingStatus,
        counterpartName: project.counterpartName || null,
        counterpartEmail: project.counterpartEmail || null,
        agreedAmount: project.agreedAmount,
        createdAt: project.createdAt,
      } satisfies AdminManagedUserProject;
    });

  if (role !== "PROFESSIONAL" || !hasTracking) {
    return contractProjects;
  }

  const hasRequests = tableExists(db, `"ProjectRequest"`);
  const orphanedTrackedProjects = db
    .prepare(
      `
        SELECT
          ProjectTracking.id,
          ProjectTracking.jobId,
          ProjectTracking.status AS trackingStatus,
          ProjectTracking.createdAt,
          ${hasRequests ? "ProjectRequest.bidAmount" : "NULL"} AS agreedAmount,
          TRIM(ClientUser.firstName || ' ' || ClientUser.lastName) AS counterpartName,
          ClientUser.email AS counterpartEmail
        FROM "ProjectTracking"
        LEFT JOIN "User" AS ClientUser ON ClientUser.id = ProjectTracking.clientId
        ${hasRequests ? `LEFT JOIN "ProjectRequest" ON ProjectRequest.id = ProjectTracking.requestId` : ""}
        WHERE ProjectTracking.professionalId = ?
          ${
            hasContracts
              ? `AND NOT EXISTS (
                  SELECT 1
                  FROM "contracts" AS MatchingContract
                  WHERE CAST(MatchingContract.professional_id AS INTEGER) = ProjectTracking.professionalId
                    AND (
                      MatchingContract.tracking_id = ProjectTracking.id
                      OR MatchingContract.client_project_id = ProjectTracking.jobId
                    )
                )`
              : ""
          }
        ORDER BY datetime(ProjectTracking.createdAt) DESC, ProjectTracking.id DESC
      `,
    )
    .all(userId) as Array<{
    id: number;
    jobId: number;
    trackingStatus: string;
    createdAt: string;
    agreedAmount: number | null;
    counterpartName: string | null;
    counterpartEmail: string | null;
  }>;

  return [
    ...contractProjects,
    ...orphanedTrackedProjects.map((project, index) => ({
      id: -(contractProjects.length + index + 1),
      title: `Tracked project #${project.jobId}`,
      category: "Tracked project",
      status: project.trackingStatus === "COMPLETED" ? "CLOSED" : project.trackingStatus,
      trackingStatus: project.trackingStatus,
      counterpartName: project.counterpartName || null,
      counterpartEmail: project.counterpartEmail || null,
      agreedAmount: project.agreedAmount,
      createdAt: project.createdAt,
    })),
  ];
}

function normalizeManagedProjectTrackingStatus(
  trackingStatus: string | null,
  contractStatus: string | null,
) {
  if (trackingStatus) {
    return trackingStatus.toUpperCase();
  }

  const normalizedContractStatus = contractStatus?.toLowerCase();
  if (normalizedContractStatus === "completed") return "COMPLETED";
  if (["cancelled", "rejected"].includes(normalizedContractStatus || "")) return "CANCELLED";
  if (["accepted", "started", "active"].includes(normalizedContractStatus || "")) return "ACTIVE";
  return null;
}

function managedProjectStatusOrder(status: string | null) {
  if (status === "ACTIVE") return 0;
  if (status === "COMPLETED") return 1;
  if (status === "CANCELLED") return 3;
  return 2;
}

function getManagedUserTransactions(
  db: BetterSqlite3Database,
  userId: number,
  role: "CLIENT" | "PROFESSIONAL",
) {
  if (!tableExists(db, `"ProjectTransaction"`)) {
    return [] as AdminManagedUserTransaction[];
  }

  const hasTracking = tableExists(db, `"ProjectTracking"`);
  const hasJobs = tableExists(db, `"ClientJob"`);
  const counterpartColumn =
    role === "CLIENT" ? "ProjectTransaction.professionalId" : "ProjectTransaction.clientId";
  const userColumn =
    role === "CLIENT" ? "ProjectTransaction.clientId" : "ProjectTransaction.professionalId";

  return db
    .prepare(
      `
      SELECT
        ProjectTransaction.id,
        ${hasTracking && hasJobs ? "COALESCE(ClientJob.title, ProjectTransaction.description)" : "ProjectTransaction.description"} AS projectTitle,
        ProjectTransaction.amount,
        ProjectTransaction.currency,
        ProjectTransaction.type,
        ProjectTransaction.status,
        COALESCE(TRIM(Counterpart.firstName || ' ' || Counterpart.lastName), 'Unknown user') AS counterpartName,
        ProjectTransaction.createdAt
      FROM "ProjectTransaction"
      ${hasTracking ? `LEFT JOIN "ProjectTracking" ON ProjectTracking.id = ProjectTransaction.trackingId` : ""}
      ${hasTracking && hasJobs ? `LEFT JOIN "ClientJob" ON ClientJob.id = ProjectTracking.jobId` : ""}
      LEFT JOIN "User" AS Counterpart ON Counterpart.id = ${counterpartColumn}
      WHERE ${userColumn} = ?
      ORDER BY datetime(ProjectTransaction.createdAt) DESC, ProjectTransaction.id DESC
    `,
    )
    .all(userId) as AdminManagedUserTransaction[];
}

function tableExists(db: BetterSqlite3Database, tableName: string) {
  const normalized = tableName.replaceAll(`"`, "");
  const result = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`)
    .get(normalized) as { name: string } | undefined;

  return Boolean(result);
}

function count(db: BetterSqlite3Database, tableName: string, where?: string) {
  if (!tableExists(db, tableName)) {
    return 0;
  }

  const row = db
    .prepare(`SELECT COUNT(*) AS value FROM ${tableName}${where ? ` WHERE ${where}` : ""}`)
    .get() as { value: number };

  return Number(row?.value || 0);
}

function countSince(
  db: BetterSqlite3Database,
  tableName: string,
  columnName: string,
  since: string,
  extraWhere?: string,
) {
  if (!tableExists(db, tableName)) {
    return 0;
  }

  const where = [`datetime(${columnName}) >= datetime(?)`, extraWhere]
    .filter(Boolean)
    .join(" AND ");
  const row = db
    .prepare(`SELECT COUNT(*) AS value FROM ${tableName} WHERE ${where}`)
    .get(since) as { value: number };

  return Number(row?.value || 0);
}

function sumAmount(db: BetterSqlite3Database, since: string | null) {
  if (!tableExists(db, `"ProjectTransaction"`)) {
    return 0;
  }

  const where = since
    ? `status = 'COMPLETED' AND datetime(createdAt) >= datetime(?)`
    : `status = 'COMPLETED'`;
  const row = db
    .prepare(`SELECT COALESCE(SUM(amount), 0) AS value FROM "ProjectTransaction" WHERE ${where}`)
    .get(...(since ? [since] : [])) as { value: number };

  return Number(row?.value || 0);
}

function getRecentJobs(db: BetterSqlite3Database) {
  if (!tableExists(db, `"ClientJob"`) || !tableExists(db, `"User"`)) {
    return [] as AdminRecentJob[];
  }

  return db
    .prepare(
      `
        SELECT
          ClientJob.id,
          ClientJob.title,
          ClientJob.category,
          ClientJob.status,
          ClientJob.budgetMin,
          ClientJob.budgetMax,
          ClientJob.createdAt,
          TRIM(User.firstName || ' ' || User.lastName) AS clientName,
          User.email AS clientEmail
        FROM "ClientJob"
        INNER JOIN "User" ON User.id = ClientJob.userId
        ORDER BY datetime(ClientJob.createdAt) DESC, ClientJob.id DESC
        LIMIT 8
      `,
    )
    .all() as AdminRecentJob[];
}

function getRecentTransactions(db: BetterSqlite3Database) {
  if (!tableExists(db, `"ProjectTransaction"`)) {
    return [] as AdminRecentTransaction[];
  }

  return db
    .prepare(
      `
        SELECT
          ProjectTransaction.id,
          ProjectTransaction.amount,
          ProjectTransaction.currency,
          ProjectTransaction.type,
          ProjectTransaction.status,
          ProjectTransaction.description,
          ProjectTransaction.createdAt,
          COALESCE(ClientJob.title, ProjectTransaction.description, 'Project payment') AS projectTitle,
          TRIM(ClientUser.firstName || ' ' || ClientUser.lastName) AS clientName,
          TRIM(ProUser.firstName || ' ' || ProUser.lastName) AS professionalName
        FROM "ProjectTransaction"
        LEFT JOIN "ProjectTracking" ON ProjectTracking.id = ProjectTransaction.trackingId
        LEFT JOIN "ClientJob" ON ClientJob.id = ProjectTracking.jobId
        LEFT JOIN "User" AS ClientUser ON ClientUser.id = ProjectTransaction.clientId
        LEFT JOIN "User" AS ProUser ON ProUser.id = ProjectTransaction.professionalId
        ORDER BY datetime(ProjectTransaction.createdAt) DESC, ProjectTransaction.id DESC
        LIMIT 8
      `,
    )
    .all() as AdminRecentTransaction[];
}

export function getAdminPaymentTransactions() {
  const db = getDatabase();

  if (
    !tableExists(db, `"ProjectTransaction"`) ||
    !tableExists(db, `"User"`) ||
    !tableExists(db, `"ProjectTracking"`) ||
    !tableExists(db, `"ClientJob"`)
  ) {
    return [] as AdminPaymentTransaction[];
  }

  const rows = db
    .prepare(
      `
        SELECT
          ProjectTransaction.id,
          COALESCE(ClientJob.title, ProjectTransaction.description, 'Project payment') AS jobTitle,
          TRIM(ClientUser.firstName || ' ' || ClientUser.lastName) AS clientName,
          ClientUser.email AS clientEmail,
          TRIM(ProUser.firstName || ' ' || ProUser.lastName) AS professionalName,
          ProUser.email AS professionalEmail,
          ProjectTransaction.amount,
          ProjectTransaction.currency,
          ProjectTransaction.type AS paymentType,
          ProjectTransaction.status,
          ProjectTransaction.createdAt AS dateTime
        FROM "ProjectTransaction"
        LEFT JOIN "ProjectTracking" ON ProjectTracking.id = ProjectTransaction.trackingId
        LEFT JOIN "ClientJob" ON ClientJob.id = ProjectTracking.jobId
        LEFT JOIN "User" AS ClientUser ON ClientUser.id = ProjectTransaction.clientId
        LEFT JOIN "User" AS ProUser ON ProUser.id = ProjectTransaction.professionalId
        ORDER BY datetime(ProjectTransaction.createdAt) DESC, ProjectTransaction.id DESC
      `,
    )
    .all() as Array<AdminPaymentTransaction>;

  return rows.map((payment) => ({
    ...payment,
    jobTitle: payment.jobTitle || "Project payment",
    clientName: payment.clientName || "Unknown client",
    clientEmail: payment.clientEmail || "Unknown email",
    professionalName: payment.professionalName || "Unknown professional",
    professionalEmail: payment.professionalEmail || "Unknown email",
  }));
}

export function getAdminJobRecords() {
  const db = getDatabase();

  if (!tableExists(db, `"User"`)) {
    return [] as AdminJobRecord[];
  }

  const hasClientJobs = tableExists(db, `"ClientJob"`);
  const hasProjectTracking = tableExists(db, `"ProjectTracking"`);
  const hasCompletionRequests = tableExists(db, `"ProjectCompletionRequest"`);
  const trackingJoin = hasProjectTracking
    ? `
        LEFT JOIN "ProjectTracking" ON ProjectTracking.id = (
          SELECT latestTracking.id
          FROM "ProjectTracking" AS latestTracking
          WHERE latestTracking.jobId = ClientJob.id
            AND latestTracking.status != 'CANCELLED'
          ORDER BY
            CASE latestTracking.status WHEN 'COMPLETED' THEN 0 WHEN 'ACTIVE' THEN 1 ELSE 2 END,
            datetime(latestTracking.updatedAt) DESC,
            latestTracking.id DESC
          LIMIT 1
        )
        LEFT JOIN "User" AS ProfessionalUser ON ProfessionalUser.id = ProjectTracking.professionalId
      `
    : "";
  const completionJoin =
    hasProjectTracking && hasCompletionRequests
      ? `
          LEFT JOIN "ProjectCompletionRequest" ON ProjectCompletionRequest.id = (
            SELECT latestCompletion.id
            FROM "ProjectCompletionRequest" AS latestCompletion
            WHERE latestCompletion.trackingId = ProjectTracking.id
            ORDER BY
              CASE latestCompletion.status WHEN 'APPROVED' THEN 0 ELSE 1 END,
              datetime(latestCompletion.updatedAt) DESC,
              latestCompletion.id DESC
            LIMIT 1
          )
        `
      : "";

  const rows = hasClientJobs
    ? (db
        .prepare(
          `
        SELECT
          ClientJob.id,
          ClientJob.title,
          ClientJob.description,
          ClientJob.category,
          ClientJob.status,
          ClientJob.budgetMin,
          ClientJob.budgetMax,
          ClientJob.urgency,
          ClientJob.timingType,
          ClientJob.jobDate,
          ClientJob.deadline,
          ClientJob.workMode,
          ClientJob.locationLabel,
          ClientJob.locationAddress,
          ClientJob.locationLat,
          ClientJob.locationLng,
          ClientJob.createdAt,
          ClientJob.updatedAt,
          TRIM(User.firstName || ' ' || User.lastName) AS clientName,
          User.email AS clientEmail,
          ${hasProjectTracking ? "ProjectTracking.id" : "NULL"} AS trackingId,
          ${hasProjectTracking ? "ProjectTracking.requestId" : "NULL"} AS requestId,
          ${hasProjectTracking ? "ProjectTracking.status" : "NULL"} AS trackingStatus,
          ${hasProjectTracking ? "ProjectTracking.acceptedAt" : "NULL"} AS acceptedAt,
          ${
            hasProjectTracking
              ? "CASE WHEN ProjectTracking.status = 'COMPLETED' THEN ProjectTracking.updatedAt ELSE NULL END"
              : "NULL"
          } AS completedAt,
          ${
            hasProjectTracking && hasCompletionRequests
              ? "ProjectCompletionRequest.submittedAt"
              : "NULL"
          } AS completionSubmittedAt,
          ${
            hasProjectTracking
              ? "TRIM(ProfessionalUser.firstName || ' ' || ProfessionalUser.lastName)"
              : "NULL"
          } AS professionalName,
          ${hasProjectTracking ? "ProfessionalUser.email" : "NULL"} AS professionalEmail
        FROM "ClientJob"
        INNER JOIN "User" ON User.id = ClientJob.userId
        ${trackingJoin}
        ${completionJoin}
        ORDER BY datetime(ClientJob.createdAt) DESC, ClientJob.id DESC
      `,
        )
        .all() as AdminJobRecord[])
    : [];
  const attachments = getAdminJobAttachments(db);
  const requests = getAdminJobRequests(db);
  const workUploads = getAdminJobWorkUploads(db);
  const modernJobIds = new Set(rows.map((job) => job.id));
  const legacyRows = getLegacyAdminJobRecords(db, modernJobIds, requests, workUploads);

  return [
    ...rows.map((job) => ({
      ...job,
      clientName: job.clientName || "Unknown client",
      clientEmail: job.clientEmail || "Unknown email",
      professionalName: job.professionalName || null,
      professionalEmail: job.professionalEmail || null,
      attachments: attachments.filter((attachment) => attachment.jobId === job.id),
      requests: requests.filter((request) => request.jobId === job.id),
      workUploads: workUploads.filter((upload) => upload.jobId === job.id),
    })),
    ...legacyRows,
  ].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id - a.id,
  );
}

function getLegacyAdminJobRecords(
  db: BetterSqlite3Database,
  modernJobIds: Set<number>,
  requests: AdminJobRequestRecord[],
  workUploads: AdminJobWorkUploadRecord[],
) {
  if (!tableExists(db, `"jobs"`)) {
    return [] as AdminJobRecord[];
  }

  const hasContracts = tableExists(db, `"contracts"`);
  const hasTracking = tableExists(db, `"ProjectTracking"`);
  const hasCompletionRequests = tableExists(db, `"ProjectCompletionRequest"`);
  const contractJoin = hasContracts
    ? `
        LEFT JOIN "contracts" AS Contract ON Contract.id = (
          SELECT latestContract.id
          FROM "contracts" AS latestContract
          WHERE latestContract.job_id = LegacyJob.id
          ORDER BY datetime(latestContract.updated_at) DESC, latestContract.id DESC
          LIMIT 1
        )
      `
    : "";
  const trackingJoin =
    hasContracts && hasTracking
      ? `
          LEFT JOIN "ProjectTracking" ON ProjectTracking.id = COALESCE(
            Contract.tracking_id,
            (
              SELECT latestTracking.id
              FROM "ProjectTracking" AS latestTracking
              WHERE latestTracking.jobId = Contract.client_project_id
                AND LOWER(COALESCE(Contract.status, '')) IN ('accepted', 'started', 'active', 'completed', 'cancelled')
              ORDER BY datetime(latestTracking.updatedAt) DESC, latestTracking.id DESC
              LIMIT 1
            )
          )
        `
      : "";
  const completionJoin =
    hasContracts && hasTracking && hasCompletionRequests
      ? `
          LEFT JOIN "ProjectCompletionRequest" ON ProjectCompletionRequest.id = (
            SELECT latestCompletion.id
            FROM "ProjectCompletionRequest" AS latestCompletion
            WHERE latestCompletion.trackingId = ProjectTracking.id
            ORDER BY datetime(latestCompletion.updatedAt) DESC, latestCompletion.id DESC
            LIMIT 1
          )
        `
      : "";

  const rows = db
    .prepare(
      `
        SELECT
          LegacyJob.id AS legacyId,
          LegacyJob.title,
          COALESCE(LegacyJob.description, '') AS description,
          'Legacy project' AS category,
          LegacyJob.status AS legacyStatus,
          LegacyJob.budget_min AS budgetMin,
          LegacyJob.budget_max AS budgetMax,
          COALESCE(LegacyJob.urgency, 'MEDIUM') AS urgency,
          'FIXED' AS timingType,
          LegacyJob.job_date AS jobDate,
          COALESCE(LegacyJob.deadline, LegacyJob.created_at) AS deadline,
          COALESCE(LegacyJob.job_type, 'both') AS workMode,
          LegacyJob.city AS locationLabel,
          LegacyJob.city AS locationAddress,
          LegacyJob.lat AS locationLat,
          LegacyJob.lng AS locationLng,
          LegacyJob.created_at AS createdAt,
          ${hasContracts ? "COALESCE(Contract.updated_at, LegacyJob.created_at)" : "LegacyJob.created_at"} AS updatedAt,
          TRIM(ClientUser.firstName || ' ' || ClientUser.lastName) AS clientName,
          ClientUser.email AS clientEmail,
          ${hasContracts && hasTracking ? "ProjectTracking.id" : "NULL"} AS trackingId,
          ${hasContracts && hasTracking ? "ProjectTracking.requestId" : "NULL"} AS requestId,
          ${hasContracts && hasTracking ? "ProjectTracking.status" : "NULL"} AS trackingStatus,
          ${hasContracts && hasTracking ? "ProjectTracking.acceptedAt" : "NULL"} AS acceptedAt,
          ${
            hasContracts && hasTracking
              ? "CASE WHEN ProjectTracking.status = 'COMPLETED' THEN ProjectTracking.updatedAt ELSE NULL END"
              : "NULL"
          } AS completedAt,
          ${
            hasContracts && hasTracking && hasCompletionRequests
              ? "ProjectCompletionRequest.submittedAt"
              : "NULL"
          } AS completionSubmittedAt,
          ${hasContracts ? "Contract.client_project_id" : "NULL"} AS linkedJobId,
          ${hasContracts ? "Contract.status" : "NULL"} AS contractStatus,
          ${hasContracts ? "Contract.total_amount" : "NULL"} AS contractAmount,
          ${
            hasContracts
              ? "TRIM(ProfessionalUser.firstName || ' ' || ProfessionalUser.lastName)"
              : "NULL"
          } AS professionalName,
          ${hasContracts ? "ProfessionalUser.email" : "NULL"} AS professionalEmail
        FROM "jobs" AS LegacyJob
        LEFT JOIN "User" AS ClientUser ON CAST(ClientUser.id AS TEXT) = LegacyJob.client_id
        ${contractJoin}
        ${
          hasContracts
            ? `LEFT JOIN "User" AS ProfessionalUser ON CAST(ProfessionalUser.id AS TEXT) = Contract.professional_id`
            : ""
        }
        ${trackingJoin}
        ${completionJoin}
        ORDER BY datetime(LegacyJob.created_at) DESC
      `,
    )
    .all() as Array<
    Omit<AdminJobRecord, "id" | "status" | "attachments" | "requests" | "workUploads"> & {
      legacyId: string;
      legacyStatus: string;
      linkedJobId: number | null;
      contractStatus: string | null;
      contractAmount: number | null;
    }
  >;

  return rows
    .filter((row) => !row.linkedJobId || !modernJobIds.has(row.linkedJobId))
    .map((row, index) => {
      const linkedRequests = row.linkedJobId
        ? requests.filter((request) => request.jobId === row.linkedJobId)
        : [];
      const linkedUploads = row.linkedJobId
        ? workUploads.filter((upload) => upload.jobId === row.linkedJobId)
        : [];
      const budgetMin = row.budgetMin ?? row.contractAmount;
      const budgetMax = row.budgetMax ?? row.contractAmount;

      return {
        id: -(index + 1),
        title: row.title || "Untitled project",
        description: row.description || "No project description was saved.",
        category: row.category,
        status: normalizeLegacyJobStatus(row.legacyStatus, row.contractStatus, row.trackingStatus),
        budgetMin,
        budgetMax,
        urgency: String(row.urgency || "MEDIUM").toUpperCase(),
        timingType: row.timingType,
        jobDate: row.jobDate,
        deadline: row.deadline,
        workMode: normalizeLegacyWorkMode(row.workMode),
        locationLabel: row.locationLabel,
        locationAddress: row.locationAddress,
        locationLat: row.locationLat,
        locationLng: row.locationLng,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        clientName: row.clientName || "Unknown client",
        clientEmail: row.clientEmail || "Unknown email",
        trackingId: row.trackingId,
        requestId: row.requestId,
        trackingStatus: row.trackingStatus,
        acceptedAt: row.acceptedAt,
        completedAt: row.completedAt,
        completionSubmittedAt: row.completionSubmittedAt,
        professionalName: row.professionalName || null,
        professionalEmail: row.professionalEmail || null,
        attachments: [],
        requests: linkedRequests,
        workUploads: linkedUploads,
      } satisfies AdminJobRecord;
    });
}

function normalizeLegacyJobStatus(
  jobStatus: string | null,
  contractStatus: string | null,
  trackingStatus: string | null,
) {
  if (trackingStatus === "COMPLETED" || contractStatus?.toLowerCase() === "completed") {
    return "CLOSED";
  }

  if (
    trackingStatus === "CANCELLED" ||
    ["cancelled", "rejected"].includes(contractStatus?.toLowerCase() || "")
  ) {
    return "CANCELLED";
  }

  if (
    trackingStatus === "ACTIVE" ||
    ["accepted", "started", "active"].includes(contractStatus?.toLowerCase() || "")
  ) {
    return "OPEN";
  }

  const normalized = jobStatus?.toUpperCase();
  return normalized === "OPEN" || normalized === "CLOSED" ? normalized : "DRAFT";
}

function normalizeLegacyWorkMode(value: string | null) {
  const normalized = value?.toUpperCase().replace("-", "_");

  if (normalized === "ONSITE") return "ON_SITE";
  if (normalized === "REMOTE") return "REMOTE";
  return "BOTH";
}

function getAdminJobAttachments(db: BetterSqlite3Database) {
  if (!tableExists(db, `"ClientJobAttachment"`)) {
    return [] as AdminJobAttachmentRecord[];
  }

  return db
    .prepare(
      `
        SELECT id, jobId, fileName, fileType, fileSize, previewUrl, createdAt
        FROM "ClientJobAttachment"
        ORDER BY datetime(createdAt) ASC, id ASC
      `,
    )
    .all() as AdminJobAttachmentRecord[];
}

function getAdminJobRequests(db: BetterSqlite3Database) {
  if (!tableExists(db, `"ProjectRequest"`)) {
    return [] as AdminJobRequestRecord[];
  }

  const hasUser = tableExists(db, `"User"`);

  const rows = db
    .prepare(
      `
        SELECT
          ProjectRequest.id,
          ProjectRequest.jobId,
          ProjectRequest.professionalId,
          ${hasUser ? "TRIM(User.firstName || ' ' || User.lastName)" : "NULL"} AS professionalName,
          ${hasUser ? "User.email" : "NULL"} AS professionalEmail,
          ProjectRequest.bidAmount,
          ProjectRequest.duration,
          ProjectRequest.coverLetter,
          ProjectRequest.attachmentsJson,
          ProjectRequest.status,
          ProjectRequest.createdAt,
          ProjectRequest.updatedAt
        FROM "ProjectRequest"
        ${hasUser ? `LEFT JOIN "User" ON User.id = ProjectRequest.professionalId` : ""}
        ORDER BY datetime(ProjectRequest.updatedAt) DESC, ProjectRequest.id DESC
      `,
    )
    .all() as AdminJobRequestRecord[];

  return rows.map((request) => ({
    ...request,
    professionalName: request.professionalName || "Unknown professional",
    professionalEmail: request.professionalEmail || "Unknown email",
  }));
}

function getAdminJobWorkUploads(db: BetterSqlite3Database) {
  if (!tableExists(db, `"ProjectWorkUpload"`) || !tableExists(db, `"ProjectTracking"`)) {
    return [] as AdminJobWorkUploadRecord[];
  }

  const hasUser = tableExists(db, `"User"`);

  const rows = db
    .prepare(
      `
        SELECT
          ProjectWorkUpload.id,
          ProjectWorkUpload.trackingId,
          ProjectTracking.jobId,
          ${hasUser ? "TRIM(User.firstName || ' ' || User.lastName)" : "NULL"} AS professionalName,
          ${hasUser ? "User.email" : "NULL"} AS professionalEmail,
          ProjectWorkUpload.roundNumber,
          ProjectWorkUpload.title,
          ProjectWorkUpload.note,
          ProjectWorkUpload.fileName,
          ProjectWorkUpload.fileUrl,
          ProjectWorkUpload.filesJson,
          ProjectWorkUpload.createdAt
        FROM "ProjectWorkUpload"
        INNER JOIN "ProjectTracking" ON ProjectTracking.id = ProjectWorkUpload.trackingId
        ${hasUser ? `LEFT JOIN "User" ON User.id = ProjectTracking.professionalId` : ""}
        ORDER BY datetime(ProjectWorkUpload.createdAt) ASC, ProjectWorkUpload.id ASC
      `,
    )
    .all() as AdminJobWorkUploadRecord[];

  return rows.map((upload) => ({
    ...upload,
    professionalName: upload.professionalName || "Unknown professional",
    professionalEmail: upload.professionalEmail || "Unknown email",
  }));
}

export function getAdminDisputeRecords() {
  const db = getDatabase();

  if (
    !tableExists(db, `"ProjectDispute"`) ||
    !tableExists(db, `"ProjectTracking"`) ||
    !tableExists(db, `"User"`)
  ) {
    return [] as AdminDisputeRecord[];
  }

  const hasClientJobs = tableExists(db, `"ClientJob"`);
  const rows = db
    .prepare(
      `
        SELECT
          ProjectDispute.id,
          ProjectDispute.trackingId,
          ${hasClientJobs ? "ClientJob.id" : "NULL"} AS jobId,
          ${hasClientJobs ? "COALESCE(ClientJob.title, 'Tracked project')" : "'Tracked project'"} AS jobTitle,
          ProjectDispute.issueType,
          ProjectDispute.priority,
          ProjectDispute.status,
          ProjectDispute.message,
          ProjectDispute.createdAt,
          ProjectDispute.updatedAt,
          ProjectDispute.reporterRole,
          TRIM(ReporterUser.firstName || ' ' || ReporterUser.lastName) AS reporterName,
          ReporterUser.email AS reporterEmail,
          TRIM(ClientUser.firstName || ' ' || ClientUser.lastName) AS clientName,
          ClientUser.email AS clientEmail,
          TRIM(ProfessionalUser.firstName || ' ' || ProfessionalUser.lastName) AS professionalName,
          ProfessionalUser.email AS professionalEmail
        FROM "ProjectDispute"
        LEFT JOIN "ProjectTracking" ON ProjectTracking.id = ProjectDispute.trackingId
        ${hasClientJobs ? `LEFT JOIN "ClientJob" ON ClientJob.id = ProjectTracking.jobId` : ""}
        LEFT JOIN "User" AS ReporterUser ON ReporterUser.id = ProjectDispute.reporterId
        LEFT JOIN "User" AS ClientUser ON ClientUser.id = ProjectDispute.clientId
        LEFT JOIN "User" AS ProfessionalUser ON ProfessionalUser.id = ProjectDispute.professionalId
        ORDER BY
          CASE ProjectDispute.status WHEN 'OPEN' THEN 0 WHEN 'UNDER_REVIEW' THEN 1 ELSE 2 END,
          CASE ProjectDispute.priority WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END,
          datetime(ProjectDispute.createdAt) DESC,
          ProjectDispute.id DESC
      `,
    )
    .all() as AdminDisputeRecord[];

  return rows.map((dispute) => ({
    ...dispute,
    jobTitle: dispute.jobTitle || "Tracked project",
    reporterName: dispute.reporterName || "Unknown reporter",
    reporterEmail: dispute.reporterEmail || "Unknown email",
    clientName: dispute.clientName || "Unknown client",
    clientEmail: dispute.clientEmail || "Unknown email",
    professionalName: dispute.professionalName || "Unknown professional",
    professionalEmail: dispute.professionalEmail || "Unknown email",
  }));
}

export function updateAdminDisputeStatus(
  disputeId: number,
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED",
) {
  const db = getDatabase();

  if (!tableExists(db, `"ProjectDispute"`)) {
    throw new Error("Dispute records are not available.");
  }

  const timestamp = new Date().toISOString();
  db.prepare(
    `
      UPDATE "ProjectDispute"
      SET status = ?, updatedAt = ?
      WHERE id = ?
    `,
  ).run(status, timestamp, disputeId);

  const row = db.prepare(`SELECT id FROM "ProjectDispute" WHERE id = ? LIMIT 1`).get(disputeId) as
    | { id: number }
    | undefined;

  if (!row) {
    throw new Error("Dispute not found.");
  }

  return { id: disputeId, status, updatedAt: timestamp };
}

export function getAdminEarningsReport(): AdminEarningsReport {
  const db = getDatabase();
  const transactions = getAdminEarningsTransactions(db);
  const payouts = getAdminPayoutRecords(db);
  const professionals = getProfessionalEarningsSummaries(transactions, payouts);
  const totals = professionals.reduce(
    (summary, professional) => ({
      grossEarnings: summary.grossEarnings + professional.grossEarnings,
      commissionAmount: summary.commissionAmount + professional.commissionAmount,
      netEarnings: summary.netEarnings + professional.netEarnings,
      requestedPayouts: summary.requestedPayouts + professional.requestedPayouts,
      paidPayouts: summary.paidPayouts + professional.paidPayouts,
      pendingPayouts: summary.pendingPayouts + professional.pendingPayouts,
      processingPayouts:
        summary.processingPayouts +
        payouts
          .filter(
            (payout) =>
              payout.professionalId === professional.professionalId &&
              payout.status === "PROCESSING",
          )
          .reduce((total, payout) => total + payout.amount, 0),
      rejectedPayouts: summary.rejectedPayouts + professional.rejectedPayouts,
      availableBalance: summary.availableBalance + professional.availableBalance,
      transactionCount: summary.transactionCount + professional.transactionCount,
      payoutCount: summary.payoutCount + professional.payoutCount,
      professionalsWithEarnings:
        summary.professionalsWithEarnings + (professional.transactionCount > 0 ? 1 : 0),
    }),
    {
      grossEarnings: 0,
      commissionAmount: 0,
      netEarnings: 0,
      requestedPayouts: 0,
      paidPayouts: 0,
      pendingPayouts: 0,
      processingPayouts: 0,
      rejectedPayouts: 0,
      availableBalance: 0,
      transactionCount: 0,
      payoutCount: 0,
      professionalsWithEarnings: 0,
    },
  );

  return {
    generatedAt: new Date().toISOString(),
    commissionRate: PLATFORM_COMMISSION_RATE,
    totals,
    transactions,
    payouts,
    professionals,
  };
}

export function updateAdminPayoutStatus(
  payoutId: number,
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "REJECTED",
) {
  const db = getDatabase();

  if (!tableExists(db, `"ProjectWithdrawal"`)) {
    throw new Error("Payout records are not available.");
  }

  const timestamp = new Date().toISOString();
  db.prepare(
    `
      UPDATE "ProjectWithdrawal"
      SET status = ?, updatedAt = ?
      WHERE id = ?
    `,
  ).run(status, timestamp, payoutId);

  const row = db
    .prepare(`SELECT id FROM "ProjectWithdrawal" WHERE id = ? LIMIT 1`)
    .get(payoutId) as { id: number } | undefined;

  if (!row) {
    throw new Error("Payout request not found.");
  }

  return { id: payoutId, status, updatedAt: timestamp };
}

function getAdminEarningsTransactions(db: BetterSqlite3Database) {
  if (!tableExists(db, `"ProjectTransaction"`)) {
    return [] as AdminEarningsTransactionRecord[];
  }

  const hasProjectTracking = tableExists(db, `"ProjectTracking"`);
  const hasClientJob = tableExists(db, `"ClientJob"`);
  const hasUser = tableExists(db, `"User"`);

  const rows = db
    .prepare(
      `
        SELECT
          ProjectTransaction.id,
          ProjectTransaction.trackingId,
          ProjectTransaction.milestoneId,
          ProjectTransaction.completionId,
          ${
            hasClientJob && hasProjectTracking
              ? "COALESCE(ClientJob.title, ProjectTransaction.description, 'Project payment')"
              : "COALESCE(ProjectTransaction.description, 'Project payment')"
          } AS jobTitle,
          ${
            hasClientJob && hasProjectTracking
              ? "COALESCE(ClientJob.category, 'Project')"
              : "'Project'"
          } AS projectCategory,
          ${hasUser ? "TRIM(ClientUser.firstName || ' ' || ClientUser.lastName)" : "NULL"} AS clientName,
          ${hasUser ? "ClientUser.email" : "NULL"} AS clientEmail,
          ${hasUser ? "TRIM(ProUser.firstName || ' ' || ProUser.lastName)" : "NULL"} AS professionalName,
          ${hasUser ? "ProUser.email" : "NULL"} AS professionalEmail,
          ProjectTransaction.professionalId,
          ProjectTransaction.amount,
          ProjectTransaction.currency,
          ProjectTransaction.type AS paymentType,
          ProjectTransaction.status,
          ProjectTransaction.description,
          ProjectTransaction.createdAt AS dateTime
        FROM "ProjectTransaction"
        ${hasProjectTracking ? `LEFT JOIN "ProjectTracking" ON ProjectTracking.id = ProjectTransaction.trackingId` : ""}
        ${hasClientJob && hasProjectTracking ? `LEFT JOIN "ClientJob" ON ClientJob.id = ProjectTracking.jobId` : ""}
        ${hasUser ? `LEFT JOIN "User" AS ClientUser ON ClientUser.id = ProjectTransaction.clientId` : ""}
        ${hasUser ? `LEFT JOIN "User" AS ProUser ON ProUser.id = ProjectTransaction.professionalId` : ""}
        ORDER BY datetime(ProjectTransaction.createdAt) DESC, ProjectTransaction.id DESC
      `,
    )
    .all() as Array<
    AdminPaymentTransaction & {
      trackingId: number;
      milestoneId: number | null;
      completionId: number | null;
      professionalId: number;
      description: string;
      projectCategory: string | null;
    }
  >;

  return rows.map((transaction) => {
    const commissionAmount = getCommissionAmount(transaction.amount, transaction.status);
    const netPayoutAmount =
      transaction.status === "COMPLETED" ? Math.max(0, transaction.amount - commissionAmount) : 0;

    return {
      ...transaction,
      jobTitle: transaction.jobTitle || "Project payment",
      projectCategory: transaction.projectCategory || "Project",
      clientName: transaction.clientName || "Unknown client",
      clientEmail: transaction.clientEmail || "Unknown email",
      professionalName: transaction.professionalName || "Unknown professional",
      professionalEmail: transaction.professionalEmail || "Unknown email",
      grossAmount: transaction.status === "COMPLETED" ? transaction.amount : 0,
      commissionAmount,
      netPayoutAmount,
      platformShareRate: PLATFORM_COMMISSION_RATE,
    };
  });
}

function getAdminPayoutRecords(db: BetterSqlite3Database) {
  if (!tableExists(db, `"ProjectWithdrawal"`)) {
    return [] as AdminPayoutRecord[];
  }

  const hasUser = tableExists(db, `"User"`);
  const rows = db
    .prepare(
      `
        SELECT
          ProjectWithdrawal.id,
          ProjectWithdrawal.professionalId,
          ${hasUser ? "TRIM(User.firstName || ' ' || User.lastName)" : "NULL"} AS professionalName,
          ${hasUser ? "User.email" : "NULL"} AS professionalEmail,
          ProjectWithdrawal.amount,
          ProjectWithdrawal.currency,
          ProjectWithdrawal.destinationType,
          ProjectWithdrawal.destinationLabel,
          ProjectWithdrawal.status,
          ProjectWithdrawal.note,
          ProjectWithdrawal.createdAt,
          ProjectWithdrawal.updatedAt
        FROM "ProjectWithdrawal"
        ${hasUser ? `LEFT JOIN "User" ON User.id = ProjectWithdrawal.professionalId` : ""}
        ORDER BY
          CASE ProjectWithdrawal.status
            WHEN 'PENDING' THEN 0
            WHEN 'PROCESSING' THEN 1
            WHEN 'COMPLETED' THEN 2
            ELSE 3
          END,
          datetime(ProjectWithdrawal.createdAt) DESC,
          ProjectWithdrawal.id DESC
      `,
    )
    .all() as AdminPayoutRecord[];

  return rows.map((payout) => ({
    ...payout,
    professionalName: payout.professionalName || "Unknown professional",
    professionalEmail: payout.professionalEmail || "Unknown email",
  }));
}

function getProfessionalEarningsSummaries(
  transactions: AdminEarningsTransactionRecord[],
  payouts: AdminPayoutRecord[],
) {
  const professionalIds = new Set<number>();

  for (const transaction of transactions) {
    if (transaction.professionalId) {
      professionalIds.add(transaction.professionalId);
    }
  }

  for (const payout of payouts) {
    professionalIds.add(payout.professionalId);
  }

  return Array.from(professionalIds)
    .map((professionalId) => {
      const professionalTransactions = transactions.filter(
        (transaction) =>
          transaction.professionalId === professionalId && transaction.status === "COMPLETED",
      );
      const professionalPayouts = payouts.filter(
        (payout) => payout.professionalId === professionalId,
      );
      const firstTransaction = professionalTransactions[0];
      const firstPayout = professionalPayouts[0];
      const grossEarnings = professionalTransactions.reduce(
        (total, transaction) => total + transaction.grossAmount,
        0,
      );
      const commissionAmount = professionalTransactions.reduce(
        (total, transaction) => total + transaction.commissionAmount,
        0,
      );
      const netEarnings = professionalTransactions.reduce(
        (total, transaction) => total + transaction.netPayoutAmount,
        0,
      );
      const requestedPayouts = professionalPayouts
        .filter((payout) => payout.status !== "REJECTED")
        .reduce((total, payout) => total + payout.amount, 0);
      const paidPayouts = professionalPayouts
        .filter((payout) => payout.status === "COMPLETED")
        .reduce((total, payout) => total + payout.amount, 0);
      const pendingPayouts = professionalPayouts
        .filter((payout) => payout.status === "PENDING" || payout.status === "PROCESSING")
        .reduce((total, payout) => total + payout.amount, 0);
      const rejectedPayouts = professionalPayouts
        .filter((payout) => payout.status === "REJECTED")
        .reduce((total, payout) => total + payout.amount, 0);

      return {
        professionalId,
        professionalName:
          firstTransaction?.professionalName ||
          firstPayout?.professionalName ||
          "Unknown professional",
        professionalEmail:
          firstTransaction?.professionalEmail || firstPayout?.professionalEmail || "Unknown email",
        grossEarnings,
        commissionAmount,
        netEarnings,
        requestedPayouts,
        paidPayouts,
        pendingPayouts,
        rejectedPayouts,
        availableBalance: Math.max(0, netEarnings - requestedPayouts),
        transactionCount: professionalTransactions.length,
        payoutCount: professionalPayouts.length,
        lastTransactionAt: professionalTransactions[0]?.dateTime || null,
        lastPayoutAt: professionalPayouts[0]?.createdAt || null,
      } satisfies AdminProfessionalEarningsSummary;
    })
    .sort((a, b) => b.netEarnings - a.netEarnings || b.availableBalance - a.availableBalance);
}

function getCommissionAmount(amount: number, status: string) {
  if (status !== "COMPLETED") {
    return 0;
  }

  return Math.round(amount * PLATFORM_COMMISSION_RATE * 100) / 100;
}
