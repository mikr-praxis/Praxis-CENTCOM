import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { listFilesInFolder } from '@/lib/google/drive'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params

  const supabase = createServerClient()
  const { data: client, error } = await supabase
    .from('clients')
    .select('id, drive_folder_id')
    .eq('slug', slug)
    .single()

  if (error || !client) {
    return NextResponse.json({ error: `Client not found: ${slug}` }, { status: 404 })
  }
  if (!client.drive_folder_id) {
    return NextResponse.json({ error: 'No Drive folder configured for this client' }, { status: 400 })
  }

  try {
    const files = await listFilesInFolder(client.drive_folder_id)
    return NextResponse.json({
      ok: true,
      folderId: client.drive_folder_id,
      count: files.length,
      files: files.map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        modifiedTime: f.modifiedTime,
        size: f.size,
      })),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Drive list failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
