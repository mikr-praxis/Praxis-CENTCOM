/**
 * List immediate child folders of a Drive parent folder. Used by the "Browse"
 * UI to let the user pick a client's subfolder without copying IDs from Drive.
 *
 * The service account must already be a Viewer on the parent folder.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { listChildFolders } from '@/lib/google/drive'
import { setConfig } from '@/lib/config'

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { parentId?: string; remember?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parentId = body.parentId?.trim()
  if (!parentId) {
    return NextResponse.json({ error: 'parentId is required' }, { status: 400 })
  }
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(parentId)) {
    return NextResponse.json(
      { error: 'parentId looks invalid. Paste only the ID (the part after /folders/).' },
      { status: 400 }
    )
  }

  try {
    const folders = await listChildFolders(parentId)

    // Optionally remember the parent for future calls
    if (body.remember) {
      try {
        await setConfig('DRIVE_REPORTS_PARENT_FOLDER_ID', parentId, userId)
      } catch {
        // best-effort; don't fail the whole call if config write fails
      }
    }

    return NextResponse.json({ ok: true, parentId, count: folders.length, folders })
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
