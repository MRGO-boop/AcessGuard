<p align="center">
  <img src="assets/logo-icon.png" alt="AccessGuard AI logo" width="140" />
</p>

<h1 align="center">🛡️ AccessGuard AI</h1>

> **AI-powered Identity & Access Management Assistant for Slack, built on the Model Context Protocol (MCP).**

AccessGuard lets IT administrators **review access requests, investigate users, analyze security risk, and approve or deny permissions** — all from within Slack, powered by AI reasoning over five independent MCP servers.

Built for the **Slack Agent Builder Hackathon**.

---

## ✨ What it does

Ask AccessGuard a question in plain English inside Slack:

> **@AccessGuard** Should Rahul receive Production Database access?

AccessGuard automatically:

1. 📇 Pulls Rahul's profile from the **HR MCP** server
2. 🔑 Pulls current permissions from the **IAM MCP** server
3. 🕵️ Pulls login & audit history from the **Audit MCP** server
4. 🎫 Checks approval tickets from the **Ticket MCP** server
5. 📜 Evaluates company rules via the **Policy MCP** server
6. 🧮 Computes an explainable **risk score**
7. 🧠 Produces a **recommendation, reasoning, and confidence**

…and replies with a polished Block Kit card plus one-click **Approve / Deny / Grant Temporary / Investigate** buttons. Clicking a button calls back into the IAM MCP server and confirms the action.

### 🤖 It's a real agent, not a script

When you `@mention` AccessGuard (or DM it in the **Assistant** panel), an **autonomous tool-calling loop** takes over: the LLM decides *which* of the 40+ MCP tools to call, in what order, and when it has enough to answer — and the reply shows the actual tool-call trace. The deterministic risk engine is exposed as a tool the agent **must** call, so scoring is never hallucinated even though the agent is fully autonomous. See it live with `npm run agent`.

### 🧭 Native Slack agent surfaces

- **Assistant container** — a dedicated AI thread with suggested prompts and a live "is analyzing…" status.
- **App Home dashboard** — a "Security Command Center" with live risk stats and quick-action modals.
- **@mentions, 5 slash commands, and interactive buttons.**


```bash
npm run demo
```

---

## 🏗️ Architecture

```
                          ┌─────────────────────────┐
      Slack  ◀──────────▶ │   Slack Agent (Bolt)     │
   @mention / slash /     │  • intent parsing        │
   button clicks          │  • AI reasoner (OpenAI)  │
                          │  • Block Kit UI          │
                          └───────────┬─────────────┘
                                      │ MCP (stdio, JSON-RPC)
        ┌───────────────┬─────────────┼─────────────┬───────────────┐
        ▼               ▼             ▼             ▼               ▼
   ┌─────────┐    ┌─────────┐   ┌─────────┐   ┌─────────┐    ┌──────────┐
   │ HR MCP  │    │ IAM MCP │   │Audit MCP│   │Ticket   │    │Policy MCP│
   │         │    │         │   │         │   │  MCP    │    │ + Risk   │
   └────┬────┘    └────┬────┘   └────┬────┘   └────┬────┘    └────┬─────┘
        └──────────────┴─────────────┴─────────────┴──────────────┘
                                      ▼
                          ┌─────────────────────────┐
                          │  SQLite (node:sqlite)    │
                          │  ~30 employees + data    │
                          └─────────────────────────┘
```

The Slack agent is a **pure MCP client** — it never touches the database directly. Every fact comes from an MCP tool call. See [docs/Architecture.md](docs/Architecture.md) and [docs/MCP.md](docs/MCP.md).

---

## 🧰 Tech stack

- **TypeScript** (strict) · **Node.js 22+**
- **Slack Bolt SDK** (Socket Mode — no public URL needed)
- **Model Context Protocol** (`@modelcontextprotocol/sdk`) — 5 servers
- **OpenAI Responses API** (optional; deterministic fallback built in)
- **SQLite** via Node's built-in `node:sqlite` (zero native deps)
- **Zod** validation · **npm workspaces** monorepo

---

## 📁 Folder structure

```
accessguard-ai/
├── apps/slack-agent/      # Slack Bolt app: intents, AI, Block Kit, MCP client
├── packages/shared/       # types, DB, repositories, risk engine, seed data
├── mcp/
│   ├── iam-server/        # getUserPermissions, grantAccess, temporaryAccess, listAdmins…
│   ├── hr-server/         # getEmployee, getManager, employmentStatus…
│   ├── audit-server/      # failedLogins, foreignLogins, deviceHistory…
│   ├── ticket-server/     # getOpenTickets, approvalStatus…
│   └── policy-server/     # evaluatePolicy, riskRules, leastPrivilege…
├── database/              # generated SQLite file
├── scripts/               # seed.ts, demo.ts
├── docs/                  # Architecture, MCP, DemoScript, API, FolderStructure
└── slack-app-manifest.yaml
```

Full detail: [docs/FolderStructure.md](docs/FolderStructure.md).

---

## 🚀 Installation & running

### Prerequisites
- **Node.js ≥ 22.5** (for the built-in `node:sqlite` module)
- npm (ships with Node)

### 1. Install & seed

```bash
npm install
npm run seed        # creates database/accessguard.db with ~30 employees
```

### 2. Verify it works (no Slack required)

```bash
npm run demo        # runs all 4 demos through the real MCP servers
```

You should see risk scores, an investigation report, the admins-without-MFA list, and expiring temp access — all rendered in the terminal.

### 3. Connect Slack

1. Create the app from the manifest → see **[Slack configuration](#-slack-configuration)** below.
2. Copy `.env.example` to `.env` and fill in the three Slack tokens.
3. Start the agent:

```bash
npm run dev
```

4. In Slack, invite the bot to a channel and try:
   > `@AccessGuard Should Rahul receive Production Database access?`

---

## 🔧 Slack configuration

1. Go to **https://api.slack.com/apps → Create New App → From a manifest**.
2. Select your workspace and paste [`slack-app-manifest.yaml`](slack-app-manifest.yaml).
3. **Install to Workspace** (grants the bot scopes).
4. **Enable Socket Mode** (Settings → Socket Mode → On). Generate an **App-Level Token** with the `connections:write` scope → this is `SLACK_APP_TOKEN` (`xapp-…`).
5. From **OAuth & Permissions**, copy the **Bot User OAuth Token** → `SLACK_BOT_TOKEN` (`xoxb-…`).
6. From **Basic Information**, copy the **Signing Secret** → `SLACK_SIGNING_SECRET`.
7. Put all three in `.env`, then `npm run dev`.

> Socket Mode means you do **not** need to expose any public URL — perfect for a laptop demo.

---

## 🔐 Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SLACK_BOT_TOKEN` | ✅ (for Slack) | Bot User OAuth token (`xoxb-…`) |
| `SLACK_APP_TOKEN` | ✅ (for Slack) | App-level token for Socket Mode (`xapp-…`) |
| `SLACK_SIGNING_SECRET` | ✅ (for Slack) | App signing secret |
| `OPENAI_API_KEY` | ⬜ optional | Enables LLM narratives; falls back to deterministic reasoning if unset |
| `OPENAI_MODEL` | ⬜ optional | Defaults to `gpt-4o-mini` |
| `ACCESSGUARD_DB_PATH` | ⬜ optional | Defaults to `./database/accessguard.db` |
| `LOG_LEVEL` | ⬜ optional | `debug` \| `info` \| `warn` \| `error` |

**No OpenAI key?** No problem. The risk score and policy checks are always deterministic; the AI only polishes the narrative. The demo is fully functional offline.

---

## 🧠 How the AI stays honest

The risk score and policy violations are computed by a **deterministic engine** in the Policy MCP server. The LLM is only allowed to write the natural-language *reasoning* and *confidence* — it can never override the numbers or turn a Critical risk into an APPROVE. This is how AccessGuard **never hallucinates access decisions**.

See [docs/Architecture.md](docs/Architecture.md#risk-scoring).

---

## 🐳 Docker

```bash
docker compose up --build
```

The container seeds the database on first boot and starts the agent in Socket Mode (provide the Slack tokens via environment).


---

## 🔭 Future work

- Real IdP integrations (Okta / Entra ID) behind the same MCP interface
- Scheduled access recertification campaigns
- Slack Home tab dashboard with live risk posture
- Anomaly detection on the audit stream
- Approval workflows with multi-party sign-off

---


---

## 📜 License

MIT
