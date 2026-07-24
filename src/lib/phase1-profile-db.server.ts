import path from "node:path";
import Database from "better-sqlite3";

type BetterSqlite3Database = InstanceType<typeof Database>;

type Phase1ProfessionalProfileInput = {
  userId: number;
  role: string;
  email: string;
  phone?: string | null;
  fullName: string;
  profilePhotoUrl?: string | null;
  companyName?: string | null;
  address?: string | null;
  bio?: string | null;
  professionalCategory?: string | null;
  professionalCity?: string | null;
  skills: string[];
  hourlyRate?: number | null;
  fixedRate?: number | null;
  experienceYears?: number | null;
  serviceType: string;
  serviceRadiusKm?: number | null;
  availabilityStatus: string;
  portfolioUrl?: string | null;
  isVerified?: boolean;
};

type Phase1VerificationInput = {
  userId: number;
  governmentIdUrl?: string | null;
  licenseUrl?: string | null;
  certifications?: string[];
  insuranceUrl?: string | null;
  selfieUrl?: string | null;
  status?: string;
};

const globalForPhase1ProfileDb = globalThis as typeof globalThis & {
  phase1ProfileDb?: BetterSqlite3Database;
};

function getDatabase() {
  if (!globalForPhase1ProfileDb.phase1ProfileDb) {
    const databasePath = path.resolve(process.cwd(), "prisma", "app.db");
    globalForPhase1ProfileDb.phase1ProfileDb = new Database(databasePath);
    ensurePhase1ProfileTables(globalForPhase1ProfileDb.phase1ProfileDb);
  }

  return globalForPhase1ProfileDb.phase1ProfileDb;
}

function ensurePhase1ProfileTables(db: BetterSqlite3Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "users" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "role" TEXT NOT NULL,
      "email" TEXT UNIQUE,
      "phone" TEXT UNIQUE,
      "password_hash" TEXT,
      "google_id" TEXT UNIQUE,
      "is_email_verified" INTEGER NOT NULL DEFAULT 0,
      "is_phone_verified" INTEGER NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'active',
      "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "last_login" TEXT
    );

    CREATE TABLE IF NOT EXISTS "user_profiles" (
      "user_id" TEXT NOT NULL PRIMARY KEY,
      "full_name" TEXT,
      "company_name" TEXT,
      "profile_photo" TEXT,
      "address" TEXT,
      "bio" TEXT,
      "timezone" TEXT,
      "language" TEXT
    );

    CREATE TABLE IF NOT EXISTS "professional_details" (
      "user_id" TEXT NOT NULL PRIMARY KEY,
      "hourly_rate" REAL,
      "fixed_rate" REAL,
      "experience_years" INTEGER,
      "skills" TEXT,
      "service_type" TEXT,
      "service_radius_km" INTEGER,
      "availability_status" TEXT,
      "portfolio_url" TEXT,
      "is_verified" INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS "locations" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "user_id" TEXT,
      "lat" REAL,
      "lng" REAL,
      "city" TEXT,
      "state" TEXT,
      "country" TEXT,
      "address_approx" TEXT,
      "service_radius_km" INTEGER,
      "is_base_location" INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS "verifications" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "professional_id" TEXT,
      "document_type" TEXT,
      "document_url" TEXT,
      "status" TEXT,
      "reviewed_by" TEXT,
      "reviewed_at" TEXT,
      "notes" TEXT
    );
  `);
}

export function upsertPhase1ProfessionalProfile(input: Phase1ProfessionalProfileInput) {
  const db = getDatabase();
  const timestamp = new Date().toISOString();
  const userId = String(input.userId);

  db.transaction(() => {
    db.prepare(
      `
        INSERT INTO "users" (
          id,
          role,
          email,
          phone,
          status,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          role = excluded.role,
          email = excluded.email,
          phone = excluded.phone,
          updated_at = excluded.updated_at
      `,
    ).run(
      userId,
      input.role.toLowerCase(),
      input.email,
      input.phone || null,
      "active",
      timestamp,
      timestamp,
    );

    db.prepare(
      `
        INSERT INTO "user_profiles" (
          user_id,
          full_name,
          company_name,
          profile_photo,
          address,
          bio,
          timezone,
          language
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          full_name = excluded.full_name,
          company_name = excluded.company_name,
          profile_photo = excluded.profile_photo,
          address = excluded.address,
          bio = excluded.bio,
          timezone = excluded.timezone,
          language = excluded.language
      `,
    ).run(
      userId,
      input.fullName,
      input.companyName || null,
      input.profilePhotoUrl || null,
      input.address || null,
      input.bio || null,
      "Asia/Calcutta",
      "en",
    );

    db.prepare(
      `
        INSERT INTO "professional_details" (
          user_id,
          hourly_rate,
          fixed_rate,
          experience_years,
          skills,
          service_type,
          service_radius_km,
          availability_status,
          portfolio_url,
          is_verified
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          hourly_rate = excluded.hourly_rate,
          fixed_rate = excluded.fixed_rate,
          experience_years = excluded.experience_years,
          skills = excluded.skills,
          service_type = excluded.service_type,
          service_radius_km = excluded.service_radius_km,
          availability_status = excluded.availability_status,
          portfolio_url = excluded.portfolio_url,
          is_verified = excluded.is_verified
      `,
    ).run(
      userId,
      input.hourlyRate ?? null,
      input.fixedRate ?? null,
      input.experienceYears ?? null,
      JSON.stringify(input.skills),
      input.serviceType,
      input.serviceRadiusKm ?? null,
      input.availabilityStatus,
      input.portfolioUrl || null,
      input.isVerified ? 1 : 0,
    );

    db.prepare(
      `
        INSERT INTO "locations" (
          id,
          user_id,
          city,
          address_approx,
          service_radius_km,
          is_base_location
        )
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          city = excluded.city,
          address_approx = excluded.address_approx,
          service_radius_km = excluded.service_radius_km,
          is_base_location = excluded.is_base_location
      `,
    ).run(
      `base:${userId}`,
      userId,
      input.professionalCity || null,
      input.address || input.professionalCity || null,
      input.serviceRadiusKm ?? null,
      1,
    );
  })();
}

export function upsertPhase1ProfessionalVerifications(input: Phase1VerificationInput) {
  const db = getDatabase();
  const userId = String(input.userId);
  const status = input.status || "pending";
  const documents = [
    { type: "government_id", url: input.governmentIdUrl },
    { type: "license", url: input.licenseUrl },
    { type: "insurance", url: input.insuranceUrl },
    { type: "selfie", url: input.selfieUrl },
    ...(input.certifications || []).map((url, index) => ({
      type: `certificate_${index + 1}`,
      url,
    })),
  ].filter((document): document is { type: string; url: string } => Boolean(document.url));

  const upsert = db.prepare(
    `
      INSERT INTO "verifications" (
        id,
        professional_id,
        document_type,
        document_url,
        status,
        reviewed_by,
        reviewed_at,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        document_type = excluded.document_type,
        document_url = excluded.document_url,
        status = excluded.status,
        notes = excluded.notes
    `,
  );

  for (const document of documents) {
    upsert.run(
      `${userId}:${document.type}`,
      userId,
      document.type,
      document.url,
      status,
      null,
      null,
      "Uploaded from professional profile",
    );
  }
}
