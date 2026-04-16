import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  getAllTasksWithSubitems,
  getBoards,
  getUsers,
  type MondayTask,
} from '@/lib/monday/client'
import { hasConfig } from '@/lib/config'

// ââ Types ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export type TaskTier = 'critical' | 'followup' | 'building'

export type DetailedTask = {
  id: string
  name: string
  status: string | null
  dueDate: string | null
  priority: string | null
  tier: TaskTier
  tierReason: string
  assignees: { id: string; name: string }[]
  groupName: string
  hasSubitems: boolean
  subitems: { id: string; name: string; status: string | null }[]
}

export type OwnershipData = {
  id: string
  name: string
  avatar: string | null
  taskCount: number
  critical: number
  followup: number
  building: number
}

export type BoardDetail = {
  boardId: string
  boardName: string
  tasks: DetailedTask[]
  ownership: OwnershipData[]
  totalTasks: number
  counts: { critical: number; followup: number; building: number }
}

// ââ Classification âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

// ââ Priority scoring for sort order ââââââââââââââââââââââââââââââââââââââââ

function taskSortScore(task: DetailedTask): number {
  let score = 0

  // Tier weight (critical first)
  if (task.tier === 'critical') score += 10000
  else if (task.tier === 'followup') score += 5000

  // Priority weight
  const p = (task.priority || '').toLowerCase()
  if (p.includes('critical')) score += 1000
  else if (p.includes('urgent') || p.includes('high')) score += 800
  else if (p.includes('medium')) score += 400

  // Overdue boost (more overdue = higher)
  if (task.dueDate) {
    const due = new Date(task.dueDate + 'T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const daysUntil = Math.ceil((due.getTime() - today.getTime()) / 86400000)
    if (daysUntil < 0) score += Math.min(Math.abs(daysUntil) * 10, 500)
    else if (daysUntil <= 3) score += 200
    else if (daysUntil <= 7) score += 100
  }

  // Blocked/stuck boost
  const s = (task.status || '').toLowerCase()
  if (s.includes('stuck') || s.includes('blocked')) score += 300

  // Unassigned penalty (needs attention)
  if (task.assignees.length === 0) score += 150

  return score
}

// ââ GET /api/projects/board-detail?boardId=xxx âââââââââââââââââââââââââââââ

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const boardId = request.nextUrl.searchParams.get('boardId')

  const connected = await hasConfig('MONDAY_API_KEY')
  if (!connected) {
    return NextResponse.json({ error: 'Monday.com not connected' }, { status: 400 })
  }

  try {
    // If no boardId, return list of boards for the dropdown
    if (!boardId) {
      const boards = await getBoards()
      return NextResponse.json({
        boards: boards.map((b) => ({ id: b.id, name: b.name })),
      })
    }

    // Fetch tasks for this board and users in parallel
    const [allTasks, users] = await Promise.all([
      getAllTasksWithSubitems([boardId]),
      getUsers(),
    ])

    // Build user lookup
    const userMap = new Map<string, { name: string; avatar: string | null }>()
    for (const u of users) {
      userMap.set(u.id, { name: u.name, avatar: u.photo_thumb_small })
      userMap.set(u.name.toLowerCase(), { name: u.name, avatar: u.photo_thumb_small })
    }

    // Filter active tasks (already MondayTask type from getAllTasksWithSubitems)
    const activeTasks = allTasks.filter(
      (t) => !t.status?.toLowerCase().includes('done') && !t.status?.toLowerCase().includes('complete')
    )

    // Classify and transform
    const detailedTasks: DetailedTask[] = activeTasks.map((task) => {
      const { tier, reason } = classifyTask(task)
      return {
        id: task.id,
        name: task.name,
        status: task.status,
        dueDate: task.dueDate,
        priority: task.priority,
        tier,
        tierReason: reason,
        assignees: task.assignees.map((a: { id: string; name: string }) => ({ id: a.id, name: a.name })),
        groupName: task.groupName,
        hasSubitems: (task.subitems?.length || 0) > 0,
        subitems: (task.subitems || []).map((s: { id: string; name: string; status: string | null }) => ({
          id: s.id,
          name: s.name,
          status: s.status,
        })),
      }
    })

    // Sort by priority score (highest first)
    detailedTasks.sort((a, b) => taskSortScore(b) - taskSortScore(a))

    // Build ownership data
    const ownerMap = new Map<string, OwnershipData>()
    for (const task of detailedTasks) {
      for (const assignee of task.assignees) {
        if (!ownerMap.has(assignee.id)) {
          const userInfo = userMap.get(assignee.id)
          ownerMap.set(assignee.id, {
            id: assignee.id,
            name: assignee.name,
            avatar: userInfo?.avatar || null,
            taskCount: 0,
            critical: 0,
            followup: 0,
            building: 0,
          })
        }
        const owner = ownerMap.get(assignee.id)!
        owner.taskCount++
        owner[task.tier]++
      }
    }

    // Add unassigned bucket
    const unassignedCount = detailedTasks.filter((t) => t.assignees.length === 0).length
    if (unassignedCount > 0) {
      const unassignedTasks = detailedTasks.filter((t) => t.assignees.length === 0)
      ownerMap.set('unassigned', {
        id: 'unassigned',
        name: 'Unassigned',
        avatar: null,
        taskCount: unassignedCount,
        critical: unassignedTasks.filter((t) => t.tier === 'critical').length,
        followup: unassignedTasks.filter((t) => t.tier === 'followup').length,
        building: unassignedTasks.filter((t) => t.tier === 'building').length,
      })
    }

    const ownership = Array.from(ownerMap.values()).sort((a, b) => b.taskCount - a.taskCount)

    const boardName = allTasks[0]?.boardName || 'Unknown Board'

    return NextResponse.json({
      boardId,
      boardName,
      tasks: detailedTasks,
      ownership,
      totalTasks: detailedTasks.length,
      counts: {
        critical: detailedTasks.filter((t) => t.tier === 'critical').length,
        followup: detailedTasks.filter((t) => t.tier === 'followup').length,
        building: detailedTasks.filter((t) => t.tier === 'building').length,
      },
    } satisfies BoardDetail)
  } catch (err) {
    console.error('Board detail error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Failed to fetch board detail',
    }, { status: 500 })
  }
}
