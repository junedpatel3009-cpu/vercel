import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Logo } from "./Logo";
import { Bell, Phone, PhoneOff, Search, Video, X } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Wallet,
  BellRing,
  PlusCircle,
  MessageSquare,
  BadgeCheck,
  Home,
  Briefcase,
  User,
  ShieldCheck,
  UserCog,
  Globe,
  LayoutTemplate,
  ArrowRight,
  FileText,
  Star,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/current-user.server";
import { getUserNotifications, type UserNotification } from "@/lib/notification-db.server";
import { getUserNotificationPreferences, type PublicUser } from "@/lib/user-db.server";

const NOTIFICATION_POPUP_MS = 3000;

const getNotificationSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = getCurrentUser();

  if (!viewer) {
    return {
      viewerId: null,
      viewerRole: null,
      unreadCount: 0,
      latest: null,
      unread: [],
      preferences: {
        emailNotificationsEnabled: true,
        browserNotificationsEnabled: false,
        projectActivityNotificationsEnabled: true,
      },
    };
  }

  const notifications = getUserNotifications(viewer.id, viewer.role);
  const preferences = getUserNotificationPreferences(viewer.id);
  const unread = notifications.filter((notification) => !notification.readAt);

  return {
    viewerId: viewer.id,
    viewerRole: viewer.role,
    unreadCount: unread.length,
    latest: unread[0] ?? notifications[0] ?? null,
    unread: unread.slice(0, 100),
    preferences,
  };
});

const getRealtimeViewer = createServerFn({ method: "GET" }).handler(async () => getCurrentUser());

const loadNotificationPanelData = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = getCurrentUser();

  if (!viewer) {
    return { notifications: [] as NotificationPopup[] };
  }

  const notifications = getUserNotifications(viewer.id, viewer.role);
  return { notifications: notifications.slice(0, 3) };
});

type LiveMessage = {
  id: string;
  conversationId: string;
  senderId: number;
  receiverId: number;
  body: string;
  kind?: "text" | "call" | "attachment";
  createdAt: string;
};

type ConversationUpsertPayload = {
  conversationId: string;
  message: LiveMessage;
  fromUser?: {
    id: number;
    name: string;
    avatarUrl?: string | null;
  };
  job?: string;
};

type CallSignalPayload = {
  callId: string;
  conversationId: string;
  fromUserId: number;
  toUserId: number;
  mode?: "voice" | "video";
  fromName?: string;
  fromAvatarUrl?: string | null;
  job?: string;
  offer?: RTCSessionDescriptionInit;
};

type ProjectActivityPayload = {
  trackingId: number;
  actorId: number;
  recipientId?: number | null;
  title: string;
  description?: string;
  href?: string;
  createdAt?: string;
};

type MessagePopup = {
  id: string;
  title: string;
  description: string;
  href: string;
  avatarUrl?: string | null;
};

type NotificationPopup = Pick<
  UserNotification,
  "key" | "title" | "description" | "href" | "type" | "createdAt"
>;
type NotificationPreferences = {
  emailNotificationsEnabled: boolean;
  browserNotificationsEnabled: boolean;
  projectActivityNotificationsEnabled: boolean;
};

const clientItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/my-info", icon: User, label: "My info" },
  { to: "/discover", icon: Users, label: "Find pros" },
  { to: "/post-job", icon: PlusCircle, label: "Post a job" },
  { to: "/projects", icon: FolderKanban, label: "Projects" },
  { to: "/messages", icon: MessageSquare, label: "Messages" },
  { to: "/earnings", icon: Wallet, label: "Earnings" },
  { to: "/client-reports", icon: FileText, label: "Reports" },
];

const professionalItems = [
  { to: "/professional-profile", icon: User, label: "Profile" },
  { to: "/professional-messages", icon: MessageSquare, label: "Messages" },
  { to: "/professional-stats", icon: Wallet, label: "My stats" },
  { to: "/professional-reports", icon: FileText, label: "Reports" },
];

const adminItems = [
  { to: "/admin", icon: ShieldCheck, label: "Admin panel" },
  { to: "/user-management", icon: UserCog, label: "User management" },
  { to: "/verification-management", icon: BadgeCheck, label: "Verification" },
  { to: "/job-management", icon: Briefcase, label: "Job & Dispute Management" },
  { to: "/earnings-reports", icon: Wallet, label: "Earnings & Payouts" },
  { to: "/admin-reports", icon: FileText, label: "Reports" },
  { to: "/admin-categories", icon: FolderKanban, label: "Categories" },
  { to: "/web-editor", icon: LayoutTemplate, label: "Web Editor" },
];

const clientMobileItems = [
  { to: "/dashboard", icon: Home, label: "Home" },
  { to: "/discover", icon: Search, label: "Search" },
  { to: "/projects", icon: Briefcase, label: "Jobs" },
  { to: "/messages", icon: MessageSquare, label: "Messages" },
  { to: "/my-info", icon: User, label: "Profile" },
  { to: "/client-reports", icon: FileText, label: "Reports" },
];

const professionalMobileItems = [
  { to: "/professional-profile", icon: User, label: "Profile" },
  { to: "/professional-messages", icon: MessageSquare, label: "Messages" },
  { to: "/professional-stats", icon: Wallet, label: "Stats" },
  { to: "/professional-reports", icon: FileText, label: "Reports" },
];

const adminMobileItems = [
  { to: "/admin", icon: ShieldCheck, label: "Admin" },
  { to: "/user-management", icon: UserCog, label: "Users" },
  { to: "/verification-management", icon: BadgeCheck, label: "Verify" },
  { to: "/job-management", icon: Briefcase, label: "Jobs" },
  { to: "/earnings-reports", icon: Wallet, label: "Payouts" },
  { to: "/admin-reports", icon: FileText, label: "Reports" },
  { to: "/admin-categories", icon: FolderKanban, label: "Categories" },
  { to: "/web-editor", icon: LayoutTemplate, label: "Editor" },
];
function normalizePath(path: string) {
  return path.replace(/\/+$/, "") || "/";
}

function isActivePath(path: string, target: string) {
  const normalizedPath = normalizePath(path);
  const normalizedTarget = normalizePath(target);
  return normalizedPath === normalizedTarget || normalizedPath.startsWith(`${normalizedTarget}/`);
}

export function AppShell({
  children,
  title,
  userName = "Alex Rivers",
  userRole = "Client",
  userAvatarUrl = "https://i.pravatar.cc/100?u=me",
}: {
  children: React.ReactNode;
  title?: string;
  userName?: string;
  userRole?: string;
  userAvatarUrl?: string | null;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const searchParam = useRouterState({
    select: (s) => (s.location.search as any).search as string | undefined,
  });
  const [globalSearch, setGlobalSearch] = useState(searchParam || "");

  useEffect(() => {
    setGlobalSearch(searchParam || "");
  }, [searchParam]);
  const isProfessional = userRole.toLowerCase() === "professional";
  const isAdmin = userRole.toLowerCase() === "admin";
  const items = isAdmin ? adminItems : isProfessional ? professionalItems : clientItems;
  const mobileItems = isAdmin
    ? adminMobileItems
    : isProfessional
      ? professionalMobileItems
      : clientMobileItems;
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [realtimeViewer, setRealtimeViewer] = useState<PublicUser | null>(null);
  const [messagePopup, setMessagePopup] = useState<MessagePopup | null>(null);
  const [notificationPopup, setNotificationPopup] = useState<NotificationPopup | null>(null);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [notificationPanelItems, setNotificationPanelItems] = useState<NotificationPopup[]>([]);
  const [notificationPanelLoading, setNotificationPanelLoading] = useState(false);
  const notificationPreferencesRef = useRef<NotificationPreferences>({
    emailNotificationsEnabled: true,
    browserNotificationsEnabled: true,
    projectActivityNotificationsEnabled: true,
  });
  const [bellBurst, setBellBurst] = useState(false);
  const [incomingCall, setIncomingCall] = useState<CallSignalPayload | null>(null);
  const latestNotificationKeyRef = useRef<string | null>(null);
  const notificationPopupTimeoutRef = useRef<number | null>(null);
  const notificationQueueRef = useRef<NotificationPopup[]>([]);
  const notificationQueueActiveRef = useRef(false);
  const displayedNotificationKeyRef = useRef<string | null>(null);
  const notificationStorageKeyRef = useRef<string | null>(null);
  const notificationSnapshotSignatureRef = useRef<string | null>(null);
  const notificationQueueTimeoutRef = useRef<number | null>(null);

  const showNotificationAlert = useCallback(
    (
      notification: NotificationPopup,
      preferences: NotificationPreferences,
      options: { showNative?: boolean } = {},
    ) => {
      if (notificationPopupTimeoutRef.current) {
        window.clearTimeout(notificationPopupTimeoutRef.current);
      }

      setBellBurst(true);
      setNotificationPopup(notification);
      displayedNotificationKeyRef.current = notification.key;
      toast.info(notification.title, {
        description: notification.description,
        duration: NOTIFICATION_POPUP_MS,
        action: {
          label: "View",
          onClick: () => window.location.assign(notification.href),
        },
      });

      if (options.showNative !== false) {
        showBrowserNotification(
          notification.title,
          notification.description,
          notification.href,
          preferences,
        );
      }

      window.setTimeout(() => setBellBurst(false), 900);
      notificationPopupTimeoutRef.current = window.setTimeout(() => {
        setNotificationPopup((current) => (current?.key === notification.key ? null : current));
        if (displayedNotificationKeyRef.current === notification.key) {
          displayedNotificationKeyRef.current = null;
        }
        notificationPopupTimeoutRef.current = null;
      }, NOTIFICATION_POPUP_MS);
    },
    [],
  );

  const showQueuedNotificationAlerts = useCallback(
    (notifications: NotificationPopup[], preferences: NotificationPreferences) => {
      const queuedKeys = new Set(
        notificationQueueRef.current.map((notification) => notification.key),
      );
      notificationQueueRef.current.push(
        ...notifications.filter(
          (notification) =>
            notification.key !== displayedNotificationKeyRef.current &&
            !queuedKeys.has(notification.key),
        ),
      );

      if (notificationQueueActiveRef.current || notificationQueueRef.current.length === 0) return;
      notificationQueueActiveRef.current = true;

      const showNext = () => {
        const next = notificationQueueRef.current.shift();
        if (!next) {
          notificationQueueActiveRef.current = false;
          return;
        }
        if (notificationStorageKeyRef.current) {
          window.localStorage.setItem(notificationStorageKeyRef.current, next.key);
        }
        showNotificationAlert(next, preferences);
        notificationQueueTimeoutRef.current = window.setTimeout(
          showNext,
          NOTIFICATION_POPUP_MS + 250,
        );
      };

      showNext();
    },
    [showNotificationAlert],
  );

  useEffect(() => {
    return () => {
      if (notificationPopupTimeoutRef.current) {
        window.clearTimeout(notificationPopupTimeoutRef.current);
      }
      if (notificationQueueTimeoutRef.current) {
        window.clearTimeout(notificationQueueTimeoutRef.current);
      }
      notificationQueueRef.current = [];
      notificationQueueActiveRef.current = false;
    };
  }, []);

  const refreshNotifications = useCallback(
    async (showToast = false) => {
      try {
        const snapshot = await getNotificationSnapshot();
        const latest = snapshot.latest;

        setUnreadNotifications(snapshot.unreadCount);
        notificationPreferencesRef.current = snapshot.preferences;
        const signature = `${snapshot.unreadCount}:${snapshot.latest?.key || "none"}`;
        if (notificationSnapshotSignatureRef.current !== signature) {
          notificationSnapshotSignatureRef.current = signature;
          window.dispatchEvent(new CustomEvent("servio:notifications-refreshed"));
        }

        if (!latest) {
          latestNotificationKeyRef.current = null;
          return;
        }

        const storageKey = snapshot.viewerId
          ? `servio:last-notification-key:${snapshot.viewerId}`
          : null;
        notificationStorageKeyRef.current = storageKey;
        const lastSeenKey = storageKey
          ? window.localStorage.getItem(storageKey)
          : latestNotificationKeyRef.current;
        const lastSeenIndex = lastSeenKey
          ? snapshot.unread.findIndex((notification) => notification.key === lastSeenKey)
          : -1;
        const missed = lastSeenKey
          ? lastSeenIndex >= 0
            ? snapshot.unread.slice(0, lastSeenIndex)
            : snapshot.unread
          : snapshot.viewerRole === "ADMIN"
            ? snapshot.unread
            : [];

        latestNotificationKeyRef.current = latest.key;

        if (!missed.length && !showToast) {
          return;
        }

        const alerts = (missed.length ? missed : snapshot.unread.slice(0, 1))
          .slice()
          .reverse()
          .map(({ key, title, description, href, type }) => {
            const notification: NotificationPopup = {
              key,
              title,
              description,
              href,
              type,
              createdAt: new Date().toISOString(),
            };
            return notification;
          });
        showQueuedNotificationAlerts(alerts, snapshot.preferences);
      } catch {
        setUnreadNotifications(0);
      }
    },
    [showQueuedNotificationAlerts],
  );

  useEffect(() => {
    void refreshNotifications(false);
    const interval = window.setInterval(() => void refreshNotifications(false), 15000);
    const onFocus = () => void refreshNotifications(false);
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [path, refreshNotifications]);

  useEffect(() => {
    let active = true;

    getRealtimeViewer()
      .then((viewer) => {
        if (active) {
          setRealtimeViewer(viewer);
        }
      })
      .catch(() => {
        if (active) {
          setRealtimeViewer(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!realtimeViewer) {
      return;
    }

    const socket = io(getSocketUrl(), {
      auth: {
        userId: realtimeViewer.id,
        role: realtimeViewer.role,
        name:
          `${realtimeViewer.firstName} ${realtimeViewer.lastName}`.trim() || realtimeViewer.email,
        avatarUrl: realtimeViewer.avatarUrl,
      },
    });

    socket.emit("notifications:subscribe", {
      userId: realtimeViewer.id,
      role: realtimeViewer.role,
    });

    if (realtimeViewer.role === "ADMIN") {
      socket.emit("admin:subscribe");
    }

    socket.on("notifications:refresh", () => {
      void refreshNotifications(false);
    });

    socket.on("admin:refresh", () => {
      if (realtimeViewer.role === "ADMIN") {
        void refreshNotifications(true);
      }
    });

    socket.on("project:activity", (payload: ProjectActivityPayload) => {
      if (!payload?.title || payload.actorId === realtimeViewer.id) {
        return;
      }

      const preferences = notificationPreferencesRef.current;

      if (!preferences.projectActivityNotificationsEnabled) {
        void refreshNotifications(false);
        return;
      }

      setUnreadNotifications((count) => count + 1);
      showNotificationAlert(
        {
          key: `project-activity:${payload.actorId}:${payload.createdAt || new Date().toISOString()}`,
          title: payload.title,
          description: payload.description || "",
          href: payload.href || "/notifications",
          type: "project",
          createdAt: payload.createdAt || new Date().toISOString(),
        },
        preferences,
      );
      void refreshNotifications(false);
    });

    socket.on("conversation:upsert", (payload: ConversationUpsertPayload) => {
      if (!payload?.message || payload.message.senderId === realtimeViewer.id) {
        return;
      }

      void refreshNotifications(true);

      if (isMessagePath(path)) {
        return;
      }

      const href = realtimeViewer.role === "PROFESSIONAL" ? "/professional-messages" : "/messages";
      setUnreadNotifications((count) => count + 1);
      setMessagePopup({
        id: payload.message.id,
        title: `New message from ${payload.fromUser?.name || "Someone"}`,
        description: getMessagePreview(payload.message, payload.job),
        href,
        avatarUrl: payload.fromUser?.avatarUrl || null,
      });

      window.setTimeout(() => {
        setMessagePopup((current) => (current?.id === payload.message.id ? null : current));
      }, 2000);
    });

    socket.on("call:incoming", (payload: CallSignalPayload) => {
      if (
        !payload?.callId ||
        !payload.conversationId ||
        payload.fromUserId === realtimeViewer.id ||
        !payload.offer
      ) {
        return;
      }

      rememberIncomingCall(payload);
      setIncomingCall(payload);
    });

    socket.on("call:ended", (payload: CallSignalPayload) => {
      setIncomingCall((current) => (current?.callId === payload.callId ? null : current));
    });

    return () => {
      socket.disconnect();
    };
  }, [path, realtimeViewer, refreshNotifications, showNotificationAlert]);

  const openIncomingCall = () => {
    if (!incomingCall) {
      return;
    }

    const href = realtimeViewer?.role === "PROFESSIONAL" ? "/professional-messages" : "/messages";
    window.location.assign(href);
  };

  const loadNotificationPanel = async () => {
    setNotificationPanelLoading(true);
    try {
      const data = await loadNotificationPanelData();
      setNotificationPanelItems(data.notifications);
    } catch {
      setNotificationPanelItems([]);
    } finally {
      setNotificationPanelLoading(false);
    }
  };

  const toggleNotificationPanel = async () => {
    const nextOpen = !notificationPanelOpen;
    setNotificationPanelOpen(nextOpen);

    if (nextOpen) {
      await loadNotificationPanel();
    }
  };

  const declineIncomingCall = () => {
    if (!incomingCall || !realtimeViewer) {
      setIncomingCall(null);
      return;
    }

    const socket: Socket = io(getSocketUrl(), {
      auth: {
        userId: realtimeViewer.id,
        role: realtimeViewer.role,
        name:
          `${realtimeViewer.firstName} ${realtimeViewer.lastName}`.trim() || realtimeViewer.email,
        avatarUrl: realtimeViewer.avatarUrl,
      },
    });

    socket.emit("call:end", {
      callId: incomingCall.callId,
      conversationId: incomingCall.conversationId,
      fromUserId: realtimeViewer.id,
      toUserId: incomingCall.fromUserId,
      reason: "declined",
    });
    socket.disconnect();
    clearIncomingCall(incomingCall.callId);
    setIncomingCall(null);
  };

  return (
    <div className="min-h-screen bg-background pb-16 lg:pb-0">
      {!isProfessional ? (
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-surface lg:block">
          <div className="flex h-16 items-center px-5">
            <Logo label={isAdmin ? "Admin panel" : "Servio"} />
          </div>
          <nav className="px-3 py-2">
            {items.map((it) => {
              const active = isActivePath(path, it.to);
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground font-medium shadow-soft"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <it.icon className="h-4 w-4" />
                  {it.label}
                </Link>
              );
            })}
          </nav>
        </aside>
      ) : null}
      <div className={isProfessional ? "" : "lg:pl-64"}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
          <div className="flex flex-1 items-center gap-2">
            {isProfessional ? (
              <>
                <Button asChild variant="outline" size="sm" className="gap-2">
                  <Link to="/">
                    <Home className="h-4 w-4" />
                    Back to home
                  </Link>
                </Button>
                <div className="hidden items-center gap-2 sm:flex">
                  {professionalItems.map((item) => {
                    const active = path === item.to;
                    return (
                      <Button
                        key={item.to}
                        asChild
                        variant={active ? "default" : "ghost"}
                        size="sm"
                        className="gap-2"
                      >
                        <Link to={item.to}>
                          <item.icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      </Button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && globalSearch.trim()) {
                      void navigate({
                        to: "/discover",
                        search: { search: globalSearch.trim() },
                      });
                    }
                  }}
                  placeholder="Search jobs, professionals..."
                  className="h-9 w-full rounded-lg border border-input bg-surface pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}
          </div>
          {!isProfessional && !isAdmin ? (
            <Link to="/post-job" className="hidden sm:inline-flex">
              <Button size="sm" className="bg-cta text-cta-foreground hover:bg-cta/90">
                Post a Job
              </Button>
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => void toggleNotificationPanel()}
            className={`relative grid h-9 w-9 place-items-center rounded-lg hover:bg-muted ${
              unreadNotifications ? "text-cta" : ""
            }`}
            aria-label={
              unreadNotifications ? `${unreadNotifications} unread notifications` : "Notifications"
            }
          >
            <Bell
              className={`h-4 w-4 ${bellBurst ? "notification-bell-burst" : unreadNotifications ? "animate-pulse" : ""}`}
            />
            {unreadNotifications ? (
              <span className="absolute right-1.5 top-1.5 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cta opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-cta" />
              </span>
            ) : null}
          </button>
          <div className="flex items-center gap-2">
            <img
              src={userAvatarUrl || "https://i.pravatar.cc/100?u=me"}
              alt="me"
              className="h-8 w-8 rounded-full object-cover"
            />
            <div className="hidden text-sm leading-tight sm:block">
              <p className="font-medium">{userName}</p>
              <p className="text-xs text-muted-foreground">{userRole}</p>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {title && (
            <h1 className="font-display mb-6 text-3xl font-bold tracking-tight">{title}</h1>
          )}
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      {!isProfessional ? (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur-md lg:hidden">
          <div
            className="grid"
            style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))` }}
          >
            {mobileItems.map((it) => {
              const active = isActivePath(path, it.to);
              return (
                <Link
                  key={it.label}
                  to={it.to}
                  className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
                >
                  <it.icon className="h-5 w-5" />
                  {it.label}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}

      {notificationPanelOpen ? (
        <div className="fixed top-16 right-4 z-50 w-[min(340px,calc(100vw-2rem))] max-h-[calc(100vh-7rem)] overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
          <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-3">
            <div>
              <p className="text-sm font-semibold">Recent notifications</p>
              <p className="text-xs text-muted-foreground">Latest 3 alerts</p>
            </div>
            <button
              type="button"
              onClick={() => setNotificationPanelOpen(false)}
              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close notifications"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="divide-y divide-border">
            {notificationPanelLoading ? (
              <div className="p-3 text-sm text-muted-foreground">Loading notifications…</div>
            ) : notificationPanelItems.length ? (
              notificationPanelItems.map((notification) => {
                const Icon = getNotificationIcon(notification.type);
                return (
                  <div key={notification.key} className="flex items-start gap-3 px-3 py-4">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{notification.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {notification.description}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatNotificationTime(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-sm text-muted-foreground">No recent notifications.</div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-3">
            <Link
              to={isAdmin ? "/admin-notifications" : "/notifications"}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-sm text-primary-foreground transition hover:bg-primary/90"
            >
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Button variant="outline" size="sm" onClick={() => setNotificationPanelOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      ) : null}

      <RealtimePopup
        messagePopup={messagePopup}
        incomingCall={incomingCall}
        notificationPopup={notificationPopup}
        onCloseMessage={() => setMessagePopup(null)}
        onCloseNotification={() => setNotificationPopup(null)}
        onOpenCall={openIncomingCall}
        onDeclineCall={declineIncomingCall}
        onDismissCall={() => setIncomingCall(null)}
      />
    </div>
  );
}

function RealtimePopup({
  messagePopup,
  notificationPopup,
  incomingCall,
  onCloseMessage,
  onCloseNotification,
  onOpenCall,
  onDeclineCall,
  onDismissCall,
}: {
  messagePopup: MessagePopup | null;
  notificationPopup: NotificationPopup | null;
  incomingCall: CallSignalPayload | null;
  onCloseMessage: () => void;
  onCloseNotification: () => void;
  onOpenCall: () => void;
  onDeclineCall: () => void;
  onDismissCall: () => void;
}) {
  if (!messagePopup && !incomingCall && !notificationPopup) {
    return null;
  }

  return (
    <div className="fixed right-4 top-20 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-3">
      {incomingCall ? (
        <div className="overflow-hidden rounded-xl border border-primary/30 bg-card shadow-elevated">
          <div className="gradient-primary flex items-center justify-between px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              {incomingCall.mode === "video" ? (
                <Video className="h-4 w-4" />
              ) : (
                <Phone className="h-4 w-4" />
              )}
              <span className="text-sm font-semibold">
                {incomingCall.mode === "video" ? "Incoming video call" : "Incoming voice call"}
              </span>
            </div>
            <button type="button" onClick={onDismissCall} aria-label="Hide call popup">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid aspect-square place-items-center bg-muted/40 p-5 text-center">
            <div>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
                {incomingCall.mode === "video" ? (
                  <Video className="h-7 w-7" />
                ) : (
                  <Phone className="h-7 w-7" />
                )}
              </div>
              <p className="mt-4 text-lg font-semibold">{incomingCall.fromName || "Someone"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {incomingCall.job || "Direct call"}
              </p>
              {incomingCall.mode === "video" ? (
                <div className="mx-auto mt-4 h-24 w-32 rounded-lg border border-border bg-background shadow-inner" />
              ) : null}
            </div>
          </div>
          <div className="flex gap-2 border-t border-border p-3">
            <Button variant="destructive" className="flex-1 gap-2" onClick={onDeclineCall}>
              <PhoneOff className="h-4 w-4" />
              Decline
            </Button>
            <Button className="flex-1 gap-2" onClick={onOpenCall}>
              {incomingCall.mode === "video" ? (
                <Video className="h-4 w-4" />
              ) : (
                <Phone className="h-4 w-4" />
              )}
              Open
            </Button>
          </div>
        </div>
      ) : null}

      {notificationPopup ? (
        <div className="notification-to-bell rounded-xl border border-cta/30 bg-card p-4 shadow-elevated">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-cta/15 text-cta">
              <BellRing className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{notificationPopup.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {notificationPopup.description}
              </p>
              <a
                href={notificationPopup.href}
                className="mt-2 inline-flex text-sm font-medium text-primary"
              >
                Open notification
              </a>
            </div>
            <button
              type="button"
              onClick={onCloseNotification}
              aria-label="Close notification popup"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      ) : null}

      {messagePopup ? (
        <div className="rounded-xl border border-border bg-card p-4 shadow-elevated">
          <div className="flex items-start gap-3">
            <img
              src={messagePopup.avatarUrl || "https://i.pravatar.cc/100?u=message-popup"}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{messagePopup.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {messagePopup.description}
              </p>
              <a
                href={messagePopup.href}
                className="mt-2 inline-flex text-sm font-medium text-primary"
              >
                Open messages
              </a>
            </div>
            <button type="button" onClick={onCloseMessage} aria-label="Close message popup">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function isMessagePath(path: string) {
  return path === "/messages" || path === "/professional-messages";
}

function getNotificationIcon(type: string) {
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

function showBrowserNotification(
  title: string,
  description: string | undefined,
  href: string | undefined,
  preferences: NotificationPreferences,
) {
  if (
    !preferences.browserNotificationsEnabled ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  const notification = new Notification(title, {
    body: description,
    tag: href || title,
  });

  notification.onclick = () => {
    window.focus();
    if (href) {
      window.location.assign(href);
    }
    notification.close();
  };
}

function getSocketUrl() {
  return (
    import.meta.env.VITE_SOCKET_URL ||
    `${window.location.protocol}//${window.location.hostname}:4001`
  );
}

function getMessagePreview(message: LiveMessage, job?: string) {
  const body =
    message.kind === "attachment"
      ? "Sent an attachment"
      : message.kind === "call"
        ? message.body
        : message.body || "New message";

  return job ? `${job}: ${body}` : body;
}

function rememberIncomingCall(payload: CallSignalPayload) {
  try {
    sessionStorage.setItem(
      "servio:pending-incoming-call",
      JSON.stringify({ createdAt: Date.now(), call: payload }),
    );
  } catch {
    // Session storage is best-effort for moving the call into the messages page.
  }
}

function clearIncomingCall(callId: string) {
  try {
    const raw = sessionStorage.getItem("servio:pending-incoming-call");
    if (!raw) return;
    const parsed = JSON.parse(raw) as { call?: { callId?: string } };
    if (parsed.call?.callId === callId) {
      sessionStorage.removeItem("servio:pending-incoming-call");
    }
  } catch {
    sessionStorage.removeItem("servio:pending-incoming-call");
  }
}
