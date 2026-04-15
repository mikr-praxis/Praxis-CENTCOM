'use client'

import { Card } from '@/components/ui/Card'
import type { Project } from '@/lib/supabase/types'

export function RoadmapProgress({ projects }: { projects: Project[] }) {
  const total = projects.length
  const complete = projects.filter((p) => p.status === 'complete').length
  const inProgress = projects.filter((p) => p.status === 'in-progress').length
  const planned = projects.filter((p) => p.status === 'planned').length

  const overallProgress = total > 0
    ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / total)
    : 0

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">CENTCOM Build Progress</h2>
          <p className="text-sm text-slate-400 mt-0.5">{complete} of {total} modules complete</p>
        </div>
        <span className="text-3xl font-bold text-amber-400">{overallProgress}%</span>
      </div>

      <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden mb-6">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
          style={{ width: `${overallProgress}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-emerald-400">{complete}</p>
          <p className="text-xs text-slate-400 mt-1">Complete</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-amber-400">{inProgress}</p>
          <p className="text-xs text-slate-400 mt-1">In Progress</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-400">{planned}</p>
          <p className="text-xs text-slate-400 mt-1">Planned</p>
        </div>
      </div>
    </Card>
  )
}
