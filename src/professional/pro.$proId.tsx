import { createServerFn } from "@tanstack/react-start";
import {
  createFileRoute,
  Link,
  notFound,
  useLoaderData,
  useNavigate,
} from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { getCurrentUser } from "@/lib/current-user.server";
import { getProfessionalVerificationByUserId } from "@/lib/pro-verification-db.server";
import { getProfessionalProfileByUserId } from "@/lib/user-db.server";
import { formatApproximateLocation } from "@/lib/location-privacy";
import {
  Star,
  MapPin,
  BadgeCheck,
  Clock,
  MessageSquare,
  Heart,
  Share2,
  Mail,
  Phone,
  FileText,
  FileBadge,
  ShieldCheck,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/pro/$proId")({
  head: () => ({ meta: [{ title: "Professional profile — Servio" }] }),
  loader: async ({ params }) => {
    const result = await getProDetails({ data: params.proId });

    if (!result || !result.profile) {
      throw notFound();
    }

    return result;
  },
  component: ProProfile,
  errorComponent: ({ error }) => <div className="p-10 text-center">{error.message}</div>,
  notFoundComponent: () => <div className="p-10 text-center">Pro not found.</div>,
});

const getProDetails = createServerFn({ method: "GET" })
  .inputValidator((id: string) => id)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();
    const proId = Number(data);

    if (!Number.isInteger(proId)) {
      return null;
    }

    const profile = getProfessionalProfileByUserId(proId);

    if (!profile) return null;

    const verification = getProfessionalVerificationByUserId(proId);

    return { viewer, profile, verification };
  });

function ProProfile() {
  const navigate = useNavigate();
  const {
    viewer,
    profile: pro,
    verification,
  } = useLoaderData({ from: "/pro/$proId" }) as {
    viewer: {
      id: number;
      firstName: string;
      lastName: string;
      email: string;
      role: string;
      avatarUrl?: string | null;
    } | null;
    profile: {
      id: number;
      fullName: string;
      avatarUrl: string | null;
      professionalCategory: string;
      professionalCity: string;
      serviceArea: string;
      address: string;
      availabilityStatus: string;
      averageRating: number;
      reviewCount: number;
      companyDescription: string;
      portfolioUrl: string;
      skills: string[];
      experienceYears: number | null;
      hourlyRate: number | null;
      fixedRate: number | null;
      certifications: string[];
      tradeLicenseUrl: string;
      workPhotos: string[];
      email: string;
      phone: string;
      workMode: string;
      serviceRadiusKm: number | null;
      isVerified: boolean;
    };
    verification: {
      governmentIdUrl: string;
      licenseUrl: string;
      certifications: string[];
      insuranceUrl: string;
      selfieUrl: string;
      status: string;
      updatedAt?: string;
    };
  };
  const rateLabel = pro.hourlyRate != null ? `$${pro.hourlyRate}/hr` : "Contact for rate";
  const fixedLabel = pro.fixedRate != null ? `$${pro.fixedRate}` : "Flexible";
  const locationLabel = formatApproximateLocation(
    pro.professionalCity || pro.serviceArea || pro.address,
    "Location not provided",
  );
  const mapLocation = locationLabel;
  const certificationLabels = getCertificationLabels(pro.certifications);
  const workPhotoUrls = getWorkPhotoUrls(pro.workPhotos);
  const workModeLabel =
    pro.workMode === "remote"
      ? "Remote"
      : pro.workMode === "onsite"
        ? "On-site"
        : "Remote & on-site";
  const ratingLabel = `${pro.averageRating.toFixed(1)} · ${pro.reviewCount} ${pro.reviewCount === 1 ? "review" : "reviews"}`;
  const verificationMeta = getVerificationMeta(verification.status);
  const verificationDocs = getVerificationDocuments(verification);
  const verificationBadges = verificationDocs.filter((document) => document.done);
  const uploadedVerificationCount = verificationDocs.filter((document) => document.done).length;

  return (
    <AppShell
      userName={viewer ? `${viewer.firstName} ${viewer.lastName}`.trim() : undefined}
      userRole={viewer?.role === "PROFESSIONAL" ? "Professional" : "Client"}
      userAvatarUrl={viewer?.avatarUrl}
    >
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
        <div className="h-32 gradient-primary" />
        <div className="px-6 pb-6 sm:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-5">
              <img
                src={pro.avatarUrl || "https://i.pravatar.cc/240?u=pro-profile"}
                alt={pro.fullName}
                className="-mt-12 h-24 w-24 rounded-2xl border-4 border-card object-cover shadow-elevated"
              />
              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight">{pro.fullName}</h1>
                  {verification.status === "approved" ? (
                    <BadgeCheck className="h-5 w-5 text-primary" />
                  ) : null}
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${verificationMeta.badgeClass}`}
                  >
                    {verificationMeta.label}
                  </span>
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
                    {pro.availabilityStatus}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {verificationBadges.length ? (
                    verificationBadges.map((badge) => (
                      <span
                        key={badge.label}
                        className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
                      >
                        <badge.icon className="h-3.5 w-3.5" />
                        {badge.label}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted-foreground">
                      No verification badges yet
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:pb-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Heart className="h-4 w-4" /> Save
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Share2 className="h-4 w-4" /> Share
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-2"
                onClick={() => openProfessionalMessage(viewer, pro, navigate)}
              >
                <MessageSquare className="h-4 w-4" /> Message
              </Button>
              <Button size="sm" variant="default" asChild>
                <Link to="/hire/$proId" params={{ proId: String(pro.id) }}>
                  Hire - {rateLabel}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="About this pro">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {pro.companyDescription ||
                "This professional has not yet added a description. Contact them to learn more about their experience and services."}
            </p>
          </Section>

          <Section title="Services">
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoCard label="Category" value={pro.professionalCategory || "Not specified"} />
              <InfoCard
                label="Service area"
                value={formatApproximateLocation(pro.serviceArea, locationLabel)}
              />
              <InfoCard label="Work mode" value={workModeLabel} />
              <InfoCard label="Availability" value={pro.availabilityStatus || "Not specified"} />
              <InfoCard label="Hourly rate" value={rateLabel} />
              <InfoCard label="Fixed rate" value={fixedLabel} />
            </div>
          </Section>

          <Section title="Portfolio">
            {pro.portfolioUrl ? (
              <a
                className="inline-block rounded-lg border border-primary bg-primary/5 px-4 py-2 text-primary font-medium hover:bg-primary/10 transition"
                href={pro.portfolioUrl}
                target="_blank"
                rel="noreferrer"
              >
                Visit portfolio
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">No portfolio link added yet.</p>
            )}
          </Section>

          <Section title="Skills & experience">
            <div className="flex flex-wrap gap-2">
              {pro.skills.length > 0 ? (
                pro.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full border border-border bg-background px-3 py-1 text-xs"
                  >
                    {skill}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No skills added yet.</span>
              )}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm text-muted-foreground">
              <div>
                <p className="text-foreground font-medium">Experience</p>
                <p>
                  {pro.experienceYears != null ? `${pro.experienceYears} years` : "Not specified"}
                </p>
              </div>
              <div>
                <p className="text-foreground font-medium">Trade license</p>
                {pro.tradeLicenseUrl ? (
                  <a
                    href={pro.tradeLicenseUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    View license
                  </a>
                ) : (
                  <p>Not provided</p>
                )}
              </div>
            </div>
          </Section>

          {certificationLabels.length > 0 ? (
            <Section title="Certifications">
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                {certificationLabels.map((cert) => (
                  <li key={cert}>{cert}</li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section title="Verification badges">
            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3">
                  <div
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${verificationMeta.iconClass}`}
                  >
                    <verificationMeta.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{verificationMeta.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {verificationMeta.description}
                    </p>
                    {verification.updatedAt ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Last updated {formatDateTime(verification.updatedAt)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-xl bg-muted px-4 py-3 text-center">
                  <p className="text-xl font-semibold">
                    {uploadedVerificationCount}/{verificationDocs.length}
                  </p>
                  <p className="text-xs text-muted-foreground">items uploaded</p>
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {verificationDocs.map((document) => (
                <VerificationCard
                  key={document.label}
                  icon={document.icon}
                  label={document.label}
                  done={document.done}
                  value={document.done ? "Uploaded" : "Missing"}
                />
              ))}
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <ProLocationMap location={mapLocation} label={locationLabel} proName={pro.fullName} />

          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h3 className="font-semibold">Contact</h3>
            <div className="mt-4 space-y-4 text-sm text-muted-foreground">
              <ContactRow icon={Mail} label="Email" value={pro.email || "Not available"} />
              <ContactRow icon={Phone} label="Phone" value={pro.phone || "Not available"} />
              <ContactRow icon={MapPin} label="Approx. location" value={locationLabel} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h3 className="font-semibold">Snapshot</h3>
            <div className="mt-4 space-y-4 text-sm text-muted-foreground">
              <StatRow label="Verification" value={verificationMeta.label} />
              <StatRow label="Rating" value={ratingLabel} />
              <StatRow
                label="Service radius"
                value={pro.serviceRadiusKm ? `${pro.serviceRadiusKm} km` : "Not set"}
              />
              <StatRow label="Work mode" value={workModeLabel} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h3 className="font-semibold">Availability</h3>
            <p className="mt-4 text-sm text-muted-foreground">
              {pro.availabilityStatus} and accepting new inquiries.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ProLocationMap({
  location,
  label,
  proName,
}: {
  location: string;
  label: string;
  proName: string;
}) {
  const hasLocation = Boolean(location.trim());
  const mapQuery = encodeURIComponent(location || label);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <div className="flex items-start justify-between gap-3 p-6 pb-4">
        <div>
          <h3 className="font-semibold">Location map</h3>
          <p className="mt-1 text-sm text-muted-foreground">{label}</p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          Pro marker
        </span>
      </div>

      <div className="relative h-64 border-t border-border bg-muted">
        {hasLocation ? (
          <iframe
            title={`${proName} location map`}
            src={`https://www.google.com/maps?q=${mapQuery}&z=12&output=embed`}
            className="h-full w-full border-0"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground">
            Location not added yet.
          </div>
        )}

        {hasLocation ? (
          <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
            <span className="absolute h-16 w-16 animate-ping rounded-full bg-primary/25" />
            <span className="absolute h-10 w-10 rounded-full border-2 border-primary/40 bg-primary/10" />
            <span className="relative grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-elevated">
              <MapPin className="h-5 w-5 fill-current" />
            </span>
            <span className="mt-2 max-w-40 rounded-full bg-background/95 px-3 py-1 text-center text-xs font-medium text-foreground shadow-soft">
              {proName}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4 text-sm">
      <p className="text-muted-foreground text-xs uppercase tracking-[0.2em]">{label}</p>
      <p className="mt-2 font-medium text-foreground">{value}</p>
    </div>
  );
}

function VerificationCard({
  icon: Icon,
  label,
  done,
  optional = false,
  value,
}: {
  icon: typeof FileText;
  label: string;
  done: boolean;
  optional?: boolean;
  value?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 font-medium text-foreground">
          <Icon className="h-4 w-4 text-primary" />
          {label}
        </span>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${done ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
        >
          {value || (done ? "Uploaded" : optional ? "Optional" : "Missing")}
        </span>
      </div>
    </div>
  );
}

function buildConversationId(clientId: number, professionalId: number) {
  return `client-${clientId}-pro-${professionalId}`;
}

function openProfessionalMessage(
  viewer: { id: number; role: string } | null,
  pro: { id: number; fullName: string; avatarUrl: string | null },
  navigate: ReturnType<typeof useNavigate>,
) {
  if (!viewer || viewer.role !== "CLIENT") {
    void navigate({
      to: "/login",
      search: { returnTo: `/pro/${pro.id}` } as never,
    });
    return;
  }

  rememberPendingProfessionalMessage(viewer.id, pro);

  void navigate({
    to: "/messages",
    search: {
      conversationId: buildConversationId(viewer.id, pro.id),
      toUserId: String(pro.id),
      name: pro.fullName,
      avatar: pro.avatarUrl || "",
      job: "Direct message",
      firstMessage: `Hi ${pro.fullName}, I found your profile and would like to discuss hiring you.`,
    } as never,
  });
}

function rememberPendingProfessionalMessage(
  viewerId: number,
  pro: { id: number; fullName: string; avatarUrl: string | null },
) {
  if (typeof window === "undefined") {
    return;
  }

  const conversationId = buildConversationId(viewerId, pro.id);
  sessionStorage.setItem(
    "servio:pending-professional-message",
    JSON.stringify({
      createdAt: Date.now(),
      conversation: {
        id: conversationId,
        otherUserId: pro.id,
        otherUserName: pro.fullName,
        otherUserAvatarUrl: pro.avatarUrl || null,
        job: "Direct message",
        preview: "Start conversation",
        time: "",
        unread: 0,
      },
      firstMessage: `Hi ${pro.fullName}, I found your profile and would like to discuss hiring you.`,
    }),
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-primary mt-1" />
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
        <p className="mt-1 font-medium text-foreground break-words">{value}</p>
      </div>
    </div>
  );
}

function formatVerificationStatus(status: string) {
  if (status === "approved") {
    return "Approved";
  }

  if (status === "rejected") {
    return "Needs changes";
  }

  if (status === "pending") {
    return "Pending review";
  }

  return "Not started";
}

function getVerificationMeta(status: string) {
  if (status === "approved") {
    return {
      label: "Approved",
      description: "This professional has passed verification review.",
      badgeClass: "bg-success/10 text-success",
      iconClass: "bg-success/10 text-success",
      icon: BadgeCheck,
    };
  }

  if (status === "rejected") {
    return {
      label: "Needs changes",
      description: "Submitted verification needs updated documents before approval.",
      badgeClass: "bg-destructive/10 text-destructive",
      iconClass: "bg-destructive/10 text-destructive",
      icon: ShieldCheck,
    };
  }

  if (status === "pending") {
    return {
      label: "Pending review",
      description: "Verification documents are saved and waiting for review.",
      badgeClass: "bg-primary/10 text-primary",
      iconClass: "bg-primary/10 text-primary",
      icon: Clock,
    };
  }

  return {
    label: "Not started",
    description: "This professional has not uploaded verification documents yet.",
    badgeClass: "bg-muted text-muted-foreground",
    iconClass: "bg-muted text-muted-foreground",
    icon: ShieldCheck,
  };
}

function getVerificationDocuments(verification: {
  governmentIdUrl: string;
  licenseUrl: string;
  certifications: string[];
  insuranceUrl: string;
  selfieUrl: string;
}) {
  return [
    { label: "Government ID", icon: FileText, done: Boolean(verification.governmentIdUrl) },
    { label: "Trade license", icon: FileBadge, done: Boolean(verification.licenseUrl) },
    {
      label: "Certifications",
      icon: BadgeCheck,
      done: Boolean(verification.certifications.length),
    },
    { label: "Insurance", icon: ShieldCheck, done: Boolean(verification.insuranceUrl) },
    { label: "Selfie verification", icon: Camera, done: Boolean(verification.selfieUrl) },
  ];
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getCertificationLabels(certifications: string[]) {
  return certifications
    .map((certification, index) => formatCertificationLabel(certification, index))
    .filter(Boolean);
}

function formatCertificationLabel(certification: string, index: number) {
  const trimmedCertification = certification.trim();

  if (!trimmedCertification) {
    return "";
  }

  if (
    trimmedCertification.startsWith("data:") ||
    trimmedCertification.includes(";base64") ||
    /^[A-Za-z0-9+/=]{80,}$/.test(trimmedCertification)
  ) {
    return `Certificate ${index + 1}`;
  }

  return trimmedCertification;
}

function getWorkPhotoUrls(workPhotos: string[]) {
  const urls: string[] = [];

  for (let index = 0; index < workPhotos.length; index += 1) {
    const photo = workPhotos[index]?.trim();
    const nextPhoto = workPhotos[index + 1]?.trim();

    if (!photo) {
      continue;
    }

    if (photo.startsWith("data:image/") && !photo.includes(",")) {
      if (nextPhoto) {
        urls.push(`${photo},${nextPhoto}`);
        index += 1;
      }

      continue;
    }

    if (photo.startsWith("data:image/") || /^https?:\/\//i.test(photo)) {
      urls.push(photo);
    }
  }

  return urls;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
