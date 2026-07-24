import Database from "better-sqlite3";

// Test database setup - use in-memory for speed
let db: ReturnType<typeof Database> | null = null;
let counter = 0;

export function getTestDb() {
  if (!db) {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    seedTestSchema(db);
  }
  return db;
}

function seedTestSchema(database: ReturnType<typeof Database>) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "role" TEXT NOT NULL DEFAULT 'CLIENT',
      "firstName" TEXT NOT NULL,
      "lastName" TEXT NOT NULL,
      "email" TEXT NOT NULL UNIQUE,
      "phone" TEXT UNIQUE,
      "passwordHash" TEXT,
      "googleId" TEXT UNIQUE,
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
      "workMode" TEXT DEFAULT 'both',
      "serviceRadiusKm" INTEGER,
      "averageRating" REAL DEFAULT 0,
      "reviewCount" INTEGER DEFAULT 0,
      "isVerified" INTEGER DEFAULT 0,
      "availabilityStatus" TEXT DEFAULT 'available',
      "savedLocationsJson" TEXT,
      "hiringNeedsJson" TEXT,
      "authProvider" TEXT NOT NULL DEFAULT 'LOCAL',
      "isActive" INTEGER NOT NULL DEFAULT 1,
      "emailVerifiedAt" TEXT,
      "lastLoginAt" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "ApiToken" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "userId" INTEGER NOT NULL,
      "tokenHash" TEXT NOT NULL UNIQUE,
      "kind" TEXT NOT NULL,
      "expiresAt" TEXT NOT NULL,
      "usedAt" TEXT,
      "createdAt" TEXT NOT NULL,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS "ServiceCategory" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL UNIQUE,
      "slug" TEXT NOT NULL UNIQUE,
      "description" TEXT DEFAULT '',
      "iconName" TEXT DEFAULT '',
      "sortOrder" INTEGER DEFAULT 0,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "Service" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "categoryId" INTEGER NOT NULL,
      "professionalId" INTEGER NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "price" INTEGER,
      "imageUrl" TEXT,
      "isActive" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id"),
      FOREIGN KEY ("professionalId") REFERENCES "User"("id")
    );
    CREATE TABLE IF NOT EXISTS "StoredFile" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "ownerId" INTEGER NOT NULL,
      "purpose" TEXT NOT NULL,
      "fileName" TEXT NOT NULL,
      "mimeType" TEXT NOT NULL,
      "sizeBytes" INTEGER NOT NULL,
      "storageKey" TEXT NOT NULL UNIQUE,
      "isPublic" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TEXT NOT NULL,
      FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS "Wallet" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "userId" INTEGER NOT NULL UNIQUE,
      "currency" TEXT NOT NULL DEFAULT 'USD',
      "balance" INTEGER NOT NULL DEFAULT 0,
      "pendingBalance" INTEGER NOT NULL DEFAULT 0,
      "updatedAt" TEXT NOT NULL,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS "WalletTransaction" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "walletId" INTEGER NOT NULL,
      "paymentId" INTEGER,
      "type" TEXT NOT NULL,
      "amount" INTEGER NOT NULL,
      "status" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "metadataJson" TEXT,
      "createdAt" TEXT NOT NULL,
      FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS "Payment" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "clientId" INTEGER NOT NULL,
      "professionalId" INTEGER NOT NULL,
      "jobId" INTEGER,
      "amount" INTEGER NOT NULL,
      "commissionAmount" INTEGER NOT NULL,
      "currency" TEXT NOT NULL DEFAULT 'USD',
      "provider" TEXT NOT NULL,
      "providerReference" TEXT,
      "status" TEXT NOT NULL,
      "idempotencyKey" TEXT NOT NULL UNIQUE,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "ClientJob" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "userId" INTEGER NOT NULL,
      "category" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "budgetMin" INTEGER,
      "budgetMax" INTEGER,
      "urgency" TEXT DEFAULT 'MEDIUM',
      "jobDate" TEXT,
      "deadline" TEXT NOT NULL,
      "workMode" TEXT DEFAULT 'BOTH',
      "locationLabel" TEXT,
      "locationAddress" TEXT,
      "locationLat" REAL,
      "locationLng" REAL,
      "status" TEXT DEFAULT 'OPEN',
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS "ProjectRequest" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "jobId" INTEGER NOT NULL,
      "professionalId" INTEGER NOT NULL,
      "bidAmount" INTEGER,
      "duration" TEXT,
      "coverLetter" TEXT,
      "attachmentsJson" TEXT,
      "status" TEXT DEFAULT 'PENDING',
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      FOREIGN KEY ("jobId") REFERENCES "ClientJob"("id") ON DELETE CASCADE,
      FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS "Notification" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "userId" INTEGER NOT NULL,
      "type" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "message" TEXT,
      "link" TEXT,
      "isRead" INTEGER DEFAULT 0,
      "createdAt" TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "BrowserSubscription" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "userId" INTEGER NOT NULL,
      "endpoint" TEXT NOT NULL UNIQUE,
      "p256dh" TEXT NOT NULL,
      "auth" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS "Faq" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "question" TEXT NOT NULL,
      "answer" TEXT NOT NULL,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "isPublished" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "ContactRequest" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "subject" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'OPEN',
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "Contract" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "clientId" INTEGER NOT NULL,
      "professionalId" INTEGER NOT NULL,
      "jobId" INTEGER,
      "bidAmount" INTEGER,
      "duration" TEXT,
      "status" TEXT DEFAULT 'ACTIVE',
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "ProjectTracking" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "jobId" INTEGER,
      "clientId" INTEGER NOT NULL,
      "professionalId" INTEGER NOT NULL,
      "status" TEXT DEFAULT 'ACTIVE',
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "ProjectCompletionRequest" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "trackingId" INTEGER NOT NULL,
      "note" TEXT,
      "status" TEXT DEFAULT 'SUBMITTED',
      "submittedAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "ProjectReview" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "trackingId" INTEGER NOT NULL UNIQUE,
      "clientId" INTEGER NOT NULL,
      "professionalId" INTEGER NOT NULL,
      "rating" INTEGER NOT NULL,
      "comment" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "ApiToken_user_kind_idx" ON "ApiToken"("userId", "kind");
    CREATE INDEX IF NOT EXISTS "Service_professional_idx" ON "Service"("professionalId");
    CREATE INDEX IF NOT EXISTS "WalletTransaction_wallet_idx" ON "WalletTransaction"("walletId", "createdAt");
    CREATE INDEX IF NOT EXISTS "Payment_users_idx" ON "Payment"("clientId", "professionalId");
  `);

  // Seed test data
  const now = new Date().toISOString();
  database
    .prepare(
      `INSERT INTO "ServiceCategory" (id, name, slug, description, sortOrder, createdAt, updatedAt) VALUES (1, 'Web Development', 'web-development', 'Web development services', 1, ?, ?)`,
    )
    .run(now, now);
  database
    .prepare(
      `INSERT INTO "ServiceCategory" (id, name, slug, description, sortOrder, createdAt, updatedAt) VALUES (2, 'Design', 'design', 'Design services', 2, ?, ?)`,
    )
    .run(now, now);
}

export function cleanTestDb() {
  if (db) {
    db.close();
    db = null;
  }
}

export function createTestUser(
  database: ReturnType<typeof Database>,
  overrides: Record<string, unknown> = {},
) {
  counter++;
  const now = new Date().toISOString();
  const defaults: Record<string, unknown> = {
    role: "CLIENT",
    firstName: "Test",
    lastName: "User",
    email: `test-${Date.now()}-${counter}@example.com`,
    passwordHash: "abc123hash",
    authProvider: "LOCAL",
    isVerified: 0,
    averageRating: 0,
    reviewCount: 0,
    workMode: "both",
    availabilityStatus: "available",
    isActive: 1,
    createdAt: now,
    updatedAt: now,
  };
  const fields = { ...defaults, ...overrides };
  const cols = Object.keys(fields);
  const vals = Object.values(fields);
  const placeholders = cols.map(() => "?").join(", ");
  const result = database
    .prepare(
      `INSERT INTO "User" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`,
    )
    .run(...vals);
  return { id: Number(result.lastInsertRowid), ...fields } as {
    id: number;
    [key: string]: unknown;
  };
}

export function createTestJob(
  database: ReturnType<typeof Database>,
  userId: number,
  overrides: Record<string, unknown> = {},
) {
  const now = new Date().toISOString();
  const defaults: Record<string, unknown> = {
    userId,
    category: "Web Development",
    title: "Test Job",
    description: "This is a test job description",
    deadline: new Date(Date.now() + 86400000 * 30).toISOString(),
    status: "OPEN",
    workMode: "BOTH",
    urgency: "MEDIUM",
    createdAt: now,
    updatedAt: now,
  };
  const fields = { ...defaults, ...overrides };
  const cols = Object.keys(fields);
  const vals = Object.values(fields);
  const placeholders = cols.map(() => "?").join(", ");
  const result = database
    .prepare(
      `INSERT INTO "ClientJob" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`,
    )
    .run(...vals);
  return { id: Number(result.lastInsertRowid), ...fields };
}

export function createTestWallet(
  database: ReturnType<typeof Database>,
  userId: number,
  balance = 1000,
) {
  const now = new Date().toISOString();
  database
    .prepare(
      `INSERT INTO "Wallet" (userId, currency, balance, pendingBalance, updatedAt) VALUES (?, 'USD', ?, 0, ?)`,
    )
    .run(userId, balance, now);
  return database.prepare(`SELECT * FROM "Wallet" WHERE userId=?`).get(userId) as {
    id: number;
    userId: number;
    balance: number;
  };
}
