'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  AlertTriangle,
  Clock,
  Hammer,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Users,
  MessageSquare,
  Loader2,
  Search,
  Hash,
  ArrowUpDown,
  CloudOff,
  Plus,
  Check,
  Circle,
  Play,
  Trash2,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react'

// -- Types -----------------------------------------------------------

type Milestone = {
  id: string
  title: string
  description: string | null
  status: 'pending' | 'in_progress' | 'done'
  sort_order: number
  due_date: string | null
}

type SlackContext = {
  channelId: string | null
  channelName: string | null
  slackTag: string | null
}

type AggregatedTask = {
  id: string
  name: string
  boardName: string
  boardId: string
  groupName: string
  groupId: string
  status: string | null
  statusColumnId: string | null
  dueDate: string | null
  assignees: { id: string; name: string }[]
  priority: string | null
  timelineStart: string | null
  timelineEnd: string | null
  tier: 'critical' | 'followup' | 'building'
  tierReason: string
  milestones: Milestone[]
  slackContext: SlackContext | null
  subitems?: { id: string; name: string; status: string | null; dueDate: string | null }[]
}

type SlackMessage = {
  ts: string
  user: string
  username?: string
  text: string
  channel: string
  channel_name?: string
}

type Tier = 'critical' | 'followup' | 'building'

type TierConfig = {
  id: Tier
  label: string
  description: string
  icon: React.ElementType
  accentColor: string
  headerBg: string
  borderColor: string
  badgeVariant: 'red' | 'amber' | 'blue'
}

const TIERS: TierConfig[] = [
  {
    id: 'critical',
    label: 'Critical',
    description: 'Urgent, overdue, blocked -- needs attention now',
    icon: AlertTriangle,
    accentColor: 'text-red-400',
    headerBg: 'bg-red-500/5 border-red-500/20',
    borderColor: 'border-l-red-500',
    badgeVariant: 'red',
  },
  {
    id: 'followup',
    label: 'Follow-ups',
    description: 'Waiting, in review, pending responses',
    icon: Clock,
    accentColor: 'text-amber-400',
    headerBg: 'bg-amber-500/5 border-amber-500/20',
    borderColor: 'border-l-amber-500',
    badgeVariant: 'amber',
  },
  {
    id: 'building',
    label: 'Building',
    description: 'Active work in progress',
    icon: Hammer,
    accentColor: 'text-blue-400',
    headerBg: 'bg-blue-500/5 border-blue-500/20',
    borderColor: 'border-l-blue-500',
    badgeVariant: 'blue',
  },
]

// -- Helpers ---------------------------------------------------------

function deadlineLabel(dateStr: string): { text: string; color: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(dateStr + 'T00:00:00')
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, color: 'text-red-400' }
  if (diff === 0) return { text: 'Due today', color: 'text-amber-400' }
  if (diff === 1) return { text: 'Tomorrow', color: 'text-amber-300' }
  if (diff <= 7) return { text: `${diff}d left`, color: 'text-blue-400' }
  return { text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: 'text-slate-400' }
}

function statusColor(status: string | null): string {
  if (!status) return 'bg-slate-600'
  const s = status.toLowerCase()
  if (s.includes('done') || s.includes('complete')) return 'bg-emerald-500'
  if (s.includes('working') || s.includes('progress') || s.includes('active')) return 'bg-blue-500'
  if (s.includes('stuck') || s.includes('blocked')) return 'bg-red-500'
  if (s.includes('review')) return 'bg-amber-500'
  if (s.includes('waiting') || s.includes('pending')) return 'bg-purple-500'
  return 'bg-slate-500'
}

function formatSlackText(text: string): string {
  return text
    .replace(/<@(\w+)>/g, '@user')
    .replace(/<#(\w+)\|([^>]+)>/g, '#$2')
    .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '$2')
    .replace(/<(https?:\/\/[^>]+)>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}

function formatSlackTs(ts: string): string {
  const date = new Date(Number(ts) * 1000)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  if (isToday) return time
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` ${time}`
}

const STATUS_OPTIONS = [
  'Working on it', 'Stuck', 'Done', 'Waiting for review', 'Blocked', 'Not Started',
]

// -- SlackThread loads messages for task -----------------------------

function SlackThread({ slackContext, taskName }: { slackContext: SlackContext | null; taskName: string }) {
  const [messages, setMessages] = useState<SlackMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (loaded || !slackContext) return
    setLoading(true)

    async function load() {
      try {
        const params = new URLSearchParams({ limit: '5' })

        // Strategy 1: Channel per project
        if (slackContext!.channelId) {
          params.set('channel', slackContext!.channelId)
        }
        // Strategy 2: Tag prefix
        if (slackContext!.slackTag) {
          params.set('tag', slackContext!.slackTag)
        }
        // Fallback: task name
        if (!slackContext!.channelId && !slackContext!.slackTag) {
          // Use first few meaningful words of task name
          const words = taskName.split(/\s+/).filter((w) => w.length > 3).slice(0, 3).join(' ')
          if (words) params.set('tag', words)
        }

        const res = await fetch(`/api/slack/project-messages?${params}`)
        if (res.ok) {
          const data = await res.json()
          setMessages(data.messages || [])
        }
      } catch { /* ignore */ }
      finally {
        setLoading(false)
        setLoaded(true)
      }
    }
    load()
  }, [slackContext, taskName, loaded])

  if (!slackContext && !taskName) return null

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-[10px] text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading Slack messages...
      </div>
    )
  }

  if (loaded && messages.length === 0) {
    return (
      <div className="py-1.5 text-[10px] text-slate-600 flex items-center gap-1">
        <MessageSquare className="h-3 w-3" />
        No Slack messages found
        {slackContext?.channelName && <span>in #{slackContext.channelName}</span>}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
        <MessageSquare className="h-3 w-3 text-purple-400" />
        Slack
        {slackContext?.channelName && (
          <span className="text-purple-400/60">#{slackContext.channelName}</span>
        )}
      </div>
      {messages.map((msg) => (
        <div key={msg.ts} className="flex items-start gap-2 rounded-md bg-slate-900/40 px-2.5 py-2">
          <div className="h-5 w-5 rounded bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-[9px] font-medium text-slate-300">
              {(msg.username || msg.user).charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-300">{msg.username || msg.user}</span>
              {msg.channel_name && (
                <span className="text-[9px] text-purple-400/50">#{msg.channel_name}</span>
              )}
              <span className="text-[9px] text-slate-600">{formatSlackTs(msg.ts)}</span>
            </div>
            <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{formatSlackText(msg.text)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// -- MilestoneCards CENTCOM defined steps ----------------------------

function MilestoneCards({
  taskId,
  milestones: initialMilestones,
  onUpdate,
}: {
  taskId: string
  milestones: Milestone[]
  onUpdate: () => void
}) {
  const [milestones, setMilestones] = useState(initialMilestones)
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => setMilestones(initialMilestones), [initialMilestones])

  const completedCount = milestones.filter((m) => m.status === 'done').length
  const pct = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0

  const handleAddMilestone = async () => {
    if (!newTitle.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', mondayTaskId: taskId, title: newTitle.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setMilestones((prev) => [...prev, data.milestone])
        setNewTitle('')
        setAdding(false)
        onUpdate()
      }
    } catch { /* ignore */ }
    finally { setSaving(false) }
  }

  const handleToggleStatus = async (milestone: Milestone) => {
    const nextStatus = milestone.status === 'done' ? 'pending'
      : milestone.status === 'in_progress' ? 'done'
      : 'in_progress'

    // Optimistic
    setMilestones((prev) => prev.map((m) => m.id === milestone.id ? { ...m, status: nextStatus } : m))

    try {
      await fetch('/api/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id: milestone.id, status: nextStatus }),
      })
      onUpdate()
    } catch {
      // Revert
      setMilestones((prev) => prev.map((m) => m.id === milestone.id ? { ...m, status: milestone.status } : m))
    }
  }

  const handleDelete = async (id: string) => {
    setMilestones((prev) => prev.filter((m) => m.id !== id))
    try {
      await fetch('/api/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      })
      onUpdate()
    } catch { /* ignore */ }
  }

  const statusIcon = (status: string) => {
    if (status === 'done') return <Check className="h-3.5 w-3.5 text-emerald-400" />
    if (status === 'in_progress') return <Play className="h-3.5 w-3.5 text-blue-400" />
    return <Circle className="h-3.5 w-3.5 text-slate-600" />
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 font-medium">Milestones</span>
          {milestones.length > 0 && (
            <span className="text-[10px] text-slate-600">
              {completedCount}/{milestones.length} &middot; {pct}%
            </span>
          )}
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-0.5 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        )}
      </div>

      {/* Progress bar */}
      {milestones.length > 0 && (
        <div className="h-1 rounded-full bg-slate-700/50 overflow-hidden mb-2">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Milestone cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {milestones.map((m) => (
          <div
            key={m.id}
            className={`group flex items-start gap-2 rounded-lg border px-3 py-2.5 transition-colors ${
              m.status === 'done'
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : m.status === 'in_progress'
                  ? 'border-blue-500/20 bg-blue-500/5'
                  : 'border-slate-700/50 bg-slate-800/30'
            }`}
          >
            <button
              onClick={() => handleToggleStatus(m)}
              className="mt-0.5 flex-shrink-0 hover:scale-110 transition-transform"
              title={m.status === 'done' ? 'Mark pending' : m.status === 'in_progress' ? 'Mark done' : 'Start'}
            >
              {statusIcon(m.status)}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium ${m.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                {m.title}
              </p>
              {m.description && (
                <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{m.description}</p>
              )}
              {m.due_date && (() => {
                const dl = deadlineLabel(m.due_date)
                const milestoneDone = m.status === 'done'
                const displayDl = milestoneDone && dl.color.includes('red')
                  ? { text: dl.text.replace(/overdue/, 'late (done)'), color: 'text-slate-500' }
                  : dl
                return (
                  <span className={`text-[10px] mt-0.5 ${displayDl.color}`}>
                    {displayDl.text}
                  </span>
                )
              })()}
            </div>
            <button
              onClick={() => handleDelete(m.id)}
              className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all flex-shrink-0"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Add form */}
      {adding && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="text"
            placeholder="Milestone title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddMilestone(); if (e.key === 'Escape') { setAdding(false); setNewTitle('') } }}
            autoFocus
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <Button size="sm" onClick={handleAddMilestone} disabled={saving || !newTitle.trim()}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
            Add
          </Button>
          <button
            onClick={() => { setAdding(false); setNewTitle('') }}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            Cancel
          </button>
        </div>
      )}

      {milestones.length === 0 && !adding && (
        <p className="text-[10px] text-slate-600">No milestones defined yet</p>
      )}
    </div>
  )
}

// -- TaskRow full task card ------------------------------------------

function TaskRow({
  task,
  tierColor,
  onStatusUpdate,
  onMilestonesUpdate,
}: {
  task: AggregatedTask
  tierColor: string
  onStatusUpdate: (taskId: string, boardId: string, newStatus: string, statusColumnId: string | null) => Promise<void>
  onMilestonesUpdate: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editingStatus, setEditingStatus] = useState(false)
  const [updating, setUpdating] = useState(false)
  const rawDeadline = task.dueDate ? deadlineLabel(task.dueDate) : null
  const taskDone = task.status?.toLowerCase().includes('done') || task.status?.toLowerCase().includes('complete')
  const deadline = rawDeadline && taskDone && rawDeadline.color.includes('red')
    ? { text: rawDeadline.text.replace(/overdue/, 'late (done)'), color: 'text-slate-500' }
    : rawDeadline

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true)
    try {
      await onStatusUpdate(task.id, task.boardId, newStatus, task.statusColumnId)
    } finally {
      setUpdating(false)
      setEditingStatus(false)
    }
  }

  const milestoneProgress = task.milestones.length > 0
    ? Math.round((task.milestones.filter((m) => m.status === 'done').length / task.milestones.length) * 100)
    : null

  return (
    <div className={`border-l-2 ${tierColor}`}>
      {/* Collapsed row */}
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/30 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <a
              href={`https://monday.com/boards/${task.boardId}/pulses/${task.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-slate-200 truncate hover:text-amber-400 hover:underline decoration-dotted underline-offset-2 transition-colors"
              onClick={(e) => e.stopPropagation()}
              title="Open in Monday.com"
            >
              {task.name}
            </a>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/60 text-amber-400/80 font-medium truncate max-w-[160px]" title={`Project: ${task.boardName}`}>
              {task.boardName}
            </span>
            <span className="text-slate-700">&middot;</span>
            <span className="truncate max-w-[100px]">{task.groupName}</span>
            <span className="text-slate-700">&middot;</span>
            <span className="text-slate-600 italic">{task.tierReason}</span>
          </div>
        </div>

        {/* Assignees */}
        {task.assignees.length > 0 && (
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500">
            <Users className="h-3 w-3" />
            <span className="truncate max-w-[80px]">
              {task.assignees.map((a) => a.name.split(' ')[0]).join(', ')}
            </span>
          </div>
        )}

        {/* Milestone progress mini */}
        {milestoneProgress !== null && (
          <div className="hidden sm:flex items-center gap-1.5" title={`${milestoneProgress}% milestones done`}>
            <div className="w-12 h-1.5 rounded-full bg-slate-700 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${milestoneProgress}%` }} />
            </div>
            <span className="text-[10px] text-slate-500">{milestoneProgress}%</span>
          </div>
        )}

        {/* Slack indicator */}
        {task.slackContext && (
          <MessageSquare className="h-3.5 w-3.5 text-purple-400/50 flex-shrink-0" />
        )}

        {/* Status */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          {editingStatus ? (
            updating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
            ) : (
              <select
                autoFocus
                value={task.status || ''}
                onChange={(e) => handleStatusChange(e.target.value)}
                onBlur={() => setEditingStatus(false)}
                className="rounded-md bg-slate-900 border border-slate-600 px-2 py-1 text-[11px] text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )
          ) : (
            <button
              onClick={() => setEditingStatus(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-slate-100 transition-colors group"
              title="Update status -- syncs to Monday"
            >
              <span className={`w-2 h-2 rounded-full ${statusColor(task.status)}`} />
              <span className="group-hover:underline decoration-dotted underline-offset-2">
                {task.status || 'No status'}
              </span>
              <ArrowUpDown className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50" />
            </button>
          )}
        </div>

        {/* Priority badge */}
        {task.priority && (
          <Badge
            variant={
              task.priority.toLowerCase().includes('critical') || task.priority.toLowerCase().includes('urgent')
                ? 'red'
                : task.priority.toLowerCase().includes('high')
                  ? 'amber'
                  : task.priority.toLowerCase().includes('medium')
                    ? 'blue'
                    : 'gray'
            }
          >
            {task.priority}
          </Badge>
        )}

        {/* Deadline */}
        {deadline && (
          <span className={`text-[11px] font-semibold whitespace-nowrap ${deadline.color}`}>
            {deadline.text}
          </span>
        )}

        <a
          href={`https://monday.com/boards/${task.boardId}/pulses/${task.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-500 hover:text-slate-300 transition-colors"
          onClick={(e) => e.stopPropagation()}
          title="Open in Monday.com"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Expanded: Slack + Milestones */}
      {expanded && (
        <div className="px-4 pb-4 pl-11 border-t border-slate-800/50 space-y-4">
          {/* Slack thread */}
          <div className="pt-3">
            <SlackThread slackContext={task.slackContext} taskName={task.name} />
          </div>

          {/* Monday subitems (read-only reference) */}
          {task.subitems && task.subitems.length > 0 && (
            <div>
              <span className="text-[10px] text-slate-500 font-medium">Monday Subitems</span>
              <div className="mt-1 space-y-1">
                {task.subitems.map((si) => (
                  <div key={si.id} className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span className={`w-1.5 h-1.5 rounded-full ${statusColor(si.status)}`} />
                    <span className={si.status?.toLowerCase().includes('done') ? 'line-through text-slate-600' : ''}>
                      {si.name}
                    </span>
                    {si.status && <span className="text-slate-600">&middot; {si.status}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Milestone cards */}
          <MilestoneCards
            taskId={task.id}
            milestones={task.milestones}
            onUpdate={onMilestonesUpdate}
          />
        </div>
      )}
    </div>
  )
}

// -- Main Component --------------------------------------------------

export function AggregatedBoard() {
  const [data, setData] = useState<{
    tasks: Record<Tier, AggregatedTask[]> & { completed?: AggregatedTask[] }
    counts: { critical: number; followup: number; building: number; completed?: number; total: number }
  } | null>(null)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)
  const [collapsedTiers, setCollapsedTiers] = useState<Set<Tier>>(new Set())

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)

    try {
      const res = await fetch('/api/tasks-aggregated')
      if (res.ok) {
        const json = await res.json()
        setData({ tasks: json.tasks, counts: json.counts })
        setConnected(json.connected)
      } else {
        const json = await res.json()
        setError(json.error || 'Failed to fetch')
        setConnected(json.connected ?? false)
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => fetchData(true), 60_000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleStatusUpdate = useCallback(async (taskId: string, boardId: string, newStatus: string, statusColumnId: string | null) => {
    // Optimistic update
    if (data) {
      const updated = { ...data }
      for (const tier of Object.keys(updated.tasks) as Tier[]) {
        updated.tasks[tier] = updated.tasks[tier].map((t) =>
          t.id === taskId ? { ...t, status: newStatus } : t
        )
      }
      setData(updated)
    }

    // Use the actual column ID from Monday.com, fall back to 'status' if unknown
    const colId = statusColumnId || 'status'
    try {
      const res = await fetch('/api/monday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch-update',
          updates: [{ boardId, itemId: taskId, columnValues: { [colId]: { label: newStatus } } }],
        }),
      })
      if (!res.ok) await fetchData(true)
    } catch {
      await fetchData(true)
    }
  }, [data, fetchData])

  // Search filter
  const filteredData = useMemo(() => {
    if (!data || !search) return data
    const q = search.toLowerCase()
    const searchFn = (t: AggregatedTask) =>
      t.name.toLowerCase().includes(q) ||
      t.boardName.toLowerCase().includes(q) ||
      t.groupName.toLowerCase().includes(q) ||
      t.assignees.some((a) => a.name.toLowerCase().includes(q))
    const filtered = {
      tasks: {} as Record<Tier, AggregatedTask[]> & { completed?: AggregatedTask[] },
      counts: data.counts,
    }
    for (const tier of ['critical', 'followup', 'building'] as Tier[]) {
      filtered.tasks[tier] = data.tasks[tier].filter(searchFn)
    }
    if (data.tasks.completed) {
      filtered.tasks.completed = data.tasks.completed.filter(searchFn)
    }
    return filtered
  }, [data, search])

  const toggleTier = (tier: Tier) => {
    setCollapsedTiers((prev) => {
      const next = new Set(prev)
      if (next.has(tier)) next.delete(tier)
      else next.add(tier)
      return next
    })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="p-0 overflow-hidden animate-pulse">
            <div className="h-12 bg-slate-800/30" />
            {[0, 1, 2].map((j) => (
              <div key={j} className="h-14 border-b border-slate-700/20 bg-slate-800/10" />
            ))}
          </Card>
        ))}
      </div>
    )
  }

  if (!connected) {
    return (
      <Card className="p-8 text-center">
        <CloudOff className="h-12 w-12 text-slate-600 mx-auto mb-3" />
        <p className="text-lg font-medium text-slate-300">Monday.com not connected</p>
        <p className="text-sm text-slate-500 mt-1">
          Add your MONDAY_API_KEY at{' '}
          <a href="/config" className="text-amber-400 hover:text-amber-300">/config</a>
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search tasks, boards, people..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowCompleted(!showCompleted)}
          className={showCompleted ? 'ring-1 ring-emerald-500/50' : ''}
        >
          {showCompleted ? (
            <EyeOff className="h-3.5 w-3.5 mr-1" />
          ) : (
            <Eye className="h-3.5 w-3.5 mr-1" />
          )}
          Completed{data?.counts?.completed ? ` (${data.counts.completed})` : ''}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => fetchData(true)} disabled={refreshing}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        {data?.counts && (
          <span className="text-[10px] text-slate-500">{data.counts.total} active tasks</span>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 h-0.5">
          <div className="h-full bg-amber-500 animate-pulse" style={{ width: '100%' }} />
        </div>
      )}

      {/* Tier sections */}
      {TIERS.map((tier) => {
        const tierTasks = filteredData?.tasks[tier.id] || []
        const isCollapsed = collapsedTiers.has(tier.id)
        const Icon = tier.icon

        return (
          <Card key={tier.id} className="p-0 overflow-hidden">
            <button
              onClick={() => toggleTier(tier.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b ${tier.headerBg} hover:brightness-110 transition-all`}
            >
              {isCollapsed ? (
                <ChevronRight className={`h-4 w-4 ` } />
              ) : (
                <ChevronDown className={`h-4 w-4 ${tier.accentColor}`} />
              )}
              <Icon className={`h-4 w-4 ${tier.accentColor}`} />
              <div className="flex-1">
                <span className="text-sm font-semibold text-slate-200">{tier.label}</span>
                <span className="text-[11px] text-slate-500 ml-2">{tier.description}</span>
              </div>
              <Badge variant={tier.badgeVariant}>{tierTasks.length}</Badge>
            </button>

            {!isCollapsed && (
              <div className="divide-y divide-slate-800/30">
                {tierTasks.length === 0 && (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-slate-500">No tasks in this tier</p>
                </div>
              )}
              {tierTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  tierColor={tier.borderColor}
                  onStatusUpdate={handleStatusUpdate}
                  onMilestonesUpdate={() => fetchData(true)}
                />
              ))}
            </div>
          )}
        </Card>
      )
    })}

    {/* Completed section (toggled) */}
    {showCompleted && (() => {
      const completedTasks = filteredData?.tasks?.completed || []
      return (
        <Card className="p-0 overflow-hidden">
          <button
            onClick={() => toggleTier('building')} // reuse collapse logic won't conflict since this is separate
            className="w-full flex items-center gap-3 px-4 py-3 text-left border-b bg-emerald-500/5 border-emerald-500/20 hover:brightness-110 transition-all"
          >
            <ChevronDown className="h-4 w-4 text-emerald-400" />
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <div className="flex-1">
              <span className="text-sm font-semibold text-slate-200">Completed</span>
              <span className="text-[11px] text-slate-500 ml-2">Done and finished tasks</span>
            </div>
            <Badge variant="gray">{completedTasks.length}</Badge>
          </button>
          <div className="divide-y divide-slate-800/30">
            {completedTasks.length === 0 && (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-slate-500">No completed tasks</p>
              </div>
            )}
            {completedTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                tierColor="border-l-emerald-500"
                onStatusUpdate={handleStatusUpdate}
                onMilestonesUpdate={() => fetchData(true)}
              />
            ))}
          </div>
        </Card>
      )
    })()}

    {/* Summary */}
    {data?.counts && (
      <div className="flex items-center justify-center gap-6 text-xs text-slate-500 py-2">
        <span>{data.counts.total} active</span>
        <span className="text-slate-700">&middot;</span>
        <span className="text-red-400">{data.counts.critical} critical</span>
        <span className="text-amber-400">{data.counts.followup} follow-ups</span>
        <span className="text-blue-400">{data.counts.building} building</span>
        {data.counts.completed ? (
          <>
            <span className="text-slate-700">&middot;</span>
            <span className="text-emerald-400">{data.counts.completed} completed</span>
          </>
        ) : null}
      </div>
    )}
  </div>
 )
}
 )}
  </div>
 )
}
