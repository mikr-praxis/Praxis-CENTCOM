'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
  AlertCircle,
  CalendarCheck,
  Flame,
  RefreshCw,
  Plus,
  X,
  LayoutGrid,
  List,
  Shield,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { TaskDeadlineModule } from '@/components/calendar/TaskDeadlineModule'
import type { CalendarEvent } from '@/lib/google/calendar'
import type { TeamCalendar } from '@/app/api/calendar/route'

type CalendarData = {
  events: CalendarEvent[]
  calendars: TeamCalendar[]
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

function formatRelativeDay(date: Date, today: Date): string {
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diff = Math.round((dateStart.getTime() - todayStart.getTime()) / 86400000)

  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff < 7) return date.toLocaleDateString('en-US', { weekday: 'long' })
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

type PriorityLevel = 'urgent' | 'upcoming' | 'later'

function getPriority(eventStart: Date, now: Date): PriorityLevel {
  const hoursUntil = (eventStart.getTime() - now.getTime()) / 3600000
  if (hoursUntil < 0) return 'urgent'
  if (hoursUntil < 24) return 'urgent'
  if (hoursUntil < 72) return 'upcoming'
  return 'later'
}

const PRIORITY_CONFIG: Record<PriorityLevel, { label: string; color: string; bg: string; icon: typeof Flame }> = {
  urgent:   { label: 'Now / Next 24h', color: 'text-red-400',    bg: 'bg-red-500/10',    icon: Flame },
  upcoming: { label: 'Next 3 Days',    color: 'text-amber-400',  bg: 'bg-amber-500/10',  icon: AlertCircle },
  later:    { label: 'This Week+',     color: 'text-slate-400',  bg: 'bg-slate-500/10',  icon: CalendarCheck },
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const AUTO_REFRESH_MS = 60_000 // 60 seconds

// ── Skeleton Components ────────────────────────────────────────────────

function GridSkeleton() {
  return (
    <div className="grid grid-cols-7 animate-pulse">
      {Array.from({ length: 35 }, (_, i) => (
        <div
          key={i}
          className="min-h-[60px] sm:min-h-[90px] p-1.5 border-b border-r border-slate-700/30"
        >
          <div className="w-7 h-7 rounded-full bg-slate-700/40 mb-1" />
          {i % 3 === 0 && <div className="h-3 w-3/4 rounded bg-slate-700/30 mb-0.5" />}
          {i % 5 === 0 && <div className="h-3 w-1/2 rounded bg-slate-700/30" />}
        </div>
      ))}
    </div>
  )
}

function SidebarSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-slate-700/40" />
          <div className="h-3 w-24 rounded bg-slate-700/30" />
        </div>
      ))}
    </div>
  )
}

// ── Component ───────────────────────────────────────────────────────────

export function CalendarClient() {
  const today = new Date()

  // Read initial month/year from URL params
  const getInitialParams = () => {
    if (typeof window === 'undefined') return { y: today.getFullYear(), m: today.getMonth() }
    const params = new URLSearchParams(window.location.search)
    const y = params.get('y')
    const m = params.get('m')
    return {
      y: y ? parseInt(y, 10) : today.getFullYear(),
      m: m ? parseInt(m, 10) : today.getMonth(),
    }
  }

  const initial = getInitialParams()
  const [year, setYear] = useState(initial.y)
  const [month, setMonth] = useState(initial.m)
  const [data, setData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [hiddenCalendars, setHiddenCalendars] = useState<Set<string>>(new Set())
  const [disconnecting, setDisconnecting] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showQuickCreate, setShowQuickCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastFetchRef = useRef<number>(0)

  // Sync URL params when month/year changes
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('y', String(year))
    url.searchParams.set('m', String(month))
    window.history.replaceState({}, '', url.toString())
  }, [year, month])

  // Build time range for the visible month (include padding days)
  const fetchEvents = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

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
        lastFetchRef.current = Date.now()
      }
    } catch (err) {
      console.error('Failed to fetch calendar:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [year, month])

  // Initial fetch + auto-refresh
  useEffect(() => {
    fetchEvents()

    // Auto-refresh every 60s
    refreshTimerRef.current = setInterval(() => {
      fetchEvents(true)
    }, AUTO_REFRESH_MS)

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    }
  }, [fetchEvents])

  // Refresh on tab visibility change
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Only refresh if stale (> 30s since last fetch)
        if (Date.now() - lastFetchRef.current > 30_000) {
          fetchEvents(true)
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [fetchEvents])

  // Detect mobile for default view
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setViewMode('list')
    }
  }, [])

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

  const handleQuickCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setCreating(true)
    const form = new FormData(e.currentTarget)

    try {
      const res = await fetch('/api/calendar/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.get('title'),
          date: form.get('date'),
          startTime: form.get('startTime'),
          endTime: form.get('endTime'),
          allDay: !form.get('startTime'),
        }),
      })
      if (res.ok) {
        setShowQuickCreate(false)
        fetchEvents(true)
      }
    } catch (err) {
      console.error('Failed to create event:', err)
    } finally {
      setCreating(false)
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

  // ── Priority task list ────────────────────────────────────────────────

  const priorityEvents = useMemo(() => {
    const now = new Date()
    const cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() + 14)

    const upcoming = visibleEvents
      .filter((e) => {
        const start = new Date(e.start)
        const end = new Date(e.end)
        return end >= now && start <= cutoff
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

    const grouped: Record<PriorityLevel, (CalendarEvent & { priority: PriorityLevel })[]> = {
      urgent: [],
      upcoming: [],
      later: [],
    }

    for (const ev of upcoming) {
      const p = getPriority(new Date(ev.start), now)
      grouped[p].push({ ...ev, priority: p })
    }

    return grouped
  }, [visibleEvents])

  const totalPriorityCount =
    priorityEvents.urgent.length +
    priorityEvents.upcoming.length +
    priorityEvents.later.length

  // ── Mobile list view data ──────────────────────────────────────────────

  const listViewEvents = useMemo(() => {
    // Group visible events by day for the current month
    const days: { date: Date; events: CalendarEvent[] }[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      const dayEvts = eventsForDay(date)
      if (dayEvts.length > 0) {
        days.push({ date, events: dayEvts })
      }
    }
    return days
  }, [visibleEvents, year, month, daysInMonth])

  // Team calendar stats
  const calendarStats = useMemo(() => {
    const cals = data?.calendars || []
    return {
      total: cals.length,
      accessible: cals.filter(c => c.hasAccess).length,
      ops: cals.filter(c => c.isOps),
      team: cals.filter(c => !c.isOps),
    }
  }, [data?.calendars])

  return (
    <div className="space-y-6">
      {/* Refresh progress bar */}
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 h-0.5">
          <div className="h-full bg-amber-500 animate-pulse" style={{ width: '100%' }} />
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Calendar</h1>
          <p className="text-sm text-slate-400 mt-1">
            {calendarStats.accessible > 0
              ? `${calendarStats.accessible} calendar${calendarStats.accessible !== 1 ? 's' : ''} connected`
              : 'Ops schedule + team calendars'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle — mobile only */}
          <div className="flex items-center rounded-lg border border-slate-700/50 overflow-hidden sm:hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-amber-500/15 text-amber-400' : 'text-slate-400'}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-amber-500/15 text-amber-400' : 'text-slate-400'}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <Button
            variant="secondary"
            onClick={() => fetchEvents(true)}
            disabled={refreshing}
            className="hidden sm:flex"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="secondary"
            onClick={() => setShowQuickCreate(!showQuickCreate)}
          >
            {showQuickCreate ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            <span className="hidden sm:inline">{showQuickCreate ? 'Cancel' : 'Quick Event'}</span>
          </Button>

          {data?.userConnected ? (
            <Button
              variant="secondary"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              <Unlink className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">{disconnecting ? 'Disconnecting...' : 'Disconnect'}</span>
            </Button>
          ) : (
            <a href="/api/auth/google">
              <Button variant="secondary">
                <LinkIcon className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Connect Google</span>
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Quick Create Form */}
      {showQuickCreate && (
        <form
          onSubmit={handleQuickCreate}
          className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <input
              name="title"
              placeholder="Event title"
              required
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 sm:col-span-2 lg:col-span-2"
            />
            <input
              name="date"
              type="date"
              required
              defaultValue={
                selectedDay
                  ? selectedDay.toISOString().split('T')[0]
                  : today.toISOString().split('T')[0]
              }
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <input
              name="startTime"
              type="time"
              placeholder="Start"
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <input
              name="endTime"
              type="time"
              placeholder="End"
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <Button type="submit" disabled={creating} className="w-full sm:w-auto">
              {creating ? 'Adding...' : 'Add to Ops'}
            </Button>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            Events are added to the Praxis Ops calendar. Leave times blank for all-day events.
          </p>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar grid / list — 3 cols */}
        <div className="lg:col-span-3">
          <Card className="p-0 overflow-hidden">
            {/* Month nav */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
              <div className="flex items-center gap-3">
                <button
                  onClick={prev}
                  className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 active:scale-95 transition-transform"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-base sm:text-lg font-semibold text-slate-100 min-w-[160px] sm:min-w-[200px] text-center">
                  {MONTH_NAMES[month]} {year}
                </h2>
                <button
                  onClick={next}
                  className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 active:scale-95 transition-transform"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                {/* Desktop view toggle */}
                <div className="hidden sm:flex items-center rounded-lg border border-slate-700/50 overflow-hidden">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-amber-500/15 text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-amber-500/15 text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
                <button
                  onClick={goToday}
                  className="px-3 py-2 min-h-[44px] text-xs font-medium rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 active:scale-95 transition-transform"
                >
                  Today
                </button>
              </div>
            </div>

            {/* Grid View */}
            {viewMode === 'grid' && (
              <>
                {/* Day headers */}
                <div className="grid grid-cols-7 border-b border-slate-700/50">
                  {DAY_NAMES.map((d) => (
                    <div
                      key={d}
                      className="px-1 sm:px-2 py-2 text-center text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider"
                    >
                      <span className="sm:hidden">{d[0]}</span>
                      <span className="hidden sm:inline">{d}</span>
                    </div>
                  ))}
                </div>

                {/* Day cells */}
                {loading ? (
                  <GridSkeleton />
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
                            min-h-[60px] sm:min-h-[90px] p-1 sm:p-1.5 border-b border-r border-slate-700/30 text-left
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
              </>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <div className="divide-y divide-slate-700/30">
                {loading ? (
                  <div className="p-6 space-y-3 animate-pulse">
                    {Array.from({ length: 6 }, (_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-slate-700/40" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 w-1/3 rounded bg-slate-700/30" />
                          <div className="h-2.5 w-1/2 rounded bg-slate-700/20" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : listViewEvents.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm">
                    No events this month
                  </div>
                ) : (
                  listViewEvents.map(({ date, events }) => (
                    <div key={date.toISOString()} className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`
                            inline-flex items-center justify-center w-8 h-8 text-xs font-bold rounded-full
                            ${isSameDay(date, today) ? 'bg-amber-500 text-slate-900' : 'bg-slate-700/50 text-slate-300'}
                          `}
                        >
                          {date.getDate()}
                        </span>
                        <div>
                          <p className={`text-sm font-medium ${isSameDay(date, today) ? 'text-amber-400' : 'text-slate-300'}`}>
                            {date.toLocaleDateString('en-US', { weekday: 'long' })}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                          </p>
                        </div>
                        <span className="ml-auto text-[10px] text-slate-500">
                          {events.length} event{events.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="space-y-1.5 pl-10">
                        {events.map((ev) => (
                          <div
                            key={ev.id}
                            className="flex items-start gap-2 rounded-lg px-3 py-2 border border-slate-700/40 hover:border-slate-600/50 transition-colors"
                            style={{ borderLeftColor: ev.color, borderLeftWidth: 3 }}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-200 truncate">{ev.title}</p>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                                {!ev.allDay ? (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatTime(ev.start)} – {formatTime(ev.end)}
                                  </span>
                                ) : (
                                  <span>All day</span>
                                )}
                                <span style={{ color: ev.color }}>{ev.calendarName}</span>
                              </div>
                            </div>
                            {ev.htmlLink && (
                              <a
                                href={ev.htmlLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-shrink-0 p-1 rounded hover:bg-slate-700/50 text-slate-500 hover:text-slate-300"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Right sidebar — 1 col */}
        <div className="space-y-4">

          {/* ── Priority Task List ──────────────────────────────────── */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-amber-400" />
                Priority
              </h3>
              {totalPriorityCount > 0 && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                  {totalPriorityCount}
                </span>
              )}
            </div>

            {totalPriorityCount === 0 && !loading && (
              <p className="text-xs text-slate-500">
                No upcoming events. Connect Google Calendar to see your schedule.
              </p>
            )}

            <div className="space-y-4">
              {(['urgent', 'upcoming', 'later'] as PriorityLevel[]).map((level) => {
                const items = priorityEvents[level]
                if (items.length === 0) return null
                const config = PRIORITY_CONFIG[level]
                const Icon = config.icon

                return (
                  <div key={level}>
                    <div className={`flex items-center gap-1.5 mb-2 ${config.color}`}>
                      <Icon className="h-3 w-3" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider">
                        {config.label}
                      </span>
                      <span className="text-[10px] opacity-60">({items.length})</span>
                    </div>
                    <div className="space-y-1.5">
                      {items.slice(0, 5).map((ev) => {
                        const start = new Date(ev.start)
                        return (
                          <button
                            key={ev.id}
                            onClick={() => setSelectedDay(start)}
                            className={`
                              w-full text-left rounded-lg px-2.5 py-2 border transition-colors
                              border-slate-700/40 hover:border-slate-600/60 hover:bg-slate-800/40
                            `}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-medium text-slate-200 leading-tight truncate">
                                {ev.title}
                              </p>
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                                style={{ backgroundColor: ev.color }}
                              />
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                              <span>{formatRelativeDay(start, today)}</span>
                              {!ev.allDay && (
                                <span className="flex items-center gap-0.5">
                                  <Clock className="h-2.5 w-2.5" />
                                  {formatTime(ev.start)}
                                </span>
                              )}
                            </div>
                          </button>
                        )
                      })}
                      {items.length > 5 && (
                        <p className="text-[10px] text-slate-500 pl-2.5">
                          +{items.length - 5} more
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* ── Team Calendars ─────────────────────────────────────── */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
                <Users className="h-4 w-4 text-slate-400" />
                Team Calendars
              </h3>
              {calendarStats.total > 0 && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-500/10 text-slate-400">
                  {calendarStats.accessible}/{calendarStats.total}
                </span>
              )}
            </div>

            {loading ? (
              <SidebarSkeleton />
            ) : (data?.calendars || []).length === 0 ? (
              <p className="text-xs text-slate-500">
                No calendars connected yet. Connect Google to get started.
              </p>
            ) : (
              <div className="space-y-1">
                {/* Ops calendars first */}
                {calendarStats.ops.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Ops
                    </p>
                    {calendarStats.ops.map((cal) => (
                      <CalendarToggle
                        key={cal.id}
                        cal={cal}
                        hidden={hiddenCalendars.has(cal.id)}
                        onToggle={() => toggleCalendar(cal.id)}
                      />
                    ))}
                  </div>
                )}

                {/* Team member calendars */}
                {calendarStats.team.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Team
                    </p>
                    {calendarStats.team.map((cal) => (
                      <CalendarToggle
                        key={cal.id}
                        cal={cal}
                        hidden={hiddenCalendars.has(cal.id)}
                        onToggle={() => toggleCalendar(cal.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* ── Selected day detail ─────────────────────────────────── */}
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
      {/* Task Deadline Module — full width below calendar */}
      <TaskDeadlineModule calendarEvents={visibleEvents} />
    </div>
  )
}

// ── Calendar Toggle Sub-component ──────────────────────────────────────

function CalendarToggle({
  cal,
  hidden,
  onToggle,
}: {
  cal: TeamCalendar
  hidden: boolean
  onToggle: () => void
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group py-1 px-1 rounded-lg hover:bg-slate-800/40 transition-colors">
      <input
        type="checkbox"
        checked={!hidden}
        onChange={onToggle}
        className="sr-only"
      />
      <span
        className={`w-3 h-3 rounded-sm flex-shrink-0 border transition-colors ${
          hidden ? 'border-slate-600 bg-transparent' : 'border-transparent'
        }`}
        style={{
          backgroundColor: hidden ? 'transparent' : cal.color,
        }}
      />
      <span className="text-sm text-slate-300 group-hover:text-slate-100 truncate flex-1">
        {cal.name}
      </span>
      {cal.role && (
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-700/50 text-slate-500 flex-shrink-0">
          {cal.role}
        </span>
      )}
      {cal.hasAccess ? (
        <Shield className="h-3 w-3 text-emerald-500/60 flex-shrink-0" title="Connected" />
      ) : (
        <ShieldAlert className="h-3 w-3 text-red-400/60 flex-shrink-0" title="Calendar not shared — ask team member to share with mscott@builtbypraxis.com" />
      )}
    </label>
  )
}
