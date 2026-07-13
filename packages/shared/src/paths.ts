/**
 * Resolves shared filesystem paths (primarily the SQLite database file)
 * in a way that works whether code runs from the repo root, a workspace
 * package, or a spawned MCP subprocess.
 */
import { dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // packages/shared/src
export const REPO_ROOT = resolve(here, '../../..'); // → repo root

/**
 * Absolute path to the SQLite database.
 * Priority: ACCESSGUARD_DB_PATH env var → `<repo>/database/accessguard.db`.
 */
export function resolveDbPath(): string {
  const fromEnv = process.env.ACCESSGUARD_DB_PATH;
  if (fromEnv && fromEnv.trim().length > 0) {
    return isAbsolute(fromEnv) ? fromEnv : resolve(process.cwd(), fromEnv);
  }
  return resolve(REPO_ROOT, 'database', 'accessguard.db');
}
