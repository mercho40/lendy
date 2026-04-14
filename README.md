# Lendy

**An AI-native microcredit lender, operated end-to-end by autonomous agents.**

Lendy is the first microfinance company where no human touches the credit process. Six AI agents handle onboarding, identity verification, social vouching, underwriting, disbursement, collections, and operations — all via WhatsApp. A four-person team can run the company at the scale of millions of customers.

The point is not the chatbot. The point is **who gets to borrow**.

---

## The problem: a billion people locked out

Traditional credit scoring requires a banking footprint — salary deposits, tax filings, credit history. Informal workers, the unbanked, and anyone operating outside the formal economy are invisible to bureaus, and therefore uncreditworthy by default.

The industry response has been "collect more structured data". That doesn't scale, and it ignores the real signal: **the context around a borrower**. How long have you known them? Are they reliable with money? Would you lend them $100?

Bureaus can't ingest that. Humans can't ingest it at scale. LLMs can.

---

## Our edge: agents that read unstructured signal

Lendy uses LLM agents at every step that traditional underwriting hands off to a form:

| Traditional underwriting | Lendy |
|---|---|
| Credit bureau query | **Voice verification agent** — a 3-minute conversation becomes a transcript, which becomes a trust signal: confidence, coherence, red flags. |
| Salary proof / tax filings | **Open-ended chat** during onboarding — occupation, income sources, intent — captured as natural language and scored by the decision agent. |
| Collateral / guarantors | **Reference verification agent** — the applicant shares three `REF-XXXX` codes with contacts. Each contact WhatsApps the bot; the agent runs a conversational interview and scores the response 0–100. |
| Human underwriter | **Credit decision agent** — one API call with structured output against a risk matrix. Full audit trail in the DB. |
| Call center collections | **Collection agent + Manager** — payment reminders, renegotiation, and cross-pipeline supervision, all autonomous. |

Every borrower leaves a **complete audit trail** of the unstructured signal that supported the decision: voice transcript, reference transcripts, decision rationale, every nudge sent, every reminder. Human operators can replay any credit from end to end.

---

## Scalable inclusion

Because every step is an agent, the marginal cost of a new borrower is cents in LLM tokens — not a branch visit, not a phone call, not a human analyst. Four people can operate Lendy at scale.

That economics changes who we can serve. **We don't underwrite people who are already easy for banks to score. We underwrite the ones the banks can't even see.** Informal workers. Recent immigrants. Young people with no credit history. Anyone who operates outside the banking rails but still has a network of people who can vouch for them.

---

## How it works

```
WhatsApp inbound
      │
      ▼
 [Onboarding agent] ─► collects name, DNI, income, occupation
                       sends voice verification link
      │
      ▼
 [Voice agent — ElevenLabs] ─► 3-minute natural conversation
                               transcript + analysis stored on user
      │
      ▼
 [Verification agent × 3] ─► applicant shares three REF-XXXX codes
                             each contact is interviewed by the agent
                             4 questions → per-reference trust score
      │
      ▼
 [Credit decision agent] ─► one API call with structured output
                            inputs: profile + voice analysis + 3 ref scores
                            output: approved/denied, amount, term, APR
      │
      ▼
 [Active-loan agent] ─► generates MercadoPago payment links
                        handles inquiries, renegotiation
                        fires reminders
      │
      ▼
 [Payments webhook] ─► confirms payment, updates installments

         ┌─────────────────────────────────────────────┐
         │ [Manager agent] — runs every 30 minutes     │
         │ snapshots the entire pipeline               │
         │ takes autonomous action on stuck cases      │
         │ exposes a chat console for the human ops    │
         │ team, with full audit trail of every action │
         └─────────────────────────────────────────────┘
```

Every agent shares the same webhook and codebase. Routing is by `conversation.state` — the only thing that changes per agent is the system prompt, the available tools, and what the Manager sees in its snapshot.

---

## The six agents

| # | Agent | Role | Key tools |
|---|-------|------|-----------|
| 1 | **Onboarding** | Collects KYC data, dispatches voice verification, generates reference codes. | `save_user_profile`, `submit_references` |
| 2 | **Voice** | Natural-conversation identity verification via ElevenLabs Agents. | Returns transcript + analysis to webhook |
| 3 | **Verification** | Conversational interview with each reference, per-contact trust score. | `save_reference_response` |
| 4 | **Credit decision** | Reads unstructured profile + references, outputs structured offer via Claude `output_config.format`. | Structured output, validated against a risk matrix |
| 5 | **Active loan** | Handles the borrower throughout the life of the loan. | `get_loan_status`, `generate_payment_link`, `renegotiate_terms` |
| 6 | **Manager** | Meta-agent: surveys the whole pipeline, acts on stuck cases, answers the human operator. | `get_system_snapshot`, `send_nudge`, `trigger_collection_reminder`, `lookup_user`, `lookup_loan`, `search_users`, `send_custom_message` |

---

## Technical highlights

- **Multi-agent by state, not by process.** The marginal cost of adding an agent is: one prompt + one tool list + one enum value. No new infra.
- **Structured output in production** (Claude 4.6) for credit decisions. The LLM cannot return an invalid schema, and we re-validate with `assertValidDecision` for defense in depth.
- **Full audit trail.** Every Manager run persists the entire LLM transcript plus a list of concrete actions taken, linked to the user/loan they affected. A human can replay any credit decision or any nudge that was sent.
- **Guard rails on the autopilot.** Max 5 actions per run, 24h cooldown between nudges to the same user, explicit priority ordering (mora > verification > onboarding > decision).
- **Hybrid supervision.** The Manager runs every 30 minutes on cron (Vercel), and it's also a chat agent the operator can talk to at `/admin/manager` — lookups, custom messages, on-demand autopilot runs.
- **Mock MercadoPago checkout** (`/mock-pay/[id]`) so the full pipeline can be demoed without a real MP account.

---

## Stack

| Layer | Choice |
|-------|--------|
| Runtime | Bun |
| Framework | SvelteKit 5 + Tailwind 4 + shadcn-svelte |
| WhatsApp transport | [Kapso.ai](https://kapso.ai) |
| Voice agent | ElevenLabs Agents |
| LLM | Claude Sonnet 4.6 — tool use + structured output |
| Database | Postgres (Neon) + Drizzle ORM |
| Payments | MercadoPago SDK, local mock for demo |
| Deploy + cron | Vercel (two cron jobs: reminders daily, Manager every 30 min) |

---

## Code layout

```
src/
├── lib/server/
│   ├── db/                             # schema + drizzle
│   ├── ai/
│   │   ├── agent.ts                    # user-facing loop
│   │   ├── manager.ts                  # autopilot + chat
│   │   ├── pipeline.ts                 # inter-agent orchestration
│   │   ├── system-prompt.ts            # per-state prompts
│   │   ├── tools.ts
│   │   └── handlers/{onboarding,verification,credit-decision,active-loan}.ts
│   ├── whatsapp.ts
│   └── mercadopago.ts
└── routes/
    ├── api/
    │   ├── whatsapp/                   # main webhook
    │   ├── payments/webhook/
    │   ├── elevenlabs/webhook/
    │   └── cron/{reminders,manager}/
    ├── mock-pay/[paymentId]/
    ├── voice/
    └── admin/
        ├── users/[id]
        ├── references/[id]
        ├── loans/[id]
        └── manager/                    # operator chat + audit log
```

---

## Running it locally

```bash
bun install
cp .env.example .env
# fill in env vars
bun run db:push
bun run dev
```

Required env vars (see `.env.example`):

- `DATABASE_URL` — Postgres (Neon.tech)
- `ANTHROPIC_API_KEY`
- `KAPSO_API_KEY`, `KAPSO_API_BASE_URL`, `KAPSO_PHONE_NUMBER_ID`, `KAPSO_VERIFY_TOKEN`
- `BASE_URL` — ngrok in dev, Vercel URL in prod
- `CRON_SECRET` — auth for cron endpoints

### Scripts

```bash
bun run dev          # dev server
bun run build        # production build
bun run db:push      # sync schema → Neon
bun run db:studio    # explore the DB
bun run test         # vitest (48 tests)
```

### Deploying to Vercel

1. Connect the repo from the Vercel dashboard.
2. Configure the env vars listed above.
3. `vercel.json` already declares both cron jobs.
4. Point the Kapso webhook at `https://<your-vercel>.vercel.app/api/whatsapp`.

---

## Example: one autopilot run

```
$ curl -sSL "$APP_URL/api/cron/manager?force=1"

{
  "runId": 1,
  "summary": "Detected 3 active alerts and used 4 of 5 available actions:
   1. Overdue loan (#1 — Pedro Mora): triggered collection reminder.
   2. Stuck verification (user #2 — María Refs): sent a nudge reminding
      her to share her REF codes with contacts.
   3. Stuck onboarding (user #1 — Carlos Trabado): nudge to resume.
   4. Observation: default rate at 100% (single active loan, overdue).",
  "actionsTaken": 3,
  "iterations": 4
}
```

The LLM read the pipeline state, prioritised correctly, took the three most urgent actions, and logged an observation about the single-loan portfolio. User #4 (2h old, not yet stuck) was correctly ignored. On the next run, users who were just nudged are in a 24-hour cooldown and the Manager respects that — all encoded in the tool, not in prompt engineering.
