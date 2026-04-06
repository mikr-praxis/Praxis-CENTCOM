'use client'

import { ProjectCard } from './ProjectCard'
import { PROJECT_STAGES } from '@/lib/supabase/types'
import { stageColors } from '@/lib/styles/colors'
import type { Project } from '@/lib/supabase/types'

export function PipelineBoard({ projects }: { projects: Project[] }) {
  const byStage = PROJECT_STAGES.map((stage) => ({
    ...stage,
    projects: projects.filter((p) => p.stage === stage.key),
  }))

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2 snap-x snap-mandatory">
      {byStage.map((stage) => (
        <div key={stage.key} className="flex-shrink-0 w-60 sm:w-64 snap-center">
          {/* Column header */}
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className={`h-2 w-2 rounded-full ${stageColors[stage.key]}`} />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {stage.label}
            </span>
            <span className="text-xs text-slate-600 ml-auto">
              {stage.projects.length}
            </span>
          </div>

          {/* Cards */}
          <div className="space-y-2">
            {stage.projects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700/30 p-4">
                <p className="text-xs text-slate-600 text-center">No projects</p>
              </div>
            ) : (
              stage.projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
