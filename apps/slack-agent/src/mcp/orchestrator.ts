/**
 * High-level orchestration over the five MCP servers.
 *
 * These functions are the "agentic" core: for a single admin question they
 * fan out across HR → Audit → Ticket → IAM → Policy, aggregate the results,
 * and hand a clean, typed context to the AI reasoner. No SQL, no DB — only
 * MCP tool calls.
 */
import type { Employee, RiskAssessment } from '@accessguard/shared';
import { mcp } from './client-manager.js';

export interface AccessSignals {
  resource: string;
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
}

export interface AccessContext {
  employee: Employee;
  resource: string;
  signals: AccessSignals;
  assessment: RiskAssessment;
  applicablePolicies: { id: string; name: string }[];
  ticket: { id: string; status: string; approverId: string | null } | null;
}

/** Resolves a free-text reference (e.g. "Rahul") to an employee via HR. */
export async function resolveEmployee(idOrName: string): Promise<Employee | null> {
  const res = await mcp.call<{ employee?: Employee; error?: string }>('hr', 'getEmployee', {
    idOrName,
  });
  return res.employee ?? null;
}

/** Gathers everything needed to decide an access request. */
export async function gatherAccessContext(
  idOrName: string,
  resource: string,
): Promise<AccessContext | { error: string }> {
  const employee = await resolveEmployee(idOrName);
  if (!employee) return { error: `No employee matched "${idOrName}".` };

  const [failed, foreign, approval] = await Promise.all([
    mcp.call<{ count: number }>('audit', 'failedLogins', { idOrName: employee.id }),
    mcp.call<{ count: number; countries: string[] }>('audit', 'foreignLogins', {
      idOrName: employee.id,
    }),
    mcp.call<{
      hasTicket: boolean;
      isApproved: boolean;
      ticket: { id: string; status: string; approverId: string | null } | null;
    }>('ticket', 'approvalStatus', { idOrName: employee.id, resource }),
  ]);

  const signals: AccessSignals = {
    resource,
    mfaEnabled: employee.mfaEnabled,
    hasForeignLogin: foreign.count > 0,
    foreignLoginCountries: foreign.countries ?? [],
    hasApprovalTicket: approval.isApproved,
    failedLoginCount: failed.count,
    isContractor: employee.employeeType === 'contractor' || employee.employeeType === 'vendor',
    employmentActive: employee.employmentStatus === 'active',
    employmentStatus: employee.employmentStatus,
    hasManagerApproval: approval.isApproved && Boolean(approval.ticket?.approverId),
    securityTrainingComplete: employee.securityTrainingComplete,
    onCall: employee.onCall,
  };

  const evaluation = await mcp.call<{
    assessment: RiskAssessment;
    applicablePolicies: { id: string; name: string }[];
  }>('policy', 'evaluatePolicy', { ...signals });

  return {
    employee,
    resource,
    signals,
    assessment: evaluation.assessment,
    applicablePolicies: evaluation.applicablePolicies ?? [],
    ticket: approval.ticket,
  };
}

// ── Investigation ────────────────────────────────────────────

export interface InvestigationReport {
  employee: Employee;
  manager: { id: string; name: string; title: string } | null;
  permissions: { resource: string; role: string; sensitivity: string; temporary: boolean }[];
  failedLoginCount: number;
  foreignLoginCountries: string[];
  privilegeChanges: { action: string; resource: string | null; timestamp: string }[];
  deviceHistory: { device: string; country: string; lastSeen: string }[];
  openTickets: { id: string; title: string; status: string }[];
  leastPrivilege: { leastPrivilegeOk: boolean; findings: string[] };
}

export async function gatherInvestigation(
  idOrName: string,
): Promise<InvestigationReport | { error: string }> {
  const employee = await resolveEmployee(idOrName);
  if (!employee) return { error: `No employee matched "${idOrName}".` };
  const id = employee.id;

  const [manager, perms, failed, foreign, priv, devices, tickets, lp] = await Promise.all([
    mcp.call<{ manager: { id: string; name: string; title: string } | null }>('hr', 'getManager', {
      idOrName: id,
    }),
    mcp.call<{ permissions: InvestigationReport['permissions'] }>('iam', 'getUserPermissions', {
      userId: id,
    }),
    mcp.call<{ count: number }>('audit', 'failedLogins', { idOrName: id }),
    mcp.call<{ countries: string[] }>('audit', 'foreignLogins', { idOrName: id }),
    mcp.call<{ changes: InvestigationReport['privilegeChanges'] }>(
      'audit',
      'recentPrivilegeChanges',
      { idOrName: id },
    ),
    mcp.call<{ history: InvestigationReport['deviceHistory'] }>('audit', 'deviceHistory', {
      idOrName: id,
    }),
    mcp.call<{ tickets: InvestigationReport['openTickets'] }>('ticket', 'getOpenTickets', {
      idOrName: id,
    }),
    mcp.call<{ leastPrivilegeOk: boolean; findings: string[] }>('policy', 'leastPrivilege', {
      idOrName: id,
    }),
  ]);

  return {
    employee,
    manager: manager.manager,
    permissions: perms.permissions ?? [],
    failedLoginCount: failed.count,
    foreignLoginCountries: foreign.countries ?? [],
    privilegeChanges: priv.changes ?? [],
    deviceHistory: devices.history ?? [],
    openTickets: tickets.tickets ?? [],
    leastPrivilege: { leastPrivilegeOk: lp.leastPrivilegeOk, findings: lp.findings ?? [] },
  };
}

// ── Fleet-wide queries ───────────────────────────────────────

export interface AdminRow {
  userId: string;
  name: string;
  title: string;
  department: string;
  mfaEnabled: boolean;
  resource: string;
  role: string;
}

export async function listAdminsWithoutMfa(): Promise<AdminRow[]> {
  const res = await mcp.call<{ admins: AdminRow[] }>('iam', 'listAdmins', { withoutMfaOnly: true });
  return res.admins ?? [];
}

export async function listAllAdmins(): Promise<AdminRow[]> {
  const res = await mcp.call<{ admins: AdminRow[] }>('iam', 'listAdmins', { withoutMfaOnly: false });
  return res.admins ?? [];
}

export interface ExpiringAccessRow {
  userId: string;
  name: string;
  resource: string;
  role: string;
  expiresAt: string;
}

/** Temporary grants expiring before the given ISO instant (default: end of today). */
export async function listExpiringTempAccess(beforeIso?: string): Promise<ExpiringAccessRow[]> {
  const res = await mcp.call<{ rows: ExpiringAccessRow[] }>('iam', 'expiringTempAccess', {
    beforeIso: beforeIso ?? endOfToday(),
  });
  return res.rows ?? [];
}

function endOfToday(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}
