import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params

  let body: { drive_folder_id?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const folderId = body.drive_folder_id?.trim() || null
  if (folderId !== null && !/^[a-zA-Z0-9_-]{10,}$/.test(folderId)) {
    return NextResponse.json(
      { error: 'Folder ID looks invalid. Paste only the ID (the part after /folders/).' },
      { status: 400 }
    )
  }

  const supabase = createServerClient()
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id')
    .eq('slug', slug)
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ error: `Client not found: ${slug}` }, { status: 404 })
  }

  const { error: updateErr } = await supabase
    .from('clients')
    .update({ drive_folder_id: folderId })
    .eq('id', client.id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, drive_folder_id: folderId })
}
