/** Public surface of @accessguard/shared. */
export * from './types.js';
export * from './logger.js';
export * from './paths.js';

export { getDb, closeDb, applySchema } from './db/database.js';
export { seedDatabase } from './db/seed.js';

export { usersRepo } from './repositories/users.js';
export { permissionsRepo } from './repositories/permissions.js';
export type { AdminWithoutMfa, GrantInput } from './repositories/permissions.js';
export { auditRepo } from './repositories/audit.js';
export { ticketsRepo } from './repositories/tickets.js';
export { policiesRepo } from './repositories/policies.js';
export { accessRequestsRepo } from './repositories/accessRequests.js';

export {
  evaluateRisk,
  evaluatePolicyViolations,
  levelForScore,
  RISK_WEIGHTS,
} from './risk/scoring.js';
export type { RiskContext } from './risk/scoring.js';
