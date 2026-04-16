import { getConfig } from '@/lib/config'

export type MemoryType = 'user' | 'project' | 'feedback' | 'reference'

export type MemoryEntry = {
  slug: string
  name: string
  description: string
  type: MemoryType
  body: string
}

// Default entries — kept as fallback, but runtime reads from app_config MEMORY_ENTRIES_JSON
const DEFAULT_MEMORIES: MemoryEntry[] = [
  {
    slug: 'user-mikr',
    name: 'User — Mikr',
    description: 'Owner profile — Built by Praxis agency founder, senior developer, primary CENTCOM user',
    type: 'user',
    body: `- Name: Mikr
- Email: mscott@builtbypraxis.com
- Role: Founder and operator of Built by Praxis, a full-stack marketing operations agency
- Focus: Helps thought leaders and creators scale virtual and in-person events through paid media, funnel building, and operational support
- Technical level: Senior developer — comfortable with Next.js, TypeScript, Supabase, infrastructure decisions
- Works solo on CENTCOM — all Supabase queries scoped to their Clerk user_id
- Prefers practical, pattern-following code over over-engineered abstractions`,
  },
  {
    slug: 'project-centcom',
    name: 'Project — CENTCOM Dashboard',
    description: 'Stack, architecture patterns, and deployment config',
    type: 'project',
    body: `CENTCOM is the internal operations dashboard for Built by Praxis.

**Stack:** Next.js 16.2.2, React 19, TypeScript, Supabase, Clerk v7, Tailwind CSS v4, Recharts, Lucide React, PostHog, Upstash Redis, Anthropic SDK

**Modules:** Dashboard, Projects, Tasks, Monday, Calendar, Events, Budget, Agents, Memory, Clients (performance dashboards), Hardcoded (config editor), Config

**Deployment:** Vercel (project: praxis-centcom, team: mscott-8907s-projects)

**Key patterns:** Server component (auth + fetch) → client component. Server actions in actions/ with auth guard. Dark theme: slate-950 bg, amber-400 accent. All tables scoped by user_id.`,
  },
  {
    slug: 'integrations-status',
    name: 'Integrations Status',
    description: 'Which integrations are live vs pending — updated 2026-04-16',
    type: 'project',
    body: `**Live:**
- Slack — bot token in Vercel, channels/messages/send working
- Gmail — MCP connector, mscott@builtbypraxis.com
- Google Calendar — MCP connector + GCP service account
- Google Sheets API — enabled for client data ingestion
- Supabase — full CRUD, realtime subscriptions
- Upstash Redis — rate limiting, caching
- PostHog — analytics tracking
- Clerk — auth with role-based access (exec/am/cs)
- Anthropic API — ANTHROPIC_API_KEY set in Vercel (free tier, credits reset hourly)

**Configured but pending data:**
- Client Performance Dashboard — M1 deployed, Mashore seeded, awaiting real Sheet data
- Monday.com — API key in Vercel, sync infrastructure built

**Not yet wired:**
- ActiveCampaign — CRM integration planned
- HubSpot — marketing pipeline sync planned`,
  },
  {
    slug: 'external-systems',
    name: 'External Systems',
    description: 'URLs and identifiers for all external services',
    type: 'reference',
    body: `- **Vercel:** project praxis-centcom, team mscott-8907s-projects, URL praxis-centcom.vercel.app
- **GitHub:** repo mikr-praxis/Praxis-CENTCOM
- **Supabase:** project xnbsvfjkmpzoxrdhfpwx
- **Clerk:** auth provider, @clerk/nextjs v7
- **GCP:** project unified-atom-492422-n5, service account praxis-centcom-calendar@unified-atom-492422-n5.iam.gserviceaccount.com
- **PostHog:** analytics (keys in NEXT_PUBLIC_POSTHOG_HOST/KEY)
- **Anthropic:** console.anthropic.com (free tier)`,
  },
  {
    slug: 'session-preferences',
    name: 'Session Preferences',
    description: 'How Mikr prefers Claude to operate — autonomy, no trailing summaries',
    type: 'feedback',
    body: `- Run /sessionstart at the beginning of sessions to bootstrap context
- Push, deploy, and take action without asking for approval — be autonomous
- Monitor Vercel deploys after every push — fix build errors before reporting done
- Don't pause for unnecessary permission confirmations — it wastes tokens and breaks flow
- Keep responses practical and concise — skip trailing summaries
- Always pull latest main before starting work to avoid building on stale branches`,
  },
  {
    slug: 'client-dashboard',
    name: 'Client Performance Dashboard',
    description: 'M1 foundation deployed — internal dashboards for client funnel metrics',
    type: 'project',
    body: `**Status:** M1 Foundation complete and deployed. Infrastructure live.

**Architecture:** Ingest client data (Sheets/CSV) → AI-map to canonical funnel metrics (Opus) → store in Supabase → render Clerk-gated dashboards at /dashboard/[slug]

**First client:** Mashore (slug: mashore, funnel_type: call — placeholder). Seeded with 12 weeks sample data.

**Tables:** clients, data_sources, metric_snapshots, client_events (migration 008)

**Next:** M2 (real data + live dashboard), M3 (exec view + other funnels), M4 (forecasting + cron)

**All config now dynamic** — models, benchmarks, rate limits, team data editable via /hardcoded page`,
  },
  {
    slug: 'feedback-fix-builds',
    name: 'Fix Builds Before Reporting Done',
    description: 'Monitor Vercel deploy after every push — fix errors until green',
    type: 'feedback',
    body: `After pushing code, always monitor the Vercel deploy and fix any build errors immediately. Never report work as "done" with a broken preview. The user expects a working URL.

**Why:** User was frustrated when M1 code was presented as complete but the preview deploy was broken from TS errors.

**How to apply:** Push → monitor deploy → if it fails, read build logs, fix, push again. Repeat until green. Only then report done.`,
  },
]

/** Return all memory entries — reads from app_config if available, falls back to defaults. */
export async function loadMemories(): Promise<MemoryEntry[]> {
  const order: Record<MemoryType, number> = { user: 0, project: 1, reference: 2, feedback: 3 }

  let entries = DEFAULT_MEMORIES
  try {
    const json = await getConfig('MEMORY_ENTRIES_JSON')
    if (json) entries = JSON.parse(json)
  } catch { /* use defaults */ }

  return [...entries].sort(
    (a, b) => (order[a.type] ?? 99) - (order[b.type] ?? 99) || a.name.localeCompare(b.name),
  )
}
