import type { ComponentType } from "react";
import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  ArrowDownToLine,
  CheckCircle2,
  Clock3,
  DollarSign,
  Percent,
  ReceiptText,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCurrentUser } from "@/lib/current-user.server";
import {
  createProfessionalWithdrawalRequest,
  getProfessionalWithdrawals,
  getUserProjectTransactions,
  type ProjectTransactionRecord,
  type ProjectWithdrawalDestinationType,
  type ProjectWithdrawalRecord,
} from "@/lib/project-request-db.server";

const getEarningsData = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = getCurrentUser();

  if (!viewer) {
    return {
      viewer: null,
      transactions: [] as ProjectTransactionRecord[],
      withdrawals: [] as ProjectWithdrawalRecord[],
    };
  }

  return {
    viewer,
    transactions: getUserProjectTransactions(viewer.id),
    withdrawals: viewer.role === "PROFESSIONAL" ? getProfessionalWithdrawals(viewer.id) : [],
  };
});

const requestWithdrawal = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      amount: number;
      destinationType: ProjectWithdrawalDestinationType;
      destinationLabel: string;
      note?: string | null;
    }) => input,
  )
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "PROFESSIONAL") {
      throw new Error("Only professionals can request withdrawals.");
    }

    return createProfessionalWithdrawalRequest(viewer.id, data);
  });

export const Route = createFileRoute("/earnings")({
  loader: async () => getEarningsData(),
  head: () => ({ meta: [{ title: "Earnings - Servio" }] }),
  component: Earnings,
});

function Earnings() {
  const { viewer, transactions, withdrawals } = Route.useLoaderData();
  const router = useRouter();
  const isProfessional = viewer?.role === "PROFESSIONAL";
  const viewerName = viewer ? `${viewer.firstName} ${viewer.lastName}`.trim() : undefined;
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState<ProjectWithdrawalDestinationType>("BANK");
  const [withdrawDestination, setWithdrawDestination] = useState("");
  const [withdrawNote, setWithdrawNote] = useState("");
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawMessage, setWithdrawMessage] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const scopedTransactions = transactions.filter((transaction) =>
    isProfessional
      ? transaction.professionalId === viewer?.id
      : transaction.clientId === viewer?.id,
  );
  const scopedWithdrawals = isProfessional ? withdrawals : [];
  const completedTransactions = scopedTransactions.filter(
    (transaction) => transaction.status === "COMPLETED",
  );
  const cancelledTransactions = scopedTransactions.filter(
    (transaction) => transaction.status === "CANCELLED",
  );
  const lifetimeTotal = completedTransactions.reduce(
    (total, transaction) => total + transaction.amount,
    0,
  );
  const thisMonthTotal = completedTransactions
    .filter((transaction) => isSameMonth(transaction.createdAt, new Date()))
    .reduce((total, transaction) => total + transaction.amount, 0);
  const completedJobs = getCompletedJobs(completedTransactions);
  const pendingPayouts = completedTransactions;
  const invoices = completedTransactions.map((transaction) => createInvoiceRecord(transaction));
  const totalCommission = invoices.reduce((total, invoice) => total + invoice.commission, 0);
  const totalNetPayout = invoices.reduce((total, invoice) => total + invoice.netPayout, 0);
  const requestedWithdrawals = scopedWithdrawals
    .filter((withdrawal) => withdrawal.status !== "REJECTED")
    .reduce((total, withdrawal) => total + withdrawal.amount, 0);
  const availableBalance = Math.max(0, totalNetPayout - requestedWithdrawals);
  const chartData = getMonthlyTotals(completedTransactions);
  const max = Math.max(1, ...chartData.map((d) => d.value));

  async function handleWithdrawalRequest() {
    const amount = Number(withdrawAmount);

    setIsWithdrawing(true);
    setWithdrawError(null);
    setWithdrawMessage(null);

    try {
      await requestWithdrawal({
        data: {
          amount,
          destinationType: withdrawMethod,
          destinationLabel: withdrawDestination,
          note: withdrawNote,
        },
      });
      setWithdrawMessage("Withdrawal request submitted. It is now pending review.");
      setIsWithdrawOpen(false);
      setWithdrawAmount("");
      setWithdrawDestination("");
      setWithdrawNote("");
      await router.invalidate();
    } catch (error) {
      setWithdrawError(
        error instanceof Error ? error.message : "Could not submit withdrawal request.",
      );
    } finally {
      setIsWithdrawing(false);
    }
  }

  return (
    <AppShell
      title={isProfessional ? "View Earnings Dashboard" : "Payments"}
      userName={viewerName}
      userRole={isProfessional ? "Professional" : "Client"}
      userAvatarUrl={viewer?.avatarUrl}
    >
      <div className="space-y-8 px-1 py-2">
        {/* Header Section */}
        <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-8 shadow-lg">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{isProfessional ? "Earnings" : "Payments"} Dashboard</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">{isProfessional ? "Earnings Overview" : "Payment Summary"}</h1>
              <p className="mt-2 max-w-xl text-base text-slate-600">{isProfessional ? "Track your completed earnings, pending payouts, and withdrawal requests." : "View all payments from your projects."}</p>
            </div>
          </div>
        </section>

        {/* Summary Cards Section */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div className="rounded-lg bg-gradient-to-br from-blue-50 to-slate-100 p-3 text-slate-700">
                <Wallet className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-sm font-medium text-slate-600">{isProfessional ? "Available balance" : "Total paid"}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{formatMoney(isProfessional ? availableBalance : lifetimeTotal)}</p>
            <p className="mt-2 text-xs text-slate-500">{isProfessional ? "Ready to withdraw" : "Saved in transactions"}</p>
          </div>
          <div className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div className="rounded-lg bg-gradient-to-br from-green-50 to-slate-100 p-3 text-green-700">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-sm font-medium text-slate-600">This month</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{formatMoney(thisMonthTotal)}</p>
            <p className="mt-2 text-xs text-slate-500">Completed payments</p>
          </div>
          <div className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div className="rounded-lg bg-gradient-to-br from-purple-50 to-slate-100 p-3 text-purple-700">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-sm font-medium text-slate-600">Completed</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{completedTransactions.length}</p>
            <p className="mt-2 text-xs text-slate-500">Ledger rows</p>
          </div>
          <div className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div className="rounded-lg bg-gradient-to-br from-orange-50 to-slate-100 p-3 text-orange-700">
                <ArrowDownToLine className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-sm font-medium text-slate-600">Cancelled</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{cancelledTransactions.length}</p>
            <p className="mt-2 text-xs text-slate-500">Voided rows</p>
          </div>
        </section>

      {isProfessional ? (
        <section className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
            <div className="mb-6 border-b border-slate-200 pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Completed Jobs</h2>
                  <p className="mt-2 text-sm text-slate-600">Projects with payment records</p>
                </div>
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="space-y-3">
              {completedJobs.map((job) => (
                <div
                  key={job.trackingId}
                  className="group rounded-lg border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4 transition-all hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 font-semibold text-slate-900">
                        {job.projectTitle || "Completed project"}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {job.projectCategory || "Project"} • {job.paymentCount} payment{job.paymentCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className="font-semibold text-slate-900">{formatMoney(job.amount)}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Last paid {formatDate(job.lastPaidAt)}
                  </p>
                </div>
              ))}
              {!completedJobs.length ? (
                <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 py-12 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-slate-400" />
                  <h3 className="mt-3 font-semibold text-slate-900">No completed jobs yet</h3>
                  <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
                    Completed jobs will appear here after clients approve work or pay milestones.
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
            <div className="mb-6 border-b border-slate-200 pb-6">
              <h2 className="text-2xl font-bold text-slate-900">Pending Payouts</h2>
              <p className="mt-2 text-sm text-slate-600">Completed earnings</p>
            </div>
            <div className="mb-6 rounded-lg bg-gradient-to-br from-blue-50 to-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-widest text-slate-600">Total pending</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{formatMoney(lifetimeTotal)}</p>
              <p className="mt-2 text-xs text-slate-600">
                {formatMoney(availableBalance)} available
              </p>
            </div>
            <div className="space-y-2">
              {pendingPayouts.slice(0, 4).map((payout) => (
                <div
                  key={payout.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <span className="min-w-0 truncate text-slate-700">
                    {payout.projectTitle || payout.description}
                  </span>
                  <span className="ml-2 font-medium text-slate-900">{formatMoney(payout.amount)}</span>
                </div>
              ))}
              {!pendingPayouts.length ? (
                <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                  No pending payouts yet.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
      </div>

      <div className="space-y-8 px-1 py-2">
        {isProfessional ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
            <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Invoices & Commission</h2>
                <p className="mt-2 text-sm text-slate-600">Payment breakdown with commission deduction</p>
              </div>
              <ReceiptText className="h-6 w-6 text-slate-700" />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
                <p className="text-xs font-medium uppercase tracking-widest text-slate-600">Gross invoices</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{formatMoney(lifetimeTotal)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-red-50 to-white p-4">
                <p className="text-xs font-medium uppercase tracking-widest text-slate-600">Commission</p>
                <p className="mt-2 text-2xl font-bold text-red-600">-{formatMoney(totalCommission)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-green-50 to-white p-4">
                <p className="text-xs font-medium uppercase tracking-widest text-slate-600">Net payout</p>
                <p className="mt-2 text-2xl font-bold text-green-700">{formatMoney(totalNetPayout)}</p>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-600">
                    <th className="py-3 pr-4 font-medium">Invoice</th>
                    <th className="py-3 pr-4 font-medium">Project</th>
                    <th className="py-3 pr-4 font-medium">Date</th>
                    <th className="py-3 pr-4 text-right font-medium">Gross</th>
                    <th className="py-3 pr-4 text-right font-medium">Commission</th>
                    <th className="py-3 text-right font-medium">Net payout</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="border-b border-slate-200 last:border-0 hover:bg-slate-50"
                    >
                      <td className="py-3 pr-4 font-medium text-slate-900">{invoice.invoiceNumber}</td>
                      <td className="py-3 pr-4 text-slate-700">{invoice.projectTitle}</td>
                      <td className="py-3 pr-4 text-slate-600">
                        {formatDate(invoice.createdAt)}
                      </td>
                      <td className="py-3 pr-4 text-right text-slate-900">{formatMoney(invoice.gross)}</td>
                      <td className="py-3 pr-4 text-right text-red-600">
                        -{formatMoney(invoice.commission)}
                      </td>
                      <td className="py-3 text-right font-semibold text-slate-900">
                        {formatMoney(invoice.netPayout)}
                      </td>
                    </tr>
                  ))}
                  {!invoices.length ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-600">
                        No invoices yet. Completed project payments will create invoice rows here.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg lg:col-span-2">
            <div className="mb-6 border-b border-slate-200 pb-6">
              <h2 className="text-2xl font-bold text-slate-900">
                {isProfessional ? "Earnings" : "Payments"} by month
              </h2>
              <p className="mt-2 text-sm text-slate-600">Last 6 months</p>
            </div>
            <div className="flex h-56 items-end gap-3">
              {chartData.map((d) => (
                <div key={d.month} className="group flex flex-1 flex-col items-center gap-2">
                  <div className="relative w-full">
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-blue-600 to-blue-400 transition-all group-hover:opacity-90"
                      style={{ height: `${Math.max(4, (d.value / max) * 200)}px` }}
                    />
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 group-hover:opacity-100">
                      {formatMoney(d.value)}
                    </span>
                  </div>
                  <span className="text-xs text-slate-600">{d.month}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-white shadow-lg">
            <p className="text-sm font-medium opacity-90">
              {isProfessional ? "Wallet balance" : "Project payments"}
            </p>
            <p className="mt-3 text-4xl font-bold">
              {formatMoney(isProfessional ? availableBalance : lifetimeTotal)}
            </p>
            <p className="mt-2 text-xs opacity-80">
              {isProfessional ? "Net payout minus requested withdrawals" : "Loaded from the database"}
            </p>
            <Button
              className="mt-6 w-full bg-white/20 text-white hover:bg-white/30 transition-all"
              disabled={!isProfessional || availableBalance <= 0}
              onClick={() => {
                setWithdrawAmount(String(Math.floor(availableBalance)));
                setWithdrawError(null);
                setWithdrawMessage(null);
                setIsWithdrawOpen(true);
              }}
            >
              <ArrowDownToLine className="mr-2 h-4 w-4" /> Withdraw
            </Button>
            <div className="mt-6 space-y-2 border-t border-white/20 pt-4 text-sm">
              <div className="flex justify-between">
                <span className="opacity-75">Currency</span>
                <span className="font-medium">USD</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-75">Source</span>
                <span className="font-medium">Project milestones</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-75">Rows</span>
                <span className="font-medium">{scopedTransactions.length}</span>
              </div>
              {isProfessional ? (
                <div className="flex justify-between">
                  <span className="opacity-75">Requested</span>
                  <span className="font-medium">{formatMoney(requestedWithdrawals)}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {isProfessional ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
            <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Withdrawal requests</h2>
                <p className="mt-2 text-sm text-slate-600">Track bank, UPI, and wallet payouts</p>
              </div>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  setWithdrawAmount(String(Math.floor(availableBalance)));
                  setWithdrawError(null);
                  setWithdrawMessage(null);
                  setIsWithdrawOpen(true);
                }}
                disabled={availableBalance <= 0}
              >
                <ArrowDownToLine className="h-4 w-4 mr-2" />
                Withdraw money
              </Button>
            </div>

            {withdrawMessage ? (
              <p className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                {withdrawMessage}
              </p>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-600">
                    <th className="py-3 pr-4 font-medium">Date</th>
                    <th className="py-3 pr-4 font-medium">Method</th>
                    <th className="py-3 pr-4 font-medium">Destination</th>
                    <th className="py-3 pr-4 font-medium">Status</th>
                    <th className="py-3 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {scopedWithdrawals.map((withdrawal) => (
                    <tr
                      key={withdrawal.id}
                      className="border-b border-slate-200 last:border-0 hover:bg-slate-50"
                    >
                      <td className="py-3 pr-4 text-slate-700">
                        {formatDate(withdrawal.createdAt)}
                      </td>
                      <td className="py-3 pr-4 text-slate-700">{formatEnum(withdrawal.destinationType)}</td>
                      <td className="py-3 pr-4 text-slate-700">{withdrawal.destinationLabel}</td>
                      <td className="py-3 pr-4">
                        <span className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                          withdrawal.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                          withdrawal.status === "PENDING" ? "bg-yellow-100 text-yellow-700" :
                          "bg-slate-100 text-slate-700"
                        }`}>
                          {formatEnum(withdrawal.status)}
                        </span>
                      </td>
                      <td className="py-3 text-right font-medium text-slate-900">
                        {formatMoney(withdrawal.amount)}
                      </td>
                    </tr>
                  ))}
                  {!scopedWithdrawals.length ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-600">
                        No withdrawal requests yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
          <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">All Transactions</h2>
              <p className="mt-2 text-sm text-slate-600">Complete transaction history and ledger</p>
            </div>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              size="sm"
              onClick={() => downloadTransactionsPdf(scopedTransactions, isProfessional)}
              disabled={!scopedTransactions.length}
            >
              <ReceiptText className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-600">
                  <th className="py-3 pr-4 font-medium">Date</th>
                  <th className="py-3 pr-4 font-medium">Description</th>
                  <th className="py-3 pr-4 font-medium">Type</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {scopedTransactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="border-b border-slate-200 last:border-0 hover:bg-slate-50"
                  >
                    <td className="py-3 pr-4 text-slate-700">
                      {formatDate(transaction.createdAt)}
                    </td>
                    <td className="py-3 pr-4 text-slate-700">{transaction.description}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                          transaction.type === "MILESTONE_PAYMENT"
                            ? "bg-green-100 text-green-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {formatTransactionType(transaction.type)}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                        transaction.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                        transaction.status === "PENDING" ? "bg-yellow-100 text-yellow-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        {formatEnum(transaction.status)}
                      </span>
                    </td>
                    <td className="py-3 text-right font-medium text-slate-900">{formatMoney(transaction.amount)}</td>
                  </tr>
                ))}
                {!scopedTransactions.length ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-600">
                      No transactions yet. Mark a project milestone as paid to create the first record.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw money</DialogTitle>
            <DialogDescription>
              Request a payout from your available balance of {formatMoney(availableBalance)}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="withdraw-amount">Amount</Label>
                <Input
                  id="withdraw-amount"
                  type="number"
                  min={1}
                  max={Math.floor(availableBalance)}
                  value={withdrawAmount}
                  onChange={(event) => setWithdrawAmount(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Method</Label>
                <Select
                  value={withdrawMethod}
                  onValueChange={(value) =>
                    setWithdrawMethod(value as ProjectWithdrawalDestinationType)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BANK">Bank transfer</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="WALLET">Wallet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="withdraw-destination">Payout details</Label>
              <Input
                id="withdraw-destination"
                value={withdrawDestination}
                onChange={(event) => setWithdrawDestination(event.target.value)}
                placeholder={
                  withdrawMethod === "UPI"
                    ? "name@upi"
                    : withdrawMethod === "WALLET"
                      ? "Wallet ID or phone"
                      : "Bank name, account, IFSC/routing"
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="withdraw-note">Note</Label>
              <Input
                id="withdraw-note"
                value={withdrawNote}
                onChange={(event) => setWithdrawNote(event.target.value)}
                placeholder="Optional note for admin"
              />
            </div>
            {withdrawError ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {withdrawError}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWithdrawOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleWithdrawalRequest}
              disabled={isWithdrawing || availableBalance <= 0}
            >
              <ArrowDownToLine className="h-4 w-4" />
              {isWithdrawing ? "Submitting" : "Submit request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function getMonthlyTotals(transactions: ProjectTransactionRecord[]) {
  const now = new Date();

  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const value = transactions
      .filter((transaction) => {
        const transactionDate = new Date(transaction.createdAt);
        return (
          transactionDate.getFullYear() === date.getFullYear() &&
          transactionDate.getMonth() === date.getMonth()
        );
      })
      .reduce((total, transaction) => total + transaction.amount, 0);

    return {
      month: new Intl.DateTimeFormat("en", { month: "short" }).format(date),
      value,
    };
  });
}

function getCompletedJobs(transactions: ProjectTransactionRecord[]) {
  const jobs = new Map<
    number,
    {
      trackingId: number;
      projectTitle: string | null;
      projectCategory: string | null;
      amount: number;
      paymentCount: number;
      lastPaidAt: string;
    }
  >();

  transactions.forEach((transaction) => {
    const existing = jobs.get(transaction.trackingId);

    if (!existing) {
      jobs.set(transaction.trackingId, {
        trackingId: transaction.trackingId,
        projectTitle: transaction.projectTitle,
        projectCategory: transaction.projectCategory,
        amount: transaction.amount,
        paymentCount: 1,
        lastPaidAt: transaction.createdAt,
      });
      return;
    }

    existing.amount += transaction.amount;
    existing.paymentCount += 1;

    if (new Date(transaction.createdAt).getTime() > new Date(existing.lastPaidAt).getTime()) {
      existing.lastPaidAt = transaction.createdAt;
    }
  });

  return Array.from(jobs.values()).sort(
    (a, b) => new Date(b.lastPaidAt).getTime() - new Date(a.lastPaidAt).getTime(),
  );
}

function createInvoiceRecord(transaction: ProjectTransactionRecord) {
  const commission = Math.round(transaction.amount * 0.1 * 100) / 100;

  return {
    id: transaction.id,
    invoiceNumber: `INV-${String(transaction.id).padStart(5, "0")}`,
    projectTitle: transaction.projectTitle || transaction.description || "Project payment",
    createdAt: transaction.createdAt,
    gross: transaction.amount,
    commission,
    netPayout: Math.max(0, transaction.amount - commission),
  };
}

function downloadTransactionsPdf(
  transactions: ProjectTransactionRecord[],
  includeCommission: boolean,
) {
  const headers = includeCommission
    ? [
        "Date",
        "Project",
        "Description",
        "Type",
        "Status",
        "Gross Amount",
        "Commission Deduction",
        "Net Payout",
        "Currency",
      ]
    : ["Date", "Project", "Description", "Type", "Status", "Amount", "Currency"];
  const rows = transactions.map((transaction) => {
    const invoice = createInvoiceRecord(transaction);

    return includeCommission
      ? [
          formatDate(transaction.createdAt),
          transaction.projectTitle || "",
          transaction.description,
          formatTransactionType(transaction.type),
          formatEnum(transaction.status),
          transaction.amount,
          invoice.commission,
          invoice.netPayout,
          transaction.currency,
        ]
      : [
          formatDate(transaction.createdAt),
          transaction.projectTitle || "",
          transaction.description,
          formatTransactionType(transaction.type),
          formatEnum(transaction.status),
          transaction.amount,
          transaction.currency,
        ];
  });
  const title = includeCommission ? "Servio Professional Earnings" : "Servio Client Payments";
  const lines = [
    title,
    `Generated: ${formatDate(new Date().toISOString())}`,
    "",
    ...formatPdfTable(headers, rows),
  ];
  const blob = new Blob([createSimplePdf(lines)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = includeCommission
    ? `servio-professional-earnings-${date}.pdf`
    : `servio-client-payments-${date}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatPdfTable(headers: string[], rows: Array<Array<string | number>>) {
  const columnWidths = headers.map((header, index) =>
    Math.min(
      Math.max(header.length, ...rows.map((row) => String(row[index] ?? "").length)),
      index === 2 ? 28 : 18,
    ),
  );
  const formatRow = (row: Array<string | number>) =>
    row
      .map((cell, index) =>
        truncatePdfCell(String(cell ?? ""), columnWidths[index]).padEnd(columnWidths[index]),
      )
      .join("  ");

  return [
    formatRow(headers),
    columnWidths.map((width) => "-".repeat(width)).join("  "),
    ...rows.map(formatRow),
  ];
}

function truncatePdfCell(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1))}.`;
}

function createSimplePdf(lines: string[]) {
  const pageWidth = 842;
  const pageHeight = 595;
  const marginX = 36;
  const lineHeight = 13;
  const maxLinesPerPage = Math.floor((pageHeight - 72) / lineHeight);
  const pages = chunkLines(lines.length ? lines : ["No transactions available."], maxLinesPerPage);
  const objects: string[] = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  );

  pages.forEach((pageLines, index) => {
    const pageObjectId = 3 + index * 2;
    const contentObjectId = pageObjectId + 1;
    const stream = [
      "BT",
      "/F1 9 Tf",
      `${marginX} ${pageHeight - 36} Td`,
      ...pageLines
        .flatMap((line, lineIndex) => [
          lineIndex === 0 ? "" : `0 -${lineHeight} Td`,
          `(${escapePdfText(line)}) Tj`,
        ])
        .filter(Boolean),
      "ET",
    ].join("\n");

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${3 + pages.length * 2} 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
    );
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");

  const parts = ["%PDF-1.4\n"];
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(parts.join("").length);
    parts.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  });

  const xrefOffset = parts.join("").length;
  parts.push(`xref\n0 ${objects.length + 1}\n`);
  parts.push("0000000000 65535 f \n");
  offsets.slice(1).forEach((offset) => {
    parts.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  });
  parts.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  );

  return parts.join("");
}

function chunkLines(lines: string[], size: number) {
  const chunks: string[][] = [];

  for (let index = 0; index < lines.length; index += size) {
    chunks.push(lines.slice(index, index + size));
  }

  return chunks.length ? chunks : [[""]];
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function isSameMonth(value: string, date: Date) {
  const transactionDate = new Date(value);

  return (
    transactionDate.getFullYear() === date.getFullYear() &&
    transactionDate.getMonth() === date.getMonth()
  );
}

function formatMoney(value: number) {
  return `$${value.toLocaleString()}`;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatTransactionType(value: string) {
  return value === "MILESTONE_PAYMENT" ? "Milestone" : "Final";
}

function Stat({
  icon: Icon,
  tint,
  label,
  value,
  sub,
}: {
  icon: ComponentType<{ className?: string }>;
  tint: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className={`grid h-10 w-10 place-items-center rounded-xl ${tint}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-2xl font-semibold">{value}</p>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}
