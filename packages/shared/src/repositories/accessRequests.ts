/** Access-request lifecycle (create → decide). */
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/database.js';
import { toAccessRequest } from '../db/mappers.js';
import type { AccessRequest, AccessRequestStatus } from '../types.js';

export const accessRequestsRepo = {
  create(input: {
    userId: string;
    resource: string;
    role: string;
    requestedBy: string;
  }): AccessRequest {
    const id = `req-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    getDb()
      .prepare(
        `INSERT INTO access_requests
         (id, user_id, resource, role, status, requested_by, decided_by, created_at, decided_at)
         VALUES (?, ?, ?, ?, 'pending', ?, NULL, ?, NULL)`,
      )
      .run(id, input.userId, input.resource, input.role, input.requestedBy, now);
    return accessRequestsRepo.findById(id)!;
  },

  findById(id: string): AccessRequest | null {
    const row = getDb().prepare('SELECT * FROM access_requests WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toAccessRequest(row) : null;
  },

  decide(id: string, status: AccessRequestStatus, decidedBy: string): AccessRequest | null {
    const now = new Date().toISOString();
    getDb()
      .prepare('UPDATE access_requests SET status = ?, decided_by = ?, decided_at = ? WHERE id = ?')
      .run(status, decidedBy, now, id);
    return accessRequestsRepo.findById(id);
  },
};
