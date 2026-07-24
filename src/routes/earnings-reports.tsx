import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, Link, useLoaderData, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownToLine,
  BadgeDollarSign,
  CalendarRange,
  CheckCircle2,
  CircleDollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  Landmark,
  Loader2,
  Percent,
  Printer,
  ReceiptText,
  Search,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSummaryCard } from "@/components/admin/AdminSummaryCard";
import { AdminSection } from "@/components/admin/AdminSection";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import {
  formatDate,
  formatDateTime,
  formatEnum,
  formatMoney,
} from "@/lib/admin-formatters";
import { getCurrentUser } from "@/lib/current-user.server";
import {
  getAdminEarningsReport,
  updateAdminPayoutStatus,
  type AdminEarningsReport,
  type AdminEarningsTransactionRecord,
  type AdminPayoutRecord,
  type AdminProfessionalEarningsSummary,
} from "@/lib/admin-dashboard-db.server";
import { cn } from "@/lib/utils";

type PayoutStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "REJECTED";
type ReportPeriod = "ALL" | "30_DAYS" | "90_DAYS" | "THIS_YEAR";

const getEarningsReportsData = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = getCurrentUser();

  if (!viewer || viewer.role !== "ADMIN") {
    return {
      viewer,
      report: null,
    };
  }

  return {
    viewer,
    report: getAdminEarningsReport(),
  };
});

const updatePayoutReviewStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { payoutId: number; status: PayoutStatus }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "ADMIN") {
      throw new Error("Only admins can update payout status.");
    }

    return updateAdminPayoutStatus(data.payoutId, data.status);
  });

export const Route = createFileRoute("/earnings-reports")({
  loader: () => getEarningsReportsData(),
  head: () => ({ meta: [{ title: "Earnings, Commission \u0026 Payout Reports - Servio" }] }),
  component: EarningsReports,
});

function EarningsReports() {
  const data = useLoaderData({ from: "/earnings-reports" });
  const router = useRouter();
  const [transactionQuery, setTransactionQuery] = useState("");
  const [payoutQuery, setPayoutQuery] = useState("");
  const [professionalQuery, setProfessionalQuery] = useState("");
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("ALL");
  const [transactionStatus, setTransactionStatus] = useState("ALL");
  const [payoutStatus, setPayoutStatus] = useState("ALL");
  const [pendingPayoutId, setPendingPayoutId] = useState<number | null>(null);
  const [summaryResult, setSummaryResult] = useState<
    "transactions" | "payouts" | "balances" | null
  >(null);

  if (!data.viewer || data.viewer.role !== "ADMIN" || !data.report) {
    return (
      <div className="grid min-h-screen place-items-center bg-muted/30 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
          <ShieldCheck className="h-8 w-8 text-primary mx-auto" />
          <h1 className="mt-6 text-xl font-bold">Admin access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in from the admin panel to view earnings and payout reports.
          </p>
          <Button asChild className="mt-8 w-full">
            <Link to="/admin">Open admin panel</Link>
          </Button>
        </div>
      </div>
    );
  }

  const report = data.report as AdminEarningsReport;
  const visibleTransactions = useMemo(
    () =>
      filterTransactions(report.transactions, transactionQuery, reportPeriod, transactionStatus),
    [report.transactions, transactionQuery, reportPeriod, transactionStatus],
  );
  const visiblePayouts = useMemo(
    () => filterPayouts(report.payouts, payoutQuery, reportPeriod, payoutStatus),
    [report.payouts, payoutQuery, reportPeriod, payoutStatus],
  );
  const visibleProfessionals = useMemo(
    () => filterProfessionals(report.professionals, professionalQuery),
    [report.professionals, professionalQuery],
  );
  const displayName =
    `${data.viewer.firstName} ${data.viewer.lastName}`.trim() || data.viewer.email;
  const [downloading, setDownloading] = useState<string | null>(null);

  async function handlePayoutStatus(payout: AdminPayoutRecord, status: PayoutStatus) {
    setPendingPayoutId(payout.id);

    try {
      await updatePayoutReviewStatus({ data: { payoutId: payout.id, status } });
      await router.invalidate();
    } finally {
      setPendingPayoutId(null);
    }
  }

  async function exportReport(table: string, format: "CSV" | "EXCEL" | "PDF") {
    setDownloading(format);
    try {
      const res = await fetch("/api/v1/reports/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table,
          format,
          reportName: `Admin-${table}-report`,
          filters: {},
        }),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${table}-${format.toLowerCase()}.${format.toLowerCase() === "pdf" ? "pdf" : format.toLowerCase() === "csv" ? "csv" : "xlsx"}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setDownloading(null);
    }
  }

  function printReport(title: string, columns: string[], dataRows: any[]) {
    const reportRows = dataRows.map((row) => {
      return columns.map((column) => `${column}: ${String(row[column] ?? "")}`).join(" | ");
    });
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) return;
    printWindow.document.write(`<!doctype html><html><head><title>${title}</title><style>body{font-family:Arial,sans-serif;padding:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;font-size:12px}th{background:#f8fafc}</style></head><body><h1>${title}</h1><p>Generated on ${new Date().toLocaleString()}</p><table><thead><tr>${columns.map((column) => `<th>${column}</th>`).join("")}</tr></thead><tbody>${reportRows.map((row) => `<tr><td>${row.replace(/\|/g, "</td><td>")}</td></tr>`).join("")}</tbody></table></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <AppShell userName={displayName} userRole="Admin" userAvatarUrl={data.viewer.avatarUrl}>
      <AdminPageHeader
        title="Earnings \u0026 Payouts"
        description="Comprehensive report of gross platform earnings, commission share, and professional payouts."
        breadcrumbs={[{ label: "Earnings Reports" }]}
        actions={
          <Button asChild variant="outline">
            <Link to="/admin">Back to admin</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <AdminSummaryCard
          icon={CircleDollarSign}
          label="Gross Earnings"
          value={formatMoney(report.totals.grossEarnings)}
          caption={`${report.totals.transactionCount} total records`}
          active={summaryResult === "transactions"}
          onClick={() => setSummaryResult("transactions")}
        />
        <AdminSummaryCard
          icon={Percent}
          label="Commission"
          value={formatMoney(report.totals.commissionAmount)}
          caption={`${Math.round(report.commissionRate * 100)}% share`}
          variant="primary"
          active={summaryResult === "transactions"}
          onClick={() => setSummaryResult("transactions")}
        />
        <AdminSummaryCard
          icon={Wallet}
          label="Net Payable"
          value={formatMoney(report.totals.netEarnings)}
          caption="Professional earnings"
          variant="success"
          active={summaryResult === "transactions"}
          onClick={() => setSummaryResult("transactions")}
        />
        <AdminSummaryCard
          icon={ArrowDownToLine}
          label="Requested Payouts"
          value={formatMoney(report.totals.requestedPayouts)}
          caption={`${report.totals.payoutCount} payout requests`}
          variant="warning"
          active={summaryResult === "payouts"}
          onClick={() => setSummaryResult("payouts")}
        />
        <AdminSummaryCard
          icon={BadgeDollarSign}
          label="Available Balance"
          value={formatMoney(report.totals.availableBalance)}
          caption="Unclaimed net total"
          active={summaryResult === "balances"}
          onClick={() => setSummaryResult("balances")}
        />
      </div>

      {summaryResult && (
        <div className="mt-6 flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 px-6 py-4 text-sm shadow-sm animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="font-bold text-primary">
              FILTER ACTIVE:{" "}
              <span className="uppercase text-primary/70">
                {summaryResult === "balances" ? "Professional Balances" : summaryResult}
              </span>
            </span>
          </div>
          <Button type="button" size="sm" variant="outline" className="rounded-xl font-bold uppercase tracking-widest text-[10px]" onClick={() => setSummaryResult(null)}>
            Show All Data
          </Button>
        </div>
      )}

      <div className="mt-8 space-y-8">
        <AdminSection
          title="Reporting Options"
          description="Narrow transactions and payouts without changing lifetime totals."
          icon={CalendarRange}
          className="bg-gradient-to-br from-blue-50/50 to-white"
          actions={
            <Button type="button" variant="outline" size="sm" className="rounded-lg h-9 font-bold text-[10px] uppercase tracking-widest" onClick={() => {
              setReportPeriod("ALL");
              setTransactionStatus("ALL");
              setPayoutStatus("ALL");
              setTransactionQuery("");
              setPayoutQuery("");
              setProfessionalQuery("");
            }}>
              Reset All Filters
            </Button>
          }
        >
          <div className="p-6 grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Period</label>
              <Select value={reportPeriod} onValueChange={(value) => setReportPeriod(value as ReportPeriod)}>
                <SelectTrigger className="rounded-xl h-11 bg-background border-border shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Time</SelectItem>
                  <SelectItem value="30_DAYS">Last 30 Days</SelectItem>
                  <SelectItem value="90_DAYS">Last 90 Days</SelectItem>
                  <SelectItem value="THIS_YEAR">This Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Transactions</label>
              <Select value={transactionStatus} onValueChange={setTransactionStatus}>
                <SelectTrigger className="rounded-xl h-11 bg-background border-border shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Payouts</label>
              <Select value={payoutStatus} onValueChange={setPayoutStatus}>
                <SelectTrigger className="rounded-xl h-11 bg-background border-border shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="PROCESSING">Processing</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </AdminSection>

        <FinanceOverview report={report} />

        {(!summaryResult || summaryResult === "balances") && (
          <ProfessionalSummarySection
            professionals={visibleProfessionals}
            query={professionalQuery}
            onQueryChange={setProfessionalQuery}
          />
        )}

        {(!summaryResult || summaryResult === "payouts") && (
          <AdminSection
            title="Payout Requests"
            description="Manage withdrawal requests from professional bank, UPI, and wallets."
            icon={ArrowDownToLine}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={payoutQuery}
                    onChange={(event) => setPayoutQuery(event.target.value)}
                    placeholder="Search payouts..."
                    className="pl-9 h-10 rounded-xl"
                  />
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-10 rounded-xl" onClick={() => exportReport("ProjectWithdrawal", "CSV")} disabled={!!downloading}>
                    {downloading === "CSV" ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileSpreadsheet className="h-3 w-3" />}
                    CSV
                  </Button>
                  <Button size="sm" variant="outline" className="h-10 rounded-xl" onClick={() => printReport("Payout Reports", ["professionalName", "amount", "status", "destinationType", "destinationLabel", "createdAt"], visiblePayouts)}>
                    <Printer className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            }
          >
            <PayoutList
              payouts={visiblePayouts}
              pendingPayoutId={pendingPayoutId}
              onStatusChange={handlePayoutStatus}
            />
          </AdminSection>
        )}

        {(!summaryResult || summaryResult === "transactions") && (
          <AdminSection
            title="Transaction History"
            description="Detailed log of all platform project payments and commissions."
            icon={ReceiptText}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={transactionQuery}
                    onChange={(event) => setTransactionQuery(event.target.value)}
                    placeholder="Search transactions..."
                    className="pl-9 h-10 rounded-xl"
                  />
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-10 rounded-xl" onClick={() => exportReport("ProjectTransaction", "EXCEL")} disabled={!!downloading}>
                    {downloading === "EXCEL" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                    Excel
                  </Button>
                  <Button size="sm" variant="outline" className="h-10 rounded-xl" onClick={() => printReport("Transaction Reports", ["jobTitle", "amount", "commissionAmount", "netPayoutAmount", "status", "dateTime"], visibleTransactions)}>
                    <Printer className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            }
          >
            <TransactionList transactions={visibleTransactions} />
          </AdminSection>
        )}
      </div>
    </AppShell>
  );
}

function FinanceOverview({ report }: { report: AdminEarningsReport }) {
  const payoutLiability = report.totals.availableBalance + report.totals.pendingPayouts;
  const reconciledNet =
    report.totals.paidPayouts + report.totals.pendingPayouts + report.totals.availableBalance;
  const reconciliationDifference = Math.abs(report.totals.netEarnings - reconciledNet);
  const isBalanced = reconciliationDifference < 0.01;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-3xl border border-indigo-200 bg-indigo-50/20 p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-indigo-900">Payout Pipeline</h2>
            <p className="text-sm text-indigo-700 font-medium">Platform fund movement distribution.</p>
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-100 text-indigo-700 shadow-inner">
            <Landmark className="h-6 w-6" />
          </div>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <PipelineMetric label="Paid Out" value={report.totals.paidPayouts} variant="success" />
          <PipelineMetric label="Pending Review" value={report.totals.pendingPayouts} variant="warning" />
          <PipelineMetric label="Processing" value={report.totals.processingPayouts} variant="primary" />
          <PipelineMetric label="Rejected" value={report.totals.rejectedPayouts} variant="destructive" />
        </div>
        <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl bg-white/80 p-5 shadow-sm border border-indigo-100">
          <span className="text-sm font-bold text-indigo-900 uppercase tracking-widest">Total Outstanding Liability</span>
          <span className="text-2xl font-bold text-indigo-950 tabular-nums">{formatMoney(payoutLiability)}</span>
        </div>
      </div>

      <div className={cn(
        "rounded-3xl border p-8 shadow-sm flex flex-col",
        isBalanced ? "border-emerald-200 bg-emerald-50/20" : "border-rose-200 bg-rose-50/20"
      )}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className={cn("text-xl font-bold", isBalanced ? "text-emerald-900" : "text-rose-900")}>Finance Reconciliation</h2>
            <p className={cn("text-sm font-medium", isBalanced ? "text-emerald-700" : "text-rose-700")}>
              Auditing net earnings against tracked funds.
            </p>
          </div>
          {isBalanced ? (
            <div className="h-12 w-12 rounded-2xl bg-emerald-100 grid place-items-center text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          ) : (
            <div className="h-12 w-12 rounded-2xl bg-rose-100 grid place-items-center text-rose-600 animate-pulse">
              <AlertCircle className="h-6 w-6" />
            </div>
          )}
        </div>
        <div className="mt-8 space-y-4 flex-1">
          <ReconciliationRow label="Net Platform Earnings" value={report.totals.netEarnings} variant={isBalanced ? "emerald" : "rose"} />
          <ReconciliationRow label="Total Reconciled Funds" value={reconciledNet} variant={isBalanced ? "emerald" : "rose"} />
          <div className="h-px bg-current opacity-10 mx-2" />
          <ReconciliationRow label="Reconciliation Difference" value={reconciliationDifference} strong variant={isBalanced ? "emerald" : "rose"} />
        </div>
        <div className={cn(
          "mt-6 rounded-xl py-2 px-4 text-center font-bold uppercase tracking-[0.2em] text-[10px]",
          isBalanced ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
        )}>
          {isBalanced ? "SYSTEM BALANCED" : "REVIEW REQUIRED \u2014 DATA MISMATCH"}
        </div>
      </div>
    </div>
  );
}

function PipelineMetric({ label, value, variant }: { label: string; value: number, variant: "success" | "warning" | "primary" | "destructive" }) {
  const styles = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    primary: "border-blue-200 bg-blue-50 text-blue-700",
    destructive: "border-rose-200 bg-rose-50 text-rose-700",
  };
  return (
    <div className={cn("rounded-2xl border p-4 shadow-sm bg-white hover:scale-[1.02] transition-transform", styles[variant])}>
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">{label}</p>
      <p className="mt-2 text-xl font-bold tabular-nums">{formatMoney(value)}</p>
    </div>
  );
}

function ReconciliationRow({
  label,
  value,
  strong,
  variant,
}: {
  label: string;
  value: number;
  strong?: boolean;
  variant: "emerald" | "rose";
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm px-2">
      <span className={cn("font-medium", variant === "emerald" ? "text-emerald-700" : "text-rose-700")}>{label}</span>
      <span className={cn(
        "font-bold tabular-nums",
        strong ? (variant === "emerald" ? "text-emerald-900 text-lg" : "text-rose-900 text-lg") : (variant === "emerald" ? "text-emerald-800" : "text-rose-800")
      )}>{formatMoney(value)}</span>
    </div>
  );
}

function ProfessionalSummarySection({
  professionals,
  query,
  onQueryChange,
}: {
  professionals: AdminProfessionalEarningsSummary[];
  query: string;
  onQueryChange: (value: string) => void;
}) {
  const totals = professionals.reduce(
    (acc, p) => {
      acc.gross += Number(p.grossEarnings || 0);
      acc.commission += Number(p.commissionAmount || 0);
      acc.net += Number(p.netEarnings || 0);
      acc.requested += Number(p.requestedPayouts || 0);
      acc.paid += Number(p.paidPayouts || 0);
      acc.available += Number(p.availableBalance || 0);
      return acc;
    },
    { gross: 0, commission: 0, net: 0, requested: 0, paid: 0, available: 0 },
  );

  return (
    <AdminSection
      title="Professional Ledger Balances"
      description="Track earnings, commission deductions, and payable balances per provider."
      icon={UserRound}
      actions={
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search providers..."
            className="pl-9 h-10 rounded-xl"
          />
        </div>
      }
    >
      <div className="divide-y divide-border">
        {professionals.length ? (
          professionals.map((p) => (
            <div key={p.professionalId} className="group p-6 hover:bg-muted/30 transition-colors">
              <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
                <div>
                  <h4 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">{p.professionalName}</h4>
                  <p className="text-sm text-muted-foreground font-medium">{p.professionalEmail}</p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <Badge variant="outline" className="rounded-lg h-7 font-bold uppercase tracking-widest text-[9px]">
                    {p.transactionCount} Trans.
                  </Badge>
                  <Badge variant="outline" className="rounded-lg h-7 font-bold uppercase tracking-widest text-[9px]">
                    {p.payoutCount} Payouts
                  </Badge>
                  {(p.pendingPayouts > 0 || p.availableBalance > 0) && (
                    <Badge variant="secondary" className="rounded-lg h-7 font-bold uppercase tracking-widest text-[9px] bg-amber-50 text-amber-700 border-amber-200">
                      Action Required
                    </Badge>
                  )}
                </div>
              </div>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                <BalanceBox label="Gross" value={p.grossEarnings} />
                <BalanceBox label="Comm." value={p.commissionAmount} negative />
                <BalanceBox label="Net" value={p.netEarnings} strong />
                <BalanceBox label="Req." value={p.requestedPayouts} />
                <BalanceBox label="Paid" value={p.paidPayouts} />
                <BalanceBox label="Avail." value={p.availableBalance} variant="success" />
              </div>
            </div>
          ))
        ) : (
          <AdminEmptyState
            title="No provider ledger records"
            description="Professional financial summaries will appear here as transactions complete."
          />
        )}
        {professionals.length > 0 && (
          <div className="bg-muted/40 p-8">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Total Aggregate Balance</h4>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              <BalanceBox label="Total Gross" value={totals.gross} size="lg" />
              <BalanceBox label="Total Comm." value={totals.commission} negative size="lg" />
              <BalanceBox label="Total Net" value={totals.net} strong size="lg" />
              <BalanceBox label="Total Req." value={totals.requested} size="lg" />
              <BalanceBox label="Total Paid" value={totals.paid} size="lg" />
              <BalanceBox label="Total Avail." value={totals.available} variant="success" size="lg" />
            </div>
          </div>
        )}
      </div>
    </AdminSection>
  );
}

function BalanceBox({ label, value, negative, strong, variant = "default", size = "md" }: { label: string, value: number, negative?: boolean, strong?: boolean, variant?: "default" | "success", size?: "md" | "lg" }) {
  return (
    <div className={cn(
      "rounded-2xl border p-4 shadow-sm bg-background transition-all",
      variant === "success" ? "border-emerald-200 bg-emerald-50/50" : "border-border",
      size === "lg" ? "p-5 border-2" : ""
    )}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn(
        "mt-1 font-bold tabular-nums tracking-tight",
        size === "lg" ? "text-2xl" : "text-lg",
        negative ? "text-rose-600" : (variant === "success" ? "text-emerald-700" : "text-foreground"),
        strong && !negative && variant !== "success" ? "text-primary" : ""
      )}>
        {negative && value > 0 ? "-" : ""}{formatMoney(value)}
      </p>
    </div>
  );
}

function PayoutList({
  payouts,
  pendingPayoutId,
  onStatusChange,
}: {
  payouts: AdminPayoutRecord[];
  pendingPayoutId: number | null;
  onStatusChange: (payout: AdminPayoutRecord, status: PayoutStatus) => void;
}) {
  if (!payouts.length) return null;

  return (
    <div className="divide-y divide-border">
      {payouts.map((payout) => (
        <div key={payout.id} className="group p-6 hover:bg-muted/30 transition-colors">
          <div className="flex flex-col lg:flex-row justify-between gap-8">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">{payout.professionalName}</p>
                <Badge variant={getPayoutStatusVariant(payout.status)} className="rounded-lg px-3 py-1 font-bold uppercase tracking-widest text-[10px]">
                  {formatEnum(payout.status)}
                </Badge>
                <Badge variant="outline" className="rounded-lg h-7 font-bold uppercase tracking-widest text-[9px] bg-background">
                  {formatEnum(payout.destinationType)}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground font-medium">{payout.professionalEmail}</p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 rounded-2xl bg-muted/40 p-4 border border-border/50">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Payout Destination</p>
                  <p className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Landmark className="h-3.5 w-3.5 text-primary/60" />
                    {payout.destinationLabel}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Admin Notes</p>
                  <p className="text-sm italic text-muted-foreground">{payout.note || "No administrative notes added."}</p>
                </div>
              </div>

              <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                <CalendarRange className="h-3 w-3" />
                Requested {formatDateTime(payout.createdAt)} \u00b7 Updated {formatDateTime(payout.updatedAt)}
              </p>
            </div>

            <div className="w-full lg:w-72 space-y-4">
              <div className="rounded-2xl border-2 border-primary/20 bg-primary/[0.02] p-5 text-center shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Requested Amount</p>
                <p className="mt-1 text-3xl font-bold text-primary tabular-nums tracking-tight">{formatMoney(payout.amount)}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Change Payout Status</label>
                <Select
                  value={payout.status}
                  disabled={pendingPayoutId === payout.id}
                  onValueChange={(value) => onStatusChange(payout, value as PayoutStatus)}
                >
                  <SelectTrigger className="rounded-xl h-11 bg-background border-border shadow-sm font-bold text-xs uppercase tracking-widest">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pending Approval</SelectItem>
                    <SelectItem value="PROCESSING">In Process</SelectItem>
                    <SelectItem value="COMPLETED">Paid / Completed</SelectItem>
                    <SelectItem value="REJECTED">Reject Request</SelectItem>
                  </SelectContent>
                </Select>
                {pendingPayoutId === payout.id && (
                  <p className="text-center text-[10px] font-bold text-primary animate-pulse uppercase tracking-widest mt-2">Updating Status...</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TransactionList({ transactions }: { transactions: AdminEarningsTransactionRecord[] }) {
  if (!transactions.length) return null;

  return (
    <div className="divide-y divide-border">
      {transactions.map((t) => (
        <div key={t.id} className="group p-6 hover:bg-muted/30 transition-colors">
          <div className="flex flex-col lg:flex-row justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">{t.jobTitle}</p>
                <Badge variant={t.status === "COMPLETED" ? "default" : "outline"} className="rounded-lg uppercase tracking-widest text-[9px]">
                  {formatEnum(t.status)}
                </Badge>
                <Badge variant="outline" className="rounded-lg h-6 font-bold uppercase tracking-widest text-[8px] bg-background">
                  {formatEnum(t.paymentType)}
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground font-medium">
                <span className="flex items-center gap-1.5"><CalendarRange className="h-3.5 w-3.5" />{t.projectCategory}</span>
                <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />TRK #{t.trackingId}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-8 text-sm">
                <p><span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Client</span> <span className="font-bold text-foreground">{t.clientName}</span></p>
                <p><span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Professional</span> <span className="font-bold text-foreground">{t.professionalName}</span></p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:w-[480px]">
              <MiniBox label="Gross" value={t.amount} />
              <MiniBox label="Comm." value={t.commissionAmount} negative />
              <MiniBox label="Net" value={t.netPayoutAmount} strong />
              <MiniBox label="Date" value={formatDate(t.dateTime)} isDate />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniBox({ label, value, negative, strong, isDate }: { label: string, value: any, negative?: boolean, strong?: boolean, isDate?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3 shadow-sm text-center group-hover:border-primary/20 transition-colors">
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
      <p className={cn(
        "font-bold tabular-nums tracking-tight whitespace-nowrap",
        isDate ? "text-[11px] text-muted-foreground" : "text-sm",
        negative ? "text-rose-600" : (strong ? "text-primary" : "text-foreground")
      )}>
        {negative && !isDate && value > 0 ? "-" : ""}{isDate ? value : formatMoney(value)}
      </p>
    </div>
  );
}

function filterTransactions(
  transactions: AdminEarningsTransactionRecord[],
  query: string,
  period: ReportPeriod,
  status: string,
) {
  const term = query.trim().toLowerCase();

  return transactions.filter((transaction) => {
    if (!isInReportPeriod(transaction.dateTime, period)) return false;
    if (status !== "ALL" && transaction.status !== status) return false;
    if (!term) return true;

    return [
      transaction.jobTitle,
      transaction.projectCategory,
      transaction.clientName,
      transaction.clientEmail,
      transaction.professionalName,
      transaction.professionalEmail,
      transaction.paymentType,
      transaction.status,
      transaction.description,
    ]
      .join(" ")
      .toLowerCase()
      .includes(term);
  });
}

function filterPayouts(
  payouts: AdminPayoutRecord[],
  query: string,
  period: ReportPeriod,
  status: string,
) {
  const term = query.trim().toLowerCase();

  return payouts.filter((payout) => {
    if (!isInReportPeriod(payout.createdAt, period)) return false;
    if (status !== "ALL" && payout.status !== status) return false;
    if (!term) return true;

    return [
      payout.professionalName,
      payout.professionalEmail,
      payout.destinationType,
      payout.destinationLabel,
      payout.status,
      payout.note,
    ]
      .join(" ")
      .toLowerCase()
      .includes(term);
  });
}

function isInReportPeriod(value: string, period: ReportPeriod) {
  if (period === "ALL") return true;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  if (period === "THIS_YEAR") return date.getFullYear() === now.getFullYear();

  const days = period === "30_DAYS" ? 30 : 90;
  return date.getTime() >= now.getTime() - days * 24 * 60 * 60 * 1000;
}

function filterProfessionals(professionals: AdminProfessionalEarningsSummary[], query: string) {
  const term = query.trim().toLowerCase();

  if (!term) {
    return professionals;
  }

  return professionals.filter((professional) =>
    [professional.professionalName, professional.professionalEmail]
      .join(" ")
      .toLowerCase()
      .includes(term),
  );
}

function getPayoutStatusVariant(status: string) {
  if (status === "COMPLETED") {
    return "default";
  }

  if (status === "REJECTED") {
    return "destructive";
  }

  if (status === "PROCESSING") {
    return "secondary";
  }

  return "outline";
}
