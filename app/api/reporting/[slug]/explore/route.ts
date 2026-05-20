/**
 * Studio Builder data endpoint.
 *
 *   POST /api/reporting/[slug]/explore
 *   Body: {
 *     source_id: "drive:sales.csv" | "posthog:opt_ins" | ...,
 *     measure_column: "revenue" | "value",
 *     measure_op: "sum" | "count" | "avg" | "min" | "max",
 *     dimension_column: "date" | "rep" | "ts" | ...,
 *     dimension_granularity?: "day" | "week" | "month" | "auto",
 *     chart_type: "line" | "bar" | "pie" | "table",
 *     timeframe?: { start: string | null, end: string | null },
 *     limit?: number   // max points returned (default 50)
 *   }
 *
 * Returns: {
 *   chart_type, points: [{ bucket, value }], rows_used, warning?: string
 * }
 *
 * v1: intra-source only. Cross-source picks are detected by source_id mismatch
 * between measure/dimension callers — but in v1 the body only has one source_id
 * so this can't happen. The UI surfaces the "cross-source coming in v2" message
 * client-side before calling this endpoint.
 */
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'

interface ExploreBody {
  source_id: string
  measure_column: string
  measure_op?: 'sum' | 'count' | 'avg' | 'min' | 'max'
  dimension_column: string
  dimension_granularity?: 'day' | 'week' | 'month' | 'auto'
  chart_type: 'line' | 'bar' | 'pie' | 'table'
  timeframe?: { start: string | null; end: string | null }
  limit?: number
}

interface ChartPoint {
  bucket: string
  value: number | null
}

function toNumber(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).replace(/[$,\s%]/g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function parseLooseDate(s: string): Date | null {
  if (!s) return null
  const dateOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (dateOnly) {
    const dt = new Date(
      parseInt(dateOnly[1], 10),
      parseInt(dateOnly[2], 10) - 1,
      parseInt(dateOnly[3], 10)
    )
    if (!Number.isNaN(dt.getTime())) return dt
  }
  const iso = new Date(s)
  if (!Number.isNaN(iso.getTime())) return iso
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (m) {
    let yr = parseInt(m[3], 10)
    if (yr < 100) yr += 2000
    const dt = new Date(yr, parseInt(m[1], 10) - 1, parseInt(m[2], 10))
    if (!Number.isNaN(dt.getTime())) return dt
  }
  return null
}

function bucketStart(date: Date, gran: 'day' | 'week' | 'month'): Date {
  if (gran === 'day') return new Date(date.getFullYear(), date.getMonth(), date.getDate())
  if (gran === 'week') {
    const day = date.getDay() || 7
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() - (day - 1))
  }
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function bucketKey(date: Date): string {
  const yr = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  const dy = String(date.getDate()).padStart(2, '0')
  return `${yr}-${mo}-${dy}`
}

function pickGranularity(timeframe?: { start: string | null; end: string | null }): 'day' | 'week' | 'month' {
  if (!timeframe?.start || !timeframe?.end) return 'week'
  const s = parseLooseDate(timeframe.start)?.getTime()
  const e = parseLooseDate(timeframe.end)?.getTime()
  if (!s || !e) return 'week'
  const days = (e - s) / (24 * 60 * 60 * 1000)
  if (days <= 14) return 'day'
  if (days <= 120) return 'week'
  return 'month'
}

interface ExternalFactRow {
  ts: string
  value: number | string | null
  dimensions: Record<string, unknown> | null
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  let body: ExploreBody
  try {
    body = (await request.json()) as ExploreBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.source_id || !body.measure_column || !body.dimension_column) {
    return NextResponse.json(
      { error: 'source_id, measure_column, and dimension_column are required' },
      { status: 400 }
    )
  }
  const op = body.measure_op ?? 'sum'
  const limit = Math.max(1, Math.min(500, body.limit ?? 50))

  const supabase = createServerClient()
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id')
    .eq('slug', slug)
    .single()
  if (clientErr || !client) {
    return NextResponse.json({ error: `Client not found: ${slug}` }, { status: 404 })
  }

  // Pull rows for the selected source.
  let rows: Record<string, unknown>[] = []
  let isDateDimension = false

  if (body.source_id.startsWith('drive:')) {
    const filename = body.source_id.slice('drive:'.length)
    const { data: fileRow } = await supabase
      .from('report_raw_files')
      .select('rows, columns')
      .eq('client_id', client.id)
      .eq('filename', filename)
      .maybeSingle()
    if (!fileRow) {
      return NextResponse.json({ error: `Source not synced: ${filename}` }, { status: 404 })
    }
    rows = Array.isArray(fileRow.rows) ? (fileRow.rows as Record<string, unknown>[]) : []
  } else {
    // External fact source: <source_type>:<kind>
    const [sourceType, kind] = body.source_id.split(':')
    if (!sourceType || !kind) {
      return NextResponse.json({ error: `Invalid source_id: ${body.source_id}` }, { status: 400 })
    }
    let q = supabase
      .from('report_external_facts')
      .select('ts, value, dimensions')
      .eq('client_id', client.id)
      .eq('source_type', sourceType)
      .eq('kind', kind)
    if (body.timeframe?.start) q = q.gte('ts', body.timeframe.start)
    if (body.timeframe?.end) {
      const endIso = body.timeframe.end.length <= 10
        ? new Date(new Date(body.timeframe.end).getTime() + 24 * 60 * 60 * 1000).toISOString()
        : body.timeframe.end
      q = q.lt('ts', endIso)
    }
    const { data: facts, error: factErr } = await q
    if (factErr) return NextResponse.json({ error: factErr.message }, { status: 500 })
    // Flatten facts into rows so the same aggregation code path works.
    rows = (facts ?? []).map((f) => {
      const r = f as ExternalFactRow
      const dims = r.dimensions && typeof r.dimensions === 'object' ? r.dimensions : {}
      return { ts: r.ts, value: r.value, ...dims }
    })
  }

  // For Drive sources we still want the timeframe to clip, if a date dimension is in use.
  // Detect if dimension is a date by sniffing the first non-null value.
  for (const r of rows) {
    const v = r[body.dimension_column]
    if (v != null && v !== '') {
      isDateDimension = parseLooseDate(String(v)) != null && /^\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}/.test(String(v).trim())
      break
    }
  }

  if (body.source_id.startsWith('drive:') && isDateDimension && body.timeframe?.start && body.timeframe?.end) {
    const startTs = parseLooseDate(body.timeframe.start)?.getTime() ?? -Infinity
    const endRaw = parseLooseDate(body.timeframe.end)?.getTime() ?? Infinity
    const endTs = body.timeframe.end.length <= 10 ? endRaw + 24 * 60 * 60 * 1000 - 1 : endRaw
    rows = rows.filter((r) => {
      const v = r[body.dimension_column]
      if (v == null || v === '') return false
      const t = parseLooseDate(String(v))?.getTime()
      if (t == null) return false
      return t >= startTs && t <= endTs
    })
  }

  // Bucket rows by dimension value.
  const buckets = new Map<string, { sum: number; count: number; min: number; max: number; nonNull: number }>()
  const ensure = (k: string) => {
    if (!buckets.has(k)) {
      buckets.set(k, { sum: 0, count: 0, min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY, nonNull: 0 })
    }
    return buckets.get(k)!
  }

  const granularity =
    body.dimension_granularity && body.dimension_granularity !== 'auto'
      ? body.dimension_granularity
      : pickGranularity(body.timeframe)

  for (const r of rows) {
    const dimRaw = r[body.dimension_column]
    if (dimRaw == null || dimRaw === '') continue
    let bucket: string
    if (isDateDimension) {
      const d = parseLooseDate(String(dimRaw))
      if (!d) continue
      bucket = bucketKey(bucketStart(d, granularity))
    } else {
      bucket = String(dimRaw)
    }
    const e = ensure(bucket)
    e.count += 1
    if (op !== 'count') {
      const n = toNumber(r[body.measure_column])
      if (n != null) {
        e.sum += n
        e.min = Math.min(e.min, n)
        e.max = Math.max(e.max, n)
        e.nonNull += 1
      }
    }
  }

  // Reduce per bucket according to op.
  let points: ChartPoint[] = Array.from(buckets.entries()).map(([bucket, agg]) => {
    let v: number | null = null
    if (op === 'count') v = agg.count
    else if (op === 'sum') v = agg.nonNull > 0 ? agg.sum : 0
    else if (op === 'avg') v = agg.nonNull > 0 ? agg.sum / agg.nonNull : null
    else if (op === 'min') v = agg.nonNull > 0 ? agg.min : null
    else if (op === 'max') v = agg.nonNull > 0 ? agg.max : null
    return { bucket, value: v }
  })

  // Sort: dates ascending, categories by value descending (top N first).
  if (isDateDimension) {
    points.sort((a, b) => a.bucket.localeCompare(b.bucket))
  } else {
    points.sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity))
  }
  if (points.length > limit) {
    if (isDateDimension) {
      points = points.slice(-limit) // keep most recent
    } else {
      points = points.slice(0, limit)
    }
  }

  return NextResponse.json({
    chart_type: body.chart_type,
    points,
    rows_used: rows.length,
    is_date_dimension: isDateDimension,
    granularity: isDateDimension ? granularity : null,
  })
}
