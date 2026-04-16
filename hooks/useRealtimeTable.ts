'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'

type OrderBy = {
  column: string
  ascending: boolean
}

/**
 * Generic Supabase realtime hook. Replaces the per-table hooks
 * (useTasks, useBudget, useEvents, useWorkflows) with a single reusable hook.
 *
 * @example
 *   const { data, loading } = useRealtimeTable<Task>('tasks', userId, {
 *     orderBy: { column: 'created_at', ascending: false }
 *   })
 */
export function useRealtimeTable<T extends { id: string }>(
  table: string,
  userId: string,
  options?: {
    orderBy?: OrderBy
    onInsert?: (item: T, prev: T[]) => T[] // custom insert behavior (e.g. sorted insert)
  }
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      let query = supabase.from(table).select('*').eq('user_id', userId)
      if (options?.orderBy) {
        query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending })
      }
      const { data: rows } = await query
      setData((rows as T[]) || [])
      setLoading(false)
    }

    fetchData()

    const channel = supabase
      .channel(`${table}-changes`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newItem = payload.new as T
            setData((prev) =>
              options?.onInsert ? options.onInsert(newItem, prev) : [newItem, ...prev]
            )
          } else if (payload.eventType === 'UPDATE') {
            setData((prev) =>
              prev.map((item) => (item.id === (payload.new as T).id ? (payload.new as T) : item))
            )
          } else if (payload.eventType === 'DELETE') {
            setData((prev) => prev.filter((item) => item.id !== (payload.old as T).id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  return { data, setData, loading }
}
