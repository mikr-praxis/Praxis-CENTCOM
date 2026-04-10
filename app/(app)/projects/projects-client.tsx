'use client'

import { useState, useEffect, useTransition, useCallback, useMemo } from 'react'
import { PipelineBoard } from '@/components/projects/PipelineBoard'
import { ProjectBoardCard } from '@/components/projects/ProjectBoardCard'
import { Button } from '@/components/ui/Button'
import {
  Plus, X, LayoutGrid, List, RefreshCw, Loader2, Users, AlertTriangle,
  Clock, Hammer, Search, ChevronDown, Filter, XCircle,
} from 'lucide-react'
import { createProject } from '@/actions/projects'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { PROJECT_STAGES } from '@/lib/supabase/types'
import type { Project } from '@/lib/supabase/types'
import type { ProjectBoardData, TaskTier } from '@/app/api/projects/board-data/route'

type View = 'boards' | 'pipeline' | 'list'

// ââ Filter types ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

type Filters = {
  memberId: string | null       // team member filter (assignee id)
  boardId: string | null        // board/client filter (board id)
  tiers: Set<TaskTier>          // tier filter (which tiers to show)
  search: string                // text search across task names
}

const EMPTY_FILTERS: Filters = {
  memberId: null,
  boardId: null,
  tiers: new Set(['critical', 'followup', 'building']),
  search: '',
}

function hasActiveFilters(f: Filters): boolean {
  return (
    f.memberId !== null ||
    f.boardId !== null ||
    f.tiers.size < 3 ||
    f.search.trim().length > 0
  )
}

// ââ Dropdown component ââââââââââââââââââââââââââââââââââââââââââââââââââââ

function FilterDropdown({
  label,
  icon: Icon,
  value,
  options,
  onChange,
}: {
  label: string
  icon: React.ElementType
  value: string | null
  options: { id: string; name: string; extra?: string }[]
  onChange: (id: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.id === value)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
          value
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
            : 'border-slate-700/50 bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:border-slate-600'
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
        {selected ? selected.name : label}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] max-h-[280px] overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 shadow-xl">
            {value && (
              <button
                onClick={() => { onChange(null); setOpen(false) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-400 hover:bg-slate-700/50 border-b border-slate-700/50"
              >
                <XCircle className="h-3.5 w-3.5" /> Clear filter
              </button>
            )}
            {options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => { onChange(opt.id); setOpen(false) }}
                className={`flex items-center justify-between w-full px-3 py-2 text-xs hover:bg-slate-700/50 transition-colors ${
                  opt.id === value ? 'text-amber-400 bg-amber-500/5' : 'text-slate-300'
                }`}
              >
                <span className="truncate">{opt.name}</span>
                {opt.extra && (
                  <span className="text-[10px] text-slate-500 ml-2 flex-shrink-0">{opt.extra}</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ââ Tier toggle buttons âââââââââââââââââââââââââââââââââââââââââââââââââââ

const TIER_ICONS: Record<TaskTier, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  critical: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', label: 'Critical' },
  followup: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', label: 'Follow-up' },
  building: { icon: Hammer, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30', label: 'Building' },
}

function TierToggles({
  tiers,
  counts,
  onToggle,
}: {
  tiers: Set<TaskTier>
  counts: { critical: number; followup: number; building: number }
  onToggle: (tier: TaskTier) => void
}) {
  return (
    <div className="flex items-center gap-1">
      {(['critical', 'followup', 'building'] as const).map((tier) => {
        const cfg = TIER_ICONS[tier]
        const active = tiers.has(tier)
        const count = counts[tier]
        return (
          <button
            key={tier}
            onClick={() => onToggle(tier)}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-all ${
              active
                ? `${cfg.bg} ${cfg.color}`
                : 'border-slate-700/30 bg-slate-800/30 text-slate-600 opacity-50'
            }`}
          >
            <cfg.icon className="h-3 w-3" />
            <span>{count}</span>
          </button>
        )
      })}
    </div>
  )
}

// ââ Main component ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export function ProjectsClient({ initialProjects }: { initialProjects  key={tier}
            onClick={() => onToggle(tier)}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-all ${
              active
                ? `${cfg.bg} ${cfg.color}`
                : 'border-slate-700/30 bg-slate-800/30 text-slate-600 opacity-50'
            }`}
          >
            <cfg.icon className="h-3 w-3" />
            <span>{count}</span>
          </button>
        )
      })}
    </div>
  )
}

// ââ Main component ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export function ProjectsClient({ initialProjects }: { initialProjects: Project[] }) {
  const [projects] = useState(initialProjects)
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [view, setView] = useState<View>('boards')

  // Monday board data
  const [boards, setBoards] = useState<ProjectBoardData[]>([])
  const [boardsLoading, setBoardsLoading] = useState(true)
  const [boardsError, setBoardsError] = useState<string | null>(null)
  const [connected, setConnected] = useState(true)

  // Filters
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)

  const fetchBoards = useCallback(async () => {
    setBoardsLoading(true)
    setBoardsError(null)
    try {
      const res = await fetch('/api/projects/board-data')
      const data = await res.json()
      if (data.error) {
        setBoardsError(data.error)
      } else {
        setBoards(data.boards || [])
        setConnected(data.connected !== false)
      }
    } catch (err) {
      setBoardsError('Failed to load board data')
    } finally {
      setBoardsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBoards()
  }, [fetchBoards])

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      await createProject(formData)
      setShowForm(false)
      window.location.reload()
    })
  }

  // ââ Derived: unique members and board options for filter dropdowns ââ

  const allMembers = useMemo(() => {
    const memberMap = new Map<string, { id: string; name: string; taskCount: number }>()
    for (const board of boards) {
      for (const a of board.assignees) {
        if (memberMap.has(a.id)) {
          memberMap.get(a.id)!.taskCount += a.counts.total
        } else {
          memberMap.set(a.id, { id: a.id, name: a.name, taskCount: a.counts.total })
        }
      }
    }
    return Array.from(memberMap.values()).sort((a, b) => b.taskCount - a.taskCount)
  }, [boards])

  const boardOptions = useMemo(() => {
    return boards.map((b) => ({
      id: b.boardId,
      name: b.boardName,
      extra: `${b.counts.total} tasks`,
    }))
  }, [boards])

  const memberOptions = useMemo(() => {
    return allMembers.map((m) => ({
      id: m.id,
      name: m.name,
      extra: `${m.taskCount} tasks`,
    }))
  }, [allMembers])

  // ââ Derived: filtered boards ââ

  const filteredBoards = useMemo(() => {
    if (!hasActiveFilters(filters)) return boards

    const searchLower = filters.search.trim().toLowerCase()

    return boards
      .map((board) => {
        // Board filter: skip boards that don't match
        if (filters.boardId && board.boardId !== filters.boardId) return null

        // Filter assignees
        let filteredAssignees = board.assignees.map((assignee) => {
          // Member filter: skip assignees that don't match
          if (filters.memberId && assignee.id !== filters.memberId) return null

          // Filter tasks by tier and search
          const filteredTasks = assignee.tasks.filter((task) => {
            if (!filters.tiers.has(task.tier)) return false
            if (searchLower && !task.name.toLowerCase().includes(searchLower)) return false
            return true
          })

          if (filteredTasks.length === 0) return null

          return {
            ...assignee,
            tasks: filteredTasks,
            counts: {
              critical: filteredTasks.filter((t) => t.tier === 'critical').length,
              followup: filteredTasks.filter((t) => t.tier === 'followup').length,
              building: filteredTasks.filter((t) => t.tier === 'building').length,
              total: filteredTasks.length,
            },
          }
        }).filter(Boolean) as typeof board.assignees

        // Filter unassigned tasks
        let filteredUnassigned = board.unassigned.filter((task) => {
          if (filters.memberId) return false // member filter hides unassigned
          if (!filters.tiers.has(task.tier)) return false
          if (searchLower && !task.name.toLowerCase().includes(searchLower)) return false
          return true
        })

        const totalTasks = filteredAssignees.reduce((sum, a) => sum + a.counts.total, 0) + filteredUnassigned.length

        // Hide boards with no matching tasks
        if (totalTasks === 0) return null

        return {
          ...board,
          assignees: filteredAssignees,
          unassigned: filteredUnassigned,
          counts: {
            critical: filteredAssignees.reduce((s, a) => s + a.counts.critical, 0) + filteredUnassigned.filter((t) => t.tier === 'critical').length,
            followup: filteredAssignees.reduce((s, a) => s + a.counts.followup, 0) + filteredUnassigned.filter((t) => t.tier === 'followup').length,
            building: filteredAssignees.reduce((s, a) => s + a.counts.building, 0) + filteredUnassigned.filter((t) => t.tier === 'building').length,
            total: totalTasks,
          },
        }
      })
      .filter(Boolean) as ProjectBoardData[]
  }, [boards, filters])

  // ââ Summary stats (from filtered view) ââ

  const totalCritical = filteredBoards.reduce((sum, b) => sum + b.counts.critical, 0)
  const totalFollowup = filteredBoards.reduce((sum, b) => sum + b.counts.followup, 0)
  const totalBuilding = filteredBoards.reduce((sum, b) => sum + b.counts.building, 0)
  const totalTasks = filteredBoards.reduce((sum, b) => sum + b.counts.total, 0)
  const totalMembers = new Set(filteredBoards.flatMap((b) => b.assignees.map((a) => a.id))).size

  // Unfiltered tier counts for the toggle buttons
  const unfilteredCounts = useMemo(() => ({
    critical: boards.reduce((s, b) => s + b.counts.critical, 0),
    followup: boards.reduce((s, b) => s + b.counts.followup, 0),
    building: boards.reduce((s, b) => s + b.counts.building, 0),
  }), [boards])

  // ââ Filter handlers ââ

  const setMember = (id: string | null) => setFilters((f) => ({ ...f, memberId: id }))
  const setBoard = (id: string | null) => setFilters((f) => ({ ...f, boardId: id }))
  const setSearch = (s: string) => setFilters((f) => ({ ...f, search: s }))
  const toggleTier = (tier: TaskTier) => {
    setFilters((f) => {
      const next = new Set(f.tiers)
      if (next.has(tier)) {
        // Don't allow deselecting all tiers
        if (next.size > 1) next.delete(tier)
      } else {
        next.add(tier)
      }
      return { ...f, tiers: next }
    })
  }
  const clearFilters = () => setFilters(EMPTY_FILTERS)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Projects</h1>
          <p className="text-sm text-slate-400 mt-1">
            Client boards â live from Monday.com
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex gap-1 rounded-lg bg-slate-800/50 border border-slate-700/50 p-1">
            <button
              onClick={() => setView('boards')}
              className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                view === 'boards'
                  ? 'bg-slate-700 text-amber-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('pipeline')}
              className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                view === 'pipeline'
                  ? 'bg-slate-700 text-amber-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                view === 'list'
                  ? 'bg-slate-700 text-amber-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          {view === 'boards' && (
            <button
              onClick={fetchBoards}
              disabled={boardsLoading}
              className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-2 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${boardsLoading ? 'animate-spin' : ''}`} />
            </button>
          )}

          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            {showForm ? 'Cancel' : 'New Project'}
          </Button>
        </div>
      </div>

      {/* Filter bar (boards view only, only when data loaded) */}
      {view === 'boards' && !boardsLoading && boards.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700/30 bg-slate-800/30 px-3 py-2.5">
          <Filter className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />

          {/* Member dropdown */}
          <FilterDropdown
            label="Team member"
            icon={Users}
            value={filters.memberId}
            options={memberOptions}
            onChange={setMember}
          />

          {/* Board dropdown */}
          <FilterDropdown
            label="Board / client"
            icon={LayoutGrid}
            value={filters.boardId}
            options={boardOptions}
            onChange={setBoard}
          />

          {/* Tier toggles */}
          <TierToggles
            tiers={filters.tiers}
            counts={unfilteredCounts}
            onToggle={toggleTier}
          />

          {/* Search */}
          <div className="relative flex-1 min-w-[140px] max-w-[260px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={filters.search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-700/50 bg-slate-900/50 pl-7 pr-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50"
            />
            {filters.search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <XCircle className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Clear all */}
          {hasActiveFilters(filters) && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 rounded-lg border border-slate-700/50 bg-slate-800/50 px-2 py-1.5 text-[11px] text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors ml-auto"
            >
              <XCircle className="h-3 w-3" />
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Summary bar (boards view) */}
      {view === 'boards' && !boardsLoading && boards.length > 0 && (
        <div className="flex items-center gap-4 rounded-xl border border-slate-700/30 bg-slate-800/30 px-4 py-2">
          <span className="text-xs text-slate-400">
            <span className="font-semibold text-slate-200">{filteredBoards.length}</span>
            {hasActiveFilters(filters) ? ` / ${boards.length}` : ''} board{boards.length !== 1 ? 's' : ''}
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-xs text-slate-400">
            <span className="font-semibold text-slate-200">{totalTasks}</span> active tasks
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-xs text-slate-400">
            <span className="font-semibold text-slate-200">{totalMembers}</span> team member{totalMembers !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            {totalCritical > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-red-400">
                <AlertTriangle className="h-3 w-3" /> {totalCritical}
              </span>
            )}
            {totalFollowup > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-amber-400">
                <Clock className="h-3 w-3" /> {totalFollowup}
              </span>
            )}
            {totalBuilding > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-blue-400">
                <Hammer className="h-3 w-3" /> {totalBuilding}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form action={handleCreate} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              name="name"
              placeholder="Project / client name"
              required
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <input
              name="slack_tag"
              placeholder="Slack tag e.g. [B4C]"
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <select
              name="stage"
              defaultValue="lead"
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {PROJECT_STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <select
              name="priority"
              defaultValue="medium"
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            <input
              name="owner_id"
              placeholder="Owner (e.g. nadeem)"
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <input
              name="deadline"
              type="date"
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <textarea
              name="description"
              placeholder="Brief description..."
              rows={1}
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 sm:col-span-1 lg:col-span-1"
            />
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      )}

      {/* Boards view (default â live Monday data) */}
      {view === 'boards' && (
        <>
          {boardsLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
              <span className="ml-3 text-sm text-slate-500">Loading boards from Monday.com...</span>
            </div>
          )}

          {!boardsLoading && boardsError && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
              <AlertTriangle className="h-6 w-6 text-red-400 mx-auto mb-2" />
              <p className="text-sm text-red-300">{boardsError}</p>
              <button
                onClick={fetchBoards}
                className="mt-3 text-xs text-red-400 hover:text-red-300 underline"
              >
                Retry
              </button>
            </div>
          )}

          {!boardsLoading && !boardsError && !connected && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 text-center">
              <p className="text-sm text-amber-300">
                Monday.com is not connected. Configure your API key at{' '}
                <a href="/config" className="underline">
                  /config
                </a>
                .
              </p>
            </div>
          )}

          {!boardsLoading && !boardsError && connected && boards.length === 0 && (
            <div className="text-center py-16">
              <Users className="h-8 w-8 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No active boards found in Monday.com</p>
            </div>
          )}

          {!boardsLoading && !boardsError && boards.length > 0 && filteredBoards.length === 0 && (
            <div className="text-center py-16">
              <Search className="h-8 w-8 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No boards match your filters</p>
              <button
                onClick={clearFilters}
                className="mt-2 text-xs text-amber-400 hover:text-amber-300 underline"
              >
                Clear all filters
              </button>
            </div>
          )}

          {!boardsLoading && !boardsError && filteredBoards.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredBoards.map((board) => (
                <ProjectBoardCard
                  key={board.boardId}
                  board={board}
                  expandByDefault={hasActiveFilters(filters) && (filters.memberId !== null || filters.search.length > 0)}
                  highlightMemberId={filters.memberId}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Pipeline board view */}
      {view === 'pipeline' && <PipelineBoard projects={projects} />}

      {/* List view */}
      {view === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.length === 0 ? (
            <p className="text-sm text-slate-500 col-span-full text-center py-12">
              No projects yet. Create your first project to get started.
            </p>
          ) : (
            projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
