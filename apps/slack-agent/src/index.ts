/**
 * AccessGuard AI — Slack agent entry point.
 *
 * 1. Connects to all five MCP servers (spawned as child processes).
 * 2. If Slack is configured, starts the Bolt app in Socket Mode.
 * 3. If Slack is NOT configured, runs an offline self-test so the project
 *    is always runnable and demoable without credentials.
 *
 * Run with: node --experimental-sqlite --import tsx apps/slack-agent/src/index.ts
 */
import { createServer } from 'node:http';
import { App, LogLevel } from '@slack/bolt';
import { createLogger } from '@accessguard/shared';
import { config } from './config.js';
import { mcp } from './mcp/client-manager.js';
import { registerHandlers } from './slack/handlers.js';
import { runSelfTest } from './selftest.js';

const log = createLogger('main');

/**
 * Minimal health server. Socket Mode needs no inbound port, but PaaS hosts
 * (Render, Railway, etc.) require the process to bind $PORT and answer health
 * checks. Only starts when PORT is set, so local dev is unaffected.
 */
function startHealthServer(): void {
  const port = process.env.PORT;
  if (!port) return;
  createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('AccessGuard AI — OK\n');
  }).listen(Number(port), '0.0.0.0', () => log.info(`Health server listening on :${port}`));
}

async function main(): Promise<void> {
  log.info('Starting AccessGuard AI…');
  startHealthServer(); // bind $PORT early so PaaS health checks pass
  await mcp.connectAll();
  const catalog = await mcp.listAllTools();
  log.info('MCP tool catalog', catalog);

  if (!config.slack.configured) {
    log.warn('Slack credentials not set (.env) — running OFFLINE SELF-TEST instead.');
    await runSelfTest();
    await mcp.close();
    process.exit(0);
  }

  const app = new App({
    token: config.slack.botToken,
    appToken: config.slack.appToken,
    signingSecret: config.slack.signingSecret,
    socketMode: true,
    logLevel: LogLevel.INFO,
  });

  registerHandlers(app);
  await app.start();
  log.info('⚡ AccessGuard is running in Slack (Socket Mode). Mention @AccessGuard to begin.');
}

// Friendly handling for the most common misconfiguration: bad Slack tokens.
process.on('unhandledRejection', (reason) => {
  const msg = (reason as { data?: { error?: string } })?.data?.error ?? String(reason);
  if (msg === 'invalid_auth' || msg === 'not_authed' || msg === 'account_inactive') {
    log.error(
      'Slack authentication failed. Check SLACK_BOT_TOKEN / SLACK_APP_TOKEN / SLACK_SIGNING_SECRET in .env. ' +
        'Ensure Socket Mode is enabled and the App-Level token has the connections:write scope.',
    );
  } else {
    log.error('Unhandled rejection', { reason: msg });
  }
  void mcp.close().finally(() => process.exit(1));
});

// Graceful shutdown.
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    log.info(`Received ${sig}, shutting down…`);
    await mcp.close();
    process.exit(0);
  });
}

main().catch(async (err) => {
  log.error('Fatal error during startup', { error: (err as Error).message, stack: (err as Error).stack });
  await mcp.close().catch(() => undefined);
  process.exit(1);
});
