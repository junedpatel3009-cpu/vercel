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

  if (process.env.PRISMA_ACCELERATE_URL) {
    options.accelerateUrl = process.env.PRISMA_ACCELERATE_URL;
  } else {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required for Prisma SQLite adapter initialization.");
    }

    try {
      const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
      options.adapter = new PrismaBetterSqlite3({ url: databaseUrl });
    } catch (cause) {
      throw new Error(
        `Failed to load @prisma/adapter-better-sqlite3. Install the package and run this project with Node >=22.12.0 or install the required native build tools. Cause: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  }

  return new PrismaClient(options as ConstructorParameters<typeof PrismaClient>[0]);
}

export const prisma = globalForPrisma.prisma ?? (await createPrismaClient());

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
