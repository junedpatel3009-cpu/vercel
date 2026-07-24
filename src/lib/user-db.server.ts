import path from "node:path";
import Database from "better-sqlite3";

type BetterSqlite3Database = InstanceType<typeof Database>;

export type UserRole = "ADMIN" | "CLIENT" | "PROFESSIONAL";

export type AuthProvider = "LOCAL" | "GOOGLE";

type UserRecord = {
  id: number;
  role: UserRole;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  passwordHash: string | null;
  googleId: string | null;
  avatarUrl: string | null;
  companyName: string | null;
  companyWebsite: string | null;
  industry: string | null;
  teamSize: string | null;
  companyDescription: string | null;
  address: string | null;
  professionalCategory: string | null;
  professionalCity: string | null;
  professionalSkillsJson: string | null;
  experienceYears: number | null;
  hourlyRate: number | null;
  fixedRate: number | null;
  portfolioUrl: string | null;
  workPhotosJson: string | null;
  certificationsJson: string | null;
  tradeLicenseUrl: string | null;
  serviceArea: string | null;
  workMode: string;
  serviceRadiusKm: number | null;
  averageRating: number;
  reviewCount: number;
  emailNotificationsEnabled: number;
  browserNotificationsEnabled: number;
  projectActivityNotificationsEnabled: number;
  isVerified: number;
  availabilityStatus: string;
  savedLocationsJson: string | null;
  hiringNeedsJson: string | null;
  authProvider: AuthProvider;
  isActive: number;
  createdAt: string;
  updatedAt: string;
};

export type PublicUser = {
  id: number;
  role: UserRole;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  companyName?: string | null;
  companyWebsite?: string | null;
  industry?: string | null;
  teamSize?: string | null;
  companyDescription?: string | null;
  address?: string | null;
  authProvider: AuthProvider;
};

export type AdminUserRecord = {
  id: number;
  role: UserRole;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  companyName: string | null;
  industry: string | null;
  professionalCategory: string | null;
  professionalCity: string | null;
  experienceYears: number | null;
  hourlyRate: number | null;
  fixedRate: number | null;
  availabilityStatus: string | null;
  averageRating: number;
  reviewCount: number;
  authProvider: AuthProvider;
  hasPassword: boolean;
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserStats = {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  admins: number;
  clients: number;
  professionals: number;
  pendingVerifications: number;
};

export type SavedLocation = {
  label: string;
  address: string;
};

export type ClientProfileInfo = {
  id: number;
  role: UserRole;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  companyName: string;
  companyWebsite: string;
  industry: string;
  teamSize: string;
  companyDescription: string;
  address: string;
  savedLocations: SavedLocation[];
  hiringNeeds: string[];
  authProvider: AuthProvider;
};

export type ProfessionalProfileInfo = {
  id: number;
  role: UserRole;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  professionalCategory: string;
  professionalCity: string;
  skills: string[];
  experienceYears: number | null;
  hourlyRate: number | null;
  fixedRate: number | null;
  portfolioUrl: string;
  workPhotos: string[];
  certifications: string[];
  tradeLicenseUrl: string;
  availabilityStatus: string;
  serviceArea: string;
  serviceRadiusKm: number | null;
  workMode: string;
  companyDescription: string;
  address: string;
  isVerified: boolean;
  averageRating: number;
  reviewCount: number;
  emailNotificationsEnabled: boolean;
  browserNotificationsEnabled: boolean;
  projectActivityNotificationsEnabled: boolean;
};

const globalForUserDb = globalThis as typeof globalThis & {
  userDb?: BetterSqlite3Database;
};

function isMissingColumnError(error: unknown) {
  return error instanceof Error && /no such column/i.test(error.message);
}

function withSchemaRecovery<T>(db: BetterSqlite3Database, operation: () => T) {
  try {
    return operation();
  } catch (error) {
    if (!isMissingColumnError(error)) {
      throw error;
    }

    ensureUserTableShape(db);
    ensureClientProfileTables(db);
    return operation();
  }
}

function ensureClientProfileTables(db: BetterSqlite3Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "ClientProfile" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "userId" INTEGER NOT NULL,
      "fullName" TEXT NOT NULL,
      "email" TEXT NOT NULL DEFAULT '',
      "phone" TEXT NOT NULL DEFAULT '',
      "companyName" TEXT NOT NULL,
      "companyWebsite" TEXT,
      "industry" TEXT,
      "teamSize" TEXT,
      "companyDescription" TEXT,
      "address" TEXT NOT NULL,
      "profilePhotoUrl" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "ClientSavedLocation" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "clientProfileId" INTEGER NOT NULL,
      "label" TEXT NOT NULL,
      "address" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "ClientHiringNeed" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "clientProfileId" INTEGER NOT NULL,
      "value" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "ClientProfile_userId_idx" ON "ClientProfile"("userId");
    CREATE INDEX IF NOT EXISTS "ClientSavedLocation_clientProfileId_idx" ON "ClientSavedLocation"("clientProfileId");
    CREATE INDEX IF NOT EXISTS "ClientHiringNeed_clientProfileId_idx" ON "ClientHiringNeed"("clientProfileId");
  `);

  const profileColumns = new Set(
    (
      db.prepare(`PRAGMA table_info("ClientProfile")`).all() as Array<{
        name: string;
      }>
    ).map((column) => column.name),
  );

  const missingProfileColumns = [
    {
      name: "email",
      sql: `ALTER TABLE "ClientProfile" ADD COLUMN "email" TEXT NOT NULL DEFAULT ''`,
    },
    {
      name: "phone",
      sql: `ALTER TABLE "ClientProfile" ADD COLUMN "phone" TEXT NOT NULL DEFAULT ''`,
    },
    { name: "companyWebsite", sql: `ALTER TABLE "ClientProfile" ADD COLUMN "companyWebsite" TEXT` },
    { name: "industry", sql: `ALTER TABLE "ClientProfile" ADD COLUMN "industry" TEXT` },
    { name: "teamSize", sql: `ALTER TABLE "ClientProfile" ADD COLUMN "teamSize" TEXT` },
    {
      name: "companyDescription",
      sql: `ALTER TABLE "ClientProfile" ADD COLUMN "companyDescription" TEXT`,
    },
  ].filter((column) => !profileColumns.has(column.name));

  for (const column of missingProfileColumns) {
    db.exec(column.sql);
  }
}

function ensureUserTableShape(db: BetterSqlite3Database) {
  const table = db
    .prepare(
      `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name = 'User'
      `,
    )
    .get() as { name: string } | undefined;

  if (!table) {
    db.exec(`
      CREATE TABLE "User" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "role" TEXT NOT NULL DEFAULT 'CLIENT',
        "firstName" TEXT NOT NULL,
        "lastName" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "phone" TEXT,
        "passwordHash" TEXT,
        "googleId" TEXT,
        "avatarUrl" TEXT,
        "companyName" TEXT,
        "companyWebsite" TEXT,
        "industry" TEXT,
        "teamSize" TEXT,
        "companyDescription" TEXT,
        "address" TEXT,
        "professionalCategory" TEXT,
        "professionalCity" TEXT,
        "professionalSkillsJson" TEXT,
        "experienceYears" INTEGER,
        "hourlyRate" INTEGER,
        "fixedRate" INTEGER,
        "portfolioUrl" TEXT,
        "workPhotosJson" TEXT,
        "certificationsJson" TEXT,
        "tradeLicenseUrl" TEXT,
        "serviceArea" TEXT,
        "workMode" TEXT NOT NULL DEFAULT 'both',
        "serviceRadiusKm" INTEGER,
        "averageRating" REAL NOT NULL DEFAULT 0,
        "reviewCount" INTEGER NOT NULL DEFAULT 0,
        "emailNotificationsEnabled" INTEGER NOT NULL DEFAULT 1,
        "browserNotificationsEnabled" INTEGER NOT NULL DEFAULT 1,
        "projectActivityNotificationsEnabled" INTEGER NOT NULL DEFAULT 1,
        "isVerified" INTEGER NOT NULL DEFAULT 0,
        "availabilityStatus" TEXT NOT NULL DEFAULT 'available',
        "savedLocationsJson" TEXT,
        "hiringNeedsJson" TEXT,
        "authProvider" TEXT NOT NULL DEFAULT 'LOCAL',
        "isActive" INTEGER NOT NULL DEFAULT 1,
        "lastLoginAt" TEXT,
        "createdAt" TEXT NOT NULL,
        "updatedAt" TEXT NOT NULL
      );
      CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
      CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
      CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
    `);
    return;
  }

  const columns = db.prepare(`PRAGMA table_info("User")`).all() as Array<{
    name: string;
    notnull: number;
  }>;
  const requiredColumns = [
    "id",
    "role",
    "firstName",
    "lastName",
    "email",
    "phone",
    "passwordHash",
    "googleId",
    "avatarUrl",
    "companyName",
    "companyWebsite",
    "industry",
    "teamSize",
    "companyDescription",
    "address",
    "professionalCategory",
    "professionalCity",
    "professionalSkillsJson",
    "experienceYears",
    "hourlyRate",
    "fixedRate",
    "portfolioUrl",
    "workPhotosJson",
    "certificationsJson",
    "tradeLicenseUrl",
    "serviceArea",
    "workMode",
    "serviceRadiusKm",
    "averageRating",
    "reviewCount",
    "emailNotificationsEnabled",
    "browserNotificationsEnabled",
    "projectActivityNotificationsEnabled",
    "isVerified",
    "availabilityStatus",
    "savedLocationsJson",
    "hiringNeedsJson",
    "authProvider",
    "isActive",
    "lastLoginAt",
    "createdAt",
    "updatedAt",
  ];
  const needsRebuild =
    requiredColumns.some((column) => !columns.some((entry) => entry.name === column)) ||
    columns.some((entry) => entry.name === "phone" && entry.notnull === 1) ||
    columns.some((entry) => entry.name === "passwordHash" && entry.notnull === 1);

  if (!needsRebuild) {
    return;
  }

  db.exec(`
    CREATE TABLE "User__new" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "role" TEXT NOT NULL DEFAULT 'CLIENT',
      "firstName" TEXT NOT NULL,
      "lastName" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "phone" TEXT,
      "passwordHash" TEXT,
      "googleId" TEXT,
      "avatarUrl" TEXT,
      "companyName" TEXT,
      "companyWebsite" TEXT,
      "industry" TEXT,
      "teamSize" TEXT,
      "companyDescription" TEXT,
      "address" TEXT,
      "professionalCategory" TEXT,
      "professionalCity" TEXT,
      "professionalSkillsJson" TEXT,
      "experienceYears" INTEGER,
      "hourlyRate" INTEGER,
      "fixedRate" INTEGER,
      "portfolioUrl" TEXT,
      "workPhotosJson" TEXT,
      "certificationsJson" TEXT,
      "tradeLicenseUrl" TEXT,
      "serviceArea" TEXT,
      "workMode" TEXT NOT NULL DEFAULT 'both',
      "serviceRadiusKm" INTEGER,
      "averageRating" REAL NOT NULL DEFAULT 0,
      "reviewCount" INTEGER NOT NULL DEFAULT 0,
      "emailNotificationsEnabled" INTEGER NOT NULL DEFAULT 1,
      "browserNotificationsEnabled" INTEGER NOT NULL DEFAULT 1,
      "projectActivityNotificationsEnabled" INTEGER NOT NULL DEFAULT 1,
      "isVerified" INTEGER NOT NULL DEFAULT 0,
      "availabilityStatus" TEXT NOT NULL DEFAULT 'available',
      "savedLocationsJson" TEXT,
      "hiringNeedsJson" TEXT,
      "authProvider" TEXT NOT NULL DEFAULT 'LOCAL',
      "isActive" INTEGER NOT NULL DEFAULT 1,
      "lastLoginAt" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );
  `);

  const columnNames = new Set(columns.map((column) => column.name));

  db.prepare(
    `
      INSERT INTO "User__new" (
        "id",
        "role",
        "firstName",
        "lastName",
        "email",
        "phone",
        "passwordHash",
        "googleId",
        "avatarUrl",
        "companyName",
        "companyWebsite",
        "industry",
        "teamSize",
        "companyDescription",
        "address",
        "professionalCategory",
        "professionalCity",
        "professionalSkillsJson",
        "experienceYears",
        "hourlyRate",
        "fixedRate",
        "portfolioUrl",
        "workPhotosJson",
        "certificationsJson",
        "tradeLicenseUrl",
        "serviceArea",
        "workMode",
        "serviceRadiusKm",
        "averageRating",
        "reviewCount",
        "emailNotificationsEnabled",
        "browserNotificationsEnabled",
        "projectActivityNotificationsEnabled",
        "isVerified",
        "availabilityStatus",
        "savedLocationsJson",
        "hiringNeedsJson",
        "authProvider",
        "isActive",
        "lastLoginAt",
        "createdAt",
        "updatedAt"
      )
      SELECT
        "id",
        COALESCE("role", 'CLIENT'),
        "firstName",
        "lastName",
        LOWER(TRIM("email")),
        ${columnNames.has("phone") ? `"phone"` : "NULL"},
        ${columnNames.has("passwordHash") ? `"passwordHash"` : "NULL"},
        ${columnNames.has("googleId") ? `"googleId"` : "NULL"},
        ${columnNames.has("avatarUrl") ? `"avatarUrl"` : "NULL"},
        ${columnNames.has("companyName") ? `"companyName"` : "NULL"},
        ${columnNames.has("companyWebsite") ? `"companyWebsite"` : "NULL"},
        ${columnNames.has("industry") ? `"industry"` : "NULL"},
        ${columnNames.has("teamSize") ? `"teamSize"` : "NULL"},
        ${columnNames.has("companyDescription") ? `"companyDescription"` : "NULL"},
        ${columnNames.has("address") ? `"address"` : "NULL"},
        ${columnNames.has("professionalCategory") ? `"professionalCategory"` : "NULL"},
        ${columnNames.has("professionalCity") ? `"professionalCity"` : "NULL"},
        ${columnNames.has("professionalSkillsJson") ? `"professionalSkillsJson"` : "NULL"},
        ${columnNames.has("experienceYears") ? `"experienceYears"` : "NULL"},
        ${columnNames.has("hourlyRate") ? `"hourlyRate"` : "NULL"},
        ${columnNames.has("fixedRate") ? `"fixedRate"` : "NULL"},
        ${columnNames.has("portfolioUrl") ? `"portfolioUrl"` : "NULL"},
        ${columnNames.has("workPhotosJson") ? `"workPhotosJson"` : "NULL"},
        ${columnNames.has("certificationsJson") ? `"certificationsJson"` : "NULL"},
        ${columnNames.has("tradeLicenseUrl") ? `"tradeLicenseUrl"` : "NULL"},
        ${columnNames.has("serviceArea") ? `"serviceArea"` : "NULL"},
        ${columnNames.has("workMode") ? `COALESCE("workMode", 'both')` : "'both'"},
        ${columnNames.has("serviceRadiusKm") ? `"serviceRadiusKm"` : "NULL"},
        ${columnNames.has("averageRating") ? `COALESCE("averageRating", 0)` : "0"},
        ${columnNames.has("reviewCount") ? `COALESCE("reviewCount", 0)` : "0"},
        ${columnNames.has("emailNotificationsEnabled") ? `COALESCE("emailNotificationsEnabled", 1)` : "1"},
        ${columnNames.has("browserNotificationsEnabled") ? `COALESCE("browserNotificationsEnabled", 1)` : "1"},
        ${columnNames.has("projectActivityNotificationsEnabled") ? `COALESCE("projectActivityNotificationsEnabled", 1)` : "1"},
        ${columnNames.has("isVerified") ? `COALESCE("isVerified", 0)` : "0"},
        ${columnNames.has("availabilityStatus") ? `COALESCE("availabilityStatus", 'available')` : "'available'"},
        ${columnNames.has("savedLocationsJson") ? `"savedLocationsJson"` : "NULL"},
        ${columnNames.has("hiringNeedsJson") ? `"hiringNeedsJson"` : "NULL"},
        ${
          columnNames.has("authProvider")
            ? `COALESCE("authProvider", CASE WHEN "googleId" IS NOT NULL THEN 'GOOGLE' ELSE 'LOCAL' END)`
            : `CASE WHEN ${columnNames.has("googleId") ? `"googleId"` : "NULL"} IS NOT NULL THEN 'GOOGLE' ELSE 'LOCAL' END`
        },
        COALESCE("isActive", 1),
        ${columnNames.has("lastLoginAt") ? `"lastLoginAt"` : "NULL"},
        COALESCE("createdAt", CURRENT_TIMESTAMP),
        COALESCE("updatedAt", CURRENT_TIMESTAMP)
      FROM "User"
    `,
  ).run();

  db.exec(`
    DROP TABLE "User";
    ALTER TABLE "User__new" RENAME TO "User";
    CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
    CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
    CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
  `);
}

function getDatabase() {
  if (!globalForUserDb.userDb) {
    const databasePath = path.resolve(process.cwd(), "prisma", "app.db");
    globalForUserDb.userDb = new Database(databasePath);
    ensureUserTableShape(globalForUserDb.userDb);
    ensureClientProfileTables(globalForUserDb.userDb);
  }

  return globalForUserDb.userDb;
}

function syncClientProfileTables(
  db: BetterSqlite3Database,
  input: {
    userId: number;
    fullName: string;
    email: string;
    phone: string;
    companyName?: string;
    companyWebsite?: string | null;
    industry?: string | null;
    teamSize?: string | null;
    companyDescription?: string | null;
    address: string;
    avatarUrl?: string | null;
    savedLocations: SavedLocation[];
    hiringNeeds: string[];
  },
  timestamp: string,
) {
  const trimmedFullName = input.fullName.trim();
  const trimmedEmail = input.email.trim().toLowerCase();
  const trimmedPhone = input.phone.trim();
  const trimmedCompanyName = input.companyName?.trim() || "";
  const trimmedCompanyWebsite = input.companyWebsite?.trim() || null;
  const trimmedIndustry = input.industry?.trim() || null;
  const trimmedTeamSize = input.teamSize?.trim() || null;
  const trimmedCompanyDescription = input.companyDescription?.trim() || null;
  const trimmedAddress = input.address.trim();
  const trimmedAvatarUrl = input.avatarUrl?.trim() || null;

  const existingProfile = db
    .prepare(
      `
        SELECT id
        FROM "ClientProfile"
        WHERE userId = ?
        ORDER BY id DESC
        LIMIT 1
      `,
    )
    .get(input.userId) as { id: number } | undefined;

  let clientProfileId = existingProfile?.id;

  if (clientProfileId) {
    db.prepare(
      `
        UPDATE "ClientProfile"
        SET
          fullName = ?,
          email = ?,
          phone = ?,
          companyName = ?,
          companyWebsite = ?,
          industry = ?,
          teamSize = ?,
          companyDescription = ?,
          address = ?,
          profilePhotoUrl = ?,
          updatedAt = ?
        WHERE id = ?
      `,
    ).run(
      trimmedFullName,
      trimmedEmail,
      trimmedPhone,
      trimmedCompanyName,
      trimmedCompanyWebsite,
      trimmedIndustry,
      trimmedTeamSize,
      trimmedCompanyDescription,
      trimmedAddress,
      trimmedAvatarUrl,
      timestamp,
      clientProfileId,
    );
  } else {
    const result = db
      .prepare(
        `
          INSERT INTO "ClientProfile" (
            userId,
            fullName,
            email,
            phone,
            companyName,
            companyWebsite,
            industry,
            teamSize,
            companyDescription,
            address,
            profilePhotoUrl,
            createdAt,
            updatedAt
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        input.userId,
        trimmedFullName,
        trimmedEmail,
        trimmedPhone,
        trimmedCompanyName,
        trimmedCompanyWebsite,
        trimmedIndustry,
        trimmedTeamSize,
        trimmedCompanyDescription,
        trimmedAddress,
        trimmedAvatarUrl,
        timestamp,
        timestamp,
      );

    clientProfileId = Number(result.lastInsertRowid);
  }

  db.prepare(
    `
      DELETE FROM "ClientSavedLocation"
      WHERE clientProfileId = ?
    `,
  ).run(clientProfileId);

  db.prepare(
    `
      DELETE FROM "ClientHiringNeed"
      WHERE clientProfileId = ?
    `,
  ).run(clientProfileId);

  const insertSavedLocation = db.prepare(
    `
      INSERT INTO "ClientSavedLocation" (
        clientProfileId,
        label,
        address,
        createdAt
      )
      VALUES (?, ?, ?, ?)
    `,
  );

  for (const location of input.savedLocations) {
    insertSavedLocation.run(
      clientProfileId,
      location.label.trim(),
      location.address.trim(),
      timestamp,
    );
  }

  const insertHiringNeed = db.prepare(
    `
      INSERT INTO "ClientHiringNeed" (
        clientProfileId,
        value,
        createdAt
      )
      VALUES (?, ?, ?)
    `,
  );

  for (const hiringNeed of input.hiringNeeds) {
    insertHiringNeed.run(clientProfileId, hiringNeed.trim(), timestamp);
  }
}

function mapPublicUser(
  user: Pick<
    UserRecord,
    "id" | "role" | "firstName" | "lastName" | "email" | "phone" | "avatarUrl" | "authProvider"
  >,
): PublicUser {
  return {
    id: user.id,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    authProvider: user.authProvider,
  };
}

function parseSavedLocations(value: string | null | undefined) {
  if (!value) {
    return [] as SavedLocation[];
  }

  try {
    const parsed = JSON.parse(value) as Array<{ label?: string; address?: string }>;
    return parsed
      .filter((location) => location?.label && location?.address)
      .map((location) => ({
        label: String(location.label).trim(),
        address: String(location.address).trim(),
      }));
  } catch {
    return [];
  }
}

function stringifySavedLocations(locations: SavedLocation[]) {
  return JSON.stringify(
    locations.map((location) => ({
      label: location.label.trim(),
      address: location.address.trim(),
    })),
  );
}

function parseHiringNeeds(value: string | null | undefined) {
  if (!value) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(value) as Array<string | null | undefined>;
    return parsed.map((entry) => String(entry ?? "").trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function parseStringList(value: string | null | undefined) {
  if (!value) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(value) as Array<string | null | undefined>;
    return parsed.map((entry) => String(entry ?? "").trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function stringifyStringList(values: string[]) {
  return JSON.stringify(values.map((value) => value.trim()).filter(Boolean));
}

function stringifyHiringNeeds(needs: string[]) {
  return JSON.stringify(needs.map((need) => need.trim()).filter(Boolean));
}

function splitFullName(fullName: string) {
  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ") || firstName;

  return {
    firstName,
    lastName,
  };
}

export function findUserByEmailOrPhone(email: string, phone?: string | null) {
  const db = getDatabase();

  if (phone) {
    return withSchemaRecovery(
      db,
      () =>
        db
          .prepare(
            `
              SELECT id, email, phone
              FROM "User"
              WHERE email = ? OR phone = ?
              LIMIT 1
            `,
          )
          .get(email, phone) as { id: number; email: string; phone: string | null } | undefined,
    );
  }

  return withSchemaRecovery(
    db,
    () =>
      db
        .prepare(
          `
            SELECT id, email, phone
            FROM "User"
            WHERE email = ?
            LIMIT 1
          `,
        )
        .get(email) as { id: number; email: string; phone: string | null } | undefined,
  );
}

export function updateUserPasswordByEmail(email: string, passwordHash: string) {
  const db = getDatabase();
  const timestamp = new Date().toISOString();

  return withSchemaRecovery(db, () => {
    const result = db
      .prepare(
        `
          UPDATE "User"
          SET passwordHash = ?, updatedAt = ?
          WHERE email = ?
        `,
      )
      .run(passwordHash, timestamp, email.trim().toLowerCase());

    return result.changes > 0;
  });
}

export function updateUserPasswordByAdmin(userId: number, passwordHash: string) {
  const db = getDatabase();
  const timestamp = new Date().toISOString();

  return withSchemaRecovery(db, () => {
    const result = db
      .prepare(
        `
          UPDATE "User"
          SET passwordHash = ?, updatedAt = ?
          WHERE id = ? AND role IN ('CLIENT', 'PROFESSIONAL')
        `,
      )
      .run(passwordHash, timestamp, userId);

    if (!result.changes) {
      throw new Error("Managed user account not found.");
    }

    return true;
  });
}

export function findUserByEmail(email: string) {
  const db = getDatabase();

  return withSchemaRecovery(
    db,
    () =>
      db
        .prepare(
          `
            SELECT id, role, firstName, lastName, email, phone, passwordHash, googleId, avatarUrl, authProvider, isActive
            FROM "User"
            WHERE email = ?
            LIMIT 1
          `,
        )
        .get(email) as
        | {
            id: number;
            role: UserRole;
            firstName: string;
            lastName: string;
            email: string;
            phone: string | null;
            passwordHash: string | null;
            googleId: string | null;
            avatarUrl: string | null;
            authProvider: AuthProvider;
            isActive: number;
          }
        | undefined,
  );
}

export function findUserByGoogleId(googleId: string) {
  const db = getDatabase();

  return withSchemaRecovery(
    db,
    () =>
      db
        .prepare(
          `
            SELECT id, role, firstName, lastName, email, phone, passwordHash, googleId, avatarUrl, authProvider
            FROM "User"
            WHERE googleId = ?
            LIMIT 1
          `,
        )
        .get(googleId) as
        | {
            id: number;
            role: UserRole;
            firstName: string;
            lastName: string;
            email: string;
            phone: string | null;
            passwordHash: string | null;
            googleId: string | null;
            avatarUrl: string | null;
            authProvider: AuthProvider;
          }
        | undefined,
  );
}

export function findUserById(userId: number) {
  const db = getDatabase();

  return withSchemaRecovery(
    db,
    () =>
      db
        .prepare(
          `
            SELECT id, role, firstName, lastName, email, phone, avatarUrl, authProvider
            FROM "User"
            WHERE id = ? AND isActive = 1
            LIMIT 1
          `,
        )
        .get(userId) as PublicUser | undefined,
  );
}

export function getAdminUsers() {
  const db = getDatabase();

  return withSchemaRecovery(
    db,
    () =>
      (
        db
          .prepare(
            `
              SELECT
                id,
                role,
                firstName,
                lastName,
                email,
                phone,
                avatarUrl,
                companyName,
                industry,
                professionalCategory,
                professionalCity,
                experienceYears,
                hourlyRate,
                fixedRate,
                availabilityStatus,
                averageRating,
                reviewCount,
                authProvider,
                CASE WHEN passwordHash IS NOT NULL THEN 1 ELSE 0 END AS hasPassword,
                isActive,
                isVerified,
                lastLoginAt,
                createdAt,
                updatedAt
              FROM "User"
              ORDER BY datetime(createdAt) DESC, id DESC
            `,
          )
          .all() as Array<{
          id: number;
          role: UserRole;
          firstName: string;
          lastName: string;
          email: string;
          phone: string | null;
          avatarUrl: string | null;
          companyName: string | null;
          industry: string | null;
          professionalCategory: string | null;
          professionalCity: string | null;
          experienceYears: number | null;
          hourlyRate: number | null;
          fixedRate: number | null;
          availabilityStatus: string | null;
          averageRating: number;
          reviewCount: number;
          authProvider: AuthProvider;
          hasPassword: number;
          isActive: number;
          isVerified: number;
          lastLoginAt: string | null;
          createdAt: string;
          updatedAt: string;
        }>
      ).map((user) => ({
        ...user,
        hasPassword: Boolean(user.hasPassword),
        isActive: Boolean(user.isActive),
        isVerified: Boolean(user.isVerified),
      })) satisfies AdminUserRecord[],
  );
}

export function recordUserLogin(userId: number) {
  const db = getDatabase();
  const timestamp = new Date().toISOString();

  return withSchemaRecovery(db, () => {
    db.prepare(
      `
        UPDATE "User"
        SET lastLoginAt = ?, updatedAt = ?
        WHERE id = ?
      `,
    ).run(timestamp, timestamp, userId);

    return timestamp;
  });
}

export function getAdminUserStats() {
  const users = getAdminUsers();

  return {
    totalUsers: users.length,
    activeUsers: users.filter((user) => user.isActive).length,
    inactiveUsers: users.filter((user) => !user.isActive).length,
    admins: users.filter((user) => user.role === "ADMIN").length,
    clients: users.filter((user) => user.role === "CLIENT").length,
    professionals: users.filter((user) => user.role === "PROFESSIONAL").length,
    pendingVerifications: users.filter((user) => user.role === "PROFESSIONAL" && !user.isVerified)
      .length,
  } satisfies AdminUserStats;
}

export function updateUserRoleByAdmin(userId: number, role: UserRole) {
  const db = getDatabase();
  const timestamp = new Date().toISOString();

  return withSchemaRecovery(db, () => {
    db.prepare(
      `
        UPDATE "User"
        SET role = ?, updatedAt = ?
        WHERE id = ?
      `,
    ).run(role, timestamp, userId);

    return findUserById(userId);
  });
}

export function updateUserActiveStatusByAdmin(userId: number, isActive: boolean) {
  const db = getDatabase();
  const timestamp = new Date().toISOString();

  return withSchemaRecovery(db, () => {
    db.prepare(
      `
        UPDATE "User"
        SET isActive = ?, updatedAt = ?
        WHERE id = ?
      `,
    ).run(isActive ? 1 : 0, timestamp, userId);

    return findUserById(userId);
  });
}

export function updateProfessionalVerifiedStatusByAdmin(userId: number, isVerified: boolean) {
  const db = getDatabase();
  const timestamp = new Date().toISOString();

  return withSchemaRecovery(db, () => {
    db.prepare(
      `
        UPDATE "User"
        SET isVerified = ?, updatedAt = ?
        WHERE id = ? AND role = 'PROFESSIONAL'
      `,
    ).run(isVerified ? 1 : 0, timestamp, userId);

    return findUserById(userId);
  });
}

export function getClientProfileByUserId(userId: number) {
  const db = getDatabase();

  return withSchemaRecovery(db, () => {
    const user = db
      .prepare(
        `
            SELECT
              id,
              role,
              firstName,
              lastName,
              email,
              phone,
              avatarUrl,
              companyName,
              companyWebsite,
              industry,
              teamSize,
              companyDescription,
              address,
              savedLocationsJson,
              hiringNeedsJson,
              authProvider
            FROM "User"
            WHERE id = ?
            LIMIT 1
          `,
      )
      .get(userId) as
      | {
          id: number;
          role: UserRole;
          firstName: string;
          lastName: string;
          email: string;
          phone: string | null;
          avatarUrl: string | null;
          companyName: string | null;
          companyWebsite: string | null;
          industry: string | null;
          teamSize: string | null;
          companyDescription: string | null;
          address: string | null;
          savedLocationsJson: string | null;
          hiringNeedsJson: string | null;
          authProvider: AuthProvider;
        }
      | undefined;

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      phone: user.phone ?? "",
      avatarUrl: user.avatarUrl,
      companyName: user.companyName ?? "",
      companyWebsite: user.companyWebsite ?? "",
      industry: user.industry ?? "",
      teamSize: user.teamSize ?? "",
      companyDescription: user.companyDescription ?? "",
      address: user.address ?? "",
      savedLocations: parseSavedLocations(user.savedLocationsJson),
      hiringNeeds: parseHiringNeeds(user.hiringNeedsJson),
      authProvider: user.authProvider,
    } satisfies ClientProfileInfo;
  });
}

export function getProfessionalUsers() {
  const db = getDatabase();

  return withSchemaRecovery(
    db,
    () =>
      db
        .prepare(
          `
            SELECT
              id,
              firstName,
              lastName,
              email,
              phone,
              avatarUrl,
              companyName,
              industry,
              companyDescription,
              address,
              professionalCategory,
              professionalCity,
              serviceArea,
              serviceRadiusKm,
              hourlyRate,
              fixedRate,
              averageRating,
              reviewCount,
              isVerified,
              availabilityStatus
            FROM "User"
            WHERE role = 'PROFESSIONAL' AND isActive = 1
            ORDER BY datetime(createdAt) DESC, id DESC
          `,
        )
        .all() as Array<{
        id: number;
        firstName: string;
        lastName: string;
        email: string;
        phone: string | null;
        avatarUrl: string | null;
        companyName: string | null;
        industry: string | null;
        companyDescription: string | null;
        address: string | null;
        professionalCategory: string | null;
        professionalCity: string | null;
        serviceArea: string | null;
        serviceRadiusKm: number | null;
        hourlyRate: number | null;
        fixedRate: number | null;
        averageRating: number;
        reviewCount: number;
        isVerified: number;
        availabilityStatus: string;
      }>,
  );
}

export function getProfessionalProfileByUserId(userId: number) {
  const db = getDatabase();

  return withSchemaRecovery(db, () => {
    const user = db
      .prepare(
        `
          SELECT
            id,
            role,
            firstName,
            lastName,
            email,
            phone,
            avatarUrl,
            professionalCategory,
            professionalCity,
            professionalSkillsJson,
            experienceYears,
            hourlyRate,
            fixedRate,
            portfolioUrl,
            workPhotosJson,
            certificationsJson,
            tradeLicenseUrl,
            availabilityStatus,
            serviceArea,
            serviceRadiusKm,
            workMode,
            companyDescription,
            address,
            isVerified,
            averageRating,
            reviewCount,
            emailNotificationsEnabled,
            browserNotificationsEnabled,
            projectActivityNotificationsEnabled
          FROM "User"
          WHERE id = ? AND role = 'PROFESSIONAL'
          LIMIT 1
        `,
      )
      .get(userId) as
      | {
          id: number;
          role: UserRole;
          firstName: string;
          lastName: string;
          email: string;
          phone: string | null;
          avatarUrl: string | null;
          professionalCategory: string | null;
          professionalCity: string | null;
          professionalSkillsJson: string | null;
          experienceYears: number | null;
          hourlyRate: number | null;
          fixedRate: number | null;
          portfolioUrl: string | null;
          workPhotosJson: string | null;
          certificationsJson: string | null;
          tradeLicenseUrl: string | null;
          availabilityStatus: string;
          serviceArea: string | null;
          serviceRadiusKm: number | null;
          workMode: string;
          companyDescription: string | null;
          address: string | null;
          isVerified: number;
          averageRating: number;
          reviewCount: number;
          emailNotificationsEnabled: number;
          browserNotificationsEnabled: number;
          projectActivityNotificationsEnabled: number;
        }
      | undefined;

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      phone: user.phone ?? "",
      avatarUrl: user.avatarUrl,
      professionalCategory: user.professionalCategory ?? "",
      professionalCity: user.professionalCity ?? "",
      skills: parseStringList(user.professionalSkillsJson),
      experienceYears: user.experienceYears,
      hourlyRate: user.hourlyRate,
      fixedRate: user.fixedRate,
      portfolioUrl: user.portfolioUrl ?? "",
      workPhotos: parseStringList(user.workPhotosJson),
      certifications: parseStringList(user.certificationsJson),
      tradeLicenseUrl: user.tradeLicenseUrl ?? "",
      availabilityStatus: user.availabilityStatus || "available",
      serviceArea: user.serviceArea ?? "",
      serviceRadiusKm: user.serviceRadiusKm,
      workMode: user.workMode || "both",
      companyDescription: user.companyDescription ?? "",
      address: user.address ?? "",
      isVerified: Boolean(user.isVerified),
      averageRating: Number(user.averageRating || 0),
      reviewCount: Number(user.reviewCount || 0),
      emailNotificationsEnabled: user.emailNotificationsEnabled !== 0,
      browserNotificationsEnabled: user.browserNotificationsEnabled !== 0,
      projectActivityNotificationsEnabled: user.projectActivityNotificationsEnabled !== 0,
    } satisfies ProfessionalProfileInfo;
  });
}

export function getUserNotificationPreferences(userId: number) {
  const db = getDatabase();

  return withSchemaRecovery(db, () => {
    const user = db
      .prepare(
        `
          SELECT
            emailNotificationsEnabled,
            browserNotificationsEnabled,
            projectActivityNotificationsEnabled
          FROM "User"
          WHERE id = ?
          LIMIT 1
        `,
      )
      .get(userId) as
      | {
          emailNotificationsEnabled: number;
          browserNotificationsEnabled: number;
          projectActivityNotificationsEnabled: number;
        }
      | undefined;

    return {
      emailNotificationsEnabled: user?.emailNotificationsEnabled !== 0,
      browserNotificationsEnabled: user?.browserNotificationsEnabled !== 0,
      projectActivityNotificationsEnabled: user?.projectActivityNotificationsEnabled !== 0,
    };
  });
}

export function updateUserNotificationPreferencesByUserId(input: {
  userId: number;
  emailNotificationsEnabled?: boolean;
  browserNotificationsEnabled?: boolean;
  projectActivityNotificationsEnabled?: boolean;
}) {
  const db = getDatabase();
  const current = getUserNotificationPreferences(input.userId);
  const timestamp = new Date().toISOString();

  return withSchemaRecovery(db, () => {
    db.prepare(
      `
        UPDATE "User"
        SET
          emailNotificationsEnabled = ?,
          browserNotificationsEnabled = ?,
          projectActivityNotificationsEnabled = ?,
          updatedAt = ?
        WHERE id = ?
      `,
    ).run(
      (input.emailNotificationsEnabled ?? current.emailNotificationsEnabled) ? 1 : 0,
      (input.browserNotificationsEnabled ?? current.browserNotificationsEnabled) ? 1 : 0,
      (input.projectActivityNotificationsEnabled ?? current.projectActivityNotificationsEnabled)
        ? 1
        : 0,
      timestamp,
      input.userId,
    );

    return getUserNotificationPreferences(input.userId);
  });
}

export function updateProfessionalNotificationPreferencesByUserId(input: {
  userId: number;
  emailNotificationsEnabled: boolean;
  browserNotificationsEnabled: boolean;
  projectActivityNotificationsEnabled: boolean;
}) {
  const db = getDatabase();
  const timestamp = new Date().toISOString();

  return withSchemaRecovery(db, () => {
    db.prepare(
      `
        UPDATE "User"
        SET
          emailNotificationsEnabled = ?,
          browserNotificationsEnabled = ?,
          projectActivityNotificationsEnabled = ?,
          updatedAt = ?
        WHERE id = ? AND role = 'PROFESSIONAL'
      `,
    ).run(
      input.emailNotificationsEnabled ? 1 : 0,
      input.browserNotificationsEnabled ? 1 : 0,
      input.projectActivityNotificationsEnabled ? 1 : 0,
      timestamp,
      input.userId,
    );

    return getProfessionalProfileByUserId(input.userId);
  });
}

export function updateProfessionalProfileByUserId(input: {
  userId: number;
  fullName: string;
  profilePhotoUrl?: string | null;
  professionalCategory: string;
  professionalCity: string;
  skills: string[];
  experienceYears?: number | null;
  hourlyRate?: number | null;
  fixedRate?: number | null;
  portfolioUrl?: string | null;
  workPhotos: string[];
  certifications: string[];
  tradeLicenseUrl?: string | null;
  availabilityStatus: string;
  serviceArea: string;
  serviceRadiusKm?: number | null;
  workMode: string;
  companyDescription?: string | null;
  address: string;
  emailNotificationsEnabled?: boolean;
  browserNotificationsEnabled?: boolean;
  projectActivityNotificationsEnabled?: boolean;
}) {
  const db = getDatabase();
  const timestamp = new Date().toISOString();
  const { firstName, lastName } = splitFullName(input.fullName);

  return withSchemaRecovery(db, () => {
    db.prepare(
      `
        UPDATE "User"
        SET
          firstName = ?,
          lastName = ?,
          avatarUrl = ?,
          professionalCategory = ?,
          professionalCity = ?,
          professionalSkillsJson = ?,
          experienceYears = ?,
          hourlyRate = ?,
          fixedRate = ?,
          portfolioUrl = ?,
          workPhotosJson = ?,
          certificationsJson = ?,
          tradeLicenseUrl = ?,
          availabilityStatus = ?,
          serviceArea = ?,
          serviceRadiusKm = ?,
          workMode = ?,
          companyDescription = ?,
          address = ?,
          emailNotificationsEnabled = ?,
          browserNotificationsEnabled = ?,
          projectActivityNotificationsEnabled = ?,
          industry = COALESCE(?, industry),
          updatedAt = ?
        WHERE id = ? AND role = 'PROFESSIONAL'
      `,
    ).run(
      firstName,
      lastName,
      input.profilePhotoUrl?.trim() || null,
      input.professionalCategory.trim(),
      input.professionalCity.trim(),
      stringifyStringList(input.skills),
      input.experienceYears ?? null,
      input.hourlyRate ?? null,
      input.fixedRate ?? null,
      input.portfolioUrl?.trim() || null,
      stringifyStringList(input.workPhotos),
      stringifyStringList(input.certifications),
      input.tradeLicenseUrl?.trim() || null,
      input.availabilityStatus,
      input.serviceArea.trim(),
      input.serviceRadiusKm ?? null,
      input.workMode,
      input.companyDescription?.trim() || null,
      input.address.trim(),
      input.emailNotificationsEnabled === false ? 0 : 1,
      input.browserNotificationsEnabled === false ? 0 : 1,
      input.projectActivityNotificationsEnabled === false ? 0 : 1,
      null,
      timestamp,
      input.userId,
    );

    return getProfessionalProfileByUserId(input.userId);
  });
}

export function updateProfessionalAvatarByUserId(input: { userId: number; avatarUrl: string }) {
  const db = getDatabase();
  const timestamp = new Date().toISOString();

  return withSchemaRecovery(db, () => {
    db.prepare(
      `
        UPDATE "User"
        SET
          avatarUrl = ?,
          updatedAt = ?
        WHERE id = ? AND role = 'PROFESSIONAL'
      `,
    ).run(input.avatarUrl.trim() || null, timestamp, input.userId);

    return getProfessionalProfileByUserId(input.userId);
  });
}

export function updateProfessionalWorkPhotosByUserId(input: {
  userId: number;
  workPhotos: string[];
}) {
  const db = getDatabase();
  const timestamp = new Date().toISOString();

  return withSchemaRecovery(db, () => {
    db.prepare(
      `
        UPDATE "User"
        SET
          workPhotosJson = ?,
          updatedAt = ?
        WHERE id = ? AND role = 'PROFESSIONAL'
      `,
    ).run(stringifyStringList(input.workPhotos), timestamp, input.userId);

    return getProfessionalProfileByUserId(input.userId);
  });
}

export function updateClientProfileByUserId(input: {
  userId: number;
  fullName: string;
  email: string;
  phone: string;
  companyName?: string;
  companyWebsite?: string | null;
  industry?: string | null;
  teamSize?: string | null;
  companyDescription?: string | null;
  address: string;
  avatarUrl?: string | null;
  savedLocations: SavedLocation[];
  hiringNeeds: string[];
}) {
  const db = getDatabase();
  const timestamp = new Date().toISOString();
  const { firstName, lastName } = splitFullName(input.fullName);

  return withSchemaRecovery(db, () => {
    db.prepare(
      `
        UPDATE "User"
        SET
          firstName = ?,
          lastName = ?,
          email = ?,
          phone = ?,
          avatarUrl = ?,
          companyName = ?,
          companyWebsite = ?,
          industry = ?,
          teamSize = ?,
          companyDescription = ?,
          address = ?,
          savedLocationsJson = ?,
          hiringNeedsJson = ?,
          updatedAt = ?
        WHERE id = ?
      `,
    ).run(
      firstName,
      lastName,
      input.email.trim().toLowerCase(),
      input.phone.trim(),
      input.avatarUrl ?? null,
      input.companyName?.trim() || null,
      input.companyWebsite?.trim() || null,
      input.industry?.trim() || null,
      input.teamSize?.trim() || null,
      input.companyDescription?.trim() || null,
      input.address.trim(),
      stringifySavedLocations(input.savedLocations),
      stringifyHiringNeeds(input.hiringNeeds),
      timestamp,
      input.userId,
    );

    syncClientProfileTables(
      db,
      {
        userId: input.userId,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        companyName: input.companyName,
        companyWebsite: input.companyWebsite,
        industry: input.industry,
        teamSize: input.teamSize,
        companyDescription: input.companyDescription,
        address: input.address,
        avatarUrl: input.avatarUrl,
        savedLocations: input.savedLocations,
        hiringNeeds: input.hiringNeeds,
      },
      timestamp,
    );

    return getClientProfileByUserId(input.userId);
  });
}

export function createUserRecord(input: {
  role: UserRole;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  passwordHash: string | null;
  googleId?: string | null;
  avatarUrl?: string | null;
  authProvider?: AuthProvider;
}) {
  const db = getDatabase();
  const timestamp = new Date().toISOString();

  return withSchemaRecovery(db, () => {
    const result = db
      .prepare(
        `
          INSERT INTO "User" (
            role,
            firstName,
            lastName,
            email,
            phone,
            passwordHash,
            googleId,
            avatarUrl,
            authProvider,
            isActive,
            createdAt,
            updatedAt
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        input.role,
        input.firstName.trim(),
        input.lastName.trim(),
        input.email.trim().toLowerCase(),
        input.phone,
        input.passwordHash,
        input.googleId ?? null,
        input.avatarUrl ?? null,
        input.authProvider ?? (input.googleId ? "GOOGLE" : "LOCAL"),
        1,
        timestamp,
        timestamp,
      );

    return db
      .prepare(
        `
          SELECT id, role, firstName, lastName, email, phone, avatarUrl, authProvider
          FROM "User"
          WHERE id = ?
          LIMIT 1
        `,
      )
      .get(result.lastInsertRowid) as PublicUser;
  });
}

export function linkGoogleAccountToUser(input: {
  userId: number;
  googleId: string;
  avatarUrl?: string | null;
  firstName?: string;
  lastName?: string;
}) {
  const db = getDatabase();
  const timestamp = new Date().toISOString();

  return withSchemaRecovery(db, () => {
    db.prepare(
      `
        UPDATE "User"
        SET
          googleId = ?,
          avatarUrl = COALESCE(?, avatarUrl),
          authProvider = CASE
            WHEN authProvider = 'LOCAL' AND passwordHash IS NOT NULL THEN authProvider
            ELSE 'GOOGLE'
          END,
          firstName = COALESCE(NULLIF(?, ''), firstName),
          lastName = COALESCE(NULLIF(?, ''), lastName),
          updatedAt = ?
        WHERE id = ?
      `,
    ).run(
      input.googleId,
      input.avatarUrl ?? null,
      input.firstName?.trim() ?? "",
      input.lastName?.trim() ?? "",
      timestamp,
      input.userId,
    );

    return db
      .prepare(
        `
          SELECT id, role, firstName, lastName, email, phone, avatarUrl, authProvider
          FROM "User"
          WHERE id = ?
          LIMIT 1
        `,
      )
      .get(input.userId) as PublicUser;
  });
}

export function upsertGoogleUser(input: {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}) {
  const existingGoogleUser = findUserByGoogleId(input.googleId);
  if (existingGoogleUser) {
    return mapPublicUser(existingGoogleUser);
  }

  const existingEmailUser = findUserByEmail(input.email);
  if (existingEmailUser) {
    return linkGoogleAccountToUser({
      userId: existingEmailUser.id,
      googleId: input.googleId,
      avatarUrl: input.avatarUrl,
      firstName: input.firstName,
      lastName: input.lastName,
    });
  }

  return createUserRecord({
    role: "CLIENT",
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: null,
    passwordHash: null,
    googleId: input.googleId,
    avatarUrl: input.avatarUrl ?? null,
    authProvider: "GOOGLE",
  });
}
