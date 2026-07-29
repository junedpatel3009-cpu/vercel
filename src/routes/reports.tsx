import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, CalendarDays, CircleDollarSign, Download, RefreshCw, ShieldCheck, Users } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ReportKind = "users" | "verifications" | "jobs" | "earnings";
type ReportData = {
  report: ReportKind;
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  summary: { total: number; verified?: number; pending?: number; amount?: number };
};

const REPORTS: Array<{ id: ReportKind; label: string; description: string; icon: typeof Users }> = [
  { id: "users", label: "Users", description: "All platform accounts", icon: Users },
  { id: "verifications", label: "Verifications", description: "Professional verification status", icon: ShieldCheck },
  { id: "jobs", label: "Jobs", description: "Posted jobs and their status", icon: BriefcaseBusiness },
  { id: "earnings", label: "Earnings", description: "Completed and pending payments", icon: CircleDollarSign },
];

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports - Servio" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const [report, setReport] = useState<ReportKind>("users");
  const [range, setRange] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const dateLabel = useMemo(() => {
    if (from || to) return "Custom date range";
    return range === "all" ? "All time" : `Last ${range} day${range === "1" ? "" : "s"}`;
  }, [from, range, to]);
  const reportColumns = data?.columns ?? [];
  const reportRows = data?.rows ?? [];
  const reportSummary = data?.summary ?? { total: 0 };

  function downloadCsv() {
    if (!reportColumns.length) return;
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [
      reportColumns.join(","),
      ...reportRows.map((row) => reportColumns.map((column) => escape(row[column])).join(",")),
    ].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `${report}-${range === "all" ? "all-time" : `${range}-days`}-report.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function downloadPdf() {
    const popup = window.open("", "_blank");
    if (!popup) {
      setError("Allow pop-ups to export this report as a PDF.");
      return;
    }
    const escape = (value: unknown) => String(value ?? "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
    const headers = reportColumns.map((column) => `<th>${escape(humanize(column))}</th>`).join("");
    const tableRows = reportRows.map((row) => `<tr>${reportColumns.map((column) => `<td>${escape(formatCell(row[column], column))}</td>`).join("")}</tr>`).join("");
    const documentUrl = URL.createObjectURL(
      new Blob(
        [`<!doctype html><html><head><title>${escape(report)} report</title><style>@page{size:landscape;margin:14mm}body{font:12px Arial;color:#172554}h1{margin:0}p{color:#475569}table{width:100%;border-collapse:collapse;margin-top:20px}th{background:#1d4ed8;color:#fff;text-align:left}th,td{border:1px solid #cbd5e1;padding:7px;vertical-align:top}tr:nth-child(even){background:#f8fafc}</style></head><body><h1>Servio ${escape(REPORTS.find((item) => item.id === report)?.label)} Report</h1><p>${escape(dateLabel)} · ${reportRows.length} records · Generated ${escape(new Date().toLocaleString())}</p><table><thead><tr>${headers}</tr></thead><tbody>${tableRows}</tbody></table></body></html>`],
        { type: "text/html" },
      ),
    );
    popup.location.href = documentUrl;
    window.setTimeout(() => {
      popup.focus();
      popup.print();
      URL.revokeObjectURL(documentUrl);
    }, 700);
  }

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ report, range });
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        const response = await fetch(`/api/v1/reports/overview?${params}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load this report.");
        // TanStack Start wraps API JSON in `data` for this server adapter.
        // Accept either shape so the table always receives the actual report.
        setData(result.data ?? result);
      } catch (cause) {
        if ((cause as Error).name !== "AbortError") setError((cause as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [report, range, from, to]);

  return (
    <AppShell title="Reports" userName="Admin" userRole="Admin">
      <main className="min-h-screen bg-slate-50 p-5 lg:p-8">
        <section className="mb-6 flex flex-col gap-4 rounded-2xl bg-slate-950 p-6 text-white shadow-sm md:flex-row md:items-center md:justify-between">
          <div><p className="text-sm font-medium text-sky-300">Platform reporting</p><h1 className="mt-1 text-3xl font-bold">Users, verification, jobs & earnings</h1><p className="mt-2 text-sm text-slate-300">Select a report and time period to see all matching records.</p></div>
          <Button variant="secondary" onClick={() => { setFrom(""); setTo(""); setRange("all"); }} className="gap-2"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Reset filters</Button>
        </section>

        <section className="mb-6 grid gap-3 md:grid-cols-4">
          {REPORTS.map(({ id, label, description, icon: Icon }) => <button key={id} type="button" onClick={() => setReport(id)} className={`rounded-xl border p-4 text-left transition ${report === id ? "border-sky-600 bg-sky-50 ring-1 ring-sky-600" : "border-slate-200 bg-white hover:border-slate-300"}`}><Icon className={`mb-3 h-5 w-5 ${report === id ? "text-sky-700" : "text-slate-500"}`} /><p className="font-semibold text-slate-900">{label}</p><p className="mt-1 text-xs text-slate-500">{description}</p></button>)}
        </section>

        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><p className="mb-2 text-sm font-semibold text-slate-800">Filter by days or date</p><div className="flex flex-wrap gap-2">{[["1", "Today"], ["7", "7 days"], ["30", "30 days"], ["90", "90 days"], ["all", "All time"]].map(([value, label]) => <Button key={value} type="button" size="sm" variant={!from && !to && range === value ? "default" : "outline"} onClick={() => { setFrom(""); setTo(""); setRange(value); }}>{label}</Button>)}</div></div><div className="flex flex-wrap items-end gap-3"><label className="text-xs font-medium text-slate-600">From<Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1" /></label><label className="text-xs font-medium text-slate-600">To<Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1" /></label><CalendarDays className="mb-2 h-5 w-5 text-slate-400" /></div></div>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <Metric label={`Total ${REPORTS.find((item) => item.id === report)?.label}`} value={reportSummary.total ?? 0} />
          <Metric label={report === "verifications" ? "Verified" : report === "earnings" ? "Total amount" : "Selected period"} value={report === "earnings" ? formatMoney(reportSummary.amount ?? 0) : reportSummary.verified ?? reportSummary.total ?? 0} />
          <Metric label={report === "verifications" ? "Pending verification" : "Date filter"} value={report === "verifications" ? reportSummary.pending ?? 0 : dateLabel} />
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="font-semibold text-slate-900">{REPORTS.find((item) => item.id === report)?.label} table</h2><p className="text-sm text-slate-500">{data?.total ?? 0} records matching {dateLabel.toLowerCase()}</p></div><div className="flex items-center gap-3"><Button size="sm" variant="outline" onClick={downloadPdf} disabled={!reportRows.length} className="gap-2"><Download className="h-4 w-4" />Download PDF</Button><Button size="sm" onClick={downloadCsv} disabled={!reportRows.length} className="gap-2"><Download className="h-4 w-4" />Download CSV</Button>{loading && <RefreshCw className="h-5 w-5 animate-spin text-sky-700" />}</div></div>{error ? <p className="p-6 text-sm text-red-700">{error}</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{reportColumns.map((column) => <th className="whitespace-nowrap px-5 py-3 font-semibold" key={column}>{humanize(column)}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{reportRows.map((row, index) => <tr key={`${String(row.id ?? index)}`} className="hover:bg-slate-50">{reportColumns.map((column) => <td className="max-w-72 px-5 py-3 text-slate-700" key={column}>{formatCell(row[column], column)}</td>)}</tr>)}{!loading && !reportRows.length && <tr><td className="px-5 py-12 text-center text-slate-500" colSpan={Math.max(reportColumns.length, 1)}>No records found for this period.</td></tr>}</tbody></table></div>}</section>
      </main>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{typeof value === "number" ? value.toLocaleString() : value}</p></div>; }
function humanize(value: string) { return value.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()); }
function formatMoney(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value); }
function formatCell(value: unknown, column: string) { if (value === null || value === undefined || value === "") return "—"; if (typeof value === "boolean") return value ? "Yes" : "No"; if (/amount|earnings|budget/i.test(column) && typeof value === "number") return formatMoney(value); if (/date|at$/i.test(column) && typeof value === "string") { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(); } return String(value); }
