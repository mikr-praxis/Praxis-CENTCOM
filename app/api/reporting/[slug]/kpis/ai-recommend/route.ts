import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { recommendKPISet } from '@/lib/reporting/ai-recommend'
import type { FileForSuggester } from '@/lib/reporting/ai-suggest'

export const maxDuration = 90

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params

  let body: { filenames?: string[]; context?: string; count?: number } = {}
  try {
    body = await request.json()
  } catch {
    /* empty body OK */
  }

  const supabase = createServerClient()
  const { data: client, error } = await supabase
    .from('clients')
    .select('id, name')
    .eq('slug', slug)
    .single()
  if (error || !client) {
    return NextResponse.json({ error: `Client not found: ${slug}` }, { status: 404 })
  }

  let q = supabase
    .from('report_raw_files')
    .select('filename, columns, rows')
    .eq('client_id', client.id)
  if (body.filenames && body.filenames.length > 0) {
    q = q.in('filename', body.filenames)
  }
  const { data: rawFiles } = await q

  if (!rawFiles || rawFiles.length === 0) {
    return NextResponse.json(
      { error: 'No synced files yet. Sync the Drive folder first.' },
      { status: 400 }
    )
  }

  const files: FileForSuggester[] = rawFiles.map((f) => ({
    filename: f.filename,
    columns: Array.isArray(f.columns) ? (f.columns as string[]) : [],
    sample_rows: (Array.isArray(f.rows) ? (f.rows as Record<string, unknown>[]) : []).slice(0, 12),
  }))

  try {
    const suggestions = await recommendKPISet({
      files,
      context: body.context || `Client: ${client.name}`,
      count: body.count,
    })
    return NextResponse.json({ ok: true, suggestions })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'AI recommendation failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
