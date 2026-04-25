'use client'

import { useState } from 'react'
import { Code2, Check, ChevronDown, ChevronRight, Pencil, Save, X, Loader2, RefreshCw } from 'lucide-react'

type Priority = 'critical' | 'config' | 'nice-to-have'

interface ConfigItem {
  configKey: string
  label: string
  description: string
  isJson?: boolean
}

interface ConfigCategory {
  id: string
  title: string
  priority: Priority
  description: string
  items: ConfigItem[]
}

const CATEGORIES: ConfigCategory[] = [
  {
    id: 'auth',
    title: 'Auth & Permissions',
    priority: 'critical',
    description: 'Domain authorization, external emails, route access control',
    items: [
      { configKey: 'AUTHORIZED_DOMAIN', label: 'Authorized Domain', description: 'Email domain that auto-grants exec access' },
      { configKey: 'AUTHORIZED_EXTERNAL_EMAILS', label: 'External Emails', description: 'Comma-separated emails outside the domain that get exec access' },
      { configKey: 'ROUTE_PERMISSIONS_JSON', label: 'Route Permissions', description: 'JSON array of {href, roles[]} controlling page access', isJson: true },
      { configKey: 'SUPPORT_EMAIL', label: 'Support Email', description: 'Shown on /unauthorized page as contact' },
    ],
  },
  {
    id: 'team',
    title: 'Team & Organization',
    priority: 'critical',
    description: 'Team members, groups, tags — used across calendar, tasks, views',
    items: [
      { configKey: 'TEAM_MEMBERS_JSON', label: 'Team Members', description: 'JSON array of {id, name, calendarEmail, role, group, avatar}', isJson: true },
      { configKey: 'GROUPS_JSON', label: 'Groups', description: 'JSON array of {id, name, description, color, members[]}', isJson: true },
      { configKey: 'TAG_CATEGORIES_JSON', label: 'Tag Categories', description: 'JSON array of {id, name, color, tags[{id,label}]}', isJson: true },
      { configKey: 'DEFAULT_CLIENT_LIST', label: 'Default Client List', description: 'Comma-separated client names used as fallback in agent prompts' },
    ],
  },
  {
    id: 'slack',
    title: 'Slack',
    priority: 'critical',
    description: 'Channel for automated messages',
    items: [
      { configKey: 'SLACK_WRITE_CHANNEL_ID', label: 'Write Channel ID', description: 'Slack channel ID for CentCom automated posts' },
      { configKey: 'SLACK_WRITE_CHANNEL_NAME', label: 'Write Channel Name', description: 'Display name of the write channel' },
    ],
  },
  {
    id: 'ai',
    title: 'AI Models',
    priority: 'config',
    description: 'Which Claude models to use and token limits',
    items: [
      { configKey: 'DEFAULT_AGENT_MODEL', label: 'Agent Model', description: 'Claude model ID for the 9 AI agents' },
      { configKey: 'DEFAULT_AGENT_MAX_TOKENS', label: 'Agent Max Tokens', description: 'Max response length for agents' },
      { configKey: 'METRIC_MAPPER_MODEL', label: 'Mapper Model', description: 'Claude model for metric column mapping (needs high accuracy)' },
      { configKey: 'METRIC_MAPPER_MAX_TOKENS', label: 'Mapper Max Tokens', description: 'Max response length for the metric mapper' },
    ],
  },
  {
    id: 'limits',
    title: 'Rate Limits',
    priority: 'config',
    description: 'Throttling for agent runs',
    items: [
      { configKey: 'AGENT_RATE_LIMIT_COUNT', label: 'Max Runs per Window', description: 'How many agent runs per user per window' },
      { configKey: 'AGENT_RATE_LIMIT_WINDOW_SECONDS', label: 'Window (seconds)', description: 'Rate limit reset window in seconds' },
    ],
  },
  {
    id: 'calendar',
    title: 'Calendar',
    priority: 'config',
    description: 'Calendar integration settings',
    items: [
      { configKey: 'OPS_CALENDAR_ID', label: 'Ops Calendar ID', description: 'Google Calendar ID for the ops calendar' },
    ],
  },
  {
    id: 'benchmarks',
    title: 'Metric Benchmarks',
    priority: 'config',
    description: 'Performance thresholds for KPI card color-coding (weak/strong per metric)',
    items: [
      { configKey: 'BENCHMARKS_CALL_JSON', label: 'Call Funnel Benchmarks', description: 'JSON: {metric_key: {weak, strong}}', isJson: true },
      { configKey: 'BENCHMARKS_WEBINAR_JSON', label: 'Webinar Funnel Benchmarks', description: 'JSON: {metric_key: {weak, strong}}', isJson: true },
      { configKey: 'BENCHMARKS_CHALLENGE_JSON', label: 'Challenge Funnel Benchmarks', description: 'JSON: {metric_key: {weak, strong}}', isJson: true },
    ],
  },
  {
    id: 'reporting',
    title: 'Reporting',
    priority: 'config',
    description: 'Per-client reporting tunables: Drive folder, AI model + cost, sync kill-switch',
    items: [
      { configKey: 'DRIVE_REPORTS_PARENT_FOLDER_ID', label: 'Drive Parent Folder ID', description: 'Folder ID of "Client Raw Data for AI" (the part after /folders/ in the Drive URL). Auto-discover scans this folder for client subfolders by name match.' },
      { configKey: 'REPORTING_AI_MODEL', label: 'Reporting AI Model', description: 'Claude model used by "Build with AI" / "Polish with AI". claude-opus-4-6 (~$0.20/dashboard) | claude-sonnet-4-6 (~$0.04) | claude-haiku-4-5-20251001 (~$0.012)' },
      { configKey: 'REPORTING_AI_MAX_TOKENS', label: 'Reporting AI Max Tokens', description: 'Output token budget for AI dashboard recommend / single-KPI suggest. Default 6000.' },
      { configKey: 'REPORTING_DEFAULT_KPI_COUNT', label: 'Default KPI Count', description: 'How many KPIs the AI / heuristic builders propose when you click "Recommend a dashboard" (3–10).' },
      { configKey: 'WEEKLY_SYNC_ENABLED', label: 'Weekly Sync Enabled', description: 'Kill-switch for the Sunday 03:00 UTC Drive sync cron. Set to "false" to pause without redeploying.' },
      { configKey: 'REPORTING_DEFAULT_TIMEFRAME', label: 'Default Timeframe', description: 'Initial timeframe preset on the workspace: 7d | 30d | 90d | qtd | ytd | all | data_7d | data_30d | data_90d | data_all. Default 30d.' },
      { configKey: 'REPORTING_MAX_CACHED_ROWS', label: 'Max Cached Rows / File', description: 'Cap on rows stored per synced file in Supabase. Larger files are truncated. Default 50000. Lower if hitting jsonb size limits.' },
      { configKey: 'REPORTING_TOP_VALUES_PER_COLUMN', label: 'Top Values Per Column', description: 'How many distinct values to keep per column for File Browser + heuristic suggester. Default 30.' },
      { configKey: 'REPORTING_GRANULARITY_THRESHOLDS_JSON', label: 'Chart Granularity Thresholds', description: 'JSON: {"day_max":N,"week_max":N}. Timeframes ≤day_max days bucket daily, ≤week_max weekly, else monthly. Default {"day_max":14,"week_max":120}.', isJson: true },
      { configKey: 'REPORTING_SYNC_NOTIFY_CHANNEL_ID', label: 'Sync Notify Channel ID', description: 'Slack channel ID (e.g. C0ABC1234) to post a summary after every sync (manual + weekly cron). Leave blank to disable. Requires SLACK_BOT_TOKEN.' },
      { configKey: 'SHARE_TOKEN_DEFAULT_EXPIRY_DAYS', label: 'Share Link Default Expiry (days)', description: 'New share links auto-expire after this many days unless the user picks "Never" or a custom date. Set to 0 for "no default expiry" (always permanent unless overridden). Default 30.' },
      { configKey: 'REPORTING_DEFAULT_FUNNEL_TYPE', label: 'Default Funnel Type', description: 'Pre-fills the dropdown when adding a new client: call | webinar | challenge. Default call.' },
      { configKey: 'REPORTING_DATE_PARSE_THRESHOLD', label: 'Date Detection Threshold', description: 'Minimum ratio (0–1) of parseable-date values a column needs to qualify as a date column. Lower (e.g. 0.1) accepts sparse-date columns; higher (e.g. 0.5) requires dense ones. Default 0.3.' },
      { configKey: 'REPORTING_FORECAST_DEFAULT_PERIODS', label: 'Forecast Default Periods', description: 'How many future periods to forecast on new line/bar KPIs by default. Set to 0 for no forecast. User can override per-KPI in the Advanced section. Default 0.' },
      { configKey: 'REPORTING_FORECAST_DEFAULT_METHOD', label: 'Forecast Default Method', description: 'Algorithm used when forecast periods > 0: linear (least-squares regression) or moving_avg (last 4 buckets average). Default linear.' },
    ],
  },
]

const priorityConfig = {
  critical: { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', dot: 'bg-red-400' },
  config: { label: 'Configuration', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20', dot: 'bg-amber-400' },
  'nice-to-have': { label: 'Nice to Have', color: 'text-slate-400', bg: 'bg-zinc-800', border: 'border-zinc-700', dot: 'bg-slate-500' },
}

interface Props {
  initialConfig: Record<string, { value: string; updated_at: string | null }>
}

export function HardcodedValuesClient({ initialConfig }: Props) {
  const [config, setConfig] = useState(initialConfig)
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['auth', 'team']))
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [filter, setFilter] = useState<Priority | 'all'>('all')

  const toggle = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpanded(next)
  }

  const startEdit = (key: string) => {
    const current = config[key]?.value || ''
    setEditing(key)
    setEditValue(current)
  }

  const cancelEdit = () => {
    setEditing(null)
    setEditValue('')
  }

  const saveEdit = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch('/api/config/values', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: editing, value: editValue }),
      })
      if (res.ok) {
        setConfig(prev => ({
          ...prev,
          [editing]: { value: editValue, updated_at: new Date().toISOString() },
        }))
        setEditing(null)
        setEditValue('')
      }
    } finally {
      setSaving(false)
    }
  }

  const seedDefaults = async () => {
    setSeeding(true)
    try {
      const res = await fetch('/api/seed/config', { method: 'POST' })
      if (res.ok) {
        window.location.reload()
      }
    } finally {
      setSeeding(false)
    }
  }

  const filtered = filter === 'all' ? CATEGORIES : CATEGORIES.filter(c => c.priority === filter)
  const totalItems = CATEGORIES.reduce((sum, c) => sum + c.items.length, 0)
  const configuredCount = CATEGORIES.reduce((sum, c) =>
    sum + c.items.filter(item => config[item.configKey]?.value).length, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Hardcoded Values</h1>
          <p className="text-sm text-slate-400 mt-1">
            {configuredCount}/{totalItems} configured — edit values directly, changes take effect in ~30s
          </p>
        </div>
        <button
          onClick={seedDefaults}
          disabled={seeding}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm hover:bg-amber-500/20 transition-colors disabled:opacity-50"
        >
          {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Seed Defaults
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all"
          style={{ width: `${Math.round((configuredCount / totalItems) * 100)}%` }}
        />
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'critical', 'config'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              filter === f
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-zinc-800 border-zinc-700 text-slate-400 hover:border-zinc-600'
            }`}
          >
            {f === 'all' ? 'All' : priorityConfig[f].label}
          </button>
        ))}
      </div>

      {/* Categories */}
      <div className="space-y-3">
        {filtered.map(cat => {
          const isOpen = expanded.has(cat.id)
          const pc = priorityConfig[cat.priority]
          const catConfigured = cat.items.filter(i => config[i.configKey]?.value).length

          return (
            <div key={cat.id} className={`rounded-xl border ${pc.border} overflow-hidden`}>
              <button onClick={() => toggle(cat.id)} className="w-full flex items-center gap-3 p-4 text-left bg-zinc-900/50">
                {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                <div className={`h-2 w-2 rounded-full ${catConfigured === cat.items.length ? 'bg-emerald-400' : pc.dot}`} />
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-slate-200">{cat.title}</h3>
                  <p className="text-xs text-slate-500">{cat.description}</p>
                </div>
                <span className="text-xs text-slate-500">{catConfigured}/{cat.items.length}</span>
              </button>

              {isOpen && (
                <div className="divide-y divide-zinc-800/50">
                  {cat.items.map(item => {
                    const val = config[item.configKey]
                    const hasValue = !!val?.value
                    const isEditing = editing === item.configKey

                    return (
                      <div key={item.configKey} className="px-4 py-3 bg-zinc-950/30">
                        <div className="flex items-start gap-3">
                          {hasValue ? (
                            <Check className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                          ) : (
                            <X className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-200">{item.label}</span>
                              <code className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-slate-500">{item.configKey}</code>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>

                            {isEditing ? (
                              <div className="mt-2 space-y-2">
                                {item.isJson ? (
                                  <textarea
                                    value={editValue}
                                    onChange={e => setEditValue(e.target.value)}
                                    rows={6}
                                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-600 text-slate-200 text-xs font-mono focus:outline-none focus:border-amber-500"
                                  />
                                ) : (
                                  <input
                                    type="text"
                                    value={editValue}
                                    onChange={e => setEditValue(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-600 text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                                  />
                                )}
                                <div className="flex gap-2">
                                  <button
                                    onClick={saveEdit}
                                    disabled={saving}
                                    className="flex items-center gap-1 px-3 py-1 rounded bg-emerald-600 text-white text-xs hover:bg-emerald-500 disabled:opacity-50"
                                  >
                                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                    Save
                                  </button>
                                  <button onClick={cancelEdit} className="px-3 py-1 rounded bg-zinc-700 text-slate-300 text-xs hover:bg-zinc-600">
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : hasValue ? (
                              <div className="mt-1 flex items-start gap-2">
                                <pre className="text-xs text-slate-400 bg-zinc-800/50 px-2 py-1 rounded max-h-20 overflow-auto flex-1 whitespace-pre-wrap break-all">
                                  {item.isJson ? formatJson(val.value) : val.value}
                                </pre>
                              </div>
                            ) : (
                              <p className="text-xs text-red-400/60 mt-1">Not configured — click Edit to set a value</p>
                            )}
                          </div>
                          {!isEditing && (
                            <button
                              onClick={() => startEdit(item.configKey)}
                              className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-slate-400 text-xs hover:border-amber-500/30 hover:text-amber-400 transition-colors"
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}
