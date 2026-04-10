'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { PipelineBoard } from '@/components/projects/PipelineBoard'
import { ProjectBoardCard } from '@/components/projects/ProjectBoardCard'
import { Button } from '@/components/ui/Button'
import { Plus, X, LayoutGrid, List, RefreshCw, Loader2, Users, AlertTriangle, Clock, Hammer } from 'lucide-react'
import { createProject } from '@/actions/projects'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { PROJECT_STAGES } from '@/lib/supabase/types'
import type { Project } from '@/lib/supabase/types'
import type { ProjectBoardData } from '@/app/api/projects/board-data/route'

type View = 'boards' | 'pipeline' | 'list'

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

  // Summary stats across all boards
  const totalCritical = boards.reduce((sum, b) => sum + b.counts.critical, 0)
  const totalFollowup = boards.reduce((sum, b) => sum + b.counts.followup, 0)
  const totalBuilding = boards.reduce((sum, b) => sum + b.counts.building, 0)
  const totalTasks = boards.reduce((sum, b) => sum + b.counts.total, 0)
  const totalMembers = new Set(boards.flatMap((b) => b.assignees.map((a) => a.id))).size

  return (
    <div className="space-y-6">
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

      {/* Summary bar (boards view) */}
      {view === 'boards' && !boardsLoading && boards.length > 0 && (
        <div className="flex items-center gap-4 rounded-xl border border-slate-700/30 bg-slate-800/30 px-4 py-2.5">
          <span className="text-xs text-slate-400">
            <span className="font-semibold text-slate-200">{boards.length}</span> board{boards.length !== 1 ? 's' : ''}
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-xs text-slate-400">
            <span className="font-semibold text-slate-200">{totalTasks}</span> active tasks
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-xs text-slate-400">
            <span className="font-semibold text-slate-200">{totalMembers}</span> team members
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

          {!boardsLoading && !boardsError && boards.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {boards.map((board) => (
                <ProjectBoardCard key={board.boardId} board={board} />
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
