import sanitizeHtml from "sanitize-html";
import { prisma } from "@/lib/prisma";
import { ensureCmsSchema } from "@/lib/cms-schema.server.ts";
import type { CmsPageStatus } from "@/generated/prisma/client.ts";

const sanitizerOptions = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "h5", "h6", "img", "section", "div", "span",
    "p", "ul", "ol", "li", "a", "strong", "em", "b", "i", "u", "br",
    "blockquote", "pre", "code", "table", "thead", "tbody", "tr", "th", "td", "hr"
  ],
  allowedAttributes: {
    "*": [
      "href", "name", "target", "rel", "src", "alt", "title", "width", "height",
      "class", "scope", "colspan", "rowspan"
    ],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
};

function sanitizeCmsHtml(value: string) {
  return sanitizeHtml(value, sanitizerOptions);
}

export type WebsitePageStatus = CmsPageStatus;
export type WebsitePageRecord = {
  pageKey: string;
  path: string;
  title: string;
  content: string;
  status: WebsitePageStatus;
  updatedAt: string;
};

export const editableWebsitePages = [
  { pageKey: "home", path: "/", title: "Home Page" },
  { pageKey: "about", path: "/about-us", title: "About Us" },
  { pageKey: "how-it-works", path: "/how-it-works", title: "How It Works" },
  { pageKey: "services", path: "/services", title: "Services / Categories" },
  { pageKey: "for-clients", path: "/for-clients", title: "For Clients Page" },
  { pageKey: "for-professionals", path: "/for-professionals", title: "For Professionals Page" },
  { pageKey: "pricing", path: "/pricing", title: "Pricing / Fees / Commission" },
  { pageKey: "faq", path: "/faq", title: "FAQ Page" },
  { pageKey: "contact", path: "/contact-us", title: "Contact Us" },
  { pageKey: "privacy", path: "/privacy-policy", title: "Privacy Policy" },
  { pageKey: "terms", path: "/terms-and-conditions", title: "Terms & Conditions" },
] as const;

let websitePagesInitializationPromise: Promise<void> | undefined;

async function ensureWebsitePages() {
  if (websitePagesInitializationPromise) {
    return websitePagesInitializationPromise;
  }

  websitePagesInitializationPromise = (async () => {
    await ensureCmsSchema();

    await prisma.websitePage.createMany({
      data: editableWebsitePages.map((page) => ({
        pageKey: page.pageKey,
        path: page.path,
        title: page.title,
        content: createDefaultContent(page.title),
        status: "DRAFT",
        updatedAt: new Date(),
      })),
      skipDuplicates: true,
    });
  })();

  return websitePagesInitializationPromise;
}

export async function listWebsitePages(): Promise<WebsitePageRecord[]> {
  await ensureWebsitePages();
  const pages = await prisma.websitePage.findMany({
    orderBy: { pageKey: "asc" },
    select: {
      pageKey: true,
      path: true,
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

export async function listPublishedWebsitePages(): Promise<WebsitePageRecord[]> {
  await ensureWebsitePages();
  const pages = await prisma.websitePage.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { pageKey: "asc" },
    select: {
      pageKey: true,
      path: true,
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

export async function getPublishedWebsitePage(
  pageKey: string,
): Promise<WebsitePageRecord | undefined> {
  await ensureWebsitePages();
  const page = await prisma.websitePage.findUnique({
    where: { pageKey },
    select: {
      pageKey: true,
      path: true,
      title: true,
      content: true,
      status: true,
      updatedAt: true,
    },
  });
  if (!page || page.status !== "PUBLISHED") return undefined;
  return {
    ...page,
    updatedAt: page.updatedAt.toISOString(),
  };
}

export async function saveWebsitePage(
  pageKey: string,
  input: Pick<WebsitePageRecord, "content" | "status">,
): Promise<WebsitePageRecord> {
  await ensureWebsitePages();
  if (!editableWebsitePages.some((page) => page.pageKey === pageKey)) {
    throw new Error("This page is not editable.");
  }

  const sanitizedContent = sanitizeCmsHtml(input.content);
  const updatedAt = new Date();
  const page = await prisma.websitePage.upsert({
    where: { pageKey },
    create: {
      pageKey,
      path: editableWebsitePages.find((page) => page.pageKey === pageKey)?.path ?? "/",
      title: editableWebsitePages.find((page) => page.pageKey === pageKey)?.title ?? pageKey,
      content: sanitizedContent,
      status: input.status,
      updatedAt,
    },
    update: {
      content: sanitizedContent,
      status: input.status,
      updatedAt,
    },
    select: {
      pageKey: true,
      path: true,
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

function createDefaultContent(title: string) {
  return `<section class="cms-hero center"><div class="cms-wrap"><p class="cms-kicker">Servio</p><h1>${title}</h1><p>Edit this page visually or open Source Editing to paste HTML.</p></div></section><section class="cms-section"><div class="cms-wrap"><h2>Main section</h2><div class="cms-grid two"><div class="cms-card"><h3>Content card one</h3><p>Add your page content here.</p></div><div class="cms-card"><h3>Content card two</h3><p>Add supporting information here.</p></div></div><div class="cms-cta"><div><h2>Ready to get started?</h2><p>Join Servio today.</p></div><a class="cms-btn orange" href="/signup">Create account</a></div></div></section>`;
}
