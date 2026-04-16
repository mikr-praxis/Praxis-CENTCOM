'use client'

import { useState } from 'react'
import { Code2, AlertTriangle, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'

type Priority = 'critical' | 'config' | 'nice-to-have'

interface HardcodedItem {
  value: string
  file: string
  line: number
  impact: string
  fix: string
}

interface Category {
  id: string
  title: string
  priority: Priority
  description: string
  items: HardcodedItem[]
}

const CATEGORIES: Category[] = [
  {
    id: 'roles',
    title: 'Roles & Permissions',
    priority: 'critical',
    description: 'Access control, authorized emails, route permissions',
    items: [
      { value: 'michael.nield7@gmail.com', file: 'lib/roles.ts', line: 25, impact: 'External user hardcoded as exec', fix: 'Move to app_config table (AUTHORIZED_EXTERNAL_EMAILS)' },
      { value: '@builtbypraxis.com → exec', file: 'lib/roles.ts', line: 35, impact: 'Domain-based role auto-assignment', fix: 'Move to app_config (AUTHORIZED_DOMAIN) + support multiple domains' },
      { value: 'ROUTE_PERMISSIONS array', file: 'lib/roles.ts', line: 48, impact: 'All route-level access control', fix: 'Move to app_config as JSON + admin UI editor' },
    ],
  },
  {
    id: 'team',
    title: 'Team Members & Groups',
    priority: 'critical',
    description: 'Team roster, calendar IDs, groups, tags',
    items: [
      { value: 'nadeem@, derek@, kevin@, mscott@', file: 'lib/views/data.ts', line: 3, impact: 'Team member list for calendar, assignees', fix: 'Move to team_members table + admin UI' },
      { value: '5 hardcoded groups (exec, am, etc.)', file: 'lib/views/data.ts', line: 12, impact: 'Team grouping & sidebar nav', fix: 'Move to team_groups table' },
      { value: '20+ client/state/event tags', file: 'lib/views/data.ts', line: 23, impact: 'Task/project tagging system', fix: 'Move to tag_categories + tags tables' },
    ],
  },
  {
    id: 'clients',
    title: 'Client & Business Names',
    priority: 'critical',
    description: 'Client names hardcoded in agent prompts and views',
    items: [
      { value: 'Breathe for Change, ManTalks, John Wineland, Soma Plus IQ, Krista Mishore', file: 'lib/views/data.ts', line: 29, impact: 'Client tag catalog', fix: 'Load from clients table dynamically' },
      { value: 'Same 5 clients as fallback', file: 'actions/agents.ts', line: 95, impact: 'Agent context for breathwork/wellness intel', fix: 'Load from projects table dynamically' },
    ],
  },
  {
    id: 'slack',
    title: 'Slack References',
    priority: 'critical',
    description: 'Channel IDs and names baked into code',
    items: [
      { value: 'C0APYEU7N1M', file: 'lib/slack.ts', line: 5, impact: 'Default Slack write channel ID', fix: 'Move to app_config (SLACK_WRITE_CHANNEL_ID)' },
      { value: 'backend-progress-updates-by-task', file: 'lib/slack.ts', line: 6, impact: 'Default Slack channel name', fix: 'Move to app_config (SLACK_WRITE_CHANNEL_NAME)' },
    ],
  },
  {
    id: 'ai-models',
    title: 'AI Model Names',
    priority: 'config',
    description: 'Anthropic model IDs used for agents and metric mapping',
    items: [
      { value: 'claude-sonnet-4-5-20241022', file: 'actions/agents.ts', line: 153, impact: 'Model for all 9 agents', fix: 'Move to app_config (DEFAULT_AGENT_MODEL)' },
      { value: 'claude-opus-4-6', file: 'lib/ingest/metric-mapper.ts', line: 103, impact: 'Model for metric column mapping', fix: 'Move to app_config (METRIC_MAPPER_MODEL)' },
      { value: 'max_tokens: 1024', file: 'actions/agents.ts', line: 154, impact: 'Agent response length cap', fix: 'Move to app_config (DEFAULT_AGENT_MAX_TOKENS)' },
      { value: 'max_tokens: 4000', file: 'lib/ingest/metric-mapper.ts', line: 104, impact: 'Mapper response length cap', fix: 'Move to app_config (METRIC_MAPPER_MAX_TOKENS)' },
    ],
  },
  {
    id: 'rate-limits',
    title: 'Rate Limits & Cache TTLs',
    priority: 'config',
    description: 'Throttling, caching, and retry configuration',
    items: [
      { value: '10 runs/hour per user', file: 'actions/agents.ts', line: 19, impact: 'Agent execution rate limit', fix: 'Move to app_config (AGENT_RATE_LIMIT_COUNT)' },
      { value: '3600s rate limit window', file: 'actions/agents.ts', line: 13, impact: 'Rate limit reset period', fix: 'Move to app_config (AGENT_RATE_LIMIT_WINDOW_SECONDS)' },
      { value: '30s config cache TTL', file: 'lib/config.ts', line: 11, impact: 'How long config values are cached in memory', fix: 'Move to env var (CONFIG_CACHE_TTL_MS)' },
      { value: 'maxRetries: 3, baseDelay: 500ms', file: 'lib/monday/client.ts', line: 17, impact: 'Monday.com API retry policy', fix: 'Move to app_config (MONDAY_MAX_RETRIES, MONDAY_BASE_DELAY_MS)' },
      { value: '30s/120s/300s cache tiers', file: 'lib/monday/client.ts', line: 56, impact: 'Monday.com data cache windows', fix: 'Move to app_config (MONDAY_CACHE_*_MS)' },
    ],
  },
  {
    id: 'benchmarks',
    title: 'Metric Benchmarks',
    priority: 'config',
    description: 'Performance thresholds for KPI card color-coding',
    items: [
      { value: 'show_rate: 50%/70%', file: 'lib/metrics/call-funnel.ts', line: 143, impact: 'Call funnel show rate green/yellow/red thresholds', fix: 'Move to benchmark_templates table per funnel type' },
      { value: 'close_rate: 20%/35%', file: 'lib/metrics/call-funnel.ts', line: 144, impact: 'Call funnel close rate thresholds', fix: 'Move to benchmark_templates table' },
      { value: 'attendance_rate: 20%/40%', file: 'lib/metrics/webinar-funnel.ts', line: 30, impact: 'Webinar attendance thresholds', fix: 'Move to benchmark_templates table' },
      { value: 'ROAS: 1.5x/3x', file: 'lib/metrics/webinar-funnel.ts', line: 33, impact: 'Webinar ROAS thresholds', fix: 'Move to benchmark_templates table' },
      { value: 'day3_attendance: 10%/20%', file: 'lib/metrics/challenge-funnel.ts', line: 35, impact: 'Challenge pitch day attendance thresholds', fix: 'Move to benchmark_templates table' },
      { value: 'retention D1→D3: 40%/65%', file: 'lib/metrics/challenge-funnel.ts', line: 36, impact: 'Challenge retention thresholds', fix: 'Move to benchmark_templates table' },
    ],
  },
  {
    id: 'emails',
    title: 'Contact & Calendar Emails',
    priority: 'nice-to-have',
    description: 'Support contacts, calendar IDs, sharing instructions',
    items: [
      { value: 'mscott@builtbypraxis.com', file: 'app/unauthorized/page.tsx', line: 40, impact: 'Support contact on unauthorized page', fix: 'Move to app_config (SUPPORT_EMAIL)' },
      { value: 'ops@builtbypraxis.com', file: 'lib/google/calendar.ts', line: 43, impact: 'Default ops calendar ID', fix: 'Move to env var (OPS_CALENDAR_ID)' },
      { value: 'mscott@builtbypraxis.com', file: 'app/(app)/calendar/calendar-client.tsx', line: 1222, impact: 'Calendar sharing instructions', fix: 'Move to app_config (CALENDAR_ADMIN_EMAIL)' },
    ],
  },
  {
    id: 'styling',
    title: 'Styling & Color Tokens',
    priority: 'nice-to-have',
    description: 'Priority colors, stage colors, chart colors',
    items: [
      { value: 'priority: high→red, medium→amber, low→green', file: 'lib/styles/colors.ts', line: 7, impact: 'Priority badge colors', fix: 'Move to CSS variables or theme config' },
      { value: '7 stage colors (slate, purple, blue, etc.)', file: 'lib/styles/colors.ts', line: 14, impact: 'Project pipeline stage colors', fix: 'Move to design token system' },
      { value: '#6366f1 (indigo), #10b981 (emerald)', file: 'components/dashboard/client/ClientTrendChart.tsx', line: 0, impact: 'Chart line colors', fix: 'Move to theme config' },
    ],
  },
]

const priorityConfig = {
  critical: { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', dot: 'bg-red-400' },
  config: { label: 'Configuration', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20', dot: 'bg-amber-400' },
  'nice-to-have': { label: 'Nice to Have', color: 'text-slate-400', bg: 'bg-zinc-800', border: 'border-zinc-700', dot: 'bg-slate-500' },
}

export function HardcodedValuesClient() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['roles', 'team', 'clients']))
  const [filter, setFilter] = useState<Priority | 'all'>('all')

  const toggle = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpanded(next)
  }

  const filtered = filter === 'all' ? CATEGORIES : CATEGORIES.filter(c => c.priority === filter)
  const totalItems = CATEGORIES.reduce((sum, c) => sum + c.items.length, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Hardcoded Values</h1>
        <p className="text-sm text-slate-400 mt-1">
          {totalItems} values across {CATEGORIES.length} categories — roadmap for making them dynamic
        </p>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2">
        {(['all', 'critical', 'config', 'nice-to-have'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              filter === f
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-zinc-800 border-zinc-700 text-slate-400 hover:border-zinc-600'
            }`}
          >
            {f === 'all' ? `All (${totalItems})` : `${priorityConfig[f].label} (${CATEGORIES.filter(c => c.priority === f).reduce((s, c) => s + c.items.length, 0)})`}
          </button>
        ))}
      </div>

      {/* Categories */}
      <div className="space-y-3">
        {filtered.map(cat => {
          const isOpen = expanded.has(cat.id)
          const pc = priorityConfig[cat.priority]

          return (
            <div key={cat.id} className={`rounded-xl border ${pc.border} ${pc.bg} overflow-hidden`}>
              <button
                onClick={() => toggle(cat.id)}
                className="w-full flex items-center gap-3 p-4 text-left"
              >
                {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                <div className={`h-2 w-2 rounded-full ${pc.dot}`} />
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-slate-200">{cat.title}</h3>
                  <p className="text-xs text-slate-500">{cat.description}</p>
                </div>
                <span className={`text-xs ${pc.color}`}>{cat.items.length} values</span>
              </button>

              {isOpen && (
                <div className="border-t border-zinc-800/50 divide-y divide-zinc-800/30">
                  {cat.items.map((item, i) => (
                    <div key={i} className="px-4 py-3 pl-12">
                      <div className="flex items-start gap-3">
                        <Code2 className="h-4 w-4 text-slate-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono text-slate-200 break-all">{item.value}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            <span className="text-slate-400">{item.file}:{item.line}</span> — {item.impact}
                          </p>
                          <p className="text-xs text-emerald-400/70 mt-1 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> {item.fix}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">Recommended New Tables</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          {[
            'team_members — roster + calendar IDs',
            'team_groups — org structure',
            'benchmark_templates — KPI thresholds per funnel',
            'feature_flags — toggle functionality',
            'tag_categories + tags — tagging system',
            'app_config — already exists, use for most values',
          ].map(t => (
            <div key={t} className="px-2 py-1.5 rounded bg-zinc-800 text-slate-400 border border-zinc-700">
              {t}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
