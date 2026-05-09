/**
 * GET /api/reporting/[slug]/standard-tiles
 *
 * Zero-config "Standard (Lifetime)" tile evaluator. Pulls every synced file for
 * the client, auto-detects canonical funnel columns (spend, leads, calls
 * booked, etc.), and evaluates every standard tile in the catalog with
 * `all_files: true` aggregation — no manual setup required.
 *
 * Per-tile precedence:
 *   1. Existing `report_kpis` row whose `key === entry.catalog_key` →
 *      use the saved formula (override).
 *   2. Catalog `auto_build()` produces a formula from detected columns →
 *      evaluate that.
 *   3. Detection failed → tile is returned with value=null and
 *      `missing` listing which canonical metrics weren't found.
 *
 * Always evaluated in lifetime mode (timeframe = {null,null}). The page-level
 * TimeframePicker doesn't apply.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { evaluateKPI } from '@/lib/reporting/engine'
import {
  STANDARD_CATALOG,
  type CatalogEntry,
} from '@/lib/reporting/kpi-catalog'
import { autoDetectColumns, METRIC_LABELS, type CanonicalMetric } from '@/lib/reporting/auto-detect'
import type {
  Formula,
  KPIDefinition,
  RawFileForEngine,
} from '@/lib/reporting/types'
import type { ReportKPI, ReportRawFile } from '@/lib/supabase/types'

interface StandardTileResult {
  key: string
  display_name: string
  description: string
  format: KPIDefinition['format']
  std_group: NonNullable<CatalogEntry['std_group']>
  value: number | null
  rows_used: number
  source_files: string[]
  error: string | null
  /** Where this tile's formula came from. */
  source: 'override' | 'auto' | 'unconfigured'
  /** Canonical metric → detected column name (only for `source: 'auto'`). */
  detected?: Partial<Record<CanonicalMetric, string>>
  /** Canonical metrics that couldn't be detected (only when `source` is
   *  unconfigured AND those metrics were required by the tile). */
  missing?: CanonicalMetric[]
  /** When `source: 'override'`, the kpi_id of the saved row so the UI can
   *  link to its single-tile editor. */
  kpi_id?: string
}

function rowToFile(r: Pick<ReportRawFile, 'filename' | 'columns' | 'rows'>): RawFileForEngine {
  return {
    filename: r.filename,
    columns: Array.isArray(r.columns) ? (r.columns as string[]) : [],
    rows: Array.isArray(r.rows) ? (r.rows as Record<string, unknown>[]) : [],
  }
}

function rowToDefinition(
  r: ReportKPI,
  fallbackEntry: CatalogEntry
): KPIDefinition {
  return {
    id: r.id,
    client_id: r.client_id,
    key: r.key,
    display_name: r.display_name || fallbackEntry.display_name,
    description: r.description ?? fallbackEntry.description,
    formula: r.formula as unknown as Formula,
    format: r.format ?? fallbackEntry.format,
    target: r.target ?? null,
    viz_type: r.viz_type ?? fallbackEntry.viz_type,
    display_order: r.display_order ?? 0,
    group_by_column: null,
    group_by_source: null,
    compare_to: null,
    forecast_periods: 0,
    forecast_method: null,
    chart_options: {},
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params

  const supabase = createServerClient()
  const { data: client, error } = await supabase
    .from('clients')
    .select('id, drive_folder_id')
    .eq('slug', slug)
    .single()
  if (error || !client) {
    return NextResponse.json({ error: `Client not found: ${slug}` }, { status: 404 })
  }

  // Pull synced files for this client.
  const { data: fileRows } = await supabase
    .from('report_raw_files')
    .select('filename, columns, rows')
    .eq('client_id', client.id)

  const files: RawFileForEngine[] = (fileRows ?? []).map(rowToFile)

  // Pull any existing standard-key overrides.
  const standardKeys = STANDARD_CATALOG.map((e) => e.catalog_key)
  let overrides: ReportKPI[] = []
  if (standardKeys.length > 0) {
    const { data: kpiRows } = await supabase
      .from('report_kpis')
      .select('*')
      .eq('client_id', client.id)
      .in('key', standardKeys)
    overrides = (kpiRows ?? []) as ReportKPI[]
  }
  const overrideByKey = new Map<string, ReportKPI>()
  for (const o of overrides) overrideByKey.set(o.key, o)

  // Run auto-detect once for the whole client.
  const detected = autoDetectColumns(files)

  const tiles: StandardTileResult[] = STANDARD_CATALOG.map((entry) => {
    const std_group = entry.std_group ?? 'volumes'
    const override = overrideByKey.get(entry.catalog_key)

    // 1. Override path — saved formula always wins.
    if (override) {
      const def = rowToDefinition(override, entry)
      const result = evaluateKPI(def, files, { start: null, end: null })
      return {
        key: entry.catalog_key,
        display_name: entry.display_name,
        description: entry.description,
        format: entry.format,
        std_group,
        value: result.value,
        rows_used: result.rows_used,
        source_files: result.source_files,
        error: result.error,
        source: 'override' as const,
        kpi_id: override.id,
      }
    }

    // 2. Auto-build path — compose formula from detected columns.
    const auto = entry.auto_build?.(detected) ?? null
    if (auto) {
      const def: KPIDefinition = {
        id: `auto:${entry.catalog_key}`,
        client_id: client.id,
        key: entry.catalog_key,
        display_name: entry.display_name,
        description: entry.description,
        formula: auto.formula,
        format: entry.format,
        target: null,
        viz_type: entry.viz_type,
        display_order: 0,
      }
      const result = evaluateKPI(def, files, { start: null, end: null })
      const detectedSubset: Partial<Record<CanonicalMetric, string>> = {}
      for (const m of auto.used) {
        const col = detected[m]
        if (col) detectedSubset[m] = col
      }
      return {
        key: entry.catalog_key,
        display_name: entry.display_name,
        description: entry.description,
        format: entry.format,
        std_group,
        value: result.value,
        rows_used: result.rows_used,
        source_files: result.source_files,
        error: result.error,
        source: 'auto' as const,
        detected: detectedSubset,
      }
    }

    // 3. Unconfigured — figure out which canonical metrics are missing so the
    //    UI can show a useful CTA.
    const missing = inferMissingMetrics(entry, detected)
    return {
      key: entry.catalog_key,
      display_name: entry.display_name,
      description: entry.description,
      format: entry.format,
      std_group,
      value: null,
      rows_used: 0,
      source_files: [],
      error: null,
      source: 'unconfigured' as const,
      missing,
    }
  })

  // Build a friendly detection summary for the UI header.
  const detectedSummary: Partial<Record<CanonicalMetric, string>> = {}
  for (const [m, col] of Object.entries(detected)) {
    if (col) detectedSummary[m as CanonicalMetric] = col
  }

  return NextResponse.json({
    file_count: files.length,
    detected: detectedSummary,
    metric_labels: METRIC_LABELS,
    tiles,
  })
}

/** Best-effort: replay auto_build with each metric individually nulled to see
 *  which one(s) caused it to fail. Cheap because there are only ~10 metrics. */
function inferMissingMetrics(
  entry: CatalogEntry,
  detected: ReturnType<typeof autoDetectColumns>
): CanonicalMetric[] {
  const autoBuild = entry.auto_build
  if (!autoBuild) return []
  // Probe by setting each metric to a sentinel "present" string and seeing
  // whether the build then succeeds — that tells us which inputs are required.
  const required: CanonicalMetric[] = []
  for (const m of Object.keys(detected) as CanonicalMetric[]) {
    const probe: Record<CanonicalMetric, string | null> = {
      spend: '__present__',
      impressions: '__present__',
      clicks: '__present__',
      leads: '__present__',
      qualified_leads: '__present__',
      calls_booked: '__present__',
      calls_showed: '__present__',
      closes: '__present__',
      revenue: '__present__',
      cash_collected: '__present__',
    }
    probe[m] = null
    const built = autoBuild(probe)
    if (built === null) required.push(m)
  }
  // Of the required ones, return those that are actually missing in real
  // detection.
  return required.filter((m) => !detected[m])
}
