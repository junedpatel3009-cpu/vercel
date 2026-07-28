import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, Link, redirect, useLoaderData, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  getClientJobsByUserId,
  getOpenClientJobs,
  updateClientJobStatus,
  type JobStatus,
} from "@/lib/job-db.server";
import { formatApproximateLocation } from "@/lib/location-privacy";
import { getClientProfileByUserId } from "@/lib/user-db.server";
import { getCurrentUser } from "@/lib/current-user.server";
import {
  Briefcase,
  CalendarClock,
  ClipboardList,
  DollarSign,
  FilePlus2,
  MapPin,
  MapPinHouse,
  Paperclip,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const getDashboardAccess = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = getCurrentUser();

  if (!viewer) {
    return null;
  }

  if (viewer.role === "CLIENT") {
    const clientProfile = await getClientProfileByUserId(viewer.id);
    const clientJobs = await getClientJobsByUserId(viewer.id);

    return {
      viewer,
      clientProfile,
      clientJobs,
      openJobs: [],
    };
  }

  return {
    viewer,
    clientProfile: null,
    clientJobs: [],
    openJobs: await getOpenClientJobs(),
  };
});

const setClientJobStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { jobId: number; status: JobStatus }) => data)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "CLIENT") {
      return {
        ok: false as const,
        formError: "Only clients can manage posted jobs.",
      };
    }

    const job = updateClientJobStatus(viewer.id, data.jobId, data.status);

    if (!job) {
      return {
        ok: false as const,
        formError: "Job not found.",
      };
    }

    return {
      ok: true as const,
      job,
    };
  });

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async ({ location }) => {
    const access = await getDashboardAccess();

    if (!access) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }

    if (access.viewer.role === "ADMIN") {
      throw redirect({
        to: "/",
      });
    }

    if (access.viewer.role === "PROFESSIONAL") {
      throw redirect({
        to: "/professional-profile",
      });
    }
  },
  loader: () => getDashboardAccess(),
  head: () => ({ meta: [{ title: "Dashboard - Servio" }] }),
  component: Dashboard,
});

function Dashboard() {
  const access = useLoaderData({ from: "/dashboard" });
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [updatingJobId, setUpdatingJobId] = useState<number | null>(null);
  const [dashboardFilter, setDashboardFilter] = useState<
    "all" | "active" | "upcoming" | "budgeted"
  >("all");

  if (!access) {
    return null;
  }

  const { viewer, clientProfile, clientJobs = [] } = access;
  const displayName = clientProfile?.fullName || `${viewer.firstName} ${viewer.lastName}`.trim();

  if (viewer.role === "ADMIN") {
    return null;
  }

  if (viewer.role === "PROFESSIONAL") {
    return (
      <ProfessionalDashboard
        displayName={displayName}
        viewer={viewer}
        openJobs={access.openJobs ?? []}
      />
    );
  }

  const openJobs = clientJobs.filter((job) => job.status === "OPEN").length;
  const draftJobs = clientJobs.filter((job) => job.status === "DRAFT").length;
  const closedJobs = clientJobs.filter((job) => job.status === "CLOSED").length;
  const upcomingDeadlineJobs = clientJobs.filter(
    (job) => job.status === "OPEN" && new Date(job.deadline) >= new Date(),
  );
  const upcomingJobs = upcomingDeadlineJobs.length;
  const budgetedJobs = clientJobs.filter((job) => job.budgetMin != null || job.budgetMax != null);
  const totalBudget = clientJobs.reduce(
    (sum, job) => sum + (job.budgetMax ?? job.budgetMin ?? 0),
    0,
  );
  const stats = [
    {
      label: "Total jobs",
      value: String(clientJobs.length),
      icon: Briefcase,
      tint: "text-primary bg-primary/10",
      filter: "all" as const,
      description: "Every job and project you have posted, including drafts and closed work.",
    },
    {
      label: "Active jobs",
      value: String(openJobs),
      icon: ClipboardList,
      tint: "text-accent bg-accent/15",
      filter: "active" as const,
      description: "Open jobs that professionals can currently view and respond to.",
    },
    {
      label: "Upcoming deadlines",
      value: String(upcomingJobs),
      icon: CalendarClock,
      tint: "text-warning bg-warning/15",
      filter: "upcoming" as const,
      description: "Active jobs with a deadline today or later.",
    },
    {
      label: "Planned budget",
      value: totalBudget ? `$${totalBudget.toLocaleString()}` : "$0",
      icon: DollarSign,
      tint: "text-success bg-success/15",
      filter: "budgeted" as const,
      description: "The combined maximum budget across jobs where you entered a budget.",
    },
  ];

  const filteredJobs =
    dashboardFilter === "active"
      ? clientJobs.filter((job) => job.status === "OPEN")
      : dashboardFilter === "upcoming"
        ? upcomingDeadlineJobs
        : dashboardFilter === "budgeted"
          ? budgetedJobs
          : clientJobs;
  const activeStat = stats.find((stat) => stat.filter === dashboardFilter) ?? stats[0];

  const changeJobStatus = async (jobId: number, status: JobStatus) => {
    setUpdatingJobId(jobId);
    setStatusMessage(null);
    setStatusError(null);

    try {
      const result = await setClientJobStatus({ data: { jobId, status } });

      if (!result.ok) {
        setStatusError(result.formError);
        return;
      }

      setStatusMessage(
        status === "OPEN"
          ? "Job is now active and visible to professionals."
          : status === "DRAFT"
            ? "Job moved to draft."
            : "Job closed.",
      );
      await router.invalidate();
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Could not update this job.");
    } finally {
      setUpdatingJobId(null);
    }
  };

  return (
    <AppShell
      userName={displayName}
      userRole="Client"
      userAvatarUrl={clientProfile?.avatarUrl || viewer.avatarUrl}
    >
      <div className="mx-auto max-w-7xl space-y-8 pb-8">
        <section className="relative overflow-hidden rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/[0.10] via-card to-card px-6 py-7 shadow-soft sm:px-8 sm:py-8">
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Client workspace
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Welcome back, {displayName}
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Post jobs, track the project details you saved, and manage deadlines from one place.
              </p>
            </div>
            <Button size="lg" className="shadow-lg shadow-primary/20" asChild>
              <Link to="/post-job">
                <FilePlus2 className="h-4 w-4" />
                Post job / project
              </Link>
            </Button>
          </div>
        </section>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-4">
            <img
              src={
                clientProfile?.avatarUrl ||
                viewer.avatarUrl ||
                "https://i.pravatar.cc/120?u=client-dashboard"
              }
              alt={displayName}
              className="h-16 w-16 rounded-2xl border-2 border-background object-cover shadow-md"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Workspace</p>
              <h2 className="mt-1 text-xl font-semibold">Job posting hub</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {clientProfile?.companyName || "Independent client account"}
              </p>
              <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0 text-primary" />
                {clientProfile?.address || "No main address saved yet."}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPinHouse className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold">Saved locations</h2>
            </div>
            <Link to="/my-info" className="text-sm font-medium text-primary hover:underline">
              View profile
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {(clientProfile?.savedLocations?.length
              ? clientProfile.savedLocations
              : [
                  {
                    label: "No saved locations yet",
                    address: "Add your first location from profile setup.",
                  },
                ]
            ).map((location, index) => (
              <div
                key={`${location.label}-${index}`}
                className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3"
              >
                <p className="font-medium">{location.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{location.address}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => setDashboardFilter(s.filter)}
            aria-pressed={dashboardFilter === s.filter}
            className={`border-b border-border/70 p-5 text-left transition-colors last:border-b-0 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:[&:nth-child(odd)]:border-r lg:border-b-0 lg:border-r lg:last:border-r-0 ${
              dashboardFilter === s.filter ? "bg-primary/[0.04]" : "bg-card"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className={`grid h-10 w-10 place-items-center rounded-xl ${s.tint}`}>
                <s.icon className="h-5 w-5" />
              </div>
              {draftJobs ? (
                <span className="text-xs font-medium text-muted-foreground">{draftJobs} draft</span>
              ) : null}
            </div>
            <p className="mt-4 text-2xl font-bold tracking-tight">{s.value}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{s.label}</p>
          </button>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
        <div className="border-b border-border/70 bg-muted/20 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold">Posted jobs / projects</h2>
            <p className="text-sm text-muted-foreground">
              Manage draft, active, and closed projects from one table.
            </p>
          </div>
          <Button variant="outline" className="bg-card" asChild>
            <Link to="/post-job">Add project</Link>
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="secondary">{draftJobs} Draft</Badge>
          <Badge>{openJobs} Active</Badge>
          <Badge variant="outline">{closedJobs} Closed</Badge>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/10 bg-primary/[0.04] px-4 py-3 text-sm">
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">{activeStat.label}: </span>
            {activeStat.description} Showing {filteredJobs.length} {filteredJobs.length === 1 ? "result" : "results"}.
          </p>
          {dashboardFilter !== "all" ? (
            <Button size="sm" variant="ghost" onClick={() => setDashboardFilter("all")}>
              Show all jobs
            </Button>
          ) : null}
        </div>
        {statusMessage ? (
          <div className="mt-4 rounded-lg border border-success/20 bg-success/5 px-4 py-3 text-sm text-success">
            {statusMessage}
          </div>
        ) : null}
        {statusError ? (
          <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {statusError}
          </div>
        ) : null}

        {filteredJobs.length ? (
          <div className="overflow-x-auto">
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Work mode</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Files</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Manage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="min-w-56 py-4">
                      <Link
                        to="/project/$projectId"
                        params={{ projectId: String(job.id) }}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {job.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">{job.category}</p>
                    </TableCell>
                    <TableCell>
                      {formatBudget(job.budgetMin, job.budgetMax, job.timingType)}
                    </TableCell>
                    <TableCell>{formatEnum(job.urgency)}</TableCell>
                    <TableCell>{formatWorkMode(job.workMode)}</TableCell>
                    <TableCell>{formatDate(job.deadline)}</TableCell>
                    <TableCell>{job.attachments.length}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          job.status === "OPEN"
                            ? "default"
                            : job.status === "DRAFT"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {formatJobStatus(job.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {job.status === "DRAFT" ? (
                          <Button size="sm" asChild>
                            <Link to="/post-job" search={{ draftId: String(job.id) } as never}>
                              Continue
                            </Link>
                          </Button>
                        ) : null}
                        {job.status === "OPEN" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => changeJobStatus(job.id, "CLOSED")}
                            disabled={updatingJobId === job.id}
                          >
                            {updatingJobId === job.id ? "Updating..." : "Close"}
                          </Button>
                        ) : null}
                        {job.status === "CLOSED" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => changeJobStatus(job.id, "OPEN")}
                            disabled={updatingJobId === job.id}
                          >
                            {updatingJobId === job.id ? "Updating..." : "Reopen"}
                          </Button>
                        ) : null}
                        <Button size="sm" variant="ghost" asChild>
                          <Link to="/project/$projectId" params={{ projectId: String(job.id) }}>
                            View
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="m-5 rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center sm:m-6">
            <Briefcase className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-3 font-semibold">
              {clientJobs.length ? "No matching jobs" : "No jobs posted yet"}
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              {clientJobs.length
                ? "Try a different dashboard summary to see other posted jobs."
                : "Start with one job or project. The posting flow will capture category, title, description, budget, dates, location, and uploaded files."}
            </p>
            {clientJobs.length ? (
              <Button className="mt-4" variant="outline" onClick={() => setDashboardFilter("all")}>
                Show all jobs
              </Button>
            ) : (
              <Button className="mt-4" asChild>
                <Link to="/post-job">Post your first job</Link>
              </Button>
            )}
          </div>
        )}
        </div>
      </section>
      </div>
    </AppShell>
  );
}

function ProfessionalDashboard({
  displayName,
  viewer,
  openJobs,
}: {
  displayName: string;
  viewer: { avatarUrl: string | null };
  openJobs: Awaited<ReturnType<typeof getOpenClientJobs>>;
}) {
  const safeOpenJobs = openJobs || [];
  const highUrgencyJobs = safeOpenJobs.filter((job) => job.urgency === "HIGH").length;
  const remoteJobs = safeOpenJobs.filter(
    (job) => job.workMode === "REMOTE" || job.workMode === "BOTH",
  ).length;
  const withAttachments = safeOpenJobs.filter((job) => job.attachments.length > 0).length;
  const stats = [
    {
      label: "Open jobs",
      value: String(safeOpenJobs.length),
      icon: Briefcase,
      tint: "text-primary bg-primary/10",
    },
    {
      label: "Remote friendly",
      value: String(remoteJobs),
      icon: Search,
      tint: "text-accent bg-accent/15",
    },
    {
      label: "High urgency",
      value: String(highUrgencyJobs),
      icon: CalendarClock,
      tint: "text-warning bg-warning/15",
    },
    {
      label: "With files",
      value: String(withAttachments),
      icon: Paperclip,
      tint: "text-success bg-success/15",
    },
  ];

  return (
    <AppShell userName={displayName} userRole="Professional" userAvatarUrl={viewer.avatarUrl}>
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Available jobs</h1>
          <p className="text-sm text-muted-foreground">
            Client-posted jobs appear here as soon as they are posted.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <div className={`grid h-10 w-10 place-items-center rounded-xl ${s.tint}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <p className="mt-4 text-2xl font-semibold">{s.value}</p>
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-soft">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold">Job feed</h2>
            <p className="text-sm text-muted-foreground">
              Review budgets, deadlines, work mode, and client details before sending a proposal.
            </p>
          </div>
        </div>

        {safeOpenJobs.length ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {safeOpenJobs.map((job) => (
              <Link
                key={job.id}
                to="/job/$jobId"
                params={{ jobId: String(job.id) }}
                className="rounded-xl border border-border bg-background p-5 transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{job.category}</Badge>
                      <Badge variant={job.urgency === "HIGH" ? "destructive" : "outline"}>
                        {formatEnum(job.urgency)}
                      </Badge>
                    </div>
                    <h3 className="mt-3 line-clamp-2 text-lg font-semibold">{job.title}</h3>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                      {job.description}
                    </p>
                  </div>
                  <img
                    src={job.clientAvatarUrl || "https://i.pravatar.cc/100?u=client-job"}
                    alt=""
                    className="h-11 w-11 rounded-full object-cover"
                  />
                </div>

                <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  <span>{formatBudget(job.budgetMin, job.budgetMax, job.timingType)}</span>
                  <span>{formatWorkMode(job.workMode)}</span>
                  <span>Deadline {formatDate(job.deadline)}</span>
                  <span>{job.attachments.length} files</span>
                </div>

                <div className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span className="truncate">
                    {formatApproximateLocation(
                      job.locationAddress || job.locationLabel,
                      "Remote job",
                    )}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Posted by {job.clientCompanyName || job.clientName}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
            <Briefcase className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-3 font-semibold">No client jobs posted yet</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Once a client posts an active job, it will show here for professional accounts.
            </p>
          </div>
        )}
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

function formatJobStatus(value: string) {
  return value === "OPEN" ? "Active" : formatEnum(value);
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
