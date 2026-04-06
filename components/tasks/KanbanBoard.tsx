'use client'

import { TaskCard } from './TaskCard'
import type { Task } from '@/lib/supabase/types'

const columns = [
  { id: 'todo', label: 'To Do', color: 'bg-slate-500' },
  { id: 'inprogress', label: 'In Progress', color: 'bg-amber-500' },
  { id: 'review', label: 'In Review', color: 'bg-blue-500' },
  { id: 'done', label: 'Done', color: 'bg-emerald-500' },
] as const

type KanbanBoardProps = {
  tasks: Task[]
  onAdvance: (taskId: string) => void
}

export function KanbanBoard({ tasks, onAdvance }: KanbanBoardProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 snap-x snap-mandatory md:grid md:grid-cols-2 md:overflow-visible md:snap-none xl:grid-cols-4 md:mx-0 md:px-0">
      {columns.map((col) => {
        const columnTasks = tasks.filter((t) => t.status === col.id)
        return (
          <div key={col.id} className="flex-shrink-0 w-[75vw] sm:w-72 md:w-auto snap-center">
            <div className="flex items-center gap-2 mb-4">
              <div className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
              <h3 className="text-sm font-semibold text-slate-300">{col.label}</h3>
              <span className="ml-auto text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                {columnTasks.length}
              </span>
            </div>
            <div className="space-y-3">
              {columnTasks.map((task) => (
                <TaskCard key={task.id} task={task} onAdvance={onAdvance} />
              ))}
              {columnTasks.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center">
                  <p className="text-xs text-slate-600">No tasks</p>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
