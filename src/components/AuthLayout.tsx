import { Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/current-user.server";
import { logoutAction } from "@/lib/logout.server";
import type { PublicUser } from "@/lib/user-db.server";
import { LogOut, Star, User } from "lucide-react";

const getAuthLayoutUser = createServerFn({ method: "GET" }).handler(async () => getCurrentUser());

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  fullWidth = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  fullWidth?: boolean;
}) {
  const [viewer, setViewer] = useState<PublicUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const profileHref =
    viewer?.role === "ADMIN"
      ? "/"
      : viewer?.role === "CLIENT"
        ? "/my-info"
        : "/professional-profile";

  useEffect(() => {
    let active = true;

    getAuthLayoutUser()
      .then((user) => {
        if (active) {
          setViewer(user);
        }
      })
      .catch(() => {
        if (active) {
          setViewer(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      const result = await logoutAction();

      if (result.ok) {
        window.location.assign("/login");
      }
    } catch (error) {
      console.error("Logout failed:", error);
      setIsLoggingOut(false);
    }
  };

  return (
    <div className={fullWidth ? "min-h-screen" : "min-h-screen lg:grid lg:grid-cols-2"}>
      <div className="flex min-h-screen flex-col px-6 py-8 lg:px-12">
        <div className="flex items-center justify-between gap-4">
          <Logo linked={false} />
          {viewer ? (
            <div className="flex items-center gap-2">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-11 rounded-2xl bg-background px-5 shadow-sm"
              >
                <Link to={profileHref as any} className="gap-2">
                  <User className="h-4 w-4" />
                  Profile
                </Link>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="h-11 rounded-2xl px-4"
              >
                <LogOut className="mr-2 h-4 w-4" />
                {isLoggingOut ? "Logging out..." : "Logout"}
              </Button>
            </div>
          ) : null}
        </div>
        <div
          className={`flex w-full flex-1 flex-col py-10 ${
            fullWidth ? "max-w-none justify-start" : "mx-auto max-w-md justify-center"
          }`}
        >
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && (
            <div
              className={`mt-6 text-sm text-muted-foreground ${fullWidth ? "text-left" : "text-center"}`}
            >
              {footer}
            </div>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground">© 2026 Servio, Inc.</p>
      </div>
      {!fullWidth ? (
        <div className="relative hidden gradient-hero lg:block">
          <div className="absolute inset-0 flex flex-col justify-between p-12">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← Back to site
            </Link>
            <div className="rounded-2xl border border-border bg-card/80 p-6 shadow-elevated backdrop-blur">
              <div className="flex gap-1 text-warning">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-warning" />
                ))}
              </div>
              <p className="mt-3 text-lg leading-snug text-foreground">
                "Servio is the only marketplace I trust. The pros are exceptional and the process is
                effortless."
              </p>
              <div className="mt-5 flex items-center gap-3">
                <img
                  src="https://i.pravatar.cc/100?u=olivia"
                  className="h-10 w-10 rounded-full"
                  alt=""
                />
                <div>
                  <p className="text-sm font-semibold">Olivia Bennett</p>
                  <p className="text-xs text-muted-foreground">Founder, Lumen</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
