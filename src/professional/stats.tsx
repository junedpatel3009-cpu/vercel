import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, Link, redirect, useLoaderData, useRouter } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import {
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock,
  Handshake,
  Heart,
  MapPin,
  MessageSquare,
  Send,
  Star,
  Wallet,
  XCircle,
} from "lucide-react";
import { io } from "socket.io-client";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUser } from "@/lib/current-user.server";
import { getFavoriteJobsByUserId } from "@/lib/job-db.server";
import {
  cancelHireProject,
  createProfessionalHireNegotiation,
  deleteRejectedHireRequest,
  getProfessionalHireNegotiations,
  getProfessionalHireRequests,
  updateProfessionalHireContractStatus,
  type DirectHireNegotiationRecord,
  type HireContractStatus,
  type ProfessionalHireRequestRecord,
} from "@/lib/hire-db.server";
import {
  cancelProjectTracking,
  createProfessionalNegotiation,
  getProfessionalProjectRequests,
  getProfessionalTrackedProjects,
  getUserProjectTransactions,
  getProjectNegotiationsForProfessional,
  respondToProjectReview,
  type ProjectNegotiationRecord,
  type ProfessionalTrackedProjectRecord,
} from "@/lib/project-request-db.server";
import { formatApproximateLocation } from "@/lib/location-privacy";
import { getProfessionalProfileByUserId } from "@/lib/user-db.server";

type ProfessionalStatsFilter =
  | "running"
  | "completed"
  | "project-requests"
  | "hire-requests"
  | "ratings"
  | "earnings";

export const getProfessionalStatsData = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = getCurrentUser();

  if (!viewer) {
    return null;
  }

  if (viewer.role !== "PROFESSIONAL") {
    return {
      viewer,
      profile: null,
      projectRequests: [],
      favoriteJobs: [],
      projectNegotiations: [],
      hireNegotiations: [],
      hireRequests: [],
      trackedProjects: [],
      transactions: [],
    };
  }

  return {
    viewer,
    profile: getProfessionalProfileByUserId(viewer.id),
    projectRequests: getProfessionalProjectRequests(viewer.id),
    favoriteJobs: getFavoriteJobsByUserId(viewer.id),
    projectNegotiations: getProjectNegotiationsForProfessional(viewer.id),
    hireNegotiations: getProfessionalHireNegotiations(viewer.id),
    hireRequests: getProfessionalHireRequests(viewer.id),
    trackedProjects: getProfessionalTrackedProjects(viewer.id),
    transactions: getUserProjectTransactions(viewer.id),
  };
});

const sendNegotiationOffer = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { requestId: number; bidAmount: number | null; duration: string; message: string }) =>
      input,
  )
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "PROFESSIONAL") {
      throw new Error("Only professionals can negotiate project requests.");
    }

    return createProfessionalNegotiation(viewer.id, data);
  });

const updateHireRequestStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { contractId: string; status: HireContractStatus }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "PROFESSIONAL") {
      throw new Error("Only professionals can update hire requests.");
    }

    return updateProfessionalHireContractStatus(viewer.id, data.contractId, data.status);
  });

const sendHireNegotiationOffer = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { contractId: string; bidAmount: number | null; duration: string; message: string }) =>
      input,
  )
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "PROFESSIONAL") {
      throw new Error("Only professionals can negotiate direct hire requests.");
    }

    return createProfessionalHireNegotiation(viewer.id, data);
  });

const cancelProfessionalTrackedProject = createServerFn({ method: "POST" })
  .inputValidator((input: { trackingId: number }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "PROFESSIONAL") {
      throw new Error("Only professionals can cancel projects from this page.");
    }

    return cancelProjectTracking(viewer.id, data.trackingId);
  });

const cancelProfessionalDirectHireProject = createServerFn({ method: "POST" })
  .inputValidator((input: { contractId: string }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "PROFESSIONAL") {
      throw new Error("Only professionals can cancel direct hire projects from this page.");
    }

    return cancelHireProject(viewer.id, data.contractId);
  });

const deleteProfessionalRejectedDirectHire = createServerFn({ method: "POST" })
  .inputValidator((input: { contractId: string }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "PROFESSIONAL") {
      throw new Error(
        "Only professionals can delete rejected direct hire requests from this page.",
      );
    }

    return deleteRejectedHireRequest(viewer.id, data.contractId);
  });

const saveReviewResponse = createServerFn({ method: "POST" })
  .inputValidator((input: { trackingId: number; response: string }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "PROFESSIONAL") {
      throw new Error("Only professionals can respond to client reviews.");
    }

    return respondToProjectReview(viewer.id, data);
  });

export const Route = createFileRoute("/professional-stats")({
  beforeLoad: async ({ location }) => {
    const data = await getProfessionalStatsData();

    if (!data) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }

    if (data.viewer.role !== "PROFESSIONAL") {
      throw redirect({ to: "/dashboard" });
    }
  },
  loader: () => getProfessionalStatsData(),
  head: () => ({ meta: [{ title: "My stats - Servio" }] }),
  component: ProfessionalStats,
});

function ProfessionalStats() {
  const data = useLoaderData({ from: "/professional-stats" });
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [openNegotiationId, setOpenNegotiationId] = useState<number | null>(null);
  const [pendingNegotiationId, setPendingNegotiationId] = useState<number | null>(null);
  const [openHireNegotiationId, setOpenHireNegotiationId] = useState<string | null>(null);
  const [pendingHireNegotiationId, setPendingHireNegotiationId] = useState<string | null>(null);
  const [pendingHireActionId, setPendingHireActionId] = useState<string | null>(null);
  const [pendingCancelActionId, setPendingCancelActionId] = useState<string | null>(null);
  const [hireActionError, setHireActionError] = useState<string | null>(null);
  const [hireActionMessage, setHireActionMessage] = useState<string | null>(null);
  const [negotiationError, setNegotiationError] = useState<string | null>(null);
  const [statDeltas, setStatDeltas] = useState<Record<string, number>>({});
  const [activeStatsFilter, setActiveStatsFilter] = useState<ProfessionalStatsFilter | null>(null);
  const [reviewResponseDrafts, setReviewResponseDrafts] = useState<Record<number, string>>({});
  const [pendingReviewResponseId, setPendingReviewResponseId] = useState<number | null>(null);
  const [reviewResponseErrorId, setReviewResponseErrorId] = useState<number | null>(null);
  const [reviewResponseError, setReviewResponseError] = useState<string | null>(null);
  const [negotiationDrafts, setNegotiationDrafts] = useState<
    Record<number, { bidAmount: string; duration: string; message: string }>
  >({});
  const [hireNegotiationDrafts, setHireNegotiationDrafts] = useState<
    Record<string, { bidAmount: string; duration: string; message: string }>
  >({});

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!hireActionMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setHireActionMessage(null), 5000);

    return () => window.clearTimeout(timeout);
  }, [hireActionMessage]);

  if (!data) {
    return null;
  }

  const { viewer, profile, projectRequests, favoriteJobs } = data;
  const projectNegotiations = (data.projectNegotiations ?? []) as ProjectNegotiationRecord[];
  const hireNegotiations = (data.hireNegotiations ?? []) as DirectHireNegotiationRecord[];
  const hireRequests = (data.hireRequests ?? []) as ProfessionalHireRequestRecord[];
  const trackedProjects = (data.trackedProjects ?? []) as ProfessionalTrackedProjectRecord[];
  const transactions = data.transactions ?? [];
  const visibleProjectRequests = projectRequests.filter((project) =>
    isVisibleProjectRequest(project),
  );
  const visibleHireRequests = hireRequests.filter(
    (request) =>
      request.status !== "started" &&
      request.status !== "cancelled" &&
      !isExpiredRejectedHireRequest(request, now),
  );
  const runningTrackedProjects = trackedProjects.filter((project) => project.status === "ACTIVE");
  const completedTrackedProjects = trackedProjects.filter(
    (project) => project.status === "COMPLETED",
  );
  const startedDirectHires = hireRequests.filter(
    (request) => request.status === "started" && !request.trackingId,
  );
  const completedEarnings = transactions
    .filter(
      (transaction) =>
        transaction.status === "COMPLETED" && transaction.professionalId === viewer.id,
    )
    .reduce((total, transaction) => total + transaction.amount, 0);
  const displayName = profile?.fullName || `${viewer.firstName} ${viewer.lastName}`.trim();
  const reviewedCompletedProjects = completedTrackedProjects.filter(
    (project) => project.reviewRating,
  );
  const averageRating =
    profile?.reviewCount && profile.reviewCount > 0
      ? Number(profile.averageRating || 0)
      : reviewedCompletedProjects.length
        ? reviewedCompletedProjects.reduce(
            (total, review) => total + Number(review.reviewRating || 0),
            0,
          ) / reviewedCompletedProjects.length
        : 0;
  const ratingLabel = reviewedCompletedProjects.length ? averageRating.toFixed(1) : "No reviews";
  const statCounts = {
    projects: runningTrackedProjects.length + startedDirectHires.length,
    requests: visibleProjectRequests.length,
    hires: visibleHireRequests.length,
    completed: completedTrackedProjects.length,
    ratings: reviewedCompletedProjects.length,
    earnings: Math.round(completedEarnings),
  };
  const showAllStatsSections = activeStatsFilter === null;
  const activeStatsFilterLabel = activeStatsFilter
    ? getProfessionalStatsFilterLabel(activeStatsFilter)
    : null;

  function toggleStatsFilter(filter: ProfessionalStatsFilter) {
    setActiveStatsFilter((current) => (current === filter ? null : filter));
  }

  useEffect(() => {
    const storageKey = `professional-stat-counts:${viewer.id}`;
    const previousCounts = readStoredStatCounts(storageKey);
    const nextDeltas = Object.fromEntries(
      Object.entries(statCounts)
        .map(([key, value]) => [key, value - Number(previousCounts[key] || 0)])
        .filter(([, value]) => Number(value) > 0),
    ) as Record<string, number>;

    setStatDeltas(nextDeltas);
    window.localStorage.setItem(storageKey, JSON.stringify(statCounts));
  }, [
    viewer.id,
    statCounts.projects,
    statCounts.requests,
    statCounts.hires,
    statCounts.completed,
    statCounts.ratings,
    statCounts.earnings,
  ]);

  async function handleSendNegotiation(project: (typeof projectRequests)[number]) {
    const draft = negotiationDrafts[project.id] ?? {
      bidAmount: project.bidAmount ? String(project.bidAmount) : "",
      duration: getDurationWeeksValue(project.duration, project.deadline),
      message: project.coverLetter || "",
    };
    const bidAmount = Number(draft.bidAmount);

    setPendingNegotiationId(project.id);
    setNegotiationError(null);

    try {
      await sendNegotiationOffer({
        data: {
          requestId: project.id,
          bidAmount: Number.isFinite(bidAmount) && bidAmount > 0 ? bidAmount : null,
          duration: formatWeeksDuration(draft.duration),
          message: draft.message,
        },
      });
      await emitProjectNotification({
        trackingId: project.trackingId ?? -1,
        actorId: viewer.id,
        recipientId: project.clientId,
        title: "Project negotiation offer",
        description: `${displayName} sent a revised offer for ${project.projectTitle}: ${formatMoney(Number.isFinite(bidAmount) && bidAmount > 0 ? bidAmount : 0)}, ${formatWeeksDuration(draft.duration)}. ${draft.message}`,
        href: "/projects",
      });
      toast.success("Negotiation offer sent.");
      setOpenNegotiationId(null);
      await router.invalidate();
    } catch (error) {
      setNegotiationError(
        error instanceof Error ? error.message : "Could not send negotiation offer.",
      );
    } finally {
      setPendingNegotiationId(null);
    }
  }

  async function handleHireStatus(contractId: string, status: HireContractStatus) {
    setPendingHireActionId(contractId);
    setHireActionError(null);

    try {
      await updateHireRequestStatus({ data: { contractId, status } });
      if (status === "rejected") {
        setHireActionMessage("Hire request rejected. It will be removed after 1 minute.");
      }
      await router.invalidate();
    } catch (error) {
      setHireActionError(error instanceof Error ? error.message : "Could not update hire request.");
    } finally {
      setPendingHireActionId(null);
    }
  }

  async function handleSendHireNegotiation(request: ProfessionalHireRequestRecord) {
    const draft = hireNegotiationDrafts[request.contractId] ?? {
      bidAmount:
        request.totalAmount || request.budgetMax || request.budgetMin
          ? String(request.totalAmount ?? request.budgetMax ?? request.budgetMin)
          : "",
      duration: getDurationWeeksValue(null, request.deadline),
      message: request.description || "",
    };
    const bidAmount = Number(draft.bidAmount);

    setPendingHireNegotiationId(request.contractId);
    setHireActionError(null);

    try {
      await sendHireNegotiationOffer({
        data: {
          contractId: request.contractId,
          bidAmount: Number.isFinite(bidAmount) && bidAmount > 0 ? bidAmount : null,
          duration: formatWeeksDuration(draft.duration),
          message: draft.message,
        },
      });
      await emitProjectNotification({
        trackingId: -1,
        actorId: viewer.id,
        recipientId: Number(request.clientId),
        title: "Direct hire negotiation offer",
        description: `${displayName} sent a revised offer for ${request.title}.`,
        href: "/projects",
      });
      toast.success("Direct hire negotiation offer sent.");
      setOpenHireNegotiationId(null);
      await router.invalidate();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not send direct hire negotiation offer.";
      setHireActionError(message);
      toast.error(message);
    } finally {
      setPendingHireNegotiationId(null);
    }
  }

  async function handleCancelTrackedProject(trackingId: number) {
    const actionKey = `tracked-${trackingId}`;
    setPendingCancelActionId(actionKey);
    setHireActionError(null);

    try {
      await cancelProfessionalTrackedProject({ data: { trackingId } });
      await router.invalidate();
    } catch (error) {
      setHireActionError(error instanceof Error ? error.message : "Could not cancel project.");
    } finally {
      setPendingCancelActionId(null);
    }
  }

  async function handleCancelDirectHire(contractId: string) {
    const actionKey = `hire-${contractId}`;
    setPendingCancelActionId(actionKey);
    setHireActionError(null);

    try {
      await cancelProfessionalDirectHireProject({ data: { contractId } });
      await router.invalidate();
    } catch (error) {
      setHireActionError(
        error instanceof Error ? error.message : "Could not cancel direct hire project.",
      );
    } finally {
      setPendingCancelActionId(null);
    }
  }

  async function handleDeleteRejectedDirectHire(contractId: string) {
    const actionKey = `delete-hire-${contractId}`;
    setPendingCancelActionId(actionKey);
    setHireActionError(null);

    try {
      await deleteProfessionalRejectedDirectHire({ data: { contractId } });
      await router.invalidate();
    } catch (error) {
      setHireActionError(
        error instanceof Error ? error.message : "Could not delete rejected direct hire request.",
      );
    } finally {
      setPendingCancelActionId(null);
    }
  }

  async function handleSaveReviewResponse(project: ProfessionalTrackedProjectRecord) {
    const response = (reviewResponseDrafts[project.id] ?? project.reviewResponse ?? "").trim();

    if (!response) {
      setReviewResponseErrorId(project.id);
      setReviewResponseError("Write a response before saving.");
      toast.error("Write a response before saving.");
      return;
    }

    setPendingReviewResponseId(project.id);
    setReviewResponseErrorId(null);
    setReviewResponseError(null);

    try {
      await saveReviewResponse({ data: { trackingId: project.id, response } });
      toast.success("Review response saved.");
      setReviewResponseDrafts((current) => {
        const next = { ...current };
        delete next[project.id];
        return next;
      });
      await router.invalidate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save review response.";
      setReviewResponseErrorId(project.id);
      setReviewResponseError(message);
      toast.error(message);
    } finally {
      setPendingReviewResponseId(null);
    }
  }

  function renderReviewResponseEditor(project: ProfessionalTrackedProjectRecord) {
    const draft = reviewResponseDrafts[project.id] ?? project.reviewResponse ?? "";

    return (
      <div className="mt-3 rounded-lg border border-primary/20 bg-background p-3">
        {project.reviewResponse ? (
          <div className="mb-3 text-sm">
            <p className="font-medium">Your response</p>
            <p className="mt-1 text-muted-foreground">{project.reviewResponse}</p>
          </div>
        ) : null}
        <Textarea
          value={draft}
          onChange={(event) => {
            setReviewResponseDrafts((current) => ({
              ...current,
              [project.id]: event.target.value,
            }));
            setReviewResponseErrorId(null);
            setReviewResponseError(null);
          }}
          maxLength={1000}
          rows={3}
          placeholder="Respond to this review"
        />
        {reviewResponseError && reviewResponseErrorId === project.id ? (
          <p className="mt-2 text-sm text-destructive">{reviewResponseError}</p>
        ) : null}
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={() => handleSaveReviewResponse(project)}
            disabled={pendingReviewResponseId === project.id}
          >
            <MessageSquare className="h-4 w-4" />
            {pendingReviewResponseId === project.id
              ? "Saving"
              : project.reviewResponse
                ? "Update response"
                : "Respond to review"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      userName={displayName}
      userRole="Professional"
      userAvatarUrl={profile?.avatarUrl || viewer.avatarUrl}
    >
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My stats</h1>
          <p className="text-sm text-muted-foreground">
            Project and earning details from accepted client requests.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/professional-profile">Profile</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatBox
          icon={Briefcase}
          label="Projects"
          value={String(statCounts.projects)}
          sub="Running now"
          tint="text-primary bg-primary/10"
          delta={statDeltas.projects}
          isActive={activeStatsFilter === "running"}
          onClick={() => toggleStatsFilter("running")}
        />
        <StatBox
          icon={Send}
          label="Project requests"
          value={String(statCounts.requests)}
          sub="Sent to clients"
          tint="text-accent bg-accent/15"
          delta={statDeltas.requests}
          isActive={activeStatsFilter === "project-requests"}
          onClick={() => toggleStatsFilter("project-requests")}
        />
        <StatBox
          icon={Handshake}
          label="Hire requests"
          value={String(statCounts.hires)}
          sub="Direct client requests"
          tint="text-warning bg-warning/15"
          delta={statDeltas.hires}
          isActive={activeStatsFilter === "hire-requests"}
          onClick={() => toggleStatsFilter("hire-requests")}
        />
        <StatBox
          icon={CheckCircle2}
          label="Completed"
          value={String(statCounts.completed)}
          sub="Finished projects"
          tint="text-success bg-success/15"
          delta={statDeltas.completed}
          isActive={activeStatsFilter === "completed"}
          onClick={() => toggleStatsFilter("completed")}
        />
        <StatBox
          icon={Star}
          label="Ratings & Reviews"
          value={ratingLabel}
          sub={`${reviewedCompletedProjects.length} client review${reviewedCompletedProjects.length === 1 ? "" : "s"}`}
          tint="text-warning bg-warning/15"
          delta={statDeltas.ratings}
          isActive={activeStatsFilter === "ratings"}
          onClick={() => toggleStatsFilter("ratings")}
        />
        <StatBox
          icon={Wallet}
          label="Earnings"
          value={formatMoney(completedEarnings)}
          sub="Open earnings dashboard"
          tint="text-success bg-success/15"
          delta={statDeltas.earnings}
          isActive={activeStatsFilter === "earnings"}
          onClick={() => toggleStatsFilter("earnings")}
        />
      </div>

      {activeStatsFilterLabel ? (
        <div className="mt-6 flex flex-col justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center">
          <p className="text-sm font-medium">
            Showing only {activeStatsFilterLabel.toLowerCase()}.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setActiveStatsFilter(null)}
          >
            Show all projects
          </Button>
        </div>
      ) : null}

      {showAllStatsSections || activeStatsFilter === "completed" ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-soft">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold">Completed projects</h2>
              <p className="text-sm text-muted-foreground">
                Finished projects and project details.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{completedTrackedProjects.length} completed</Badge>
            </div>
          </div>

          {completedTrackedProjects.length ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {completedTrackedProjects.map((project) => (
                <div
                  key={`completed-${project.id}`}
                  className="rounded-lg border border-border p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{project.projectCategory}</Badge>
                        <Badge>Completed</Badge>
                        {project.reviewRating ? (
                          <Badge variant="outline">{project.reviewRating}/5 review</Badge>
                        ) : project.reviewRequestedAt ? (
                          <Badge variant="outline">Review requested</Badge>
                        ) : (
                          <Badge variant="outline">No review yet</Badge>
                        )}
                      </div>
                      <h3 className="mt-3 line-clamp-2 font-semibold">{project.projectTitle}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Client: {project.clientName || `Client ${project.clientId}`}
                      </p>
                    </div>
                    <img
                      src={
                        project.clientAvatarUrl ||
                        `https://i.pravatar.cc/100?u=completed-client-${project.clientId}`
                      }
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    <span>Price: {formatMoney(project.bidAmount ?? 0)}</span>
                    <span>Duration: {project.duration || "Not set"}</span>
                    <span>
                      Accepted {project.acceptedAt ? formatDate(project.acceptedAt) : "Not set"}
                    </span>
                    <span>
                      {project.deadline
                        ? `Deadline ${formatDate(project.deadline)}`
                        : "Deadline not set"}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link
                        to="/project-track/$trackingId"
                        params={{ trackingId: String(project.id) }}
                      >
                        View project
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/professional-messages">
                        <MessageSquare className="h-4 w-4" />
                        Message client
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-muted-foreground" />
              <h3 className="mt-3 font-semibold">No completed projects yet</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Completed tracked projects will appear here with review status.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {activeStatsFilter === "ratings" ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-soft">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold">Ratings & Client Reviews</h2>
              <p className="text-sm text-muted-foreground">
                Completed projects where clients left a review.
              </p>
            </div>
            <Badge variant="secondary">
              {reviewedCompletedProjects.length} client review
              {reviewedCompletedProjects.length === 1 ? "" : "s"}
            </Badge>
          </div>

          {reviewedCompletedProjects.length ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {reviewedCompletedProjects.map((project) => (
                <div key={`rating-${project.id}`} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{project.projectCategory}</Badge>
                        <RatingStars rating={Number(project.reviewRating || 0)} />
                        <Badge variant="outline">{project.reviewRating}/5</Badge>
                      </div>
                      <h3 className="mt-3 line-clamp-2 font-semibold">{project.projectTitle}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Client: {project.clientName || `Client ${project.clientId}`}
                      </p>
                    </div>
                    <img
                      src={
                        project.clientAvatarUrl ||
                        `https://i.pravatar.cc/100?u=rating-client-${project.clientId}`
                      }
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                  </div>
                  <p className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                    {project.reviewComment || "Client left a rating without a written review."}
                  </p>
                  {renderReviewResponseEditor(project)}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link
                        to="/project-track/$trackingId"
                        params={{ trackingId: String(project.id) }}
                      >
                        View project
                      </Link>
                    </Button>
                    {project.reviewCreatedAt ? (
                      <Badge variant="outline">Rated {formatDate(project.reviewCreatedAt)}</Badge>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
              <Star className="mx-auto h-8 w-8 text-muted-foreground" />
              <h3 className="mt-3 font-semibold">No ratings yet</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Client reviews for completed projects will appear here.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {activeStatsFilter === "earnings" ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-soft">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold">Earnings</h2>
              <p className="text-sm text-muted-foreground">
                Completed project payments from milestones and final approvals.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>{formatMoney(completedEarnings)} earned</Badge>
              <Button size="sm" variant="outline" asChild>
                <Link to="/earnings">Open earnings dashboard</Link>
              </Button>
            </div>
          </div>

          {transactions.length ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {transactions.map((transaction) => (
                <div
                  key={`earning-${transaction.id}`}
                  className="rounded-lg border border-border p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">
                          {transaction.projectCategory || "Project"}
                        </Badge>
                        <Badge variant="outline">{formatEnum(transaction.type)}</Badge>
                      </div>
                      <h3 className="mt-3 line-clamp-2 font-semibold">
                        {transaction.projectTitle ||
                          transaction.description ||
                          `Project #${transaction.trackingId}`}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {transaction.description}
                      </p>
                    </div>
                    <p className="shrink-0 text-lg font-semibold">
                      {formatMoney(transaction.amount)}
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                    <span>{formatDate(transaction.createdAt)}</span>
                    <Button size="sm" variant="outline" asChild>
                      <Link
                        to="/project-track/$trackingId"
                        params={{ trackingId: String(transaction.trackingId) }}
                      >
                        View project
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
              <Wallet className="mx-auto h-8 w-8 text-muted-foreground" />
              <h3 className="mt-3 font-semibold">No earnings yet</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Completed milestone and final payments will appear here.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {showAllStatsSections || activeStatsFilter === "running" ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-soft">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold">Running projects</h2>
              <p className="text-sm text-muted-foreground">
                Active tracked jobs and accepted direct hires.
              </p>
            </div>
            <Badge>{runningTrackedProjects.length + startedDirectHires.length} running</Badge>
          </div>

          {runningTrackedProjects.length || startedDirectHires.length ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {runningTrackedProjects.map((project) => (
                <div key={`tracked-${project.id}`} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{project.projectCategory}</Badge>
                        <Badge>Running</Badge>
                      </div>
                      <h3 className="mt-3 line-clamp-2 font-semibold">{project.projectTitle}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Client: {project.clientName || `Client ${project.clientId}`}
                      </p>
                    </div>
                    <img
                      src={
                        project.clientAvatarUrl ||
                        `https://i.pravatar.cc/100?u=running-client-${project.clientId}`
                      }
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    <span>Price: {formatMoney(project.bidAmount ?? 0)}</span>
                    <span>Duration: {project.duration || "Not set"}</span>
                    <span>
                      Accepted {project.acceptedAt ? formatDate(project.acceptedAt) : "Not set"}
                    </span>
                    <span>Tracking {formatEnum(project.status || "ACTIVE")}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" asChild>
                      <Link
                        to="/project-track/$trackingId"
                        params={{ trackingId: String(project.id) }}
                      >
                        Track project
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/professional-messages">
                        <MessageSquare className="h-4 w-4" />
                        Message
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCancelTrackedProject(project.id)}
                      disabled={pendingCancelActionId === `tracked-${project.id}`}
                    >
                      <XCircle className="h-4 w-4" />
                      {pendingCancelActionId === `tracked-${project.id}` ? "Cancelling" : "Cancel"}
                    </Button>
                  </div>
                </div>
              ))}

              {startedDirectHires.map((request) => (
                <div
                  key={`hire-${request.contractId}`}
                  className="rounded-lg border border-border p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">Direct hire</Badge>
                        <Badge>Running</Badge>
                      </div>
                      <h3 className="mt-3 line-clamp-2 font-semibold">{request.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Client: {request.clientName || `Client ${request.clientId}`}
                      </p>
                    </div>
                    <img
                      src={
                        request.clientAvatarUrl ||
                        `https://i.pravatar.cc/100?u=running-hire-client-${request.clientId}`
                      }
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    <span>
                      Price:{" "}
                      {formatMoney(
                        request.totalAmount ?? request.budgetMax ?? request.budgetMin ?? 0,
                      )}
                    </span>
                    <span>Work mode: {formatEnum(request.workMode || "both")}</span>
                    <span>
                      Accepted {request.updatedAt ? formatDate(request.updatedAt) : "Not set"}
                    </span>
                    <span>
                      {request.deadline
                        ? `Deadline ${formatDate(request.deadline)}`
                        : "Deadline not set"}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/professional-messages">
                        <MessageSquare className="h-4 w-4" />
                        Message client
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCancelDirectHire(request.contractId)}
                      disabled={pendingCancelActionId === `hire-${request.contractId}`}
                    >
                      <XCircle className="h-4 w-4" />
                      {pendingCancelActionId === `hire-${request.contractId}`
                        ? "Cancelling"
                        : "Cancel"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
              <Clock className="mx-auto h-8 w-8 text-muted-foreground" />
              <h3 className="mt-3 font-semibold">No running projects yet</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Accepted tracked jobs and accepted direct hires will appear here.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {showAllStatsSections || activeStatsFilter === "hire-requests" ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-soft">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold">Direct hire requests</h2>
              <p className="text-sm text-muted-foreground">
                Client hire requests sent from your professional profile.
              </p>
            </div>
            <Badge variant="secondary">{visibleHireRequests.length} requests</Badge>
          </div>

          {hireActionMessage ? (
            <p className="mt-4 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
              {hireActionMessage}
            </p>
          ) : null}

          {hireActionError ? (
            <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {hireActionError}
            </p>
          ) : null}

          {visibleHireRequests.length ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {visibleHireRequests.map((request) => {
                const negotiationHistory = hireNegotiations.filter(
                  (negotiation) => negotiation.contractId === request.contractId,
                );
                const latestNegotiation = negotiationHistory.at(-1);
                const hireNegotiationDraft = hireNegotiationDrafts[request.contractId] ?? {
                  bidAmount:
                    request.totalAmount || request.budgetMax || request.budgetMin
                      ? String(request.totalAmount ?? request.budgetMax ?? request.budgetMin)
                      : "",
                  duration: getDurationWeeksValue(null, request.deadline),
                  message: request.description || "",
                };

                return (
                  <div
                    key={request.contractId}
                    className={`rounded-lg border p-4 transition ${
                      request.status === "pending"
                        ? "border-primary/30 bg-primary/5 shadow-soft"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">Direct hire</Badge>
                          <Badge
                            variant={
                              request.status === "accepted"
                                ? "default"
                                : request.status === "rejected"
                                  ? "destructive"
                                  : "outline"
                            }
                          >
                            {formatEnum(request.status)}
                          </Badge>
                          {negotiationHistory.length ? (
                            <Badge variant="outline">{negotiationHistory.length} offers</Badge>
                          ) : null}
                        </div>
                        <h3 className="mt-3 line-clamp-2 font-semibold">{request.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Client: {request.clientName || `Client ${request.clientId}`}
                        </p>
                      </div>
                      <img
                        src={
                          request.clientAvatarUrl ||
                          `https://i.pravatar.cc/100?u=hire-client-${request.clientId}`
                        }
                        alt=""
                        className="h-11 w-11 rounded-lg object-cover"
                      />
                    </div>
                    <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                      <span>
                        Budget:{" "}
                        {formatMoney(
                          request.totalAmount ?? request.budgetMax ?? request.budgetMin ?? 0,
                        )}
                      </span>
                      <span>Work mode: {formatEnum(request.workMode || "both")}</span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        Sent {formatDateTime(request.createdAt)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4" />
                        Updated {request.updatedAt ? formatDateTime(request.updatedAt) : "Not set"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4" />
                        Deadline {request.deadline ? formatDate(request.deadline) : "Not set"}
                      </span>
                      <span className="flex min-w-0 items-center gap-1.5">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span className="truncate">{request.location || "Location not set"}</span>
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                      {request.description || "No work description added."}
                    </p>
                    {latestNegotiation ? (
                      <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          <Handshake className="h-4 w-4 text-primary" />
                          <span>Latest negotiation offer</span>
                          <span className="text-xs font-normal text-muted-foreground">
                            {formatDateTime(latestNegotiation.createdAt)}
                          </span>
                        </div>
                        <div className="mt-2 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                          <span>Bid: {formatMoney(latestNegotiation.bidAmount ?? 0)}</span>
                          <span>Duration: {latestNegotiation.duration || "Not set"}</span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                          {latestNegotiation.message}
                        </p>
                      </div>
                    ) : null}
                    {request.status === "rejected" ? (
                      <p className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        Direct hire rejected. It will be removed after 1 minute.
                      </p>
                    ) : null}
                    {request.status === "pending" ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleHireStatus(request.contractId, "accepted")}
                          disabled={pendingHireActionId === request.contractId}
                        >
                          {pendingHireActionId === request.contractId ? "Updating" : "Accept"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleHireStatus(request.contractId, "rejected")}
                          disabled={pendingHireActionId === request.contractId}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setHireActionError(null);
                            setHireNegotiationDrafts((drafts) => ({
                              ...drafts,
                              [request.contractId]: hireNegotiationDraft,
                            }));
                            setOpenHireNegotiationId(request.contractId);
                          }}
                        >
                          <Handshake className="h-4 w-4" />
                          Negotiate
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <Link to="/professional-messages">Message</Link>
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" asChild>
                          <Link to="/professional-messages">Message client</Link>
                        </Button>
                        {request.status === "rejected" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteRejectedDirectHire(request.contractId)}
                            disabled={pendingCancelActionId === `delete-hire-${request.contractId}`}
                          >
                            <XCircle className="h-4 w-4" />
                            {pendingCancelActionId === `delete-hire-${request.contractId}`
                              ? "Deleting"
                              : "Delete immediately"}
                          </Button>
                        ) : null}
                      </div>
                    )}
                    <Dialog
                      open={openHireNegotiationId === request.contractId}
                      onOpenChange={(open) =>
                        setOpenHireNegotiationId(open ? request.contractId : null)
                      }
                    >
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Negotiate direct hire request</DialogTitle>
                          <DialogDescription>
                            Send the client a revised amount, duration, and message for{" "}
                            {request.title}.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor={`hire-bid-${request.contractId}`}>Bid amount</Label>
                              <Input
                                id={`hire-bid-${request.contractId}`}
                                type="number"
                                min="0"
                                value={hireNegotiationDraft.bidAmount}
                                onChange={(event) =>
                                  setHireNegotiationDrafts((drafts) => ({
                                    ...drafts,
                                    [request.contractId]: {
                                      ...hireNegotiationDraft,
                                      bidAmount: event.target.value,
                                    },
                                  }))
                                }
                                placeholder="Direct hire amount"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`hire-duration-${request.contractId}`}>
                                Duration (weeks)
                              </Label>
                              <Input
                                id={`hire-duration-${request.contractId}`}
                                type="number"
                                min="1"
                                step="1"
                                value={hireNegotiationDraft.duration}
                                onChange={(event) =>
                                  setHireNegotiationDrafts((drafts) => ({
                                    ...drafts,
                                    [request.contractId]: {
                                      ...hireNegotiationDraft,
                                      duration: event.target.value,
                                    },
                                  }))
                                }
                                placeholder="Weeks"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`hire-message-${request.contractId}`}>Message</Label>
                            <Textarea
                              id={`hire-message-${request.contractId}`}
                              value={hireNegotiationDraft.message}
                              onChange={(event) =>
                                setHireNegotiationDrafts((drafts) => ({
                                  ...drafts,
                                  [request.contractId]: {
                                    ...hireNegotiationDraft,
                                    message: event.target.value,
                                  },
                                }))
                              }
                              className="min-h-28"
                              placeholder="Explain your revised direct hire offer"
                            />
                          </div>
                          {negotiationHistory.length ? (
                            <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-3">
                              <h4 className="text-sm font-medium">Offer history</h4>
                              <div className="mt-3 space-y-3">
                                {negotiationHistory.map((negotiation) => (
                                  <div
                                    key={negotiation.id}
                                    className="rounded-md bg-muted/40 p-3 text-sm"
                                  >
                                    <div className="flex flex-wrap justify-between gap-2 font-medium">
                                      <span>
                                        {formatMoney(negotiation.bidAmount ?? 0)} /{" "}
                                        {negotiation.duration || "Not set"}
                                      </span>
                                      <span className="text-xs font-normal text-muted-foreground">
                                        {formatDateTime(negotiation.createdAt)}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-muted-foreground">
                                      {negotiation.message}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setOpenHireNegotiationId(null)}>
                            Cancel
                          </Button>
                          <Button
                            onClick={() => handleSendHireNegotiation(request)}
                            disabled={pendingHireNegotiationId === request.contractId}
                          >
                            <Handshake className="h-4 w-4" />
                            {pendingHireNegotiationId === request.contractId
                              ? "Sending"
                              : "Send offer"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
              <Handshake className="mx-auto h-8 w-8 text-muted-foreground" />
              <h3 className="mt-3 font-semibold">No direct hire requests yet</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                When a client sends a hire request from your profile, it will appear here.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {showAllStatsSections ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-soft">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold">Saved jobs</h2>
              <p className="text-sm text-muted-foreground">
                Favorite client jobs you saved while browsing.
              </p>
            </div>
            <Badge variant="secondary">{favoriteJobs.length} saved</Badge>
          </div>

          {favoriteJobs.length ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {favoriteJobs.map((job) => (
                <Link
                  key={job.id}
                  to="/job/$jobId"
                  params={{ jobId: String(job.id) }}
                  className="block rounded-lg border border-border p-4 transition-colors hover:border-primary/50 hover:bg-primary/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{job.category}</Badge>
                        <Badge variant={job.urgency === "HIGH" ? "destructive" : "outline"}>
                          {formatEnum(job.urgency)}
                        </Badge>
                      </div>
                      <h3 className="mt-3 line-clamp-2 font-semibold">{job.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Posted by {job.clientCompanyName || job.clientName}
                      </p>
                    </div>
                    <Heart className="h-4 w-4 shrink-0 fill-primary text-primary" />
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    <span>{formatBudget(job.budgetMin, job.budgetMax, job.timingType)}</span>
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4" />
                      Deadline {formatDate(job.deadline)}
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5 sm:col-span-2">
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span className="truncate">{formatFavoriteJobLocation(job)}</span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
              <Heart className="mx-auto h-8 w-8 text-muted-foreground" />
              <h3 className="mt-3 font-semibold">No saved jobs yet</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Save jobs from the home page or job detail page. They will appear here.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {showAllStatsSections || activeStatsFilter === "project-requests" ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-soft">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold">Project requests you sent</h2>
              <p className="text-sm text-muted-foreground">
                Only your submitted project requests appear here with pending, accepted, or rejected
                status.
              </p>
            </div>
            <Badge variant="secondary">{visibleProjectRequests.length} projects</Badge>
          </div>

          {visibleProjectRequests.length ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {visibleProjectRequests.map((project) => {
                const negotiationHistory = projectNegotiations.filter(
                  (negotiation) => negotiation.requestId === project.id,
                );
                const latestNegotiation = negotiationHistory.at(-1);
                const negotiationDraft = negotiationDrafts[project.id] ?? {
                  bidAmount: project.bidAmount ? String(project.bidAmount) : "",
                  duration: getDurationWeeksValue(project.duration, project.deadline),
                  message: project.coverLetter || "",
                };

                return (
                  <div key={project.id} className="rounded-lg border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">{project.projectCategory}</Badge>
                          <Badge
                            variant={
                              project.status === "ACCEPTED"
                                ? "default"
                                : project.status === "DECLINED"
                                  ? "destructive"
                                  : "outline"
                            }
                          >
                            {formatEnum(project.status)}
                          </Badge>
                          {project.trackingStatus ? (
                            <Badge variant="outline">
                              Tracking {formatEnum(project.trackingStatus)}
                            </Badge>
                          ) : null}
                          {negotiationHistory.length ? (
                            <Badge variant="outline">{negotiationHistory.length} offers</Badge>
                          ) : null}
                        </div>
                        <h3 className="mt-3 line-clamp-2 font-semibold">{project.projectTitle}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Client: {project.clientName || `Client ${project.clientId}`}
                        </p>
                      </div>
                      <img
                        src={
                          project.clientAvatarUrl ||
                          `https://i.pravatar.cc/100?u=tracked-client-${project.clientId}`
                        }
                        alt=""
                        className="h-11 w-11 rounded-lg object-cover"
                      />
                    </div>
                    <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                      <span>Bid: {formatMoney(project.bidAmount ?? 0)}</span>
                      <span>Duration: {project.duration || "Not set"}</span>
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4" />
                        Deadline {formatDate(project.deadline)}
                      </span>
                      <span>
                        {project.acceptedAt
                          ? `Accepted ${formatDate(project.acceptedAt)}`
                          : `Sent ${formatDate(project.createdAt)}`}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                      {project.coverLetter}
                    </p>
                    {project.status === "DECLINED" ? (
                      <p className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        Project request rejected. It will be removed after 24 hours.
                      </p>
                    ) : null}
                    {latestNegotiation ? (
                      <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          <Handshake className="h-4 w-4 text-primary" />
                          <span>Latest negotiation offer</span>
                          <span className="text-xs font-normal text-muted-foreground">
                            {formatDateTime(latestNegotiation.createdAt)}
                          </span>
                        </div>
                        <div className="mt-2 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                          <span>Bid: {formatMoney(latestNegotiation.bidAmount ?? 0)}</span>
                          <span>Duration: {latestNegotiation.duration || "Not set"}</span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                          {latestNegotiation.message}
                        </p>
                      </div>
                    ) : null}
                    {project.reviewRating ? (
                      <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          <Star className="h-4 w-4 fill-primary text-primary" />
                          <span>Client rating: {project.reviewRating}/5</span>
                          {project.reviewCreatedAt ? (
                            <span className="text-xs font-normal text-muted-foreground">
                              {formatDate(project.reviewCreatedAt)}
                            </span>
                          ) : null}
                        </div>
                        {project.reviewComment ? (
                          <p className="mt-2 text-sm text-muted-foreground">
                            {project.reviewComment}
                          </p>
                        ) : null}
                      </div>
                    ) : project.trackingStatus === "COMPLETED" ? (
                      <div className="mt-3 rounded-lg border border-dashed border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                        No client rating yet.
                      </div>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" asChild>
                        <Link to="/job/$jobId" params={{ jobId: String(project.jobId) }}>
                          View job
                        </Link>
                      </Button>
                      {project.status === "PENDING" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setNegotiationError(null);
                            setNegotiationDrafts((drafts) => ({
                              ...drafts,
                              [project.id]: negotiationDraft,
                            }));
                            setOpenNegotiationId(project.id);
                          }}
                        >
                          <Handshake className="h-4 w-4" />
                          Negotiate
                        </Button>
                      ) : null}
                      {project.trackingId ? (
                        <Button size="sm" variant="outline" asChild>
                          <Link
                            to="/project-track/$trackingId"
                            params={{ trackingId: String(project.trackingId) }}
                          >
                            Track project
                          </Link>
                        </Button>
                      ) : null}
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/professional-messages">Message</Link>
                      </Button>
                    </div>
                    <Dialog
                      open={openNegotiationId === project.id}
                      onOpenChange={(open) => setOpenNegotiationId(open ? project.id : null)}
                    >
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Negotiate project offer</DialogTitle>
                          <DialogDescription>
                            Send the client a revised bid, duration, and message for{" "}
                            {project.projectTitle}.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor={`bid-${project.id}`}>Bid amount</Label>
                              <Input
                                id={`bid-${project.id}`}
                                type="number"
                                min="0"
                                value={negotiationDraft.bidAmount}
                                onChange={(event) =>
                                  setNegotiationDrafts((drafts) => ({
                                    ...drafts,
                                    [project.id]: {
                                      ...negotiationDraft,
                                      bidAmount: event.target.value,
                                    },
                                  }))
                                }
                                placeholder="Project bid"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`duration-${project.id}`}>Duration (weeks)</Label>
                              <Input
                                id={`duration-${project.id}`}
                                type="number"
                                min="1"
                                step="1"
                                value={negotiationDraft.duration}
                                onChange={(event) =>
                                  setNegotiationDrafts((drafts) => ({
                                    ...drafts,
                                    [project.id]: {
                                      ...negotiationDraft,
                                      duration: event.target.value,
                                    },
                                  }))
                                }
                                placeholder="Weeks"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`message-${project.id}`}>Message</Label>
                            <Textarea
                              id={`message-${project.id}`}
                              value={negotiationDraft.message}
                              onChange={(event) =>
                                setNegotiationDrafts((drafts) => ({
                                  ...drafts,
                                  [project.id]: {
                                    ...negotiationDraft,
                                    message: event.target.value,
                                  },
                                }))
                              }
                              className="min-h-28"
                              placeholder="Explain your revised offer"
                            />
                          </div>
                          {negotiationHistory.length ? (
                            <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-3">
                              <h4 className="text-sm font-medium">Offer history</h4>
                              <div className="mt-3 space-y-3">
                                {negotiationHistory.map((negotiation) => (
                                  <div
                                    key={negotiation.id}
                                    className="rounded-md bg-muted/40 p-3 text-sm"
                                  >
                                    <div className="flex flex-wrap justify-between gap-2 font-medium">
                                      <span>
                                        {formatMoney(negotiation.bidAmount ?? 0)} /{" "}
                                        {negotiation.duration || "Not set"}
                                      </span>
                                      <span className="text-xs font-normal text-muted-foreground">
                                        {formatDateTime(negotiation.createdAt)}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-muted-foreground">
                                      {negotiation.message}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {negotiationError ? (
                            <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                              {negotiationError}
                            </p>
                          ) : null}
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setOpenNegotiationId(null)}>
                            Cancel
                          </Button>
                          <Button
                            onClick={() => handleSendNegotiation(project)}
                            disabled={pendingNegotiationId === project.id}
                          >
                            <Handshake className="h-4 w-4" />
                            {pendingNegotiationId === project.id ? "Sending" : "Send offer"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
              <Send className="mx-auto h-8 w-8 text-muted-foreground" />
              <h3 className="mt-3 font-semibold">No project requests yet</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Project requests you send to clients will appear here.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </AppShell>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
  sub,
  tint,
  to,
  delta,
  isActive = false,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  tint: string;
  to?:
    | "/earnings"
    | "/professional-stats/projects"
    | "/professional-stats/project-requests"
    | "/professional-stats/hire-requests"
    | "/professional-stats/completed"
    | "/professional-stats/ratings";
  delta?: number;
  isActive?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${tint}`}>
          <Icon className="h-5 w-5" />
        </div>
        {delta && delta > 0 ? (
          <Badge variant="secondary" className="shrink-0">
            +{delta} new
          </Badge>
        ) : null}
      </div>
      <p className="mt-4 text-2xl font-semibold">{value}</p>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="block rounded-xl border border-border bg-card p-5 shadow-soft transition-colors hover:border-primary/50 hover:bg-primary/5"
      >
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={isActive}
        className={`rounded-xl border p-5 text-left shadow-soft transition-colors hover:border-primary/50 hover:bg-primary/5 ${
          isActive ? "border-primary bg-primary/10" : "border-border bg-card"
        }`}
      >
        {content}
      </button>
    );
  }

  return <div className="rounded-xl border border-border bg-card p-5 shadow-soft">{content}</div>;
}

function getProfessionalStatsFilterLabel(filter: ProfessionalStatsFilter) {
  switch (filter) {
    case "running":
      return "Running projects";
    case "completed":
      return "Completed projects";
    case "project-requests":
      return "Project requests";
    case "hire-requests":
      return "Direct hire requests";
    case "ratings":
      return "Ratings";
    case "earnings":
      return "Earnings";
  }
}

function RatingStars({ rating }: { rating: number }) {
  const roundedRating = Math.round(rating);

  return (
    <div className="flex items-center gap-1" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={`h-4 w-4 ${
            index < roundedRating ? "fill-warning text-warning" : "text-muted-foreground/40"
          }`}
        />
      ))}
    </div>
  );
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

function getDurationWeeksValue(duration?: string | null, fallbackDate?: string | null) {
  const existingWeeks = parseWeeks(duration);

  if (existingWeeks) {
    return String(existingWeeks);
  }

  const fallbackWeeks = getWeeksUntil(fallbackDate);

  return fallbackWeeks ? String(fallbackWeeks) : "";
}

function formatWeeksDuration(value: string) {
  const weeks = Math.max(1, Math.round(Number(value) || 0));

  return weeks === 1 ? "1 week" : `${weeks} weeks`;
}

function parseWeeks(value?: string | null) {
  if (!value) {
    return null;
  }

  const weekMatch = value.match(/(\d+(?:\.\d+)?)\s*weeks?/i);
  const anyNumberMatch = value.match(/\d+(?:\.\d+)?/);

  if (weekMatch || !value.toLowerCase().includes("until")) {
    const numericValue = Number((weekMatch || anyNumberMatch)?.[1] ?? anyNumberMatch?.[0]);

    return Number.isFinite(numericValue) && numericValue > 0
      ? Math.max(1, Math.round(numericValue))
      : null;
  }

  const untilDate = new Date(value.replace(/^until\s+/i, ""));

  if (Number.isNaN(untilDate.getTime())) {
    return null;
  }

  return Math.max(1, Math.ceil((untilDate.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)));
}

function getWeeksUntil(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return Math.max(1, Math.ceil((date.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)));
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

function formatFavoriteJobLocation(job: {
  locationAddress?: string | null;
  locationLabel?: string | null;
  workMode?: string | null;
}) {
  if (job.workMode === "REMOTE") {
    return "Remote job";
  }

  return formatApproximateLocation(job.locationAddress || job.locationLabel, "Location not set");
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

function formatMoney(value: number) {
  return `$${value.toLocaleString()}`;
}

function readStoredStatCounts(storageKey: string) {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey) || "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function isVisibleProjectRequest(project: {
  coverLetter?: string | null;
  status: string;
  trackingStatus?: string | null;
  updatedAt?: string | null;
  createdAt: string;
}) {
  if (project.coverLetter === "Direct hire project started by the client.") {
    return false;
  }

  if (
    project.status === "ACCEPTED" &&
    (project.trackingStatus === "ACTIVE" || project.trackingStatus === "COMPLETED")
  ) {
    return false;
  }

  if (project.status === "DECLINED") {
    const rejectedAt = new Date(project.updatedAt || project.createdAt).getTime();

    if (!Number.isNaN(rejectedAt) && Date.now() - rejectedAt >= 24 * 60 * 60 * 1000) {
      return false;
    }
  }

  return true;
}

function isExpiredRejectedHireRequest(request: ProfessionalHireRequestRecord, now = Date.now()) {
  if (request.status !== "rejected") {
    return false;
  }

  const rejectedAt = new Date(request.updatedAt || request.createdAt).getTime();

  if (Number.isNaN(rejectedAt)) {
    return false;
  }

  return now - rejectedAt >= 60 * 1000;
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
    // Realtime alerts are best-effort; the saved page state still updates on refresh.
  }
}

function getSocketUrl() {
  return (
    import.meta.env.VITE_SOCKET_URL ||
    `${window.location.protocol}//${window.location.hostname}:4001`
  );
}
