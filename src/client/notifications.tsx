import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, redirect, useLoaderData, useRouter } from "@tanstack/react-router";
import {
  BellOff,
  BellRing,
  Briefcase,
  CheckCheck,
  FileText,
  MessageSquare,
  Star,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/current-user.server";
import {
  clearUserNotifications,
  getUserNotifications,
  markUserNotificationsRead,
  type NotificationType,
  type UserNotification,
} from "@/lib/notification-db.server";
import type { PublicUser } from "@/lib/user-db.server";
import {
  getUserNotificationPreferences,
  updateUserNotificationPreferencesByUserId,
} from "@/lib/user-db.server";

const tabs = ["All", "Projects", "Work", "Messages", "Payments", "Reviews"] as const;

const getNotificationsPageData = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = getCurrentUser();

  if (!viewer) {
    return null;
  }

  return {
    viewer,
    notifications: getUserNotifications(viewer.id, viewer.role),
    preferences: getUserNotificationPreferences(viewer.id),
  };
});

const markNotificationsRead = createServerFn({ method: "POST" }).handler(async () => {
  const viewer = getCurrentUser();

  if (!viewer) {
    throw new Error("Please log in to update notifications.");
  }

  markUserNotificationsRead(viewer.id, viewer.role);
});

const clearNotifications = createServerFn({ method: "POST" }).handler(async () => {
  const viewer = getCurrentUser();

  if (!viewer) {
    throw new Error("Please log in to clear notifications.");
  }

  clearUserNotifications(viewer.id, viewer.role);
});

const updateBrowserNotifications = createServerFn({ method: "POST" })
  .inputValidator((input: { enabled: boolean }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();

    if (!viewer) {
      throw new Error("Please log in to update notifications.");
    }

    return updateUserNotificationPreferencesByUserId({
      userId: viewer.id,
      browserNotificationsEnabled: data.enabled,
      projectActivityNotificationsEnabled: data.enabled,
    });
  });

export const Route = createFileRoute("/notifications")({
  beforeLoad: async ({ location }) => {
    const data = await getNotificationsPageData();

    if (!data) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }
  },
  loader: () => getNotificationsPageData(),
  head: () => ({ meta: [{ title: "Notifications - Servio" }] }),
  component: Notifications,
});

function Notifications() {
  const data = useLoaderData({ from: "/notifications" }) as {
    viewer: PublicUser;
    notifications: UserNotification[];
    preferences: {
      emailNotificationsEnabled: boolean;
      browserNotificationsEnabled: boolean;
      projectActivityNotificationsEnabled: boolean;
    };
  };
  const router = useRouter();
  const [tab, setTab] = useState<(typeof tabs)[number]>("All");
  const [isUpdating, setIsUpdating] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");
  const notifications = data.notifications;
  const filtered = notifications.filter((notification) => matchesTab(notification.type, tab));
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const userName =
    `${data.viewer.firstName} ${data.viewer.lastName}`.trim() || data.viewer.email || "User";
  const userRole =
    data.viewer.role === "ADMIN"
      ? "Admin"
      : data.viewer.role === "PROFESSIONAL"
        ? "Professional"
        : "Client";
  const browserAlertsOn =
    data.preferences.browserNotificationsEnabled &&
    data.preferences.projectActivityNotificationsEnabled &&
    browserPermission === "granted";

  useEffect(() => {
    setBrowserPermission("Notification" in window ? Notification.permission : "unsupported");
  }, []);

  const runAction = async (action: "read" | "clear") => {
    setIsUpdating(true);

    try {
      if (action === "read") {
        await markNotificationsRead();
      } else {
        await clearNotifications();
      }

      await router.invalidate();
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleBrowserAlerts = async () => {
    if (!("Notification" in window)) {
      setBrowserPermission("unsupported");
      return;
    }

    setIsUpdating(true);

    try {
      let permission = Notification.permission;

      if (permission === "default") {
        permission = await Notification.requestPermission();
        setBrowserPermission(permission);
      }

      const enabled = permission === "granted" && !browserAlertsOn;
      await updateBrowserNotifications({ data: { enabled } });
      await router.invalidate();
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <AppShell userName={userName} userRole={userRole} userAvatarUrl={data.viewer.avatarUrl}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
            {unreadCount ? <Badge>{unreadCount} unread</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Database updates for messages, project requests, uploaded work, and account activity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!notifications.length || isUpdating}
            onClick={() => void runAction("read")}
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!notifications.length || isUpdating}
            onClick={() => void runAction("clear")}
          >
            <BellOff className="h-4 w-4" />
            Clear
          </Button>
          <Button
            variant={browserAlertsOn ? "default" : "outline"}
            size="sm"
            className="gap-2"
            disabled={
              isUpdating || browserPermission === "denied" || browserPermission === "unsupported"
            }
            onClick={() => void toggleBrowserAlerts()}
          >
            <BellRing className="h-4 w-4" />
            {browserAlertsOn ? "Browser alerts on" : "Enable browser alerts"}
          </Button>
        </div>
      </div>

      <div className="mb-6 grid gap-3 rounded-lg border border-border bg-card p-4 text-sm shadow-soft sm:grid-cols-2">
        <div>
          <p className="font-medium">Email notifications</p>
          <p className="mt-1 text-muted-foreground">
            {data.preferences.emailNotificationsEnabled
              ? "Project requests, acceptances, and status updates can be sent to your account email."
              : "Email notifications are off in your profile settings."}
          </p>
        </div>
        <div>
          <p className="font-medium">Browser notifications</p>
          <p className="mt-1 text-muted-foreground">
            {browserPermission === "denied"
              ? "Browser permission is blocked. Enable it from your browser site settings."
              : browserPermission === "unsupported"
                ? "This browser does not support desktop notifications."
                : browserAlertsOn
                  ? "Realtime project activity can appear as browser alerts."
                  : "Enable alerts to see realtime project activity while Servio is open."}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-soft">
        <div className="flex gap-1 overflow-x-auto border-b border-border p-2">
          {tabs.map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === item
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {filtered.length ? (
          <ul className="divide-y divide-border">
            {filtered.map((notification) => {
              const Icon = iconFor(notification.type);
              const unread = !notification.readAt;

              return (
                <li
                  key={notification.key}
                  className={`flex flex-col gap-4 p-5 transition-colors hover:bg-muted/40 sm:flex-row ${
                    unread ? "bg-primary/[0.03]" : ""
                  }`}
                >
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tintFor(
                      notification.type,
                    )}`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{notification.title}</p>
                      {unread ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{notification.description}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatNotificationTime(notification.createdAt)}
                    </p>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="self-start">
                    <a href={notification.href}>View</a>
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="grid place-items-center px-6 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <BellOff className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">No notifications</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              New messages, project requests, accepted work, and uploaded files will appear here.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function matchesTab(type: NotificationType, tab: (typeof tabs)[number]) {
  if (tab === "All") {
    return true;
  }

  if (tab === "Projects") {
    return type === "project";
  }

  if (tab === "Work") {
    return type === "work";
  }

  if (tab === "Messages") {
    return type === "message";
  }

  if (tab === "Payments") {
    return type === "payment";
  }

  return type === "review";
}

function iconFor(type: NotificationType) {
  if (type === "project") {
    return Briefcase;
  }

  if (type === "work") {
    return FileText;
  }

  if (type === "message") {
    return MessageSquare;
  }

  if (type === "payment") {
    return Wallet;
  }

  return Star;
}

function tintFor(type: NotificationType) {
  if (type === "project") {
    return "bg-primary/10 text-primary";
  }

  if (type === "work") {
    return "bg-blue-50 text-blue-700";
  }

  if (type === "message") {
    return "bg-success/15 text-success";
  }

  if (type === "payment") {
    return "bg-warning/15 text-warning-foreground";
  }

  return "bg-muted text-muted-foreground";
}

function formatNotificationTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
