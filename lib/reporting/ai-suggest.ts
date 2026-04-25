/**
 * AI-assisted KPI generation. Reads a synced raw file's columns + sample rows,
 * combines that with a plain-English KPI description from the user, and asks
 * Claude to emit a Formula + display metadata that the engine can run.
 */

import Anthropic from '@anthropic-ai/sdk'
import { getConfig } from '@/lib/config'
import { getReportingAIModel, getReportingAIMaxTokens } from '@/lib/reporting/config'
import type { Formula } from '@/lib/reporting/types'
import type { KPIFormat, KPIVizType } from '@/lib/supabase/types'

export interface AISuggestion {
  display_name: string
  key: string
  description: string
  formula: Formula
  format: KPIFormat
  viz_type: KPIVizType
  target: number | null
  confidence: 'high' | 'medium' | 'low'
  notes: string
}

export interface FileForSuggester {
  filename: string
  columns: string[]
  sample_rows: Record<string, unknown>[]
}

const SYSTEM_PROMPT = `You generate a single KPI definition (formula + display metadata) for a marketing operations reporting tool.

You are given:
- The user's plain-English description of the KPI they want
- One or more synced raw data files: filename, columns, and sample rows

You output a JSON object matching this exact schema:

{
  "display_name": "Human-friendly name (e.g. \\"Conversion rate\\")",
  "key": "snake_case_unique_slug",
  "description": "One sentence: what this measures and how",
  "formula": <Formula JSON, see below>,
  "format": "count" | "currency" | "percent" | "ratio",
  "viz_type": "card" | "line" | "bar" | "pie" | "table",
  "target": null | number,
  "confidence": "high" | "medium" | "low",
  "notes": "Brief explanation of the formula choice and any caveats"
}

The Formula DSL has three kinds of nodes:

1. Aggregation (top-level or nested in a composite):
{
  "op": "sum" | "count" | "count_distinct" | "avg" | "min" | "max",
  "source": "<exact filename of one of the input files>",
  "column": "<exact column name>" (REQUIRED for sum/avg/min/max/count_distinct; omit for count),
  "filters": [
    { "column": "<col>", "op": "eq" | "neq" | "in" | "not_in" | "contains" | "gt" | "gte" | "lt" | "lte" | "not_empty" | "empty", "value": "<string|number>" or ["a","b"] for in/not_in }
  ],
  "timeframe_column": "<col>" (optional — column to apply the dashboard timeframe filter against; pick a date column if available)
}

2. Composite (combines two sub-formulas):
{
  "op": "divide", "numerator": <Formula>, "denominator": <Formula>
}
or
{
  "op": "multiply" | "add" | "subtract", "left": <Formula>, "right": <Formula>
}

3. Constant:
{ "op": "const", "value": 42 }

Rules:
- Output ONLY the JSON object. No prose, no markdown fences.
- "source" and "column" must EXACTLY match a filename and column name from the input. Do not invent.
- For ratios/conversion rates, use "divide" with two count/sum aggregations and set format to "percent".
- For revenue/spend, set format to "currency".
- Pick a timeframe_column intelligently — prefer columns named like *_at, date, created, modified, when, ts, timestamp, *_date, *_time. If no obvious date column, omit timeframe_column.
- If the user asks for a trend / "over time", set viz_type to "line" and ensure timeframe_column is set.
- For status/stage filters, look at sample row values to pick the exact filter value. Be case-sensitive.
- key should be lowercase snake_case derived from display_name.
- target: include only if the user explicitly mentions a target/goal number; otherwise null.
- confidence: "high" if columns match clearly, "medium" if some inference, "low" if guessing.
- Notes should call out any assumptions or alternative interpretations.

Do not output any text other than the JSON object.`

function buildPrompt(description: string, files: FileForSuggester[]): string {
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
      return `FILE: "${f.filename}" (${f.sample_rows.length} sample rows shown of available)\nColumns: ${headers}\n${sample}`
    })
    .join('\n\n')

  return `KPI DESCRIPTION FROM USER:
${description}

AVAILABLE DATA FILES:

${filesBlock}

Generate the KPI definition JSON now.`
}

export async function suggestKPI(args: {
  description: string
  files: FileForSuggester[]
}): Promise<AISuggestion> {
  const apiKey = await getConfig('ANTHROPIC_API_KEY')
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured. Set it in /config or Vercel env vars.')
  }

  const model = await getReportingAIModel()
  const maxTokens = await getReportingAIMaxTokens(2000)

  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: buildPrompt(args.description, args.files) }],
  })

  const rawText = response.content[0]?.type === 'text' ? response.content[0].text : ''
  const cleaned = rawText.replace(/```json|```/g, '').trim()
  try {
    const parsed = JSON.parse(cleaned) as AISuggestion
    return parsed
  } catch (e) {
    throw new Error(
      `AI returned unparseable JSON: ${(e as Error).message}\n\nFirst 400 chars: ${cleaned.slice(0, 400)}`
    )
  }
}
