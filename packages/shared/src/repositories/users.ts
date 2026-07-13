/** Employee (HR/IAM identity) queries. */
import { getDb } from '../db/database.js';
import { toEmployee } from '../db/mappers.js';
import type { Employee } from '../types.js';

export const usersRepo = {
  findById(id: string): Employee | null {
    const row = getDb().prepare('SELECT * FROM employees WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toEmployee(row) : null;
  },

  /**
   * Resolves a free-text name reference (e.g. "Rahul", "rahul sharma")
   * to a single employee. Prefers exact (case-insensitive) matches, then
   * unique prefix/substring matches.
   */
  findByName(query: string): Employee | null {
    const matches = usersRepo.searchByName(query);
    if (matches.length === 0) return null;
    const lower = query.trim().toLowerCase();
    const exact = matches.find((e) => e.name.toLowerCase() === lower);
    return exact ?? matches[0] ?? null;
  },

  searchByName(query: string): Employee[] {
    const like = `%${query.trim().toLowerCase()}%`;
    const rows = getDb()
      .prepare(
        `SELECT * FROM employees
         WHERE lower(name) LIKE ? OR lower(email) LIKE ? OR lower(id) LIKE ?
         ORDER BY name`,
      )
      .all(like, like, like) as Record<string, unknown>[];
    return rows.map(toEmployee);
  },

  getManager(userId: string): Employee | null {
    const user = usersRepo.findById(userId);
    if (!user?.managerId) return null;
    return usersRepo.findById(user.managerId);
  },

  listByDepartment(department: string): Employee[] {
    const rows = getDb()
      .prepare('SELECT * FROM employees WHERE lower(department) = ? ORDER BY name')
      .all(department.toLowerCase()) as Record<string, unknown>[];
    return rows.map(toEmployee);
  },

  all(): Employee[] {
    const rows = getDb()
      .prepare('SELECT * FROM employees ORDER BY name')
      .all() as Record<string, unknown>[];
    return rows.map(toEmployee);
  },
};
