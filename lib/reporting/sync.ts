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

import { listFilesInFolder, downloadFileText, type DriveFile } from '@/lib/google/drive'
import { parseCsvFull, MAX_CACHED_ROWS } from '@/lib/reporting/parse'
import { createServerClient } from '@/lib/supabase/server'

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

    let text: string | null = null
    try {
      text = await downloadFileText(file.id, file.mimeType)
    } catch (e) {
      result.errors.push({
        file: file.name,
        error: e instanceof Error ? e.message : String(e),
      })
      continue
    }

    if (text === null) {
      result.files_unsupported += 1
      continue
    }

    const parsed = parseCsvFull(text)
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
