import { randomBytes, scryptSync } from "node:crypto";
import path from "node:path";
import Database from "better-sqlite3";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!email || !/^\S+@\S+\.\S+$/.test(email) || !password || password.length < 12) {
  console.error("Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters.");
  process.exit(1);
}

const databaseUrl = (process.env.DATABASE_URL || "file:./prisma/app.db").replace(/^file:/, "");
const db = new Database(path.resolve(process.cwd(), databaseUrl));
const salt = randomBytes(16).toString("base64url");
const passwordHash = `scrypt$${salt}$${scryptSync(password, salt, 64).toString("base64url")}`;
const stamp = new Date().toISOString();
const existing = db.prepare(`SELECT id FROM "User" WHERE email=?`).get(email);

if (existing) {
  db.prepare(`UPDATE "User" SET role='ADMIN',passwordHash=?,isActive=1,updatedAt=? WHERE id=?`).run(
    passwordHash,
    stamp,
    existing.id,
  );
} else {
  db.prepare(
    `INSERT INTO "User" (role,firstName,lastName,email,passwordHash,authProvider,isActive,createdAt,updatedAt) VALUES ('ADMIN','Servio','Admin',? ,?,'LOCAL',1,?,?)`,
  ).run(email, passwordHash, stamp, stamp);
}
console.log(`Admin account ready: ${email}`);
db.close();
