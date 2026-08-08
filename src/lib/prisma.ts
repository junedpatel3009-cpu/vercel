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

  // Supabase's transaction-mode pooler (normally DATABASE_URL on port 6543)
  // is useful for short-lived tools, but has proven unreliable for this
  // long-lived Prisma adapter. Prefer the direct/session connection when it
  // is provided, while retaining DATABASE_URL as the fallback.
  const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
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

// The Supabase pooler backing DATABASE_URL has proven slow/unreliable (see
// comment above), and callers fall back to a local SQLite mirror on failure.
// Without a bound, a slow-but-not-erroring query hangs for however long the
// pooler takes instead of triggering that fallback — race it against a short
// timeout so callers fail fast and fall back promptly.
export async function withPostgresTimeout<T>(fn: () => Promise<T>, ms = 4000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Postgres query timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([fn(), timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
