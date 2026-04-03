'use client'

import { useState, useTransition } from 'react'
import { StackTable } from '@/components/budget/StackTable'
import { BudgetSummary } from '@/components/budget/BudgetSummary'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Plus, X } from 'lucide-react'
import { createBudgetItem, deleteBudgetItem } from '@/actions/budget'
import type { BudgetItem } from '@/lib/supabase/types'

export function BudgetClient({ initialItems }: { initialItems: BudgetItem[] }) {
  const [items, setItems] = useState(initialItems)
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleDelete = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
    startTransition(async () => {
      await deleteBudgetItem(id)
    })
  }

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      await createBudgetItem(formData)
      setShowForm(false)
      window.location.reload()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Budget</h1>
          <p className="text-sm text-slate-400 mt-1">Track your stack costs and expenses</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          {showForm ? 'Cancel' : 'Add Item'}
        </Button>
      </div>

      <BudgetSummary items={items} />

      {showForm && (
        <form action={handleCreate} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <input
              name="name"
              placeholder="Service name"
              required
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <input
              name="plan"
              placeholder="Plan (e.g., Monthly)"
              required
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <input
              name="cost"
              type="number"
              step="0.01"
              placeholder="Cost"
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <select
              name="expense_type"
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="Business">Business</option>
              <option value="Personal">Personal</option>
            </select>
            <input
              name="card"
              placeholder="Card (optional)"
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Adding...' : 'Add'}
            </Button>
          </div>
        </form>
      )}

      <Card className="p-0 overflow-hidden">
        <StackTable items={items} onDelete={handleDelete} />
      </Card>
    </div>
  )
}
