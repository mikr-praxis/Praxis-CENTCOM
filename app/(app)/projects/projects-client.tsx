'use client'

import { useState, useTransition } from 'react'
import { RoadmapProgress } from '@/components/projects/RoadmapProgress'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { Button } from '@/components/ui/Button'
import { Plus, X } from 'lucide-react'
import { createProject } from '@/actions/projects'
import type { Project } from '@/lib/supabase/types'

const categories = ['all', 'core', 'integration', 'infrastructure', 'ai'] as const

export function ProjectsClient({ initialProjects }: { initialProjects: Project[] }) {
  const [projects, setProjects] = useState(initialProjects)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<(typeof categories)[number]>('all')
  const [isPending, startTransition] = useTransition()

  const filtered = filter === 'all'
    ? projects
    : projects.filter((p) => p.category === filter)

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      await createProject(formData)
      setShowForm(false)
      window.location.reload()
    })
  }

  const handleUpdate = () => {
    window.location.reload()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Projects</h1>
          <p className="text-sm text-slate-400 mt-1">Track module progress across CENTCOM</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          {showForm ? 'Cancel' : 'Add Module'}
        </Button>
      </div>

      <RoadmapProgress projects={projects} />

      {showForm && (
        <form action={handleCreate} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <input
              name="name"
              placeholder="Module name"
              required
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <input
              name="description"
              placeholder="Description"
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <select
              name="category"
              defaultValue="core"
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="core">Core</option>
              <option value="integration">Integration</option>
              <option value="infrastructure">Infrastructure</option>
              <option value="ai">AI</option>
            </select>
            <select
              name="status"
              defaultValue="planned"
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="planned">Planned</option>
              <option value="in-progress">In Progress</option>
              <option value="complete">Complete</option>
            </select>
            <select
              name="priority"
              defaultValue="medium"
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <input
              name="target_date"
              type="date"
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Adding...' : 'Add Module'}
            </Button>
          </div>
        </form>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              filter === cat
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {cat === 'all' ? 'All' : cat === 'ai' ? 'AI' : cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((project) => (
          <ProjectCard key={project.id} project={project} onUpdate={handleUpdate} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500">
            No modules in this category yet.
          </div>
        )}
      </div>
    </div>
  )
}
