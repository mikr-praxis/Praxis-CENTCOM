'use client'

import { useState, useTransition } from 'react'
import { KanbanBoard } from '@/components/tasks/KanbanBoard'
import { TaskFilters } from '@/components/tasks/TaskFilters'
import { Button } from '@/components/ui/Button'
import { Plus, X } from 'lucide-react'
import { advanceTask, createTask } from '@/actions/tasks'
import type { Task } from '@/lib/supabase/types'

export function TasksClient({ initialTasks }: { initialTasks: Task[] }) {
  const [tasks, setTasks] = useState(initialTasks)
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()

  const assignees = [...new Set(tasks.map((t) => t.assignee).filter(Boolean))] as string[]

  const filteredTasks = selectedAssignee
    ? tasks.filter((t) => t.assignee === selectedAssignee)
    : tasks

  const handleAdvance = (taskId: string) => {
    // Optimistic update
    const statusOrder = ['todo', 'inprogress', 'review', 'done'] as const
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t
        const idx = statusOrder.indexOf(t.status as typeof statusOrder[number])
        if (idx === -1 || idx >= statusOrder.length - 1) return t
        return { ...t, status: statusOrder[idx + 1] }
      })
    )

    startTransition(async () => {
      await advanceTask(taskId)
    })
  }

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      await createTask(formData)
      setShowForm(false)
      // Refresh would happen via revalidation
      window.location.reload()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Tasks</h1>
          <p className="text-sm text-slate-400 mt-1">Manage and track your work</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          {showForm ? 'Cancel' : 'New Task'}
        </Button>
      </div>

      {showForm && (
        <form action={handleCreate} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <input
              name="title"
              placeholder="Task title"
              required
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <select
              name="priority"
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="low">Low</option>
            </select>
            <input
              name="assignee"
              placeholder="Assignee"
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <input
              name="due_date"
              type="date"
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Adding...' : 'Add Task'}
            </Button>
          </div>
        </form>
      )}

      <TaskFilters
        assignees={assignees}
        selectedAssignee={selectedAssignee}
        onAssigneeChange={setSelectedAssignee}
      />

      <KanbanBoard tasks={filteredTasks} onAdvance={handleAdvance} />
    </div>
  )
}
