/**
 * High-level Block Kit "views" — one builder per demo surface. These take
 * domain data and produce polished, security-themed Slack messages.
 */
import type { RiskLevel } from '@accessguard/shared';
import type {
  AccessContext,
  InvestigationReport,
  AdminRow,
  ExpiringAccessRow,
} from '../mcp/orchestrator.js';
import type { ReasonedDecision } from '../ai/reasoner.js';
import { header, section, context, divider, fields, actions, type SlackBlock } from './kit.js';

const RISK_BADGE: Record<RiskLevel, string> = {
  Low: '🟢 *LOW*',
  Medium: '🟡 *MEDIUM*',
  High: '🟠 *HIGH*',
  Critical: '🔴 *CRITICAL*',
};

const REC_BADGE: Record<ReasonedDecision['recommendation'], string> = {
  APPROVE: '✅ *APPROVE*',
  APPROVE_WITH_CONDITIONS: '🟡 *APPROVE WITH CONDITIONS*',
  DENY: '⛔ *DENY*',
  ESCALATE: '🔺 *ESCALATE*',
};

/** A textual risk meter, e.g. ▰▰▰▰▰▰▱▱▱▱ 63/100. */
function riskMeter(score: number): string {
  const filled = Math.round((Math.min(score, 100) / 100) * 10);
  return '▰'.repeat(filled) + '▱'.repeat(10 - filled) + `  \`${score}/100\``;
}

export interface ActionPayload {
  userId: string;
  name: string;
  resource: string;
}

// ── Demo #1: Access Review ───────────────────────────────────

export function accessReviewView(ctx: AccessContext, decision: ReasonedDecision): SlackBlock[] {
  const payload: ActionPayload = {
    userId: ctx.employee.id,
    name: ctx.employee.name,
    resource: ctx.resource,
  };
  const value = JSON.stringify(payload);

  const blocks: SlackBlock[] = [
    header('🛡️ Access Review'),
    section(
      `*Request:* Should *${ctx.employee.name}* receive *${ctx.resource}* access?\n` +
        `*Subject:* ${ctx.employee.title} · ${ctx.employee.department} · \`${ctx.employee.id}\``,
    ),
    divider(),
    section(
      `*Recommendation:* ${REC_BADGE[decision.recommendation]}\n` +
        `*Risk:* ${RISK_BADGE[decision.riskLevel]}   ${riskMeter(decision.riskScore)}\n` +
        `*Confidence:* \`${decision.confidence}%\``,
    ),
    section(`*🧠 Reasoning*\n${decision.reason}`),
    section(`*🔎 Key Findings*\n${decision.keyFindings.map((f) => `• ${f}`).join('\n')}`),
  ];

  if (decision.policyViolations.length) {
    blocks.push(
      section(
        `*🚨 Policy Violations*\n${decision.policyViolations.map((v) => `• ${v}`).join('\n')}`,
      ),
    );
  }

  blocks.push(
    section(`*🛠️ Suggested Action*\n${decision.suggestedAction}`),
    actions([
      { text: 'Approve', actionId: 'access_approve', value, style: 'primary', emoji: '✅' },
      { text: 'Deny', actionId: 'access_deny', value, style: 'danger', emoji: '⛔' },
      { text: 'Grant Temporary', actionId: 'access_temp', value, emoji: '⏳' },
      { text: 'Investigate User', actionId: 'access_investigate', value, emoji: '🔍' },
    ]),
    context([
      `Analyzed via 5 MCP servers (HR · IAM · Audit · Ticket · Policy)` +
        (ctx.applicablePolicies.length
          ? ` · Policies: ${ctx.applicablePolicies.map((p) => p.name).join(', ')}`
          : ''),
      decision.source === 'llm'
        ? '🤖 Reasoning: LLM narrative + deterministic risk engine'
        : '⚙️ Reasoning: deterministic risk engine',
    ]),
  );

  return blocks;
}

// ── Demo #2: Investigation ───────────────────────────────────

export function investigationView(report: InvestigationReport): SlackBlock[] {
  const e = report.employee;
  const statusEmoji = e.employmentStatus === 'active' ? '🟢' : '🔴';

  const blocks: SlackBlock[] = [
    header(`🔍 Investigation — ${e.name}`),
    fields([
      `*Employee*\n${e.name} (\`${e.id}\`)`,
      `*Title*\n${e.title}`,
      `*Department*\n${e.department}`,
      `*Manager*\n${report.manager ? report.manager.name : '—'}`,
      `*Status*\n${statusEmoji} ${e.employmentStatus} · ${e.employeeType}`,
      `*MFA*\n${e.mfaEnabled ? '✅ Enabled' : '🔓 Disabled'}`,
      `*Location*\n${e.location} (${e.country})`,
      `*Security Training*\n${e.securityTrainingComplete ? '🎓 Complete' : '❌ Incomplete'}`,
    ]),
    divider(),
    section(
      `*🧾 Security Signals*\n` +
        `• Failed logins: \`${report.failedLoginCount}\`\n` +
        `• Foreign login countries: ${report.foreignLoginCountries.length ? report.foreignLoginCountries.map((c) => `\`${c}\``).join(', ') : '`none`'}\n` +
        `• Privilege changes (recent): \`${report.privilegeChanges.length}\``,
    ),
  ];

  blocks.push(
    section(
      `*🔑 Current Permissions (${report.permissions.length})*\n` +
        (report.permissions.length
          ? report.permissions
              .map(
                (p) =>
                  `• ${sensitivityDot(p.sensitivity)} *${p.resource}* — ${p.role}${p.temporary ? ' _(temp)_' : ''}`,
              )
              .join('\n')
          : '_No permissions on record._'),
    ),
  );

  if (report.deviceHistory.length) {
    blocks.push(
      section(
        `*💻 Device & Geo History*\n` +
          report.deviceHistory
            .slice(0, 5)
            .map((d) => `• ${d.device} — ${d.country} · ${shortDate(d.lastSeen)}`)
            .join('\n'),
      ),
    );
  }

  if (report.openTickets.length) {
    blocks.push(
      section(
        `*🎫 Open Tickets*\n` +
          report.openTickets.map((t) => `• \`${t.id}\` ${t.title} — _${t.status}_`).join('\n'),
      ),
    );
  }

  blocks.push(
    section(
      `*⚖️ Least-Privilege Review*\n` +
        (report.leastPrivilege.leastPrivilegeOk
          ? '✅ No least-privilege issues detected.'
          : report.leastPrivilege.findings.map((f) => `• 🚩 ${f}`).join('\n')),
    ),
    context(['Generated by AccessGuard AI · Sources: HR · IAM · Audit · Ticket · Policy MCP servers']),
  );

  return blocks;
}

// ── Demo #3: Admins without MFA ──────────────────────────────

export function adminsWithoutMfaView(rows: AdminRow[]): SlackBlock[] {
  if (!rows.length) {
    return [
      header('🔐 Admins Without MFA'),
      section('✅ *Great news* — every admin account has MFA enabled.'),
    ];
  }
  return [
    header('🔐 Admins Without MFA'),
    section(`Found *${rows.length}* privileged account(s) missing MFA — immediate risk:`),
    divider(),
    ...rows.map((r) =>
      section(
        `🔴 *${r.name}* — ${r.title}\n` +
          `• Access: *${r.resource}* (${r.role})\n` +
          `• Dept: ${r.department} · \`${r.userId}\``,
      ),
    ),
    context([`⚠️ Recommend enforcing MFA enrollment before next login for all ${rows.length} account(s).`]),
  ];
}

// ── Demo #4: Expiring temporary access ───────────────────────

export function expiringAccessView(rows: ExpiringAccessRow[]): SlackBlock[] {
  if (!rows.length) {
    return [
      header('⏳ Temporary Access Expiring Today'),
      section('✅ No temporary access grants are expiring today.'),
    ];
  }
  return [
    header('⏳ Temporary Access Expiring Today'),
    section(`*${rows.length}* temporary grant(s) expire today:`),
    divider(),
    ...rows.map((r) =>
      section(
        `⌛ *${r.name}* → *${r.resource}* (${r.role})\n• Expires: \`${shortTime(r.expiresAt)}\` · \`${r.userId}\``,
      ),
    ),
    context(['Tip: run `/tempaccess extend` workflows or let them auto-expire.']),
  ];
}

// ── Autonomous agent (LLM-driven tool calling) ───────────────

export interface AgentTraceEntry {
  server: string;
  tool: string;
  args: Record<string, unknown>;
}

const SERVER_EMOJI: Record<string, string> = {
  hr: '📇',
  iam: '🔑',
  audit: '🕵️',
  ticket: '🎫',
  policy: '📜',
};

function compactArgs(args: Record<string, unknown>): string {
  const v = args.idOrName ?? args.query ?? args.resource ?? args.userId ?? '';
  const extra = args.resource && (args.idOrName || args.userId) ? ` · ${String(args.resource)}` : '';
  return v ? `${String(v)}${extra}` : '';
}

export function agentView(opts: {
  answer: string;
  trace: AgentTraceEntry[];
  payload?: ActionPayload;
  model?: string;
}): SlackBlock[] {
  const { answer, trace, payload } = opts;
  const systems = new Set(trace.map((t) => t.server));

  const blocks: SlackBlock[] = [
    header('🤖 AccessGuard Agent'),
    section(slackifyMarkdown(answer) || '_No response produced._'),
  ];

  if (trace.length) {
    blocks.push(divider());
    blocks.push(
      section(
        `*🔧 How I investigated* — _${trace.length} autonomous tool call(s) across ${systems.size} system(s)_\n` +
          trace
            .map((t, i) => {
              const arg = compactArgs(t.args);
              return `\`${i + 1}\` ${SERVER_EMOJI[t.server] ?? '•'} \`${t.server}.${t.tool}${arg ? `(${arg})` : '()'}\``;
            })
            .join('\n'),
      ),
    );
  }

  if (payload) {
    const value = JSON.stringify(payload);
    blocks.push(
      actions([
        { text: 'Approve', actionId: 'access_approve', value, style: 'primary', emoji: '✅' },
        { text: 'Deny', actionId: 'access_deny', value, style: 'danger', emoji: '⛔' },
        { text: 'Grant Temporary', actionId: 'access_temp', value, emoji: '⏳' },
        { text: 'Investigate User', actionId: 'access_investigate', value, emoji: '🔍' },
      ]),
    );
  }

  blocks.push(
    context([
      `🧠 Autonomous MCP agent${opts.model ? ` · ${opts.model}` : ''} · risk scored by deterministic engine`,
    ]),
  );
  return blocks;
}

// ── Confirmations / help / errors ────────────────────────────

export function confirmationView(title: string, lines: string[]): SlackBlock[] {
  return [section(`*${title}*\n${lines.map((l) => `• ${l}`).join('\n')}`)];
}

export function errorView(message: string): SlackBlock[] {
  return [section(`⚠️ ${message}`)];
}

export function helpView(): SlackBlock[] {
  return [
    header('🛡️ AccessGuard AI'),
    section(
      '*AI-powered Identity & Access Management, right inside Slack.*\n' +
        'Ask me in natural language or use a slash command:',
    ),
    section(
      '*💬 Mention me:*\n' +
        '• `@AccessGuard Should Rahul receive Production Database access?`\n' +
        '• `@AccessGuard Investigate Rahul`\n' +
        '• `@AccessGuard Who has admin access without MFA?`\n' +
        '• `@AccessGuard Show temp access expiring today`',
    ),
    section(
      '*⌨️ Slash commands:*\n' +
        '• `/access <name> · <resource>` — review an access request\n' +
        '• `/investigate <name>` — deep-dive on a user\n' +
        '• `/risk <name> · <resource>` — quick risk score\n' +
        '• `/admins` — admins without MFA\n' +
        '• `/tempaccess` — temp access expiring today',
    ),
    context(['Powered by 5 MCP servers · HR · IAM · Audit · Ticket · Policy']),
  ];
}

// ── helpers ──────────────────────────────────────────────────

/** Converts common GitHub-flavoured markdown (from the LLM) to Slack mrkdwn. */
export function slackifyMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '*$1*') // **bold** → *bold*
    .replace(/^#{1,6}\s*(.+)$/gm, '*$1*') // # Heading → *Heading*
    .replace(/^\s*[-*]\s+/gm, '• ') // "- item" / "* item" → "• item"
    .trim();
}

function sensitivityDot(s: string): string {
  return { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' }[s] ?? '⚪';
}
function shortDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}
function shortTime(iso: string): string {
  return new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}
