# 📦 AccessGuard AI — Devpost Submission Kit

Everything you need to submit. Copy-paste the sections below.

---

## 1) Text description — features & functionality

**AccessGuard AI** is an autonomous security analyst that lives in Slack and answers the question every IT admin faces a dozen times a day: *"Should this person get this access?"* Instead of an admin manually checking HR, the identity provider, the SIEM, the ticketing system, and a stack of policy docs, they just ask AccessGuard in plain English — and get an explainable decision in seconds.

**How it works**
- Ask via **@mention**, a **slash command**, or the **Assistant panel** (e.g. *"Should Rahul receive Production Database access?"*).
- An **autonomous LLM tool-calling agent** decides which of 40+ tools to call across **five independent Model Context Protocol (MCP) servers** — HR, IAM, Audit, Ticket, and Policy — gathers the facts, and calls a **deterministic risk engine** for scoring.
- It replies with a polished **Block Kit** card: **risk score, level, recommendation, confidence, key findings, policy violations**, and a visible **tool-call trace** showing exactly which systems it queried.
- One-click **Approve / Deny / Grant Temporary / Investigate** buttons execute the decision live against the IAM server and log it to the audit trail.

**Key features**
- 🤖 **Real agentic loop** — the LLM autonomously selects & chains MCP tools (not hard-coded routing), with the reasoning path shown to the user.
- 🧠 **Non-hallucinating AI** — the risk score is computed deterministically; the LLM only writes the narrative and picks tools, so it can never turn a Critical risk into an "approve."
- 🧭 **Full Slack agent surface** — Assistant container with suggested prompts, App Home "Security Command Center" dashboard, @mentions, 5 slash commands, and interactive buttons/modals.
- 🔐 **Enterprise workflows** — access review, user investigation, "who has admin without MFA?", and "temp access expiring today," each rendered as clean Block Kit.
- 🎚️ **Explainable spectrum** — approves low-risk requests, adds conditions to medium ones, escalates ambiguous ones, and denies violations — with reasons every time.

**Stack:** TypeScript · Node.js · Slack Bolt (Socket Mode) · Model Context Protocol SDK · OpenAI/OpenRouter · SQLite (`node:sqlite`) · Zod.

---

## 2) Impact — "Slack Agent for Good"

**The problem:** Most data breaches don't come from clever hackers — they come from *access that shouldn't exist*: a contractor with no MFA, an admin account never de-provisioned, a "temporary" grant that never expired. Every one of those is a door left open to the private data of real people — patients, students, customers, employees. Reviewing access properly takes security expertise and time, which the organizations holding the most sensitive data (nonprofits, clinics, schools, small teams) simply don't have.

**How AccessGuard does good:**
- **Protects people's private data at the source.** By enforcing least-privilege and catching risky grants *before* they're approved, it shrinks the attack surface that exposes personal, medical, and financial data.
- **Democratizes security expertise.** It puts a senior security analyst inside Slack for teams that could never hire one — so a two-person IT department gets the same rigor as a Fortune 500 SOC.
- **Keeps AI accountable.** Every decision is explainable and grounded in real data, with the score computed deterministically — no black-box AI silently deciding what employees can and can't access.
- **Closes the gaps that hurt people.** It surfaces admins without MFA, terminated employees who still have access, and expiring grants — the exact failures behind real-world breaches.
- **Reduces toil and burnout** for overworked admins, freeing them for higher-value work.

**In one line:** AccessGuard makes strong, explainable access security accessible to everyone — protecting the private data of the people these systems ultimately serve.

---

## 3) ~3-minute demo video — shot list & script

> Record your screen with the Slack workspace full-screen (Loom / OBS / Windows Game Bar `Win+G`). Keep the agent running (`npm run dev`). Aim for 2:45–3:00.

| Time | Show on screen | Say (voiceover) |
|---|---|---|
| **0:00–0:15** | AccessGuard app open (logo + Assistant greeting) | "Every IT admin asks the same question daily: should this person get this access? Answering it means checking five systems. AccessGuard does it in Slack in seconds — with five MCP servers and an autonomous AI agent." |
| **0:15–1:05** | Type `@AccessGuard Should Rahul receive Production Database access?` → the card renders | "Watch — the agent decides on its own which systems to query." Point at the **🔧 tool-call trace**. "HR, tickets, audit logs, foreign logins, then the policy risk engine. It returns CRITICAL, score 100, DENY — with four policy violations. The score is deterministic; the AI explains it but can't fabricate it." |
| **1:05–1:35** | Type `@AccessGuard Should Aisha receive Production Database access?` → APPROVE | "Same resource, different person — and now it's APPROVE. Aisha has MFA and a manager-approved ticket. Identical ask, opposite decision, because the facts differ. That's proof the reasoning is real, not scripted." |
| **1:35–2:05** | Click **Investigate User** (or `/investigate Leo Fischer`) | "One click gives a full investigation — logins, devices, permissions, tickets, and a least-privilege audit — work that normally spans five consoles." |
| **2:05–2:30** | `@AccessGuard Who has admin access without MFA?` then the **Home tab** dashboard | "Natural-language security analytics surfaces every admin missing MFA. And the Home tab is a live command center of the org's risk posture." |
| **2:30–3:00** | Click **Grant Temporary** on a card → confirmation | "Actions run live against the IAM server and auto-expire. Five MCP servers, an autonomous agent, explainable risk — all inside Slack. That's AccessGuard: enterprise-grade access security, for everyone." |

**Backup if the network/LLM is flaky:** run `npm run agent` and `npm run demo` — both render the full flow in the terminal.

---

## 4) Architecture diagram

Use **[docs/architecture.svg](architecture.svg)** — open it in a browser and export/screenshot to PNG. (Text version in [docs/Architecture.md](Architecture.md).)

Flow: **Slack surfaces** → **Bolt agent** (intent parser · autonomous LLM tool-calling loop · AI reasoner · Block Kit) → **MCP client** → **5 MCP servers** (HR · IAM · Audit · Ticket · Policy+Risk Engine) → **SQLite**. The LLM selects tools and writes narratives; the Policy server owns the deterministic score.

---

## 5) Slack developer sandbox URL + reviewer access

**Grant access to the judges (required):**
1. In Slack, click your **workspace name** (top-left) → **Invite people to [workspace]**.
2. Add both emails: **`slackhack@salesforce.com`** and **`testing@devpost.com`**.
3. Send invites (as *Members* so they can use the app).

**Get the sandbox URL to paste into Devpost:**
- It's your workspace URL, e.g. `https://app.slack.com/client/<TEAM_ID>` (visible in your browser address bar), or `https://<your-workspace>.slack.com`.

**Important — keep it testable during judging:**
Because the agent uses **Socket Mode**, it only responds while the process is running on a reachable machine. For judging, either (a) keep `npm run dev` running on a machine that stays online, or (b) deploy the included Docker image (`docker compose up`) to any small cloud host with the Slack + LLM env vars set. Mention in your submission that reviewers can `@AccessGuard` in the workspace once the app is live.

---

## ✅ Pre-submit checklist
- [ ] Text description pasted (Section 1)
- [ ] Impact statement pasted (Section 2)
- [ ] 3-min video recorded & uploaded (Section 3)
- [ ] Architecture PNG exported from `docs/architecture.svg` (Section 4)
- [ ] `slackhack@salesforce.com` + `testing@devpost.com` invited to the workspace (Section 5)
- [ ] Sandbox URL added to Devpost
- [ ] App icon uploaded (`assets/logo-icon.png`) and app is running for judges
