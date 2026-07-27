import { PrismaClient } from "@/generated/prisma/client.ts";

interface PrismaClientOptionsLike {
  log?: Array<"info" | "query" | "warn" | "error">;
  accelerateUrl?: string;
  adapter?: unknown;
}

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

async function createPrismaClient() {
  const options: PrismaClientOptionsLike = {
    log: ["warn", "error"],
  };

  const databaseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL or DIRECT_URL is required for Prisma initialization.");
  }

  if (process.env.PRISMA_ACCELERATE_URL) {
    options.accelerateUrl = process.env.PRISMA_ACCELERATE_URL;
  } else if (databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://")) {
    try {
      const { PrismaPg } = await import("@prisma/adapter-pg");
      options.adapter = new PrismaPg({ connectionString: databaseUrl });
    } catch (cause) {
      throw new Error(
        `Failed to load @prisma/adapter-pg. Install @prisma/adapter-pg and ensure your DATABASE_URL or DIRECT_URL points to a Postgres database. Cause: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  } else if (databaseUrl.startsWith("file:") || databaseUrl.endsWith(".db")) {
    try {
      const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
      options.adapter = new PrismaBetterSqlite3({ url: databaseUrl });
    } catch (cause) {
      throw new Error(
        `Failed to load @prisma/adapter-better-sqlite3. Install the package and run this project with Node >=22.12.0 or install the required native build tools. Cause: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  } else {
    throw new Error(
      `Unsupported DATABASE_URL format for Prisma initialization: ${databaseUrl}. Use postgres:// or file://.`,
    );
  }

  return new PrismaClient(options as ConstructorParameters<typeof PrismaClient>[0]);
}

export const prisma = globalForPrisma.prisma ?? (await createPrismaClient());

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
