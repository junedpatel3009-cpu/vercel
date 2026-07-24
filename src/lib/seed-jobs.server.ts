import path from "node:path";
import Database from "better-sqlite3";

export function seedTestJobs(userId: number) {
  const databasePath = path.resolve(process.cwd(), "prisma", "app.db");
  const db = new Database(databasePath);

  const now = new Date().toISOString();
  const deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Check if test job already exists
  const existing = db
    .prepare(`SELECT id FROM "ClientJob" WHERE userId = ? AND title = ?`)
    .get(userId, "Website Redesign");
  if (existing) {
    console.log("Test job already exists");
    return;
  }

  // Insert test job
  const result = db
    .prepare(
      `
    INSERT INTO "ClientJob" (
      userId, category, title, description, budgetMin, budgetMax,
      urgency, deadline, workMode, locationLabel, locationAddress,
      status, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      userId,
      "Development",
      "Website Redesign",
      "We need to redesign our company website with modern UI/UX. Should include responsive design, contact form integration, and SEO optimization.",
      5000,
      15000,
      "HIGH",
      deadline,
      "REMOTE",
      "San Francisco, CA",
      "123 Market St, San Francisco, CA 94103",
      "OPEN",
      now,
      now,
    );

  const jobId = result.lastInsertRowid as number;

  // Add sample attachment
  db.prepare(
    `
    INSERT INTO "ClientJobAttachment" (jobId, fileName, fileType, fileSize, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `,
  ).run(jobId, "design-reference.pdf", "application/pdf", 2048000, now);

  console.log(`Created test job with ID: ${jobId}`);
  return jobId;
}
