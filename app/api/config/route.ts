import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getConfig, setConfig, deleteConfig, bustConfigCache } from '@/lib/config'
import { ACTIVECAMPAIGN_MODULE } from '@/lib/activecampaign/config-entry'

// Keys that CANNOT be edited from the UI — they're required at boot time
// before Supabase is even available (chicken-and-egg).
const IMMUTABLE_KEYS = new Set([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
])

// Each module the platform depends on
export const MODULES = [
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Core database, auth, and row-level security. Required for all data features.',
    docsUrl: 'https://supabase.com/dashboard/project/_/settings/api',
    editable: false,
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
    editable: false,
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
    editable: true,
    vars: [
      { key: 'ANTHROPIC_API_KEY', label: 'API Key', hint: 'Anthropic Console → Settings → API Keys' },
    ],
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Ops calendar (company-wide) + user calendar layers via OAuth. Powers the /calendar page.',
    docsUrl: 'https://console.cloud.google.com/apis/credentials',
    editable: true,
    vars: [
      { key: 'GOOGLE_CLIENT_ID', label: 'OAuth Client ID', hint: 'GCP → Google Auth Platform → Clients → Web client → Client ID' },
      { key: 'GOOGLE_CLIENT_SECRET', label: 'OAuth Client Secret', hint: 'Same OAuth 2.0 client → Client Secret' },
      { key: 'GOOGLE_REFRESH_TOKEN', label: 'OAuth Refresh Token', hint: 'One-time token from OAuth Playground (access_type=offline)' },
      { key: 'OPS_CALENDAR_ID', label: 'Ops Calendar ID', hint: 'Google Calendar → Settings → Calendar ID (defaults to primary)' },
      { key: 'GOOGLE_REDIRECT_URI', label: 'OAuth Redirect URI (optional)', hint: 'For per-user OAuth flow: https://your-domain.com/api/auth/google/callback' },
      { key: 'NEXT_PUBLIC_APP_URL', label: 'App URL', hint: 'Your deployment URL, e.g. https://praxis-centcom.vercel.app' },
    ],
  },
  {
    id: 'monday',
    name: 'Monday.com',
    description: 'Task deadlines and team member data. Feeds into the calendar task module.',
    docsUrl: 'https://monday.com/developers/apps',
    editable: true,
    vars: [
      { key: 'MONDAY_API_KEY', label: 'API Token', hint: 'Monday → Profile → Admin → API → Personal API Token' },
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Team comms, project channels, and message feeds on the /comms page.',
    docsUrl: 'https://api.slack.com/apps',
    editable: true,
    vars: [
      { key: 'SLACK_BOT_TOKEN', label: 'Bot Token', hint: 'Slack App → OAuth & Permissions → Bot User OAuth Token (xoxb-...)' },
    ],
  },
  {
    id: 'upstash',
    name: 'Upstash Redis',
    description: 'Rate limiting for AI agents. Optional — agents work without it but have no rate cap.',
    docsUrl: 'https://console.upstash.com',
    editable: true,
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
    editable: true,
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
    editable: true,
    vars: [
      { key: 'VERCEL_API_TOKEN', label: 'API Token', hint: 'Vercel → Settings → Tokens → Create' },
      { key: 'VERCEL_PROJECT_ID', label: 'Project ID', hint: 'Vercel → Project → Settings → General → Project ID' },
    ],
  },
  ACTIVECAMPAIGN_MODULE,
  {
    id: 'hubspot',
    name: 'HubSpot CRM',
    description: 'Deal pipeline, contacts, and revenue tracking. Powers the pipeline dashboard.',
    docsUrl: 'https://app.hubspot.com/settings/api-key',
    editable: true,
    vars: [
      { key: 'HUBSPOT_ACCESS_TOKEN', label: 'Private App Token', hint: 'HubSpot → Settings → Integrations → Private Apps → Create → Access Token' },
    ],
  },
]

// ── GET — return module status ────────────────────────────────────────────

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Bust cache so we always get fresh data on page load
  bustConfigCache()

  const modules = await Promise.all(
    MODULES.map(async (mod) => {
      const vars = await Promise.all(
        mod.vars.map(async (v) => {
          const value = await getConfig(v.key)
          return {
            key: v.key,
            label: v.label,
            hint: v.hint,
            configured: !!value,
            // Send a masked preview for configured values (never send full secrets)
            maskedValue: value ? maskValue(v.key, value) : '',
            source: value
              ? (process.env[v.key] ? 'env' : 'database')
              : 'none',
          }
        })
      )

      return {
        ...mod,
        vars,
        status: vars.every((v) => v.configured)
          ? 'ready'
          : vars.some((v) => v.configured)
            ? 'partial'
            : 'missing',
      }
    })
  )

  return NextResponse.json({ modules })
}

// ── POST — save config values ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { updates } = body as { updates: { key: string; value: string }[] }

  if (!updates || !Array.isArray(updates)) {
    return NextResponse.json({ error: 'Invalid payload — expected { updates: [{key, value}] }' }, { status: 400 })
  }

  const results: { key: string; ok: boolean; error?: string }[] = []

  for (const { key, value } of updates) {
    // Block immutable keys
    if (IMMUTABLE_KEYS.has(key)) {
      results.push({ key, ok: false, error: 'This key must be set via Vercel env vars (required at boot)' })
      continue
    }

    try {
      if (value === '' || value === null || value === undefined) {
        // Empty value = delete from DB, revert to env fallback
        await deleteConfig(key)
      } else {
        await setConfig(key, value, userId)
      }
      results.push({ key, ok: true })
    } catch (err) {
      results.push({ key, ok: false, error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  return NextResponse.json({ results })
}

// ── Helpers ───────────────────────────────────────────────────────────────

function maskValue(key: string, value: string): string {
  // Show just enough to confirm the right value is set
  if (key.includes('URL') || key.includes('HOST') || key.includes('URI') || key === 'OPS_CALENDAR_ID' || key === 'NEXT_PUBLIC_APP_URL') {
    // URLs are safe to show more of
    if (value.length <= 30) return value
    return value.slice(0, 25) + '...'
  }
  // For secrets/keys: show first 4 and last 4 chars
  if (value.length <= 12) return '••••••••'
  return value.slice(0, 4) + '••••••••' + value.slice(-4)
}
