'use client'

import { clsx } from 'clsx'
import { Badge } from '@/components/ui/Badge'
import type { Event } from '@/lib/supabase/types'
import { useFormatters } from '@/components/providers/BrandingProvider'

type WeekGridProps = {
  events: Event[]
  weekStart: Date
}

export function WeekGrid({ events, weekStart }: WeekGridProps) {
  const f = useFormatters()
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
      {days.map((day) => {
        const dateStr = day.toISOString().split('T')[0]
        const dayEvents = events.filter((e) => e.event_date === dateStr)
        const isToday = day.getTime() === today.getTime()

        return (
          <div
            key={dateStr}
            className={clsx(
              'rounded-xl border p-2 sm:p-3 min-h-[80px] sm:min-h-[120px]',
              isToday
                ? 'border-amber-500/50 bg-amber-500/5'
                : 'border-slate-700/50 bg-slate-800/30'
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={clsx('text-xs font-medium', isToday ? 'text-amber-400' : 'text-slate-500')}>
                {f.date(day, { weekday: 'short' })}
              </span>
              <span
                className={clsx(
                  'text-sm font-bold',
                  isToday ? 'text-amber-400' : 'text-slate-300'
                )}
              >
                {day.getDate()}
              </span>
            </div>
            <div className="space-y-1">
              {dayEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="rounded-md bg-slate-700/50 px-2 py-1 text-xs text-slate-300 truncate"
                >
                  {evt.event_time && (
                    <span className="text-slate-500 mr-1">{evt.event_time.slice(0, 5)}</span>
                  )}
                  {evt.title}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
