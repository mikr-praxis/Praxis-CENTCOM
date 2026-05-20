'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ChevronDown, ChevronRight, RefreshCw, Loader2, AlertTriangle,
  Clock, Hammer, Search, Users, Hash, Target, Plus, Trash2,
  Pencil, Check, X, MessageSquare, TrendingUp, BarChart3,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import type { BoardDetail, DetailedTask, OwnershipData, TaskTier } from '@/app/api/projects/board-detail/route'
import type { ProjectKPI, KPISnapshot } from '@/app/api/projects/kpis/route'
import { MilestoneRoadmap } from '@/components/projects/MilestoneRoadmap'
import { useFormatters } from '@/components/providers/BrandingProvider'
import { Skeleton, SkeletonList, SkeletonChart } from '@/components/ui/Skeleton'

// Ã¢ÂÂÃ¢ÂÂ Colors & Constants Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

const TIER_CONFIG: Record<TaskTier, { label: string; color: string; bg: string; icon: typeof AlertTriangle }> = {
  critical: { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/10', icon: AlertTriangle },
  followup: { label: 'Follow-up', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Clock },
  building: { label: 'Building', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Hammer },
}

const PIE_COLORS = [
  '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444',
  '#06b6d4', '#f97316', '#ec4899', '#6366f1', '#14b8a6',
]

const UNIT_OPTIONS = ['#', '$', '%', 'days', 'hrs', 'calls', 'leads', 'rate']

// Ã¢ÂÂÃ¢ÂÂ Board Selector Dropdown Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

function BoardSelector({
  boards,
  selectedId,
  onChange,
  loading,
}: {
  boards: { id: string; name: string }[]
  selectedId: string | null
  onChange: (id: string) => void
  loading: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = boards.find((b) => b.id === selectedId)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={loading || boards.length === 0}
        className="flex items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 py-2.5 text-sm font-medium text-slate-200 hover:border-slate-600 transition-colors disabled:opacity-50 min-w-[240px]"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
        ) : (
          <BarChart3 className="h-4 w-4 text-amber-400" />
        )}
        <span className="flex-1 text-left truncate">
          {loading ? 'Loading boards...' : selected ? selected.name : 'Select a project board'}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && !loading && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 w-full min-w-[280px] max-h-[360px] overflow-y-auto rounded-xl border border-slate-700 bg-slate-800 shadow-2xl">
            {boards.map((board) => (
              <button
                key={board.id}
                onClick={() => { onChange(board.id); setOpen(false) }}
                className={`flex items-center w-full px-4 py-2.5 text-sm hover:bg-slate-700/50 transition-colors ${
                  board.id === selectedId ? 'text-amber-400 bg-amber-500/5' : 'text-slate-300'
                }`}
              >
                <span className="truncate">{board.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Ã¢ÂÂÃ¢ÂÂ Q1: Prioritized Task List Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

function TaskListQuadrant({ tasks, loading }: { tasks: DetailedTask[]; loading: boolean }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return tasks
    const s = searchTerm.toLowerCase()
    return tasks.filter((t) =>
      t.name.toLowerCase().includes(s) ||
      t.assignees.some((a) => a.name.toLowerCase().includes(s)) ||
      t.groupName.toLowerCase().includes(s)
    )
  }, [tasks, searchTerm])

  if (loading) {
    return <SkeletonList rows={6} cols={3} className="p-3" />
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-slate-200">Tasks by Priority</h3>
          <span className="text-xs text-slate-500">({filtered.length})</span>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-32 rounded-lg border border-slate-700/50 bg-slate-900/50 pl-6 pr-2 py-1 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          />
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-slate-500">
            {tasks.length === 0 ? 'Select a board to view tasks' : 'No tasks match your search'}
          </div>
        ) : (
          <div className="divide-y divide-slate-700/30">
            {filtered.map((task) => {
              const cfg = TIER_CONFIG[task.tier]
              const expanded = expandedIds.has(task.id)
              return (
                <div key={task.id} className="group">
                  <button
                    onClick={() => toggle(task.id)}
                    className="flex items-start gap-2 w-full px-4 py-2.5 text-left hover:bg-slate-800/50 transition-colors"
                  >
                    {/* Tier indicator */}
                    <div className={`mt-0.5 rounded-full p-1 ${cfg.bg} flex-shrink-0`}>
                      <cfg.icon className={`h-2.5 w-2.5 ${cfg.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-200 truncate">{task.name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] ${cfg.color}`}>{task.tierReason}</span>
                        {task.dueDate && (
                          <span className="text-[10px] text-slate-500">{task.dueDate}</span>
                        )}
                        {task.assignees.length > 0 && (
                          <span className="text-[10px] text-slate-500">
                            Ã¢ÂÂ {task.assignees.map((a) => a.name.split(' ')[0]).join(', ')}
                          </span>
                        )}
                        {task.assignees.length === 0 && (
                          <span className="text-[10px] text-red-400/60">unassigned</span>
                        )}
                      </div>
                    </div>

                    {/* Expand indicator */}
                    {task.hasSubitems && (
                      expanded
                        ? <ChevronDown className="h-3 w-3 text-slate-500 mt-1 flex-shrink-0" />
                        : <ChevronRight className="h-3 w-3 text-slate-500 mt-1 flex-shrink-0" />
                    )}
                  </button>

                  {/* Expanded subitems */}
                  {expanded && task.subitems.length > 0 && (
                    <div className="pl-10 pr-4 pb-2 space-y-1">
                      {task.subitems.map((sub) => (
                        <div key={sub.id} className="flex items-center gap-2 text-[11px]">
                          <div className="h-1 w-1 rounded-full bg-slate-600" />
                          <span className="text-slate-400 truncate">{sub.name}</span>
                          {sub.status && (
                            <span className="text-[10px] text-slate-600 flex-shrink-0">{sub.status}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// Ã¢ÂÂÃ¢ÂÂ Q2: Ownership Pie Chart Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

function OwnershipQuadrant({ ownership, loading }: { ownership: OwnershipData[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <Skeleton className="h-40 w-40 rounded-full" />
      </div>
    )
  }

  const pieData = ownership.map((o) => ({
    name: o.name.split(' ')[0], // First name only for chart
    fullName: o.name,
    value: o.taskCount,
    critical: o.critical,
    followup: o.followup,
    building: o.building,
  }))

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/50">
        <Users className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-slate-200">Task Ownership</h3>
        <span className="text-xs text-slate-500">({ownership.reduce((s, o) => s + o.taskCount, 0)} tasks)</span>
      </div>

      {ownership.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-sm text-slate-500">
          Select a board to view ownership
        </div>
      ) : (
        <div className="flex-1 flex min-h-0">
          {/* Pie chart */}
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius="40%"
                  outerRadius="70%"
                  dataKey="value"
                  stroke="none"
                  paddingAngle={2}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                    fontSize: '12px',
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, _: any, props: any) => {
                    const d = props?.payload
                    if (!d) return [String(value), '']
                    return [
                      `${value} tasks (${d.critical} crit / ${d.followup} follow / ${d.building} build)`,
                      d.fullName,
                    ]
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend / breakdown */}
          <div className="w-36 overflow-y-auto border-l border-slate-700/30 py-2 px-2 space-y-1">
            {ownership.map((o, i) => (
              <div key={o.id} className="flex items-center gap-1.5 text-[11px]">
                <div
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                />
                <span className="text-slate-300 truncate">{o.name.split(' ')[0]}</span>
                <span className="text-slate-500 ml-auto flex-shrink-0">{o.taskCount}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Ã¢ÂÂÃ¢ÂÂ Q3: Slack Communications (placeholder) Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

function SlackQuadrant({ boardName }: { boardName: string | null }) {
  // Placeholder channels Ã¢ÂÂ will be wired to real Slack MCP later
  const placeholderChannels = boardName
    ? [
        { name: `#${boardName.toLowerCase().replace(/\s+/g, '-')}`, messageCount: 0 },
        { name: '#general', messageCount: 0 },
        { name: '#client-updates', messageCount: 0 },
      ]
    : []

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/50">
        <MessageSquare className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-slate-200">Slack Communications</h3>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="rounded-2xl bg-slate-800/50 border border-slate-700/30 p-6 max-w-xs">
          <MessageSquare className="h-8 w-8 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-300 font-medium mb-1">Slack Integration</p>
          <p className="text-xs text-slate-500 mb-4">
            Connect Slack to see project-related messages organized by channel.
          </p>

          {boardName && (
            <div className="space-y-2 mb-4">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Channels to monitor</p>
              {placeholderChannels.map((ch) => (
                <div
                  key={ch.name}
                  className="flex items-center gap-2 rounded-lg border border-slate-700/30 bg-slate-900/30 px-3 py-2"
                >
                  <Hash className="h-3 w-3 text-slate-500" />
                  <span className="text-xs text-slate-400">{ch.name}</span>
                  <span className="text-[10px] text-slate-600 ml-auto">Ã¢ÂÂ</span>
                </div>
              ))}
            </div>
          )}

          <div className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-1.5">
            <span className="text-[11px] text-amber-400 font-medium">Coming soon</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Ã¢ÂÂÃ¢ÂÂ Q4: KPI Tracker Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

function KPIQuadrant({
  boardId,
  kpis,
  snapshots,
  loading,
  onRefresh,
}: {
  boardId: string | null
  kpis: ProjectKPI[]
  snapshots: KPISnapshot[]
  loading: boolean
  onRefresh: () => void
}) {
  const f = useFormatters()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{
    kpi_name: string; current_value: string; target_value: string; unit: string
  }>({ kpi_name: '', current_value: '', target_value: '', unit: '#' })
  const [adding, setAdding] = useState(false)
  const [newKpi, setNewKpi] = useState({ kpi_name: '', current_value: '', target_value: '', unit: '#' })
  const [saving, setSaving] = useState(false)
  const [selectedKpiId, setSelectedKpiId] = useState<string | null>(null)

  const startEdit = (kpi: ProjectKPI) => {
    setEditingId(kpi.id)
    setEditValues({
      kpi_name: kpi.kpi_name,
      current_value: kpi.current_value?.toString() || '',
      target_value: kpi.target_value?.toString() || '',
      unit: kpi.unit,
    })
  }

  const saveEdit = async () => {
    if (!editingId) return
    setSaving(true)
    try {
      await fetch('/api/projects/kpis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          id: editingId,
          kpi_name: editValues.kpi_name,
          current_value: editValues.current_value ? parseFloat(editValues.current_value) : null,
          target_value: editValues.target_value ? parseFloat(editValues.target_value) : null,
          unit: editValues.unit,
        }),
      })
      setEditingId(null)
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  const addKpi = async () => {
    if (!boardId || !newKpi.kpi_name.trim()) return
    setSaving(true)
    try {
      await fetch('/api/projects/kpis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          board_id: boardId,
          kpi_name: newKpi.kpi_name,
          current_value: newKpi.current_value ? parseFloat(newKpi.current_value) : null,
          target_value: newKpi.target_value ? parseFloat(newKpi.target_value) : null,
          unit: newKpi.unit,
        }),
      })
      setNewKpi({ kpi_name: '', current_value: '', target_value: '', unit: '#' })
      setAdding(false)
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  const deleteKpi = async (id: string) => {
    setSaving(true)
    try {
      await fetch('/api/projects/kpis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      })
      if (selectedKpiId === id) setSelectedKpiId(null)
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  // Build sparkline data for selected KPI
  const selectedSnapshots = useMemo(() => {
    if (!selectedKpiId) return []
    return snapshots
      .filter((s) => s.kpi_id === selectedKpiId)
      .map((s) => ({
        date: f.date(s.recorded_at, { month: 'short', day: 'numeric' }),
        value: s.value,
      }))
  }, [selectedKpiId, snapshots, f])

  if (loading) {
    return <SkeletonChart className="h-full m-3" />
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-slate-200">KPIs</h3>
        </div>
        {boardId && (
          <button
            onClick={() => setAdding(!adding)}
            className="flex items-center gap-1 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2 py-1 text-[11px] text-amber-400 hover:bg-amber-500/20 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {!boardId ? (
          <div className="flex items-center justify-center h-32 text-sm text-slate-500">
            Select a board to manage KPIs
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {/* Add new KPI form */}
            {adding && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
                <input
                  type="text"
                  placeholder="KPI name (e.g. CPL, ROAS)"
                  value={newKpi.kpi_name}
                  onChange={(e) => setNewKpi({ ...newKpi, kpi_name: e.target.value })}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Current"
                    value={newKpi.current_value}
                    onChange={(e) => setNewKpi({ ...newKpi, current_value: e.target.value })}
                    className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  />
                  <input
                    type="number"
                    placeholder="Target"
                    value={newKpi.target_value}
                    onChange={(e) => setNewKpi({ ...newKpi, target_value: e.target.value })}
                    className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  />
                  <select
                    value={newKpi.unit}
                    onChange={(e) => setNewKpi({ ...newKpi, unit: e.target.value })}
                    className="w-16 rounded-md border border-slate-700 bg-slate-900 px-1 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  >
                    {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setAdding(false)}
                    className="rounded-md px-2 py-1 text-xs text-slate-400 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addKpi}
                    disabled={!newKpi.kpi_name.trim() || saving}
                    className="rounded-md bg-amber-500/20 px-3 py-1 text-xs text-amber-400 hover:bg-amber-500/30 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}

            {/* KPI cards */}
            {kpis.length === 0 && !adding && (
              <div className="text-center py-8 text-xs text-slate-500">
                No KPIs defined yet. Click Add to create your first KPI.
              </div>
            )}

            {kpis.map((kpi) => {
              const isEditing = editingId === kpi.id
              const isSelected = selectedKpiId === kpi.id
              const progress = kpi.target_value && kpi.current_value
                ? Math.min((kpi.current_value / kpi.target_value) * 100, 100)
                : null

              return (
                <div
                  key={kpi.id}
                  className={`rounded-lg border transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : 'border-slate-700/30 bg-slate-800/30 hover:border-slate-600/50'
                  }`}
                  onClick={() => !isEditing && setSelectedKpiId(isSelected ? null : kpi.id)}
                >
                  {isEditing ? (
                    <div className="p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editValues.kpi_name}
                        onChange={(e) => setEditValues({ ...editValues, kpi_name: e.target.value })}
                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="Current"
                          value={editValues.current_value}
                          onChange={(e) => setEditValues({ ...editValues, current_value: e.target.value })}
                          className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                        />
                        <input
                          type="number"
                          placeholder="Target"
                          value={editValues.target_value}
                          onChange={(e) => setEditValues({ ...editValues, target_value: e.target.value })}
                          className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                        />
                        <select
                          value={editValues.unit}
                          onChange={(e) => setEditValues({ ...editValues, unit: e.target.value })}
                          className="w-16 rounded-md border border-slate-700 bg-slate-900 px-1 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                        >
                          {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:text-slate-200">
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={saveEdit} disabled={saving} className="p-1 text-amber-400 hover:text-amber-300">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-slate-300">{kpi.kpi_name}</span>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => startEdit(kpi)}
                            className="p-0.5 text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => deleteKpi(kpi.id)}
                            className="p-0.5 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-bold text-slate-100">
                          {kpi.unit === '$' && '$'}
                          {kpi.current_value != null ? kpi.current_value.toLocaleString() : 'Ã¢ÂÂ'}
                          {kpi.unit === '%' && '%'}
                        </span>
                        {kpi.target_value != null && (
                          <span className="text-xs text-slate-500">
                            / {kpi.unit === '$' && '$'}{kpi.target_value.toLocaleString()}{kpi.unit === '%' && '%'}
                            {kpi.unit !== '$' && kpi.unit !== '%' && ` ${kpi.unit}`}
                          </span>
                        )}
                      </div>

                      {/* Progress bar */}
                      {progress != null && (
                        <div className="mt-2 h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              progress >= 90 ? 'bg-emerald-500' : progress >= 60 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Mini sparkline for selected KPI */}
            {selectedKpiId && selectedSnapshots.length >= 2 && (
              <div className="rounded-lg border border-slate-700/30 bg-slate-800/30 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="h-3 w-3 text-amber-400" />
                  <span className="text-[11px] text-slate-400">History</span>
                </div>
                <div className="h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedSnapshots}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={9} />
                      <YAxis stroke="#64748b" fontSize={9} width={30} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          color: '#e2e8f0',
                          fontSize: '11px',
                        }}
                      />
                      <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Ã¢ÂÂÃ¢ÂÂ Main Page Component Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

export function ProjectsClient() {
  // Board list (for dropdown)
  const [boards, setBoards] = useState<{ id: string; name: string }[]>([])
  const [boardsLoading, setBoardsLoading] = useState(true)
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null)

  // Board detail data (for quadrants 1 & 2)
  const [detail, setDetail] = useState<BoardDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // KPI data (quadrant 4)
  const [kpis, setKpis] = useState<ProjectKPI[]>([])
  const [snapshots, setSnapshots] = useState<KPISnapshot[]>([])
  const [kpiLoading, setKpiLoading] = useState(false)

  // Fetch boards list on mount, and auto-select the first board so the page
  // doesn't render a useless "Select a board" empty state on first load.
  useEffect(() => {
    async function loadBoards() {
      setBoardsLoading(true)
      try {
        const res = await fetch('/api/projects/board-detail')
        const data = await res.json()
        const list = data.boards || []
        setBoards(list)
        // Auto-select the first board if nothing is selected yet. Subsequent
        // user picks (via the dropdown) call setSelectedBoardId directly so
        // we don't clobber their choice on remount.
        if (list.length > 0) {
          setSelectedBoardId((current) => current ?? list[0].id)
        }
      } catch {
        console.error('Failed to load boards')
      } finally {
        setBoardsLoading(false)
      }
    }
    loadBoards()
  }, [])

  // Fetch board detail when selection changes
  const fetchDetail = useCallback(async (boardId: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/projects/board-detail?boardId=${boardId}`)
      const data = await res.json()
      if (data.error) {
        console.error(data.error)
        setDetail(null)
      } else {
        setDetail(data)
      }
    } catch {
      console.error('Failed to load board detail')
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  // Fetch KPIs
  const fetchKpis = useCallback(async (boardId: string) => {
    setKpiLoading(true)
    try {
      const res = await fetch(`/api/projects/kpis?boardId=${boardId}`)
      const data = await res.json()
      setKpis(data.kpis || [])
      setSnapshots(data.snapshots || [])
    } catch {
      console.error('Failed to load KPIs')
    } finally {
      setKpiLoading(false)
    }
  }, [])

  // Load data when board changes
  useEffect(() => {
    if (!selectedBoardId) {
      setDetail(null)
      setKpis([])
      setSnapshots([])
      return
    }
    fetchDetail(selectedBoardId)
    fetchKpis(selectedBoardId)
  }, [selectedBoardId, fetchDetail, fetchKpis])

  const handleBoardChange = (id: string) => {
    setSelectedBoardId(id)
  }

  const refreshAll = () => {
    if (selectedBoardId) {
      fetchDetail(selectedBoardId)
      fetchKpis(selectedBoardId)
    }
  }

  const isLoading = detailLoading || boardsLoading

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top bar: board selector + refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Projects</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {detail ? detail.boardName : 'Select a board to view project intel'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <BoardSelector
            boards={boards}
            selectedId={selectedBoardId}
            onChange={handleBoardChange}
            loading={boardsLoading}
          />
          <button
            onClick={refreshAll}
            disabled={!selectedBoardId || isLoading}
            className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-2.5 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary bar */}
      {detail && (
        <div className="flex items-center gap-4 rounded-xl border border-slate-700/30 bg-slate-800/30 px-4 py-2">
          <span className="text-xs text-slate-400">
            <span className="font-semibold text-slate-200">{detail.totalTasks}</span> active tasks
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-xs text-slate-400">
            <span className="font-semibold text-slate-200">{detail.ownership.length}</span> team members
          </span>
          <div className="flex items-center gap-3 ml-auto">
            {detail.counts.critical > 0 && (
              <span className="flex items-center gap-1 text-xs text-red-400">
                <AlertTriangle className="h-3 w-3" /> {detail.counts.critical} critical
              </span>
            )}
            {detail.counts.followup > 0 && (
              <span className="flex items-center gap-1 text-xs text-amber-400">
                <Clock className="h-3 w-3" /> {detail.counts.followup} follow-up
              </span>
            )}
            {detail.counts.building > 0 && (
              <span className="flex items-center gap-1 text-xs text-blue-400">
                <Hammer className="h-3 w-3" /> {detail.counts.building} building
              </span>
            )}
          </div>
        </div>
      )}

      {/* 2x2 Grid */}
      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-3 min-h-0" style={{ minHeight: 'calc(100vh - 220px)' }}>
        {/* Q1: Prioritized tasks (top-left) */}
        <div className="rounded-xl border border-slate-700/30 bg-slate-900/50 overflow-hidden">
          <TaskListQuadrant tasks={detail?.tasks || []} loading={detailLoading && !!selectedBoardId} />
        </div>

        {/* Q2: Ownership pie (top-right) */}
        <div className="rounded-xl border border-slate-700/30 bg-slate-900/50 overflow-hidden">
          <OwnershipQuadrant ownership={detail?.ownership || []} loading={detailLoading && !!selectedBoardId} />
        </div>

        {/* Q3: Slack (bottom-left) */}
        <div className="rounded-xl border border-slate-700/30 bg-slate-900/50 overflow-hidden">
          <SlackQuadrant boardName={detail?.boardName || null} />
        </div>

        {/* Q4: KPIs (bottom-right) */}
        <div className="rounded-xl border border-slate-700/30 bg-slate-900/50 overflow-hidden group">
          <KPIQuadrant
            boardId={selectedBoardId}
            kpis={kpis}
            snapshots={snapshots}
            loading={kpiLoading && !!selectedBoardId}
            onRefresh={() => selectedBoardId && fetchKpis(selectedBoardId)}
          />
        </div>
      </div>

      {/* Full-width Milestone Roadmap below quadrants */}
      <div className="mt-3">
        <MilestoneRoadmap boardId={selectedBoardId} tasks={detail?.tasks || []} />
      </div>
    </div>
  )
}
