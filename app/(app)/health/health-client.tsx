'use client'

import { useMemo, useState } from 'react'
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Wand2,
  ExternalLink,
  Zap,
  Send,
} from 'lucide-react'
import type { HealthCheck, HealthReport, HealthStatus } from '@/lib/health/checks'

interface Props {
  initialReport: HealthReport
}

const STATUS_ORDER: HealthStatus[] = ['fail', 'warn', 'info', 'ok']
const STATUS_RANK: Record<HealthStatus, number> = { fail: 0, warn: 1, info: 2, ok: 3 }

const STATUS_STYLES: Record<HealthStatus, { icon: React.ReactNode; pill: string; row: string }> = {
  ok: {
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
    pill: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    row: 'border-slate-700/50 bg-slate-900',
  },
  warn: {
    icon: <AlertTriangle className="h-4 w-4 text-amber-400" />,
    pill: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    row: 'border-amber-500/20 bg-amber-500/5',
  },
  fail: {
    icon: <XCircle className="h-4 w-4 text-red-400" />,
    pill: 'bg-red-500/10 border-red-500/30 text-red-300',
    row: 'border-red-500/30 bg-red-500/5',
  },
  info: {
    icon: <Info className="h-4 w-4 text-slate-400" />,
    pill: 'bg-slate-800 border-slate-700 text-slate-400',
    row: 'border-slate-700/50 bg-slate-900',
  },
}

export function HealthClient({ initialReport }: Props) {
  const [report, setReport] = useState<HealthReport>(initialReport)
  const [refreshing, setRefreshing] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Auto-expand any category that has at least one fail or warn
    const out = new Set<string>()
    for (const c of initialReport.checks) {
      if (c.status === 'fail' || c.status === 'warn') out.add(c.category)
    }
    return out
  })
  const [filter, setFilter] = useState<HealthStatus | 'all'>('all')
  const [actionRunning, setActionRunning] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const grouped = useMemo(() => {
    const map = new Map<string, HealthCheck[]>()
    for (const c of report.checks) {
      if (filter !== 'all' && c.status !== filter) continue
      if (!map.has(c.category)) map.set(c.category, [])
      map.get(c.category)!.push(c)
    }
    // Worst-first sort within categories, but keep category alpha order
    for (const list of map.values()) {
      list.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
    }
    return [...map.entries()]
  }, [report.checks, filter])

  async function refresh() {
    setRefreshing(true)
    setActionMsg(null)
    try {
      const res = await fetch('/api/health')
      const body = await res.json()
      if (res.ok) setReport(body)
    } finally {
      setRefreshing(false)
    }
  }

  async function runAutoFix(check: HealthCheck) {
    if (!check.fix?.auto_fix) return
    setActionRunning(check.id)
    setActionMsg(null)
    try {
      const res = await fetch('/api/health/auto-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: check.fix.auto_fix }),
      })
      const body = await res.json()
      if (res.ok || body.ok) {
        setActionMsg(`✓ ${formatActionMsg(check.fix.auto_fix, body.details)}`)
        await refresh()
      } else {
        setActionMsg(`✗ ${body.error ?? 'Auto-fix failed'}`)
      }
    } catch (e) {
      setActionMsg(`✗ ${e instanceof Error ? e.message : 'Auto-fix failed'}`)
    } finally {
      setActionRunning(null)
    }
  }

  function categorySummary(checks: HealthCheck[]): { ok: number; warn: number; fail: number; info: number } {
    return checks.reduce(
      (acc, c) => {
        acc[c.status] += 1
        return acc
      },
      { ok: 0, warn: 0, fail: 0, info: 0 } as Record<HealthStatus, number>
    )
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="h-6 w-6 text-amber-400" /> Health
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Server-side checks of database, env, integrations, and per-client setup.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() =>
              runAutoFix({ id: '__manual_test_slack', category: '', name: 'Test Slack', status: 'info', message: '', fix: { auto_fix: 'test_slack' } })
            }
            disabled={actionRunning !== null}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            Test Slack
          </button>
          <button
            onClick={() =>
              runAutoFix({ id: '__manual_connect_everything', category: '', name: 'Connect everything', status: 'info', message: '', fix: { auto_fix: 'connect_everything' } })
            }
            disabled={actionRunning !== null}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-500/20 disabled:opacity-50"
          >
            <Zap className="h-4 w-4" />
            Connect everything
          </button>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Re-running…' : 'Re-run'}
          </button>
        </div>
      </div>

      {/* Summary pills + filter */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {STATUS_ORDER.map((s) => {
            const count = report.summary[s]
            return (
              <button
                key={s}
                onClick={() => setFilter((f) => (f === s ? 'all' : s))}
                className={
                  filter === s
                    ? `inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full border ${STATUS_STYLES[s].pill} ring-2 ring-offset-1 ring-offset-slate-950 ring-current/30`
                    : `inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full border ${STATUS_STYLES[s].pill}`
                }
              >
                {STATUS_STYLES[s].icon}
                <span>{count}</span>
                <span className="capitalize">{s}</span>
              </button>
            )
          })}
        </div>
        <span className="text-[10px] text-slate-500">
          Last run {new Date(report.ran_at).toLocaleTimeString()}
        </span>
      </div>

      {actionMsg && (
        <div className="mb-3 p-2 rounded-lg border border-slate-700 bg-slate-900 text-sm text-slate-300">
          {actionMsg}
        </div>
      )}

      {/* Categories */}
      <div className="space-y-3">
        {grouped.map(([category, checks]) => {
          const sum = categorySummary(checks)
          const isOpen = expanded.has(category)
          return (
            <div key={category} className="rounded-xl border border-slate-700/50 bg-slate-900 overflow-hidden">
              <button
                onClick={() => {
                  const next = new Set(expanded)
                  if (next.has(category)) next.delete(category)
                  else next.add(category)
                  setExpanded(next)
                }}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-800/40"
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                )}
                <span className="text-sm font-semibold text-white flex-1 text-left">{category}</span>
                <div className="flex items-center gap-1.5 text-[10px]">
                  {sum.fail > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full border ${STATUS_STYLES.fail.pill}`}>
                      {sum.fail} fail
                    </span>
                  )}
                  {sum.warn > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full border ${STATUS_STYLES.warn.pill}`}>
                      {sum.warn} warn
                    </span>
                  )}
                  {sum.ok > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full border ${STATUS_STYLES.ok.pill}`}>
                      {sum.ok} ok
                    </span>
                  )}
                  {sum.info > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full border ${STATUS_STYLES.info.pill}`}>
                      {sum.info} info
                    </span>
                  )}
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-slate-700/50 divide-y divide-slate-800">
                  {checks.map((c) => (
                    <div key={c.id} className={`px-4 py-3 flex items-start gap-3 ${STATUS_STYLES[c.status].row}`}>
                      <div className="flex-shrink-0 mt-0.5">{STATUS_STYLES[c.status].icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium text-slate-200 truncate">{c.name}</span>
                          <code className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 font-mono flex-shrink-0">
                            {c.id}
                          </code>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 break-words">{c.message}</p>
                        {c.fix && (c.fix.description || c.fix.doc_link || c.fix.auto_fix) && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {c.fix.description && (
                              <p className="text-[11px] text-slate-500">{c.fix.description}</p>
                            )}
                            {c.fix.doc_link && (
                              <a
                                href={c.fix.doc_link}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-0.5 text-[11px] text-amber-400 hover:text-amber-300"
                              >
                                Open <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            {c.fix.auto_fix && (
                              <button
                                onClick={() => runAutoFix(c)}
                                disabled={actionRunning === c.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                              >
                                <Wand2 className="h-3 w-3" />
                                {actionRunning === c.id ? 'Running…' : 'Auto-fix'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatActionMsg(action: string, details: unknown): string {
  if (!details || typeof details !== 'object') return `Ran ${action}`
  const d = details as Record<string, unknown>
  switch (action) {
    case 'discover_drive_folders':
      return `Auto-discovered ${d.matched ?? 0} of ${d.total_unconnected ?? 0} unconnected client folders`
    case 'sync_all_clients': {
      const results = (d.results ?? []) as { result?: { files_synced?: number; files_seen?: number } }[]
      const totalSynced = results.reduce((a, r) => a + (r.result?.files_synced ?? 0), 0)
      const totalSeen = results.reduce((a, r) => a + (r.result?.files_seen ?? 0), 0)
      return `Synced ${totalSynced} of ${totalSeen} files across ${results.length} client${results.length === 1 ? '' : 's'}`
    }
    case 'test_slack':
      return d.posted ? `Posted test message to ${d.channel}` : `Slack test failed: ${d.error ?? 'unknown'}`
    case 'connect_everything':
      return `Ran all auto-fixes — see Re-run results for current state`
    default:
      return `Ran ${action}`
  }
}
