# MCP Servers

AccessGuard runs **five** independent Model Context Protocol servers. Each is a standalone stdio process (`@modelcontextprotocol/sdk`) that exposes typed tools with Zod input schemas. The Slack agent connects to all five via `StdioClientTransport`.

Spawn command (per server):

```
node --experimental-sqlite --import tsx mcp/<name>-server/src/index.ts
```

All servers share one SQLite file (path via `ACCESSGUARD_DB_PATH`), but only reach it through the shared repositories — never raw SQL in the agent.

---

## 1. IAM MCP  (`mcp/iam-server`)
Identity & access management — the only server that mutates state.

| Tool | Input | Purpose |
|---|---|---|
| `getUserPermissions` | `userId` | List a user's permissions |
| `grantAccess` | `userId, resource, role, sensitivity, grantedBy` | Permanent grant |
| `revokeAccess` | `userId, resource` | Revoke a grant |
| `temporaryAccess` | `userId, resource, role, sensitivity, hours, grantedBy` | Time-boxed grant |
| `listAdmins` | `withoutMfaOnly?` | All admins (optionally only those without MFA) |
| `searchUsers` | `query` | Resolve name/email/id → users |
| `expiringTempAccess` | `beforeIso?` | Temp grants expiring before an instant |
| `recordDecision` | `userId, resource, role, status, decidedBy` | Log an approve/deny/temp decision |

## 2. HR MCP  (`mcp/hr-server`)
Employee identity truth (read-only).

| Tool | Input | Purpose |
|---|---|---|
| `getEmployee` | `idOrName` | Full employee profile |
| `getManager` | `idOrName` | Employee's manager |
| `getDepartment` | `department` | Department roster |
| `employmentStatus` | `idOrName` | Status, type, tenure, security posture |

## 3. Audit MCP  (`mcp/audit-server`)
Security telemetry (read-only).

| Tool | Input | Purpose |
|---|---|---|
| `getAuditLogs` | `idOrName, limit?` | Recent audit entries |
| `failedLogins` | `idOrName` | Failed login attempts |
| `recentPrivilegeChanges` | `idOrName` | Grant/revoke/role/escalation events |
| `deviceHistory` | `idOrName` | Distinct devices & countries |
| `foreignLogins` | `idOrName` | Logins outside the home country |

## 4. Ticket MCP  (`mcp/ticket-server`)
ITSM change/access-request paper trail (read-only).

| Tool | Input | Purpose |
|---|---|---|
| `getOpenTickets` | `idOrName` | Open / in-review tickets |
| `approvalStatus` | `idOrName, resource` | Is there an approved ticket for this resource? |
| `changeRequests` | `idOrName` | Full ticket history |

## 5. Policy MCP  (`mcp/policy-server`)
Deterministic risk engine + policy evaluation.

| Tool | Input | Purpose |
|---|---|---|
| `evaluatePolicy` | risk signals | Score, level, factors, violations |
| `riskRules` | — | The weights & thresholds (explainability) |
| `getPolicies` | `resource` | Policies applicable to a resource |
| `leastPrivilege` | `idOrName` | Audit a user's grants against least-privilege |

---

## Tool result convention

Every tool returns a single text content block containing pretty-printed JSON:

```json
{ "content": [ { "type": "text", "text": "{ … }" } ] }
```

The client (`mcp/client-manager.ts`) parses that text back into a typed object. Helper: `jsonResult()` in `packages/shared/src/mcp.ts`.

## Adding a new server

1. `mkdir mcp/<name>-server` with `package.json`, `tsconfig.json`, `src/index.ts`.
2. Build tools with `server.registerTool(name, { inputSchema }, handler)`.
3. `await serveStdio(server, '<name>-server')`.
4. Register the entry path in `apps/slack-agent/src/mcp/client-manager.ts`.
