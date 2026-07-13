/**
 * Ticket MCP Server
 * ─────────────────
 * ITSM change/access-request tickets — the paper trail that access
 * decisions are supposed to reference.
 *
 * Tools: getOpenTickets, approvalStatus, changeRequests
 */
import { z } from 'zod';
import { McpServer, jsonResult, serveStdio } from '@accessguard/shared/mcp';
import { usersRepo, ticketsRepo } from '@accessguard/shared';

const server = new McpServer({ name: 'ticket-server', version: '1.0.0' });

function resolveId(idOrName: string): string | null {
  return (usersRepo.findById(idOrName) ?? usersRepo.findByName(idOrName))?.id ?? null;
}

server.registerTool(
  'getOpenTickets',
  {
    title: 'Get Open Tickets',
    description: 'Open / in-review tickets associated with a user.',
    inputSchema: { idOrName: z.string() },
  },
  async ({ idOrName }) => {
    const id = resolveId(idOrName);
    if (!id) return jsonResult({ error: `No employee matched "${idOrName}"` });
    const open = ticketsRepo.getOpenByUser(id);
    return jsonResult({ userId: id, count: open.length, tickets: open });
  },
);

server.registerTool(
  'approvalStatus',
  {
    title: 'Approval Status',
    description:
      'Check whether an approved access-request ticket backs a user\'s request for a resource.',
    inputSchema: { idOrName: z.string(), resource: z.string() },
  },
  async ({ idOrName, resource }) => {
    const id = resolveId(idOrName);
    if (!id) return jsonResult({ error: `No employee matched "${idOrName}"` });
    const ticket = ticketsRepo.approvalStatus(id, resource);
    return jsonResult({
      userId: id,
      resource,
      hasTicket: Boolean(ticket),
      isApproved: ticket?.status === 'approved',
      ticket,
    });
  },
);

server.registerTool(
  'changeRequests',
  {
    title: 'Change Requests',
    description: 'All tickets for a user (any status) — full history.',
    inputSchema: { idOrName: z.string() },
  },
  async ({ idOrName }) => {
    const id = resolveId(idOrName);
    if (!id) return jsonResult({ error: `No employee matched "${idOrName}"` });
    return jsonResult({ userId: id, tickets: ticketsRepo.getByUser(id) });
  },
);

await serveStdio(server, 'ticket-server');
