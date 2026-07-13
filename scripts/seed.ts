/**
 * Seeds the AccessGuard SQLite database.
 *
 *   npm run seed          # create + populate if empty-ish
 *   npm run reset-db      # force re-seed (alias: --force)
 *
 * Run with: node --experimental-sqlite --import tsx scripts/seed.ts
 */
import { getDb, closeDb, resolveDbPath, createLogger, seedDatabase } from '@accessguard/shared';

const log = createLogger('seed-script');

function main(): void {
  const dbPath = resolveDbPath();
  log.info('Seeding database', { dbPath });

  const db = getDb();
  seedDatabase(db);

  const count = (db.prepare('SELECT COUNT(*) AS c FROM employees').get() as { c: number }).c;
  log.info(`Database ready — ${count} employees loaded.`);

  closeDb();
  process.stdout.write('\n✅ AccessGuard database seeded successfully.\n');
}

main();
