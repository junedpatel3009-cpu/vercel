import { useState } from "react";
import { createServerFn } from "@tanstack/react-start";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, redirect, useLoaderData } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Heart,
  ImagePlus,
  MapPin,
  MapPinHouse,
  Pencil,
  Save,
  UserRound,
  X,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUser } from "@/lib/current-user.server";
import { getFavoriteJobsByUserId } from "@/lib/job-db.server";
import { formatApproximateLocation } from "@/lib/location-privacy";
import { clientProfileSchema, type ClientProfileInput } from "@/lib/validation/client-profile";
import {
  findUserByEmailOrPhone,
  getClientProfileByUserId,
  updateClientProfileByUserId,
} from "@/lib/user-db.server";

const teamSizeOptions = [
  "Just me",
  "2-10 employees",
  "11-50 employees",
  "51-200 employees",
  "200+ employees",
] as const;

const suggestedHiringNeeds = [
  "Web development",
  "Mobile app design",
  "SEO",
  "Content writing",
  "Customer support",
  "Bookkeeping",
  "Video editing",
  "Lead generation",
];

const getMyInfoData = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = getCurrentUser();

  if (!viewer || viewer.role !== "CLIENT") {
    return null;
  }

  const clientProfile = getClientProfileByUserId(viewer.id);

  return {
    viewer,
    clientProfile,
    favoriteJobs: getFavoriteJobsByUserId(viewer.id),
  };
});

const updateMyInfo = createServerFn({ method: "POST" })
  .inputValidator((data: ClientProfileInput) => clientProfileSchema.parse(data))
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "CLIENT") {
      return {
        ok: false as const,
        formError: "Only client accounts can update this page.",
      };
    }

    const normalizedEmail = data.email.trim().toLowerCase();
    const normalizedPhone = data.phone.trim();
    const existingUser = findUserByEmailOrPhone(normalizedEmail, normalizedPhone);

    if (existingUser && existingUser.id !== viewer.id) {
      return {
        ok: false as const,
        formError:
          existingUser.email === normalizedEmail
            ? "This email address is already registered."
            : "This phone number is already registered.",
      };
    }

    const profile = updateClientProfileByUserId({
      userId: viewer.id,
      fullName: data.fullName,
      email: normalizedEmail,
      phone: normalizedPhone,
      companyName: data.companyName,
      companyWebsite: data.companyWebsite || null,
      industry: data.industry,
      teamSize: data.teamSize,
      companyDescription: data.companyDescription,
      address: data.address,
      avatarUrl: data.profilePhotoUrl || null,
      savedLocations: data.savedLocations,
      hiringNeeds: data.hiringNeeds,
    });

    return {
      ok: true as const,
      profile,
    };
  });

export const Route = createFileRoute("/my-info")({
  beforeLoad: async ({ location }) => {
    const data = await getMyInfoData();

    if (!data) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }
  },
  loader: () => getMyInfoData(),
  head: () => ({ meta: [{ title: "My Info - Servio" }] }),
  component: MyInfoPage,
});

function MyInfoPage() {
  const data = useLoaderData({ from: "/my-info" });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [newLocationLabel, setNewLocationLabel] = useState("");
  const [newLocationAddress, setNewLocationAddress] = useState("");
  const [newHiringNeed, setNewHiringNeed] = useState("");
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(
    data?.clientProfile?.avatarUrl ?? "",
  );
  const [isEditing, setIsEditing] = useState(false);

  if (!data) {
    return null;
  }

  const { viewer, clientProfile, favoriteJobs } = data;
  const displayName = clientProfile?.fullName || `${viewer.firstName} ${viewer.lastName}`.trim();

  const form = useForm<ClientProfileInput>({
    resolver: zodResolver(clientProfileSchema),
    defaultValues: {
      fullName: clientProfile?.fullName ?? `${viewer.firstName} ${viewer.lastName}`.trim(),
      email: clientProfile?.email ?? viewer.email,
      phone: clientProfile?.phone ?? viewer.phone ?? "",
      companyName: clientProfile?.companyName ?? "",
      companyWebsite: clientProfile?.companyWebsite ?? "",
      industry: clientProfile?.industry ?? "",
      teamSize: clientProfile?.teamSize ?? "",
      companyDescription: clientProfile?.companyDescription ?? "",
      address: clientProfile?.address ?? "",
      profilePhotoUrl: clientProfile?.avatarUrl ?? viewer.avatarUrl ?? "",
      savedLocations: clientProfile?.savedLocations?.length
        ? clientProfile.savedLocations.map((location) => ({
            label: location.label,
            address: location.address,
          }))
        : [{ label: "Primary office", address: "" }],
      hiringNeeds: clientProfile?.hiringNeeds?.length ? clientProfile.hiringNeeds : [],
    },
  });

  const savedLocations = form.watch("savedLocations");
  const hiringNeeds = form.watch("hiringNeeds");
  const primaryLocationAddress =
    form.watch("address")?.trim() ||
    savedLocations?.[0]?.address?.trim() ||
    clientProfile?.address?.trim() ||
    clientProfile?.savedLocations?.[0]?.address?.trim() ||
    "";
  const profileImage =
    profilePhotoPreview ||
    clientProfile?.avatarUrl ||
    viewer.avatarUrl ||
    "https://i.pravatar.cc/120?u=client-my-info";

  async function handlePhotoUpload(file: File | undefined) {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setProfilePhotoPreview(result);
      form.setValue("profilePhotoUrl", result, { shouldValidate: true });
    };
    reader.readAsDataURL(file);
  }

  const addSavedLocation = () => {
    if (!newLocationLabel.trim() || !newLocationAddress.trim()) {
      setSubmitError("Enter both a location label and address before adding it.");
      return;
    }

    setSubmitError(null);
    form.setValue(
      "savedLocations",
      [...savedLocations, { label: newLocationLabel.trim(), address: newLocationAddress.trim() }],
      { shouldValidate: true },
    );
    setNewLocationLabel("");
    setNewLocationAddress("");
  };

  const removeSavedLocation = (index: number) => {
    form.setValue(
      "savedLocations",
      savedLocations.filter((_, currentIndex) => currentIndex !== index),
      { shouldValidate: true },
    );
  };

  const addHiringNeed = (value?: string) => {
    const nextNeed = (value ?? newHiringNeed).trim();

    if (!nextNeed) {
      setSubmitError("Add at least one skill or hiring need before saving.");
      return;
    }

    if (hiringNeeds.some((need) => need.toLowerCase() === nextNeed.toLowerCase())) {
      setSubmitError("That skill is already listed.");
      return;
    }

    setSubmitError(null);
    form.setValue("hiringNeeds", [...hiringNeeds, nextNeed], { shouldValidate: true });
    setNewHiringNeed("");
  };

  const removeHiringNeed = (needToRemove: string) => {
    form.setValue(
      "hiringNeeds",
      hiringNeeds.filter((need) => need !== needToRemove),
      { shouldValidate: true },
    );
  };

  const onSubmit = async (values: ClientProfileInput) => {
    setSuccessMessage(null);
    setSubmitError(null);

    const result = await updateMyInfo({ data: values });

    if (!result.ok) {
      setSubmitError(result.formError);
      return;
    }

    if (result.profile) {
      form.reset({
        fullName: result.profile.fullName,
        email: result.profile.email,
        phone: result.profile.phone,
        companyName: result.profile.companyName,
        companyWebsite: result.profile.companyWebsite,
        industry: result.profile.industry,
        teamSize: result.profile.teamSize,
        companyDescription: result.profile.companyDescription,
        address: result.profile.address,
        profilePhotoUrl: result.profile.avatarUrl ?? "",
        savedLocations: result.profile.savedLocations,
        hiringNeeds: result.profile.hiringNeeds,
      });
      setProfilePhotoPreview(result.profile.avatarUrl ?? "");
    }

    setSuccessMessage("Your client information has been updated successfully.");
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <AppShell
        title="My profile"
        userName={displayName}
        userRole="Client"
        userAvatarUrl={profileImage}
      >
        <div className="space-y-6">
          <Card className="border-border shadow-soft">
            <CardContent className="p-6">
              <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-4">
                  <img
                    src={profileImage}
                    alt={displayName}
                    className="h-24 w-24 rounded-2xl object-cover"
                  />
                  <div>
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <UserRound className="h-4 w-4" />
                      Client profile
                    </div>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                      {displayName || "Client"}
                    </h1>
                    <p className="mt-1 text-muted-foreground">
                      {clientProfile?.companyName || "Company not added"}
                    </p>
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                      {clientProfile?.companyDescription || "No company description added yet."}
                    </p>
                  </div>
                </div>
                <Button type="button" onClick={() => setIsEditing(true)} className="gap-2">
                  <Pencil className="h-4 w-4" />
                  Edit profile
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
            <Card className="border-border shadow-soft">
              <CardHeader>
                <CardTitle>Profile information</CardTitle>
                <CardDescription>
                  All information saved from the client profile setup.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <SummaryItem label="Contact name" value={form.watch("fullName") || "Not added"} />
                <SummaryItem label="Email" value={form.watch("email") || "Not added"} />
                <SummaryItem label="Phone" value={form.watch("phone") || "Not added"} />
                <SummaryItem label="Company" value={form.watch("companyName") || "Not added"} />
                <SummaryItem label="Website" value={form.watch("companyWebsite") || "Not added"} />
                <SummaryItem label="Industry" value={form.watch("industry") || "Not added"} />
                <SummaryItem label="Team size" value={form.watch("teamSize") || "Not added"} />
                <SummaryItem label="Main address" value={form.watch("address") || "Not added"} />
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-border shadow-soft">
                <CardHeader>
                  <CardTitle>Hiring needs</CardTitle>
                  <CardDescription>Skills and services this client hires for.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {hiringNeeds.length ? (
                    hiringNeeds.map((need) => (
                      <span
                        key={need}
                        className="rounded-full border border-border bg-muted/30 px-3 py-1 text-sm"
                      >
                        {need}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No hiring needs added yet.</p>
                  )}
                </CardContent>
              </Card>

              <ClientLocationMap locationAddress={primaryLocationAddress} />

              <Card className="border-border shadow-soft">
                <CardHeader>
                  <CardTitle>Saved locations</CardTitle>
                  <CardDescription>Addresses saved for job posting and matching.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {savedLocations.filter((location) => location.address).length ? (
                    savedLocations
                      .filter((location) => location.address)
                      .map((location, index) => (
                        <div
                          key={`${location.label}-${index}`}
                          className="rounded-2xl border border-border bg-muted/30 p-4"
                        >
                          <p className="font-medium">{location.label || "Saved location"}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{location.address}</p>
                        </div>
                      ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No saved locations added yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="My info"
      userName={displayName}
      userRole="Client"
      userAvatarUrl={profilePhotoPreview || clientProfile?.avatarUrl || viewer.avatarUrl}
    >
      <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
        <Card className="border-border shadow-soft">
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-primary">
              <UserRound className="h-4 w-4" />
              Client account information
            </div>
            <CardTitle>Edit your onboarding details</CardTitle>
            <CardDescription>
              Everything the client entered during signup onboarding can be reviewed and updated
              here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="flex items-start gap-4 rounded-2xl border border-border bg-muted/40 p-4">
                  <img
                    src={
                      profilePhotoPreview ||
                      clientProfile?.avatarUrl ||
                      viewer.avatarUrl ||
                      "https://i.pravatar.cc/120?u=client-my-info"
                    }
                    alt={displayName}
                    className="h-20 w-20 rounded-2xl object-cover"
                  />
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ImagePlus className="h-4 w-4" />
                      Company or profile photo
                    </div>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(event) => handlePhotoUpload(event.target.files?.[0])}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact name</FormLabel>
                        <FormControl>
                          <Input placeholder="Alex Rivers" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company name</FormLabel>
                        <FormControl>
                          <Input placeholder="Northwind Studio" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="you@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="9876543210" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="companyWebsite"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company website</FormLabel>
                        <FormControl>
                          <Input placeholder="https://yourcompany.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="industry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Industry</FormLabel>
                        <FormControl>
                          <Input placeholder="SaaS, e-commerce, healthcare..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="teamSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Team size</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select your team size" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {teamSizeOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="companyDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>About your company</FormLabel>
                      <FormControl>
                        <Textarea
                          className="min-h-28"
                          placeholder="Describe your company, typical projects, and how you like to work with freelancers."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary company location</FormLabel>
                      <FormControl>
                        <Textarea
                          className="min-h-24"
                          placeholder="Full office or billing address"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <MapPinHouse className="h-4 w-4 text-primary" />
                    Saved locations
                  </div>
                  <div className="grid gap-3 rounded-2xl border border-border bg-muted/40 p-4 sm:grid-cols-[180px_1fr_auto]">
                    <Input
                      placeholder="Location label"
                      value={newLocationLabel}
                      onChange={(event) => setNewLocationLabel(event.target.value)}
                    />
                    <Input
                      placeholder="Address"
                      value={newLocationAddress}
                      onChange={(event) => setNewLocationAddress(event.target.value)}
                    />
                    <Button type="button" onClick={addSavedLocation}>
                      Add
                    </Button>
                  </div>
                  {savedLocations.map((location, index) => (
                    <div
                      key={`${location.label}-${index}`}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-muted/30 p-4"
                    >
                      <div>
                        <p className="font-medium">{location.label}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{location.address}</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => removeSavedLocation(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <FormField
                    control={form.control}
                    name="savedLocations"
                    render={() => (
                      <FormItem>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <BriefcaseBusiness className="h-4 w-4 text-primary" />
                    Hiring needs
                  </div>
                  <div className="rounded-2xl border border-border bg-muted/40 p-4">
                    <div className="flex flex-wrap gap-2">
                      {suggestedHiringNeeds.map((need) => (
                        <button
                          key={need}
                          type="button"
                          onClick={() => addHiringNeed(need)}
                          className="rounded-full border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:border-primary hover:text-primary"
                        >
                          + {need}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                      <Input
                        placeholder="Add a custom hiring need"
                        value={newHiringNeed}
                        onChange={(event) => setNewHiringNeed(event.target.value)}
                      />
                      <Button type="button" onClick={() => addHiringNeed()}>
                        Add skill
                      </Button>
                    </div>
                  </div>
                  {hiringNeeds.map((need) => (
                    <div
                      key={need}
                      className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 px-4 py-3"
                    >
                      <span className="font-medium">{need}</span>
                      <button
                        type="button"
                        onClick={() => removeHiringNeed(need)}
                        className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={`Remove ${need}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <FormField
                    control={form.control}
                    name="hiringNeeds"
                    render={() => (
                      <FormItem>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {submitError ? (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {submitError}
                  </div>
                ) : null}
                {successMessage ? (
                  <div className="rounded-xl border border-success/20 bg-success/5 px-4 py-3 text-sm text-success">
                    {successMessage}
                  </div>
                ) : null}

                <div className="flex gap-3">
                  <Button type="submit">
                    <Save className="h-4 w-4" />
                    Save changes
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border shadow-soft">
            <CardHeader>
              <div className="flex items-center gap-2 text-sm text-primary">
                <Building2 className="h-4 w-4" />
                Company summary
              </div>
              <CardTitle>Current company profile</CardTitle>
              <CardDescription>
                A quick view of the client information currently saved from onboarding.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <SummaryItem label="Company" value={form.watch("companyName") || "Not added"} />
              <SummaryItem label="Industry" value={form.watch("industry") || "Not added"} />
              <SummaryItem label="Team size" value={form.watch("teamSize") || "Not added"} />
              <SummaryItem label="Website" value={form.watch("companyWebsite") || "Not added"} />
            </CardContent>
          </Card>

          <ClientLocationMap locationAddress={primaryLocationAddress} />

          <Card className="border-border shadow-soft">
            <CardHeader>
              <div className="flex items-center gap-2 text-sm text-primary">
                <BriefcaseBusiness className="h-4 w-4" />
                Hiring summary
              </div>
              <CardTitle>What this client hires for</CardTitle>
              <CardDescription>
                These skills now come from the onboarding flow and can be changed anytime here.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {hiringNeeds.map((need) => (
                <span
                  key={need}
                  className="rounded-full border border-border bg-muted/30 px-3 py-1 text-sm"
                >
                  {need}
                </span>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border shadow-soft">
            <CardHeader>
              <div className="flex items-center gap-2 text-sm text-primary">
                <Heart className="h-4 w-4" />
                Saved favorites
              </div>
              <CardTitle>Favorite jobs</CardTitle>
              <CardDescription>Jobs you saved from the home page or job details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {favoriteJobs.length ? (
                favoriteJobs.map((job) => (
                  <Link
                    key={job.id}
                    to="/job/$jobId"
                    params={{ jobId: String(job.id) }}
                    className="block rounded-2xl border border-border bg-muted/30 p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 font-medium">{job.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{job.category}</p>
                      </div>
                      <Heart className="h-4 w-4 shrink-0 fill-primary text-primary" />
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <span>{formatBudget(job.budgetMin, job.budgetMax, job.timingType)}</span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(job.deadline)}
                      </span>
                      <span className="flex min-w-0 items-center gap-1 sm:col-span-2">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {formatApproximateLocation(
                            job.locationAddress || job.locationLabel,
                            "Remote job",
                          )}
                        </span>
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-5 text-center">
                  <Heart className="mx-auto h-7 w-7 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">No favorite jobs saved yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Save jobs from the home page and they will appear here.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function ClientLocationMap({ locationAddress }: { locationAddress: string }) {
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const query = currentCoords
    ? `${currentCoords.lat},${currentCoords.lng}`
    : locationAddress.trim();
  const mapSrc = query
    ? `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`
    : "";

  const handleUseMyLocation = () => {
    if (!navigator?.geolocation) {
      setStatusMessage("Location is not supported by this browser.");
      return;
    }

    setIsLocating(true);
    setStatusMessage(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setStatusMessage("Showing your current location on the map.");
        setIsLocating(false);
      },
      (error) => {
        setStatusMessage(error.message || "Could not get your location.");
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
  };

  return (
    <Card className="border-border shadow-soft">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Client location map</CardTitle>
            <CardDescription>
              Small embedded Google map for the current client address.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={handleUseMyLocation} disabled={isLocating}>
            {isLocating ? "Locating..." : "Use my location"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-2xl border border-border overflow-hidden bg-muted/40">
          {mapSrc ? (
            <iframe
              title="Client location map"
              src={mapSrc}
              className="h-44 w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="flex h-44 items-center justify-center px-4 text-sm text-muted-foreground">
              Add an address to your profile or use your location to show the map here.
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {currentCoords
            ? `Current location: ${currentCoords.lat.toFixed(4)}, ${currentCoords.lng.toFixed(4)}`
            : locationAddress
              ? locationAddress
              : "No location is available yet."}
        </p>
        {statusMessage ? <p className="text-sm text-muted-foreground">{statusMessage}</p> : null}
      </CardContent>
    </Card>
  );
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
