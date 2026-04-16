import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { HardcodedValuesClient } from './hardcoded-client'
import { getMemorySeedRows } from '@/lib/memory/loader'

export const dynamic = 'force-dynamic'

// Config keys that should exist — auto-seed if missing
const EXPECTED_KEYS = [
  'AUTHORIZED_DOMAIN', 'AUTHORIZED_EXTERNAL_EMAILS', 'SUPPORT_EMAIL',
  'SLACK_WRITE_CHANNEL_ID', 'SLACK_WRITE_CHANNEL_NAME',
  'DEFAULT_AGENT_MODEL', 'DEFAULT_AGENT_MAX_TOKENS',
  'METRIC_MAPPER_MODEL', 'METRIC_MAPPER_MAX_TOKENS',
  'AGENT_RATE_LIMIT_COUNT', 'AGENT_RATE_LIMIT_WINDOW_SECONDS',
  'DEFAULT_CLIENT_LIST', 'OPS_CALENDAR_ID',
]

const DEFAULT_VALUES: Record<string, string> = {
  AUTHORIZED_DOMAIN: 'builtbypraxis.com',
  AUTHORIZED_EXTERNAL_EMAILS: 'michael.nield7@gmail.com',
  SUPPORT_EMAIL: 'mscott@builtbypraxis.com',
  SLACK_WRITE_CHANNEL_ID: 'C0APYEU7N1M',
  SLACK_WRITE_CHANNEL_NAME: 'backend-progress-updates-by-task',
  DEFAULT_AGENT_MODEL: 'claude-sonnet-4-5-20241022',
  DEFAULT_AGENT_MAX_TOKENS: '1024',
  METRIC_MAPPER_MODEL: 'claude-opus-4-6',
  METRIC_MAPPER_MAX_TOKENS: '4000',
  AGENT_RATE_LIMIT_COUNT: '10',
  AGENT_RATE_LIMIT_WINDOW_SECONDS: '3600',
  DEFAULT_CLIENT_LIST: 'Breathe for Change, ManTalks, John Wineland, Soma Plus IQ, Krista Mishore',
  OPS_CALENDAR_ID: 'ops@builtbypraxis.com',
}

export default async function HardcodedValuesPage() {
  const { userId } = await auth()
  if (!userId) return null

  const supabase = createServerClient()
  let { data } = await supabase.from('app_config').select('key, value, updated_at')

  // Auto-seed missing config keys on first load
  const existingKeys = new Set((data || []).map(r => r.key))
  const missingKeys = EXPECTED_KEYS.filter(k => !existingKeys.has(k))

  if (missingKeys.length > 0) {
    const seedRows = missingKeys.map(key => ({
      key,
      value: DEFAULT_VALUES[key] || '',
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }))

    // Also seed memory entries if none exist
    const hasMemory = (data || []).some(r => r.key.startsWith('MEMORY_'))
    if (!hasMemory) {
      seedRows.push(...getMemorySeedRows(userId))
    }

    await supabase.from('app_config').upsert(seedRows, { onConflict: 'key' })

    // Re-read after seeding
    const refreshed = await supabase.from('app_config').select('key, value, updated_at')
    data = refreshed.data
  }

  const configMap: Record<string, { value: string; updated_at: string | null }> = {}
  for (const row of data || []) {
    configMap[row.key] = { value: row.value, updated_at: row.updated_at }
  }

  return <HardcodedValuesClient initialConfig={configMap} />
}
