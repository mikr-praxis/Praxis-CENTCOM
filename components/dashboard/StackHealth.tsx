import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { BudgetItem } from '@/lib/supabase/types'

export function StackHealth({ items }: { items: BudgetItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stack Health</CardTitle>
      </CardHeader>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-sm text-slate-300">{item.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={item.cost > 0 ? 'amber' : 'gray'}>
                {item.cost > 0 ? `$${item.cost}/mo` : 'Free'}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
