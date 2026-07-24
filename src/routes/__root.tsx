import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useLocation,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { Provider } from "react-redux";
import { toast } from "sonner";

import appCss from "../styles.css?url";
import { store } from "@/store";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import type { WebsitePageRecord } from "@/lib/website-page-cms.server";

const loadPublishedEditorPages = createServerFn({ method: "GET" }).handler(async () => {
  const { listPublishedWebsitePages } = await import("@/lib/website-page-cms.server");
  return listPublishedWebsitePages();
});

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: () => loadPublishedEditorPages(),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Servio — Hire trusted professionals near you" },
      {
        name: "description",
        content:
          "Servio is the trusted marketplace to post jobs, hire vetted professionals, track work and manage payments — all in one place.",
      },
      { name: "author", content: "Servio" },
      { property: "og:title", content: "Servio — Hire trusted professionals near you" },
      {
        property: "og:description",
        content: "Post jobs, hire experts, track work and manage projects in one platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pages = Route.useLoaderData() as WebsitePageRecord[];
  const location = useLocation();
  // Home contains live jobs and professionals. Its CMS content is integrated
  // inside the real route instead of replacing the complete React page.
  const editorPage =
    location.pathname === "/" ? undefined : pages.find((page) => page.path === location.pathname);

  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ActivityToastListener />
        {editorPage ? <PublishedEditorPage page={editorPage} /> : <Outlet />}
        <Toaster position="bottom-right" richColors closeButton />
      </QueryClientProvider>
    </Provider>
  );
}

function PublishedEditorPage({ page }: { page: WebsitePageRecord }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="cms-old" dangerouslySetInnerHTML={{ __html: page.content }} />
      <SiteFooter />
    </div>
  );
}

function ActivityToastListener() {
  const lastToastRef = useRef<{ label: string; shownAt: number } | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const actionElement = target.closest<HTMLElement>(
        "a[href], button, [role='button'], [data-activity-toast]",
      );

      if (!actionElement || shouldSkipActivityToast(actionElement)) {
        return;
      }

      const label = getActivityLabel(actionElement);
      const message = label ? getActivityMessage(label, actionElement) : "";

      if (!message) {
        return;
      }

      const now = Date.now();
      const lastToast = lastToastRef.current;

      if (lastToast?.label === message && now - lastToast.shownAt < 900) {
        return;
      }

      lastToastRef.current = { label: message, shownAt: now };
      toast.info(message, { duration: 1500 });
    };

    document.addEventListener("click", onClick, true);

    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}

function shouldSkipActivityToast(element: HTMLElement) {
  if (
    element.dataset.noActivityToast === "true" ||
    element.getAttribute("aria-disabled") === "true" ||
    element.closest("[data-no-activity-toast='true']")
  ) {
    return true;
  }

  if (element instanceof HTMLButtonElement && element.disabled) {
    return true;
  }

  const label = getActivityLabel(element).toLowerCase();
  const ignoredLabels = new Set([
    "",
    "toggle menu",
    "hide call popup",
    "close message popup",
    "close notification popup",
    "close",
  ]);

  return ignoredLabels.has(label);
}

function getActivityLabel(element: HTMLElement) {
  return (
    element.dataset.activityToast ||
    element.getAttribute("aria-label") ||
    element.textContent ||
    ""
  )
    .replace(/\s+/g, " ")
    .trim();
}

function getActivityMessage(label: string, element: HTMLElement) {
  const normalized = label.toLowerCase();
  const href = element instanceof HTMLAnchorElement ? element.getAttribute("href") || "" : "";

  if (normalized.includes("track project") || href.includes("project-track")) {
    return "Tracking project";
  }

  if (normalized.includes("view profile") || href.includes("/pro/")) {
    return "Opening profile";
  }

  if (normalized.includes("view job") || href.includes("/job/")) {
    return "Opening job";
  }

  if (
    normalized.includes("open messages") ||
    normalized === "message" ||
    href.includes("messages")
  ) {
    return "Opening messages";
  }

  if (normalized.includes("notification")) {
    return "Opening notification";
  }

  if (normalized.startsWith("save") || normalized.includes(" save")) {
    return "Saving";
  }

  if (normalized.startsWith("apply") || normalized.includes("apply")) {
    return "Applying";
  }

  if (normalized.startsWith("accept")) {
    return "Accepting request";
  }

  if (normalized.startsWith("reject") || normalized.startsWith("decline")) {
    return "Declining request";
  }

  if (normalized.startsWith("start")) {
    return "Starting project";
  }

  if (normalized.startsWith("cancel")) {
    return "Cancelling";
  }

  if (normalized.startsWith("delete") || normalized.startsWith("remove")) {
    return "Removing";
  }

  if (normalized.startsWith("clear")) {
    return "Clearing";
  }

  if (normalized.startsWith("mark all read")) {
    return "Marking notifications read";
  }

  if (normalized.startsWith("post")) {
    return "Opening post job";
  }

  if (normalized.startsWith("view") || normalized.startsWith("open")) {
    return `Opening ${label.replace(/^(view|open)\s+/i, "").toLowerCase() || "page"}`;
  }

  if (element instanceof HTMLAnchorElement) {
    return `Opening ${label.toLowerCase()}`;
  }

  return `${label} selected`;
}
