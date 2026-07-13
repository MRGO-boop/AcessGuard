/** Change/access-request ticket queries. */
import { getDb } from '../db/database.js';
import { toTicket } from '../db/mappers.js';
import type { Ticket } from '../types.js';

export const ticketsRepo = {
  getByUser(userId: string): Ticket[] {
    const rows = getDb()
      .prepare('SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as Record<string, unknown>[];
    return rows.map(toTicket);
  },

  getOpenByUser(userId: string): Ticket[] {
    const rows = getDb()
      .prepare(
        `SELECT * FROM tickets
         WHERE user_id = ? AND status IN ('open','in_review')
         ORDER BY created_at DESC`,
      )
      .all(userId) as Record<string, unknown>[];
    return rows.map(toTicket);
  },

  /**
   * Finds an approval ticket covering a given resource for a user, if any.
   * Used to check whether an access request has a paper trail.
   */
  approvalStatus(userId: string, resource: string): Ticket | null {
    const like = `%${resource.trim().toLowerCase()}%`;
    const row = getDb()
      .prepare(
        `SELECT * FROM tickets
         WHERE user_id = ? AND type = 'access_request'
           AND (lower(resource) LIKE ? OR lower(title) LIKE ?)
         ORDER BY created_at DESC LIMIT 1`,
      )
      .get(userId, like, like) as Record<string, unknown> | undefined;
    return row ? toTicket(row) : null;
  },
};
