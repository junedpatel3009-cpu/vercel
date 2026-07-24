import { useState, useEffect, useEffectEvent, useRef } from "react";
import { createServerFn } from "@tanstack/react-start";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createFileRoute,
  Link,
  redirect,
  useLoaderData,
  useNavigate,
} from "@tanstack/react-router";
import {
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  MapPinHouse,
  Save,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useForm } from "react-hook-form";

import { AuthLayout } from "@/components/AuthLayout";
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
import { requireCurrentUser } from "@/lib/current-user.server";
import { clientProfileSchema, type ClientProfileInput } from "@/lib/validation/client-profile";
import {
  findUserByEmailOrPhone,
  getClientProfileByUserId,
  updateClientProfileByUserId,
} from "@/lib/user-db.server";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearMessages,
  setIsLoading,
  setNewHiringNeed,
  setProfilePhotoPreview,
  setSubmitError,
  setSuccessMessage,
} from "@/store/slices/profileSlice";

const getProfileSetupData = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = requireCurrentUser();
  const clientProfile = viewer.role === "CLIENT" ? getClientProfileByUserId(viewer.id) : null;

  return {
    viewer,
    clientProfile,
  };
});

const saveClientProfile = createServerFn({ method: "POST" })
  .inputValidator((data: ClientProfileInput) => clientProfileSchema.parse(data))
  .handler(async ({ data }) => {
    const viewer = requireCurrentUser();

    if (viewer.role !== "CLIENT") {
      return {
        ok: false as const,
        formError: "Only client accounts can save this onboarding flow.",
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
      avatarUrl: data.profilePhotoUrl || undefined,
      savedLocations: data.savedLocations,
      hiringNeeds: data.hiringNeeds,
    });

    return {
      ok: true as const,
      profile,
    };
  });

export const Route = createFileRoute("/profile-setup")({
  beforeLoad: async ({ location }) => {
    try {
      await getProfileSetupData();
    } catch {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }
  },
  loader: () => getProfileSetupData(),
  head: () => ({
    meta: [
      { title: "Client onboarding - Servio" },
      { name: "description", content: "Set up your client company profile in three guided steps." },
    ],
  }),
  component: ProfileSetup,
});

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

const steps = [
  {
    title: "Company details",
    subtitle:
      "Start with the same polished company setup clients expect on marketplaces like Upwork.",
    validationMessage: "Please complete the required company details before continuing.",
    icon: Building2,
    fields: [
      "fullName",
      "email",
      "phone",
      "companyName",
      "companyWebsite",
      "industry",
      "teamSize",
      "companyDescription",
    ] as const,
  },
  {
    title: "Locations",
    subtitle:
      "Add your main company location and any saved service addresses your team uses often.",
    validationMessage:
      "Please add your main address and at least one saved location before continuing.",
    icon: MapPinHouse,
    fields: ["address", "savedLocations"] as const,
  },
  {
    title: "Hiring needs",
    subtitle:
      "Tell us what skills and services you hire for so the dashboard can feel tailored to your workflow.",
    validationMessage: "Please add at least one hiring need or skill before continuing.",
    icon: Sparkles,
    fields: ["hiringNeeds"] as const,
  },
] as const;

type LocationAutocompleteInputProps = {
  value: string;
  onChange: (value: string) => void;
  onLocationSelect: (location: { address: string; label: string }) => void | Promise<void>;
};

type GooglePlaceResult = {
  formatted_address?: string;
  name?: string;
};

type GoogleAutocompleteInstance = {
  setFields: (fields: string[]) => void;
  addListener: (
    eventName: string,
    callback: () => void,
  ) => {
    remove?: () => void;
  };
  getPlace: () => GooglePlaceResult;
};

type GoogleMapsWindow = Window & {
  google?: {
    maps?: {
      places?: {
        Autocomplete: new (
          input: HTMLInputElement,
          options: { types: string[] },
        ) => GoogleAutocompleteInstance;
      };
    };
  };
};

function LocationAutocompleteInput({
  value,
  onChange,
  onLocationSelect,
}: LocationAutocompleteInputProps) {
  const googleKey =
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyCZHfjLWVc0CJ4LMg3CP7fcBc3ncdR9Vtw";
  const inputRef = useRef<HTMLInputElement | null>(null);
  const handleChange = useEffectEvent(onChange);
  const handleLocationSelect = useEffectEvent(onLocationSelect);

  useEffect(() => {
    if (!googleKey || !inputRef.current) {
      return;
    }

    const win = window as GoogleMapsWindow;
    let autocompleteListener: { remove?: () => void } | undefined;

    const initAutocomplete = () => {
      if (!inputRef.current || !win.google?.maps?.places) {
        return;
      }

      const autocomplete = new win.google.maps.places.Autocomplete(inputRef.current, {
        types: ["geocode", "establishment"],
      });

      autocomplete.setFields(["formatted_address", "name"]);
      autocompleteListener = autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const address = place.formatted_address || place.name || inputRef.current?.value || "";
        const label = place.name || "Selected location";

        handleChange(address);
        void handleLocationSelect({ address, label });
      });
    };

    if (win.google?.maps?.places) {
      initAutocomplete();
      return () => {
        autocompleteListener?.remove?.();
      };
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-google-maps-places="true"]',
    );

    if (existingScript) {
      existingScript.addEventListener("load", initAutocomplete, { once: true });
      return () => {
        existingScript.removeEventListener("load", initAutocomplete);
        autocompleteListener?.remove?.();
      };
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleKey}&libraries=places`;
    script.async = true;
    script.dataset.googleMapsPlaces = "true";
    script.addEventListener("load", initAutocomplete, { once: true });
    document.head.appendChild(script);

    return () => {
      script.removeEventListener("load", initAutocomplete);
      autocompleteListener?.remove?.();
    };
  }, [googleKey, handleChange, handleLocationSelect]);

  if (!googleKey) {
    return (
      <Textarea
        className="min-h-24"
        placeholder="Select location"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <Input
      ref={inputRef}
      placeholder="Select location"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function ProfileSetup() {
  const { viewer, clientProfile } = useLoaderData({ from: "/profile-setup" });
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedLocationLabel, setSelectedLocationLabel] = useState(
    clientProfile?.savedLocations?.[0]?.label ?? "Selected location",
  );
  const { profilePhotoPreview, successMessage, submitError, newHiringNeed, isLoading } =
    useAppSelector((state) => state.profile);

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
  const currentStepConfig = steps[currentStep];
  const progressPercent = ((currentStep + 1) / steps.length) * 100;

  const companyName = form.watch("companyName");
  const industry = form.watch("industry");
  const teamSize = form.watch("teamSize");
  const address = form.watch("address");
  const mapQuery = encodeURIComponent(address || savedLocations[0]?.address || "");
  const hasMapLocation = Boolean((address || savedLocations[0]?.address || "").trim());

  async function handlePhotoUpload(file: File | undefined) {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      dispatch(setProfilePhotoPreview(result));
      form.setValue("profilePhotoUrl", result, { shouldValidate: true });
    };
    reader.readAsDataURL(file);
  }

  const addHiringNeed = (value?: string) => {
    const nextNeed = (value ?? newHiringNeed).trim();

    if (!nextNeed) {
      dispatch(setSubmitError("Add at least one skill or hiring need before continuing."));
      return;
    }

    if (hiringNeeds.some((need) => need.toLowerCase() === nextNeed.toLowerCase())) {
      dispatch(setSubmitError("That skill is already in your hiring needs list."));
      return;
    }

    dispatch(setSubmitError(null));
    form.setValue("hiringNeeds", [...hiringNeeds, nextNeed], { shouldValidate: true });
    dispatch(setNewHiringNeed(""));
  };

  const removeHiringNeed = (needToRemove: string) => {
    form.setValue(
      "hiringNeeds",
      hiringNeeds.filter((need) => need !== needToRemove),
      { shouldValidate: true },
    );
  };

  const goToNextStep = async () => {
    dispatch(clearMessages());
    const stepIsValid = await form.trigger([...currentStepConfig.fields]);

    if (!stepIsValid) {
      dispatch(setSubmitError(currentStepConfig.validationMessage));
      return;
    }

    dispatch(setSubmitError(null));
    setCurrentStep((step) => Math.min(step + 1, steps.length - 1));
  };

  const goToPreviousStep = () => {
    dispatch(clearMessages());
    setCurrentStep((step) => Math.max(step - 1, 0));
  };

  const selectLocation = ({
    address: selectedAddress,
    label,
  }: {
    address: string;
    label: string;
  }) => {
    const trimmedAddress = selectedAddress.trim();

    form.setValue("address", trimmedAddress, { shouldValidate: true });
    form.setValue(
      "savedLocations",
      trimmedAddress
        ? [{ label: label.trim() || "Selected location", address: trimmedAddress }]
        : [],
      { shouldValidate: true },
    );
    setSelectedLocationLabel(label.trim() || "Selected location");
    dispatch(setSubmitError(null));
    dispatch(setSuccessMessage(null));
  };

  const applyProfileResult = (profile: Awaited<ReturnType<typeof updateClientProfileByUserId>>) => {
    if (!profile) {
      return;
    }

    form.reset({
      fullName: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      companyName: profile.companyName,
      companyWebsite: profile.companyWebsite,
      industry: profile.industry,
      teamSize: profile.teamSize,
      companyDescription: profile.companyDescription,
      address: profile.address,
      profilePhotoUrl: profile.avatarUrl ?? "",
      savedLocations: profile.savedLocations,
      hiringNeeds: profile.hiringNeeds,
    });
    setSelectedLocationLabel(profile.savedLocations[0]?.label ?? "Selected location");
    dispatch(setProfilePhotoPreview(profile.avatarUrl ?? ""));
  };

  const saveSelectedLocation = async ({
    address: selectedAddress,
    label,
  }: {
    address: string;
    label: string;
  }) => {
    const trimmedAddress = selectedAddress.trim();

    if (!trimmedAddress) {
      dispatch(setSubmitError("Select a valid location before saving."));
      return;
    }

    const currentValues = form.getValues();
    const nextSavedLocations = [
      { label: label.trim() || "Selected location", address: trimmedAddress },
    ];

    form.setValue("address", trimmedAddress, { shouldValidate: true });
    form.setValue("savedLocations", nextSavedLocations, { shouldValidate: true });
    dispatch(setSubmitError(null));
    dispatch(setSuccessMessage(null));
    dispatch(setIsLoading(true));

    try {
      const result = await saveClientProfile({
        data: {
          ...currentValues,
          address: trimmedAddress,
          savedLocations: nextSavedLocations,
        } satisfies ClientProfileInput,
      });

      if (!result.ok) {
        dispatch(setSubmitError(result.formError));
        return;
      }

      applyProfileResult(result.profile);
      dispatch(setSuccessMessage("Location saved."));
    } finally {
      dispatch(setIsLoading(false));
    }
  };

  const onSubmit = async (values: ClientProfileInput) => {
    dispatch(setSubmitError(null));
    dispatch(setSuccessMessage(null));
    dispatch(setIsLoading(true));

    try {
      const result = await saveClientProfile({ data: values });

      if (!result.ok) {
        dispatch(setSubmitError(result.formError));
        return;
      }

      applyProfileResult(result.profile);

      dispatch(setSuccessMessage("Client onboarding saved. Opening your home page now."));
      await navigate({ to: "/" });
    } finally {
      dispatch(setIsLoading(false));
    }
  };

  if (viewer.role !== "CLIENT") {
    return (
      <AuthLayout
        title="Professional onboarding"
        subtitle="This onboarding flow is currently built only for clients."
        footer={
          <>
            Want to continue later?{" "}
            <Link to="/" className="text-primary hover:underline">
              Go back home
            </Link>
          </>
        }
      >
        <Card className="border-border shadow-soft">
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-primary">
              <ShieldCheck className="h-4 w-4" />
              Client-only flow
            </div>
            <CardTitle>Professional setup is next</CardTitle>
            <CardDescription>
              We turned this setup into a client-only onboarding wizard. Professional onboarding can
              be added separately.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/">Return to home</Link>
            </Button>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Set up your client account"
      subtitle="Complete your company profile in three steps so your dashboard, saved locations, and future hiring flow all start with the right information."
      fullWidth
      footer={
        <>
          Prefer editing later?{" "}
          <Link to="/my-info" className="text-primary hover:underline">
            Open my info
          </Link>
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="border-border shadow-soft">
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-primary">
              <ShieldCheck className="h-4 w-4" />
              Client onboarding
            </div>
            <CardTitle>Build your client profile</CardTitle>
            <CardDescription>
              A clean, Upwork-style onboarding flow for company details, locations, and hiring
              needs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>
                  Step {currentStep + 1} of {steps.length}
                </span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <div className="space-y-3">
              {steps.map((step, index) => (
                <div
                  key={step.title}
                  className={`rounded-2xl border p-4 transition-colors ${
                    index === currentStep
                      ? "border-primary bg-primary/5"
                      : index < currentStep
                        ? "border-success/30 bg-success/5"
                        : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`grid h-10 w-10 place-items-center rounded-xl ${index === currentStep ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
                    >
                      <step.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{step.title}</p>
                      <p className="text-xs text-muted-foreground">{step.subtitle}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground">Live summary</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {companyName || "Your company name will appear here"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {industry || "Industry not added yet"}
                {teamSize ? ` - ${teamSize}` : ""}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {address || "Primary location not added yet"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-soft">
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-primary">
              <currentStepConfig.icon className="h-4 w-4" />
              {currentStepConfig.title}
            </div>
            <CardTitle>{currentStepConfig.title}</CardTitle>
            <CardDescription>{currentStepConfig.subtitle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {currentStep === 0 ? (
                  <>
                    <div className="flex items-start gap-4 rounded-2xl border border-border bg-muted/40 p-4">
                      <img
                        src={
                          profilePhotoPreview ||
                          form.watch("profilePhotoUrl") ||
                          "https://i.pravatar.cc/120?u=client-profile"
                        }
                        alt="Profile preview"
                        className="h-20 w-20 rounded-2xl object-cover"
                      />
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <ImagePlus className="h-4 w-4 text-primary" />
                          Company or profile photo
                        </div>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(event) => handlePhotoUpload(event.target.files?.[0])}
                        />
                        <p className="text-sm text-muted-foreground">
                          Add a polished logo or profile photo so your dashboard feels complete from
                          day one.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
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
                              placeholder="Describe what your company does, the kinds of projects you hire for, and what great collaboration looks like for your team."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                ) : null}

                {currentStep === 1 ? (
                  <>
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary company location</FormLabel>
                          <FormControl>
                            <LocationAutocompleteInput
                              value={field.value}
                              onChange={field.onChange}
                              onLocationSelect={selectLocation}
                            />
                          </FormControl>
                          <p className="text-sm text-muted-foreground">
                            Search on the map, choose one location, then use the save button below.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="overflow-hidden rounded-2xl border border-border bg-muted/30">
                      <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">Google Maps preview</p>
                          <p className="text-sm text-muted-foreground">
                            Preview the company location while entering the address.
                          </p>
                        </div>
                        {hasMapLocation ? (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            Open in Google Maps
                          </a>
                        ) : null}
                      </div>

                      {hasMapLocation ? (
                        <iframe
                          title="Company location map"
                          src={`https://www.google.com/maps?q=${mapQuery}&z=14&output=embed`}
                          className="h-[320px] w-full border-0"
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                      ) : (
                        <div className="grid h-[320px] place-items-center px-6 text-center text-sm text-muted-foreground">
                          Enter a valid company address to preview it on Google Maps here.
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <MapPinHouse className="h-4 w-4 text-primary" />
                        Selected location
                      </div>
                      <div className="rounded-2xl border border-border bg-muted/40 p-4">
                        {savedLocations[0]?.address ? (
                          <>
                            <p className="font-medium">{selectedLocationLabel}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {savedLocations[0].address}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">No location selected yet.</p>
                        )}
                      </div>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          onClick={() =>
                            saveSelectedLocation({
                              address: form.getValues("address"),
                              label: selectedLocationLabel,
                            })
                          }
                          disabled={isLoading || !form.getValues("address")?.trim()}
                        >
                          <Save className="h-4 w-4" />
                          {isLoading ? "Saving..." : "Save location"}
                        </Button>
                      </div>
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
                  </>
                ) : null}

                {currentStep === 2 ? (
                  <>
                    <div className="rounded-2xl border border-border bg-muted/40 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <BriefcaseBusiness className="h-4 w-4 text-primary" />
                        What do you hire for?
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Add the skills, roles, or services your company hires for most often.
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
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
                          onChange={(event) => dispatch(setNewHiringNeed(event.target.value))}
                        />
                        <Button type="button" onClick={() => addHiringNeed()}>
                          Add skill
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {hiringNeeds.map((need) => (
                        <div
                          key={need}
                          className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3"
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
                  </>
                ) : null}

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

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={goToPreviousStep}
                      disabled={currentStep === 0 || isLoading}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Back
                    </Button>
                    <Button variant="ghost" asChild>
                      <Link to="/my-info">Edit later</Link>
                    </Button>
                  </div>

                  {currentStep < steps.length - 1 ? (
                    <Button type="button" onClick={goToNextStep}>
                      Continue
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={isLoading}>
                      <Save className="h-4 w-4" />
                      {isLoading ? "Saving..." : "Finish setup"}
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </AuthLayout>
  );
}
