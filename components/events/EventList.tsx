'use client'

import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Clock, Users } from 'lucide-react'
import type { Event } from '@/lib/supabase/types'
import { useFormatters } from '@/components/providers/BrandingProvider'

const typeVariant: Record<string, 'blue' | 'orange' | 'green'> = {
  internal: 'blue',
  client: 'orange',
  external: 'green',
}

export function EventList({ events }: { events: Event[] }) {
  const f = useFormatters()
  return (
    <div className="space-y-3">
      {events.length === 0 && (
        <p className="text-sm text-slate-500 text-center py-8">No upcoming events</p>
      )}
      {events.map((event) => (
        <Card key={event.id} className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-200">{event.title}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-slate-500">
                  {f.date(event.event_date, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                {event.event_time && (
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {event.event_time.slice(0, 5)}
                  </span>
                )}
                {event.duration && (
                  <span className="text-xs text-slate-500">{event.duration}</span>
                )}
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {event.attendees}
                </span>
              </div>
            </div>
            <Badge variant={typeVariant[event.event_type] || 'default'}>
              {event.event_type}
            </Badge>
          </div>
        </Card>
      ))}
    </div>
  )
}
