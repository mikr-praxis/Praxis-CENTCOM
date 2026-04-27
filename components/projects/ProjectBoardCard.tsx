'use client'

import { useState, useEffect } from 'react'
import {
  AlertTriangle,
  Clock,
  Hammer,
  ChevronDown,
  ChevronRight,
  Users,
  Calendar,
  Hash,
  User,
  ListTodo,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import type { ProjectBoardData, AssigneeSummary, BoardTaskSummary, TaskTier } from '@/app/api/projects/board-data/route'
import { useFormatters } from '@/components/providers/BrandingProvider'
import type { BoundFormatters } from '@/lib/format'

// -- Tier config ----------------------------------------------------------------

const TIER_CONFIG: Record<TaskTier, {
  label: string
  icon: React.ElementType
  color: string
  dotColor: string
  badgeVariant: 'red' | 'amber' | 'blue'
}> = {
  critical: {
    label: 'Critical',
    icon: AlertTriangle,
    color: 'text-red-400',
    dotColor: 'bg-red-500',
    badgeVariant: 'red',
  },
  followup: {
    label: 'Follow-up',
    icon: Clock,
    color: 'text-amber-400',
    dotColor: 'bg-amber-500',
    badgeVariant: 'amber',
  },
  building: {
    label: 'Building',
    icon: Hammer,
    color: 'text-blue-400',
    dotColor: 'bg-blue-500',
    badgeVariant: 'blue',
  },
}

// -- Helpers --------------------------------------------------------------------

function deadlineLabel(dateStr: string, f: BoundFormatters): { text: string; color: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(dateStr + 'T00:00:00')
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, color: 'text-red-400' }
  if (diff === 0) return { text: 'Due today', color: 'text-amber-400' }
  if (diff === 1) return { text: 'Tomorrow', color: 'text-amber-300' }
  if (diff <= 7) return { text: `${diff}d left`, color: 'text-blue-400' }
  return { text: f.date(date, { month: 'short', day: 'numeric' }), color: 'text-slate-400' }
}

function statusDot(status: string | null): string {
  if (!status) return 'bg-slate-600'
  const s = status.toLowerCase()
  if (s.includes('working') || s.includes('progress') || s.includes('active')) return 'bg-blue-500'
  if (s.includes('stuck') || s.includes('blocked')) return 'bg-red-500'
  if (s.includes('review')) return 'bg-amber-500'
  if (s.includes('waiting') || s.includes('pending')) return 'bg-purple-500'
  return 'bg-slate-500'
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// -- TierBadges (inline count badges) -------------------------------------------

function TierBadges({ counts }: { counts: { critical: number; followup: number; building: number } }) {
  return (
    <div className="flex items-center gap-1.5">
      {counts.critical > 0 && (
        <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400">
          <AlertTriangle className="h-2.5 w-2.5" />
          {counts.critical}
        </span>
      )}
      {counts.followup > 0 && (
        <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
          <Clock className="h-2.5 w-2.5" />
          {counts.followup}
        </span>
      )}
      {counts.building > 0 && (
        <span className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
          <Hammer className="h-2.5 w-2.5" />
          {counts.building}
        </span>
      )}
    </div>
  )
}

// -- Avatar row (collapsed view) ------------------------------------------------

function AvatarRow({ assignees }: { assignees: AssigneeSummary[] }) {
  const shown = assignees.slice(0, 5)
  const overflow = assignees.length - shown.length

  return (
    <div className="flex items-center -space-x-2">
      {shown.map((a) => (
        <div
          key={a.id}
          className="relative h-7 w-7 rounded-full border-2 border-slate-800 bg-slate-700 flex items-center justify-center flex-shrink-0 group/avatar"
          title={`${a.name} â ${a.counts.total} task${a.counts.total !== 1 ? 's' : ''}`}
        >
          {a.avatar ? (
            <img src={a.avatar} alt={a.name} className="h-full w-full rounded-full object-cover" />
          ) : (
            <span className="text-[9px] font-semibold text-slate-300">{initials(a.name)}</span>
          )}
          {/* Task count badge */}
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-600 text-[8px] font-bold text-slate-200 border border-slate-800">
            {a.counts.total}
          </span>
          {/* Critical indicator */}
          {a.counts.critical > 0 && (
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 border border-slate-800" />
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div className="h-7 w-7 rounded-full border-2 border-slate-800 bg-slate-600 flex items-center justify-center flex-shrink-0">
          <span className="text-[9px] font-semibold text-slate-300">+{overflow}</span>
        </div>
      )}
    </div>
  )
}

// -- TaskRow (single task in expanded view) -------------------------------------

function TaskRow({ task }: { task: BoardTaskSummary }) {
  const f = useFormatters()
  const tierCfg = TIER_CONFIG[task.tier]
  const dl = task.dueDate ? deadlineLabel(task.dueDate, f) : null

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-slate-800/50 transition-colors group/task">
      <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${statusDot(task.status)}`} />
      <span className="text-xs text-slate-300 truncate flex-1 min-w-0">{task.name}</span>
      {dl && <span className={`text-[10px] flex-shrink-0 ${dl.color}`}>{dl.text}</span>}
      <tierCfg.icon className={`h-3 w-3 flex-shrink-0 ${tierCfg.color} opacity-60`} />
    </div>
  )
}

// -- AssigneeSection (expanded per-user breakdown) ------------------------------

function AssigneeSection({ assignee, highlighted = false }: { assignee: AssigneeSummary; highlighted?: boolean }) {
  const [open, setOpen] = useState(highlighted)

  // Group tasks by tier
  const byTier = {
    critical: assignee.tasks.filter((t) => t.tier === 'critical'),
    followup: assignee.tasks.filter((t) => t.tier === 'followup'),
    building: assignee.tasks.filter((t) => t.tier === 'building'),
  }

  return (
    <div className={`border-b border-slate-700/30 last:border-b-0 ${highlighted ? 'bg-amber-500/5 rounded-lg' : ''}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2.5 w-full py-2 px-2 hover:bg-slate-800/30 transition-colors rounded-md ${highlighted ? 'ring-1 ring-amber-500/20' : ''}`}
      >
        {/* Avatar */}
        <div className="h-6 w-6 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
          {assignee.avatar ? (
            <img src={assignee.avatar} alt={assignee.name} className="h-full w-full rounded-full object-cover" />
          ) : (
            <span className="text-[8px] font-semibold text-slate-300">{initials(assignee.name)}</span>
          )}
        </div>

        <span className="text-xs font-medium text-slate-200 truncate">{assignee.name}</span>
        <TierBadges counts={assignee.counts} />

        <span className="text-[10px] text-slate-500 ml-auto flex-shrink-0">
          {assignee.counts.total} task{assignee.counts.total !== 1 ? 's' : ''}
        </span>

        {open ? (
          <ChevronDown className="h-3 w-3 text-slate-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-slate-500 flex-shrink-0" />
        )}
      </button>

      {open && (
        <div className="pl-4 pb-2 space-y-0.5">
          {(['critical', 'followup', 'building'] as const).map((tier) => {
            const tasks = byTier[tier]
            if (tasks.length === 0) return null
            const cfg = TIER_CONFIG[tier]
            return (
              <div key={tier}>
                <div className={`flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium ${cfg.color} opacity-70`}>
                  <cfg.icon className="h-2.5 w-2.5" />
                  {cfg.label} ({tasks.length})
                </div>
                {tasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// -- AllTasksSection (flat task list grouped by tier) ---------------------------

function AllTasksSection({ board }: { board: ProjectBoardData }) {
  const allTasks = [
    ...board.assignees.flatMap((a) => a.tasks),
    ...board.unassigned,
  ]

  const byTier = {
    critical: allTasks.filter((t) => t.tier === 'critical'),
    followup: allTasks.filter((t) => t.tier === 'followup'),
    building: allTasks.filter((t) => t.tier === 'building'),
  }

  return (
    <div className="space-y-1">
      {(['critical', 'followup', 'building'] as const).map((tier) => {
        const tasks = byTier[tier]
        if (tasks.length === 0) return null
        const cfg = TIER_CONFIG[tier]
        return (
          <div key={tier}>
            <div className={`flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-medium ${cfg.color} opacity-70`}>
              <cfg.icon className="h-2.5 w-2.5" />
              {cfg.label} ({tasks.length})
            </div>
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        )
      })}
      {allTasks.length === 0 && (
        <p className="text-xs text-slate-500 px-2 py-3 text-center">No tasks</p>
      )}
    </div>
  )
}

// -- ExpandedViewTabs -----------------------------------------------------------

type ExpandedTab = 'members' | 'tasks'

function ExpandedViewTabs({ active, onChange }: { active: ExpandedTab; onChange: (tab: ExpandedTab) => void }) {
  const tabs: { key: ExpandedTab; label: string; icon: React.ElementType }[] = [
    { key: 'members', label: 'By Member', icon: Users },
    { key: 'tasks', label: 'All Tasks', icon: ListTodo },
  ]

  return (
    <div className="flex items-center gap-1 mb-2">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
            active === tab.key
              ? 'bg-slate-700/60 text-slate-200'
              : 'text-slate-500 hover:text-slate-400 hover:bg-slate-800/40'
          }`}
        >
          <tab.icon className="h-3 w-3" />
          {tab.label}
        </button>
      ))}
    </div>
  )
}

// -- Main ProjectBoardCard ------------------------------------------------------

export function ProjectBoardCard({
  board,
  expandByDefault = false,
  highlightMemberId = null,
}: {
  board: ProjectBoardData
  expandByDefault?: boolean
  highlightMemberId?: string | null
}) {
  const f = useFormatters()
  const [expanded, setExpanded] = useState(expandByDefault)
  const [expandedTab, setExpandedTab] = useState<ExpandedTab>('members')

  // Auto-expand/collapse when filter state changes
  useEffect(() => {
    setExpanded(expandByDefault)
  }, [expandByDefault])

  // Determine accent color based on highest-severity tier
  const accentBorder = board.counts.critical > 0
    ? 'border-l-red-500/60'
    : board.counts.followup > 0
      ? 'border-l-amber-500/40'
      : 'border-l-blue-500/30'

  return (
    <div
      className={`rounded-xl border border-slate-700/50 bg-slate-800/50 border-l-[3px] ${accentBorder} transition-all hover:bg-slate-800/70`}
    >
      {/* Header -- always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 pb-3"
      >
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-slate-100 truncate">
              {board.boardName}
            </h3>
            {board.description && (
              <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{board.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
            {board.stage && (
              <Badge variant="default">{board.stage}</Badge>
            )}
            {board.priority && (
              <Badge variant={board.priority === 'high' ? 'red' : board.priority === 'medium' ? 'amber' : 'green'}>
                {board.priority}
              </Badge>
            )}
          </div>
        </div>

        {/* Tier summary badges */}
        <div className="flex items-center justify-between mb-3">
          <TierBadges counts={board.counts} />
          <span className="text-[10px] text-slate-500">
            {board.counts.total} active task{board.counts.total !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-[11px] text-slate-500 mb-3">
          {board.owner && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" /> {board.owner}
            </span>
          )}
          {board.deadline && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {f.date(board.deadline, { month: 'short', day: 'numeric' })}
            </span>
          )}
          {board.slackTag && (
            <span className="flex items-center gap-1">
              <Hash className="h-3 w-3" /> {board.slackTag}
            </span>
          )}
        </div>

        {/* Collapsed: avatar row + expand chevron */}
        <div className="flex items-center justify-between">
          {board.assignees.length > 0 ? (
            <AvatarRow assignees={board.assignees} />
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-slate-600">
              <Users className="h-3 w-3" /> No assignees
            </span>
          )}

          <div className="flex items-center gap-1 text-[10px] text-slate-500">
            <Users className="h-3 w-3" />
            {board.assignees.length} member{board.assignees.length !== 1 ? 's' : ''}
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 ml-1" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded: tabbed view (members / all tasks) */}
      {expanded && (
        <div className="border-t border-slate-700/50 px-3 py-2">
          <ExpandedViewTabs active={expandedTab} onChange={setExpandedTab} />

          {expandedTab === 'members' && (
            <>
              {board.assignees.map((assignee) => (
                <AssigneeSection
                  key={assignee.id}
                  assignee={assignee}
                  highlighted={highlightMemberId === assignee.id}
                />
              ))}

              {/* Unassigned tasks */}
              {board.unassigned.length > 0 && (
                <div className="border-t border-slate-700/30 mt-1 pt-1">
                  <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-500">
                    <Users className="h-3.5 w-3.5" />
                    <span className="font-medium">Unassigned</span>
                    <span className="text-[10px] ml-auto">{board.unassigned.length} task{board.unassigned.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="space-y-0.5">
                    {board.unassigned.map((task) => (
                      <TaskRow key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {expandedTab === 'tasks' && (
            <AllTasksSection board={board} />
          )}
        </div>
      )}
    </div>
  )
}
