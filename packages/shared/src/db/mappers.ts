/**
 * Row → domain mappers. SQLite stores booleans as integers and uses
 * snake_case columns; these functions produce clean camelCase entities.
 */
import type {
  Employee,
  Permission,
  AuditLog,
  Ticket,
  Policy,
  AccessRequest,
} from '../types.js';

type Row = Record<string, unknown>;

const bool = (v: unknown): boolean => v === 1 || v === true;
const str = (v: unknown): string => String(v);
const strOrNull = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

export function toEmployee(r: Row): Employee {
  return {
    id: str(r.id),
    name: str(r.name),
    email: str(r.email),
    title: str(r.title),
    department: str(r.department),
    managerId: strOrNull(r.manager_id),
    employeeType: str(r.employee_type) as Employee['employeeType'],
    employmentStatus: str(r.employment_status) as Employee['employmentStatus'],
    location: str(r.location),
    country: str(r.country),
    startDate: str(r.start_date),
    mfaEnabled: bool(r.mfa_enabled),
    securityTrainingComplete: bool(r.security_training_complete),
    onCall: bool(r.on_call),
  };
}

export function toPermission(r: Row): Permission {
  return {
    id: str(r.id),
    userId: str(r.user_id),
    resource: str(r.resource),
    role: str(r.role),
    sensitivity: str(r.sensitivity) as Permission['sensitivity'],
    grantedAt: str(r.granted_at),
    grantedBy: str(r.granted_by),
    temporary: bool(r.temporary),
    expiresAt: strOrNull(r.expires_at),
  };
}

export function toAuditLog(r: Row): AuditLog {
  return {
    id: str(r.id),
    userId: str(r.user_id),
    action: str(r.action),
    resource: strOrNull(r.resource),
    outcome: str(r.outcome) as AuditLog['outcome'],
    ipAddress: str(r.ip_address),
    country: str(r.country),
    device: str(r.device),
    timestamp: str(r.timestamp),
  };
}

export function toTicket(r: Row): Ticket {
  return {
    id: str(r.id),
    userId: str(r.user_id),
    type: str(r.type) as Ticket['type'],
    title: str(r.title),
    status: str(r.status) as Ticket['status'],
    resource: strOrNull(r.resource),
    approverId: strOrNull(r.approver_id),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

export function toPolicy(r: Row): Policy {
  return {
    id: str(r.id),
    name: str(r.name),
    description: str(r.description),
    resourcePattern: str(r.resource_pattern),
    requiresMfa: bool(r.requires_mfa),
    requiresTicket: bool(r.requires_ticket),
    requiresManagerApproval: bool(r.requires_manager_approval),
    disallowContractors: bool(r.disallow_contractors),
    maxTempAccessHours: Number(r.max_temp_access_hours),
  };
}

export function toAccessRequest(r: Row): AccessRequest {
  return {
    id: str(r.id),
    userId: str(r.user_id),
    resource: str(r.resource),
    role: str(r.role),
    status: str(r.status) as AccessRequest['status'],
    requestedBy: str(r.requested_by),
    decidedBy: strOrNull(r.decided_by),
    createdAt: str(r.created_at),
    decidedAt: strOrNull(r.decided_at),
  };
}
