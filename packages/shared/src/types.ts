/**
 * Domain model for AccessGuard AI.
 *
 * Zod schemas double as the single source of truth for both runtime
 * validation (MCP tool inputs/outputs) and static TypeScript types.
 */
import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────────

export const EmploymentStatus = z.enum(['active', 'on_leave', 'terminated', 'suspended']);
export type EmploymentStatus = z.infer<typeof EmploymentStatus>;

export const EmployeeType = z.enum(['full_time', 'contractor', 'intern', 'vendor']);
export type EmployeeType = z.infer<typeof EmployeeType>;

export const RiskLevel = z.enum(['Low', 'Medium', 'High', 'Critical']);
export type RiskLevel = z.infer<typeof RiskLevel>;

export const Recommendation = z.enum(['APPROVE', 'DENY', 'APPROVE_WITH_CONDITIONS', 'ESCALATE']);
export type Recommendation = z.infer<typeof Recommendation>;

export const TicketStatus = z.enum(['open', 'in_review', 'approved', 'rejected', 'closed']);
export type TicketStatus = z.infer<typeof TicketStatus>;

export const AccessRequestStatus = z.enum(['pending', 'approved', 'denied', 'granted_temp']);
export type AccessRequestStatus = z.infer<typeof AccessRequestStatus>;

// ── Entities ─────────────────────────────────────────────────

export const Employee = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  title: z.string(),
  department: z.string(),
  managerId: z.string().nullable(),
  employeeType: EmployeeType,
  employmentStatus: EmploymentStatus,
  location: z.string(),
  country: z.string(),
  startDate: z.string(),
  mfaEnabled: z.boolean(),
  securityTrainingComplete: z.boolean(),
  onCall: z.boolean(),
});
export type Employee = z.infer<typeof Employee>;

export const Permission = z.object({
  id: z.string(),
  userId: z.string(),
  resource: z.string(),
  role: z.string(),
  sensitivity: z.enum(['low', 'medium', 'high', 'critical']),
  grantedAt: z.string(),
  grantedBy: z.string(),
  temporary: z.boolean(),
  expiresAt: z.string().nullable(),
});
export type Permission = z.infer<typeof Permission>;

export const AuditLog = z.object({
  id: z.string(),
  userId: z.string(),
  action: z.string(),
  resource: z.string().nullable(),
  outcome: z.enum(['success', 'failure', 'denied']),
  ipAddress: z.string(),
  country: z.string(),
  device: z.string(),
  timestamp: z.string(),
});
export type AuditLog = z.infer<typeof AuditLog>;

export const Ticket = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.enum(['access_request', 'incident', 'change_request', 'offboarding']),
  title: z.string(),
  status: TicketStatus,
  resource: z.string().nullable(),
  approverId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Ticket = z.infer<typeof Ticket>;

export const Policy = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  resourcePattern: z.string(),
  requiresMfa: z.boolean(),
  requiresTicket: z.boolean(),
  requiresManagerApproval: z.boolean(),
  disallowContractors: z.boolean(),
  maxTempAccessHours: z.number(),
});
export type Policy = z.infer<typeof Policy>;

export const AccessRequest = z.object({
  id: z.string(),
  userId: z.string(),
  resource: z.string(),
  role: z.string(),
  status: AccessRequestStatus,
  requestedBy: z.string(),
  decidedBy: z.string().nullable(),
  createdAt: z.string(),
  decidedAt: z.string().nullable(),
});
export type AccessRequest = z.infer<typeof AccessRequest>;

// ── Risk / Analysis outputs ──────────────────────────────────

export const RiskFactor = z.object({
  label: z.string(),
  points: z.number(),
  detail: z.string(),
});
export type RiskFactor = z.infer<typeof RiskFactor>;

export const RiskAssessment = z.object({
  score: z.number(),
  level: RiskLevel,
  factors: z.array(RiskFactor),
  policyViolations: z.array(z.string()),
});
export type RiskAssessment = z.infer<typeof RiskAssessment>;

/** The full structured output the AI reasoner must produce. */
export const AccessDecision = z.object({
  recommendation: Recommendation,
  reason: z.string(),
  confidence: z.number().min(0).max(100),
  riskScore: z.number(),
  riskLevel: RiskLevel,
  policyViolations: z.array(z.string()),
  suggestedAction: z.string(),
  keyFindings: z.array(z.string()),
});
export type AccessDecision = z.infer<typeof AccessDecision>;
