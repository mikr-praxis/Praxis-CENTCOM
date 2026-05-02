/**
 * GET  /api/reporting/[slug]/standard-tiles
 * POST /api/reporting/[slug]/standard-tiles  (force re-map, ignore cache)
 *
 * Zero-config standard-tile evaluator. Uses AI to map each canonical KPI
 * (spend, leads, ROAS, …) onto the client's actual synced columns, then
 * runs the resulting formulas through the existing engine.
 *
 * Mapping precedence per tile (highest first):
 *   1. Saved override row in report_kpis with key === std_lifetime_*  → use that formula.
 *   2. Cached AI mapping in app_config (key STD_TILE_MAP__<client_id>__<hash>).
 *   3. Fresh AI call → cache result → use it.
 *
 * Always evaluated lifetime (timeframe = {null, null}). The page-level
 * TimeframePicker doesn't apply.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { getConfig, setConfig } from '@/lib/config'
import { evaluateKPI } from '@/lib/reporting/engine'
import {
  STANDARD_TILE_SPECS,
  mapStandardTiles,
  hashFiles,
  type FileForMapper,
  type MappedTile,
  type StandardTilesMapping,
} from '@/lib/reporting/ai-standard-tiles'
import type {
  Formula,
  KPIDefinition,
  RawFileForEngine,
} from '@/lib/reporting/types'
import type { ReportKPI, ReportRawFile } from '@/lib/supabase/types'

interface TileResponse {
  key: string
  display_name: string
  format: KPIDefinition['format']
  value: number | null
  rows_used: number
  source_files: string[]
  error: string | null
  /** Where this tile's formula came from. */
  source: 'override' | 'ai' | 'unmapped'
  /** AI-only: confidence in the mapping. */
  confidence?: 'high' | 'medium' | 'low'
  /** AI-only: one-line plain-English rationale. */
  rationale?: string
  /** AI-only: column names the AI used. */
  source_columns?: string[]
  /** Override-only: kpi_id of the saved row so the gear can deep-link. */
  kpi_id?: string
}

interface ApiResponse {
  file_count: number
  /** Iso timestamp the cached AI mapping was generated. null when AI didn't run
   *  (no files, or every tile is overridden). */
  mapping_generated_at: string | null
  /** Model id that generated the mapping. */
  mapping_model: string | null
  /** Whether this response came from cache or a fresh AI call. */
  from_cache: boolean
  tiles: TileResponse[]
}

const CACHE_KEY_PREFIX = 'STD_TILE_MAP__'
const cacheKey = (clientId: string, hash: string) =>
  `${CACHE_KEY_PREFIX}${clientId}__${hash}`

function rowToFileForEngine(
  r: Pick<ReportRawFile, 'filename' | 'columns' | 'rows'>
): RawFileForEngine {
  return {
    filename: r.filename,
    columns: Array.isArray(r.columns) ? (r.columns as string[]) : [],
    rows: Array.isArray(r.rows) ? (r.rows as Record<string, unknown>[]) : [],
  }
}

function rowToFileForMapper(
  r: Pick<ReportRawFile, 'filename' | 'columns' | 'rows'>
): FileForMapper {
  return {
    filename: r.filename,
    columns: Array.isArray(r.columns) ? (r.columns as string[]) : [],
    sample_rows: Array.isArray(r.rows)
      ? (r.rows as Record<string, unknown>[]).slice(0, 12)
      : [],
  }
}

/** Make a synthetic KPIDefinition out of a Formula so we can hand it to the engine. */
function defFromFormula(args: {
  kpi_id: string
  client_id: string
  key: string
  display_name: string
  format: KPIDefinition['format']
  formula: Formula
}): KPIDefinition {
  return {
    id: args.kpi_id,
    client_id: args.client_id,
    key: args.key,
    display_name: args.display_name,
    description: null,
    formula: args.formula,
    format: args.format,
    target: null,
    viz_type: 'card',
    display_order: 0,
  }
}

async function getCachedMapping(
  clientId: string,
  hash: string
): Promise<StandardTilesMapping | null> {
  const raw = await getConfig(cacheKey(clientId, hash))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as StandardTilesMapping
    if (!Array.isArray(parsed.tiles)) return null
    return parsed
  } catch {
    return null
  }
}

async function setCachedMapping(
  clientId: string,
  hash: string,
  mapping: StandardTilesMapping
): Promise<void> {
  try {
    await setConfig(cacheKey(clientId, hash), JSON.stringify(mapping))
  } catch {
    // best-effort — if cache write fails (e.g. row too large), the next page
    // load just re-runs the AI. Don't break the user-facing response.
  }
}

async function evaluate(args: {
  request: Request
  params: Promise<{ slug: string }>
  forceRefresh: boolean
}): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await args.params

  const supabase = createServerClient()
  const { data: client, error } = await supabase
    .from('clients')
    .select('id')
    .eq('slug', slug)
    .single()
  if (error || !client) {
    return NextResponse.json({ error: `Client not found: ${slug}` }, { status: 404 })
  }

  const { data: fileRows } = await supabase
    .from('report_raw_files')
    .select('filename, columns, rows')
    .eq('client_id', client.id)

  const files = (fileRows ?? []).map(rowToFileForEngine)
  const mapperFiles = (fileRows ?? []).map(rowToFileForMapper)

  // 1. Saved overrides — keyed by std_lifetime_*. These ALWAYS win.
  const standardKeys = STANDARD_TILE_SPECS.map((s) => s.key)
  const { data: overrideRows } = await supabase
    .from('report_kpis')
    .select('*')
    .eq('client_id', client.id)
    .in('key', standardKeys)
  const overrides = new Map<string, ReportKPI>()
  for (const r of (overrideRows ?? []) as ReportKPI[]) overrides.set(r.key, r)

  // 2. Decide whether to call the AI: only for tiles WITHOUT overrides.
  const needsAI = STANDARD_TILE_SPECS.some((s) => !overrides.has(s.key))
  const hash = hashFiles(mapperFiles)

  let mapping: StandardTilesMapping | null = null
  let fromCache = false

  if (needsAI && mapperFiles.length > 0) {
    if (!args.forceRefresh) {
      mapping = await getCachedMapping(client.id, hash)
      if (mapping) fromCache = true
    }
    if (!mapping) {
      try {
        mapping = await mapStandardTiles({ files: mapperFiles })
        await setCachedMapping(client.id, hash, mapping)
      } catch (e) {
        // AI failed (no API key, network, bad JSON). Return tiles with
        // null formulas + the error for visibility.
        return NextResponse.json(
          {
            file_count: files.length,
            mapping_generated_at: null,
            mapping_model: null,
            from_cache: false,
            tiles: STANDARD_TILE_SPECS.map((s) => ({
              key: s.key,
              display_name: s.display_name,
              format: s.format,
              value: null,
              rows_used: 0,
              source_files: [],
              error: e instanceof Error ? e.message : 'AI mapping failed',
              source: 'unmapped' as const,
            })),
          } satisfies ApiResponse,
          { status: 200 }
        )
      }
    }
  }

  const aiByKey = new Map<string, MappedTile>()
  for (const t of mapping?.tiles ?? []) aiByKey.set(t.key, t)

  // 3. Evaluate every tile, picking override → AI → unmapped per spec.
  const tiles: TileResponse[] = STANDARD_TILE_SPECS.map((spec) => {
    const override = overrides.get(spec.key)
    if (override) {
      const def = defFromFormula({
        kpi_id: override.id,
        client_id: client.id,
        key: spec.key,
        display_name: override.display_name || spec.display_name,
        format: override.format ?? spec.format,
        formula: override.formula as unknown as Formula,
      })
      const r = evaluateKPI(def, files, { start: null, end: null })
      return {
        key: spec.key,
        display_name: spec.display_name,
        format: spec.format,
        value: r.value,
        rows_used: r.rows_used,
        source_files: r.source_files,
        error: r.error,
        source: 'override' as const,
        kpi_id: override.id,
      }
    }

    const ai = aiByKey.get(spec.key)
    if (ai && ai.formula) {
      const def = defFromFormula({
        kpi_id: `ai:${spec.key}`,
        client_id: client.id,
        key: spec.key,
        display_name: spec.display_name,
        format: spec.format,
        formula: ai.formula,
      })
      const r = evaluateKPI(def, files, { start: null, end: null })
      return {
        key: spec.key,
        display_name: spec.display_name,
        format: spec.format,
        value: r.value,
        rows_used: r.rows_used,
        source_files: r.source_files,
        error: r.error,
        source: 'ai' as const,
        confidence: ai.confidence,
        rationale: ai.rationale,
        source_columns: ai.source_columns,
      }
    }

    // Unmapped: AI couldn't find data, OR no AI call ran (no files).
    return {
      key: spec.key,
      display_name: spec.display_name,
      format: spec.format,
      value: null,
      rows_used: 0,
      source_files: [],
      error: null,
      source: 'unmapped' as const,
      rationale: ai?.rationale,
    }
  })

  const response: ApiResponse = {
    file_count: files.length,
    mapping_generated_at: mapping?.generated_at ?? null,
    mapping_model: mapping?.model ?? null,
    from_cache: fromCache,
    tiles,
  }
  return NextResponse.json(response)
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  return evaluate({ request, params, forceRefresh: false })
}

export const maxDuration = 60 // AI call can take ~30s on big folders

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  // POST forces a fresh AI call (skips cache, overwrites it on success).
  return evaluate({ request, params, forceRefresh: true })
}
