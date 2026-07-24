import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/about-us")({
  head: () => ({
    meta: [
      { title: "About Us - Servio" },
      { name: "description", content: "Learn about Servio's mission, story, and values." },
    ],
  }),
  component: AboutUs,
});

function AboutUs() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="gradient-hero">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Company</p>
          <h1 className="font-display mt-3 text-4xl font-bold tracking-tight md:text-5xl">
            About Us
          </h1>
          <p className="mt-4 text-muted-foreground">
            Servio helps clients hire trusted professionals and helps skilled workers grow.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-7 shadow-soft">
            <h2 className="font-display text-2xl font-semibold">Our Mission</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Make hiring services simple, safe, and transparent for everyone.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-7 shadow-soft">
            <h2 className="font-display text-2xl font-semibold">Our Values</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Trust, quality, transparency, and opportunity guide how Servio is built.
            </p>
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
