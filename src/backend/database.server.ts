import path from "node:path";
import Database from "better-sqlite3";

export type AppDatabase = InstanceType<typeof Database>;

const globalDatabase = globalThis as typeof globalThis & { servioApiDb?: AppDatabase };

export function databasePath() {
  const configured = process.env.DATABASE_URL?.replace(/^file:/, "");
  return path.resolve(process.cwd(), configured || "prisma/app.db");
}

export function getApiDatabase() {
  if (!globalDatabase.servioApiDb) {
    const db = new Database(databasePath());
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrateApiSchema(db);
    globalDatabase.servioApiDb = db;
  }
  return globalDatabase.servioApiDb;
}

function addColumn(db: AppDatabase, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column))
    db.exec(`ALTER TABLE "${table}" ADD COLUMN ${definition}`);
}

function migrateApiSchema(db: AppDatabase) {
  // Ensure the application's established user bootstrap runs before adding API fields.
  db.exec(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "role" TEXT NOT NULL DEFAULT 'CLIENT', "firstName" TEXT NOT NULL, "lastName" TEXT NOT NULL,
      "email" TEXT NOT NULL UNIQUE, "phone" TEXT UNIQUE, "passwordHash" TEXT, "googleId" TEXT UNIQUE,
      "avatarUrl" TEXT, "authProvider" TEXT NOT NULL DEFAULT 'LOCAL', "isActive" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TEXT NOT NULL, "updatedAt" TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "ApiToken" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT, "userId" INTEGER NOT NULL, "tokenHash" TEXT NOT NULL UNIQUE,
      "kind" TEXT NOT NULL, "expiresAt" TEXT NOT NULL, "usedAt" TEXT, "createdAt" TEXT NOT NULL,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS "ServiceCategory" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT NOT NULL UNIQUE, "slug" TEXT NOT NULL UNIQUE,
      "description" TEXT DEFAULT '', "iconName" TEXT DEFAULT '', "sortOrder" INTEGER DEFAULT 0,
      "createdAt" TEXT NOT NULL, "updatedAt" TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "Service" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT, "categoryId" INTEGER NOT NULL, "professionalId" INTEGER NOT NULL,
      "name" TEXT NOT NULL, "description" TEXT NOT NULL, "price" INTEGER, "imageUrl" TEXT, "isActive" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TEXT NOT NULL, "updatedAt" TEXT NOT NULL,
      FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id"), FOREIGN KEY ("professionalId") REFERENCES "User"("id")
    );
    CREATE TABLE IF NOT EXISTS "StoredFile" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT, "ownerId" INTEGER NOT NULL, "purpose" TEXT NOT NULL,
      "fileName" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "sizeBytes" INTEGER NOT NULL, "storageKey" TEXT NOT NULL UNIQUE,
      "isPublic" INTEGER NOT NULL DEFAULT 0, "createdAt" TEXT NOT NULL,
      FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS "Wallet" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT, "userId" INTEGER NOT NULL UNIQUE, "currency" TEXT NOT NULL DEFAULT 'USD',
      "balance" INTEGER NOT NULL DEFAULT 0, "pendingBalance" INTEGER NOT NULL DEFAULT 0, "updatedAt" TEXT NOT NULL,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS "WalletTransaction" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT, "walletId" INTEGER NOT NULL, "paymentId" INTEGER,
      "type" TEXT NOT NULL, "amount" INTEGER NOT NULL, "status" TEXT NOT NULL, "description" TEXT NOT NULL,
      "metadataJson" TEXT, "createdAt" TEXT NOT NULL,
      FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS "Payment" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT, "clientId" INTEGER NOT NULL, "professionalId" INTEGER NOT NULL,
      "jobId" INTEGER, "amount" INTEGER NOT NULL, "commissionAmount" INTEGER NOT NULL, "currency" TEXT NOT NULL DEFAULT 'USD',
      "provider" TEXT NOT NULL, "providerReference" TEXT, "status" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL UNIQUE,
      "createdAt" TEXT NOT NULL, "updatedAt" TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "BrowserSubscription" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT, "userId" INTEGER NOT NULL, "endpoint" TEXT NOT NULL UNIQUE,
      "p256dh" TEXT NOT NULL, "auth" TEXT NOT NULL, "createdAt" TEXT NOT NULL,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS "Faq" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT, "question" TEXT NOT NULL, "answer" TEXT NOT NULL,
      "sortOrder" INTEGER NOT NULL DEFAULT 0, "isPublished" INTEGER NOT NULL DEFAULT 1, "createdAt" TEXT NOT NULL, "updatedAt" TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "ContactRequest" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT NOT NULL, "email" TEXT NOT NULL, "subject" TEXT NOT NULL,
      "message" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'OPEN', "createdAt" TEXT NOT NULL, "updatedAt" TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "ApiToken_user_kind_idx" ON "ApiToken"("userId", "kind");
    CREATE INDEX IF NOT EXISTS "Service_professional_idx" ON "Service"("professionalId");
    CREATE INDEX IF NOT EXISTS "WalletTransaction_wallet_idx" ON "WalletTransaction"("walletId", "createdAt");
    CREATE INDEX IF NOT EXISTS "Payment_users_idx" ON "Payment"("clientId", "professionalId");
  `);
  addColumn(db, "User", "emailVerifiedAt", '"emailVerifiedAt" TEXT');
}
