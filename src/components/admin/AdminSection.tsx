import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminSectionProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function AdminSection({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
}: AdminSectionProps) {
  return (
    <section className={cn(
      "rounded-2xl border border-border bg-card shadow-sm overflow-hidden",
      className
    )}>
      <div className="border-b border-border bg-muted/30 px-6 py-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-4">
            {Icon && (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-foreground">{title}</h2>
              {description && (
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      </div>
      <div className="p-0">
        {children}
      </div>
    </section>
  );
}
