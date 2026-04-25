import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'

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
    .select('id')
    .eq('slug', slug)
    .single()
  if (error || !client) {
    return NextResponse.json({ error: `Client not found: ${slug}` }, { status: 404 })
  }
  const { data: views } = await supabase
    .from('report_views')
    .select('*')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })
  return NextResponse.json({ views: views ?? [] })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { slug } = await params

  let body: {
    name?: string
    timeframe?: Record<string, unknown>
    slicers?: Record<string, unknown>[]
    selected_filenames?: string[]
    is_default?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
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

  const { data, error: insErr } = await supabase
    .from('report_views')
    .insert({
      client_id: client.id,
      name: body.name.trim(),
      timeframe: body.timeframe ?? null,
      slicers: body.slicers ?? [],
      selected_filenames: body.selected_filenames ?? [],
      is_default: body.is_default ?? false,
      created_by: userId,
    })
    .select()
    .single()
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, view: data })
}
