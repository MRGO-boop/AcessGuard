/**
 * Deterministic risk-scoring engine.
 *
 * Intentionally simple and explainable — every point is attributable to a
 * named factor so the AI (and the human reviewer) can justify decisions.
 * The AI reasoner NEVER invents a score; it consumes this output.
 */
import type { Policy, RiskAssessment, RiskFactor, RiskLevel } from '../types.js';

/** Point weights, centralised so they can be tuned in one place. */
export const RISK_WEIGHTS = {
  NO_MFA: 30,
  FOREIGN_LOGIN: 25,
  NO_TICKET: 20,
  FAILED_LOGINS: 15,
  CONTRACTOR: 20,
  TERMINATED_OR_SUSPENDED: 60,
  CRITICAL_RESOURCE: 15,
  MANAGER_APPROVAL: -20,
  SECURITY_TRAINING: -10,
  ON_CALL: -10,
} as const;

/** Signals distilled from the five MCP servers. */
export interface RiskContext {
  resource: string;
  isCriticalResource: boolean;
  mfaEnabled: boolean;
  hasForeignLogin: boolean;
  foreignLoginCountries: string[];
  hasApprovalTicket: boolean;
  failedLoginCount: number;
  isContractor: boolean;
  employmentActive: boolean;
  employmentStatus: string;
  hasManagerApproval: boolean;
  securityTrainingComplete: boolean;
  onCall: boolean;
  applicablePolicies: Policy[];
}

const THRESHOLDS: { level: RiskLevel; min: number }[] = [
  { level: 'Critical', min: 75 },
  { level: 'High', min: 50 },
  { level: 'Medium', min: 25 },
  { level: 'Low', min: 0 },
];

export function levelForScore(score: number): RiskLevel {
  return THRESHOLDS.find((t) => score >= t.min)?.level ?? 'Low';
}

export function evaluateRisk(ctx: RiskContext): RiskAssessment {
  const factors: RiskFactor[] = [];
  const add = (condition: boolean, points: number, label: string, detail: string): void => {
    if (condition) factors.push({ label, points, detail });
  };

  add(!ctx.mfaEnabled, RISK_WEIGHTS.NO_MFA, 'No MFA', 'User does not have multi-factor authentication enabled.');
  add(
    ctx.hasForeignLogin,
    RISK_WEIGHTS.FOREIGN_LOGIN,
    'Foreign Login',
    `Recent logins from unusual locations: ${ctx.foreignLoginCountries.join(', ') || 'unknown'}.`,
  );
  add(!ctx.hasApprovalTicket, RISK_WEIGHTS.NO_TICKET, 'No Ticket', 'No approved access-request ticket backs this request.');
  add(
    ctx.failedLoginCount > 0,
    RISK_WEIGHTS.FAILED_LOGINS,
    'Failed Logins',
    `${ctx.failedLoginCount} failed login attempt(s) recently.`,
  );
  add(ctx.isContractor, RISK_WEIGHTS.CONTRACTOR, 'Contractor', 'User is a contractor / non-FTE.');
  add(
    !ctx.employmentActive,
    RISK_WEIGHTS.TERMINATED_OR_SUSPENDED,
    'Inactive Employment',
    `Employment status is "${ctx.employmentStatus}".`,
  );
  add(
    ctx.isCriticalResource,
    RISK_WEIGHTS.CRITICAL_RESOURCE,
    'Critical Resource',
    `${ctx.resource} is classified as a critical/high-sensitivity resource.`,
  );

  // Mitigating factors (negative points).
  add(ctx.hasManagerApproval, RISK_WEIGHTS.MANAGER_APPROVAL, 'Manager Approval', 'Request is backed by manager approval.');
  add(
    ctx.securityTrainingComplete,
    RISK_WEIGHTS.SECURITY_TRAINING,
    'Security Training',
    'User has completed security training.',
  );
  add(ctx.onCall, RISK_WEIGHTS.ON_CALL, 'On-Call Engineer', 'User is an on-call engineer with operational need.');

  const rawScore = factors.reduce((sum, f) => sum + f.points, 0);
  const score = Math.max(0, Math.min(100, rawScore));

  return {
    score,
    level: levelForScore(score),
    factors,
    policyViolations: evaluatePolicyViolations(ctx),
  };
}

/** Hard policy checks — these produce explicit violation strings. */
export function evaluatePolicyViolations(ctx: RiskContext): string[] {
  const violations: string[] = [];
  for (const policy of ctx.applicablePolicies) {
    if (policy.requiresMfa && !ctx.mfaEnabled) {
      violations.push(`${policy.name}: requires MFA, but user has none.`);
    }
    if (policy.requiresTicket && !ctx.hasApprovalTicket) {
      violations.push(`${policy.name}: requires an approved ticket, none found.`);
    }
    if (policy.requiresManagerApproval && !ctx.hasManagerApproval) {
      violations.push(`${policy.name}: requires manager approval, none on record.`);
    }
    if (policy.disallowContractors && ctx.isContractor) {
      violations.push(`${policy.name}: contractors are not permitted on this resource.`);
    }
  }
  if (!ctx.employmentActive) {
    violations.push(`Least-privilege: employment status "${ctx.employmentStatus}" must not receive new access.`);
  }
  return violations;
}
