import { createServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Loader2,
  Search,
  Command,
  User,
  BriefcaseBusiness,
  AlertTriangle,
  ReceiptText,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  adminGlobalSearch,
  type GlobalSearchResultItem,
  type GlobalSearchResult,
} from "@/lib/admin-global-search.server";

const performSearch = createServerFn({ method: "GET" })
  .inputValidator((input: { query: string }) => input)
  .handler(async ({ data }) => {
    return adminGlobalSearch(data.query);
  });

const groupIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Users: User,
  Jobs: BriefcaseBusiness,
  Disputes: AlertTriangle,
  Payments: ReceiptText,
};

const groupColors: Record<string, string> = {
  Users: "bg-blue-500/10 text-blue-600",
  Jobs: "bg-emerald-500/10 text-emerald-600",
  Disputes: "bg-amber-500/10 text-amber-600",
  Payments: "bg-violet-500/10 text-violet-600",
};

export function GlobalSearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(null);
      setSelectedIndex(0);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const term = query.trim();
    if (!term) {
      setResults(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    debounceRef.current = setTimeout(async () => {
      try {
        const result = await performSearch({ data: { query: term } });
        setResults(result);
        setSelectedIndex(0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const allItems = results?.results ?? [];
  const groupedResults = allItems.reduce(
    (acc, item) => {
      if (!acc[item.group]) acc[item.group] = [];
      acc[item.group].push(item);
      return acc;
    },
    {} as Record<string, GlobalSearchResultItem[]>,
  );

  const handleSelect = useCallback(
    (item: GlobalSearchResultItem) => {
      onClose();
      if (item.route) {
        navigate({ to: item.route as any });
      }
    },
    [navigate, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, allItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && allItems[selectedIndex]) {
        e.preventDefault();
        handleSelect(allItems[selectedIndex]);
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [allItems, selectedIndex, handleSelect, onClose],
  );

  useEffect(() => {
    if (!open) return;

    const handleKeyDownGlobal = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDownGlobal);
    return () => window.removeEventListener("keydown", handleKeyDownGlobal);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        tabIndex={-1}
      />

      <div
        className="relative z-10 w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users, jobs, disputes, payments..."
            className="border-none bg-transparent px-0 text-base shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <kbd className="hidden shrink-0 items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground sm:inline-flex">
            <Command className="h-3 w-3" />K
          </kbd>
          <button
            onClick={onClose}
            className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
          >
            ESC
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </div>
          )}

          {error && <div className="py-8 text-center text-sm text-destructive">{error}</div>}

          {!loading && !error && query.trim() && !allItems.length && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No results found for <span className="font-medium text-foreground">"{query}"</span>
            </div>
          )}

          {!loading && !error && Object.keys(groupedResults).length > 0 && (
            <div className="space-y-3">
              {Object.entries(groupedResults).map(([group, items]) => {
                const GroupIcon = groupIcons[group] || Search;

                return (
                  <div key={group}>
                    <div className="flex items-center gap-2 px-3 py-2">
                      <div className={`rounded-md p-1 ${groupColors[group] || "bg-muted"}`}>
                        <GroupIcon className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {group}
                      </span>
                      <span className="text-xs text-muted-foreground">({items.length})</span>
                    </div>

                    <div className="space-y-0.5">
                      {items.map((item) => {
                        const globalIndex = allItems.indexOf(item);
                        const isSelected = globalIndex === selectedIndex;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelect(item)}
                            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                              isSelected
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-muted/60 text-foreground"
                            }`}
                          >
                            {item.avatarUrl ? (
                              <img
                                src={item.avatarUrl}
                                alt=""
                                className="h-8 w-8 shrink-0 rounded-full object-cover"
                              />
                            ) : (
                              <div
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                                  groupColors[item.group] || "bg-muted"
                                }`}
                              >
                                {item.label.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{item.label}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {item.subtitle}
                              </p>
                            </div>
                            {item.badge && (
                              <span className="shrink-0 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
                                {item.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && !error && !query.trim() && (
            <div className="space-y-3 px-3 py-6">
              <div className="text-center">
                <Search className="mx-auto h-8 w-8 text-muted-foreground/40" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Type anything to search across the admin panel
                </p>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {[
                  { label: "Search users", desc: "Name, email, phone, company" },
                  { label: "Search jobs", desc: "Title, description, category, client" },
                  { label: "Search disputes", desc: "Issue, message, status" },
                  { label: "Search payments", desc: "Transaction, type, client, pro" },
                ].map((hint) => (
                  <div
                    key={hint.label}
                    className="rounded-lg border border-border bg-muted/30 p-3 text-left text-sm"
                  >
                    <p className="font-medium text-foreground">{hint.label}</p>
                    <p className="text-xs text-muted-foreground">{hint.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {allItems.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
            <span>
              {results?.totalCount ?? 0} result{(results?.totalCount ?? 0) !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-3">
              <span>
                <kbd className="mr-1 rounded border border-border bg-muted/50 px-1.5 py-0.5">
                  ↑↓
                </kbd>
                Navigate
              </span>
              <span>
                <kbd className="mr-1 rounded border border-border bg-muted/50 px-1.5 py-0.5">↵</kbd>
                Open
              </span>
              <span>
                <kbd className="mr-1 rounded border border-border bg-muted/50 px-1.5 py-0.5">
                  Esc
                </kbd>
                Close
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
