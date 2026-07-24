import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Building2,
  Clock3,
  Loader2,
  ReceiptText,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ReportExportActions } from "@/components/ReportExportActions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSummaryCard } from "@/components/admin/AdminSummaryCard";
import { AdminSection } from "@/components/admin/AdminSection";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { getCurrentUser } from "@/lib/current-user.server";
import { cn } from "@/lib/utils";

type AdminReportsData = {
  viewer: { id: number; firstName: string; lastName: string; email: string } | null;
};

type ReportTableOption = {
  name: string;
  rows: number;
  primaryKey: string;
};

type SummaryCardData = {
  title: string;
  value: number;
  subtitle: string;
  icon: string;
};

type SummaryPayload = {
  role: string;
  cards: SummaryCardData[];
  charts: Record<string, Array<{ name: string; value: number }>>;
  error?: string;
};

type ReportRow = Record<string, unknown>;

const getAdminReportsData = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = getCurrentUser();
  if (!viewer || viewer.role !== "ADMIN") {
    throw new Error("Not authorized");
  }
  return { viewer } satisfies AdminReportsData;
});

export const Route = createFileRoute("/admin-reports")({
  loader: () => getAdminReportsData(),
  head: () => ({ meta: [{ title: "Platform Reports - Servio" }] }),
  component: AdminReportsPage,
});

function AdminReportsPage() {
  const data = useLoaderData({ from: "/admin-reports" }) as AdminReportsData;
  const displayName =
    `${data.viewer?.firstName || ""} ${data.viewer?.lastName || ""}`.trim() ||
    data.viewer?.email ||
    "Admin";
  const [tables, setTables] = useState<Array<ReportTableOption & { label?: string }>>([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [rowLoading, setRowLoading] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRows, setTotalRows] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    search: "",
    status: "",
    category: "",
    userType: "",
    paymentStatus: "",
    jobStatus: "",
  });

  async function parseBackendJson<T>(response: Response): Promise<T> {
    const result = await response.json();
    return (result?.data ?? result) as T;
  }

  useEffect(() => {
    void loadTables();
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [filters.from, filters.to]);

  useEffect(() => {
    if (!selectedTable) return;
    const timer = window.setTimeout(() => {
      void loadRows(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [selectedTable, pageSize, filters.from, filters.to, filters.search, filters.status, filters.category, filters.userType, filters.paymentStatus, filters.jobStatus]);

  async function loadTables() {
    setTableLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/reports/tables");
      if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
      const result = await parseBackendJson<{ tables: ReportTableOption[]; status: string; error?: string }>(res);
      if (result?.status === "connected") {
        const nextTables = Array.isArray(result.tables) ? result.tables : [];
        setTables(nextTables);
        if (!selectedTable && nextTables[0]) {
          setSelectedTable(nextTables[0].name);
        }
      } else {
        setError(result?.error || "The reports database is currently unavailable.");
      }
    } catch (err: any) {
      setError(`Unable to load report tables: ${err.message}`);
    } finally {
      setTableLoading(false);
    }
  }

  async function loadSummary() {
    setSummaryLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      const res = await fetch(`/api/v1/reports/summary${params.toString() ? `?${params.toString()}` : ""}`);
      if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
      const result = await parseBackendJson<SummaryPayload>(res);
      setSummary(result);
    } catch (err: any) {
      setError((current) => current ?? `Unable to load summary cards: ${err.message}`);
    } finally {
      setSummaryLoading(false);
    }
  }

  async function loadRows(pageNumber = 1) {
    if (!selectedTable) return;
    setRowLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/reports/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: selectedTable,
          page: pageNumber,
          pageSize,
          filters: {
            from: filters.from,
            to: filters.to,
            search: filters.search,
            status: filters.status,
            category: filters.category,
            userType: filters.userType,
            paymentStatus: filters.paymentStatus,
            jobStatus: filters.jobStatus,
          },
        }),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
      const result = await parseBackendJson<{ columns: string[]; rows: ReportRow[]; total: number; page: number }>(res);
      setColumns(result.columns || []);
      setRows(result.rows || []);
      setTotalRows(result.total || 0);
      setPage(result.page || pageNumber);
    } catch (err: any) {
      setError(`Unable to load rows: ${err.message}`);
    } finally {
      setRowLoading(false);
    }
  }

  function printReport() {
    if (!selectedTable) return;
    const reportRows = sortedRows.map((row) => {
      return columns.map((column) => `${column}: ${String(row[column] ?? "")}`).join(" | ");
    });
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) return;
    printWindow.document.write(`<!doctype html><html><head><title>${selectedTable} report</title><style>body{font-family:Arial,sans-serif;padding:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;font-size:12px}th{background:#f8fafc}</style></head><body><h1>${selectedTable} report</h1><p>Generated on ${new Date().toLocaleString()}</p><table><thead><tr>${columns.map((column) => `<th>${column}</th>`).join("")}</tr></thead><tbody>${reportRows.map((row) => `<tr><td>${row.replace(/\|/g, "</td><td>")}</td></tr>`).join("")}</tbody></table></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const sortedRows = useMemo(() => {
    if (!sortColumn) return rows;
    const copy = [...rows];
    copy.sort((left, right) => {
      const a = left[sortColumn];
      const b = right[sortColumn];
      if (typeof a === "number" && typeof b === "number") {
        return sortDirection === "asc" ? a - b : b - a;
      }
      const leftValue = String(a ?? "");
      const rightValue = String(b ?? "");
      return sortDirection === "asc"
        ? leftValue.localeCompare(rightValue)
        : rightValue.localeCompare(leftValue);
    });
    return copy;
  }, [rows, sortColumn, sortDirection]);

  function toggleSort(column: string) {
    if (sortColumn === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortColumn(column);
    setSortDirection("asc");
  }

  function getIcon(iconName: string) {
    switch (iconName) {
      case "Users": return Users;
      case "Building2": return Building2;
      case "BriefcaseBusiness": return BriefcaseBusiness;
      case "ReceiptText": return ReceiptText;
      case "Wallet": return Wallet;
      case "Clock3": return Clock3;
      default: return TrendingUp;
    }
  }

  const userAvatarUrl = data.viewer?.email ? "https://i.pravatar.cc/100?u=" + data.viewer.email : undefined;

  return (
    <AppShell userName={displayName} userRole="Admin" userAvatarUrl={userAvatarUrl}>
      <AdminPageHeader
        title="Platform Data Reports"
        description="Visualize system metrics and extract detailed database records for analysis."
        breadcrumbs={[{ label: "System Reports" }]}
        actions={
          <Button asChild variant="outline">
            <Link to="/admin">Back to admin</Link>
          </Button>
        }
      />

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-bold flex items-center gap-2 animate-in fade-in duration-300">
          <ShieldCheck className="h-4 w-4" />
          {error}
        </div>
      )}

      {summaryLoading ? (
        <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 rounded-2xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : summary?.cards?.length ? (
        <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {summary.cards.map((card, index) => (
            <AdminSummaryCard
              key={`${card.title}-${index}`}
              icon={getIcon(card.icon)}
              label={card.title}
              value={card.value}
              caption={card.subtitle}
            />
          ))}
        </div>
      ) : null}

      <AdminSection
        title="Report Builder & Explorer"
        description="Choose a database table, apply filters, and generate custom exports."
        icon={ReceiptText}
        actions={
          <ReportExportActions
            table={selectedTable}
            reportName={`${selectedTable}-report`}
            filters={filters}
            onPrint={printReport}
          />
        }
      >
        <div className="p-6 bg-muted/20 border-b border-border">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Database Table</label>
              <select
                value={selectedTable}
                onChange={(event) => {
                  setSelectedTable(event.target.value);
                  setPage(1);
                }}
                className="w-full h-11 rounded-xl border border-border bg-background px-4 py-0 text-sm font-bold text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {tableLoading ? <option value="">Loading...</option> : null}
                {tables.map((table) => (
                  <option key={table.name} value={table.name}>
                    {table.label || table.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Quick Search</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filters.search}
                  onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                  placeholder="Filter records..."
                  className="h-11 pl-9 rounded-xl bg-background border-border shadow-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Date Range (Start)</label>
              <Input
                type="date"
                value={filters.from}
                onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
                className="h-11 rounded-xl bg-background border-border shadow-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">More Filters</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-11 w-full rounded-xl font-bold bg-background border-border shadow-sm">
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    Advanced Filters
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-6 rounded-2xl shadow-2xl border-border" align="end">
                  <div className="space-y-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Additional Query Filters</p>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</label>
                        <Input
                          value={filters.status}
                          onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                          placeholder="e.g. OPEN, DRAFT"
                          className="h-9 rounded-lg text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Category</label>
                        <Input
                          value={filters.category}
                          onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
                          placeholder="e.g. Design, Dev"
                          className="h-9 rounded-lg text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">User Type</label>
                        <Input
                          value={filters.userType}
                          onChange={(event) => setFilters((current) => ({ ...current, userType: event.target.value }))}
                          placeholder="CLIENT / PROFESSIONAL"
                          className="h-9 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                    <Button variant="secondary" className="w-full rounded-xl font-bold h-10 mt-2" onClick={() => setFilters({
                      from: filters.from,
                      to: filters.to,
                      search: filters.search,
                      status: "",
                      category: "",
                      userType: "",
                      paymentStatus: "",
                      jobStatus: "",
                    })}>
                      Clear All Extra Filters
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <div className="bg-background">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-muted/10 border-b border-border">
            <div>
              <p className="text-sm font-bold text-foreground flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                {selectedTable ? `Table: ${selectedTable}` : "Choose a table to begin"}
              </p>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">{totalRows.toLocaleString()} total records found</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={pageSize}
                onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}
                className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {[10, 25, 50, 100].map((size) => (<option key={size} value={size}>{size} per page</option>))}
              </select>
              <div className="flex gap-1">
                <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl font-bold" onClick={() => loadRows(Math.max(1, page - 1))} disabled={rowLoading || page <= 1}>Prev</Button>
                <div className="flex items-center justify-center px-4 bg-muted/30 rounded-xl text-xs font-bold tabular-nums">
                  {page} / {pageCount}
                </div>
                <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl font-bold" onClick={() => loadRows(Math.min(pageCount, page + 1))} disabled={rowLoading || page >= pageCount}>Next</Button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto min-h-[400px]">
            {rowLoading && rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-24">
                <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Fetching Dataset...</p>
              </div>
            ) : rows.length > 0 ? (
              <table className="w-full text-sm border-collapse">
                <thead className="bg-muted/50 text-left border-b border-border">
                  <tr>
                    {columns.map((column) => (
                      <th key={column} className="group cursor-pointer whitespace-nowrap px-6 py-4 font-bold text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:text-primary transition-colors" onClick={() => toggleSort(column)}>
                        <div className="flex items-center gap-2">
                          {column}
                          {sortColumn === column ? (
                            <TrendingUp className={cn("h-3 w-3 transition-transform", sortDirection === "desc" && "rotate-180")} />
                          ) : (
                            <TrendingUp className="h-3 w-3 opacity-0 group-hover:opacity-30 transition-opacity" />
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedRows.map((row, index) => (
                    <tr key={`${selectedTable}-${index}`} className="hover:bg-muted/30 transition-colors">
                      {columns.map((column) => (
                        <td key={`${column}-${index}`} className="max-w-[300px] truncate px-6 py-4 text-foreground font-medium">
                          {String(row[column] ?? "-")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <AdminEmptyState
                title="No report data available"
                description="No records matched your selection or filters. Try choosing a different table or clearing your search."
                icon={ShieldCheck}
              />
            )}
          </div>
        </div>
      </AdminSection>
    </AppShell>
  );
}
