/**
 * Policy MCP Server
 * ─────────────────
 * Hosts the deterministic risk engine and company policy evaluation.
 * The Slack agent gathers signals from HR/IAM/Audit/Ticket, then calls
 * `evaluatePolicy` here to get an explainable, non-hallucinated score.
 *
 * Tools: evaluatePolicy, riskRules, leastPrivilege, getPolicies
 */
import { z } from 'zod';
import { McpServer, jsonResult, serveStdio } from '@accessguard/shared/mcp';
import {
  policiesRepo,
  permissionsRepo,
  usersRepo,
  evaluateRisk,
  RISK_WEIGHTS,
  levelForScore,
  type RiskContext,
} from '@accessguard/shared';

const server = new McpServer({ name: 'policy-server', version: '1.0.0' });

const CRITICAL_KEYWORDS = ['production', 'iam', 'okta', 'payroll', 'admin', 'root'];
const isCritical = (resource: string): boolean =>
  CRITICAL_KEYWORDS.some((k) => resource.toLowerCase().includes(k));

server.registerTool(
  'evaluatePolicy',
  {
    title: 'Evaluate Policy & Risk',
    description:
      'Given signals gathered from the HR/IAM/Audit/Ticket servers, compute a deterministic risk score, level, contributing factors, and policy violations for an access request.',
    inputSchema: {
      resource: z.string(),
      mfaEnabled: z.boolean(),
      hasForeignLogin: z.boolean().default(false),
      foreignLoginCountries: z.array(z.string()).default([]),
      hasApprovalTicket: z.boolean().default(false),
      failedLoginCount: z.number().default(0),
      isContractor: z.boolean().default(false),
      employmentActive: z.boolean().default(true),
      employmentStatus: z.string().default('active'),
      hasManagerApproval: z.boolean().default(false),
      securityTrainingComplete: z.boolean().default(false),
      onCall: z.boolean().default(false),
    },
  },
  async (input) => {
    const applicablePolicies = policiesRepo.findForResource(input.resource);
    const ctx: RiskContext = {
      ...input,
      isCriticalResource: isCritical(input.resource),
      applicablePolicies,
    };
    const assessment = evaluateRisk(ctx);
    return jsonResult({
      resource: input.resource,
      assessment,
      applicablePolicies: applicablePolicies.map((p) => ({ id: p.id, name: p.name })),
    });
  },
);

server.registerTool(
  'riskRules',
  {
    title: 'Risk Rules',
    description: 'Return the risk-scoring weights and level thresholds (for explainability).',
    inputSchema: {},
  },
  async () => {
    return jsonResult({
      weights: RISK_WEIGHTS,
      thresholds: {
        Low: '0–24',
        Medium: '25–49',
        High: '50–74',
        Critical: '75+',
      },
      sample: { 40: levelForScore(40), 80: levelForScore(80) },
    });
  },
);

server.registerTool(
  'getPolicies',
  {
    title: 'Get Applicable Policies',
    description: 'List company policies that apply to a given resource.',
    inputSchema: { resource: z.string() },
  },
  async ({ resource }) => {
    const policies = policiesRepo.findForResource(resource);
    return jsonResult({ resource, count: policies.length, policies });
  },
);

server.registerTool(
  'leastPrivilege',
  {
    title: 'Least-Privilege Review',
    description:
      'Audit a user\'s current permissions against least-privilege: flags critical grants, stale temporary access, and access held despite inactive employment.',
    inputSchema: { idOrName: z.string() },
  },
  async ({ idOrName }) => {
    const emp = usersRepo.findById(idOrName) ?? usersRepo.findByName(idOrName);
    if (!emp) return jsonResult({ error: `No employee matched "${idOrName}"` });
    const perms = permissionsRepo.getByUser(emp.id);
    const now = Date.now();
    const findings: string[] = [];

    if (emp.employmentStatus !== 'active' && perms.length > 0) {
      findings.push(
        `User is "${emp.employmentStatus}" but still holds ${perms.length} active permission(s) — offboarding gap.`,
      );
    }
    for (const p of perms) {
      if (p.sensitivity === 'critical') {
        findings.push(`Holds CRITICAL access to ${p.resource} (${p.role}).`);
      }
      if (p.temporary && p.expiresAt && new Date(p.expiresAt).getTime() < now) {
        findings.push(`Temporary access to ${p.resource} has EXPIRED but is still present.`);
      }
      if (!emp.mfaEnabled && p.sensitivity !== 'low') {
        findings.push(`Holds ${p.sensitivity} access to ${p.resource} WITHOUT MFA.`);
      }
    }

    return jsonResult({
      userId: emp.id,
      name: emp.name,
      permissionCount: perms.length,
      leastPrivilegeOk: findings.length === 0,
      findings,
    });
  },
);

await serveStdio(server, 'policy-server');
