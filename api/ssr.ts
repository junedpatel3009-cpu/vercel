import { mkdirSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

function initializeSsrDatabase() {
  const databaseUrl = process.env.DATABASE_URL || "file:./prisma/app.db";
  const configured = /^(postgres|postgresql):\/\//.test(databaseUrl)
    ? "file:./prisma/app.db"
    : databaseUrl;
  const normalized = configured.replace(/^file:/, "");
  const databasePath = path.isAbsolute(normalized)
    ? normalized
    : process.env.VERCEL
      ? path.resolve(process.env.TMPDIR || os.tmpdir(), normalized)
      : path.resolve(process.cwd(), normalized);

  mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new Database(databasePath);
  try {
    // The full user module upgrades this base table if it needs extra columns.
    // This table must exist before the SSR bundle loads its first route module.
    db.exec(`
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
        "authProvider" TEXT NOT NULL DEFAULT 'LOCAL',
        "isActive" INTEGER NOT NULL DEFAULT 1,
        "createdAt" TEXT NOT NULL,
        "updatedAt" TEXT NOT NULL
      )
    `);
  } finally {
    db.close();
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    // Vercel functions receive a fresh /tmp filesystem on cold starts. Create
    // the base user table before route modules issue their first User query.
    initializeSsrDatabase();

    // @ts-expect-error Generated build output
    const { default: serverEntry } = await import("../dist/server/server.js");

    const host = req.headers.host || "localhost";
    const url = new URL(req.url || "/", `https://${host}`);

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        value.forEach((v) => headers.append(key, v));
      } else if (value) {
        headers.set(key, value);
      }
    }

    const response = await serverEntry.fetch(
      new Request(url, {
        method: req.method,
        headers,
      }),
      {},
      {},
    );

    res.statusCode = response.status;
    response.headers.forEach((value: string, key: string) => {
      res.setHeader(key, value);
    });

    if (response.body) {
      const buffer = await response.arrayBuffer();
      res.end(Buffer.from(buffer));
    } else {
      res.end("");
    }
  } catch (error) {
    console.error("SSR Error:", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
