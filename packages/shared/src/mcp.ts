/**
 * Thin helpers shared by all five MCP servers: a uniform way to build a
 * tool result and to start a stdio transport.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createLogger } from './logger.js';

export { McpServer };

/** Wraps any JSON-serialisable payload as an MCP text-content result. */
export function jsonResult(payload: unknown): {
  content: { type: 'text'; text: string }[];
} {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

/** Boots an McpServer over stdio and keeps the process alive. */
export async function serveStdio(server: McpServer, name: string): Promise<void> {
  const log = createLogger(name);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info(`MCP server "${name}" connected over stdio`);
}
