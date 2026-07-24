import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";

interface AdminPageHeaderProps {
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: Array<{ label: string; to?: string }>;
}

export function AdminPageHeader({
  kicker = "Admin panel",
  title,
  description,
  actions,
  breadcrumbs,
}: AdminPageHeaderProps) {
  return (
    <div className="mb-8 space-y-4">
      {breadcrumbs && (
        <nav className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/admin" className="hover:text-primary transition-colors">
            <Home className="h-3 w-3" />
          </Link>
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.label} className="flex items-center gap-2">
              <ChevronRight className="h-3 w-3" />
              {crumb.to ? (
                <Link to={crumb.to} className="hover:text-primary transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className={index === breadcrumbs.length - 1 ? "text-foreground font-medium" : ""}>
                  {crumb.label}
                </span>
              )}
            </div>
          ))}
        </nav>
      )}

      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/80">{kicker}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
          {description && (
            <p className="mt-2 max-w-2xl text-base text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
