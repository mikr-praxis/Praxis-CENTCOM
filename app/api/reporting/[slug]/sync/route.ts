import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { syncClientFolder } from '@/lib/reporting/sync'
import { notifySyncComplete } from '@/lib/reporting/notify'

export const maxDuration = 300 // up to 5 min for large folder sync

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params

  const supabase = createServerClient()
  const { data: client, error } = await supabase
    .from('clients')
    .select('id, name, drive_folder_id')
    .eq('slug', slug)
    .single()

  if (error || !client) {
    return NextResponse.json({ error: `Client not found: ${slug}` }, { status: 404 })
  }
  if (!client.drive_folder_id) {
    return NextResponse.json(
      { error: 'No Drive folder configured for this client' },
      { status: 400 }
    )
  }

  try {
    const result = await syncClientFolder({
      clientId: client.id,
      folderId: client.drive_folder_id,
    })
    // Best-effort Slack notification (no-op if channel unset)
    await notifySyncComplete({ clientName: client.name, results: [result] })
    return NextResponse.json({ ok: true, result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Sync failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
