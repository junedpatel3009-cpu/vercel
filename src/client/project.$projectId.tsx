import { Link, useLoaderData, useParams, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  FileText,
  MapPin,
  MessageSquare,
  ReceiptText,
  Search,
  Send,
  Trash2,
  AlertTriangle,
  Timer,
  Upload,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteProject } from "@/client/project.$projectId.server";
import { formatApproximateLocation } from "@/lib/location-privacy";

export function Project() {
  const { viewer, job, tracking } = useLoaderData({ from: "/project/$projectId" }) as any;
  const { projectId } = useParams({ from: "/project/$projectId" });
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!job) {
    return <div className="p-10 text-center">Project not found.</div>;
  }

  const displayName = viewer ? `${viewer.firstName} ${viewer.lastName}`.trim() : undefined;
  const projectNumber = projectId.replace(/^p-/i, "").toUpperCase() || String(job.id);
  const budgetLabel = formatBudget(job.budgetMin, job.budgetMax, job.timingType);
  const statusLabel = job.status === "OPEN" ? "Active" : formatEnum(job.status);
  const isDraft = job.status === "DRAFT";

  async function handleDeleteProject() {
    const confirmed = window.confirm(
      "Delete this project? Draft or untracked project data will be removed. Active and completed tracked projects stay in account history.",
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteProject({ data: { projectId: job.id } });
      await router.navigate({ to: "/projects" });
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not delete project.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <AppShell userName={displayName} userRole="Client" userAvatarUrl={viewer?.avatarUrl}>
      <div className="mb-5">
        <Link to="/dashboard" className="text-sm text-primary hover:underline">
          Back to dashboard
        </Link>
      </div>

      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm text-muted-foreground">Project #{projectNumber}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{job.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="secondary">{job.category}</Badge>
            <Badge
              variant={
                job.status === "OPEN" ? "default" : job.status === "DRAFT" ? "secondary" : "outline"
              }
            >
              {statusLabel}
            </Badge>
            <Badge variant={job.urgency === "HIGH" ? "destructive" : "outline"}>
              {formatEnum(job.urgency)} urgency
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleDeleteProject} disabled={isDeleting}>
            <Trash2 className="h-4 w-4" />
            {isDeleting ? "Deleting" : "Delete project"}
          </Button>
          <Button variant="outline" asChild>
            <Link to="/messages">
              <MessageSquare className="h-4 w-4" />
              Messages
            </Link>
          </Button>
          {isDraft ? (
            <Button asChild>
              <Link to="/post-job" search={{ draftId: String(job.id) } as never}>
                <AlertTriangle className="h-4 w-4" />
                Continue draft
              </Link>
            </Button>
          ) : (
            <Button asChild>
              <Link to="/discover">
                <Users className="h-4 w-4" />
                Hire professional
              </Link>
            </Button>
          )}
        </div>
      </div>
      {deleteError ? <p className="-mt-3 mb-5 text-sm text-destructive">{deleteError}</p> : null}

      {isDraft ? (
        <div className="mb-6 rounded-xl border border-warning/30 bg-warning/10 p-5 text-warning-foreground shadow-soft">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-warning/20">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">Project is incomplete</h2>
                <p className="mt-1 text-sm">
                  This project is still saved as a draft. Complete the missing details and post it
                  before professionals can see it or send requests.
                </p>
              </div>
            </div>
            <Button asChild className="shrink-0">
              <Link to="/post-job" search={{ draftId: String(job.id) } as never}>
                Continue draft
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Budget", value: budgetLabel, icon: BriefcaseBusiness },
          { label: "Work mode", value: formatWorkMode(job.workMode), icon: Search },
          { label: "Deadline", value: formatDate(job.deadline), icon: CalendarDays },
          {
            label: "Tracking",
            value: isDraft ? "Incomplete" : tracking ? "Active" : "Ready",
            icon: Send,
          },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <item.icon className="h-5 w-5 text-primary" />
            <p className="mt-4 text-xl font-semibold">{item.value}</p>
            <p className="text-sm text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <h2 className="text-lg font-semibold">Project details</h2>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {job.description}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-semibold">
                  {tracking ? "Tracking overview" : "Hire and work requests"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {tracking
                    ? "Live status and activity pulled from the project tracking records in the database."
                    : "Use this project as the source when you contact professionals or start a direct hire."}
                </p>
              </div>
              {isDraft ? (
                <Button asChild>
                  <Link to="/post-job" search={{ draftId: String(job.id) } as never}>
                    <AlertTriangle className="h-4 w-4" />
                    Continue draft
                  </Link>
                </Button>
              ) : tracking ? (
                <Button asChild>
                  <Link to={`/project-track/${tracking.id}`}>
                    <Search className="h-4 w-4" />
                    Open tracking
                  </Link>
                </Button>
              ) : (
                <Button asChild>
                  <Link to="/discover">
                    <Search className="h-4 w-4" />
                    Find pros
                  </Link>
                </Button>
              )}
            </div>

            {tracking ? (
              <div className="mt-5 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-sm text-muted-foreground">Tracking status</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge>{formatEnum(tracking.status)}</Badge>
                      <span className="text-sm text-muted-foreground">
                        accepted {formatDate(tracking.acceptedAt)}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-sm text-muted-foreground">Professional</p>
                    <p className="mt-2 font-medium">{tracking.professionalName}</p>
                    <p className="text-sm text-muted-foreground">
                      {tracking.professionalCategory || "Professional"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border border-border p-4">
                    <div className="flex items-center gap-2 text-primary">
                      <CheckCircle2 className="h-4 w-4" />
                      <p className="font-semibold">Milestones</p>
                    </div>
                    <p className="mt-3 text-2xl font-semibold">
                      {
                        tracking.milestones.filter((milestone) => milestone.status === "DONE")
                          .length
                      }
                      /{tracking.milestones.length}
                    </p>
                    <p className="text-sm text-muted-foreground">Completed from the database</p>
                  </div>

                  <div className="rounded-lg border border-border p-4">
                    <div className="flex items-center gap-2 text-primary">
                      <Timer className="h-4 w-4" />
                      <p className="font-semibold">Work updates</p>
                    </div>
                    <p className="mt-3 text-2xl font-semibold">{tracking.workUploads.length}</p>
                    <p className="text-sm text-muted-foreground">Uploaded work entries</p>
                  </div>

                  <div className="rounded-lg border border-border p-4">
                    <div className="flex items-center gap-2 text-primary">
                      <FileText className="h-4 w-4" />
                      <p className="font-semibold">Revision requests</p>
                    </div>
                    <p className="mt-3 text-2xl font-semibold">
                      {
                        tracking.revisionRequests.filter((item) => item.status === "REQUESTED")
                          .length
                      }
                    </p>
                    <p className="text-sm text-muted-foreground">Pending review items</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-border p-4">
                    <div className="flex items-center gap-2 text-primary">
                      <ReceiptText className="h-4 w-4" />
                      <p className="font-semibold">Completion requests</p>
                    </div>
                    <p className="mt-3 text-2xl font-semibold">
                      {tracking.completionRequests.length}
                    </p>
                    <p className="text-sm text-muted-foreground">Saved approval requests</p>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <p className="font-semibold">Latest tracking update</p>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {tracking.workUploads.length > 0
                        ? `${tracking.workUploads[tracking.workUploads.length - 1].title} • ${formatDate(tracking.workUploads[tracking.workUploads.length - 1].createdAt)}`
                        : tracking.revisionRequests.length > 0
                          ? `${tracking.revisionRequests[tracking.revisionRequests.length - 1].note} • ${formatDate(tracking.revisionRequests[tracking.revisionRequests.length - 1].createdAt)}`
                          : `Tracking started on ${formatDate(tracking.acceptedAt)}`}
                    </p>
                  </div>
                </div>
              </div>
            ) : isDraft ? (
              <div className="mt-5 rounded-lg border border-dashed border-warning/40 bg-warning/5 p-5">
                <h3 className="font-semibold text-warning-foreground">Finish this draft first</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Once the project is posted, you can request work, hire professionals, and begin
                  tracking progress from here.
                </p>
                <Button className="mt-4" asChild>
                  <Link to="/post-job" search={{ draftId: String(job.id) } as never}>
                    Continue draft
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-border p-4">
                  <h3 className="font-semibold">Request work from this project</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Share the project scope with a professional, discuss availability, and move into
                    messages.
                  </p>
                  <Button className="mt-4 w-full" variant="outline" asChild>
                    <Link to="/discover">
                      <Send className="h-4 w-4" />
                      Request work
                    </Link>
                  </Button>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <h3 className="font-semibold">Create a hire request</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Choose a professional from Discover, then send a hire request with the title,
                    budget, files, and dates.
                  </p>
                  <Button className="mt-4 w-full" asChild>
                    <Link to="/discover">Hire from project</Link>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <h3 className="font-semibold">Project summary</h3>
            <div className="mt-4 space-y-3 text-sm">
              <p>
                <span className="text-muted-foreground">Category:</span> {job.category}
              </p>
              <p>
                <span className="text-muted-foreground">Posted:</span> {formatDate(job.createdAt)}
              </p>
              <p>
                <span className="text-muted-foreground">Job date:</span>{" "}
                {job.jobDate ? formatDate(job.jobDate) : "Not set"}
              </p>
              <p>
                <span className="text-muted-foreground">Status:</span> {statusLabel}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <h3 className="font-semibold">Attached files</h3>
            {job.attachments.length > 0 ? (
              <ul className="mt-4 space-y-3 text-sm">
                {job.attachments.map((file: any) => (
                  <li
                    key={file.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-3"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{file.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.fileSize)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">No files attached yet.</p>
            )}
            <Button variant="outline" size="sm" className="mt-4 w-full gap-2">
              <Upload className="h-4 w-4" />
              Upload file
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <h3 className="font-semibold">Location</h3>
            <div className="mt-4 space-y-3 text-sm">
              {job.locationLabel ? <p>{formatApproximateLocation(job.locationLabel)}</p> : null}
              {job.locationAddress ? (
                <p className="flex gap-2 text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  {formatApproximateLocation(job.locationAddress)}
                </p>
              ) : (
                <p className="text-muted-foreground">Remote or no location specified.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
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
