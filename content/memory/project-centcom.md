---
name: Project — CENTCOM Dashboard
description: Stack, architecture patterns, and deployment config for the Praxis internal ops dashboard
type: project
originSessionId: 153d7d76-ae1f-470b-94ca-62a7f0119b80
---
CENTCOM is the internal operations dashboard for Built by Praxis.

**Stack:** Next.js 16.2.2, React 19, TypeScript, Supabase (Postgres + Realtime), Clerk v7, Tailwind CSS v4, Recharts, Lucide React, PostHog, Upstash Redis, Anthropic SDK

**Why:** Centralizes task management, budget tracking, Slack comms, calendar events, AI agents, and integrations into one dashboard for a solo operator running a marketing ops agency.

**How to apply:** Follow existing patterns exactly — server component (auth + fetch) passes data to client component. Server actions in `actions/` with auth guard + `revalidatePath()`. Dark theme: slate-950 bg, amber-400 accent. All tables have user_id scoping.

**Deployment:** Vercel (project: praxis-centcom). Env vars managed in Vercel dashboard, not local .env files.

**Modules (as of 2026-04-14):** Dashboard, Tasks/Kanban, Budget, Slack Comms, Events/Calendar, AI Agents, Projects/Roadmap
