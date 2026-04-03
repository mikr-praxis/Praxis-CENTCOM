'use client'

import { useState, useTransition } from 'react'
import { WorkflowCard } from '@/components/comms/WorkflowCard'
import { MessageLog } from '@/components/comms/MessageLog'
import { Button } from '@/components/ui/Button'
import { Plus, X } from 'lucide-react'
import { toggleWorkflow, createWorkflow } from '@/actions/workflows'
import type { Workflow } from '@/lib/supabase/types'

export function CommsClient({ initialWorkflows }: { initialWorkflows: Workflow[] }) {
  const [workflows, setWorkflows] = useState(initialWorkflows)
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleToggle = (id: string, newStatus: 'active' | 'paused') => {
    setWorkflows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, status: newStatus } : w))
    )
    startTransition(async () => {
      await toggleWorkflow(id, newStatus)
    })
  }

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      await createWorkflow(formData)
      setShowForm(false)
      window.location.reload()
    })
  }

  // Mock message logs
  const logs = [
    { id: '1', workflow: 'Weekly Standup Summary', message: 'Standup summary generated and posted to #general', platform: 'Slack', time: 'Mon 9:05 AM' },
    { id: '2', workflow: 'Budget Alert Monitor', message: 'Monthly burn within budget. No alerts triggered.', platform: 'Slack', time: 'Today 8:02 AM' },
    { id: '3', workflow: 'Sprint Report Generator', message: 'Sprint report drafted and sent to stakeholders', platform: 'Email', time: 'Fri 4:12 PM' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Comms</h1>
          <p className="text-sm text-slate-400 mt-1">Automated workflows and communications</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          {showForm ? 'Cancel' : 'New Workflow'}
        </Button>
      </div>

      {showForm && (
        <form action={handleCreate} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              name="name"
              placeholder="Workflow name"
              required
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 sm:col-span-2"
            />
            <select
              name="platform"
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="Slack">Slack</option>
              <option value="Email">Email</option>
              <option value="SMS">SMS</option>
            </select>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {workflows.map((workflow) => (
          <WorkflowCard key={workflow.id} workflow={workflow} onToggle={handleToggle} />
        ))}
      </div>

      <MessageLog logs={logs} />
    </div>
  )
}
