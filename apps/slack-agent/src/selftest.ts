/**
 * Offline self-test: runs all four demo workflows through the real MCP
 * orchestration and prints a readable rendering of the resulting Slack
 * blocks. Lets you verify the full pipeline without Slack credentials.
 *
 * Assumes MCP servers are already connected (see index.ts / scripts/demo.ts).
 */
import { createLogger } from '@accessguard/shared';
import { parseIntent } from './nlp/intent.js';
import { runIntent } from './workflows/dispatcher.js';
import type { SlackBlock } from './slack/kit.js';

const log = createLogger('selftest');

const SCENARIOS = [
  'Should Rahul receive Production Database access?',
  'Investigate Rahul',
  'Who has admin access without MFA?',
  'Show temp access expiring today',
];

export async function runSelfTest(): Promise<void> {
  process.stdout.write('\n' + banner('ACCESSGUARD AI — OFFLINE SELF-TEST') + '\n');
  for (const scenario of SCENARIOS) {
    process.stdout.write(`\n\x1b[1m\x1b[36m▶ Admin asks:\x1b[0m "${scenario}"\n`);
    const blocks = await runIntent(parseIntent(scenario));
    process.stdout.write(renderBlocks(blocks) + '\n');
  }
  process.stdout.write('\n' + banner('SELF-TEST COMPLETE — all workflows executed via MCP') + '\n');
  log.info('Self-test finished');
}

/** Renders Block Kit blocks to plain, readable terminal text. */
function renderBlocks(blocks: SlackBlock[]): string {
  const lines: string[] = [];
  for (const b of blocks) {
    const type = b.type as string;
    if (type === 'header') {
      lines.push(`\n\x1b[1m═══ ${textOf(b.text)} ═══\x1b[0m`);
    } else if (type === 'section') {
      if (b.text) lines.push(clean(textOf(b.text)));
      if (Array.isArray(b.fields)) {
        for (const f of b.fields as { text: string }[]) lines.push('  ' + clean(f.text));
      }
    } else if (type === 'context') {
      const els = (b.elements as { text: string }[]).map((e) => clean(e.text)).join(' · ');
      lines.push(`\x1b[90m${els}\x1b[0m`);
    } else if (type === 'actions') {
      const btns = (b.elements as { text: { text: string } }[]).map((e) => `[ ${e.text.text} ]`);
      lines.push('\x1b[33m' + btns.join('  ') + '\x1b[0m');
    } else if (type === 'divider') {
      lines.push('\x1b[90m────────────────────────────────────────\x1b[0m');
    }
  }
  return lines.join('\n');
}

function textOf(t: unknown): string {
  if (t && typeof t === 'object' && 'text' in t) return String((t as { text: unknown }).text);
  return String(t ?? '');
}

/** Strips Slack mrkdwn bold markers for cleaner terminal output. */
function clean(s: string): string {
  return s.replace(/\*(.+?)\*/g, '\x1b[1m$1\x1b[0m').replace(/`(.+?)`/g, '\x1b[36m$1\x1b[0m');
}

function banner(text: string): string {
  const line = '═'.repeat(text.length + 4);
  return `\x1b[35m${line}\n  ${text}\n${line}\x1b[0m`;
}
