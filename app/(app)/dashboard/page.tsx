import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { KPIGrid } from '@/components/dashboard/KPIGrid'
import { TrendChart } from '@/components/dashboard/TrendChart'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { StackHealth } from '@/components/dashboard/StackHealth'
import { SlackWidget } from '@/components/dashboard/SlackWidget'
import { MondayWidget } from '@/components/dashboard/MondayWidget'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { AlertCircle, BarChart3, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { getBrandingConfig } from '@/lib/branding'
import { formatDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) return null

  const supabase = createServerClient()

  const [tasksRes, budgetRes, eventsRes, agentLogsRes, workflowsRes] = await Promise.all([
    supabase.from('tasks').select('*').eq('user_id', userId),
    supabase.from('budget_items').select('*').eq('user_id', userId),
    supabase.from('events').select('*').eq('user_id', userId),
    supabase.from('agent_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    supabase.from('workflows').select('*').eq('user_id', userId),
  ])

  const branding = await getBrandingConfig()
  const dateLocale = branding.app_date_locale
  const tasks = tasksRes.data || []
  const budgetItems = budgetRes.data || []
  const events = eventsRes.data || []
  const agentLogs = agentLogsRes.data || []
  const workflows = workflowsRes.data || []

  const activeTasks = tasks.filter((t) => t.status !== 'done').length
  const totalBurn = budgetItems.reduce((sum, i) => sum + Number(i.cost), 0)

  // ── Real week-over-week trends ─────────────────────────────────────
  const now = new Date()
  const oneWeekAgo = new Date(now)
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
  const twoWeeksAgo = new Date(now)
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

  // Tasks: active tasks created this week vs last week
  const tasksThisWeek = tasks.filter((t) => t.status !== 'done' && new Date(t.created_at) >= oneWeekAgo).length
  const tasksLastWeek = tasks.filter(
    (t) => t.status !== 'done' && new Date(t.created_at) >= twoWeeksAgo && new Date(t.created_at) < oneWeekAgo
  ).length
  const tasksTrend = tasksLastWeek > 0
    ? Math.round(((tasksThisWeek - tasksLastWeek) / tasksLastWeek) * 100)
    : tasksThisWeek > 0 ? 100 : 0

  // Events this week
  const weekEnd = new Date(now)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const eventsThisWeek = events.filter((e) => {
    const d = new Date(e.event_date)
    return d >= now && d <= weekEnd
  }).length

  // ── Real 4-week trend data ─────────────────────────────────────────
  const trendData = Array.from({ length: 4 }, (_, i) => {
    const weekIdx = 3 - i // start from 4 weeks ago
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - (weekIdx + 1) * 7)
    const weekEndDate = new Date(now)
    weekEndDate.setDate(weekEndDate.getDate() - weekIdx * 7)

    const weekTasks = tasks.filter((t) => {
      const d = new Date(t.created_at)
      return d >= weekStart && d < weekEndDate
    }).length

    // Budget burn is cumulative (doesn't change week to week) — show total
    // This could be improved with a monthly breakdown if budget items had a date range
    return {
      week: `Week ${i + 1}`,
      burn: totalBurn,
      tasks: weekTasks,
    }
  })

  // ── Real activity feed from DB ─────────────────────────────────────
  type Activity = { id: string; action: string; subject: string; module: string; time: string; sortDate: Date }
  const activities: Activity[] = []

  // Recent tasks (created or completed recently)
  const recentTasks = [...tasks]
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
    .slice(0, 5)

  for (const t of recentTasks) {
    const date = new Date(t.updated_at || t.created_at)
    activities.push({
      id: `task-${t.id}`,
      action: t.status === 'done' ? 'completed' : t.status === 'inprogress' ? 'moved' : 'created',
      subject: t.title,
      module: 'Tasks',
      time: formatTimeAgo(date, dateLocale),
      sortDate: date,
    })
  }

  // Recent agent runs
  for (const log of agentLogs.slice(0, 3)) {
    const date = new Date(log.created_at)
    activities.push({
      id: `agent-${log.id}`,
      action: 'ran',
      subject: log.agent_name || log.agent_id,
      module: 'Agents',
      time: formatTimeAgo(date, dateLocale),
      sortDate: date,
    })
  }

  // Recent workflow activity
  const recentWorkflows = [...workflows]
    .filter((w) => w.last_run)
    .sort((a, b) => new Date(b.last_run!).getTime() - new Date(a.last_run!).getTime())
    .slice(0, 3)

  for (const w of recentWorkflows) {
    const date = new Date(w.last_run!)
    activities.push({
      id: `workflow-${w.id}`,
      action: 'ran',
      subject: w.name,
      module: 'Comms',
      time: formatTimeAgo(date, dateLocale),
      sortDate: date,
    })
  }

  // Sort all activities by date, take top 6
  const sortedActivities = activities
    .sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime())
    .slice(0, 6)
    .map(({ sortDate: _sortDate, ...rest }) => rest)

  // High priority tasks for Today's Focus
  const focusTasks = tasks.filter((t) => t.priority === 'high' && t.status !== 'done')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">Welcome back. Here&apos;s your ops overview.</p>
      </div>

      <KPIGrid
        burn={totalBurn}
        activeTasks={activeTasks}
        eventsThisWeek={eventsThisWeek}
        stackTools={budgetItems.length}
        tasksTrend={tasksTrend}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TrendChart data={trendData} />
        </div>
        <ActivityFeed activities={sortedActivities} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SlackWidget />
        <MondayWidget />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Focus</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {focusTasks.length === 0 && (
              <p className="text-sm text-slate-500">No high-priority tasks. Nice work!</p>
            )}
            {focusTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/50">
                <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{task.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {task.assignee || 'Unassigned'} · {task.status}
                  </p>
                </div>
                <Badge variant="red">High</Badge>
              </div>
            ))}
          </div>
        </Card>
        <StackHealth items={budgetItems} />
      </div>

      <ClientPerformanceWidget />
    </div>
  )
}

async function ClientPerformanceWidget() {
  const supabase = createServerClient()
  const { data: clients } = await supabase.from('clients').select('id, slug, name, funnel_type')

  if (!clients || clients.length === 0) return null

  // Get latest cash_collected for each client
  const clientData = await Promise.all(
    clients.map(async (c) => {
      const { data: latest } = await supabase
        .from('metric_snapshots')
        .select('metric_value, period_date')
        .eq('client_id', c.id)
        .eq('metric_key', 'cash_collected')
        .order('period_date', { ascending: false })
        .limit(1)
      return { ...c, latestCash: latest?.[0]?.metric_value ?? null, latestDate: latest?.[0]?.period_date ?? null }
    })
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-400" />
            <CardTitle>Client Performance</CardTitle>
          </div>
          <Link href="/clients" className="text-xs text-slate-400 hover:text-amber-400 flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <div className="space-y-2">
        {clientData.map((c) => (
          <Link
            key={c.id}
            href={`/dashboard/${c.slug}`}
            className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 hover:bg-slate-800/50 transition-colors"
          >
            <div>
              <p className="text-sm font-medium text-slate-200">{c.name}</p>
              <p className="text-xs text-slate-500">{c.funnel_type} funnel</p>
            </div>
            <div className="text-right">
              {c.latestCash !== null ? (
                <>
                  <p className="text-sm font-bold text-emerald-400">
                    ${(Number(c.latestCash) / 1000).toFixed(1)}k
                  </p>
                  <p className="text-[10px] text-slate-600">latest week</p>
                </>
              ) : (
                <p className="text-xs text-slate-600">No data</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </Card>
  )
}

function formatTimeAgo(date: Date, locale?: string): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return formatDate(date, { month: 'short', day: 'numeric' }, locale)
}
