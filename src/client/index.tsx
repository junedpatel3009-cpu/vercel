import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import {
  Award,
  BookmarkCheck,
  Briefcase,
  CalendarClock,
  Camera,
  Clock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileBadge,
  FileText,
  Heart,
  Mail,
  Map,
  MapPin,
  Paperclip,
  Phone,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Trash2,
  UserRound,
  Wallet,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { createServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { logoutAction as logout } from "@/lib/logout.server";
import { getCurrentUser } from "@/lib/current-user.server";
import { setFavoriteJob } from "@/lib/job-db.server";
import { formatApproximateLocation } from "@/lib/location-privacy";

const indexRoute = getRouteApi("/");

type SavedJobFilter = {
  id: string;
  name: string;
  createdAt: string;
  filters: {
    search: string;
    city: string;
    budgetMin: string;
    budgetMax: string;
    urgency: string;
    type: string;
  };
};

const saveFavoriteJob = createServerFn({ method: "POST" })
  .inputValidator((data: { jobId: number; favorite: boolean }) => data)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer) {
      return {
        ok: false as const,
        error: "Log in to save favorite jobs.",
      };
    }

    return {
      ok: true as const,
      favorite: setFavoriteJob(viewer.id, data.jobId, data.favorite),
    };
  });

export function Landing() {
  const { user } = indexRoute.useRouteContext();
  const { openJobs, professionals, favoriteJobIds, homeIntroHtml } = indexRoute.useLoaderData();
  const welcomeName = user ? `${user.firstName} ${user.lastName}`.trim() : "";
  const isProfessional = user?.role === "PROFESSIONAL";
  const [selectedProfessional, setSelectedProfessional] = useState<any | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isJobFilterOpen, setIsJobFilterOpen] = useState(false);
  const [isProfessionalListOpen, setIsProfessionalListOpen] = useState(false);
  const [showJobsMap, setShowJobsMap] = useState(false);
  const [selectedMapJobId, setSelectedMapJobId] = useState<number | null>(null);
  const [jobSearch, setJobSearch] = useState("");
  const [jobCity, setJobCity] = useState("");
  const [jobBudgetMin, setJobBudgetMin] = useState("");
  const [jobBudgetMax, setJobBudgetMax] = useState("");
  const [jobUrgency, setJobUrgency] = useState("all");
  const [jobType, setJobType] = useState("all");
  const [savedJobFilters, setSavedJobFilters] = useState<SavedJobFilter[]>([]);
  const [selectedSavedJobFilterId, setSelectedSavedJobFilterId] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<number[]>(favoriteJobIds);
  const [favoriteMessage, setFavoriteMessage] = useState<string | null>(null);
  const [professionalSearch, setProfessionalSearch] = useState("");
  const [professionalSearchFilter, setProfessionalSearchFilter] = useState("all");
  const navigate = useNavigate();
  const savedJobFilterStorageKey = user?.id
    ? `servio:saved-home-job-filters:${user.id}`
    : "servio:saved-home-job-filters:guest";

  useEffect(() => {
    setSavedJobFilters(readSavedJobFilters(savedJobFilterStorageKey));
    setSelectedSavedJobFilterId("");
  }, [savedJobFilterStorageKey]);

  const filteredOpenJobs = openJobs.filter((job) => {
    const query = jobSearch.trim().toLowerCase();
    const cityQuery = jobCity.trim().toLowerCase();
    const minBudget = jobBudgetMin ? Number(jobBudgetMin) : null;
    const maxBudget = jobBudgetMax ? Number(jobBudgetMax) : null;
    const locationText = [job.locationLabel, job.locationAddress].filter(Boolean).join(" ");
    const jobBudgetMinValue = job.budgetMin ?? job.budgetMax ?? 0;
    const jobBudgetMaxValue = job.budgetMax ?? job.budgetMin ?? 0;
    const matchesSearch =
      !query ||
      [
        job.title,
        job.description,
        job.category,
        job.workMode,
        job.urgency,
        locationText,
        job.clientCompanyName,
        job.clientName,
        formatBudget(job.budgetMin, job.budgetMax, job.timingType),
        formatDate(job.deadline),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    const matchesCity = !cityQuery || locationText.toLowerCase().includes(cityQuery);
    const matchesBudgetMin = minBudget == null || jobBudgetMaxValue >= minBudget;
    const matchesBudgetMax = maxBudget == null || jobBudgetMinValue <= maxBudget;
    const matchesUrgency = jobUrgency === "all" || job.urgency === jobUrgency;
    const matchesType = jobType === "all" || job.workMode === jobType;

    return (
      matchesSearch &&
      matchesCity &&
      matchesBudgetMin &&
      matchesBudgetMax &&
      matchesUrgency &&
      matchesType
    );
  });
  const hasJobFilters =
    Boolean(jobSearch || jobCity || jobBudgetMin || jobBudgetMax) ||
    jobUrgency !== "all" ||
    jobType !== "all";
  const activeJobFilterCount = [
    jobCity,
    jobBudgetMin,
    jobBudgetMax,
    jobUrgency !== "all" ? jobUrgency : "",
    jobType !== "all" ? jobType : "",
  ].filter(Boolean).length;
  const filteredProfessionals = professionals.filter((professional) => {
    const fullName = `${professional.firstName} ${professional.lastName}`.trim();
    const query = professionalSearch.trim().toLowerCase();

    if (!query) {
      return true;
    }

    const searchableProfessionalFields: Record<string, unknown[]> = {
      all: [
        fullName,
        professional.industry,
        professional.companyName,
        professional.companyDescription,
        professional.address,
        professional.professionalCategory,
        professional.professionalCity,
      ],
      name: [fullName],
      skill: [
        professional.industry,
        professional.professionalCategory,
        professional.companyDescription,
      ],
      company: [professional.companyName, professional.companyDescription],
      location: [professional.address, professional.professionalCity],
    };

    return (
      searchableProfessionalFields[professionalSearchFilter] || searchableProfessionalFields.all
    )
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });
  const selectedVerificationMeta = getVerificationMeta(selectedProfessional?.verification?.status);
  const selectedVerificationBadges = getVerificationBadges(selectedProfessional?.verification);
  const selectedMapJob =
    filteredOpenJobs.find((job) => job.id === selectedMapJobId) ||
    filteredOpenJobs.find((job) => job.locationAddress);
  const jobsMapQuery =
    selectedMapJob?.locationAddress ||
    selectedMapJob?.locationLabel ||
    jobCity ||
    filteredOpenJobs.find((job) => job.locationAddress)?.locationAddress ||
    "India";
  const clearJobFilters = () => {
    setJobSearch("");
    setJobCity("");
    setJobBudgetMin("");
    setJobBudgetMax("");
    setJobUrgency("all");
    setJobType("all");
    setSelectedSavedJobFilterId("");
  };

  const currentJobFilterState = () => ({
    search: jobSearch,
    city: jobCity,
    budgetMin: jobBudgetMin,
    budgetMax: jobBudgetMax,
    urgency: jobUrgency,
    type: jobType,
  });

  const saveCurrentJobFilter = () => {
    if (savedJobFilters.length >= 5) {
      toast.error("You can save up to 5 filters.", {
        description: "Delete one saved filter before adding another.",
      });
      return;
    }

    const filter: SavedJobFilter = {
      id: crypto.randomUUID(),
      name: buildSavedJobFilterName(currentJobFilterState()),
      createdAt: new Date().toISOString(),
      filters: currentJobFilterState(),
    };
    const nextFilters = [filter, ...savedJobFilters];

    setSavedJobFilters(nextFilters);
    setSelectedSavedJobFilterId(filter.id);
    writeSavedJobFilters(savedJobFilterStorageKey, nextFilters);
    toast.success("Filter saved", {
      description: `${filter.name} was added to home filters.`,
    });
  };

  const applySavedJobFilter = (filter: SavedJobFilter) => {
    setJobSearch(filter.filters.search);
    setJobCity(filter.filters.city);
    setJobBudgetMin(filter.filters.budgetMin);
    setJobBudgetMax(filter.filters.budgetMax);
    setJobUrgency(filter.filters.urgency);
    setJobType(filter.filters.type);
    setSelectedMapJobId(null);
    setSelectedSavedJobFilterId(filter.id);
    toast.info("Saved filter applied", {
      description: filter.name,
    });
  };

  const deleteSavedJobFilter = (filterId: string) => {
    const nextFilters = savedJobFilters.filter((filter) => filter.id !== filterId);

    setSavedJobFilters(nextFilters);
    setSelectedSavedJobFilterId((current) => (current === filterId ? "" : current));
    writeSavedJobFilters(savedJobFilterStorageKey, nextFilters);
    toast.success("Saved filter deleted");
  };

  useEffect(() => {
    if (!favoriteMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setFavoriteMessage(null), 2000);

    return () => window.clearTimeout(timeout);
  }, [favoriteMessage]);

  const toggleFavoriteJob = async (jobId: number) => {
    if (!user) {
      await navigate({ to: "/login", search: { returnTo: "/" } as never });
      return;
    }

    const nextFavorite = !favoriteIds.includes(jobId);
    const previousFavorites = favoriteIds;
    setFavoriteIds((current) =>
      nextFavorite ? [...current, jobId] : current.filter((favoriteId) => favoriteId !== jobId),
    );
    setFavoriteMessage(nextFavorite ? "Job saved to favorites." : "Job removed from favorites.");

    try {
      const result = await saveFavoriteJob({ data: { jobId, favorite: nextFavorite } });

      if (!result.ok) {
        setFavoriteIds(previousFavorites);
        setFavoriteMessage(result.error);
      }
    } catch (error) {
      setFavoriteIds(previousFavorites);
      setFavoriteMessage(error instanceof Error ? error.message : "Could not update favorite job.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader user={user} onLogout={logout} />

      <main>
        {homeIntroHtml ? (
          <section className="border-b border-border bg-surface">
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
              {(() => {
                // If the intro HTML already contains a Welcome header, inject the user's name into it
                let introHtmlToRender = homeIntroHtml;
                let nameInjected = false;
                function escapeHtml(value: string) {
                  return String(value || "")
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/\"/g, "&quot;")
                    .replace(/'/g, "&#039;");
                }

                if (user && homeIntroHtml) {
                  // Prefer replacing within an <h1> if present
                  if (/<h1[^>]*>[\s\S]*?<\/h1>/i.test(homeIntroHtml)) {
                    introHtmlToRender = homeIntroHtml.replace(/<h1([^>]*)>([\s\S]*?)<\/h1>/i, (m, attrs, inner) => {
                      if (/welcome/i.test(inner)) {
                        nameInjected = true;
                        return `<h1${attrs}>${inner.replace(/welcome/i, `Welcome, ${escapeHtml(welcomeName)}`)}</h1>`;
                      }
                      return m;
                    });
                  }

                  // If not injected yet, replace first plain 'Welcome' word occurrence
                  if (!nameInjected && /\bWelcome\b/i.test(homeIntroHtml)) {
                    introHtmlToRender = homeIntroHtml.replace(/\bWelcome\b/i, `Welcome, ${escapeHtml(welcomeName)}`);
                    nameInjected = true;
                  }
                }

                return (
                  <div>
                    <div dangerouslySetInnerHTML={{ __html: introHtmlToRender }} />
                    {!nameInjected && user ? (
                      <div className="mt-4 rounded-xl border border-primary/15 bg-primary/5 px-5 py-4">
                        <h1 className="text-2xl font-semibold tracking-tight text-primary">{`Welcome, ${welcomeName || "there"}`}</h1>
                      </div>
                    ) : null}
                  </div>
                );
              })()}
            </div>
          </section>
        ) : (
          <section className="border-b border-border bg-muted/20">
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
              <div className="relative overflow-hidden rounded-[2rem] border border-primary/15 bg-gradient-to-br from-primary/10 via-background to-primary/5 p-8 shadow-sm">
                <div className="relative z-10">
                  <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                    {user ? (
                      <>
                        Welcome back, <span className="text-primary">{welcomeName || "there"}</span>
                      </>
                    ) : (
                      "Welcome to Servio"
                    )}
                  </h1>
                  <p className="mt-3 max-w-2xl text-base font-medium text-muted-foreground leading-relaxed">
                    {isProfessional
                      ? "Your expertise is in demand. Explore new projects and connect with clients looking for your skills."
                      : "Hire trusted professionals for your next project. We connect you with the best talent in your area."}
                  </p>
                </div>
                <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
                <div className="absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-blue-500/5 blur-3xl" />
              </div>
            </div>
          </section>
        )}

        <section className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <label className="flex h-11 min-w-0 items-center gap-3 rounded-xl border border-input bg-background px-4">
                <Search className="h-5 w-5 text-muted-foreground" />
                <input
                  value={jobSearch}
                  onChange={(event) => setJobSearch(event.target.value)}
                  placeholder="Search available jobs"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </label>
              <Button
                type="button"
                variant="outline"
                className="h-11 gap-2"
                onClick={() => setIsJobFilterOpen(true)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {activeJobFilterCount ? (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                    {activeJobFilterCount}
                  </span>
                ) : null}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={clearJobFilters}
                disabled={!hasJobFilters}
              >
                Clear
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <div className="flex flex-wrap items-center gap-3">
                {activeJobFilterCount ? (
                  <span>
                    {activeJobFilterCount} filter{activeJobFilterCount === 1 ? "" : "s"} active
                  </span>
                ) : null}
              </div>
              {favoriteMessage ? (
                <span className="animate-in fade-in slide-in-from-bottom-1 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                  {favoriteMessage}
                </span>
              ) : null}
            </div>
          </div>
        </section>

        <Dialog open={isJobFilterOpen} onOpenChange={setIsJobFilterOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Filters</DialogTitle>
              <DialogDescription>
                Narrow available jobs by location, budget, urgency, and type.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-medium">Saved filters</p>
                  <p className="text-xs text-muted-foreground">
                    {savedJobFilters.length}/5 saved on home page
                  </p>
                </div>
                <Button type="button" size="sm" className="gap-2" onClick={saveCurrentJobFilter}>
                  <Save className="h-4 w-4" />
                  Save current
                </Button>
              </div>

              <select
                className="mt-3 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={selectedSavedJobFilterId}
                onChange={(event) => {
                  const filter = savedJobFilters.find((item) => item.id === event.target.value);
                  if (filter) {
                    applySavedJobFilter(filter);
                  } else {
                    setSelectedSavedJobFilterId("");
                  }
                }}
              >
                <option value="">Choose saved filter</option>
                {savedJobFilters.map((filter) => (
                  <option key={filter.id} value={filter.id}>
                    {filter.name}
                  </option>
                ))}
              </select>

              {savedJobFilters.length ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {savedJobFilters.map((filter) => (
                    <div
                      key={filter.id}
                      role="button"
                      tabIndex={0}
                      onDoubleClick={() => applySavedJobFilter(filter)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          applySavedJobFilter(filter);
                        }
                      }}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        selectedSavedJobFilterId === filter.id
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background hover:border-primary/50"
                      }`}
                      title="Double click to apply"
                    >
                      <BookmarkCheck className="h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate">{filter.name}</span>
                      <button
                        type="button"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteSavedJobFilter(filter.id);
                        }}
                        aria-label={`Delete ${filter.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 py-2 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                <span>Location</span>
                <input
                  value={jobCity}
                  onChange={(event) => setJobCity(event.target.value)}
                  placeholder="Search city, area, or address"
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-normal outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>

              <label className="space-y-2 text-sm font-medium">
                <span>Minimum budget</span>
                <input
                  type="number"
                  min="0"
                  value={jobBudgetMin}
                  onChange={(event) => setJobBudgetMin(event.target.value)}
                  placeholder="Min budget"
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-normal outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>

              <label className="space-y-2 text-sm font-medium">
                <span>Maximum budget</span>
                <input
                  type="number"
                  min="0"
                  value={jobBudgetMax}
                  onChange={(event) => setJobBudgetMax(event.target.value)}
                  placeholder="Max budget"
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-normal outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>

              <label className="space-y-2 text-sm font-medium">
                <span>Urgency</span>
                <select
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  value={jobUrgency}
                  onChange={(event) => setJobUrgency(event.target.value)}
                >
                  <option value="all">Any urgency</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </label>

              <label className="space-y-2 text-sm font-medium">
                <span>Type</span>
                <select
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  value={jobType}
                  onChange={(event) => setJobType(event.target.value)}
                >
                  <option value="all">Any type</option>
                  <option value="REMOTE">Remote</option>
                  <option value="ON_SITE">On-site</option>
                  <option value="BOTH">Both</option>
                </select>
              </label>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={clearJobFilters}>
                Clear
              </Button>
              <Button type="button" onClick={() => setIsJobFilterOpen(false)}>
                Apply filters
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
            <div
              className={
                isProfessional ? "" : "flex flex-col gap-6 lg:flex-row lg:items-start"
              }
            >
              <div className={cn("rounded-2xl border border-border bg-card p-6 shadow-soft", !isProfessional && "flex-1")}>
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">
                      {isProfessional ? "Recommended Opportunities" : "Browse Marketplace"}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isProfessional
                        ? "Review client requirements, budget, and location before applying for a job."
                        : "Discover trusted professionals and explore available job posts in your area."}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {!isProfessional && (
                       <Button
                        type="button"
                        className="h-10 gap-2 rounded-xl font-bold transition-all shadow-sm"
                        asChild
                      >
                        <Link to="/post-job">Post a job</Link>
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 gap-2 rounded-xl font-bold border-border shadow-sm hover:bg-primary/5 hover:text-primary transition-all"
                      onClick={() => setShowJobsMap((value) => !value)}
                    >
                      <Map className="h-4 w-4" />
                      {showJobsMap ? "Hide Map View" : "View on Map"}
                    </Button>
                  </div>
                </div>

              {openJobs.length ? (
                filteredOpenJobs.length ? (
                  showJobsMap ? (
                    <div className="mt-5 overflow-hidden rounded-xl border border-border bg-background">
                      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
                        <div className="min-h-[420px]">
                          <iframe
                            title="Jobs map"
                            src={`https://www.google.com/maps?q=${encodeURIComponent(jobsMapQuery)}&z=12&output=embed`}
                            className="h-[420px] w-full border-0"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                          />
                        </div>
                        <div className="max-h-[420px] overflow-y-auto border-t border-border bg-card p-3 lg:border-l lg:border-t-0">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold">Map results</p>
                            <Badge variant="secondary">{filteredOpenJobs.length}</Badge>
                          </div>
                          <div className="grid gap-3">
                            {filteredOpenJobs.map((job) => (
                              <div
                                key={job.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => setSelectedMapJobId(job.id)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    setSelectedMapJobId(job.id);
                                  }
                                }}
                                className={`rounded-lg border p-3 text-left transition-colors ${
                                  selectedMapJob?.id === job.id
                                    ? "border-primary bg-primary/5"
                                    : "border-border bg-background hover:border-primary/40 hover:bg-primary/5"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="line-clamp-2 text-sm font-semibold">
                                      {job.title}
                                    </p>
                                    <p className="mt-1 truncate text-xs text-muted-foreground">
                                      {job.category} ·{" "}
                                      {formatBudget(job.budgetMin, job.budgetMax, job.timingType)}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void toggleFavoriteJob(job.id);
                                      }}
                                      className={`grid h-8 w-8 place-items-center rounded-md border transition-colors ${
                                        favoriteIds.includes(job.id)
                                          ? "border-primary bg-primary/10 text-primary"
                                          : "border-border bg-card text-muted-foreground hover:text-primary"
                                      }`}
                                      aria-label={
                                        favoriteIds.includes(job.id)
                                          ? "Remove favorite job"
                                          : "Save favorite job"
                                      }
                                    >
                                      <Heart
                                        className={`h-4 w-4 ${favoriteIds.includes(job.id) ? "fill-current" : ""}`}
                                      />
                                    </button>
                                    <Badge
                                      variant={job.urgency === "HIGH" ? "destructive" : "outline"}
                                    >
                                      {formatEnum(job.urgency)}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{formatJobLocation(job)}</span>
                                </div>
                                <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                                  <Link to="/job/$jobId" params={{ jobId: String(job.id) }}>
                                    View job
                                  </Link>
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 grid auto-rows-fr gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                      {filteredOpenJobs.map((job) => (
                        <div
                          key={job.id}
                          className="group relative flex flex-col rounded-xl border border-border bg-background p-4 transition-all hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex flex-wrap gap-1.5">
                              <Badge
                                variant="secondary"
                                className="bg-primary/5 text-primary border-primary/10 text-[9px] font-bold uppercase tracking-wider px-1.5"
                              >
                                {job.category}
                              </Badge>
                              <Badge
                                variant={job.urgency === "HIGH" ? "destructive" : "outline"}
                                className="text-[9px] font-bold uppercase tracking-wider px-1.5"
                              >
                                {formatEnum(job.urgency)}
                              </Badge>
                              <Badge className="text-[9px] font-bold uppercase tracking-wider px-1.5">
                                {formatWorkMode(job.workMode)}
                              </Badge>
                            </div>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void toggleFavoriteJob(job.id);
                              }}
                              className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-lg border transition-all hover:scale-110 active:scale-95",
                                favoriteIds.includes(job.id)
                                  ? "border-rose-100 bg-rose-50 text-rose-500 shadow-sm shadow-rose-200"
                                  : "border-border bg-card text-muted-foreground hover:text-primary hover:border-primary/30",
                              )}
                              aria-label={
                                favoriteIds.includes(job.id)
                                  ? "Remove favorite job"
                                  : "Save favorite job"
                              }
                            >
                              <Heart
                                className={cn(
                                  "h-4 w-4",
                                  favoriteIds.includes(job.id) && "fill-current",
                                )}
                              />
                            </button>
                          </div>

                          <Link
                            to="/job/$jobId"
                            params={{ jobId: String(job.id) }}
                            className="flex-1 focus:outline-none"
                          >
                            <h3 className="mt-3 text-base font-bold text-foreground transition-colors group-hover:text-primary line-clamp-1">
                              {job.title}
                            </h3>
                            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                              {job.description}
                            </p>

                            <div className="mt-4 grid grid-cols-2 gap-3">
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                                  <Wallet className="h-4 w-4" />
                                </div>
                                <div className="flex min-w-0 flex-col">
                                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                                    Budget
                                  </span>
                                  <span className="truncate text-xs font-bold">
                                    {formatBudget(job.budgetMin, job.budgetMax, job.timingType)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                  <CalendarClock className="h-4 w-4" />
                                </div>
                                <div className="flex min-w-0 flex-col">
                                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                                    Deadline
                                  </span>
                                  <span className="truncate text-xs font-bold">
                                    {formatDate(job.deadline)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                                  <MapPin className="h-4 w-4" />
                                </div>
                                <div className="flex min-w-0 flex-col">
                                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                                    Location
                                  </span>
                                  <span className="truncate text-xs font-bold">
                                    {formatJobLocation(job)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                                  <Paperclip className="h-4 w-4" />
                                </div>
                                <div className="flex min-w-0 flex-col">
                                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                                    Files
                                  </span>
                                  <span className="truncate text-xs font-bold">
                                    {job.attachments.length} attached
                                  </span>
                                </div>
                              </div>
                            </div>
                          </Link>

                          <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                                {(job.clientCompanyName || job.clientName || "C")
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                              <span className="text-[10px] font-semibold text-muted-foreground">
                                By <span className="text-foreground truncate max-w-[60px] inline-block align-bottom">{job.clientCompanyName || job.clientName}</span>
                              </span>
                            </div>
                            <Link
                              to="/job/$jobId"
                              params={{ jobId: String(job.id) }}
                              className="flex items-center gap-1 text-[10px] font-bold text-primary transition-colors hover:underline"
                            >
                              View details
                              <ExternalLink className="h-2.5 w-2.5" />
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/30 p-10 text-center">
                    <Search className="mx-auto h-9 w-9 text-muted-foreground" />
                    <h3 className="mt-3 font-semibold">Job not available</h3>
                    <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                      No available job matches "{jobSearch.trim()}". Try searching another title,
                      category, location, budget, or client.
                    </p>
                  </div>
                )
              ) : (
                <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/30 p-10 text-center">
                  <Briefcase className="mx-auto h-9 w-9 text-muted-foreground" />
                  <h3 className="mt-3 font-semibold">No available jobs</h3>
                  <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                    When a client posts an active job, it will appear here automatically.
                  </p>
                  {user?.role === "CLIENT" ? (
                    <Button className="mt-4" asChild>
                      <Link to="/post-job">Post your first job</Link>
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
            {!isProfessional ? (
              <aside className="w-full lg:w-[400px] lg:shrink-0 lg:sticky lg:top-6">
                <Collapsible
                  open={isProfessionalListOpen}
                  onOpenChange={setIsProfessionalListOpen}
                  className="w-full"
                >
                  <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-soft transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-foreground text-balance">
                          Top Professionals
                        </h2>
                        <Badge
                          variant="secondary"
                          className="bg-primary/10 text-primary border-none"
                        >
                          {filteredProfessionals.length} found
                        </Badge>
                      </div>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 rounded-full hover:bg-primary/5"
                        >
                          <ChevronDown
                            className={cn(
                              "h-5 w-5 text-primary transition-transform duration-300",
                              isProfessionalListOpen && "rotate-180",
                            )}
                          />
                        </Button>
                      </CollapsibleTrigger>
                    </div>

                    <CollapsibleContent className="space-y-5 overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          value={professionalSearch}
                          onChange={(event) => setProfessionalSearch(event.target.value)}
                          placeholder="Search name, skill, location..."
                          className="h-11 w-full rounded-xl border border-input bg-background pl-9 pr-4 text-sm outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/5"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {[
                          ["all", "All"],
                          ["name", "Name"],
                          ["skill", "Skill"],
                          ["location", "Location"],
                        ].map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setProfessionalSearchFilter(value)}
                            className={cn(
                              "rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
                              professionalSearchFilter === value
                                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                                : "bg-muted text-muted-foreground hover:bg-muted/80",
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {professionals.length ? (
                        filteredProfessionals.length ? (
                          <div className="custom-scrollbar grid max-h-[500px] gap-3 overflow-y-auto pr-1">
                            {filteredProfessionals.map((professional) => {
                              const fullName =
                                `${professional.firstName} ${professional.lastName}`.trim();
                              const verificationMeta = getVerificationMeta(
                                professional.verification?.status,
                              );

                              return (
                                <div
                                  key={professional.id}
                                  className="group relative rounded-xl border border-border bg-background p-4 transition-all hover:border-primary/40 hover:shadow-md"
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="relative">
                                      <img
                                        src={
                                          professional.avatarUrl ||
                                          `https://i.pravatar.cc/100?u=pro-${professional.id}`
                                        }
                                        alt={fullName}
                                        className="h-12 w-12 rounded-xl object-cover shadow-sm"
                                      />
                                      <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-background bg-emerald-500" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center justify-between gap-2">
                                        <h3 className="truncate font-bold text-foreground">
                                          {fullName || "Professional"}
                                        </h3>
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            "h-5 border-none px-1.5 text-[9px] font-bold uppercase tracking-wider",
                                            verificationMeta.badgeClass,
                                          )}
                                        >
                                          {verificationMeta.shortLabel}
                                        </Badge>
                                      </div>
                                      <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
                                        {professional.industry ||
                                          professional.companyName ||
                                          "Professional Services"}
                                      </p>
                                      <div className="mt-3 flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                                          <MapPin className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                                          <span className="truncate">
                                            {getProfessionalLocation(professional)}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedProfessional(professional);
                                            setIsSheetOpen(true);
                                          }}
                                          className="flex items-center gap-1 rounded-lg bg-primary/5 px-2 py-1 text-[11px] font-bold text-primary transition-all hover:bg-primary hover:text-white"
                                        >
                                          View Profile
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
                            <Search className="mx-auto h-8 w-8 text-muted-foreground/50" />
                            <h3 className="mt-3 text-sm font-bold">No results</h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Try adjusting your filters.
                            </p>
                          </div>
                        )
                      ) : (
                        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
                          <Search className="mx-auto h-8 w-8 text-muted-foreground/50" />
                          <h3 className="mt-3 text-sm font-bold">Marketplace is quiet</h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Professional accounts will appear here.
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1 rounded-xl text-xs font-bold"
                          onClick={() => setProfessionalSearch("")}
                          disabled={!professionalSearch}
                        >
                          Reset
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="flex-1 rounded-xl text-xs font-bold"
                        >
                          See All
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              </aside>
            ) : null}
          </div>
        </section>
      </main>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent
          side="right"
          className="flex h-dvh w-full max-w-none flex-col overflow-hidden p-0 sm:max-w-none md:w-[min(760px,100vw)]"
        >
          <SheetTitle className="sr-only">Professional profile preview</SheetTitle>
          <SheetDescription className="sr-only">
            Preview professional details and open the full profile.
          </SheetDescription>
          <div className="h-24 shrink-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" />

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 sm:px-7">
            <div className="-mt-6 rounded-2xl border border-border bg-card shadow-soft">
              <div className="grid gap-5 p-5 sm:grid-cols-[132px_minmax(0,1fr)] sm:items-start">
                <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-2xl bg-muted shadow-lg ring-4 ring-background">
                  <img
                    src={
                      selectedProfessional?.avatarUrl ||
                      `https://i.pravatar.cc/160?u=pro-${selectedProfessional?.id}`
                    }
                    alt={getProfessionalName(selectedProfessional)}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="min-w-0 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="min-w-0 truncate text-2xl font-semibold tracking-tight text-foreground">
                      {getProfessionalName(selectedProfessional)}
                    </h2>
                    <Badge
                      className={`rounded-full border-0 ${selectedVerificationMeta.badgeClass}`}
                    >
                      {selectedVerificationMeta.label}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {selectedProfessional?.professionalCategory ||
                      selectedProfessional?.industry ||
                      selectedProfessional?.companyName ||
                      "Professional services"}
                  </p>
                  <div className="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                    <ProfileMetric
                      icon={Star}
                      label="Rating"
                      value={getRatingLabel(selectedProfessional)}
                      accent="text-warning"
                    />
                    <ProfileMetric
                      icon={MapPin}
                      label="Location"
                      value={getProfessionalLocation(selectedProfessional)}
                    />
                    <ProfileMetric
                      icon={Clock}
                      label="Status"
                      value={formatAvailability(
                        selectedProfessional?.availabilityStatus ||
                          selectedProfessional?.availability,
                      )}
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedVerificationBadges.length ? (
                      selectedVerificationBadges.map((badge) => (
                        <VerificationBadge
                          key={badge.label}
                          icon={badge.icon}
                          label={badge.label}
                        />
                      ))
                    ) : (
                      <span className="rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
                        No verification badges yet
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-5">
                <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
                  <h3 className="text-base font-semibold">About</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {selectedProfessional?.companyDescription ||
                      selectedProfessional?.bio ||
                      "This professional has not added a description yet. Open the full profile or message them to discuss services, availability, and fit."}
                  </p>
                </section>

                <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
                  <h3 className="text-base font-semibold">Profile highlights</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <DetailTile
                      label="Main service"
                      value={
                        selectedProfessional?.professionalCategory ||
                        selectedProfessional?.industry ||
                        "Professional services"
                      }
                    />
                    <DetailTile
                      label="Experience"
                      value={
                        selectedProfessional?.experienceYears != null
                          ? `${selectedProfessional.experienceYears} years`
                          : "Not specified"
                      }
                    />
                    <DetailTile
                      label="Work mode"
                      value={formatWorkModeLabel(selectedProfessional?.workMode)}
                    />
                    <DetailTile
                      label="Service radius"
                      value={
                        selectedProfessional?.serviceRadiusKm
                          ? `${selectedProfessional.serviceRadiusKm} km`
                          : "Not set"
                      }
                    />
                    <DetailTile
                      label="Service area"
                      value={formatApproximateLocation(
                        selectedProfessional?.serviceArea,
                        getProfessionalLocation(selectedProfessional),
                      )}
                    />
                    <DetailTile label="Verification" value={selectedVerificationMeta.label} />
                  </div>
                </section>

                {selectedProfessional?.skills?.length ? (
                  <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
                    <h3 className="text-base font-semibold">Skills</h3>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedProfessional.skills.map((skill: string) => (
                        <span
                          key={skill}
                          className="rounded-full border border-border bg-muted px-3 py-1.5 text-sm font-medium text-foreground"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </section>
                ) : null}

                {selectedProfessional?.workPhotos?.length ? (
                  <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
                    <h3 className="text-base font-semibold">Work photos</h3>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      {selectedProfessional.workPhotos
                        .slice(0, 6)
                        .map((photo: string, index: number) => (
                          <img
                            key={`${photo}-${index}`}
                            src={photo}
                            alt=""
                            className="aspect-[4/3] w-full rounded-lg border border-border object-cover"
                          />
                        ))}
                    </div>
                  </section>
                ) : null}

                {selectedProfessional?.portfolioUrl ||
                selectedProfessional?.certifications?.length ||
                selectedProfessional?.tradeLicenseUrl ? (
                  <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
                    <h3 className="text-base font-semibold">Documents and links</h3>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {selectedProfessional?.portfolioUrl ? (
                        <a
                          className="rounded-lg border border-border p-4 transition-colors hover:border-primary/50 hover:bg-primary/5"
                          href={selectedProfessional.portfolioUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink className="mb-3 h-4 w-4 text-primary" />
                          <p className="font-medium">Portfolio link</p>
                          <p className="mt-1 truncate text-sm text-muted-foreground">
                            {selectedProfessional.portfolioUrl}
                          </p>
                        </a>
                      ) : null}
                      {selectedProfessional?.tradeLicenseUrl ? (
                        <a
                          className="rounded-lg border border-border p-4 transition-colors hover:border-primary/50 hover:bg-primary/5"
                          href={selectedProfessional.tradeLicenseUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ShieldCheck className="mb-3 h-4 w-4 text-primary" />
                          <p className="font-medium">Trade license</p>
                          <p className="mt-1 truncate text-sm text-muted-foreground">
                            View uploaded license
                          </p>
                        </a>
                      ) : null}
                      {selectedProfessional?.certifications?.map((cert: string, index: number) => (
                        <div
                          key={`${cert}-${index}`}
                          className="rounded-lg border border-border p-4"
                        >
                          <Award className="mb-3 h-4 w-4 text-primary" />
                          <p className="font-medium">Certification</p>
                          <p className="mt-1 truncate text-sm text-muted-foreground">{cert}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
                  <h3 className="text-base font-semibold">Contact preview</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <DetailTile
                      label="Email"
                      value={selectedProfessional?.email || "Not added"}
                      icon={Mail}
                    />
                    <DetailTile
                      label="Phone"
                      value={selectedProfessional?.phone || "Not added"}
                      icon={Phone}
                    />
                  </div>
                </section>

                {selectedProfessional?.portfolio?.length ? (
                  <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
                    <h3 className="text-base font-semibold">Portfolio</h3>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {selectedProfessional.portfolio.slice(0, 4).map((p: any, i: number) => (
                        <div
                          key={i}
                          className="min-h-24 rounded-lg border border-border bg-muted/40 p-4"
                        >
                          <div className="text-xs text-muted-foreground">{p?.tag || "Project"}</div>
                          <div className="mt-2 font-medium leading-5">
                            {p?.title || "Portfolio item"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>

              <aside className="space-y-5">
                <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
                  <h3 className="text-base font-semibold">Pricing</h3>
                  <div className="mt-4 space-y-3 text-sm">
                    {selectedProfessional?.hourlyRate ? (
                      <div className="rounded-lg border border-border px-3 py-2">
                        <div className="text-muted-foreground">Hourly consulting</div>
                        <div className="mt-1 font-medium">
                          ${selectedProfessional.hourlyRate}/hr
                        </div>
                      </div>
                    ) : null}
                    {selectedProfessional?.weeklyRate ? (
                      <div className="rounded-lg border border-border px-3 py-2">
                        <div className="text-muted-foreground">Weekly retainer</div>
                        <div className="mt-1 font-medium">
                          ${selectedProfessional.weeklyRate}/wk
                        </div>
                      </div>
                    ) : null}
                    {selectedProfessional?.fixedRate ? (
                      <div className="rounded-lg border border-border px-3 py-2">
                        <div className="text-muted-foreground">Fixed scope project</div>
                        <div className="mt-1 font-medium">
                          From ${selectedProfessional.fixedRate}
                        </div>
                      </div>
                    ) : null}
                    {!selectedProfessional?.hourlyRate &&
                    !selectedProfessional?.weeklyRate &&
                    !selectedProfessional?.fixedRate ? (
                      <p className="rounded-lg border border-dashed border-border px-3 py-3 text-muted-foreground">
                        Pricing is not added yet.
                      </p>
                    ) : null}
                  </div>
                </section>

                <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
                  <h3 className="text-base font-semibold">Service coverage</h3>
                  <div className="mt-4 space-y-3 text-sm">
                    <DetailTile
                      label="Area"
                      value={formatApproximateLocation(
                        selectedProfessional?.serviceArea,
                        getProfessionalLocation(selectedProfessional),
                      )}
                    />
                    <DetailTile
                      label="Approx. location"
                      value={getProfessionalLocation(selectedProfessional)}
                    />
                    <DetailTile
                      label="Work mode"
                      value={formatWorkModeLabel(selectedProfessional?.workMode)}
                    />
                  </div>
                </section>

                <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold">Verification badges</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {selectedVerificationMeta.description}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${selectedVerificationMeta.badgeClass}`}
                    >
                      {selectedVerificationMeta.shortLabel}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {getVerificationBadgeRows(selectedProfessional?.verification).map((badge) => (
                      <VerificationBadgeRow
                        key={badge.label}
                        icon={badge.icon}
                        label={badge.label}
                        done={badge.done}
                      />
                    ))}
                  </div>
                </section>
              </aside>
            </div>

            <div className="sticky bottom-0 -mx-5 mt-6 flex flex-col gap-3 border-t border-border bg-background/95 px-5 py-4 backdrop-blur sm:-mx-7 sm:flex-row sm:items-center sm:justify-end sm:px-7">
              <Button variant="outline" onClick={() => setIsSheetOpen(false)}>
                Close
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => openProfessionalMessage(user, selectedProfessional, navigate)}
              >
                Message
              </Button>
              <Button
                className="gap-2"
                onClick={async () => {
                  setIsSheetOpen(false);
                  if (selectedProfessional?.id) {
                    await navigate({
                      to: "/pro/$proId",
                      params: { proId: String(selectedProfessional.id) },
                    });
                  }
                }}
              >
                <UserRound className="h-4 w-4" />
                View profile
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <SiteFooter />
    </div>
  );
}

function readSavedJobFilters(storageKey: string) {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "[]");

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.slice(0, 5).filter(isSavedJobFilter) as SavedJobFilter[];
  } catch {
    return [];
  }
}

function writeSavedJobFilters(storageKey: string, filters: SavedJobFilter[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(filters.slice(0, 5)));
}

function isSavedJobFilter(value: unknown): value is SavedJobFilter {
  if (!value || typeof value !== "object") {
    return false;
  }

  const filter = value as SavedJobFilter;

  return Boolean(filter.id && filter.name && filter.filters);
}

function buildSavedJobFilterName(filters: SavedJobFilter["filters"]) {
  const parts = [
    filters.search.trim() ? `"${filters.search.trim()}"` : "",
    filters.city.trim() ? filters.city.trim() : "",
    filters.budgetMin.trim() ? `From $${Number(filters.budgetMin).toLocaleString()}` : "",
    filters.budgetMax.trim() ? `Up to $${Number(filters.budgetMax).toLocaleString()}` : "",
    filters.urgency !== "all" ? `${formatEnum(filters.urgency)} urgency` : "",
    filters.type !== "all" ? formatWorkMode(filters.type) : "",
  ].filter(Boolean);

  return parts.length ? parts.slice(0, 3).join(" / ") : "All jobs";
}

function DetailTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/50 p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </div>
      <p className="mt-2 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ProfileMetric({
  icon: Icon,
  label,
  value,
  accent = "text-primary",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <span className="rounded-lg bg-muted px-3 py-2">
      <span className="flex items-center gap-1 text-xs">
        <Icon className={`h-3.5 w-3.5 ${accent}`} />
        {label}
      </span>
      <span className="mt-1 block truncate font-medium text-foreground">{value}</span>
    </span>
  );
}

function VerificationBadge({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function VerificationBadgeRow({
  icon: Icon,
  label,
  done,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  done: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
        done ? "border-primary/15 bg-primary/5" : "border-border bg-muted/40"
      }`}
    >
      <span className="inline-flex min-w-0 items-center gap-2">
        <Icon className={`h-4 w-4 shrink-0 ${done ? "text-primary" : "text-muted-foreground"}`} />
        <span className="truncate font-medium text-foreground">{label}</span>
      </span>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
          done ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
        }`}
      >
        {done ? "Displayed" : "Not added"}
      </span>
    </div>
  );
}

function getRatingLabel(professional: any | null) {
  const rating = Number(professional?.averageRating || professional?.rating || 0);
  const reviews = Number(professional?.reviewCount || professional?.reviewsCount || 0);

  return rating > 0 ? `${rating.toFixed(1)} (${reviews})` : "New profile";
}

function getProfessionalName(professional: any | null) {
  const name =
    professional?.fullName ||
    `${professional?.firstName || ""} ${professional?.lastName || ""}`.trim();

  return name || professional?.companyName || "Professional profile";
}

function getProfessionalLocation(professional: any | null) {
  return formatApproximateLocation(
    professional?.professionalCity ||
      professional?.serviceArea ||
      professional?.city ||
      professional?.address,
    "Location not added",
  );
}

function formatJobLocation(job: {
  locationAddress?: string | null;
  locationLabel?: string | null;
  workMode?: string | null;
}) {
  if (job.workMode === "REMOTE") {
    return "Remote job";
  }

  return formatApproximateLocation(job.locationAddress || job.locationLabel, "Location not set");
}

function formatAvailability(value?: string) {
  if (!value) {
    return "Available now";
  }

  const normalized = value.toLowerCase();

  if (normalized === "available") {
    return "Available now";
  }

  if (normalized === "busy") {
    return "Busy";
  }

  if (normalized === "unavailable") {
    return "Unavailable";
  }

  return formatEnum(value);
}

function formatWorkModeLabel(value?: string) {
  if (!value) {
    return "Remote and on-site";
  }

  const normalized = value.toLowerCase();

  if (normalized === "remote") {
    return "Remote";
  }

  if (normalized === "onsite" || normalized === "on_site") {
    return "On-site";
  }

  return "Remote and on-site";
}

function getVerificationMeta(status?: string) {
  if (status === "approved") {
    return {
      label: "Verified professional",
      shortLabel: "Verified",
      description: "This professional passed verification review.",
      badgeClass: "bg-success/10 text-success",
    };
  }

  if (status === "pending") {
    return {
      label: "Verification pending",
      shortLabel: "Pending",
      description: "Documents are uploaded and waiting for review.",
      badgeClass: "bg-primary/10 text-primary",
    };
  }

  if (status === "rejected") {
    return {
      label: "Needs verification changes",
      shortLabel: "Needs changes",
      description: "Some submitted verification documents need updates.",
      badgeClass: "bg-destructive/10 text-destructive",
    };
  }

  return {
    label: "Not verified yet",
    shortLabel: "Not verified",
    description: "No verification documents are approved for display yet.",
    badgeClass: "bg-muted text-muted-foreground",
  };
}

function getVerificationBadgeRows(verification?: {
  governmentIdUrl?: string;
  licenseUrl?: string;
  certifications?: string[];
  insuranceUrl?: string;
  selfieUrl?: string;
}) {
  return [
    { label: "Government ID", icon: FileText, done: Boolean(verification?.governmentIdUrl) },
    { label: "Trade license", icon: FileBadge, done: Boolean(verification?.licenseUrl) },
    { label: "Certifications", icon: Award, done: Boolean(verification?.certifications?.length) },
    { label: "Insurance", icon: ShieldCheck, done: Boolean(verification?.insuranceUrl) },
    { label: "Selfie check", icon: Camera, done: Boolean(verification?.selfieUrl) },
  ];
}

function getVerificationBadges(verification?: Parameters<typeof getVerificationBadgeRows>[0]) {
  return getVerificationBadgeRows(verification).filter((badge) => badge.done);
}

function openProfessionalMessage(
  user: { id?: number; role?: string } | null,
  professional: any | null,
  navigate: ReturnType<typeof useNavigate>,
) {
  if (!professional?.id) {
    return;
  }

  if (!user || user.role !== "CLIENT" || typeof user.id !== "number") {
    void navigate({
      to: "/login",
      search: { returnTo: `/pro/${professional.id}` } as never,
    });
    return;
  }

  rememberPendingProfessionalMessage(user.id, professional);

  void navigate({
    to: "/messages",
    search: buildProfessionalMessageSearch(user.id, professional) as never,
  });
}

function buildProfessionalMessageSearch(clientId: number, professional: any) {
  const fullName =
    `${professional.firstName || ""} ${professional.lastName || ""}`.trim() || "this professional";
  return {
    conversationId: buildConversationId(clientId, professional.id),
    toUserId: String(professional.id),
    name: fullName,
    avatar: professional.avatarUrl || "",
    job: "Direct message",
    firstMessage: `Hi ${fullName}, I found your profile and would like to discuss hiring you.`,
  };
}

function buildConversationId(clientId: number, professionalId: number) {
  return `client-${clientId}-pro-${professionalId}`;
}

function rememberPendingProfessionalMessage(clientId: number, professional: any) {
  if (typeof window === "undefined") {
    return;
  }

  const search = buildProfessionalMessageSearch(clientId, professional);
  const pending = {
    createdAt: Date.now(),
    conversation: {
      id: search.conversationId,
      otherUserId: Number(search.toUserId),
      otherUserName: search.name,
      otherUserAvatarUrl: search.avatar || null,
      job: search.job,
      preview: "Start conversation",
      time: "",
      unread: 0,
    },
    firstMessage: search.firstMessage,
  };

  sessionStorage.setItem("servio:pending-professional-message", JSON.stringify(pending));
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatWorkMode(value: string) {
  return value === "ON_SITE" ? "On-site" : formatEnum(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
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
