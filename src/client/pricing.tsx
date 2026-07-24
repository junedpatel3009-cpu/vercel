import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Simple, transparent | Servio" },
      {
        name: "description",
        content:
          "Free for clients. Pay only when work is done. Pros pay a small platform fee that drops as you grow.",
      },
    ],
  }),
  component: Pricing,
});

const tiers = [
  {
    name: "Starter",
    forWho: "For clients & new pros",
    price: { monthly: 0, yearly: 0 },
    desc: "Post jobs and apply for free. Pay only when you hire or are hired.",
    fee: "Pros: 10% platform fee",
    perks: [
      "Unlimited job posts",
      "Up to 8 proposals/month",
      "Standard support",
      "Escrow protection",
    ],
    cta: "Get started",
  },
  {
    name: "Pro",
    forWho: "Most popular for pros",
    price: { monthly: 19, yearly: 15 },
    desc: "Win more work with priority placement and unlimited proposals.",
    fee: "Pros: 7% platform fee",
    perks: [
      "Unlimited proposals",
      "Priority placement",
      "Verified badge",
      "AI proposal writer",
      "Same-day payouts",
    ],
    cta: "Start 14-day trial",
    highlight: true,
  },
  {
    name: "Business",
    forWho: "Teams & agencies",
    price: { monthly: 49, yearly: 39 },
    desc: "Hire at scale with team seats, contracts, and dedicated support.",
    fee: "0% platform fee on jobs",
    perks: [
      "Up to 10 team seats",
      "Custom contracts",
      "Bulk hiring",
      "Dedicated account manager",
      "API access",
    ],
    cta: "Talk to sales",
  },
];

function Pricing() {
  const [yearly, setYearly] = useState(true);
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="gradient-hero">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Pricing</p>
          <h1 className="font-display mt-3 text-4xl font-bold tracking-tight md:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-4 text-muted-foreground">
            Free for clients. Pros pay only when they get paid. No hidden fees.
          </p>
          <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-soft">
            <button
              onClick={() => setYearly(false)}
              className={`rounded-full px-4 py-1.5 text-sm transition ${!yearly ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`rounded-full px-4 py-1.5 text-sm transition ${yearly ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Yearly · Save 20%
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`relative flex flex-col rounded-3xl border bg-card p-7 shadow-soft ${t.highlight ? "border-primary shadow-card ring-2 ring-primary/15" : "border-border"}`}
            >
              {t.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-cta px-3 py-0.5 text-xs font-bold text-cta-foreground">
                  Most popular
                </span>
              )}
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t.forWho}
              </p>
              <h3 className="font-display mt-2 text-2xl font-bold">{t.name}</h3>
              <div className="mt-4 flex items-end gap-1">
                <span className="font-display text-5xl font-bold">
                  ${yearly ? t.price.yearly : t.price.monthly}
                </span>
                <span className="mb-1.5 text-sm text-muted-foreground">/mo</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{t.desc}</p>
              <p className="mt-3 inline-flex w-fit rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
                {t.fee}
              </p>
              <ul className="mt-6 space-y-3">
                {t.perks.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {p}
                  </li>
                ))}
              </ul>
              <Button
                asChild
                size="lg"
                className={`mt-7 ${t.highlight ? "bg-cta text-cta-foreground hover:bg-cta/90" : "bg-primary"}`}
              >
                <Link to="/signup">{t.cta}</Link>
              </Button>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          Need something custom?{" "}
          <Link to="/" className="font-medium text-primary hover:underline">
            Contact us
          </Link>
          .
        </p>
      </section>
      <SiteFooter />
    </div>
  );
}
