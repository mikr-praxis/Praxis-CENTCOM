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

  // Route permissions
  { key: 'ROUTE_PERMISSIONS_JSON', value: JSON.stringify([
    { href: '/dashboard', roles: ['exec', 'am', 'cs'] },
    { href: '/projects',  roles: ['exec', 'am'] },
    { href: '/tasks',     roles: ['exec', 'am', 'cs'] },
    { href: '/monday',    roles: ['exec', 'am'] },
    { href: '/calendar',  roles: ['exec', 'am', 'cs'] },
    { href: '/events',    roles: ['exec', 'am', 'cs'] },
    { href: '/budget',    roles: ['exec'] },
    { href: '/agents',    roles: ['exec'] },
    { href: '/memory',    roles: ['exec'] },
    { href: '/clients',   roles: ['exec'] },
    { href: '/hardcoded', roles: ['exec'] },
    { href: '/config',    roles: ['exec'] },
  ]) },

  // Team members
  { key: 'TEAM_MEMBERS_JSON', value: JSON.stringify([
    { id: 'nadeem', name: 'Nadeem', calendarEmail: 'nadeem@builtbypraxis.com', role: 'Co-Founder', group: 'exec', avatar: '🟠' },
    { id: 'derek', name: 'Derek', calendarEmail: 'derek@builtbypraxis.com', role: 'Co-Founder', group: 'exec', avatar: '🔵' },
    { id: 'kevin', name: 'Kevin', calendarEmail: 'kevin@builtbypraxis.com', role: 'Co-Founder', group: 'exec', avatar: '🟢' },
    { id: 'mike', name: 'Mike', calendarEmail: 'mscott@builtbypraxis.com', role: 'Data & Ops', group: 'data-analyst', avatar: '🟣' },
  ]) },

  // Groups
  { key: 'GROUPS_JSON', value: JSON.stringify([
    { id: 'exec', name: 'Exec', description: 'Executive leadership', color: 'amber', members: ['nadeem', 'derek', 'kevin'] },
    { id: 'account-manager', name: 'Account Manager', description: 'Client relationship management', color: 'blue', members: ['derek'] },
    { id: 'marketing-manager', name: 'Marketing Manager', description: 'Paid media & funnel strategy', color: 'green', members: ['kevin'] },
    { id: 'data-analyst', name: 'Data Analyst', description: 'Data, ops & automation', color: 'purple', members: ['mike'] },
    { id: 'event-coordinator', name: 'Event Coordinator', description: 'Event planning & execution', color: 'rose', members: ['nadeem', 'derek'] },
  ]) },

  // Tag categories
  { key: 'TAG_CATEGORIES_JSON', value: JSON.stringify([
    { id: 'client', name: 'Client Tags', color: 'cyan', tags: [
      { id: 'breathe-for-change', label: 'Breathe for Change' },
      { id: 'mantalks', label: 'ManTalks' },
      { id: 'john-wineland', label: 'John Wineland' },
      { id: 'soma-plus-iq', label: 'Soma Plus IQ' },
      { id: 'krista-mishore', label: 'Krista Mishore' },
    ]},
    { id: 'state', name: 'State Tags', color: 'emerald', tags: [
      { id: 'active', label: 'Active' }, { id: 'onboarding', label: 'Onboarding' },
      { id: 'paused', label: 'Paused' }, { id: 'completed', label: 'Completed' },
    ]},
    { id: 'event', name: 'Event Tags', color: 'violet', tags: [
      { id: 'virtual', label: 'Virtual' }, { id: 'in-person', label: 'In-Person' },
      { id: 'workshop', label: 'Workshop' }, { id: 'masterclass', label: 'Masterclass' },
    ]},
    { id: 'importance', name: 'Importance Tags', color: 'rose', tags: [
      { id: 'critical', label: 'Critical' }, { id: 'high', label: 'High' },
      { id: 'medium', label: 'Medium' }, { id: 'low', label: 'Low' },
    ]},
  ]) },

  // Benchmarks
  { key: 'BENCHMARKS_CALL_JSON', value: JSON.stringify({ show_rate: { weak: 0.5, strong: 0.7 }, close_rate: { weak: 0.2, strong: 0.35 }, lead_to_book_rate: { weak: 0.05, strong: 0.15 } }) },
  { key: 'BENCHMARKS_WEBINAR_JSON', value: JSON.stringify({ attendance_rate: { weak: 0.2, strong: 0.4 }, offer_click_rate: { weak: 0.05, strong: 0.15 }, revenue_per_registrant: { weak: 10, strong: 50 }, roas: { weak: 1.5, strong: 3 } }) },
  { key: 'BENCHMARKS_CHALLENGE_JSON', value: JSON.stringify({ day1_attendance_rate: { weak: 0.2, strong: 0.35 }, day3_attendance_rate: { weak: 0.1, strong: 0.2 }, retention_day1_to_day3: { weak: 0.4, strong: 0.65 }, offer_click_rate: { weak: 0.1, strong: 0.25 }, revenue_per_registrant: { weak: 20, strong: 100 } }) },
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
