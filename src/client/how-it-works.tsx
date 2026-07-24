import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import {
  ClipboardList,
  MessageSquare,
  Wallet,
  ShieldCheck,
  Star,
  Users,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How It Works — Servio" },
      {
        name: "description",
        content:
          "From posting a job to hiring a vetted pro and tracking work — see how Servio gets it done in three simple steps.",
      },
    ],
  }),
  component: HowItWorks,
});

const stepsClient = [
  {
    icon: ClipboardList,
    title: "Post your job",
    desc: "Describe the work, set your budget and timeline. It's free and takes 2 minutes.",
  },
  {
    icon: MessageSquare,
    title: "Compare proposals",
    desc: "Receive quotes from vetted pros. Chat, compare ratings, and shortlist the best.",
  },
  {
    icon: ShieldCheck,
    title: "Hire safely",
    desc: "Funds are held in escrow and released only when each milestone is approved.",
  },
  {
    icon: Wallet,
    title: "Pay & review",
    desc: "Release final payment and rate your pro to help our community.",
  },
];

const stepsPro = [
  {
    icon: Users,
    title: "Create your profile",
    desc: "Showcase skills, portfolio, and certifications. Get verified for free.",
  },
  {
    icon: MessageSquare,
    title: "Send proposals",
    desc: "Browse nearby and remote jobs. Submit a quote in under a minute.",
  },
  {
    icon: Star,
    title: "Win, deliver, get paid",
    desc: "Deliver milestones, get reviews, and grow your business with Servio.",
  },
];

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <Hero />
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">For clients</p>
        <h2 className="font-display mt-2 text-3xl font-bold tracking-tight md:text-4xl">
          Get great work done — in 4 steps
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {stepsClient.map((s, i) => (
            <div
              key={s.title}
              className="relative rounded-2xl border border-border bg-card p-6 shadow-soft"
            >
              <span className="font-display text-5xl font-bold text-primary/15">0{i + 1}</span>
              <div className="mt-2 grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-cta">
            For professionals
          </p>
          <h2 className="font-display mt-2 text-3xl font-bold tracking-tight md:text-4xl">
            Earn more, with less hassle
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {stepsPro.map((s, i) => (
              <div
                key={s.title}
                className="rounded-2xl border border-border bg-card p-7 shadow-soft"
              >
                <span className="rounded-full bg-cta/10 px-2.5 py-0.5 text-xs font-bold text-cta">
                  Step {i + 1}
                </span>
                <div className="mt-3 grid h-11 w-11 place-items-center rounded-xl bg-cta/10 text-cta">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <CTABand />
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="gradient-hero">
      <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">How it works</p>
        <h1 className="font-display mx-auto mt-3 max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
          A simpler way to <span className="text-primary">hire & get hired</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Servio handles the busywork — discovery, vetting, payments, and tracking — so you can
          focus on the work.
        </p>
      </div>
    </section>
  );
}

export function CTABand() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="rounded-3xl bg-primary p-10 text-white md:p-14">
        <div className="grid gap-6 md:grid-cols-2 md:items-center">
          <h3 className="font-display text-3xl font-bold md:text-4xl">Get started today</h3>
          <div className="flex flex-wrap gap-3 md:justify-end">
            <Button asChild size="lg" className="bg-cta text-cta-foreground hover:bg-cta/90">
              <Link to="/post-job">
                Post a Job <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/30 bg-white/10 text-white hover:bg-white/20"
            >
              <Link to="/signup">Become a Pro</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
