import "dotenv/config";
import Database from "better-sqlite3";
import pg from "pg";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString?.startsWith("postgres")) {
  throw new Error("DIRECT_URL or DATABASE_URL must be a PostgreSQL connection string.");
}

const sqlite = new Database("prisma/app.db", { readonly: true });
const client = new pg.Client({ connectionString });
await client.connect();

try {
  const users = sqlite.prepare('SELECT * FROM "User"').all();
  let migrated = 0;

  for (const user of users) {
    await client.query(
      `INSERT INTO "User" (
        role, "firstName", "lastName", email, phone, "passwordHash", "googleId", "avatarUrl",
        "companyName", industry, "professionalCategory", "professionalCity", "experienceYears",
        "hourlyRate", "fixedRate", "availabilityStatus", "averageRating", "reviewCount",
        "isVerified", "authProvider", "isActive", "createdAt", "updatedAt"
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
      ) ON CONFLICT (email) DO UPDATE SET
        role = EXCLUDED.role, "firstName" = EXCLUDED."firstName", "lastName" = EXCLUDED."lastName",
        phone = EXCLUDED.phone, "avatarUrl" = EXCLUDED."avatarUrl", "companyName" = EXCLUDED."companyName",
        industry = EXCLUDED.industry, "professionalCategory" = EXCLUDED."professionalCategory",
        "professionalCity" = EXCLUDED."professionalCity", "experienceYears" = EXCLUDED."experienceYears",
        "hourlyRate" = EXCLUDED."hourlyRate", "fixedRate" = EXCLUDED."fixedRate",
        "availabilityStatus" = EXCLUDED."availabilityStatus", "averageRating" = EXCLUDED."averageRating",
        "reviewCount" = EXCLUDED."reviewCount", "isVerified" = EXCLUDED."isVerified",
        "isActive" = EXCLUDED."isActive", "updatedAt" = EXCLUDED."updatedAt"`,
      [
        user.role, user.firstName, user.lastName, user.email, user.phone, user.passwordHash,
        user.googleId, user.avatarUrl, user.companyName, user.industry, user.professionalCategory,
        user.professionalCity, user.experienceYears, user.hourlyRate, user.fixedRate,
        user.availabilityStatus || "available", user.averageRating || 0, user.reviewCount || 0,
        Boolean(user.isVerified), user.authProvider || "LOCAL", Boolean(user.isActive),
        user.createdAt || new Date(), user.updatedAt || new Date(),
      ],
    );
    migrated += 1;
  }

  console.log(`Migrated ${migrated} users from SQLite to PostgreSQL.`);
} finally {
  sqlite.close();
  await client.end();
}
