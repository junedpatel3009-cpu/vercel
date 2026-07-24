import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, Link, notFound, redirect, useLoaderData } from "@tanstack/react-router";
import { useState } from "react";
import { io } from "socket.io-client";
import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  Clock,
  FileUp,
  DollarSign,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Star,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUser, requireCurrentUserRole } from "@/lib/current-user.server";
import { createHireContract, type HireContractInput } from "@/lib/hire-db.server";
import { getClientJobsByUserId, type ClientJobRecord } from "@/lib/job-db.server";
import { formatApproximateLocation } from "@/lib/location-privacy";
import { getProfessionalProfileByUserId } from "@/lib/user-db.server";

const getHireDetails = createServerFn({ method: "GET" })
  .inputValidator((id: string) => id)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();
    const proId = Number(data);

    if (!Number.isInteger(proId)) {
      return null;
    }

    const profile = getProfessionalProfileByUserId(proId);

    if (!profile) {
      return null;
    }

    return {
      viewer,
      profile,
      projects: viewer?.role === "CLIENT" ? getClientJobsByUserId(viewer.id) : [],
    };
  });

const saveHireContract = createServerFn({ method: "POST" })
  .inputValidator((data: HireContractInput) => data)
  .handler(async ({ data }) => {
    const viewer = requireCurrentUserRole("CLIENT");
    const result = createHireContract(viewer.id, data);

    return {
      ok: true as const,
      ...result,
    };
  });

const getHireAccess = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = requireCurrentUserRole("CLIENT");

  return {
    viewer,
  };
});

export const Route = createFileRoute("/hire/$proId")({
  beforeLoad: async ({ location }) => {
    try {
      await getHireAccess();
    } catch {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }
  },
  loader: async ({ params }) => {
    const result = await getHireDetails({ data: params.proId });

    if (!result) {
      throw notFound();
    }

    return result;
  },
  head: () => ({ meta: [{ title: "Hire professional - Servio" }] }),
  component: HireProfessional,
  notFoundComponent: () => <div className="p-10 text-center">Professional not found.</div>,
});

function HireProfessional() {
  const { viewer, profile: pro, projects } = useLoaderData({ from: "/hire/$proId" });
  const clientProjects = (projects ?? []) as ClientJobRecord[];
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    clientProjects[0]?.id ?? null,
  );
  const [workDescription, setWorkDescription] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isStartingMessage, setIsStartingMessage] = useState(false);
  const selectedProject =
    clientProjects.find((project) => project.id === selectedProjectId) ?? null;
  const displayName = viewer ? `${viewer.firstName} ${viewer.lastName}`.trim() : "Guest";
  const rateLabel = pro.hourlyRate != null ? `$${pro.hourlyRate}/hr` : "Contact for rate";
  const fixedLabel = pro.fixedRate != null ? `$${pro.fixedRate}` : "Flexible";
  const locationLabel = formatApproximateLocation(
    pro.professionalCity || pro.serviceArea || pro.address,
    "Location not provided",
  );
  const ratingLabel = `${pro.averageRating.toFixed(1)} - ${pro.reviewCount} ${pro.reviewCount === 1 ? "review" : "reviews"}`;
  const availabilityLabel = formatAvailability(pro.availabilityStatus);
  const workModeLabel =
    pro.workMode === "remote"
      ? "Remote"
      : pro.workMode === "onsite"
        ? "On-site"
        : "Remote and on-site";

  const openSocketMessages = (firstMessage: string, job: string) => {
    if (!viewer) {
      throw new Error("Please log in as a client to message this professional.");
    }

    const search = new URLSearchParams({
      conversationId: buildConversationId(viewer.id, pro.id),
      toUserId: String(pro.id),
      name: pro.fullName,
      avatar: pro.avatarUrl || "",
      job,
      firstMessage,
    });

    window.location.href = `/messages?${search.toString()}`;
  };

  const saveContract = async () => {
    if (!selectedProject) {
      setSubmitError("Select a project before sending the hire request.");
      return;
    }

    const payload: HireContractInput = {
      professionalId: pro.id,
      clientProjectId: selectedProject.id,
      hiringTeam: "Direct hire",
      contractTitle: selectedProject.title,
      workDescription: buildHireDescription(selectedProject, workDescription),
      jobDate: dateInputValue(selectedProject.jobDate),
      deadline: dateInputValue(selectedProject.deadline),
      workMode: toHireWorkMode(selectedProject.workMode),
      location: selectedProject.locationAddress || selectedProject.locationLabel || "",
      paymentOption: "fixed",
      hourlyRate: null,
      fixedPrice: selectedProject.budgetMax ?? selectedProject.budgetMin ?? pro.fixedRate ?? null,
      paymentSchedule: "whole",
      acceptedTerms: true,
      attachments: selectedProject.attachments.map((attachment) => ({
        fileName: attachment.fileName,
        fileType: attachment.fileType || "document",
        fileSize: attachment.fileSize ?? undefined,
        fileUrl: attachment.previewUrl || attachment.fileName,
      })),
      milestones: [],
    };

    setIsSaving(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      const result = await saveHireContract({ data: payload });

      if (result.ok) {
        await emitDirectHireNotification({
          actorId: viewer.id,
          recipientId: pro.id,
          title: "New direct hire request",
          description: `${displayName || "A client"} sent a direct hire request for ${selectedProject.title}.`,
          href: "/professional-stats",
        });
        setSuccessMessage(
          "Hire request sent successfully. The professional will see it in My Stats and notifications.",
        );
        window.setTimeout(() => {
          if (window.history.length > 1) {
            window.history.back();
            return;
          }

          window.location.href = `/pro/${pro.id}`;
        }, 900);
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Could not save contract. Please check the details.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const messageBeforeHiring = async () => {
    setIsStartingMessage(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      openSocketMessages(
        `Hi ${pro.fullName}, I am interested in hiring you and would like to discuss the work details.`,
        "Direct hire discussion",
      );
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not open messages.");
    } finally {
      setIsStartingMessage(false);
    }
  };

  return (
    <AppShell
      userName={displayName}
      userRole={viewer?.role === "PROFESSIONAL" ? "Professional" : "Client"}
      userAvatarUrl={viewer?.avatarUrl}
    >
      <div className="mb-5">
        <Link
          to="/pro/$proId"
          params={{ proId: String(pro.id) }}
          className="text-sm text-primary hover:underline"
        >
          Back to profile
        </Link>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
        <div className="h-36 gradient-primary" />
        <div className="px-6 pb-6 sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-5">
              <img
                src={pro.avatarUrl || "https://i.pravatar.cc/240?u=hire-professional"}
                alt={pro.fullName}
                className="-mt-12 h-24 w-24 rounded-2xl border-4 border-card object-cover shadow-elevated"
              />
              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight">{pro.fullName}</h1>
                  {pro.isVerified ? <BadgeCheck className="h-5 w-5 text-primary" /> : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  {pro.professionalCategory || "Professional services"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 text-foreground">
                    <Star className="h-3 w-3 fill-warning text-warning" />
                    {ratingLabel}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {locationLabel}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {availabilityLabel}
                  </span>
                </div>
              </div>
            </div>
            <Button
              type="button"
              className="gap-2 sm:mb-2"
              onClick={messageBeforeHiring}
              disabled={isStartingMessage}
            >
              <MessageSquare className="h-4 w-4" />
              {isStartingMessage ? "Opening..." : "Message before hiring"}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Posted projects</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select one of your posted jobs and add a short note for the professional.
                </p>
              </div>
              <Badge variant="secondary">Direct hire</Badge>
            </div>

            {clientProjects.length ? (
              <div className="mt-5 grid auto-rows-fr gap-4 xl:grid-cols-2">
                {clientProjects.map((project) => (
                  <ProjectOptionCard
                    key={project.id}
                    project={project}
                    checked={selectedProjectId === project.id}
                    onSelect={() => {
                      setSelectedProjectId(project.id);
                      setSubmitError(null);
                      setSuccessMessage(null);
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-border bg-background p-8 text-center">
                <BriefcaseBusiness className="mx-auto h-8 w-8 text-muted-foreground" />
                <h3 className="mt-3 font-semibold">No projects yet</h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  Create a project first, then send it as a direct hire request.
                </p>
                <Button className="mt-4" asChild>
                  <Link to="/post-job">Create project</Link>
                </Button>
              </div>
            )}

            <div className="mt-5">
              <Label htmlFor="direct-hire-description">Description</Label>
              <Textarea
                id="direct-hire-description"
                rows={7}
                value={workDescription}
                onChange={(event) => {
                  setWorkDescription(event.target.value);
                  setSubmitError(null);
                  setSuccessMessage(null);
                }}
                placeholder="Add anything specific for this professional: schedule notes, access details, preferred outcome, or questions."
                className="mt-2"
              />
            </div>

            {submitError ? (
              <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {submitError}
              </div>
            ) : null}
            {successMessage ? (
              <div className="mt-4 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
                {successMessage}
              </div>
            ) : null}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="text-lg font-semibold">Professional details</h2>
            <div className="mt-4 grid gap-3">
              <InfoCard label="Hourly money" value={rateLabel} icon={DollarSign} />
              <InfoCard label="Fixed rate" value={fixedLabel} icon={DollarSign} />
              <InfoCard
                label="Service area"
                value={formatApproximateLocation(pro.serviceArea, locationLabel)}
                icon={MapPin}
              />
              <InfoCard label="Work mode" value={workModeLabel} icon={BriefcaseBusiness} />
              <InfoCard label="Availability" value={availabilityLabel} icon={CalendarDays} />
              <InfoCard
                label="Service radius"
                value={pro.serviceRadiusKm ? `${pro.serviceRadiusKm} km` : "Not set"}
                icon={MapPin}
              />
            </div>
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              {pro.companyDescription || "This professional has not added a full description yet."}
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="text-lg font-semibold">Hire checklist</h2>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <ChecklistRow text="Project selected" />
              <ChecklistRow text="Project budget and deadline included" />
              <ChecklistRow text="Description added for the professional" />
            </div>
            <Button
              type="button"
              className="mt-5 w-full gap-2"
              onClick={saveContract}
              disabled={isSaving || !clientProjects.length}
            >
              <ShieldCheck className="h-4 w-4" />
              {isSaving ? "Sending..." : "Send hire request"}
            </Button>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}

function ProjectOptionCard({
  project,
  checked,
  onSelect,
}: {
  project: ClientJobRecord;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={`flex min-h-[260px] flex-col rounded-xl border bg-background p-5 text-left transition ${
        checked
          ? "border-primary bg-primary/5"
          : "border-border bg-background hover:border-primary/60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{project.category}</Badge>
            <Badge variant={project.status === "OPEN" ? "default" : "outline"}>
              {project.status === "OPEN" ? "Active" : formatEnum(project.status)}
            </Badge>
            {checked ? <Badge variant="outline">Selected</Badge> : null}
          </div>
          <h3 className="mt-3 line-clamp-2 text-lg font-semibold">{project.title}</h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {project.description}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link to="/project/$projectId" params={{ projectId: String(project.id) }}>
            View
          </Link>
        </Button>
      </div>

      <div className="mt-5 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
        <span className="flex items-center gap-1.5">
          <DollarSign className="h-4 w-4 text-primary" />
          {formatBudget(project.budgetMin, project.budgetMax, project.timingType)}
        </span>
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 text-primary" />
          Deadline {formatDate(project.deadline)}
        </span>
        <span className="flex items-center gap-1.5">
          <BriefcaseBusiness className="h-4 w-4 text-primary" />
          {formatEnum(project.workMode)}
        </span>
        <span className="flex items-center gap-1.5">
          <FileUp className="h-4 w-4 text-primary" />
          {project.attachments.length} files
        </span>
      </div>

      <div className="mt-auto flex items-center gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
        <MapPin className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate">
          {formatApproximateLocation(
            project.locationAddress || project.locationLabel,
            "Remote or no location saved",
          )}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onSelect}
          variant={checked ? "default" : "outline"}
        >
          {checked ? "Selected project" : "Select project"}
        </Button>
        <Button type="button" size="sm" variant="outline" asChild>
          <Link to="/project/$projectId" params={{ projectId: String(project.id) }}>
            View project
          </Link>
        </Button>
      </div>
    </div>
  );
}

function InfoCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof MapPin;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </div>
      <p className="mt-2 font-medium text-foreground">{value}</p>
    </div>
  );
}

function ChecklistRow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <ShieldCheck className="h-4 w-4 text-primary" />
      <span>{text}</span>
    </div>
  );
}

function buildConversationId(clientId: number, professionalId: number) {
  return `client-${clientId}-pro-${professionalId}`;
}

async function emitDirectHireNotification(payload: {
  actorId: number;
  recipientId: number;
  title: string;
  description: string;
  href: string;
}) {
  try {
    const socket = io(getSocketUrl());
    socket.emit("project:activity", {
      trackingId: -1,
      ...payload,
    });
    window.setTimeout(() => socket.disconnect(), 800);
  } catch {
    // Realtime alerts are best-effort; the notification list still updates from the saved hire request.
  }
}

function getSocketUrl() {
  return (
    import.meta.env.VITE_SOCKET_URL ||
    `${window.location.protocol}//${window.location.hostname}:4001`
  );
}

function buildHireDescription(project: ClientJobRecord, note: string) {
  const parts = [project.description, note.trim() ? `Client note: ${note.trim()}` : ""].filter(
    Boolean,
  );

  return parts.join("\n\n");
}

function dateInputValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

function toHireWorkMode(value: ClientJobRecord["workMode"]): HireContractInput["workMode"] {
  if (value === "REMOTE") {
    return "remote";
  }

  if (value === "ON_SITE") {
    return "onsite";
  }

  return "both";
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

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatAvailability(value: string | null | undefined) {
  if (value === "busy") {
    return "Busy";
  }

  if (value === "unavailable") {
    return "Unavailable";
  }

  return "Available now";
}
