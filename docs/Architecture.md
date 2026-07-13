# Architecture

AccessGuard AI is an npm-workspaces monorepo with three layers: the **Slack agent** (client), five **MCP servers**, and a **shared** domain/data package.

## High-level flow

```
Admin (Slack)
   │  "Should Rahul receive Production Database access?"
   ▼
app_mention / slash command
   ▼
Intent parser (nlp/intent.ts)  ──►  { kind: access_review, name: Rahul, resource: Production Database }
   ▼
Orchestrator (mcp/orchestrator.ts)
   │   fans out concurrently over MCP:
   ├─ HR.getEmployee            → identity, employment type, MFA, training
   ├─ Audit.failedLogins        → failed login count
   ├─ Audit.foreignLogins       → anomalous geo logins
   ├─ Ticket.approvalStatus     → is there an approved ticket?
   └─ Policy.evaluatePolicy      → deterministic risk score + violations
   ▼
AI reasoner (ai/reasoner.ts)
   │   deterministic decision  (+ optional OpenAI narrative)
   ▼
Block Kit views (slack/views.ts)  ──►  polished card + action buttons
   ▼
Admin clicks "Approve" ──► IAM.grantAccess + IAM.recordDecision ──► confirmation
```

## Why MCP?

Each enterprise system (HR, IAM, Audit, Ticketing, Policy) is modeled as an **independent MCP server** exposing typed tools. The Slack agent is a **pure MCP client**: it spawns each server as a child process and talks JSON-RPC over stdio. This mirrors how a real deployment would federate across Workday, Okta, Splunk, ServiceNow, and an OPA-style policy engine — swap the mock for the real thing behind the same tool contract and nothing else changes.

The agent **never** imports the database. The only code that touches SQLite lives inside the MCP servers (via the shared repositories).

## Risk scoring

Risk is **deterministic and explainable** (`packages/shared/src/risk/scoring.ts`). Each signal contributes fixed points:

| Signal | Points |
|---|---|
| No MFA | +30 |
| Foreign login | +25 |
| No approval ticket | +20 |
| Failed logins | +15 |
| Contractor / vendor | +20 |
| Inactive employment | +60 |
| Critical resource | +15 |
| Manager approval | −20 |
| Security training | −10 |
| On-call engineer | −10 |

Total (clamped 0–100) maps to **Low (0–24) / Medium (25–49) / High (50–74) / Critical (75+)**.

### AI guardrails
The LLM receives the deterministic score and violations as **ground truth** and may only author the narrative reasoning + confidence. The reasoner overwrites any score/level/violations the model returns with the deterministic values, so the AI can never turn a Critical risk into an APPROVE. This is the core anti-hallucination guarantee.

## Data layer

- **Storage:** Node's built-in `node:sqlite` (`DatabaseSync`), no native modules.
- **Repositories:** one per aggregate (`users`, `permissions`, `audit`, `tickets`, `policies`, `accessRequests`) — all queries live here.
- **Mappers:** snake_case rows → camelCase domain objects.
- **Seed:** `packages/shared/src/db/seed.ts` builds a deterministic ~30-person enterprise tuned so each demo surfaces something interesting.

## Resilience

- If **Slack env vars are missing**, the agent runs an offline self-test instead of crashing.
- If **OpenAI is unavailable or errors**, the reasoner falls back to the deterministic engine.
- All MCP tool failures degrade to a friendly Block Kit error message.
