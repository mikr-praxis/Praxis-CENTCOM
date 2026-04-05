import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Each module the platform depends on, the env vars it needs, and a
// human-readable explanation of how to get them.
const MODULES = [
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Core database, auth, and row-level security. Required for all data features.',
    docsUrl: 'https://supabase.com/dashboard/project/_/settings/api',
    vars: [
      { key: 'NEXT_PUBLIC_SUPABASE_URL', label: 'Project URL', hint: 'Settings → API → Project URL' },
      { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', label: 'Anon Key', hint: 'Settings → API → anon public key' },
      { key: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Service Role Key', hint: 'Settings → API → service_role secret (server-only)' },
    ],
  },
  {
    id: 'clerk',
    name: 'Clerk Auth',
    description: 'User authentication, session management, and role-based access.',
    docsUrl: 'https://dashboard.clerk.com',
    vars: [
      { key: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', label: 'Publishable Key', hint: 'Clerk Dashboard → API Keys' },
      { key: 'CLERK_SECRET_KEY', label: 'Secret Key', hint: 'Clerk Dashboard → API Keys (server-only)' },
    ],
  },
  {
    id: 'anthropic',
    name: 'AI Agents (Anthropic)',
    description: 'Powers all 9 AI agents — weekly reports, budget analysis, intel briefings, audits.',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    vars: [
      { key: 'ANTHROPIC_API_KEY', label: 'API Key', hint: 'Anthropic Console → Settings → API Keys' },
    ],
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Ops calendar (company-wide) + user calendar layers via OAuth. Powers the /calendar page.',
    docsUrl: 'https://console.cloud.google.com/apis/credentials',
    vars: [
      { key: 'GOOGLE_SERVICE_ACCOUNT_KEY', label: 'Service Account Key (base64)', hint: 'GCP → IAM → Service Accounts → Keys → JSON → base64 encode' },
      { key: 'OPS_CALENDAR_ID', label: 'Ops Calendar ID', hint: 'Google Calendar → ops@builtbypraxis.com → Settings → Calendar ID' },
      { key: 'GOOGLE_CLIENT_ID', label: 'OAuth Client ID', hint: 'GCP → APIs & Services → Credentials → OAuth 2.0 Client IDs' },
      { key: 'GOOGLE_CLIENT_SECRET', label: 'OAuth Client Secret', hint: 'Same OAuth 2.0 client → Client Secret' },
      { key: 'GOOGLE_REDIRECT_URI', label: 'OAuth Redirect URI', hint: 'Set to https://your-domain.com/api/auth/google/callback' },
      { key: 'NEXT_PUBLIC_APP_URL', label: 'App URL', hint: 'Your deployment URL, e.g. https://praxis-centcom.vercel.app' },
    ],
  },
  {
    id: 'monday',
    name: 'Monday.com',
    description: 'Task deadlines and team member data. Feeds into the calendar task module.',
    docsUrl: 'https://monday.com/developers/apps',
    vars: [
      { key: 'MONDAY_API_KEY', label: 'API Token', hint: 'Monday → Profile → Admin → API → Personal API Token' },
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Team comms, project channels, and message feeds on the /comms page.',
    docsUrl: 'https://api.slack.com/apps',
    vars: [
      { key: 'SLACK_BOT_TOKEN', label: 'Bot Token', hint: 'Slack App → OAuth & Permissions → Bot User OAuth Token (xoxb-...)' },
    ],
  },
  {
    id: 'upstash',
    name: 'Upstash Redis',
    description: 'Rate limiting for AI agents. Optional — agents work without it but have no rate cap.',
    docsUrl: 'https://console.upstash.com',
    vars: [
      { key: 'UPSTASH_REDIS_REST_URL', label: 'REST URL', hint: 'Upstash Console → Database → REST API → URL' },
      { key: 'UPSTASH_REDIS_REST_TOKEN', label: 'REST Token', hint: 'Upstash Console → Database → REST API → Token' },
    ],
  },
  {
    id: 'posthog',
    name: 'PostHog Analytics',
    description: 'Product analytics and event tracking. Optional — app works without it.',
    docsUrl: 'https://app.posthog.com/project/settings',
    vars: [
      { key: 'NEXT_PUBLIC_POSTHOG_KEY', label: 'Project API Key', hint: 'PostHog → Settings → Project API Key' },
      { key: 'NEXT_PUBLIC_POSTHOG_HOST', label: 'Host URL', hint: 'Usually https://app.posthog.com or your self-hosted URL' },
    ],
  },
  {
    id: 'vercel',
    name: 'Vercel Deploy Status',
    description: 'Shows deployment status on the dashboard. Optional.',
    docsUrl: 'https://vercel.com/account/tokens',
    vars: [
      { key: 'VERCEL_API_TOKEN', label: 'API Token', hint: 'Vercel → Settings → Tokens → Create' },
      { key: 'VERCEL_PROJECT_ID', label: 'Project ID', hint: 'Vercel → Project → Settings → General → Project ID' },
    ],
  },
]

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const modules = MODULES.map((mod) => ({
    ...mod,
    vars: mod.vars.map((v) => ({
      key: v.key,
      label: v.label,
      hint: v.hint,
      configured: !!process.env[v.key],
    })),
    status: mod.vars.every((v) => !!process.env[v.key])
      ? 'ready'
      : mod.vars.some((v) => !!process.env[v.key])
        ? 'partial'
        : 'missing',
  }))

  return NextResponse.json({ modules })
}
