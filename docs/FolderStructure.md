# Folder Structure

```
accessguard-ai/
├── package.json                 # root — npm workspaces + scripts (seed, dev, demo, typecheck)
├── tsconfig.base.json           # shared strict TS config
├── tsconfig.json                # project references (build orchestration)
├── eslint.config.js             # flat ESLint config
├── .prettierrc
├── .env.example                 # copy → .env
├── slack-app-manifest.yaml      # one-click Slack app setup
├── Dockerfile
├── docker-compose.yml
├── README.md
│
├── apps/
│   └── slack-agent/             # @accessguard/slack-agent — the Slack Bolt app
│       └── src/
│           ├── index.ts         # entry: connect MCP → start Bolt (or self-test)
│           ├── config.ts        # .env loader + typed config
│           ├── selftest.ts      # offline runner for all 4 demos
│           ├── nlp/
│           │   └── intent.ts    # natural-language → intent
│           ├── mcp/
│           │   ├── client-manager.ts   # spawn + connect 5 MCP servers
│           │   └── orchestrator.ts     # fan-out queries → typed context
│           ├── ai/
│           │   ├── prompts.ts   # system prompt + JSON schema
│           │   └── reasoner.ts  # OpenAI + deterministic decision
│           ├── slack/
│           │   ├── kit.ts       # low-level Block Kit builders
│           │   ├── views.ts     # high-level views (1 per demo)
│           │   └── handlers.ts  # mentions, slash commands, buttons
│           └── workflows/
│               └── dispatcher.ts # intent/button → orchestration → view
│
├── packages/
│   └── shared/                  # @accessguard/shared — domain + data
│       └── src/
│           ├── index.ts         # barrel export
│           ├── types.ts         # Zod schemas + inferred types
│           ├── logger.ts        # stderr structured logger
│           ├── paths.ts         # DB path resolution
│           ├── mcp.ts           # MCP server helpers (jsonResult, serveStdio)
│           ├── db/
│           │   ├── schema.sql   # SQLite DDL
│           │   ├── database.ts  # node:sqlite connection
│           │   ├── mappers.ts   # row → domain
│           │   └── seed.ts      # ~30-employee dataset
│           ├── repositories/    # one file per aggregate
│           │   ├── users.ts
│           │   ├── permissions.ts
│           │   ├── audit.ts
│           │   ├── tickets.ts
│           │   ├── policies.ts
│           │   └── accessRequests.ts
│           └── risk/
│               └── scoring.ts   # deterministic risk engine
│
├── mcp/                         # five independent MCP servers
│   ├── iam-server/src/index.ts
│   ├── hr-server/src/index.ts
│   ├── audit-server/src/index.ts
│   ├── ticket-server/src/index.ts
│   └── policy-server/src/index.ts
│
├── database/                    # generated accessguard.db (gitignored)
├── scripts/
│   ├── seed.ts                  # npm run seed
│   └── demo.ts                  # npm run demo (offline 4-demo run)
└── docs/
    ├── Architecture.md
    ├── MCP.md
    ├── DemoScript.md
    ├── API.md
    └── FolderStructure.md
```

## Package boundaries

- **`@accessguard/shared`** — the only package that knows about SQLite. Domain types, repositories, risk engine, seed data, MCP helpers.
- **`mcp/*-server`** — thin adapters: map MCP tool calls → shared repositories. No business logic beyond shaping responses.
- **`@accessguard/slack-agent`** — MCP *client* only. Intent parsing, orchestration, AI, and Block Kit. Never imports the DB.
