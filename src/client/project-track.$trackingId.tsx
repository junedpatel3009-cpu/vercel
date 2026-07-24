import type { ComponentType, ChangeEvent, FormEvent } from "react";
import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, Link, redirect, useLoaderData, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bell,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  MapPin,
  MessageSquare,
  ReceiptText,
  RotateCcw,
  Send,
  Star,
  Timer,
  Upload,
  UserRound,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/current-user.server";
import {
  createProjectRevisionRequest,
  createProjectMilestone,
  createProjectDispute,
  createProjectWorkUpload,
  deleteProjectMilestone,
  deleteProjectRevisionRequest,
  deleteProjectWorkUpload,
  getOrCreateProjectTrackingDetails,
  rateCompletedProject,
  submitProjectCompletion,
  updateProjectMilestoneStatus,
  updateProjectCompletionStatus,
  type ProjectCompletionRequestRecord,
  type ProjectCompletionStatus,
  type ProjectDisputePriority,
  type ProjectDisputeRecord,
  type ProjectDisputeType,
  type ProjectMilestoneRecord,
  type ProjectMilestoneStatus,
  type ProjectRevisionRequestRecord,
  type ProjectWorkUploadRecord,
} from "@/lib/project-request-db.server";

const REQUIRED_PROJECT_MILESTONES = 5;

const getTrackingPageData = createServerFn({ method: "GET" })
  .inputValidator((trackingKey: string) => trackingKey)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();
    const trackingKey = Number(data);

    if (!viewer) {
      return null;
    }

    if (!Number.isInteger(trackingKey) || trackingKey <= 0) {
      return {
        viewer,
        tracking: null,
      };
    }

    const tracking = getOrCreateProjectTrackingDetails(viewer.id, trackingKey);

    return {
      viewer,
      tracking,
    };
  });

const uploadProjectWork = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      trackingId: number;
      title?: string;
      note?: string;
      fileName?: string | null;
      fileUrl?: string | null;
      files?: Array<{
        fileName: string;
        fileUrl?: string | null;
        fileDataUrl?: string | null;
        fileType?: string | null;
        fileSize?: number | null;
      }>;
    }) => input,
  )
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "PROFESSIONAL") {
      throw new Error("Only professionals can upload project work.");
    }

    return createProjectWorkUpload(viewer.id, data);
  });

const deleteUploadedWork = createServerFn({ method: "POST" })
  .inputValidator((input: { uploadId: number }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "PROFESSIONAL") {
      throw new Error("Only professionals can delete uploaded work.");
    }

    return deleteProjectWorkUpload(viewer.id, data.uploadId);
  });

const requestProjectRevision = createServerFn({ method: "POST" })
  .inputValidator((input: { trackingId: number; note: string }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "CLIENT") {
      throw new Error("Only clients can request revisions.");
    }

    return createProjectRevisionRequest(viewer.id, data);
  });

const clearProjectRevision = createServerFn({ method: "POST" })
  .inputValidator((input: { revisionId: number }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "CLIENT") {
      throw new Error("Only clients can clear revision requests.");
    }

    return deleteProjectRevisionRequest(viewer.id, data.revisionId);
  });

const addProjectMilestone = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      trackingId: number;
      title: string;
      description?: string | null;
      amount?: number | null;
      dueDate?: string | null;
    }) => input,
  )
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "CLIENT") {
      throw new Error("Only clients can add milestones.");
    }

    return createProjectMilestone(viewer.id, data);
  });

const changeMilestoneStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { milestoneId: number; status: ProjectMilestoneStatus }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer) {
      throw new Error("Please log in to update milestones.");
    }

    return updateProjectMilestoneStatus(viewer.id, data.milestoneId, data.status);
  });

const removeProjectMilestone = createServerFn({ method: "POST" })
  .inputValidator((input: { milestoneId: number }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "CLIENT") {
      throw new Error("Only clients can delete milestones.");
    }

    return deleteProjectMilestone(viewer.id, data.milestoneId);
  });

const submitFinalWork = createServerFn({ method: "POST" })
  .inputValidator((input: { trackingId: number; note?: string | null }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "PROFESSIONAL") {
      throw new Error("Only professionals can submit finished work.");
    }

    return submitProjectCompletion(viewer.id, data);
  });

const reviewFinalWork = createServerFn({ method: "POST" })
  .inputValidator((input: { completionId: number; status: ProjectCompletionStatus }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "CLIENT") {
      throw new Error("Only clients can review finished work.");
    }

    return updateProjectCompletionStatus(viewer.id, data.completionId, data.status);
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

const raiseProjectDispute = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      trackingId: number;
      issueType: ProjectDisputeType;
      priority: ProjectDisputePriority;
      message: string;
      attachments?: Array<{
        fileName: string;
        fileType?: string | null;
        fileSize?: number | null;
        fileUrl?: string | null;
      }>;
    }) => input,
  )
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer) {
      throw new Error("Please log in to raise a dispute.");
    }

    return createProjectDispute(viewer.id, viewer.role, data);
  });

export const Route = createFileRoute("/project-track/$trackingId")({
  loader: async ({ location, params }) => {
    const result = await getTrackingPageData({ data: params.trackingId });

    if (!result) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }

    return result;
  },
  head: () => ({ meta: [{ title: "Track project - Servio" }] }),
  component: ProjectTrack,
});

function ProjectTrack() {
  const { viewer, tracking } = useLoaderData({ from: "/project-track/$trackingId" });
  const router = useRouter();
  const isProfessional = viewer.role === "PROFESSIONAL";
  const displayName = `${viewer.firstName} ${viewer.lastName}`.trim();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const milestoneListRef = useRef<HTMLDivElement | null>(null);
  const [uploadFiles, setUploadFiles] = useState<
    Array<{
      fileName: string;
      fileUrl: string;
      fileDataUrl: string;
      fileType: string;
      fileSize: number;
    }>
  >([]);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingUploadId, setDeletingUploadId] = useState<number | null>(null);
  const [revisionNote, setRevisionNote] = useState("");
  const [isRequestingRevision, setIsRequestingRevision] = useState(false);
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [clearingRevisionId, setClearingRevisionId] = useState<number | null>(null);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDescription, setMilestoneDescription] = useState("");
  const [milestoneDueDate, setMilestoneDueDate] = useState("");
  const [milestoneError, setMilestoneError] = useState<string | null>(null);
  const [isSavingMilestone, setIsSavingMilestone] = useState(false);
  const [updatingMilestoneId, setUpdatingMilestoneId] = useState<number | null>(null);
  const [completionNote, setCompletionNote] = useState("");
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);
  const [reviewingCompletionId, setReviewingCompletionId] = useState<number | null>(null);
  const [reviewDraft, setReviewDraft] = useState<{ rating: number; comment: string } | null>(null);
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [disputeIssueType, setDisputeIssueType] = useState<ProjectDisputeType>("WORK_QUALITY");
  const [disputePriority, setDisputePriority] = useState<ProjectDisputePriority>("MEDIUM");
  const [disputeMessage, setDisputeMessage] = useState("");
  const [disputeFiles, setDisputeFiles] = useState<
    Array<{
      fileName: string;
      fileType: string | null;
      fileSize: number | null;
      fileUrl: string | null;
    }>
  >([]);
  const [isRaisingDispute, setIsRaisingDispute] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(new Date()), 60000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!tracking) {
      return;
    }

    const socket = io(getSocketUrl(), {
      auth: {
        userId: viewer.id,
        role: viewer.role,
        name: displayName || viewer.email,
        avatarUrl: viewer.avatarUrl,
      },
    });

    socketRef.current = socket;
    socket.emit("project:join", { trackingId: tracking.id });
    socket.on("project:activity", (payload: { actorId?: number; trackingId?: number }) => {
      if (payload?.actorId !== viewer.id && payload?.trackingId === tracking.id) {
        void router.invalidate();
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [displayName, router, tracking?.id, viewer.avatarUrl, viewer.email, viewer.id, viewer.role]);

  if (!tracking) {
    return (
      <AppShell
        userName={displayName}
        userRole={isProfessional ? "Professional" : "Client"}
        userAvatarUrl={viewer.avatarUrl}
      >
        <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-8 text-center shadow-soft">
          <Briefcase className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-semibold">No active project tracking</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Tracking starts after the client accepts a professional request. Accept a request from
            Projects, then open Track project again.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to={isProfessional ? "/professional-stats" : "/projects"}>
                {isProfessional ? "Go to my stats" : "Go to projects"}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={isProfessional ? "/professional-messages" : "/messages"}>
                Open messages
              </Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  const expectedWeeks = parseDurationWeeks(tracking.duration);
  const expectedDays = expectedWeeks ? expectedWeeks * 7 : null;
  const elapsedDays = getElapsedDays(tracking.acceptedAt, currentTime);
  const remainingDays = expectedDays == null ? null : Math.max(0, expectedDays - elapsedDays);
  const progress = expectedDays ? Math.min(100, Math.round((elapsedDays / expectedDays) * 100)) : 0;
  const displayProgress = tracking.status === "COMPLETED" ? 100 : progress;
  const projectValue = tracking.bidAmount ?? 0;
  const scheduleStartInput = getDateInputValue(tracking.projectJobDate || tracking.acceptedAt);
  const scheduleEndInput = getDateInputValue(tracking.projectDeadline);
  const canStartProject =
    !scheduleStartInput ||
    compareDateInputs(getDateInputValue(currentTime.toISOString()), scheduleStartInput) >= 0;
  const displayMilestones = tracking.milestones.slice(0, REQUIRED_PROJECT_MILESTONES);
  const nextMilestoneNumber = Math.min(tracking.milestones.length + 1, REQUIRED_PROJECT_MILESTONES);
  const isMilestonePlanComplete = tracking.milestones.length >= REQUIRED_PROJECT_MILESTONES;
  const requiredMilestoneAmount = getRequiredMilestoneAmount(projectValue, nextMilestoneNumber);
  const completedMilestoneCount = tracking.milestones.filter(
    (milestone) => milestone.status === "PAID",
  ).length;
  const canSubmitFinalWork = completedMilestoneCount >= REQUIRED_PROJECT_MILESTONES;
  const milestonePaidAmount = tracking.milestones
    .filter((milestone) => milestone.status === "PAID")
    .reduce((total, milestone) => total + (milestone.amount ?? 0), 0);
  const paidAmount =
    tracking.status === "COMPLETED" ? projectValue : Math.min(projectValue, milestonePaidAmount);
  const remainingAmount = Math.max(0, projectValue - paidAmount);
  const requestAttachments = getRequestAttachments(tracking.attachmentsJson);
  const openRevisionRequests = tracking.revisionRequests.filter(
    (revision) => revision.status === "REQUESTED",
  );
  const latestRevisionRequest = tracking.revisionRequests.at(-1) ?? null;
  const latestCompletionRequest = tracking.completionRequests.at(-1) ?? null;
  const finalChangesLockAt =
    latestCompletionRequest?.status === "APPROVED"
      ? new Date(new Date(latestCompletionRequest.updatedAt).getTime() + 86400000).toISOString()
      : null;
  const projectActivityRecipientId = isProfessional ? tracking.clientId : tracking.professionalId;

  function emitProjectActivity(title: string, description?: string) {
    socketRef.current?.emit("project:activity", {
      trackingId: tracking.id,
      actorId: viewer.id,
      recipientId: projectActivityRecipientId,
      title,
      description,
      href: `/project-track/${tracking.id}`,
      createdAt: new Date().toISOString(),
    });
  }

  async function handleWorkUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tracking) {
      return;
    }

    setIsUploading(true);

    try {
      await uploadProjectWork({
        data: {
          trackingId: tracking.id,
          files: uploadFiles,
        },
      });
      setUploadFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      toast.success("Work uploaded");
      emitProjectActivity(
        "New work uploaded",
        `${displayName || "Professional"} uploaded work for ${tracking.projectTitle}.`,
      );
      await router.invalidate();
    } finally {
      setIsUploading(false);
    }
  }

  async function handleBrowseFiles(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);

    if (!selectedFiles.length) {
      return;
    }

    const loadedFiles = await Promise.all(
      selectedFiles.map(
        (file) =>
          new Promise<{
            fileName: string;
            fileUrl: string;
            fileDataUrl: string;
            fileType: string;
            fileSize: number;
          }>((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
              resolve({
                fileName: file.name,
                fileUrl: "",
                fileDataUrl: typeof reader.result === "string" ? reader.result : "",
                fileType: file.type || "application/octet-stream",
                fileSize: file.size,
              });
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }),
      ),
    );

    setUploadFiles((files) => [...files, ...loadedFiles]);
  }

  async function handleDisputeFiles(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);

    if (!selectedFiles.length) {
      return;
    }

    const loadedFiles = await Promise.all(
      selectedFiles.map(
        (file) =>
          new Promise<{
            fileName: string;
            fileType: string | null;
            fileSize: number | null;
            fileUrl: string | null;
          }>((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
              resolve({
                fileName: file.name,
                fileType: file.type || null,
                fileSize: file.size,
                fileUrl: typeof reader.result === "string" ? reader.result : null,
              });
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }),
      ),
    );

    setDisputeFiles((files) => [...files, ...loadedFiles]);
  }

  async function handleDeleteWorkUpload(uploadId: number) {
    setDeletingUploadId(uploadId);

    try {
      await deleteUploadedWork({ data: { uploadId } });
      toast.success("Work file deleted");
      emitProjectActivity(
        "Work file deleted",
        `${displayName || "Professional"} deleted a work file from ${tracking.projectTitle}.`,
      );
      await router.invalidate();
    } finally {
      setDeletingUploadId(null);
    }
  }

  async function handleRevisionRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tracking) {
      return;
    }

    if (revisionNote.trim().length < 5) {
      setRevisionError("Add a short revision note.");
      return;
    }

    setIsRequestingRevision(true);
    setRevisionError(null);

    try {
      await requestProjectRevision({
        data: {
          trackingId: tracking.id,
          note: revisionNote,
        },
      });
      setRevisionNote("");
      toast.success("Revision requested");
      emitProjectActivity(
        "Revision requested",
        `${displayName || "Client"} requested changes for ${tracking.projectTitle}.`,
      );
      await router.invalidate();
    } catch (error) {
      setRevisionError(error instanceof Error ? error.message : "Could not request revision.");
    } finally {
      setIsRequestingRevision(false);
    }
  }

  async function handleClearRevision(revisionId: number) {
    setClearingRevisionId(revisionId);

    try {
      await clearProjectRevision({ data: { revisionId } });
      toast.success("Revision cleared");
      emitProjectActivity(
        "Revision cleared",
        `${displayName || "Client"} cleared a revision request for ${tracking.projectTitle}.`,
      );
      await router.invalidate();
    } finally {
      setClearingRevisionId(null);
    }
  }

  async function handleAddMilestone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tracking) {
      return;
    }

    if (tracking.milestones.length >= REQUIRED_PROJECT_MILESTONES) {
      setMilestoneError("This project already has the required 5 milestones.");
      return;
    }

    const title =
      milestoneTitle.trim() || `Milestone ${nextMilestoneNumber}/${REQUIRED_PROJECT_MILESTONES}`;

    if (title.length < 3) {
      setMilestoneError("Add a milestone title.");
      return;
    }

    if (
      milestoneDueDate &&
      scheduleStartInput &&
      compareDateInputs(milestoneDueDate, scheduleStartInput) < 0
    ) {
      setMilestoneError("Milestone due date cannot be before the project start date.");
      return;
    }

    if (
      milestoneDueDate &&
      scheduleEndInput &&
      compareDateInputs(milestoneDueDate, scheduleEndInput) > 0
    ) {
      setMilestoneError("Milestone due date cannot be after the project deadline.");
      return;
    }

    setIsSavingMilestone(true);
    setMilestoneError(null);

    try {
      await addProjectMilestone({
        data: {
          trackingId: tracking.id,
          title,
          description: milestoneDescription || null,
          amount: requiredMilestoneAmount || null,
          dueDate: milestoneDueDate || null,
        },
      });
      setMilestoneTitle("");
      setMilestoneDescription("");
      setMilestoneDueDate("");
      toast.success(`Milestone ${nextMilestoneNumber}/${REQUIRED_PROJECT_MILESTONES} added`);
      emitProjectActivity(
        "Milestone added",
        `${displayName || "Client"} added "${title}" to ${tracking.projectTitle}.`,
      );
      await router.invalidate();
      window.requestAnimationFrame(() =>
        milestoneListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    } catch (error) {
      setMilestoneError(error instanceof Error ? error.message : "Could not add milestone.");
    } finally {
      setIsSavingMilestone(false);
    }
  }

  async function handleMilestoneStatus(milestoneId: number, status: ProjectMilestoneStatus) {
    setUpdatingMilestoneId(milestoneId);
    const paidMilestoneCountAfterChange = tracking.milestones.filter((milestone) =>
      milestone.id === milestoneId ? status === "PAID" : milestone.status === "PAID",
    ).length;
    const willCompleteProject =
      status === "PAID" &&
      tracking.milestones.length >= REQUIRED_PROJECT_MILESTONES &&
      paidMilestoneCountAfterChange >= REQUIRED_PROJECT_MILESTONES;

    try {
      await changeMilestoneStatus({ data: { milestoneId, status } });
      if (willCompleteProject) {
        toast.success("Project completed");
        emitProjectActivity(
          "Project completed",
          `${displayName || "Client"} completed all 5 milestones for ${tracking.projectTitle}.`,
        );
      } else {
        toast.success(`Milestone ${formatMilestoneStatus(status).toLowerCase()}`);
        emitProjectActivity(
          `Milestone ${formatMilestoneStatus(status).toLowerCase()}`,
          `${displayName || "Someone"} updated a milestone in ${tracking.projectTitle}.`,
        );
      }
      await router.invalidate();
    } finally {
      setUpdatingMilestoneId(null);
    }
  }

  async function handleDeleteMilestone(milestoneId: number) {
    setUpdatingMilestoneId(milestoneId);

    try {
      await removeProjectMilestone({ data: { milestoneId } });
      toast.success("Milestone deleted");
      emitProjectActivity(
        "Milestone deleted",
        `${displayName || "Client"} deleted a milestone from ${tracking.projectTitle}.`,
      );
      await router.invalidate();
      window.requestAnimationFrame(() =>
        milestoneListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    } finally {
      setUpdatingMilestoneId(null);
    }
  }

  async function handleSubmitCompletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tracking) {
      return;
    }

    if (!canSubmitFinalWork) {
      toast.error(
        `Complete all ${REQUIRED_PROJECT_MILESTONES} milestones before final submission.`,
      );
      return;
    }

    setIsSubmittingCompletion(true);

    try {
      await submitFinalWork({
        data: {
          trackingId: tracking.id,
          note: completionNote || null,
        },
      });
      setCompletionNote("");
      toast.success("Final work submitted");
      emitProjectActivity(
        "Final work submitted",
        `${displayName || "Professional"} submitted final work for ${tracking.projectTitle}.`,
      );
      await router.invalidate();
    } finally {
      setIsSubmittingCompletion(false);
    }
  }

  async function handleReviewCompletion(completionId: number, status: ProjectCompletionStatus) {
    setReviewingCompletionId(completionId);

    try {
      await reviewFinalWork({ data: { completionId, status } });
      toast.success(status === "APPROVED" ? "Project completed" : "Revision requested");
      emitProjectActivity(
        status === "APPROVED" ? "Project completed" : "Final revision requested",
        `${displayName || "Client"} ${status === "APPROVED" ? "approved" : "requested changes to"} final work for ${tracking.projectTitle}.`,
      );
      await router.invalidate();
    } finally {
      setReviewingCompletionId(null);
    }
  }

  async function handleSaveProjectReview() {
    if (!tracking) {
      return;
    }

    const draft = reviewDraft ?? {
      rating: tracking.reviewRating ?? 5,
      comment: tracking.reviewComment ?? "",
    };

    setIsSavingReview(true);
    setReviewError(null);

    try {
      await rateProjectProfessional({
        data: {
          trackingId: tracking.id,
          rating: draft.rating,
          comment: draft.comment || null,
        },
      });
      await router.invalidate();
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Could not save review.");
    } finally {
      setIsSavingReview(false);
    }
  }

  async function handleRaiseDispute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tracking) {
      return;
    }

    if (disputeMessage.trim().length < 10) {
      setDisputeError("Add at least 10 characters describing the issue.");
      return;
    }

    setIsRaisingDispute(true);
    setDisputeError(null);

    try {
      await raiseProjectDispute({
        data: {
          trackingId: tracking.id,
          issueType: disputeIssueType,
          priority: disputePriority,
          message: disputeMessage,
          attachments: disputeFiles,
        },
      });
      setDisputeIssueType("WORK_QUALITY");
      setDisputePriority("MEDIUM");
      setDisputeMessage("");
      setDisputeFiles([]);
      toast.success("Dispute raised.");
      emitProjectActivity(
        "Dispute raised",
        `${displayName || "Someone"} raised a dispute for ${tracking.projectTitle}.`,
      );
      await router.invalidate();
    } catch (error) {
      setDisputeError(error instanceof Error ? error.message : "Could not raise dispute.");
    } finally {
      setIsRaisingDispute(false);
    }
  }

  return (
    <AppShell
      userName={displayName}
      userRole={isProfessional ? "Professional" : "Client"}
      userAvatarUrl={viewer.avatarUrl}
    >
      <div className="mb-5">
        <Link
          to={isProfessional ? "/professional-stats" : "/projects"}
          className="text-sm text-primary hover:underline"
        >
          Back to {isProfessional ? "my stats" : "projects"}
        </Link>
      </div>

      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{tracking.projectCategory}</Badge>
            <Badge>{formatEnum(tracking.status)}</Badge>
            <Badge variant="outline">Request {formatEnum(tracking.requestStatus)}</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">{tracking.projectTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isProfessional
              ? `Client: ${tracking.clientName}`
              : `Professional: ${tracking.professionalName}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to={isProfessional ? "/professional-messages" : "/messages"}>
              <MessageSquare className="h-4 w-4" />
              Message
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={DollarSign} label="Project value" value={formatMoney(projectValue)} />
        <Stat icon={Clock} label="Expected duration" value={tracking.duration || "Not set"} />
        <Stat
          icon={Timer}
          label="Time tracked"
          value={`${elapsedDays} day${elapsedDays === 1 ? "" : "s"}`}
        />
        <Stat icon={DollarSign} label="Remaining money" value={formatMoney(remainingAmount)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <h2 className="text-lg font-semibold">Project timeline</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Request, acceptance, tracking, work, and payment activity in one place.
                </p>
              </div>
              <Badge variant="secondary">Tracking #{tracking.id}</Badge>
            </div>
            <ProjectTimeline
              trackingStatus={tracking.status}
              requestStatus={tracking.requestStatus}
              requestCreatedAt={tracking.requestCreatedAt}
              requestUpdatedAt={tracking.requestUpdatedAt}
              acceptedAt={tracking.acceptedAt}
              progress={progress}
              remainingDays={remainingDays}
              workUploads={tracking.workUploads}
              revisionRequests={tracking.revisionRequests}
              completionRequests={tracking.completionRequests}
            />
          </section>

          <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <h2 className="text-lg font-semibold">Milestones</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Exactly 5 milestones are required. Project money is divided automatically.
                </p>
              </div>
              <Badge variant={isMilestonePlanComplete ? "default" : "secondary"}>
                {Math.min(tracking.milestones.length, REQUIRED_PROJECT_MILESTONES)}/
                {REQUIRED_PROJECT_MILESTONES} milestones
              </Badge>
            </div>
            {!isProfessional && !isMilestonePlanComplete ? (
              <MilestoneForm
                milestoneNumber={nextMilestoneNumber}
                requiredCount={REQUIRED_PROJECT_MILESTONES}
                title={milestoneTitle}
                description={milestoneDescription}
                amountLabel={formatMoney(requiredMilestoneAmount)}
                dueDate={milestoneDueDate}
                minDate={scheduleStartInput || undefined}
                maxDate={scheduleEndInput || undefined}
                error={milestoneError}
                isSaving={isSavingMilestone}
                onTitleChange={setMilestoneTitle}
                onDescriptionChange={setMilestoneDescription}
                onDueDateChange={setMilestoneDueDate}
                onSubmit={handleAddMilestone}
              />
            ) : null}
            <div ref={milestoneListRef}>
              <MilestoneList
                milestones={displayMilestones}
                requiredCount={REQUIRED_PROJECT_MILESTONES}
                isProfessional={isProfessional}
                canStartProject={canStartProject}
                projectStartLabel={formatScheduleDate(
                  tracking.projectJobDate || tracking.acceptedAt,
                )}
                updatingMilestoneId={updatingMilestoneId}
                onStatusChange={handleMilestoneStatus}
                onDelete={handleDeleteMilestone}
              />
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">Uploaded work</h2>
                  {!isProfessional && tracking.workUploads.length ? (
                    <span className="relative grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
                      <span className="absolute h-8 w-8 animate-ping rounded-full bg-primary/20" />
                      <Bell className="relative h-4 w-4" />
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isProfessional
                    ? "Files you upload here are visible to the client."
                    : tracking.workUploads.length
                      ? "New work files are available. Open them below."
                      : "Files uploaded by the professional will appear here."}
                </p>
              </div>
              <Badge
                variant={!isProfessional && tracking.workUploads.length ? "default" : "secondary"}
              >
                {tracking.workUploads.length} files
              </Badge>
            </div>
            <WorkFiles
              uploads={tracking.workUploads}
              isProfessional={isProfessional}
              deletingUploadId={deletingUploadId}
              onDelete={handleDeleteWorkUpload}
            />
            {!isProfessional ? (
              <RevisionRequestForm
                canRequest={tracking.status === "ACTIVE"}
                hasUploadedWork={tracking.workUploads.length > 0}
                note={revisionNote}
                error={revisionError}
                isSubmitting={isRequestingRevision}
                openRevisionCount={openRevisionRequests.length}
                onNoteChange={setRevisionNote}
                onSubmit={handleRevisionRequest}
              />
            ) : null}
          </section>

          <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <h2 className="text-lg font-semibold">Project details</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Saved job data and accepted proposal details from the database.
                </p>
              </div>
              <Badge variant={tracking.projectUrgency === "HIGH" ? "destructive" : "outline"}>
                {formatEnum(tracking.projectUrgency)} urgency
              </Badge>
            </div>
            <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {tracking.projectDescription}
            </p>
            <div className="mt-5 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
              <InfoLine
                icon={DollarSign}
                text={`Posted budget ${formatBudget(tracking.projectBudgetMin, tracking.projectBudgetMax, tracking.projectTimingType)}`}
              />
              <InfoLine
                icon={CalendarDays}
                text={`Start date ${formatScheduleDate(tracking.projectJobDate || tracking.acceptedAt)}`}
              />
              <InfoLine
                icon={CalendarDays}
                text={`End date ${formatScheduleDate(tracking.projectDeadline)}`}
              />
              <InfoLine icon={Briefcase} text={formatEnum(tracking.projectWorkMode)} />
              <InfoLine icon={MapPin} text={tracking.projectLocationLabel || "No location label"} />
              <InfoLine
                icon={MapPin}
                text={tracking.projectLocationAddress || "Remote or no location saved"}
                wide
              />
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-semibold">
                  {tracking.status === "COMPLETED" ? "Work completed" : "Work and time"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tracking.status === "COMPLETED"
                    ? "The client accepted the finished work."
                    : "Shows how much time passed after the client accepted this work."}
                </p>
              </div>
              <Badge variant="outline">
                {tracking.status === "COMPLETED" ? "100% complete" : `${progress}% time used`}
              </Badge>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${displayProgress}%` }}
              />
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <ProgressBox
                label="Start date"
                value={formatScheduleDate(tracking.projectJobDate || tracking.acceptedAt)}
              />
              <ProgressBox label="End date" value={formatScheduleDate(tracking.projectDeadline)} />
              <ProgressBox
                label={tracking.status === "COMPLETED" ? "Completed in" : "Days used"}
                value={`${elapsedDays} day${elapsedDays === 1 ? "" : "s"}`}
              />
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <h2 className="text-lg font-semibold">Money</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <ProgressBox label="Accepted bid" value={formatMoney(projectValue)} />
              <ProgressBox label="Paid amount" value={formatMoney(paidAmount)} />
              <ProgressBox label="Remaining amount" value={formatMoney(remainingAmount)} />
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <h2 className="text-lg font-semibold">Proposal details</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  The accepted request from the professional.
                </p>
              </div>
              <Badge variant="outline">Sent {formatDateTime(tracking.requestCreatedAt)}</Badge>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {tracking.coverLetter}
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <ProgressBox
                label="Professional bid"
                value={tracking.bidAmount ? formatMoney(tracking.bidAmount) : "Not set"}
              />
              <ProgressBox label="Proposed duration" value={tracking.duration || "Not set"} />
            </div>
            {requestAttachments.length ? (
              <div className="mt-5">
                <h3 className="text-sm font-medium">Attached work samples</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {requestAttachments.map((attachment) => (
                    <div
                      key={attachment.fileName}
                      className="flex items-center gap-3 rounded-lg border border-border p-3"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{attachment.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(attachment.fileSize)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="space-y-6">
          <CompletionPanel
            isProfessional={isProfessional}
            trackingStatus={tracking.status}
            latestCompletion={latestCompletionRequest}
            completedMilestoneCount={completedMilestoneCount}
            requiredMilestoneCount={REQUIRED_PROJECT_MILESTONES}
            canSubmitFinalWork={canSubmitFinalWork}
            note={completionNote}
            isSubmitting={isSubmittingCompletion}
            reviewingCompletionId={reviewingCompletionId}
            onNoteChange={setCompletionNote}
            onSubmit={handleSubmitCompletion}
            onReview={handleReviewCompletion}
          />

          <DisputePanel
            disputes={tracking.disputes}
            issueType={disputeIssueType}
            priority={disputePriority}
            message={disputeMessage}
            files={disputeFiles}
            error={disputeError}
            isSubmitting={isRaisingDispute}
            onIssueTypeChange={setDisputeIssueType}
            onPriorityChange={setDisputePriority}
            onMessageChange={setDisputeMessage}
            onFilesChange={handleDisputeFiles}
            onRemoveFile={(index) =>
              setDisputeFiles((files) => files.filter((_, fileIndex) => fileIndex !== index))
            }
            onSubmit={handleRaiseDispute}
          />

          {!isProfessional && tracking.status === "COMPLETED" ? (
            <ProjectReviewPanel
              professionalName={tracking.professionalName}
              reviewRating={tracking.reviewRating}
              reviewComment={tracking.reviewComment}
              reviewCreatedAt={tracking.reviewCreatedAt}
              reviewRequestedAt={tracking.reviewRequestedAt}
              reviewRequestNote={tracking.reviewRequestNote}
              draft={
                reviewDraft ?? {
                  rating: tracking.reviewRating ?? 5,
                  comment: tracking.reviewComment ?? "",
                }
              }
              isSaving={isSavingReview}
              error={reviewError}
              onDraftChange={setReviewDraft}
              onSave={handleSaveProjectReview}
            />
          ) : null}

          {isProfessional ? (
            <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Upload your work</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tracking.status === "COMPLETED"
                      ? "This project is completed. Uploaded work is now shown as project details."
                      : "Upload files for the client."}
                  </p>
                </div>
              </div>
              {tracking.status === "COMPLETED" ? (
                <div className="mt-5 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                  Project changes are locked after 24 hours from finish. After that, you cannot
                  upload documents or change work; this page remains available for details only.
                  {finalChangesLockAt ? (
                    <span className="mt-2 block text-xs">
                      Lock time: {formatDateTime(finalChangesLockAt)}
                    </span>
                  ) : null}
                </div>
              ) : (
                <form className="mt-5 space-y-4" onSubmit={handleWorkUpload}>
                  {openRevisionRequests.length ? (
                    <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
                      <div className="flex items-start gap-3">
                        <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
                        <div>
                          <h3 className="text-sm font-semibold">Revision requested</h3>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                            {openRevisionRequests.at(-1)?.note}
                          </p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Upload updated work to mark this revision as addressed.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : latestRevisionRequest ? (
                    <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                      Last revision request was addressed{" "}
                      {formatDateTime(latestRevisionRequest.updatedAt)}.
                    </div>
                  ) : null}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-medium">Files</h3>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4" />
                        Browse
                      </Button>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleBrowseFiles}
                    />
                    {uploadFiles.map((file, index) => (
                      <div
                        key={`${file.fileName}-${index}`}
                        className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border p-3"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                          {file.fileName}
                          <span className="ml-1 text-xs">({formatFileSize(file.fileSize)})</span>
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setUploadFiles((files) =>
                              files.filter((_, itemIndex) => itemIndex !== index),
                            )
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    {!uploadFiles.length ? (
                      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                        Choose one or more files from your computer.
                      </div>
                    ) : null}
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isUploading || !uploadFiles.length}
                  >
                    <Upload className="h-4 w-4" />
                    {isUploading ? "Uploading" : "Upload work"}
                  </Button>
                </form>
              )}
            </section>
          ) : null}

          <RevisionHistory
            revisions={tracking.revisionRequests}
            isProfessional={isProfessional}
            clearingRevisionId={clearingRevisionId}
            onClear={handleClearRevision}
          />

          <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-semibold">Professional working</h2>
            <div className="mt-4 flex items-center gap-3">
              <img
                src={
                  tracking.professionalAvatarUrl ||
                  `https://i.pravatar.cc/100?u=tracking-pro-${tracking.professionalId}`
                }
                alt={tracking.professionalName}
                className="h-12 w-12 rounded-lg object-cover"
              />
              <div className="min-w-0">
                <p className="truncate font-medium">{tracking.professionalName}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {tracking.professionalCategory || "Professional"}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <InfoLine icon={UserRound} text={tracking.professionalEmail} />
              <InfoLine icon={CheckCircle2} text={`Accepted ${formatDate(tracking.acceptedAt)}`} />
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-semibold">Client</h2>
            <div className="mt-4 flex items-center gap-3">
              <img
                src={
                  tracking.clientAvatarUrl ||
                  `https://i.pravatar.cc/100?u=tracking-client-${tracking.clientId}`
                }
                alt={tracking.clientName}
                className="h-12 w-12 rounded-lg object-cover"
              />
              <div>
                <p className="font-medium">{tracking.clientName}</p>
                <p className="text-sm text-muted-foreground">Project owner</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-semibold">Next steps</h2>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              {tracking.status === "COMPLETED" ? (
                <>
                  <InfoLine icon={CheckCircle2} text="Project finished and accepted" />
                  <InfoLine
                    icon={FileText}
                    text={
                      finalChangesLockAt
                        ? `Document upload and changes lock after ${formatDateTime(finalChangesLockAt)}`
                        : "After 24 hours, uploads and changes are locked"
                    }
                  />
                  <InfoLine icon={FileText} text="This page will show project details only" />
                </>
              ) : (
                <>
                  <InfoLine icon={FileText} text="Share work updates in messages" />
                  <InfoLine icon={CheckCircle2} text="Client reviews delivered work" />
                  <InfoLine icon={DollarSign} text="Release remaining payment after completion" />
                </>
              )}
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}

function ProjectTimeline({
  trackingStatus,
  requestStatus,
  requestCreatedAt,
  requestUpdatedAt,
  acceptedAt,
  progress,
  remainingDays,
  workUploads,
  revisionRequests,
  completionRequests,
}: {
  trackingStatus: string;
  requestStatus: string;
  requestCreatedAt: string;
  requestUpdatedAt: string;
  acceptedAt: string;
  progress: number;
  remainingDays: number | null;
  workUploads: ProjectWorkUploadRecord[];
  revisionRequests: ProjectRevisionRequestRecord[];
  completionRequests: ProjectCompletionRequestRecord[];
}) {
  const latestUpload = workUploads.at(-1);
  const latestRevision = revisionRequests.at(-1);
  const latestCompletion = completionRequests.at(-1);
  const timelineItems = [
    {
      label: "Request sent",
      description: "The professional sent the bid, duration, cover note, and any work samples.",
      time: formatDateTime(requestCreatedAt),
      state: "complete",
      icon: Send,
    },
    {
      label: requestStatus === "ACCEPTED" ? "Project start" : formatEnum(requestStatus),
      description:
        "The client accepted the request and project tracking uses the scheduled start date.",
      time: formatScheduleDate(acceptedAt || requestUpdatedAt),
      state: "complete",
      icon: CheckCircle2,
    },
    {
      label: "Project in progress",
      description:
        remainingDays == null
          ? `${progress}% of the tracked estimate is used.`
          : `${progress}% of the tracked estimate is used, with ${remainingDays} day${remainingDays === 1 ? "" : "s"} remaining.`,
      time: formatEnum(trackingStatus),
      state: trackingStatus === "ACTIVE" ? "current" : "complete",
      icon: Timer,
    },
    {
      label: "Messages and files",
      description: latestUpload
        ? `Latest uploaded file: ${latestUpload.fileName || latestUpload.title}.`
        : "Use messages to share updates, proofs, questions, and delivery notes.",
      time: latestUpload ? formatDateTime(latestUpload.createdAt) : "Ongoing",
      state: trackingStatus === "ACTIVE" ? "current" : "complete",
      icon: MessageSquare,
    },
    {
      label: latestRevision ? "Revision requested" : "Revision review",
      description: latestRevision
        ? latestRevision.note
        : "If the uploaded work needs changes, the client can request a revision.",
      time: latestRevision ? formatDateTime(latestRevision.createdAt) : "Optional",
      state: latestRevision
        ? latestRevision.status === "REQUESTED"
          ? "current"
          : "complete"
        : "upcoming",
      icon: RotateCcw,
    },
    {
      label:
        trackingStatus === "COMPLETED"
          ? "Project completed"
          : latestCompletion
            ? "Final work submitted"
            : "Review and payment",
      description:
        trackingStatus === "COMPLETED"
          ? "Client approved the final work."
          : latestCompletion
            ? latestCompletion.note || "Professional marked the project finished for client review."
            : "Final review and remaining payment happen after delivery.",
      time:
        trackingStatus === "COMPLETED"
          ? formatDateTime(
              latestCompletion?.updatedAt || latestCompletion?.submittedAt || acceptedAt,
            )
          : latestCompletion
            ? formatDateTime(latestCompletion.submittedAt)
            : "Upcoming",
      state:
        trackingStatus === "COMPLETED" ? "complete" : latestCompletion ? "current" : "upcoming",
      icon: ReceiptText,
    },
  ] as const;

  return (
    <ol className="mt-5 space-y-5">
      {timelineItems.map((item, index) => (
        <li key={item.label} className="relative flex gap-4">
          {index < timelineItems.length - 1 ? (
            <span className="absolute left-5 top-10 h-[calc(100%+0.25rem)] w-px bg-border" />
          ) : null}
          <span
            className={`relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border ${
              item.state === "complete"
                ? "border-primary bg-primary text-primary-foreground"
                : item.state === "current"
                  ? "border-primary bg-card text-primary"
                  : "border-border bg-card text-muted-foreground"
            }`}
          >
            <item.icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1 rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-medium">{item.label}</h3>
              <span className="text-xs text-muted-foreground">{item.time}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function CompletionPanel({
  isProfessional,
  trackingStatus,
  latestCompletion,
  completedMilestoneCount,
  requiredMilestoneCount,
  canSubmitFinalWork,
  note,
  isSubmitting,
  reviewingCompletionId,
  onNoteChange,
  onSubmit,
  onReview,
}: {
  isProfessional: boolean;
  trackingStatus: string;
  latestCompletion: ProjectCompletionRequestRecord | null;
  completedMilestoneCount: number;
  requiredMilestoneCount: number;
  canSubmitFinalWork: boolean;
  note: string;
  isSubmitting: boolean;
  reviewingCompletionId: number | null;
  onNoteChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReview: (completionId: number, status: ProjectCompletionStatus) => void;
}) {
  const pendingClientReview = latestCompletion?.status === "SUBMITTED";
  const remainingMilestones = Math.max(0, requiredMilestoneCount - completedMilestoneCount);
  let description = "Submit and review final project completion.";

  if (trackingStatus === "COMPLETED") {
    description = "This project is completed.";
  } else if (!isProfessional && pendingClientReview) {
    description =
      "Professional marked this work finished. Review and accept it or request changes.";
  } else if (isProfessional && !canSubmitFinalWork) {
    description = `Final submission unlocks after ${requiredMilestoneCount} completed milestones.`;
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">
            {!isProfessional && pendingClientReview ? "Accept work request" : "Final work"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Badge variant={trackingStatus === "COMPLETED" ? "default" : "outline"}>
          {trackingStatus === "COMPLETED"
            ? "Completed"
            : latestCompletion
              ? formatEnum(latestCompletion.status)
              : "Open"}
        </Badge>
      </div>

      {latestCompletion ? (
        <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-sm font-medium">
            Submitted {formatDateTime(latestCompletion.submittedAt)}
          </p>
          {latestCompletion.note ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {latestCompletion.note}
            </p>
          ) : null}
        </div>
      ) : null}

      {isProfessional && trackingStatus !== "COMPLETED" && !canSubmitFinalWork ? (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/20 p-3">
          <p className="text-sm font-medium">Final submission locked</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {remainingMilestones === 1
              ? "Complete 1 more milestone to send final submission."
              : `Complete ${remainingMilestones} more milestones to send final submission.`}
          </p>
          <Badge variant="secondary" className="mt-3">
            {completedMilestoneCount}/{requiredMilestoneCount} completed
          </Badge>
        </div>
      ) : null}

      {isProfessional && trackingStatus !== "COMPLETED" && canSubmitFinalWork ? (
        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <textarea
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="Final note for the client"
            className="min-h-24 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <Button type="submit" className="w-full" disabled={isSubmitting || pendingClientReview}>
            <CheckCircle2 className="h-4 w-4" />
            {pendingClientReview
              ? "Accept request sent"
              : isSubmitting
                ? "Submitting"
                : "Send accept work request"}
          </Button>
        </form>
      ) : null}

      {!isProfessional && pendingClientReview ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={() => onReview(latestCompletion.id, "APPROVED")}
            disabled={reviewingCompletionId !== null}
          >
            <CheckCircle2 className="h-4 w-4" />
            Accept work
          </Button>
          <Button
            variant="outline"
            onClick={() => onReview(latestCompletion.id, "REVISION_REQUESTED")}
            disabled={reviewingCompletionId !== null}
          >
            Request revision
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function DisputePanel({
  disputes,
  issueType,
  priority,
  message,
  files,
  error,
  isSubmitting,
  onIssueTypeChange,
  onPriorityChange,
  onMessageChange,
  onFilesChange,
  onRemoveFile,
  onSubmit,
}: {
  disputes: ProjectDisputeRecord[];
  issueType: ProjectDisputeType;
  priority: ProjectDisputePriority;
  message: string;
  files: Array<{
    fileName: string;
    fileType: string | null;
    fileSize: number | null;
    fileUrl: string | null;
  }>;
  error: string | null;
  isSubmitting: boolean;
  onIssueTypeChange: (value: ProjectDisputeType) => void;
  onPriorityChange: (value: ProjectDisputePriority) => void;
  onMessageChange: (value: string) => void;
  onFilesChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (index: number) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const latestDispute = disputes.at(-1) ?? null;

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Report issue</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Raise a dispute for payment, delivery, files, deadlines, or communication.
          </p>
        </div>
        <Badge variant={latestDispute?.status === "OPEN" ? "destructive" : "outline"}>
          {latestDispute ? formatDisputeStatus(latestDispute.status) : "No disputes"}
        </Badge>
      </div>

      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="font-medium">Issue type</span>
            <select
              value={issueType}
              onChange={(event) => onIssueTypeChange(event.target.value as ProjectDisputeType)}
              className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="PAYMENT">Payment issue</option>
              <option value="WORK_QUALITY">Work quality</option>
              <option value="DEADLINE_DELAY">Deadline delay</option>
              <option value="COMMUNICATION">Communication</option>
              <option value="FILE_PROBLEM">File problem</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium">Priority</span>
            <select
              value={priority}
              onChange={(event) => onPriorityChange(event.target.value as ProjectDisputePriority)}
              className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </label>
        </div>

        <textarea
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          placeholder="Explain what happened..."
          className="min-h-28 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />

        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3">
          <label className="flex cursor-pointer items-center justify-center gap-2 text-sm font-medium text-primary">
            <Upload className="h-4 w-4" />
            Attach proof
            <input type="file" multiple className="hidden" onChange={onFilesChange} />
          </label>
          {files.length ? (
            <div className="mt-3 grid gap-2">
              {files.map((file, index) => (
                <div
                  key={`${file.fileName}-${index}`}
                  className="flex items-center justify-between gap-2 rounded-md bg-background p-2 text-sm"
                >
                  <span className="min-w-0 truncate text-muted-foreground">
                    {file.fileName}
                    {file.fileSize ? (
                      <span className="ml-1 text-xs">({formatFileSize(file.fileSize)})</span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveFile(index)}
                    className="shrink-0 text-xs text-primary hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          <AlertTriangle className="h-4 w-4" />
          {isSubmitting ? "Submitting" : "Raise dispute"}
        </Button>
      </form>

      {disputes.length ? (
        <div className="mt-5 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Dispute history</h3>
          <div className="mt-3 space-y-3">
            {disputes
              .slice()
              .reverse()
              .map((dispute) => {
                const attachments = getDisputeAttachments(dispute.attachmentsJson);

                return (
                  <div key={dispute.id} className="rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={dispute.status === "OPEN" ? "destructive" : "outline"}>
                          {formatDisputeStatus(dispute.status)}
                        </Badge>
                        <Badge variant="secondary">{formatDisputeType(dispute.issueType)}</Badge>
                        <Badge variant="outline">{formatEnum(dispute.priority)}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(dispute.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {dispute.message}
                    </p>
                    {attachments.length ? (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {attachments.length} proof file{attachments.length === 1 ? "" : "s"}{" "}
                        attached
                      </div>
                    ) : null}
                  </div>
                );
              })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ProjectReviewPanel({
  professionalName,
  reviewRating,
  reviewComment,
  reviewCreatedAt,
  reviewRequestedAt,
  reviewRequestNote,
  draft,
  isSaving,
  error,
  onDraftChange,
  onSave,
}: {
  professionalName: string;
  reviewRating: number | null;
  reviewComment: string | null;
  reviewCreatedAt: string | null;
  reviewRequestedAt: string | null;
  reviewRequestNote: string | null;
  draft: { rating: number; comment: string };
  isSaving: boolean;
  error: string | null;
  onDraftChange: (draft: { rating: number; comment: string }) => void;
  onSave: () => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="font-semibold">Leave review</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {reviewRating
              ? `You rated ${professionalName || "this professional"} ${reviewRating}/5.`
              : reviewRequestedAt
                ? `${professionalName || "This professional"} requested a review for this completed project.`
                : `Share how ${professionalName || "this professional"} worked on this project.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {reviewRequestedAt && !reviewRating ? (
            <Badge variant="secondary">Review requested</Badge>
          ) : null}
          {reviewCreatedAt ? (
            <Badge variant="outline">Rated {formatDate(reviewCreatedAt)}</Badge>
          ) : null}
        </div>
      </div>

      {reviewRequestedAt && !reviewRating ? (
        <p className="mt-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
          Requested {formatDate(reviewRequestedAt)}
          {reviewRequestNote ? `: ${reviewRequestNote}` : "."}
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
      {reviewComment && !draft.comment ? (
        <p className="mt-2 text-sm text-muted-foreground">{reviewComment}</p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}

      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={onSave} disabled={isSaving}>
          <Star className="h-4 w-4" />
          {isSaving ? "Saving" : reviewRating ? "Update review" : "Submit review"}
        </Button>
      </div>
    </section>
  );
}

function MilestoneForm({
  milestoneNumber,
  requiredCount,
  title,
  description,
  amountLabel,
  dueDate,
  minDate,
  maxDate,
  error,
  isSaving,
  onTitleChange,
  onDescriptionChange,
  onDueDateChange,
  onSubmit,
}: {
  milestoneNumber: number;
  requiredCount: number;
  title: string;
  description: string;
  amountLabel: string;
  dueDate: string;
  minDate?: string;
  maxDate?: string;
  error: string | null;
  isSaving: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="mt-5 rounded-lg border border-border bg-muted/20 p-4" onSubmit={onSubmit}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Badge variant="secondary">
          Milestone {milestoneNumber}/{requiredCount}
        </Badge>
        <span className="text-sm font-medium">Amount: {amountLabel}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder={`Milestone ${milestoneNumber}/${requiredCount} title`}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <div className="flex h-10 items-center rounded-lg border border-input bg-muted px-3 text-sm font-medium text-muted-foreground">
          {amountLabel}
        </div>
        <input
          value={dueDate}
          onChange={(event) => onDueDateChange(event.target.value)}
          type="date"
          min={minDate}
          max={maxDate}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <div className="flex items-center justify-end">
          <Button type="submit" disabled={isSaving}>
            <CheckCircle2 className="h-4 w-4" />
            {isSaving ? "Saving" : "Add milestone"}
          </Button>
        </div>
      </div>
      <textarea
        value={description}
        onChange={(event) => onDescriptionChange(event.target.value)}
        placeholder="Milestone details"
        className="mt-3 min-h-20 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </form>
  );
}

function MilestoneList({
  milestones,
  requiredCount,
  isProfessional,
  canStartProject,
  projectStartLabel,
  updatingMilestoneId,
  onStatusChange,
  onDelete,
}: {
  milestones: ProjectMilestoneRecord[];
  requiredCount: number;
  isProfessional: boolean;
  canStartProject: boolean;
  projectStartLabel: string;
  updatingMilestoneId: number | null;
  onStatusChange: (milestoneId: number, status: ProjectMilestoneStatus) => void;
  onDelete: (milestoneId: number) => void;
}) {
  if (!milestones.length) {
    return (
      <div className="mt-5 rounded-lg border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
        No milestones yet. The client must create 5 milestones for this project.
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-3">
      {milestones.map((milestone, index) => (
        <div key={milestone.id} className="rounded-lg border border-border p-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  {index + 1}/{requiredCount}
                </Badge>
                <h3 className="font-semibold">{milestone.title}</h3>
                <Badge variant={milestone.status === "PAID" ? "default" : "outline"}>
                  {formatMilestoneStatus(milestone.status)}
                </Badge>
              </div>
              {milestone.description ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {milestone.description}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span>{milestone.amount ? formatMoney(milestone.amount) : "No amount"}</span>
                <span>
                  {milestone.dueDate ? `Due ${formatDate(milestone.dueDate)}` : "No due date"}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {isProfessional ? (
              <>
                {milestone.status === "PENDING" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onStatusChange(milestone.id, "IN_PROGRESS")}
                    disabled={updatingMilestoneId !== null || !canStartProject}
                  >
                    Start
                  </Button>
                ) : null}
                {["PENDING", "IN_PROGRESS", "REVISION_REQUESTED"].includes(milestone.status) ? (
                  <Button
                    size="sm"
                    onClick={() => onStatusChange(milestone.id, "SUBMITTED")}
                    disabled={updatingMilestoneId !== null || !canStartProject}
                  >
                    Submit
                  </Button>
                ) : null}
                {!canStartProject ? (
                  <span className="inline-flex items-center rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                    Starts {projectStartLabel}
                  </span>
                ) : null}
              </>
            ) : (
              <>
                {milestone.status === "SUBMITTED" ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => onStatusChange(milestone.id, "APPROVED")}
                      disabled={updatingMilestoneId !== null}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onStatusChange(milestone.id, "REVISION_REQUESTED")}
                      disabled={updatingMilestoneId !== null}
                    >
                      Request revision
                    </Button>
                  </>
                ) : null}
                {milestone.status === "APPROVED" ? (
                  <Button
                    size="sm"
                    onClick={() => onStatusChange(milestone.id, "PAID")}
                    disabled={updatingMilestoneId !== null}
                  >
                    Mark paid
                  </Button>
                ) : null}
                {["PENDING", "REVISION_REQUESTED"].includes(milestone.status) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onDelete(milestone.id)}
                    disabled={updatingMilestoneId !== null}
                  >
                    Delete
                  </Button>
                ) : null}
              </>
            )}
            {updatingMilestoneId === milestone.id ? (
              <span className="self-center text-sm text-muted-foreground">Updating...</span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function RevisionRequestForm({
  canRequest,
  hasUploadedWork,
  note,
  error,
  isSubmitting,
  openRevisionCount,
  onNoteChange,
  onSubmit,
}: {
  canRequest: boolean;
  hasUploadedWork: boolean;
  note: string;
  error: string | null;
  isSubmitting: boolean;
  openRevisionCount: number;
  onNoteChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="mt-5 rounded-lg border border-border bg-muted/20 p-4" onSubmit={onSubmit}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h3 className="font-semibold">Request revision</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell the professional what needs to change in the uploaded work.
          </p>
        </div>
        {openRevisionCount ? <Badge variant="secondary">{openRevisionCount} open</Badge> : null}
      </div>
      <textarea
        value={note}
        onChange={(event) => onNoteChange(event.target.value)}
        disabled={!canRequest || isSubmitting}
        placeholder={
          canRequest && hasUploadedWork
            ? "Example: Please update the final file with the corrected colors and export as PDF."
            : canRequest
              ? "Example: Please share an updated file, add missing details, or change the delivered work."
              : "Revision can be requested while the project is active."
        }
        className="mt-4 min-h-28 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      <div className="mt-3 flex justify-end">
        <Button type="submit" disabled={!canRequest || isSubmitting}>
          <RotateCcw className="h-4 w-4" />
          {isSubmitting ? "Requesting" : "Request revision"}
        </Button>
      </div>
    </form>
  );
}

function RevisionHistory({
  revisions,
  isProfessional,
  clearingRevisionId,
  onClear,
}: {
  revisions: ProjectRevisionRequestRecord[];
  isProfessional: boolean;
  clearingRevisionId: number | null;
  onClear: (revisionId: number) => void;
}) {
  if (!revisions.length) {
    return null;
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Revision history</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isProfessional
              ? "Client revision notes for this project."
              : "Revision requests you sent to the professional."}
          </p>
        </div>
        <Badge variant="outline">{revisions.length}</Badge>
      </div>
      <div className="mt-4 space-y-3">
        {revisions
          .slice()
          .reverse()
          .map((revision) => (
            <div key={revision.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={revision.status === "REQUESTED" ? "default" : "outline"}>
                    {revision.status === "REQUESTED" ? "Requested" : "Addressed"}
                  </Badge>
                  {!isProfessional ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onClear(revision.id)}
                      disabled={clearingRevisionId !== null}
                    >
                      {clearingRevisionId === revision.id ? "Clearing" : "Clear"}
                    </Button>
                  ) : null}
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(revision.createdAt)}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {revision.note}
              </p>
            </div>
          ))}
      </div>
    </section>
  );
}

function WorkFiles({
  uploads,
  isProfessional,
  deletingUploadId,
  onDelete,
}: {
  uploads: ProjectWorkUploadRecord[];
  isProfessional: boolean;
  deletingUploadId: number | null;
  onDelete: (uploadId: number) => void;
}) {
  if (!uploads.length) {
    return (
      <div className="mt-5 rounded-lg border border-dashed border-border bg-muted/30 p-5">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-primary bg-card text-primary">
            <Upload className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold">No files uploaded yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {isProfessional
                ? "Use the upload box on the right to send work files."
                : "The professional has not uploaded work files yet."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-3">
      {uploads.map((upload) => (
        <WorkFileItem
          key={upload.id}
          upload={upload}
          canDelete={isProfessional}
          isDeleting={deletingUploadId === upload.id}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function WorkFileItem({
  upload,
  canDelete,
  isDeleting,
  onDelete,
}: {
  upload: ProjectWorkUploadRecord;
  canDelete: boolean;
  isDeleting: boolean;
  onDelete: (uploadId: number) => void;
}) {
  const files = getWorkUploadFiles(upload);
  const primaryFile = files[0] ?? {
    fileName: upload.fileName || upload.title || "Uploaded file",
    fileUrl: upload.fileUrl,
    fileType: null,
    fileSize: null,
  };

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{primaryFile.fileName}</h3>
            <p className="text-xs text-muted-foreground">
              Uploaded {formatDateTime(upload.createdAt)}
              {primaryFile.fileSize ? ` · ${formatFileSize(primaryFile.fileSize)}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {primaryFile.fileUrl ? (
            <Button size="sm" variant="outline" onClick={() => openWorkFile(primaryFile)}>
              Open
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled>
              Open
            </Button>
          )}
          {canDelete ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDelete(upload.id)}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting" : "Delete"}
            </Button>
          ) : null}
        </div>
      </div>
      {files.length > 1 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {files.slice(1).map((file) => (
            <div
              key={`${upload.id}-${file.fileName}-${file.fileUrl || ""}`}
              className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-muted/40 p-2 text-sm"
            >
              <span className="truncate text-muted-foreground">{file.fileName}</span>
              {file.fileUrl ? (
                <button
                  type="button"
                  onClick={() => openWorkFile(file)}
                  className="shrink-0 text-primary hover:underline"
                >
                  Open
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function openWorkFile(file: { fileName: string; fileUrl: string | null; fileType: string | null }) {
  if (!file.fileUrl) {
    return;
  }

  if (!file.fileUrl.startsWith("data:")) {
    window.open(file.fileUrl, "_blank", "noopener,noreferrer");
    return;
  }

  const blob = dataUrlToBlob(file.fileUrl, file.fileType);
  const objectUrl = URL.createObjectURL(blob);
  const openedWindow = window.open(objectUrl, "_blank", "noopener,noreferrer");

  if (!openedWindow) {
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = file.fileName;
    link.click();
  }

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
}

function dataUrlToBlob(dataUrl: string, fallbackType: string | null) {
  const [metadata = "", base64 = ""] = dataUrl.split(",");
  const contentType =
    metadata.match(/^data:([^;]+)/)?.[1] || fallbackType || "application/octet-stream";
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: contentType });
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-4 text-2xl font-semibold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function InfoLine({
  icon: Icon,
  text,
  wide = false,
}: {
  icon: ComponentType<{ className?: string }>;
  text: string;
  wide?: boolean;
}) {
  return (
    <span className={`flex min-w-0 items-center gap-2 ${wide ? "sm:col-span-2" : ""}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{text}</span>
    </span>
  );
}

function ProgressBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}

function parseDurationWeeks(value: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function getElapsedDays(value: string, now = new Date()) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  return Math.max(0, Math.floor((todayDate - startDate) / 86400000));
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMilestoneStatus(value: ProjectMilestoneStatus) {
  return value === "REVISION_REQUESTED" ? "Revision requested" : formatEnum(value);
}

function formatDisputeType(value: ProjectDisputeType) {
  const labels: Record<ProjectDisputeType, string> = {
    PAYMENT: "Payment issue",
    WORK_QUALITY: "Work quality",
    DEADLINE_DELAY: "Deadline delay",
    COMMUNICATION: "Communication",
    FILE_PROBLEM: "File problem",
    OTHER: "Other",
  };

  return labels[value];
}

function formatDisputeStatus(value: string) {
  return value === "UNDER_REVIEW" ? "Under review" : formatEnum(value);
}

function formatDate(value: string) {
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

function formatScheduleDate(value: string | null | undefined) {
  const input = getDateInputValue(value);

  if (!input) {
    return "Not set";
  }

  const [year, month, day] = input.split("-").map(Number);

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function getDateInputValue(value: string | Date | null | undefined) {
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0"),
    ].join("-");
  }

  const dateOnly = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];

  if (dateOnly) {
    return dateOnly;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function compareDateInputs(a: string, b: string) {
  return new Date(`${a}T00:00:00.000Z`).getTime() - new Date(`${b}T00:00:00.000Z`).getTime();
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

function formatMoney(value: number) {
  return `$${value.toLocaleString()}`;
}

function getRequiredMilestoneAmount(totalAmount: number, milestoneNumber: number) {
  const normalizedTotal = Math.max(0, Math.round(Number(totalAmount) || 0));
  const baseAmount = Math.floor(normalizedTotal / REQUIRED_PROJECT_MILESTONES);
  const remainder = normalizedTotal - baseAmount * REQUIRED_PROJECT_MILESTONES;

  return baseAmount + (milestoneNumber <= remainder ? 1 : 0);
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

function formatFileSize(size?: number | null) {
  if (!size) {
    return "Unknown size";
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getRequestAttachments(value: string | null) {
  if (!value) {
    return [] as Array<{ fileName: string; fileSize?: number | null }>;
  }

  try {
    const parsed = JSON.parse(value) as Array<{ fileName?: string; fileSize?: number | null }>;
    return parsed
      .filter((attachment) => attachment.fileName)
      .map((attachment) => ({
        fileName: attachment.fileName || "Attachment",
        fileSize: attachment.fileSize ?? null,
      }));
  } catch {
    return [];
  }
}

function getDisputeAttachments(value: string | null) {
  if (!value) {
    return [] as Array<{ fileName: string; fileSize?: number | null }>;
  }

  try {
    const parsed = JSON.parse(value) as Array<{ fileName?: string; fileSize?: number | null }>;
    return parsed
      .filter((attachment) => attachment.fileName)
      .map((attachment) => ({
        fileName: attachment.fileName || "Proof file",
        fileSize: attachment.fileSize ?? null,
      }));
  } catch {
    return [];
  }
}

function getWorkUploadFiles(upload: ProjectWorkUploadRecord) {
  if (upload.filesJson) {
    try {
      const parsed = JSON.parse(upload.filesJson) as Array<{
        fileName?: string;
        fileUrl?: string | null;
        fileDataUrl?: string | null;
        fileType?: string | null;
        fileSize?: number | null;
      }>;
      const files = parsed
        .filter((file) => file.fileName)
        .map((file) => ({
          fileName: file.fileName || "File",
          fileUrl: file.fileDataUrl || file.fileUrl || null,
          fileType: file.fileType || null,
          fileSize: file.fileSize ?? null,
        }));

      if (files.length) {
        return files;
      }
    } catch {
      // Fall back to the older single-file columns below.
    }
  }

  if (upload.fileName || upload.fileUrl) {
    return [
      {
        fileName: upload.fileName || upload.fileUrl || "File",
        fileUrl: upload.fileUrl,
        fileType: null,
        fileSize: null,
      },
    ];
  }

  return [] as Array<{
    fileName: string;
    fileUrl: string | null;
    fileType: string | null;
    fileSize: number | null;
  }>;
}

function getSocketUrl() {
  return (
    import.meta.env.VITE_SOCKET_URL ||
    `${window.location.protocol}//${window.location.hostname}:4001`
  );
}
