import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, Link, useLoaderData, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  Banknote,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Clock3,
  FolderKanban,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Star,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { hashPassword } from "@/lib/password.server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ReportExportActions } from "@/components/ReportExportActions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  getAdminManagedUserDetails,
  type AdminManagedUserDetail,
} from "@/lib/admin-dashboard-db.server";
import { getCurrentUser } from "@/lib/current-user.server";
import {
  getAdminUsers,
  updateProfessionalVerifiedStatusByAdmin,
  updateUserActiveStatusByAdmin,
  updateUserPasswordByAdmin,
  type AdminUserRecord,
} from "@/lib/user-db.server";
import { cn } from "@/lib/utils";

const getUserManagementData = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = getCurrentUser();

  if (!viewer || viewer.role !== "ADMIN") {
    return {
      viewer,
      users: [],
    };
  }

  const users = getAdminUsers().filter(
    (user) => user.role === "CLIENT" || user.role === "PROFESSIONAL",
  );

  return {
    viewer,
    users,
    userDetails: getAdminManagedUserDetails(
      users.map((user) => ({ id: user.id, role: user.role as "CLIENT" | "PROFESSIONAL" })),
    ),
  };
});

const updateManagedUserStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: number; isActive: boolean }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "ADMIN") {
      throw new Error("Only admins can change user status.");
    }

    return updateUserActiveStatusByAdmin(data.userId, data.isActive);
  });

const updateManagedProfessionalVerification = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: number; isVerified: boolean }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "ADMIN") {
      throw new Error("Only admins can change professional verification.");
    }

    return updateProfessionalVerifiedStatusByAdmin(data.userId, data.isVerified);
  });

const updateManagedUserPassword = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: number; password: string }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer || viewer.role !== "ADMIN") {
      throw new Error("Only admins can change user passwords.");
    }

    const passwordError = validatePassword(data.password);
    if (passwordError) {
      throw new Error(passwordError);
    }

    updateUserPasswordByAdmin(data.userId, hashPassword(data.password));
    return { ok: true as const };
  });

export const Route = createFileRoute("/user-management")({
  loader: () => getUserManagementData(),
  head: () => ({ meta: [{ title: "User Management - Servio" }] }),
  component: UserManagement,
});

function UserManagement() {
  const data = useLoaderData({ from: "/user-management" });
  const router = useRouter();
  const [clientQuery, setClientQuery] = useState("");
  const [professionalQuery, setProfessionalQuery] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [summaryFilter, setSummaryFilter] = useState<
    "clients" | "professionals" | "verified" | "inactive" | null
  >(null);

  if (!data.viewer || data.viewer.role !== "ADMIN") {
    return (
      <div className="grid min-h-screen place-items-center bg-muted/30 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
          <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
          <h1 className="mt-6 text-xl font-bold">Admin access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in from the admin panel to manage clients and professionals.
          </p>
          <Button asChild className="mt-8 w-full">
            <Link to="/admin">Open admin panel</Link>
          </Button>
        </div>
      </div>
    );
  }

  const users = data.users as AdminUserRecord[];
  const clients = users.filter((user) => user.role === "CLIENT");
  const professionals = users.filter((user) => user.role === "PROFESSIONAL");
  const visibleClients = filterUsers(
    summaryFilter === "inactive" ? clients.filter((user) => !user.isActive) : clients,
    clientQuery,
  );
  const visibleProfessionals = filterUsers(
    summaryFilter === "verified"
      ? professionals.filter((user) => user.isVerified)
      : summaryFilter === "inactive"
        ? professionals.filter((user) => !user.isActive)
        : professionals,
    professionalQuery,
  );
  const displayName =
    `${data.viewer.firstName} ${data.viewer.lastName}`.trim() || data.viewer.email;
  const selectedUser = users.find((user) => user.id === selectedUserId) || null;
  const selectedUserDetail = selectedUserId
    ? (data.userDetails[selectedUserId] as AdminManagedUserDetail | undefined)
    : undefined;

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

  async function handleVerificationChange(user: AdminUserRecord, isVerified: boolean) {
    const actionKey = `verified-${user.id}`;
    setPendingAction(actionKey);

    try {
      await updateManagedProfessionalVerification({ data: { userId: user.id, isVerified } });
      await router.invalidate();
    } finally {
      setPendingAction(null);
    }
  }

  async function handlePasswordChange(user: AdminUserRecord, password: string) {
    const actionKey = `password-${user.id}`;
    setPendingAction(actionKey);

    try {
      await updateManagedUserPassword({ data: { userId: user.id, password } });
      await router.invalidate();
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <AppShell userName={displayName} userRole="Admin" userAvatarUrl={data.viewer.avatarUrl}>
      <AdminPageHeader
        title="Users Management"
        description="Manage account status, professional verification, and profile readiness."
        breadcrumbs={[{ label: "User Management" }]}
        actions={
          <>
            <ReportExportActions
              table="User"
              reportName="User management export"
              variant="outline"
            />
            <Button asChild variant="outline">
              <Link to="/admin">Back to admin</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminSummaryCard
          icon={Users}
          label="Clients"
          value={clients.length}
          caption={`${activeCount(clients)} active`}
          active={summaryFilter === "clients"}
          onClick={() => setSummaryFilter(summaryFilter === "clients" ? null : "clients")}
        />
        <AdminSummaryCard
          icon={BriefcaseBusiness}
          label="Professionals"
          value={professionals.length}
          caption={`${activeCount(professionals)} active`}
          active={summaryFilter === "professionals"}
          onClick={() =>
            setSummaryFilter(summaryFilter === "professionals" ? null : "professionals")
          }
        />
        <AdminSummaryCard
          icon={BadgeCheck}
          label="Verified Pros"
          value={professionals.filter((user) => user.isVerified).length}
          caption="Approved providers"
          active={summaryFilter === "verified"}
          variant="success"
          onClick={() => setSummaryFilter(summaryFilter === "verified" ? null : "verified")}
        />
        <AdminSummaryCard
          icon={UserRound}
          label="Inactive Users"
          value={users.filter((user) => !user.isActive).length}
          caption="Need attention"
          active={summaryFilter === "inactive"}
          variant="destructive"
          onClick={() => setSummaryFilter(summaryFilter === "inactive" ? null : "inactive")}
        />
      </div>

      {summaryFilter ? (
        <div className="mt-6 flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 px-6 py-4 text-sm shadow-sm animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="font-bold text-primary">
              FILTER ACTIVE:{" "}
              <span className="uppercase text-primary/70">
                {summaryFilter === "verified"
                  ? "Verified professionals"
                  : summaryFilter === "inactive"
                    ? "Inactive users"
                    : summaryFilter}
              </span>
            </span>
          </div>
          <Button type="button" size="sm" variant="outline" className="rounded-xl font-bold uppercase tracking-widest text-[10px]" onClick={() => setSummaryFilter(null)}>
            Clear Filter
          </Button>
        </div>
      ) : null}

      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        {summaryFilter !== "professionals" && summaryFilter !== "verified" ? (
          <AdminSection
            title="Clients"
            description="People or companies posting jobs and hiring professionals."
            icon={Users}
            actions={
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={clientQuery}
                  onChange={(event) => setClientQuery(event.target.value)}
                  placeholder="Search clients..."
                  className="pl-9 h-10 rounded-xl"
                />
              </div>
            }
          >
            <UserList
              users={visibleClients}
              pendingAction={pendingAction}
              onStatusChange={handleStatusChange}
              onUserSelect={setSelectedUserId}
              title="Clients"
            />
          </AdminSection>
        ) : null}
        {summaryFilter !== "clients" ? (
          <AdminSection
            title="Professionals"
            description="Service providers, verification, rates, and availability."
            icon={BriefcaseBusiness}
            actions={
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={professionalQuery}
                  onChange={(event) => setProfessionalQuery(event.target.value)}
                  placeholder="Search professionals..."
                  className="pl-9 h-10 rounded-xl"
                />
              </div>
            }
          >
            <UserList
              users={visibleProfessionals}
              pendingAction={pendingAction}
              onStatusChange={handleStatusChange}
              onVerificationChange={handleVerificationChange}
              onUserSelect={setSelectedUserId}
              title="Professionals"
            />
          </AdminSection>
        ) : null}
      </div>

      <UserDetailDialog
        key={selectedUser?.id || "closed"}
        user={selectedUser}
        detail={selectedUserDetail}
        open={selectedUser !== null}
        pendingAction={pendingAction}
        onStatusChange={handleStatusChange}
        onPasswordChange={handlePasswordChange}
        onOpenChange={(open) => {
          if (!open) setSelectedUserId(null);
        }}
      />
    </AppShell>
  );
}

function UserList({
  users,
  pendingAction,
  onStatusChange,
  onVerificationChange,
  onUserSelect,
  title,
}: {
  users: AdminUserRecord[];
  pendingAction: string | null;
  onStatusChange: (user: AdminUserRecord, isActive: boolean) => void;
  onVerificationChange?: (user: AdminUserRecord, isVerified: boolean) => void;
  onUserSelect: (userId: number) => void;
  title: string;
}) {
  const isProfessionals = title === "Professionals";

  if (!users.length) {
    return (
      <AdminEmptyState
        title={`No ${title.toLowerCase()} found`}
        description={`Try a different name or email search for your ${title.toLowerCase()}.`}
      />
    );
  }

  return (
    <div className="divide-y divide-border">
      {users.map((user) => {
        const fullName = getFullName(user);
        const statusKey = `status-${user.id}`;
        const verifiedKey = `verified-${user.id}`;

        return (
          <article
            key={user.id}
            className="group cursor-pointer p-6 transition-all hover:bg-muted/50"
            onClick={() => onUserSelect(user.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onUserSelect(user.id);
            }}
            role="button"
            tabIndex={0}
            aria-label={`View full details for ${fullName}`}
          >
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 gap-4">
                <div className="relative shrink-0">
                  <img
                    src={user.avatarUrl || `https://i.pravatar.cc/100?u=${user.id}`}
                    className="h-14 w-14 rounded-2xl object-cover ring-2 ring-background shadow-sm"
                    alt=""
                  />
                  <div className={cn(
                    "absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-background shadow-sm",
                    user.isActive ? "bg-emerald-500" : "bg-slate-300"
                  )} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-lg font-bold text-foreground group-hover:text-primary transition-colors">{fullName}</h3>
                    <Badge variant={user.isActive ? "default" : "outline"} className="rounded-lg">
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                    {isProfessionals ? (
                      <Badge variant={user.isVerified ? "default" : "secondary"} className="rounded-lg">
                        {user.isVerified ? "Verified" : "Pending"}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground font-medium">
                    <span className="inline-flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-primary/60" />
                      {user.email}
                    </span>
                    {user.phone ? (
                      <span className="inline-flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-primary/60" />
                        {user.phone}
                      </span>
                    ) : null}
                  </div>
                  <UserDetails user={user} />
                </div>
              </div>

              <div
                className="flex shrink-0 flex-col gap-4 rounded-2xl border border-border bg-background p-5 shadow-sm sm:w-60"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold text-foreground uppercase tracking-wider text-[11px]">Account Access</span>
                  <Switch
                    checked={user.isActive}
                    disabled={pendingAction !== null}
                    onCheckedChange={(checked) => onStatusChange(user, checked)}
                    aria-label={`${user.isActive ? "Deactivate" : "Activate"} ${fullName}`}
                  />
                </div>
                {pendingAction === statusKey && (
                  <p className="text-[10px] font-bold text-primary animate-pulse uppercase tracking-widest">Saving status...</p>
                )}
                {isProfessionals && onVerificationChange && (
                  <>
                    <div className="border-t border-border pt-4 flex items-center justify-between gap-3 text-sm">
                      <span className="font-bold text-foreground uppercase tracking-wider text-[11px]">Verification</span>
                      <Switch
                        checked={user.isVerified}
                        disabled={pendingAction !== null}
                        onCheckedChange={(checked) => onVerificationChange(user, checked)}
                        aria-label={`${user.isVerified ? "Unverify" : "Verify"} ${fullName}`}
                      />
                    </div>
                    {pendingAction === verifiedKey && (
                      <p className="text-[10px] font-bold text-primary animate-pulse uppercase tracking-widest">Saving verification...</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function UserDetailDialog({
  user,
  detail,
  open,
  pendingAction,
  onStatusChange,
  onPasswordChange,
  onOpenChange,
}: {
  user: AdminUserRecord | null;
  detail?: AdminManagedUserDetail;
  open: boolean;
  pendingAction: string | null;
  onStatusChange: (user: AdminUserRecord, isActive: boolean) => Promise<void>;
  onPasswordChange: (user: AdminUserRecord, password: string) => Promise<void>;
  onOpenChange: (open: boolean) => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  if (!user) return null;

  const fullName = getFullName(user);
  const isProfessional = user.role === "PROFESSIONAL";
  const passwordPending = pendingAction === `password-${user.id}`;

  async function submitPasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage(null);

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setPasswordMessage({ type: "error", text: passwordError });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "Password confirmation does not match." });
      return;
    }

    try {
      await onPasswordChange(user, newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage({
        type: "success",
        text: "Password changed successfully.",
      });
    } catch (error) {
      setPasswordMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Password could not be changed.",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto p-0 rounded-3xl border-none shadow-2xl overflow-hidden">
        <div className="border-b border-border bg-muted/20 p-8">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <img
                src={user.avatarUrl || `https://i.pravatar.cc/100?u=${user.id}`}
                className="h-24 w-24 rounded-3xl object-cover ring-4 ring-background shadow-lg"
                alt=""
              />
              <div className="min-w-0 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                  <DialogTitle className="text-3xl font-bold tracking-tight">{fullName}</DialogTitle>
                  <Badge className="rounded-lg px-3 py-1 font-bold uppercase tracking-widest text-[10px]">{formatEnum(user.role)}</Badge>
                  <Badge variant={user.isActive ? "default" : "outline"} className="rounded-lg px-3 py-1 font-bold uppercase tracking-widest text-[10px]">
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                  {isProfessional ? (
                    <Badge variant={user.isVerified ? "default" : "secondary"} className="rounded-lg px-3 py-1 font-bold uppercase tracking-widest text-[10px]">
                      {user.isVerified ? "Verified" : "Pending Review"}
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-x-6 gap-y-2 text-base font-medium text-muted-foreground">
                  <span className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" />{user.email}</span>
                  {user.phone ? <span className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" />{user.phone}</span> : null}
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailStat
              icon={CalendarDays}
              label="Account created"
              value={formatDateTime(user.createdAt)}
            />
            <DetailStat
              icon={Clock3}
              label="Last login"
              value={user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Not recorded yet"}
            />
            <DetailStat
              icon={FolderKanban}
              label="Projects"
              value={`${detail?.projectCount || 0} total`}
            />
            <DetailStat
              icon={Banknote}
              label={isProfessional ? "Gross earned" : "Total paid"}
              value={formatMoney(detail?.totalMoney || 0)}
            />
          </div>

          <Tabs defaultValue="overview" className="mt-10">
            <TabsList className="grid w-full grid-cols-3 h-14 rounded-2xl bg-muted p-1 shadow-inner">
              <TabsTrigger value="overview" className="rounded-xl font-bold text-sm data-[state=active]:shadow-md">Overview</TabsTrigger>
              <TabsTrigger value="projects" className="rounded-xl font-bold text-sm data-[state=active]:shadow-md">Projects ({detail?.projectCount || 0})</TabsTrigger>
              <TabsTrigger value="payments" className="rounded-xl font-bold text-sm data-[state=active]:shadow-md">
                Payments ({detail?.transactions.length || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-8">
              <div className="grid gap-6 md:grid-cols-2">
                <DetailPanel title="Account Information">
                  <InfoRow label="Account ID" value={`#${user.id}`} />
                  <InfoRow label="Sign-in method" value={formatSignInMethod(user)} />
                  <InfoRow label="Account access" value={user.isActive ? "Allowed" : "Blocked"} />
                  <InfoRow label="Created" value={formatDateTime(user.createdAt)} />
                  <InfoRow label="Last updated" value={formatDateTime(user.updatedAt)} />
                </DetailPanel>
                <DetailPanel title={isProfessional ? "Professional Profile" : "Client Profile"}>
                  {isProfessional ? (
                    <>
                      <InfoRow label="Category" value={user.professionalCategory || "Not set"} />
                      <InfoRow label="City" value={user.professionalCity || "Not set"} />
                      <InfoRow
                        label="Experience"
                        value={user.experienceYears ? `${user.experienceYears} years` : "Not set"}
                      />
                      <InfoRow label="Rate" value={formatProfessionalRate(user)} />
                      <InfoRow
                        label="Availability"
                        value={formatEnum(user.availabilityStatus || "available")}
                      />
                    </>
                  ) : (
                    <>
                      <InfoRow label="Company" value={user.companyName || "Not set"} />
                      <InfoRow label="Industry" value={user.industry || "Not set"} />
                      <InfoRow label="Projects posted" value={String(detail?.projectCount || 0)} />
                    </>
                  )}
                </DetailPanel>
                <DetailPanel title="Project Status">
                  <InfoRow label="Active" value={String(detail?.activeProjectCount || 0)} />
                  <InfoRow label="Completed" value={String(detail?.completedProjectCount || 0)} />
                  <InfoRow
                    label="Other / unassigned"
                    value={String(
                      Math.max(
                        0,
                        (detail?.projectCount || 0) -
                          (detail?.activeProjectCount || 0) -
                          (detail?.completedProjectCount || 0),
                      ),
                    )}
                  />
                </DetailPanel>
                <DetailPanel title="Money Summary">
                  <InfoRow
                    label={isProfessional ? "Gross earnings" : "Completed payments"}
                    value={formatMoney(detail?.totalMoney || 0)}
                  />
                  {isProfessional ? (
                    <InfoRow
                      label="Estimated net after 10% fee"
                      value={formatMoney((detail?.totalMoney || 0) * 0.9)}
                    />
                  ) : null}
                  <InfoRow label="Transactions" value={String(detail?.transactions.length || 0)} />
                </DetailPanel>
                <DetailPanel title="Security \u0026 Access Control" className="md:col-span-2 bg-primary/[0.02]">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6 rounded-2xl border border-primary/20 bg-primary/5 p-6 shadow-sm">
                    <div>
                      <p className="text-lg font-bold text-primary flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5" />
                        Account Active Status
                      </p>
                      <p className="mt-1 text-sm text-primary/70 font-medium">
                        {user.isActive
                          ? "User has full access to the platform."
                          : "User is currently blocked from signing in."}
                      </p>
                    </div>
                    <Switch
                      checked={user.isActive}
                      disabled={pendingAction !== null}
                      onCheckedChange={(checked) => void onStatusChange(user, checked)}
                      className="data-[state=checked]:bg-primary"
                      aria-label={`${user.isActive ? "Deactivate" : "Activate"} ${fullName}`}
                    />
                  </div>

                  <form className="mt-8 space-y-5 border-t border-border pt-8" onSubmit={submitPasswordChange}>
                    <div className="flex items-center gap-3">
                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-100 text-amber-700">
                        <KeyRound className="h-4 w-4" />
                      </div>
                      <p className="text-lg font-bold text-foreground">Reset User Password</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">New Password</label>
                        <Input
                          type="password"
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                          placeholder="••••••••"
                          className="h-12 rounded-xl"
                          autoComplete="new-password"
                          disabled={passwordPending}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Confirm Password</label>
                        <Input
                          type="password"
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          placeholder="••••••••"
                          className="h-12 rounded-xl"
                          autoComplete="new-password"
                          disabled={passwordPending}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium italic">
                      Security tip: Use 8+ characters with mixed case, numbers, and symbols.
                    </p>
                    {passwordMessage && (
                      <div className={cn(
                        "rounded-xl p-4 text-sm font-bold flex items-center gap-2 animate-in fade-in duration-300",
                        passwordMessage.type === "error" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      )}>
                        {passwordMessage.type === "error" ? <ShieldCheck className="h-4 w-4 text-rose-600" /> : <ShieldCheck className="h-4 w-4" />}
                        {passwordMessage.text}
                      </div>
                    )}
                    <Button
                      type="submit"
                      size="lg"
                      className="h-12 px-8 rounded-xl font-bold"
                      disabled={passwordPending || !newPassword || !confirmPassword}
                    >
                      {passwordPending
                        ? "UPDATING PASSWORD..."
                        : user.hasPassword
                          ? "UPDATE USER PASSWORD"
                          : "SET INITIAL PASSWORD"}
                    </Button>
                  </form>
                </DetailPanel>
              </div>
            </TabsContent>

            <TabsContent value="projects" className="mt-8">
              <div className="grid gap-4">
                {detail?.projects.length ? (
                  detail.projects.map((project) => (
                    <div key={project.id} className="group rounded-2xl border border-border p-5 hover:border-primary/30 transition-all hover:bg-muted/30">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{project.title}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground font-medium">
                            <span className="flex items-center gap-1.5"><FolderKanban className="h-3.5 w-3.5" />{project.category}</span>
                            <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{formatDate(project.createdAt)}</span>
                          </div>
                        </div>
                        <Badge variant="outline" className="rounded-lg px-3 py-1 font-bold uppercase tracking-widest text-[10px]">
                          {formatEnum(project.trackingStatus || project.status)}
                        </Badge>
                      </div>
                      <div className="mt-5 grid gap-4 sm:grid-cols-2 rounded-xl bg-background p-4 border border-border/50">
                        <InfoRow
                          label={isProfessional ? "Client Account" : "Hired Professional"}
                          value={project.counterpartName || "Not assigned"}
                        />
                        <InfoRow
                          label="Agreed Budget"
                          value={
                            project.agreedAmount ? formatMoney(project.agreedAmount) : "Not set"
                          }
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState message="No projects are connected to this user yet." />
                )}
              </div>
            </TabsContent>

            <TabsContent value="payments" className="mt-8">
              <div className="grid gap-4">
                {detail?.transactions.length ? (
                  detail.transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="group flex flex-col justify-between gap-4 rounded-2xl border border-border p-6 sm:flex-row sm:items-center hover:border-emerald-200 hover:bg-emerald-50/30 transition-all"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                            <Wallet className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-bold text-foreground group-hover:text-emerald-700 transition-colors">{transaction.projectTitle}</p>
                            <p className="text-sm text-muted-foreground font-medium mt-0.5">
                              {isProfessional ? "From Client" : "To Professional"}:{" "}
                              <span className="text-foreground">{transaction.counterpartName}</span> · {formatDateTime(transaction.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-left sm:text-right shrink-0">
                        <p className="text-2xl font-bold tracking-tight text-foreground">
                          {formatMoney(transaction.amount, transaction.currency)}
                        </p>
                        <Badge variant={transaction.status === "COMPLETED" ? "default" : "outline"} className="mt-1 rounded-lg uppercase tracking-widest text-[9px] px-2">
                          {formatEnum(transaction.status)}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState message="No payment transactions are recorded for this user." />
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="group rounded-2xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

function DetailPanel({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-border p-6 shadow-sm bg-card", className)}>
      <h3 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2 mb-5">
        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span className="text-right font-bold text-foreground">{value}</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center text-sm font-medium text-muted-foreground bg-muted/10">
      <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Search className="h-6 w-6 text-muted-foreground/50" />
      </div>
      {message}
    </div>
  );
}

function UserDetails({ user }: { user: AdminUserRecord }) {
  if (user.role === "CLIENT") {
    return (
      <div className="mt-4 grid gap-3 text-sm text-muted-foreground font-medium sm:grid-cols-2">
        <Detail icon={Building2} label={user.companyName || "No company added"} />
        <Detail icon={BriefcaseBusiness} label={user.industry || "Industry not set"} />
        <Detail icon={ShieldCheck} label={`Joined ${formatDate(user.createdAt)}`} />
        <Detail icon={UserRound} label={formatEnum(user.authProvider)} />
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-3 text-sm text-muted-foreground font-medium sm:grid-cols-2">
      <Detail icon={BriefcaseBusiness} label={user.professionalCategory || "Category not set"} />
      <Detail icon={MapPin} label={user.professionalCity || "City not set"} />
      <Detail icon={Wallet} label={formatProfessionalRate(user)} />
      <Detail
        icon={Star}
        label={`${user.averageRating.toFixed(1)} rating / ${user.reviewCount} reviews`}
      />
      <Detail icon={ShieldCheck} label={`Joined ${formatDate(user.createdAt)}`} />
      <Detail icon={UserRound} label={formatEnum(user.availabilityStatus || "available")} />
    </div>
  );
}

function Detail({ icon: Icon, label }: { icon: typeof Users; label: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-primary/50" />
      <span className="truncate">{label}</span>
    </span>
  );
}

function filterUsers(users: AdminUserRecord[], query: string) {
  const term = query.trim().toLowerCase();

  if (!term) {
    return users;
  }

  return users.filter((user) =>
    [
      user.firstName,
      user.lastName,
      user.email,
      user.phone,
      user.companyName,
      user.industry,
      user.professionalCategory,
      user.professionalCity,
      user.availabilityStatus,
      user.authProvider,
      user.isActive ? "active" : "inactive",
      user.isVerified ? "verified" : "pending",
    ]
      .join(" ")
      .toLowerCase()
      .includes(term),
  );
}

function activeCount(users: AdminUserRecord[]) {
  return users.filter((user) => user.isActive).length;
}

function getFullName(user: AdminUserRecord) {
  return `${user.firstName} ${user.lastName}`.trim() || user.email;
}

function formatProfessionalRate(user: AdminUserRecord) {
  if (user.hourlyRate) {
    return `$${user.hourlyRate.toLocaleString()}/hr`;
  }

  if (user.fixedRate) {
    return `$${user.fixedRate.toLocaleString()} fixed`;
  }

  return "Rate not set";
}

function formatSignInMethod(user: AdminUserRecord) {
  if (user.authProvider === "GOOGLE" && user.hasPassword) {
    return "Google + password";
  }

  return user.hasPassword ? "Password" : formatEnum(user.authProvider);
}

function validatePassword(password: string) {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must include one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must include one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include one number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include one special character.";
  return null;
}
