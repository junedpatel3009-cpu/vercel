import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TrendingUp,
  ShieldCheck,
  MapPin,
  Wallet,
  BadgeCheck,
  Briefcase,
  CalendarClock,
  LocateFixed,
  Paperclip,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { getOpenClientJobs } from "@/lib/job-db.server";
import { formatApproximateCoordinates, formatApproximateLocation } from "@/lib/location-privacy";

const getHomeData = createServerFn({ method: "GET" }).handler(async () => {
  return {
    openJobs: getOpenClientJobs(),
  };
});

export const Route = createFileRoute("/for-professionals")({
  head: () => ({
    meta: [
      { title: "For Professionals — Grow your business | Servio" },
      {
        name: "description",
        content: "Find quality jobs near you, get paid safely, and grow your business with Servio.",
      },
    ],
  }),
  loader: () => getHomeData(),
  component: ForPros,
});

function ForPros() {
  const { openJobs } = useLoaderData({ from: "/for-professionals" }) as { openJobs: any[] };
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [urgency, setUrgency] = useState("all");
  const [type, setType] = useState("all");
  const [distance, setDistance] = useState("any");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [selectedMapJobId, setSelectedMapJobId] = useState<number | null>(null);

  const filteredJobs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const normalizedCity = city.trim().toLowerCase();
    const min = budgetMin ? Number(budgetMin) : null;
    const max = budgetMax ? Number(budgetMax) : null;
    const maxDistance = distance === "any" ? null : Number(distance);

    return openJobs
      .map((job) => ({
        ...job,
        distanceKm:
          userLocation != null && job.locationLat != null && job.locationLng != null
            ? getDistanceKm(userLocation, { lat: job.locationLat, lng: job.locationLng })
            : null,
      }))
      .filter((job) => {
        const jobBudgetMin = job.budgetMin ?? job.budgetMax ?? 0;
        const jobBudgetMax = job.budgetMax ?? job.budgetMin ?? 0;
        const locationText = [job.locationLabel, job.locationAddress].filter(Boolean).join(" ");
        const searchable = [
          job.title,
          job.description,
          job.category,
          job.urgency,
          job.workMode,
          locationText,
          job.clientCompanyName,
          job.clientName,
          formatBudget(job.budgetMin, job.budgetMax, job.timingType),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesSearch = !normalizedSearch || searchable.includes(normalizedSearch);
        const matchesCity = !normalizedCity || locationText.toLowerCase().includes(normalizedCity);
        const matchesBudgetMin = min == null || jobBudgetMax >= min;
        const matchesBudgetMax = max == null || jobBudgetMin <= max;
        const matchesUrgency = urgency === "all" || job.urgency === urgency;
        const matchesType = type === "all" || job.workMode === type;
        const matchesDistance =
          maxDistance == null ||
          job.workMode === "REMOTE" ||
          (userLocation != null && job.distanceKm != null && job.distanceKm <= maxDistance);

        return (
          matchesSearch &&
          matchesCity &&
          matchesBudgetMin &&
          matchesBudgetMax &&
          matchesUrgency &&
          matchesType &&
          matchesDistance
        );
      })
      .sort((left, right) => {
        if (!userLocation) {
          return 0;
        }

        if (left.distanceKm == null && right.distanceKm == null) {
          return 0;
        }

        if (left.distanceKm == null) {
          return 1;
        }

        if (right.distanceKm == null) {
          return -1;
        }

        return left.distanceKm - right.distanceKm;
      });
  }, [budgetMax, budgetMin, city, distance, openJobs, search, type, urgency, userLocation]);
  const hasFilters =
    Boolean(search || city || budgetMin || budgetMax) ||
    distance !== "any" ||
    urgency !== "all" ||
    type !== "all";
  const selectedMapJob =
    filteredJobs.find((job) => job.id === selectedMapJobId) ||
    filteredJobs.find(
      (job) => job.locationAddress || (job.locationLat != null && job.locationLng != null),
    );
  const selectedMapQuery =
    selectedMapJob?.locationLat != null && selectedMapJob.locationLng != null
      ? `${selectedMapJob.locationLat},${selectedMapJob.locationLng}`
      : selectedMapJob?.locationAddress ||
        (userLocation ? `${userLocation.lat},${userLocation.lng}` : city);
  const mappableJobs = filteredJobs.filter(
    (job) => job.locationAddress || (job.locationLat != null && job.locationLng != null),
  );
  const activeFilterCount = [
    city,
    budgetMin,
    budgetMax,
    distance !== "any" ? distance : "",
    urgency !== "all" ? urgency : "",
    type !== "all" ? type : "",
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSearch("");
    setCity("");
    setBudgetMin("");
    setBudgetMax("");
    setUrgency("all");
    setType("all");
    setDistance("any");
    setLocationStatus(null);
    setSelectedMapJobId(null);
  };

  const useCurrentLocation = () => {
    setLocationStatus(null);

    if (!navigator.geolocation) {
      setLocationStatus("Current location is not supported by this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationStatus("Location ready for distance filtering.");
      },
      () => setLocationStatus("Allow location access to use distance filtering."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="bg-ink text-ink-foreground">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cta">
              For professionals
            </p>
            <h1 className="font-display mt-3 text-4xl font-bold tracking-tight text-white md:text-5xl">
              Find quality jobs. Get paid safely. Grow your business.
            </h1>
            <p className="mt-4 max-w-lg text-white/70">
              No more chasing leads or waiting on payments. Servio brings nearby and remote jobs
              straight to you.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-cta text-cta-foreground hover:bg-cta/90">
                <Link to="/signup">Join as a Pro — free</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              >
                <Link to="/discover">See sample jobs</Link>
              </Button>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-6">
              {[
                { v: "$3.2k", l: "Avg. monthly earnings" },
                { v: "<2h", l: "First lead" },
                { v: "120K+", l: "Active pros" },
              ].map((s) => (
                <div key={s.l}>
                  <p className="font-display text-2xl font-bold text-white">{s.v}</p>
                  <p className="text-xs text-white/60">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4">
            {[
              {
                icon: TrendingUp,
                t: "Grow",
                d: "Algorithmic match-making puts you in front of the right clients.",
              },
              {
                icon: ShieldCheck,
                t: "Trusted",
                d: "Verified badges and ratings build long-term reputation.",
              },
              {
                icon: MapPin,
                t: "Nearby",
                d: "See jobs by distance, urgency, and budget — at a glance.",
              },
              {
                icon: Wallet,
                t: "Paid weekly",
                d: "Withdraw earnings to your bank or wallet, anytime.",
              },
            ].map((b) => (
              <div key={b.t} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-cta/15 text-cta">
                    <b.icon className="h-5 w-5" />
                  </div>
                  <p className="font-display text-lg font-semibold text-white">{b.t}</p>
                </div>
                <p className="mt-2 text-sm text-white/70">{b.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="font-display text-3xl font-bold tracking-tight">
          Built for professionals like you
        </h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            {
              icon: Briefcase,
              t: "All trades welcome",
              d: "Plumbers, designers, photographers, tutors — there's a market for you.",
            },
            {
              icon: BadgeCheck,
              t: "Get verified",
              d: "Free identity & license verification builds trust with clients.",
            },
            {
              icon: TrendingUp,
              t: "Insights & analytics",
              d: "Track win-rates, response times, and earnings in one dashboard.",
            },
          ].map((b) => (
            <div key={b.t} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                <b.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display mt-4 text-lg font-semibold">{b.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight">
              Jobs posted by clients
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              These are live open jobs created by clients. Professionals can use this feed to
              browse, review, and apply.
            </p>
          </div>
          <div className="rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            {openJobs.length} active job{openJobs.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-border bg-card p-4 shadow-soft">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search jobs, client, category"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-9 gap-2"
              onClick={() => setIsFilterOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilterCount ? (
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>
            <Button type="button" variant="outline" onClick={resetFilters} disabled={!hasFilters}>
              Clear
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              Showing {filteredJobs.length} of {openJobs.length} jobs
            </span>
            {activeFilterCount ? (
              <span>
                {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"} active
              </span>
            ) : null}
          </div>
        </div>

        <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Filters</DialogTitle>
              <DialogDescription>
                Narrow available client jobs by distance, city, budget, urgency, and type.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                <span>City</span>
                <Input
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="e.g. Mumbai"
                />
              </label>

              <label className="space-y-2 text-sm font-medium">
                <span>Distance</span>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-normal"
                  value={distance}
                  onChange={(event) => setDistance(event.target.value)}
                >
                  <option value="any">Any distance</option>
                  <option value="5">Within 5 km</option>
                  <option value="10">Within 10 km</option>
                  <option value="25">Within 25 km</option>
                  <option value="50">Within 50 km</option>
                </select>
              </label>

              <label className="space-y-2 text-sm font-medium">
                <span>Minimum budget</span>
                <Input
                  type="number"
                  min="0"
                  value={budgetMin}
                  onChange={(event) => setBudgetMin(event.target.value)}
                  placeholder="Min budget"
                />
              </label>

              <label className="space-y-2 text-sm font-medium">
                <span>Maximum budget</span>
                <Input
                  type="number"
                  min="0"
                  value={budgetMax}
                  onChange={(event) => setBudgetMax(event.target.value)}
                  placeholder="Max budget"
                />
              </label>

              <label className="space-y-2 text-sm font-medium">
                <span>Urgency</span>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-normal"
                  value={urgency}
                  onChange={(event) => setUrgency(event.target.value)}
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
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-normal"
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                >
                  <option value="all">Any type</option>
                  <option value="REMOTE">Remote</option>
                  <option value="ON_SITE">On-site</option>
                  <option value="BOTH">Both</option>
                </select>
              </label>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>{locationStatus || "Use your current location for distance filters."}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={useCurrentLocation}
                >
                  <MapPin className="h-4 w-4" />
                  Use my location
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={resetFilters}>
                Clear
              </Button>
              <Button type="button" onClick={() => setIsFilterOpen(false)}>
                Apply filters
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {selectedMapQuery ? (
          <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card shadow-soft">
            <div className="flex flex-col justify-between gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center">
              <div>
                <p className="font-medium">Nearby jobs on map</p>
                <p className="text-sm text-muted-foreground">
                  {selectedMapJob
                    ? `Showing ${selectedMapJob.title} near ${formatJobLocation(selectedMapJob) || formatApproximateCoordinates(selectedMapJob.locationLat, selectedMapJob.locationLng) || "saved location"}.`
                    : userLocation
                      ? "Showing jobs around your current location."
                      : "Choose a job with a saved location to preview it."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={useCurrentLocation}
                >
                  <LocateFixed className="h-4 w-4" />
                  Use my location
                </Button>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedMapQuery)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-border px-3 py-2 text-sm font-medium text-primary hover:bg-muted"
                >
                  Open in Google Maps
                </a>
              </div>
            </div>
            <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
              <iframe
                key={selectedMapQuery}
                title="Nearby jobs map"
                src={`https://www.google.com/maps?q=${encodeURIComponent(selectedMapQuery)}&z=${userLocation ? 12 : 14}&output=embed`}
                className="h-[380px] w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <div className="max-h-[380px] overflow-y-auto border-t border-border bg-background p-3 lg:border-l lg:border-t-0">
                <div className="mb-3 flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">
                    {mappableJobs.length} mapped job{mappableJobs.length === 1 ? "" : "s"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {userLocation ? "Nearest first" : "Select a job"}
                  </span>
                </div>
                {mappableJobs.length ? (
                  <div className="space-y-2">
                    {mappableJobs.map((job) => (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => setSelectedMapJobId(job.id)}
                        className={`w-full rounded-lg border p-3 text-left transition-colors ${
                          selectedMapJob?.id === job.id
                            ? "border-primary bg-primary/5"
                            : "border-border bg-card hover:border-primary/60"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {job.title}
                            </p>
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {formatJobLocation(job)}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                            {formatDistanceLabel(job.distanceKm)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span className="rounded-full bg-muted px-2 py-1">{job.category}</span>
                          <span className="rounded-full bg-muted px-2 py-1">
                            {formatBudget(job.budgetMin, job.budgetMax, job.timingType)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                    No jobs with saved map locations match these filters.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {filteredJobs.length ? (
          <div className="mt-8 grid gap-3 lg:grid-cols-2">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="group rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/60 hover:bg-muted/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        {job.category}
                      </span>
                      <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {job.workMode === "ON_SITE"
                          ? "On-site"
                          : job.workMode === "REMOTE"
                            ? "Remote"
                            : "Both"}
                      </span>
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-[11px] ${
                          job.urgency === "HIGH"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {formatEnum(job.urgency)}
                      </span>
                    </div>
                    <h3 className="mt-3 line-clamp-2 text-base font-semibold leading-6 text-foreground">
                      {job.title}
                    </h3>
                  </div>
                  <div className="shrink-0 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-right">
                    <p className="text-[10px] font-semibold uppercase text-primary/80">Budget</p>
                    <p className="mt-0.5 whitespace-nowrap text-sm font-semibold text-primary">
                      {formatBudget(job.budgetMin, job.budgetMax, job.timingType)}
                    </p>
                  </div>
                </div>
                <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-muted-foreground">
                  {job.description}
                </p>

                <div className="mt-3 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
                  <div className="flex min-w-0 items-center gap-1.5 rounded-md border border-border/70 bg-background px-2 py-1.5">
                    <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {new Intl.DateTimeFormat("en", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      }).format(new Date(job.deadline))}
                    </span>
                  </div>
                  <div className="flex min-w-0 items-center gap-1.5 rounded-md border border-border/70 bg-background px-2 py-1.5">
                    <Paperclip className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {job.attachments.length} file{job.attachments.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="flex min-w-0 items-center gap-1.5 rounded-md border border-border/70 bg-background px-2 py-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{formatJobLocation(job)}</span>
                  </div>
                  <div className="flex min-w-0 items-center gap-1.5 rounded-md border border-border/70 bg-background px-2 py-1.5">
                    <LocateFixed className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{formatDistanceLabel(job.distanceKm)}</span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground">
                    Posted by{" "}
                    <span className="font-medium text-foreground">
                      {job.clientCompanyName || job.clientName}
                    </span>
                  </p>
                  {job.locationAddress || (job.locationLat != null && job.locationLng != null) ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 px-2.5 text-xs"
                      onClick={() => setSelectedMapJobId(job.id)}
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      Map
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-border bg-muted/10 p-8 text-center">
            <p className="text-sm font-semibold text-muted-foreground">
              No jobs match these filters.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Try clearing filters or broadening the budget, city, urgency, or type.
            </p>
          </div>
        )}
      </section>

      <SiteFooter />
    </div>
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

  return "Budget not set";
}

function formatJobLocation(job: {
  locationAddress?: string | null;
  locationLabel?: string | null;
  workMode?: string | null;
}) {
  if (job.workMode === "REMOTE") {
    return "Remote";
  }

  return formatApproximateLocation(job.locationAddress || job.locationLabel, "Location saved");
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

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDistanceLabel(distanceKm: number | null) {
  if (distanceKm == null) {
    return "Distance unavailable";
  }

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m away`;
  }

  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km away`;
}

function getDistanceKm(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const radius = 6371;
  const latDelta = toRadians(to.lat - from.lat);
  const lngDelta = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const haversine =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) * Math.sin(lngDelta / 2);

  return radius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
