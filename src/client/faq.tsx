import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

const faqItems = [
  {
    id: 1,
    question: "How do I hire a professional?",
    answer:
      "Post a job, compare proposals, review profiles, and choose the pro that fits your needs.",
  },
  {
    id: 2,
    question: "Is payment safe on Servio?",
    answer: "Yes. Payments are held safely and released when the work or milestone is approved.",
  },
  {
    id: 3,
    question: "How are professionals verified?",
    answer:
      "Profiles are reviewed for completeness and can include verification badges and platform checks.",
  },
  {
    id: 4,
    question: "Can I contact support directly?",
    answer: "Yes. Use the contact page and our support team will respond as quickly as possible.",
  },
];

const loadFaqPage = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublishedLegalPageBySlug } = await import("@/lib/legal-cms.server");
  return { cmsPage: getPublishedLegalPageBySlug("faq") || null };
});

export const Route = createFileRoute("/faq")({
  loader: () => loadFaqPage(),
  head: () => ({
    meta: [
      { title: "FAQ — Common questions answered | Servio" },
      {
        name: "description",
        content:
          "Answers to common questions about hiring, pricing, payments, verification, and more.",
      },
    ],
  }),
  component: FAQ,
});

function FAQ() {
  const { cmsPage } = Route.useLoaderData() as {
    cmsPage: { title: string; content: string } | null;
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="gradient-hero">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Help center</p>
          <h1 className="font-display mt-3 text-4xl font-bold tracking-tight md:text-5xl">
            {cmsPage?.title || "Frequently asked questions"}
          </h1>
          <p className="mt-4 text-muted-foreground">
            Can't find what you're looking for? Our team is one click away.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6 lg:px-8">
        {cmsPage?.content ? (
          <div
            className="prose prose-gray mb-8 max-w-none rounded-2xl border border-border bg-card p-6 text-sm leading-7 shadow-soft dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: cmsPage.content }}
          />
        ) : null}
        <Accordion
          type="single"
          collapsible
          className="rounded-2xl border border-border bg-card shadow-soft"
        >
          {faqItems.map((faq) => (
            <AccordionItem key={faq.id} value={`faq-${faq.id}`} className="px-5">
              <AccordionTrigger className="text-left font-medium">{faq.question}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <div className="mt-12 rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
          <h3 className="font-display text-2xl font-semibold">Still have questions?</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Our support team replies in under an hour.
          </p>
          <Button asChild size="lg" className="mt-5 bg-cta text-cta-foreground hover:bg-cta/90">
            <Link to="/">Contact support</Link>
          </Button>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
