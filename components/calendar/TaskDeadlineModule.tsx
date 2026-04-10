'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import {
  ListChecks,
  User,
  Calendar,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Link2,
  Clock,
} from 'lucide-react'
import type { CalendarEvent } from '@/lib/google/calendar'
import type { MondayTask } from '@/lib/monday/client'

type MondayData = {
  tasks: MondayTask[]
  users: { id: string; name: string; email: string }[]
  connected: boolean
}

type MatchedTask = MondayTask & {
  matchedEvent: CalendarEvent | null
  matchReason: string | null
}

// ââ Auto-match logic ââââââââââââââââââââââââââââââââââââââââââââââââââââ
// Matches tasks to calendar events by:
// 1. Exact or partial title match (fuzzy)
// 2. Same-day date overlap (task due date = event date)

function normalizeForMatch(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
}

function titleSimilarity(a: string, b: string): number {
  const na = normalizeForMatch(a)
  const nb = normalizeForMatch(b)

  // Exact match
  if (na === nb) return 1

  // One contains the other
  if (na.includes(nb) || nb.includes(na)) return 0.8

  // Word overlap
  const wordsA = new Set(na.split(/\s+/).filter((w) => w.length > 2))
  const wordsB = new Set(nb.split(/\s+/).filter((w) => w.length > 2))
  if (wordsA.size === 0 || wordsB.size === 0) return 0

  let overlap = 0
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++
  }

  return overlap / Math.max(wordsA.size, wordsB.size)
}

function isSameDate(dateA: string, dateB: string): boolean {
  return dateA.substring(0, 10) === dateB.substring(0, 10)
}

function matchTaskToEvent(
  task: MondayTask,
  events: CalendarEvent[]
): { event: CalendarEvent | null; reason: string | null } {
  let bestMatch: CalendarEvent | null = null
  let bestScore = 0
  let reason: string | null = null

  for (const ev of events) {
    let score = 0
    let matchReason = ''

    // Title similarity
    const titleScore = titleSimilarity(task.name, ev.title)
    if (titleScore >= 0.5) {
      score += titleScore * 2
      matchReason = 'title match'
    }

    // Date match: task due date matches event date
    if (task.dueDate && isSameDate(task.dueDate, ev.start)) {
      score += 1
      matchReason = matchReason ? `${matchReason} + same day` : 'same day'
    }

    // Timeline overlap
    if (task.timelineStart && task.timelineEnd) {
      const tStart = new Date(task.timelineStart).getTime()
      const tEnd = new Date(task.timelineEnd).getTime()
      const eStart = new Date(ev.start).getTime()
      if (eStart >= tStart && eStart <= tEnd) {
        score += 0.5
        matchReason = matchReason ? `${matchReason} + in timeline` : 'in timeline'
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestMatch = ev
      reason = matchReason
    }
  }

  // Only match if there's meaningful overlap
  if (bestScore < 0.5) return { event: null, reason: null }

  return { event: bestMatch, reason }
}

// ââ Relative date display âââââââââââââââââââââââââââââââââââââââââââââââ

function formatDeadline(dateStr: string): { label: string; urgency: 'overdue' | 'today' | 'soon' | 'later' } {
  const now = new Date()
  const date = new Date(dateStr + 'T00:00:00')
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = Math.round((date.getTime() - todayStart.getTime()) / 86400000)

  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, urgency: 'overdue' }
  if (diff === 0) return { label: 'Due today', urgency: 'today' }
  if (diff === 1) return { label: 'Due tomorrow', urgency: 'soon' }
  if (diff <= 7) return { label: `Due in ${diff} days`, urgency: 'soon' }
  return {
    label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    urgency: 'later',
  }
}

const URGENCY_STYLES = {
  overdue: 'text-red-400 bg-red-500/10',
  today: 'text-amber-400 bg-amber-500/10',
  soon: 'text-blue-400 bg-blue-500/10',
  later: 'text-slate-400 bg-slate-500/10',
}

// ââ Component âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

type Props = {
  calendarEvents: CalendarEvent[]
}

export function TaskDeadlineModule({ calendarEvents }: Props) {
  const [mondayData, setMondayData] = useState<MondayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)
  const [activeUsers, setActiveUsers] = useState<Set<string>>(new Set(['all']))
  const [showMatched, setShowMatched] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/monday')
        if (res.ok) {
          const json = await res.json()
          setMondayData(json)
        }
      } catch (err) {
        console.error('Failed to fetch Monday.com tasks:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Build matched tasks
  const matchedTasks: MatchedTask[] = useMemo(() => {
    if (!mondayData?.tasks) return []

    return mondayData.tasks
      .map((task) => {
        const { event, reason } = matchTaskToEvent(task, calendarEvents)
        return { ...task, matchedEvent: event, matchReason: reason }
      })
      .filter((t) => t.dueDate || t.timelineEnd) // only tasks with dates
      .sort((a, b) => {
        const dateA = a.dueDate || a.timelineEnd || '9999'
        const dateB = b.dueDate || b.timelineEnd || '9999'
        return dateA.localeCompare(dateB)
      })
  }, [mondayData?.tasks, calendarEvents])

  // Get unique assignees for filter
  const allAssignees = useMemo(() => {
    const map = new Map<string, string>()
    for (const task of matchedTasks) {
      for (const a of task.assignees) {
        map.set(a.id, a.name)
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [matchedTasks])

  // Filter tasks by active users
  const filteredTasks = useMemo(() => {
    if (activeUsers.has('all')) return matchedTasks

    return matchedTasks.filter((t) =>
      t.assignees.some((a) => activeUsers.has(a.id))
    )
  }, [matchedTasks, activeUsers])

  // Further filter: only matched vs all
  const displayTasks = showMatched
    ? filteredTasks.filter((t) => t.matchedEvent)
    : filteredTasks

  const toggleUser = (id: string) => {
    setActiveUsers((prev) => {
      const next = new Set(prev)
      if (id === 'all') {
        return new Set(['all'])
      }
      next.delete('all')
      if (next.has(id)) {
        next.delete(id)
        if (next.size === 0) return new Set(['all'])
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <Card className="p-0 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-amber-400" />
          <h2 className="text-sm font-semibold text-slate-200">
            Task Deadlines
          </h2>
          {!loading && mondayData?.connected && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
              Monday.com
            </span>
          )}
          {displayTasks.length > 0 && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-500/10 text-slate-400">
              {displayTasks.length} tasks
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        )}
      </button>

      {expanded && (
        <div className="px-5 py-4">
          {loading && (
            <p className="text-sm text-slate-500">Loading Monday.com tasks...</p>
          )}

          {!loading && !mondayData?.connected && (
            <div className="text-center py-6">
              <ListChecks className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Monday.com not connected</p>
              <p className="text-xs text-slate-500 mt-1">
                Add your MONDAY_API_KEY to see tasks and deadlines here.
              </p>
            </div>
          )}

          {!loading && mondayData?.connected && matchedTasks.length === 0 && (
            <p className="text-sm text-slate-500 py-4">No tasks with deadlines found.</p>
          )}

          {!loading && mondayData?.connected && matchedTasks.length > 0 && (
            <>
              {/* Filters row */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                {/* User filters */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => toggleUser('all')}
                    className={`
                      px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors
                      ${activeUsers.has('all')
                        ? 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-300'
                      }
                    `}
                  >
                    All
                  </button>
                  {allAssignees.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => toggleUser(u.id)}
                      className={`
                        px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1
                        ${activeUsers.has(u.id)
                          ? 'bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/30'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-300'
                        }
                      `}
                    >
                      <User className="h-3 w-3" />
                      {u.name.split(' ')[0]}
                    </button>
                  ))}
                </div>

                {/* Matched filter */}
                <div className="ml-auto">
                  <button
                    onClick={() => setShowMatched(!showMatched)}
                    className={`
                      px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1
                      ${showMatched
                        ? 'bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/30'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-300'
                      }
                    `}
                  >
                    <Link2 className="h-3 w-3" />
                    Linked only
                  </button>
                </div>
              </div>

              {/* Task list */}
              <div className="space-y-2">
                {displayTasks.slice(0, 20).map((task) => {
                  const deadline = task.dueDate
                    ? formatDeadline(task.dueDate)
                    : task.timelineEnd
                      ? formatDeadline(task.timelineEnd)
                      : null
                  const taskDone = task.status?.toLowerCase().includes('done') || task.status?.toLowerCase().includes('complete')
                  // Override overdue styling for completed tasks
                  const displayDeadline = deadline && taskDone && deadline.urgency === 'overdue'
                    ? { label: deadline.label.replace(/overdue/, 'late (done)'), urgency: 'later' as const }
                    : deadline

                  return (
                    <div
                      key={task.id}
                      className={`flex items-start gap-3 rounded-lg border border-slate-700/40 px-3 py-2.5 hover:border-slate-600/50 transition-colors ${taskDone ? 'opacity-60' : ''}`}
                    >
                      {/* Task info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-medium leading-tight ${taskDone ? 'text-slate-400 line-through' : 'text-slate-200'}`}>
                            {task.name}
                          </p>
                          {displayDeadline && (
                            <span
                              className={`
                                flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap
                                ${URGENCY_STYLES[displayDeadline.urgency]}
                              `}
                            >
                              {displayDeadline.label}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 flex-wrap">
                          {/* Board / Group */}
                          <span className="truncate max-w-[150px]">
                            {task.boardName}
                          </span>

                          {/* Status */}
                          {task.status && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400">
                              {task.status}
                            </span>
                          )}

                          {/* Assignees */}
                          {task.assignees.length > 0 && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {task.assignees.map((a) => a.name.split(' ')[0]).join(', ')}
                            </span>
                          )}
                        </div>

                        {/* Matched calendar event */}
                        {task.matchedEvent && (
                          <div className="mt-2 flex items-center gap-1.5 text-[10px] rounded-md px-2 py-1 bg-cyan-500/8 border border-cyan-500/15">
                            <Calendar className="h-3 w-3 text-cyan-400" />
                            <span className="text-cyan-400 font-medium">
                              {task.matchedEvent.title}
                            </span>
                            <span className="text-cyan-400/60">
                              ({task.matchReason})
                            </span>
                            {!task.matchedEvent.allDay && (
                              <span className="text-cyan-400/50 flex items-center gap-0.5 ml-auto">
                                <Clock className="h-2.5 w-2.5" />
                                {new Date(task.matchedEvent.start).toLocaleTimeString([], {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Monday.com link */}
                      <a
                        href={`https://monday.com/boards/${task.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 p-1 rounded hover:bg-slate-700/50 text-slate-500 hover:text-slate-300"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  )
                })}

                {displayTasks.length > 20 && (
                  <p className="text-xs text-slate-500 text-center py-2">
                    +{displayTasks.length - 20} more tasks
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  )
}
