'use client'

import { useState, useTransition } from 'react'
import { PipelineBoard } from '@/components/projects/PipelineBoard'
import { Button } from '@/components/ui/Button'
import { Plus, X, LayoutGrid, List } from 'lucide-react'
import { createProject } from '@/actions/projects'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { PROJECT_STAGES } from '@/lib/supabase/types'
import type { Project } from '@/lib/supabase/types'

type View = 'pipeline' | 'list'

export function ProjectsClient({ initialProjects }: { initialProjects: Project[] }) {
  const [projects] = useState(initialProjects)
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [view, setView] = useState<View>('pipeline')

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      await createProject(formData)
      setShowForm(false)
      window.location.reload()
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Projects</h1>
          <p className="text-sm text-slate-400 mt-1">
            Client pipeline — lead to deployed
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex gap-1 rounded-lg bg-slate-800/50 border border-slate-700/50 p-1">
            <button
              onClick={() => setView('pipeline')}
              className={`rounded-md p-1.5 transition-colors ${
                view === 'pipeline'
                  ? 'bg-slate-700 text-amber-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`rounded-md p-1.5 transition-colors ${
                view === 'list'
                  ? 'bg-slate-700 text-amber-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            {showForm ? 'Cancel' : 'New Project'}
          </Button>
        </div>
      </div>

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
