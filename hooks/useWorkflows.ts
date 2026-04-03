'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { Workflow } from '@/lib/supabase/types'

export function useWorkflows(userId: string) {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchWorkflows() {
      const { data } = await supabase
        .from('workflows')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      setWorkflows(data || [])
      setLoading(false)
    }

    fetchWorkflows()

    const channel = supabase
      .channel('workflows-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workflows', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setWorkflows((prev) => [payload.new as Workflow, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setWorkflows((prev) => prev.map((w) => (w.id === (payload.new as Workflow).id ? payload.new as Workflow : w)))
          } else if (payload.eventType === 'DELETE') {
            setWorkflows((prev) => prev.filter((w) => w.id !== (payload.old as Workflow).id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  return { workflows, loading }
}
