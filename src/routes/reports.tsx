import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Table2,
  X,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/lib/current-user.server";

type TableInfo = {
  name: string;
  rows: number;
  primaryKey: string;
};
type ReportPreviewRow = Record<string, unknown>;

type ReportsLoaderData = {
  viewer: { id: number; role: string; firstName: string; lastName: string; email: string } | null;
};

const getReportsData = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = getCurrentUser();
  return { viewer } satisfies ReportsLoaderData;
});

export const Route = createFileRoute("/reports")({
  loader: () => getReportsData(),
  head: () => ({ meta: [{ title: "Reports - Servio" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const data = useLoaderData({ from: "/reports" }) as ReportsLoaderData;
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<ReportPreviewRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRows, setTotalRows] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [filterId, setFilterId] = useState("");
  const [filterPo, setFilterPo] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canLoad = Boolean(data.viewer && ["ADMIN", "PROFESSIONAL", "CLIENT"].includes(data.viewer.role));
  const displayName = `${data.viewer?.firstName || ""} ${data.viewer?.lastName || ""}`.trim() || data.viewer?.email || "User";
  const roleLabel = data.viewer?.role === "PROFESSIONAL" 
    ? "Professional" 
    : data.viewer?.role === "CLIENT" 
    ? "Client" 
    : "Admin";

  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));

  useEffect(() => {
    if (canLoad) {
      fetchTables();
    }
  }, [canLoad]);

  useEffect(() => {
    if (!selectedTable) return;
    const timer = setTimeout(() => {
      loadPreview(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [selectedTable, pageSize, from, to, search, filterId, filterPo]);

  async function fetchTables() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/reports/tables");
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      const tableList = (result?.tables || []).map((table: any) => ({
        name: table.name,
        rows: Number(table.rows ?? 0),
        primaryKey: table.primaryKey || "id",
      }));
      setTables(tableList);
      if (!selectedTable && tableList.length > 0) {
        setSelectedTable(tableList[0].name);
      }
    } catch (err: any) {
      setError(`Failed to fetch tables: ${err.message}`);
    } finally {
      setLoading(false);
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
            from,
            to,
            search,
            id: filterId ? Number(filterId) : undefined,
            po: filterPo || undefined
          },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      setColumns(result.columns || []);
      setRows(result.rows || []);
      setTotalRows(result.total || 0);
      setPage(result.page || pageNumber);
    } catch (err: any) {
      setError(`Failed to load preview: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function download(format: "PDF" | "CSV" | "JSON" | "EXCEL") {
    if (!selectedTable) return;
    setDownloading(format);
    setError(null);
    try {
      const res = await fetch("/api/v1/reports/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: selectedTable,
          format,
          filters: {
            from,
            to,
            search,
            id: filterId ? Number(filterId) : undefined,
            po: filterPo || undefined
          },
          reportName: `${selectedTable}-export`,
        }),
      });
      if (!res.ok) throw new Error(await res.text());

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const extension = format === "EXCEL" ? "xls" : format.toLowerCase();
      link.download = `${selectedTable}-export.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(`Download failed: ${err.message}`);
    } finally {
      setDownloading(null);
    }
  }

  if (!canLoad) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <div className="text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-slate-400" />
          <h1 className="mt-4 text-xl font-bold">Access Denied</h1>
          <Button asChild className="mt-4">
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AppShell title="Reports" userName={displayName} userRole={roleLabel}>
      <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Reports</h1>
            <p className="text-slate-500">View and export database records.</p>
          </div>
          <Button onClick={() => fetchTables()} variant="outline" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          {/* Filters */}
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Configuration</h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Select Table</label>
                  <select
                    value={selectedTable}
                    onChange={(e) => {
                      setSelectedTable(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Choose a table...</option>
                    {tables.map((table) => (
                      <option key={table.name} value={table.name}>
                        {table.name} ({table.rows})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">ID</label>
                    <Input
                      type="number"
                      placeholder="ID"
                      value={filterId}
                      onChange={(e) => setFilterId(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">PO</label>
                    <Input
                      placeholder="PO #"
                      value={filterPo}
                      onChange={(e) => setFilterPo(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      className="pl-9"
                      placeholder="Keyword..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">From</label>
                    <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">To</label>
                    <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                  </div>
                </div>

                <Button
                  variant="ghost"
                  className="w-full text-xs text-slate-500 hover:text-red-600"
                  onClick={() => {
                    setSearch("");
                    setFilterId("");
                    setFilterPo("");
                    setFrom("");
                    setTo("");
                  }}
                >
                  <X className="mr-2 h-3 w-3" />
                  Clear Filters
                </Button>
              </div>
            </div>

            {/* Export */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Export</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => download("PDF")} disabled={!selectedTable || !!downloading}>
                  <FileText className="mr-2 h-4 w-4 text-red-500" />
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => download("CSV")} disabled={!selectedTable || !!downloading}>
                  <FileSpreadsheet className="mr-2 h-4 w-4 text-green-500" />
                  CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => download("JSON")} disabled={!selectedTable || !!downloading}>
                  <FileJson className="mr-2 h-4 w-4 text-purple-500" />
                  JSON
                </Button>
              </div>
            </div>
          </div>

          {/* Table Preview */}
          <div className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {error}
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">
                    {selectedTable ? `Preview: ${selectedTable}` : "Select a table to preview"}
                  </h3>
                  <div className="text-xs text-slate-500">
                    {totalRows.toLocaleString()} total records
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[600px]">
                {loading && rows.length === 0 ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  </div>
                ) : rows.length > 0 ? (
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-slate-700">
                      <tr>
                        {columns.map((col) => (
                          <th key={col} className="whitespace-nowrap px-6 py-3 font-semibold border-b border-slate-200">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          {columns.map((col) => (
                            <td key={col} className="px-6 py-3 text-slate-600">
                              {row[col] === null ? "-" : String(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Table2 className="mb-2 h-12 w-12 opacity-20" />
                    <p>No records found.</p>
                  </div>
                )}
              </div>

              {pageCount > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3">
                  <span className="text-xs text-slate-500">
                    Page {page} of {pageCount}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1 || loading}
                      onClick={() => loadPreview(page - 1)}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= pageCount || loading}
                      onClick={() => loadPreview(page + 1)}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
