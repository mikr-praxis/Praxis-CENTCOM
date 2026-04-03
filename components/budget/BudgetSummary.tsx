import { MetricCard } from '@/components/ui/MetricCard'
import { DollarSign, User, Building2 } from 'lucide-react'
import type { BudgetItem } from '@/lib/supabase/types'

export function BudgetSummary({ items }: { items: BudgetItem[] }) {
  const total = items.reduce((sum, item) => sum + Number(item.cost), 0)
  const personal = items.filter((i) => i.expense_type === 'Personal').reduce((sum, i) => sum + Number(i.cost), 0)
  const business = items.filter((i) => i.expense_type === 'Business').reduce((sum, i) => sum + Number(i.cost), 0)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <MetricCard title="Total Monthly" value={`$${total}`} icon={DollarSign} color="amber" />
      <MetricCard title="Personal" value={`$${personal}`} icon={User} color="green" />
      <MetricCard title="Business" value={`$${business}`} icon={Building2} color="blue" />
    </div>
  )
}
