# 🚀 Deploying AccessGuard (keep it live for judges)

AccessGuard uses Slack **Socket Mode**, so it needs **no public URL and no open ports** — it's a background worker that dials out to Slack. That makes hosting simple. The included **Dockerfile** seeds the database at build time and starts the agent.

**Environment variables to set on any host:**

| Variable | Required | Value |
|---|---|---|
| `SLACK_BOT_TOKEN` | ✅ | `xoxb-…` |
| `SLACK_APP_TOKEN` | ✅ | `xapp-…` |
| `SLACK_SIGNING_SECRET` | ✅ | your signing secret |
| `OPENROUTER_API_KEY` | ⬜ | `sk-or-…` (for AI narratives) |
| `OPENROUTER_MODEL` | ⬜ | `openai/gpt-4o-mini` |

> Never commit `.env` (it's gitignored). Set these in the host's dashboard/secrets.

A healthy deploy prints, in the logs:
```
⚡ AccessGuard is running in Slack (Socket Mode). Mention @AccessGuard to begin.
```
Any "no open ports detected" warning is **expected and fine** — Socket Mode has no inbound port.

---

## Option A — Railway (easiest UI) ⭐

**A1. Push the code to GitHub first** (Railway deploys from a repo):
```bash
cd "C:\Users\Lenovo\Desktop\slack hack"
git init
git add .
git commit -m "AccessGuard AI"
# create an EMPTY repo on github.com, then:
git remote add origin https://github.com/<you>/accessguard-ai.git
git branch -M main
git push -u origin main
```
`.env` is gitignored, so your tokens are **not** pushed. ✅

**A2. Deploy:**
1. Go to **https://railway.app** → **New Project** → **Deploy from GitHub repo** → pick the repo.
2. Railway detects the **Dockerfile** and builds it.
3. Open the service → **Variables** → add the env vars from the table above.
4. **Deploy**. Open **Deployments → View Logs** and confirm the ⚡ line.

> Railway may say "no ports detected" — ignore it. In service **Settings**, you don't need a public domain.

**A3. Deploy without GitHub (CLI alternative):**
```bash
npm i -g @railway/cli
railway login
railway init
railway up            # uploads local dir, builds the Dockerfile
railway variables set SLACK_BOT_TOKEN=xoxb-... SLACK_APP_TOKEN=xapp-... SLACK_SIGNING_SECRET=... OPENROUTER_API_KEY=sk-or-...
```

---

## Option B — Fly.io (generous free allowance)

A `fly.toml` is already included (configured as a portless worker).
```bash
# install flyctl: https://fly.io/docs/hands-on/install-flyctl/
fly auth login
fly launch --no-deploy --copy-config --name accessguard-ai   # reuses fly.toml
fly secrets set SLACK_BOT_TOKEN=xoxb-... SLACK_APP_TOKEN=xapp-... SLACK_SIGNING_SECRET=... OPENROUTER_API_KEY=sk-or-...
fly deploy
fly logs            # look for the ⚡ line
```
If `fly launch` asks about a public service / ports, choose **no** — Socket Mode needs none.

---

## Option C — Any always-on machine with Docker (VPS, home server, spare laptop)

```bash
cd "C:\Users\Lenovo\Desktop\slack hack"
# put your tokens in .env (already created), then:
docker compose up --build -d
docker compose logs -f      # confirm the ⚡ line
```
`docker-compose.yml` reads the tokens from your environment/`.env` and persists the DB in a named volume. This is the zero-cloud option — just keep the machine on during judging.

---

## Option D — Simplest of all (no deploy)

Keep `npm run dev` running on any machine that stays online during the judging window. It's the same app; it just needs to stay up so `@AccessGuard` responds.

---

## Recommendation
For a multi-day judging window, use **Railway (Option A)** or **Fly.io (Option B)** so it's always live and you can close your laptop. Allocate **~1 GB RAM** (the agent spawns 5 MCP child processes). After deploy, DM/@mention the bot from the workspace to confirm it responds, then you're done.
