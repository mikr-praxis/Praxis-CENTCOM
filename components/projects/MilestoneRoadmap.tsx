'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  AlertTriangle, ChevronDown, ChevronRight, Loader2, RefreshCw,
  Calendar, GripHorizontal, ChevronLeft,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

// -- Types ------------------------------------------------------------------

type Subitem = {
  id: string
  name: string
  status: string | null
  dueDate: string | null
}

type RoadmapTask = {
  id: string
  name: string
  boardName: string
  boardId: string
  groupName: string
  status: string | null
  dueDate: string | null
  timelineStart: string | null
  timelineEnd: string | null
  priority: string | null
  assignees: { id: string; name: string }[]
  tierReason: string
  subitems: Subitem[]
}

type ClientGroup = {
  boardName: string
  boardId: string
  tasks: RoadmapTask[]
}

// -- Helpers ----------------------------------------------------------------

function parseDate(d: string | null): Date | null {
  if (!d) return null
  const date = new Date(d + 'T00:00:00')
  return isNaN(date.getTime()) ? null : date
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function subitemStatusColor(status: string | null): string {
  if (!status) return 'bg-slate-600'
  const s = status.toLowerCase()
  if (s.includes('done') || s.includes('complete')) return 'bg-emerald-500'
  if (s.includes('working') || s.includes('progress') || s.includes('active')) return 'bg-blue-500'
  if (s.includes('stuck') || s.includes('blocked')) return 'bg-red-500'
  if (s.includes('review')) return 'bg-amber-500'
  return 'bg-slate-500'
}

// -- Constants --------------------------------------------------------------

const DAY_WIDTH = 36 // pixels per day
const ROW_HEIGHT = 44 // pixels per task row
const HEADER_HEIGHT = 32 // month/day header

// -- GanttBar ---------------------------------------------------------------

function GanttBar({
  task,
  timelineOrigin,
  onToggleExpand,
  expanded,
}: {
  task: RoadmapTask
  timelineOrigin: Date
  onToggleExpand: () => void
  expanded: boolean
}) {
  const start = parseDate(task.timelineStart) || parseDate(task.dueDate)
  const end = parseDate(task.timelineEnd) || (start ? addDays(start, 3) : null)
  if (!start) return null

  const startOffset = diffDays(timelineOrigin, start)
  const duration = end ? Math.max(diffDays(start, end), 1) : 3
  const left = startOffset * DAY_WIDTH
  const width = Math.max(duration * DAY_WIDTH, 40)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isOverdue = end ? end < today : start < today
  const isActive = start <= today && (end ? end >= today : true)

  const barColor = isOverdue
    ? 'bg-red-500/80 border-red-400/60'
    : isActive
      ? 'bg-amber-500/60 border-amber-400/50'
      : 'bg-blue-500/40 border-blue-400/30'

  const hasSubs = task.subitems.length > 0

  return (
    <div
      className="absolute top-1 group"
      style={{ left: `${left}px`, width: `${width}px`, height: `${ROW_HEIGHT - 8}px` }}
    >
      {/* Task bar */}
      <div
        className={`h-full rounded-md border ${barColor} flex items-center px-2 cursor-pointer transition-all hover:brightness-125`}
        onClick={onToggleExpand}
        title={`${task.name}${task.dueDate ? ` â Due: ${task.dueDate}` : ''}`}
      >
        {hasSubs && (
          expanded
            ? <ChevronDown className="h-3 w-3 text-white/70 flex-shrink-0 mr-1" />
            : <ChevronRight className="h-3 w-3 text-white/70 flex-shrink-0 mr-1" />
        )}
        <span className="text-[11px] font-medium text-white truncate">
          {task.name}
        </span>
        {task.assignees.length > 0 && (
          <span className="ml-auto text-[9px] text-white/50 flex-shrink-0 pl-1">
            {task.assignees.map((a) => a.name.split(' ')[0]).join(', ')}
          </span>
        )}
      </div>

      {/* Dependency dropdown */}
      {expanded && hasSubs && (
        <div className="absolute top-full left-0 mt-1 z-30 w-64 bg-slate-800 border border-slate-600/50 rounded-lg shadow-xl overflow-hidden">
          <div className="px-3 py-1.5 text-[10px] font-medium text-slate-400 border-b border-slate-700/50 flex items-center gap-1">
            <GripHorizontal className="h-3 w-3" />
            Dependencies ({task.subitems.length})
          </div>
          <div className="max-h-48 overflow-y-auto">
            {task.subitems.map((si) => (
              <div key={si.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700/30 transition-colors">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${subitemStatusColor(si.status)}`} />
                <span className={`text-[11px] flex-1 min-w-0 truncate ${
                  si.status?.toLowerCase().includes('done') ? 'text-slate-500 line-through' : 'text-slate-300'
                }`}>
                  {si.name}
                </span>
                {si.status && (
                  <span className="text-[9px] text-slate-500 flex-shrink-0">{si.status}</span>
                )}
                {si.dueDate && (
                  <span className="text-[9px] text-slate-600 flex-shrink-0">{si.dueDate}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// -- TimelineHeader ---------------------------------------------------------

function TimelineHeader({ origin, totalDays }: { origin: Date; totalDays: number }) {
  const months: { label: string; startDay: number; days: number }[] = []
  let current = new Date(origin)

  for (let day = 0; day < totalDays; ) {
    const monthStart = day
    const monthLabel = current.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate()
    const remaining = daysInMonth - current.getDate() + 1
    const span = Math.min(remaining, totalDays - day)
    months.push({ label: monthLabel, startDay: monthStart, days: span })
    day += span
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1)
  }

  // Day markers (every 7 days)
  const dayMarkers: { day: number; label: string }[] = []
  for (let d = 0; d < totalDays; d += 7) {
    const date = addDays(origin, d)
    dayMarkers.push({ day: d, label: formatShortDate(date) })
  }

  return (
    <div style={{ width: `${totalDays * DAY_WIDTH}px` }}>
      {/* Month row */}
      <div className="flex h-5 border-b border-slate-700/40">
        {months.map((m, i) => (
          <div
            key={i}
            className="text-[10px] font-medium text-slate-400 px-2 border-r border-slate-700/30 flex items-center"
            style={{ width: `${m.days * DAY_WIDTH}px` }}
          >
            {m.label}
          </div>
        ))}
      </div>
      {/* Day row */}
      <div className="relative h-4 border-b border-slate-700/40">
        {dayMarkers.map((dm, i) => (
          <span
            key={i}
            className="absolute text-[9px] text-slate-600"
            style={{ left: `${dm.day * DAY_WIDTH}px` }}
          >
            {dm.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// -- TodayLine --------------------------------------------------------------

function TodayLine({ origin, totalDays }: { origin: Date; totalDays: number }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const offset = diffDays(origin, today)
  if (offset < 0 || offset > totalDays) return null

  return (
    <div
      className="absolute top-0 bottom-0 w-px bg-red-500/60 z-20 pointer-events-none"
      style={{ left: `${offset * DAY_WIDTH}px` }}
    >
      <div className="absolute -top-1 -left-1.5 w-3 h-3 rounded-full bg-red-500 border-2 border-slate-900" />
    </div>
  )
}

// -- Main Component ---------------------------------------------------------

export function MilestoneRoadmap() {
  const [data, setData] = useState<ClientGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [collapsedClients, setCollapsedClients] = useState<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    try {
      const res = await fetch('/api/tasks-aggregated')
      if (!res.ok) return
      const json = await res.json()

      // Extract critical tasks, group by client (boardName)
      const critical: RoadmapTask[] = (json.tasks?.critical || []).map((t: RoadmapTask & { subitems?: Subitem[] }) => ({
        id: t.id,
        name: t.name,
        boardName: t.boardName,
        boardId: t.boardId,
        groupName: t.groupName,
        status: t.status,
        dueDate: t.dueDate,
        timelineStart: t.timelineStart,
        timelineEnd: t.timelineEnd,
        priority: t.priority,
        assignees: t.assignees || [],
        tierReason: t.tierReason || '',
        subitems: t.subitems || [],
      }))

      // Group by boardName (client)
      const grouped = new Map<string, ClientGroup>()
      for (const task of critical) {
        if (!grouped.has(task.boardName)) {
          grouped.set(task.boardName, { boardName: task.boardName, boardId: task.boardId, tasks: [] })
        }
        grouped.get(task.boardName)!.tasks.push(task)
      }

      // Sort groups by number of tasks desc, then tasks within by dueDate
      const groups = Array.from(grouped.values())
      groups.sort((a, b) => b.tasks.length - a.tasks.length)
      for (const g of groups) {
        g.tasks.sort((a, b) => {
          const da = parseDate(a.timelineStart) || parseDate(a.dueDate)
          const db = parseDate(b.timelineStart) || parseDate(b.dueDate)
          if (!da && !db) return 0
          if (!da) return 1
          if (!db) return -1
          return da.getTime() - db.getTime()
        })
      }

      setData(groups)
    } catch { /* ignore */ }
    finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Compute timeline bounds
  const { origin, totalDays } = useMemo(() => {
    const allDates: Date[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    allDates.push(today)

    for (const g of data) {
      for (const t of g.tasks) {
        const s = parseDate(t.timelineStart) || parseDate(t.dueDate)
        const e = parseDate(t.timelineEnd)
        if (s) allDates.push(s)
        if (e) allDates.push(e)
      }
    }

    if (allDates.length === 0) return { origin: today, totalDays: 90 }

    const min = new Date(Math.min(...allDates.map((d) => d.getTime())))
    const max = new Date(Math.max(...allDates.map((d) => d.getTime())))

    // Pad 14 days before and 30 days after
    const start = addDays(min, -14)
    const end = addDays(max, 30)
    const days = Math.max(diffDays(start, end), 60)

    return { origin: start, totalDays: days }
  }, [data])

  const toggleTask = (id: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleClient = (boardName: string) => {
    setCollapsedClients((prev) => {
      const next = new Set(prev)
      if (next.has(boardName)) next.delete(boardName)
      else next.add(boardName)
      return next
    })
  }

  // Scroll to today on first load
  useEffect(() => {
    if (!loading && scrollRef.current) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const offset = diffDays(origin, today)
      const scrollTo = Math.max(0, offset * DAY_WIDTH - 200)
      scrollRef.current.scrollLeft = scrollTo
    }
  }, [loading, origin])

  const scrollTimeline = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return
    const amount = DAY_WIDTH * 14 // scroll 2 weeks
    scrollRef.current.scrollBy({ left: dir === 'right' ? amount : -amount, behavior: 'smooth' })
  }

  // Total tasks count
  const totalTasks = data.reduce((sum, g) => sum + g.tasks.length, 0)

  if (loading) {
    return (
      <Card className="p-0 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/30 bg-red-500/5">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <span className="text-sm font-semibold text-slate-200">Critical Milestone Roadmap</span>
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
          <span className="ml-2 text-sm text-slate-500">Loading roadmap...</span>
        </div>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card className="p-0 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/30 bg-red-500/5">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <span className="text-sm font-semibold text-slate-200">Critical Milestone Roadmap</span>
        </div>
        <div className="text-center py-12">
          <Calendar className="h-10 w-10 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No critical tasks with dates found</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/30 bg-red-500/5">
        <AlertTriangle className="h-4 w-4 text-red-400" />
        <span className="text-sm font-semibold text-slate-200">Critical Milestone Roadmap</span>
        <span className="text-[11px] text-slate-500">
          {totalTasks} critical tasks across {data.length} clients
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => scrollTimeline('left')}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => scrollTimeline('right')}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => fetchData(true)} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Gantt body */}
      <div className="flex overflow-hidden" style={{ maxHeight: '500px' }}>
        {/* Left sidebar: client + task names */}
        <div className="flex-shrink-0 w-56 border-r border-slate-700/30 overflow-y-auto bg-slate-900/80">
          {/* Spacer for header */}
          <div style={{ height: `${HEADER_HEIGHT + 16 + 4}px` }} className="border-b border-slate-700/40" />

          {data.map((group) => {
            const isCollapsed = collapsedClients.has(group.boardName)
            return (
              <div key={group.boardName}>
                {/* Client header */}
                <button
                  onClick={() => toggleClient(group.boardName)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left bg-slate-800/60 border-b border-slate-700/30 hover:bg-slate-800/80 transition-colors"
                >
                  {isCollapsed
                    ? <ChevronRight className="h-3 w-3 text-slate-500 flex-shrink-0" />
                    : <ChevronDown className="h-3 w-3 text-red-400 flex-shrink-0" />
                  }
                  <span className="text-[11px] font-semibold text-amber-400/80 truncate">{group.boardName}</span>
                  <Badge variant="red" className="ml-auto">{group.tasks.length}</Badge>
                </button>

                {/* Task rows */}
                {!isCollapsed && group.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 px-3 border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors"
                    style={{ height: `${ROW_HEIGHT}px` }}
                  >
                    <a
                      href={`https://monday.com/boards/${task.boardId}/pulses/${task.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-slate-300 truncate hover:text-amber-400 hover:underline decoration-dotted underline-offset-2 transition-colors flex-1"
                      title={task.name}
                    >
                      {task.name}
                    </a>
                    {task.subitems.length > 0 && (
                      <span className="text-[9px] text-slate-600 flex-shrink-0">{task.subitems.length} deps</span>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {/* Right: scrollable Gantt chart */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto">
          <div className="relative" style={{ width: `${totalDays * DAY_WIDTH}px` }}>
            {/* Timeline header */}
            <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm">
              <TimelineHeader origin={origin} totalDays={totalDays} />
            </div>

            {/* Today line */}
            <TodayLine origin={origin} totalDays={totalDays} />

            {/* Day grid lines (every 7 days) */}
            <div className="absolute top-0 bottom-0 w-full pointer-events-none">
              {Array.from({ length: Math.ceil(totalDays / 7) }, (_, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 w-px bg-slate-700/20"
                  style={{ left: `${i * 7 * DAY_WIDTH}px` }}
                />
              ))}
            </div>

            {/* Task bars */}
            {data.map((group) => {
              const isCollapsed = collapsedClients.has(group.boardName)
              return (
                <div key={group.boardName}>
                  {/* Client header spacer */}
                  <div className="h-8 border-b border-slate-700/30" />

                  {/* Task rows */}
                  {!isCollapsed && group.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="relative border-b border-slate-800/20"
                      style={{ height: `${ROW_HEIGHT}px` }}
                    >
                      <GanttBar
                        task={task}
                        timelineOrigin={origin}
                        expanded={expandedTasks.has(task.id)}
                        onToggleExpand={() => toggleTask(task.id)}
                      />
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Card>
  )
}
