import { useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Clock3,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
  Search,
  SlidersHorizontal,
  Table2,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ReportExportActions } from "@/components/ReportExportActions";

type ReportPreviewRow = Record<string, unknown>;

interface UserPersonalReportsProps {
  userRole: "PROFESSIONAL" | "CLIENT";
  userId: number;
  userName: string;
}

type ReportTableOption = {
  name: string;
  label: string;
  rows: number;
  primaryKey: string;
};

export function UserPersonalReports({ userRole, userId, userName }: UserPersonalReportsProps) {
  const [tables, setTables] = useState<ReportTableOption[]>([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<ReportPreviewRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    search: "",
    status: "",
    category: "",
  });

  const [summary, setSummary] = useState<{
    cards?: Array<{ title: string; value: number; subtitle: string; icon: string }>;
    charts?: Record<string, Array<{ name: string; value: number }>>;
  } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));

  useEffect(() => {
    void loadTables();
  }, []);

  useEffect(() => {
    if (!selectedTable) return;
    const timer = setTimeout(() => {
      loadPreview(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedTable, pageSize, filters.from, filters.to, filters.search, filters.status, filters.category]);

  useEffect(() => {
    void loadSummary();
  }, [userRole, filters.from, filters.to]);

  async function parseBackendJson<T>(response: Response): Promise<T> {
    const result = await response.json();
    return (result?.data ?? result) as T;
  }

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
      const result = await parseBackendJson<{ cards?: Array<{ title: string; value: number; subtitle: string; icon: string }>; charts?: Record<string, Array<{ name: string; value: number }>> }>(res);
      setSummary(result);
    } catch (err: any) {
      console.error("Failed to load summary:", err);
      setError((current) => current ?? `Failed to load summary: ${err.message}`);
    } finally {
      setSummaryLoading(false);
    }
  }

  async function loadPreview(pageNumber = 1) {
    if (!selectedTable) return;
    setLoading(true);
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
          },
        }),
      });
      if (!res.ok) {
        throw new Error(await res.text().catch(() => res.statusText));
      }
      const result = await parseBackendJson<{ columns: string[]; rows: ReportPreviewRow[]; total: number; page: number }>(res);
      setColumns(result.columns || []);
      setRows(result.rows || []);
      setTotalRows(result.total || 0);
      setPage(result.page || pageNumber);
    } catch (err: any) {
      console.error("Failed to load preview:", err);
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function printReport() {
    if (!selectedTable) return;
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) return;

    const reportRows = sortedRows.length
      ? sortedRows
          .map((row) => `<tr>${columns.map((column) => `<td>${String(row[column] ?? "-")}</td>`).join("")}</tr>`)
          .join("")
      : `<tr><td colspan="${columns.length || 1}">No records to display.</td></tr>`;

    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${selectedTable} report</title><style>body{font-family:Arial,sans-serif;padding:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d1d5db;padding:8px;font-size:12px}th{background:#f3f4f6}</style></head><body><h1>${selectedTable} report</h1><p>Generated on ${new Date().toLocaleString()}</p><table><thead><tr>${columns.map((column) => `<th>${column}</th>`).join("")}</tr></thead><tbody>${reportRows}</tbody></table></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  const lineData = useMemo(
    () => (summary?.charts?.monthlyEarnings ?? summary?.charts?.monthlySpending ?? summary?.charts?.monthlyUsers ?? []).map((item) => ({ name: item.name, value: item.value })),
    [summary],
  );
  const pieData = useMemo(
    () => (summary?.charts?.applicationsByStatus ?? summary?.charts?.jobsByStatus ?? []).map((item) => ({ name: item.name, value: item.value })),
    [summary],
  );

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

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-medium">{error}</p>
        </div>
      )}

      {summaryLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
              <div className="mt-3 h-7 w-24 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : summary?.cards?.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summary.cards.map((card, index) => (
            <div key={`${card.title}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">{card.title}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value.toLocaleString()}</p>
                </div>
                <div className="rounded-full bg-slate-100 p-2 text-slate-700">
                  {card.icon === "DollarSign" ? <DollarSign className="h-4 w-4" /> : card.icon === "BriefcaseBusiness" ? <BriefcaseBusiness className="h-4 w-4" /> : card.icon === "Clock3" ? <Clock3 className="h-4 w-4" /> : card.icon === "Users" ? <Users className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-500">{card.subtitle}</p>
            </div>
          ))}
        </div>
      ) : null}

      {(lineData.length > 0 || pieData.length > 0) ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {lineData.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <p className="text-sm font-semibold text-slate-900">Trend overview</p>
                <p className="text-sm text-slate-500">Performance over time</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineData}>
                    <CartesianGrid vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}
          {pieData.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <p className="text-sm font-semibold text-slate-900">Distribution</p>
                <p className="text-sm text-slate-500">Current status mix</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip />
                    <Legend />
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2}>
                      {pieData.map((entry, index) => (
                        <Cell key={`${entry.name}-${index}`} fill={index % 2 === 0 ? "#2563eb" : "#22c55e"} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}


        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Report builder</p>
              <p className="text-xs text-slate-500">Choose a category, apply filters, and export.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ReportExportActions
                table={selectedTable}
                reportName={`${selectedTable}-report`}
                filters={{
                  from: filters.from,
                  to: filters.to,
                  search: filters.search,
                  status: filters.status,
                  category: filters.category,
                }}
                onPrint={printReport}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Category</label>
                <select
                  value={selectedTable}
                  onChange={(event) => {
                    setSelectedTable(event.target.value);
                    setPage(1);
                  }}
                  className="w-full h-8 rounded-md border border-slate-300 bg-white px-2 py-0 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {tableLoading ? <option value="">Loading...</option> : null}
                  {tables.map((table) => (
                    <option key={table.name} value={table.name}>
                      {table.label || table.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Search</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={filters.search}
                    onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                    placeholder="Search..."
                    className="h-8 pl-8 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Date From</label>
                <Input
                  type="date"
                  value={filters.from}
                  onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
                  className="h-8 text-sm px-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Date To</label>
                <Input
                  type="date"
                  value={filters.to}
                  onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
                  className="h-8 text-sm px-2"
                />
              </div>

              <div className="lg:col-start-4 flex justify-end items-end">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 w-full lg:w-auto">
                      <SlidersHorizontal className="mr-2 h-3.5 w-3.5" />
                      More Filters
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-4" align="end">
                    <div className="grid gap-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Additional Filters</p>
                      <div className="grid gap-2">
                        <div>
                          <label className="mb-1 block text-[10px] font-semibold text-slate-500">Status</label>
                          <Input
                            value={filters.status}
                            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                            placeholder="OPEN, COMPLETED..."
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-semibold text-slate-500">Extra Category</label>
                          <Input
                            value={filters.category}
                            onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
                            placeholder="Category"
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      <Button variant="secondary" size="sm" className="mt-1" onClick={() => setFilters({
                        from: filters.from,
                        to: filters.to,
                        search: filters.search,
                        status: "",
                        category: "",
                      })}>
                        Clear Extra Filters
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{tables.find(t => t.name === selectedTable)?.label || selectedTable || "No category selected"}</p>
                <p className="text-sm text-slate-500">{totalRows} rows • Page {page} of {pageCount}</p>
              </div>
              <div className="flex items-center gap-2">
                <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700">
                  {[10, 25, 50].map((size) => (<option key={size} value={size}>{size}/page</option>))}
                </select>
                <Button type="button" variant="outline" size="sm" onClick={() => loadPreview(Math.max(1, page - 1))} disabled={loading || page <= 1}>Prev</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => loadPreview(Math.min(pageCount, page + 1))} disabled={loading || page >= pageCount}>Next</Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              {loading && rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-sm text-slate-500">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  Loading data...
                </div>
              ) : rows.length > 0 ? (
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-700">
                    <tr>
                      {columns.map((column) => (
                        <th key={column} className="cursor-pointer whitespace-nowrap border-b border-slate-200 px-4 py-3 font-semibold" onClick={() => toggleSort(column)}>
                          <div className="flex items-center gap-1">
                            {column}
                            {sortColumn === column ? <TrendingUp className={`h-3.5 w-3.5 ${sortDirection === "desc" ? "rotate-180" : ""}`} /> : null}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row, index) => (
                      <tr key={`${selectedTable}-${index}`} className="border-b border-slate-100 bg-white hover:bg-slate-50">
                        {columns.map((column) => (
                          <td key={`${column}-${index}`} className="max-w-[220px] truncate px-4 py-3 text-slate-700">
                            {String(row[column] ?? "-")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-sm text-slate-500">
                  <Table2 className="h-8 w-8 text-slate-300" />
                  <p>No records matched the current filters.</p>
                </div>
              )}
            </div>
          </div>
        </div>
    </div>
  );
}
