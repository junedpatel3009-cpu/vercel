import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, redirect, useLoaderData, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  Camera,
  Clock,
  FileBadge,
  FileCheck2,
  FileText,
  IdCard,
  ImagePlus,
  Shield,
  Upload,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { getCurrentUser } from "@/lib/current-user.server";
import {
  getProfessionalVerificationByUserId,
  upsertProfessionalVerification,
  type ProfessionalVerificationInfo,
} from "@/lib/pro-verification-db.server";

export const Route = createFileRoute("/verification")({
  head: () => ({
    meta: [
      { title: "Verification - Servio" },
      {
        name: "description",
        content: "Upload your documents to get verified and earn the trust badge.",
      },
    ],
  }),
  beforeLoad: async ({ location }) => {
    const data = await getVerificationPage();

    if (!data?.viewer || data.viewer.role !== "PROFESSIONAL") {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
  },
  loader: async () => {
    const data = await getVerificationPage();

    if (!data?.viewer || data.viewer.role !== "PROFESSIONAL") {
      throw redirect({ to: "/login" });
    }

    return data;
  },
  component: Verification,
});

type VerificationDocumentKey =
  | "governmentIdUrl"
  | "licenseUrl"
  | "certifications"
  | "insuranceUrl"
  | "selfieUrl";

const documentOptions: Array<{
  key: VerificationDocumentKey;
  title: string;
  desc: string;
  icon: typeof IdCard;
  accept: string;
}> = [
  {
    key: "governmentIdUrl",
    title: "Government ID",
    desc: "Passport, Aadhaar, voter ID, driver's license, or national ID.",
    icon: IdCard,
    accept: "image/*,.pdf",
  },
  {
    key: "licenseUrl",
    title: "Trade License",
    desc: "Required for licensed services such as plumbing, electrical, HVAC, or similar work.",
    icon: FileBadge,
    accept: "image/*,.pdf",
  },
  {
    key: "certifications",
    title: "Certifications",
    desc: "Training certificates, awards, or professional qualification proof.",
    icon: FileText,
    accept: "image/*,.pdf",
  },
  {
    key: "insuranceUrl",
    title: "Insurance",
    desc: "Liability, business, or service insurance document.",
    icon: Shield,
    accept: "image/*,.pdf",
  },
  {
    key: "selfieUrl",
    title: "Selfie verification",
    desc: "A clear selfie to help confirm the profile owner.",
    icon: Camera,
    accept: "image/*",
  },
];

const getVerificationPage = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = getCurrentUser();

  if (!viewer) {
    return null;
  }

  return {
    viewer,
    verification: getProfessionalVerificationByUserId(viewer.id),
  };
});

const saveVerificationDocument = createServerFn({ method: "POST" })
  .inputValidator((data: { key: VerificationDocumentKey; value: string }) => data)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "PROFESSIONAL") {
      return {
        ok: false as const,
        formError: "Only professional accounts can save verification documents.",
      };
    }

    const current = getProfessionalVerificationByUserId(viewer.id);
    const next = {
      ...current,
      [data.key]: data.key === "certifications" ? [data.value] : data.value,
    };
    const verification = upsertProfessionalVerification({
      userId: viewer.id,
      governmentIdUrl: next.governmentIdUrl,
      licenseUrl: next.licenseUrl,
      certifications: next.certifications,
      insuranceUrl: next.insuranceUrl,
      selfieUrl: next.selfieUrl,
    });

    return { ok: true as const, verification };
  });

function Verification() {
  const { viewer, verification } = useLoaderData({ from: "/verification" }) as {
    viewer: { firstName: string; lastName: string; avatarUrl?: string | null };
    verification: ProfessionalVerificationInfo;
  };
  const router = useRouter();
  const [savingKey, setSavingKey] = useState<VerificationDocumentKey | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const status = getStatusMeta(verification.status);
  const completedCount = getCompletedCount(verification);
  const percent = Math.round((completedCount / documentOptions.length) * 100);

  const docs = useMemo(
    () =>
      documentOptions.map((document) => ({
        ...document,
        uploaded: Boolean(getDocumentValue(verification, document.key)),
      })),
    [verification],
  );

  const uploadDocument = async (key: VerificationDocumentKey, file: File | undefined) => {
    if (!file) {
      return;
    }

    setSavingKey(key);
    setMessage(null);
    setError(null);

    try {
      const result = await saveVerificationDocument({
        data: {
          key,
          value: await readFileAsDataUrl(file),
        },
      });

      if (!result.ok) {
        setError(result.formError);
        return;
      }

      setMessage("Document saved to verification database.");
      await router.invalidate();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not save document.");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <AppShell
      title="Verification"
      userName={`${viewer.firstName} ${viewer.lastName}`.trim()}
      userAvatarUrl={viewer.avatarUrl}
    >
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-card to-success/5 p-6 shadow-soft">
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-success text-success-foreground shadow-soft">
            <BadgeCheck className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-bold">{percent}% verified</h2>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${status.color}`}
              >
                <status.icon className="h-3.5 w-3.5" />
                {status.label}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {completedCount} of {documentOptions.length} verification items saved in the database.
            </p>
            <div className="mt-3 h-2 w-full max-w-md overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-success transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>
        {message ? <p className="mt-4 text-sm font-medium text-primary">{message}</p> : null}
        {error ? <p className="mt-4 text-sm font-medium text-destructive">{error}</p> : null}
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {docs.map((document) => {
          const Icon = document.icon;
          const isSaving = savingKey === document.key;

          return (
            <div
              key={document.key}
              className="rounded-2xl border border-border bg-card p-5 shadow-soft"
            >
              <div className="flex items-start gap-4">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-base font-semibold">{document.title}</h3>
                    <DocumentBadge uploaded={document.uploaded} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{document.desc}</p>
                </div>
              </div>

              {document.uploaded ? (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm">
                  <span className="truncate font-medium">{document.title} saved</span>
                  <label className="cursor-pointer">
                    <span className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium hover:bg-muted">
                      {isSaving ? "Saving..." : "Replace"}
                    </span>
                    <input
                      type="file"
                      accept={document.accept}
                      className="sr-only"
                      disabled={isSaving}
                      onChange={(event) => uploadDocument(document.key, event.target.files?.[0])}
                    />
                  </label>
                </div>
              ) : (
                <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-6 text-center hover:bg-muted/40">
                  {document.key === "selfieUrl" ? (
                    <ImagePlus className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {isSaving ? "Saving to database..." : "Click to upload"}
                  </p>
                  <span className="mt-3 inline-flex h-9 items-center rounded-md bg-cta px-3 text-sm font-medium text-cta-foreground hover:bg-cta/90">
                    {isSaving ? "Saving..." : "Upload file"}
                  </span>
                  <input
                    type="file"
                    accept={document.accept}
                    className="sr-only"
                    disabled={isSaving}
                    onChange={(event) => uploadDocument(document.key, event.target.files?.[0])}
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}

function DocumentBadge({ uploaded }: { uploaded: boolean }) {
  if (uploaded) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
        <FileCheck2 className="h-3 w-3" />
        Uploaded
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-semibold text-warning-foreground">
      <Upload className="h-3 w-3" />
      Needed
    </span>
  );
}

function getStatusMeta(status: ProfessionalVerificationInfo["status"]) {
  if (status === "approved") {
    return { label: "Approved", color: "bg-success/10 text-success", icon: FileCheck2 };
  }

  if (status === "pending") {
    return { label: "Reviewing", color: "bg-primary/10 text-primary", icon: Clock };
  }

  if (status === "rejected") {
    return {
      label: "Needs changes",
      color: "bg-destructive/10 text-destructive",
      icon: AlertCircle,
    };
  }

  return { label: "Not started", color: "bg-warning/15 text-warning-foreground", icon: Upload };
}

function getDocumentValue(
  verification: ProfessionalVerificationInfo,
  key: VerificationDocumentKey,
) {
  if (key === "certifications") {
    return verification.certifications[0] || "";
  }

  return verification[key];
}

function getCompletedCount(verification: ProfessionalVerificationInfo) {
  return documentOptions.filter((document) => Boolean(getDocumentValue(verification, document.key)))
    .length;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
}
