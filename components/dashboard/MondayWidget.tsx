'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LayoutGrid, RefreshCw, ExternalLink, AlertCircle, Clock, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

type MondayTask = {
  id: string
  name: string
  board_name?: string
  group_name?: string
  status?: string
  priority?: string
  due_date?: string | null
  assignees?: string[]
}

type BoardSummary = {
  name: string
  total: number
  done: number
  overdue: number
}

const STATUS_COLORS: Record<string, 'green' | 'blue' | 'red' | 'amber' | 'default' | 'gray' | 'orange'> = {
  done: 'green',
  'working on it': 'blue',
  'stuck': 'red',
  'blocked': 'red',
  'review': 'amber',
  'waiting for review': 'amber',
  'waiting': 'gray',
  'not started': 'gray',
}

const PRIORITY_COLORS: Record<string, 'red' | 'amber' | 'blue' | 'gray'> = {
  critical: 'red',
  urgent: 'red',
  high: 'amber',
  medium: 'blue',
  low: 'gray',
}

function getDeadlineLabel(dueDate: string | null | undefined): { text: string; color: string } | null {
  if (!dueDate) return null
  const due = new Date(dueDate)
  const now = new Date()
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return { text: 'Overdue', color: 'text-red-400' }
  if (diffDays === 0) return { text: 'Due today', color: 'text-amber-400' }
  if (diffDays <= 3) return { text: `Due in ${diffDays}d`, color: 'text-amber-300' }
  return null
}

export function MondayWidget() {
  const [tasks, setTasks] = useState<MondayTask[]>([])
  const [boards, setBoards] = useState<BoardSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'tasks' | 'boards'>('tasks')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/monday')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to fetch Monday data')
      }
      const data = await res.json()
      const allTasks: MondayTask[] = data.tasks || []

      // Filter to active tasks, sort by due date urgency
      const isDone = (t: MondayTask) => t.status?.toLowerCase().includes('done') || t.status?.toLowerCase().includes('complete')
      const active = allTasks
        .filter((t) => !isDone(t))
        .sort((a, b) => {
          if (!a.due_date && !b.due_date) return 0
          if (!a.due_date) return 1
          if (!b.due_date) return -1
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        })
        .slice(0, 8)

      setTasks(active)

      // Build board summaries
      const boardMap = new Map<string, BoardSummary>()
      const now = new Date()
      for (const t of allTasks) {
        const name = t.board_name || 'Unknown'
        if (!boardMap.has(name)) {
          boardMap.set(name, { name, total: 0, done: 0, overdue: 0 })
        }
        const board = boardMap.get(name)!
        board.total++
        if (isDone(t)) board.done++
        if (t.due_date && new Date(t.due_date) < now && !isDone(t)) {
          board.overdue++
        }
      }
      setBoards(Array.from(boardMap.values()).sort((a, b) => b.total - a.total))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Monday.com not connected')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(fetchData, 60_000)
    return () => clearInterval(interval)
  }, [fetchData])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-amber-400" />
            <CardTitle>Monday.com</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={fetchData}
              disabled={loading}
              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Link
              href="/monday"
              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
        {/* View toggle */}
        <div className="flex gap-1 mt-3">
          <button
            onClick={() => setView('tasks')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              view === 'tasks'
                ? 'bg-amber-500/20 text-amber-300'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
            }`}
          >
            Active Tasks
          </button>
          <button
            onClick={() => setView('boards')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              view === 'boards'
                ? 'bg-amber-500/20 text-amber-300'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
            }`}
          >
            Boards
          </button>
        </div>
      </CardHeader>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 mb-3">
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}

      <div className="max-h-[320px] overflow-y-auto">
        {loading && tasks.length === 0 && (
          <div className="text-center py-6">
            <RefreshCw className="h-4 w-4 animate-spin text-slate-500 mx-auto mb-2" />
            <span className="text-xs text-slate-500">Loading...</span>
          </div>
        )}

        {/* Tasks view */}
        {view === 'tasks' && !loading && tasks.length === 0 && !error && (
          <p className="text-xs text-slate-500 text-center py-6">No active tasks</p>
        )}

        {view === 'tasks' && (
          <div className="space-y-0.5">
            {tasks.map((task) => {
              const deadline = getDeadlineLabel(task.due_date)
              const statusKey = task.status?.toLowerCase() || ''
              const priorityKey = task.priority?.toLowerCase() || ''
              return (
                <div
                  key={task.id}
                  className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-slate-700/30 transition-colors"
                >
                  {deadline && deadline.text === 'Overdue' ? (
                    <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                  ) : deadline ? (
                    <Clock className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-slate-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{task.name}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {task.status && (
                        <Badge variant={STATUS_COLORS[statusKey] || 'default'}>
                          {task.status}
                        </Badge>
                      )}
                      {task.priority && (
                        <Badge variant={PRIORITY_COLORS[priorityKey] || 'gray'}>
                          {task.priority}
                        </Badge>
                      )}
                      {deadline && (
                        <span className={`text-[10px] font-medium ${deadline.color}`}>
                          {deadline.text}
                        </span>
                      )}
                    </div>
                    {task.board_name && (
                      <p className="text-[10px] text-slate-600 mt-0.5">{task.board_name}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Boards view */}
        {view === 'boards' && !loading && boards.length === 0 && !error && (
          <p className="text-xs text-slate-500 text-center py-6">No boards found</p>
        )}

        {view === 'boards' && (
          <div className="space-y-2">
            {boards.map((board) => {
              const pct = board.total > 0 ? Math.round((board.done / board.total) * 100) : 0
              return (
                <div key={board.name} className="rounded-lg bg-slate-900/50 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-medium text-slate-200 truncate">{board.name}</p>
                    <span className="text-[10px] text-slate-500">{board.done}/{board.total}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[10px] text-emerald-400">{pct}% done</span>
                    {board.overdue > 0 && (
                      <span className="text-[10px] text-red-400">{board.overdue} overdue</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Card>
  )
}
