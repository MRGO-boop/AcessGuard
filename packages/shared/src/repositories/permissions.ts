/** IAM permission grants, admin analytics, and mutation helpers. */
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/database.js';
import { toPermission, toEmployee } from '../db/mappers.js';
import type { Employee, Permission } from '../types.js';

export interface AdminWithoutMfa {
  employee: Employee;
  permission: Permission;
}

export interface GrantInput {
  userId: string;
  resource: string;
  role: string;
  sensitivity: Permission['sensitivity'];
  grantedBy: string;
  temporary?: boolean;
  expiresAt?: string | null;
}

export const permissionsRepo = {
  getByUser(userId: string): Permission[] {
    const rows = getDb()
      .prepare('SELECT * FROM permissions WHERE user_id = ? ORDER BY granted_at DESC')
      .all(userId) as Record<string, unknown>[];
    return rows.map(toPermission);
  },

  /** Users holding any admin/owner/root role. */
  listAdmins(): AdminWithoutMfa[] {
    const rows = getDb()
      .prepare(
        `SELECT p.*, e.id AS e_id FROM permissions p
         JOIN employees e ON e.id = p.user_id
         WHERE lower(p.role) LIKE '%admin%' OR lower(p.role) LIKE '%owner%' OR lower(p.role) LIKE '%root%'
         ORDER BY e.name`,
      )
      .all() as Record<string, unknown>[];
    return rows.map((r) => ({
      permission: toPermission(r),
      employee: usersById(String(r.user_id)),
    }));
  },

  /** Admin-level access held by users WITHOUT MFA — the classic risk query. */
  adminsWithoutMfa(): AdminWithoutMfa[] {
    return permissionsRepo.listAdmins().filter((a) => !a.employee.mfaEnabled);
  },

  /** Users who currently hold access to a given resource (substring match). */
  searchUsersWithAccess(resource: string): AdminWithoutMfa[] {
    const like = `%${resource.trim().toLowerCase()}%`;
    const rows = getDb()
      .prepare(
        `SELECT p.* FROM permissions p
         JOIN employees e ON e.id = p.user_id
         WHERE lower(p.resource) LIKE ?
         ORDER BY e.name`,
      )
      .all(like) as Record<string, unknown>[];
    return rows.map((r) => ({
      permission: toPermission(r),
      employee: usersById(String(r.user_id)),
    }));
  },

  /** Temporary grants expiring on or before the given ISO instant. */
  expiringTemp(beforeIso: string): AdminWithoutMfa[] {
    const rows = getDb()
      .prepare(
        `SELECT p.* FROM permissions p
         WHERE p.temporary = 1 AND p.expires_at IS NOT NULL AND p.expires_at <= ?
         ORDER BY p.expires_at ASC`,
      )
      .all(beforeIso) as Record<string, unknown>[];
    return rows.map((r) => ({
      permission: toPermission(r),
      employee: usersById(String(r.user_id)),
    }));
  },

  hasAccess(userId: string, resource: string): boolean {
    const row = getDb()
      .prepare('SELECT 1 FROM permissions WHERE user_id = ? AND lower(resource) = ? LIMIT 1')
      .get(userId, resource.toLowerCase());
    return Boolean(row);
  },

  grant(input: GrantInput): Permission {
    const id = `perm-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    getDb()
      .prepare(
        `INSERT INTO permissions
         (id, user_id, resource, role, sensitivity, granted_at, granted_by, temporary, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.userId,
        input.resource,
        input.role,
        input.sensitivity,
        now,
        input.grantedBy,
        input.temporary ? 1 : 0,
        input.expiresAt ?? null,
      );
    return toPermission(
      getDb().prepare('SELECT * FROM permissions WHERE id = ?').get(id) as Record<string, unknown>,
    );
  },

  /** Grants time-boxed access expiring `hours` from now. */
  grantTemporary(input: Omit<GrantInput, 'temporary' | 'expiresAt'>, hours: number): Permission {
    const expiresAt = new Date(Date.now() + hours * 3_600_000).toISOString();
    return permissionsRepo.grant({ ...input, temporary: true, expiresAt });
  },

  revoke(userId: string, resource: string): number {
    const result = getDb()
      .prepare('DELETE FROM permissions WHERE user_id = ? AND lower(resource) = ?')
      .run(userId, resource.toLowerCase());
    return Number(result.changes);
  },
};

function usersById(id: string): Employee {
  const row = getDb().prepare('SELECT * FROM employees WHERE id = ?').get(id) as Record<
    string,
    unknown
  >;
  return toEmployee(row);
}
