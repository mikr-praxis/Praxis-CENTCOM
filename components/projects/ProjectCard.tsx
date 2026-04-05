'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { ChevronRight, Calendar, User, Hash } from 'lucide-react'
import { advanceProject } from '@/actions/projects'
import type { Project, ProjectStage } from '@/lib/supabase/types'

const stageBadgeVariant: Record<ProjectStage, 'gray' | 'blue' | 'amber' | 'green' | 'orange' | 'red' | 'default'> = {
  lead: 'gray',
  discovery: 'default',
  proposal: 'blue',
  onboarded: 'blue',
  building: 'amber',
  qa: 'orange',
  deployed: 'green',
}

const priorityVariant = {
  high: 'red' as const,
  medium: 'amber' as const,
  low: 'gray' as const,
}

export function ProjectCard({ project }: { project: Project }) {
  const [isPending, startTransition] = useTransition()

  const handleAdvance = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (project.stage === 'deployed') return
    startTransition(async () => {
      await advanceProject(project.id)
    })
  }

  return (
    <Link
      href={`/projects/${project.id}`}
      className="block rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 hover:bg-slate-800 hover:border-slate-600/50 transition-all group"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-100 group-hover:text-amber-400 transition-colors">
          {project.name}
        </h3>
        <Badge variant={priorityVariant[project.priority]}>{project.priority}</Badge>
      </div>

      {project.description && (
        <p className="text-xs text-slate-500 line-clamp-2 mb-3">{project.description}</p>
      )}

      <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
        {project.owner_id && (
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {project.owner_id}
          </span>
        )}
        {project.deadline && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(project.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
        {project.slack_tag && (
          <span className="flex items-center gap-1">
            <Hash className="h-3 w-3" />
            {project.slack_tag}
          </span>
        )}
      </div>

      {project.stage !== 'deployed' && (
        <button
          onClick={handleAdvance}
          disabled={isPending}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-amber-400 transition-colors disabled:opacity-50"
        >
          <ChevronRight className="h-3 w-3" />
          {isPending ? 'Moving...' : 'Advance stage'}
        </button>
      )}
    </Link>
  )
}
