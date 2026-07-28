import Database from "better-sqlite3";

process.loadEnvFile(".env");
try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local is optional for non-local runs.
}

const { PrismaClient } = await import("../src/generated/prisma/client.ts");
const { PrismaPg } = await import("@prisma/adapter-pg");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.startsWith("postgres")) {
  throw new Error("DATABASE_URL must point to the PostgreSQL database.");
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

const localDb = new Database("prisma/app.db", { readonly: true });
const jobs = localDb.prepare('SELECT * FROM "ClientJob" ORDER BY id ASC').all();
const attachmentsFor = localDb.prepare(
  'SELECT * FROM "ClientJobAttachment" WHERE jobId = ? ORDER BY id ASC',
);
const userFor = localDb.prepare('SELECT email FROM "User" WHERE id = ? LIMIT 1');

let migrated = 0;
let skipped = 0;
let missingOwners = 0;

for (const job of jobs) {
  const localOwner = userFor.get(job.userId);
  if (!localOwner?.email) {
    missingOwners += 1;
    continue;
  }

  const owner = await prisma.user.findUnique({ where: { email: localOwner.email } });
  if (!owner) {
    missingOwners += 1;
    continue;
  }

  const createdAt = new Date(job.createdAt);
  const existing = await prisma.clientJob.findFirst({
    where: { userId: owner.id, title: job.title, createdAt },
    select: { id: true },
  });
  if (existing) {
    skipped += 1;
    continue;
  }

  const attachments = attachmentsFor.all(job.id).map((attachment) => ({
    fileName: attachment.fileName,
    fileType: attachment.fileType ?? null,
    fileSize: attachment.fileSize ?? null,
    previewUrl: attachment.previewUrl ?? null,
    createdAt: new Date(attachment.createdAt),
  }));

  await prisma.clientJob.create({
    data: {
      userId: owner.id,
      category: job.category,
      title: job.title,
      description: job.description,
      budgetMin: job.budgetMin ?? null,
      budgetMax: job.budgetMax ?? null,
      urgency: job.urgency,
      timingType: job.timingType,
      hourlyRate: job.hourlyRate ?? null,
      jobDate: job.jobDate ? new Date(job.jobDate) : null,
      deadline: new Date(job.deadline),
      workMode: job.workMode,
      locationLabel: job.locationLabel ?? null,
      locationAddress: job.locationAddress ?? null,
      locationLat: job.locationLat ?? null,
      locationLng: job.locationLng ?? null,
      status: job.status,
      createdAt,
      updatedAt: new Date(job.updatedAt),
      attachments: { create: attachments },
    },
  });
  migrated += 1;
}

localDb.close();
await prisma.$disconnect();
console.log(JSON.stringify({ localJobs: jobs.length, migrated, skipped, missingOwners }));
