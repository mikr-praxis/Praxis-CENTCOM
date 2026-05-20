/**
 * Unified field catalog for the Studio Builder.
 *
 * Returns every data source the client has, with each source's fields
 * typed as `date` | `number` | `category`. Powers the Source/Measure/
 * Dimension dropdowns. Detection is best-effort name + content sniffing.
 *
 * Sources include:
 *   - One per synced Drive file (id: `drive:<filename>`)
 *   - One per distinct (source_type, kind) tuple in report_external_facts
 *     (id: `<source_type>:<kind>`, e.g. `posthog:opt_ins`, `stripe:cash_collected`)
 *
 * Fields:
 *   Drive: real columns sniffed from the rows[] payload.
 *   External: always `ts` (date) + `value` (number) + each distinct dimension key (category).
 */
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'

const DATE_NAME_RE = /date|time|created|modified|at$|when|^ts$/i
const PERCENT_NUMERIC_THRESHOLD = 0.7

export interface FieldDef {
  name: string
  type: 'date' | 'number' | 'category'
}

export interface SourceCatalog {
  id: string
  label: string
  kind: 'drive' | 'external'
  /** Approx row count in the source — gives the UI a hint. */
  row_count: number
  fields: FieldDef[]
}

function looksLikeDate(v: unknown): boolean {
  if (v == null || v === '') return false
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(s)) return true
  const t = Date.parse(s)
  return Number.isFinite(t)
}

function looksLikeNumber(v: unknown): boolean {
  if (v == null || v === '') return false
  if (typeof v === 'number') return Number.isFinite(v)
  const s = String(v).replace(/[$,\s%]/g, '')
  return s !== '' && Number.isFinite(Number(s))
}

function detectColumnType(name: string, samples: unknown[]): FieldDef['type'] {
  if (DATE_NAME_RE.test(name)) {
    const dateHits = samples.filter(looksLikeDate).length
    if (samples.length === 0 || dateHits / samples.length >= PERCENT_NUMERIC_THRESHOLD) return 'date'
  }
  const numericHits = samples.filter(looksLikeNumber).length
  if (samples.length > 0 && numericHits / samples.length >= PERCENT_NUMERIC_THRESHOLD) return 'number'
  const dateHits = samples.filter(looksLikeDate).length
  if (samples.length > 0 && dateHits / samples.length >= PERCENT_NUMERIC_THRESHOLD) return 'date'
  return 'category'
}

interface ExternalFactRow {
  source_type: string
  kind: string
  dimensions: Record<string, unknown> | null
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const supabase = createServerClient()

  const { data: client, error } = await supabase
    .from('clients')
    .select('id')
    .eq('slug', slug)
    .single()
  if (error || !client) {
    return NextResponse.json({ error: `Client not found: ${slug}` }, { status: 404 })
  }

  // Drive files
  const { data: fileRows } = await supabase
    .from('report_raw_files')
    .select('filename, columns, rows, row_count')
    .eq('client_id', client.id)

  const sources: SourceCatalog[] = []
  for (const f of fileRows ?? []) {
    const filename = f.filename as string
    const columns = Array.isArray(f.columns) ? (f.columns as string[]) : []
    const rows = Array.isArray(f.rows) ? (f.rows as Record<string, unknown>[]) : []
    // Sample first 50 rows for type detection — fast, and consistent enough
    // for the picker to make a good guess.
    const sample = rows.slice(0, 50)
    const fields: FieldDef[] = columns.map((c) => ({
      name: c,
      type: detectColumnType(c, sample.map((r) => r[c])),
    }))
    sources.push({
      id: `drive:${filename}`,
      label: `${filename} (Drive)`,
      kind: 'drive',
      row_count: typeof f.row_count === 'number' ? f.row_count : rows.length,
      fields,
    })
  }

  // External facts — group by (source_type, kind) and unionize dimension keys.
  const { data: factRows } = await supabase
    .from('report_external_facts')
    .select('source_type, kind, dimensions')
    .eq('client_id', client.id)

  const factGroups = new Map<string, { dims: Set<string>; count: number }>()
  for (const row of (factRows ?? []) as ExternalFactRow[]) {
    const key = `${row.source_type}:${row.kind}`
    const entry = factGroups.get(key) ?? { dims: new Set<string>(), count: 0 }
    entry.count += 1
    if (row.dimensions && typeof row.dimensions === 'object') {
      for (const k of Object.keys(row.dimensions)) entry.dims.add(k)
    }
    factGroups.set(key, entry)
  }
  for (const [id, { dims, count }] of factGroups.entries()) {
    const [sourceType, kind] = id.split(':')
    const baseFields: FieldDef[] = [
      { name: 'ts', type: 'date' },
      { name: 'value', type: 'number' },
    ]
    const dimFields: FieldDef[] = Array.from(dims).map((k) => ({ name: k, type: 'category' }))
    sources.push({
      id,
      label: `${sourceType}: ${kind}`,
      kind: 'external',
      row_count: count,
      fields: [...baseFields, ...dimFields],
    })
  }

  return NextResponse.json({ sources })
}
