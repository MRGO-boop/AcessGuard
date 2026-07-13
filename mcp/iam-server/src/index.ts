/**
 * IAM MCP Server
 * ──────────────
 * Identity & Access Management tools. This is the only server that can
 * MUTATE state (grant/revoke/temporary access) — every mutation is what
 * the Slack "Approve / Deny / Grant Temporary" buttons ultimately call.
 *
 * Tools: getUserPermissions, grantAccess, revokeAccess, temporaryAccess,
 *        listAdmins, searchUsers
 */
import { z } from 'zod';
import { McpServer, jsonResult, serveStdio } from '@accessguard/shared/mcp';
import { usersRepo, permissionsRepo, accessRequestsRepo } from '@accessguard/shared';

const server = new McpServer({ name: 'iam-server', version: '1.0.0' });

function endOfToday(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

server.registerTool(
  'getUserPermissions',
  {
    title: 'Get User Permissions',
    description: 'List all IAM permissions currently held by a user (by employee id).',
    inputSchema: { userId: z.string().describe('Employee id, e.g. emp-001') },
  },
  async ({ userId }) => {
    const user = usersRepo.findById(userId);
    if (!user) return jsonResult({ error: `No user found with id ${userId}` });
    return jsonResult({
      user: { id: user.id, name: user.name, mfaEnabled: user.mfaEnabled },
      permissions: permissionsRepo.getByUser(userId),
    });
  },
);

server.registerTool(
  'grantAccess',
  {
    title: 'Grant Access',
    description: 'Permanently grant a user access to a resource with a given role.',
    inputSchema: {
      userId: z.string(),
      resource: z.string(),
      role: z.string(),
      sensitivity: z.enum(['low', 'medium', 'high', 'critical']).default('high'),
      grantedBy: z.string().default('AccessGuard'),
    },
  },
  async ({ userId, resource, role, sensitivity, grantedBy }) => {
    const user = usersRepo.findById(userId);
    if (!user) return jsonResult({ error: `No user found with id ${userId}` });
    const permission = permissionsRepo.grant({ userId, resource, role, sensitivity, grantedBy });
    return jsonResult({ status: 'granted', permission });
  },
);

server.registerTool(
  'revokeAccess',
  {
    title: 'Revoke Access',
    description: 'Revoke a user\'s access to a specific resource.',
    inputSchema: { userId: z.string(), resource: z.string() },
  },
  async ({ userId, resource }) => {
    const removed = permissionsRepo.revoke(userId, resource);
    return jsonResult({ status: removed > 0 ? 'revoked' : 'no_matching_grant', removed });
  },
);

server.registerTool(
  'temporaryAccess',
  {
    title: 'Grant Temporary Access',
    description: 'Grant time-boxed access that automatically expires after N hours.',
    inputSchema: {
      userId: z.string(),
      resource: z.string(),
      role: z.string().default('Temporary Access'),
      sensitivity: z.enum(['low', 'medium', 'high', 'critical']).default('high'),
      hours: z.number().min(1).max(72).default(4),
      grantedBy: z.string().default('AccessGuard'),
    },
  },
  async ({ userId, resource, role, sensitivity, hours, grantedBy }) => {
    const user = usersRepo.findById(userId);
    if (!user) return jsonResult({ error: `No user found with id ${userId}` });
    const permission = permissionsRepo.grantTemporary(
      { userId, resource, role, sensitivity, grantedBy },
      hours,
    );
    return jsonResult({ status: 'temporary_granted', hours, permission });
  },
);

server.registerTool(
  'listAdmins',
  {
    title: 'List Admins',
    description:
      'List every user holding an admin/owner/root role. Optionally filter to those WITHOUT MFA.',
    inputSchema: { withoutMfaOnly: z.boolean().default(false) },
  },
  async ({ withoutMfaOnly }) => {
    const admins = withoutMfaOnly
      ? permissionsRepo.adminsWithoutMfa()
      : permissionsRepo.listAdmins();
    return jsonResult({
      count: admins.length,
      admins: admins.map((a) => ({
        userId: a.employee.id,
        name: a.employee.name,
        title: a.employee.title,
        department: a.employee.department,
        mfaEnabled: a.employee.mfaEnabled,
        resource: a.permission.resource,
        role: a.permission.role,
      })),
    });
  },
);

server.registerTool(
  'searchUsers',
  {
    title: 'Search Users',
    description: 'Resolve a free-text name/email/id reference to matching employees.',
    inputSchema: { query: z.string() },
  },
  async ({ query }) => {
    const matches = usersRepo.searchByName(query);
    return jsonResult({
      count: matches.length,
      matches: matches.map((m) => ({
        id: m.id,
        name: m.name,
        title: m.title,
        department: m.department,
        employeeType: m.employeeType,
      })),
    });
  },
);

server.registerTool(
  'expiringTempAccess',
  {
    title: 'Expiring Temporary Access',
    description:
      'List temporary access grants expiring on or before an ISO instant (default: end of today).',
    inputSchema: { beforeIso: z.string().optional() },
  },
  async ({ beforeIso }) => {
    const cutoff = beforeIso ?? endOfToday();
    const rows = permissionsRepo.expiringTemp(cutoff).map((r) => ({
      userId: r.employee.id,
      name: r.employee.name,
      resource: r.permission.resource,
      role: r.permission.role,
      expiresAt: r.permission.expiresAt,
    }));
    return jsonResult({ cutoff, count: rows.length, rows });
  },
);

server.registerTool(
  'recordDecision',
  {
    title: 'Record Access Decision',
    description: 'Record the outcome of an access request (audit trail for Approve/Deny actions).',
    inputSchema: {
      userId: z.string(),
      resource: z.string(),
      role: z.string().default('Access'),
      status: z.enum(['approved', 'denied', 'granted_temp']),
      decidedBy: z.string().default('AccessGuard'),
    },
  },
  async ({ userId, resource, role, status, decidedBy }) => {
    const req = accessRequestsRepo.create({ userId, resource, role, requestedBy: decidedBy });
    const decided = accessRequestsRepo.decide(req.id, status, decidedBy);
    return jsonResult({ status: 'recorded', request: decided });
  },
);

await serveStdio(server, 'iam-server');
