import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createServerFn } from "@tanstack/react-start";
import {
  createFileRoute,
  Link,
  redirect,
  useLoaderData,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { io } from "socket.io-client";
import {
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  ExternalLink,
  FileText,
  LocateFixed,
  MapPin,
  Navigation,
  Paperclip,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import LocationPicker from "@/components/maps/LocationPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createClientJob, getClientJobById, updateClientJob } from "@/lib/job-db.server";
import { getServiceCategories } from "@/lib/services-db.server";
import { formatApproximateCoordinates, formatApproximateLocation } from "@/lib/location-privacy";
import { requireCurrentUserRole } from "@/lib/current-user.server";
import { getClientProfileByUserId } from "@/lib/user-db.server";
import { saveClientJobSchema, type ClientJobInput } from "@/lib/validation/client-job";

type AttachmentDraft = {
  fileName: string;
  fileType?: string;
  fileSize?: number;
  previewUrl?: string;
};

type JobLocation = {
  locationName: string;
  latitude: number | null;
  longitude: number | null;
};

// Removed Google Maps window typing — using Leaflet-based LocationPicker instead

const defaultMapCenter = { lat: 21.1702, lng: 72.8311 };

type StepId = "basics" | "files" | "timing" | "location";

const getPostJobAccess = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = requireCurrentUserRole("CLIENT");
  const clientProfile = getClientProfileByUserId(viewer.id);

  return {
    viewer,
    clientProfile,
    categories: getServiceCategories(),
  };
});

const saveClientJob = createServerFn({ method: "POST" })
  .inputValidator((data: { draftId?: number | null; job: ClientJobInput }) => ({
    draftId: data.draftId ?? null,
    job: saveClientJobSchema.parse(data.job) as ClientJobInput,
  }))
  .handler(async ({ data }) => {
    const viewer = requireCurrentUserRole("CLIENT");
    const job = data.draftId
      ? updateClientJob(viewer.id, data.draftId, data.job)
      : createClientJob(viewer.id, data.job);

    return {
      ok: true as const,
      job,
    };
  });

const getDraftJob = createServerFn({ method: "GET" })
  .inputValidator((data: { draftId: number }) => data)
  .handler(async ({ data }) => {
    const viewer = requireCurrentUserRole("CLIENT");
    const job = getClientJobById(viewer.id, data.draftId);

    if (!job || job.status !== "DRAFT") {
      return null;
    }

    return job;
  });

export const Route = createFileRoute("/post-job")({
  beforeLoad: async ({ location }) => {
    try {
      await getPostJobAccess();
    } catch {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }
  },
  loader: () => getPostJobAccess(),
  head: () => ({ meta: [{ title: "Post a job / project - Servio" }] }),
  component: PostJob,
});

const wizardSteps: Array<{
  id: StepId;
  title: string;
  subtitle: string;
  icon: typeof BriefcaseBusiness;
}> = [
  {
    id: "basics",
    title: "Job basics",
    subtitle: "Category, title, and project description.",
    icon: BriefcaseBusiness,
  },
  {
    id: "timing",
    title: "Timing",
    subtitle: "Urgency, job date, deadline, and work mode.",
    icon: CalendarDays,
  },
  {
    id: "files",
    title: "Budget & files",
    subtitle: "Budget range and helpful references.",
    icon: Paperclip,
  },
  {
    id: "location",
    title: "Review & save",
    subtitle: "Final review before posting.",
    icon: Check,
  },
];

const workModes = [
  { value: "ON_SITE", label: "On-site" },
  { value: "REMOTE", label: "Remote" },
  { value: "BOTH", label: "Both" },
] as const;

const urgencyOptions = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
] as const;

const timingTypes = [
  {
    value: "FIXED",
    label: "Fixed project",
    description: "Set one total budget and delivery dates.",
  },
  { value: "HOURLY", label: "Hourly", description: "Set the budget as an hourly rate." },
  { value: "WEEKLY", label: "Weekly", description: "Set the budget as a weekly rate." },
] as const;

function PostJob() {
  const { viewer, clientProfile, categories } = useLoaderData({ from: "/post-job" });
  const search = useSearch({ from: "/post-job" }) as { draftId?: string };
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [draftId, setDraftId] = useState<number | null>(null);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [form, setForm] = useState<ClientJobInput>({
    category: "",
    title: "",
    description: "",
    attachments: [],
    budgetMin: null,
    budgetMax: null,
    urgency: "MEDIUM",
    timingType: "FIXED",
    hourlyRate: null,
    jobDate: "",
    deadline: "",
    workMode: "BOTH",
    locationLabel: "Selected job location",
    locationAddress: "",
    locationLat: null,
    locationLng: null,
    status: "OPEN",
  });

  const activeStep = wizardSteps[currentStep];
  const ActiveStepIcon = activeStep.icon;
  const completedPercent = useMemo(
    () => calculateCompletion({ ...form, attachments }),
    [form, attachments],
  );
  const displayName = clientProfile?.fullName || `${viewer.firstName} ${viewer.lastName}`.trim();

  useEffect(() => {
    const numericDraftId = Number(search.draftId);

    if (!Number.isFinite(numericDraftId) || numericDraftId <= 0) {
      setDraftId(null);
      return;
    }

    let active = true;
    setIsLoadingDraft(true);
    setSubmitError(null);

    getDraftJob({ data: { draftId: numericDraftId } })
      .then((draft) => {
        if (!active) {
          return;
        }

        if (!draft) {
          setSubmitError("Draft project was not found.");
          return;
        }

        const draftAttachments = draft.attachments.map((attachment) => ({
          fileName: attachment.fileName,
          fileType: attachment.fileType || undefined,
          fileSize: attachment.fileSize || undefined,
          previewUrl: attachment.previewUrl || undefined,
        }));

        setDraftId(draft.id);
        setAttachments(draftAttachments);
        setForm({
          category: draft.category,
          title: draft.title,
          description: draft.description,
          attachments: draftAttachments,
          budgetMin: draft.budgetMin,
          budgetMax: draft.budgetMax,
          urgency: draft.urgency,
          timingType: draft.timingType ?? "FIXED",
          hourlyRate: draft.hourlyRate ?? null,
          jobDate: toDateInputValue(draft.jobDate),
          deadline: toDateInputValue(draft.deadline),
          workMode: draft.workMode,
          locationLabel: draft.locationLabel || "Selected job location",
          locationAddress: draft.locationAddress || "",
          locationLat: draft.locationLat,
          locationLng: draft.locationLng,
          status: draft.status,
        });
        setCurrentStep(
          getFirstIncompleteStep({
            category: draft.category,
            title: draft.title,
            description: draft.description,
            attachments: draftAttachments,
            budgetMin: draft.budgetMin,
            budgetMax: draft.budgetMax,
            urgency: draft.urgency,
            timingType: draft.timingType ?? "FIXED",
            hourlyRate: draft.hourlyRate ?? null,
            jobDate: toDateInputValue(draft.jobDate),
            deadline: toDateInputValue(draft.deadline),
            workMode: draft.workMode,
            locationLabel: draft.locationLabel || "Selected job location",
            locationAddress: draft.locationAddress || "",
            locationLat: draft.locationLat,
            locationLng: draft.locationLng,
            status: draft.status,
          }),
        );
      })
      .catch((error) => {
        if (active) {
          setSubmitError(error instanceof Error ? error.message : "Could not load this draft.");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingDraft(false);
        }
      });

    return () => {
      active = false;
    };
  }, [search.draftId]);

  const updateField = <K extends keyof ClientJobInput>(key: K, value: ClientJobInput[K]) => {
    setSubmitError(null);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) {
      return;
    }

    const nextFiles = await Promise.all(
      Array.from(fileList)
        .slice(0, Math.max(0, 10 - attachments.length))
        .map((file) => readAttachment(file)),
    );

    const nextAttachments = [...attachments, ...nextFiles];
    setAttachments(nextAttachments);
    updateField("attachments", nextAttachments);
  };

  const removeAttachment = (fileName: string) => {
    const nextAttachments = attachments.filter((attachment) => attachment.fileName !== fileName);
    setAttachments(nextAttachments);
    updateField("attachments", nextAttachments);
  };

  const goNext = () => {
    const validationMessage = validateStep(activeStep.id, { ...form, attachments });

    if (validationMessage) {
      setSubmitError(validationMessage);
      return;
    }

    setSubmitError(null);
    setCurrentStep((step) => Math.min(step + 1, wizardSteps.length - 1));
  };

  const goBack = () => {
    setSubmitError(null);
    setCurrentStep((step) => Math.max(step - 1, 0));
  };

  const saveJob = async (status: "DRAFT" | "OPEN") => {
    const payload = {
      ...form,
      attachments,
      status,
    };

    if (status === "OPEN") {
      const validationMessage = validateAll(payload);

      if (validationMessage) {
        setSubmitError(validationMessage);
        return;
      }
    }

    setIsSaving(true);
    setSubmitError(null);

    try {
      const result = await saveClientJob({ data: { draftId, job: payload } });

      if (result.ok) {
        emitAdminActivity(draftId ? "client job updated" : "client job posted");
        await navigate({ to: "/dashboard" });
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Could not save this job. Please check the details.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell
      userName={displayName}
      userRole="Client"
      userAvatarUrl={clientProfile?.avatarUrl || viewer.avatarUrl}
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <Link to="/dashboard" className="text-sm text-primary hover:underline">
              Back to dashboard
            </Link>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {draftId ? "Continue draft job / project" : "Create new job / project"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {draftId
                ? "Your saved draft information is loaded below. Review or complete the missing fields before posting."
                : "A guided posting flow for the Phase-1 client job feature."}
            </p>
          </div>
          <Badge variant="secondary" className="w-fit">
            {completedPercent}% complete
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>
                  Step {currentStep + 1} of {wizardSteps.length}
                </span>
                <span>{completedPercent}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${completedPercent}%` }}
                />
              </div>
            </div>

            <div className="space-y-3">
              {wizardSteps.map((step, index) => (
                <StepButton
                  key={step.id}
                  step={step}
                  index={index}
                  currentStep={currentStep}
                  isComplete={isStepComplete(step.id, { ...form, attachments })}
                  onClick={() => setCurrentStep(index)}
                />
              ))}
            </div>
          </aside>

          <section className="rounded-xl border border-border bg-card shadow-soft">
            <div className="border-b border-border p-5">
              <div className="flex items-center gap-2 text-sm text-primary">
                <ActiveStepIcon className="h-4 w-4" />
                {activeStep.title}
              </div>
              <h2 className="mt-1 text-xl font-semibold">{activeStep.title}</h2>
              <p className="text-sm text-muted-foreground">{activeStep.subtitle}</p>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
              {isLoadingDraft ? (
                <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  Loading saved draft details...
                </div>
              ) : null}

              {activeStep.id === "basics" ? (
                <BasicsStep form={form} updateField={updateField} categories={categories} />
              ) : null}

              {activeStep.id === "files" ? (
                <FilesStep
                  form={form}
                  attachments={attachments}
                  updateField={updateField}
                  handleFiles={handleFiles}
                  removeAttachment={removeAttachment}
                />
              ) : null}

              {activeStep.id === "timing" ? (
                <TimingStep form={form} updateField={updateField} />
              ) : null}

              {activeStep.id === "location" ? (
                <LocationStep form={form} attachments={attachments} updateField={updateField} />
              ) : null}

              {submitError ? (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {submitError}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goBack}
                    disabled={currentStep === 0 || isSaving}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => saveJob("DRAFT")}
                    disabled={isSaving}
                  >
                    <Save className="h-4 w-4" />
                    Save draft
                  </Button>
                </div>

                {currentStep < wizardSteps.length - 1 ? (
                  <Button type="button" onClick={goNext}>
                    Continue
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="button" onClick={() => saveJob("OPEN")} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Post job"}
                  </Button>
                )}
              </div>
            </div>

            <div className="border-t border-border bg-muted/30 px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{ width: `${completedPercent}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {completedPercent}% done
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function StepButton({
  step,
  index,
  currentStep,
  isComplete,
  onClick,
}: {
  step: (typeof wizardSteps)[number];
  index: number;
  currentStep: number;
  isComplete: boolean;
  onClick: () => void;
}) {
  const isActive = index === currentStep;
  const Icon = step.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border p-3 text-left transition-colors ${
        isActive
          ? "border-primary bg-primary/5"
          : isComplete
            ? "border-success/30 bg-success/5"
            : "border-border bg-card hover:bg-muted/50"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`grid h-9 w-9 place-items-center rounded-lg ${
            isActive
              ? "bg-primary text-primary-foreground"
              : isComplete
                ? "bg-success/10 text-success"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {isComplete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <p className="font-medium">{step.title}</p>
          <p className="text-xs text-muted-foreground">{step.subtitle}</p>
          {!isActive && !isComplete ? (
            <p className="mt-1 text-xs font-medium text-warning-foreground">Pending</p>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function BasicsStep({
  form,
  updateField,
  categories,
}: {
  form: ClientJobInput;
  updateField: <K extends keyof ClientJobInput>(key: K, value: ClientJobInput[K]) => void;
  categories: Array<{ name: string }>;
}) {
  return (
    <>
      <Field label="Category">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          {categories.slice(0, 9).map((category) => (
            <button
              type="button"
              key={category.name}
              onClick={() => updateField("category", category.name)}
              className={`flex min-h-12 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                form.category === category.name
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              <BriefcaseBusiness className="h-4 w-4 shrink-0" />
              <span>{category.name}</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Title">
        <Input
          value={form.title}
          onChange={(event) => updateField("title", event.target.value)}
          placeholder="e.g. Build a Shopify storefront with custom theme"
        />
      </Field>

      <Field label="Description">
        <Textarea
          className="min-h-44"
          value={form.description}
          onChange={(event) => updateField("description", event.target.value)}
          placeholder="Describe scope, goals, deliverables, required skills, and what a successful result should look like."
        />
      </Field>
    </>
  );
}

function FilesStep({
  form,
  attachments,
  updateField,
  handleFiles,
  removeAttachment,
}: {
  form: ClientJobInput;
  attachments: AttachmentDraft[];
  updateField: <K extends keyof ClientJobInput>(key: K, value: ClientJobInput[K]) => void;
  handleFiles: (files: FileList | null) => void;
  removeAttachment: (fileName: string) => void;
}) {
  const budgetUnit = getBudgetUnit(form.timingType);
  const budgetHint =
    form.timingType === "HOURLY"
      ? "Enter the hourly rate range for this job."
      : form.timingType === "WEEKLY"
        ? "Enter the weekly rate range for this job."
        : "Enter the total budget range for this project.";

  return (
    <>
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        {budgetHint} Change the timing step to switch this between fixed, hourly, and weekly.
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`Minimum ${budgetUnit} budget`}>
          <Input
            type="number"
            min="0"
            value={form.budgetMin ?? ""}
            onChange={(event) =>
              updateField("budgetMin", event.target.value ? Number(event.target.value) : null)
            }
            placeholder={form.timingType === "FIXED" ? "$ Min" : `$ Min / ${budgetUnit}`}
          />
        </Field>
        <Field label={`Maximum ${budgetUnit} budget`}>
          <Input
            type="number"
            min="0"
            value={form.budgetMax ?? ""}
            onChange={(event) =>
              updateField("budgetMax", event.target.value ? Number(event.target.value) : null)
            }
            placeholder={form.timingType === "FIXED" ? "$ Max" : `$ Max / ${budgetUnit}`}
          />
        </Field>
      </div>

      <Field
        label="Photos / documents"
        hint="Upload briefs, photos, screenshots, PDFs, or documents."
      >
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-background py-10 text-center transition-colors hover:border-primary/40 hover:bg-primary/5">
          <Upload className="h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Drop files here or click to upload</p>
          <p className="text-xs text-muted-foreground">PDF, PNG, JPG, DOCX up to 10 files</p>
          <input
            type="file"
            className="hidden"
            multiple
            accept="image/*,.pdf,.doc,.docx"
            onChange={(event) => handleFiles(event.target.files)}
          />
        </label>
      </Field>

      {attachments.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.fileName}
              className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
            >
              {attachment.previewUrl ? (
                <img
                  src={attachment.previewUrl}
                  alt=""
                  className="h-12 w-12 rounded-md object-cover"
                />
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded-md bg-muted">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{attachment.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.fileSize)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeAttachment(attachment.fileName)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Remove ${attachment.fileName}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function TimingStep({
  form,
  updateField,
}: {
  form: ClientJobInput;
  updateField: <K extends keyof ClientJobInput>(key: K, value: ClientJobInput[K]) => void;
}) {
  const updateJobDate = (value: string) => {
    updateField("jobDate", value);

    if (value && form.deadline && compareDateInputs(form.deadline, value) < 0) {
      updateField("deadline", value);
    }
  };

  const updateTimingType = (value: ClientJobInput["timingType"]) => {
    updateField("timingType", value);
    updateField("hourlyRate", null);

    if (value === "HOURLY" || value === "WEEKLY") {
      updateField("jobDate", "");
      updateField("deadline", "");
    }
  };

  return (
    <>
      <Field label="Job timing">
        <div className="grid gap-2 sm:grid-cols-2">
          {timingTypes.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => updateTimingType(type.value)}
              className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                form.timingType === type.value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              <span className="block text-sm font-medium">{type.label}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{type.description}</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Urgency">
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted p-1">
          {urgencyOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => updateField("urgency", option.value)}
              className={`rounded-md py-2 text-sm font-medium transition-colors ${
                form.urgency === option.value
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Field>

      {form.timingType === "FIXED" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Job date">
            <Input
              type="date"
              value={form.jobDate || ""}
              onChange={(event) => updateJobDate(event.target.value)}
            />
          </Field>
          <Field label="Deadline">
            <Input
              type="date"
              min={form.jobDate || undefined}
              value={form.deadline}
              onChange={(event) => updateField("deadline", event.target.value)}
            />
          </Field>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          {form.timingType === "HOURLY"
            ? "Hourly selected. Add the hourly budget in Budget & files."
            : "Weekly selected. Add the weekly budget in Budget & files."}
        </div>
      )}

      <Field label="Work mode">
        <div className="grid gap-2 sm:grid-cols-3">
          {workModes.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => updateField("workMode", mode.value)}
              className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                form.workMode === mode.value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </Field>
    </>
  );
}

function LocationStep({
  form,
  attachments,
  updateField,
}: {
  form: ClientJobInput;
  attachments: AttachmentDraft[];
  updateField: <K extends keyof ClientJobInput>(key: K, value: ClientJobInput[K]) => void;
}) {
  const location: JobLocation = {
    locationName: form.locationAddress || "",
    latitude: form.locationLat ?? null,
    longitude: form.locationLng ?? null,
  };

  const updateLocation = (nextLocation: JobLocation) => {
    updateField("locationAddress", nextLocation.locationName);
    updateField("locationLabel", nextLocation.locationName ? "Selected job location" : "");
    updateField("locationLat", nextLocation.latitude);
    updateField("locationLng", nextLocation.longitude);
  };

  return (
    <>
      <div className="space-y-4">
        <Field label="Location search">
          <GoogleJobLocationPicker location={location} onLocationChange={updateLocation} />
        </Field>

        <div className="rounded-lg border border-border bg-background p-4">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Saved job location
              </p>
              <p className="mt-1 font-medium">
                {formatApproximateLocation(form.locationAddress, "No location selected yet")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReviewItem label="Title" value={form.title || "Not added"} />
        <ReviewItem label="Category" value={form.category || "Not selected"} />
        <ReviewItem
          label="Budget"
          value={formatBudget(form.budgetMin ?? null, form.budgetMax ?? null, form.timingType)}
        />
        <ReviewItem label="Timing" value={formatTimingType(form.timingType)} />
        <ReviewItem label="Urgency" value={formatEnum(form.urgency)} />
        <ReviewItem
          label="Work mode"
          value={form.workMode === "ON_SITE" ? "On-site" : formatEnum(form.workMode)}
        />
        <ReviewItem label="Files" value={`${attachments.length} attached`} />
        <ReviewItem
          label="Location"
          value={formatApproximateLocation(form.locationAddress, "No location selected yet")}
        />
      </div>
    </>
  );
}

function GoogleJobLocationPicker({
  location,
  onLocationChange,
}: {
  location: JobLocation;
  onLocationChange: (location: JobLocation) => void;
}) {
  return (
    <LocationPicker
      initial={
        location.latitude != null && location.longitude != null
          ? { lat: location.latitude, lng: location.longitude }
          : undefined
      }
      onChange={(data) => {
        onLocationChange({
          locationName: data.address ?? "",
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
        });
      }}
    />
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <Label className="text-sm font-medium">{label}</Label>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function validateStep(step: StepId, values: ClientJobInput & { attachments: AttachmentDraft[] }) {
  if (step === "basics") {
    if (!values.category.trim()) return "Select a category.";
    if (!values.title.trim()) return "Add a job title.";
    if (values.description.trim().length < 40)
      return "Add a project description with at least 40 characters.";
  }

  if (step === "files") {
    if (
      values.budgetMin != null &&
      values.budgetMax != null &&
      values.budgetMin > values.budgetMax
    ) {
      return "Maximum budget must be greater than minimum budget.";
    }
  }

  if (step === "timing") {
    if (values.timingType === "FIXED" && !values.deadline.trim()) return "Add a deadline.";
    if (
      values.deadline.trim() &&
      values.jobDate?.trim() &&
      compareDateInputs(values.deadline, values.jobDate) < 0
    ) {
      return "Deadline must be on or after the job date.";
    }
  }

  if (step === "location" && values.workMode !== "REMOTE") {
    if (
      !values.locationAddress?.trim() ||
      values.locationLat == null ||
      values.locationLng == null
    ) {
      return "Select a job location by choosing a suggestion or dropping the map pin.";
    }
  }

  return null;
}

function isStepComplete(step: StepId, values: ClientJobInput & { attachments: AttachmentDraft[] }) {
  if (step === "basics") {
    return (
      Boolean(values.category.trim()) &&
      Boolean(values.title.trim()) &&
      values.description.trim().length >= 40
    );
  }

  if (step === "files") {
    const budgetIsValid =
      values.budgetMin == null || values.budgetMax == null || values.budgetMin <= values.budgetMax;

    return (
      (values.budgetMin != null || values.budgetMax != null || values.attachments.length > 0) &&
      budgetIsValid
    );
  }

  if (step === "timing") {
    const deadlineIsValid =
      values.timingType === "HOURLY" ||
      values.timingType === "WEEKLY" ||
      (Boolean(values.deadline.trim()) &&
        (!values.jobDate?.trim() || compareDateInputs(values.deadline, values.jobDate) >= 0));

    return Boolean(values.timingType) && deadlineIsValid;
  }

  if (step === "location") {
    return (
      values.workMode === "REMOTE" ||
      (Boolean(values.locationAddress?.trim()) &&
        values.locationLat != null &&
        values.locationLng != null)
    );
  }

  return false;
}

function validateAll(values: ClientJobInput & { attachments: AttachmentDraft[] }) {
  for (const step of wizardSteps) {
    const message = validateStep(step.id, values);

    if (message) {
      return message;
    }
  }

  return null;
}

function getFirstIncompleteStep(values: ClientJobInput & { attachments: AttachmentDraft[] }) {
  const index = wizardSteps.findIndex((step) => !isStepComplete(step.id, values));

  return index >= 0 ? index : wizardSteps.length - 1;
}

function calculateCompletion(values: ClientJobInput & { attachments: AttachmentDraft[] }) {
  const checks = [
    Boolean(values.category?.trim()),
    Boolean(values.title.trim()),
    values.description.trim().length >= 40,
    values.attachments.length > 0,
    values.budgetMin != null || values.budgetMax != null,
    Boolean(values.timingType),
    values.timingType === "FIXED"
      ? Boolean(values.jobDate?.trim())
      : values.budgetMin != null || values.budgetMax != null,
    values.timingType === "FIXED"
      ? Boolean(values.deadline?.trim())
      : values.budgetMin != null || values.budgetMax != null,
    values.workMode === "REMOTE" ||
      (Boolean(values.locationAddress?.trim()) &&
        values.locationLat != null &&
        values.locationLng != null),
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function toDateInputValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function compareDateInputs(a: string, b: string) {
  return new Date(`${a}T00:00:00.000Z`).getTime() - new Date(`${b}T00:00:00.000Z`).getTime();
}

async function readAttachment(file: File): Promise<AttachmentDraft> {
  const base = {
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
  };

  if (!file.type.startsWith("image/")) {
    return base;
  }

  const previewUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });

  return {
    ...base,
    previewUrl,
  };
}

function formatFileSize(size?: number) {
  if (!size) {
    return "Unknown size";
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function emitAdminActivity(reason: string) {
  try {
    const socket = io(getSocketUrl());
    socket.emit("admin:activity", { reason });
    window.setTimeout(() => socket.disconnect(), 800);
  } catch {
    // Admin dashboard refresh is best-effort; saved data remains the source of truth.
  }
}

function getSocketUrl() {
  return (
    import.meta.env.VITE_SOCKET_URL ||
    `${window.location.protocol}//${window.location.hostname}:4001`
  );
}

function formatBudget(
  min: number | null,
  max: number | null,
  timingType: ClientJobInput["timingType"] = "FIXED",
) {
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

function formatTimingType(value: ClientJobInput["timingType"]) {
  if (value === "HOURLY") {
    return "Hourly";
  }

  if (value === "WEEKLY") {
    return "Weekly";
  }

  return "Fixed project";
}

function getBudgetUnit(value: ClientJobInput["timingType"]) {
  if (value === "HOURLY") {
    return "hourly";
  }

  if (value === "WEEKLY") {
    return "weekly";
  }

  return "total";
}

function getBudgetSuffix(value: ClientJobInput["timingType"]) {
  if (value === "HOURLY") {
    return " / hour";
  }

  if (value === "WEEKLY") {
    return " / week";
  }

  return "";
}
