import { createServerFn } from "@tanstack/react-start";
import { getCurrentUser } from "@/lib/current-user.server";
import { deleteClientJob, getClientJobById } from "@/lib/job-db.server";
import { getProjectTrackingDetailsByJob } from "@/lib/project-request-db.server";
import { seedTestJobs } from "@/lib/seed-jobs.server";

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

    let job = getClientJobById(viewer.id, numericId);

    // For development/testing: create test job if it doesn't exist
    if (!job && numericId === 1) {
      const testJobId = seedTestJobs(viewer.id) as number;
      if (testJobId) {
        job = getClientJobById(viewer.id, testJobId);
      }
    }

    const tracking = job ? (getProjectTrackingDetailsByJob(viewer.id, job.id) ?? null) : null;

    return { viewer, job, tracking };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .inputValidator((input: { projectId: number }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "CLIENT") {
      throw new Error("Only clients can delete projects.");
    }

    return deleteClientJob(viewer.id, data.projectId);
  });
