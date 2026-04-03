import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { KPIGrid } from '@/components/dashboard/KPIGrid'
import { TrendChart } from '@/components/dashboard/TrendChart'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { StackHealth } from '@/components/dashboard/StackHealth'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { AlertCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) return null

  const supabase = createServerClient()

  const [tasksRes, budgetRes, eventsRes] = await Promise.all([
    supabase.from('tasks').select('*').eq('user_id', userId),
    supabase.from('budget_items').select('*').eq('user_id', userId),
    supabase.from('events').select('*').eq('user_id', userId),
  ])

  const tasks = tasksRes.data || []
  const budgetItems = budgetRes.data || []
  const events = eventsRes.data || []

  const activeTasks = tasks.filter((t) => t.status !== 'done').length
  const totalBurn = budgetItems.reduce((sum, i) => sum + Number(i.cost), 0)

  // Events this week
  const now = new Date()
  const weekEnd = new Date(now)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const eventsThisWeek = events.filter((e) => {
    const d = new Date(e.event_date)
    return d >= now && d <= weekEnd
  }).length

  // High priority tasks for Today's Focus
  const focusTasks = tasks.filter((t) => t.priority === 'high' && t.status !== 'done')

  // Mock activity feed
  const activities = [
    { id: '1', action: 'completed', subject: 'Write agent prompt templates', module: 'Tasks', time: '2 hours ago' },
    { id: '2', action: 'created', subject: 'Budget Alert Monitor', module: 'Comms', time: '4 hours ago' },
    { id: '3', action: 'moved', subject: 'Test Clerk auth flow', module: 'Tasks', time: '5 hours ago' },
    { id: '4', action: 'ran', subject: 'Weekly Report Agent', module: 'Agents', time: '1 day ago' },
  ]

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
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TrendChart />
        </div>
        <ActivityFeed activities={activities} />
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
    </div>
  )
}
