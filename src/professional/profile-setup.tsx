import { createServerFn } from "@tanstack/react-start";
import { Link, createFileRoute, redirect, useLoaderData, useRouter } from "@tanstack/react-router";
import type { ComponentType, FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Bell,
  Camera,
  FileBadge,
  FileCheck,
  FileText,
  ImagePlus,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Save,
  ShieldCheck,
  Upload,
  UserRound,
} from "lucide-react";
import { z } from "zod";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUser } from "@/lib/current-user.server";
import {
  upsertPhase1ProfessionalProfile,
  upsertPhase1ProfessionalVerifications,
} from "@/lib/phase1-profile-db.server";
import {
  getProfessionalVerificationByUserId,
  upsertProfessionalVerification,
} from "@/lib/pro-verification-db.server";
import {
  getProfessionalProfileByUserId,
  updateProfessionalAvatarByUserId,
  updateProfessionalProfileByUserId,
  updateProfessionalWorkPhotosByUserId,
} from "@/lib/user-db.server";

const professionalProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required."),
  profilePhotoUrl: z.string().trim().optional(),
  professionalCategory: z.string().trim().min(2, "Add your main skill or service category."),
  professionalCity: z.string().trim().min(2, "City is required."),
  skillsText: z.string().trim().min(2, "Add at least one skill or service."),
  experienceYears: z.coerce.number().min(0).max(80).optional().nullable(),
  hourlyRate: z.coerce.number().min(0).optional().nullable(),
  fixedRate: z.coerce.number().min(0).optional().nullable(),
  portfolioUrl: z.string().trim().optional(),
  workPhotosText: z.string().trim().optional(),
  certificationsText: z.string().trim().optional(),
  tradeLicenseUrl: z.string().trim().optional(),
  availabilityStatus: z.enum(["available", "busy", "unavailable"]),
  serviceArea: z.string().trim().min(2, "Service area is required."),
  serviceRadiusKm: z.coerce.number().min(0).max(500).optional().nullable(),
  workMode: z.enum(["remote", "onsite", "both"]),
  companyDescription: z.string().trim().min(10, "Add a short professional bio."),
  address: z.string().trim().min(3, "Address or base location is required."),
  emailNotificationsEnabled: z.boolean(),
  browserNotificationsEnabled: z.boolean(),
  projectActivityNotificationsEnabled: z.boolean(),
  governmentIdUrl: z.string().trim().optional(),
  insuranceUrl: z.string().trim().optional(),
  selfieUrl: z.string().trim().optional(),
});

type ProfessionalProfileForm = z.infer<typeof professionalProfileSchema>;

type VerificationDocumentKey =
  | "governmentIdUrl"
  | "tradeLicenseUrl"
  | "certificationsText"
  | "insuranceUrl"
  | "selfieUrl";

type LocationPickerTarget = "professionalCity" | "serviceArea" | "address";

const verificationDocumentOptions: Array<{
  value: VerificationDocumentKey;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  optional?: boolean;
}> = [
  {
    value: "governmentIdUrl",
    label: "Government ID",
    description: "Passport, Aadhaar, voter ID, or another government identity document.",
    icon: FileText,
  },
  {
    value: "tradeLicenseUrl",
    label: "License",
    description: "Trade license, professional license, or business registration.",
    icon: FileBadge,
  },
  {
    value: "certificationsText",
    label: "Certificates",
    description: "Training certificate, award, or qualification proof.",
    icon: FileCheck,
  },
  {
    value: "insuranceUrl",
    label: "Insurance",
    description: "Liability, work, or service insurance document.",
    icon: ShieldCheck,
  },
  {
    value: "selfieUrl",
    label: "Selfie verification",
    description: "Selfie check to help confirm the profile owner.",
    icon: Camera,
  },
];

const skillOptions = [
  "Plumbing",
  "Electrical",
  "Cleaning",
  "Repair",
  "Moving",
  "Photography",
  "Design",
  "Development",
  "Marketing",
  "Tutoring",
  "Carpentry",
  "Painting",
];

const serviceRadiusPresets = [5, 10, 25, 50] as const;

const getProfessionalProfilePage = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = getCurrentUser();

  if (!viewer) {
    return null;
  }

  return {
    viewer,
    professionalProfile:
      viewer.role === "PROFESSIONAL" ? getProfessionalProfileByUserId(viewer.id) : null,
    verification:
      viewer.role === "PROFESSIONAL" ? getProfessionalVerificationByUserId(viewer.id) : null,
  };
});

const saveProfessionalProfile = createServerFn({ method: "POST" })
  .inputValidator((data: ProfessionalProfileForm) => professionalProfileSchema.parse(data))
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "PROFESSIONAL") {
      return {
        ok: false as const,
        formError: "Only professional accounts can save a professional profile.",
      };
    }

    const profile = updateProfessionalProfileByUserId({
      userId: viewer.id,
      fullName: data.fullName,
      profilePhotoUrl: data.profilePhotoUrl || null,
      professionalCategory: data.professionalCategory,
      professionalCity: data.professionalCity,
      skills: splitList(data.skillsText),
      experienceYears: data.experienceYears ?? null,
      hourlyRate: data.hourlyRate ?? null,
      fixedRate: data.fixedRate ?? null,
      portfolioUrl: data.portfolioUrl || null,
      workPhotos: splitList(data.workPhotosText || ""),
      certifications: splitList(data.certificationsText || ""),
      tradeLicenseUrl: data.tradeLicenseUrl || null,
      availabilityStatus: data.availabilityStatus,
      serviceArea: data.serviceArea,
      serviceRadiusKm: data.serviceRadiusKm ?? null,
      workMode: data.workMode,
      companyDescription: data.companyDescription,
      address: data.address,
      emailNotificationsEnabled: data.emailNotificationsEnabled,
      browserNotificationsEnabled: data.browserNotificationsEnabled,
      projectActivityNotificationsEnabled: data.projectActivityNotificationsEnabled,
    });
    const verification = upsertProfessionalVerification({
      userId: viewer.id,
      governmentIdUrl: data.governmentIdUrl || null,
      licenseUrl: data.tradeLicenseUrl || null,
      certifications: splitList(data.certificationsText || ""),
      insuranceUrl: data.insuranceUrl || null,
      selfieUrl: data.selfieUrl || null,
    });
    upsertPhase1ProfessionalProfile({
      userId: viewer.id,
      role: viewer.role,
      email: viewer.email,
      phone: viewer.phone,
      fullName: data.fullName,
      profilePhotoUrl: data.profilePhotoUrl || null,
      companyName: viewer.companyName || null,
      address: data.address,
      bio: data.companyDescription,
      professionalCategory: data.professionalCategory,
      professionalCity: data.professionalCity,
      skills: splitList(data.skillsText),
      hourlyRate: data.hourlyRate ?? null,
      fixedRate: data.fixedRate ?? null,
      experienceYears: data.experienceYears ?? null,
      serviceType: data.workMode,
      serviceRadiusKm: data.serviceRadiusKm ?? null,
      availabilityStatus: data.availabilityStatus,
      portfolioUrl: data.portfolioUrl || null,
      isVerified: profile?.isVerified,
    });
    upsertPhase1ProfessionalVerifications({
      userId: viewer.id,
      governmentIdUrl: data.governmentIdUrl || null,
      licenseUrl: data.tradeLicenseUrl || null,
      certifications: splitList(data.certificationsText || ""),
      insuranceUrl: data.insuranceUrl || null,
      selfieUrl: data.selfieUrl || null,
      status: verification.status,
    });

    return {
      ok: true as const,
      profile,
      verification,
    };
  });

const saveProfessionalVerificationUpload = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      governmentIdUrl?: string;
      tradeLicenseUrl?: string;
      certificationsText?: string;
      insuranceUrl?: string;
      selfieUrl?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "PROFESSIONAL") {
      return {
        ok: false as const,
        formError: "Only professional accounts can upload verification documents.",
      };
    }

    const verification = upsertProfessionalVerification({
      userId: viewer.id,
      governmentIdUrl: data.governmentIdUrl || null,
      licenseUrl: data.tradeLicenseUrl || null,
      certifications: splitList(data.certificationsText || ""),
      insuranceUrl: data.insuranceUrl || null,
      selfieUrl: data.selfieUrl || null,
    });
    upsertPhase1ProfessionalVerifications({
      userId: viewer.id,
      governmentIdUrl: data.governmentIdUrl || null,
      licenseUrl: data.tradeLicenseUrl || null,
      certifications: splitList(data.certificationsText || ""),
      insuranceUrl: data.insuranceUrl || null,
      selfieUrl: data.selfieUrl || null,
      status: verification.status,
    });

    return {
      ok: true as const,
      verification,
    };
  });

const saveProfessionalWorkPhotosUpload = createServerFn({ method: "POST" })
  .inputValidator((data: { workPhotosText?: string }) => data)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "PROFESSIONAL") {
      return {
        ok: false as const,
        formError: "Only professional accounts can upload work photos.",
      };
    }

    const profile = updateProfessionalWorkPhotosByUserId({
      userId: viewer.id,
      workPhotos: splitList(data.workPhotosText || ""),
    });

    return {
      ok: true as const,
      profile,
    };
  });

const saveProfessionalProfilePhotoUpload = createServerFn({ method: "POST" })
  .inputValidator((data: { profilePhotoUrl?: string }) => data)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "PROFESSIONAL") {
      return {
        ok: false as const,
        formError: "Only professional accounts can upload a profile photo.",
      };
    }

    const profile = updateProfessionalAvatarByUserId({
      userId: viewer.id,
      avatarUrl: data.profilePhotoUrl || "",
    });

    return {
      ok: true as const,
      profile,
    };
  });

export const Route = createFileRoute("/professional-profile")({
  beforeLoad: async ({ location }) => {
    const data = await getProfessionalProfilePage();

    if (!data?.viewer) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }

    if (data.viewer.role !== "PROFESSIONAL") {
      throw redirect({ to: "/profile-setup" });
    }
  },
  loader: () => getProfessionalProfilePage(),
  head: () => ({
    meta: [
      { title: "Professional profile setup - Servio" },
      { name: "description", content: "Complete your professional profile for Phase-1 discovery." },
    ],
  }),
  component: ProfessionalProfileSetup,
});

function ProfessionalProfileSetup() {
  const data = useLoaderData({ from: "/professional-profile" });
  const router = useRouter();
  const viewer = data?.viewer;
  const profile = data?.professionalProfile;
  const verification = data?.verification;
  const [form, setForm] = useState<ProfessionalProfileForm>(() => ({
    fullName: profile?.fullName || `${viewer?.firstName ?? ""} ${viewer?.lastName ?? ""}`.trim(),
    profilePhotoUrl: profile?.avatarUrl || viewer?.avatarUrl || "",
    professionalCategory: profile?.professionalCategory || "",
    professionalCity: profile?.professionalCity || "",
    skillsText: profile?.skills.join(", ") || "",
    experienceYears: profile?.experienceYears ?? 0,
    hourlyRate: profile?.hourlyRate ?? 0,
    fixedRate: profile?.fixedRate ?? 0,
    portfolioUrl: profile?.portfolioUrl || "",
    workPhotosText: profile?.workPhotos.join("\n") || "",
    certificationsText: profile?.certifications.join(", ") || "",
    tradeLicenseUrl: profile?.tradeLicenseUrl || "",
    availabilityStatus:
      (profile?.availabilityStatus as ProfessionalProfileForm["availabilityStatus"]) || "available",
    serviceArea: profile?.serviceArea || "",
    serviceRadiusKm: profile?.serviceRadiusKm ?? 10,
    workMode: (profile?.workMode as ProfessionalProfileForm["workMode"]) || "both",
    companyDescription: profile?.companyDescription || "",
    address: profile?.address || "",
    emailNotificationsEnabled: profile?.emailNotificationsEnabled ?? true,
    browserNotificationsEnabled: profile?.browserNotificationsEnabled ?? true,
    projectActivityNotificationsEnabled: profile?.projectActivityNotificationsEnabled ?? true,
    governmentIdUrl: verification?.governmentIdUrl || "",
    insuranceUrl: verification?.insuranceUrl || "",
    selfieUrl: verification?.selfieUrl || "",
  }));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerificationSaving, setIsVerificationSaving] = useState(false);
  const [isWorkPhotosSaving, setIsWorkPhotosSaving] = useState(false);
  const [isProfilePhotoSaving, setIsProfilePhotoSaving] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedSkillOption, setSelectedSkillOption] = useState(skillOptions[0]);
  const [customSkill, setCustomSkill] = useState("");
  const [selectedVerificationDoc, setSelectedVerificationDoc] =
    useState<VerificationDocumentKey>("governmentIdUrl");
  const [locationPickerTarget, setLocationPickerTarget] = useState<LocationPickerTarget | null>(
    null,
  );
  const [locationPickerValue, setLocationPickerValue] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const displayName =
    form.fullName ||
    `${viewer?.firstName ?? ""} ${viewer?.lastName ?? ""}`.trim() ||
    "Professional";
  const completion = useMemo(() => getCompletion(form), [form]);
  const selectedSkills = splitList(form.skillsText);
  const verificationStatus = getVerificationStatus({
    status: verification?.status,
    governmentIdUrl: form.governmentIdUrl,
    licenseUrl: form.tradeLicenseUrl,
    certificationsText: form.certificationsText,
    insuranceUrl: form.insuranceUrl,
    selfieUrl: form.selfieUrl,
  });
  const selectedVerificationOption =
    verificationDocumentOptions.find((option) => option.value === selectedVerificationDoc) ||
    verificationDocumentOptions[0];
  const SelectedVerificationIcon = selectedVerificationOption.icon;
  const selectedVerificationUploaded = Boolean(form[selectedVerificationDoc]);

  const stopSelfieCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraReady(false);
    setIsCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      stopSelfieCamera();
    };
  }, []);

  useEffect(() => {
    setBrowserPermission("Notification" in window ? Notification.permission : "unsupported");
  }, []);

  useEffect(() => {
    if (!isCameraOpen || !videoRef.current || !streamRef.current) {
      return;
    }

    const video = videoRef.current;
    video.srcObject = streamRef.current;

    const markCameraReady = () => {
      setIsCameraReady(true);
      setCameraError(null);
    };

    video.addEventListener("loadedmetadata", markCameraReady);
    video.addEventListener("canplay", markCameraReady);
    void video.play().catch(() => {
      setCameraError("Camera opened, but the preview could not start. Please try again.");
    });

    return () => {
      video.removeEventListener("loadedmetadata", markCameraReady);
      video.removeEventListener("canplay", markCameraReady);
    };
  }, [isCameraOpen]);

  if (!viewer) {
    return null;
  }

  if (!isEditing) {
    return (
      <AppShell
        title="Professional profile"
        userName={displayName}
        userRole="Professional"
        userAvatarUrl={form.profilePhotoUrl || viewer.avatarUrl}
      >
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-4">
                <img
                  src={
                    form.profilePhotoUrl ||
                    viewer.avatarUrl ||
                    "https://i.pravatar.cc/140?u=professional-profile"
                  }
                  alt={displayName}
                  className="h-24 w-24 rounded-2xl object-cover"
                />
                <div>
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <UserRound className="h-4 w-4" />
                    Professional profile
                  </div>
                  <h1 className="mt-2 text-2xl font-semibold tracking-tight">{displayName}</h1>
                  <p className="mt-1 text-muted-foreground">
                    {form.professionalCategory || "Service category not added"}
                  </p>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    {form.companyDescription || "No professional bio added yet."}
                  </p>
                </div>
              </div>
              <Button type="button" onClick={() => setIsEditing(true)} className="gap-2">
                <Pencil className="h-4 w-4" />
                Edit profile
              </Button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <SectionTitle
                title="Profile information"
                subtitle="All information saved in your professional profile."
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <ProfileInfoItem label="Name" value={form.fullName || "Not added"} />
                <ProfileInfoItem
                  label="Category"
                  value={form.professionalCategory || "Not added"}
                />
                <ProfileInfoItem label="City" value={form.professionalCity || "Not added"} />
                <ProfileInfoItem label="Address" value={form.address || "Not added"} />
                <ProfileInfoItem label="Service area" value={form.serviceArea || "Not added"} />
                <ProfileInfoItem
                  label="Service radius"
                  value={formatServiceRadius(clampServiceRadius(Number(form.serviceRadiusKm ?? 0)))}
                />
                <ProfileInfoItem label="Work mode" value={capitalizeWords(form.workMode)} />
                <ProfileInfoItem
                  label="Availability"
                  value={capitalizeWords(form.availabilityStatus)}
                />
                <ProfileInfoItem
                  label="Experience"
                  value={`${Number(form.experienceYears ?? 0)} years`}
                />
                <ProfileInfoItem
                  label="Hourly rate"
                  value={
                    form.hourlyRate
                      ? `$${Number(form.hourlyRate).toLocaleString()} / hour`
                      : "Not added"
                  }
                />
                <ProfileInfoItem
                  label="Fixed rate"
                  value={
                    form.fixedRate ? `$${Number(form.fixedRate).toLocaleString()}` : "Not added"
                  }
                />
                <ProfileInfoItem label="Portfolio" value={form.portfolioUrl || "Not added"} />
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                <SectionTitle title="Skills" subtitle="Services clients can match with." />
                <div className="mt-5 flex flex-wrap gap-2">
                  {selectedSkills.length ? (
                    selectedSkills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full border border-border bg-muted/30 px-3 py-1 text-sm"
                      >
                        {skill}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No skills added yet.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                <SectionTitle
                  title="Profile status"
                  subtitle="Completion and verification summary."
                />
                <div className="mt-5 space-y-3">
                  <ProfileInfoItem label="Completion" value={`${completion}%`} />
                  <ProfileInfoItem label="Verification" value={verificationStatus.label} />
                  <ProfileInfoItem
                    label="Documents uploaded"
                    value={`${verificationStatus.uploadedCount}/5`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  const updateField = <Key extends keyof ProfessionalProfileForm>(
    key: Key,
    value: ProfessionalProfileForm[Key],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const openLocationPicker = (target: LocationPickerTarget) => {
    setLocationPickerTarget(target);
    setLocationPickerValue(String(form[target] || ""));
  };

  const applyLocationPicker = () => {
    if (!locationPickerTarget) {
      return;
    }

    const selectedLocation =
      locationPickerValue.trim() ||
      (locationPickerTarget ? String(form[locationPickerTarget] || "").trim() : "");

    if (!selectedLocation) {
      return;
    }

    updateField(locationPickerTarget, selectedLocation);

    if (locationPickerTarget !== "professionalCity" && !form.professionalCity.trim()) {
      updateField("professionalCity", getCityFromLocation(selectedLocation));
    }

    if (locationPickerTarget === "serviceArea") {
      updateField("address", selectedLocation);
    }

    if (locationPickerTarget === "address" && !form.serviceArea.trim()) {
      updateField("serviceArea", selectedLocation);
    }

    setLocationPickerTarget(null);
  };

  const addSkill = (skill: string) => {
    const trimmedSkill = capitalizeWords(skill).trim();

    if (!trimmedSkill) {
      return;
    }

    const currentSkills = splitList(form.skillsText);
    const alreadyAdded = currentSkills.some(
      (currentSkill) => currentSkill.toLowerCase() === trimmedSkill.toLowerCase(),
    );

    if (alreadyAdded) {
      return;
    }

    updateField("skillsText", [...currentSkills, trimmedSkill].join(", "));
  };

  const removeSkill = (skill: string) => {
    updateField(
      "skillsText",
      selectedSkills.filter((currentSkill) => currentSkill !== skill).join(", "),
    );
  };

  const handleAddSelectedSkill = () => {
    if (selectedSkillOption === "Other") {
      addSkill(customSkill);
      setCustomSkill("");
      return;
    }

    addSkill(selectedSkillOption);
  };

  const requestBrowserNotificationPermission = async () => {
    if (!("Notification" in window)) {
      setBrowserPermission("unsupported");
      updateField("browserNotificationsEnabled", false);
      setSubmitError("Browser notifications are not supported in this browser.");
      return;
    }

    const permission = await Notification.requestPermission();
    setBrowserPermission(permission);

    if (permission === "granted") {
      updateField("browserNotificationsEnabled", true);
      setStatusMessage("Browser notifications enabled. Save your profile to keep this setting.");
      return;
    }

    updateField("browserNotificationsEnabled", false);
    setSubmitError("Browser notification permission was not granted.");
  };

  const handleBrowserNotificationChange = async (checked: boolean) => {
    if (!checked) {
      updateField("browserNotificationsEnabled", false);
      return;
    }

    if (!("Notification" in window)) {
      setBrowserPermission("unsupported");
      updateField("browserNotificationsEnabled", false);
      setSubmitError("Browser notifications are not supported in this browser.");
      return;
    }

    if (Notification.permission === "granted") {
      setBrowserPermission("granted");
      updateField("browserNotificationsEnabled", true);
      return;
    }

    if (Notification.permission === "denied") {
      setBrowserPermission("denied");
      updateField("browserNotificationsEnabled", false);
      setSubmitError("Browser permission is blocked. Enable notifications from site settings.");
      return;
    }

    await requestBrowserNotificationPermission();
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(file);
    });

  const handleProfilePhoto = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    const profilePhotoUrl = await readFileAsDataUrl(file);

    updateField("profilePhotoUrl", profilePhotoUrl);
    setIsProfilePhotoSaving(true);
    setSubmitError(null);
    setStatusMessage(null);

    try {
      const result = await saveProfessionalProfilePhotoUpload({
        data: {
          profilePhotoUrl,
        },
      });

      if (!result.ok) {
        setSubmitError(result.formError);
        return;
      }

      setStatusMessage("Profile photo updated and saved.");
      await router.invalidate();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not save profile photo.");
    } finally {
      setIsProfilePhotoSaving(false);
    }
  };

  const appendWorkPhotos = async (files: FileList | null) => {
    if (!files?.length) {
      return;
    }

    const urls = await Promise.all(Array.from(files).slice(0, 6).map(readFileAsDataUrl));
    const nextWorkPhotosText = urls.join("\n");

    updateField("workPhotosText", nextWorkPhotosText);
    setIsWorkPhotosSaving(true);
    setSubmitError(null);
    setStatusMessage(null);

    try {
      const result = await saveProfessionalWorkPhotosUpload({
        data: {
          workPhotosText: nextWorkPhotosText,
        },
      });

      if (!result.ok) {
        setSubmitError(result.formError);
        return;
      }

      setStatusMessage("Work photos updated and saved to your portfolio.");
      await router.invalidate();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not save work photos.");
    } finally {
      setIsWorkPhotosSaving(false);
    }
  };

  const appendCertification = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    const current = splitList(form.certificationsText || "");
    updateField("certificationsText", [...current, file.name].join(", "));
  };

  const persistVerificationUpload = async (key: VerificationDocumentKey, fileUrl: string) => {
    const nextForm = {
      ...form,
      [key]: fileUrl,
    };

    updateField(key, fileUrl);
    setIsVerificationSaving(true);
    setSubmitError(null);
    setStatusMessage(null);

    try {
      const result = await saveProfessionalVerificationUpload({
        data: {
          governmentIdUrl: nextForm.governmentIdUrl,
          tradeLicenseUrl: nextForm.tradeLicenseUrl,
          certificationsText: nextForm.certificationsText,
          insuranceUrl: nextForm.insuranceUrl,
          selfieUrl: nextForm.selfieUrl,
        },
      });

      if (!result.ok) {
        setSubmitError(result.formError);
        return;
      }

      const documentLabel =
        verificationDocumentOptions.find((option) => option.value === key)?.label || "Document";
      setStatusMessage(`${documentLabel} uploaded and saved to verification records.`);
      await router.invalidate();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not save verification document.",
      );
    } finally {
      setIsVerificationSaving(false);
    }
  };

  const handleVerificationFile = async (key: VerificationDocumentKey, file: File | undefined) => {
    if (!file) {
      return;
    }

    const fileUrl = await readFileAsDataUrl(file);
    await persistVerificationUpload(key, fileUrl);
  };

  const startSelfieCamera = async () => {
    setCameraError(null);
    setIsCameraReady(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is not available in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      setIsCameraOpen(true);
    } catch {
      setIsCameraReady(false);
      setCameraError("Camera permission was denied or the camera could not be opened.");
    }
  };

  const captureSelfie = async () => {
    const video = videoRef.current;

    if (!video || !isCameraReady || !video.videoWidth || !video.videoHeight) {
      setCameraError("Please wait for the camera preview to load.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    context?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const selfieUrl = canvas.toDataURL("image/jpeg", 0.9);
    stopSelfieCamera();
    await persistVerificationUpload("selfieUrl", selfieUrl);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage(null);
    setSubmitError(null);
    setFieldErrors({});

    const parsed = professionalProfileSchema.safeParse(form);

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errors[String(issue.path[0])] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setIsSaving(true);

    try {
      const result = await saveProfessionalProfile({ data: parsed.data });

      if (!result.ok) {
        setSubmitError(result.formError);
        return;
      }

      setStatusMessage("Professional profile saved. Clients can now discover this profile.");
      await router.invalidate();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not save professional profile.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell
      userName={displayName}
      userRole="Professional"
      userAvatarUrl={form.profilePhotoUrl || viewer.avatarUrl}
    >
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Professional profile setup</h1>
        </div>
        <div className="rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
          {completion}% complete
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="h-fit rounded-xl border border-border bg-card p-5 shadow-soft lg:sticky lg:top-20">
          <div className="flex items-start gap-4">
            <div
              className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full"
              style={{
                background: `conic-gradient(hsl(var(--primary)) ${completion * 3.6}deg, hsl(var(--muted)) 0deg)`,
              }}
            >
              <div className="grid h-[86px] w-[86px] place-items-center rounded-full bg-card">
                <img
                  src={form.profilePhotoUrl || "https://i.pravatar.cc/140?u=professional-profile"}
                  alt={displayName}
                  className="h-20 w-20 rounded-full object-cover"
                />
              </div>
              <span className="absolute -bottom-2 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground shadow-soft">
                {completion}%
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-semibold">{displayName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {form.professionalCategory || "Add your main service"}
              </p>
              <Badge className="mt-3" variant={profile?.isVerified ? "default" : "secondary"}>
                {profile?.isVerified ? "Verified" : "Verification pending"}
              </Badge>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-border bg-background p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Profile completion</span>
              <span className="font-semibold text-foreground">{completion}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${completion}%` }} />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Complete your details and verification documents to improve client trust.
            </p>
          </div>

          <Button asChild type="button" className="mt-4 w-full gap-2">
            <Link to="/professional-messages">
              <MessageSquare className="h-4 w-4" />
              Messages
            </Link>
          </Button>
        </aside>

        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <SectionTitle
              title="Basic profile"
              subtitle="Your public identity on the professional side."
            />
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Full name" error={fieldErrors.fullName}>
                <Input
                  value={form.fullName}
                  onChange={(event) => updateField("fullName", capitalizeWords(event.target.value))}
                />
              </Field>
              <Field label="Profile picture" error={fieldErrors.profilePhotoUrl}>
                <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-input text-sm hover:bg-muted">
                  <Camera className="h-4 w-4" />
                  {isProfilePhotoSaving
                    ? "Saving..."
                    : form.profilePhotoUrl
                      ? "Change photo"
                      : "Upload photo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={isProfilePhotoSaving}
                    onChange={(event) => handleProfilePhoto(event.target.files?.[0])}
                  />
                </label>
              </Field>
              <Field label="Main category / service" error={fieldErrors.professionalCategory}>
                <Input
                  placeholder="e.g. Electrician, UI Designer, Cleaner"
                  value={form.professionalCategory}
                  onChange={(event) =>
                    updateField("professionalCategory", capitalizeWords(event.target.value))
                  }
                />
              </Field>
              <Field label="Professional city" error={fieldErrors.professionalCity}>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. Surat"
                    value={form.professionalCity}
                    onChange={(event) =>
                      updateField("professionalCity", capitalizeWords(event.target.value))
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0 gap-2"
                    onClick={() => openLocationPicker("professionalCity")}
                  >
                    <MapPin className="h-4 w-4" />
                    Map
                  </Button>
                </div>
              </Field>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <SectionTitle
              title="Skills, experience, and pricing"
              subtitle="Tell clients what you do and how you charge."
            />
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field
                label="Skills / services"
                error={fieldErrors.skillsText}
                className="md:col-span-2"
              >
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <Select value={selectedSkillOption} onValueChange={setSelectedSkillOption}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {skillOptions.map((skill) => (
                          <SelectItem key={skill} value={skill}>
                            {skill}
                          </SelectItem>
                        ))}
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" onClick={handleAddSelectedSkill}>
                      Add skill
                    </Button>
                  </div>

                  {selectedSkillOption === "Other" ? (
                    <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                      <Input
                        placeholder="Write another skill or service"
                        value={customSkill}
                        onChange={(event) => setCustomSkill(capitalizeWords(event.target.value))}
                      />
                      <Button
                        type="button"
                        onClick={() => {
                          addSkill(customSkill);
                          setCustomSkill("");
                        }}
                      >
                        Add other
                      </Button>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-3">
                    {selectedSkills.length ? (
                      selectedSkills.map((skill) => (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => removeSkill(skill)}
                          className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                        >
                          {skill} x
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Select a skill and click Add skill. Use Other for anything not listed.
                      </p>
                    )}
                  </div>
                </div>
              </Field>
              <Field label="Experience years" error={fieldErrors.experienceYears}>
                <Input
                  type="number"
                  min={0}
                  value={form.experienceYears ?? 0}
                  onChange={(event) => updateField("experienceYears", Number(event.target.value))}
                />
              </Field>
              <Field label="Hourly rate" error={fieldErrors.hourlyRate}>
                <Input
                  type="number"
                  min={0}
                  value={form.hourlyRate ?? 0}
                  onChange={(event) => updateField("hourlyRate", Number(event.target.value))}
                />
              </Field>
              <Field label="Fixed rate" error={fieldErrors.fixedRate}>
                <Input
                  type="number"
                  min={0}
                  value={form.fixedRate ?? 0}
                  onChange={(event) => updateField("fixedRate", Number(event.target.value))}
                />
              </Field>
              <Field label="Portfolio link" error={fieldErrors.portfolioUrl}>
                <Input
                  placeholder="https://your-work.com"
                  value={form.portfolioUrl}
                  onChange={(event) => updateField("portfolioUrl", event.target.value)}
                />
              </Field>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <SectionTitle
              title="Work proof and documents"
              subtitle="Add photos, certificates, and license details clients can trust."
            />
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Work photos" error={fieldErrors.workPhotosText}>
                <label
                  className={`flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border text-sm transition-all hover:bg-muted ${
                    form.workPhotosText
                      ? "border-success/40 bg-success/10 text-success shadow-soft"
                      : "border-input"
                  }`}
                >
                  {form.workPhotosText ? (
                    <BadgeCheck className="h-4 w-4" />
                  ) : (
                    <ImagePlus className="h-4 w-4" />
                  )}
                  {isWorkPhotosSaving
                    ? "Saving..."
                    : form.workPhotosText
                      ? "Uploaded"
                      : "Upload work photos"}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    disabled={isWorkPhotosSaving}
                    onChange={(event) => appendWorkPhotos(event.target.files)}
                  />
                </label>
              </Field>
              <Field label="Certifications" error={fieldErrors.certificationsText}>
                <label
                  className={`flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border text-sm transition-all hover:bg-muted ${
                    form.certificationsText
                      ? "border-success/40 bg-success/10 text-success shadow-soft"
                      : "border-input"
                  }`}
                >
                  {form.certificationsText ? (
                    <BadgeCheck className="h-4 w-4" />
                  ) : (
                    <FileBadge className="h-4 w-4" />
                  )}
                  {form.certificationsText ? "Uploaded" : "Upload certificate"}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="sr-only"
                    onChange={(event) => appendCertification(event.target.files?.[0])}
                  />
                </label>
              </Field>
              <Field
                label="Trade license URL"
                error={fieldErrors.tradeLicenseUrl}
                className="md:col-span-2"
              >
                <Input
                  placeholder="Paste trade license link if you already have one"
                  value={form.tradeLicenseUrl}
                  onChange={(event) => updateField("tradeLicenseUrl", event.target.value)}
                />
              </Field>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <SectionTitle
              title="Verification documents"
              subtitle="Select one document type, upload one file, and save it to verification records."
            />

            <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <div className="rounded-xl border border-border bg-background p-4">
                <Field label="Select document type">
                  <Select
                    value={selectedVerificationDoc}
                    onValueChange={(value) =>
                      setSelectedVerificationDoc(value as VerificationDocumentKey)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {verificationDocumentOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                  Only one file is uploaded for the selected document type. Uploading again replaces
                  that document.
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                      <SelectedVerificationIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{selectedVerificationOption.label}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {selectedVerificationOption.description}
                      </p>
                    </div>
                  </div>
                  <Badge variant={selectedVerificationUploaded ? "default" : "secondary"}>
                    {selectedVerificationUploaded ? "Uploaded" : "Needed"}
                  </Badge>
                </div>
                {selectedVerificationDoc === "selfieUrl" ? (
                  <div className="mt-4 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 gap-2"
                        onClick={startSelfieCamera}
                        disabled={isVerificationSaving}
                      >
                        <Camera className="h-4 w-4" />
                        {isVerificationSaving ? "Saving..." : "Take selfie"}
                      </Button>
                      <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md border border-input text-sm hover:bg-muted">
                        <ImagePlus className="h-4 w-4" />
                        {isVerificationSaving ? "Saving..." : "Select image"}
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(event) =>
                            handleVerificationFile("selfieUrl", event.target.files?.[0])
                          }
                        />
                      </label>
                    </div>
                    {cameraError ? <p className="text-sm text-destructive">{cameraError}</p> : null}
                    {isCameraOpen ? (
                      <div className="rounded-xl border border-border bg-card p-3">
                        <video
                          ref={videoRef}
                          className="aspect-video w-full rounded-lg bg-muted object-cover"
                          autoPlay
                          playsInline
                          muted
                          onLoadedMetadata={() => setIsCameraReady(true)}
                          onCanPlay={() => setIsCameraReady(true)}
                        />
                        {!isCameraReady ? (
                          <p className="mt-2 text-sm text-muted-foreground">
                            Camera preview is starting...
                          </p>
                        ) : null}
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <Button
                            type="button"
                            onClick={captureSelfie}
                            disabled={isVerificationSaving || !isCameraReady}
                          >
                            {isCameraReady ? "Capture and save" : "Loading camera..."}
                          </Button>
                          <Button type="button" variant="outline" onClick={stopSelfieCamera}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <label className="mt-4 flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md border border-input text-sm hover:bg-muted">
                    <Upload className="h-4 w-4" />
                    {isVerificationSaving
                      ? "Saving upload..."
                      : selectedVerificationUploaded
                        ? "Replace selected document"
                        : "Upload selected document"}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="sr-only"
                      onChange={(event) =>
                        handleVerificationFile(selectedVerificationDoc, event.target.files?.[0])
                      }
                    />
                  </label>
                )}
              </div>

              <div className="rounded-xl border border-border bg-background p-4">
                <h3 className="font-semibold">Verification badges display</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Completed documents can appear as trust badges on your public profile after
                  review.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant={form.governmentIdUrl ? "default" : "secondary"}>ID</Badge>
                  <Badge variant={form.tradeLicenseUrl ? "default" : "secondary"}>License</Badge>
                  <Badge variant={form.certificationsText ? "default" : "secondary"}>Certs</Badge>
                  <Badge variant={form.insuranceUrl ? "default" : "secondary"}>Insurance</Badge>
                  <Badge variant={form.selfieUrl ? "default" : "secondary"}>Selfie</Badge>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <VerificationStatusBox
                label="Document upload"
                done={verificationStatus.uploadedCount > 0}
              />
              <VerificationStatusBox label="Selfie verification" done={Boolean(form.selfieUrl)} />
              <VerificationStatusBox
                label="Badges ready"
                done={verificationStatus.requiredComplete}
              />
              <VerificationStatusBox
                label="Status tracking"
                value={verificationStatus.label}
                done={verificationStatus.status === "approved"}
              />
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <SectionTitle
              title="Email & Browser Notifications"
              subtitle="Choose how you want to hear about projects, messages, reviews, and payments."
            />
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <NotificationPreference
                icon={Mail}
                title="Email notifications"
                description="Send important account and project updates to your email."
                checked={form.emailNotificationsEnabled}
                onChange={(checked) => updateField("emailNotificationsEnabled", checked)}
              />
              <NotificationPreference
                icon={Bell}
                title="Browser notifications"
                description={
                  browserPermission === "granted"
                    ? "Show native browser alerts when new activity arrives."
                    : browserPermission === "denied"
                      ? "Browser permission is blocked. Enable it from site settings."
                      : browserPermission === "unsupported"
                        ? "This browser does not support native notifications."
                        : "Ask this browser for permission to show alerts."
                }
                checked={form.browserNotificationsEnabled && browserPermission === "granted"}
                disabled={browserPermission === "unsupported" || browserPermission === "denied"}
                onChange={handleBrowserNotificationChange}
                action={
                  browserPermission === "default" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={requestBrowserNotificationPermission}
                    >
                      Allow browser alerts
                    </Button>
                  ) : null
                }
              />
              <NotificationPreference
                icon={MessageSquare}
                title="Project activity alerts"
                description="Notify you about milestones, review requests, project tracking, and client actions."
                checked={form.projectActivityNotificationsEnabled}
                onChange={(checked) => updateField("projectActivityNotificationsEnabled", checked)}
                className="md:col-span-2"
              />
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <SectionTitle
              title="Availability and service area"
              subtitle="Control where and how clients can hire you."
            />
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Availability" error={fieldErrors.availabilityStatus}>
                <Select
                  value={form.availabilityStatus}
                  onValueChange={(value) =>
                    updateField(
                      "availabilityStatus",
                      value as ProfessionalProfileForm["availabilityStatus"],
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available now</SelectItem>
                    <SelectItem value="busy">Busy</SelectItem>
                    <SelectItem value="unavailable">Unavailable</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Remote / on-site / both" error={fieldErrors.workMode}>
                <Select
                  value={form.workMode}
                  onValueChange={(value) =>
                    updateField("workMode", value as ProfessionalProfileForm["workMode"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="onsite">On-site</SelectItem>
                    <SelectItem value="remote">Remote</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label="Service location"
                error={fieldErrors.serviceArea || fieldErrors.address}
              >
                <div className="flex gap-2">
                  <Input
                    placeholder="Address, area, or landmark"
                    value={form.serviceArea || form.address}
                    onChange={(event) => {
                      const location = capitalizeWords(event.target.value);

                      updateField("serviceArea", location);
                      updateField("address", location);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0 gap-2"
                    onClick={() => openLocationPicker("serviceArea")}
                  >
                    <MapPin className="h-4 w-4" />
                    Map
                  </Button>
                </div>
              </Field>
              <Field label="Service radius in km" error={fieldErrors.serviceRadiusKm}>
                <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {formatServiceRadius(form.serviceRadiusKm ?? 0)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Clients nearby can find you from{" "}
                        {form.serviceArea || form.address || "your service location"}.
                      </p>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={500}
                      value={form.serviceRadiusKm ?? 0}
                      onChange={(event) =>
                        updateField(
                          "serviceRadiusKm",
                          clampServiceRadius(Number(event.target.value)),
                        )
                      }
                      className="w-full sm:w-28"
                    />
                  </div>

                  <Slider
                    value={[Math.min(form.serviceRadiusKm ?? 0, 100)]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={([value]) => updateField("serviceRadiusKm", value)}
                    aria-label="Service radius in kilometers"
                  />

                  <div className="flex flex-wrap gap-2">
                    {serviceRadiusPresets.map((radius) => (
                      <button
                        key={radius}
                        type="button"
                        onClick={() => updateField("serviceRadiusKm", radius)}
                        className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                          form.serviceRadiusKm === radius
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-foreground hover:bg-muted"
                        }`}
                      >
                        {radius} km
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                    <div className="rounded-lg bg-background px-3 py-2">
                      <span className="block font-medium text-foreground">0 km</span>
                      Remote only or exact location.
                    </div>
                    <div className="rounded-lg bg-background px-3 py-2">
                      <span className="block font-medium text-foreground">10-25 km</span>
                      Best for local city service.
                    </div>
                    <div className="rounded-lg bg-background px-3 py-2">
                      <span className="block font-medium text-foreground">50+ km</span>
                      Regional coverage.
                    </div>
                  </div>
                </div>
              </Field>
              <Field
                label="Professional bio"
                error={fieldErrors.companyDescription}
                className="md:col-span-2"
              >
                <Textarea
                  className="min-h-28"
                  placeholder="Write a short profile clients will read before hiring you"
                  value={form.companyDescription}
                  onChange={(event) => updateField("companyDescription", event.target.value)}
                />
              </Field>
            </div>
          </section>

          {statusMessage ? (
            <div className="rounded-xl border border-success/20 bg-success/5 px-4 py-3 text-sm text-success">
              {statusMessage}
            </div>
          ) : null}
          {submitError ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {submitError}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button size="lg" type="submit" disabled={isSaving}>
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save professional profile"}
            </Button>
          </div>
        </div>
      </form>

      <Dialog
        open={Boolean(locationPickerTarget)}
        onOpenChange={(open) => !open && setLocationPickerTarget(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Select location on map</DialogTitle>
          </DialogHeader>

          <LocationMapPicker
            value={locationPickerValue}
            onChange={setLocationPickerValue}
            placeholder={locationPickerTarget ? String(form[locationPickerTarget] || "") : ""}
            targetLabel={formatLocationPickerTarget(locationPickerTarget)}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLocationPickerTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={applyLocationPicker}
              disabled={!locationPickerValue.trim()}
            >
              Use this location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function ProfileInfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-medium">{value}</p>
    </div>
  );
}

function NotificationPreference({
  icon: Icon,
  title,
  description,
  checked,
  disabled = false,
  className = "",
  action,
  onChange,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  className?: string;
  action?: ReactNode;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className={`rounded-xl border border-border bg-background p-4 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={`${checked ? "Turn off" : "Turn on"} ${title}`}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={`relative flex h-8 w-[74px] shrink-0 items-center rounded-full border px-1 text-[10px] font-bold uppercase transition-colors ${
            checked
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-muted text-muted-foreground"
          } ${disabled ? "cursor-not-allowed opacity-50" : "hover:shadow-sm"}`}
        >
          <span
            className={`z-10 flex-1 text-center transition-opacity ${checked ? "opacity-100" : "opacity-40"}`}
          >
            On
          </span>
          <span
            className={`z-10 flex-1 text-center transition-opacity ${checked ? "opacity-40" : "opacity-100"}`}
          >
            Off
          </span>
          <span
            className={`absolute top-1 h-6 w-8 rounded-full bg-background shadow transition-transform ${
              checked ? "translate-x-[34px]" : "translate-x-0"
            }`}
          />
        </button>
      </div>
      {action ? <div className="mt-4 flex justify-end">{action}</div> : null}
    </div>
  );
}

function Field({
  label,
  error,
  children,
  className = "",
}: {
  label: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-2 ${className}`}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error ? <span className="block text-sm text-destructive">{error}</span> : null}
    </label>
  );
}

function LocationMapPicker({
  value,
  onChange,
  placeholder,
  targetLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  targetLabel: string;
}) {
  const useGoogleMapsJs = import.meta.env.VITE_GOOGLE_MAPS_JS_ENABLED === "true";
  const googleMapsApiKey =
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyCZHfjLWVc0CJ4LMg3CP7fcBc3ncdR9Vtw";
  const googleKey = useGoogleMapsJs ? googleMapsApiKey : "";
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);

  useEffect(() => {
    if (!googleKey || !mapRef.current || !inputRef.current) {
      return;
    }

    let cancelled = false;

    const initMap = () => {
      if (cancelled || !mapRef.current || !inputRef.current) {
        return;
      }

      const win = window as Window & { google?: any };

      if (!win.google?.maps) {
        setMapError("Map could not load.");
        return;
      }

      const geocoder = new win.google.maps.Geocoder();
      const defaultCenter = { lat: 21.1702, lng: 72.8311 };
      const map = new win.google.maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });
      const marker = new win.google.maps.Marker({
        map,
        position: defaultCenter,
        draggable: true,
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
      const placesService = new win.google.maps.places.PlacesService(map);
      const updateSelectedLocation = (selectedLocation: string) => {
        const trimmedLocation = selectedLocation.trim();

        if (!trimmedLocation) {
          return;
        }

        if (inputRef.current) {
          inputRef.current.value = trimmedLocation;
        }

        onChange(trimmedLocation);
        setMapError(null);
      };

      const getGeocodedLocationText = (results: any[] | null | undefined) => {
        const result = results?.find((entry) => entry?.formatted_address) || results?.[0];

        if (result?.formatted_address) {
          return result.formatted_address;
        }

        const components = result?.address_components
          ?.map((component: any) => component?.long_name)
          .filter(Boolean);

        if (components?.length) {
          return components.join(", ");
        }

        const compoundCode = result?.plus_code?.compound_code;

        if (compoundCode) {
          return compoundCode.replace(/^[A-Z0-9+]+\s+/, "");
        }

        return "";
      };

      const setNearestPlace = (latLng: any) => {
        placesService.nearbySearch(
          {
            location: latLng,
            radius: 50,
          },
          (places: any[] | null, status: string) => {
            if (status === "OK" && places?.[0]) {
              updateSelectedLocation(
                places[0].vicinity
                  ? `${places[0].name}, ${places[0].vicinity}`
                  : places[0].name || "",
              );
            }
          },
        );
      };

      const setSelectedPosition = (latLng: any) => {
        marker.setPosition(latLng);
        map.panTo(latLng);
        map.setZoom(20);
        setMapError(null);
        geocoder.geocode({ location: latLng }, (results: any[], status: string) => {
          const selectedLocation = status === "OK" ? getGeocodedLocationText(results) : "";

          if (selectedLocation) {
            updateSelectedLocation(selectedLocation);
            return;
          }

          setNearestPlace(latLng);
        });
      };

      const setSelectedPlace = (placeId: string, latLng?: any) => {
        setMapError(null);
        placesService.getDetails(
          {
            placeId,
            fields: ["formatted_address", "geometry", "name"],
          },
          (place: any, status: string) => {
            if (status !== "OK" || !place) {
              if (latLng) {
                setSelectedPosition(latLng);
                return;
              }

              setMapError(null);
              return;
            }

            const location = place.geometry?.location || latLng;
            const selectedAddress = place.formatted_address || place.name || "";

            if (location) {
              marker.setPosition(location);
              map.panTo(location);
              map.setZoom(20);
            }

            if (selectedAddress) {
              updateSelectedLocation(selectedAddress);
              return;
            }

            setMapError(null);
          },
        );
      };

      map.addListener("click", (event: any) => {
        mapRef.current?.focus();

        if (event.placeId) {
          event.stop();
          setSelectedPlace(event.placeId, event.latLng);
          return;
        }

        if (event.latLng) {
          setSelectedPosition(event.latLng);
        }
      });
      marker.addListener("dragend", () => {
        const position = marker.getPosition();

        if (position) {
          setSelectedPosition(position);
        }
      });

      mapRef.current.addEventListener("keydown", (event) => {
        if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
          return;
        }

        const position = marker.getPosition();

        if (!position) {
          return;
        }

        event.preventDefault();

        const moveBy = 0.00005;
        const nextPosition = new win.google.maps.LatLng(
          position.lat() +
            (event.key === "ArrowUp" ? moveBy : event.key === "ArrowDown" ? -moveBy : 0),
          position.lng() +
            (event.key === "ArrowRight" ? moveBy : event.key === "ArrowLeft" ? -moveBy : 0),
        );

        setSelectedPosition(nextPosition);
      });

      const autocomplete = new win.google.maps.places.Autocomplete(inputRef.current, {
        fields: ["formatted_address", "geometry", "name"],
      });

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const location = place.geometry?.location;

        if (!location) {
          onChange(place.formatted_address || place.name || inputRef.current?.value || "");
          return;
        }

        marker.setPosition(location);
        map.setCenter(location);
        map.setZoom(20);
        updateSelectedLocation(
          place.formatted_address || place.name || inputRef.current?.value || "",
        );
      });

      const previewLocation = value.trim() || placeholder.trim();

      if (previewLocation) {
        geocoder.geocode({ address: previewLocation }, (results: any[], status: string) => {
          if (status === "OK" && results?.[0]?.geometry?.location) {
            const location = results[0].geometry.location;
            marker.setPosition(location);
            map.setCenter(location);
            map.setZoom(15);
          }
        });
      }
    };

    const win = window as Window & { google?: any };

    if (win.google?.maps?.places) {
      initMap();
      return () => {
        cancelled = true;
      };
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-google-maps-places="true"]',
    );

    if (existingScript) {
      existingScript.addEventListener("load", initMap, { once: true });
      return () => {
        cancelled = true;
        existingScript.removeEventListener("load", initMap);
      };
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsPlaces = "true";
    script.addEventListener("load", initMap, { once: true });
    script.addEventListener("error", () => setMapError("Map could not load."));
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      script.removeEventListener("load", initMap);
    };
  }, [googleKey, onChange, placeholder, value]);

  const previewLocation = value.trim() || placeholder.trim();
  const resolveLocationName = async () => {
    const query = value.trim();

    if (!query || googleKey) {
      return;
    }

    if (!googleMapsApiKey) {
      return;
    }

    setIsResolvingLocation(true);
    setMapError(null);

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${googleMapsApiKey}`,
      );
      const data = await response.json();
      const formattedAddress = data?.results?.[0]?.formatted_address;

      if (formattedAddress) {
        onChange(formattedAddress);
      }
    } catch {
      setMapError(null);
    } finally {
      setIsResolvingLocation(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(capitalizeWords(event.target.value))}
          onBlur={resolveLocationName}
          placeholder={placeholder || "Search city, address, area, or landmark"}
        />
        {!googleKey ? (
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            onClick={resolveLocationName}
            disabled={!value.trim() || isResolvingLocation}
          >
            {isResolvingLocation ? "Finding..." : "Find"}
          </Button>
        ) : null}
        <Button type="button" variant="outline" asChild>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(previewLocation || "Surat")}`}
            target="_blank"
            rel="noreferrer"
          >
            Open map
          </a>
        </Button>
      </div>

      {googleKey ? (
        <div className="overflow-hidden rounded-xl border border-border bg-muted">
          <div ref={mapRef} className="h-80 w-full outline-none" tabIndex={0} />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-muted">
          {previewLocation ? (
            <iframe
              title="Selected professional location"
              src={`https://www.google.com/maps?q=${encodeURIComponent(previewLocation)}&z=14&output=embed`}
              className="h-80 w-full border-0"
              loading="lazy"
            />
          ) : (
            <div className="grid h-80 place-items-center text-sm text-muted-foreground">
              Enter a location to preview it on the map.
            </div>
          )}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        {googleKey
          ? `Search or click the map to select the exact ${targetLabel}.`
          : `Type the ${targetLabel}, preview it on the map, then use this location.`}
      </p>
      {mapError ? <p className="text-sm text-destructive">{mapError}</p> : null}
    </div>
  );
}

function VerificationStatusBox({
  label,
  done,
  optional = false,
  value,
}: {
  label: string;
  done: boolean;
  optional?: boolean;
  value?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4 text-sm">
      <div className="flex items-center gap-2">
        <BadgeCheck className={`h-4 w-4 ${done ? "text-primary" : "text-muted-foreground"}`} />
        <span className="font-medium">{label}</span>
      </div>
      <p className="mt-2 text-muted-foreground">
        {value || (done ? "Complete" : optional ? "Optional" : "Pending")}
      </p>
    </div>
  );
}

function ProfileHint({
  icon: Icon,
  label,
  done,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  done: boolean;
  value?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <Badge variant={done ? "default" : "secondary"}>{value || (done ? "Done" : "Pending")}</Badge>
    </div>
  );
}

function splitList(value: string) {
  if (value.includes("data:")) {
    return value.split(/\n+/).flatMap((line) => {
      const trimmedLine = line.trim();

      if (!trimmedLine) {
        return [];
      }

      if (trimmedLine.startsWith("data:")) {
        return [trimmedLine];
      }

      return trimmedLine
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    });
  }

  return value
    .split(/,|\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function clampServiceRadius(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(500, Math.max(0, Math.round(value)));
}

function formatServiceRadius(value: number) {
  if (value <= 0) {
    return "Exact location / remote only";
  }

  if (value === 1) {
    return "Serving clients within 1 km";
  }

  return `Serving clients within ${value} km`;
}

function capitalizeWords(value: string) {
  const acronyms: Record<string, string> = {
    api: "API",
    css: "CSS",
    html: "HTML",
    id: "ID",
    js: "JS",
    seo: "SEO",
    ui: "UI",
    ux: "UX",
  };

  return value.replace(/[A-Za-z]+/g, (word) => {
    const acronym = acronyms[word.toLowerCase()];

    if (acronym) {
      return acronym;
    }

    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

function getCityFromLocation(value: string) {
  return (
    value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)[0] || value
  );
}

function formatLocationPickerTarget(target: LocationPickerTarget | null) {
  if (target === "professionalCity") {
    return "professional city";
  }

  if (target === "serviceArea") {
    return "service area";
  }

  return "base address";
}

function getCompletion(form: ProfessionalProfileForm) {
  const checks = [
    form.fullName,
    form.profilePhotoUrl,
    form.professionalCategory,
    form.professionalCity,
    form.skillsText,
    form.experienceYears !== null && form.experienceYears !== undefined,
    form.hourlyRate || form.fixedRate,
    form.portfolioUrl || form.workPhotosText,
    form.certificationsText || form.tradeLicenseUrl,
    form.availabilityStatus,
    form.serviceArea,
    form.workMode,
    form.companyDescription,
    form.address,
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function getVerificationStatus(input: {
  status?: string;
  governmentIdUrl?: string;
  licenseUrl?: string;
  certificationsText?: string;
  insuranceUrl?: string;
  selfieUrl?: string;
}) {
  const uploadedCount = [
    input.governmentIdUrl,
    input.licenseUrl,
    input.certificationsText,
    input.insuranceUrl,
    input.selfieUrl,
  ].filter(Boolean).length;
  const requiredComplete = Boolean(
    input.governmentIdUrl &&
    input.licenseUrl &&
    input.certificationsText &&
    input.insuranceUrl &&
    input.selfieUrl,
  );
  const status = uploadedCount > 0 ? input.status || "pending" : "not_started";

  return {
    status,
    uploadedCount,
    requiredComplete,
    label:
      status === "approved"
        ? "Approved"
        : status === "rejected"
          ? "Needs changes"
          : status === "pending"
            ? "Pending review"
            : "Not started",
  };
}
