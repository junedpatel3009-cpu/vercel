import Database from "better-sqlite3";

const databasePath = process.argv[2] || "prisma/app.db";
const db = new Database(databasePath, { readonly: true });

const tables = db
  .prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
  )
  .all();

for (const { name } of tables) {
  const quotedName = name.replaceAll('"', '""');
  const { count } = db.prepare(`SELECT COUNT(*) AS count FROM "${quotedName}"`).get();
  console.log(`${name}\t${count}`);
}

db.close();
