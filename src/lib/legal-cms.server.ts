import path from "node:path";
import Database from "better-sqlite3";
import { JSDOM } from "jsdom";
import DOMPurify from "dompurify";

const window = new JSDOM("").window;
const purify = DOMPurify(window);

export type LegalPageSlug = string;
export type LegalPageStatus = "DRAFT" | "PUBLISHED";

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

const globalForLegalCms = globalThis as typeof globalThis & {
  legalCmsDb?: InstanceType<typeof Database>;
};

function getDatabase() {
  if (!globalForLegalCms.legalCmsDb) {
    const databasePath = path.resolve(process.cwd(), "prisma", "app.db");
    globalForLegalCms.legalCmsDb = new Database(databasePath);
    ensureLegalPagesTable(globalForLegalCms.legalCmsDb);
  }

  return globalForLegalCms.legalCmsDb;
}

function ensureLegalPagesTable(db: InstanceType<typeof Database>) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "LegalPage" (
      "slug" TEXT NOT NULL PRIMARY KEY,
      "title" TEXT NOT NULL,
      "content" TEXT NOT NULL DEFAULT \'\',
      "status" TEXT NOT NULL DEFAULT \'PUBLISHED\',
      "updatedAt" TEXT NOT NULL
    );
  `);

  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO "LegalPage" ("slug", "title", "content", "status", "updatedAt")
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const page of Object.values(defaultLegalPages)) {
    insert.run(page.slug, page.title, page.content, page.status, now);
  }
}

export function listLegalPages(): LegalPageRecord[] {
  const db = getDatabase();
  return db
    .prepare(
      `
        SELECT slug, title, content, status, updatedAt
        FROM "LegalPage"
        ORDER BY CASE slug
          WHEN \'faq\' THEN 0
          WHEN \'terms-and-conditions\' THEN 1
          WHEN \'privacy-policy\' THEN 2
          ELSE 3
        END
      `,
    )
    .all() as LegalPageRecord[];
}

export function getLegalPageBySlug(slug: LegalPageSlug): LegalPageRecord | undefined {
  const db = getDatabase();
  return db
    .prepare(
      `
        SELECT slug, title, content, status, updatedAt
        FROM "LegalPage"
        WHERE slug = ?
        LIMIT 1
      `,
    )
    .get(slug) as LegalPageRecord | undefined;
}

export function getPublishedLegalPageBySlug(slug: LegalPageSlug): LegalPageRecord | undefined {
  const page = getLegalPageBySlug(slug);
  return page?.status === "PUBLISHED" ? page : undefined;
}

export function saveLegalPage(slug: LegalPageSlug, input: LegalPageInput): LegalPageRecord {
  const db = getDatabase();
  const sanitizedContent = purify.sanitize(input.content);
  const updatedAt = new Date().toISOString();
  const defaultTemplate = getDefaultLegalPageTemplate(slug);
  const fallbackTitle = defaultTemplate?.title || slug.replace(/[-_]+/g, " ").trim() || "New page";

  db.prepare(
    `
      INSERT INTO "LegalPage" ("slug", "title", "content", "status", "updatedAt")
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT("slug") DO UPDATE SET
        title = excluded.title,
        content = excluded.content,
        status = excluded.status,
        updatedAt = excluded.updatedAt
    `,
  ).run(slug, input.title.trim() || fallbackTitle, sanitizedContent, input.status, updatedAt);

  const page = getLegalPageBySlug(slug);
  if (!page) {
    throw new Error("Unable to save legal page.");
  }

  return page;
}
