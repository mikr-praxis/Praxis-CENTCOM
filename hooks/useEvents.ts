'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { Event } from '@/lib/supabase/types'

export function useEvents(userId: string) {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchEvents() {
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .order('event_date', { ascending: true })

      setEvents(data || [])
      setLoading(false)
    }

    fetchEvents()

    const channel = supabase
      .channel('events-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setEvents((prev) => [...prev, payload.new as Event].sort((a, b) => a.event_date.localeCompare(b.event_date)))
          } else if (payload.eventType === 'UPDATE') {
            setEvents((prev) => prev.map((e) => (e.id === (payload.new as Event).id ? payload.new as Event : e)))
          } else if (payload.eventType === 'DELETE') {
            setEvents((prev) => prev.filter((e) => e.id !== (payload.old as Event).id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  return { events, loading }
}
