'use client'

import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Play, Pause, Clock, Hash } from 'lucide-react'
import type { Workflow } from '@/lib/supabase/types'

type WorkflowCardProps = {
  workflow: Workflow
  onToggle: (id: string, newStatus: 'active' | 'paused') => void
}

export function WorkflowCard({ workflow, onToggle }: WorkflowCardProps) {
  const isActive = workflow.status === 'active'

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">{workflow.name}</h3>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant={isActive ? 'green' : 'gray'}>
              {isActive ? 'Active' : 'Paused'}
            </Badge>
            <Badge variant="default">{workflow.platform}</Badge>
          </div>
          <div className="flex items-center gap-4 mt-3">
            {workflow.schedule && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {workflow.schedule}
              </span>
            )}
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Hash className="h-3 w-3" />
              {workflow.run_count} runs
            </span>
          </div>
        </div>
        <button
          onClick={() => onToggle(workflow.id, isActive ? 'paused' : 'active')}
          className={`rounded-lg p-2 transition-colors ${
            isActive
              ? 'text-amber-400 hover:bg-amber-500/10'
              : 'text-slate-400 hover:bg-slate-700'
          }`}
        >
          {isActive ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
      </div>
    </Card>
  )
}
