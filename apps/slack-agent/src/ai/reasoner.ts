/**
 * AI reasoning layer.
 *
 * Ground truth (risk score + policy violations) is computed deterministically
 * by the policy MCP server. The reasoner turns that into a recommendation +
 * human narrative. When an OpenAI key is present it produces the narrative
 * with the Responses API (structured output); otherwise a fully deterministic
 * fallback keeps every demo working offline.
 */
import type { AccessDecision, RiskLevel } from '@accessguard/shared';
import { createLogger } from '@accessguard/shared';
import type { AccessContext } from '../mcp/orchestrator.js';
import { llm as client, llmModel } from './client.js';
import { SYSTEM_PROMPT, buildDecisionInput, DECISION_SCHEMA } from './prompts.js';

const log = createLogger('reasoner');

export interface ReasonedDecision extends AccessDecision {
  source: 'llm' | 'deterministic';
}

export async function reasonAccessDecision(ctx: AccessContext): Promise<ReasonedDecision> {
  const baseline = deterministicDecision(ctx);

  if (!client) return { ...baseline, source: 'deterministic' };

  try {
    // Chat Completions with JSON output — compatible with OpenAI *and*
    // OpenRouter (which does not implement the newer Responses API).
    const completion = await client.chat.completions.create({
      model: llmModel,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}\n\nRespond with ONLY a JSON object matching this schema (no prose, no code fences):\n${JSON.stringify(
            DECISION_SCHEMA,
          )}`,
        },
        { role: 'user', content: buildDecisionInput(ctx) },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(stripFences(raw)) as Partial<AccessDecision>;

    // Never let the model override the deterministic risk numbers.
    return {
      recommendation: parsed.recommendation ?? baseline.recommendation,
      reason: parsed.reason ?? baseline.reason,
      confidence: clampConfidence(parsed.confidence ?? baseline.confidence),
      suggestedAction: parsed.suggestedAction ?? baseline.suggestedAction,
      keyFindings: parsed.keyFindings?.length ? parsed.keyFindings : baseline.keyFindings,
      riskScore: baseline.riskScore,
      riskLevel: baseline.riskLevel,
      policyViolations: baseline.policyViolations,
      source: 'llm',
    };
  } catch (err) {
    log.warn('LLM reasoning failed — falling back to deterministic', {
      error: (err as Error).message,
    });
    return { ...baseline, source: 'deterministic' };
  }
}

/** Some models wrap JSON in ```json fences despite instructions. */
function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
}

// ── Deterministic engine ─────────────────────────────────────

function deterministicDecision(ctx: AccessContext): AccessDecision {
  const { assessment, signals } = ctx;
  const violations = assessment.policyViolations;
  const level = assessment.level;

  const recommendation = decideRecommendation(level, violations.length, signals.employmentActive);
  const keyFindings = buildKeyFindings(ctx);
  const confidence = computeConfidence(level, violations.length);

  return {
    recommendation,
    reason: buildReason(ctx, recommendation),
    confidence,
    riskScore: assessment.score,
    riskLevel: level,
    policyViolations: violations,
    suggestedAction: suggestAction(recommendation, ctx),
    keyFindings,
  };
}

function decideRecommendation(
  level: RiskLevel,
  violationCount: number,
  active: boolean,
): AccessDecision['recommendation'] {
  if (!active) return 'DENY';
  if (level === 'Critical') return violationCount > 0 ? 'DENY' : 'ESCALATE';
  if (level === 'High') return violationCount > 0 ? 'DENY' : 'APPROVE_WITH_CONDITIONS';
  if (level === 'Medium') return 'APPROVE_WITH_CONDITIONS';
  return 'APPROVE';
}

function computeConfidence(level: RiskLevel, violationCount: number): number {
  // More decisive at the extremes; violations increase certainty of denial.
  const base: Record<RiskLevel, number> = { Low: 88, Medium: 74, High: 82, Critical: 93 };
  return clampConfidence(base[level] + Math.min(violationCount * 2, 6));
}

function buildKeyFindings(ctx: AccessContext): string[] {
  const f: string[] = [];
  const s = ctx.signals;
  if (!s.mfaEnabled) f.push('🔓 MFA is NOT enabled.');
  if (!s.employmentActive) f.push(`⛔ Employment status is "${s.employmentStatus}".`);
  if (s.isContractor) f.push('👷 User is a contractor / vendor.');
  if (s.hasForeignLogin)
    f.push(`🌍 Foreign login(s) detected from ${s.foreignLoginCountries.join(', ')}.`);
  if (s.failedLoginCount > 0) f.push(`⚠️ ${s.failedLoginCount} recent failed login(s).`);
  if (!s.hasApprovalTicket) f.push('🎫 No approved access ticket on record.');
  if (s.hasManagerApproval) f.push('✅ Manager approval present.');
  if (s.onCall) f.push('📟 On-call engineer with operational need.');
  if (s.securityTrainingComplete) f.push('🎓 Security training complete.');
  return f.length ? f : ['No notable risk signals detected.'];
}

function buildReason(ctx: AccessContext, rec: AccessDecision['recommendation']): string {
  const { employee, resource, assessment } = ctx;
  const drivers = assessment.factors
    .filter((factor) => factor.points > 0)
    .slice(0, 3)
    .map((factor) => factor.label);
  const driverText = drivers.length ? drivers.join(', ') : 'no significant risk drivers';

  const verdict: Record<AccessDecision['recommendation'], string> = {
    APPROVE: `low risk and policy-compliant`,
    APPROVE_WITH_CONDITIONS: `acceptable only with additional safeguards`,
    DENY: `unacceptable under current policy`,
    ESCALATE: `too consequential to auto-decide`,
  };

  return (
    `${employee.name}'s request for ${resource} scored ${assessment.score}/100 (${assessment.level} risk), ` +
    `driven by ${driverText}. This is ${verdict[rec]}` +
    (assessment.policyViolations.length
      ? `, with ${assessment.policyViolations.length} policy violation(s).`
      : `.`)
  );
}

function suggestAction(
  rec: AccessDecision['recommendation'],
  ctx: AccessContext,
): string {
  switch (rec) {
    case 'APPROVE':
      return `Grant ${ctx.resource} access as requested.`;
    case 'APPROVE_WITH_CONDITIONS':
      return ctx.signals.mfaEnabled
        ? `Grant time-boxed (temporary) access with monitoring; require a follow-up ticket.`
        : `Require MFA enrollment first, then grant temporary access with monitoring.`;
    case 'DENY':
      return `Deny the request. Remediate: ${remediation(ctx)}.`;
    case 'ESCALATE':
      return `Escalate to the resource owner / CISO for manual sign-off before granting.`;
  }
}

function remediation(ctx: AccessContext): string {
  const fixes: string[] = [];
  if (!ctx.signals.mfaEnabled) fixes.push('enable MFA');
  if (!ctx.signals.hasApprovalTicket) fixes.push('obtain an approved ticket');
  if (!ctx.signals.hasManagerApproval) fixes.push('secure manager approval');
  if (ctx.signals.isContractor) fixes.push('convert to sponsored FTE access or use a jump host');
  return fixes.length ? fixes.join(', ') : 'address the flagged policy violations';
}

function clampConfidence(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
