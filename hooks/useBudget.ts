'use client'

import { useRealtimeTable } from './useRealtimeTable'
import type { BudgetItem } from '@/lib/supabase/types'

export function useBudget(userId: string) {
  const { data: items, loading } = useRealtimeTable<BudgetItem>('budget_items', userId, {
    orderBy: { column: 'cost', ascending: false },
  })

  const total = items.reduce((sum, i) => sum + Number(i.cost), 0)
  const personal = items.filter((i) => i.expense_type === 'Personal').reduce((sum, i) => sum + Number(i.cost), 0)
  const business = items.filter((i) => i.expense_type === 'Business').reduce((sum, i) => sum + Number(i.cost), 0)

  return { items, loading, total, personal, business }
}
