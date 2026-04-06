'use client'

import { useTransition } from 'react'
import { useRealtimeTable } from './useRealtimeTable'
import type { Task } from '@/lib/supabase/types'

export function useTasks(userId: string) {
  const { data: tasks, setData: setTasks, loading } = useRealtimeTable<Task>('tasks', userId, {
    orderBy: { column: 'created_at', ascending: false },
  })
  const [isPending, startTransition] = useTransition()

  return { tasks, setTasks, loading, isPending, startTransition }
}
