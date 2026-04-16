export type MemoryType = 'user' | 'project' | 'feedback' | 'reference'

export type MemoryEntry = {
  slug: string
  name: string
  description: string
  type: MemoryType
  body: string
}

/**
 * Memory entries are inlined rather than read from disk so they bundle
 * cleanly on Vercel without filesystem assumptions. Source of truth lives
 * in `content/memory/*.md` — keep these in sync when adding entries.
 */
const MEMORIES: MemoryEntry[] = [
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
    description: 'Stack, architecture patterns, and deployment config for the Praxis internal ops dashboard',
    type: 'project',
    body: `CENTCOM is the internal operations dashboard for Built by Praxis.

**Stack:** Next.js 16.2.2, React 19, TypeScript, Supabase (Postgres + Realtime), Clerk v7, Tailwind CSS v4, Recharts, Lucide React, PostHog, Upstash Redis, Anthropic SDK

**Why:** Centralizes task management, budget tracking, Slack comms, calendar events, AI agents, and integrations into one dashboard for a solo operator running a marketing ops agency.

**How to apply:** Follow existing patterns exactly — server component (auth + fetch) passes data to client component. Server actions in \`actions/\` with auth guard + \`revalidatePath()\`. Dark theme: slate-950 bg, amber-400 accent. All tables have user_id scoping.

**Deployment:** Vercel (project: praxis-centcom). Env vars managed in Vercel dashboard, not local .env files.

**Modules (as of 2026-04-14):** Dashboard, Tasks/Kanban, Budget, Slack Comms, Events/Calendar, AI Agents, Projects/Roadmap`,
  },
  {
    slug: 'integrations-status',
    name: 'Integrations Status',
    description: 'Which third-party integrations are live, pending, or blocked — updated 2026-04-14',
    type: 'project',
    body: `**Live:**
- Slack (@slack/web-api) — bot token in Vercel, channels/messages/send working
- Gmail — via MCP connector, mscott@builtbypraxis.com
- Google Calendar — via MCP connector, GCP service account key deployed to Vercel
- Supabase — full CRUD, realtime subscriptions
- Upstash Redis — connected
- PostHog — analytics tracking active
- Clerk — auth, middleware protecting all app routes

**Pending (not yet configured):**
- Monday.com — MCP connector available but not wired in
- ActiveCampaign — CRM integration planned
- HubSpot — marketing pipeline sync planned

**Blocked:**
- ANTHROPIC_API_KEY not set in Vercel env vars — blocks AI Agents feature (9 agents defined but can't execute)
- Ops calendar needs to be shared with service account \`praxis-centcom-calendar@unified-atom-492422-n5.iam.gserviceaccount.com\`

**Why:** Tracking this avoids re-discovering blockers each session.

**How to apply:** Before working on any integration feature, check this list first. Update when status changes.`,
  },
  {
    slug: 'external-systems',
    name: 'External Systems',
    description: 'URLs and identifiers for Vercel, GitHub, Supabase, and other external services',
    type: 'reference',
    body: `- **Vercel:** project \`praxis-centcom\`, team \`mscott-8907s-projects\`, URL \`praxis-centcom.vercel.app\`
- **GitHub:** repo \`mikr-praxis/Praxis-CENTCOM\`
- **Supabase:** referenced via \`NEXT_PUBLIC_SUPABASE_URL\` env var (check Vercel for actual value)
- **Clerk:** auth provider, \`@clerk/nextjs\` v7 — sign-in/sign-up at catch-all routes
- **Cloudflare:** DNS proxy (free tier)
- **GCP:** project \`unified-atom-492422-n5\`, service account for Calendar API
- **PostHog:** analytics, keys in \`NEXT_PUBLIC_POSTHOG_HOST\` and \`NEXT_PUBLIC_POSTHOG_KEY\``,
  },
  {
    slug: 'session-preferences',
    name: 'Session Preferences',
    description: 'How Mikr prefers sessions to be bootstrapped and how Claude should operate',
    type: 'feedback',
    body: `Always use \`/sessionstart\` skill at the start of sessions to bootstrap context. Do NOT use scheduled tasks for session bootstrap — this was explicitly rejected in favor of manual skill invocation.

**Why:** Mikr wants control over when context loads. Scheduled tasks were creating nested task issues and felt too autonomous.

Push, deploy, and take action without asking for constant approval. Be autonomous with git operations (push, PR creation, deployments).

**Why:** User explicitly stated "you need to be able to push without my constant approval." Stopping to ask permission on routine git ops breaks flow.

**How to apply:** When starting a new session on the Praxis project, run \`/sessionstart\` if the user asks for it. Don't auto-schedule recurring bootstrap. Keep responses practical and concise — skip trailing summaries of what was just done (the user can read the diff). Push code, create PRs, and deploy without asking — just do it and report the result.`,
  },
  {
    slug: 'feedback-pull-first',
    name: 'Pull Latest Before Starting Work',
    description: 'Always fetch and rebase onto latest main before starting any work — never assume the worktree is current',
    type: 'feedback',
    body: `ALWAYS run \`git fetch origin && git rebase origin/main\` (or check \`git log origin/main\`) at the START of every session before writing any code. Never assume the current branch/worktree reflects the latest state of main.

**Why:** On 2026-04-14 I built an entire Projects module on a stale worktree (branched from an old commit), only to discover main had already built a far more advanced version with milestones, Monday.com integration, kanban trackers, and role-based sidebar. Everything I built was already superseded. The user was rightfully frustrated.

**How to apply:**
- Session start: check \`git log origin/main -10\` and diff against the current branch
- Before opening any plan: verify the files you intend to change haven't already been rewritten upstream
- If the worktree is more than a day or two old, rebase first
- The \`/sessionstart\` skill should verify this — if it doesn't already, update it`,
  },
]

/** Return all memory entries, sorted user → project → reference → feedback. */
export async function loadMemories(): Promise<MemoryEntry[]> {
  const order: Record<MemoryType, number> = { user: 0, project: 1, reference: 2, feedback: 3 }
  return [...MEMORIES].sort(
    (a, b) => (order[a.type] ?? 99) - (order[b.type] ?? 99) || a.name.localeCompare(b.name),
  )
}
