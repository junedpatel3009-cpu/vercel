import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminSummaryCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  caption?: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  variant?: "default" | "primary" | "success" | "warning" | "destructive";
}

export function AdminSummaryCard({
  icon: Icon,
  label,
  value,
  caption,
  active,
  onClick,
  className,
  variant = "default",
}: AdminSummaryCardProps) {
  const variants = {
    default: "text-primary bg-primary/10",
    primary: "text-blue-600 bg-blue-50",
    success: "text-emerald-600 bg-emerald-50",
    warning: "text-amber-600 bg-amber-50",
    destructive: "text-rose-600 bg-rose-50",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card p-6 text-left transition-all duration-300",
        onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-1" : "cursor-default",
        active
          ? "border-primary bg-primary/[0.03] shadow-sm ring-1 ring-primary/20"
          : "border-border hover:border-primary/30",
        className
      )}
    >
      <div className={cn(
        "grid h-12 w-12 place-items-center rounded-xl transition-colors",
        variants[variant]
      )}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="mt-4 space-y-1">
        <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
          {label}
        </p>
        <p className="text-3xl font-bold tracking-tight text-foreground">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {caption && (
          <p className="text-xs text-muted-foreground font-medium">
            {caption}
          </p>
        )}
      </div>
      {active && (
        <div className="absolute right-0 top-0 h-1.5 w-full bg-primary" />
      )}
    </button>
  );
}
