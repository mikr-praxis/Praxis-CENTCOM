/**
 * AI-recommended KPI set. Given one or more synced files, ask Claude to suggest
 * a coherent dashboard worth of KPIs (typically 5-8) covering different angles:
 * volume, conversion, revenue, trend, retention, etc.
 *
 * Reuses the same Formula DSL as the single-KPI suggester.
 */

import Anthropic from '@anthropic-ai/sdk'
import { getConfig } from '@/lib/config'
import type { AISuggestion, FileForSuggester } from './ai-suggest'

const SYSTEM_PROMPT = `You design a coherent KPI dashboard for a marketing operations agency client.

You are given:
- Synced raw data files: filename, columns, sample rows
- Optional business context

Your job: propose 5-8 KPIs that cover different useful angles. Aim for variety:
- Volume / counts (top of funnel)
- Conversion or efficiency (rates, ratios)
- Revenue / spend (currency)
- Trend or recency (line chart)
- Quality / retention (where data supports it)

Return a JSON object:
{
  "kpis": [<KPI1>, <KPI2>, ...]
}

Each KPI matches this schema:
{
  "display_name": "Human-friendly name",
  "key": "snake_case_unique_slug",
  "description": "One sentence: what it measures and why",
  "formula": <Formula JSON, see below>,
  "format": "count" | "currency" | "percent" | "ratio",
  "viz_type": "card" | "line" | "bar" | "pie" | "table",
  "target": null | number,
  "confidence": "high" | "medium" | "low",
  "notes": "Brief — flag any assumptions or alternatives"
}

Formula DSL — three node kinds:

1. Aggregation:
{
  "op": "sum" | "count" | "count_distinct" | "avg" | "min" | "max",
  "source": "<exact filename>",
  "column": "<exact column>" (REQUIRED for sum/avg/min/max/count_distinct; omit for count),
  "filters": [
    { "column": "<col>", "op": "eq" | "neq" | "in" | "not_in" | "contains" | "gt" | "gte" | "lt" | "lte" | "not_empty" | "empty", "value": "<v>" or ["a","b"] for in/not_in }
  ],
  "timeframe_column": "<col>" (optional)
}

2. Composite:
{ "op": "divide", "numerator": <Formula>, "denominator": <Formula> }
{ "op": "multiply" | "add" | "subtract", "left": <Formula>, "right": <Formula> }

3. Constant:
{ "op": "const", "value": 42 }

Rules:
- Output ONLY the JSON object, nothing else.
- "source" and "column" must EXACTLY match a filename / column from inputs. Do not invent.
- Conversion rates / win rates / attendance rates → composite "divide" with format "percent".
- Revenue / spend / dollar amounts → format "currency".
- Counts / volumes → format "count".
- Trends ("over time", "by week", weekly tracking) → viz_type "line" with timeframe_column set.
- Pick timeframe_column intelligently: prefer columns named like *_at, date, created, modified, ts, *_date.
- For status/stage filters, look at sample row VALUES to pick the exact filter value (case-sensitive).
- key: lowercase snake_case derived from display_name, unique within the set.
- Aim for variety; avoid 3 KPIs that all measure essentially the same thing.
- If two files relate to the same funnel (e.g. leads.xlsx + deals.xlsx), build cross-file KPIs (count(deals) / count(leads)).
- confidence: "high" if columns clearly match; "medium" if some inference; "low" if guessing — be honest.

Output the JSON object now.`

function buildPrompt(files: FileForSuggester[], context: string | undefined, count: number): string {
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

  return `${context ? `BUSINESS CONTEXT:\n${context}\n\n` : ''}TARGET KPI COUNT: ${count}

AVAILABLE DATA FILES:

${filesBlock}

Generate the JSON object now.`
}

export async function recommendKPISet(args: {
  files: FileForSuggester[]
  context?: string
  count?: number
}): Promise<AISuggestion[]> {
  const apiKey = await getConfig('ANTHROPIC_API_KEY')
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured.')
  }

  const model = (await getConfig('REPORTING_AI_MODEL')) || 'claude-opus-4-6'
  const maxTokens = Number(await getConfig('REPORTING_AI_MAX_TOKENS')) || 6000
  const count = Math.min(Math.max(args.count ?? 6, 3), 10)

  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: buildPrompt(args.files, args.context, count) }],
  })

  const rawText = response.content[0]?.type === 'text' ? response.content[0].text : ''
  const cleaned = rawText.replace(/```json|```/g, '').trim()
  try {
    const parsed = JSON.parse(cleaned) as { kpis: AISuggestion[] }
    if (!Array.isArray(parsed.kpis)) {
      throw new Error('Response missing "kpis" array')
    }
    return parsed.kpis
  } catch (e) {
    throw new Error(
      `AI returned unparseable JSON: ${(e as Error).message}\n\nFirst 400 chars: ${cleaned.slice(0, 400)}`
    )
  }
}
