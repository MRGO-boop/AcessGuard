/** Security audit log queries. */
import { getDb } from '../db/database.js';
import { toAuditLog } from '../db/mappers.js';
import type { AuditLog } from '../types.js';

const PRIVILEGE_ACTIONS = ['grant_access', 'revoke_access', 'role_change', 'privilege_escalation'];

export const auditRepo = {
  getByUser(userId: string, limit = 25): AuditLog[] {
    const rows = getDb()
      .prepare('SELECT * FROM audit_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?')
      .all(userId, limit) as Record<string, unknown>[];
    return rows.map(toAuditLog);
  },

  failedLogins(userId: string, limit = 25): AuditLog[] {
    const rows = getDb()
      .prepare(
        `SELECT * FROM audit_logs
         WHERE user_id = ? AND action = 'login' AND outcome = 'failure'
         ORDER BY timestamp DESC LIMIT ?`,
      )
      .all(userId, limit) as Record<string, unknown>[];
    return rows.map(toAuditLog);
  },

  recentPrivilegeChanges(userId: string, limit = 25): AuditLog[] {
    const placeholders = PRIVILEGE_ACTIONS.map(() => '?').join(',');
    const rows = getDb()
      .prepare(
        `SELECT * FROM audit_logs
         WHERE user_id = ? AND action IN (${placeholders})
         ORDER BY timestamp DESC LIMIT ?`,
      )
      .all(userId, ...PRIVILEGE_ACTIONS, limit) as Record<string, unknown>[];
    return rows.map(toAuditLog);
  },

  /** Distinct devices/countries the user has authenticated from. */
  deviceHistory(userId: string): { device: string; country: string; lastSeen: string }[] {
    const rows = getDb()
      .prepare(
        `SELECT device, country, MAX(timestamp) AS last_seen
         FROM audit_logs WHERE user_id = ?
         GROUP BY device, country ORDER BY last_seen DESC`,
      )
      .all(userId) as Record<string, unknown>[];
    return rows.map((r) => ({
      device: String(r.device),
      country: String(r.country),
      lastSeen: String(r.last_seen),
    }));
  },

  /** Logins originating outside the user's home country. */
  foreignLogins(userId: string, homeCountry: string): AuditLog[] {
    const rows = getDb()
      .prepare(
        `SELECT * FROM audit_logs
         WHERE user_id = ? AND action = 'login' AND country != ?
         ORDER BY timestamp DESC`,
      )
      .all(userId, homeCountry) as Record<string, unknown>[];
    return rows.map(toAuditLog);
  },
};
