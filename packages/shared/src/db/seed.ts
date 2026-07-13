/**
 * Deterministic seed data for AccessGuard AI.
 *
 * Produces a believable ~30-employee enterprise with permissions, audit
 * trails, tickets, policies, and access requests. Carefully tuned so the
 * four hackathon demos each surface something interesting:
 *   1. "Should Rahul receive Production Database access?" → high risk
 *   2. "Investigate Rahul"                                → rich trail
 *   3. "Who has admin access without MFA?"                → several hits
 *   4. "Temp access expiring today"                       → several hits
 *
 * The base date is 2026-07-13 to match the demo timeline.
 */
import type { DatabaseSync } from 'node:sqlite';
import { createLogger } from '../logger.js';

const log = createLogger('seed');

const BASE_NOW = new Date('2026-07-13T09:00:00.000Z');
const iso = (d: Date): string => d.toISOString();
const daysAgo = (n: number): string => iso(new Date(BASE_NOW.getTime() - n * 86_400_000));
const hoursAgo = (n: number): string => iso(new Date(BASE_NOW.getTime() - n * 3_600_000));
const hoursFromNow = (n: number): string => iso(new Date(BASE_NOW.getTime() + n * 3_600_000));

// Small deterministic PRNG so audit noise is stable across runs.
let seedState = 1337;
function rand(): number {
  seedState = (seedState * 1103515245 + 12345) & 0x7fffffff;
  return seedState / 0x7fffffff;
}
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]!;

interface Emp {
  id: string;
  name: string;
  email: string;
  title: string;
  department: string;
  managerId: string | null;
  employeeType: 'full_time' | 'contractor' | 'intern' | 'vendor';
  employmentStatus: 'active' | 'on_leave' | 'terminated' | 'suspended';
  location: string;
  country: string;
  startDate: string;
  mfaEnabled: boolean;
  securityTrainingComplete: boolean;
  onCall: boolean;
}

// ── Employees ────────────────────────────────────────────────
const EMPLOYEES: Emp[] = [
  // Leadership
  { id: 'emp-010', name: 'Anita Desai', email: 'anita.desai@acme.io', title: 'VP Engineering', department: 'Engineering', managerId: null, employeeType: 'full_time', employmentStatus: 'active', location: 'Bangalore', country: 'IN', startDate: '2018-03-01', mfaEnabled: true, securityTrainingComplete: true, onCall: false },
  { id: 'emp-011', name: 'Michael Chen', email: 'michael.chen@acme.io', title: 'CISO', department: 'Security', managerId: null, employeeType: 'full_time', employmentStatus: 'active', location: 'San Francisco', country: 'US', startDate: '2017-06-15', mfaEnabled: true, securityTrainingComplete: true, onCall: false },
  { id: 'emp-012', name: 'Sofia Alvarez', email: 'sofia.alvarez@acme.io', title: 'VP Finance', department: 'Finance', managerId: null, employeeType: 'full_time', employmentStatus: 'active', location: 'New York', country: 'US', startDate: '2019-01-20', mfaEnabled: true, securityTrainingComplete: true, onCall: false },

  // The demo subject: contractor, no MFA, risky signals.
  { id: 'emp-001', name: 'Rahul Sharma', email: 'rahul.sharma@contractor.acme.io', title: 'Backend Engineer (Contract)', department: 'Engineering', managerId: 'emp-010', employeeType: 'contractor', employmentStatus: 'active', location: 'Bangalore', country: 'IN', startDate: '2026-05-02', mfaEnabled: false, securityTrainingComplete: false, onCall: false },

  // Engineering
  { id: 'emp-002', name: 'Priya Nair', email: 'priya.nair@acme.io', title: 'Senior Security Engineer', department: 'Security', managerId: 'emp-011', employeeType: 'full_time', employmentStatus: 'active', location: 'Bangalore', country: 'IN', startDate: '2020-08-10', mfaEnabled: true, securityTrainingComplete: true, onCall: true },
  { id: 'emp-003', name: 'Arjun Mehta', email: 'arjun.mehta@acme.io', title: 'DevOps Lead', department: 'DevOps', managerId: 'emp-010', employeeType: 'full_time', employmentStatus: 'active', location: 'Pune', country: 'IN', startDate: '2019-11-05', mfaEnabled: true, securityTrainingComplete: true, onCall: true },
  { id: 'emp-004', name: 'Sanjay Gupta', email: 'sanjay.gupta@acme.io', title: 'IT Administrator', department: 'IT', managerId: 'emp-011', employeeType: 'full_time', employmentStatus: 'active', location: 'Delhi', country: 'IN', startDate: '2016-02-28', mfaEnabled: false, securityTrainingComplete: true, onCall: false },
  { id: 'emp-005', name: 'Emily Watson', email: 'emily.watson@acme.io', title: 'Staff Software Engineer', department: 'Engineering', managerId: 'emp-010', employeeType: 'full_time', employmentStatus: 'active', location: 'London', country: 'GB', startDate: '2018-09-17', mfaEnabled: true, securityTrainingComplete: true, onCall: true },
  { id: 'emp-006', name: 'Carlos Ruiz', email: 'carlos.ruiz@acme.io', title: 'Database Administrator', department: 'DevOps', managerId: 'emp-003', employeeType: 'full_time', employmentStatus: 'active', location: 'Madrid', country: 'ES', startDate: '2019-04-22', mfaEnabled: true, securityTrainingComplete: true, onCall: true },
  { id: 'emp-007', name: 'Fatima Khan', email: 'fatima.khan@acme.io', title: 'Backend Engineer', department: 'Engineering', managerId: 'emp-010', employeeType: 'full_time', employmentStatus: 'active', location: 'Dubai', country: 'AE', startDate: '2021-07-01', mfaEnabled: true, securityTrainingComplete: true, onCall: false },
  { id: 'emp-008', name: 'Tom Becker', email: 'tom.becker@acme.io', title: 'SRE', department: 'DevOps', managerId: 'emp-003', employeeType: 'full_time', employmentStatus: 'active', location: 'Berlin', country: 'DE', startDate: '2020-03-30', mfaEnabled: false, securityTrainingComplete: false, onCall: true },
  { id: 'emp-009', name: 'Grace Lee', email: 'grace.lee@acme.io', title: 'Frontend Engineer', department: 'Engineering', managerId: 'emp-010', employeeType: 'full_time', employmentStatus: 'active', location: 'Seoul', country: 'KR', startDate: '2022-01-11', mfaEnabled: true, securityTrainingComplete: true, onCall: false },

  // IT / Cloud admins (some without MFA → demo #3)
  { id: 'emp-013', name: 'David Kim', email: 'david.kim@acme.io', title: 'Cloud Infrastructure Admin', department: 'IT', managerId: 'emp-004', employeeType: 'full_time', employmentStatus: 'active', location: 'San Jose', country: 'US', startDate: '2018-12-03', mfaEnabled: false, securityTrainingComplete: true, onCall: true },
  { id: 'emp-014', name: 'Nadia Ivanova', email: 'nadia.ivanova@acme.io', title: 'Systems Administrator', department: 'IT', managerId: 'emp-004', employeeType: 'full_time', employmentStatus: 'active', location: 'Warsaw', country: 'PL', startDate: '2019-10-14', mfaEnabled: true, securityTrainingComplete: true, onCall: false },
  { id: 'emp-015', name: 'Victor Osei', email: 'victor.osei@acme.io', title: 'Security Operations Analyst', department: 'Security', managerId: 'emp-011', employeeType: 'full_time', employmentStatus: 'active', location: 'Accra', country: 'GH', startDate: '2021-05-19', mfaEnabled: true, securityTrainingComplete: true, onCall: true },

  // Finance
  { id: 'emp-016', name: 'Hannah Schmidt', email: 'hannah.schmidt@acme.io', title: 'Financial Analyst', department: 'Finance', managerId: 'emp-012', employeeType: 'full_time', employmentStatus: 'active', location: 'Frankfurt', country: 'DE', startDate: '2020-06-08', mfaEnabled: true, securityTrainingComplete: true, onCall: false },
  { id: 'emp-017', name: 'Robert Taylor', email: 'robert.taylor@acme.io', title: 'Payroll Administrator', department: 'Finance', managerId: 'emp-012', employeeType: 'full_time', employmentStatus: 'active', location: 'Chicago', country: 'US', startDate: '2017-09-25', mfaEnabled: false, securityTrainingComplete: true, onCall: false },
  { id: 'emp-018', name: 'Mei Wong', email: 'mei.wong@acme.io', title: 'Accountant', department: 'Finance', managerId: 'emp-012', employeeType: 'full_time', employmentStatus: 'active', location: 'Singapore', country: 'SG', startDate: '2021-02-15', mfaEnabled: true, securityTrainingComplete: false, onCall: false },

  // Data / Product
  { id: 'emp-019', name: 'Omar Haddad', email: 'omar.haddad@acme.io', title: 'Data Engineer', department: 'Data', managerId: 'emp-010', employeeType: 'full_time', employmentStatus: 'active', location: 'Cairo', country: 'EG', startDate: '2020-11-30', mfaEnabled: true, securityTrainingComplete: true, onCall: false },
  { id: 'emp-020', name: 'Laura Bianchi', email: 'laura.bianchi@acme.io', title: 'Data Scientist', department: 'Data', managerId: 'emp-010', employeeType: 'full_time', employmentStatus: 'active', location: 'Milan', country: 'IT', startDate: '2022-04-04', mfaEnabled: true, securityTrainingComplete: true, onCall: false },
  { id: 'emp-021', name: 'James Wilson', email: 'james.wilson@acme.io', title: 'Product Manager', department: 'Product', managerId: 'emp-010', employeeType: 'full_time', employmentStatus: 'active', location: 'Austin', country: 'US', startDate: '2019-07-22', mfaEnabled: true, securityTrainingComplete: true, onCall: false },
  { id: 'emp-022', name: 'Ananya Reddy', email: 'ananya.reddy@acme.io', title: 'Product Designer', department: 'Product', managerId: 'emp-021', employeeType: 'full_time', employmentStatus: 'active', location: 'Hyderabad', country: 'IN', startDate: '2021-08-16', mfaEnabled: true, securityTrainingComplete: true, onCall: false },

  // Contractors / vendors / edge cases
  { id: 'emp-023', name: 'Igor Petrov', email: 'igor.petrov@vendor.acme.io', title: 'Vendor Support Engineer', department: 'IT', managerId: 'emp-004', employeeType: 'vendor', employmentStatus: 'active', location: 'Belgrade', country: 'RS', startDate: '2026-06-20', mfaEnabled: false, securityTrainingComplete: false, onCall: false },
  { id: 'emp-024', name: 'Chloe Martin', email: 'chloe.martin@acme.io', title: 'HR Business Partner', department: 'HR', managerId: null, employeeType: 'full_time', employmentStatus: 'active', location: 'Paris', country: 'FR', startDate: '2018-05-14', mfaEnabled: true, securityTrainingComplete: true, onCall: false },
  { id: 'emp-025', name: 'Daniel Okafor', email: 'daniel.okafor@acme.io', title: 'Recruiter', department: 'HR', managerId: 'emp-024', employeeType: 'full_time', employmentStatus: 'active', location: 'Lagos', country: 'NG', startDate: '2022-03-07', mfaEnabled: true, securityTrainingComplete: true, onCall: false },
  { id: 'emp-026', name: 'Sara Lindqvist', email: 'sara.lindqvist@acme.io', title: 'Sales Engineer', department: 'Sales', managerId: null, employeeType: 'full_time', employmentStatus: 'active', location: 'Stockholm', country: 'SE', startDate: '2020-09-09', mfaEnabled: true, securityTrainingComplete: true, onCall: false },
  { id: 'emp-027', name: 'Kevin Brown', email: 'kevin.brown@acme.io', title: 'Account Executive', department: 'Sales', managerId: 'emp-026', employeeType: 'full_time', employmentStatus: 'on_leave', location: 'Toronto', country: 'CA', startDate: '2019-12-12', mfaEnabled: true, securityTrainingComplete: true, onCall: false },
  { id: 'emp-028', name: 'Yuki Tanaka', email: 'yuki.tanaka@acme.io', title: 'QA Engineer', department: 'Engineering', managerId: 'emp-005', employeeType: 'full_time', employmentStatus: 'active', location: 'Tokyo', country: 'JP', startDate: '2021-06-28', mfaEnabled: true, securityTrainingComplete: true, onCall: false },
  { id: 'emp-029', name: 'Ben Carter', email: 'ben.carter@acme.io', title: 'Intern - Platform', department: 'Engineering', managerId: 'emp-005', employeeType: 'intern', employmentStatus: 'active', location: 'Manchester', country: 'GB', startDate: '2026-06-01', mfaEnabled: false, securityTrainingComplete: false, onCall: false },
  // A terminated employee who still holds access (offboarding gap → risk).
  { id: 'emp-030', name: 'Marcus Reed', email: 'marcus.reed@acme.io', title: 'Former Backend Engineer', department: 'Engineering', managerId: 'emp-010', employeeType: 'full_time', employmentStatus: 'terminated', location: 'Dublin', country: 'IE', startDate: '2019-02-11', mfaEnabled: false, securityTrainingComplete: true, onCall: false },

  // ── Recommendation-spectrum demo characters ──
  // APPROVE: solid FTE with MFA + approved, manager-backed ticket → the clean
  // counterpart to Rahul on the SAME resource (Production Database).
  { id: 'emp-033', name: 'Aisha Patel', email: 'aisha.patel@acme.io', title: 'Senior Backend Engineer', department: 'Engineering', managerId: 'emp-010', employeeType: 'full_time', employmentStatus: 'active', location: 'Bangalore', country: 'IN', startDate: '2019-03-18', mfaEnabled: true, securityTrainingComplete: true, onCall: true },
  // APPROVE_WITH_CONDITIONS: FTE, training done, but MFA off and no ticket for
  // a non-critical resource → Medium risk, no hard policy violation.
  { id: 'emp-031', name: 'Neha Kapoor', email: 'neha.kapoor@acme.io', title: 'Data Analyst', department: 'Data', managerId: 'emp-010', employeeType: 'full_time', employmentStatus: 'active', location: 'Mumbai', country: 'IN', startDate: '2021-09-06', mfaEnabled: false, securityTrainingComplete: true, onCall: false },
  // ESCALATE: an FTE account showing compromise signals (no MFA, foreign +
  // failed logins) requesting a resource with no strict policy → Critical
  // score but zero hard violations → too consequential to auto-decide.
  { id: 'emp-032', name: 'Leo Fischer', email: 'leo.fischer@acme.io', title: 'Software Engineer', department: 'Engineering', managerId: 'emp-005', employeeType: 'full_time', employmentStatus: 'active', location: 'Munich', country: 'DE', startDate: '2020-07-27', mfaEnabled: false, securityTrainingComplete: true, onCall: false },
];

const homeCountry = (id: string): string => EMPLOYEES.find((e) => e.id === id)?.country ?? 'US';

// ── Permissions ──────────────────────────────────────────────
interface PermSeed {
  userId: string;
  resource: string;
  role: string;
  sensitivity: 'low' | 'medium' | 'high' | 'critical';
  grantedBy: string;
  daysAgo: number;
  temporary?: boolean;
  expiresAt?: string;
}

const PERMISSIONS: PermSeed[] = [
  // Admins WITHOUT MFA (demo #3 hits): emp-004, emp-013, emp-017 have no MFA.
  { userId: 'emp-004', resource: 'IAM Console', role: 'Global Admin', sensitivity: 'critical', grantedBy: 'emp-011', daysAgo: 400 },
  { userId: 'emp-004', resource: 'Okta Admin', role: 'Super Admin', sensitivity: 'critical', grantedBy: 'emp-011', daysAgo: 400 },
  { userId: 'emp-013', resource: 'AWS Production', role: 'Cloud Admin', sensitivity: 'critical', grantedBy: 'emp-004', daysAgo: 300 },
  { userId: 'emp-013', resource: 'Kubernetes Cluster', role: 'Cluster Admin', sensitivity: 'high', grantedBy: 'emp-004', daysAgo: 250 },
  { userId: 'emp-017', resource: 'Payroll System', role: 'Payroll Admin', sensitivity: 'critical', grantedBy: 'emp-012', daysAgo: 500 },
  { userId: 'emp-008', resource: 'Monitoring Stack', role: 'Admin', sensitivity: 'high', grantedBy: 'emp-003', daysAgo: 200 }, // emp-008 no MFA
  // Admins WITH MFA (should not appear in demo #3).
  { userId: 'emp-014', resource: 'IAM Console', role: 'Admin', sensitivity: 'critical', grantedBy: 'emp-004', daysAgo: 350 },
  { userId: 'emp-003', resource: 'AWS Production', role: 'Deploy Admin', sensitivity: 'critical', grantedBy: 'emp-013', daysAgo: 300 },
  { userId: 'emp-006', resource: 'Production Database', role: 'DBA', sensitivity: 'critical', grantedBy: 'emp-003', daysAgo: 300 },

  // Standard access
  { userId: 'emp-001', resource: 'Dev Environment', role: 'Developer', sensitivity: 'low', grantedBy: 'emp-010', daysAgo: 60 },
  { userId: 'emp-001', resource: 'Staging Database', role: 'Read Only', sensitivity: 'medium', grantedBy: 'emp-010', daysAgo: 40 },
  { userId: 'emp-002', resource: 'SIEM Platform', role: 'Analyst', sensitivity: 'high', grantedBy: 'emp-011', daysAgo: 500 },
  { userId: 'emp-005', resource: 'Production Database', role: 'Read Write', sensitivity: 'critical', grantedBy: 'emp-006', daysAgo: 200 },
  { userId: 'emp-007', resource: 'Dev Environment', role: 'Developer', sensitivity: 'low', grantedBy: 'emp-010', daysAgo: 300 },
  { userId: 'emp-016', resource: 'Finance Reporting', role: 'Analyst', sensitivity: 'high', grantedBy: 'emp-012', daysAgo: 300 },
  { userId: 'emp-019', resource: 'Data Warehouse', role: 'Engineer', sensitivity: 'high', grantedBy: 'emp-010', daysAgo: 250 },
  { userId: 'emp-020', resource: 'Data Warehouse', role: 'Read Only', sensitivity: 'medium', grantedBy: 'emp-019', daysAgo: 150 },
  // Terminated employee still holding critical access (offboarding gap).
  { userId: 'emp-030', resource: 'Production Database', role: 'Read Write', sensitivity: 'critical', grantedBy: 'emp-006', daysAgo: 400 },

  // Spectrum characters' existing baseline access.
  { userId: 'emp-033', resource: 'Dev Environment', role: 'Developer', sensitivity: 'low', grantedBy: 'emp-010', daysAgo: 500 },
  { userId: 'emp-033', resource: 'Staging Database', role: 'Read Write', sensitivity: 'medium', grantedBy: 'emp-010', daysAgo: 400 },
  { userId: 'emp-031', resource: 'Data Warehouse', role: 'Read Only', sensitivity: 'medium', grantedBy: 'emp-019', daysAgo: 300 },
  { userId: 'emp-032', resource: 'Dev Environment', role: 'Developer', sensitivity: 'low', grantedBy: 'emp-005', daysAgo: 250 },

  // Temporary access EXPIRING TODAY (demo #4 hits).
  { userId: 'emp-007', resource: 'Production Database', role: 'Break-glass Read', sensitivity: 'critical', grantedBy: 'emp-002', daysAgo: 1, temporary: true, expiresAt: hoursFromNow(6) },
  { userId: 'emp-009', resource: 'AWS Production', role: 'Temp Deploy', sensitivity: 'high', grantedBy: 'emp-003', daysAgo: 1, temporary: true, expiresAt: hoursFromNow(3) },
  { userId: 'emp-023', resource: 'Support Console', role: 'Temp Support', sensitivity: 'medium', grantedBy: 'emp-004', daysAgo: 2, temporary: true, expiresAt: hoursFromNow(10) },
  { userId: 'emp-019', resource: 'Finance Reporting', role: 'Temp Analyst', sensitivity: 'high', grantedBy: 'emp-012', daysAgo: 1, temporary: true, expiresAt: hoursFromNow(1) },
  // Temporary access expiring later this week (should NOT show for "today").
  { userId: 'emp-020', resource: 'Production Database', role: 'Temp Read', sensitivity: 'critical', grantedBy: 'emp-006', daysAgo: 1, temporary: true, expiresAt: hoursFromNow(72) },
];

// ── Policies ─────────────────────────────────────────────────
const POLICIES = [
  { id: 'pol-001', name: 'Production Database Access', description: 'Access to any production database requires MFA, a manager-approved ticket, and excludes contractors.', resourcePattern: 'production database', requiresMfa: true, requiresTicket: true, requiresManagerApproval: true, disallowContractors: true, maxTempAccessHours: 8 },
  { id: 'pol-002', name: 'Production Infrastructure', description: 'Production cloud/infra access requires MFA and an approved ticket.', resourcePattern: 'aws production', requiresMfa: true, requiresTicket: true, requiresManagerApproval: false, disallowContractors: true, maxTempAccessHours: 12 },
  { id: 'pol-003', name: 'Privileged Admin Access', description: 'IAM/Okta admin consoles require MFA and security training.', resourcePattern: 'iam console', requiresMfa: true, requiresTicket: true, requiresManagerApproval: true, disallowContractors: true, maxTempAccessHours: 4 },
  { id: 'pol-004', name: 'Financial Systems', description: 'Payroll and finance systems require MFA and manager approval.', resourcePattern: 'payroll', requiresMfa: true, requiresTicket: true, requiresManagerApproval: true, disallowContractors: true, maxTempAccessHours: 8 },
  { id: 'pol-005', name: 'Least Privilege Baseline', description: 'All access grants follow least-privilege; inactive employees receive no new access.', resourcePattern: '*', requiresMfa: false, requiresTicket: false, requiresManagerApproval: false, disallowContractors: false, maxTempAccessHours: 24 },
];

// ── Tickets ──────────────────────────────────────────────────
const TICKETS = [
  { id: 'TKT-4501', userId: 'emp-005', type: 'access_request', title: 'Request: Production Database read-write for release', status: 'approved', resource: 'Production Database', approverId: 'emp-010', daysAgo: 201 },
  { id: 'TKT-4712', userId: 'emp-007', type: 'access_request', title: 'Break-glass Production Database access for incident INC-882', status: 'approved', resource: 'Production Database', approverId: 'emp-002', daysAgo: 1 },
  { id: 'TKT-4890', userId: 'emp-001', type: 'incident', title: 'Multiple failed logins for Rahul Sharma', status: 'open', resource: null, approverId: null, daysAgo: 2 },
  { id: 'TKT-4901', userId: 'emp-001', type: 'access_request', title: 'Request: Production Database access (no manager approval attached)', status: 'in_review', resource: 'Production Database', approverId: null, daysAgo: 1 },
  { id: 'TKT-4620', userId: 'emp-030', type: 'offboarding', title: 'Offboarding: revoke all access for Marcus Reed', status: 'open', resource: null, approverId: 'emp-024', daysAgo: 20 },
  { id: 'TKT-4777', userId: 'emp-013', type: 'change_request', title: 'Enable MFA for Cloud Admin accounts', status: 'open', resource: 'AWS Production', approverId: 'emp-011', daysAgo: 5 },
  // Aisha's fully-approved, manager-backed request → makes her a clean APPROVE.
  { id: 'TKT-5010', userId: 'emp-033', type: 'access_request', title: 'Request: Production Database read-write for Q3 migration', status: 'approved', resource: 'Production Database', approverId: 'emp-010', daysAgo: 2 },
];

// ── Access requests ──────────────────────────────────────────
const ACCESS_REQUESTS = [
  { id: 'req-0001', userId: 'emp-001', resource: 'Production Database', role: 'Read Write', status: 'pending', requestedBy: 'emp-010', daysAgo: 1 },
  { id: 'req-0002', userId: 'emp-009', resource: 'AWS Production', role: 'Temp Deploy', status: 'granted_temp', requestedBy: 'emp-003', daysAgo: 1 },
];

/** Wipes and repopulates all tables in a single transaction. */
export function seedDatabase(db: DatabaseSync): void {
  db.exec('BEGIN');
  try {
    for (const table of ['access_requests', 'tickets', 'policies', 'audit_logs', 'permissions', 'employees']) {
      db.exec(`DELETE FROM ${table}`);
    }

    const empStmt = db.prepare(
      `INSERT INTO employees (id, name, email, title, department, manager_id, employee_type,
        employment_status, location, country, start_date, mfa_enabled, security_training_complete, on_call)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    );
    for (const e of EMPLOYEES) {
      empStmt.run(e.id, e.name, e.email, e.title, e.department, e.managerId, e.employeeType,
        e.employmentStatus, e.location, e.country, e.startDate, e.mfaEnabled ? 1 : 0,
        e.securityTrainingComplete ? 1 : 0, e.onCall ? 1 : 0);
    }

    const permStmt = db.prepare(
      `INSERT INTO permissions (id, user_id, resource, role, sensitivity, granted_at, granted_by, temporary, expires_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    );
    PERMISSIONS.forEach((p, i) => {
      permStmt.run(`perm-${String(i + 1).padStart(3, '0')}`, p.userId, p.resource, p.role,
        p.sensitivity, daysAgo(p.daysAgo), p.grantedBy, p.temporary ? 1 : 0, p.expiresAt ?? null);
    });

    const polStmt = db.prepare(
      `INSERT INTO policies (id, name, description, resource_pattern, requires_mfa, requires_ticket,
        requires_manager_approval, disallow_contractors, max_temp_access_hours)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    );
    for (const p of POLICIES) {
      polStmt.run(p.id, p.name, p.description, p.resourcePattern, p.requiresMfa ? 1 : 0,
        p.requiresTicket ? 1 : 0, p.requiresManagerApproval ? 1 : 0, p.disallowContractors ? 1 : 0,
        p.maxTempAccessHours);
    }

    const tktStmt = db.prepare(
      `INSERT INTO tickets (id, user_id, type, title, status, resource, approver_id, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    );
    for (const t of TICKETS) {
      tktStmt.run(t.id, t.userId, t.type, t.title, t.status, t.resource, t.approverId,
        daysAgo(t.daysAgo), daysAgo(Math.max(0, t.daysAgo - 1)));
    }

    const reqStmt = db.prepare(
      `INSERT INTO access_requests (id, user_id, resource, role, status, requested_by, decided_by, created_at, decided_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    );
    for (const r of ACCESS_REQUESTS) {
      reqStmt.run(r.id, r.userId, r.resource, r.role, r.status, r.requestedBy,
        r.status === 'pending' ? null : r.requestedBy, daysAgo(r.daysAgo),
        r.status === 'pending' ? null : daysAgo(r.daysAgo));
    }

    seedAuditLogs(db);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  log.info('Seed complete', {
    employees: EMPLOYEES.length,
    permissions: PERMISSIONS.length,
    policies: POLICIES.length,
    tickets: TICKETS.length,
  });
}

/** Generates a believable login/audit trail — dense for the demo subject. */
function seedAuditLogs(db: DatabaseSync): void {
  seedState = 1337; // reset PRNG for determinism
  const stmt = db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, resource, outcome, ip_address, country, device, timestamp)
     VALUES (?,?,?,?,?,?,?,?,?)`,
  );
  let n = 0;
  const emit = (
    userId: string,
    action: string,
    outcome: 'success' | 'failure' | 'denied',
    country: string,
    device: string,
    ts: string,
    resource: string | null = null,
  ): void => {
    const ip = `${10 + (n % 240)}.${Math.floor(rand() * 255)}.${Math.floor(rand() * 255)}.${Math.floor(rand() * 255)}`;
    stmt.run(`log-${String(++n).padStart(4, '0')}`, userId, action, resource, outcome, ip, country, device, ts);
  };

  const devices = ['MacBook Pro', 'Windows 11 Laptop', 'iPhone 15', 'Ubuntu Workstation'];

  // Baseline: routine logins for everyone from their home country.
  for (const e of EMPLOYEES) {
    const home = e.country;
    for (let d = 1; d <= 5; d++) {
      emit(e.id, 'login', 'success', home, pick(devices), hoursAgo(d * 20 + Math.floor(rand() * 5)));
    }
  }

  // Demo subject: Rahul (emp-001) — suspicious pattern.
  emit('emp-001', 'login', 'failure', 'IN', 'Windows 11 Laptop', hoursAgo(30));
  emit('emp-001', 'login', 'failure', 'IN', 'Windows 11 Laptop', hoursAgo(29));
  emit('emp-001', 'login', 'failure', 'RU', 'Unknown Device', hoursAgo(28));
  emit('emp-001', 'login', 'success', 'RU', 'Unknown Device', hoursAgo(27)); // foreign login
  emit('emp-001', 'access_denied', 'denied', 'RU', 'Unknown Device', hoursAgo(26), 'Production Database');
  emit('emp-001', 'login', 'failure', 'IN', 'Windows 11 Laptop', hoursAgo(10));
  emit('emp-001', 'access_request', 'success', 'IN', 'Windows 11 Laptop', hoursAgo(9), 'Production Database');

  // emp-013 David Kim — privilege escalation + foreign login (interesting investigate target).
  emit('emp-013', 'privilege_escalation', 'success', 'US', 'Ubuntu Workstation', daysAgo(3), 'AWS Production');
  emit('emp-013', 'login', 'success', 'CN', 'Unknown Device', daysAgo(2));
  emit('emp-013', 'role_change', 'success', 'US', 'Ubuntu Workstation', daysAgo(30), 'Kubernetes Cluster');

  // Leo Fischer (emp-032) — FTE account showing compromise signals.
  emit('emp-032', 'login', 'failure', 'DE', 'Windows 11 Laptop', hoursAgo(20));
  emit('emp-032', 'login', 'failure', 'BR', 'Unknown Device', hoursAgo(19));
  emit('emp-032', 'login', 'success', 'BR', 'Unknown Device', hoursAgo(18)); // foreign login
  emit('emp-032', 'access_request', 'success', 'BR', 'Unknown Device', hoursAgo(17), 'Analytics Portal');

  // Terminated employee still logging in — clear red flag.
  emit('emp-030', 'login', 'success', 'IE', 'MacBook Pro', hoursAgo(48));
  emit('emp-030', 'access_denied', 'denied', 'IE', 'MacBook Pro', hoursAgo(47), 'Production Database');

  // A few grant/revoke events for realism.
  emit('emp-007', 'grant_access', 'success', 'AE', 'MacBook Pro', hoursAgo(24), 'Production Database');
  emit('emp-004', 'grant_access', 'success', 'IN', 'Ubuntu Workstation', daysAgo(1), 'IAM Console');

  log.debug('Audit logs seeded', { count: n });
}

export { homeCountry };
