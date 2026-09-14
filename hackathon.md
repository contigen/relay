# Hackathon log

- **Project:** Relay
- **Event:** Convex All Gas Hackathon
- **What it does:** Email-native autonomous AI sourcing agent that parses tasks, researches vendors via Firecrawl, coordinates quotes via AgentMail, and resolves human decisions with real-time sync.
- **Live app:** https://energetic-koala-352.convex.site
- **Repo:** none
- **Frontend:** Convex static hosting
- **Convex deployment:** https://energetic-koala-352.convex.cloud
- **Components:** @firecrawl/firecrawl-convex, @agentmail/convex, @convex-dev/static-hosting
- **Convex features:** schema, tables, indexes, queries, mutations, actions, HTTP actions, realtime queries
- **Auth:** none
- **AI models:** gpt-4o
- **Started:** 2026-08-25T12:00:00Z
- **Last updated:** 2026-09-14T19:33:00Z

## Log

### 2026-08-25 - 5fd3e56
Initialized Next.js application shell with App Router, TypeScript, and styling primitives.

### 2026-09-14 - 1314cec

Built the core Relay autonomous sourcing engine and real-time dashboard:
- Defined Convex schema with four core tables (`jobs`, `threads`, `messages`, `decisions`) and status indexes (`convex/schema.ts`).
- Implemented the autonomous agent pipeline in Convex actions (`convex/agent.ts`): structured intent parsing with OpenAI GPT-4o, web vendor discovery via Firecrawl, multi-vendor email outreach via AgentMail, inbound reply analysis, and user decision escalation.
- Mounted official `@firecrawl/firecrawl-convex`, `@agentmail/convex`, and `@convex-dev/static-hosting` components in `convex/convex.config.ts`.
- Added HTTP webhook handlers (`convex/http.ts`) for inbound AgentMail vendor replies and email-driven job intake alongside static route registration.
- Created real-time reactive dashboard with live job status progression, vendor thread inspection, inline decision banners, and demo reply simulator (`src/app/page.tsx`, `src/app/components/`).
- Deployed frontend to Convex static hosting at `https://energetic-koala-352.convex.site`.
- Verified zero-error TypeScript build (`tsc --noEmit`), zero-warning ESLint (`eslint`), and live cloud execution.

