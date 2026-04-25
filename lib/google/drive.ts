/**
 * Google Drive client — service-account auth, read-only.
 *
 * Uses the same GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_KEY env
 * vars as lib/ingest/sheets-client.ts. The service account must be added as
 * Viewer to the parent folder ("Client Raw Data for AI") in Drive.
 *
 * The Drive API must be enabled on the GCP project (unified-atom-492422-n5).
 */

import { google, drive_v3 } from 'googleapis'

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

function parsePrivateKey(rawKey: string): { client_email: string; private_key: string } {
  // Key is either raw JSON or base64-encoded JSON.
  try {
    return JSON.parse(rawKey)
  } catch {
    const decoded = Buffer.from(rawKey, 'base64').toString('utf-8')
    return JSON.parse(decoded)
  }
}

let _client: drive_v3.Drive | null = null

export function getDriveClient(): drive_v3.Drive {
  if (_client) return _client

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!email || !rawKey) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_KEY env vars')
  }

  const keyData = parsePrivateKey(rawKey)

  const auth = new google.auth.JWT({
    email: keyData.client_email || email,
    key: keyData.private_key,
    scopes: SCOPES,
  })

  _client = google.drive({ version: 'v3', auth })
  return _client
}

export interface DriveFolder {
  id: string
  name: string
  modifiedTime: string | null
}

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime: string | null
  size: string | null
}

/**
 * List immediate child folders of a parent folder. Used to enumerate per-client
 * subfolders inside the "Client Raw Data for AI" parent.
 */
export async function listChildFolders(parentFolderId: string): Promise<DriveFolder[]> {
  const drive = getDriveClient()
  const folders: DriveFolder[] = []
  let pageToken: string | undefined

  do {
    const res = await drive.files.list({
      q: `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'nextPageToken, files(id, name, modifiedTime)',
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })
    for (const f of res.data.files || []) {
      if (f.id && f.name) {
        folders.push({ id: f.id, name: f.name, modifiedTime: f.modifiedTime || null })
      }
    }
    pageToken = res.data.nextPageToken || undefined
  } while (pageToken)

  return folders
}

/**
 * List all non-folder files in a folder. Used to enumerate per-client raw data files.
 */
export async function listFilesInFolder(folderId: string): Promise<DriveFile[]> {
  const drive = getDriveClient()
  const files: DriveFile[] = []
  let pageToken: string | undefined

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size)',
      pageSize: 200,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })
    for (const f of res.data.files || []) {
      if (f.id && f.name) {
        files.push({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType || 'application/octet-stream',
          modifiedTime: f.modifiedTime || null,
          size: f.size || null,
        })
      }
    }
    pageToken = res.data.nextPageToken || undefined
  } while (pageToken)

  return files
}

/**
 * Download a file's content as text. Native Google file types (Sheets, Docs)
 * are exported to CSV / plain text. Other text-like files use raw download.
 * Binary types (Excel, etc.) return null — use downloadFileBytes for those.
 */
export async function downloadFileText(fileId: string, mimeType: string): Promise<string | null> {
  const drive = getDriveClient()

  // Google-native exports
  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    const res = await drive.files.export(
      { fileId, mimeType: 'text/csv' },
      { responseType: 'text' }
    )
    return typeof res.data === 'string' ? res.data : null
  }
  if (mimeType === 'application/vnd.google-apps.document') {
    const res = await drive.files.export(
      { fileId, mimeType: 'text/plain' },
      { responseType: 'text' }
    )
    return typeof res.data === 'string' ? res.data : null
  }

  // Raw download for CSV / TSV / plain text
  if (
    mimeType === 'text/csv' ||
    mimeType === 'text/plain' ||
    mimeType === 'application/csv' ||
    mimeType === 'text/tab-separated-values' ||
    mimeType === 'text/tsv'
  ) {
    const res = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'text' }
    )
    return typeof res.data === 'string' ? res.data : String(res.data ?? '')
  }

  return null
}

/**
 * Download raw bytes for binary file types (Excel etc.). Returns null if Drive
 * refused or returned non-binary. Caller is responsible for parsing.
 */
export async function downloadFileBytes(fileId: string): Promise<Buffer | null> {
  const drive = getDriveClient()
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  )
  if (!res.data) return null
  if (res.data instanceof Buffer) return res.data
  if (res.data instanceof ArrayBuffer) return Buffer.from(res.data)
  // googleapis sometimes returns a Node stream Uint8Array-like
  if (ArrayBuffer.isView(res.data)) return Buffer.from(res.data.buffer as ArrayBuffer)
  return null
}

/**
 * Get metadata for a single file by ID. Used to verify a folder ID resolves.
 */
export async function getFileMetadata(fileId: string): Promise<DriveFile | null> {
  const drive = getDriveClient()
  try {
    const res = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, modifiedTime, size',
      supportsAllDrives: true,
    })
    const f = res.data
    if (!f.id || !f.name) return null
    return {
      id: f.id,
      name: f.name,
      mimeType: f.mimeType || '',
      modifiedTime: f.modifiedTime || null,
      size: f.size || null,
    }
  } catch {
    return null
  }
}
