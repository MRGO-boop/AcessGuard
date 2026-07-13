/**
 * MCP Client Manager
 * ──────────────────
 * Spawns all five MCP servers as child processes and connects to each
 * over stdio using the official MCP client SDK. This is the heart of the
 * "MCP orchestration" story: the Slack agent is a pure MCP *client* and
 * never touches the database directly.
 */
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { REPO_ROOT, resolveDbPath, createLogger } from '@accessguard/shared';

const log = createLogger('mcp-client');

export type ServerName = 'iam' | 'hr' | 'audit' | 'ticket' | 'policy';

export interface ToolDef {
  server: ServerName;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const SERVER_ENTRIES: Record<ServerName, string> = {
  iam: 'mcp/iam-server/src/index.ts',
  hr: 'mcp/hr-server/src/index.ts',
  audit: 'mcp/audit-server/src/index.ts',
  ticket: 'mcp/ticket-server/src/index.ts',
  policy: 'mcp/policy-server/src/index.ts',
};

interface Connection {
  client: Client;
  transport: StdioClientTransport;
}

export class McpClientManager {
  private readonly connections = new Map<ServerName, Connection>();

  /** Spawns + connects to every MCP server. Idempotent. */
  async connectAll(): Promise<void> {
    const dbPath = resolveDbPath();
    await Promise.all(
      (Object.keys(SERVER_ENTRIES) as ServerName[]).map((name) => this.connect(name, dbPath)),
    );
    log.info('All MCP servers connected', { servers: [...this.connections.keys()] });
  }

  private async connect(name: ServerName, dbPath: string): Promise<void> {
    if (this.connections.has(name)) return;
    const entry = resolve(REPO_ROOT, SERVER_ENTRIES[name]);

    const transport = new StdioClientTransport({
      command: process.execPath, // the current node binary
      args: ['--experimental-sqlite', '--import', 'tsx', entry],
      cwd: REPO_ROOT,
      env: { ...process.env, ACCESSGUARD_DB_PATH: dbPath } as Record<string, string>,
      stderr: 'inherit',
    });

    const client = new Client({ name: `accessguard-${name}-client`, version: '1.0.0' });
    await client.connect(transport);
    this.connections.set(name, { client, transport });
    log.debug(`Connected to ${name} MCP server`);
  }

  /** Calls a tool on a server and returns the parsed JSON payload. */
  async call<T = unknown>(
    server: ServerName,
    tool: string,
    args: Record<string, unknown> = {},
  ): Promise<T> {
    const conn = this.connections.get(server);
    if (!conn) throw new Error(`MCP server "${server}" is not connected`);

    const result = (await conn.client.callTool({ name: tool, arguments: args })) as {
      content?: { type: string; text?: string }[];
      isError?: boolean;
    };

    const text = result.content?.find((c) => c.type === 'text')?.text ?? '{}';
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  /** Returns the tool catalog per server (used for diagnostics / docs). */
  async listAllTools(): Promise<Record<string, string[]>> {
    const out: Record<string, string[]> = {};
    for (const [name, conn] of this.connections) {
      const { tools } = await conn.client.listTools();
      out[name] = tools.map((t) => t.name);
    }
    return out;
  }

  /** Full tool definitions across all servers, for LLM function-calling. */
  async listAllToolDefs(): Promise<ToolDef[]> {
    const out: ToolDef[] = [];
    for (const [server, conn] of this.connections) {
      const { tools } = await conn.client.listTools();
      for (const t of tools) {
        out.push({
          server,
          name: t.name,
          description: t.description ?? '',
          inputSchema: (t.inputSchema as Record<string, unknown>) ?? { type: 'object', properties: {} },
        });
      }
    }
    return out;
  }

  async close(): Promise<void> {
    for (const { client } of this.connections.values()) {
      await client.close().catch(() => undefined);
    }
    this.connections.clear();
  }
}

/** Process-wide singleton. */
export const mcp = new McpClientManager();
