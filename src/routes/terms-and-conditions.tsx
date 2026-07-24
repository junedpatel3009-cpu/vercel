import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

const loadTermsPage = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublishedLegalPageBySlug } = await import("@/lib/legal-cms.server");
  return { cmsPage: getPublishedLegalPageBySlug("terms-and-conditions") || null };
});

export const Route = createFileRoute("/terms-and-conditions")({
  loader: () => loadTermsPage(),
  head: () => ({
    meta: [
      { title: "Terms & Conditions - Servio" },
      { name: "description", content: "Read the terms and conditions for using Servio." },
    ],
  }),
  component: TermsAndConditions,
});

function TermsAndConditions() {
  const { cmsPage } = Route.useLoaderData() as {
    cmsPage: { title: string; content: string } | null;
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="gradient-hero">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Legal</p>
          <h1 className="font-display mt-3 text-4xl font-bold tracking-tight md:text-5xl">
            {cmsPage?.title || "Terms & Conditions"}
          </h1>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6 lg:px-8">
        {cmsPage?.content ? (
          <div
            className="prose prose-gray max-w-none text-sm leading-7 dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: cmsPage.content }}
          />
        ) : (
          <div className="text-sm leading-7 text-muted-foreground">
            <h2 className="font-display text-2xl font-semibold text-foreground">
              Acceptance of Terms
            </h2>
            <p className="mt-3">By accessing or using Servio, you agree to follow these terms.</p>
            <h2 className="font-display mt-8 text-2xl font-semibold text-foreground">
              User Accounts
            </h2>
            <p className="mt-3">You are responsible for your account credentials and activity.</p>
            <h2 className="font-display mt-8 text-2xl font-semibold text-foreground">
              Payments & Services
            </h2>
            <p className="mt-3">
              Clients and professionals are responsible for agreed work, payments, and platform
              rules.
            </p>
          </div>
        )}
      </section>
      <SiteFooter />
    </div>
  );
}
