import Database from "better-sqlite3";

const origin = process.env.SERVIO_ORIGIN || "http://localhost:8080";
const database = new Database("prisma/app.db");
const pages = database
  .prepare(`SELECT pageKey, path, status FROM "WebsitePage" WHERE pageKey <> 'home' ORDER BY rowid`)
  .all();

const setStatus = database.prepare(`UPDATE "WebsitePage" SET status = ? WHERE pageKey = ?`);
const saveSnapshot = database.prepare(
  `UPDATE "WebsitePage" SET content = ?, status = ?, updatedAt = ? WHERE pageKey = ?`,
);

for (const page of pages) {
  // Ensure the request renders the coded route, not an older published snapshot.
  setStatus.run("DRAFT", page.pageKey);

  const response = await fetch(`${origin}${page.path}`);
  if (!response.ok) {
    setStatus.run(page.status, page.pageKey);
    throw new Error(`Unable to render ${page.path}: HTTP ${response.status}`);
  }

  const document = await response.text();
  const content = extractPageContent(document);
  if (!content) {
    setStatus.run(page.status, page.pageKey);
    throw new Error(`Unable to find page content for ${page.path}`);
  }

  saveSnapshot.run(content, page.status, new Date().toISOString(), page.pageKey);
  console.log(`Synced ${page.path} (${content.length} characters)`);
}

function extractPageContent(document) {
  const afterHeader = document.match(/<\/header>([\s\S]*?)(?=<footer\b)/i)?.[1];
  if (afterHeader) return cleanMarkup(afterHeader);

  const main = document.match(/(<main\b[\s\S]*?<\/main>)/i)?.[1];
  return main ? cleanMarkup(main) : null;
}

function cleanMarkup(markup) {
  return markup
    .replace(/<!--\$-->|<!--\/\$-->|<!--\$\?-->|<!--\$!-->/g, "")
    .replace(/<template[^>]*><\/template>/g, "")
    .trim();
}
