import path from "node:path";
import Database from "better-sqlite3";
import { JSDOM } from "jsdom";
import DOMPurify from "dompurify";

const window = new JSDOM("").window;
const purify = DOMPurify(window);

export type WebsitePageStatus = "DRAFT" | "PUBLISHED";
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

const globalForWebsiteCms = globalThis as typeof globalThis & {
  websiteCmsDb?: InstanceType<typeof Database>;
};

function getDatabase() {
  if (!globalForWebsiteCms.websiteCmsDb) {
    const databasePath = path.resolve(process.cwd(), "prisma", "app.db");
    globalForWebsiteCms.websiteCmsDb = new Database(databasePath);
    ensureTable(globalForWebsiteCms.websiteCmsDb);
  }
  return globalForWebsiteCms.websiteCmsDb;
}

function ensureTable(db: InstanceType<typeof Database>) {
  db.exec(`CREATE TABLE IF NOT EXISTS "WebsitePage" (
    "pageKey" TEXT NOT NULL PRIMARY KEY,
    "path" TEXT NOT NULL UNIQUE,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "updatedAt" TEXT NOT NULL
  );`);
  const insert = db.prepare(`INSERT OR IGNORE INTO "WebsitePage"
    ("pageKey", "path", "title", "content", "status", "updatedAt")
    VALUES (?, ?, ?, ?, 'DRAFT', ?)`);
  const now = new Date().toISOString();
  for (const page of editableWebsitePages) {
    insert.run(page.pageKey, page.path, page.title, createDefaultContent(page.title), now);
  }
}

export function listWebsitePages(): WebsitePageRecord[] {
  return getDatabase()
    .prepare(
      `SELECT pageKey, path, title, content, status, updatedAt FROM "WebsitePage" ORDER BY rowid`,
    )
    .all() as WebsitePageRecord[];
}

export function listPublishedWebsitePages(): WebsitePageRecord[] {
  return getDatabase()
    .prepare(
      `SELECT pageKey, path, title, content, status, updatedAt FROM "WebsitePage" WHERE status = 'PUBLISHED'`,
    )
    .all() as WebsitePageRecord[];
}

export function getPublishedWebsitePage(pageKey: string): WebsitePageRecord | undefined {
  return getDatabase()
    .prepare(
      `SELECT pageKey, path, title, content, status, updatedAt FROM "WebsitePage" WHERE pageKey = ? AND status = 'PUBLISHED'`,
    )
    .get(pageKey) as WebsitePageRecord | undefined;
}

export function saveWebsitePage(
  pageKey: string,
  input: Pick<WebsitePageRecord, "content" | "status">,
): WebsitePageRecord {
  if (!editableWebsitePages.some((page) => page.pageKey === pageKey)) {
    throw new Error("This page is not editable.");
  }
  const db = getDatabase();
  const sanitizedContent = purify.sanitize(input.content);
  db.prepare(
    `UPDATE "WebsitePage" SET content = ?, status = ?, updatedAt = ? WHERE pageKey = ?`,
  ).run(sanitizedContent, input.status, new Date().toISOString(), pageKey);
  const saved = db
    .prepare(
      `SELECT pageKey, path, title, content, status, updatedAt FROM "WebsitePage" WHERE pageKey = ?`,
    )
    .get(pageKey) as WebsitePageRecord | undefined;
  if (!saved) throw new Error("Unable to save website page.");
  return saved;
}

function createDefaultContent(title: string) {
  return `<section class="cms-hero center"><div class="cms-wrap"><p class="cms-kicker">Servio</p><h1>\${title}</h1><p>Edit this page visually or open Source Editing to paste HTML.</p></div></section><section class="cms-section"><div class="cms-wrap"><h2>Main section</h2><div class="cms-grid two"><div class="cms-card"><h3>Content card one</h3><p>Add your page content here.</p></div><div class="cms-card"><h3>Content card two</h3><p>Add supporting information here.</p></div></div><div class="cms-cta"><div><h2>Ready to get started?</h2><p>Join Servio today.</p></div><a class="cms-btn orange" href="/signup">Create account</a></div></div></section>`;
}
