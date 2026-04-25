import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { suggestKPI, type FileForSuggester } from '@/lib/reporting/ai-suggest'

export const maxDuration = 60

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params

  let body: { description?: string; filenames?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const description = body.description?.trim()
  if (!description) {
    return NextResponse.json({ error: 'description is required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: client, error } = await supabase
    .from('clients')
    .select('id')
    .eq('slug', slug)
    .single()
  if (error || !client) {
    return NextResponse.json({ error: `Client not found: ${slug}` }, { status: 404 })
  }

  const filterFilenames = body.filenames && body.filenames.length > 0 ? body.filenames : null

  let query = supabase
    .from('report_raw_files')
    .select('filename, columns, rows, row_count')
    .eq('client_id', client.id)
  if (filterFilenames) {
    query = query.in('filename', filterFilenames)
  }
  const { data: rawFiles } = await query

  if (!rawFiles || rawFiles.length === 0) {
    return NextResponse.json(
      { error: 'No synced files yet. Sync the Drive folder first so the AI has data to read.' },
      { status: 400 }
    )
  }

  const files: FileForSuggester[] = rawFiles.map((f) => ({
    filename: f.filename,
    columns: Array.isArray(f.columns) ? (f.columns as string[]) : [],
    sample_rows: (Array.isArray(f.rows) ? (f.rows as Record<string, unknown>[]) : []).slice(0, 12),
  }))

  try {
    const suggestion = await suggestKPI({ description, files })
    return NextResponse.json({ ok: true, suggestion })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'AI suggestion failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
