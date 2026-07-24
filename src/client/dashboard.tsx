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
    const clientProfile = getClientProfileByUserId(viewer.id);
    const clientJobs = getClientJobsByUserId(viewer.id);

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
    openJobs: getOpenClientJobs(),
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

  if (!access) {
    return null;
  }

  const { viewer, clientProfile, clientJobs } = access;
  const displayName = clientProfile?.fullName || `${viewer.firstName} ${viewer.lastName}`.trim();

  if (viewer.role === "ADMIN") {
    return null;
  }

  if (viewer.role === "PROFESSIONAL") {
    return (
      <ProfessionalDashboard displayName={displayName} viewer={viewer} openJobs={access.openJobs} />
    );
  }

  const openJobs = clientJobs.filter((job) => job.status === "OPEN").length;
  const draftJobs = clientJobs.filter((job) => job.status === "DRAFT").length;
  const closedJobs = clientJobs.filter((job) => job.status === "CLOSED").length;
  const upcomingJobs = clientJobs.filter((job) => new Date(job.deadline) >= new Date()).length;
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
    },
    {
      label: "Active jobs",
      value: String(openJobs),
      icon: ClipboardList,
      tint: "text-accent bg-accent/15",
    },
    {
      label: "Upcoming deadlines",
      value: String(upcomingJobs),
      icon: CalendarClock,
      tint: "text-warning bg-warning/15",
    },
    {
      label: "Planned budget",
      value: totalBudget ? `$${totalBudget.toLocaleString()}` : "$0",
      icon: DollarSign,
      tint: "text-success bg-success/15",
    },
  ];

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
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {displayName}</h1>
          <p className="text-sm text-muted-foreground">
            Post jobs, track the project details you saved, and manage deadlines from one place.
          </p>
        </div>
        <Button size="lg" asChild>
          <Link to="/post-job">
            <FilePlus2 className="h-4 w-4" />
            Post job / project
          </Link>
        </Button>
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-start gap-4">
            <img
              src={
                clientProfile?.avatarUrl ||
                viewer.avatarUrl ||
                "https://i.pravatar.cc/120?u=client-dashboard"
              }
              alt={displayName}
              className="h-16 w-16 rounded-xl object-cover"
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold">Job posting hub</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {clientProfile?.companyName || "Independent client account"}
              </p>
              <p className="mt-3 text-sm text-foreground">
                {clientProfile?.address || "No main address saved yet."}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPinHouse className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold">Saved locations</h2>
            </div>
            <Link to="/my-info" className="text-sm text-primary hover:underline">
              View profile
            </Link>
          </div>
          <div className="mt-4 space-y-3">
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
                className="rounded-lg border border-border bg-muted/30 p-4"
              >
                <p className="font-medium">{location.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{location.address}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-start justify-between">
              <div className={`grid h-10 w-10 place-items-center rounded-xl ${s.tint}`}>
                <s.icon className="h-5 w-5" />
              </div>
              {draftJobs ? (
                <span className="text-xs font-medium text-muted-foreground">{draftJobs} draft</span>
              ) : null}
            </div>
            <p className="mt-4 text-2xl font-semibold">{s.value}</p>
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-soft">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold">Posted jobs / projects</h2>
            <p className="text-sm text-muted-foreground">
              Manage draft, active, and closed projects from one table.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/post-job">Add project</Link>
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="secondary">{draftJobs} Draft</Badge>
          <Badge>{openJobs} Active</Badge>
          <Badge variant="outline">{closedJobs} Closed</Badge>
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

        {clientJobs.length ? (
          <div className="mt-5">
            <Table>
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
                {clientJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="min-w-56">
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
          <div className="mt-5 rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
            <Briefcase className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-3 font-semibold">No jobs posted yet</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Start with one job or project. The posting flow will capture category, title,
              description, budget, dates, location, and uploaded files.
            </p>
            <Button className="mt-4" asChild>
              <Link to="/post-job">Post your first job</Link>
            </Button>
          </div>
        )}
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
  const highUrgencyJobs = openJobs.filter((job) => job.urgency === "HIGH").length;
  const remoteJobs = openJobs.filter(
    (job) => job.workMode === "REMOTE" || job.workMode === "BOTH",
  ).length;
  const withAttachments = openJobs.filter((job) => job.attachments.length > 0).length;
  const stats = [
    {
      label: "Open jobs",
      value: String(openJobs.length),
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

        {openJobs.length ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {openJobs.map((job) => (
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
