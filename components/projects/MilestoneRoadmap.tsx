'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Loader2, Trash2, ChevronLeft, ChevronRight, User, Calendar,
  Target, CheckCircle2, Clock, CircleDot, AlertTriangle, Pencil, X, Check,
} from 'lucide-react'
import { useFormatters } from '@/components/providers/BrandingProvider'
import type { BoundFormatters } from '@/lib/format'

// ââ Types âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

type Milestone = {
  id: string
  board_id: string
  milestone_number: number
  title: string
  monday_task_id: string | null
  task_name: string | null
  assignee_name: string | null
  due_date: string | null
  status: 'not_started' | 'in_progress' | 'done'
}

type BoardTask = {
  id: string
  name: string
  assignees: { id: string; name: string }[]
  dueDate: string | null
  status: string | null
}

type Props = {
  boardId: string | null
  tasks: BoardTask[]
}

// ââ Helpers âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

const STATUS_CONFIG = {
  not_started: { label: 'Not Started', icon: CircleDot, color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-600/40', pill: 'bg-slate-600/30 text-slate-300' },
  in_progress: { label: 'In Progress', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/5', border: 'border-amber-500/20', pill: 'bg-amber-500/20 text-amber-300' },
  done: { label: 'Done', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', pill: 'bg-emerald-500/20 text-emerald-300' },
} as const

type StatusKey = keyof typeof STATUS_CONFIG

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function formatDate(d: string | null, f: BoundFormatters): string {
  if (!d) return 'â'
  const dt = new Date(d + 'T00:00:00')
  return f.date(dt, { month: 'short', day: 'numeric' })
}

function isOverdue(d: string | null): boolean {
  if (!d) return false
  const dt = new Date(d + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return dt < today
}

function isDueThisMonth(d: string | null, year: number, month: number): boolean {
  if (!d) return true
  const dt = new Date(d + 'T00:00:00')
  return dt.getFullYear() === year && dt.getMonth() === month
}

// ââ Milestone Card ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

function MilestoneCard({
  milestone,
  tasks,
  onUpdate,
  onDelete,
}: {
  milestone: Milestone
  tasks: BoardTask[]
  onUpdate: (id: string, data: Partial<Milestone>) => void
  onDelete: (id: string) => void
}) {
  const f = useFormatters()
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(milestone.title)
  const [editTaskId, setEditTaskId] = useState(milestone.monday_task_id || '')
  const [editDate, setEditDate] = useState(milestone.due_date || '')
  const [deleting, setDeleting] = useState(false)

  const cfg = STATUS_CONFIG[milestone.status]
  const overdue = milestone.status !== 'done' && isOverdue(milestone.due_date)

  const handleSave = () => {
    const linkedTask = tasks.find((t) => t.id === editTaskId)
    onUpdate(milestone.id, {
      title: editTitle,
      monday_task_id: editTaskId || null,
      task_name: linkedTask?.name || null,
      assignee_name: linkedTask?.assignees?.[0]?.name || null,
      due_date: editDate || null,
    })
    setEditing(false)
  }

  const handleStatusCycle = () => {
    const order: StatusKey[] = ['not_started', 'in_progress', 'done']
    const idx = order.indexOf(milestone.status)
    const next = order[(idx + 1) % order.length]
    onUpdate(milestone.id, { status: next })
  }

  const handleDelete = () => {
    if (deleting) {
      onDelete(milestone.id)
    } else {
      setDeleting(true)
      setTimeout(() => setDeleting(false), 3000)
    }
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-slate-800/80 p-3 space-y-2">
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          placeholder="Milestone title..."
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          autoFocus
        />
        <select
          value={editTaskId}
          onChange={(e) => setEditTaskId(e.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        >
          <option value="">â Link a task â</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={editDate}
          onChange={(e) => setEditDate(e.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        />
        <div className="flex justify-end gap-1.5">
          <button onClick={() => setEditing(false)} className="p-1 text-slate-400 hover:text-slate-200">
            <X className="h-3.5 w-3.5" />
          </button>
          <button onClick={handleSave} className="p-1 text-amber-400 hover:text-amber-300">
            <Check className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`group rounded-lg border ${cfg.border} ${cfg.bg} p-3 transition-all hover:border-slate-500/50`}>
      {/* Header: number + title + actions */}
      <div className="flex items-start gap-2">
        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${cfg.pill} flex-shrink-0 mt-0.5`}>
          {milestone.milestone_number}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-200 leading-tight truncate">
            {milestone.title || `Milestone ${milestone.milestone_number}`}
          </p>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={() => { setEditTitle(milestone.title); setEditTaskId(milestone.monday_task_id || ''); setEditDate(milestone.due_date || ''); setEditing(true) }} className="p-0.5 text-slate-500 hover:text-slate-300">
            <Pencil className="h-3 w-3" />
          </button>
          <button onClick={handleDelete} className={`p-0.5 ${deleting ? 'text-red-400' : 'text-slate-500 hover:text-red-400'}`}>
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Linked task */}
      {milestone.task_name && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-400">
          <Target className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{milestone.task_name}</span>
        </div>
      )}

      {/* Meta row: assignee + date + status */}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        {milestone.assignee_name && (
          <span className="flex items-center gap-1 text-[10px] text-slate-400">
            <User className="h-3 w-3" />
            {milestone.assignee_name.split(' ')[0]}
          </span>
        )}
        {milestone.due_date && (
          <span className={`flex items-center gap-1 text-[10px] ${overdue ? 'text-red-400' : 'text-slate-500'}`}>
            <Calendar className="h-3 w-3" />
            {formatDate(milestone.due_date, f)}
            {overdue && <AlertTriangle className="h-2.5 w-2.5" />}
          </span>
        )}
        <button
          onClick={handleStatusCycle}
          className={`ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${cfg.pill} hover:brightness-125`}
          title="Click to cycle status"
        >
          <cfg.icon className="h-3 w-3" />
          {cfg.label}
        </button>
      </div>
    </div>
  )
}

// ââ Main Component ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export function MilestoneRoadmap({ boardId, tasks }: Props) {
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)

  // Month navigation
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) }
    else setViewMonth(viewMonth - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) }
    else setViewMonth(viewMonth + 1)
  }

  // Fetch milestones
  const fetchMilestones = useCallback(async () => {
    if (!boardId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/milestones?boardId=${boardId}`)
      const data = await res.json()
      setMilestones(data.milestones || [])
    } catch {
      console.error('Failed to load milestones')
    } finally {
      setLoading(false)
    }
  }, [boardId])

  useEffect(() => {
    fetchMilestones()
  }, [fetchMilestones])

  // CRUD
  const addMilestone = async () => {
    if (!boardId) return
    setAdding(true)
    try {
      const res = await fetch('/api/projects/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', boardId }),
      })
      const data = await res.json()
      if (data.milestone) {
        setMilestones((prev) => [...prev, data.milestone])
      }
    } catch {
      console.error('Failed to create milestone')
    } finally {
      setAdding(false)
    }
  }

  const updateMilestone = async (id: string, updates: Partial<Milestone>) => {
    // Optimistic update
    setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)))
    try {
      const body: Record<string, unknown> = { action: 'update', id }
      if (updates.title !== undefined) body.title = updates.title
      if (updates.monday_task_id !== undefined) body.mondayTaskId = updates.monday_task_id
      if (updates.task_name !== undefined) body.taskName = updates.task_name
      if (updates.assignee_name !== undefined) body.assigneeName = updates.assignee_name
      if (updates.due_date !== undefined) body.dueDate = updates.due_date
      if (updates.status !== undefined) body.status = updates.status

      await fetch('/api/projects/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch {
      fetchMilestones() // revert on error
    }
  }

  const deleteMilestone = async (id: string) => {
    setMilestones((prev) => prev.filter((m) => m.id !== id))
    try {
      await fetch('/api/projects/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      })
    } catch {
      fetchMilestones()
    }
  }

  // Filter by month
  const filtered = milestones.filter((m) => isDueThisMonth(m.due_date, viewYear, viewMonth))

  // Group by status lanes
  const lanes: { key: StatusKey; items: Milestone[] }[] = [
    { key: 'not_started', items: filtered.filter((m) => m.status === 'not_started') },
    { key: 'in_progress', items: filtered.filter((m) => m.status === 'in_progress') },
    { key: 'done', items: filtered.filter((m) => m.status === 'done') },
  ]

  // Empty state â no board selected
  if (!boardId) {
    return (
      <div className="rounded-xl border border-slate-700/30 bg-slate-900/50 p-6">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-slate-200">Milestone Roadmap</h3>
        </div>
        <p className="text-xs text-slate-500 text-center py-8">Select a board to manage milestones</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-700/30 bg-slate-900/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/30">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-slate-200">Milestone Roadmap</h3>
          <span className="text-[11px] text-slate-500">{milestones.length} total</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Month nav */}
          <div className="flex items-center gap-1.5">
            <button onClick={prevMonth} className="p-1 text-slate-400 hover:text-slate-200 transition-colors">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs font-medium text-slate-300 w-28 text-center">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button onClick={nextMonth} className="p-1 text-slate-400 hover:text-slate-200 transition-colors">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Add button */}
          <button
            onClick={addMilestone}
            disabled={adding}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
          >
            {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Add
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
        </div>
      )}

      {/* Kanban lanes */}
      {!loading && (
        <div className="grid grid-cols-3 divide-x divide-slate-700/30 min-h-[200px]">
          {lanes.map(({ key, items }) => {
            const laneCfg = STATUS_CONFIG[key]
            return (
              <div key={key} className="flex flex-col">
                {/* Lane header */}
                <div className={`flex items-center gap-2 px-3 py-2.5 border-b border-slate-700/30 ${laneCfg.bg}`}>
                  <laneCfg.icon className={`h-3.5 w-3.5 ${laneCfg.color}`} />
                  <span className={`text-xs font-semibold ${laneCfg.color}`}>{laneCfg.label}</span>
                  <span className="ml-auto text-[10px] text-slate-500 font-medium">{items.length}</span>
                </div>

                {/* Cards */}
                <div className="flex-1 p-2 space-y-2 overflow-y-auto" style={{ maxHeight: '360px' }}>
                  {items.length === 0 && (
                    <p className="text-[11px] text-slate-600 text-center py-6">No milestones</p>
                  )}
                  {items.map((m) => (
                    <MilestoneCard
                      key={m.id}
                      milestone={m}
                      tasks={tasks}
                      onUpdate={updateMilestone}
                      onDelete={deleteMilestone}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Empty state â no milestones at all */}
      {!loading && milestones.length === 0 && (
        <div className="text-center py-8 -mt-[200px] relative z-10">
          <Target className="h-8 w-8 text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500 mb-3">No milestones yet</p>
          <button
            onClick={addMilestone}
            disabled={adding}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-2 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Create your first milestone
          </button>
        </div>
      )}
    </div>
  )
}
