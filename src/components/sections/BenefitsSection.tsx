import type { BenefitsSectionConfig } from "@/types/page-builder";

interface BenefitsSectionProps {
  config: BenefitsSectionConfig;
  children?: React.ReactNode;
}

const ICON_MAP: Record<string, React.ElementType> = {};

export function BenefitsSection({ config, children }: BenefitsSectionProps) {
  if (!config.visible) return null;

  const spacingClass = getSpacingClass(config.spacing || "normal");
  const colsClass =
    config.columns === 2
      ? "md:grid-cols-2"
      : config.columns === 4
        ? "md:grid-cols-2 lg:grid-cols-4"
        : "md:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className={spacingClass}>
        <div className="text-center">
          {config.subtitle && (
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {config.subtitle}
            </p>
          )}
          <h2 className="font-display text-3xl font-bold tracking-tight">{config.title}</h2>
        </div>
        {children || (
          <div className={`mt-10 grid gap-6 ${colsClass}`}>
            {(config.items || []).map((item, index) => (
              <div key={index} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <div className="h-5 w-5" />
                </div>
                <h3 className="font-display mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        )}
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
