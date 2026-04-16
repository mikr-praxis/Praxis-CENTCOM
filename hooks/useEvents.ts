'use client'

import { useRealtimeTable } from './useRealtimeTable'
import type { Event } from '@/lib/supabase/types'

export function useEvents(userId: string) {
  const { data: events, loading } = useRealtimeTable<Event>('events', userId, {
    orderBy: { column: 'event_date', ascending: true },
    onInsert: (item, prev) =>
      [...prev, item].sort((a, b) => a.event_date.localeCompare(b.event_date)),
  })

  return { events, loading }
}
