/**
 * One-client Drive → Supabase sync. Used by both the manual "Sync Now" endpoint
 * and the weekly Vercel cron.
 *
 * Strategy:
 *  - List files in the client's Drive folder
 *  - For each file, compare modifiedTime against the row in report_raw_files
 *  - If new or changed, download + parse + upsert
 *  - Files removed from Drive are NOT deleted from Supabase (manual decision)
 */

import {
  listFilesInFolder,
  downloadFileText,
  downloadFileBytes,
  type DriveFile,
} from '@/lib/google/drive'
import { parseFileByType, MAX_CACHED_ROWS } from '@/lib/reporting/parse'
import { createServerClient } from '@/lib/supabase/server'

/** File types we know how to fetch + parse. Filenames are checked too as fallback. */
const BINARY_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.ms-excel.sheet.macroenabled.12',
])
const TEXT_MIMES = new Set([
  'text/csv',
  'application/csv',
  'text/plain',
  'text/tab-separated-values',
  'text/tsv',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.document',
])
const BINARY_EXTS = ['.xlsx', '.xls', '.xlsm']
const TEXT_EXTS = ['.csv', '.tsv', '.txt']

export interface SyncResult {
  client_id: string
  folder_id: string
  files_seen: number
  files_synced: number
  files_skipped: number
  files_unsupported: number
  errors: { file: string; error: string }[]
}

/**
 * Sync a single client's Drive folder. Returns a summary of what changed.
 */
export async function syncClientFolder(args: {
  clientId: string
  folderId: string
}): Promise<SyncResult> {
  const { clientId, folderId } = args
  const supabase = createServerClient()

  const result: SyncResult = {
    client_id: clientId,
    folder_id: folderId,
    files_seen: 0,
    files_synced: 0,
    files_skipped: 0,
    files_unsupported: 0,
    errors: [],
  }

  let files: DriveFile[] = []
  try {
    files = await listFilesInFolder(folderId)
  } catch (e) {
    result.errors.push({ file: '(list folder)', error: e instanceof Error ? e.message : String(e) })
    return result
  }

  result.files_seen = files.length

  // Look up cached files for this client to compare modifiedTime
  const { data: existingRows } = await supabase
    .from('report_raw_files')
    .select('id, drive_file_id, modified_time')
    .eq('client_id', clientId)

  const existingByFile = new Map(
    (existingRows ?? []).map((r) => [r.drive_file_id, r])
  )

  for (const file of files) {
    const cached = existingByFile.get(file.id)
    const modifiedChanged =
      !cached ||
      !cached.modified_time ||
      !file.modifiedTime ||
      new Date(file.modifiedTime).getTime() > new Date(cached.modified_time).getTime()

    if (!modifiedChanged) {
      result.files_skipped += 1
      continue
    }

    const lower = file.name.toLowerCase()
    const wantsBinary =
      BINARY_MIMES.has(file.mimeType) || BINARY_EXTS.some((ext) => lower.endsWith(ext))
    const wantsText =
      TEXT_MIMES.has(file.mimeType) ||
      file.mimeType.startsWith('text/') ||
      TEXT_EXTS.some((ext) => lower.endsWith(ext))

    let text: string | null = null
    let bytes: Buffer | null = null
    try {
      if (wantsBinary) {
        bytes = await downloadFileBytes(file.id)
      } else if (wantsText) {
        text = await downloadFileText(file.id, file.mimeType)
      } else {
        // Unknown mime + unknown extension. Try text first; if that fails (returns null),
        // try bytes — covers files Drive misreports as octet-stream.
        text = await downloadFileText(file.id, file.mimeType)
        if (text === null) bytes = await downloadFileBytes(file.id)
      }
    } catch (e) {
      result.errors.push({
        file: file.name,
        error: e instanceof Error ? e.message : String(e),
      })
      continue
    }

    if (text === null && bytes === null) {
      result.files_unsupported += 1
      continue
    }

    let parsed
    try {
      parsed = await parseFileByType({
        filename: file.name,
        mimeType: file.mimeType,
        text,
        bytes,
      })
    } catch (e) {
      result.errors.push({
        file: file.name,
        error: e instanceof Error ? e.message : String(e),
      })
      continue
    }

    if (!parsed) {
      result.files_unsupported += 1
      continue
    }

    const truncatedRows = parsed.rows.slice(0, MAX_CACHED_ROWS)

    const { error: upsertErr } = await supabase
      .from('report_raw_files')
      .upsert(
        {
          client_id: clientId,
          drive_file_id: file.id,
          filename: file.name,
          mime_type: file.mimeType,
          modified_time: file.modifiedTime,
          last_synced_at: new Date().toISOString(),
          columns: parsed.columns,
          rows: truncatedRows,
          row_count: parsed.rowCount,
        },
        { onConflict: 'client_id,drive_file_id' }
      )

    if (upsertErr) {
      result.errors.push({ file: file.name, error: upsertErr.message })
      continue
    }

    result.files_synced += 1
  }

  return result
}
