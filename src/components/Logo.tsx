import { Link } from "@tanstack/react-router";
import { Briefcase } from "lucide-react";

export function Logo({
  className = "",
  linked = true,
  label = "Servio",
}: {
  className?: string;
  linked?: boolean;
  label?: string;
}) {
  const content = (
    <>
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-soft">
        <Briefcase className="h-4 w-4" />
      </span>
      <span className="text-xl tracking-tight">{label}</span>
    </>
  );

  if (!linked) {
    return (
      <div
        className={`flex items-center gap-2 font-display font-bold text-foreground ${className}`}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      to="/"
      className={`flex items-center gap-2 font-display font-bold text-foreground ${className}`}
    >
      {content}
    </Link>
  );
}
