import { createServerClient } from '@/lib/supabase/server'

export type MemoryType = 'user' | 'project' | 'feedback' | 'reference'

export type MemoryEntry = {
  slug: string
  name: string
  description: string
  type: MemoryType
  body: string
  updatedAt: string
}

// Default entries used as seed data — once seeded to app_config, these are ignored.
// Each entry is stored as its own app_config row: key = MEMORY_{SLUG}, value = JSON
const DEFAULT_MEMORIES: Omit<MemoryEntry, 'updatedAt'>[] = [
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
    description: 'Which integrations are live vs pending',
    type: 'project',
    body: `**Live:** Slack, Gmail, Google Calendar, Google Sheets API, Supabase, Upstash Redis, PostHog, Clerk, Anthropic API (free tier)

**Configured but pending data:** Client Performance Dashboard (M1 deployed, Mashore seeded), Monday.com (API key set)

**Not yet wired:** ActiveCampaign, HubSpot`,
  },
  {
    slug: 'external-systems',
    name: 'External Systems',
    description: 'URLs and identifiers for all external services',
    type: 'reference',
    body: `- **Vercel:** project praxis-centcom, team mscott-8907s-projects, URL praxis-centcom.vercel.app
- **GitHub:** repo mikr-praxis/Praxis-CENTCOM
- **Supabase:** project xnbsvfjkmpzoxrdhfpwx
- **Clerk:** @clerk/nextjs v7
- **GCP:** project unified-atom-492422-n5, service account praxis-centcom-calendar@unified-atom-492422-n5.iam.gserviceaccount.com
- **Anthropic:** console.anthropic.com (free tier)`,
  },
  {
    slug: 'session-preferences',
    name: 'Session Preferences',
    description: 'How Mikr prefers Claude to operate',
    type: 'feedback',
    body: `- Run /sessionstart at the beginning of sessions
- Push, deploy, and take action without asking for approval
- Monitor Vercel deploys after every push — fix errors before reporting done
- Don't pause for unnecessary permission confirmations
- Keep responses concise — skip trailing summaries
- Always pull latest main before starting work`,
  },
  {
    slug: 'client-dashboard',
    name: 'Client Performance Dashboard',
    description: 'M1 foundation deployed — internal dashboards for client funnel metrics',
    type: 'project',
    body: `**Status:** M1 Foundation complete and deployed.

**Architecture:** Ingest (Sheets/CSV) → AI-map (Opus) → Supabase → Clerk-gated dashboards at /dashboard/[slug]

**First client:** Mashore (call funnel placeholder). Sample data seeded.

**Tables:** clients, data_sources, metric_snapshots, client_events

**Next:** M2 (real data), M3 (exec view), M4 (forecasting + cron)

**All config now dynamic** via /hardcoded editor page`,
  },
  {
    slug: 'feedback-fix-builds',
    name: 'Fix Builds Before Reporting Done',
    description: 'Monitor Vercel deploy after every push',
    type: 'feedback',
    body: `After pushing code, always monitor the Vercel deploy and fix any build errors immediately. Never report work as "done" with a broken deploy.

**Why:** User was frustrated when M1 code was presented as complete but the deploy was broken.

**How:** Push → monitor → if fail, read logs, fix, push again. Repeat until green.`,
  },
]

/**
 * Load memory entries from app_config (each stored as MEMORY_{slug} key).
 * Falls back to defaults if nothing is in the DB yet.
 * The updatedAt comes from app_config.updated_at — the actual DB timestamp.
 */
export async function loadMemories(): Promise<MemoryEntry[]> {
  const order: Record<MemoryType, number> = { user: 0, project: 1, reference: 2, feedback: 3 }

  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('app_config')
      .select('key, value, updated_at')
      .like('key', 'MEMORY_%')

    if (data && data.length > 0) {
      const entries: MemoryEntry[] = []
      for (const row of data) {
        try {
          const parsed = JSON.parse(row.value)
          entries.push({
            ...parsed,
            updatedAt: row.updated_at
              ? new Date(row.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
              : 'Unknown',
          })
        } catch { /* skip malformed */ }
      }
      if (entries.length > 0) {
        return entries.sort((a, b) => (order[a.type] ?? 99) - (order[b.type] ?? 99) || a.name.localeCompare(b.name))
      }
    }
  } catch { /* DB unavailable, use defaults */ }

  // Fallback: return defaults with "Not yet saved" as timestamp
  return DEFAULT_MEMORIES
    .map(m => ({ ...m, updatedAt: 'Not yet saved — run Seed Defaults on /hardcoded' }))
    .sort((a, b) => (order[a.type] ?? 99) - (order[b.type] ?? 99) || a.name.localeCompare(b.name))
}

/**
 * Seed all default memory entries into app_config.
 * Each gets its own row so updated_at tracks per-entry.
 */
export function getMemorySeedRows(userId: string) {
  return DEFAULT_MEMORIES.map(entry => ({
    key: `MEMORY_${entry.slug.replace(/-/g, '_').toUpperCase()}`,
    value: JSON.stringify({ slug: entry.slug, name: entry.name, description: entry.description, type: entry.type, body: entry.body }),
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }))
}
