/** Prompt templates for the AccessGuard security-analyst persona. */
import type { AccessContext } from '../mcp/orchestrator.js';

export const SYSTEM_PROMPT = `You are AccessGuard, a meticulous enterprise security analyst embedded in Slack.
You review Identity & Access Management (IAM) requests.

STRICT RULES:
- Reason ONLY from the structured facts provided. NEVER invent data.
- The risk score and policy violations are computed deterministically upstream —
  treat them as ground truth. Your recommendation MUST be consistent with them.
- A Critical risk or any hard policy violation must never result in a plain APPROVE.
- Be concise, specific, and reference concrete facts (MFA, tickets, foreign logins, employment type).
- Output must exactly match the requested JSON schema.`;

export function buildDecisionInput(ctx: AccessContext): string {
  const s = ctx.signals;
  return JSON.stringify(
    {
      request: {
        subject: { id: ctx.employee.id, name: ctx.employee.name, title: ctx.employee.title },
        resource: ctx.resource,
      },
      facts: {
        employmentStatus: s.employmentStatus,
        isContractor: s.isContractor,
        mfaEnabled: s.mfaEnabled,
        securityTrainingComplete: s.securityTrainingComplete,
        onCall: s.onCall,
        failedLoginCount: s.failedLoginCount,
        foreignLoginCountries: s.foreignLoginCountries,
        hasApprovalTicket: s.hasApprovalTicket,
        hasManagerApproval: s.hasManagerApproval,
      },
      deterministicRisk: {
        score: ctx.assessment.score,
        level: ctx.assessment.level,
        factors: ctx.assessment.factors,
        policyViolations: ctx.assessment.policyViolations,
      },
      applicablePolicies: ctx.applicablePolicies.map((p) => p.name),
    },
    null,
    2,
  );
}

/** JSON schema the model must fill (OpenAI structured outputs). */
export const DECISION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['recommendation', 'reason', 'confidence', 'suggestedAction', 'keyFindings'],
  properties: {
    recommendation: {
      type: 'string',
      enum: ['APPROVE', 'DENY', 'APPROVE_WITH_CONDITIONS', 'ESCALATE'],
    },
    reason: { type: 'string' },
    confidence: { type: 'integer', minimum: 0, maximum: 100 },
    suggestedAction: { type: 'string' },
    keyFindings: { type: 'array', items: { type: 'string' } },
  },
} as const;
