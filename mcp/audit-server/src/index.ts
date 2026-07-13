/**
 * Audit MCP Server
 * ────────────────
 * Security telemetry: login history, failed logins, privilege changes,
 * device/geo history, and foreign-login detection.
 *
 * Tools: getAuditLogs, failedLogins, recentPrivilegeChanges,
 *        deviceHistory, foreignLogins
 */
import { z } from 'zod';
import { McpServer, jsonResult, serveStdio } from '@accessguard/shared/mcp';
import { usersRepo, auditRepo } from '@accessguard/shared';

const server = new McpServer({ name: 'audit-server', version: '1.0.0' });

function resolveId(idOrName: string): string | null {
  return (usersRepo.findById(idOrName) ?? usersRepo.findByName(idOrName))?.id ?? null;
}

server.registerTool(
  'getAuditLogs',
  {
    title: 'Get Audit Logs',
    description: 'Recent audit-log entries for a user (most recent first).',
    inputSchema: { idOrName: z.string(), limit: z.number().min(1).max(100).default(25) },
  },
  async ({ idOrName, limit }) => {
    const id = resolveId(idOrName);
    if (!id) return jsonResult({ error: `No employee matched "${idOrName}"` });
    return jsonResult({ userId: id, logs: auditRepo.getByUser(id, limit) });
  },
);

server.registerTool(
  'failedLogins',
  {
    title: 'Failed Logins',
    description: 'Failed login attempts for a user — a key risk signal.',
    inputSchema: { idOrName: z.string() },
  },
  async ({ idOrName }) => {
    const id = resolveId(idOrName);
    if (!id) return jsonResult({ error: `No employee matched "${idOrName}"` });
    const failures = auditRepo.failedLogins(id);
    return jsonResult({ userId: id, count: failures.length, failures });
  },
);

server.registerTool(
  'recentPrivilegeChanges',
  {
    title: 'Recent Privilege Changes',
    description: 'Grant/revoke/role-change/escalation events for a user.',
    inputSchema: { idOrName: z.string() },
  },
  async ({ idOrName }) => {
    const id = resolveId(idOrName);
    if (!id) return jsonResult({ error: `No employee matched "${idOrName}"` });
    const changes = auditRepo.recentPrivilegeChanges(id);
    return jsonResult({ userId: id, count: changes.length, changes });
  },
);

server.registerTool(
  'deviceHistory',
  {
    title: 'Device & Geo History',
    description: 'Distinct devices and countries a user has authenticated from.',
    inputSchema: { idOrName: z.string() },
  },
  async ({ idOrName }) => {
    const id = resolveId(idOrName);
    if (!id) return jsonResult({ error: `No employee matched "${idOrName}"` });
    return jsonResult({ userId: id, history: auditRepo.deviceHistory(id) });
  },
);

server.registerTool(
  'foreignLogins',
  {
    title: 'Foreign Logins',
    description:
      'Logins originating outside the user\'s home country — a strong anomaly signal.',
    inputSchema: { idOrName: z.string() },
  },
  async ({ idOrName }) => {
    const emp = usersRepo.findById(idOrName) ?? usersRepo.findByName(idOrName);
    if (!emp) return jsonResult({ error: `No employee matched "${idOrName}"` });
    const foreign = auditRepo.foreignLogins(emp.id, emp.country);
    return jsonResult({
      userId: emp.id,
      homeCountry: emp.country,
      count: foreign.length,
      countries: [...new Set(foreign.map((f) => f.country))],
      logins: foreign,
    });
  },
);

await serveStdio(server, 'audit-server');
