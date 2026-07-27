let _sanitizeHtml: any | undefined;
async function getSanitizeHtml() {
  if (!_sanitizeHtml) {
    const mod = await import("@/lib/sanitize-html-shim.mjs");
    _sanitizeHtml = mod.default ?? mod;
  }
  return _sanitizeHtml;
}
import { prisma } from "@/lib/prisma";
import { ensureCmsSchema } from "@/lib/cms-schema.server.ts";
import type { CmsPageStatus } from "@/generated/prisma/client.ts";

const sanitizerOptions = {
  allowedTags: [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "img",
    "section",
    "div",
    "span",
    "p",
    "ul",
    "ol",
    "li",
    "a",
    "strong",
    "em",
    "b",
    "i",
    "u",
    "br",
    "blockquote",
    "pre",
    "code",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "hr",
  ],
  allowedAttributes: {
    "*": [
      "href",
      "name",
      "target",
      "rel",
      "src",
      "alt",
      "title",
      "width",
      "height",
      "class",
      "scope",
      "colspan",
      "rowspan",
    ],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
};

async function sanitizeCmsHtml(value: string) {
  const fn = await getSanitizeHtml();
  return fn(value, sanitizerOptions);
}

export type LegalPageSlug = string;
export type LegalPageStatus = CmsPageStatus;

type DefaultLegalPageSlug = "faq" | "terms-and-conditions" | "privacy-policy";

export type LegalPageRecord = {
  slug: LegalPageSlug;
  title: string;
  content: string;
  status: LegalPageStatus;
  updatedAt: string;
};

export type LegalPageInput = {
  title: string;
  content: string;
  status: LegalPageStatus;
};

const defaultLegalPages: Record<DefaultLegalPageSlug, Omit<LegalPageRecord, "updatedAt">> = {
  faq: {
    slug: "faq",
    title: "Frequently asked questions",
    content:
      "<p>Find answers to common questions about hiring, payments, and how Servio works.</p>",
    status: "PUBLISHED",
  },
  "terms-and-conditions": {
    slug: "terms-and-conditions",
    title: "Terms & Conditions",
    content:
      '<p>By accessing or using Servio, you agree to follow these terms.</p><p class="mt-4">You are responsible for your account credentials and activity.</p><p class="mt-4">Clients and professionals are responsible for agreed work, payments, and platform rules.</p>',
    status: "PUBLISHED",
  },
  "privacy-policy": {
    slug: "privacy-policy",
    title: "Privacy Policy",
    content:
      '<p>We collect account, contact, usage, and transaction information needed to operate Servio.</p><p class="mt-4">We use information to provide services, improve safety, process payments, and support users.</p><p class="mt-4">You can update your account information or contact support for privacy requests.</p>',
    status: "PUBLISHED",
  },
};

function getDefaultLegalPageTemplate(slug: string): Omit<LegalPageRecord, "updatedAt"> | null {
  return (defaultLegalPages as Record<string, Omit<LegalPageRecord, "updatedAt">>)[slug] || null;
}

let legalPagesInitializationPromise: Promise<void> | undefined;

async function ensureLegalPages() {
  if (legalPagesInitializationPromise) {
    return legalPagesInitializationPromise;
  }

  legalPagesInitializationPromise = (async () => {
    await ensureCmsSchema();

    await prisma.legalPage.createMany({
      data: Object.values(defaultLegalPages).map((page) => ({
        slug: page.slug,
        title: page.title,
        content: page.content,
        status: page.status,
        updatedAt: new Date(),
      })),
      skipDuplicates: true,
    });
  })();

  return legalPagesInitializationPromise;
}

export async function listLegalPages(): Promise<LegalPageRecord[]> {
  await ensureLegalPages();
  const pages = await prisma.legalPage.findMany({
    orderBy: { slug: "asc" },
    select: {
      slug: true,
      title: true,
      content: true,
      status: true,
      updatedAt: true,
    },
  });
  return pages.map((page) => ({
    ...page,
    updatedAt: page.updatedAt.toISOString(),
  }));
}

export async function getLegalPageBySlug(
  slug: LegalPageSlug,
): Promise<LegalPageRecord | undefined> {
  await ensureLegalPages();
  const page = await prisma.legalPage.findUnique({
    where: { slug },
    select: {
      slug: true,
      title: true,
      content: true,
      status: true,
      updatedAt: true,
    },
  });
  return page ? { ...page, updatedAt: page.updatedAt.toISOString() } : undefined;
}

export async function getPublishedLegalPageBySlug(
  slug: LegalPageSlug,
): Promise<LegalPageRecord | undefined> {
  const page = await getLegalPageBySlug(slug);
  return page?.status === "PUBLISHED" ? page : undefined;
}

export async function saveLegalPage(
  slug: LegalPageSlug,
  input: LegalPageInput,
): Promise<LegalPageRecord> {
  await ensureLegalPages();
  const sanitizedContent = await sanitizeCmsHtml(input.content);
  const updatedAt = new Date();
  const defaultTemplate = getDefaultLegalPageTemplate(slug);
  const fallbackTitle = defaultTemplate?.title || slug.replace(/[-_]+/g, " ").trim() || "New page";

  const page = await prisma.legalPage.upsert({
    where: { slug },
    create: {
      slug,
      title: input.title.trim() || fallbackTitle,
      content: sanitizedContent,
      status: input.status,
      updatedAt,
    },
    update: {
      title: input.title.trim() || fallbackTitle,
      content: sanitizedContent,
      status: input.status,
      updatedAt,
    },
    select: {
      slug: true,
      title: true,
      content: true,
      status: true,
      updatedAt: true,
    },
  });

  return {
    ...page,
    updatedAt: page.updatedAt.toISOString(),
  };
}
