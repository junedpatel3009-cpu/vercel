import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, ShieldCheck, Star, Users, Wallet } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/for-clients")({
  head: () => ({
    meta: [
      { title: "For Clients - Hire vetted professionals | Servio" },
      {
        name: "description",
        content:
          "Post a job, compare proposals, and pay safely via escrow. Servio is built to help clients hire with confidence.",
      },
    ],
  }),
  component: ForClients,
});

const benefits = [
  {
    icon: ShieldCheck,
    title: "Vetted professionals",
    desc: "Every pro is ID-verified. Background checks for in-home services.",
  },
  {
    icon: Wallet,
    title: "Escrow payments",
    desc: "Your money is safe. Released only when you approve a milestone.",
  },
  {
    icon: Clock,
    title: "Fast matches",
    desc: "Get your first proposal in under 2 hours, on average.",
  },
  { icon: Users, title: "World-class support", desc: "Real humans, 24/7 - never a bot." },
];

function ForClients() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="gradient-hero">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              For clients
            </p>
            <h1 className="font-display mt-3 text-4xl font-bold tracking-tight md:text-5xl">
              Hire trusted pros - without the back-and-forth
            </h1>
            <p className="mt-4 max-w-lg text-muted-foreground">
              Post once. Get qualified, vetted proposals fast. Pay only when work is done. It&apos;s
              the modern way to get things done.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-cta text-cta-foreground hover:bg-cta/90">
                <Link to="/post-job">Post a Job - it&apos;s free</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/discover">Browse pros</Link>
              </Button>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-sm">
              <Star className="h-4 w-4 fill-warning text-warning" />
              <span className="font-semibold">4.9 / 5</span>
              <span className="text-muted-foreground">from 28,400 client reviews</span>
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-card p-6 shadow-elevated">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Sample timeline
            </p>
            <ol className="mt-4 space-y-4">
              {[
                { t: "0 min", e: "You post a kitchen plumbing job" },
                { t: "8 min", e: "First proposal received from Priya, $180" },
                { t: "32 min", e: "3 more vetted plumbers have applied" },
                { t: "1h", e: "You hire Priya. She's on her way." },
                { t: "Same day", e: "Job done. Payment released." },
              ].map((item, index) => (
                <li key={index} className="flex gap-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-success/10 text-success">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{item.t}</p>
                    <p className="text-sm font-medium">{item.e}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="font-display text-3xl font-bold tracking-tight">
          Why clients choose Servio
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className="rounded-2xl border border-border bg-card p-6 shadow-soft"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                <benefit.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display mt-4 text-lg font-semibold">{benefit.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{benefit.desc}</p>
            </div>
          ))}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
