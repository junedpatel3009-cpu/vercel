import path from "node:path";
import Database from "better-sqlite3";

type BetterSqlite3Database = InstanceType<typeof Database>;

export type GlobalSearchResultItem = {
  id: string;
  group: "Users" | "Jobs" | "Disputes" | "Payments";
  label: string;
  subtitle: string;
  route?: string;
  badge?: string;
  avatarUrl?: string;
};

export type GlobalSearchResult = {
  query: string;
  results: GlobalSearchResultItem[];
  totalCount: number;
};

const globalForSearch = globalThis as typeof globalThis & {
  adminSearchDb?: BetterSqlite3Database;
};

function getDatabase() {
  if (!globalForSearch.adminSearchDb) {
    const databasePath = path.resolve(process.cwd(), "prisma", "app.db");
    globalForSearch.adminSearchDb = new Database(databasePath);
  }
  return globalForSearch.adminSearchDb;
}

function tableExists(db: BetterSqlite3Database, tableName: string) {
  const normalized = tableName.replaceAll(`"`, "");
  const result = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`)
    .get(normalized) as { name: string } | undefined;
  return Boolean(result);
}

function searchUsers(db: BetterSqlite3Database, term: string): GlobalSearchResultItem[] {
  if (!tableExists(db, "User")) return [];

  const like = `%${term}%`;
  const rows = db
    .prepare(
      `
        SELECT id, role, firstName, lastName, email, phone, companyName, avatarUrl
        FROM "User"
        WHERE
          LOWER(firstName) LIKE LOWER(?) OR
          LOWER(lastName) LIKE LOWER(?) OR
          LOWER(email) LIKE LOWER(?) OR
          LOWER(phone) LIKE LOWER(?) OR
          LOWER(companyName) LIKE LOWER(?) OR
          LOWER(firstName || ' ' || lastName) LIKE LOWER(?)
        ORDER BY datetime(createdAt) DESC
        LIMIT 15
      `,
    )
    .all(like, like, like, like, like, like) as Array<{
    id: number;
    role: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    companyName: string | null;
    avatarUrl: string | null;
  }>;

  return rows.map((user) => ({
    id: `user-${user.id}`,
    group: "Users" as const,
    label: `${user.firstName} ${user.lastName}`.trim() || user.email,
    subtitle: `${user.email}${user.phone ? ` / ${user.phone}` : ""}`,
    badge: user.role,
    avatarUrl: user.avatarUrl || undefined,
  }));
}

function searchJobs(db: BetterSqlite3Database, term: string): GlobalSearchResultItem[] {
  if (!tableExists(db, "User") || !tableExists(db, "ClientJob")) return [];

  const like = `%${term}%`;
  const rows = db
    .prepare(
      `
        SELECT
          ClientJob.id, ClientJob.title, ClientJob.category, ClientJob.status,
          TRIM(User.firstName || ' ' || User.lastName) AS clientName
        FROM "ClientJob"
        INNER JOIN "User" ON User.id = ClientJob.userId
        WHERE
          LOWER(ClientJob.title) LIKE LOWER(?) OR
          LOWER(ClientJob.description) LIKE LOWER(?) OR
          LOWER(ClientJob.category) LIKE LOWER(?) OR
          LOWER(TRIM(User.firstName || ' ' || User.lastName)) LIKE LOWER(?) OR
          LOWER(User.email) LIKE LOWER(?)
        ORDER BY datetime(ClientJob.createdAt) DESC
        LIMIT 15
      `,
    )
    .all(like, like, like, like, like) as Array<{
    id: number;
    title: string;
    category: string;
    status: string;
    clientName: string;
  }>;

  return rows.map((job) => ({
    id: `job-${job.id}`,
    group: "Jobs" as const,
    label: job.title,
    subtitle: `${job.clientName} / ${job.category}`,
    badge: job.status,
    route: `/project/${job.id}`,
  }));
}

function searchDisputes(db: BetterSqlite3Database, term: string): GlobalSearchResultItem[] {
  if (!tableExists(db, "ProjectDispute")) return [];

  const like = `%${term}%`;
  const rows = db
    .prepare(
      `
        SELECT id, issueType, priority, status, message
        FROM "ProjectDispute"
        WHERE
          LOWER(message) LIKE LOWER(?) OR
          LOWER(issueType) LIKE LOWER(?) OR
          LOWER(priority) LIKE LOWER(?) OR
          LOWER(status) LIKE LOWER(?)
        ORDER BY
          CASE status WHEN 'OPEN' THEN 0 WHEN 'UNDER_REVIEW' THEN 1 ELSE 2 END,
          datetime(createdAt) DESC
        LIMIT 10
      `,
    )
    .all(like, like, like, like) as Array<{
    id: number;
    issueType: string;
    priority: string;
    status: string;
    message: string;
  }>;

  return rows.map((dispute) => ({
    id: `dispute-${dispute.id}`,
    group: "Disputes" as const,
    label: `Dispute #${dispute.id} - ${dispute.issueType}`,
    subtitle: dispute.message.substring(0, 80) + (dispute.message.length > 80 ? "..." : ""),
    badge: `${dispute.status} / ${dispute.priority}`,
  }));
}

function searchPayments(db: BetterSqlite3Database, term: string): GlobalSearchResultItem[] {
  if (
    !tableExists(db, "ProjectTransaction") ||
    !tableExists(db, "ProjectTracking") ||
    !tableExists(db, "ClientJob")
  )
    return [];

  const like = `%${term}%`;
  const rows = db
    .prepare(
      `
        SELECT
          ProjectTransaction.id, ProjectTransaction.amount, ProjectTransaction.type, ProjectTransaction.status,
          COALESCE(ClientJob.title, ProjectTransaction.description, 'Project payment') AS jobTitle,
          TRIM(ClientUser.firstName || ' ' || ClientUser.lastName) AS clientName,
          TRIM(ProUser.firstName || ' ' || ProUser.lastName) AS professionalName
        FROM "ProjectTransaction"
        LEFT JOIN "ProjectTracking" ON ProjectTracking.id = ProjectTransaction.trackingId
        LEFT JOIN "ClientJob" ON ClientJob.id = ProjectTracking.jobId
        LEFT JOIN "User" AS ClientUser ON ClientUser.id = ProjectTransaction.clientId
        LEFT JOIN "User" AS ProUser ON ProUser.id = ProjectTransaction.professionalId
        WHERE
          LOWER(ClientJob.title) LIKE LOWER(?) OR
          LOWER(ProjectTransaction.description) LIKE LOWER(?) OR
          LOWER(ProjectTransaction.type) LIKE LOWER(?) OR
          LOWER(ProjectTransaction.status) LIKE LOWER(?) OR
          LOWER(TRIM(ClientUser.firstName || ' ' || ClientUser.lastName)) LIKE LOWER(?) OR
          LOWER(TRIM(ProUser.firstName || ' ' || ProUser.lastName)) LIKE LOWER(?) OR
          LOWER(ClientUser.email) LIKE LOWER(?) OR
          LOWER(ProUser.email) LIKE LOWER(?)
        ORDER BY datetime(ProjectTransaction.createdAt) DESC
        LIMIT 10
      `,
    )
    .all(like, like, like, like, like, like, like, like) as Array<{
    id: number;
    amount: number;
    type: string;
    status: string;
    jobTitle: string;
    clientName: string;
    professionalName: string;
  }>;

  return rows.map((payment) => ({
    id: `payment-${payment.id}`,
    group: "Payments" as const,
    label: payment.jobTitle,
    subtitle: `${payment.clientName} → ${payment.professionalName}`,
    badge: `${payment.type} / $${(payment.amount || 0).toLocaleString()}`,
  }));
}

export function adminGlobalSearch(query: string): GlobalSearchResult {
  const term = query.trim();

  if (!term || term.length < 1) {
    return { query, results: [], totalCount: 0 };
  }

  const db = getDatabase();

  const users = searchUsers(db, term);
  const jobs = searchJobs(db, term);
  const disputes = searchDisputes(db, term);
  const payments = searchPayments(db, term);

  const allResults = [...users, ...jobs, ...disputes, ...payments];

  return {
    query: term,
    results: allResults,
    totalCount: allResults.length,
  };
}
