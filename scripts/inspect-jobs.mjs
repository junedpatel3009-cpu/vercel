import Database from 'better-sqlite3';
import path from 'node:path';

const dbPath = path.resolve(process.cwd(), 'prisma', 'app.db');
const db = new Database(dbPath, { readonly: true });

function run() {
  const total = db.prepare('SELECT COUNT(*) AS c FROM "ClientJob"').get()?.c ?? 0;
  const byTiming = db
    .prepare('SELECT timingType, COUNT(*) AS c FROM "ClientJob" GROUP BY timingType')
    .all();
  const recent = db
    .prepare(
      `SELECT id, title, timingType, hourlyRate, status, createdAt FROM "ClientJob" ORDER BY datetime(createdAt) DESC LIMIT 10`,
    )
    .all();

  console.log('DB:', dbPath);
  console.log('Total ClientJob rows:', total);
  console.log('By timing type:');
  for (const row of byTiming) console.log(' ', row.timingType, row.c);
  console.log('\nRecent jobs:');
  for (const r of recent) console.log(' ', r.id, r.title, r.timingType, r.hourlyRate, r.status, r.createdAt);
}

try {
  run();
} catch (e) {
  console.error('Error reading DB', e);
}
