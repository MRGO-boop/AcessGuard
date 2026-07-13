/**
 * Showcases the autonomous agent loop: the LLM chooses which MCP tools to
 * call. Prints each question, the agent's answer, and the real tool-call trace.
 *
 * Run: node --experimental-sqlite --import tsx scripts/agent-demo.ts
 */
import { mcp } from '../apps/slack-agent/src/mcp/client-manager.js';
import { runAgent } from '../apps/slack-agent/src/agent/agent-loop.js';
import { llmEnabled } from '../apps/slack-agent/src/ai/client.js';

const QUESTIONS = [
  'Should Rahul receive Production Database access?',
  'Who has admin access without MFA?',
  'Investigate Leo Fischer for me.',
];

async function main(): Promise<void> {
  if (!llmEnabled) {
    process.stderr.write('No LLM key set — the agent loop needs OPENROUTER_API_KEY or OPENAI_API_KEY.\n');
    process.exit(1);
  }
  await mcp.connectAll();
  for (const q of QUESTIONS) {
    process.stdout.write(`\n\x1b[1m\x1b[36m▶ ${q}\x1b[0m\n`);
    const r = await runAgent(q);
    process.stdout.write(`\x1b[90m— agent made ${r.trace.length} tool call(s):\x1b[0m\n`);
    r.trace.forEach((t, i) =>
      process.stdout.write(`  ${i + 1}. ${t.server}.${t.tool}(${JSON.stringify(t.args)})\n`),
    );
    process.stdout.write(`\n${r.answer}\n`);
    process.stdout.write('\x1b[90m' + '─'.repeat(60) + '\x1b[0m\n');
  }
  await mcp.close();
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`Agent demo failed: ${(err as Error).stack}\n`);
  process.exit(1);
});
