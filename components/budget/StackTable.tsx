'use client'

import { Badge } from '@/components/ui/Badge'
import { Trash2 } from 'lucide-react'
import type { BudgetItem } from '@/lib/supabase/types'

type StackTableProps = {
  items: BudgetItem[]
  onDelete: (id: string) => void
}

export function StackTable({ items, onDelete }: StackTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-700/50">
            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Item</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Plan</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Cost</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Type</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Card</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/30">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-slate-800/50 transition-colors group">
              <td className="py-3 px-4 text-sm font-medium text-slate-200">{item.name}</td>
              <td className="py-3 px-4">
                <Badge variant={item.plan.includes('Monthly') ? 'amber' : 'gray'}>
                  {item.plan}
                </Badge>
              </td>
              <td className="py-3 px-4 text-right text-sm font-mono text-slate-300">
                ${Number(item.cost).toFixed(2)}
              </td>
              <td className="py-3 px-4">
                <Badge variant={item.expense_type === 'Personal' ? 'green' : 'orange'}>
                  {item.expense_type}
                </Badge>
              </td>
              <td className="py-3 px-4 text-sm text-slate-400">{item.card || '—'}</td>
              <td className="py-3 px-4 text-right">
                <button
                  onClick={() => onDelete(item.id)}
                  className="rounded-lg p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
