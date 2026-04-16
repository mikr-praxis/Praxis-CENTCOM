import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'

const DEFAULT_CONFIG: Array<{ key: string; value: string }> = [
  // Auth & Permissions
  { key: 'AUTHORIZED_DOMAIN', value: 'builtbypraxis.com' },
  { key: 'AUTHORIZED_EXTERNAL_EMAILS', value: 'michael.nield7@gmail.com' },
  { key: 'SUPPORT_EMAIL', value: 'mscott@builtbypraxis.com' },

  // Slack
  { key: 'SLACK_WRITE_CHANNEL_ID', value: 'C0APYEU7N1M' },
  { key: 'SLACK_WRITE_CHANNEL_NAME', value: 'backend-progress-updates-by-task' },

  // AI Models
  { key: 'DEFAULT_AGENT_MODEL', value: 'claude-sonnet-4-5-20241022' },
  { key: 'DEFAULT_AGENT_MAX_TOKENS', value: '1024' },
  { key: 'METRIC_MAPPER_MODEL', value: 'claude-opus-4-6' },
  { key: 'METRIC_MAPPER_MAX_TOKENS', value: '4000' },

  // Rate Limits
  { key: 'AGENT_RATE_LIMIT_COUNT', value: '10' },
  { key: 'AGENT_RATE_LIMIT_WINDOW_SECONDS', value: '3600' },

  // Client defaults
  { key: 'DEFAULT_CLIENT_LIST', value: 'Breathe for Change, ManTalks, John Wineland, Soma Plus IQ, Krista Mishore' },

  // Calendar
  { key: 'OPS_CALENDAR_ID', value: 'ops@builtbypraxis.com' },
]

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient()

  const rows = DEFAULT_CONFIG.map(({ key, value }) => ({
    key,
    value,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('app_config')
    .upsert(rows, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ seeded: rows.length, keys: rows.map(r => r.key) })
}
