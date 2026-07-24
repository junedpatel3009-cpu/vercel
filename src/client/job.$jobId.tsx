import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, Link, notFound, useLoaderData } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useState } from "react";
import { io } from "socket.io-client";
import {
  BadgeCheck,
  Briefcase,
  CalendarDays,
  ExternalLink,
  Heart,
  MessageSquare,
  Paperclip,
  Settings,
  Star,
  Tag,
  MapPin,
  FileText,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getCurrentUser } from "@/lib/current-user.server";
import { getOpenClientJobById, isFavoriteJob, setFavoriteJob } from "@/lib/job-db.server";
import { formatApproximateLocation } from "@/lib/location-privacy";
import { queueAccountEmailNotification } from "@/lib/notification-email.server";
import { createProjectRequest } from "@/lib/project-request-db.server";

const getJobDetails = createServerFn({ method: "GET" })
  .inputValidator((jobId: string) => jobId)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();
    const jobId = Number(data);

    if (!Number.isInteger(jobId)) {
      return null;
    }

    const job = getOpenClientJobById(jobId);

    if (!job) {
      return null;
    }

    return {
      viewer,
      job,
      isFavorite: viewer ? isFavoriteJob(viewer.id, job.id) : false,
    };
  });

const saveFavoriteJob = createServerFn({ method: "POST" })
  .inputValidator((data: { jobId: number; favorite: boolean }) => data)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer) {
      return {
        ok: false as const,
        error: "Log in to save favorite jobs.",
      };
    }

    return {
      ok: true as const,
      favorite: setFavoriteJob(viewer.id, data.jobId, data.favorite),
    };
  });

const submitProjectRequest = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      jobId: number;
      bidAmount: number | null;
      duration: string;
      coverLetter: string;
      attachments?: Array<{
        fileName: string;
        fileType?: string | null;
        fileSize?: number | null;
        fileUrl?: string | null;
      }>;
    }) => data,
  )
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "PROFESSIONAL") {
      return {
        ok: false as const,
        formError: "Only professional accounts can send project requests.",
      };
    }

    try {
      const request = createProjectRequest({
        jobId: data.jobId,
        professionalId: viewer.id,
        bidAmount: data.bidAmount,
        duration: data.duration,
        coverLetter: data.coverLetter,
        attachments: data.attachments ?? [],
      });
      const job = getOpenClientJobById(data.jobId);
      const professionalName = `${viewer.firstName} ${viewer.lastName}`.trim() || viewer.email;
      const projectTitle = job?.title || "your project";

      if (request) {
        queueAccountEmailNotification(request.clientId, {
          subject: `New project request for ${projectTitle}`,
          title: "New project request",
          body: `${professionalName} sent a request for ${projectTitle}. Review the bid, timeline, message, and attachments in your projects page.`,
          actionLabel: "Review request",
          actionPath: "/projects",
        });
      }

      return {
        ok: true as const,
        request,
      };
    } catch (error) {
      return {
        ok: false as const,
        formError: error instanceof Error ? error.message : "Could not save this project request.",
      };
    }
  });

export const Route = createFileRoute("/job/$jobId")({
  loader: async ({ params }) => {
    const result = await getJobDetails({ data: params.jobId });

    if (!result) {
      throw notFound();
    }

    return result;
  },
  head: () => ({ meta: [{ title: "Job details - Servio" }] }),
  component: JobDetails,
});

function JobDetails() {
  const { viewer, job, isFavorite } = useLoaderData({ from: "/job/$jobId" });
  const isProfessional = viewer?.role === "PROFESSIONAL";
  const displayName = viewer ? `${viewer.firstName} ${viewer.lastName}`.trim() : "Guest";
  const skillTags = getSkillTags(job.category, job.title, job.description);
  const budgetLabel = formatBudget(job.budgetMin, job.budgetMax, job.timingType);
  const budgetType =
    job.budgetMin || job.budgetMax ? formatTimingType(job.timingType) : "Budget not set";
  const clientLocation = formatJobLocation(job);
  const jobMapQuery =
    job.locationLat != null && job.locationLng != null
      ? `${job.locationLat},${job.locationLng}`
      : job.locationAddress;
  const [favorite, setFavorite] = useState(isFavorite);
  const [favoriteStatus, setFavoriteStatus] = useState<string | null>(null);
  const [isProposalOpen, setIsProposalOpen] = useState(false);

  const toggleFavorite = async () => {
    if (!viewer) {
      window.location.href = `/login?returnTo=${encodeURIComponent(`/job/${job.id}`)}`;
      return;
    }

    const nextFavorite = !favorite;
    setFavorite(nextFavorite);
    setFavoriteStatus(nextFavorite ? "Job saved to favorites." : "Job removed from favorites.");

    try {
      const result = await saveFavoriteJob({ data: { jobId: job.id, favorite: nextFavorite } });

      if (!result.ok) {
        setFavorite(!nextFavorite);
        setFavoriteStatus(result.error);
      }
    } catch (error) {
      setFavorite(!nextFavorite);
      setFavoriteStatus(error instanceof Error ? error.message : "Could not update favorite job.");
    }
  };

  return (
    <AppShell
      userName={displayName}
      userRole={viewer?.role === "PROFESSIONAL" ? "Professional" : "Client"}
      userAvatarUrl={viewer?.avatarUrl}
    >
      <div className="mb-5">
        <Link to="/dashboard" className="text-sm text-primary hover:underline">
          Back to dashboard
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-6 shadow-soft sm:p-8">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="secondary">{job.category}</Badge>
              <Badge>{formatEnum(job.status)}</Badge>
              <Badge variant={job.urgency === "HIGH" ? "destructive" : "outline"}>
                {formatEnum(job.urgency)} urgency
              </Badge>
            </div>

            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{job.title}</h1>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                Posted {formatRelativeTime(job.createdAt)}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {clientLocation}
              </span>
              <span className="flex items-center gap-1.5">
                <Briefcase className="h-4 w-4" />
                {formatWorkMode(job.workMode)}
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { label: budgetType, value: budgetLabel, icon: Tag },
                {
                  label: "Experience level",
                  value: getExperienceLevel(job.urgency),
                  icon: Settings,
                },
                { label: "Deadline", value: formatDate(job.deadline), icon: CalendarDays },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-border p-4">
                  <item.icon className="mb-3 h-5 w-5 text-muted-foreground" />
                  <p className="font-semibold">{item.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-semibold">Summary</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {job.description}
              </p>
            </div>

            <div className="mt-6 rounded-lg border border-border p-4 text-sm">
              <span className="font-semibold text-foreground">Project Type:</span>
              <span className="ml-2 text-muted-foreground">{getProjectType(job.status)}</span>
            </div>

            <div className="mt-6">
              <h2 className="text-lg font-semibold">Skills and Expertise</h2>
              <p className="mt-3 text-sm font-medium">Mandatory skills</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {skillTags.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <h2 className="text-lg font-semibold">Attachments</h2>
              {job.attachments.length ? (
                <ul className="mt-3 space-y-2">
                  {job.attachments.map((attachment) => (
                    <li
                      key={attachment.id}
                      className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{attachment.fileName}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(attachment.fileSize)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No files attached.</p>
              )}
            </div>

            <div className="mt-8 grid gap-6 border-t border-border pt-6 sm:grid-cols-2">
              <div>
                <h2 className="text-lg font-semibold">Preferred qualifications</h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  {getExperienceLevel(job.urgency)} professional with clear communication and
                  examples of similar work.
                </p>
              </div>
              <div>
                <h2 className="text-lg font-semibold">Activity on this job</h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  Proposals: 0 to 5. Interviewing: 0. Invites sent: 0.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Dialog open={isProposalOpen} onOpenChange={setIsProposalOpen}>
            <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
              <a
                href={`/job/${job.id}`}
                target="_blank"
                rel="noreferrer"
                className="mb-5 flex items-center gap-2 text-sm font-semibold text-primary"
              >
                <ExternalLink className="h-4 w-4" />
                Open job in a new window
              </a>
              <div className="rounded-xl bg-muted p-4">
                <div className="flex gap-3 text-sm">
                  <MessageSquare className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                  <p>
                    Send a message to the client to ask questions, confirm the work, and discuss
                    next steps.
                  </p>
                </div>
              </div>
              {isProfessional ? (
                <DialogTrigger asChild>
                  <Button className="mt-5 w-full gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Send message to client
                  </Button>
                </DialogTrigger>
              ) : (
                <Button className="mt-4 w-full" asChild>
                  <Link to="/login">Log in as professional</Link>
                </Button>
              )}
              <Button variant="outline" className="mt-3 w-full gap-2" onClick={toggleFavorite}>
                <Heart className={`h-4 w-4 ${favorite ? "fill-current text-primary" : ""}`} />
                {favorite ? "Saved job" : "Save job"}
              </Button>
              {favoriteStatus ? (
                <p className="mt-2 text-center text-xs text-muted-foreground">{favoriteStatus}</p>
              ) : null}
            </div>
            <ProposalDialog
              jobId={job.id}
              budgetMax={job.budgetMax}
              viewerId={viewer?.id ?? null}
              clientId={job.userId}
              projectTitle={job.title}
              onSent={() => setIsProposalOpen(false)}
            />
          </Dialog>

          <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <h3 className="font-semibold">About the client</h3>
            <div className="mt-4 flex items-center gap-3">
              <img
                src={job.clientAvatarUrl || "https://i.pravatar.cc/100?u=client-job-detail"}
                className="h-12 w-12 rounded-full object-cover"
                alt=""
              />
              <div>
                <p className="font-medium">{job.clientCompanyName || job.clientName}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-warning text-warning" />
                  Client account
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-3 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-success" />
                Payment method verified
              </p>
              <p className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-success" />
                Phone number verified
              </p>
              <p>{clientLocation}</p>
              <p>1 job posted</p>
              <p>0% hire rate, 1 open job</p>
              <p>{job.category}</p>
              <p>Individual client</p>
            </div>
          </div>

          {jobMapQuery ? (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
              <div className="border-b border-border p-4">
                <h3 className="font-semibold">Location</h3>
                <p className="text-sm text-muted-foreground">{clientLocation}</p>
              </div>
              <iframe
                title="Job location map"
                src={`https://www.google.com/maps?q=${encodeURIComponent(jobMapQuery)}&z=16&output=embed`}
                className="h-56 w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

function ProposalDialog({
  jobId,
  budgetMax,
  viewerId,
  clientId,
  projectTitle,
  onSent,
}: {
  jobId: number;
  budgetMax: number | null;
  viewerId: number | null;
  clientId: number;
  projectTitle: string;
  onSent: () => void;
}) {
  const [bid, setBid] = useState(budgetMax ?? 0);
  const [durationWeeks, setDurationWeeks] = useState(1);
  const [coverLetter, setCoverLetter] = useState("");
  const [attachments, setAttachments] = useState<
    Array<{
      fileName: string;
      fileType?: string | null;
      fileSize?: number | null;
      fileUrl?: string | null;
    }>
  >([]);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const serviceFee = Math.round(bid * 0.1);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedCoverLetter = coverLetter.trim();

    if (!trimmedCoverLetter) {
      setFormError("Cover letter is required.");
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);
    setFormError(null);

    try {
      const result = await submitProjectRequest({
        data: {
          jobId,
          bidAmount: bid > 0 ? bid : null,
          duration: `${durationWeeks} ${durationWeeks === 1 ? "week" : "weeks"}`,
          coverLetter: trimmedCoverLetter,
          attachments,
        },
      });

      if (!result.ok) {
        setFormError(result.formError);
        return;
      }

      if (viewerId && result.request) {
        void emitProjectNotification({
          trackingId: result.request.id,
          actorId: viewerId,
          recipientId: clientId,
          title: "New project request",
          description: `A professional sent a request for ${projectTitle}.`,
          href: "/projects",
        });
      }

      setStatusMessage("Project request saved and sent to the client.");
      window.setTimeout(onSent, 1100);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save this project request.");
    } finally {
      setIsSaving(false);
    }
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(file);
    });

  const handleAttachments = async (files: FileList | null) => {
    if (!files?.length) {
      return;
    }

    const nextAttachments = await Promise.all(
      Array.from(files)
        .slice(0, 5)
        .map(async (file) => ({
          fileName: file.name,
          fileType: file.type || null,
          fileSize: file.size,
          fileUrl: await readFileAsDataUrl(file),
        })),
    );

    setAttachments(nextAttachments);
    setFormError(null);
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Submit your proposal</DialogTitle>
      </DialogHeader>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Your bid</Label>
            <Input
              type="number"
              placeholder="$ Total"
              value={bid || ""}
              onChange={(event) => {
                setBid(Number(event.target.value));
                setFormError(null);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Weeks</Label>
            <Input
              type="number"
              min={1}
              placeholder="3"
              value={durationWeeks}
              onChange={(event) => {
                setDurationWeeks(Math.max(1, Number(event.target.value) || 1));
                setFormError(null);
              }}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Cover letter</Label>
          <Textarea
            rows={6}
            placeholder="Why are you the best fit for this job?"
            value={coverLetter}
            onChange={(event) => {
              setCoverLetter(event.target.value);
              setFormError(null);
            }}
          />
        </div>
        {statusMessage ? (
          <div className="rounded-lg border border-success/20 bg-success/5 px-3 py-2 text-sm text-success">
            {statusMessage}
          </div>
        ) : null}
        {formError ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {formError}
          </div>
        ) : null}
        <label className="block cursor-pointer rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground hover:bg-muted/40">
          <Paperclip className="mr-1 inline h-3 w-3" />
          {attachments.length
            ? `${attachments.length} work sample${attachments.length === 1 ? "" : "s"} selected`
            : "Attach work samples (optional)"}
          <input
            type="file"
            multiple
            className="sr-only"
            onChange={(event) => handleAttachments(event.target.files)}
          />
        </label>
        {attachments.length ? (
          <div className="space-y-1 text-xs text-muted-foreground">
            {attachments.map((attachment) => (
              <div key={attachment.fileName} className="truncate rounded-md bg-muted px-2 py-1">
                {attachment.fileName}
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex justify-between rounded-lg bg-muted p-3 text-sm">
          <span className="text-muted-foreground">Service fee (10%)</span>
          <span>-${serviceFee.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm font-semibold">
          <span>You'll receive</span>
          <span>${Math.max(0, bid - serviceFee).toLocaleString()}</span>
        </div>
        <Button className="w-full" type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : "Submit request"}
        </Button>
      </form>
    </DialogContent>
  );
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

function formatTimingType(timingType: string | null | undefined) {
  if (timingType === "HOURLY") {
    return "Hourly";
  }

  if (timingType === "WEEKLY") {
    return "Weekly";
  }

  return "Fixed-price";
}

function formatJobLocation(job: {
  locationAddress?: string | null;
  locationLabel?: string | null;
  workMode?: string | null;
}) {
  if (job.workMode === "REMOTE") {
    return "Remote";
  }

  return formatApproximateLocation(job.locationAddress || job.locationLabel, "Worldwide");
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

function formatFileSize(size: number | null) {
  if (!size) {
    return "Unknown size";
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeTime(value: string) {
  const postedAt = new Date(value).getTime();
  const diffMs = Math.max(0, Date.now() - postedAt);
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return "just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} ${diffMinutes === 1 ? "minute" : "minutes"} ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
}

function getExperienceLevel(urgency: string) {
  if (urgency === "HIGH") {
    return "Expert";
  }

  if (urgency === "LOW") {
    return "Entry level";
  }

  return "Intermediate";
}

function getProjectType(status: string) {
  if (status === "OPEN") {
    return "Ongoing project";
  }

  return formatEnum(status);
}

function getSkillTags(category: string, title: string, description: string) {
  const text = `${category} ${title} ${description}`.toLowerCase();
  const tags = new Set<string>();

  tags.add(category);

  if (text.includes("web") || text.includes("website")) {
    tags.add("Web Design");
    tags.add("Web Development");
    tags.add("HTML");
    tags.add("CSS");
  }

  if (text.includes("react")) {
    tags.add("React");
  }

  if (text.includes("design")) {
    tags.add("Design");
  }

  if (text.includes("photo")) {
    tags.add("Photography");
  }

  if (text.includes("seo") || text.includes("marketing")) {
    tags.add("Marketing");
  }

  return Array.from(tags).slice(0, 6);
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
    // Realtime alerts are best-effort; the notification list and email still update.
  }
}

function getSocketUrl() {
  return (
    import.meta.env.VITE_SOCKET_URL ||
    `${window.location.protocol}//${window.location.hostname}:4001`
  );
}
