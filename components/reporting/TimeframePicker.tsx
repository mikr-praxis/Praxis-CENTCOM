'use client'

import { useEffect, useState } from 'react'
import { Calendar, Database, Flag, Plus, Trash2, X } from 'lucide-react'

export type TimeframePreset =
  | '7d'
  | '30d'
  | '90d'
  | 'qtd'
  | 'ytd'
  | 'all'
  | 'custom'
  // Data-relative (anchored on last data point)
  | 'data_7d'
  | 'data_30d'
  | 'data_90d'
  | 'data_all'
  // Event-relative (specific to an event)
  | 'event'

export type TimeframeMode = 'calendar' | 'data' | 'event'

export interface TimeframeValue {
  preset: TimeframePreset
  start: string | null
  end: string | null
  /** Optional event metadata when preset === 'event' */
  event?: {
    id: string
    name: string
    relation: 'since' | 'around' | 'between' | 'before'
    /** Days before/after when relation === 'around' */
    around_days?: number
    /** Second event ID when relation === 'between' */
    second_event_id?: string
  } | null
}

const CAL_PRESETS: { id: TimeframePreset; label: string }[] = [
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
  { id: 'qtd', label: 'QTD' },
  { id: 'ytd', label: 'YTD' },
  { id: 'all', label: 'All' },
]

const DATA_PRESETS: { id: TimeframePreset; label: string }[] = [
  { id: 'data_7d', label: 'Last 7d of data' },
  { id: 'data_30d', label: 'Last 30d of data' },
  { id: 'data_90d', label: 'Last 90d of data' },
  { id: 'data_all', label: 'All data' },
]

interface DateRange {
  global_min: string | null
  global_max: string | null
  span_days: number | null
}

interface ClientEvent {
  id: string
  event_name: string
  event_date: string
  event_type: string | null
  notes: string | null
}

interface Props {
  value: TimeframeValue
  onChange: (next: TimeframeValue) => void
  /** Slug enables data-aware + event-aware modes by fetching range and events. Optional. */
  slug?: string
}

function todayDate(): Date {
  return new Date()
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function computeTimeframe(
  preset: TimeframePreset,
  customStart: string | null,
  customEnd: string | null
): TimeframeValue {
  if (preset === 'custom') {
    return { preset, start: customStart, end: customEnd }
  }
  if (preset === 'all' || preset === 'data_all') {
    return { preset, start: null, end: null }
  }
  // Data-relative presets are computed in resolveTimeframe with knowledge of dataRange.
  // When called without dataRange context (e.g., on initial page load), fall back to
  // calendar interpretation so a sensible default still ships.
  const now = todayDate()
  const end = isoDate(now)
  let start: Date
  switch (preset) {
    case '7d':
    case 'data_7d':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case '30d':
    case 'data_30d':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case '90d':
    case 'data_90d':
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      break
    case 'qtd': {
      const q = Math.floor(now.getMonth() / 3)
      start = new Date(now.getFullYear(), q * 3, 1)
      break
    }
    case 'ytd':
      start = new Date(now.getFullYear(), 0, 1)
      break
    default:
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }
  return { preset, start: isoDate(start), end }
}

/** Re-resolve a preset with a known data range. Used after the range loads. */
function resolveDataRelative(preset: TimeframePreset, range: DateRange): TimeframeValue {
  if (!range.global_max) return computeTimeframe(preset, null, null)
  const maxDate = new Date(range.global_max)
  const end = isoDate(maxDate)
  if (preset === 'data_all') {
    return { preset, start: range.global_min ? isoDate(new Date(range.global_min)) : null, end: null }
  }
  let days = 30
  if (preset === 'data_7d') days = 7
  else if (preset === 'data_30d') days = 30
  else if (preset === 'data_90d') days = 90
  const start = new Date(maxDate.getTime() - days * 24 * 60 * 60 * 1000)
  return { preset, start: isoDate(start), end }
}

function resolveEvent(
  events: ClientEvent[],
  eventId: string | undefined,
  relation: 'since' | 'around' | 'between' | 'before',
  aroundDays: number,
  secondEventId: string | undefined
): TimeframeValue {
  const evt = events.find((e) => e.id === eventId)
  if (!evt) return { preset: 'event', start: null, end: null, event: null }
  const evtDate = new Date(evt.event_date)
  const today = todayDate()
  if (relation === 'since') {
    return {
      preset: 'event',
      start: isoDate(evtDate),
      end: isoDate(today),
      event: { id: evt.id, name: evt.event_name, relation: 'since' },
    }
  }
  if (relation === 'before') {
    return {
      preset: 'event',
      start: null,
      end: isoDate(evtDate),
      event: { id: evt.id, name: evt.event_name, relation: 'before' },
    }
  }
  if (relation === 'around') {
    const start = new Date(evtDate.getTime() - aroundDays * 24 * 60 * 60 * 1000)
    const end = new Date(evtDate.getTime() + aroundDays * 24 * 60 * 60 * 1000)
    return {
      preset: 'event',
      start: isoDate(start),
      end: isoDate(end),
      event: { id: evt.id, name: evt.event_name, relation: 'around', around_days: aroundDays },
    }
  }
  // between
  const evt2 = events.find((e) => e.id === secondEventId)
  if (!evt2) return { preset: 'event', start: null, end: null, event: null }
  const d1 = new Date(evt.event_date).getTime()
  const d2 = new Date(evt2.event_date).getTime()
  const startD = isoDate(new Date(Math.min(d1, d2)))
  const endD = isoDate(new Date(Math.max(d1, d2)))
  return {
    preset: 'event',
    start: startD,
    end: endD,
    event: { id: evt.id, name: evt.event_name, relation: 'between', second_event_id: evt2.id },
  }
}

export function TimeframePicker({ value, onChange, slug }: Props) {
  const [mode, setMode] = useState<TimeframeMode>(
    value.preset.startsWith('data_') ? 'data' : value.preset === 'event' ? 'event' : 'calendar'
  )
  const [dataRange, setDataRange] = useState<DateRange | null>(null)
  const [events, setEvents] = useState<ClientEvent[]>([])
  const [showCustom, setShowCustom] = useState(value.preset === 'custom')
  const [customStart, setCustomStart] = useState(value.start ?? '')
  const [customEnd, setCustomEnd] = useState(value.end ?? '')

  // Event-mode local state
  const [eventId, setEventId] = useState<string>(value.event?.id ?? '')
  const [relation, setRelation] = useState<'since' | 'around' | 'between' | 'before'>(
    (value.event?.relation as 'since' | 'around' | 'between' | 'before' | undefined) ?? 'since'
  )
  const [aroundDays, setAroundDays] = useState<number>(value.event?.around_days ?? 7)
  const [secondEventId, setSecondEventId] = useState<string>(value.event?.second_event_id ?? '')

  // Add-event state
  const [addOpen, setAddOpen] = useState(false)
  const [newEventName, setNewEventName] = useState('')
  const [newEventDate, setNewEventDate] = useState('')
  const [newEventType, setNewEventType] = useState<'launch' | 'challenge' | 'webinar' | 'sale' | ''>('')
  const [savingEvent, setSavingEvent] = useState(false)

  // Fetch data range + events when slug provided
  useEffect(() => {
    if (!slug) return
    fetch(`/api/reporting/${slug}/date-range`)
      .then((r) => r.json())
      .then((b) => setDataRange(b))
      .catch(() => {})
    fetch(`/api/reporting/${slug}/events`)
      .then((r) => r.json())
      .then((b) => setEvents(b.events ?? []))
      .catch(() => {})
  }, [slug])

  // When data range arrives and the current preset is data-relative, re-resolve
  useEffect(() => {
    if (!dataRange) return
    if (value.preset.startsWith('data_')) {
      onChange(resolveDataRelative(value.preset, dataRange))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataRange])

  function pickCalendar(p: TimeframePreset) {
    setMode('calendar')
    setShowCustom(false)
    onChange(computeTimeframe(p, null, null))
  }
  function pickData(p: TimeframePreset) {
    setMode('data')
    if (dataRange) onChange(resolveDataRelative(p, dataRange))
    else onChange(computeTimeframe(p, null, null))
  }
  function applyEvent(rel = relation, ad = aroundDays, sid = secondEventId, eid = eventId) {
    setMode('event')
    onChange(resolveEvent(events, eid, rel, ad, sid))
  }
  async function addEvent() {
    if (!slug || !newEventName.trim() || !newEventDate) return
    setSavingEvent(true)
    try {
      const res = await fetch(`/api/reporting/${slug}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: newEventName.trim(),
          event_date: newEventDate,
          event_type: newEventType || null,
        }),
      })
      const body = await res.json()
      if (res.ok && body.event) {
        setEvents((prev) => [body.event, ...prev])
        setEventId(body.event.id)
        setAddOpen(false)
        setNewEventName('')
        setNewEventDate('')
        setNewEventType('')
      }
    } finally {
      setSavingEvent(false)
    }
  }
  async function removeEvent(id: string) {
    if (!slug) return
    if (!confirm('Delete this event?')) return
    const res = await fetch(`/api/reporting/${slug}/events/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setEvents((prev) => prev.filter((e) => e.id !== id))
      if (eventId === id) setEventId('')
      if (secondEventId === id) setSecondEventId('')
    }
  }

  const hasData = dataRange && dataRange.global_min && dataRange.global_max
  const dataSpanLabel = hasData
    ? `${new Date(dataRange.global_min!).toLocaleDateString()} → ${new Date(dataRange.global_max!).toLocaleDateString()} (${dataRange.span_days} days)`
    : null

  return (
    <div className="space-y-2">
      {/* Mode tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-slate-700 p-1 bg-slate-900">
          <ModeBtn
            active={mode === 'calendar'}
            onClick={() => setMode('calendar')}
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="Calendar"
          />
          {slug && (
            <ModeBtn
              active={mode === 'data'}
              onClick={() => setMode('data')}
              icon={<Database className="h-3.5 w-3.5" />}
              label="Data"
              disabled={!hasData}
            />
          )}
          {slug && (
            <ModeBtn
              active={mode === 'event'}
              onClick={() => setMode('event')}
              icon={<Flag className="h-3.5 w-3.5" />}
              label="Event"
            />
          )}
        </div>
        {dataSpanLabel && (
          <span className="text-[10px] text-slate-500 font-mono">{dataSpanLabel}</span>
        )}
        {value.start && value.end && (
          <span className="text-[10px] text-slate-400">
            {new Date(value.start).toLocaleDateString()} → {new Date(value.end).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Calendar mode */}
      {mode === 'calendar' && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-lg border border-slate-700 p-1 bg-slate-900">
            {CAL_PRESETS.map((p) => (
              <PresetBtn key={p.id} active={value.preset === p.id} onClick={() => pickCalendar(p.id)}>
                {p.label}
              </PresetBtn>
            ))}
            <PresetBtn active={value.preset === 'custom' || showCustom} onClick={() => setShowCustom((s) => !s)}>
              Custom
            </PresetBtn>
          </div>
          {showCustom && (
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2 py-1 text-xs rounded-md bg-slate-900 border border-slate-700 text-slate-200"
              />
              <span className="text-xs text-slate-500">→</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2 py-1 text-xs rounded-md bg-slate-900 border border-slate-700 text-slate-200"
              />
              <button
                onClick={() => onChange({ preset: 'custom', start: customStart || null, end: customEnd || null })}
                disabled={!customStart && !customEnd}
                className="px-2 py-1 text-xs rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}

      {/* Data-relative mode */}
      {mode === 'data' && (
        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-700 p-1 bg-slate-900 w-fit">
          {!hasData ? (
            <span className="px-3 py-1 text-xs text-slate-500">No date data detected — sync files first.</span>
          ) : (
            DATA_PRESETS.map((p) => (
              <PresetBtn key={p.id} active={value.preset === p.id} onClick={() => pickData(p.id)}>
                {p.label}
              </PresetBtn>
            ))
          )}
        </div>
      )}

      {/* Event mode */}
      {mode === 'event' && (
        <div className="rounded-lg border border-slate-700 p-3 bg-slate-900 space-y-2">
          {events.length === 0 ? (
            <div className="text-xs text-slate-400">
              No events for this client yet.
              <button
                onClick={() => setAddOpen(true)}
                className="ml-2 inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
              >
                <Plus className="h-3 w-3" /> Add an event
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={eventId}
                  onChange={(e) => {
                    setEventId(e.target.value)
                    applyEvent(relation, aroundDays, secondEventId, e.target.value)
                  }}
                  className="px-2 py-1 text-xs rounded bg-slate-950 border border-slate-700 text-slate-200"
                >
                  <option value="">— pick an event —</option>
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.event_name} ({new Date(e.event_date).toLocaleDateString()})
                    </option>
                  ))}
                </select>
                <select
                  value={relation}
                  onChange={(e) => {
                    const r = e.target.value as 'since' | 'around' | 'between' | 'before'
                    setRelation(r)
                    applyEvent(r, aroundDays, secondEventId, eventId)
                  }}
                  className="px-2 py-1 text-xs rounded bg-slate-950 border border-slate-700 text-slate-200"
                >
                  <option value="since">Since this event</option>
                  <option value="before">Up to this event</option>
                  <option value="around">Around (± days)</option>
                  <option value="between">Between two events</option>
                </select>
                {relation === 'around' && (
                  <input
                    type="number"
                    min={1}
                    value={aroundDays}
                    onChange={(e) => {
                      const n = Number(e.target.value) || 1
                      setAroundDays(n)
                      applyEvent(relation, n, secondEventId, eventId)
                    }}
                    placeholder="±days"
                    className="px-2 py-1 text-xs rounded bg-slate-950 border border-slate-700 text-slate-200"
                  />
                )}
                {relation === 'between' && (
                  <select
                    value={secondEventId}
                    onChange={(e) => {
                      setSecondEventId(e.target.value)
                      applyEvent(relation, aroundDays, e.target.value, eventId)
                    }}
                    className="px-2 py-1 text-xs rounded bg-slate-950 border border-slate-700 text-slate-200"
                  >
                    <option value="">— and this event —</option>
                    {events
                      .filter((ev) => ev.id !== eventId)
                      .map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.event_name} ({new Date(ev.event_date).toLocaleDateString()})
                        </option>
                      ))}
                  </select>
                )}
              </div>

              <details className="text-[11px] text-slate-500">
                <summary className="cursor-pointer hover:text-slate-300">Manage events ({events.length})</summary>
                <div className="mt-2 space-y-1">
                  {events.map((e) => (
                    <div key={e.id} className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-slate-950/50">
                      <span className="text-slate-300 truncate">
                        {e.event_name}{' '}
                        <span className="text-slate-500">
                          · {new Date(e.event_date).toLocaleDateString()}
                          {e.event_type ? ` · ${e.event_type}` : ''}
                        </span>
                      </span>
                      <button
                        onClick={() => removeEvent(e.id)}
                        className="p-1 rounded hover:bg-red-500/10 text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setAddOpen(true)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs text-amber-400 hover:text-amber-300"
                  >
                    <Plus className="h-3 w-3" /> Add event
                  </button>
                </div>
              </details>
            </div>
          )}
        </div>
      )}

      {/* Add event modal */}
      {addOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => !savingEvent && setAddOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white">Add event</h2>
              <button
                onClick={() => !savingEvent && setAddOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              <input
                type="text"
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
                placeholder="Name (e.g. April challenge)"
                className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700 text-sm text-slate-200"
                autoFocus
              />
              <input
                type="date"
                value={newEventDate}
                onChange={(e) => setNewEventDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700 text-sm text-slate-200"
              />
              <select
                value={newEventType}
                onChange={(e) => setNewEventType(e.target.value as 'launch' | 'challenge' | 'webinar' | 'sale' | '')}
                className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700 text-sm text-slate-200"
              >
                <option value="">— optional type —</option>
                <option value="launch">Launch</option>
                <option value="challenge">Challenge</option>
                <option value="webinar">Webinar</option>
                <option value="sale">Sale</option>
              </select>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => !savingEvent && setAddOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800 border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={addEvent}
                  disabled={savingEvent || !newEventName.trim() || !newEventDate}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-medium hover:bg-amber-500/20 disabled:opacity-50"
                >
                  {savingEvent ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ModeBtn({
  active,
  onClick,
  icon,
  label,
  disabled,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        active
          ? 'inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30'
          : 'inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent disabled:opacity-30'
      }
    >
      {icon}
      {label}
    </button>
  )
}

function PresetBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? 'px-3 py-1 text-xs rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30'
          : 'px-3 py-1 text-xs rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
      }
    >
      {children}
    </button>
  )
}
