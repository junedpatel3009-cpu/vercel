import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock,
  Handshake,
  MapPin,
  MessageSquare,
  Send,
  Star,
} from "lucide-react";
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
import { getProfessionalStatsData } from "@/professional/stats";
import type { ProfessionalHireRequestRecord } from "@/lib/hire-db.server";
import {
  createProfessionalNegotiation,
  respondToProjectReview,
  type ProjectNegotiationRecord,
  type ProfessionalProjectRequestRecord,
  type ProfessionalTrackedProjectRecord,
} from "@/lib/project-request-db.server";

export const Route = createFileRoute("/professional-stats/$section")({
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
  head: ({ params }) => ({ meta: [{ title: `${getSectionTitle(params.section)} - Servio` }] }),
  component: ProfessionalStatsDetail,
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

function ProfessionalStatsDetail() {
  const data = Route.useLoaderData();
  const { section } = Route.useParams();

  if (!data) {
    return null;
  }

  const { viewer, profile, projectRequests } = data;
  const projectNegotiations = (data.projectNegotiations ?? []) as ProjectNegotiationRecord[];
  const hireRequests = (data.hireRequests ?? []) as ProfessionalHireRequestRecord[];
  const trackedProjects = (data.trackedProjects ?? []) as ProfessionalTrackedProjectRecord[];
  const visibleProjectRequests = projectRequests.filter((project) =>
    isVisibleProjectRequest(project),
  );
  const visibleHireRequests = hireRequests.filter(
    (request) =>
      request.status !== "started" &&
      request.status !== "cancelled" &&
      !isExpiredRejectedHireRequest(request),
  );
  const runningProjects = trackedProjects.filter((project) => project.status === "ACTIVE");
  const completedProjects = trackedProjects.filter((project) => project.status === "COMPLETED");
  const reviewedProjects = completedProjects.filter((project) => project.reviewRating);
  const displayName = profile?.fullName || `${viewer.firstName} ${viewer.lastName}`.trim();
  const title = getSectionTitle(section);

  return (
    <AppShell
      userName={displayName}
      userRole="Professional"
      userAvatarUrl={profile?.avatarUrl || viewer.avatarUrl}
    >
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{getSectionDescription(section)}</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/professional-stats">Back to stats</Link>
        </Button>
      </div>

      {section === "projects" ? (
        <ProjectGrid projects={runningProjects} emptyTitle="No running projects" />
      ) : null}
      {section === "project-requests" ? (
        <RequestGrid projects={visibleProjectRequests} negotiations={projectNegotiations} />
      ) : null}
      {section === "hire-requests" ? <HireGrid requests={visibleHireRequests} /> : null}
      {section === "completed" ? (
        <ProjectGrid projects={completedProjects} emptyTitle="No completed projects" />
      ) : null}
      {section === "ratings" ? (
        <ProjectGrid projects={reviewedProjects} emptyTitle="No client reviews yet" showReviews />
      ) : null}

      {!["projects", "project-requests", "hire-requests", "completed", "ratings"].includes(
        section,
      ) ? (
        <EmptyState
          title="Stats section not found"
          description="Choose one of the stat cards from My stats."
        />
      ) : null}
    </AppShell>
  );
}

function ProjectGrid({
  projects,
  emptyTitle,
  showReviews = false,
}: {
  projects: ProfessionalTrackedProjectRecord[];
  emptyTitle: string;
  showReviews?: boolean;
}) {
  if (!projects.length) {
    return (
      <EmptyState
        title={emptyTitle}
        description="New items will appear here when the project status changes."
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {projects.map((project) => (
        <div key={project.id} className="rounded-xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{project.projectCategory}</Badge>
                <Badge>{project.status === "COMPLETED" ? "Completed" : "Running"}</Badge>
              </div>
              <h2 className="mt-3 line-clamp-2 font-semibold">{project.projectTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Client: {project.clientName || `Client ${project.clientId}`}
              </p>
            </div>
            <img
              src={
                project.clientAvatarUrl ||
                `https://i.pravatar.cc/100?u=stat-detail-${project.clientId}`
              }
              alt=""
              className="h-12 w-12 shrink-0 rounded-lg object-cover"
            />
          </div>
          <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <Info icon={Briefcase} label="Price" value={formatMoney(project.bidAmount ?? 0)} />
            <Info
              icon={CalendarDays}
              label="Accepted"
              value={project.acceptedAt ? formatDate(project.acceptedAt) : "Not set"}
            />
            <Info
              icon={MapPin}
              label="Deadline"
              value={project.deadline ? formatDate(project.deadline) : "Not set"}
            />
            <Info icon={CheckCircle2} label="Status" value={formatEnum(project.status)} />
          </div>
          {showReviews ? <ReviewSummary project={project} /> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" asChild>
              <Link to="/project-track/$trackingId" params={{ trackingId: String(project.id) }}>
                View project
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/professional-messages">
                <MessageSquare className="h-4 w-4" />
                Message
              </Link>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function RequestGrid({
  projects,
  negotiations,
}: {
  projects: ProfessionalProjectRequestRecord[];
  negotiations: ProjectNegotiationRecord[];
}) {
  const router = useRouter();
  const [openNegotiationId, setOpenNegotiationId] = useState<number | null>(null);
  const [pendingNegotiationId, setPendingNegotiationId] = useState<number | null>(null);
  const [negotiationError, setNegotiationError] = useState<string | null>(null);
  const [negotiationDrafts, setNegotiationDrafts] = useState<
    Record<number, { bidAmount: string; duration: string; message: string }>
  >({});

  if (!projects.length) {
    return (
      <EmptyState
        title="No project requests"
        description="Requests you send to clients will appear here."
      />
    );
  }

  async function handleSendNegotiation(project: ProfessionalProjectRequestRecord) {
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
      toast.success("Negotiation offer sent.");
      setOpenNegotiationId(null);
      await router.invalidate();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not send negotiation offer.";
      setNegotiationError(message);
      toast.error(message);
    } finally {
      setPendingNegotiationId(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {projects.map((project) => {
        const negotiationHistory = negotiations.filter(
          (negotiation) => negotiation.requestId === project.id,
        );
        const latestNegotiation = negotiationHistory.at(-1);
        const negotiationDraft = negotiationDrafts[project.id] ?? {
          bidAmount: project.bidAmount ? String(project.bidAmount) : "",
          duration: getDurationWeeksValue(project.duration, project.deadline),
          message: project.coverLetter || "",
        };

        return (
          <div key={project.id} className="rounded-xl border border-border bg-card p-5 shadow-soft">
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
                <Badge variant="outline">Tracking {formatEnum(project.trackingStatus)}</Badge>
              ) : null}
              {negotiationHistory.length ? (
                <Badge variant="outline">{negotiationHistory.length} offers</Badge>
              ) : null}
            </div>
            <h2 className="mt-3 line-clamp-2 font-semibold">{project.projectTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Client: {project.clientName || `Client ${project.clientId}`}
            </p>
            <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <Info icon={Briefcase} label="Bid" value={formatMoney(project.bidAmount ?? 0)} />
              <Info
                icon={CalendarDays}
                label="Deadline"
                value={project.deadline ? formatDate(project.deadline) : "Not set"}
              />
            </div>
            <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{project.coverLetter}</p>

            {latestNegotiation ? (
              <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
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
                <Link to="/professional-messages">
                  <MessageSquare className="h-4 w-4" />
                  Message
                </Link>
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
                    Send the client a revised bid, duration, and message for {project.projectTitle}.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`detail-bid-${project.id}`}>Bid amount</Label>
                      <Input
                        id={`detail-bid-${project.id}`}
                        type="number"
                        min="0"
                        value={negotiationDraft.bidAmount}
                        onChange={(event) =>
                          setNegotiationDrafts((drafts) => ({
                            ...drafts,
                            [project.id]: { ...negotiationDraft, bidAmount: event.target.value },
                          }))
                        }
                        placeholder="Project bid"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`detail-duration-${project.id}`}>Duration (weeks)</Label>
                      <Input
                        id={`detail-duration-${project.id}`}
                        type="number"
                        min="1"
                        step="1"
                        value={negotiationDraft.duration}
                        onChange={(event) =>
                          setNegotiationDrafts((drafts) => ({
                            ...drafts,
                            [project.id]: { ...negotiationDraft, duration: event.target.value },
                          }))
                        }
                        placeholder="Weeks"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`detail-message-${project.id}`}>Message</Label>
                    <Textarea
                      id={`detail-message-${project.id}`}
                      value={negotiationDraft.message}
                      onChange={(event) =>
                        setNegotiationDrafts((drafts) => ({
                          ...drafts,
                          [project.id]: { ...negotiationDraft, message: event.target.value },
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
                          <div key={negotiation.id} className="rounded-md bg-muted/40 p-3 text-sm">
                            <div className="flex flex-wrap justify-between gap-2 font-medium">
                              <span>
                                {formatMoney(negotiation.bidAmount ?? 0)} /{" "}
                                {negotiation.duration || "Not set"}
                              </span>
                              <span className="text-xs font-normal text-muted-foreground">
                                {formatDateTime(negotiation.createdAt)}
                              </span>
                            </div>
                            <p className="mt-1 text-muted-foreground">{negotiation.message}</p>
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
  );
}

function HireGrid({ requests }: { requests: ProfessionalHireRequestRecord[] }) {
  if (!requests.length) {
    return (
      <EmptyState
        title="No hire requests"
        description="Direct client hire requests will appear here."
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {requests.map((request) => (
        <div
          key={request.contractId}
          className="rounded-xl border border-border bg-card p-5 shadow-soft"
        >
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
          </div>
          <h2 className="mt-3 line-clamp-2 font-semibold">{request.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Client: {request.clientName || `Client ${request.clientId}`}
          </p>
          <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <Info icon={Clock} label="Sent" value={formatDateTime(request.createdAt)} />
            <Info
              icon={CalendarDays}
              label="Updated"
              value={request.updatedAt ? formatDateTime(request.updatedAt) : "Not set"}
            />
            <Info
              icon={Briefcase}
              label="Budget"
              value={formatMoney(
                request.totalAmount ?? request.budgetMax ?? request.budgetMin ?? 0,
              )}
            />
            <Info
              icon={MapPin}
              label="Deadline"
              value={request.deadline ? formatDate(request.deadline) : "Not set"}
            />
          </div>
          <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
            {request.description || "No work description added."}
          </p>
        </div>
      ))}
    </div>
  );
}

function ReviewSummary({ project }: { project: ProfessionalTrackedProjectRecord }) {
  const router = useRouter();
  const [response, setResponse] = useState(project.reviewResponse || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!project.reviewRating) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/20 p-3 text-sm text-muted-foreground">
        {project.reviewRequestedAt
          ? `Review requested ${formatDate(project.reviewRequestedAt)}.`
          : "Client review not submitted yet."}
      </div>
    );
  }

  async function handleSaveResponse() {
    const nextResponse = response.trim();

    if (!nextResponse) {
      setError("Write a response before saving.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await saveReviewResponse({ data: { trackingId: project.id, response: nextResponse } });
      toast.success("Review response saved.");
      await router.invalidate();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save review response.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
        <Star className="h-4 w-4 fill-warning text-warning" />
        <span>{project.reviewRating}/5 client review</span>
        {project.reviewCreatedAt ? (
          <span className="text-xs text-muted-foreground">
            {formatDate(project.reviewCreatedAt)}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {project.reviewComment || "Client left a rating without a written review."}
      </p>
      {project.reviewResponse ? (
        <div className="mt-3 rounded-lg border border-primary/20 bg-background p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2 font-medium">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span>Your response</span>
            {project.reviewResponseAt ? (
              <span className="text-xs font-normal text-muted-foreground">
                {formatDate(project.reviewResponseAt)}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-muted-foreground">{project.reviewResponse}</p>
        </div>
      ) : null}
      <div className="mt-3 space-y-2">
        <Textarea
          value={response}
          onChange={(event) => {
            setResponse(event.target.value);
            setError(null);
          }}
          maxLength={1000}
          rows={3}
          placeholder="Respond to this client review"
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSaveResponse} disabled={isSaving}>
            {isSaving ? "Saving..." : project.reviewResponse ? "Update response" : "Save response"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-soft">
      <Send className="mx-auto h-8 w-8 text-muted-foreground" />
      <h2 className="mt-3 font-semibold">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Briefcase;
  label: string;
  value: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">
        <span className="text-foreground">{label}:</span> {value}
      </span>
    </span>
  );
}

function getSectionTitle(section: string) {
  const titles: Record<string, string> = {
    projects: "Running projects",
    "project-requests": "Project requests",
    "hire-requests": "Hire requests",
    completed: "Completed projects",
    ratings: "Ratings & Client Reviews",
  };

  return titles[section] || "Professional stats";
}

function getSectionDescription(section: string) {
  const descriptions: Record<string, string> = {
    projects: "Active tracked jobs and accepted direct hires.",
    "project-requests": "Project requests you sent to clients.",
    "hire-requests": "Direct hire requests from clients.",
    completed: "Finished projects with review status.",
    ratings: "Client ratings and written reviews from completed projects.",
  };

  return descriptions[section] || "Focused professional stats details.";
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

function formatMoney(value: number) {
  return `$${value.toLocaleString()}`;
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

function isExpiredRejectedHireRequest(request: ProfessionalHireRequestRecord) {
  if (request.status !== "rejected") {
    return false;
  }

  const rejectedAt = new Date(request.updatedAt || request.createdAt).getTime();

  if (Number.isNaN(rejectedAt)) {
    return false;
  }

  return Date.now() - rejectedAt >= 24 * 60 * 60 * 1000;
}
