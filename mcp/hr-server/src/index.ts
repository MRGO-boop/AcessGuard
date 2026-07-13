/**
 * HR MCP Server
 * ─────────────
 * Read-only source of employee identity truth.
 *
 * Tools: getEmployee, getManager, getDepartment, employmentStatus
 */
import { z } from 'zod';
import { McpServer, jsonResult, serveStdio } from '@accessguard/shared/mcp';
import { usersRepo } from '@accessguard/shared';

const server = new McpServer({ name: 'hr-server', version: '1.0.0' });

/** Resolves either an employee id or a free-text name to a single employee. */
function resolve(idOrName: string) {
  return usersRepo.findById(idOrName) ?? usersRepo.findByName(idOrName);
}

server.registerTool(
  'getEmployee',
  {
    title: 'Get Employee',
    description: 'Fetch a full employee profile by id or name (e.g. "Rahul" or "emp-001").',
    inputSchema: { idOrName: z.string() },
  },
  async ({ idOrName }) => {
    const emp = resolve(idOrName);
    if (!emp) return jsonResult({ error: `No employee matched "${idOrName}"` });
    return jsonResult({ employee: emp });
  },
);

server.registerTool(
  'getManager',
  {
    title: 'Get Manager',
    description: 'Fetch the manager of an employee.',
    inputSchema: { idOrName: z.string() },
  },
  async ({ idOrName }) => {
    const emp = resolve(idOrName);
    if (!emp) return jsonResult({ error: `No employee matched "${idOrName}"` });
    const manager = usersRepo.getManager(emp.id);
    return jsonResult({
      employee: { id: emp.id, name: emp.name },
      manager: manager
        ? { id: manager.id, name: manager.name, title: manager.title }
        : null,
    });
  },
);

server.registerTool(
  'getDepartment',
  {
    title: 'Get Department Roster',
    description: 'List all employees in a department.',
    inputSchema: { department: z.string() },
  },
  async ({ department }) => {
    const roster = usersRepo.listByDepartment(department);
    return jsonResult({
      department,
      count: roster.length,
      employees: roster.map((e) => ({ id: e.id, name: e.name, title: e.title })),
    });
  },
);

server.registerTool(
  'employmentStatus',
  {
    title: 'Employment Status',
    description:
      'Return employment status, type, tenure, and security posture for an employee — the HR signals that feed risk scoring.',
    inputSchema: { idOrName: z.string() },
  },
  async ({ idOrName }) => {
    const emp = resolve(idOrName);
    if (!emp) return jsonResult({ error: `No employee matched "${idOrName}"` });
    const tenureDays = Math.floor(
      (Date.now() - new Date(emp.startDate).getTime()) / 86_400_000,
    );
    return jsonResult({
      id: emp.id,
      name: emp.name,
      employmentStatus: emp.employmentStatus,
      employeeType: emp.employeeType,
      isContractor: emp.employeeType === 'contractor' || emp.employeeType === 'vendor',
      isActive: emp.employmentStatus === 'active',
      tenureDays,
      mfaEnabled: emp.mfaEnabled,
      securityTrainingComplete: emp.securityTrainingComplete,
      onCall: emp.onCall,
      homeCountry: emp.country,
    });
  },
);

await serveStdio(server, 'hr-server');
