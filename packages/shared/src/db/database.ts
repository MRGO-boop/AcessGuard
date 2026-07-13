/**
 * SQLite connection built on Node's native `node:sqlite` module.
 * Requires the `--experimental-sqlite` flag (already wired into every
 * npm script and the MCP spawn commands).
 *
 * A single shared connection is memoised per process.
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDbPath } from '../paths.js';
import { createLogger } from '../logger.js';

const log = createLogger('db');
const here = dirname(fileURLToPath(import.meta.url));

let connection: DatabaseSync | null = null;

/** Returns the process-wide SQLite connection, creating the schema on first use. */
export function getDb(): DatabaseSync {
  if (connection) return connection;

  const dbPath = resolveDbPath();
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA busy_timeout = 5000;');
  applySchema(db);

  connection = db;
  log.debug('SQLite connection opened', { dbPath });
  return connection;
}

/** Applies the schema (idempotent — uses CREATE TABLE IF NOT EXISTS). */
export function applySchema(db: DatabaseSync): void {
  const schema = readFileSync(resolve(here, 'schema.sql'), 'utf8');
  db.exec(schema);
}

/** Closes and clears the memoised connection (used by the seeder). */
export function closeDb(): void {
  if (connection) {
    connection.close();
    connection = null;
  }
}
