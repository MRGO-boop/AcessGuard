/** Security policy queries. */
import { getDb } from '../db/database.js';
import { toPolicy } from '../db/mappers.js';
import type { Policy } from '../types.js';

export const policiesRepo = {
  all(): Policy[] {
    const rows = getDb().prepare('SELECT * FROM policies ORDER BY name').all() as Record<
      string,
      unknown
    >[];
    return rows.map(toPolicy);
  },

  findById(id: string): Policy | null {
    const row = getDb().prepare('SELECT * FROM policies WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toPolicy(row) : null;
  },

  /**
   * Returns every policy whose resource pattern matches the resource.
   * Patterns support a trailing `*` wildcard (e.g. "Production*").
   */
  findForResource(resource: string): Policy[] {
    const target = resource.trim().toLowerCase();
    return policiesRepo.all().filter((p) => matchesPattern(target, p.resourcePattern.toLowerCase()));
  },
};

function matchesPattern(resource: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern.endsWith('*')) {
    return resource.startsWith(pattern.slice(0, -1));
  }
  return resource === pattern || resource.includes(pattern);
}
