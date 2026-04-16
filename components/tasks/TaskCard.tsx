'use client'

import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { ChevronRight, Calendar } from 'lucide-react'
import type { Task } from '@/lib/supabase/types'
import { priorityVariant } from '@/lib/styles/colors'

type TaskCardProps = {
  task: Task
  onAdvance?: (taskId: string) => void
}

export function TaskCard({ task, onAdvance }: TaskCardProps) {
  return (
    <Card className="p-4 hover:border-slate-600 transition-colors group">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-200 truncate">{task.title}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={priorityVariant[task.priority]}>{task.priority}</Badge>
            {task.tag && <Badge variant="blue">{task.tag}</Badge>}
          </div>
          <div className="flex items-center gap-3 mt-2">
            {task.assignee && (
              <span className="text-xs text-slate-500">{task.assignee}</span>
            )}
            {task.due_date && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </div>
        {onAdvance && task.status !== 'done' && (
          <button
            onClick={() => onAdvance(task.id)}
            className="ml-2 rounded-lg p-1.5 text-slate-500 hover:text-amber-400 hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"
            title="Advance status"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </Card>
  )
}
