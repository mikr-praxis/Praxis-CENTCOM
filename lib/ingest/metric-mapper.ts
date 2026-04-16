import Anthropic from '@anthropic-ai/sdk'
import type { FunnelType, SheetTabData, MapperResult, CanonicalMetric } from '@/lib/metrics/types'
import { getMetricsForFunnel } from '@/lib/metrics'
import { getConfig } from '@/lib/config'

const MAPPER_SYSTEM_PROMPT = `You are a data analyst working for Praxis, a marketing operations agency.
Your job is to scan raw client spreadsheet data and map each column to a canonical
metric from Praxis's standardized funnel models.

You will be given:
1. A funnel type: "call", "webinar", or "challenge"
2. A list of canonical metrics for that funnel type (with descriptions and aliases)
3. Raw column data from the client's spreadsheet (tab name + column headers + sample rows)

Your output must be a JSON object with this exact structure:
{
  "mappings": [
    {
      "raw_column": "exact column header from client data",
      "tab": "sheet tab name",
      "canonical_metric": "snake_case_key",
      "confidence": "direct" | "derived" | "estimated",
      "notes": "brief explanation"
    }
  ],
  "derived_metrics": [
    {
      "canonical_metric": "snake_case_key",
      "formula": "human-readable formula using canonical metric names",
      "required_metrics": ["metric_a", "metric_b"],
      "notes": "brief explanation"
    }
  ],
  "missing_metrics": ["metric_key_1", "metric_key_2"],
  "missing_notes": "Plain language explanation of what data is missing and what would fill it",
  "ambiguities": [
    {
      "raw_column": "column name",
      "tab": "tab name",
      "possible_mappings": ["metric_a", "metric_b"],
      "question": "A plain-language question to ask the human to resolve the ambiguity"
    }
  ]
}

Rules:
- Only output valid JSON. No preamble, no markdown, no explanation outside the JSON.
- If you are not at least 70% confident in a mapping, put it in "ambiguities" instead.
- For derived metrics: only include them if ALL required raw metrics are already mapped.
- "direct" confidence = column name or alias is a clear match.
- "derived" confidence = calculated from other mapped metrics; formula is deterministic.
- "estimated" confidence = reasonable guess but could be wrong; flag for human review.
- If a column could map to a standard metric but uses non-standard date logic (e.g.,
  "cumulative since launch" vs "this week"), note this clearly.
- Do not invent metrics not in the canonical list. If something is interesting but
  not canonical, note it in missing_notes as "additional data available: [column name]".

Additionally, identify:
- date_column: which column represents the time period
- period_type: "day" | "week" | "month" | "event" | "unknown"
- is_cumulative: true | false | "unknown"`

function buildMapperPrompt(
  funnelType: FunnelType,
  canonicalMetrics: CanonicalMetric[],
  rawSheetData: SheetTabData[]
): string {
  const metricsBlock = canonicalMetrics
    .map(m => `- ${m.key}: ${m.display_name} — ${m.description}. Aliases: ${m.aliases.join(', ')}`)
    .join('\n')

  const sheetsBlock = rawSheetData
    .map(tab => `
Tab: "${tab.name}"
Headers: ${tab.headers.join(' | ')}
${tab.sampleRows.map((row, i) => `Sample row ${i + 1}: ${row.join(' | ')}`).join('\n')}`)
    .join('\n')

  return `
Funnel type: ${funnelType}

CANONICAL METRICS FOR THIS FUNNEL:
${metricsBlock}

RAW CLIENT DATA:
${sheetsBlock}

Please produce the mapping JSON now.
  `.trim()
}

export async function runMetricMapper(
  funnelType: FunnelType,
  sheetData: SheetTabData[]
): Promise<MapperResult> {
  const apiKey = await getConfig('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set. Configure it at /config or Vercel env vars.')

  const metrics = getMetricsForFunnel(funnelType)
  const userPrompt = buildMapperPrompt(funnelType, metrics, sheetData)

  const mapperModel = await getConfig('METRIC_MAPPER_MODEL') || 'claude-opus-4-6'
  const maxTokens = Number(await getConfig('METRIC_MAPPER_MAX_TOKENS')) || 4000

  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model: mapperModel,
    max_tokens: maxTokens,
    system: [{ type: 'text', text: MAPPER_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userPrompt }],
  })

  const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
  const clean = rawText.replace(/```json|```/g, '').trim()

  try {
    return JSON.parse(clean) as MapperResult
  } catch (e) {
    throw new Error(`Failed to parse mapper response: ${(e as Error).message}\n\nRaw: ${clean.slice(0, 500)}`)
  }
}
