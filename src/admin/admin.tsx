import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { createFileRoute, Link, useLoaderData, useRouter } from "@tanstack/react-router";
import type { ComponentType, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import {
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  CalendarRange,
  ClipboardList,
  DollarSign,
  ReceiptText,
  Radio,
  Search,
  ShieldCheck,
  TrendingUp,
  UserCog,
  Users,
  Zap,
  Command,
  LayoutTemplate,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { verifyPassword } from "@/lib/password.server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlobalSearchOverlay } from "@/components/GlobalSearch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSummaryCard } from "@/components/admin/AdminSummaryCard";
import { AdminSection } from "@/components/admin/AdminSection";
import {
  formatBudget,
  formatDate,
  formatDateTime,
  formatEnum,
  formatMoney,
} from "@/lib/admin-formatters";
import {
  getAdminJobRecords,
  getAdminDisputeRecords,
  getAdminPaymentTransactions,
  getAdminDashboardSnapshot,
  updateAdminDisputeStatus,
  type AdminDisputeRecord,
  type AdminJobRecord,
  type AdminDashboardSnapshot,
  type AdminPaymentTransaction,
} from "@/lib/admin-dashboard-db.server";
import { createSessionCookie } from "@/lib/auth-session.server";
import { getCurrentUser } from "@/lib/current-user.server";
import {
  findUserByEmail,
  getAdminUsers,
  getAdminUserStats,
  updateUserActiveStatusByAdmin,
  updateUserRoleByAdmin,
  type AdminUserRecord,
  type AdminUserStats,
  type PublicUser,
  type UserRole,
} from "@/lib/user-db.server";
import { cn } from "@/lib/utils";

const ADMIN_USERNAME = "";

const getAdminPageData = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = getCurrentUser();

  if (!viewer) {
    return {
      viewer: null,
      users: [],
      stats: null,
      dashboard: null,
      jobRecords: [],
      disputeRecords: [],
      paymentTransactions: [],
    };
  }

  if (viewer.role !== "ADMIN") {
    return {
      viewer,
      users: [],
      stats: null,
      dashboard: null,
      jobRecords: [],
      disputeRecords: [],
      paymentTransactions: [],
    };
  }

  return {
    viewer,
    users: getAdminUsers(),
    stats: getAdminUserStats(),
    dashboard: getAdminDashboardSnapshot(),
    jobRecords: getAdminJobRecords(),
    disputeRecords: getAdminDisputeRecords(),
    paymentTransactions: getAdminPaymentTransactions(),
  };
});

const submitAdminLogin = createServerFn({ method: "POST" })
  .inputValidator((input: { username: string; password: string }) => input)
  .handler(async ({ data }) => {
    const email = data.username.trim().toLowerCase();
    const existingAdmin = findUserByEmail(email);
    const passwordCheck = await verifyPassword(data.password, existingAdmin?.passwordHash ?? null);

    if (
      !existingAdmin ||
      existingAdmin.role !== "ADMIN" ||
      !existingAdmin.isActive ||
      !passwordCheck.valid
    ) {
      return {
        ok: false as const,
        formError: "Invalid admin username or password.",
      };
    }

    const adminUser: PublicUser = existingAdmin;

    setResponseHeader(
      "Set-Cookie",
      createSessionCookie({
        id: adminUser.id,
        role: "ADMIN",
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        email: adminUser.email,
        phone: adminUser.phone,
        avatarUrl: adminUser.avatarUrl,
        authProvider: adminUser.authProvider,
      }),
    );

    return {
      ok: true as const,
    };
  });

const updateManagedUserRole = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: number; role: UserRole }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "ADMIN") {
      throw new Error("Only admins can change user roles.");
    }

    if (viewer.id === data.userId && data.role !== "ADMIN") {
      throw new Error("You cannot remove your own admin role.");
    }

    return updateUserRoleByAdmin(data.userId, data.role);
  });

const updateManagedUserStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: number; isActive: boolean }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "ADMIN") {
      throw new Error("Only admins can change user status.");
    }

    if (viewer.id === data.userId && !data.isActive) {
      throw new Error("You cannot deactivate your own admin account.");
    }

    return updateUserActiveStatusByAdmin(data.userId, data.isActive);
  });

const updateManagedDisputeStatus = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { disputeId: number; status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" }) => input,
  )
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "ADMIN") {
      throw new Error("Only admins can update disputes.");
    }

    return updateAdminDisputeStatus(data.disputeId, data.status);
  });

export const Route = createFileRoute("/admin")({
  loader: () => getAdminPageData(),
  head: () => ({ meta: [{ title: "Admin - Servio" }] }),
  component: Admin,
});

type ShortcutKey = "overview" | "jobs" | "users" | "payments";
type OverviewResult = "total-users" | "today-jobs" | "today-transactions" | "open-disputes";

const shortcutConfig = [
  { key: "overview", label: "Overview", icon: TrendingUp, description: "Live platform metrics" },
  {
    key: "jobs",
    label: "Jobs \u0026 Disputes",
    icon: BriefcaseBusiness,
    description: "Job posts, tracked work, and dispute queue",
  },
  { key: "users", label: "Users", icon: Users, description: "User roles and access" },
  { key: "payments", label: "Payments", icon: ReceiptText, description: "Revenue and payouts" },
] as const;

const tabs = shortcutConfig;

const roleOptions = [
  { value: "ADMIN", label: "Admin" },
  { value: "CLIENT", label: "Client" },
  { value: "PROFESSIONAL", label: "Professional" },
] as const;

function Admin() {
  const data = useLoaderData({ from: "/admin" });
  const router = useRouter();
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("overview");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [liveStatus, setLiveStatus] = useState("Connecting live feed...");
  const [jobQuery, setJobQuery] = useState("");
  const [disputeQuery, setDisputeQuery] = useState("");
  const [paymentQuery, setPaymentQuery] = useState("");
  const [overviewResult, setOverviewResult] = useState<OverviewResult | null>(null);

  function selectTab(nextTab: ShortcutKey) {
    setOverviewResult(null);
    setTab(nextTab);
  }

  function showOverviewResult(result: OverviewResult) {
    setOverviewResult(result);
    setQuery("");
    setJobQuery("");
    setDisputeQuery("");
    setPaymentQuery("");
    setTab(
      result === "total-users" ? "users" : result === "today-transactions" ? "payments" : "jobs",
    );
  }

  useEffect(() => {
    const handleShortcutKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && /^\d$/.test(event.key)) {
        const index = Number(event.key) - 1;

        if (index >= 0 && index < tabs.length) {
          event.preventDefault();
          selectTab(tabs[index].key);
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener("keydown", handleShortcutKeyDown);

    return () => {
      window.removeEventListener("keydown", handleShortcutKeyDown);
    };
  }, []);

  const filteredJobs = useMemo(() => {
    const term = jobQuery.trim().toLowerCase();
    let jobs = data.jobRecords as JobRecord[];

    if (overviewResult === "today-jobs") {
      const generatedAt = data.dashboard?.generatedAt;
      if (generatedAt) {
        jobs = jobs.filter((job) => isOnDashboardDay(job.createdAt, generatedAt));
      } else {
        jobs = [];
      }
    } else if (overviewResult === "open-disputes") {
      const disputedJobIds = new Set(
        (data.disputeRecords as DisputeRecord[])
          .filter((dispute) => dispute.status === "OPEN" || dispute.status === "UNDER_REVIEW")
          .map((dispute) => dispute.jobId),
      );
      jobs = jobs.filter((job) => disputedJobIds.has(job.id));
    }

    if (!term) {
      return jobs;
    }

    return jobs.filter((job) => {
      const haystack = [
        job.title,
        job.category,
        job.status,
        job.clientName,
        job.clientEmail,
        job.professionalName,
        job.professionalEmail,
        job.trackingStatus,
        job.locationLabel,
        job.locationAddress,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [data.dashboard?.generatedAt, data.disputeRecords, data.jobRecords, jobQuery, overviewResult]);

  const filteredDisputes = useMemo(() => {
    const term = disputeQuery.trim().toLowerCase();
    let disputes = data.disputeRecords as DisputeRecord[];

    if (overviewResult === "open-disputes") {
      disputes = disputes.filter(
        (dispute) => dispute.status === "OPEN" || dispute.status === "UNDER_REVIEW",
      );
    }

    if (!term) {
      return disputes;
    }

    return disputes.filter((dispute) => {
      const haystack = [
        dispute.jobTitle,
        dispute.issueType,
        dispute.priority,
        dispute.status,
        dispute.message,
        dispute.reporterRole,
        dispute.reporterName,
        dispute.reporterEmail,
        dispute.clientName,
        dispute.clientEmail,
        dispute.professionalName,
        dispute.professionalEmail,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [data.disputeRecords, disputeQuery, overviewResult]);

  const filteredPayments = useMemo(() => {
    const term = paymentQuery.trim().toLowerCase();
    let payments = data.paymentTransactions as PaymentRecord[];

    if (overviewResult === "today-transactions") {
      const generatedAt = data.dashboard?.generatedAt;
      if (generatedAt) {
        payments = payments.filter(
          (payment) =>
            payment.status === "COMPLETED" && isOnDashboardDay(payment.dateTime, generatedAt),
        );
      } else {
        payments = [];
      }
    }

    if (!term) {
      return payments;
    }

    return payments.filter((payment) => {
      const haystack = [
        payment.jobTitle,
        payment.clientName,
        payment.clientEmail,
        payment.professionalName,
        payment.professionalEmail,
        payment.status,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [data.dashboard?.generatedAt, data.paymentTransactions, overviewResult, paymentQuery]);

  useEffect(() => {
    if (!data?.viewer || data.viewer.role !== "ADMIN") {
      return;
    }

    const socket = io(getSocketUrl(), {
      auth: {
        userId: data.viewer.id,
        role: data.viewer.role,
        name: `${data.viewer.firstName} ${data.viewer.lastName}`.trim() || data.viewer.email,
        avatarUrl: data.viewer.avatarUrl,
      },
    });

    const refresh = async (reason: string) => {
      setLiveStatus(`Live update: ${reason}`);
      await router.invalidate();
    };

    socket.emit("admin:subscribe");
    socket.on("connect", () => setLiveStatus("Live feed connected"));
    socket.on("disconnect", () => setLiveStatus("Live feed disconnected"));
    socket.on("admin:refresh", (payload: { reason?: string }) => {
      refresh(payload?.reason || "platform activity");
    });
    socket.on("project:activity", () => {
      refresh("project activity");
    });
    socket.on("notifications:refresh", (payload: { reason?: string }) => {
      refresh(payload?.reason || "notification activity");
    });

    return () => {
      socket.disconnect();
    };
  }, [data?.viewer, router]);

  if (!data?.viewer || data.viewer.role !== "ADMIN" || !data.stats || !data.dashboard) {
    return <AdminLogin />;
  }

  const displayName =
    `${data.viewer.firstName} ${data.viewer.lastName}`.trim() || data.viewer.email;
  const users = data.users as AdminUserRecord[];
  const shortcutStats = getShortcutStats(data.dashboard, data.stats, users.length);
  const activeShortcut = shortcutConfig.find((item) => item.key === tab) ?? shortcutConfig[0];
  const filteredUsers = users.filter((user) => {
    const haystack = `${user.firstName} ${user.lastName} ${user.email} ${user.role}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <AppShell userName={displayName} userRole="Admin" userAvatarUrl={data.viewer.avatarUrl}>
      <GlobalSearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />

      <AdminPageHeader
        title="Admin Dashboard"
        description="Live view of users, client job posts, transactions, projects, and dispute queues."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={() => setSearchOpen(true)}>
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Global Search</span>
              <kbd className="hidden items-center gap-1 rounded-lg border border-border bg-muted/50 px-2 py-0.5 text-[10px] md:inline-flex">
                <Command className="h-3 w-3" />K
              </kbd>
            </Button>
            <Badge variant="secondary" className="gap-2 rounded-xl px-4 py-1.5 font-bold uppercase tracking-widest text-[10px]">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Secure Admin Session
            </Badge>
            <Badge variant="outline" className="gap-2 rounded-xl px-4 py-1.5 font-bold uppercase tracking-widest text-[10px] bg-background">
              <Radio className={cn("h-3.5 w-3.5", liveStatus.includes("connected") ? "text-emerald-500" : "text-rose-500")} />
              {liveStatus}
            </Badge>
          </div>
        }
      />

      <div className="space-y-8">
        <AdminSection
          title="Dashboard Shortcuts"
          description="Pick a shortcut to load its summary cards instantly. Use Ctrl/Cmd + 1\u20134 for fast navigation."
          icon={Zap}
          actions={
            <div className="flex flex-wrap gap-2">
              {tabs.map((item) => {
                const Icon = item.icon;
                const isActive = item.key === tab;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => selectTab(item.key)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-[11px] font-bold uppercase tracking-widest transition-all",
                      isActive
                        ? "border-primary bg-primary text-white shadow-md scale-105"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-muted/50"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          }
        >
          <div className="p-8 bg-muted/20">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {shortcutStats[tab].map((item) => (
                <AdminSummaryCard
                  key={`${tab}-${item.label}`}
                  icon={getMetricIcon(item.label)}
                  label={item.label}
                  value={item.value}
                  caption={item.caption}
                />
              ))}
            </div>
          </div>
        </AdminSection>

        <div className="flex flex-col gap-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9 h-11 rounded-2xl shadow-sm border-border bg-background"
                placeholder={tab === "users" ? "Search users by name or email..." : "Quick search..."}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" className="rounded-xl h-11 px-6 font-bold shadow-sm">
                <Link to="/web-editor">
                  <LayoutTemplate className="mr-2 h-4 w-4" />
                  Web Editor
                </Link>
              </Button>
            </div>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {tab === "overview" && (
              <Overview dashboard={data.dashboard} onSelectResult={showOverviewResult} />
            )}
            {tab === "users" && (
              <div className="space-y-6">
                {overviewResult === "total-users" && (
                  <ResultNotice
                    label="Total users"
                    count={filteredUsers.length}
                    onClear={() => selectTab("users")}
                  />
                )}
                <AdminSection
                  title="User Access Control"
                  description="Review all registered accounts and manage their roles and active status."
                  icon={UserCog}
                  actions={
                    <Button asChild className="rounded-xl font-bold">
                      <Link to="/user-management">Advanced User Management</Link>
                    </Button>
                  }
                >
                  <UsersTable users={filteredUsers} currentUserId={data.viewer.id} />
                </AdminSection>
              </div>
            )}
            {tab === "jobs" && (
              <div className="space-y-6">
                {overviewResult === "today-jobs" && (
                  <ResultNotice
                    label="Jobs posted today"
                    count={filteredJobs.length}
                    onClear={() => selectTab("jobs")}
                  />
                )}
                {overviewResult === "open-disputes" && (
                  <ResultNotice
                    label="Open disputes"
                    count={filteredDisputes.length}
                    onClear={() => selectTab("jobs")}
                  />
                )}
                <AdminSection
                  title="Job \u0026 Dispute Management"
                  description="Database view of work activity and reported issues."
                  icon={BriefcaseBusiness}
                  actions={
                    <Button asChild className="rounded-xl font-bold">
                      <Link to="/job-management">Full Job Management</Link>
                    </Button>
                  }
                >
                  <JobDisputeManagement
                    jobs={filteredJobs}
                    disputes={filteredDisputes}
                    jobQuery={jobQuery}
                    disputeQuery={disputeQuery}
                    onJobQueryChange={setJobQuery}
                    onDisputeQueryChange={setDisputeQuery}
                    resultMode={
                      overviewResult === "today-jobs"
                        ? "jobs"
                        : overviewResult === "open-disputes"
                          ? "disputes"
                          : "all"
                    }
                  />
                </AdminSection>
              </div>
            )}
            {tab === "payments" && (
              <div className="space-y-6">
                {overviewResult === "today-transactions" && (
                  <ResultNotice
                    label="Today transactions"
                    count={filteredPayments.length}
                    onClear={() => selectTab("payments")}
                  />
                )}
                <AdminSection
                  title="Payment Activity"
                  description="Real-time transaction log from the platform database."
                  icon={ReceiptText}
                  actions={
                    <Button asChild className="rounded-xl font-bold">
                      <Link to="/earnings-reports">Full Earnings Report</Link>
                    </Button>
                  }
                >
                  <PaymentsTable
                    payments={filteredPayments}
                    loading={false}
                    query={paymentQuery}
                    onQueryChange={setPaymentQuery}
                  />
                </AdminSection>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

type JobRecord = AdminJobRecord;
type DisputeRecord = AdminDisputeRecord;
type PaymentRecord = AdminPaymentTransaction;

type ShortcutMetric = {
  label: string;
  value: number | string;
  caption: string;
};

function getMetricIcon(label: string) {
  const l = label.toLowerCase();
  if (l.includes("user")) return Users;
  if (l.includes("job")) return ClipboardList;
  if (l.includes("revenue") || l.includes("transaction") || l.includes("payment")) return DollarSign;
  if (l.includes("dispute")) return AlertTriangle;
  return TrendingUp;
}

function getShortcutStats(
  dashboard: AdminDashboardSnapshot,
  stats: AdminUserStats | null,
  totalUsers: number,
) {
  const totalJobs = dashboard.stats.totalJobs;
  const openJobs = dashboard.stats.openJobs;
  const todayJobs = dashboard.stats.todayJobs;
  const completedJobs = totalJobs - openJobs - todayJobs;
  const totalRevenue = dashboard.stats.totalRevenue || 0;
  const activeUsersCount = stats?.activeUsers ?? totalUsers;

  return {
    overview: [
      { label: "Total users", value: stats?.totalUsers ?? 0, caption: "Registered accounts" },
      { label: "Active users", value: activeUsersCount, caption: "Currently active" },
      {
        label: "Today revenue",
        value: formatMoney(dashboard.stats.todayRevenue),
        caption: "Payments completed today",
      },
      { label: "Open disputes", value: dashboard.stats.openDisputes, caption: "Needs attention" },
    ],
    jobs: [
      { label: "Total jobs", value: totalJobs, caption: "All posted jobs" },
      { label: "Active jobs", value: openJobs, caption: "Running and open work" },
      { label: "Completed jobs", value: completedJobs, caption: "Closed successfully" },
      {
        label: "Open disputes",
        value: dashboard.stats.openDisputes,
        caption: "Needs admin review",
      },
    ],
    users: [
      {
        label: "Total users",
        value: stats?.totalUsers ?? totalUsers,
        caption: "All account holders",
      },
      { label: "Active users", value: activeUsersCount, caption: "Verified and active" },
      {
        label: "New today",
        value: dashboard.stats.todayUsers,
        caption: "Accounts created today",
      },
      {
        label: "Verified users",
        value: stats?.activeUsers ?? 0,
        caption: "Verified from current database counts",
      },
    ],
    payments: [
      { label: "Total revenue", value: formatMoney(totalRevenue), caption: "Completed earnings" },
      {
        label: "Successful payments",
        value: dashboard.stats.todayTransactions,
        caption: "Transactions completed",
      },
      {
        label: "Monthly revenue",
        value: formatMoney(dashboard.stats.todayRevenue * 30),
        caption: "Derived from current database revenue",
      },
    ],
  } satisfies Record<ShortcutKey, ShortcutMetric[]>;
}

function JobDisputeManagement({
  jobs,
  disputes,
  jobQuery,
  disputeQuery,
  onJobQueryChange,
  onDisputeQueryChange,
  resultMode,
}: {
  jobs: JobRecord[];
  disputes: DisputeRecord[];
  jobQuery: string;
  disputeQuery: string;
  onJobQueryChange: (value: string) => void;
  onDisputeQueryChange: (value: string) => void;
  resultMode: "all" | "jobs" | "disputes";
}) {
  const openDisputes = disputes.filter((dispute) => dispute.status !== "RESOLVED").length;
  const highPriorityDisputes = disputes.filter(
    (dispute) => dispute.priority === "HIGH" && dispute.status !== "RESOLVED",
  ).length;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-3 p-6 bg-muted/20 border-b border-border">
        <div className="rounded-2xl border border-border bg-background p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Work queue</p>
          <p className="mt-2 text-3xl font-bold">{jobs.length}</p>
          <p className="mt-1 text-xs text-muted-foreground font-medium">Matching current filter</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Open disputes</p>
          <p className="mt-2 text-3xl font-bold text-rose-600">{openDisputes}</p>
          <p className="mt-1 text-xs text-muted-foreground font-medium">Open or under review</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">High priority</p>
          <p className="mt-2 text-3xl font-bold text-rose-700">{highPriorityDisputes}</p>
          <p className="mt-1 text-xs text-muted-foreground font-medium">Needs immediate action</p>
        </div>
      </div>

      <div className="p-6 pt-0 space-y-8">
        {resultMode !== "jobs" && (
          <DisputesTable
            disputes={disputes}
            query={disputeQuery}
            onQueryChange={onDisputeQueryChange}
          />
        )}
        {resultMode !== "disputes" && (
          <JobsTable jobs={jobs} query={jobQuery} onQueryChange={onJobQueryChange} />
        )}
      </div>
    </div>
  );
}

function DisputesTable({
  disputes,
  query,
  onQueryChange,
}: {
  disputes: DisputeRecord[];
  query: string;
  onQueryChange: (value: string) => void;
}) {
  const router = useRouter();
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  async function handleStatusChange(disputeId: number, status: DisputeRecord["status"]) {
    if (!["OPEN", "UNDER_REVIEW", "RESOLVED"].includes(status)) {
      return;
    }

    setUpdatingId(disputeId);

    try {
      await updateManagedDisputeStatus({
        data: { disputeId, status: status as "OPEN" | "UNDER_REVIEW" | "RESOLVED" },
      });
      await router.invalidate();
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-foreground">Dispute Management</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Review reported issues and update resolution state.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search disputes..."
            className="pl-9 h-10 rounded-xl"
          />
        </div>
      </div>

      {disputes.length ? (
        <div className="divide-y divide-border rounded-2xl border border-border overflow-hidden bg-background shadow-sm">
          {disputes.map((dispute) => (
            <div
              key={dispute.id}
              className="group grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-center hover:bg-muted/30 transition-colors"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-bold text-lg text-foreground group-hover:text-primary transition-colors">{dispute.jobTitle}</p>
                  <Badge
                    variant={
                      dispute.status === "OPEN"
                        ? "destructive"
                        : dispute.status === "UNDER_REVIEW"
                          ? "secondary"
                          : "outline"
                    }
                    className="rounded-lg"
                  >
                    {formatEnum(dispute.status)}
                  </Badge>
                  <Badge variant={dispute.priority === "HIGH" ? "destructive" : "outline"} className="rounded-lg">
                    {formatEnum(dispute.priority)}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-medium">
                  <span className="flex items-center gap-1.5"><UserCog className="h-3.5 w-3.5" />By {formatEnum(dispute.reporterRole)}: {dispute.reporterName}</span>
                  <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{formatDateTime(dispute.createdAt)}</span>
                  <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />{formatEnum(dispute.issueType)}</span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground bg-muted/40 p-3 rounded-xl italic">"{dispute.message}"</p>
                <div className="mt-3 flex gap-4 text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
                  <p>Client: <span className="text-foreground">{dispute.clientName}</span></p>
                  <p>Provider: <span className="text-foreground">{dispute.professionalName}</span></p>
                </div>
              </div>
              <div className="space-y-3 bg-muted/30 p-4 rounded-2xl border border-border/50 shadow-inner">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Update Status</p>
                <Select
                  value={dispute.status}
                  onValueChange={(value) => handleStatusChange(dispute.id, value)}
                  disabled={updatingId === dispute.id}
                >
                  <SelectTrigger className="rounded-xl h-11 bg-background border-border shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                    <SelectItem value="RESOLVED">Resolved</SelectItem>
                  </SelectContent>
                </Select>
                {dispute.jobId ? (
                  <Button asChild variant="outline" size="sm" className="w-full rounded-xl h-10 font-bold">
                    <Link to="/job-management">View Full Case</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-border bg-muted/10 p-12 text-center">
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">No disputes found</p>
        </div>
      )}
    </div>
  );
}

function JobsTable({
  jobs,
  query,
  onQueryChange,
}: {
  jobs: JobRecord[];
  query: string;
  onQueryChange: (value: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-foreground">Platform Job Records</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Search by client, title, category, or status.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search jobs..."
            className="pl-9 h-10 rounded-xl"
          />
        </div>
      </div>

      {jobs.length ? (
        <div className="divide-y divide-border rounded-2xl border border-border overflow-hidden bg-background shadow-sm">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="group grid gap-4 p-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center hover:bg-muted/30 transition-colors"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="truncate font-bold text-lg text-foreground group-hover:text-primary transition-colors">{job.title}</p>
                  <Badge variant={job.status === "OPEN" ? "default" : "outline"} className="rounded-lg">
                    {formatEnum(job.status)}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{job.category}</span>
                  <span className="flex items-center gap-1.5"><CalendarRange className="h-3.5 w-3.5" />Posted {formatDateTime(job.createdAt)}</span>
                </div>
                <div className="mt-3 flex gap-6 text-sm">
                  <p className="font-medium">Client: <span className="font-bold text-foreground">{job.clientName}</span></p>
                  {job.professionalName && (
                    <p className="font-medium">Provider: <span className="font-bold text-foreground">{job.professionalName}</span></p>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground font-medium uppercase tracking-widest flex items-center gap-2">
                  <MapPin className="h-3 w-3" />
                  {formatEnum(job.workMode)} \u00b7 Deadline {formatDate(job.deadline)}
                  {job.locationLabel ? ` \u00b7 ${job.locationLabel}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xl font-bold text-foreground tracking-tight">
                  {formatBudget(job.budgetMin, job.budgetMax)}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-2 h-8 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 hover:text-primary">
                  <Link to="/job-management">Open Job Details</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-border bg-muted/10 p-12 text-center">
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">No jobs found</p>
        </div>
      )}
    </div>
  );
}

function PaymentsTable({
  payments,
  loading,
  query,
  onQueryChange,
}: {
  payments: PaymentRecord[];
  loading: boolean;
  query: string;
  onQueryChange: (value: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="p-6 border-b border-border bg-muted/10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-foreground">Database Transaction Log</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Audit trailing payments and revenue records.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Filter transactions..."
            className="pl-9 h-10 rounded-xl bg-background"
          />
        </div>
      </div>

      <div className="p-6 pt-0">
        {loading ? (
          <div className="space-y-4">
            <div className="h-16 animate-pulse rounded-2xl bg-muted" />
            <div className="h-16 animate-pulse rounded-2xl bg-muted" />
            <div className="h-16 animate-pulse rounded-2xl bg-muted" />
          </div>
        ) : payments.length ? (
          <div className="divide-y divide-border rounded-2xl border border-border overflow-hidden bg-background shadow-sm">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="group grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center hover:bg-emerald-50/50 transition-colors"
              >
                <div className="min-w-0 flex items-center gap-4">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-foreground group-hover:text-emerald-700 transition-colors">
                      {payment.jobTitle}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground font-medium uppercase tracking-widest">
                      {formatEnum(payment.paymentType)} \u00b7 {formatDateTime(payment.dateTime)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-foreground tracking-tight">{formatMoney(payment.amount)}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Status: <span className="text-emerald-600">COMPLETED</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-border bg-muted/10 p-12 text-center">
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">No transactions found</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState(ADMIN_USERNAME);
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const result = await submitAdminLogin({ data: { username, password } });

      if (!result.ok) {
        setFormError(result.formError);
        return;
      }

      await router.invalidate();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Admin login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 px-4">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="mb-8">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">Admin Login</h1>
          <p className="mt-2 text-sm text-muted-foreground font-medium">
            Authorized administrative access only.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground" htmlFor="admin-username">
              Username / Email
            </label>
            <Input
              id="admin-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              className="h-12 rounded-xl bg-background border-border shadow-sm focus:ring-2 focus:ring-primary/20"
              placeholder="admin@servio.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground" htmlFor="admin-password">
              Security Password
            </label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="h-12 rounded-xl bg-background border-border shadow-sm focus:ring-2 focus:ring-primary/20"
              placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
            />
          </div>

          {formError && (
            <div className="rounded-xl bg-rose-50 p-4 border border-rose-100 flex items-center gap-2 text-rose-700 text-sm font-bold animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {formError}
            </div>
          )}

          <Button type="submit" className="w-full h-12 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all active:scale-95" disabled={isSubmitting}>
            {isSubmitting ? "AUTHORIZING..." : "ENTER ADMIN PANEL"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function Overview({
  dashboard,
  onSelectResult,
}: {
  dashboard: AdminDashboardSnapshot;
  onSelectResult: (result: OverviewResult) => void;
}) {
  const stats = dashboard.stats;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminSummaryCard
          icon={Users}
          label="Total Registered Users"
          value={stats.totalUsers}
          caption={`${stats.activeUsers} active accounts \u00b7 ${stats.todayUsers} new today`}
          onClick={() => onSelectResult("total-users")}
        />
        <AdminSummaryCard
          icon={ClipboardList}
          label="Jobs Posted Today"
          value={stats.todayJobs}
          caption={`${stats.openJobs} currently open work posts`}
          variant="primary"
          onClick={() => onSelectResult("today-jobs")}
        />
        <AdminSummaryCard
          icon={DollarSign}
          label="Today Gross Revenue"
          value={formatMoney(stats.todayRevenue)}
          caption={`${stats.todayTransactions} successful transactions`}
          variant="success"
          onClick={() => onSelectResult("today-transactions")}
        />
        <AdminSummaryCard
          icon={AlertTriangle}
          label="Open Disputed Issues"
          value={stats.openDisputes}
          caption={`${stats.pendingRequests} project requests pending`}
          variant="destructive"
          onClick={() => onSelectResult("open-disputes")}
        />
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
          <div className="border-b border-border bg-muted/20 px-8 py-6">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary grid place-items-center">
                <ClipboardList className="h-4 w-4" />
              </div>
              Live Client Job Posts
            </h2>
            <p className="mt-1 text-sm text-muted-foreground font-medium">
              Real-time feed of work being posted to the platform.
            </p>
          </div>
          <div className="divide-y divide-border overflow-auto max-h-[500px] custom-scrollbar">
            {dashboard.recentJobs.length ? (
              dashboard.recentJobs.map((job) => (
                <div key={job.id} className="group p-6 hover:bg-muted/30 transition-colors flex items-center justify-between gap-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="truncate font-bold text-foreground group-hover:text-primary transition-colors">{job.title}</p>
                      <Badge variant={job.status === "OPEN" ? "default" : "outline"} className="rounded-lg text-[9px] uppercase tracking-widest">
                        {formatEnum(job.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground font-medium uppercase tracking-widest flex items-center gap-2">
                      <span className="text-primary/60 font-bold">{job.clientName || "Unknown Client"}</span>
                      <span>\u00b7</span>
                      <span>{job.category}</span>
                      <span>\u00b7</span>
                      <span>{formatDateTime(job.createdAt)}</span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-base font-bold text-foreground">
                      {formatBudget(job.budgetMin, job.budgetMax)}
                    </p>
                    <Link to="/job-management" className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline mt-1 block">View Case</Link>
                  </div>
                </div>
              ))
            ) : (
              <EmptyLiveRow
                title="No live jobs detected"
                description="Client job posts will appear here as soon as they are created."
              />
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
          <div className="border-b border-border bg-muted/20 px-8 py-6">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 grid place-items-center">
                <Wallet className="h-4 w-4" />
              </div>
              Recent Financial Transactions
            </h2>
            <p className="mt-1 text-sm text-muted-foreground font-medium">
              Total completed revenue: <span className="font-bold text-emerald-600">{formatMoney(stats.totalRevenue)}</span>
            </p>
          </div>
          <div className="divide-y divide-border overflow-auto max-h-[500px] custom-scrollbar">
            {dashboard.recentTransactions.length ? (
              dashboard.recentTransactions.map((transaction) => (
                <div key={transaction.id} className="group p-6 hover:bg-emerald-50/30 transition-colors flex items-center justify-between gap-6">
                  <div className="min-w-0 flex items-center gap-4">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-muted-foreground group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">
                      <ReceiptText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-foreground group-hover:text-emerald-700 transition-colors">{transaction.projectTitle}</p>
                      <p className="mt-1 text-xs text-muted-foreground font-medium uppercase tracking-widest">
                        {formatEnum(transaction.type)} \u00b7 {formatDateTime(transaction.createdAt)}
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 text-lg font-bold text-foreground tracking-tight">{formatMoney(transaction.amount)}</p>
                </div>
              ))
            ) : (
              <EmptyLiveRow
                title="No transactions found"
                description="Completed project payments will appear here."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultNotice({
  label,
  count,
  onClear,
}: {
  label: string;
  count: number;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 px-6 py-4 text-sm shadow-sm animate-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-primary" />
        <span className="font-bold text-primary uppercase tracking-widest">
          FILTER ACTIVE: {label} ({count.toLocaleString()} RESULTS)
        </span>
      </div>
      <Button type="button" variant="outline" size="sm" className="rounded-xl font-bold uppercase tracking-widest text-[10px]" onClick={onClear}>
        Clear Selection
      </Button>
    </div>
  );
}

function isOnDashboardDay(value: string, generatedAt: string) {
  const date = new Date(value);
  const dashboardDate = new Date(generatedAt);

  return (
    date.getFullYear() === dashboardDate.getFullYear() &&
    date.getMonth() === dashboardDate.getMonth() &&
    date.getDate() === dashboardDate.getDate()
  );
}

function EmptyLiveRow({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground/30 mb-4">
        <Radio className="h-6 w-6" />
      </div>
      <p className="font-bold text-muted-foreground uppercase tracking-widest text-[11px]">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground max-w-[200px]">{description}</p>
    </div>
  );
}

function UsersTable({ users, currentUserId }: { users: AdminUserRecord[]; currentUserId: number }) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const visibleUsers = useMemo(() => users, [users]);

  async function handleRoleChange(user: AdminUserRecord, role: UserRole) {
    const actionKey = `role-${user.id}`;
    setPendingAction(actionKey);

    try {
      await updateManagedUserRole({ data: { userId: user.id, role } });
      await router.invalidate();
    } finally {
      setPendingAction(null);
    }
  }

  async function handleStatusChange(user: AdminUserRecord, isActive: boolean) {
    const actionKey = `status-${user.id}`;
    setPendingAction(actionKey);

    try {
      await updateManagedUserStatus({ data: { userId: user.id, isActive } });
      await router.invalidate();
    } finally {
      setPendingAction(null);
    }
  }

  if (!visibleUsers.length) {
    return (
      <AdminEmptyState
        title="No users found"
        description="Try a different name, email, or role search."
        icon={UserCog}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm border-collapse">
        <thead className="bg-muted/50 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground border-b border-border">
          <tr>
            <th className="px-6 py-4 text-left">User Profile</th>
            <th className="px-6 py-4 text-left">Access Role</th>
            <th className="px-6 py-4 text-left">Active Status</th>
            <th className="px-6 py-4 text-left">Auth Provider</th>
            <th className="px-6 py-4 text-left">Registration</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {visibleUsers.map((user) => {
            const isCurrentUser = user.id === currentUserId;
            const fullName = `${user.firstName} ${user.lastName}`.trim() || user.email;

            return (
              <tr
                key={user.id}
                className="group border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={user.avatarUrl || `https://i.pravatar.cc/100?u=${user.id}`}
                      className="h-10 w-10 rounded-xl object-cover ring-2 ring-background shadow-sm"
                      alt=""
                    />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-foreground group-hover:text-primary transition-colors">{fullName}</p>
                      <p className="truncate text-xs text-muted-foreground font-medium">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Select
                    value={user.role}
                    onValueChange={(value) => handleRoleChange(user, value as UserRole)}
                    disabled={pendingAction !== null || isCurrentUser}
                  >
                    <SelectTrigger className="rounded-xl h-10 w-44 bg-background border-border shadow-sm text-xs font-bold uppercase tracking-widest">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    <Switch
                      checked={user.isActive}
                      onCheckedChange={(checked) => handleStatusChange(user, checked)}
                      disabled={pendingAction !== null || isCurrentUser}
                      className="data-[state=checked]:bg-emerald-500"
                      aria-label={`${user.isActive ? "Deactivate" : "Activate"} ${fullName}`}
                    />
                    <span
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest",
                        user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      )}
                    >
                      {user.isActive ? "Active" : "Blocked"}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Badge variant="outline" className="rounded-lg text-[10px] font-bold uppercase tracking-widest bg-background">{formatEnum(user.authProvider)}</Badge>
                </td>
                <td className="px-6 py-4 text-xs font-medium text-muted-foreground tabular-nums">{formatDate(user.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Wallet({ className }: { className?: string }) {
  return <DollarSign className={className} />;
}

function getSocketUrl() {
  return (
    import.meta.env.VITE_SOCKET_URL ||
    `${window.location.protocol}//${window.location.hostname}:4001`
  );
}
