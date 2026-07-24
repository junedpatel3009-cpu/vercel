import path from "node:path";
import Database from "better-sqlite3";

type BetterSqlite3Database = InstanceType<typeof Database>;

export type ProfessionalVerificationInfo = {
  userId: number;
  governmentIdUrl: string;
  licenseUrl: string;
  certifications: string[];
  insuranceUrl: string;
  selfieUrl: string;
  status: "not_started" | "pending" | "approved" | "rejected";
  updatedAt: string;
};

export type ProfessionalVerificationInput = {
  userId: number;
  governmentIdUrl?: string | null;
  licenseUrl?: string | null;
  certifications?: string[];
  insuranceUrl?: string | null;
  selfieUrl?: string | null;
};

export type AdminVerificationRecord = ProfessionalVerificationInfo & {
  professionalName: string;
  professionalEmail: string;
  professionalCategory: string | null;
  professionalCity: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  isVerified: boolean;
};

const globalForProVerificationDb = globalThis as typeof globalThis & {
  proVerificationDb?: BetterSqlite3Database;
};

function getDatabase() {
  if (!globalForProVerificationDb.proVerificationDb) {
    const databasePath = path.resolve(process.cwd(), "prisma", "app.db");
    globalForProVerificationDb.proVerificationDb = new Database(databasePath);
    ensureVerificationTable(globalForProVerificationDb.proVerificationDb);
  }

  return globalForProVerificationDb.proVerificationDb;
}

function ensureVerificationTable(db: BetterSqlite3Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "ProfessionalVerification" (
      "userId" INTEGER NOT NULL PRIMARY KEY,
      "governmentIdUrl" TEXT,
      "licenseUrl" TEXT,
      "certificationsJson" TEXT,
      "insuranceUrl" TEXT,
      "selfieUrl" TEXT,
      "status" TEXT NOT NULL DEFAULT 'not_started',
      "updatedAt" TEXT NOT NULL
    );
  `);
}

export function getProfessionalVerificationByUserId(userId: number) {
  const db = getDatabase();
  const row = db
    .prepare(
      `
        SELECT *
        FROM "ProfessionalVerification"
        WHERE userId = ?
        LIMIT 1
      `,
    )
    .get(userId) as
    | {
        userId: number;
        governmentIdUrl: string | null;
        licenseUrl: string | null;
        certificationsJson: string | null;
        insuranceUrl: string | null;
        selfieUrl: string | null;
        status: ProfessionalVerificationInfo["status"];
        updatedAt: string;
      }
    | undefined;

  if (!row) {
    return {
      userId,
      governmentIdUrl: "",
      licenseUrl: "",
      certifications: [],
      insuranceUrl: "",
      selfieUrl: "",
      status: "not_started",
      updatedAt: "",
    } satisfies ProfessionalVerificationInfo;
  }

  return {
    userId: row.userId,
    governmentIdUrl: row.governmentIdUrl ?? "",
    licenseUrl: row.licenseUrl ?? "",
    certifications: parseStringList(row.certificationsJson),
    insuranceUrl: row.insuranceUrl ?? "",
    selfieUrl: row.selfieUrl ?? "",
    status: row.status || "not_started",
    updatedAt: row.updatedAt,
  } satisfies ProfessionalVerificationInfo;
}

export function getAdminVerificationRecords() {
  const db = getDatabase();

  const rows = db
    .prepare(
      `
        SELECT
          "User".id AS userId,
          TRIM("User".firstName || ' ' || "User".lastName) AS professionalName,
          "User".email AS professionalEmail,
          "User".avatarUrl AS avatarUrl,
          "User".professionalCategory AS professionalCategory,
          "User".professionalCity AS professionalCity,
          "User".isActive AS isActive,
          "User".isVerified AS isVerified,
          ProfessionalVerification.governmentIdUrl AS governmentIdUrl,
          ProfessionalVerification.licenseUrl AS licenseUrl,
          ProfessionalVerification.certificationsJson AS certificationsJson,
          ProfessionalVerification.insuranceUrl AS insuranceUrl,
          ProfessionalVerification.selfieUrl AS selfieUrl,
          COALESCE(ProfessionalVerification.status, 'not_started') AS status,
          COALESCE(ProfessionalVerification.updatedAt, "User".updatedAt) AS updatedAt
        FROM "User"
        LEFT JOIN "ProfessionalVerification"
          ON ProfessionalVerification.userId = "User".id
        WHERE "User".role = 'PROFESSIONAL'
        ORDER BY
          CASE COALESCE(ProfessionalVerification.status, 'not_started')
            WHEN 'pending' THEN 0
            WHEN 'rejected' THEN 1
            WHEN 'not_started' THEN 2
            ELSE 3
          END,
          datetime(COALESCE(ProfessionalVerification.updatedAt, "User".updatedAt)) DESC,
          "User".id DESC
      `,
    )
    .all() as Array<{
    userId: number;
    professionalName: string | null;
    professionalEmail: string;
    avatarUrl: string | null;
    professionalCategory: string | null;
    professionalCity: string | null;
    isActive: number;
    isVerified: number;
    governmentIdUrl: string | null;
    licenseUrl: string | null;
    certificationsJson: string | null;
    insuranceUrl: string | null;
    selfieUrl: string | null;
    status: ProfessionalVerificationInfo["status"];
    updatedAt: string;
  }>;

  return rows.map((row) => ({
    userId: row.userId,
    professionalName: row.professionalName?.trim() || row.professionalEmail,
    professionalEmail: row.professionalEmail,
    avatarUrl: row.avatarUrl,
    professionalCategory: row.professionalCategory,
    professionalCity: row.professionalCity,
    isActive: Boolean(row.isActive),
    isVerified: Boolean(row.isVerified),
    governmentIdUrl: row.governmentIdUrl ?? "",
    licenseUrl: row.licenseUrl ?? "",
    certifications: parseStringList(row.certificationsJson),
    insuranceUrl: row.insuranceUrl ?? "",
    selfieUrl: row.selfieUrl ?? "",
    status: row.status || "not_started",
    updatedAt: row.updatedAt,
  })) satisfies AdminVerificationRecord[];
}

export function upsertProfessionalVerification(input: ProfessionalVerificationInput) {
  const db = getDatabase();
  const timestamp = new Date().toISOString();
  const hasSubmittedDocument = Boolean(
    input.governmentIdUrl ||
    input.licenseUrl ||
    input.insuranceUrl ||
    input.selfieUrl ||
    input.certifications?.length,
  );

  db.prepare(
    `
      INSERT INTO "ProfessionalVerification" (
        userId,
        governmentIdUrl,
        licenseUrl,
        certificationsJson,
        insuranceUrl,
        selfieUrl,
        status,
        updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(userId) DO UPDATE SET
        governmentIdUrl = excluded.governmentIdUrl,
        licenseUrl = excluded.licenseUrl,
        certificationsJson = excluded.certificationsJson,
        insuranceUrl = excluded.insuranceUrl,
        selfieUrl = excluded.selfieUrl,
        status = excluded.status,
        updatedAt = excluded.updatedAt
    `,
  ).run(
    input.userId,
    input.governmentIdUrl?.trim() || null,
    input.licenseUrl?.trim() || null,
    stringifyStringList(input.certifications ?? []),
    input.insuranceUrl?.trim() || null,
    input.selfieUrl?.trim() || null,
    hasSubmittedDocument ? "pending" : "not_started",
    timestamp,
  );

  return getProfessionalVerificationByUserId(input.userId);
}

export function updateProfessionalVerificationStatusByAdmin(
  userId: number,
  status: ProfessionalVerificationInfo["status"],
) {
  const db = getDatabase();
  const timestamp = new Date().toISOString();

  db.transaction(() => {
    db.prepare(
      `
        INSERT INTO "ProfessionalVerification" (
          userId,
          governmentIdUrl,
          licenseUrl,
          certificationsJson,
          insuranceUrl,
          selfieUrl,
          status,
          updatedAt
        )
        VALUES (?, NULL, NULL, '[]', NULL, NULL, ?, ?)
        ON CONFLICT(userId) DO UPDATE SET
          status = excluded.status,
          updatedAt = excluded.updatedAt
      `,
    ).run(userId, status, timestamp);

    db.prepare(
      `
        UPDATE "User"
        SET isVerified = ?, updatedAt = ?
        WHERE id = ? AND role = 'PROFESSIONAL'
      `,
    ).run(status === "approved" ? 1 : 0, timestamp, userId);
  })();

  return getProfessionalVerificationByUserId(userId);
}

function parseStringList(value: string | null | undefined) {
  if (!value) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

function stringifyStringList(value: string[]) {
  return JSON.stringify(value.filter(Boolean));
}
