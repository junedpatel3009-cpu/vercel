import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/contact-us")({
  head: () => ({
    meta: [
      { title: "Contact Us - Servio" },
      { name: "description", content: "Contact the Servio support team." },
    ],
  }),
  component: ContactUs,
});

function ContactUs() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="gradient-hero">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Support</p>
          <h1 className="font-display mt-3 text-4xl font-bold tracking-tight md:text-5xl">
            Contact Us
          </h1>
          <p className="mt-4 text-muted-foreground">We would love to hear from you.</p>
        </div>
      </section>
      <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-display text-xl font-semibold">Email</h2>
            <p className="mt-2 text-sm text-muted-foreground">support@servio.com</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-display text-xl font-semibold">Office</h2>
            <p className="mt-2 text-sm text-muted-foreground">123 Market Street, San Francisco</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-display text-xl font-semibold">Hours</h2>
            <p className="mt-2 text-sm text-muted-foreground">Monday to Friday, 9 AM to 6 PM</p>
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
