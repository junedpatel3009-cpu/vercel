import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, Link, useLoaderData, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  DollarSign,
  Eye,
  ListChecks,
  Mail,
  MapPin,
  Paperclip,
  RotateCcw,
  Search,
  ShieldCheck,
  Upload,
  UserRound,
  X,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReportExportActions } from "@/components/ReportExportActions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSummaryCard } from "@/components/admin/AdminSummaryCard";
import { AdminSection } from "@/components/admin/AdminSection";
import { AdminTable, AdminTableCell, AdminTableRow } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import {
  formatBudget,
  formatDate,
  formatDateTime,
  formatEnum,
  formatFileSize,
  formatMoney,
} from "@/lib/admin-formatters";
import { getCurrentUser } from "@/lib/current-user.server";
import {
  getAdminDashboardSnapshot,
  getAdminDisputeRecords,
  getAdminJobRecords,
  updateAdminDisputeStatus,
  type AdminDisputeRecord,
  type AdminJobRecord,
} from "@/lib/admin-dashboard-db.server";
import { cn } from "@/lib/utils";

type DisputeStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED";
type JobQuickFilter =
  | "TOTAL"
  | "PENDING"
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "DISPUTED";
type DisputeQuickFilter =
  | "TOTAL"
  | "OPEN_ALL"
  | "NEW"
  | "UNDER_REVIEW"
  | "WAITING_CUSTOMER"
  | "WAITING_PROVIDER"
  | "RESOLVED"
  | "CLOSED";

type JobFilters = {
  customer: string;
  provider: string;
  category: string;
  status: string;
  paymentStatus: string;
};

type DisputeFilters = {
  status: string;
  priority: string;
  customer: string;
  provider: string;
};

const getJobManagementData = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = getCurrentUser();

  if (!viewer || viewer.role !== "ADMIN") {
    return {
      viewer,
      jobs: [],
      disputes: [],
      dashboard: null,
    };
  }

  return {
    viewer,
    jobs: getAdminJobRecords(),
    disputes: getAdminDisputeRecords(),
    dashboard: getAdminDashboardSnapshot(),
  };
});

const updateDisputeReviewStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { disputeId: number; status: DisputeStatus }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "ADMIN") {
      throw new Error("Only admins can update disputes.");
    }

    return updateAdminDisputeStatus(data.disputeId, data.status);
  });

export const Route = createFileRoute("/job-management")({
  loader: () => getJobManagementData(),
  head: () => ({ meta: [{ title: "Job & Dispute Management - Servio" }] }),
  component: JobManagement,
});

function JobManagement() {
  const data = useLoaderData({ from: "/job-management" });
  const router = useRouter();
  const [jobQuery, setJobQuery] = useState("");
  const [disputeQuery, setDisputeQuery] = useState("");
  const [jobQuickFilter, setJobQuickFilter] = useState<JobQuickFilter | null>(null);
  const [disputeQuickFilter, setDisputeQuickFilter] = useState<DisputeQuickFilter | null>(null);
  const [jobFilters, setJobFilters] = useState<JobFilters>({
    customer: "",
    provider: "",
    category: "ALL",
    status: "ALL",
    paymentStatus: "ALL",
  });
  const [disputeFilters, setDisputeFilters] = useState<DisputeFilters>({
    status: "ALL",
    priority: "ALL",
    customer: "",
    provider: "",
  });
  const [pendingDisputeId, setPendingDisputeId] = useState<number | null>(null);
  const [selectedJob, setSelectedJob] = useState<AdminJobRecord | null>(null);
  const [selectedDispute, setSelectedDispute] = useState<AdminDisputeRecord | null>(null);

  if (!data.viewer || data.viewer.role !== "ADMIN") {
    return (
      <div className="grid min-h-screen place-items-center bg-muted/30 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="mt-6 text-xl font-bold">Admin access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in from the admin panel to manage jobs and disputes.
          </p>
          <Button asChild className="mt-8 w-full">
            <Link to="/admin">Open admin panel</Link>
          </Button>
        </div>
      </div>
    );
  }

  const jobs = data.jobs as AdminJobRecord[];
  const disputes = data.disputes as AdminDisputeRecord[];
  const visibleJobs = useMemo(
    () => filterJobs(jobs, disputes, jobQuery, jobFilters, jobQuickFilter),
    [jobs, disputes, jobQuery, jobFilters, jobQuickFilter],
  );
  const visibleDisputes = useMemo(
    () => filterDisputes(disputes, disputeQuery, disputeFilters, disputeQuickFilter),
    [disputes, disputeQuery, disputeFilters, disputeQuickFilter],
  );
  const displayName =
    `${data.viewer.firstName} ${data.viewer.lastName}`.trim() || data.viewer.email;
  const stats = getPageStats(jobs, disputes);
  const jobStatuses = useMemo(
    () =>
      uniqueOptions(
        jobs.flatMap((job) => [job.status, job.trackingStatus].filter(Boolean) as string[]),
      ),
    [jobs],
  );

  async function handleDisputeStatus(dispute: AdminDisputeRecord, status: DisputeStatus) {
    setPendingDisputeId(dispute.id);

    try {
      await updateDisputeReviewStatus({ data: { disputeId: dispute.id, status } });
      await router.invalidate();
    } finally {
      setPendingDisputeId(null);
    }
  }

  return (
    <AppShell userName={displayName} userRole="Admin" userAvatarUrl={data.viewer.avatarUrl}>
      <AdminPageHeader
        title="Job & Dispute Management"
        description="Monitor posted jobs, assigned work, completion activity, and dispute resolution."
        breadcrumbs={[{ label: "Job Management" }]}
        actions={
          <>
            <ReportExportActions
              table="ClientJob"
              reportName="Job management export"
              variant="outline"
            />
            <Button asChild variant="outline">
              <Link to="/admin">Back to admin</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminSummaryCard
          icon={BriefcaseBusiness}
          label="Total jobs"
          value={stats.totalJobs}
          caption={`${stats.openJobs} open jobs`}
          active={jobQuickFilter === "TOTAL"}
          onClick={() => {
            setDisputeQuickFilter(null);
            setJobQuickFilter("TOTAL");
          }}
        />
        <AdminSummaryCard
          icon={ListChecks}
          label="Assigned jobs"
          value={stats.assignedJobs}
          caption={`${stats.inProgressJobs} in progress`}
          active={jobQuickFilter === "ASSIGNED"}
          onClick={() => {
            setDisputeQuickFilter(null);
            setJobQuickFilter("ASSIGNED");
          }}
        />
        <AdminSummaryCard
          icon={AlertTriangle}
          label="Open disputes"
          value={stats.openDisputes}
          caption={`${stats.highPriorityDisputes} high priority`}
          active={disputeQuickFilter === "OPEN_ALL"}
          variant="destructive"
          onClick={() => {
            setJobQuickFilter(null);
            setDisputeQuickFilter("OPEN_ALL");
          }}
        />
        <AdminSummaryCard
          icon={CheckCircle2}
          label="Completed jobs"
          value={stats.completedJobs}
          caption={`${stats.resolvedDisputes} disputes resolved`}
          active={jobQuickFilter === "COMPLETED"}
          variant="success"
          onClick={() => {
            setDisputeQuickFilter(null);
            setJobQuickFilter("COMPLETED");
          }}
        />
      </div>

      <div className="mt-8 space-y-8">
        {!jobQuickFilter ? (
          <AdminSection
            icon={AlertTriangle}
            title="Dispute queue"
            description="Review issue type, parties, priority, and resolution status."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={disputeQuery}
                    onChange={(event) => setDisputeQuery(event.target.value)}
                    placeholder="Search disputes..."
                    className="pl-9 h-10 rounded-xl"
                  />
                </div>
                <FilterSelect
                  label="Status"
                  value={disputeFilters.status}
                  values={["ALL", "OPEN", "UNDER_REVIEW", "RESOLVED"]}
                  onChange={(value) => setDisputeFilters({ ...disputeFilters, status: value })}
                />
                <FilterSelect
                  label="Priority"
                  value={disputeFilters.priority}
                  values={["ALL", "HIGH", "MEDIUM", "LOW"]}
                  onChange={(value) => setDisputeFilters({ ...disputeFilters, priority: value })}
                />
              </div>
            }
          >
            {disputeQuickFilter && (
              <div className="px-6 py-2 border-b border-border bg-primary/5">
                <ActiveFilterPill
                  label={`Showing ${formatEnum(disputeQuickFilter)}`}
                  onClear={() => setDisputeQuickFilter(null)}
                />
              </div>
            )}
            <AdminTable
              headers={["Dispute ID", "Customer", "Provider", "Status", "Actions"]}
              emptyState={
                <AdminEmptyState
                  title="No disputes found"
                  description="Raised disputes will appear here for admin review."
                />
              }
            >
              {visibleDisputes.map((dispute) => (
                <AdminTableRow key={dispute.id} onClick={() => setSelectedDispute(dispute)}>
                  <AdminTableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-foreground">#{dispute.id}</span>
                      <span className="text-xs text-muted-foreground font-medium">
                        {dispute.jobId ? `Job #${dispute.jobId}` : "No job"}
                      </span>
                    </div>
                  </AdminTableCell>
                  <AdminTableCell>
                    <p className="font-medium text-foreground">{dispute.clientName}</p>
                  </AdminTableCell>
                  <AdminTableCell>
                    <p className="font-medium text-foreground">{dispute.professionalName}</p>
                  </AdminTableCell>
                  <AdminTableCell>
                    <div className="flex flex-col items-start gap-1.5">
                      <Badge variant={getDisputeStatusVariant(dispute.status)}>
                        {formatEnum(dispute.status)}
                      </Badge>
                      <Badge variant={dispute.priority === "HIGH" ? "destructive" : "outline"}>
                        {formatEnum(dispute.priority)}
                      </Badge>
                    </div>
                  </AdminTableCell>
                  <AdminTableCell align="right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2 rounded-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDispute(dispute);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                      View Details
                    </Button>
                  </AdminTableCell>
                </AdminTableRow>
              ))}
            </AdminTable>
          </AdminSection>
        ) : null}

        {!disputeQuickFilter ? (
          <AdminSection
            icon={BriefcaseBusiness}
            title="Posted jobs"
            description="View client jobs, assigned professionals, budgets, deadlines, and work status."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={jobQuery}
                    onChange={(event) => setJobQuery(event.target.value)}
                    placeholder="Search jobs..."
                    className="pl-9 h-10 rounded-xl"
                  />
                </div>
                <FilterSelect
                  label="Status"
                  value={jobFilters.status}
                  values={["ALL", ...jobStatuses]}
                  onChange={(value) => setJobFilters({ ...jobFilters, status: value })}
                />
                <FilterSelect
                  label="Payment"
                  value={jobFilters.paymentStatus}
                  values={["ALL", "PENDING", "PAID", "REFUND_DUE"]}
                  onChange={(value) => setJobFilters({ ...jobFilters, paymentStatus: value })}
                />
              </div>
            }
          >
            {jobQuickFilter && (
              <div className="px-6 py-2 border-b border-border bg-primary/5">
                <ActiveFilterPill
                  label={`Showing ${formatEnum(jobQuickFilter)}`}
                  onClear={() => setJobQuickFilter(null)}
                />
              </div>
            )}
            <AdminTable
              headers={["Job ID", "Customer", "Provider", "Status", "Actions"]}
              emptyState={
                <AdminEmptyState
                  title="No jobs found"
                  description="Client job posts will appear here after they are created."
                />
              }
            >
              {visibleJobs.map((job) => (
                <AdminTableRow key={job.id} onClick={() => setSelectedJob(job)}>
                  <AdminTableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-foreground">#{job.id}</span>
                      <span className="max-w-[160px] truncate text-xs text-muted-foreground font-medium">
                        {job.title}
                      </span>
                    </div>
                  </AdminTableCell>
                  <AdminTableCell>
                    <p className="font-medium text-foreground">{job.clientName}</p>
                  </AdminTableCell>
                  <AdminTableCell>
                    <p className="font-medium text-foreground">{job.professionalName || "Not assigned"}</p>
                  </AdminTableCell>
                  <AdminTableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {getJobStatusBadges(job).map((badge) => (
                        <Badge key={badge.label} variant={badge.variant}>
                          {badge.label}
                        </Badge>
                      ))}
                    </div>
                  </AdminTableCell>
                  <AdminTableCell align="right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2 rounded-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedJob(job);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                      View Details
                    </Button>
                  </AdminTableCell>
                </AdminTableRow>
              ))}
            </AdminTable>
          </AdminSection>
        ) : null}
      </div>

      {selectedJob ? (
        <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />
      ) : null}
      {selectedDispute ? (
        <DisputeDetailModal
          dispute={selectedDispute}
          pending={pendingDisputeId === selectedDispute.id}
          onClose={() => setSelectedDispute(null)}
          onStatusChange={handleDisputeStatus}
        />
      ) : null}
    </AppShell>
  );
}

function JobDetailModal({ job, onClose }: { job: AdminJobRecord; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-all animate-in fade-in">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col rounded-3xl border border-border bg-background shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-4 border-b border-border px-8 py-6 bg-muted/20">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="truncate text-2xl font-bold tracking-tight">{job.title}</h2>
              <div className="flex gap-2">
                {getJobStatusBadges(job).map((badge) => (
                  <Badge key={badge.label} variant={badge.variant}>
                    {badge.label}
                  </Badge>
                ))}
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
              <span className="font-semibold text-primary">Job #{job.id}</span>
              <span className="text-border">|</span>
              <span>{job.category}</span>
              <span className="text-border">|</span>
              <span>Uploaded by {job.clientName} on {formatDateTime(job.createdAt)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90"
            aria-label="Close job details"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="overflow-auto p-8 custom-scrollbar">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <InfoPanel title="Job Details" icon={BriefcaseBusiness}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoLine
                    icon={UserRound}
                    label="Client"
                    value={`${job.clientName} / ${job.clientEmail}`}
                  />
                  <InfoLine
                    icon={BriefcaseBusiness}
                    label="Assigned professional"
                    value={
                      job.professionalName
                        ? `${job.professionalName} / ${job.professionalEmail}`
                        : "Not assigned"
                    }
                  />
                  <InfoLine
                    icon={CalendarDays}
                    label="Posted"
                    value={formatDateTime(job.createdAt)}
                  />
                  <InfoLine icon={Clock3} label="Updated" value={formatDateTime(job.updatedAt)} />
                  <InfoLine icon={CalendarDays} label="Job date" value={formatDate(job.jobDate)} />
                  <InfoLine icon={CalendarDays} label="Deadline" value={formatDate(job.deadline)} />
                  <InfoLine icon={Clock3} label="Urgency" value={formatEnum(job.urgency)} />
                  <InfoLine icon={Clock3} label="Work mode" value={formatEnum(job.workMode)} />
                </div>
                <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Description
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                    {job.description || "No description added."}
                  </p>
                </div>
              </InfoPanel>

              <InfoPanel title="Timeline" icon={Clock3}>
                <div className="space-y-3">
                  <TimelineRow
                    label="Job uploaded by client"
                    value={formatDateTime(job.createdAt)}
                  />
                  <TimelineRow label="Last updated" value={formatDateTime(job.updatedAt)} />
                  <TimelineRow
                    label="Professional accepted"
                    value={formatDateTime(job.acceptedAt)}
                  />
                  <TimelineRow
                    label="Completion submitted"
                    value={formatDateTime(job.completionSubmittedAt)}
                  />
                  <TimelineRow label="Completed / closed" value={formatDateTime(job.completedAt)} />
                </div>
              </InfoPanel>
            </div>

            <div className="space-y-6">
              <InfoPanel title="Budget & Location" icon={MapPin}>
                <div className="grid gap-4">
                  <InfoLine
                    icon={BriefcaseBusiness}
                    label="Budget"
                    value={formatBudget(job.budgetMin, job.budgetMax)}
                  />
                  <InfoLine
                    icon={DollarSign}
                    label="Payment status"
                    value={formatEnum(getPaymentStatus(job))}
                  />
                  <InfoLine
                    icon={DollarSign}
                    label="Transaction ID"
                    value={job.trackingId ? `Tracking #${job.trackingId}` : "Not available"}
                  />
                  <InfoLine
                    icon={RotateCcw}
                    label="Refund status"
                    value={
                      getPaymentStatus(job) === "REFUND_DUE" ? "Review needed" : "No refund pending"
                    }
                  />
                  <InfoLine icon={Clock3} label="Timing type" value={formatEnum(job.timingType)} />
                  <InfoLine
                    icon={MapPin}
                    label="Location label"
                    value={job.locationLabel || "Not set"}
                  />
                  <InfoLine
                    icon={MapPin}
                    label="Address"
                    value={job.locationAddress || "Not set"}
                  />
                </div>
              </InfoPanel>

              <InfoPanel title="Client Uploaded Files" icon={Paperclip}>
                {job.attachments.length ? (
                  <div className="space-y-3">
                    {job.attachments.map((attachment) => (
                      <FileRow
                        key={attachment.id}
                        title={attachment.fileName}
                        subtitle={`Uploaded by ${job.clientName} · ${formatDateTime(attachment.createdAt)} · ${formatFileSize(attachment.fileSize)}`}
                        href={attachment.previewUrl}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center rounded-xl border-2 border-dashed border-border">
                    <Paperclip className="h-8 w-8 text-muted-foreground/40" />
                    <p className="mt-2 text-sm text-muted-foreground font-medium">No client files uploaded.</p>
                  </div>
                )}
              </InfoPanel>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <InfoPanel title="Professional Proposals" icon={Mail}>
              {job.requests.length ? (
                <div className="space-y-4">
                  {job.requests.map((request) => (
                    <div key={request.id} className="rounded-2xl border border-border bg-muted/20 p-5 hover:bg-muted/40 transition-colors">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <p className="font-bold text-foreground">{request.professionalName}</p>
                          <p className="text-xs text-muted-foreground font-medium">
                            {request.professionalEmail}
                          </p>
                        </div>
                        <Badge variant={request.status === "ACCEPTED" ? "default" : "outline"} className="rounded-lg">
                          {formatEnum(request.status)}
                        </Badge>
                      </div>
                      <div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-primary/60" />
                          <span>Bid: <span className="font-bold text-foreground">{request.bidAmount ? formatMoney(request.bidAmount) : "Not set"}</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock3 className="h-4 w-4 text-primary/60" />
                          <span>Duration: <span className="font-bold text-foreground">{request.duration || "Not set"}</span></span>
                        </div>
                      </div>
                      <div className="mt-4 p-4 rounded-xl border border-border bg-background">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Cover Letter</p>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed italic">
                          "{request.coverLetter || "No cover letter."}"
                        </p>
                      </div>
                      <AttachmentJsonList
                        value={request.attachmentsJson}
                        uploadedBy={request.professionalName}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center rounded-xl border-2 border-dashed border-border">
                  <Mail className="h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-3 text-sm text-muted-foreground font-medium">No proposals submitted for this job.</p>
                </div>
              )}
            </InfoPanel>

            <InfoPanel title="Professional Work Uploads" icon={Upload}>
              {job.workUploads.length ? (
                <div className="space-y-4">
                  {job.workUploads.map((upload) => (
                    <div key={upload.id} className="rounded-2xl border border-border bg-muted/20 p-5 hover:bg-muted/40 transition-colors">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <p className="font-bold text-foreground">
                            Round {upload.roundNumber}: {upload.title}
                          </p>
                          <p className="text-xs text-muted-foreground font-medium">
                            Uploaded by {upload.professionalName} · {formatDateTime(upload.createdAt)}
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground leading-relaxed italic">"{upload.note}"</p>
                      <div className="mt-4 space-y-3">
                        {upload.fileName ? (
                          <FileRow
                            title={upload.fileName}
                            subtitle="Single uploaded work file"
                            href={upload.fileUrl}
                          />
                        ) : null}
                        <AttachmentJsonList
                          value={upload.filesJson}
                          uploadedBy={upload.professionalName}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center rounded-xl border-2 border-dashed border-border">
                  <Upload className="h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-3 text-sm text-muted-foreground font-medium">No professional work uploads yet.</p>
                </div>
              )}
            </InfoPanel>
          </div>

          <div className="mt-8">
            <InfoPanel title="Activity Log" icon={ListChecks}>
              <ActivityLogRows
                rows={[
                  {
                    date: job.createdAt,
                    user: job.clientName,
                    role: "Customer",
                    action: "Created job",
                    description: job.title,
                  },
                  ...(job.acceptedAt
                    ? [
                        {
                          date: job.acceptedAt,
                          user: job.professionalName || "Provider",
                          role: "Provider",
                          action: "Accepted job",
                          description: "Provider assigned to job",
                        },
                      ]
                    : []),
                  ...(job.completionSubmittedAt
                    ? [
                        {
                          date: job.completionSubmittedAt,
                          user: job.professionalName || "Provider",
                          role: "Provider",
                          action: "Submitted work",
                          description: "Completion request submitted",
                        },
                      ]
                    : []),
                  {
                    date: job.updatedAt,
                    user: "System",
                    role: "System",
                    action: "Updated record",
                    description: `Status: ${formatEnum(job.trackingStatus || job.status)}`,
                  },
                ]}
              />
            </InfoPanel>
          </div>
        </div>
      </div>
    </div>
  );
}

function DisputeDetailModal({
  dispute,
  pending,
  onClose,
  onStatusChange,
}: {
  dispute: AdminDisputeRecord;
  pending: boolean;
  onClose: () => void;
  onStatusChange: (dispute: AdminDisputeRecord, status: DisputeStatus) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-all animate-in fade-in">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col rounded-3xl border border-border bg-background shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-4 border-b border-border px-8 py-6 bg-muted/20">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="truncate text-2xl font-bold tracking-tight">Dispute #{dispute.id}</h2>
              <div className="flex gap-2">
                <Badge variant={getDisputeStatusVariant(dispute.status)}>
                  {formatEnum(dispute.status)}
                </Badge>
                <Badge variant={dispute.priority === "HIGH" ? "destructive" : "outline"}>
                  {formatEnum(dispute.priority)}
                </Badge>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
              <span className="font-semibold text-primary">Job #{dispute.jobId || "unlinked"}</span>
              <span className="text-border">|</span>
              <span className="truncate max-w-md">{dispute.jobTitle}</span>
              <span className="text-border">|</span>
              <span>Opened {formatDateTime(dispute.createdAt)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90"
            aria-label="Close dispute details"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="overflow-auto p-8 custom-scrollbar">
          <div className="grid gap-6 lg:grid-cols-2">
            <InfoPanel title="Dispute Information" icon={AlertTriangle}>
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoLine icon={FileText} label="Reason" value={formatEnum(dispute.issueType)} />
                <InfoLine
                  icon={BriefcaseBusiness}
                  label="Job ID"
                  value={dispute.jobId ? `#${dispute.jobId}` : "Not linked"}
                />
                <InfoLine
                  icon={CalendarDays}
                  label="Created"
                  value={formatDateTime(dispute.createdAt)}
                />
                <InfoLine icon={Clock3} label="Updated" value={formatDateTime(dispute.updatedAt)} />
              </div>
              <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Description
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90 italic">
                  "{dispute.message}"
                </p>
              </div>
            </InfoPanel>

            <InfoPanel title="People Involved" icon={UserRound}>
              <div className="space-y-4">
                <InfoLine
                  icon={UserRound}
                  label="Reporter"
                  value={`${dispute.reporterName} · ${formatEnum(dispute.reporterRole)} · ${dispute.reporterEmail}`}
                />
                <InfoLine
                  icon={UserRound}
                  label="Customer"
                  value={`${dispute.clientName} · ${dispute.clientEmail}`}
                />
                <InfoLine
                  icon={BriefcaseBusiness}
                  label="Provider"
                  value={`${dispute.professionalName} · ${dispute.professionalEmail}`}
                />
              </div>
            </InfoPanel>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <InfoPanel title="Evidence & Conversation" icon={Paperclip}>
              <div className="flex flex-col items-center justify-center py-10 text-center rounded-2xl border-2 border-dashed border-border bg-muted/5">
                <Paperclip className="h-12 w-12 text-muted-foreground/40" />
                <h4 className="mt-4 font-bold text-foreground">No evidence files attached</h4>
                <p className="mt-2 max-w-xs text-sm text-muted-foreground leading-relaxed">
                  Images, videos, PDFs, screenshots, and admin notes will appear here when the evidence table is connected.
                </p>
              </div>
              <div className="mt-6 rounded-2xl border border-border bg-primary/5 p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Conversation Timeline</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Customer/provider messages and admin notes are ready to display once message
                  history is exposed to this admin loader.
                </p>
              </div>
            </InfoPanel>

            <InfoPanel title="Resolution Actions" icon={ShieldCheck}>
              <div className="grid gap-3 sm:grid-cols-3">
                <Button
                  type="button"
                  size="lg"
                  variant={dispute.status === "OPEN" ? "default" : "outline"}
                  disabled={pending}
                  className="rounded-xl h-14"
                  onClick={() => onStatusChange(dispute, "OPEN")}
                >
                  Mark Open
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant={dispute.status === "UNDER_REVIEW" ? "default" : "outline"}
                  disabled={pending}
                  className="rounded-xl h-14"
                  onClick={() => onStatusChange(dispute, "UNDER_REVIEW")}
                >
                  Under Review
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant={dispute.status === "RESOLVED" ? "default" : "outline"}
                  disabled={pending}
                  className="rounded-xl h-14"
                  onClick={() => onStatusChange(dispute, "RESOLVED")}
                >
                  Mark Resolved
                </Button>
              </div>
              <div className="mt-6 rounded-2xl border border-border bg-amber-50 p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-2">
                  Admin Note
                </p>
                <p className="text-sm text-amber-900/70 leading-relaxed">
                  Carefully review all evidence and party statements before finalizing the resolution status. Status changes are logged for auditing.
                </p>
              </div>
            </InfoPanel>
          </div>

          <div className="mt-8">
            <InfoPanel title="Resolution History" icon={ListChecks}>
              <ActivityLogRows
                rows={[
                  {
                    date: dispute.createdAt,
                    user: dispute.reporterName,
                    role: formatEnum(dispute.reporterRole),
                    action: "Opened dispute",
                    description: dispute.message,
                  },
                  {
                    date: dispute.updatedAt,
                    user: "Admin/System",
                    role: "Admin",
                    action: "Updated status",
                    description: `Current status: ${formatEnum(dispute.status)}`,
                  },
                ]}
              />
            </InfoPanel>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof BriefcaseBusiness;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-lg font-bold tracking-tight text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="h-10 rounded-xl shadow-sm bg-background w-full sm:w-44">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {values.map((option) => (
          <SelectItem key={option} value={option}>
            {option === "ALL" ? `All ${label}` : formatEnum(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ActiveFilterPill({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
      {label}
      <button
        type="button"
        onClick={onClear}
        className="rounded-full p-0.5 hover:bg-primary/10 transition-colors"
        aria-label="Clear quick filter"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function ActivityLogRows({
  rows,
}: {
  rows: Array<{
    date: string | null;
    user: string;
    role: string;
    action: string;
    description: string;
  }>;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[680px] text-sm">
        <thead className="bg-muted/50 text-[10px] uppercase tracking-widest text-muted-foreground">
          <tr>
            <th className="px-6 py-4 text-left font-bold">Date</th>
            <th className="px-6 py-4 text-left font-bold">User</th>
            <th className="px-6 py-4 text-left font-bold">Role</th>
            <th className="px-6 py-4 text-left font-bold">Action</th>
            <th className="px-6 py-4 text-left font-bold">Description</th>
            <th className="px-6 py-4 text-left font-bold">IP Address</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, index) => (
            <tr key={`${row.action}-${index}`} className="hover:bg-muted/30 transition-colors">
              <td className="px-6 py-4 text-muted-foreground tabular-nums">{formatDateTime(row.date)}</td>
              <td className="px-6 py-4 font-medium text-foreground">{row.user}</td>
              <td className="px-6 py-4">
                <Badge variant="outline" className="rounded-lg text-[10px] uppercase tracking-wider">{row.role}</Badge>
              </td>
              <td className="px-6 py-4 font-bold text-primary">{row.action}</td>
              <td className="px-6 py-4 text-muted-foreground leading-relaxed max-w-xs truncate">{row.description}</td>
              <td className="px-6 py-4 text-muted-foreground/60 italic text-xs">Not logged</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InfoLine({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-background p-4 shadow-sm hover:border-primary/20 transition-colors">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5 text-primary/60" />
        <span>{label}</span>
      </div>
      <p className="mt-1 break-words text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

function TimelineRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background px-5 py-3 text-sm shadow-sm">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span className="text-right font-bold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function FileRow({
  title,
  subtitle,
  href,
}: {
  title: string;
  subtitle: string;
  href?: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background p-4 shadow-sm hover:border-primary/30 transition-all group">
      <div className="min-w-0 flex items-center gap-4">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
          <Paperclip className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">{subtitle}</p>
        </div>
      </div>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-sm font-bold text-primary hover:underline px-4 py-2 rounded-xl hover:bg-primary/10 transition-colors"
        >
          View File
        </a>
      ) : null}
    </div>
  );
}

function AttachmentJsonList({ value, uploadedBy }: { value: string | null; uploadedBy: string }) {
  const files = parseAttachmentJson(value);

  if (!files.length) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      {files.map((file, index) => (
        <FileRow
          key={`${file.fileName}-${index}`}
          title={file.fileName || `Attachment ${index + 1}`}
          subtitle={`Uploaded by ${uploadedBy}${file.fileSize ? ` · ${formatFileSize(file.fileSize)}` : ""}`}
          href={file.fileUrl || file.fileDataUrl || null}
        />
      ))}
    </div>
  );
}

function getPageStats(jobs: AdminJobRecord[], disputes: AdminDisputeRecord[]) {
  const unresolvedDisputes = disputes.filter((dispute) => dispute.status !== "RESOLVED");
  const disputedJobIds = new Set(
    disputes.map((dispute) => dispute.jobId).filter((id): id is number => id != null),
  );

  return {
    totalJobs: jobs.length,
    pendingJobs: jobs.filter(
      (job) => job.status === "DRAFT" || (!job.trackingId && job.status !== "OPEN"),
    ).length,
    openJobs: jobs.filter((job) => job.status === "OPEN").length,
    assignedJobs: jobs.filter((job) => Boolean(job.trackingId)).length,
    inProgressJobs: jobs.filter((job) => job.trackingStatus === "ACTIVE").length,
    completedJobs: jobs.filter(
      (job) => job.status === "CLOSED" || job.trackingStatus === "COMPLETED",
    ).length,
    cancelledJobs: jobs.filter(
      (job) => job.status === "CANCELLED" || job.trackingStatus === "CANCELLED",
    ).length,
    disputedJobs: jobs.filter((job) => disputedJobIds.has(job.id)).length,
    totalDisputes: disputes.length,
    openDisputes: unresolvedDisputes.length,
    newDisputes: disputes.filter((dispute) => dispute.status === "OPEN").length,
    underReviewDisputes: disputes.filter((dispute) => dispute.status === "UNDER_REVIEW").length,
    resolvedDisputes: disputes.filter((dispute) => dispute.status === "RESOLVED").length,
    highPriorityDisputes: unresolvedDisputes.filter((dispute) => dispute.priority === "HIGH")
      .length,
  };
}

function filterJobs(
  jobs: AdminJobRecord[],
  disputes: AdminDisputeRecord[],
  query: string,
  filters: JobFilters,
  quickFilter: JobQuickFilter | null,
) {
  const term = query.trim().toLowerCase();
  const disputedJobIds = new Set(
    disputes.map((dispute) => dispute.jobId).filter((id): id is number => id != null),
  );

  return jobs.filter((job) => {
    const searchable = [
      String(job.id),
      job.title,
      job.description,
      job.category,
      job.status,
      job.clientName,
      job.clientEmail,
      job.professionalName,
      job.professionalEmail,
      job.trackingStatus,
      job.locationLabel,
      job.locationAddress,
      job.workMode,
    ]
      .join(" ")
      .toLowerCase();
    const statusValues = [job.status, job.trackingStatus].filter(Boolean).map(String);

    if (term && !searchable.includes(term)) return false;
    if (
      filters.customer.trim() &&
      !`${job.clientName} ${job.clientEmail}`
        .toLowerCase()
        .includes(filters.customer.trim().toLowerCase())
    )
      return false;
    if (
      filters.provider.trim() &&
      !`${job.professionalName || ""} ${job.professionalEmail || ""}`
        .toLowerCase()
        .includes(filters.provider.trim().toLowerCase())
    )
      return false;
    if (filters.category !== "ALL" && job.category !== filters.category) return false;
    if (filters.status !== "ALL" && !statusValues.includes(filters.status)) return false;
    if (filters.paymentStatus !== "ALL" && getPaymentStatus(job) !== filters.paymentStatus)
      return false;
    if (!matchesJobQuickFilter(job, quickFilter, disputedJobIds)) return false;

    return true;
  });
}

function filterDisputes(
  disputes: AdminDisputeRecord[],
  query: string,
  filters: DisputeFilters,
  quickFilter: DisputeQuickFilter | null,
) {
  const term = query.trim().toLowerCase();

  return disputes.filter((dispute) => {
    const searchable = [
      String(dispute.id),
      dispute.jobId ? String(dispute.jobId) : "",
      dispute.jobTitle,
      dispute.issueType,
      dispute.priority,
      dispute.status,
      dispute.message,
      dispute.reporterRole,
      dispute.reporterName,
      dispute.reporterEmail,
      dispute.clientName,
      dispute.clientEmail,
      dispute.professionalName,
      dispute.professionalEmail,
    ]
      .join(" ")
      .toLowerCase();

    if (term && !searchable.includes(term)) return false;
    if (filters.status !== "ALL" && dispute.status !== filters.status) return false;
    if (filters.priority !== "ALL" && dispute.priority !== filters.priority) return false;
    if (
      filters.customer.trim() &&
      !`${dispute.clientName} ${dispute.clientEmail}`
        .toLowerCase()
        .includes(filters.customer.trim().toLowerCase())
    )
      return false;
    if (
      filters.provider.trim() &&
      !`${dispute.professionalName} ${dispute.professionalEmail}`
        .toLowerCase()
        .includes(filters.provider.trim().toLowerCase())
    )
      return false;
    if (!matchesDisputeQuickFilter(dispute, quickFilter)) return false;

    return true;
  });
}

function matchesJobQuickFilter(
  job: AdminJobRecord,
  quickFilter: JobQuickFilter | null,
  disputedJobIds: Set<number>,
) {
  if (!quickFilter || quickFilter === "TOTAL") return true;
  if (quickFilter === "PENDING")
    return job.status === "DRAFT" || (!job.trackingId && job.status !== "OPEN");
  if (quickFilter === "OPEN") return job.status === "OPEN";
  if (quickFilter === "ASSIGNED") return Boolean(job.trackingId);
  if (quickFilter === "IN_PROGRESS") return job.trackingStatus === "ACTIVE";
  if (quickFilter === "COMPLETED")
    return job.status === "CLOSED" || job.trackingStatus === "COMPLETED";
  if (quickFilter === "CANCELLED")
    return job.status === "CANCELLED" || job.trackingStatus === "CANCELLED";
  if (quickFilter === "DISPUTED") return disputedJobIds.has(job.id);
  return true;
}

function matchesDisputeQuickFilter(
  dispute: AdminDisputeRecord,
  quickFilter: DisputeQuickFilter | null,
) {
  if (!quickFilter || quickFilter === "TOTAL") return true;
  if (quickFilter === "OPEN_ALL")
    return dispute.status === "OPEN" || dispute.status === "UNDER_REVIEW";
  if (quickFilter === "NEW") return dispute.status === "OPEN";
  if (quickFilter === "UNDER_REVIEW") return dispute.status === "UNDER_REVIEW";
  if (quickFilter === "WAITING_CUSTOMER" || quickFilter === "WAITING_PROVIDER") return false;
  if (quickFilter === "RESOLVED" || quickFilter === "CLOSED") return dispute.status === "RESOLVED";
  return true;
}

function getDisputeStatusVariant(status: string) {
  if (status === "OPEN") {
    return "destructive";
  }

  if (status === "UNDER_REVIEW") {
    return "secondary";
  }

  return "outline";
}

function getPaymentStatus(job: AdminJobRecord) {
  if (job.trackingStatus === "COMPLETED" || job.status === "CLOSED") {
    return "PAID";
  }

  if (job.status === "CANCELLED" || job.trackingStatus === "CANCELLED") {
    return "REFUND_DUE";
  }

  return "PENDING";
}

function getJobStatusBadges(job: AdminJobRecord) {
  if (job.status === "CLOSED" || job.trackingStatus === "COMPLETED") {
    return [{ label: "Closed", variant: "outline" as const }];
  }

  if (job.status === "CANCELLED" || job.trackingStatus === "CANCELLED") {
    return [{ label: "Cancelled", variant: "destructive" as const }];
  }

  if (job.status === "OPEN") {
    return [
      { label: "Open", variant: "default" as const },
      { label: "Active", variant: "secondary" as const },
    ];
  }

  if (job.trackingStatus) {
    return [{ label: formatEnum(job.trackingStatus), variant: "secondary" as const }];
  }

  return [{ label: formatEnum(job.status), variant: "outline" as const }];
}

function uniqueOptions(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function parseAttachmentJson(value: string | null) {
  if (!value) {
    return [] as Array<{
      fileName?: string;
      fileUrl?: string | null;
      fileDataUrl?: string | null;
      fileSize?: number | null;
    }>;
  }

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((file) => file && typeof file === "object")
      .map((file) => ({
        fileName: typeof file.fileName === "string" ? file.fileName : "Attachment",
        fileUrl: typeof file.fileUrl === "string" ? file.fileUrl : null,
        fileDataUrl: typeof file.fileDataUrl === "string" ? file.fileDataUrl : null,
        fileSize: typeof file.fileSize === "number" ? file.fileSize : null,
      }));
  } catch {
    return [];
  }
}
