import { useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState, type ComponentType } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, MapPin, Filter, X } from "lucide-react";
import {
  Wrench,
  Code,
  Paintbrush,
  Camera,
  Megaphone,
  GraduationCap,
  Hammer,
  Sparkles,
  Truck,
  Music,
  Briefcase,
  HeartPulse,
} from "lucide-react";

const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  Wrench,
  Code,
  Paintbrush,
  Camera,
  Megaphone,
  GraduationCap,
  Hammer,
  Sparkles,
  Truck,
  Music,
  Briefcase,
  HeartPulse,
};

export function buildDiscoverSearch(
  category?: string,
  extra?: Record<string, string>,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (category) params.category = category;
  if (extra) Object.assign(params, extra);
  return params;
}

export function ServicesPageContent({
  categories,
  totalPros,
}: {
  categories: any[];
  totalPros: number;
}) {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [ratingFilters, setRatingFilters] = useState<string[]>([]);
  const [distanceFilters, setDistanceFilters] = useState<string[]>([]);
  const [availabilityFilters, setAvailabilityFilters] = useState<string[]>([]);
  const [otherFilters, setOtherFilters] = useState<Set<string>>(new Set());

  const hasActiveFilters =
    searchQuery ||
    locationQuery ||
    selectedCategory ||
    ratingFilters.length ||
    distanceFilters.length ||
    availabilityFilters.length ||
    otherFilters.size > 0;

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c: any) => c.name.toLowerCase().includes(q));
  }, [categories, searchQuery]);

  function toggleRating(value: string) {
    setRatingFilters((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  function toggleDistance(value: string) {
    setDistanceFilters((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  function toggleAvailability(value: string) {
    setAvailabilityFilters((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  function toggleOther(value: string) {
    setOtherFilters((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function clearAllFilters() {
    setSearchQuery("");
    setLocationQuery("");
    setSelectedCategory("");
    setRatingFilters([]);
    setDistanceFilters([]);
    setAvailabilityFilters([]);
    setOtherFilters(new Set());
  }

  function handleSearch() {
    const extra: Record<string, string> = {};
    if (locationQuery.trim()) extra.location = locationQuery.trim();
    if (otherFilters.has("Verified only")) extra.verifiedOnly = "true";
    if (otherFilters.has("Remote")) extra.workMode = "REMOTE";
    if (otherFilters.has("On-site")) extra.workMode = "ON_SITE";
    if (ratingFilters.length > 0)
      extra.rating = Math.min(...ratingFilters.map(parseRating)).toString();

    navigate({
      to: "/discover",
      search: buildDiscoverSearch(
        selectedCategory || undefined,
        Object.keys(extra).length ? extra : undefined,
      ),
    });
  }

  const appliedFilterCount =
    ratingFilters.length + distanceFilters.length + availabilityFilters.length + otherFilters.size;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            Browse all services
          </h1>
          <p className="mt-2 text-muted-foreground">Find exactly the type of pro you need.</p>
          <div className="mt-6 grid gap-2 rounded-2xl border border-border bg-card p-2 shadow-soft sm:grid-cols-[1fr_1fr_auto_auto]">
            <div className="flex items-center gap-2 rounded-xl px-3">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Search services"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-0 shadow-none focus-visible:ring-0"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-2 rounded-xl px-3 sm:border-l sm:border-border">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Location"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                className="border-0 shadow-none focus-visible:ring-0"
              />
              {locationQuery ? (
                <button
                  type="button"
                  onClick={() => setLocationQuery("")}
                  className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="rounded-xl border-border">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c: any) => (
                  <SelectItem key={c.slug} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="rounded-xl bg-primary" onClick={handleSearch}>
              <Search className="h-4 w-4" />
              Search
            </Button>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[260px_1fr] lg:px-8">
        <aside className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold">Filters</h3>
              <div className="flex items-center gap-2">
                {appliedFilterCount > 0 ? (
                  <Badge variant="outline" className="rounded-full px-2 text-xs">
                    {appliedFilterCount}
                  </Badge>
                ) : null}
                <Filter className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            {hasActiveFilters ? (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-xs text-primary hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            ) : null}
            <FilterGroup
              title="Rating"
              options={["4.5 & up", "4.0 & up", "3.5 & up"]}
              selected={ratingFilters}
              onToggle={toggleRating}
            />
            <FilterGroup
              title="Distance"
              options={["Within 2 km", "Within 5 km", "Within 10 km", "Any"]}
              selected={distanceFilters}
              onToggle={toggleDistance}
            />
            <FilterGroup
              title="Availability"
              options={["Now", "This week", "Next week"]}
              selected={availabilityFilters}
              onToggle={toggleAvailability}
            />
            <FilterGroup
              title="Other"
              options={["Verified only", "Remote", "On-site"]}
              selected={Array.from(otherFilters)}
              onToggle={(value) => toggleOther(value)}
            />
            <Button className="mt-4 w-full bg-primary" onClick={handleSearch}>
              <Search className="h-4 w-4" />
              {appliedFilterCount > 0
                ? `Apply ${appliedFilterCount} filter${appliedFilterCount > 1 ? "s" : ""}`
                : "Apply filters"}
            </Button>
          </div>
        </aside>

        <div>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {filteredCategories.length} categor{filteredCategories.length === 1 ? "y" : "ies"}
            </span>
            {totalPros > 0 ? <span> · {totalPros.toLocaleString()} pros</span> : null}
          </p>
          {filteredCategories.length ? (
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCategories.map((c: any) => {
                const IconComponent = ICON_MAP[c.iconName] || null;
                return (
                  <Link
                    key={c.name}
                    to="/discover"
                    search={{ category: c.name }}
                    className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card"
                  >
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
                      {IconComponent ? <IconComponent className="h-6 w-6" /> : null}
                    </div>
                    <div>
                      <p className="font-display text-base font-semibold">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.proCount.toLocaleString()} professional{c.proCount === 1 ? "" : "s"}
                      </p>
                      {c.jobCount > 0 ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {c.jobCount} open job{c.jobCount === 1 ? "" : "s"}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
                        Browse pros →
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="mt-10 text-center">
              <Search className="mx-auto h-8 w-8 text-muted-foreground" />
              <h3 className="mt-3 font-semibold">No categories match</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different search term or clear your filters.
              </p>
              <Button variant="outline" className="mt-4" onClick={clearAllFilters}>
                <X className="h-4 w-4" />
                Clear filters
              </Button>
            </div>
          )}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

function parseRating(label: string): number {
  if (label.startsWith("4.5")) return 4.5;
  if (label.startsWith("4.0")) return 4;
  if (label.startsWith("3.5")) return 3.5;
  return 0;
}

function FilterGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="mt-5 border-t border-border pt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="mt-3 space-y-2">
        {options.map((o) => (
          <label key={o} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(o)}
              onChange={() => onToggle(o)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            {o}
          </label>
        ))}
      </div>
    </div>
  );
}

export default ServicesPageContent;
