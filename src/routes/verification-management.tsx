import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, Link, useLoaderData, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileBadge,
  FileCheck2,
  FileText,
  IdCard,
  ImageIcon,
  MapPin,
  Search,
  ShieldCheck,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReportExportActions } from "@/components/ReportExportActions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSummaryCard } from "@/components/admin/AdminSummaryCard";
import { AdminSection } from "@/components/admin/AdminSection";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import {
  formatDateTime,
  formatEnum,
} from "@/lib/admin-formatters";
import { getCurrentUser } from "@/lib/current-user.server";
import {
  getAdminVerificationRecords,
  updateProfessionalVerificationStatusByAdmin,
  type AdminVerificationRecord,
  type ProfessionalVerificationInfo,
} from "@/lib/pro-verification-db.server";
import { cn } from "@/lib/utils";

type VerificationStatus = ProfessionalVerificationInfo["status"];
type StatusFilter = "all" | VerificationStatus;

const getVerificationManagementData = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = getCurrentUser();

  if (!viewer || viewer.role !== "ADMIN") {
    return {
      viewer,
      records: [],
    };
  }

  return {
    viewer,
    records: getAdminVerificationRecords(),
  };
});

const updateVerificationReviewStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: number; status: VerificationStatus }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "ADMIN") {
      throw new Error("Only admins can review professional verification.");
    }

    return updateProfessionalVerificationStatusByAdmin(data.userId, data.status);
  });

export const Route = createFileRoute("/verification-management")({
  loader: () => getVerificationManagementData(),
  head: () => ({ meta: [{ title: "Verification Management - Servio" }] }),
  component: VerificationManagement,
});

function VerificationManagement() {
  const data = useLoaderData({ from: "/verification-management" });
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ url: string; label: string } | null>(null);

  const records = data.records as AdminVerificationRecord[];
  const visibleRecords = useMemo(
    () => filterRecords(records, query, statusFilter),
    [records, query, statusFilter],
  );

  const handleClosePreview = useCallback(() => {
    setPreviewFile(null);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClosePreview();
      }
    };

    if (previewFile) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewFile, handleClosePreview]);

  if (!data.viewer || data.viewer.role !== "ADMIN") {
    return (
      <div className="grid min-h-screen place-items-center bg-muted/30 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
          <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
          <h1 className="mt-6 text-xl font-bold">Admin access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in from the admin panel to review professional verification.
          </p>
          <Button asChild className="mt-8 w-full">
            <Link to="/admin">Open admin panel</Link>
          </Button>
        </div>
      </div>
    );
  }

  const displayName =
    `${data.viewer.firstName} ${data.viewer.lastName}`.trim() || data.viewer.email;
  const counts = getStatusCounts(records);

  async function handleReview(record: AdminVerificationRecord, status: VerificationStatus) {
    const actionKey = `${status}-${record.userId}`;
    setPendingAction(actionKey);

    try {
      await updateVerificationReviewStatus({ data: { userId: record.userId, status } });
      await router.invalidate();
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <AppShell userName={displayName} userRole="Admin" userAvatarUrl={data.viewer.avatarUrl}>
      <AdminPageHeader
        title="Verification Management"
        description="Review professional identity documents and approve verified providers."
        breadcrumbs={[{ label: "Verification" }]}
        actions={
          <>
            <ReportExportActions
              table="User"
              reportName="Verification management export"
              filters={{ userType: "PROFESSIONAL" }}
              variant="outline"
            />
            <Button asChild variant="outline">
              <Link to="/user-management">User Management</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin">Back to admin</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <AdminSummaryCard
          icon={UserRound}
          label="Professionals"
          value={records.length}
          caption="Total accounts"
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
        />
        <AdminSummaryCard
          icon={Clock3}
          label="Pending"
          value={counts.pending}
          caption="Need review"
          active={statusFilter === "pending"}
          variant="warning"
          onClick={() => setStatusFilter("pending")}
        />
        <AdminSummaryCard
          icon={CheckCircle2}
          label="Approved"
          value={counts.approved}
          caption="Verified providers"
          active={statusFilter === "approved"}
          variant="success"
          onClick={() => setStatusFilter("approved")}
        />
        <AdminSummaryCard
          icon={XCircle}
          label="Rejected"
          value={counts.rejected}
          caption="Needs correction"
          active={statusFilter === "rejected"}
          variant="destructive"
          onClick={() => setStatusFilter("rejected")}
        />
        <AdminSummaryCard
          icon={FileText}
          label="Not Started"
          value={counts.not_started}
          caption="No documents"
          active={statusFilter === "not_started"}
          onClick={() => setStatusFilter("not_started")}
        />
      </div>

      <AdminSection
        className="mt-8"
        title="Professional Verification Requests"
        description="Search by professional name, email, category, city, or status."
        icon={BadgeCheck}
        actions={
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search..."
                className="pl-9 h-10 rounded-xl"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
              {(["all", "pending", "approved", "rejected"] as StatusFilter[]).map((status) => (
                <Button
                  key={status}
                  type="button"
                  size="sm"
                  variant={statusFilter === status ? "default" : "outline"}
                  className="rounded-lg h-10 px-4 font-bold uppercase tracking-widest text-[10px]"
                  onClick={() => setStatusFilter(status)}
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>
        }
      >
        {visibleRecords.length ? (
          <div className="divide-y divide-border">
            {visibleRecords.map((record) => {
              const statusMeta = getStatusMeta(record.status);
              const documents = getDocumentItems(record);

              return (
                <article key={record.userId} className="group p-6 transition-all hover:bg-muted/30">
                  <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <div className="relative shrink-0">
                          <img
                            src={record.avatarUrl || `https://i.pravatar.cc/100?u=verification-${record.userId}`}
                            className="h-16 w-16 rounded-2xl object-cover ring-4 ring-background shadow-lg"
                            alt=""
                          />
                          <div className={cn(
                            "absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-4 border-background shadow-md",
                            record.isVerified ? "bg-emerald-500" : "bg-slate-300"
                          )} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="truncate text-xl font-bold tracking-tight group-hover:text-primary transition-colors">{record.professionalName}</h3>
                            <Badge variant={statusMeta.variant} className="rounded-lg px-3 py-1 font-bold uppercase tracking-widest text-[10px]">{statusMeta.label}</Badge>
                            <Badge variant={record.isActive ? "default" : "outline"} className="rounded-lg px-3 py-1 font-bold uppercase tracking-widest text-[10px]">
                              {record.isActive ? "Active Account" : "Inactive Account"}
                            </Badge>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground font-medium">
                            <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary/60" />{record.professionalEmail}</span>
                            <span className="flex items-center gap-2">
                              <FileBadge className="h-4 w-4 text-primary/60" />
                              {record.professionalCategory || "Category not set"}
                            </span>
                            <span className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-primary/60" />
                              {record.professionalCity || "City not set"}
                            </span>
                            <span className="flex items-center gap-2">
                              <Clock3 className="h-4 w-4 text-primary/60" />
                              Updated {formatDateTime(record.updatedAt)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        {documents.map((document) => (
                          <div
                            key={document.label}
                            className="group/doc relative rounded-2xl border border-border bg-background p-4 shadow-sm hover:border-primary/40 hover:shadow-md transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary group-hover/doc:bg-primary group-hover/doc:text-white transition-colors">
                                <document.icon className="h-4 w-4" />
                              </div>
                              <p className="min-w-0 truncate text-xs font-bold uppercase tracking-widest">
                                {document.label}
                              </p>
                            </div>
                            <div className="mt-4 flex items-center justify-between gap-2">
                              <Badge variant={document.hasValue ? "default" : "outline"} className="rounded-lg text-[9px] uppercase tracking-wider">
                                {document.hasValue ? "Uploaded" : "Missing"}
                              </Badge>
                              {document.href ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  type="button"
                                  className="h-8 rounded-lg font-bold text-[11px] text-primary hover:bg-primary/10"
                                  onClick={() =>
                                    setPreviewFile({ url: document.href, label: document.label })
                                  }
                                >
                                  Preview
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-3 xl:w-64 xl:flex-col bg-muted/30 p-4 rounded-2xl border border-border/50 shadow-inner">
                      <p className="w-full text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80 mb-1 px-1">Admin Decision</p>
                      <Button
                        type="button"
                        className="gap-2 h-12 rounded-xl font-bold shadow-md hover:shadow-lg transition-all"
                        disabled={pendingAction !== null || record.status === "approved"}
                        onClick={() => handleReview(record, "approved")}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Approve Provider
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        className="gap-2 h-12 rounded-xl font-bold shadow-md hover:shadow-lg transition-all"
                        disabled={pendingAction !== null || record.status === "rejected"}
                        onClick={() => handleReview(record, "rejected")}
                      >
                        <XCircle className="h-4 w-4" />
                        Reject Request
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2 h-12 rounded-xl font-bold transition-all"
                        disabled={pendingAction !== null || record.status === "pending"}
                        onClick={() => handleReview(record, "pending")}
                      >
                        <Clock3 className="h-4 w-4" />
                        Mark as Pending
                      </Button>
                      {pendingAction?.endsWith(`-${record.userId}`) && (
                        <p className="mt-1 text-center text-[10px] font-bold text-primary animate-pulse uppercase tracking-widest">Processing review...</p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <AdminEmptyState
            title="No verification records found"
            description="Documents submitted for review will appear here. Try adjusting your search or filters."
          />
        )}
      </AdminSection>

      {previewFile ? (
        <FilePreviewModal
          url={previewFile.url}
          label={previewFile.label}
          onClose={handleClosePreview}
        />
      ) : null}
    </AppShell>
  );
}

function FilePreviewModal({
  url,
  label,
  onClose,
}: {
  url: string;
  label: string;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const previewType = getPreviewType(url);

  const handleOverlayClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target === overlayRef.current) {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative flex max-h-[95vh] w-full max-w-5xl flex-col rounded-3xl bg-background shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-white">
              <BadgeCheck className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-bold tracking-tight">{label}</h2>
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              type="button"
              className="rounded-xl h-9 font-bold px-4"
              onClick={() => openDocumentInNewTab(url)}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Full Size
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-8 custom-scrollbar bg-slate-50/50">
          {previewType === "image" ? (
            <div className="flex h-full items-center justify-center p-4">
              <img
                src={url}
                alt={label}
                className="max-h-[75vh] max-w-full rounded-2xl object-contain shadow-xl ring-1 ring-border"
              />
            </div>
          ) : previewType === "pdf" ? (
            <iframe src={`${url}#toolbar=1`} title={label} className="h-[75vh] w-full rounded-2xl shadow-xl ring-1 ring-border bg-white" />
          ) : (
            <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
              <div className="grid h-24 w-24 place-items-center rounded-3xl bg-muted text-muted-foreground/40">
                <FileText className="h-12 w-12" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Preview not available</h3>
                <p className="mt-2 text-muted-foreground font-medium">
                  This file format cannot be displayed directly. Open it in a new tab to view it.
                </p>
              </div>
              <Button type="button" size="lg" className="rounded-xl px-8 font-bold" onClick={() => openDocumentInNewTab(url)}>
                <ExternalLink className="mr-2 h-5 w-5" />
                Open In New Tab
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getPreviewType(url: string) {
  const normalized = url.trim().toLowerCase();

  if (
    normalized.startsWith("data:image/") ||
    /\.(jpe?g|png|gif|bmp|webp|svg)(\?|#|$)/i.test(normalized)
  ) {
    return "image";
  }

  if (normalized.startsWith("data:application/pdf") || /\.pdf(\?|#|$)/i.test(normalized)) {
    return "pdf";
  }

  return "other";
}

function openDocumentInNewTab(url: string) {
  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return;
  }

  if (!trimmedUrl.startsWith("data:")) {
    window.open(trimmedUrl, "_blank", "noopener,noreferrer");
    return;
  }

  try {
    const blob = dataUrlToBlob(trimmedUrl);
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch {
    window.open(trimmedUrl, "_blank", "noopener,noreferrer");
  }
}

function dataUrlToBlob(dataUrl: string) {
  const [header, payload] = dataUrl.split(",", 2);
  const mimeType = header.match(/^data:([^;]+)/)?.[1] || "application/octet-stream";
  const isBase64 = /;base64$/i.test(header) || /;base64;/i.test(header);
  const binary = isBase64 ? atob(payload || "") : decodeURIComponent(payload || "");
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function getDocumentItems(record: AdminVerificationRecord) {
  return [
    {
      label: "Government ID",
      icon: IdCard,
      href: record.governmentIdUrl,
      hasValue: Boolean(record.governmentIdUrl),
    },
    {
      label: "License",
      icon: FileBadge,
      href: record.licenseUrl,
      hasValue: Boolean(record.licenseUrl),
    },
    {
      label: "Certifications",
      icon: FileCheck2,
      href: record.certifications[0] || "",
      hasValue: record.certifications.length > 0,
    },
    {
      label: "Insurance",
      icon: FileText,
      href: record.insuranceUrl,
      hasValue: Boolean(record.insuranceUrl),
    },
    {
      label: "Selfie",
      icon: ImageIcon,
      href: record.selfieUrl,
      hasValue: Boolean(record.selfieUrl),
    },
  ];
}

function getStatusCounts(records: AdminVerificationRecord[]) {
  return records.reduce(
    (counts, record) => ({
      ...counts,
      [record.status]: counts[record.status] + 1,
    }),
    {
      not_started: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    } satisfies Record<VerificationStatus, number>,
  );
}

function filterRecords(
  records: AdminVerificationRecord[],
  query: string,
  statusFilter: StatusFilter,
) {
  const term = query.trim().toLowerCase();

  return records.filter((record) => {
    const matchesStatus = statusFilter === "all" || record.status === statusFilter;

    if (!matchesStatus) {
      return false;
    }

    if (!term) {
      return true;
    }

    return [
      record.professionalName,
      record.professionalEmail,
      record.professionalCategory,
      record.professionalCity,
      record.status,
      record.isActive ? "active" : "inactive",
      record.isVerified ? "verified" : "not verified",
      ...record.certifications,
      record.governmentIdUrl,
      record.licenseUrl,
      record.insuranceUrl,
      record.selfieUrl,
    ]
      .join(" ")
      .toLowerCase()
      .includes(term);
  });
}

function getStatusMeta(status: VerificationStatus) {
  const labels = {
    not_started: "Not started",
    pending: "Pending review",
    approved: "Approved",
    rejected: "Rejected",
  };

  return {
    label: labels[status],
    variant: status === "approved" ? "default" : status === "pending" ? "secondary" : "outline",
  } as const;
}
