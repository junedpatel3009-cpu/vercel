import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

const loadPrivacyPage = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublishedLegalPageBySlug } = await import("@/lib/legal-cms.server");
  return { cmsPage: getPublishedLegalPageBySlug("privacy-policy") || null };
});

export const Route = createFileRoute("/privacy-policy")({
  loader: () => loadPrivacyPage(),
  head: () => ({
    meta: [
      { title: "Privacy Policy - Servio" },
      { name: "description", content: "Learn how Servio handles privacy and personal data." },
    ],
  }),
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  const { cmsPage } = Route.useLoaderData() as {
    cmsPage: { title: string; content: string } | null;
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="gradient-hero">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Information</p>
          <h1 className="font-display mt-3 text-4xl font-bold tracking-tight md:text-5xl">
            {cmsPage?.title || "Privacy Policy"}
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
              Information We Collect
            </h2>
            <p className="mt-3">
              We collect account, contact, usage, and transaction information needed to operate
              Servio.
            </p>
            <h2 className="font-display mt-8 text-2xl font-semibold text-foreground">
              How We Use It
            </h2>
            <p className="mt-3">
              We use information to provide services, improve safety, process payments, and support
              users.
            </p>
            <h2 className="font-display mt-8 text-2xl font-semibold text-foreground">
              Your Choices
            </h2>
            <p className="mt-3">
              You can update your account information or contact support for privacy requests.
            </p>
          </div>
        )}
      </section>
      <SiteFooter />
    </div>
  );
}
