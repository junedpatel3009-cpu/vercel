import os from "node:os";
import path from "node:path";
import { mkdirSync } from "node:fs";

function isPostgresUrl(url: string) {
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}

export function getSqliteDatabasePath(rawDatabaseUrl = process.env.DATABASE_URL || "file:./prisma/app.db") {
  if (isPostgresUrl(rawDatabaseUrl)) {
    throw new Error(
      "DATABASE_URL points to PostgreSQL, but this loader requires a SQLite file path. " +
        "Use a file path like \"file:./prisma/app.db\" or configure a separate PostgreSQL adapter."
    );
  }

  const configured = rawDatabaseUrl.replace(/^file:/, "");
  const pathToUse = path.isAbsolute(configured)
    ? configured
    : process.env.VERCEL
    ? path.resolve(process.env.TMPDIR || os.tmpdir(), configured)
    : path.resolve(process.cwd(), configured);

  mkdirSync(path.dirname(pathToUse), { recursive: true });
  return pathToUse;
}
