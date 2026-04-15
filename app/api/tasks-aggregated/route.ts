import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAllTasksWithSubitems, type MondayTask } from '@/lib/monday/client'
import { hasConfig } from '@/lib/config'
import { createServerClient } from '@/lib/supabase/server'

export type TaskTier = 'critical' | 'followup' | 'building'

export type AggregatedTask = MondayTask & {
  tier: TaskTier
  tierReason: string
  milestones: {
    id: string
    title: string
    description: string | null
    status: 'pending' | 'in_progress' | 'done'
    sort_order: number
    due_date: string | null
  }[]
  slackContext: {
    channelId: string | null
    channelName: string | null
    slackTag: string | null
  } | null
}

// ââ Classification logic ââââââââââââââââââââââââââââââââââââââââââââââââââ

function classifyTask(task: MondayTask): { tier: TaskTier; reason: string } {
  const status = (task.status || '').toLowerCase()
  const priority = (task.priority || '').toLowerCase()
  const group = (task.groupName || '').toLowerCase()
  const board = (task.boardName || '').toLowerCase()

  // 1. Priority column: critical/urgent
  if (priority.includes('critical') || priority.includes('urgent')) {
    return { tier: 'critical', reason: `Priority: ${task.priority}` }
  }

  // 2. Status column: stuck/blocked
  if (status.includes('stuck') || status.includes('blocked')) {
    return { tier: 'critical', reason: `Status: ${task.status}` }
  }

  // 3. Overdue tasks
  if (task.dueDate) {
    const due = new Date(task.dueDate + 'T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (due < today) {
      const daysOverdue = Math.ceil((today.getTime() - due.getTime()) / 86400000)
      return { tier: 'critical', reason: `${daysOverdue}d overdue` }
    }
  }

  // 4. Group name contains critical/urgent
  if (group.includes('critical') || group.includes('urgent') || group.includes('escalat')) {
    return { tier: 'critical', reason: `Group: ${task.groupName}` }
  }

  // 5. Board-level: boards with "critical" or "urgent" in name
  if (board.includes('critical') || board.includes('urgent')) {
    return { tier: 'critical', reason: `Board: ${task.boardName}` }
  }

  // Follow-ups: waiting, review, pending
  if (status.includes('waiting') || status.includes('pending')) {
    return { tier: 'followup', reason: `Status: ${task.status}` }
  }
  if (status.includes('review')) {
    return { tier: 'followup', reason: `Status: ${task.status}` }
  }
  if (group.includes('follow') || group.includes('waiting') || group.includes('review')) {
    return { tier: 'followup', reason: `Group: ${task.groupName}` }
  }

  // Everything else is building
  return { tier: 'building', reason: 'Active work' }
}

function sortWithinTier(tasks: AggregatedTask[], tier: TaskTier): AggregatedTask[] {
  return [...tasks].sort((a, b) => {
    if (tier === 'critical') {
      // Most overdue first, then by priority weight
      const aOverdue = a.dueDate ? Math.max(0, Date.now() - new Date(a.dueDate + 'T00:00:00').getTime()) : 0
      const bOverdue = b.dueDate ? Math.max(0, Date.now() - new Date(b.dueDate + 'T00:00:00').getTime()) : 0
      if (aOverdue !== bOverdue) return bOverdue - aOverdue
      return priorityWeight(b.priority) - priorityWeight(a.priority)
    }

    if (tier === 'followup') {
      // Soonest due first
      return (a.dueDate || '9999').localeCompare(b.dueDate || '9999')
    }

    // Building: descending by due date (furthest out first â nearest at bottom)
    return (b.dueDate || '0000').localeCompare(a.dueDate || '0000')
  })
}

function priorityWeight(p: string | null): number {
  if (!p) return 0
  const lp = p.toLowerCase()
  if (lp.includes('critical')) return 4
  if (lp.includes('urgent')) return 3
  if (lp.includes('high')) return 2
  if (lp.includes('medium')) return 1
  return 0
}

// ââ GET /api/tasks-aggregated ââââââââââââââââââââââââââââââââââââââââââââââ

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const connected = await hasConfig('MONDAY_API_KEY')
  if (!connected) {
    return NextResponse.json({ tasks: [], connected: false })
  }

  try {
    const supabase = createServerClient()

    // Fetch Monday tasks with subitems + projects (for Slack context) + milestones in parallel
    const [mondayTasks, projectsRes, milestonesRes] = await Promise.all([
      getAllTasksWithSubitems(),
      supabase.from('projects').select('name, client_tag, slack_tag, slack_channel_id'),
      supabase.from('task_milestones').select('*').order('sort_order', { ascending: true }),
    ])

    const projects = projectsRes.data || []
    const allMilestones = milestonesRes.data || []

    // Build milestone lookup by monday_task_id
    const milestoneMap = new Map<string, typeof allMilestones>()
    for (const m of allMilestones) {
      if (!milestoneMap.has(m.monday_task_id)) milestoneMap.set(m.monday_task_id, [])
      milestoneMap.get(m.monday_task_id)!.push(m)
    }

    // Build project lookup for Slack context
    // Match Monday board/task names to projects via client_tag or name similarity
    function findSlackContext(task: MondayTask): AggregatedTask['slackContext'] {
      // Try exact tag match first
      for (const proj of projects) {
        if (proj.slack_tag && task.boardName.toLowerCase().includes(proj.slack_tag.toLowerCase())) {
          return {
            channelId: proj.slack_channel_id,
            channelName: proj.name,
            slackTag: proj.slack_tag,
          }
        }
        if (proj.client_tag && task.boardName.toLowerCase().includes(proj.client_tag.toLowerCase())) {
          return {
            channelId: proj.slack_channel_id,
            channelName: proj.name,
            slackTag: proj.client_tag,
          }
        }
      }

      // Try name similarity
      for (const proj of projects) {
        const projWords = proj.name.toLowerCase().split(/\s+/)
        const boardWords = task.boardName.toLowerCase().split(/\s+/)
        const overlap = projWords.filter((w: string) => w.length > 3 && boardWords.some((bw: string) => bw.includes(w)))
        if (overlap.length > 0) {
          return {
            channelId: proj.slack_channel_id,
            channelName: proj.name,
            slackTag: proj.slack_tag || proj.client_tag,
          }
        }
      }

      return null
    }

    // Classify and enrich ALL tasks (including completed)
    const aggregated: AggregatedTask[] = mondayTasks.map((task) => {
      const isCompleted = task.status?.toLowerCase().includes('done') || task.status?.toLowerCase().includes('complete')
      const { tier, reason } = isCompleted
        ? { tier: 'building' as TaskTier, reason: `Status: ${task.status}` }
        : classifyTask(task)
      return {
        ...task,
        tier,
        tierReason: reason,
        milestones: (milestoneMap.get(task.id) || []).map((m) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          status: m.status as 'pending' | 'in_progress' | 'done',
          sort_order: m.sort_order,
          due_date: m.due_date,
        })),
        slackContext: findSlackContext(task),
      }
    })

    // Separate completed from active
    const activeTasks = aggregated.filter(
      (t) => !t.status?.toLowerCase().includes('done') && !t.status?.toLowerCase().includes('complete')
    )
    const completedTasks = aggregated.filter(
      (t) => t.status?.toLowerCase().includes('done') || t.status?.toLowerCase().includes('complete')
    )

    // Sort within tiers
    const critical = sortWithinTier(activeTasks.filter((t) => t.tier === 'critical'), 'critical')
    const followup = sortWithinTier(activeTasks.filter((t) => t.tier === 'followup'), 'followup')
    const building = sortWithinTier(activeTasks.filter((t) => t.tier === 'building'), 'building')

    return NextResponse.json({
      tasks: { critical, followup, building, completed: completedTasks },
      counts: {
        critical: critical.length,
        followup: followup.length,
        building: building.length,
        completed: completedTasks.length,
        total: activeTasks.length,
      },
      connected: true,
    })
  } catch (err) {
    console.error('Aggregated tasks error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Failed to fetch tasks',
      tasks: { critical: [], followup: [], building: [] },
      counts: { critical: 0, followup: 0, building: 0, total: 0 },
      connected: true,
    }, { status: 500 })
  }
}
