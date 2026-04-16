'use client'

import { useRealtimeTable } from './useRealtimeTable'
import type { Workflow } from '@/lib/supabase/types'

export function useWorkflows(userId: string) {
  const { data: workflows, loading } = useRealtimeTable<Workflow>('workflows', userId, {
    orderBy: { column: 'created_at', ascending: false },
  })

  return { workflows, loading }
}
