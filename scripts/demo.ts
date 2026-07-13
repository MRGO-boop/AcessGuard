/**
 * Standalone demo runner — connects to the MCP servers and runs the four
 * demo workflows offline (no Slack needed). Great for verifying everything
 * works before wiring up Slack.
 *
 * Run: node --experimental-sqlite --import tsx scripts/demo.ts
 */
import { mcp } from '../apps/slack-agent/src/mcp/client-manager.js';
import { runSelfTest } from '../apps/slack-agent/src/selftest.js';

async function main(): Promise<void> {
  await mcp.connectAll();
  await runSelfTest();
  await mcp.close();
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`Demo failed: ${(err as Error).stack}\n`);
  process.exit(1);
});
