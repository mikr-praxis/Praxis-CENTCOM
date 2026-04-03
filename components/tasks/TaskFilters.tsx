'use client'

import { Button } from '@/components/ui/Button'

type TaskFiltersProps = {
  assignees: string[]
  selectedAssignee: string | null
  onAssigneeChange: (assignee: string | null) => void
}

export function TaskFilters({ assignees, selectedAssignee, onAssigneeChange }: TaskFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-slate-400">Filter:</span>
      <Button
        variant={selectedAssignee === null ? 'primary' : 'ghost'}
        size="sm"
        onClick={() => onAssigneeChange(null)}
      >
        All
      </Button>
      {assignees.map((a) => (
        <Button
          key={a}
          variant={selectedAssignee === a ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => onAssigneeChange(a)}
        >
          {a}
        </Button>
      ))}
    </div>
  )
}
