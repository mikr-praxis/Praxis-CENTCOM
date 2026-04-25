/**
 * List immediate child folders of a Drive parent folder. Used by the "Browse"
 * UI to let the user pick a client's subfolder without copying IDs from Drive.
 *
 * The service account must already be a Viewer on the parent folder.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { listChildFolders, getFileMetadata } from '@/lib/google/drive'
import { setConfig } from '@/lib/config'

/**
 * Accept either a raw Drive folder ID or a full Drive URL and return the ID.
 * Strips query strings and trailing slashes; matches the /folders/<ID> pattern.
 */
function extractFolderId(input: string): string | null {
  if (!input) return null
  const m = input.match(/\/folders\/([a-zA-Z0-9_-]{10,})/)
  if (m) return m[1]
  // Fallback: strip query/fragment then validate raw ID
  const cleaned = input.split('?')[0].split('#')[0].replace(/\/+$/, '').trim()
  if (/^[a-zA-Z0-9_-]{10,}$/.test(cleaned)) return cleaned
  return null
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { parentId?: string; remember?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const raw = body.parentId?.trim() ?? ''
  const parentId = extractFolderId(raw)
  if (!parentId) {
    return NextResponse.json(
      { error: 'parentId looks invalid. Paste a Drive folder URL or the raw ID.' },
      { status: 400 }
    )
  }

  try {
    const folders = await listChildFolders(parentId)

    // Optionally remember the parent for future calls
    if (body.remember && folders.length > 0) {
      try {
        await setConfig('DRIVE_REPORTS_PARENT_FOLDER_ID', parentId, userId)
      } catch {
        // best-effort; don't fail the whole call if config write fails
      }
    }

    // If 0 folders, try to fetch metadata so we can tell the user *why*
    let meta: { name: string; mimeType: string } | null = null
    if (folders.length === 0) {
      const m = await getFileMetadata(parentId)
      if (m) meta = { name: m.name, mimeType: m.mimeType }
    }

    return NextResponse.json({
      ok: true,
      parentId,
      count: folders.length,
      folders,
      meta,
      hint:
        folders.length === 0
          ? meta
            ? `Folder "${meta.name}" has no subfolders. If this IS the client's data folder, paste this ID into the "Drive folder" field above instead of "Browse".`
            : 'No folders found. The service account may not have access to this folder, or the ID is wrong.'
          : null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Drive list failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Convenience GET for browser testing — uses the saved parent ID from app_config
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { getConfig } = await import('@/lib/config')
  const parentId = await getConfig('DRIVE_REPORTS_PARENT_FOLDER_ID')
  if (!parentId) {
    return NextResponse.json(
      { error: 'No parent folder saved yet. Use POST with a parentId to discover folders.' },
      { status: 400 }
    )
  }

  try {
    const folders = await listChildFolders(parentId)
    return NextResponse.json({ ok: true, parentId, count: folders.length, folders })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Drive list failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
