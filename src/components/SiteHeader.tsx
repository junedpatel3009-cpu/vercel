import { createServerFn } from "@tanstack/react-start";
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { Menu, X, LogOut, User } from "lucide-react";
import { getCurrentUser } from "@/lib/current-user.server";
import { logoutAction } from "@/lib/logout.server";
import type { PublicUser } from "@/lib/user-db.server";

const links = [
  { to: "/", label: "Home" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/services", label: "Services" },
  { to: "/for-clients", label: "For Clients" },
  { to: "/for-professionals", label: "For Professionals" },
  { to: "/pricing", label: "Pricing" },
  { to: "/faq", label: "FAQ" },
];

interface SiteHeaderProps {
  user?: PublicUser | null;
  onLogout?: () => Promise<{ ok: true }>;
}

const getSiteHeaderUser = createServerFn({ method: "GET" }).handler(async () => getCurrentUser());

export function SiteHeader({ user, onLogout }: SiteHeaderProps) {
  const [open, setOpen] = useState(false);
  const [viewer, setViewer] = useState<PublicUser | null>(user ?? null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const path = useRouterState({ select: (state) => state.location.pathname });
  const profileHref =
    viewer?.role === "ADMIN"
      ? "/"
      : viewer?.role === "CLIENT"
        ? "/my-info"
        : "/professional-profile";
  const isActiveLink = (to: string) => (to === "/" ? path === "/" : path.startsWith(to));

  useEffect(() => {
    if (user !== undefined) {
      setViewer(user);
      return;
    }

    let cancelled = false;

    getSiteHeaderUser()
      .then((currentUser) => {
        if (!cancelled) {
          setViewer(currentUser);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setViewer(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const result = onLogout ? await onLogout() : await logoutAction();
      if (result.ok) {
        window.location.assign("/login");
      }
    } catch (error) {
      console.error("Logout failed:", error);
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Logo linked={false} />
          <nav className="hidden items-center gap-6 lg:flex">
            {links.map((l) => {
              const active = isActiveLink(l.to);

              return (
                <Link
                  key={l.to}
                  to={l.to as any}
                  className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="hidden items-center gap-2 lg:flex">
          {viewer ? (
            <>
              <Button asChild variant="outline" size="sm">
                <Link
                  to={profileHref as any}
                  className={`flex items-center gap-2 ${
                    isActiveLink(profileHref) ? "text-primary" : ""
                  }`}
                >
                  <User className="h-4 w-4" />
                  Profile
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                {isLoggingOut ? "Logging out..." : "Logout"}
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant={isActiveLink("/login") ? "outline" : "ghost"} size="sm">
                <Link to="/login" className={isActiveLink("/login") ? "text-primary" : ""}>
                  Log in
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/signup" className={isActiveLink("/signup") ? "text-primary" : ""}>
                  Sign up
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="bg-cta text-cta-foreground hover:bg-cta/90 shadow-soft"
              >
                <Link to="/post-job">Post a Job</Link>
              </Button>
            </>
          )}
        </div>
        <button className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-border bg-background lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {links.map((l) => {
              const active = isActiveLink(l.to);

              return (
                <Link
                  key={l.to}
                  to={l.to as any}
                  className={`rounded-md px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-foreground hover:bg-muted"
                  }`}
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </Link>
              );
            })}
            <div className="mt-2 flex flex-col gap-2">
              {viewer ? (
                <>
                  <Button asChild variant="outline" size="sm">
                    <Link to={profileHref as any} onClick={() => setOpen(false)}>
                      <User className="h-4 w-4 mr-2" />
                      Profile
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setOpen(false);
                      handleLogout();
                    }}
                    className="justify-start"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/login">Log in</Link>
                  </Button>
                  <Button asChild size="sm" className="bg-cta text-cta-foreground hover:bg-cta/90">
                    <Link to="/post-job">Post a Job</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
