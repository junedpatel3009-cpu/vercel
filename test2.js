import { getTestDb, createTestUser } from "./src/backend/test-helper.js";
const db = getTestDb();
const user = createTestUser(db, { role: "PROFESSIONAL" });
console.log("User:", user);
const row = db.prepare('SELECT * FROM "User" WHERE id = ?').get(user.id);
console.log("Row keys:", Object.keys(row));
console.log("Row:", row);
console.log("isVerified:", row.isVerified);
console.log("isVerified type:", typeof row.isVerified);
