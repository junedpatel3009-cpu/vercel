import "dotenv/config";
import pg from "pg";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DIRECT_URL or DATABASE_URL must be configured.");
}

const client = new pg.Client({ connectionString });
await client.connect();

try {
  const { rows: tables } = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  for (const { table_name: tableName } of tables) {
    const escapedName = tableName.replaceAll('"', '""');
    const { rows } = await client.query(`SELECT COUNT(*)::int AS count FROM "${escapedName}"`);
    console.log(`${tableName}\t${rows[0].count}`);
  }
} finally {
  await client.end();
}
