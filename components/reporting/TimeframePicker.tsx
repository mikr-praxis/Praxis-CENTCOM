'use client'

import { useEffect, useState } from 'react'
import { Calendar, Database, Flag } from 'lucide-react'

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
    /** Source filename + column the event came from */
    filename: string
    column: string
    /** The selected value in that column */
    value: string
    /** Date range derived from rows where column = value */
    date_column?: string | null
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

interface FileColumn {
  filename: string
  columns: string[]
}

interface EventValue {
  value: string
  count: number
  min_date: string | null
  max_date: string | null
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

/**
 * Format a Date as YYYY-MM-DD using LOCAL date components (not UTC). This
 * ensures the date string the engine receives matches what the user sees in
 * the picker, regardless of timezone.
 */
function isoDate(d: Date): string {
  const yr = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const dy = String(d.getDate()).padStart(2, '0')
  return `${yr}-${mo}-${dy}`
}

/** Render a YYYY-MM-DD string as a local date without TZ shift. */
function displayDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  const yr = parseInt(m[1], 10)
  const mo = parseInt(m[2], 10) - 1
  const dy = parseInt(m[3], 10)
  return new Date(yr, mo, dy).toLocaleDateString()
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

function resolveEventValue(
  filename: string,
  column: string,
  evt: EventValue,
  dateColumn: string | null
): TimeframeValue {
  const start = evt.min_date ? isoDate(new Date(evt.min_date)) : null
  const end = evt.max_date ? isoDate(new Date(evt.max_date)) : null
  return {
    preset: 'event',
    start,
    end,
    event: { filename, column, value: evt.value, date_column: dateColumn },
  }
}

export function TimeframePicker({ value, onChange, slug }: Props) {
  const [mode, setMode] = useState<TimeframeMode>(
    value.preset.startsWith('data_') ? 'data' : value.preset === 'event' ? 'event' : 'calendar'
  )
  const [dataRange, setDataRange] = useState<DateRange | null>(null)
  const [showCustom, setShowCustom] = useState(value.preset === 'custom')
  const [customStart, setCustomStart] = useState(value.start ?? '')
  const [customEnd, setCustomEnd] = useState(value.end ?? '')

  // Event-mode (column-driven) state
  const [files, setFiles] = useState<FileColumn[]>([])
  const [evtFile, setEvtFile] = useState<string>(value.event?.filename ?? '')
  const [evtColumn, setEvtColumn] = useState<string>(value.event?.column ?? '')
  const [evtValues, setEvtValues] = useState<EventValue[]>([])
  const [evtDateColumn, setEvtDateColumn] = useState<string | null>(value.event?.date_column ?? null)
  const [evtValuesLoading, setEvtValuesLoading] = useState(false)
  const [evtError, setEvtError] = useState<string | null>(null)

  // Fetch data range + file columns when slug provided
  useEffect(() => {
    if (!slug) return
    fetch(`/api/reporting/${slug}/date-range`)
      .then((r) => r.json())
      .then((b) => setDataRange(b))
      .catch(() => {})
    // Load each file's columns from the inspect-friendly endpoint via report_raw_files
    fetch(`/api/reporting/${slug}/kpis`)
      .then(async () => {
        // Use date-range endpoint's per-file output to drive file list (already shape-compatible with FileColumn-ish)
        const res = await fetch(`/api/reporting/${slug}/date-range`)
        const body = await res.json()
        const list: FileColumn[] = (body.files ?? []).map((f: { filename: string; date_columns: { column: string }[] }) => ({
          filename: f.filename,
          columns: [], // filled lazily when user selects a file
        }))
        setFiles(list)
      })
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

  // Load all columns of selected file
  useEffect(() => {
    if (!slug || !evtFile) return
    fetch(`/api/reporting/${slug}/files/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: evtFile }),
    })
      .then((r) => r.json())
      .then((b) => {
        const cols = (b.columns ?? []).map((c: { name: string }) => c.name)
        setFiles((prev) => prev.map((f) => (f.filename === evtFile ? { ...f, columns: cols } : f)))
      })
      .catch(() => {})
  }, [slug, evtFile])

  // Load distinct values when file+column chosen
  useEffect(() => {
    if (!slug || !evtFile || !evtColumn) {
      setEvtValues([])
      return
    }
    setEvtValuesLoading(true)
    setEvtError(null)
    fetch(`/api/reporting/${slug}/event-column/values`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: evtFile, column: evtColumn }),
    })
      .then(async (r) => {
        const b = await r.json()
        if (!r.ok) throw new Error(b.error || 'Load failed')
        setEvtValues(b.values ?? [])
        setEvtDateColumn(b.date_column ?? null)
      })
      .catch((e) => {
        setEvtError(e instanceof Error ? e.message : 'Load failed')
        setEvtValues([])
      })
      .finally(() => setEvtValuesLoading(false))
  }, [slug, evtFile, evtColumn])

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
  function pickEventValue(value: string) {
    if (!value) {
      // Clear event but stay in event mode
      onChange({ preset: 'event', start: null, end: null, event: null })
      return
    }
    const evt = evtValues.find((v) => v.value === value)
    if (!evt) return
    setMode('event')
    onChange(resolveEventValue(evtFile, evtColumn, evt, evtDateColumn))
  }

  const hasData = dataRange && dataRange.global_min && dataRange.global_max
  const dataSpanLabel = hasData
    ? `${displayDate(dataRange.global_min!.slice(0, 10))} → ${displayDate(dataRange.global_max!.slice(0, 10))} (${dataRange.span_days} days)`
    : null
  const selectedFile = files.find((f) => f.filename === evtFile) ?? null

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
            {displayDate(value.start)} → {displayDate(value.end)}
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

      {/* Event mode (column-driven) */}
      {mode === 'event' && (
        <div className="rounded-lg border border-slate-700 p-3 bg-slate-900 space-y-2">
          <p className="text-[11px] text-slate-400">
            Pick a column from your data — its distinct values become event options. Selecting one filters to its date range.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select
              value={evtFile}
              onChange={(e) => {
                setEvtFile(e.target.value)
                setEvtColumn('')
              }}
              className="px-2 py-1 text-xs rounded bg-slate-950 border border-slate-700 text-slate-200"
            >
              <option value="">— file —</option>
              {files.map((f) => (
                <option key={f.filename} value={f.filename}>
                  {f.filename}
                </option>
              ))}
            </select>
            <select
              value={evtColumn}
              onChange={(e) => setEvtColumn(e.target.value)}
              disabled={!selectedFile || selectedFile.columns.length === 0}
              className="px-2 py-1 text-xs rounded bg-slate-950 border border-slate-700 text-slate-200 disabled:opacity-50"
            >
              <option value="">— column —</option>
              {selectedFile?.columns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={value.event?.value ?? ''}
              onChange={(e) => pickEventValue(e.target.value)}
              disabled={!evtColumn || evtValuesLoading || evtValues.length === 0}
              className="px-2 py-1 text-xs rounded bg-slate-950 border border-slate-700 text-slate-200 disabled:opacity-50"
            >
              <option value="">
                {evtValuesLoading ? 'Loading…' : evtValues.length === 0 ? '— event —' : '— pick event —'}
              </option>
              {evtValues.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.value} ({v.count} rows{v.max_date ? ` · ${new Date(v.max_date).toLocaleDateString()}` : ''})
                </option>
              ))}
            </select>
          </div>
          {evtError && <p className="text-[11px] text-red-400">{evtError}</p>}
          {evtColumn && !evtError && evtValues.length === 0 && !evtValuesLoading && (
            <p className="text-[11px] text-slate-500">
              No values in that column.
            </p>
          )}
          {evtDateColumn && (
            <p className="text-[11px] text-slate-500">
              Date column: <span className="font-mono text-slate-400">{evtDateColumn}</span>
            </p>
          )}
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
