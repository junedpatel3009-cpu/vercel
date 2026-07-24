import { createServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

const loadLegalPage = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    const { getPublishedLegalPageBySlug } = await import("@/lib/legal-cms.server");
    return getPublishedLegalPageBySlug(data.slug) || null;
  });

export const Route = createFileRoute("/$legalPageSlug")({
  loader: ({ params }) => loadLegalPage({ data: { slug: params.legalPageSlug } }),
  component: LegalPage,
});

function LegalPage() {
  const page = Route.useLoaderData() as { title: string; content: string } | null;

  if (!page) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-32 text-center sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold">Page not found</h1>
          <p className="mt-3 text-muted-foreground">
            This page is not published or does not exist.
          </p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="gradient-hero">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Information</p>
          <h1 className="font-display mt-3 text-4xl font-bold tracking-tight md:text-5xl">
            {page.title}
          </h1>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6 lg:px-8">
        <div
          className="prose prose-gray max-w-none text-sm leading-7 dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />
      </section>
      <SiteFooter />
    </div>
  );
}
