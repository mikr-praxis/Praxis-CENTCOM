'use client'

import { useState, useTransition } from 'react'
import { WeekGrid } from '@/components/events/WeekGrid'
import { EventList } from '@/components/events/EventList'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Plus, X, Calendar } from 'lucide-react'
import { createEvent } from '@/actions/events'
import type { Event } from '@/lib/supabase/types'

export function EventsClient({ initialEvents }: { initialEvents: Event[] }) {
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Calculate week start (Monday)
  const now = new Date()
  const dayOfWeek = now.getDay()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  weekStart.setHours(0, 0, 0, 0)

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      await createEvent(formData)
      setShowForm(false)
      window.location.reload()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Events</h1>
          <p className="text-sm text-slate-400 mt-1">Upcoming meetings and milestones</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/calendar">
            <Button variant="secondary">
              <Calendar className="h-4 w-4 mr-1" />
              View Calendar
            </Button>
          </a>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            {showForm ? 'Cancel' : 'New Event'}
          </Button>
        </div>
      </div>

      {showForm && (
        <form action={handleCreate} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <input
              name="title"
              placeholder="Event title"
              required
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 lg:col-span-2"
            />
            <input
              name="event_date"
              type="date"
              required
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <input
              name="event_time"
              type="time"
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <select
              name="event_type"
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="internal">Internal</option>
              <option value="client">Client</option>
              <option value="external">External</option>
            </select>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Adding...' : 'Add'}
            </Button>
          </div>
        </form>
      )}

      <Card>
        <CardHeader>
          <CardTitle>This Week</CardTitle>
        </CardHeader>
        <WeekGrid events={initialEvents} weekStart={weekStart} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Upcoming Events</CardTitle>
        </CardHeader>
        <EventList events={initialEvents} />
      </Card>
    </div>
  )
}
