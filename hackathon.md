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
- **AI models:** gemini-3.6-flash
- **Started:** 2026-08-25T12:00:00Z
- **Last updated:** 2026-09-14T20:23:00Z

## Log

### 2026-08-25 - 5fd3e56

Initialized Next.js application shell with App Router, TypeScript, and styling primitives.

### 2026-09-14 - 1314cec

Built the core Relay autonomous sourcing engine and real-time dashboard:

- Defined Convex schema with four core tables (`jobs`, `threads`, `messages`, `decisions`) and status indexes (`convex/schema.ts`).
- Mounted official `@firecrawl/firecrawl-convex`, `@agentmail/convex`, and `@convex-dev/static-hosting` components in `convex/convex.config.ts`.
- Added HTTP webhook handlers (`convex/http.ts`) for inbound AgentMail vendor replies and email-driven job intake alongside static route registration.
- Created real-time reactive dashboard with live job status progression, vendor thread inspection, inline decision banners, and demo reply simulator.

### 2026-09-14 - ed97c65

Upgraded autonomous AI engine and redesigned user experience:

- Migrated from OpenAI SDK to Vercel AI SDK (`@ai-sdk/google`) using Google Gemini 3.6 Flash (`gemini-3.6-flash`) with live cloud execution verified on Convex.
- Redesigned interface adapting PaydayAgent luxury editorial aesthetic with Instrument Serif headlines and Geist Mono technical typography.
- Refactored all component architecture to kebab-case file names (`dashboard-view.tsx`, `job-card.tsx`, `thread-row.tsx`, `terminal-box.tsx`, `decision-banner.tsx`, `setup-view.tsx`).
- Enforced strict TypeScript discipline: types over interfaces, zero `any`, zero code comments, Server Component parent page pattern, and zero-error builds.

### 2026-09-14 - f149274

Hardened pipeline for production end-users by eliminating all mocks and fallbacks:

- Removed synthetic fallback vendors (`${category} Co. #1`, `example1.com`) from `convex/agent.ts`; discovery now strictly queries Firecrawl web results and uses Gemini 3.6 Flash to extract genuine businesses.
- Fixed Firecrawl v2 result parser to consume `searchResults.web` directly, verified live against Austin office cleaning providers.
- Integrated real AgentMail account inbox resolution (`inboxes.list()`) replacing hardcoded `demo-` inbox IDs.
- Eliminated the in-app interactive simulation panel and mock reply dispatcher from `src/app/components/thread-row.tsx` and `dashboard-view.tsx`; inbound replies are now strictly received through real AgentMail webhooks.
- Simplified setup wizard specification flow to feed unadulterated user requirements directly into Gemini's intent parser.
