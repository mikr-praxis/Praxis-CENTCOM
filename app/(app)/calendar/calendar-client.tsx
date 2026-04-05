'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  ChevronLeft,
  ChevronRight,
  Link as LinkIcon,
  Unlink,
  Clock,
  MapPin,
  ExternalLink,
} from 'lucide-react'
import type { CalendarEvent } from '@/lib/google/calendar'

type CalendarData = {
  events: CalendarEvent[]
  calendars: { id: string; name: string; color: string; email: string }[]
  userConnected: boolean
}

// ── Helpers ─────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1 // Monday = 0
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ── Component ───────────────────────────────────────────────────────────

export function CalendarClient() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [data, setData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [hiddenCalendars, setHiddenCalendars] = useState<Set<string>>(new Set())
  const [disconnecting, setDisconnecting] = useState(false)

  // Build time range for the visible month (include padding days)
  const fetchEvents = useCallback(async () => {
    setLoading(true)
    const start = new Date(year, month, 1)
    start.setDate(start.getDate() - getFirstDayOfWeek(year, month))
    const end = new Date(year, month + 1, 0)
    const remaining = 6 - (end.getDay() === 0 ? 6 : end.getDay() - 1)
    end.setDate(end.getDate() + remaining)
    end.setHours(23, 59, 59)

    try {
      const res = await fetch(
        `/api/calendar?start=${start.toISOString()}&end=${end.toISOString()}`
      )
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (err) {
      console.error('Failed to fetch calendar:', err)
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const prev = () => {
    if (month === 0) { setMonth(11); setYear(year - 1) }
    else setMonth(month - 1)
  }

  const next = () => {
    if (month === 11) { setMonth(0); setYear(year + 1) }
    else setMonth(month + 1)
  }

  const goToday = () => {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
    setSelectedDay(today)
  }

  const toggleCalendar = (id: string) => {
    setHiddenCalendars((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      await fetch('/api/auth/google/disconnect', { method: 'POST' })
      fetchEvents()
    } finally {
      setDisconnecting(false)
    }
  }

  // ── Build grid ──────────────────────────────────────────────────────

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7

  const visibleEvents = (data?.events || []).filter(
    (e) => !hiddenCalendars.has(e.calendarId)
  )

  const eventsForDay = (date: Date) =>
    visibleEvents.filter((e) => {
      const start = new Date(e.start)
      if (e.allDay) {
        const end = new Date(e.end)
        return date >= new Date(start.getFullYear(), start.getMonth(), start.getDate()) &&
               date < new Date(end.getFullYear(), end.getMonth(), end.getDate())
      }
      return isSameDay(start, date)
    })

  const selectedEvents = selectedDay ? eventsForDay(selectedDay) : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Calendar</h1>
          <p className="text-sm text-slate-400 mt-1">
            Ops schedule + your personal calendar
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data?.userConnected ? (
            <Button
              variant="secondary"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              <Unlink className="h-4 w-4 mr-1" />
              {disconnecting ? 'Disconnecting...' : 'Disconnect Google'}
            </Button>
          ) : (
            <a href="/api/auth/google">
              <Button variant="secondary">
                <LinkIcon className="h-4 w-4 mr-1" />
                Connect Google Calendar
              </Button>
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar grid — 3 cols */}
        <div className="lg:col-span-3">
          <Card className="p-0 overflow-hidden">
            {/* Month nav */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
              <div className="flex items-center gap-3">
                <button
                  onClick={prev}
                  className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-slate-200"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-lg font-semibold text-slate-100 min-w-[200px] text-center">
                  {MONTH_NAMES[month]} {year}
                </h2>
                <button
                  onClick={next}
                  className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-slate-200"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              <button
                onClick={goToday}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
              >
                Today
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-slate-700/50">
              {DAY_NAMES.map((d) => (
                <div
                  key={d}
                  className="px-2 py-2 text-center text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            {loading ? (
              <div className="flex items-center justify-center h-96 text-slate-500">
                Loading calendar...
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {Array.from({ length: totalCells }, (_, i) => {
                  const dayNum = i - firstDay + 1
                  const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth
                  const date = new Date(year, month, dayNum)
                  const isToday = isSameDay(date, today)
                  const isSelected = selectedDay && isSameDay(date, selectedDay)
                  const dayEvents = isCurrentMonth ? eventsForDay(date) : []

                  return (
                    <button
                      key={i}
                      onClick={() => isCurrentMonth && setSelectedDay(date)}
                      className={`
                        min-h-[90px] p-1.5 border-b border-r border-slate-700/30 text-left
                        transition-colors relative
                        ${isCurrentMonth ? 'hover:bg-slate-800/50 cursor-pointer' : 'opacity-30 cursor-default'}
                        ${isSelected ? 'bg-amber-500/10 ring-1 ring-amber-500/30' : ''}
                      `}
                    >
                      <span
                        className={`
                          inline-flex items-center justify-center w-7 h-7 text-xs rounded-full
                          ${isToday ? 'bg-amber-500 text-slate-900 font-bold' : 'text-slate-400'}
                        `}
                      >
                        {isCurrentMonth ? dayNum : new Date(year, month, dayNum).getDate()}
                      </span>

                      <div className="mt-0.5 space-y-0.5 overflow-hidden">
                        {dayEvents.slice(0, 3).map((ev) => (
                          <div
                            key={ev.id}
                            className="flex items-center gap-1 px-1 py-0.5 rounded text-[10px] leading-tight truncate"
                            style={{
                              backgroundColor: `${ev.color}15`,
                              color: ev.color,
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: ev.color }}
                            />
                            <span className="truncate">{ev.title}</span>
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[10px] text-slate-500 pl-1">
                            +{dayEvents.length - 3} more
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar — 1 col */}
        <div className="space-y-4">
          {/* Calendar layers */}
          <Card className="p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Calendars</h3>
            {(data?.calendars || []).length === 0 && !loading && (
              <p className="text-xs text-slate-500">
                No calendars connected yet. Connect Google to get started.
              </p>
            )}
            <div className="space-y-2">
              {(data?.calendars || []).map((cal) => (
                <label
                  key={cal.id}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={!hiddenCalendars.has(cal.id)}
                    onChange={() => toggleCalendar(cal.id)}
                    className="sr-only"
                  />
                  <span
                    className={`w-3 h-3 rounded-sm flex-shrink-0 border transition-colors ${
                      hiddenCalendars.has(cal.id)
                        ? 'border-slate-600 bg-transparent'
                        : 'border-transparent'
                    }`}
                    style={{
                      backgroundColor: hiddenCalendars.has(cal.id)
                        ? 'transparent'
                        : cal.color,
                    }}
                  />
                  <span className="text-sm text-slate-300 group-hover:text-slate-100 truncate">
                    {cal.name}
                  </span>
                </label>
              ))}
            </div>
          </Card>

          {/* Selected day detail */}
          <Card className="p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-3">
              {selectedDay
                ? selectedDay.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })
                : 'Select a day'}
            </h3>

            {!selectedDay && (
              <p className="text-xs text-slate-500">
                Click a date to see event details.
              </p>
            )}

            {selectedDay && selectedEvents.length === 0 && (
              <p className="text-xs text-slate-500">No events this day.</p>
            )}

            <div className="space-y-3 mt-2">
              {selectedEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-lg border border-slate-700/50 p-3 space-y-1.5"
                  style={{ borderLeftColor: ev.color, borderLeftWidth: 3 }}
                >
                  <p className="text-sm font-medium text-slate-200">{ev.title}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    {!ev.allDay && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(ev.start)} – {formatTime(ev.end)}
                      </span>
                    )}
                    {ev.allDay && <span>All day</span>}
                    <span
                      className="flex items-center gap-1"
                      style={{ color: ev.color }}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: ev.color }}
                      />
                      {ev.calendarName}
                    </span>
                  </div>
                  {ev.location && (
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {ev.location}
                    </p>
                  )}
                  {ev.htmlLink && (
                    <a
                      href={ev.htmlLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 mt-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open in Google Calendar
                    </a>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
