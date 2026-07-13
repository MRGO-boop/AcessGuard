# Internal API Reference

This documents the internal TypeScript surface (there is no public HTTP API — Slack is the frontend).

## Slack surface

### Mentions
`@AccessGuard <natural language>` → parsed by `nlp/intent.ts` into one of:
- `access_review` (name + resource)
- `investigate` (name)
- `admins_no_mfa`
- `expiring_temp`
- `help`

### Slash commands
| Command | Example | Intent |
|---|---|---|
| `/access` | `/access Rahul · Production Database` | access_review |
| `/investigate` | `/investigate Rahul` | investigate |
| `/risk` | `/risk Rahul · Production Database` | access_review |
| `/admins` | `/admins` | admins_no_mfa |
| `/tempaccess` | `/tempaccess` | expiring_temp |

### Interactive actions
| `action_id` | Handler | Effect |
|---|---|---|
| `access_approve` | `handleApprove` | `IAM.grantAccess` + `IAM.recordDecision(approved)` |
| `access_deny` | `handleDeny` | `IAM.recordDecision(denied)` |
| `access_temp` | `handleTemp` | `IAM.temporaryAccess(4h)` + `recordDecision(granted_temp)` |
| `access_investigate` | `handleInvestigate` | Renders investigation report |

Button `value` is JSON: `{ "userId", "name", "resource" }`.

---

## Shared package (`@accessguard/shared`)

### Repositories
```ts
usersRepo.findById(id) | findByName(q) | searchByName(q) | getManager(id) | listByDepartment(d) | all()
permissionsRepo.getByUser(id) | listAdmins() | adminsWithoutMfa() | searchUsersWithAccess(r)
                | expiringTemp(iso) | grant(input) | grantTemporary(input, hours) | revoke(id, r)
auditRepo.getByUser(id, n) | failedLogins(id) | recentPrivilegeChanges(id) | deviceHistory(id) | foreignLogins(id, home)
ticketsRepo.getByUser(id) | getOpenByUser(id) | approvalStatus(id, resource)
policiesRepo.all() | findById(id) | findForResource(resource)
accessRequestsRepo.create(input) | findById(id) | decide(id, status, by)
```

### Risk engine
```ts
evaluateRisk(ctx: RiskContext): RiskAssessment          // { score, level, factors, policyViolations }
evaluatePolicyViolations(ctx: RiskContext): string[]
levelForScore(score: number): RiskLevel
RISK_WEIGHTS                                             // point table
```

### Types
`Employee`, `Permission`, `AuditLog`, `Ticket`, `Policy`, `AccessRequest`, `RiskAssessment`, `AccessDecision`, `RiskLevel`, `Recommendation`. All are Zod schemas with inferred TS types (`packages/shared/src/types.ts`).

---

## Agent orchestration (`apps/slack-agent`)

```ts
// mcp/orchestrator.ts
resolveEmployee(idOrName): Promise<Employee | null>
gatherAccessContext(idOrName, resource): Promise<AccessContext | { error }>
gatherInvestigation(idOrName): Promise<InvestigationReport | { error }>
listAdminsWithoutMfa(): Promise<AdminRow[]>
listExpiringTempAccess(beforeIso?): Promise<ExpiringAccessRow[]>

// ai/reasoner.ts
reasonAccessDecision(ctx: AccessContext): Promise<ReasonedDecision>   // AccessDecision + source: 'openai' | 'deterministic'

// mcp/client-manager.ts
mcp.connectAll()
mcp.call<T>(server, tool, args): Promise<T>
mcp.listAllTools(): Promise<Record<string, string[]>>
mcp.close()
```
