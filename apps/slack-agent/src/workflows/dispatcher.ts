/**
 * Workflow dispatcher — the bridge between a parsed intent (or a button
 * click) and the MCP orchestration + Block Kit rendering.
 */
import { createLogger } from '@accessguard/shared';
import { parseIntent, type Intent } from '../nlp/intent.js';
import {
  gatherAccessContext,
  gatherInvestigation,
  listAdminsWithoutMfa,
  listExpiringTempAccess,
  resolveEmployee,
} from '../mcp/orchestrator.js';
import { mcp } from '../mcp/client-manager.js';
import { reasonAccessDecision } from '../ai/reasoner.js';
import { llmEnabled, llmModel } from '../ai/client.js';
import { runAgent, type ToolCallRecord } from '../agent/agent-loop.js';
import {
  accessReviewView,
  investigationView,
  adminsWithoutMfaView,
  expiringAccessView,
  confirmationView,
  errorView,
  agentView,
  type ActionPayload,
} from '../slack/views.js';
import type { SlackBlock } from '../slack/kit.js';

const log = createLogger('dispatcher');

/**
 * Autonomous-agent entry point (used for @mentions). The LLM decides which
 * MCP tools to call; we render its answer plus the visible tool-call trace.
 * Falls back to the deterministic dispatcher if the LLM is unavailable or errors.
 */
export async function runAgentQuestion(rawText: string): Promise<SlackBlock[]> {
  const text = rawText.replace(/<@[^>]+>/g, '').trim();
  const intent = parseIntent(text);

  if (!llmEnabled) return runIntent(intent);

  try {
    const result = await runAgent(text);
    let payload: ActionPayload | undefined;
    if (intent.kind === 'access_review') {
      const userId = sniffUserId(result.calls) ?? (await resolveEmployee(intent.name))?.id;
      if (userId) payload = { userId, name: intent.name, resource: intent.resource };
    }
    return agentView({ answer: result.answer, trace: result.trace, payload, model: llmModel });
  } catch (err) {
    log.warn('Agent loop failed — falling back to deterministic dispatch', {
      error: (err as Error).message,
    });
    return runIntent(intent);
  }
}

/** Best-effort extraction of the subject employee id from tool results. */
function sniffUserId(calls: ToolCallRecord[]): string | null {
  for (const c of calls) {
    const r = c.result as Record<string, unknown> | undefined;
    if (!r) continue;
    const emp = r.employee as { id?: string } | undefined;
    if (emp?.id) return emp.id;
    if (typeof r.userId === 'string' && r.userId.startsWith('emp-')) return r.userId;
    if (typeof r.id === 'string' && r.id.startsWith('emp-')) return r.id;
  }
  return null;
}

/** Runs a parsed intent and returns Slack blocks to render. */
export async function runIntent(intent: Intent): Promise<SlackBlock[]> {
  log.info('Running intent', intent);
  switch (intent.kind) {
    case 'access_review': {
      const ctx = await gatherAccessContext(intent.name, intent.resource);
      if ('error' in ctx) return errorView(ctx.error);
      const decision = await reasonAccessDecision(ctx);
      return accessReviewView(ctx, decision);
    }
    case 'investigate': {
      const report = await gatherInvestigation(intent.name);
      if ('error' in report) return errorView(report.error);
      return investigationView(report);
    }
    case 'admins_no_mfa':
      return adminsWithoutMfaView(await listAdminsWithoutMfa());
    case 'expiring_temp':
      return expiringAccessView(await listExpiringTempAccess());
    case 'help':
    default:
      return errorView(
        'I couldn\'t parse that. Try `Should <name> receive <resource> access?`, `Investigate <name>`, `Who has admin access without MFA?`, or `Show temp access expiring today`.',
      );
  }
}

// ── Button actions (interactive components) ──────────────────

export async function handleApprove(p: ActionPayload): Promise<SlackBlock[]> {
  await mcp.call('iam', 'grantAccess', {
    userId: p.userId,
    resource: p.resource,
    role: 'Granted via AccessGuard',
    sensitivity: 'critical',
    grantedBy: 'AccessGuard',
  });
  await mcp.call('iam', 'recordDecision', {
    userId: p.userId,
    resource: p.resource,
    status: 'approved',
  });
  return confirmationView('✅ Access Approved', [
    `Granted *${p.resource}* to *${p.name}* (\`${p.userId}\`).`,
    'IAM permission created and decision logged to the audit trail.',
  ]);
}

export async function handleDeny(p: ActionPayload): Promise<SlackBlock[]> {
  await mcp.call('iam', 'recordDecision', {
    userId: p.userId,
    resource: p.resource,
    status: 'denied',
  });
  return confirmationView('⛔ Access Denied', [
    `Denied *${p.resource}* for *${p.name}* (\`${p.userId}\`).`,
    'Decision logged. Requester should remediate the flagged violations and re-apply.',
  ]);
}

export async function handleTemp(p: ActionPayload, hours = 4): Promise<SlackBlock[]> {
  const res = await mcp.call<{ permission: { expiresAt: string } }>('iam', 'temporaryAccess', {
    userId: p.userId,
    resource: p.resource,
    role: 'Temporary (AccessGuard)',
    sensitivity: 'high',
    hours,
    grantedBy: 'AccessGuard',
  });
  await mcp.call('iam', 'recordDecision', {
    userId: p.userId,
    resource: p.resource,
    status: 'granted_temp',
  });
  return confirmationView('⏳ Temporary Access Granted', [
    `Granted *${p.resource}* to *${p.name}* for *${hours}h*.`,
    `Auto-expires at \`${res.permission?.expiresAt ?? 'scheduled time'}\`.`,
    'Time-boxed grant logged to the audit trail.',
  ]);
}

export async function handleInvestigate(p: ActionPayload): Promise<SlackBlock[]> {
  const report = await gatherInvestigation(p.userId);
  if ('error' in report) return errorView(report.error);
  return investigationView(report);
}
