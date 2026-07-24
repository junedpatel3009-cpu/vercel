import { createFileRoute, redirect, useLoaderData, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { BellRing, Briefcase, CheckCheck, Trash2, UserPlus, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/current-user.server";
import {
  clearUserNotifications,
  getUserNotifications,
  markUserNotificationsRead,
  type UserNotification,
} from "@/lib/notification-db.server";

const getAdminNotifications = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = getCurrentUser();

  if (!viewer || viewer.role !== "ADMIN") {
    return null;
  }

  return {
    viewer,
    notifications: getUserNotifications(viewer.id, "ADMIN"),
  };
});

const markAdminNotificationsRead = createServerFn({ method: "POST" }).handler(async () => {
  const viewer = getCurrentUser();

  if (!viewer || viewer.role !== "ADMIN") {
    throw new Error("Admin access required.");
  }

  markUserNotificationsRead(viewer.id, "ADMIN");
});

const clearAdminNotifications = createServerFn({ method: "POST" }).handler(async () => {
  const viewer = getCurrentUser();

  if (!viewer || viewer.role !== "ADMIN") {
    throw new Error("Admin access required.");
  }

  clearUserNotifications(viewer.id, "ADMIN");
});

export const Route = createFileRoute("/admin-notifications")({
  beforeLoad: async () => {
    if (!(await getAdminNotifications())) {
      throw redirect({ to: "/admin" });
    }
  },
  loader: () => getAdminNotifications(),
  head: () => ({ meta: [{ title: "Admin Notifications - Servio" }] }),
  component: AdminNotifications,
});

const filters = ["All", "Users", "Jobs", "Disputes", "Payments"] as const;
type Filter = (typeof filters)[number];

function AdminNotifications() {
  const data = useLoaderData({ from: "/admin-notifications" })!;
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("All");
  const [updating, setUpdating] = useState(false);
  const notifications = data.notifications as UserNotification[];
  const visible = notifications.filter((notification) => matchesFilter(notification, filter));
  const unread = notifications.filter((notification) => !notification.readAt).length;
  const userName = `${data.viewer.firstName} ${data.viewer.lastName}`.trim() || data.viewer.email;

  useEffect(() => {
    const refresh = () => void router.invalidate();
    window.addEventListener("servio:notifications-refreshed", refresh);
    return () => window.removeEventListener("servio:notifications-refreshed", refresh);
  }, [router]);

  async function runAction(action: "read" | "clear") {
    setUpdating(true);
    try {
      if (action === "read") {
        await markAdminNotificationsRead();
      } else {
        await clearAdminNotifications();
      }
      await router.invalidate();
    } finally {
      setUpdating(false);
    }
  }

  return (
    <AppShell userName={userName} userRole="Admin" userAvatarUrl={data.viewer.avatarUrl}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Admin panel
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Live platform activity for users, jobs, disputes, and payments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={updating || unread === 0}
            onClick={() => runAction("read")}
          >
            <CheckCheck className="mr-2 h-4 w-4" /> Mark all read
          </Button>
          <Button
            variant="outline"
            disabled={updating || notifications.length === 0}
            onClick={() => runAction("clear")}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Clear all
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((item) => (
          <Button
            key={item}
            size="sm"
            variant={filter === item ? "default" : "outline"}
            onClick={() => setFilter(item)}
          >
            {item}
          </Button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        {visible.length ? (
          <div className="divide-y divide-border">
            {visible.map((notification) => {
              const Icon = getNotificationIcon(notification);
              return (
                <a
                  key={notification.key}
                  href={notification.href}
                  className="flex gap-4 p-4 transition-colors hover:bg-muted/40"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{notification.title}</p>
                      {!notification.readAt ? <Badge>New</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{notification.description}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatDateTime(notification.createdAt)}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>
        ) : (
          <div className="grid place-items-center px-4 py-16 text-center">
            <BellRing className="h-10 w-10 text-muted-foreground" />
            <p className="mt-4 font-semibold">No notifications found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              New admin activity will appear here instantly.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function matchesFilter(notification: UserNotification, filter: Filter) {
  if (filter === "All") return true;
  if (filter === "Users") return notification.key.startsWith("admin:user:");
  if (filter === "Jobs") return notification.key.startsWith("admin:job:");
  if (filter === "Disputes") return notification.key.startsWith("admin:dispute:");
  return notification.key.startsWith("admin:payment:");
}

function getNotificationIcon(notification: UserNotification) {
  if (notification.key.startsWith("admin:user:")) return UserPlus;
  if (notification.key.startsWith("admin:job:")) return Briefcase;
  if (notification.key.startsWith("admin:payment:")) return Wallet;
  return BellRing;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
