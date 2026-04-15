'use client'

import { useTransition } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CheckCircle, ArrowRight, Trash2, Calendar } from 'lucide-react'
import { clsx } from 'clsx'
import { updateProject, deleteProject } from '@/actions/projects'
import type { Project } from '@/lib/supabase/types'

const statusConfig = {
  planned: { label: 'Planned', variant: 'gray' as const },
  'in-progress': { label: 'In Progress', variant: 'amber' as const },
  complete: { label: 'Complete', variant: 'green' as const },
}

const categoryConfig = {
  core: { label: 'Core', variant: 'blue' as const },
  integration: { label: 'Integration', variant: 'orange' as const },
  infrastructure: { label: 'Infra', variant: 'default' as const },
  ai: { label: 'AI', variant: 'amber' as const },
}

export function ProjectCard({
  project,
  onUpdate,
}: {
  project: Project
  onUpdate: () => void
}) {
  const [isPending, startTransition] = useTransition()

  const statusNext: Record<string, string> = {
    planned: 'in-progress',
    'in-progress': 'complete',
  }

  const handleAdvance = () => {
    const next = statusNext[project.status]
    if (!next) return
    startTransition(async () => {
      await updateProject(project.id, {
        status: next,
        progress: next === 'complete' ? 100 : project.progress,
      })
      onUpdate()
    })
  }

  const handleDelete = () => {
    startTransition(async () => {
      await deleteProject(project.id)
      onUpdate()
    })
  }

  const status = statusConfig[project.status]
  const category = categoryConfig[project.category]

  return (
    <Card className={clsx('relative', isPending && 'opacity-60')}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-slate-100 truncate">{project.name}</h3>
          {project.description && (
            <p className="text-sm text-slate-400 mt-1 line-clamp-2">{project.description}</p>
          )}
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <Badge variant={status.variant}>{status.label}</Badge>
          <Badge variant={category.variant}>{category.label}</Badge>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-400">Progress</span>
          <span className="text-xs font-medium text-slate-300">{project.progress}%</span>
        </div>
        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-300',
              project.status === 'complete'
                ? 'bg-emerald-500'
                : 'bg-amber-500'
            )}
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {project.target_date && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Calendar className="h-3 w-3" />
              {new Date(project.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          <Badge variant={project.priority === 'high' ? 'red' : project.priority === 'medium' ? 'amber' : 'gray'}>
            {project.priority}
          </Badge>
        </div>
        <div className="flex gap-1">
          {project.status !== 'complete' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleAdvance}
              disabled={isPending}
              title={project.status === 'planned' ? 'Start' : 'Complete'}
            >
              {project.status === 'planned' ? (
                <ArrowRight className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            disabled={isPending}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5 text-slate-500 hover:text-red-400" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
