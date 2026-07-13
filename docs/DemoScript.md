# 🎬 3-Minute Demo Script

A tight, judge-ready walkthrough. Total runtime ≈ 3 minutes.

> **Setup before you present:** `npm install && npm run seed && npm run dev`.
> Invite **@AccessGuard** to a demo channel. Have the channel open full-screen.

---

## 0:00 — The hook (15s)

> "Every IT admin faces the same question ten times a day: *should this person get this access?* Answering it means checking HR, Okta, the SIEM, the ticket system, and your policy docs. AccessGuard does all of that in Slack, in seconds — using five MCP servers and AI reasoning."

---

## 0:15 — Demo 1: Access Review ⭐ (60s)

**Type in Slack:**
```
@AccessGuard Should Rahul receive Production Database access?
```

**What appears:** a security-themed card with:
- 🔴 **CRITICAL** risk, score **100/100**, confidence **99%**
- Recommendation: **⛔ DENY**
- Key findings: no MFA, contractor, foreign login from RU, 4 failed logins, no ticket
- 4 explicit **policy violations**
- Buttons: **Approve · Deny · Grant Temporary · Investigate User**

**Say:**
> "AccessGuard just queried HR, IAM, Audit, Ticket and Policy — five separate MCP servers — and came back with an explainable risk score. Notice it's a contractor with no MFA logging in from Russia with no approval ticket. Watch the reasoning — it never invents anything; the score is deterministic, the AI just explains it."

**Click "Investigate User"** → seamlessly transitions to Demo 2.

---

## 1:15 — Demo 2: Investigation (45s)

**The investigation report shows:** profile, manager, MFA status, failed logins, foreign-login countries, current permissions, device/geo history, open tickets, and a **least-privilege review**.

**Say:**
> "One click gives a full investigation — login history, devices, open tickets, and a least-privilege audit. This is what would normally take an analyst 20 minutes across five consoles."

*(Alternatively type `@AccessGuard Investigate David Kim` to show a privilege-escalation + foreign-login case.)*

---

## 2:00 — Demo 3: Fleet risk query (30s)

**Type:**
```
@AccessGuard Who has admin access without MFA?
```

**What appears:** a clean list of **6 privileged accounts missing MFA**, with the resource and role each holds.

**Say:**
> "Natural-language security analytics. That's every admin account one phishing email away from a breach — surfaced instantly."

---

## 2:30 — Demo 4: Expiring access + close (30s)

**Type:**
```
@AccessGuard Show temp access expiring today
```

**What appears:** temporary grants expiring today (break-glass DB access, temp deploy, etc.).

**Say:**
> "And it closes the loop on temporary access, so nothing lingers past its window. Five MCP servers, real AI reasoning, enterprise IAM automation — all inside Slack. That's AccessGuard."

---

## 🎚️ Bonus: the full recommendation spectrum

AccessGuard doesn't just say "no". Show all four outcomes — great for Q&A:

| Command (Slack) | Outcome | Why |
|---|---|---|
| `/access Aisha · Production Database` | ✅ **APPROVE** (Low) | FTE, MFA on, approved manager-backed ticket |
| `/access Neha · Analytics Portal` | 🟡 **APPROVE WITH CONDITIONS** (Medium) | MFA off + no ticket, but no hard policy block |
| `/access Leo · Analytics Portal` | 🔺 **ESCALATE** (Critical) | Compromise signals (no MFA, foreign + failed logins), but no explicit policy violation → human sign-off |
| `/access Rahul · Production Database` | ⛔ **DENY** (Critical) | Contractor, no MFA, foreign login, no ticket → 4 policy violations |

> **The money shot:** run `Aisha` and `Rahul` back-to-back on the **same resource** (Production Database). Identical ask, opposite decision — because the *facts* differ. This is the clearest possible proof the risk engine is real, not scripted.

---

## 💡 Judge wow-moments to emphasize
- **Five MCP servers orchestrated live** — say it out loud when the first card renders.
- **Deterministic, non-hallucinating risk** — the AI explains, it doesn't decide the number.
- **One-click actions call back into MCP** — click Approve on a low-risk user to show `grantAccess` firing and a confirmation.
- **Runs with zero cloud dependencies** — Socket Mode + local SQLite + optional OpenAI.

## 🔁 Backup (no Slack / no network)
Run `npm run demo` — all four scenarios render in the terminal via the real MCP servers.
