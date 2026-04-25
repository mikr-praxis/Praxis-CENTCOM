/**
 * Full CSV parser for the reporting sync pipeline. Unlike lib/ingest/csv-parser
 * (which only keeps sample rows), this returns every parsed row as a record
 * keyed by column name so it can be cached in Supabase and queried by the KPI
 * engine.
 */

export interface ParsedFile {
  columns: string[]
  rows: Record<string, string>[]
  rowCount: number
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

export function parseCsvFull(raw: string): ParsedFile {
  // Normalize line endings; preserve quoted multi-line content rough-and-ready
  // by relying on quote balancing across joined lines.
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rawLines = text.split('\n')

  // Re-join lines that are inside an open quote (so multi-line cells survive).
  const lines: string[] = []
  let buffer = ''
  let openQuotes = false
  for (const line of rawLines) {
    const quoteCount = (line.match(/"/g) || []).length
    if (!openQuotes) {
      if (quoteCount % 2 === 1) {
        buffer = line
        openQuotes = true
      } else {
        if (line.trim() !== '') lines.push(line)
      }
    } else {
      buffer += '\n' + line
      if (quoteCount % 2 === 1) {
        lines.push(buffer)
        buffer = ''
        openQuotes = false
      }
    }
  }
  if (buffer) lines.push(buffer)

  if (lines.length === 0) {
    return { columns: [], rows: [], rowCount: 0 }
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.trim()).filter((_, i, arr) => arr.length > 0)
  const dedupHeaders = headers.map((h, i) => (h === '' ? `col_${i + 1}` : h))

  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i])
    const nonEmpty = cells.filter((c) => c.trim() !== '').length
    // Skip near-empty / footer rows (>80% blank cells)
    if (nonEmpty / Math.max(dedupHeaders.length, 1) <= 0.2) continue

    const record: Record<string, string> = {}
    for (let c = 0; c < dedupHeaders.length; c++) {
      record[dedupHeaders[c]] = (cells[c] ?? '').trim()
    }
    rows.push(record)
  }

  return { columns: dedupHeaders, rows, rowCount: rows.length }
}

/**
 * Limit on how many rows we'll cache per file to avoid runaway memory use.
 * Files larger than this are truncated; the row_count reflects the original.
 */
export const MAX_CACHED_ROWS = 50_000
