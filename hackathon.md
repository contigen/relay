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
- **Last updated:** 2026-09-19T08:25:00Z

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

### 2026-09-14 - 0ecff50

Fixed node types and process import in agent:

- Added `@types/node` to `convex/tsconfig.json` compiler options so `process.env` resolves without errors.
- Switched all `process` references in `convex/agent.ts` to `import process from 'node:process'`.

### 2026-09-15 - b67ca9a

Configured Prettier and formatted the entire codebase:

- Added `.prettierrc` (2-space indent, single quotes, trailing commas, 80-char print width) and `.prettierignore`.
- Ran format pass across all source files: `convex/`, `src/`, config files.

### 2026-09-15 - 1ed56b5

Purged remaining legacy mock data from the dashboard:

- Removed all hardcoded job and thread fixtures from `dashboard-view.tsx`; zero state now renders the genuine empty list returned by Convex.
- Added `listJobs` query to `convex/jobs.ts` with a `userEmail` index filter.

### 2026-09-15 - 7c75031

Hardened outreach emails and sanitized message feed:

- Blocked placeholder generation in vendor emails: agent now refuses to send if body still contains unfilled bracket tokens.
- Added `sanitizeMessageFeed` helper to strip internal-only system messages before rendering thread rows.
- Registered `syncInboxMessages` action and `checkJobStatus` query in `convex/jobs.ts`.

### 2026-09-15 - 4d455ca, ea26a5a, 1dc188a

Dashboard polish and data hygiene:

- Agent cards labelled as `Agent #NN` (sequential run index + category) instead of inbox IDs.
- Client email strings masked in the UI (`u***@domain`) to avoid PII on screen.
- Elapsed time on job cards formatted as `Xh Ym` instead of a raw millisecond count.

### 2026-09-15 - 06c1207, d7f1c5a

Routing and UX refinements:

- Removed the stale verify tab from the dashboard; status-check queries now route to the summary modal.
- Terminal dispatch prompt made more precise.
- Added `src/app/jobs/page.tsx` as a dedicated `/jobs` route that accepts `?job=` and `?email=` query params and renders `DashboardView` scoped to that job.

### 2026-09-19 - (working tree)

Email templates, cron sync, landing page, and backend hardening:

- Extracted all transactional email HTML into `convex/templates.ts`: `renderAcknowledgmentEmail`, `renderOutreachEmail`, `renderVendorReplyEmail`, `renderExecutiveSummaryEmail`, `renderDecisionRequiredEmail`. Each template uses Instrument Serif headlines and Geist Mono labels, matching the app's editorial aesthetic.
- Added `convex/crons.ts`: a 1-minute interval cron (`syncAllActiveInboxes`) polls AgentMail for new replies on all jobs in `awaiting_replies` state, eliminating sole dependence on the inbound webhook.
- Added `ensureWebhookRegistered` in `convex/agent.ts`: auto-registers the AgentMail webhook on first pipeline run if not already present.
- Added `safeSend` rate-limit guard in `convex/agent.ts`: backs off on 429s (60 min for daily-limit errors, 1 min otherwise) without crashing the pipeline.
- Added `sourceMessageId` field to the `jobs` schema and `createJob` mutation to track the originating inbound email.
- Added `getThread` query to `convex/threads.ts` for direct thread lookup by ID.
- Replaced raw `inboxes.messages.send` calls with `safeSend` + `renderOutreachEmail` HTML throughout `convex/agent.ts`.
- Hardened `convex/http.ts` webhook handler: extracts sender address with `extractEmail` helper; sends acknowledgment HTML email on new job intake.
- `DashboardView` now accepts `initialJobId` prop and reads `?job=` / `?email=` from the URL, scoping the live query to a single job when deep-linking from email notifications.
- User email identity stored in `localStorage` and synced to URL params; editable inline in the dashboard header.
- Rebuilt `src/app/page.tsx` as a full marketing landing page: hero with copyable `re-lay@agentmail.to` address, 3-step workflow section, example sourcing requests grid, and footer. Removed the old redirect-only behaviour.
- `package.json` build script switches to `--webpack` flag.

