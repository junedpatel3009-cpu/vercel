import { createServerFn } from "@tanstack/react-start";
import { getCurrentUser } from "@/lib/current-user.server";
import { deleteClientJob, getClientJobById } from "@/lib/job-db.server";
import { prisma } from "@/lib/prisma";
import { getProjectTrackingDetailsByJob } from "@/lib/project-request-db.server";
import { seedTestJobs } from "@/lib/seed-jobs.server";

const usesPostgres = () => (process.env.DATABASE_URL || "").startsWith("postgres");

/**
 * Sessions created before the PostgreSQL migration can retain the old local
 * user ID. Resolve the account by its stable email before accessing migrated
 * project records.
 */
async function getProjectOwnerId(viewer: { id: number; email: string }) {
  if (!usesPostgres()) {
    return viewer.id;
  }

  const user = await prisma.user.findUnique({
    where: { email: viewer.email },
    select: { id: true },
  });

  return user?.id ?? viewer.id;
}

export const checkProjectAuth = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = getCurrentUser();

  if (!viewer) {
    return { authenticated: false, isClient: false };
  }

  return {
    authenticated: true,
    isClient: viewer.role === "CLIENT",
  };
});

export const getProjectData = createServerFn({ method: "GET" })
  .inputValidator((id: string) => id)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer) {
      return null;
    }

    if (viewer.role !== "CLIENT") {
      return null;
    }

    // Convert "p-001" format to numeric ID (parse the number after "p-")
    const numericId = parseInt(data.replace(/^p-/i, ""), 10);
    if (isNaN(numericId)) {
      return null;
    }

    const ownerId = await getProjectOwnerId(viewer);

    let job = usesPostgres()
      ? (await prisma.clientJob.findFirst({
          where: { id: numericId, userId: ownerId },
          include: { attachments: true },
        }).then((record) => (record ? {
          ...record,
          jobDate: record.jobDate?.toISOString() ?? null,
          deadline: record.deadline.toISOString(),
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString(),
          attachments: record.attachments.map((attachment) => ({
            ...attachment,
            createdAt: attachment.createdAt.toISOString(),
          })),
        } : null)))
      : getClientJobById(viewer.id, numericId);

    // For development/testing: create test job if it doesn't exist
    if (!job && numericId === 1) {
      const testJobId = seedTestJobs(ownerId) as number;
      if (testJobId) {
        job = getClientJobById(ownerId, testJobId);
      }
    }

    const tracking = !usesPostgres() && job
      ? (getProjectTrackingDetailsByJob(ownerId, job.id) ?? null)
      : null;

    return { viewer, job, tracking };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .inputValidator((input: { projectId: number }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "CLIENT") {
      throw new Error("Only clients can delete projects.");
    }

    const ownerId = await getProjectOwnerId(viewer);

    if (usesPostgres()) {
      const result = await prisma.clientJob.deleteMany({
        where: { id: data.projectId, userId: ownerId },
      });
      return result.count > 0;
    }

    return deleteClientJob(ownerId, data.projectId);
  });
