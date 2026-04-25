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
 * Default cap on rows cached per file. The actual cap is read from app_config
 * via getReportingMaxCachedRows() at sync time.
 */
export const DEFAULT_MAX_CACHED_ROWS = 50_000

/**
 * TSV parser — same shape as CSV, tab-delimited, no quote handling needed for v1.
 */
export function parseTsvFull(raw: string): ParsedFile {
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = text.split('\n').filter((l) => l.trim() !== '')
  if (lines.length === 0) return { columns: [], rows: [], rowCount: 0 }

  const headers = lines[0].split('\t').map((h) => h.trim())
  const dedupHeaders = headers.map((h, i) => (h === '' ? `col_${i + 1}` : h))

  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split('\t')
    const nonEmpty = cells.filter((c) => c.trim() !== '').length
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
 * Parse Excel (.xlsx, .xls) buffer using SheetJS. Picks the first non-empty
 * sheet. Returns the same ParsedFile shape so the rest of the pipeline is
 * format-agnostic.
 */
export async function parseXlsxBuffer(buffer: Buffer): Promise<ParsedFile> {
  // Lazy-import to keep cold-start light on routes that don't touch Excel
  const XLSX = await import('xlsx')

  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false })
  if (!workbook.SheetNames.length) {
    return { columns: [], rows: [], rowCount: 0 }
  }

  // Pick first non-empty sheet
  let sheetName = workbook.SheetNames[0]
  for (const name of workbook.SheetNames) {
    const ref = workbook.Sheets[name]['!ref']
    if (ref) {
      sheetName = name
      break
    }
  }
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return { columns: [], rows: [], rowCount: 0 }

  // Convert to array-of-arrays so we can run the same empty-row-skip pass as CSV
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false,
  })

  if (!aoa.length) return { columns: [], rows: [], rowCount: 0 }

  // First non-empty row is the header
  const headerRowIndex = aoa.findIndex((row) => row.some((c) => String(c ?? '').trim() !== ''))
  if (headerRowIndex === -1) return { columns: [], rows: [], rowCount: 0 }

  const headers = (aoa[headerRowIndex] as unknown[]).map((h) => String(h ?? '').trim())
  const dedupHeaders = headers.map((h, i) => (h === '' ? `col_${i + 1}` : h))

  const rows: Record<string, string>[] = []
  for (let i = headerRowIndex + 1; i < aoa.length; i++) {
    const cells = aoa[i] as unknown[]
    const cellStrs = cells.map((c) => String(c ?? '').trim())
    const nonEmpty = cellStrs.filter((c) => c !== '').length
    if (nonEmpty / Math.max(dedupHeaders.length, 1) <= 0.2) continue
    const record: Record<string, string> = {}
    for (let c = 0; c < dedupHeaders.length; c++) {
      record[dedupHeaders[c]] = cellStrs[c] ?? ''
    }
    rows.push(record)
  }

  return { columns: dedupHeaders, rows, rowCount: rows.length }
}

/**
 * Dispatch parser by mime type and filename. Returns null for unsupported types.
 */
export async function parseFileByType(args: {
  filename: string
  mimeType: string | null
  text: string | null
  bytes: Buffer | null
}): Promise<ParsedFile | null> {
  const { filename, mimeType, text, bytes } = args
  const lower = filename.toLowerCase()
  const mt = mimeType ?? ''

  // Excel
  const isXlsxMime =
    mt === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mt === 'application/vnd.ms-excel' ||
    mt === 'application/vnd.ms-excel.sheet.macroenabled.12'
  if (isXlsxMime || lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.xlsm')) {
    if (!bytes) return null
    return parseXlsxBuffer(bytes)
  }

  // TSV
  if (mt === 'text/tab-separated-values' || mt === 'text/tsv' || lower.endsWith('.tsv')) {
    if (!text) return null
    return parseTsvFull(text)
  }

  // CSV / plain text / Google native exports
  if (text != null) {
    return parseCsvFull(text)
  }

  // octet-stream with a known extension — best-effort dispatch
  if ((mt === 'application/octet-stream' || mt === '') && bytes) {
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.xlsm')) {
      return parseXlsxBuffer(bytes)
    }
    // Try as text
    const decoded = bytes.toString('utf8')
    if (lower.endsWith('.tsv')) return parseTsvFull(decoded)
    return parseCsvFull(decoded)
  }

  return null
}
