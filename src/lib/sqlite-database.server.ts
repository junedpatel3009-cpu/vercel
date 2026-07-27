import os from "node:os";
import path from "node:path";
import { mkdirSync } from "node:fs";

function isPostgresUrl(url: string) {
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}

export function getSqliteDatabasePath(rawDatabaseUrl = process.env.DATABASE_URL || "file:./prisma/app.db") {
  const configured = isPostgresUrl(rawDatabaseUrl)
    ? "file:./prisma/app.db"
    : rawDatabaseUrl;

  if (isPostgresUrl(rawDatabaseUrl)) {
    console.warn(
      "DATABASE_URL points to PostgreSQL. Falling back to local SQLite for legacy database modules. " +
        "This allows the app to start, but it will use a local SQLite file instead of Supabase/Postgres for these legacy paths."
    );
  }

  const normalized = configured.replace(/^file:/, "");
  const pathToUse = path.isAbsolute(normalized)
    ? normalized
    : process.env.VERCEL
    ? path.resolve(process.env.TMPDIR || os.tmpdir(), normalized)
    : path.resolve(process.cwd(), normalized);

  mkdirSync(path.dirname(pathToUse), { recursive: true });
  return pathToUse;
}
