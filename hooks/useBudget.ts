'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { BudgetItem } from '@/lib/supabase/types'

export function useBudget(userId: string) {
  const [items, setItems] = useState<BudgetItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchItems() {
      const { data } = await supabase
        .from('budget_items')
        .select('*')
        .eq('user_id', userId)
        .order('cost', { ascending: false })

      setItems(data || [])
      setLoading(false)
    }

    fetchItems()

    const channel = supabase
      .channel('budget-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_items', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setItems((prev) => [payload.new as BudgetItem, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setItems((prev) => prev.map((i) => (i.id === (payload.new as BudgetItem).id ? payload.new as BudgetItem : i)))
          } else if (payload.eventType === 'DELETE') {
            setItems((prev) => prev.filter((i) => i.id !== (payload.old as BudgetItem).id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const total = items.reduce((sum, i) => sum + Number(i.cost), 0)
  const personal = items.filter((i) => i.expense_type === 'Personal').reduce((sum, i) => sum + Number(i.cost), 0)
  const business = items.filter((i) => i.expense_type === 'Business').reduce((sum, i) => sum + Number(i.cost), 0)

  return { items, loading, total, personal, business }
}
