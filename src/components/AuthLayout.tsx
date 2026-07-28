import { Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/current-user.server";
import type { PublicUser } from "@/lib/user-db.server";
import { CheckCircle2, LogOut, Quote, Star, User } from "lucide-react";

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

  const handleLogout = () => {
    setIsLoggingOut(true);
    // Do not keep the user on the current page while a serverless function
    // wakes up. `keepalive` lets the cookie-clear request finish during the
    // navigation to the public login page.
    void fetch("/api/v1/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
    });
    window.location.replace("/login");
  };

  return (
    <div className={fullWidth ? "min-h-screen bg-background" : "min-h-screen bg-slate-50 lg:grid lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]"}>
      <div className="flex min-h-screen flex-col bg-white px-6 py-7 sm:px-10 lg:px-16 xl:px-20">
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
            fullWidth ? "max-w-none justify-start" : "mx-auto max-w-[28rem] justify-center"
          }`}
        >
          <div className={fullWidth ? "" : "rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.32)] sm:p-9"}>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><CheckCircle2 className="h-5 w-5" /></div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-primary">Secure sign in</p>
          <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-slate-950">{title}</h1>
          {subtitle && <p className="mt-3 text-[15px] leading-6 text-slate-500">{subtitle}</p>}
          <div className="mt-9">{children}</div>
          {footer && (
            <div
              className={`mt-6 text-sm text-muted-foreground ${fullWidth ? "text-left" : "text-center"}`}
            >
              {footer}
            </div>
          )}
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground">© 2026 Servio, Inc.</p>
      </div>
      {!fullWidth ? (
        <div className="relative hidden overflow-hidden bg-[#0a43af] lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_12%,rgba(107,178,255,0.5),transparent_32%),radial-gradient(circle_at_16%_88%,rgba(18,30,95,0.95),transparent_50%)]" />
          <div className="absolute -right-24 top-1/3 h-80 w-80 rounded-full border border-white/10" />
          <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
            <Link to="/" className="w-fit rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-card/70 hover:text-foreground">
              ← Back to site
            </Link>
            <div className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">Trusted professionals</p>
              <h2 className="mt-5 max-w-lg text-5xl font-bold leading-[1.05] tracking-[-0.05em] text-white">Work with confidence.</h2>
              <p className="mt-5 max-w-md text-base leading-7 text-blue-100">Find skilled local professionals, manage every detail, and keep your project moving.</p>
            </div>
            <div className="max-w-xl rounded-[1.75rem] border border-white/20 bg-white/10 p-7 shadow-2xl shadow-blue-950/20 backdrop-blur-md">
              <Quote className="h-6 w-6 text-blue-200" />
              <div className="mt-4 flex gap-1 text-amber-300">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-warning" />
                ))}
              </div>
              <p className="mt-3 text-lg leading-snug text-white">
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
                  <p className="text-sm font-semibold text-white">Olivia Bennett</p>
                  <p className="text-xs text-blue-200">Founder, Lumen</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
