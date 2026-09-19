# Relay — Email-native AI sourcing agent

> You email a task. Relay researches vendors, contacts them, handles replies, and reports back. No app to log into. The inbox is the interface.

Built for the Convex All Gas Hackathon.

**Stack:** Next.js · Convex · Google Gemini (Vercel AI SDK) · Firecrawl · AgentMail

- **Live App:** https://energetic-koala-352.convex.site
- **Backend:** https://energetic-koala-352.convex.cloud
- **Components:** `@firecrawl/firecrawl-convex` · `@agentmail/convex` · `@convex-dev/static-hosting`

---

## How it works

1. You submit a sourcing task (via the dashboard or email)
2. Gemini parses your intent into structured goals
3. Firecrawl searches the web for vendor candidates
4. AgentMail creates a dedicated inbox and sends outreach emails to each vendor
5. Vendor replies trigger the agent to analyze, follow up, or extract quotes
6. When ready, the agent emails you a structured summary with a recommendation
7. If it needs a decision from you mid-job, it emails you a question — you reply, it continues

All state lives in Convex. The dashboard shows jobs updating live in real-time.

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Initialize Convex

```bash
npx convex dev
```

This creates your deployment and generates `convex/_generated/`. Copy the `NEXT_PUBLIC_CONVEX_URL` it gives you.

### 3. Set environment variables

```bash
cp .env.local.example .env.local
```

Fill in:

- `NEXT_PUBLIC_CONVEX_URL` — from `npx convex dev`
- `GOOGLE_GENERATIVE_AI_API_KEY` — https://aistudio.google.com/app/apikey
- `FIRECRAWL_API_KEY` — https://firecrawl.dev
- `AGENTMAIL_API_KEY` — https://agentmail.to

### 4. Set Convex environment variables

```bash
npx convex env set GOOGLE_GENERATIVE_AI_API_KEY AIza...
npx convex env set FIRECRAWL_API_KEY fc-...
npx convex env set AGENTMAIL_API_KEY am-...
```

### 5. Run

```bash
npm run dev
```

Open http://localhost:3000

---

## Demo flow (for judges)

1. Click **New job**
2. Enter your email and paste: _"Find me 3 office cleaning services in Austin, weekly contract, roughly 2,000 sqft, under \$500/month"_
3. Watch the dashboard — the job card updates live: parsing → researching → sending emails → awaiting replies
4. Expand a vendor thread to inspect outreach messages and replies as they arrive
5. Watch the agent analyze each reply, extract the quote or send a follow-up
6. Click **Compile summary** (or wait for all threads to resolve) — Relay emails you the final report

---

## Architecture

```
User submits task
       │
       ▼
Convex: createJob → status: "received"
       │
       ▼
Gemini: parseTask → extracts intent, creates AgentMail inbox
       │
       ▼
Firecrawl: researchVendors → finds vendor candidates
       │
       ▼
AgentMail: sendOutreach → one email per vendor from agent inbox
       │
       ▼
Convex: status → "awaiting_replies"
       │
  [vendor replies via webhook or 1-min cron poll]
       │
       ▼
AgentMail webhook → processReply → Gemini analyzes → quote_received / follow_up / declined
       │
       ▼
[all replies in] → compileSummary → Gemini drafts report → AgentMail sends to user
       │
       ▼
Convex: status → "completed"
```

## Webhook setup (for live inbound emails)

In your AgentMail dashboard, set the webhook URL to:

```
https://YOUR_CONVEX_DEPLOYMENT.convex.site/webhook/agentmail
```

This fires every time a vendor replies, resuming the pipeline automatically.
