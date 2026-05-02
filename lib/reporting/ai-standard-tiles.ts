/**
 * AI-driven mapping for the always-on "Standard (Lifetime)" tiles.
 *
 * Instead of guessing at columns with keyword heuristics, we hand Claude:
 *   - the list of canonical KPIs we want filled in
 *   - every synced file (filename + columns + sample rows)
 * and let it return a Formula JSON per tile, plus a one-line rationale we can
 * surface in the UI so the user can see exactly which file + column was used.
 *
 * Designed to be cached per (client_id, content_hash) — see
 * /api/reporting/[slug]/standard-tiles route.
 */

import Anthropic from '@anthropic-ai/sdk'
import { getConfig } from '@/lib/config'
import { getReportingAIModel, getReportingAIMaxTokens } from './config'
import type { Formula } from './types'
import type { KPIFormat } from '@/lib/supabase/types'

export interface StandardTileSpec {
  /** Stable key — `std_lifetime_*`. Becomes the report_kpis.key for overrides. */
  key: string
  /** Display name shown on the tile. */
  display_name: string
  /** One-line plain-English definition fed to the AI ("ad spend, USD"). */
  definition: string
  /** Output format the engine will use to render the value. */
  format: KPIFormat
}

/** The canonical set of standard tiles the AI is asked to build for every
 *  client. Order = render order. Add a new entry here and it shows up
 *  everywhere — no other code change needed. */
export const STANDARD_TILE_SPECS: StandardTileSpec[] = [
  // Volumes
  {
    key: 'std_lifetime_spend',
    display_name: 'Total Spend',
    definition:
      'Total ad spend / media cost in dollars. Sum the column that represents money paid to ad platforms. Usually appears in Meta / Google / paid-media reports as "Amount Spent", "Cost", "Ad Spend", "Spend", etc.',
    format: 'currency',
  },
  {
    key: 'std_lifetime_leads',
    display_name: 'Total Leads',
    definition:
      'Total leads / opt-ins / signups across the funnel. Could be "Opt-Ins", "Leads", "Sign-ups", "Registrations", or a count of rows in a leads file.',
    format: 'count',
  },
  {
    key: 'std_lifetime_calls_booked',
    display_name: 'Total Calls Booked',
    definition:
      'Total sales calls booked / appointments scheduled. Look for "Calls Booked", "Bookings", "Sets", "Appointments Booked". Avoid "Show Rate" or "No Show".',
    format: 'count',
  },
  {
    key: 'std_lifetime_calls_showed',
    display_name: 'Total Calls Showed',
    definition:
      'Total calls actually attended / showed up. Look for "Showed", "Attended", "Calls Held", "Calls Kept", "Shows".',
    format: 'count',
  },
  {
    key: 'std_lifetime_closes',
    display_name: 'Total Closes',
    definition:
      'Total closed deals / sales / customers won. Look for "Closes", "Sales", "Closed-Won", "Wins", "Deals Closed".',
    format: 'count',
  },
  {
    key: 'std_lifetime_revenue',
    display_name: 'Total Revenue',
    definition:
      'Total contracted revenue in dollars. Usually "Revenue", "Total Revenue", "Sales Revenue", "Contract Value", "Deal Value". This is gross/contracted, not necessarily collected.',
    format: 'currency',
  },
  {
    key: 'std_lifetime_cash_collected',
    display_name: 'Total Cash Collected',
    definition:
      'Total cash actually received (vs contracted). Look for "Cash Collected", "Payments", "Collected", "Deposits". May be lower than revenue if there are payment plans.',
    format: 'currency',
  },
  // Costs
  {
    key: 'std_lifetime_cpl',
    display_name: 'CPL',
    definition: 'Cost per lead = total spend / total leads. Use a divide composite.',
    format: 'currency',
  },
  {
    key: 'std_lifetime_cpb',
    display_name: 'Cost per Booking',
    definition: 'Spend / calls booked. Divide composite.',
    format: 'currency',
  },
  {
    key: 'std_lifetime_cps',
    display_name: 'Cost per Show',
    definition: 'Spend / calls showed. Divide composite.',
    format: 'currency',
  },
  {
    key: 'std_lifetime_cpa',
    display_name: 'CPA',
    definition: 'Cost per acquisition = spend / closes. Divide composite.',
    format: 'currency',
  },
  {
    key: 'std_lifetime_roas',
    display_name: 'ROAS',
    definition: 'Return on ad spend = revenue / spend. Divide composite, ratio format.',
    format: 'ratio',
  },
  // Rates
  {
    key: 'std_lifetime_booking_rate',
    display_name: 'Booking Rate',
    definition: 'Calls booked / leads. Divide composite, percent format.',
    format: 'percent',
  },
  {
    key: 'std_lifetime_show_rate',
    display_name: 'Show Rate',
    definition: 'Calls showed / calls booked. Divide composite, percent format.',
    format: 'percent',
  },
  {
    key: 'std_lifetime_close_rate',
    display_name: 'Close Rate',
    definition: 'Closes / calls showed. Divide composite, percent format.',
    format: 'percent',
  },
  {
    key: 'std_lifetime_lead_to_close',
    display_name: 'Lead → Close',
    definition: 'End-to-end conversion: closes / leads. Divide composite, percent format.',
    format: 'percent',
  },
  // Averages
  {
    key: 'std_lifetime_aov',
    display_name: 'AOV',
    definition: 'Average order value = revenue / closes. Divide composite, currency format.',
    format: 'currency',
  },
  {
    key: 'std_lifetime_cash_per_close',
    display_name: 'Cash per Close',
    definition:
      'Cash collected / closes — actual money per closed deal. Divide composite, currency format.',
    format: 'currency',
  },
]

export interface FileForMapper {
  filename: string
  columns: string[]
  sample_rows: Record<string, unknown>[]
}

export interface MappedTile {
  key: string
  /** Filled formula, or null if the AI couldn't find usable data. */
  formula: Formula | null
  /** Filenames the AI used for this tile (for UI provenance). */
  source_files: string[]
  /** Columns the AI picked (filenames are in source_files). */
  source_columns: string[]
  confidence: 'high' | 'medium' | 'low'
  /** One-line plain-English explanation of the choice. */
  rationale: string
}

export interface StandardTilesMapping {
  /** Generated_at ISO. */
  generated_at: string
  /** ID of the model that produced the mapping. */
  model: string
  /** One mapping per STANDARD_TILE_SPECS entry. Keys are stable; UI looks up by key. */
  tiles: MappedTile[]
}

const SYSTEM_PROMPT = `You are a marketing-ops analytics engineer. You map a list of canonical KPIs onto a client's actual synced data files and produce evaluable formula JSON for each one.

You will receive:
  - The canonical KPI list (key, display_name, definition, format)
  - Every synced file for the client: filename, columns, and sample rows

For each canonical KPI, return a JSON object with these exact keys:
{
  "key": "<the canonical key, unchanged>",
  "formula": <Formula JSON, see DSL below> OR null,
  "source_files": ["<filename1>", ...],   // empty array when formula is null
  "source_columns": ["<column1>", ...],   // matches files used
  "confidence": "high" | "medium" | "low",
  "rationale": "<one short sentence — why this mapping fits>"
}

Wrap them all in:
{ "tiles": [ {...}, {...}, ... ] }

# Formula DSL

Aggregation node:
{
  "op": "sum" | "count" | "count_distinct" | "avg" | "min" | "max",
  "source": "<exact filename>" or "*"  // "*" + all_files:true means scan every file that has the column
  "column": "<exact column>",          // required for sum/avg/min/max/count_distinct
  "all_files": true,                    // STRONGLY PREFER this for lifetime tiles — sums across every synced file containing the column
  "filters": [
    { "column": "<col>", "op": "eq" | "neq" | "in" | "not_in" | "contains" | "gt" | "gte" | "lt" | "lte" | "not_empty" | "empty", "value": "<v>" }
  ]
}

Composite node:
{ "op": "divide", "numerator": <Formula>, "denominator": <Formula> }
{ "op": "multiply" | "add" | "subtract", "left": <Formula>, "right": <Formula> }

Constant node:
{ "op": "const", "value": 42 }

# Rules

1. Always prefer "all_files": true on the AggOp so a metric like spend gets summed across EVERY file that has a spend column (e.g. Meta + Google + organic). When using all_files, set "source": "*".

2. If the same metric is split across multiple files with DIFFERENT column names (e.g. "Amount Spent" in Meta and "Cost" in Google), build an "add" composite of two AggOps — one per (file, column) pair, NOT all_files.

3. For ratio tiles (CPL, ROAS, rates) — build a divide composite where numerator and denominator are themselves AggOps (each can use all_files).

4. If the data clearly cannot support a tile (e.g. no spend column anywhere → can't compute CPL), return formula: null with a one-line rationale. Don't invent.

5. Be honest with confidence. "high" = the mapping is unambiguous (e.g. column literally named "Amount Spent" with $-values). "medium" = best guess but there are alternative columns. "low" = forced choice from limited options.

6. NEVER invent filenames or columns. They must match the input exactly, byte-for-byte.

7. Filters: use them when a column is present but rows need to be scoped (e.g. closes might be rows in a deals file with status="Closed Won"). Inspect the sample rows to pick filter values.

8. Sample-row inspection is essential. A column called "Status" with values [New, Booked, Showed, Closed] tells you to filter for status="Booked"/"Showed"/"Closed" rather than expecting separate columns.

9. Output ONLY the JSON object. No markdown, no prose, no fences.

10. Order tiles in the output in the SAME order as the input canonical list.`

function buildPrompt(specs: StandardTileSpec[], files: FileForMapper[]): string {
  const filesBlock = files
    .map((f) => {
      const headers = f.columns.join(' | ')
      const sample = f.sample_rows
        .slice(0, 8)
        .map((row, i) => {
          const cells = f.columns.map((c) => String(row[c] ?? '').slice(0, 80))
          return `  Row ${i + 1}: ${cells.join(' | ')}`
        })
        .join('\n')
      return `FILE: "${f.filename}" (sample of ${f.sample_rows.length} rows)\nColumns: ${headers}\n${sample}`
    })
    .join('\n\n')

  const specsBlock = specs
    .map(
      (s) =>
        `- key: ${s.key}\n  display_name: ${s.display_name}\n  format: ${s.format}\n  definition: ${s.definition}`
    )
    .join('\n')

  return `CANONICAL KPI LIST (${specs.length} tiles):

${specsBlock}

AVAILABLE DATA FILES:

${filesBlock}

Now emit the JSON object: { "tiles": [ ... ] }, one entry per canonical key, in the same order. Use "all_files": true wherever a metric should sum across every file that has the column.`
}

/** Run the AI mapper against the given files. Throws on misconfig (no API key,
 *  bad JSON response). Caller is responsible for caching. */
export async function mapStandardTiles(args: {
  files: FileForMapper[]
}): Promise<StandardTilesMapping> {
  const apiKey = await getConfig('ANTHROPIC_API_KEY')
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured. Set it in /config or Vercel env vars.')
  }

  if (args.files.length === 0) {
    return {
      generated_at: new Date().toISOString(),
      model: 'none',
      tiles: STANDARD_TILE_SPECS.map((s) => ({
        key: s.key,
        formula: null,
        source_files: [],
        source_columns: [],
        confidence: 'low',
        rationale: 'No synced files for this client yet.',
      })),
    }
  }

  const model = await getReportingAIModel()
  // 18 tiles × ~150 tokens each = ~2.7k base, plus rationales — leave room.
  const maxTokens = await getReportingAIMaxTokens(8000)

  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: buildPrompt(STANDARD_TILE_SPECS, args.files) }],
  })

  const rawText = response.content[0]?.type === 'text' ? response.content[0].text : ''
  const cleaned = rawText.replace(/```json|```/g, '').trim()
  let parsed: { tiles: MappedTile[] }
  try {
    parsed = JSON.parse(cleaned)
  } catch (e) {
    throw new Error(
      `AI returned unparseable JSON: ${(e as Error).message}\n\nFirst 400 chars: ${cleaned.slice(0, 400)}`
    )
  }
  if (!Array.isArray(parsed.tiles)) {
    throw new Error('AI response missing "tiles" array.')
  }

  // Index by key, ensure every spec has a mapping (fill missing with null formula).
  const byKey = new Map<string, MappedTile>()
  for (const t of parsed.tiles) {
    if (typeof t.key === 'string') byKey.set(t.key, t)
  }
  const tiles: MappedTile[] = STANDARD_TILE_SPECS.map((s) => {
    const t = byKey.get(s.key)
    if (!t) {
      return {
        key: s.key,
        formula: null,
        source_files: [],
        source_columns: [],
        confidence: 'low',
        rationale: 'AI did not return a mapping for this tile.',
      }
    }
    return {
      key: s.key,
      formula: t.formula ?? null,
      source_files: Array.isArray(t.source_files) ? t.source_files : [],
      source_columns: Array.isArray(t.source_columns) ? t.source_columns : [],
      confidence:
        t.confidence === 'high' || t.confidence === 'medium' || t.confidence === 'low'
          ? t.confidence
          : 'low',
      rationale: typeof t.rationale === 'string' ? t.rationale : '',
    }
  })

  return {
    generated_at: new Date().toISOString(),
    model,
    tiles,
  }
}

/**
 * Stable hash of "what the AI would see". When this changes (new files, new
 * columns), we re-run the mapping. Otherwise we serve from cache.
 *
 * NOT cryptographic — just collision-resistant enough for cache-busting.
 */
export function hashFiles(files: FileForMapper[]): string {
  const summary = files
    .slice() // don't mutate input
    .sort((a, b) => a.filename.localeCompare(b.filename))
    .map((f) => `${f.filename}|${f.columns.join(',')}|${f.sample_rows.length}`)
    .join('||')
  // Simple djb2-ish hash so we don't pull crypto deps server-side.
  let h = 5381
  for (let i = 0; i < summary.length; i++) {
    h = (h * 33) ^ summary.charCodeAt(i)
    h = h | 0
  }
  return Math.abs(h).toString(36)
}
