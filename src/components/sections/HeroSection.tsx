import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import type { HeroSectionConfig } from "@/types/page-builder";

interface HeroSectionProps {
  config: HeroSectionConfig;
  children?: React.ReactNode;
}

export function HeroSection({ config, children }: HeroSectionProps) {
  if (!config.visible) return null;

  const spacingClass = getSpacingClass(config.spacing || "normal");
  const layoutClass =
    config.layoutStyle === "left"
      ? "text-left"
      : config.layoutStyle === "split"
        ? "text-left lg:grid lg:grid-cols-2 lg:items-center"
        : "text-center";

  return (
    <section className="gradient-hero">
      <div className={`mx-auto max-w-7xl px-4 ${spacingClass} sm:px-6 lg:px-8 ${layoutClass}`}>
        <div>
          {config.subtitle && (
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {config.subtitle}
            </p>
          )}
          <h1
            className="font-display mt-3 text-4xl font-bold tracking-tight md:text-5xl"
            style={{ color: config.textColor || undefined }}
          >
            {config.title}
          </h1>
          {children}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to={config.buttonLink as any}>{config.buttonText}</Link>
            </Button>
            {config.secondaryButtonText && (
              <Button asChild size="lg" variant="outline">
                <Link to={(config.secondaryButtonLink || "/") as any}>
                  {config.secondaryButtonText}
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function HeroSectionSkeleton() {
  return (
    <section className="gradient-hero">
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Loading...</p>
        <div className="mx-auto mt-3 h-12 w-3/4 animate-pulse rounded bg-primary/20" />
        <div className="mx-auto mt-4 h-6 w-1/2 animate-pulse rounded bg-primary/10" />
      </div>
    </section>
  );
}

function getSpacingClass(spacing: "compact" | "normal" | "spacious"): string {
  switch (spacing) {
    case "compact":
      return "py-10";
    case "spacious":
      return "py-28";
    default:
      return "py-20";
  }
}
