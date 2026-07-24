import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  BookmarkCheck,
  BriefcaseBusiness,
  Clock,
  LocateFixed,
  Map,
  MapPin,
  Save,
  Search,
  SlidersHorizontal,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/lib/current-user.server";
import { formatApproximateLocation } from "@/lib/location-privacy";
import { getProfessionalUsers } from "@/lib/user-db.server";

type ProfessionalDiscoveryUser = ReturnType<typeof getProfessionalUsers>[number];
type ProfessionalWithDistance = ProfessionalDiscoveryUser & {
  distanceKm: number | null;
};

type ClientLocation = {
  lat: number;
  lng: number;
  label: string;
};

type SavedFilter = {
  id: string;
  name: string;
  createdAt: string;
  filters: {
    search: string;
    city: string;
    availability: string;
    rating: string;
    distance: string;
    verifiedOnly: boolean;
  };
};

const getDiscoveryData = createServerFn({ method: "GET" }).handler(async () => ({
  viewer: getCurrentUser(),
  professionals: getProfessionalUsers(),
}));

export const Route = createFileRoute("/discover")({
  validateSearch: (search) =>
    z
      .object({
        search: z.string().optional(),
      })
      .parse(search),
  loader: () => getDiscoveryData(),
  head: () => ({ meta: [{ title: "Find professionals - Servio" }] }),
  component: Discover,
});

function Discover() {
  const { viewer, professionals } = useLoaderData({ from: "/discover" });
  const { search: searchParam } = Route.useSearch();
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const [search, setSearch] = useState(searchParam || "");

  useEffect(() => {
    setSearch(searchParam || "");
  }, [searchParam]);
  const [city, setCity] = useState("");
  const [availability, setAvailability] = useState("all");
  const [rating, setRating] = useState("any");
  const [distance, setDistance] = useState("any");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [selectedMapProfessionalId, setSelectedMapProfessionalId] = useState<number | null>(null);
  const [clientLocation, setClientLocation] = useState<ClientLocation | null>(null);
  const [distanceByProfessionalId, setDistanceByProfessionalId] = useState<Record<number, number>>(
    {},
  );
  const [isLocatingClient, setIsLocatingClient] = useState(false);
  const [isResolvingDistances, setIsResolvingDistances] = useState(false);
  const [distanceError, setDistanceError] = useState<string | null>(null);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [selectedSavedFilterId, setSelectedSavedFilterId] = useState("");
  const displayName = viewer ? `${viewer.firstName} ${viewer.lastName}`.trim() : "Guest";
  const savedFilterStorageKey = viewer
    ? `servio:saved-discovery-filters:${viewer.id}`
    : "servio:saved-discovery-filters:guest";

  useEffect(() => {
    setSavedFilters(readSavedFilters(savedFilterStorageKey));
    setSelectedSavedFilterId("");
  }, [savedFilterStorageKey]);

  useEffect(() => {
    if (!clientLocation) {
      setDistanceByProfessionalId({});
      setIsResolvingDistances(false);
      return;
    }

    if (!googleMapsApiKey) {
      setDistanceError("Add VITE_GOOGLE_MAPS_API_KEY to calculate nearby professional distances.");
      return;
    }

    let active = true;

    setIsResolvingDistances(true);
    setDistanceError(null);

    Promise.all(
      professionals.map(async (professional) => {
        const queries = getProfessionalLocationQueries(professional);

        if (!queries.length) {
          return [professional.id, null] as const;
        }

        let coordinates: { lat: number; lng: number } | null = null;

        for (const query of queries) {
          coordinates = await geocodeAddress(query, googleMapsApiKey);

          if (coordinates) {
            break;
          }
        }

        if (!coordinates) {
          return [professional.id, null] as const;
        }

        return [professional.id, getDistanceKm(clientLocation, coordinates)] as const;
      }),
    )
      .then((entries) => {
        if (!active) {
          return;
        }

        const nextDistances: Record<number, number> = {};

        entries.forEach(([professionalId, distanceKm]) => {
          if (distanceKm != null) {
            nextDistances[professionalId] = distanceKm;
          }
        });

        setDistanceByProfessionalId(nextDistances);
        if (!Object.keys(nextDistances).length && professionals.length) {
          setDistanceError(
            "Could not resolve professional addresses. Check that profiles have a city, service area, or address.",
          );
        }
      })
      .catch(() => {
        if (active) {
          setDistanceError("Could not calculate distances right now.");
        }
      })
      .finally(() => {
        if (active) {
          setIsResolvingDistances(false);
        }
      });

    return () => {
      active = false;
    };
  }, [clientLocation, googleMapsApiKey, professionals]);

  const filteredProfessionals = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const normalizedCity = city.trim().toLowerCase();
    const maxDistanceKm = distance === "any" ? null : Number(distance);

    return professionals
      .map((professional) => ({
        ...professional,
        distanceKm: distanceByProfessionalId[professional.id] ?? null,
      }))
      .filter((professional) => {
        const fullName = `${professional.firstName} ${professional.lastName}`.trim();
        const professionalLocation =
          professional.professionalCity ||
          professional.serviceArea ||
          getCityFromAddress(professional.address);
        const averageRating = Number(professional.averageRating || 0);
        const searchable = [
          fullName,
          professional.email,
          professional.companyName,
          professional.professionalCategory,
          professional.industry,
          professional.companyDescription,
          professional.professionalCity,
          professional.serviceArea,
          professional.address,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const matchesSearch = !normalizedSearch || searchable.includes(normalizedSearch);
        const matchesCity =
          !normalizedCity ||
          professionalLocation.toLowerCase().includes(normalizedCity) ||
          (professional.address || "").toLowerCase().includes(normalizedCity);
        const matchesVerified = !verifiedOnly || Boolean(professional.isVerified);
        const matchesAvailability =
          availability === "all" || professional.availabilityStatus === availability;
        const matchesRating = rating === "any" || averageRating >= Number(rating);
        const matchesDistance =
          maxDistanceKm == null ||
          (clientLocation != null &&
            professional.distanceKm != null &&
            professional.distanceKm <= maxDistanceKm);

        return (
          matchesSearch &&
          matchesCity &&
          matchesVerified &&
          matchesAvailability &&
          matchesRating &&
          matchesDistance
        );
      })
      .sort((left, right) => {
        if (!clientLocation) {
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
  }, [
    availability,
    city,
    clientLocation,
    distance,
    distanceByProfessionalId,
    professionals,
    rating,
    search,
    verifiedOnly,
  ]);

  const selectedMapProfessional = filteredProfessionals.find(
    (professional) => professional.id === selectedMapProfessionalId,
  );
  const mapQuery =
    selectedMapProfessional?.professionalCity ||
    selectedMapProfessional?.serviceArea ||
    formatApproximateLocation(selectedMapProfessional?.address, "") ||
    city ||
    formatApproximateLocation(
      filteredProfessionals.find((professional) => professional.address)?.address,
      "",
    ) ||
    "India";

  const resetFilters = () => {
    setSearch("");
    setCity("");
    setAvailability("all");
    setRating("any");
    setDistance("any");
    setVerifiedOnly(false);
    setSelectedMapProfessionalId(null);
    setSelectedSavedFilterId("");
  };

  const useClientCurrentLocation = () => {
    setDistanceError(null);

    if (!navigator.geolocation) {
      setDistanceError("Current location is not supported by this browser.");
      return;
    }

    setIsLocatingClient(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setClientLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: "Current location",
        });
        setIsLocatingClient(false);
        toast.success("Location enabled", {
          description: "Nearby professionals are sorted by distance.",
        });
      },
      () => {
        setDistanceError("Allow location access to view nearby professionals.");
        setIsLocatingClient(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const currentFilterState = () => ({
    search,
    city,
    availability,
    rating,
    distance,
    verifiedOnly,
  });

  const saveCurrentFilter = () => {
    if (savedFilters.length >= 5) {
      toast.error("You can save up to 5 filters.", {
        description: "Delete one saved filter before adding a new one.",
      });
      return;
    }

    const filter: SavedFilter = {
      id: crypto.randomUUID(),
      name: buildSavedFilterName(currentFilterState()),
      createdAt: new Date().toISOString(),
      filters: currentFilterState(),
    };
    const nextFilters = [filter, ...savedFilters];

    setSavedFilters(nextFilters);
    setSelectedSavedFilterId(filter.id);
    writeSavedFilters(savedFilterStorageKey, nextFilters);
    toast.success("Filter saved", {
      description: `${filter.name} was added to your saved filters.`,
    });
  };

  const applySavedFilter = (filter: SavedFilter) => {
    setSearch(filter.filters.search);
    setCity(filter.filters.city);
    setAvailability(filter.filters.availability);
    setRating(filter.filters.rating);
    setDistance(filter.filters.distance);
    setVerifiedOnly(filter.filters.verifiedOnly);
    setSelectedMapProfessionalId(null);
    setSelectedSavedFilterId(filter.id);
    toast.info("Saved filter applied", {
      description: filter.name,
    });
  };

  const deleteSavedFilter = (filterId: string) => {
    const nextFilters = savedFilters.filter((filter) => filter.id !== filterId);

    setSavedFilters(nextFilters);
    setSelectedSavedFilterId((current) => (current === filterId ? "" : current));
    writeSavedFilters(savedFilterStorageKey, nextFilters);
    toast.success("Saved filter deleted");
  };

  return (
    <AppShell
      userName={displayName}
      userRole={viewer?.role === "PROFESSIONAL" ? "Professional" : "Client"}
      userAvatarUrl={viewer?.avatarUrl}
    >
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Find professionals</h1>
          <p className="text-sm text-muted-foreground">
            Search saved professional accounts by name, city, service, availability, rating, and
            verified status.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => setShowMap((value) => !value)}>
          <Map className="h-4 w-4" />
          {showMap ? "Hide Map" : "View Professionals on Map"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="h-fit rounded-xl border border-border bg-card p-5 shadow-soft lg:sticky lg:top-20">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Filters</h2>
            <button className="text-xs text-primary hover:underline" onClick={resetFilters}>
              Clear all
            </button>
          </div>

          <div className="mb-4 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">Saved filters</p>
                <p className="text-xs text-muted-foreground">{savedFilters.length}/5 saved</p>
              </div>
              <Button size="sm" className="gap-2" onClick={saveCurrentFilter}>
                <Save className="h-4 w-4" />
                Save
              </Button>
            </div>

            <select
              className="mt-3 h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
              value={selectedSavedFilterId}
              onChange={(event) => {
                const filter = savedFilters.find((item) => item.id === event.target.value);
                if (filter) {
                  applySavedFilter(filter);
                } else {
                  setSelectedSavedFilterId("");
                }
              }}
            >
              <option value="">Choose saved filter</option>
              {savedFilters.map((filter) => (
                <option key={filter.id} value={filter.id}>
                  {filter.name}
                </option>
              ))}
            </select>

            {savedFilters.length ? (
              <div className="mt-3 space-y-2">
                {savedFilters.map((filter) => (
                  <div
                    key={filter.id}
                    role="button"
                    tabIndex={0}
                    onDoubleClick={() => applySavedFilter(filter)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        applySavedFilter(filter);
                      }
                    }}
                    className={`flex items-center gap-2 rounded-md border px-2 py-2 text-sm transition-colors ${
                      selectedSavedFilterId === filter.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background hover:border-primary/50"
                    }`}
                    title="Double click to apply"
                  >
                    <BookmarkCheck className="h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate">{filter.name}</span>
                    <button
                      type="button"
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteSavedFilter(filter.id);
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

          <FilterSection title="City">
            <Input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="e.g. Surat"
            />
          </FilterSection>

          <FilterSection title="Distance">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Nearby professionals</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {clientLocation
                      ? `${clientLocation.label}: ${isResolvingDistances ? "calculating..." : `${Object.keys(distanceByProfessionalId).length} distances ready`}`
                      : "Use your location to show real distance."}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-2"
                  onClick={useClientCurrentLocation}
                  disabled={isLocatingClient}
                >
                  <LocateFixed className="h-4 w-4" />
                  {isLocatingClient ? "Finding" : "Use"}
                </Button>
              </div>
              {distanceError ? (
                <p className="mt-2 text-xs text-destructive">{distanceError}</p>
              ) : null}
            </div>
            <select
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
              value={distance}
              onChange={(event) => setDistance(event.target.value)}
            >
              <option value="any">Anywhere</option>
              <option value="5">Within 5 km</option>
              <option value="10">Within 10 km</option>
              <option value="25">Within 25 km</option>
              <option value="50">Within 50 km</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Distance uses your browser location and each professional profile address.
            </p>
          </FilterSection>

          <FilterSection title="Rating">
            <select
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
              value={rating}
              onChange={(event) => setRating(event.target.value)}
            >
              <option value="any">Any rating</option>
              <option value="4.5">4.5 and up</option>
              <option value="4">4.0 and up</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Uses saved average rating and review count.
            </p>
          </FilterSection>

          <FilterSection title="Verified">
            <label className="flex items-center justify-between text-sm">
              <span>Verified professionals</span>
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(event) => setVerifiedOnly(event.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
            </label>
          </FilterSection>

          <FilterSection title="Availability">
            <select
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
              value={availability}
              onChange={(event) => setAvailability(event.target.value)}
            >
              <option value="all">Any availability</option>
              <option value="available">Available now</option>
              <option value="busy">Busy</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </FilterSection>
        </aside>

        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-soft">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, service, company, or address"
              />
            </div>
            <Button variant="outline" size="sm" className="gap-2 lg:hidden">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </Button>
          </div>

          {showMap ? (
            <div className="mb-4 overflow-hidden rounded-xl border border-border bg-card shadow-soft">
              <div className="flex flex-col justify-between gap-2 border-b border-border p-4 sm:flex-row sm:items-center">
                <div>
                  <h2 className="font-semibold">View Professionals on Map</h2>
                  <p className="text-sm text-muted-foreground">
                    Showing map around {mapQuery}. Nearby results sort by client distance when
                    location is enabled.
                  </p>
                </div>
                <Badge variant="secondary">{filteredProfessionals.length} results</Badge>
              </div>
              <div className="grid lg:grid-cols-[1fr_320px]">
                <iframe
                  title="Professional discovery map"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=12&output=embed`}
                  className="h-[380px] w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <div className="max-h-[380px] overflow-y-auto border-t border-border bg-background p-3 lg:border-l lg:border-t-0">
                  {filteredProfessionals.length ? (
                    <div className="space-y-3">
                      {filteredProfessionals.map((professional) => (
                        <MapProfessionalRow
                          key={professional.id}
                          professional={professional}
                          distanceKm={professional.distanceKm}
                          selected={selectedMapProfessionalId === professional.id}
                          onSelect={() => setSelectedMapProfessionalId(professional.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      No professionals match these map filters.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filteredProfessionals.length} of {professionals.length} saved professionals
            </p>
          </div>

          {filteredProfessionals.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
              {filteredProfessionals.map((professional) => (
                <ProfessionalResultCard
                  key={professional.id}
                  professional={professional}
                  distanceKm={professional.distanceKm}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-soft">
              <BriefcaseBusiness className="mx-auto h-9 w-9 text-muted-foreground" />
              <h3 className="mt-3 font-semibold">No professionals found</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Try clearing filters or add professional accounts with profile details in the
                database.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function ProfessionalResultCard({
  professional,
  distanceKm,
}: {
  professional: ProfessionalWithDistance;
  distanceKm: number | null;
}) {
  const fullName = `${professional.firstName} ${professional.lastName}`.trim();
  const verified = Boolean(professional.isVerified);
  const category =
    professional.professionalCategory || professional.industry || professional.companyName;
  const city =
    professional.professionalCity ||
    professional.serviceArea ||
    getCityFromAddress(professional.address);
  const averageRating = Number(professional.averageRating || 0);
  const reviewCount = Number(professional.reviewCount || 0);
  const availabilityLabel = formatAvailability(professional.availabilityStatus);
  const hourlyRateLabel =
    professional.hourlyRate != null ? `$${professional.hourlyRate}/hr` : "Contact for rate";
  const fixedRateLabel = professional.fixedRate != null ? `$${professional.fixedRate}` : "Flexible";

  return (
    <div className="flex min-h-[260px] flex-col rounded-xl border border-border bg-card p-4 shadow-soft transition-colors hover:border-primary/40">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <img
            src={
              professional.avatarUrl ||
              `https://i.pravatar.cc/100?u=discover-pro-${professional.id}`
            }
            alt={fullName}
            className="h-16 w-16 rounded-xl object-cover"
          />
          {verified ? (
            <span className="absolute -bottom-1.5 -right-1.5 grid h-6 w-6 place-items-center rounded-full bg-success text-success-foreground ring-2 ring-card">
              <BadgeCheck className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-foreground">
            {fullName || "Professional"}
          </h3>
          <p className="truncate text-sm text-muted-foreground">
            {category || "Professional account"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge className="rounded-full" variant={verified ? "default" : "secondary"}>
              {verified ? "Verified" : "Not verified"}
            </Badge>
            <Badge className="rounded-full" variant="outline">
              {availabilityLabel}
            </Badge>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
        <MetaPill label="Hourly" value={hourlyRateLabel} />
        <MetaPill label="Fixed" value={fixedRateLabel} />
        <MetaPill
          label="Radius"
          value={professional.serviceRadiusKm ? `${professional.serviceRadiusKm} km` : "Not set"}
        />
      </div>

      {professional.companyDescription ? (
        <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">
          {professional.companyDescription}
        </p>
      ) : (
        <div className="mt-4 flex-1" />
      )}

      <div className="mt-auto border-t border-border pt-4">
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted px-3 py-1">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {formatApproximateLocation(city || professional.address, "Location not added")}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
            <LocateFixed className="h-3.5 w-3.5 shrink-0" />
            {formatDistanceLabel(distanceKm)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
            <Star className="h-3.5 w-3.5 fill-warning text-warning" />
            {averageRating > 0 ? `${averageRating.toFixed(1)} (${reviewCount})` : "No rating yet"}
          </span>
        </div>
        <div className="mt-4 flex justify-end">
          <Button asChild variant="outline" size="sm">
            <Link to="/pro/$proId" params={{ proId: String(professional.id) }}>
              View profile
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/60 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate font-medium text-foreground">{value}</p>
    </div>
  );
}

function MapProfessionalRow({
  professional,
  distanceKm,
  selected,
  onSelect,
}: {
  professional: ProfessionalWithDistance;
  distanceKm: number | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const fullName = `${professional.firstName} ${professional.lastName}`.trim();
  const category =
    professional.professionalCategory ||
    professional.industry ||
    professional.companyName ||
    "Professional services";
  const city =
    professional.professionalCity ||
    professional.serviceArea ||
    getCityFromAddress(professional.address) ||
    "Location not added";
  const averageRating = Number(professional.averageRating || 0);
  const reviewCount = Number(professional.reviewCount || 0);
  const hourlyRateLabel =
    professional.hourlyRate != null ? `$${professional.hourlyRate}/hr` : "Contact";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={`block cursor-pointer rounded-xl border bg-card p-3 text-sm shadow-soft transition hover:border-primary ${
        selected ? "border-primary ring-2 ring-primary/15" : "border-border"
      }`}
    >
      <div className="flex gap-3">
        <div className="relative shrink-0">
          <img
            src={professional.avatarUrl || `https://i.pravatar.cc/100?u=map-pro-${professional.id}`}
            alt={fullName}
            className="h-12 w-12 rounded-xl object-cover"
          />
          {professional.isVerified ? (
            <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-card">
              <BadgeCheck className="h-3 w-3" />
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{fullName || "Professional"}</p>
              <p className="truncate text-xs text-muted-foreground">{category}</p>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
              {hourlyRateLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <span className="flex min-w-0 items-center gap-1 rounded-lg bg-muted px-2 py-1.5 text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{city}</span>
        </span>
        <span className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1.5 text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          <span className="truncate">{formatAvailability(professional.availabilityStatus)}</span>
        </span>
        <span className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1.5 text-muted-foreground">
          <Star className="h-3 w-3 shrink-0 fill-warning text-warning" />
          <span>{averageRating > 0 ? `${averageRating.toFixed(1)} (${reviewCount})` : "New"}</span>
        </span>
        <span className="rounded-lg bg-muted px-2 py-1.5 text-muted-foreground">
          {formatDistanceLabel(distanceKm)}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">
          {selected ? "Showing on map" : "Click card to show location"}
        </span>
        <Button asChild size="sm" variant="outline" onClick={(event) => event.stopPropagation()}>
          <Link to="/pro/$proId" params={{ proId: String(professional.id) }}>
            View profile
          </Link>
        </Button>
      </div>
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border py-4 first:border-t-0 first:pt-0">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function getProfessionalLocationQueries(professional: ProfessionalDiscoveryUser) {
  return Array.from(
    new Set(
      [
        professional.address,
        professional.serviceArea,
        professional.professionalCity,
        getCityFromAddress(professional.address),
      ]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

async function geocodeAddress(address: string, googleMapsApiKey: string) {
  try {
    const google = await loadGoogleMapsApi(googleMapsApiKey);
    const geocoder = new google.maps.Geocoder();

    return await new Promise<{ lat: number; lng: number } | null>((resolve) => {
      geocoder.geocode({ address }, (results: any[] | null, status: string) => {
        const location = status === "OK" ? results?.[0]?.geometry?.location : null;

        if (!location) {
          resolve(null);
          return;
        }

        resolve({
          lat: location.lat(),
          lng: location.lng(),
        });
      });
    });
  } catch {
    return null;
  }
}

function loadGoogleMapsApi(googleMapsApiKey: string) {
  const win = window as Window & { google?: any };

  if (win.google?.maps?.Geocoder) {
    return Promise.resolve(win.google);
  }

  const existingScript = document.querySelector<HTMLScriptElement>(
    'script[src*="maps.googleapis.com/maps/api/js"]',
  );

  if (existingScript) {
    return new Promise<any>((resolve, reject) => {
      existingScript.addEventListener(
        "load",
        () => {
          if (win.google?.maps?.Geocoder) {
            resolve(win.google);
            return;
          }

          reject(new Error("Google Maps geocoder unavailable."));
        },
        { once: true },
      );
      existingScript.addEventListener("error", reject, { once: true });
    });
  }

  return new Promise<any>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsDiscovery = "true";
    script.addEventListener(
      "load",
      () => {
        if (win.google?.maps?.Geocoder) {
          resolve(win.google);
          return;
        }

        reject(new Error("Google Maps geocoder unavailable."));
      },
      { once: true },
    );
    script.addEventListener("error", reject, { once: true });
    document.head.appendChild(script);
  });
}

function getDistanceKm(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
) {
  const earthRadiusKm = 6371;
  const latDelta = toRadians(destination.lat - origin.lat);
  const lngDelta = toRadians(destination.lng - origin.lng);
  const originLat = toRadians(origin.lat);
  const destinationLat = toRadians(destination.lat);
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(lngDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
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

function getCityFromAddress(address: string | null) {
  if (!address) {
    return "";
  }

  return (
    address
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)[0] || ""
  );
}

function formatAvailability(value: string | null | undefined) {
  if (value === "busy") {
    return "Busy";
  }

  if (value === "unavailable") {
    return "Unavailable";
  }

  return "Available now";
}

function readSavedFilters(storageKey: string) {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "[]");

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.slice(0, 5).filter(isSavedFilter) as SavedFilter[];
  } catch {
    return [];
  }
}

function writeSavedFilters(storageKey: string, filters: SavedFilter[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(filters.slice(0, 5)));
}

function isSavedFilter(value: unknown): value is SavedFilter {
  if (!value || typeof value !== "object") {
    return false;
  }

  const filter = value as SavedFilter;

  return Boolean(filter.id && filter.name && filter.filters);
}

function buildSavedFilterName(filters: SavedFilter["filters"]) {
  const parts = [
    filters.search.trim() ? `"${filters.search.trim()}"` : "",
    filters.city.trim() ? filters.city.trim() : "",
    filters.availability !== "all" ? formatAvailability(filters.availability) : "",
    filters.rating !== "any" ? `${filters.rating}+ stars` : "",
    filters.distance !== "any" ? `${filters.distance} km` : "",
    filters.verifiedOnly ? "Verified" : "",
  ].filter(Boolean);

  return parts.length ? parts.slice(0, 3).join(" / ") : "All professionals";
}
