import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  getAllTasksWithSubitems,
  getUsers,
  type MondayTask,
  type MondayUser,
} from '@/lib/monday/client'
import { hasConfig } from '@/lib/config'
import { createServerClient } from '@/lib/supabase/server'

// ââ Types ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export type TaskTier = 'critical' | 'followup' | 'building'

export type BoardTaskSummary = {
  id: string
  name: string
  status: string | null
  dueDate: string | null
  priority: string | null
  tier: TaskTier
  tierReason: string
}

export type AssigneeSummary = {
  id: string
  name: string
  avatar: string | null
  tasks: BoardTaskSummary[]
  counts: { critical: number; followup: number; building: number; total: number }
}

export type ProjectBoardData = {
  boardId: string
  boardName: string
  // Merged Supabase project data (if matched)
  projectId: string | null
  stage: string | null
  priority: string | null
  slackTag: string | null
  owner: string | null
  deadline: string | null
  description: string | null
  // Monday data
  assignees: AssigneeSummary[]
  unassigned: BoardTaskSummary[]
  counts: { critical: number; followup: number; building: number; total: number }
}

// ââ Classification (reused from tasks-aggregated) ââââââââââââââââââââââââââ

function classifyTask(task: MondayTask): { tier: TaskTier; reason: string } {
  const status = (task.status || '').toLowerCase()
  const priority = (task.priority || '').toLowerCase()
  const group = (task.groupName || '').toLowerCase()

  if (priority.includes('critical') || priority.includes('urgent')) {
    return { tier: 'critical', reason: `Priority: ${task.priority}` }
  }
  if (status.includes('stuck') || status.includes('blocked')) {
    return { tier: 'critical', reason: `Status: ${task.status}` }
  }
  if (task.dueDate) {
    const due = new Date(task.dueDate + 'T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (due < today) {
      // Check if task is done â if so, it's not critical
      if (status.includes('done') || status.includes('complete')) {
        return { tier: 'building', reason: 'Completed (late)' }
      }
      const daysOverdue = Math.ceil((today.getTime() - due.getTime()) / 86400000)
      return { tier: 'critical', reason: `${daysOverdue}d overdue` }
    }
  }
  if (group.includes('critical') || group.includes('urgent') || group.includes('escalat')) {
    return { tier: 'critical', reason: `Group: ${task.groupName}` }
  }

  if (status.includes('waiting') || status.includes('pending')) {
    return { tier: 'followup', reason: `Status: ${task.status}` }
  }
  if (status.includes('review')) {
    return { tier: 'followup', reason: `Status: ${task.status}` }
  }
  if (group.includes('follow') || group.includes('waiting') || group.includes('review')) {
    return { tier: 'followup', reason: `Group: ${task.groupName}` }
  }

  return { tier: 'building', reason: 'Active work' }
}

// ââ GET /api/projects/board-data âââââââââââââââââââââââââââââââââââââââââââ

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const connected = await hasConfig('MONDAY_API_KEY')
  if (!connected) {
    return NextResponse.json({ boards: [], connected: false })
  }

  try {
    const supabase = createServerClient()

    // Fetch everything in parallel
    const [mondayTasks, mondayUsers, projectsRes] = await Promise.all([
      getAllTasksWithSubitems(),
      getUsers(),
      supabase.from('projects').select('*').eq('user_id', userId),
    ])

    const projects = projectsRes.data || []

    // Build user avatar lookup
    const userAvatars = new Map<string, string | null>()
    for (const u of mondayUsers) {
      userAvatars.set(u.id, u.photo_thumb_small)
      userAvatars.set(u.name.toLowerCase(), u.photo_thumb_small)
    }

    // Filter out done/completed tasks
    const activeTasks = mondayTasks.filter(
      (t) => !t.status?.toLowerCase().includes('done') && !t.status?.toLowerCase().includes('complete')
    )

    // Group tasks by board
    const boardMap = new Map<string, MondayTask[]>()
    for (const task of activeTasks) {
      const key = task.boardId
      if (!boardMap.has(key)) boardMap.set(key, [])
      boardMap.get(key)!.push(task)
    }

    // Match boards to Supabase projects
    function matchProject(boardName: string) {
      // Try exact name match
      const exact = projects.find(
        (p) => p.name.toLowerCase() === boardName.toLowerCase()
      )
      if (exact) return exact

      // Try client_tag or slack_tag in board name
      for (const proj of projects) {
        if (proj.client_tag && boardName.toLowerCase().includes(proj.client_tag.toLowerCase())) {
          return proj
        }
        if (proj.slack_tag && boardName.toLowerCase().includes(
          proj.slack_tag.replace(/[\[\]]/g, '').toLowerCase()
        )) {
          return proj
        }
      }

      // Try word overlap (at least one word >3 chars matches)
      for (const proj of projects) {
        const projWords = proj.name.toLowerCase().split(/\s+/)
        const boardWords = boardName.toLowerCase().split(/\s+/)
        const overlap = projWords.filter(
          (w: string) => w.length > 3 && boardWords.some((bw: string) => bw.includes(w) || w.includes(bw))
        )
        if (overlap.length > 0) return proj
      }

      return null
    }

    // Build board data
    const boards: ProjectBoardData[] = []

    for (const [boardId, tasks] of boardMap) {
      const boardName = tasks[0]?.boardName || 'Unknown Board'
      const project = matchProject(boardName)

      // Classify all tasks
      const classified = tasks.map((task) => {
        const { tier, reason } = classifyTask(task)
        return {
          ...task,
          tier,
          tierReason: reason,
        }
      })

      // Group by assignee
      const assigneeMap = new Map<string, {
        id: string
        name: string
        avatar: string | null
        tasks: typeof classified
      }>()

      const unassignedTasks: typeof classified = []

      for (const task of classified) {
        if (task.assignees.length === 0) {
          unassignedTasks.push(task)
        } else {
          for (const assignee of task.assignees) {
            if (!assigneeMap.has(assignee.id)) {
              assigneeMap.set(assignee.id, {
                id: assignee.id,
                name: assignee.name,
                avatar: userAvatars.get(assignee.id) || userAvatars.get(assignee.name.toLowerCase()) || null,
                tasks: [],
              })
            }
            assigneeMap.get(assignee.id)!.tasks.push(task)
          }
        }
      }

      // Build assignee summaries
      const assignees: AssigneeSummary[] = Array.from(assigneeMap.values()).map((a) => ({
        id: a.id,
        name: a.name,
        avatar: a.avatar,
        tasks: a.tasks.map((t) => ({
          id: t.id,
          name: t.name,
          status: t.status,
          dueDate: t.dueDate,
          priority: t.priority,
          tier: t.tier,
          tierReason: t.tierReason,
        })),
        counts: {
          critical: a.tasks.filter((t) => t.tier === 'critical').length,
          followup: a.tasks.filter((t) => t.tier === 'followup').length,
          building: a.tasks.filter((t) => t.tier === 'building').length,
          total: a.tasks.length,
        },
      }))

      // Sort assignees by critical count descending, then total
      assignees.sort((a, b) => {
        if (a.counts.critical !== b.counts.critical) return b.counts.critical - a.counts.critical
        return b.counts.total - a.counts.total
      })

      const totalCritical = classified.filter((t) => t.tier === 'critical').length
      const totalFollowup = classified.filter((t) => t.tier === 'followup').length
      const totalBuilding = classified.filter((t) => t.tier === 'building').length

      boards.push({
        boardId,
        boardName,
        projectId: project?.id || null,
        stage: project?.stage || null,
        priority: project?.priority || null,
        slackTag: project?.slack_tag || null,
        owner: project?.owner_id || null,
        deadline: project?.deadline || null,
        description: project?.description || null,
        assignees,
        unassigned: unassignedTasks.map((t) => ({
          id: t.id,
          name: t.name,
          status: t.status,
          dueDate: t.dueDate,
          priority: t.priority,
          tier: t.tier,
          tierReason: t.tierReason,
        })),
        counts: {
          critical: totalCritical,
          followup: totalFollowup,
          building: totalBuilding,
          total: classified.length,
        },
      })
    }

    // Sort boards: most critical first, then by total task count
    boards.sort((a, b) => {
      if (a.counts.critical !== b.counts.critical) return b.counts.critical - a.counts.critical
      return b.counts.total - a.counts.total
    })

    return NextResponse.json({ boards, connected: true })
  } catch (err) {
    console.error('Board data error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Failed to fetch board data',
      boards: [],
      connected: true,
    }, { status: 500 })
  }
}
