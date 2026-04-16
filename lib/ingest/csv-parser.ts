import type { SheetTabData } from '@/lib/metrics/types'

export function parseCSV(raw: string): SheetTabData {
  const lines = raw.split('\n').map(line => line.trim()).filter(Boolean)
  if (lines.length === 0) {
    return { name: 'CSV Upload', headers: [], sampleRows: [] }
  }

  // Find first non-empty row as header
  const headerLine = lines[0]
  const headers = splitCSVLine(headerLine).map(h => h.trim())

  const dataLines = lines.slice(1)
  const rows = dataLines.map(splitCSVLine)

  // Filter out rows where >80% of cells are empty (summary rows, totals, etc.)
  const validRows = rows.filter(row => {
    const nonEmpty = row.filter(cell => cell.trim() !== '').length
    return nonEmpty / Math.max(headers.length, 1) > 0.2
  })

  return {
    name: 'CSV Upload',
    headers,
    sampleRows: validRows.slice(0, 5),
  }
}

function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}
