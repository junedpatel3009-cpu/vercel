import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import type { CTASectionConfig } from "@/types/page-builder";

interface CTASectionProps {
  config: CTASectionConfig;
  children?: React.ReactNode;
}

export function CTASection({ config, children }: CTASectionProps) {
  if (!config.visible) return null;

  const spacingClass = getSpacingClass(config.spacing || "normal");

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className={spacingClass}>
        <div
          className="rounded-3xl bg-primary p-10 text-white md:p-14"
          style={{ backgroundColor: config.backgroundColor || undefined }}
        >
          <div className="grid gap-6 md:grid-cols-2 md:items-center">
            <div>
              <h3
                className="font-display text-3xl font-bold md:text-4xl"
                style={{ color: config.textColor || undefined }}
              >
                {config.title}
              </h3>
              {config.description && <p className="mt-2 text-white/80">{config.description}</p>}
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Button asChild size="lg">
                <Link to={(config.buttonLink || "/signup") as any}>{config.buttonText}</Link>
              </Button>
              {config.secondaryButtonText && (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                >
                  <Link to={(config.secondaryButtonLink || "/") as any}>
                    {config.secondaryButtonText}
                  </Link>
                </Button>
              )}
            </div>
          </div>
          {children}
        </div>
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
