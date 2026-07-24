import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, Link, redirect, useLoaderData, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import {
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Handshake,
  MapPin,
  MessageSquare,
  PlusCircle,
  Search,
  Send,
  Star,
  XCircle,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/current-user.server";
import {
  cancelHireProject,
  deleteRejectedHireRequest,
  getClientHireRequests,
  startClientHireProject,
  type ClientHireRequestRecord,
} from "@/lib/hire-db.server";
import {
  deleteClientJob,
  getClientJobsByUserId,
  getOpenClientJobById,
  updateClientJobStatus,
  type ClientJobRecord,
  type JobStatus,
} from "@/lib/job-db.server";
import { formatApproximateLocation } from "@/lib/location-privacy";
import { queueAccountEmailNotification } from "@/lib/notification-email.server";
import {
  getClientTrackedProjects,
  getClientProjectRequests,
  getProjectNegotiationsForClient,
  cancelProjectTracking,
  rateCompletedProject,
  updateClientProjectRequestStatus,
  type ClientTrackedProjectRecord,
  type ClientProjectRequestRecord,
  type ProjectNegotiationRecord,
  type ProjectRequestStatus,
} from "@/lib/project-request-db.server";
import { getClientProfileByUserId } from "@/lib/user-db.server";

type ProjectBucketFilter = "running" | "completed" | "requests" | "direct-hires";

const getProjectsPageData = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = getCurrentUser();

  if (!viewer) {
    return null;
  }

  if (viewer.role !== "CLIENT") {
    return {
      viewer,
      clientProfile: null,
      projects: [],
      projectRequests: [],
      projectNegotiations: [],
      trackedProjects: [],
      hireRequests: [],
    };
  }

  return {
    viewer,
    clientProfile: getClientProfileByUserId(viewer.id),
    projects: getClientJobsByUserId(viewer.id),
    projectRequests: getClientProjectRequests(viewer.id),
    projectNegotiations: getProjectNegotiationsForClient(viewer.id),
    trackedProjects: getClientTrackedProjects(viewer.id),
    hireRequests: getClientHireRequests(viewer.id),
  };
});

const updateProjectRequest = createServerFn({ method: "POST" })
  .inputValidator((input: { requestId: number; status: ProjectRequestStatus }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "CLIENT") {
      throw new Error("Only clients can update project requests.");
    }

    const existingRequest = getClientProjectRequests(viewer.id).find(
      (request) => request.id === data.requestId,
    );
    const request = updateClientProjectRequestStatus(viewer.id, data.requestId, data.status);

    if (request) {
      const projectTitle =
        existingRequest?.projectTitle ||
        getOpenClientJobById(request.jobId)?.title ||
        "your project";
      const clientName = `${viewer.firstName} ${viewer.lastName}`.trim() || viewer.email;
      const statusLabel = data.status === "ACCEPTED" ? "accepted" : "rejected";

      queueAccountEmailNotification(request.professionalId, {
        subject: `Your project request was ${statusLabel}`,
        title: `Request ${statusLabel}`,
        body: `${clientName} ${statusLabel} your request for ${projectTitle}. ${
          data.status === "ACCEPTED"
            ? "Project tracking is ready for the next steps."
            : "You can review other open projects from your professional dashboard."
        }`,
        actionLabel: data.status === "ACCEPTED" ? "View project" : "View requests",
        actionPath: "/professional-stats",
      });
    }

    return request;
  });

const updateProjectStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { projectId: number; status: JobStatus }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "CLIENT") {
      throw new Error("Only clients can update projects.");
    }

    return updateClientJobStatus(viewer.id, data.projectId, data.status);
  });

const removeProjectImmediately = createServerFn({ method: "POST" })
  .inputValidator((input: { projectId: number }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "CLIENT") {
      throw new Error("Only clients can remove projects.");
    }

    return deleteClientJob(viewer.id, data.projectId);
  });

const rateProjectProfessional = createServerFn({ method: "POST" })
  .inputValidator((input: { trackingId: number; rating: number; comment?: string | null }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "CLIENT") {
      throw new Error("Only clients can rate completed projects.");
    }

    return rateCompletedProject(viewer.id, data);
  });

const startDirectHireProject = createServerFn({ method: "POST" })
  .inputValidator((input: { contractId: string }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "CLIENT") {
      throw new Error("Only clients can start direct hire projects.");
    }

    return startClientHireProject(viewer.id, data.contractId);
  });

const cancelTrackedProject = createServerFn({ method: "POST" })
  .inputValidator((input: { trackingId: number }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "CLIENT") {
      throw new Error("Only clients can cancel projects from this page.");
    }

    return cancelProjectTracking(viewer.id, data.trackingId);
  });

const cancelDirectHireProject = createServerFn({ method: "POST" })
  .inputValidator((input: { contractId: string }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "CLIENT") {
      throw new Error("Only clients can cancel direct hire projects from this page.");
    }

    return cancelHireProject(viewer.id, data.contractId);
  });

const deleteRejectedDirectHire = createServerFn({ method: "POST" })
  .inputValidator((input: { contractId: string }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "CLIENT") {
      throw new Error("Only clients can delete rejected direct hire requests from this page.");
    }

    return deleteRejectedHireRequest(viewer.id, data.contractId);
  });

export const Route = createFileRoute("/projects")({
  beforeLoad: async ({ location }) => {
    const data = await getProjectsPageData();

    if (!data) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }

    if (data.viewer.role !== "CLIENT") {
      throw redirect({
        to: "/dashboard",
      });
    }
  },
  loader: () => getProjectsPageData(),
  head: () => ({ meta: [{ title: "Projects - Servio" }] }),
  component: Projects,
});

function Projects() {
  const data = useLoaderData({ from: "/projects" });
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [expandedTimelineId, setExpandedTimelineId] = useState<number | null>(null);
  const [ratingDrafts, setRatingDrafts] = useState<
    Record<number, { rating: number; comment: string }>
  >({});
  const [activeProjectFilter, setActiveProjectFilter] = useState<ProjectBucketFilter | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(interval);
  }, []);

  if (!data) {
    return null;
  }

  const { viewer, clientProfile, projects } = data;
  const projectRequests = (data.projectRequests ?? []) as ClientProjectRequestRecord[];
  const projectNegotiations = (data.projectNegotiations ?? []) as ProjectNegotiationRecord[];
  const trackedProjects = (data.trackedProjects ?? []) as ClientTrackedProjectRecord[];
  const hireRequests = (data.hireRequests ?? []) as ClientHireRequestRecord[];
  const trackedJobIds = new Set(
    trackedProjects
      .filter((project) => project.status === "ACTIVE" || project.status === "COMPLETED")
      .map((project) => project.jobId),
  );
  const visibleProjects = projects.filter(
    (project) => !trackedJobIds.has(project.id) && !isClosedProjectExpired(project, now),
  );
  const displayName = clientProfile?.fullName || `${viewer.firstName} ${viewer.lastName}`.trim();
  const runningProjects = trackedProjects.filter((project) => project.status === "ACTIVE");
  const completedProjects = trackedProjects.filter((project) => project.status === "COMPLETED");
  const visibleHireRequests = hireRequests.filter(
    (request) =>
      request.status !== "started" &&
      request.status !== "cancelled" &&
      !isExpiredRejectedHireRequest(request, now),
  );
  const acceptedHireRequests = visibleHireRequests.filter(
    (request) => request.status === "accepted",
  );
  const startedHireRequests = hireRequests.filter(
    (request) => request.status === "started" && !request.trackingId,
  );
  const runningProjectCount = runningProjects.length + startedHireRequests.length;
  const showAllProjectBuckets = activeProjectFilter === null;
  const activeProjectFilterLabel = activeProjectFilter
    ? getProjectBucketLabel(activeProjectFilter)
    : null;

  function toggleProjectFilter(filter: ProjectBucketFilter) {
    setActiveProjectFilter((current) => (current === filter ? null : filter));
  }

  async function handleRequestStatus(requestId: number, status: ProjectRequestStatus) {
    const actionKey = `${requestId}-${status}`;
    const selectedRequest = projectRequests.find((request) => request.id === requestId);
    setPendingAction(actionKey);

    try {
      const request = await updateProjectRequest({ data: { requestId, status } });
      if (request && selectedRequest) {
        await emitProjectNotification({
          trackingId: request.id,
          actorId: viewer.id,
          recipientId: request.professionalId,
          title: status === "ACCEPTED" ? "Project request accepted" : "Project request rejected",
          description:
            status === "ACCEPTED"
              ? `${selectedRequest.projectTitle} was accepted. Project tracking is ready.`
              : `${selectedRequest.projectTitle} request was rejected.`,
          href: "/professional-stats",
        });
      }
      await router.invalidate();
    } finally {
      setPendingAction(null);
    }
  }

  async function handleProjectStatus(projectId: number, status: JobStatus) {
    const actionKey = `project-${projectId}-${status}`;
    setPendingAction(actionKey);

    try {
      await updateProjectStatus({ data: { projectId, status } });
      await router.invalidate();
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRemoveProjectNow(projectId: number) {
    const actionKey = `project-${projectId}-REMOVE`;
    setPendingAction(actionKey);

    try {
      await removeProjectImmediately({ data: { projectId } });
      await router.invalidate();
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRateProject(project: ClientTrackedProjectRecord) {
    const draft = ratingDrafts[project.id] ?? {
      rating: project.reviewRating ?? 5,
      comment: project.reviewComment ?? "",
    };
    const actionKey = `rate-${project.id}`;
    setPendingAction(actionKey);

    try {
      await rateProjectProfessional({
        data: {
          trackingId: project.id,
          rating: draft.rating,
          comment: draft.comment || null,
        },
      });
      await router.invalidate();
    } finally {
      setPendingAction(null);
    }
  }

  async function handleStartDirectHire(request: ClientHireRequestRecord) {
    const actionKey = `start-direct-hire-${request.contractId}`;
    setPendingAction(actionKey);

    try {
      await startDirectHireProject({ data: { contractId: request.contractId } });
      await router.invalidate();
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCancelTrackedProject(project: ClientTrackedProjectRecord) {
    const actionKey = `cancel-tracked-${project.id}`;
    setPendingAction(actionKey);

    try {
      await cancelTrackedProject({ data: { trackingId: project.id } });
      await router.invalidate();
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCancelDirectHire(request: ClientHireRequestRecord) {
    const actionKey = `cancel-direct-hire-${request.contractId}`;
    setPendingAction(actionKey);

    try {
      await cancelDirectHireProject({ data: { contractId: request.contractId } });
      await router.invalidate();
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDeleteRejectedDirectHire(request: ClientHireRequestRecord) {
    const actionKey = `delete-rejected-direct-hire-${request.contractId}`;
    setPendingAction(actionKey);

    try {
      await deleteRejectedDirectHire({ data: { contractId: request.contractId } });
      await router.invalidate();
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <AppShell
      userName={displayName}
      userRole="Client"
      userAvatarUrl={clientProfile?.avatarUrl || viewer.avatarUrl}
    >
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            These projects are loaded from your saved database records.
          </p>
        </div>
        <Button asChild>
          <Link to="/post-job">
            <PlusCircle className="h-4 w-4" />
            Create new project
          </Link>
        </Button>
      </div>

      {visibleProjects.length ? (
        <div className="mb-6 grid auto-rows-fr gap-4 lg:grid-cols-2">
          {visibleProjects.map((project) => {
            const removeInMs = getClosedProjectRemovalMs(project, now);

            return (
              <div
                key={project.id}
                className="flex min-h-[240px] flex-col rounded-xl border border-border bg-card p-5 shadow-soft transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{project.category}</Badge>
                      <Badge
                        variant={
                          project.status === "OPEN"
                            ? "default"
                            : project.status === "DRAFT"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {project.status === "OPEN" ? "Active" : formatEnum(project.status)}
                      </Badge>
                    </div>
                    <h2 className="mt-3 line-clamp-2 text-lg font-semibold">{project.title}</h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                      {project.description}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/project/$projectId" params={{ projectId: String(project.id) }}>
                      <Search className="h-4 w-4" />
                      View
                    </Link>
                  </Button>
                </div>

                <div className="mt-5 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                  <span className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    {formatBudget(project.budgetMin, project.budgetMax, project.timingType)}
                  </span>
                  <span className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    {formatDate(project.deadline)}
                  </span>
                  <span className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    {formatWorkMode(project.workMode)}
                  </span>
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {project.attachments.length} files
                  </span>
                </div>

                <div className="mt-auto flex items-center gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {formatApproximateLocation(
                      project.locationAddress || project.locationLabel,
                      "Remote or no location saved",
                    )}
                  </span>
                </div>

                {removeInMs != null ? (
                  <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
                    Closed project. Removes in {formatCountdown(removeInMs)}.
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" asChild>
                    <Link to="/project/$projectId" params={{ projectId: String(project.id) }}>
                      View project
                    </Link>
                  </Button>
                  {project.status === "OPEN" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleProjectStatus(project.id, "CLOSED")}
                      disabled={pendingAction !== null}
                    >
                      <XCircle className="h-4 w-4" />
                      {pendingAction === `project-${project.id}-CLOSED`
                        ? "Closing"
                        : "Close project"}
                    </Button>
                  ) : null}
                  {project.status === "CLOSED" ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleProjectStatus(project.id, "OPEN")}
                        disabled={pendingAction !== null}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {pendingAction === `project-${project.id}-OPEN`
                          ? "Opening"
                          : "Reopen project"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemoveProjectNow(project.id)}
                        disabled={pendingAction !== null}
                      >
                        <XCircle className="h-4 w-4" />
                        {pendingAction === `project-${project.id}-REMOVE`
                          ? "Removing"
                          : "Close immediately"}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mb-6 rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-soft">
          <Briefcase className="mx-auto h-9 w-9 text-muted-foreground" />
          <h2 className="mt-3 font-semibold">No projects saved yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Create a project from the job posting form. After it is saved, it will appear here from
            the database.
          </p>
          <Button className="mt-4" asChild>
            <Link to="/post-job">Create new project</Link>
          </Button>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ProjectStat
          label="Running"
          value={runningProjectCount}
          icon={Clock}
          isActive={activeProjectFilter === "running"}
          onClick={() => toggleProjectFilter("running")}
        />
        <ProjectStat
          label="Completed"
          value={completedProjects.length}
          icon={CheckCircle2}
          isActive={activeProjectFilter === "completed"}
          onClick={() => toggleProjectFilter("completed")}
        />
        <ProjectStat
          label="Requests"
          value={projectRequests.length}
          icon={Send}
          isActive={activeProjectFilter === "requests"}
          onClick={() => toggleProjectFilter("requests")}
        />
        <ProjectStat
          label="Direct hires"
          value={acceptedHireRequests.length}
          icon={Handshake}
          isActive={activeProjectFilter === "direct-hires"}
          onClick={() => toggleProjectFilter("direct-hires")}
        />
      </div>

      {activeProjectFilterLabel ? (
        <div className="mb-6 flex flex-col justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center">
          <p className="text-sm font-medium">
            Showing only {activeProjectFilterLabel.toLowerCase()}.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setActiveProjectFilter(null)}
          >
            Show all projects
          </Button>
        </div>
      ) : null}

      <div className="mb-6 space-y-6">
        {showAllProjectBuckets || activeProjectFilter === "running" ? (
          <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-semibold">Running projects</h2>
                <p className="text-sm text-muted-foreground">
                  Accepted requests currently in progress.
                </p>
              </div>
              <Badge>{runningProjectCount} running</Badge>
            </div>
            {runningProjectCount ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {runningProjects.map((project) => (
                  <TrackedProjectCard
                    key={`running-${project.id}`}
                    project={project}
                    pendingAction={pendingAction}
                    ratingDraft={
                      ratingDrafts[project.id] ?? {
                        rating: project.reviewRating ?? 5,
                        comment: project.reviewComment ?? "",
                      }
                    }
                    onDraftChange={(draft) =>
                      setRatingDrafts((drafts) => ({
                        ...drafts,
                        [project.id]: draft,
                      }))
                    }
                    onRate={() => handleRateProject(project)}
                    onCancel={() => handleCancelTrackedProject(project)}
                  />
                ))}
                {startedHireRequests.map((request) => (
                  <RunningDirectHireCard
                    key={`running-direct-hire-${request.contractId}`}
                    request={request}
                    pendingAction={pendingAction}
                    onCancel={handleCancelDirectHire}
                  />
                ))}
              </div>
            ) : (
              <EmptyProjectBox
                icon={Clock}
                title="No running projects"
                description="Accepted active projects will appear here."
              />
            )}
          </section>
        ) : null}

        {showAllProjectBuckets || activeProjectFilter === "direct-hires" ? (
          <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-semibold">Direct hires</h2>
                <p className="text-sm text-muted-foreground">
                  Hire requests you sent directly from professional profiles.
                </p>
              </div>
              <Badge variant="secondary">{visibleHireRequests.length} hires</Badge>
            </div>
            {visibleHireRequests.length ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {visibleHireRequests.map((request) => (
                  <DirectHireCard
                    key={request.contractId}
                    request={request}
                    pendingAction={pendingAction}
                    onStartProject={handleStartDirectHire}
                    onDeleteRejected={handleDeleteRejectedDirectHire}
                  />
                ))}
              </div>
            ) : (
              <EmptyProjectBox
                icon={Handshake}
                title="No direct hires yet"
                description="When you send a hire request to a professional, it will appear here."
              />
            )}
          </section>
        ) : null}

        {showAllProjectBuckets || activeProjectFilter === "completed" ? (
          <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-semibold">Completed projects</h2>
                <p className="text-sm text-muted-foreground">
                  Finished work ready for review history.
                </p>
              </div>
              <Badge variant="secondary">{completedProjects.length} completed</Badge>
            </div>
            {completedProjects.length ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {completedProjects.map((project) => (
                  <TrackedProjectCard
                    key={`completed-${project.id}`}
                    project={project}
                    pendingAction={pendingAction}
                    ratingDraft={
                      ratingDrafts[project.id] ?? {
                        rating: project.reviewRating ?? 5,
                        comment: project.reviewComment ?? "",
                      }
                    }
                    onDraftChange={(draft) =>
                      setRatingDrafts((drafts) => ({
                        ...drafts,
                        [project.id]: draft,
                      }))
                    }
                    onRate={() => handleRateProject(project)}
                  />
                ))}
              </div>
            ) : (
              <EmptyProjectBox
                icon={CheckCircle2}
                title="No completed projects"
                description="Projects accepted as finished will appear here."
              />
            )}
          </section>
        ) : null}

        {showAllProjectBuckets || activeProjectFilter === "requests" ? (
          <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-semibold">Request projects</h2>
                <p className="text-sm text-muted-foreground">
                  Professional requests waiting for your action.
                </p>
              </div>
              <Badge variant="secondary">{projectRequests.length} requests</Badge>
            </div>

            {projectRequests.length ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {projectRequests.map((request) => (
                  <ProjectRequestCard
                    key={request.id}
                    request={request}
                    negotiations={projectNegotiations.filter(
                      (negotiation) => negotiation.requestId === request.id,
                    )}
                    pendingAction={pendingAction}
                    isTimelineOpen={expandedTimelineId === request.id}
                    onToggleTimeline={() =>
                      setExpandedTimelineId(expandedTimelineId === request.id ? null : request.id)
                    }
                    onRequestStatus={handleRequestStatus}
                  />
                ))}
              </div>
            ) : (
              <EmptyProjectBox
                icon={Send}
                title="No project requests"
                description="New professional requests will appear here."
              />
            )}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}

function RunningDirectHireCard({
  request,
  pendingAction,
  onCancel,
}: {
  request: ClientHireRequestRecord;
  pendingAction: string | null;
  onCancel: (request: ClientHireRequestRecord) => void;
}) {
  const professionalName = request.professionalName || "Professional";

  const openMessage = () => {
    const search = new URLSearchParams({
      conversationId: `client-${request.clientId}-pro-${request.professionalId}`,
      toUserId: String(request.professionalId),
      name: professionalName,
      avatar: request.professionalAvatarUrl || "",
      job: request.title,
      firstMessage: `Hi ${professionalName}, let's discuss the running project: ${request.title}`,
    });

    window.location.href = `/messages?${search.toString()}`;
  };

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start gap-3">
        <img
          src={
            request.professionalAvatarUrl ||
            `https://i.pravatar.cc/100?u=running-direct-hire-${request.professionalId}`
          }
          alt={professionalName}
          className="h-11 w-11 rounded-lg object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{request.title}</h3>
            <Badge>Running</Badge>
            <Badge variant="outline">Direct hire</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Professional: {professionalName}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        <InfoPill
          icon={DollarSign}
          label="Budget"
          value={formatMoney(request.totalAmount ?? request.budgetMax ?? request.budgetMin ?? 0)}
        />
        <InfoPill
          icon={Briefcase}
          label="Work mode"
          value={formatEnum(request.workMode || "both")}
        />
        <InfoPill
          icon={CalendarDays}
          label="Accepted"
          value={request.updatedAt ? formatDateTime(request.updatedAt) : "Not set"}
        />
        <InfoPill icon={MapPin} label="Location" value={request.location || "Not set"} />
      </div>

      <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
        {request.description || "No work description added."}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {request.trackingId ? (
          <Button size="sm" asChild>
            <Link
              to="/project-track/$trackingId"
              params={{ trackingId: String(request.trackingId) }}
            >
              Track project
            </Link>
          </Button>
        ) : (
          <Button size="sm" disabled>
            Track project
          </Button>
        )}
        {request.clientProjectId ? (
          <Button size="sm" variant="outline" asChild>
            <Link to="/project/$projectId" params={{ projectId: String(request.clientProjectId) }}>
              View project
            </Link>
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled>
            View project
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={openMessage}>
          <MessageSquare className="h-4 w-4" />
          Message
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onCancel(request)}
          disabled={pendingAction === `cancel-direct-hire-${request.contractId}`}
        >
          <XCircle className="h-4 w-4" />
          {pendingAction === `cancel-direct-hire-${request.contractId}` ? "Cancelling" : "Cancel"}
        </Button>
      </div>
    </div>
  );
}

function TrackedProjectCard({
  project,
  pendingAction,
  ratingDraft,
  onDraftChange,
  onRate,
  onCancel,
}: {
  project: ClientTrackedProjectRecord;
  pendingAction: string | null;
  ratingDraft: { rating: number; comment: string };
  onDraftChange: (draft: { rating: number; comment: string }) => void;
  onRate: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start gap-3">
        <img
          src={
            project.professionalAvatarUrl ||
            `https://i.pravatar.cc/100?u=running-project-${project.professionalId}`
          }
          alt={project.professionalName}
          className="h-11 w-11 rounded-lg object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{project.projectTitle}</h3>
            <Badge variant={project.status === "COMPLETED" ? "default" : "secondary"}>
              {project.status === "COMPLETED" ? "Completed" : "Running"}
            </Badge>
            <Badge variant="outline">Tracking {formatEnum(project.status)}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Professional: {project.professionalName || "Professional"}
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        <InfoPill
          icon={DollarSign}
          label="Bid"
          value={project.bidAmount ? `$${project.bidAmount.toLocaleString()}` : "Not set"}
        />
        <InfoPill icon={Clock} label="Duration" value={project.duration || "Not set"} />
        <InfoPill icon={CalendarDays} label="Accepted" value={formatDateTime(project.acceptedAt)} />
        <InfoPill icon={Briefcase} label="Category" value={project.projectCategory} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" asChild>
          <Link to="/project-track/$trackingId" params={{ trackingId: String(project.id) }}>
            Track project
          </Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link to="/project-track/$trackingId" params={{ trackingId: String(project.id) }}>
            View project
          </Link>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const search = new URLSearchParams({
              conversationId: `client-${project.clientId}-pro-${project.professionalId}`,
              toUserId: String(project.professionalId),
              name: project.professionalName || "Professional",
              avatar: project.professionalAvatarUrl || "",
              job: project.projectTitle,
              projectId: String(project.id),
              firstMessage: `Hi ${project.professionalName || "Professional"}, let's discuss the project: ${project.projectTitle}`,
            });
            window.location.href = `/messages?${search.toString()}`;
          }}
        >
          <MessageSquare className="h-4 w-4" />
          Message
        </Button>
        {project.status === "ACTIVE" && onCancel ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
            disabled={pendingAction === `cancel-tracked-${project.id}`}
          >
            <XCircle className="h-4 w-4" />
            {pendingAction === `cancel-tracked-${project.id}` ? "Cancelling" : "Cancel"}
          </Button>
        ) : null}
      </div>
      {project.status === "COMPLETED" ? (
        <RateProfessionalBox
          project={project}
          draft={ratingDraft}
          isSaving={pendingAction === `rate-${project.id}`}
          onDraftChange={onDraftChange}
          onSave={onRate}
        />
      ) : null}
    </div>
  );
}

function DirectHireCard({
  request,
  pendingAction,
  onStartProject,
  onDeleteRejected,
}: {
  request: ClientHireRequestRecord;
  pendingAction: string | null;
  onStartProject: (request: ClientHireRequestRecord) => void;
  onDeleteRejected: (request: ClientHireRequestRecord) => void;
}) {
  const statusLabel =
    request.status === "accepted"
      ? "Accepted"
      : request.status === "rejected"
        ? "Rejected"
        : "Waiting";

  const openDirectHireMessage = () => {
    const professionalName = request.professionalName || "Professional";
    const search = new URLSearchParams({
      conversationId: `client-${request.clientId}-pro-${request.professionalId}`,
      toUserId: String(request.professionalId),
      name: professionalName,
      avatar: request.professionalAvatarUrl || "",
      job: request.title,
      firstMessage: `Hi ${professionalName}, I want to discuss the hire request for "${request.title}".`,
    });

    window.location.href = `/messages?${search.toString()}`;
  };

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start gap-3">
        <img
          src={
            request.professionalAvatarUrl ||
            `https://i.pravatar.cc/100?u=direct-hire-${request.professionalId}`
          }
          alt={request.professionalName || "Professional"}
          className="h-11 w-11 rounded-lg object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{request.title}</h3>
            <Badge
              variant={
                request.status === "accepted"
                  ? "default"
                  : request.status === "rejected"
                    ? "destructive"
                    : "outline"
              }
            >
              {statusLabel}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Professional: {request.professionalName || "Professional"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        <InfoPill
          icon={DollarSign}
          label="Budget"
          value={formatMoney(request.totalAmount ?? request.budgetMax ?? request.budgetMin ?? 0)}
        />
        <InfoPill
          icon={Briefcase}
          label="Work mode"
          value={formatEnum(request.workMode || "both")}
        />
        <InfoPill icon={CalendarDays} label="Sent" value={formatDateTime(request.createdAt)} />
        <InfoPill icon={MapPin} label="Location" value={request.location || "Not set"} />
      </div>

      <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
        {request.description || "No work description added."}
      </p>
      {request.status === "rejected" ? (
        <p className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Direct hire rejected. It will be removed after 1 minute.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {request.status === "accepted" ? (
          <Button
            size="sm"
            onClick={() => onStartProject(request)}
            disabled={pendingAction === `start-direct-hire-${request.contractId}`}
          >
            <Handshake className="h-4 w-4" />
            {pendingAction === `start-direct-hire-${request.contractId}`
              ? "Starting"
              : "Start project"}
          </Button>
        ) : null}
        <Button size="sm" variant="outline" onClick={openDirectHireMessage}>
          <MessageSquare className="h-4 w-4" />
          Message
        </Button>
        {request.status === "rejected" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDeleteRejected(request)}
            disabled={pendingAction === `delete-rejected-direct-hire-${request.contractId}`}
          >
            <XCircle className="h-4 w-4" />
            {pendingAction === `delete-rejected-direct-hire-${request.contractId}`
              ? "Deleting"
              : "Delete immediately"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ProjectRequestCard({
  request,
  negotiations,
  pendingAction,
  isTimelineOpen,
  onToggleTimeline,
  onRequestStatus,
}: {
  request: ClientProjectRequestRecord;
  negotiations: ProjectNegotiationRecord[];
  pendingAction: string | null;
  isTimelineOpen: boolean;
  onToggleTimeline: () => void;
  onRequestStatus: (requestId: number, status: ProjectRequestStatus) => void;
}) {
  const attachments = getRequestAttachments(request.attachmentsJson);
  const latestNegotiation = negotiations.at(-1) ?? null;

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start gap-3">
        <img
          src={
            request.professionalAvatarUrl ||
            `https://i.pravatar.cc/100?u=project-request-${request.professionalId}`
          }
          alt={request.professionalName}
          className="h-11 w-11 rounded-lg object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{request.professionalName || "Professional"}</h3>
            <Badge variant="outline">{formatEnum(request.status)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {request.professionalCategory || "Professional"} requested {request.projectTitle}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{request.projectCategory}</Badge>
          {request.trackingStatus ? (
            <Badge variant="outline">Tracking {formatEnum(request.trackingStatus)}</Badge>
          ) : null}
          {negotiations.length ? (
            <Badge variant="outline">
              {negotiations.length} negotiation offer{negotiations.length === 1 ? "" : "s"}
            </Badge>
          ) : null}
        </div>
        <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          {request.bidAmount ? (
            <InfoPill
              icon={DollarSign}
              label="Bid"
              value={`$${request.bidAmount.toLocaleString()}`}
            />
          ) : null}
          {request.duration ? (
            <InfoPill icon={Clock} label="Duration" value={request.duration} />
          ) : null}
          <InfoPill icon={Briefcase} label="Project" value={request.projectTitle} />
          <InfoPill icon={CalendarDays} label="Sent" value={formatDateTime(request.createdAt)} />
        </div>
      </div>

      <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{request.coverLetter}</p>
      {attachments.length ? (
        <div className="mt-3 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          <FileText className="mr-1 inline h-3 w-3" />
          {attachments.length} work sample{attachments.length === 1 ? "" : "s"} attached
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={isTimelineOpen ? "default" : "outline"}
          onClick={onToggleTimeline}
        >
          <Clock className="h-4 w-4" />
          {isTimelineOpen ? "Hide details" : latestNegotiation ? "Negotiation details" : "Timeline"}
        </Button>
        <Button size="sm" asChild>
          <Link
            to={request.trackingId ? "/project-track/$trackingId" : "/project/$projectId"}
            params={
              request.trackingId
                ? { trackingId: String(request.trackingId) }
                : { projectId: String(request.jobId) }
            }
          >
            View project
          </Link>
        </Button>
        {request.status === "PENDING" ? (
          <>
            <Button
              size="sm"
              onClick={() => onRequestStatus(request.id, "ACCEPTED")}
              disabled={pendingAction !== null}
            >
              <CheckCircle2 className="h-4 w-4" />
              {pendingAction === `${request.id}-ACCEPTED` ? "Accepting" : "Accept"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRequestStatus(request.id, "DECLINED")}
              disabled={pendingAction !== null}
            >
              <XCircle className="h-4 w-4" />
              {pendingAction === `${request.id}-DECLINED` ? "Rejecting" : "Reject"}
            </Button>
          </>
        ) : null}
        {request.status === "ACCEPTED" ? (
          <Button size="sm" variant="outline" asChild>
            <Link
              to="/project-track/$trackingId"
              params={{ trackingId: String(request.trackingId || request.jobId) }}
            >
              Track project
            </Link>
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const search = new URLSearchParams({
              conversationId: `client-${request.clientId}-pro-${request.professionalId}`,
              toUserId: String(request.professionalId),
              name: request.professionalName || "Professional",
              avatar: request.professionalAvatarUrl || "",
              job: request.projectTitle,
              projectId: String(request.jobId),
              firstMessage: `Hi ${request.professionalName || "Professional"}, let's discuss the project: ${request.projectTitle}`,
            });
            window.location.href = `/messages?${search.toString()}`;
          }}
        >
          <MessageSquare className="h-4 w-4" />
          Message
        </Button>
      </div>

      {isTimelineOpen ? (
        <ProjectRequestTimeline
          status={request.status}
          createdAt={request.createdAt}
          updatedAt={request.updatedAt}
          acceptedAt={request.acceptedAt}
          trackingId={request.trackingId}
          trackingStatus={request.trackingStatus}
          projectTitle={request.projectTitle}
          projectCategory={request.projectCategory}
          professionalName={request.professionalName || "Professional"}
          bidAmount={request.bidAmount}
          duration={request.duration}
          coverLetter={request.coverLetter}
          attachmentsJson={request.attachmentsJson}
          negotiations={negotiations}
        />
      ) : null}
    </div>
  );
}

function EmptyProjectBox({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="mt-5 rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
      <Icon className="mx-auto h-8 w-8 text-muted-foreground" />
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ProjectRequestTimeline({
  status,
  createdAt,
  updatedAt,
  acceptedAt,
  trackingId,
  trackingStatus,
  projectTitle,
  projectCategory,
  professionalName,
  bidAmount,
  duration,
  coverLetter,
  attachmentsJson,
  negotiations,
}: {
  status: ProjectRequestStatus;
  createdAt: string;
  updatedAt: string;
  acceptedAt: string | null;
  trackingId: number | null;
  trackingStatus: string | null;
  projectTitle: string;
  projectCategory: string;
  professionalName: string;
  bidAmount: number | null;
  duration: string | null;
  coverLetter: string;
  attachmentsJson: string | null;
  negotiations: ProjectNegotiationRecord[];
}) {
  const attachments = getRequestAttachments(attachmentsJson);
  const latestNegotiation = negotiations.at(-1) ?? null;
  const timelineItems = [
    {
      label: "Request sent",
      description: "Professional sent a project request.",
      time: formatDateTime(createdAt),
      state: "complete",
      icon: Send,
    },
    {
      label:
        status === "DECLINED"
          ? "Request rejected"
          : status === "ACCEPTED"
            ? "Request accepted"
            : "Waiting for response",
      description:
        status === "PENDING"
          ? "Review the bid, cover note, duration, and files before accepting."
          : status === "ACCEPTED"
            ? "Client accepted the request and project tracking started."
            : "Client rejected the request.",
      time:
        status === "PENDING"
          ? "Pending"
          : formatDateTime(status === "ACCEPTED" ? acceptedAt || updatedAt : updatedAt),
      state: status === "PENDING" ? "current" : status === "ACCEPTED" ? "complete" : "declined",
      icon: status === "DECLINED" ? XCircle : CheckCircle2,
    },
    {
      label: "Track project",
      description: trackingId
        ? "Project info, time, money, and next steps are available."
        : "Tracking appears after accepting the request.",
      time: trackingId ? `Tracking #${trackingId}` : "Not started",
      state: trackingId ? "complete" : "upcoming",
      icon: Clock,
    },
    {
      label: "Message updates",
      description: "Continue conversations and delivery updates in messages.",
      time: "Any time",
      state: trackingId ? "current" : "upcoming",
      icon: MessageSquare,
    },
  ] as const;

  return (
    <div className="mt-4 rounded-lg border border-border p-4">
      {!latestNegotiation ? (
        <>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <h4 className="font-medium">Project timeline</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Full request history and project details for {projectTitle}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={
                  status === "PENDING" ? "secondary" : status === "ACCEPTED" ? "default" : "outline"
                }
              >
                {formatEnum(status)}
              </Badge>
              {trackingStatus ? (
                <Badge variant="outline">Tracking {formatEnum(trackingStatus)}</Badge>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid gap-3 rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground sm:grid-cols-2">
            <InfoPill icon={Briefcase} label="Project" value={projectTitle} />
            <InfoPill icon={FileText} label="Category" value={projectCategory} />
            {bidAmount ? (
              <InfoPill icon={DollarSign} label="Bid" value={`$${bidAmount.toLocaleString()}`} />
            ) : null}
            {duration ? <InfoPill icon={Clock} label="Duration" value={duration} /> : null}
            <InfoPill icon={MessageSquare} label="Professional" value={professionalName} />
            <InfoPill icon={CalendarDays} label="Last update" value={formatDateTime(updatedAt)} />
          </div>
        </>
      ) : null}

      {latestNegotiation ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
            <div>
              <h5 className="text-sm font-semibold">Negotiation details</h5>
              <p className="mt-1 text-sm text-muted-foreground">
                {professionalName} revised the offer on{" "}
                {formatDateTime(latestNegotiation.createdAt)}.
              </p>
            </div>
            <Badge variant="secondary">Latest offer</Badge>
          </div>
          <div className="mt-3">
            <OfferCompareBox
              title="Professional offer"
              bidAmount={latestNegotiation.bidAmount}
              duration={latestNegotiation.duration}
              message={latestNegotiation.message}
              highlight
            />
          </div>
          {negotiations.length > 1 ? (
            <div className="mt-3 rounded-lg border border-border bg-card/70 p-3">
              <h6 className="text-sm font-medium">Offer history</h6>
              <div className="mt-2 space-y-2">
                {negotiations.map((negotiation) => (
                  <div key={negotiation.id} className="rounded-md bg-muted/40 p-2 text-sm">
                    <div className="flex flex-wrap justify-between gap-2 font-medium">
                      <span>{formatOfferSummary(negotiation)}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {formatDateTime(negotiation.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">
                      {negotiation.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {!latestNegotiation ? (
        <>
          <ol className="mt-4 space-y-4">
            {timelineItems.map((item, index) => (
              <li key={item.label} className="relative flex gap-3">
                {index < timelineItems.length - 1 ? (
                  <span className="absolute left-4 top-8 h-[calc(100%+0.25rem)] w-px bg-border" />
                ) : null}
                <span
                  className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border ${
                    item.state === "complete"
                      ? "border-primary bg-primary text-primary-foreground"
                      : item.state === "declined"
                        ? "border-destructive bg-destructive text-destructive-foreground"
                        : item.state === "current"
                          ? "border-primary bg-card text-primary"
                          : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{item.label}</p>
                    <span className="text-xs text-muted-foreground">{item.time}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-4 rounded-lg border border-border p-3">
            <h5 className="text-sm font-medium">Request note</h5>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
              {coverLetter}
            </p>
          </div>
        </>
      ) : null}

      {attachments.length ? (
        <div className="mt-3 rounded-lg border border-border p-3">
          <h5 className="text-sm font-medium">Attached files</h5>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.fileName}
                className="flex min-w-0 items-center gap-2 rounded-md bg-muted/40 p-2 text-sm text-muted-foreground"
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span className="truncate">{attachment.fileName}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OfferCompareBox({
  title,
  bidAmount,
  priceLabel,
  duration,
  message,
  highlight = false,
}: {
  title: string;
  bidAmount: number | null;
  priceLabel?: string | null;
  duration: string | null;
  message: string | null;
  highlight?: boolean;
}) {
  const hasBid = bidAmount != null && bidAmount > 0;
  const hasPriceLabel = Boolean(priceLabel?.trim() && priceLabel !== "Not set");
  const hasDuration = Boolean(duration?.trim());
  const hasMessage = Boolean(message?.trim());

  return (
    <div
      className={`rounded-lg border p-3 ${highlight ? "border-primary/30 bg-card" : "border-border bg-muted/30"}`}
    >
      <p className="text-sm font-medium">{title}</p>
      {hasBid || hasPriceLabel || hasDuration ? (
        <div className="mt-2 grid gap-2 text-sm text-muted-foreground">
          {hasBid || hasPriceLabel ? (
            <InfoPill
              icon={DollarSign}
              label="Price"
              value={hasBid ? formatMoney(bidAmount) : (priceLabel ?? "")}
            />
          ) : null}
          {hasDuration ? <InfoPill icon={Clock} label="Duration" value={duration ?? ""} /> : null}
        </div>
      ) : null}
      {hasMessage ? (
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function RateProfessionalBox({
  project,
  draft,
  isSaving,
  onDraftChange,
  onSave,
}: {
  project: ClientTrackedProjectRecord;
  draft: { rating: number; comment: string };
  isSaving: boolean;
  onDraftChange: (draft: { rating: number; comment: string }) => void;
  onSave: () => void;
}) {
  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h4 className="font-semibold">Rate professional</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.reviewRating
              ? `You rated ${project.professionalName || "this professional"} ${project.reviewRating}/5.`
              : project.reviewRequestedAt
                ? `${project.professionalName || "This professional"} requested a review for this completed project.`
                : `Share how ${project.professionalName || "this professional"} worked on this project.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {project.reviewRequestedAt && !project.reviewRating ? (
            <Badge variant="secondary">Review requested</Badge>
          ) : null}
          {project.reviewCreatedAt ? (
            <Badge variant="outline">Rated {formatDate(project.reviewCreatedAt)}</Badge>
          ) : null}
        </div>
      </div>
      {project.reviewRequestedAt && !project.reviewRating ? (
        <p className="mt-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
          Requested {formatDate(project.reviewRequestedAt)}
          {project.reviewRequestNote ? `: ${project.reviewRequestNote}` : "."}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onDraftChange({ ...draft, rating: value })}
            className={`grid h-9 w-9 place-items-center rounded-lg border transition-colors ${
              value <= draft.rating
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary"
            }`}
            aria-label={`Rate ${value} star${value === 1 ? "" : "s"}`}
          >
            <Star className="h-4 w-4" />
          </button>
        ))}
      </div>
      <textarea
        value={draft.comment}
        onChange={(event) => onDraftChange({ ...draft, comment: event.target.value })}
        placeholder="Write a short review"
        className="mt-3 min-h-20 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={onSave} disabled={isSaving}>
          <Star className="h-4 w-4" />
          {isSaving ? "Saving" : project.reviewRating ? "Update rating" : "Submit rating"}
        </Button>
      </div>
    </div>
  );
}

function InfoPill({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 truncate">
        <span className="text-foreground">{label}:</span> {value}
      </span>
    </span>
  );
}

function ProjectStat({
  label,
  value,
  icon: Icon,
  isActive = false,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={`rounded-xl border p-5 text-left shadow-soft transition-colors hover:border-primary/50 hover:bg-primary/5 ${
        isActive ? "border-primary bg-primary/10" : "border-border bg-card"
      }`}
    >
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-4 text-2xl font-semibold">{value}</p>
      <p className="text-sm text-muted-foreground">{label} projects</p>
    </button>
  );
}

function getProjectBucketLabel(filter: ProjectBucketFilter) {
  switch (filter) {
    case "running":
      return "Running projects";
    case "completed":
      return "Completed projects";
    case "requests":
      return "Request projects";
    case "direct-hires":
      return "Direct hire projects";
  }
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatWorkMode(value: string) {
  return value === "ON_SITE" ? "On-site" : formatEnum(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatBudget(min: number | null, max: number | null, timingType = "FIXED") {
  const suffix = getBudgetSuffix(timingType);

  if (min && max) {
    return `$${min.toLocaleString()} - $${max.toLocaleString()}${suffix}`;
  }

  if (max) {
    return `Up to $${max.toLocaleString()}${suffix}`;
  }

  if (min) {
    return `From $${min.toLocaleString()}${suffix}`;
  }

  return "Not set";
}

function getBudgetSuffix(timingType: string | null | undefined) {
  if (timingType === "HOURLY") {
    return " / hour";
  }

  if (timingType === "WEEKLY") {
    return " / week";
  }

  return "";
}

function formatMoney(value: number | null) {
  if (!value) {
    return "Not set";
  }

  return `$${value.toLocaleString()}`;
}

function formatOfferSummary(negotiation: ProjectNegotiationRecord) {
  const parts = [
    negotiation.bidAmount ? formatMoney(negotiation.bidAmount) : null,
    negotiation.duration?.trim() || null,
  ].filter(Boolean);

  return parts.length ? parts.join(" / ") : "Offer updated";
}

const CLOSED_PROJECT_REMOVAL_MS = 60 * 60 * 1000;

function getClosedProjectRemovalMs(project: ClientJobRecord, now: number) {
  if (project.status !== "CLOSED") {
    return null;
  }

  const closedAt = new Date(project.updatedAt).getTime();

  if (Number.isNaN(closedAt)) {
    return CLOSED_PROJECT_REMOVAL_MS;
  }

  return Math.max(0, closedAt + CLOSED_PROJECT_REMOVAL_MS - now);
}

function isClosedProjectExpired(project: ClientJobRecord, now: number) {
  const removeInMs = getClosedProjectRemovalMs(project, now);

  return removeInMs != null && removeInMs <= 0;
}

function isExpiredRejectedHireRequest(request: ClientHireRequestRecord, now: number) {
  if (request.status !== "rejected") {
    return false;
  }

  const rejectedAt = new Date(request.updatedAt || request.createdAt).getTime();

  if (Number.isNaN(rejectedAt)) {
    return false;
  }

  return now - rejectedAt >= 60 * 1000;
}

function formatCountdown(value: number) {
  const totalSeconds = Math.max(0, Math.ceil(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function getRequestAttachments(value: string | null) {
  if (!value) {
    return [] as Array<{ fileName: string }>;
  }

  try {
    const parsed = JSON.parse(value) as Array<{ fileName?: string }>;
    return parsed.filter((attachment) => attachment.fileName);
  } catch {
    return [];
  }
}

async function emitProjectNotification(payload: {
  trackingId: number;
  actorId: number;
  recipientId: number;
  title: string;
  description: string;
  href: string;
}) {
  try {
    const socket = io(getSocketUrl());
    socket.emit("project:activity", payload);
    window.setTimeout(() => socket.disconnect(), 800);
  } catch {
    // Realtime alerts are best-effort; email and the notification list still update.
  }
}

function getSocketUrl() {
  return (
    import.meta.env.VITE_SOCKET_URL ||
    `${window.location.protocol}//${window.location.hostname}:4001`
  );
}
